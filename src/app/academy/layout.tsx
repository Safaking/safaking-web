import type { Metadata } from 'next';

/**
 * Page title and description for search results and link previews.
 *
 * It lives in a layout because the page itself is a client component, and a
 * client component cannot export metadata. Without this the page inherited
 * the site-wide title, so every page looked identical to Google.
 */
export const metadata: Metadata = {
  title: 'Safa tying training academy',
  description:
    'Learn to tie Jodhpuri, rounded and barati safas at SafaKing Academy — at our Ahmedabad centre, or in your own city once a batch fills.',
  alternates: { canonical: '/academy' },
  openGraph: {
    title: 'Safa tying training academy · SafaKing',
    description: 'Learn to tie Jodhpuri, rounded and barati safas at SafaKing Academy — at our Ahmedabad centre, or in your own city once a batch fills.',
    url: '/academy',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
