import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Allow running a second dev server (e.g. a preview instance) without clashing
  // over the default `.next` build dir. Unset → defaults to `.next` (no change).
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),

  // Fix jsdom ESM issue with isomorphic-dompurify
  serverExternalPackages: ['jsdom', 'xlsx'],

  // The experiences hub merged into the home page's experiences section
  async redirects() {
    return [
      { source: '/:locale(he|en)/experiences', destination: '/:locale/marketing#features', permanent: true },
      // Short address printed on the 10 בול share card
      { source: '/10-bool', destination: '/he/experiences/10-bool', permanent: false },
    ];
  },

  // Security headers
  async headers() {
    return [
      // Customer-owned experience pages (a client's event game, gallery, raffle…) stay out of search
      // results - people searching should land on our own landing pages - but links on them (e.g.
      // the 10 בול "Powered by" footer) are still followed.
      ...['/v/:path*', '/gallery/:path*', '/lobby/:path*', '/packs/:path*', '/raffle/:path*', '/:locale/p/:path*'].map(
        (source) => ({ source, headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }] })
      ),
      // The public viewer may be framed by the TVzone signage player (a game on a TV screen with a
      // USB buzzer). Only these origins - every other route keeps X-Frame-Options: SAMEORIGIN below.
      {
        source: '/v/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://tvzone.playzones.app https://bindexcloud.playzones.app http://localhost:3200"
          },
        ],
      },
      {
        // Clickjacking protection on every route except /v/ (framing there is governed by the CSP above)
        source: '/((?!v/).*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
        ],
      },
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
