'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Send, X } from 'lucide-react';
import type { SocialWallStrings } from './i18n';
import { PrimaryButton } from './ui';

export interface ComposerResult {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  caption: string;
}

function readSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

/** Bottom sheet: pick (camera or gallery), preview, caption, post. The upload itself runs in the
 *  feed so the sheet closes at once and the photo shows with a progress bar. */
export default function Composer({
  t, captionMax, onClose, onSubmit, blockedReason, initialFile,
}: {
  t: SocialWallStrings;
  captionMax: number;
  onClose: () => void;
  onSubmit: (result: ComposerResult) => void;
  blockedReason: string | null;
  /** Picked by the "+" tap itself (iOS only opens a file picker inside the user's tap handler). */
  initialFile: File | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ file: File; url: string; width: number; height: number } | null>(null);
  const [caption, setCaption] = useState('');
  const handedOff = useRef(false);

  const take = async (file: File) => {
    const url = URL.createObjectURL(file);
    const size = await readSize(url);
    setPicked((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { file, url, ...size };
    });
  };

  useEffect(() => {
    if (initialFile) void take(initialFile);
  }, [initialFile]);

  // Revoke the preview unless the feed took it over
  useEffect(() => {
    return () => {
      if (picked && !handedOff.current) URL.revokeObjectURL(picked.url);
    };
  }, [picked]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await take(file);
  };

  const submit = () => {
    if (!picked) return;
    handedOff.current = true;
    onSubmit({ file: picked.file, previewUrl: picked.url, width: picked.width, height: picked.height, caption: caption.trim() });
  };

  const left = captionMax - Array.from(caption).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={t.newPhoto}>
      <div className="absolute inset-0 bg-black/50 sw-fade" onClick={onClose} />
      <div className="relative bg-white rounded-t-[28px] max-h-[92dvh] flex flex-col sw-sheet shadow-2xl">
        <div className="pt-2.5 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between px-4 pb-2">
          <button type="button" onClick={onClose} className="w-11 h-11 -ms-2 flex items-center justify-center rounded-full text-gray-700 active:bg-gray-100" aria-label={t.close}>
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-lg font-bold text-gray-900">{t.newPhoto}</h2>
          <div className="w-11" />
        </div>

        <div className="overflow-y-auto sw-scroll px-4 pb-[max(16px,env(safe-area-inset-bottom))] space-y-4">
          {blockedReason ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-5 text-center text-[15px] font-semibold text-amber-900">{blockedReason}</div>
          ) : (
            <>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
              {picked ? (
                <div className="relative rounded-2xl overflow-hidden bg-gray-100 sw-scale-in">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={picked.url} alt="" className="w-full max-h-[48dvh] object-contain" />
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="absolute bottom-3 end-3 flex items-center gap-2 rounded-full bg-black/60 backdrop-blur text-white px-4 h-10 text-sm font-semibold active:scale-95 transition-transform"
                  >
                    <ImagePlus className="w-4 h-4" />
                    {t.replacePhoto}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-3 active:bg-gray-100 transition-colors"
                >
                  <span className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg" style={{ background: 'linear-gradient(135deg, var(--sw-primary), var(--sw-secondary))' }}>
                    <Camera className="w-8 h-8" />
                  </span>
                  <span className="text-[17px] font-bold text-gray-900">{t.choosePhoto}</span>
                  <span className="text-sm text-gray-500">{t.choosePhotoHint}</span>
                </button>
              )}

              {captionMax > 0 && (
                <div>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(Array.from(e.target.value).slice(0, captionMax).join(''))}
                    placeholder={t.captionPlaceholder}
                    rows={2}
                    className="w-full rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-[16px] text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-[var(--sw-primary)] resize-none"
                  />
                  <div className={`text-xs text-end mt-1 tabular-nums ${left < 10 ? 'text-amber-600' : 'text-gray-400'}`}>{left}</div>
                </div>
              )}

              <PrimaryButton onClick={submit} disabled={!picked}>
                <Send className="w-5 h-5 rtl:-scale-x-100" />
                {t.publish}
              </PrimaryButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
