// Share-card (OG image) routes take the logo URL from the query string and the image renderer
// fetches it server-side. Without a host check that is an open fetcher/image proxy under our
// domain (internal-address probing, attacker images in link previews). Only our own hosts and
// our media storage are fetched; anything else falls back to the default Q logo.
// Edge-safe: no Node or Firebase imports.

export const DEFAULT_OG_LOGO = 'https://qr.playzones.app/theQ.png';

const ALLOWED_HOSTS = new Set(['qr.playzones.app', 'theq-media.playzones.app']);

export function safeOgLogoUrl(raw: string | null): string {
  if (!raw) return DEFAULT_OG_LOGO;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return DEFAULT_OG_LOGO;
    const host = url.hostname.toLowerCase();
    if (ALLOWED_HOSTS.has(host) || host.endsWith('.public.blob.vercel-storage.com')) return url.toString();
  } catch {
    // not a URL
  }
  return DEFAULT_OG_LOGO;
}
