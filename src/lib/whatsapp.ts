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

const ADMIN_WHATSAPP_PHONE = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_PHONE || '919829012345';

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
