import type { Metadata } from 'next';

/**
 * Page title and description for search results and link previews.
 *
 * It lives in a layout because the page itself is a client component, and a
 * client component cannot export metadata. Without this the page inherited
 * the site-wide title, so every page looked identical to Google.
 */
export const metadata: Metadata = {
  title: 'About SafaKing',
  description:
    'A royal turban house: our own safa collection, trained artists who tie at weddings across India, and an academy that teaches the craft.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About SafaKing · SafaKing',
    description: 'A royal turban house: our own safa collection, trained artists who tie at weddings across India, and an academy that teaches the craft.',
    url: '/about',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
