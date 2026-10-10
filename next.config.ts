import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Allow running a second dev server (e.g. a preview instance) without clashing
  // over the default `.next` build dir. Unset → defaults to `.next` (no change).
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),

  // Fix jsdom ESM issue with isomorphic-dompurify
  serverExternalPackages: ['jsdom', 'xlsx'],

  // Security headers
  async headers() {
    return [
      // Customer-owned experience pages (a client's event game, gallery, raffle…) stay out of search
      // results - people searching should land on our own landing pages - but links on them (e.g.
      // the 10 בול "Powered by" footer) are still followed.
      ...['/v/:path*', '/gallery/:path*', '/lobby/:path*', '/packs/:path*', '/raffle/:path*', '/:locale/p/:path*'].map(
        (source) => ({ source, headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }] })
      ),
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()'
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
