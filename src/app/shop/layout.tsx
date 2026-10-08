import type { Metadata } from 'next';

/**
 * Page title and description for search results and link previews.
 *
 * It lives in a layout because the page itself is a client component, and a
 * client component cannot export metadata. Without this the page inherited
 * the site-wide title, so every page looked identical to Google.
 */
export const metadata: Metadata = {
  title: 'Shop royal safas and groom turbans',
  description:
    'Buy groom safas, sehra and barati safas online — Jodhpuri, rounded and brocade styles from SafaKing, delivered across India.',
  alternates: { canonical: '/shop' },
  openGraph: {
    title: 'Shop royal safas and groom turbans · SafaKing',
    description: 'Buy groom safas, sehra and barati safas online — Jodhpuri, rounded and brocade styles from SafaKing, delivered across India.',
    url: '/shop',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
