'use client';

// A team's symbol: an emoji, or (demo, awaiting approval) a selfie photo drawn round.
// The value travels in the same `emoji` field everywhere; a photo is a data:/blob:/https: URL.

export function isPhotoAvatar(v: string | undefined | null): boolean {
  return !!v && /^(data:image\/|blob:|https:\/\/)/.test(v);
}

/** `cssSize` (any CSS length, e.g. '4.6vh') overrides `size` px — for screens sized in viewport units. */
export function Avatar({ value, size, className, cssSize }: { value: string; size: number; className?: string; cssSize?: string }) {
  const box = cssSize ?? `${size}px`;
  if (isPhotoAvatar(value)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={value} alt="" aria-hidden decoding="async" width={size} height={size}
        className={`inline-block shrink-0 rounded-full object-cover ${className || ''}`}
        style={{ width: box, height: box, boxShadow: '0 0 0 2px var(--tc-brass), 0 2px 8px rgba(0,0,0,.4)' }} />
    );
  }
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center leading-none ${className || ''}`}
      style={{ width: box, height: box, fontSize: `calc(${box} * 0.8)` }}>{value}</span>
  );
}
