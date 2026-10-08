import type { Metadata } from 'next';

/**
 * Page title and description for search results and link previews.
 *
 * It lives in a layout because the page itself is a client component, and a
 * client component cannot export metadata. Without this the page inherited
 * the site-wide title, so every page looked identical to Google.
 */
export const metadata: Metadata = {
  title: 'Safa knowledge and videos',
  description:
    'How a safa is tied, what the styles mean, and videos from the SafaKing turban house.',
  alternates: { canonical: '/knowledge' },
  openGraph: {
    title: 'Safa knowledge and videos · SafaKing',
    description: 'How a safa is tied, what the styles mean, and videos from the SafaKing turban house.',
    url: '/knowledge',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
