import type { Metadata } from 'next';

/**
 * Page title and description for search results and link previews.
 *
 * It lives in a layout because the page itself is a client component, and a
 * client component cannot export metadata. Without this the page inherited
 * the site-wide title, so every page looked identical to Google.
 */
export const metadata: Metadata = {
  title: 'Wedding safa enquiry',
  description:
    'Tell us the date, the venue and how many safas you need, and we will come back with artists and a price.',
  alternates: { canonical: '/enquiry' },
  openGraph: {
    title: 'Wedding safa enquiry · SafaKing',
    description: 'Tell us the date, the venue and how many safas you need, and we will come back with artists and a price.',
    url: '/enquiry',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
