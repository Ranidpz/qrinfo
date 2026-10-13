'use client';

import { useCallback, useState, type ReactNode } from 'react';
import SquareImageCropper from './SquareImageCropper';

export interface CropStepLabels {
  title: string;
  hint: string;
  confirm: string;
  cancel: string;
  processing: string;
}

export const CROP_STEP_LABELS: Record<'he' | 'en', CropStepLabels> = {
  he: {
    title: 'מרכזו את התמונה',
    hint: 'גררו כדי להזיז, צבטו או גללו כדי להגדיל',
    confirm: 'אישור',
    cancel: 'ביטול',
    processing: 'מכינים...',
  },
  en: {
    title: 'Frame your photo',
    hint: 'Drag to move, pinch or scroll to zoom',
    confirm: 'Done',
    cancel: 'Cancel',
    processing: 'Preparing...',
  },
};

function croppedFileName(original: string, type: string): string {
  const base = original.replace(/\.[^/.]+$/, '') || 'photo';
  return `${base}.${type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp'}`;
}

/**
 * Optional square-crop step before an upload (Q.Vote `enableCropping`).
 * `crop(file)` resolves with the cropped file, the original file when the step is off,
 * or null when the user cancelled. Call it for one file at a time (await in a loop).
 * Render `cropElement` once anywhere in the component.
 */
export function useCropStep(enabled: boolean, labels: CropStepLabels): {
  crop: (file: File) => Promise<File | null>;
  cropElement: ReactNode;
} {
  const [pending, setPending] = useState<{ file: File; resolve: (file: File | null) => void } | null>(null);

  const crop = useCallback(
    (file: File) => (enabled ? new Promise<File | null>((resolve) => setPending({ file, resolve })) : Promise.resolve(file)),
    [enabled]
  );

  const cropElement = pending ? (
    // Own stacking context: the cropper must sit above whatever modal opened it.
    <div className="relative z-[120]">
      <SquareImageCropper
        file={pending.file}
        labels={labels}
        onCancel={() => {
          pending.resolve(null);
          setPending(null);
        }}
        onConfirm={(blob) => {
          const type = blob.type || 'image/webp';
          pending.resolve(new File([blob], croppedFileName(pending.file.name, type), { type }));
          setPending(null);
        }}
      />
    </div>
  ) : null;

  return { crop, cropElement };
}
