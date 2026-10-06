'use client';

import { useRef, useState } from 'react';
import { Upload, Film, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { uploadCliostroVideo, CliostroGame, ALLOWED_VIDEO_TYPES } from '@/lib/qtreasure/videoUpload';

interface CliostroVideoSlotProps {
  codeId?: string;
  game: CliostroGame;
  scenario: string;
  label: string;
  hint?: string;
  url?: string;
  onChange: (url: string | undefined) => void;
  isRTL: boolean;
}

/**
 * A single Cliostro-video upload slot for the editor. Handles drag/drop + click
 * upload (direct-to-R2 via presigned URL), progress, preview, replace, remove.
 * Reused across Q.Treasure and Q.Hunt (pass the matching `game`/`scenario`).
 */
export function CliostroVideoSlot({
  codeId,
  game,
  scenario,
  label,
  hint,
  url,
  onChange,
  isRTL,
}: CliostroVideoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const t = (he: string, en: string) => (isRTL ? he : en);

  const handleFile = async (file: File) => {
    setError(null);
    if (!codeId) {
      setError(t('יש לשמור את המשחק קודם', 'Save the game first'));
      return;
    }
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setError(t('פורמט לא נתמך — MP4 או WebM', 'Unsupported format — use MP4 or WebM'));
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadCliostroVideo({
        file,
        codeId,
        game,
        scenario,
        replaceUrl: url,
        onProgress: setProgress,
      });
      onChange(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ההעלאה נכשלה', 'Upload failed'));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/40">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
        </div>
        {url && !uploading && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-xs flex items-center gap-1 text-red-500 hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('הסר', 'Remove')}
          </button>
        )}
      </div>

      {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{hint}</p>}

      {url ? (
        <div className="space-y-2">
          <video
            src={url}
            controls
            playsInline
            className="w-full max-h-40 rounded-lg bg-black"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('החלף סרטון', 'Replace video')}
          </button>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
            dragOver
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-amber-400'
          } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {t('מעלה', 'Uploading')} {progress}%
              </span>
              <div className="w-3/4 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('גררו סרטון לכאן או לחצו', 'Drag a video here or click')}
              </span>
              <span className="text-[10px] text-gray-400">MP4 · WebM</span>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
