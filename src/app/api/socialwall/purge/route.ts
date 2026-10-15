import { NextRequest, NextResponse } from 'next/server';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { deleteStoredObjectByUrl } from '@/lib/media-storage';
import { adjustStorageUsed } from '@/lib/storage-guard';
import { allPostStorage, isValidCodeId, loadSocialWall, purgeDocs } from '@/lib/socialwall/store';
import { errorResponse, readJson } from '@/lib/socialwall/server';

export const maxDuration = 300;

// Owner only: end of event — delete every photo file, post, member, HR-list row and audit entry.
// Requires {confirm: 'DELETE'}. Files first: a failure leaves docs that still point at what remains,
// so the owner can simply run it again.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const { codeId } = body;
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;
    if (body.confirm !== 'DELETE') return NextResponse.json({ error: 'Confirmation required' }, { status: 400 });
    const wall = await loadSocialWall(codeId);

    const { urls, bytes } = await allPostStorage(codeId);
    let failed = 0;
    for (let i = 0; i < urls.length; i += 20) {
      const results = await Promise.allSettled(urls.slice(i, i + 20).map((url) => deleteStoredObjectByUrl(url)));
      failed += results.filter((r) => r.status === 'rejected').length;
    }
    if (failed > 0) {
      console.error(`[socialwall] purge: ${failed} file deletes failed for ${codeId}`);
      return NextResponse.json({ error: 'Some files could not be deleted — try again', errorCode: 'PARTIAL' }, { status: 502 });
    }
    await adjustStorageUsed(wall.ownerId, -bytes);
    const counts = await purgeDocs(codeId);
    return NextResponse.json({ success: true, ...counts, files: urls.length });
  } catch (error) {
    return errorResponse(error, 'purge');
  }
}
