import type { MetadataRoute } from 'next';

const SITE = 'https://www.safaking.in';

/**
 * Only the pages a stranger should land on. Product and artist pages are left
 * out deliberately: they are rendered client-side from Supabase, so listing
 * them here would promise a crawler content it cannot see without JavaScript.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/shop', priority: 0.9, changeFrequency: 'daily' },
    { path: '/rent', priority: 0.9, changeFrequency: 'daily' },
    { path: '/artists', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/enquiry', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/plan', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/academy', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/knowledge', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/about', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/careers', priority: 0.4, changeFrequency: 'monthly' },
    { path: '/policies', priority: 0.4, changeFrequency: 'monthly' },
  ];

  const now = new Date();
  return pages.map((p) => ({
    url: `${SITE}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
