import { del } from '@vercel/blob';
import { deleteR2ObjectByUrl, isR2Url, R2_STORAGE_PROVIDER } from '@/lib/r2-storage';

export type StoredObjectProvider = 'vercel-blob' | typeof R2_STORAGE_PROVIDER;

export async function deleteStoredObjectByUrl(url: string): Promise<StoredObjectProvider> {
  if (isR2Url(url)) {
    await deleteR2ObjectByUrl(url);
    return R2_STORAGE_PROVIDER;
  }

  await del(url);
  return 'vercel-blob';
}
