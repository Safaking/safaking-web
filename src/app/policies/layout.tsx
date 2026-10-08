import type { Metadata } from 'next';

/**
 * Page title and description for search results and link previews.
 *
 * It lives in a layout because the page itself is a client component, and a
 * client component cannot export metadata. Without this the page inherited
 * the site-wide title, so every page looked identical to Google.
 */
export const metadata: Metadata = {
  title: 'Policies: booking, cancellation and refunds',
  description:
    'SafaKing\'s booking, payment, cancellation and refund rules — read live from the same settings that run every booking.',
  alternates: { canonical: '/policies' },
  openGraph: {
    title: 'Policies: booking, cancellation and refunds · SafaKing',
    description: 'SafaKing\'s booking, payment, cancellation and refund rules — read live from the same settings that run every booking.',
    url: '/policies',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
