'use client';

import type { CartItem } from '@/context/CartContext';
import { Capacitor } from '@capacitor/core';

/**
 * Client half of the Razorpay flow.
 *
 * Deliberately carries no prices: it sends product ids and quantities, and the
 * server decides what everything costs. The figures it gets back are the
 * server's, and those are what the UI shows.
 */

export interface CheckoutCustomer {
  name: string;
  phone: string;
  address: string;
  pincode: string;
}

export interface CreatedOrder {
  orderId: string;
  razorpayOrderId: string;
  amount: number; // paise
  currency: string;
  keyId: string;
  totalAmount: number;
  advanceAmount: number;
  balanceAmount: number;
  /** Fraction taken up front, as configured by the admin. */
  advanceRate: number;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): { open: () => void };
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * A dropped connection or a mid-deploy server restart surfaces to `fetch()`
 * as a raw `TypeError: Failed to fetch` — accurate, but meaningless to a
 * customer mid-checkout. Every server call in this file goes through here so
 * they see "try again" instead of a JS error class name.
 */
async function postJson<T>(url: string, body: unknown, fallbackError: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach our servers. Please check your connection and try again.');
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(fallbackError);
  }

  if (!response.ok) {
    const message = (parsed as { error?: string } | null)?.error ?? fallbackError;
    throw new Error(message);
  }
  return parsed as T;
}

/** Loads Razorpay's widget once, resolving if it is already present. Not needed on native — that path uses the native SDK instead. */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (Capacitor.isNativePlatform()) return resolve(true);
    if (window.Razorpay) return resolve(true);

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function createOrder(
  items: CartItem[],
  customer: CheckoutCustomer
): Promise<CreatedOrder> {
  return postJson<CreatedOrder>(
    '/api/checkout/create-order',
    {
      // Only identity and quantity travel. No prices.
      items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      customerName: customer.name,
      customerPhone: customer.phone,
      shippingAddress: customer.address,
      pincode: customer.pincode,
    },
    'Could not start checkout.'
  );
}

export interface PaymentOutcome {
  orderId: string | null;
  rentalId?: string | null;
  warning?: string;
}

/** Everything the Razorpay widget needs, regardless of what is being paid for. */
export interface PayableOrder {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  /** Shown on the Razorpay panel. */
  reference: string;
  description: string;
}

export interface RentalQuoteLine {
  productId: string;
  name: string;
  quantity: number;
  unitRentPerDay: number;
  unitDeposit: number;
  lineRent: number;
  lineDeposit: number;
  available: number;
}

export interface RentalQuote {
  startDate: string;
  endDate: string;
  days: number;
  safaCount: number;
  lines: RentalQuoteLine[];
  rentAmount: number;
  depositAmount: number;
  artistAmount: number;
  totalAmount: number;
  advanceAmount: number;
  balanceAmount: number;
  needsArtist: boolean;
  artistPerSafaRate: number;
}

export interface RentalSelection {
  startDate: string;
  endDate: string;
  items: { productId: string; quantity: number }[];
  needsArtist: boolean;
}

export interface RentalCustomer {
  name: string;
  phone: string;
  venueAddress: string;
  city?: string;
  pincode: string;
}

export interface CreatedRental {
  rentalId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  quote: RentalQuote;
}

/** Live price + availability preview. Writes nothing. */
export async function quoteRental(selection: RentalSelection): Promise<RentalQuote> {
  return postJson<RentalQuote>('/api/rentals/quote', selection, 'Could not price this rental.');
}

export async function createRental(
  selection: RentalSelection,
  customer: RentalCustomer
): Promise<CreatedRental> {
  return postJson<CreatedRental>(
    '/api/rentals/create-order',
    {
      ...selection,
      customerName: customer.name,
      customerPhone: customer.phone,
      venueAddress: customer.venueAddress,
      city: customer.city,
      pincode: customer.pincode,
    },
    'Could not start the rental booking.'
  );
}

/** POSTs the payment response to our server and resolves/rejects on the same terms as the web handler. */
async function verifyAndResolve(response: RazorpayResponse): Promise<PaymentOutcome> {
  try {
    const verifyRes = await fetch('/api/checkout/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    });
    const verifyBody = await verifyRes.json();

    if (!verifyRes.ok || !verifyBody.success) {
      throw new Error(
        verifyBody?.error ??
          'We could not verify your payment. Do not retry — contact us with your payment id.'
      );
    }
    return {
      orderId: verifyBody.orderId ?? null,
      rentalId: verifyBody.rentalId ?? null,
      warning: verifyBody.warning,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('could not verify')) throw err;
    throw new Error(
      'Payment went through but confirmation failed. Please contact us before paying again.'
    );
  }
}

/**
 * Opens Razorpay's native Android checkout (via the `capacitor-razorpay` bridge
 * to Razorpay's Standard Checkout SDK) and resolves once the server has
 * verified the signature. `checkout.js`'s browser-only bits — UPI app hand-off,
 * OTP popups — don't reliably work inside a bare WebView, so the Android build
 * goes through Razorpay's native SDK instead; the server-side verification is
 * identical either way.
 */
async function payAndVerifyNative(
  order: PayableOrder,
  customer: { name: string; phone: string }
): Promise<PaymentOutcome> {
  const { Checkout } = await import('capacitor-razorpay');
  try {
    // The plugin's TS definitions only declare {key, amount}, but its native
    // side (and README) accept the full Razorpay Standard Checkout option set —
    // passed via a variable, not an inline literal, so TS's excess-property
    // check doesn't reject the extra fields it structurally still accepts.
    const options = {
      key: order.keyId,
      amount: String(order.amount),
      currency: order.currency,
      order_id: order.razorpayOrderId,
      name: 'SafaKing',
      description: order.description,
      prefill: { contact: customer.phone, email: '' },
      theme: { color: '#4A0E1A' },
    };
    const result = await Checkout.open(options);
    const response = result.response as unknown as RazorpayResponse;
    return await verifyAndResolve(response);
  } catch (err) {
    if (err instanceof Error && err.message.includes('confirmation failed')) throw err;
    if (err instanceof Error && err.message.includes('could not verify')) throw err;
    throw new Error('Payment cancelled. Your bag has been kept — you can try again.');
  }
}

/**
 * Opens the Razorpay widget and resolves once the server has verified the
 * signature. Rejects if the customer dismisses the widget or verification fails.
 */
export function payAndVerify(
  order: PayableOrder,
  customer: { name: string; phone: string }
): Promise<PaymentOutcome> {
  if (Capacitor.isNativePlatform()) {
    return payAndVerifyNative(order, customer);
  }

  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      return reject(new Error('Payment widget failed to load. Check your connection and retry.'));
    }

    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.razorpayOrderId,
      name: 'SafaKing',
      description: order.description,
      prefill: { name: customer.name, contact: customer.phone },
      notes: { safaking_reference: order.reference },
      theme: { color: '#4A0E1A' },
      modal: {
        ondismiss: () =>
          reject(new Error('Payment cancelled. Your bag has been kept — you can try again.')),
      },
      handler: async (response: RazorpayResponse) => {
        try {
          resolve(await verifyAndResolve(response));
        } catch (err) {
          reject(err);
        }
      },
    });

    checkout.open();
  });
}


/** Adapts a purchase order to the shared Razorpay payload. */
export function payableFromOrder(order: CreatedOrder): PayableOrder {
  return {
    razorpayOrderId: order.razorpayOrderId,
    amount: order.amount,
    currency: order.currency,
    keyId: order.keyId,
    reference: order.orderId,
    description: `Advance ${Math.round(order.advanceRate * 100)}% · Order ${order.orderId
      .slice(0, 8)
      .toUpperCase()}`,
  };
}

/** Adapts a rental booking to the shared Razorpay payload. */
export function payableFromRental(rental: CreatedRental): PayableOrder {
  return {
    razorpayOrderId: rental.razorpayOrderId,
    amount: rental.amount,
    currency: rental.currency,
    keyId: rental.keyId,
    reference: rental.rentalId,
    description: `Rental advance · ${rental.quote.safaCount} safa(s) · ${rental.quote.days} day(s)`,
  };
}
