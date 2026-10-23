import type { Metadata } from 'next';
import { ReferralLanding } from './ReferralLanding';

/**
 * Where a referral QR lands.
 *
 * The code is in the address rather than a query string so the whole thing
 * fits a small, sharp QR — and so the link reads as an invitation rather than
 * as tracking.
 *
 * Nothing is claimed here. The code is only remembered; it attaches to an
 * account the moment there is one, because the person scanning this usually
 * has no account yet and often not even the app.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const clean = code.toUpperCase().slice(0, 16);
  return {
    title: `Join SafaKing with code ${clean}`,
    description: 'Royal safas, delivered across India. Use this code and get credit off your first order.',
    // One person's invitation is not a page for search results.
    robots: { index: false, follow: false },
  };
}

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ReferralLanding code={code.toUpperCase().slice(0, 16)} />;
}
