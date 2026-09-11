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
        <p>One step is left before you can receive bookings: sign in to your Artist Portal and
           upload your <strong>KYC documents</strong> (ID proof and photo) under
           <em>Verification &amp; Documents</em>. Our team approves them within a working day.</p>
        <p style="background:#fff7e6;border:1px solid #f0c96a;border-radius:8px;padding:12px;font-size:14px">
          Until your KYC is approved you will not be offered any booking and cannot send quotes on
          customer enquiries.
        </p>
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

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Operations: an artist incident that needs someone to act. */
export async function sendOpsIncidentEmail({
  to, artistName, incident, reason, eventDate, customerName, backupCount, freed,
}: {
  to: string; artistName: string; incident: string; reason: string; eventDate: string;
  customerName: string; backupCount: number; freed: boolean;
}) {
  return sendEmail({
    to,
    subject: `Artist incident: ${artistName} — ${incident} (${eventDate})`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#9b0f2c">${escapeHtml(incident)}</h2>
        <p><strong>${escapeHtml(artistName)}</strong> · booking for ${escapeHtml(customerName)} on ${escapeHtml(eventDate)}</p>
        <p style="background:#fbe6ea;border-radius:8px;padding:12px">${escapeHtml(reason)}</p>
        ${freed
          ? `<p>The booking has been freed for a replacement. <strong>${backupCount}</strong> backup artist${backupCount === 1 ? '' : 's'} were found.</p>`
          : '<p>Recorded on the artist’s standing. The booking is unchanged.</p>'}
        <p style="margin-top:24px">
          <a href="https://www.safaking.in/admin" style="background:#7a1f2b;color:#f5d98e;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
            Open Live Ops
          </a>
        </p>
      </div>
    `,
  });
}

/** Customer: the artist changed, the booking did not. */
export async function sendCustomerReplacementEmail({ to, name, eventDate }: { to: string; name: string; eventDate: string }) {
  return sendEmail({
    to,
    subject: 'Your SafaKing booking is safe — we are arranging your artist',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#7a1f2b">Namaste ${escapeHtml(name)},</h2>
        <p>The artist originally arranged for your event on <strong>${escapeHtml(eventDate)}</strong> is no longer able to come.</p>
        <p><strong>Your booking stands.</strong> Our team is arranging another verified artist for you now, and you will see them confirmed in My Bookings.</p>
        <p>If anything is urgent, call us on +91 90013 47143.</p>
        <p style="color:#888;font-size:12px;margin-top:32px">SafaKing &middot; Royal Turban House</p>
      </div>
    `,
  });
}
