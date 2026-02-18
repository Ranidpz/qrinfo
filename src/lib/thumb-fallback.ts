// Module-level set tracking failed thumbnail URLs — persists across renders
// Prevents infinite 404 loops when React re-renders reset img.src to a broken thumbnailUrl
const failedThumbs = new Set<string>();

export function getThumbSrc(thumbnailUrl: string | undefined, mainUrl: string): string {
  if (thumbnailUrl && !failedThumbs.has(thumbnailUrl)) return thumbnailUrl;
  return mainUrl;
}

export function onThumbError(
  e: React.SyntheticEvent<HTMLImageElement>,
  mainUrl: string,
  thumbnailUrl?: string
) {
  if (thumbnailUrl && !failedThumbs.has(thumbnailUrl)) {
    failedThumbs.add(thumbnailUrl);
    e.currentTarget.src = mainUrl;
  }
}
