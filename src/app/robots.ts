import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/landing/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/og/'], // OG images are shown in search / social previews
        disallow: ['/api/', '/he/admin/', '/en/admin/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
