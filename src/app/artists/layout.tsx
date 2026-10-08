import type { Metadata } from 'next';

/**
 * Page title and description for search results and link previews.
 *
 * It lives in a layout because the page itself is a client component, and a
 * client component cannot export metadata. Without this the page inherited
 * the site-wide title, so every page looked identical to Google.
 */
export const metadata: Metadata = {
  title: 'Our safa artists',
  description:
    'The trained safa artists who tie for SafaKing weddings. Book one for your baraat through SafaKing.',
  alternates: { canonical: '/artists' },
  openGraph: {
    title: 'Our safa artists · SafaKing',
    description: 'The trained safa artists who tie for SafaKing weddings. Book one for your baraat through SafaKing.',
    url: '/artists',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
