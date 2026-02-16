/**
 * Shared image compression utility for QVote and other uploads
 * Compresses images to WebP format with target size
 */

export interface CompressionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  format: 'webp' | 'jpeg' | 'png';
}

export interface CompressionOptions {
  maxSizeKB?: number;  // Target max size in KB (default: 300)
  maxWidth?: number;   // Max width in pixels (default: 1200)
  maxHeight?: number;  // Max height in pixels (default: 1200)
  quality?: number;    // Initial quality 0-1 (default: 0.8)
  preserveAlpha?: boolean; // Skip white background fill to preserve PNG transparency (default: false)
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxSizeKB: 300,
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.8,
  preserveAlpha: false,
};

/**
 * Check if browser supports WebP encoding
 */
function supportsWebP(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

/**
 * Compress an image file to WebP (or JPEG fallback) with size optimization
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<CompressionResult> - The compressed blob and metadata
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;
  const useWebP = supportsWebP();
  // When preserving alpha, always use PNG (lossless alpha). Canvas WebP encoding can degrade alpha at quality < 1.
  const format: 'webp' | 'jpeg' | 'png' = opts.preserveAlpha ? 'png' : (useWebP ? 'webp' : 'jpeg');
  const mimeType = format === 'webp' ? 'image/webp' : (format === 'png' ? 'image/png' : 'image/jpeg');

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Load image
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });

  // Calculate new dimensions while maintaining aspect ratio
  let { width, height } = img;
  if (width > opts.maxWidth || height > opts.maxHeight) {
    const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;

  // Draw image (optionally with white background for non-transparent images)
  if (!opts.preserveAlpha) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);

  // Revoke the object URL to free memory
  URL.revokeObjectURL(img.src);

  // Binary search for optimal quality
  const targetBytes = opts.maxSizeKB * 1024;
  let minQ = 0.1;
  let maxQ = opts.quality;
  let blob: Blob | null = null;

  // Initial compression
  blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), mimeType, opts.quality);
  });

  // If already under target, return
  if (blob.size <= targetBytes) {
    return { blob, originalSize, compressedSize: blob.size, format };
  }

  // Binary search for optimal quality (5 iterations max)
  for (let i = 0; i < 5; i++) {
    const quality = (minQ + maxQ) / 2;
    blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), mimeType, quality);
    });

    if (blob.size <= targetBytes) {
      minQ = quality; // Can try higher quality
    } else {
      maxQ = quality; // Need lower quality
    }
  }

  // Final pass with best quality that meets target
  blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), mimeType, Math.min(minQ + 0.05, 0.9));
  });

  return { blob, originalSize, compressedSize: blob.size, format };
}

/**
 * Get the file extension for a compression result
 */
export function getCompressedExtension(result: CompressionResult): string {
  if (result.format === 'webp') return 'webp';
  if (result.format === 'png') return 'png';
  return 'jpg';
}

/**
 * Create a File object from compression result
 */
export function createCompressedFile(
  result: CompressionResult,
  originalName: string
): File {
  const ext = getCompressedExtension(result);
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  const mimeTypes = { webp: 'image/webp', png: 'image/png', jpeg: 'image/jpeg' };
  return new File([result.blob], `${baseName}.${ext}`, { type: mimeTypes[result.format] });
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
