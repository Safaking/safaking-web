import { BUSINESS } from '@/lib/business';
import { FAQ_ITEMS, FAQ_FALLBACKS, fillTokens } from '@/lib/faq';

/**
 * Structured data — the part of a page written for Google rather than for a
 * person.
 *
 * Without it a search result is a blue link. With it, SafaKing can appear
 * with its address, phone number and opening hours in the local panel, and an
 * answer from the FAQ can be shown directly under the result. It costs one
 * <script type="application/ld+json"> per page and nothing at runtime.
 *
 * Every value is read from the same places the site reads them, so the shop
 * address and the one Google is told can never drift apart.
 */

export const SITE = 'https://www.safaking.in';

const ADDRESS = {
  '@type': 'PostalAddress',
  streetAddress: 'C-603 Nakshtra Heights, Nr. Karnavati Apartment 1, Narol Lambha Highway',
  addressLocality: 'Narol, Ahmedabad',
  addressRegion: 'Gujarat',
  postalCode: '382405',
  addressCountry: 'IN',
} as const;

/** Who SafaKing is — on every page, so Google links the brand to this site. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE}/#organization`,
    name: BUSINESS.name,
    alternateName: 'SafaKing',
    url: SITE,
    logo: `${SITE}/logo.png`,
    image: `${SITE}/logo.png`,
    telephone: `+${BUSINESS.phoneDigits}`,
    email: BUSINESS.email,
    address: ADDRESS,
  };
}

/**
 * The shop as a place: address, hours, what it sells. This is what a
 * "safa near me" search looks for.
 */
export function localBusinessJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ClothingStore',
    '@id': `${SITE}/#store`,
    name: BUSINESS.name,
    url: SITE,
    image: `${SITE}/logo.png`,
    telephone: `+${BUSINESS.phoneDigits}`,
    email: BUSINESS.email,
    address: ADDRESS,
    priceRange: '₹₹',
    currenciesAccepted: 'INR',
    paymentAccepted: 'UPI, Credit Card, Debit Card, Net Banking',
    areaServed: { '@type': 'Country', name: 'India' },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '10:00',
        closes: '20:00',
      },
    ],
    makesOffer: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Safa artist booking for baraat' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Groom safa and sehra' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Safa rental' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Safa tying training' } },
    ],
  };
}

/**
 * The FAQ, in the form Google can show under a search result.
 *
 * English only: this is the language the structured data is declared in, and
 * a mixed-language answer reads as spam to a crawler. The page itself still
 * offers both.
 */
export function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE}/faq#faq`,
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: fillTokens(item.q.en, FAQ_FALLBACKS),
      acceptedAnswer: { '@type': 'Answer', text: fillTokens(item.a.en, FAQ_FALLBACKS) },
    })),
  };
}

/** The trail shown above a search result: SafaKing › Gallery. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...trail].map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${SITE}${crumb.path}`,
    })),
  };
}

/** A gallery of photographs, so image search can index them properly. */
export function imageGalleryJsonLd(photos: { src: string; alt: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    '@id': `${SITE}/gallery#gallery`,
    name: 'SafaKing photo gallery',
    url: `${SITE}/gallery`,
    image: photos.map((photo) => ({
      '@type': 'ImageObject',
      contentUrl: `${SITE}${photo.src}`,
      caption: photo.alt,
    })),
  };
}

/** Renders a block for the page head. Next keeps it in the server HTML. */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
