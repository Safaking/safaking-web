/**
 * SafaKing WhatsApp Notification Helper
 * Supports Twilio WhatsApp API, Wati, UltraMsg, and WhatsApp Click-to-Chat links.
 */

export interface WhatsAppOrderNotification {
  orderId: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  shippingAddress: string;
  items?: string;
}

export interface WhatsAppBookingNotification {
  bookingId: string;
  customerName: string;
  customerPhone: string;
  cityVenue: string;
  eventDate: string;
  safaStyle: string;
}

/**
 * Formats a message for WhatsApp
 */
export function formatOrderWhatsAppMessage(data: WhatsAppOrderNotification): string {
  const ref = data.orderId.slice(0, 8).toUpperCase();
  return (
    `👑 *NEW SAFAKING ORDER RECEIVED!*\n\n` +
    `*Order Ref:* #${ref}\n` +
    `*Customer:* ${data.customerName}\n` +
    `*Phone:* ${data.customerPhone}\n` +
    `*Total Amount:* ₹${data.totalAmount.toLocaleString()}\n` +
    `*Address:* ${data.shippingAddress}\n\n` +
    `*Action:* Please review in Admin Panel & Confirm.`
  );
}

export function formatBookingWhatsAppMessage(data: WhatsAppBookingNotification): string {
  return (
    `👑 *NEW SAFA ARTIST BOOKING!*\n\n` +
    `*Customer:* ${data.customerName}\n` +
    `*Phone:* ${data.customerPhone}\n` +
    `*Event Date:* ${data.eventDate}\n` +
    `*Venue/City:* ${data.cityVenue}\n` +
    `*Safa Style:* ${data.safaStyle}\n\n` +
    `*Action:* Please assign a Safa Artist in Admin Panel.`
  );
}

/**
 * Generates a direct WhatsApp link to send a message to Admin or Customer
 */
export function getWhatsAppClickLink(phone: string, text: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

/**
 * Sends a WhatsApp Notification via API Endpoint
 */
export async function sendWhatsAppNotification(
  type: 'order' | 'booking',
  payload: WhatsAppOrderNotification | WhatsAppBookingNotification
) {
  try {
    const response = await fetch('/api/notifications/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    });
    return await response.json();
  } catch (err) {
    console.warn('WhatsApp Notification dispatch fallback:', err);
    return { success: false, error: err };
  }
}

// ---------------------------------------------------------------------------
// Messages to the customer and the artist.
//
// These are not sent by a robot: staff press a button in Admin, WhatsApp opens
// with the message already typed, and they send it themselves. That keeps it
// free and needs no DLT registration or WhatsApp Business API.
// ---------------------------------------------------------------------------

/** The shape every prepared message has: a label for the button, and the text. */
export interface WhatsAppDraft {
  label: string;
  text: string;
}

const ref = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;
const money = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`;

/** 15 Nov 2026, from either a date or an ISO string. */
export function prettyDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const sign = (phone: string) => `\n\nSafaKing · Royal Turban House\n${phone}`;

export interface BookingDraftInput {
  id: string;
  customerName: string;
  eventDate: string;
  cityVenue: string;
  safaStyle: string;
  amount: number;
  balanceAmount?: number | null;
  artistName?: string | null;
  artistPhone?: string | null;
  businessPhone: string;
}

/** Ready messages for an artist booking, in the order they are usually needed. */
export function bookingDrafts(booking: BookingDraftInput): WhatsAppDraft[] {
  const name = booking.customerName.split(' ')[0] || 'ji';
  const when = prettyDate(booking.eventDate);
  const drafts: WhatsAppDraft[] = [
    {
      label: 'Booking confirmed',
      text:
        `Namaste ${name} 🙏\n\nYour SafaKing booking is confirmed.\n\n` +
        `Date: ${when}\nStyle: ${booking.safaStyle}\nVenue: ${booking.cityVenue}\n` +
        `Booking no: ${ref(booking.id)}\n\n` +
        `We will tell you your artist's name and number before the day.` +
        sign(booking.businessPhone),
    },
  ];

  if (booking.artistName) {
    drafts.push({
      label: 'Artist assigned',
      text:
        `Namaste ${name} 🙏\n\nYour safa artist for ${when} is ${booking.artistName}.\n` +
        (booking.artistPhone ? `You can reach them on ${booking.artistPhone}.\n` : '') +
        `\nThey will reach ${booking.cityVenue} in good time and tie your ${booking.safaStyle}.` +
        sign(booking.businessPhone),
    });
  }

  if (booking.balanceAmount && booking.balanceAmount > 0) {
    drafts.push({
      label: 'Balance reminder',
      text:
        `Namaste ${name} 🙏\n\nA gentle reminder for booking ${ref(booking.id)} on ${when}:\n` +
        `Balance due: ${money(booking.balanceAmount)}\n\n` +
        `It can be paid before the event or on the day, to SafaKing only — never to the artist.` +
        sign(booking.businessPhone),
    });
  }

  drafts.push({
    label: 'Day before reminder',
    text:
      `Namaste ${name} 🙏\n\nYour safa tying is tomorrow, ${when}, at ${booking.cityVenue}.\n` +
      (booking.artistName ? `${booking.artistName} will be there.\n` : '') +
      `\nPlease keep the safa cloth and accessories ready. Anything urgent, call us.` +
      sign(booking.businessPhone),
  });

  return drafts;
}

export interface OrderDraftInput {
  id: string;
  customerName: string;
  totalAmount: number;
  balanceAmount?: number | null;
  status: string;
  businessPhone: string;
}

/** Ready messages for a shop order. */
export function orderDrafts(order: OrderDraftInput): WhatsAppDraft[] {
  const name = order.customerName.split(' ')[0] || 'ji';
  const drafts: WhatsAppDraft[] = [
    {
      label: 'Order confirmed',
      text:
        `Namaste ${name} 🙏\n\nWe have your SafaKing order ${ref(order.id)}.\n` +
        `Total: ${money(order.totalAmount)}\n\n` +
        `We are packing it now and will send the courier details once it is on its way.` +
        sign(order.businessPhone),
    },
    {
      label: 'Order dispatched',
      text:
        `Namaste ${name} 🙏\n\nYour order ${ref(order.id)} has been dispatched.\n\n` +
        `Courier: \nTracking no: \n\n` +
        `(Please fill the courier and tracking number before sending.)` +
        sign(order.businessPhone),
    },
    {
      label: 'Delivered — thank you',
      text:
        `Namaste ${name} 🙏\n\nWe hope your safa reached you well.\n\n` +
        `If anything is not right, tell us and we will set it right. ` +
        `And if you liked it, a word to your friends means a lot to us. 👑` +
        sign(order.businessPhone),
    },
  ];

  if (order.balanceAmount && order.balanceAmount > 0) {
    drafts.splice(1, 0, {
      label: 'Balance reminder',
      text:
        `Namaste ${name} 🙏\n\nOrder ${ref(order.id)}:\nBalance due: ${money(order.balanceAmount)}\n\n` +
        `We send the safa once the balance is received.` +
        sign(order.businessPhone),
    });
  }

  return drafts;
}

/** The message that goes to the artist about a job. */
export function artistJobDraft(input: {
  artistName: string;
  eventDate: string;
  cityVenue: string;
  safaStyle: string;
  payout?: number | null;
  businessPhone: string;
}): WhatsAppDraft {
  const name = input.artistName.split(' ')[0] || 'ji';
  return {
    label: 'Tell the artist',
    text:
      `Namaste ${name} 🙏\n\nA SafaKing job for you:\n\n` +
      `Date: ${prettyDate(input.eventDate)}\nVenue: ${input.cityVenue}\nStyle: ${input.safaStyle}\n` +
      (input.payout ? `Your payout: ${money(input.payout)}\n` : '') +
      `\nOpen the SafaKing artist portal to accept it.` +
      sign(input.businessPhone),
  };
}
