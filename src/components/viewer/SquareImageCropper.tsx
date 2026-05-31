'use client';

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Check, X, ZoomIn } from 'lucide-react';
import { cropImageToSquareWebp } from '@/lib/imageCrop';

interface SquareImageCropperProps {
  file: File;
  /** Output square edge in px (default 1000). */
  outputSize?: number;
  /** WebP quality 0-1 (default 0.82). */
  quality?: number;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  labels: {
    title: string;
    hint: string;
    confirm: string;
    cancel: string;
    processing: string;
  };
}

const MAX_USER_SCALE = 5;

/**
 * Interactive square selfie cropper for Selfie Beam.
 * The participant frames their photo inside a fixed square with pinch-to-zoom and
 * drag-to-pan (single-finger pan, two-finger pinch, plus a slider/wheel on desktop),
 * then we export exactly the visible square as a 1000px WebP via cropImageToSquareWebp.
 */
export default function SquareImageCropper({
  file,
  outputSize = 1000,
  quality = 0.82,
  onCancel,
  onConfirm,
  labels,
}: SquareImageCropperProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const [objectUrl, setObjectUrl] = useState<string>('');
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [viewport, setViewport] = useState(0); // square edge in CSS px
  const [userScale, setUserScale] = useState(1); // 1 = image just covers the square
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // img top-left within viewport (<= 0)
  const [processing, setProcessing] = useState(false);

  // Active pointers for pan/pinch gesture tracking.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);

  // Decode the selected file into an object URL and read its natural size.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Measure the viewport (responsive square) and keep it in sync on resize.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setViewport(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // coverScale makes the image's shorter side exactly fill the square at userScale = 1.
  const coverScale = natural && natural.w > 0 && natural.h > 0
    ? viewport / Math.min(natural.w, natural.h)
    : 1;
  const totalScale = coverScale * userScale;
  const dispW = natural ? natural.w * totalScale : 0;
  const dispH = natural ? natural.h * totalScale : 0;

  // Keep the image covering the viewport: top-left must be <= 0 and bottom-right >= viewport.
  const clampOffset = useCallback(
    (x: number, y: number, w: number, h: number) => ({
      x: Math.min(0, Math.max(viewport - w, x)),
      y: Math.min(0, Math.max(viewport - h, y)),
    }),
    [viewport]
  );

  // Center the image once we know both the viewport and the image size.
  useEffect(() => {
    if (!natural || viewport === 0) return;
    setOffset(clampOffset((viewport - dispW) / 2, (viewport - dispH) / 2, dispW, dispH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, viewport]);

  // Apply a new zoom level anchored on a viewport point (so content under the
  // fingers / cursor stays put), then re-clamp.
  const applyZoom = useCallback(
    (nextUserScale: number, anchorX: number, anchorY: number) => {
      const clampedNext = Math.min(MAX_USER_SCALE, Math.max(1, nextUserScale));
      setUserScale((prevUser) => {
        const ratio = clampedNext / prevUser;
        setOffset((prev) => {
          const nx = anchorX - (anchorX - prev.x) * ratio;
          const ny = anchorY - (anchorY - prev.y) * ratio;
          return clampOffset(nx, ny, natural!.w * coverScale * clampedNext, natural!.h * coverScale * clampedNext);
        });
        return clampedNext;
      });
    },
    [clampOffset, coverScale, natural]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: userScale };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);

    if (pointers.current.size >= 2 && pinchRef.current) {
      // Pinch zoom around the midpoint of the two fingers.
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = viewportRef.current!.getBoundingClientRect();
      const midX = (a.x + b.x) / 2 - rect.left;
      const midY = (a.y + b.y) / 2 - rect.top;
      const nextScale = pinchRef.current.scale * (dist / pinchRef.current.dist);
      applyZoom(nextScale, midX, midY);
    } else if (pointers.current.size === 1) {
      // Single-finger / mouse pan.
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      setOffset((o) => clampOffset(o.x + dx, o.y + dy, dispW, dispH));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = viewportRef.current!.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    applyZoom(userScale * factor, e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleConfirm = async () => {
    if (!natural || processing) return;
    setProcessing(true);
    try {
      // Map the visible square back to source pixels.
      const sourceSize = viewport / totalScale;
      const crop = {
        x: -offset.x / totalScale,
        y: -offset.y / totalScale,
        size: sourceSize,
      };
      const blob = await cropImageToSquareWebp(file, { crop, size: outputSize, quality });
      onConfirm(blob);
    } catch (err) {
      console.error('Crop failed:', err);
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-4">
        <button
          onClick={onCancel}
          disabled={processing}
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
          aria-label={labels.cancel}
        >
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-white font-semibold">{labels.title}</h3>
        <div className="w-9" />
      </div>

      {/* Square viewport */}
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        className="relative w-full max-w-md aspect-square overflow-hidden rounded-2xl bg-black select-none ring-1 ring-white/20"
        style={{ touchAction: 'none' }}
      >
        {objectUrl && natural ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={objectUrl}
            alt=""
            draggable={false}
            className="absolute max-w-none pointer-events-none"
            style={{
              width: dispW,
              height: dispH,
              left: offset.x,
              top: offset.y,
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
          </div>
        )}

        {/* Framing overlay: rule-of-thirds grid */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
        </div>
      </div>

      {/* Zoom slider */}
      <div className="w-full max-w-md flex items-center gap-3 mt-4">
        <ZoomIn className="w-5 h-5 text-white/60 shrink-0" />
        <input
          type="range"
          min={1}
          max={MAX_USER_SCALE}
          step={0.01}
          value={userScale}
          onChange={(e) => applyZoom(Number(e.target.value), viewport / 2, viewport / 2)}
          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>
      <p className="text-xs text-white/50 mt-2">{labels.hint}</p>

      {/* Confirm */}
      <button
        onClick={handleConfirm}
        disabled={processing || !natural}
        className="mt-5 w-full max-w-md flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60"
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {labels.processing}
          </>
        ) : (
          <>
            <Check className="w-5 h-5" />
            {labels.confirm}
          </>
        )}
      </button>
    </div>
  );
}
