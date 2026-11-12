import type { Metadata } from 'next';
import { ARTIST_DIRECTORY_ENABLED } from '@/lib/features';

/**
 * Page title and description for search results and link previews.
 *
 * It lives in a layout because the page itself is a client component, and a
 * client component cannot export metadata. Without this the page inherited
 * the site-wide title, so every page looked identical to Google.
 */
const DIRECTORY_METADATA: Metadata = {
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

// A page that answers 404 should not still be describing itself to crawlers:
// a canonical address and an inviting title are how a dead URL stays in
// search results long after it stopped working. Same reasoning as /try-on.
export const metadata: Metadata = ARTIST_DIRECTORY_ENABLED
  ? DIRECTORY_METADATA
  : { title: 'Not found', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
