import { NextResponse } from 'next/server';
import {
  formatOrderWhatsAppMessage,
  formatBookingWhatsAppMessage,
} from '@/lib/whatsapp';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, payload } = body;

    const message =
      type === 'order'
        ? formatOrderWhatsAppMessage(payload)
        : formatBookingWhatsAppMessage(payload);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
    const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_PHONE || '919829012345';

    // If Twilio credentials exist, send via Twilio API
    if (accountSid && authToken) {
      const toWhatsApp = `whatsapp:${adminPhone.startsWith('+') ? adminPhone : '+' + adminPhone}`;
      const params = new URLSearchParams({
        From: fromWhatsApp,
        To: toWhatsApp,
        Body: message,
      });

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          },
          body: params.toString(),
        }
      );

      const twilioData = await twilioRes.json();
      return NextResponse.json({ success: true, provider: 'twilio', data: twilioData });
    }

    // Fallback response with formatted message if Twilio credentials are not set yet
    return NextResponse.json({
      success: true,
      provider: 'ready',
      message: 'WhatsApp notification payload formatted successfully.',
      formattedText: message,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'WhatsApp notification failed' },
      { status: 500 }
    );
  }
}
