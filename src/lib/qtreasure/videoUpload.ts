import { fetchWithAuth } from '@/lib/fetchWithAuth';

/**
 * Client-side orchestration for uploading a Cliostro character video:
 *   1. ask the server for a presigned R2 PUT URL (owner-only),
 *   2. PUT the file DIRECTLY to R2 (bypasses the Vercel 4.5MB body cap),
 *   3. confirm — the server verifies the object + accounts storage.
 *
 * Compression to a mobile-friendly size is a separate, optional step the caller
 * can run on `file` BEFORE calling this (see src/lib/videoCompression — future).
 */

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export type CliostroGame = 'treasure' | 'hunt';

export interface CliostroUploadResult {
  url: string;
  size: number;
}

export async function uploadCliostroVideo(params: {
  file: File;
  codeId: string;
  game: CliostroGame;
  scenario: string;
  replaceUrl?: string;
  onProgress?: (pct: number) => void;
}): Promise<CliostroUploadResult> {
  const { file, codeId, game, scenario, replaceUrl, onProgress } = params;

  const contentType = file.type;
  if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
    throw new Error('Unsupported video type. Use MP4 or WebM.');
  }

  // 1. Presigned URL (owner-authenticated)
  const presignRes = await fetchWithAuth('/api/qtreasure/video-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codeId, game, scenario, contentType, size: file.size }),
  });
  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to get upload URL');
  }
  const { uploadUrl, key } = await presignRes.json();

  // 2. Direct PUT to R2 (XHR for upload progress)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () =>
      reject(new Error('Upload failed — check the R2 bucket CORS policy allows PUT from this origin.'));
    xhr.send(file);
  });

  // 3. Confirm (verifies the object landed + accounts storage; replaces old)
  const confirmRes = await fetchWithAuth('/api/qtreasure/video-confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codeId, key, replaceUrl }),
  });
  if (!confirmRes.ok) {
    const err = await confirmRes.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to confirm upload');
  }

  return (await confirmRes.json()) as CliostroUploadResult;
}
