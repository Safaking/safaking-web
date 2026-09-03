// Server-only — reads RESEND_API_KEY (no NEXT_PUBLIC_ prefix), never bundled to the client.
// Sends from Resend's shared test domain until safaking.in is verified in the
// Resend dashboard; swap RESEND_FROM once that's done.
const RESEND_FROM = process.env.RESEND_FROM || 'SafaKing <onboarding@resend.dev>';

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`RESEND_API_KEY not set — skipping email "${subject}".`);
    return { ok: false, skipped: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Resend send failed:', res.status, body);
    return { ok: false, error: body || `Resend responded ${res.status}` };
  }

  return { ok: true };
}

export async function sendArtistApprovedEmail({ to, name }: { to: string; name: string }) {
  return sendEmail({
    to,
    subject: "You're approved — SafaKing Master Artist Network",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#7a1f2b">Welcome to the Network, ${name}!</h2>
        <p>Your Safa Artist application has been reviewed and <strong>approved</strong>.</p>
        <p>You can now sign in to your Artist Portal to accept bookings, track earnings, and manage your profile.</p>
        <p style="margin-top:24px">
          <a href="https://www.safaking.in/artist-portal/login"
             style="background:#7a1f2b;color:#f5d98e;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
            Sign In to Artist Portal
          </a>
        </p>
        <p style="color:#888;font-size:12px;margin-top:32px">SafaKing &middot; Master Artist Network</p>
      </div>
    `,
  });
}

export async function sendArtistBookingOfferEmail({
  to, name, eventDate, cityVenue, safaStyle,
}: { to: string; name: string; eventDate: string; cityVenue: string; safaStyle: string }) {
  return sendEmail({
    to,
    subject: 'New booking offer — action needed on SafaKing',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#7a1f2b">New Booking Offer, ${name}</h2>
        <p>You've been offered a <strong>${safaStyle}</strong> booking:</p>
        <ul style="color:#333">
          <li><strong>Date:</strong> ${eventDate}</li>
          <li><strong>Venue:</strong> ${cityVenue}</li>
        </ul>
        <p>Sign in to your Artist Portal to accept or decline — declining lets us offer it to another artist right away.</p>
        <p style="margin-top:24px">
          <a href="https://www.safaking.in/artist-portal"
             style="background:#7a1f2b;color:#f5d98e;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
            View Offer
          </a>
        </p>
        <p style="color:#888;font-size:12px;margin-top:32px">SafaKing &middot; Master Artist Network</p>
      </div>
    `,
  });
}
