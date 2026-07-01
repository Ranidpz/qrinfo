'use client';

/**
 * Client-side square crop + WebP conversion for Selfie Beam.
 *
 * Used in two places:
 *  - Admin bulk "seed" uploads (center-crop) in the code editor.
 *  - Participant selfie capture (interactive pinch/zoom crop) in the viewer.
 *
 * Output is always a square WebP. Default 1000px source resolution; the big-screen
 * beam grid displays it scaled down via `object-cover`, so a single 1000px asset
 * covers everything from phones to 4K projectors while staying ~150-300KB.
 */

export interface SquareCropOptions {
  /** Output square edge in px (default 1000). Never upscales beyond the source square. */
  size?: number;
  /** WebP quality 0-1 (default 0.82). */
  quality?: number;
  /**
   * Explicit source crop region (a square, in source-image pixels).
   * When omitted, a centered square crop is used.
   * Supplied by the interactive participant cropper (pinch/zoom/pan).
   */
  crop?: { x: number; y: number; size: number };
}

interface DecodedImage {
  draw: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

async function decodeImage(file: File | Blob): Promise<DecodedImage> {
  // Prefer createImageBitmap — fast, off-main-thread, and respects EXIF orientation.
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      draw: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  } catch {
    // Fallback: <img> element (broader format support in some browsers).
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load image'));
        image.src = url;
      });
      return {
        draw: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      };
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
  }
}

/**
 * Center-crop (or crop the given region of) an image to a square and return a WebP Blob.
 *
 * Mobile cameras produce huge images (12MP ≈ 48MB decoded). On phones — especially after many
 * shots in one session — `createImageBitmap`/canvas can intermittently fail with out-of-memory.
 * Those failures are usually transient: a short delay lets the previous (closed) bitmap get GC'd,
 * and the second attempt succeeds. So we retry once before giving up, instead of silently losing
 * the photographer's shot.
 */
export async function cropImageToSquareWebp(
  file: File | Blob,
  options: SquareCropOptions = {}
): Promise<Blob> {
  try {
    return await cropOnce(file, options);
  } catch {
    await new Promise((r) => setTimeout(r, 250)); // give the GC a moment to reclaim memory
    return await cropOnce(file, options);
  }
}

async function cropOnce(
  file: File | Blob,
  options: SquareCropOptions = {}
): Promise<Blob> {
  const { size = 1000, quality = 0.82, crop } = options;

  const { draw, width: sw, height: sh, cleanup } = await decodeImage(file);

  try {
    // Resolve the source square region.
    let sx: number;
    let sy: number;
    let side: number;

    if (crop) {
      // Clamp the requested region inside the image bounds.
      side = Math.max(1, Math.min(crop.size, sw, sh));
      sx = Math.max(0, Math.min(crop.x, sw - side));
      sy = Math.max(0, Math.min(crop.y, sh - side));
    } else {
      side = Math.min(sw, sh);
      sx = (sw - side) / 2;
      sy = (sh - side) / 2;
    }

    // Don't upscale beyond the available source square.
    const out = Math.min(size, Math.round(side));

    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(draw, sx, sy, side, side, 0, 0, out, out);

    // Encode. iOS Safari before v17 IGNORES 'image/webp' in canvas.toBlob and silently
    // returns a PNG instead — a photographic 1000px PNG is ~2-3MB, which then trips the
    // /api/gallery size limit and the upload fails ("Error" on the phone, works on desktop).
    // So: ask for WebP, and if we didn't actually get WebP back, re-encode the same canvas
    // as JPEG (universally supported, small). Desktop / modern browsers keep the WebP path.
    const encode = (type: string): Promise<Blob | null> =>
      new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

    let blob = await encode('image/webp');
    if (!blob || blob.type !== 'image/webp') {
      blob = await encode('image/jpeg');
    }
    if (!blob) throw new Error('Canvas toBlob failed');
    return blob;
  } finally {
    cleanup();
  }
}
