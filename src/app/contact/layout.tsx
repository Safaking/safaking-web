import type { Metadata } from 'next';

/**
 * Page title and description for search results and link previews.
 *
 * It lives in a layout because the page itself is a client component, and a
 * client component cannot export metadata. Without this the page inherited
 * the site-wide title, so every page looked identical to Google.
 */
export const metadata: Metadata = {
  title: 'Contact SafaKing',
  description:
    'Call or WhatsApp SafaKing in Narol, Ahmedabad — Monday to Saturday, 10 AM to 8 PM. Bookings, orders and supplier enquiries.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact SafaKing · SafaKing',
    description: 'Call or WhatsApp SafaKing in Narol, Ahmedabad — Monday to Saturday, 10 AM to 8 PM. Bookings, orders and supplier enquiries.',
    url: '/contact',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
