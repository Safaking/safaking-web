import type { Metadata } from 'next';

/**
 * Page title and description for search results and link previews.
 *
 * It lives in a layout because the page itself is a client component, and a
 * client component cannot export metadata. Without this the page inherited
 * the site-wide title, so every page looked identical to Google.
 */
export const metadata: Metadata = {
  title: 'Careers at SafaKing',
  description:
    'Open roles for safa artists, trainers and coordinators at SafaKing. See what each job involves and apply online.',
  alternates: { canonical: '/careers' },
  openGraph: {
    title: 'Careers at SafaKing · SafaKing',
    description: 'Open roles for safa artists, trainers and coordinators at SafaKing. See what each job involves and apply online.',
    url: '/careers',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
