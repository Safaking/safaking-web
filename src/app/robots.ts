import type { MetadataRoute } from 'next';

/**
 * Search engines are welcome everywhere a visitor is welcome — and nowhere
 * else. The staff and account areas are behind auth anyway; keeping them out
 * of the index stops a signed-out crawler from filling search results with
 * login redirects.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/artist-portal', '/my-bookings', '/api/', '/documents/', '/reset-password'],
    },
    sitemap: 'https://www.safaking.in/sitemap.xml',
  };
}
