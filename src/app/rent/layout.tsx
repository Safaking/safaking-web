import type { Metadata } from 'next';

/**
 * Page title and description for search results and link previews.
 *
 * It lives in a layout because the page itself is a client component, and a
 * client component cannot export metadata. Without this the page inherited
 * the site-wide title, so every page looked identical to Google.
 */
export const metadata: Metadata = {
  title: 'Safas on rent',
  description:
    'Rent wedding safas by the day with a refundable deposit, and add an artist to tie them for your baraat. Prices shown before you pay.',
  alternates: { canonical: '/rent' },
  openGraph: {
    title: 'Safas on rent · SafaKing',
    description: 'Rent wedding safas by the day with a refundable deposit, and add an artist to tie them for your baraat. Prices shown before you pay.',
    url: '/rent',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
