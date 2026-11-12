'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { CircleAlert, ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import type { ImageUploader } from './model';
import { cx } from './ui';

/** Formats people actually drop. HEIC is left out on purpose: browsers cannot draw it to compress. */
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

type Phase = { kind: 'idle' } | { kind: 'uploading'; progress: number; preview: string } | { kind: 'error'; message: string };

/**
 * One image slot (riddle image / spot photo): drop a file on it or click to pick one.
 * Shows a preview, upload progress, a remove button and polite errors. The actual upload
 * (compression + R2, or an object URL in the demo) is the injected `upload`.
 */
export default function ImageDropZone({
  value,
  onChange,
  upload,
  label,
  emptyText,
  aspect = 'aspect-[16/7]',
  keepAlpha,
  fit = 'cover',
}: {
  value?: string;
  onChange: (url: string | undefined) => void;
  upload: ImageUploader;
  label: string;
  emptyText: string;
  aspect?: string;
  /** Logos: upload as PNG with transparency kept. */
  keepAlpha?: boolean;
  /** 'contain' on a checkerboard — for logos, so transparency is visible. */
  fit?: 'cover' | 'contain';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const take = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      setPhase({ kind: 'error', message: file.type.startsWith('image/') ? 'את סוג התמונה הזה אי אפשר להעלות. נסו JPG או PNG.' : 'זה לא קובץ תמונה. גררו לכאן תמונה (JPG, PNG או WebP).' });
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setPhase({ kind: 'error', message: 'התמונה גדולה מדי (מעל 25MB). נסו תמונה קטנה יותר.' });
      return;
    }
    const preview = URL.createObjectURL(file);
    setPhase({ kind: 'uploading', progress: 0, preview });
    try {
      const url = await upload(file, (f) => alive.current && setPhase({ kind: 'uploading', progress: f, preview }), keepAlpha ? { keepAlpha: true } : undefined);
      if (!alive.current) return;
      onChange(url);
      setPhase({ kind: 'idle' });
    } catch {
      if (alive.current) setPhase({ kind: 'error', message: 'ההעלאה נכשלה. בדקו את החיבור ונסו שוב.' });
    } finally {
      // The demo uploader returns its own object URL; this one was only the preview.
      URL.revokeObjectURL(preview);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    depth.current = 0;
    setOver(false);
    void take(e.dataTransfer.files?.[0]);
  };

  const busy = phase.kind === 'uploading';
  const shown = phase.kind === 'uploading' ? phase.preview : value;

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div
        role="button"
        tabIndex={0}
        aria-label={shown ? `${label} — החליפו תמונה` : label}
        aria-busy={busy}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current++;
          setOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (!depth.current) setOver(false);
        }}
        onDrop={onDrop}
        className={cx(
          'group relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-bg-secondary text-text-secondary transition-colors',
          aspect,
          over ? 'border-accent bg-accent/10 text-accent' : 'border-border hover:bg-bg-hover',
          busy && 'cursor-progress'
        )}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            className={cx('size-full', fit === 'contain' ? 'object-contain p-3' : 'object-cover', busy && 'opacity-60')}
            style={fit === 'contain' ? { background: 'repeating-conic-gradient(#d4d4d8 0 25%, #fafafa 0 50%) 0 0 / 16px 16px' } : undefined}
          />
        ) : (
          <span className="flex flex-col items-center gap-2 px-4 text-center text-sm">
            <ImagePlus size={26} aria-hidden />
            <span className="font-medium text-text-primary">גררו לכאן תמונה או לחצו לבחירה</span>
            <span>{emptyText}</span>
          </span>
        )}

        {over && shown && (
          <span className="absolute inset-0 flex items-center justify-center bg-accent/20 text-lg font-semibold text-white backdrop-blur-[1px]">שחררו כדי להחליף</span>
        )}

        {busy && (
          <span className="absolute inset-x-4 bottom-4 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-sm text-white">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            <span>מעלים… {Math.round(phase.progress * 100)}%</span>
            <span className="ms-2 h-1.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <span className="block h-full rounded-full bg-white transition-[width]" style={{ width: `${Math.round(phase.progress * 100)}%` }} />
            </span>
          </span>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(',')}
          className="sr-only"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      <div className="mt-2 flex min-h-8 flex-wrap items-center gap-2 text-sm">
        {phase.kind === 'error' && (
          <span role="alert" className="flex items-center gap-1.5 text-danger">
            <CircleAlert size={16} aria-hidden /> {phase.message}
          </span>
        )}
        {value && !busy && (
          <span className="ms-auto flex gap-1">
            <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-text-secondary hover:bg-bg-hover">
              <RefreshCw size={14} aria-hidden /> החליפו
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setPhase({ kind: 'idle' });
              }}
              className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-danger hover:bg-danger/10"
            >
              <Trash2 size={14} aria-hidden /> הסירו תמונה
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
