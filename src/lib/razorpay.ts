import crypto from 'node:crypto';

/**
 * Razorpay helpers. SERVER ONLY — this module reads the key secret.
 *
 * Uses the REST API directly rather than the `razorpay` npm package: the two
 * calls we need are a POST and an HMAC, and this keeps the dependency surface
 * (and the bundle) unchanged.
 */

const RAZORPAY_API = 'https://api.razorpay.com/v1';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      'Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET. Add them to .env.local ' +
        'from Razorpay Dashboard -> Settings -> API Keys. Use the rzp_test_ ' +
        'pair until you are ready to take live payments.'
    );
  }
  return { keyId, keySecret };
}

/** The publishable key id, safe to hand to the browser checkout widget. */
export function publicKeyId(): string {
  return credentials().keyId;
}

/**
 * Creates a Razorpay order.
 * @param amountPaise Amount in paise (₹1 = 100). Razorpay rejects decimals.
 */
export async function createRazorpayOrder(
  amountPaise: number,
  receipt: string,
  notes: Record<string, string> = {}
): Promise<RazorpayOrder> {
  const { keyId, keySecret } = credentials();

  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    throw new Error(`Invalid amount: ${amountPaise} paise (minimum is 100 = ₹1)`);
  }

  const response = await fetch(`${RAZORPAY_API}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: receipt.slice(0, 40), // Razorpay caps receipt at 40 chars
      notes,
    }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `Razorpay order creation failed: ${body?.error?.description ?? response.statusText}`
    );
  }
  return body as RazorpayOrder;
}

/**
 * Verifies the checkout callback signature.
 *
 * Razorpay signs `${razorpay_order_id}|${razorpay_payment_id}` with the key
 * secret. Without this check a customer could POST a fabricated success and
 * mark an unpaid order as paid.
 *
 * Compared in constant time to avoid leaking the expected digest by timing.
 */
export function verifyPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  const { keySecret } = credentials();

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest('hex');

  const received = params.signature ?? '';
  if (expected.length !== received.length) return false;

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

/** Rupees -> paise, guarding against float drift (₹40.1 * 100 = 4009.99…). */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
