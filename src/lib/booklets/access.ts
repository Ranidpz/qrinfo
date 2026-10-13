import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import type { PdfActor } from '@/lib/content-intake/pdf-replacement';

/**
 * Booklet editors: a super admin lets an extra user replace the PDF of chosen booklets
 * WITHOUT transferring ownership. The grant lives only in `bookletEditors/{codeId}__{uid}`
 * (rules: no client access), so the code doc, Firestore rules and storage deletes are
 * untouched — an editor can do nothing except the server routes that call
 * `requireBookletAccess`: replace a PDF, read its history, restore the previous file.
 */
export const BOOKLET_EDITORS_COLLECTION = 'bookletEditors';

export function bookletGrantId(codeId: string, uid: string): string {
  return `${codeId}__${uid}`;
}

export function hasPdfMedia(media: unknown): boolean {
  return Array.isArray(media) && media.some((item) => item?.type === 'pdf');
}

export interface BookletAccess {
  actor: PdfActor & { uid: string };
  ownerId: string;
}

/**
 * Active (not revoked) grant for `uid` on `codeId`, given under the CURRENT owner —
 * an ownership transfer silently ends every grant made for the previous owner.
 */
export async function hasBookletGrant(codeId: string, uid: string, ownerId: string): Promise<boolean> {
  const grant = await getAdminDb().collection(BOOKLET_EDITORS_COLLECTION).doc(bookletGrantId(codeId, uid)).get();
  const data = grant.data();
  return !!data && data.codeId === codeId && data.uid === uid && !data.revokedAt && !!ownerId && data.ownerId === ownerId;
}

/**
 * Owner, super admin or an active booklet editor of a code that holds a PDF.
 * The grant is re-read on every request, so a revoke takes effect immediately.
 */
export async function requireBookletAccess(
  request: NextRequest,
  codeId: string
): Promise<BookletAccess | { response: NextResponse }> {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return { response: authResult.error };
  const { uid } = authResult;

  const db = getAdminDb();
  const [codeDoc, userDoc] = await Promise.all([
    db.collection('codes').doc(codeId).get(),
    db.collection('users').doc(uid).get(),
  ]);
  if (!codeDoc.exists) {
    return { response: NextResponse.json({ error: 'Code not found' }, { status: 404 }) };
  }

  const code = codeDoc.data() || {};
  const ownerId = String(code.ownerId || '');
  const user = userDoc.data() || {};
  const identity = {
    uid,
    email: typeof user.email === 'string' ? user.email : undefined,
    name: typeof user.displayName === 'string' ? user.displayName : undefined,
  };

  if (ownerId && ownerId === uid) return { actor: { ...identity, via: 'owner' }, ownerId };
  if (user.role === 'super_admin') return { actor: { ...identity, via: 'super_admin' }, ownerId };
  // Existing full-edit collaborators keep replacing PDFs as before.
  if (Array.isArray(code.collaborators) && code.collaborators.includes(uid)) {
    return { actor: { ...identity, via: 'collaborator' }, ownerId };
  }

  // Editors must also hold an approved account (same rule as isApprovedStatus: no status =
  // pre-gate account = approved), so rejecting a user ends their booklet access too.
  const approved = user.status == null || user.status === 'approved';
  if (approved && hasPdfMedia(code.media) && await hasBookletGrant(codeId, uid, ownerId)) {
    return { actor: { ...identity, via: 'editor' }, ownerId };
  }

  return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
}
