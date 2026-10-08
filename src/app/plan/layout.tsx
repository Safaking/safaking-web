import type { Metadata } from 'next';

/**
 * Page title and description for search results and link previews.
 *
 * It lives in a layout because the page itself is a client component, and a
 * client component cannot export metadata. Without this the page inherited
 * the site-wide title, so every page looked identical to Google.
 */
export const metadata: Metadata = {
  title: 'Plan the complete groom look',
  description:
    'Build a groom\'s wedding look step by step — sherwani, jewellery, sehra and the safa that crowns it.',
  alternates: { canonical: '/plan' },
  openGraph: {
    title: 'Plan the complete groom look · SafaKing',
    description: 'Build a groom\'s wedding look step by step — sherwani, jewellery, sehra and the safa that crowns it.',
    url: '/plan',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
