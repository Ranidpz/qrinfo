import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  BOOKLET_EDITORS_COLLECTION,
  bookletGrantId,
  hasPdfMedia,
} from '@/lib/booklets/access';
import { recordAccessChange } from '@/lib/booklets/pdf-history';

// Booklet editors — super admin only. GET ?codeId= lists, POST {codeId,email} grants,
// DELETE {codeId,uid} revokes. A grant never touches the code doc or its ownership.

const CODE_ID = /^[A-Za-z0-9_-]{1,128}$/;

async function superAdminActor(uid: string) {
  const user = (await getAdminDb().collection('users').doc(uid).get()).data() || {};
  return {
    uid,
    via: 'super_admin' as const,
    ...(typeof user.email === 'string' ? { email: user.email } : {}),
    ...(typeof user.displayName === 'string' ? { name: user.displayName } : {}),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthError(auth)) return auth.response;

  const codeId = request.nextUrl.searchParams.get('codeId') || '';
  if (!CODE_ID.test(codeId)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  try {
    const snap = await getAdminDb().collection(BOOKLET_EDITORS_COLLECTION).where('codeId', '==', codeId).get();
    const code = (await getAdminDb().collection('codes').doc(codeId).get()).data();
    const editors = snap.docs
      .map((doc) => doc.data())
      .filter((grant) => !grant.revokedAt && grant.ownerId === code?.ownerId)
      .map((grant) => ({
        uid: grant.uid,
        email: grant.email || '',
        name: grant.name || '',
        grantedAt: grant.grantedAt?.toDate?.()?.toISOString() || null,
        grantedByEmail: grant.grantedByEmail || '',
      }));
    return NextResponse.json({ editors });
  } catch (error) {
    console.error('[booklet-editors] list failed:', error);
    return NextResponse.json({ error: 'Failed to load editors' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthError(auth)) return auth.response;

  const body = await request.json().catch(() => ({}));
  const codeId = typeof body?.codeId === 'string' ? body.codeId : '';
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!CODE_ID.test(codeId) || !email || email.length > 254 || !email.includes('@')) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const code = (await db.collection('codes').doc(codeId).get()).data();
    if (!code) return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    if (!hasPdfMedia(code.media)) return NextResponse.json({ error: 'not_a_booklet' }, { status: 400 });

    const users = db.collection('users');
    let match = await users.where('email', '==', email).limit(1).get();
    if (match.empty && email !== email.toLowerCase()) {
      match = await users.where('email', '==', email.toLowerCase()).limit(1).get();
    }
    if (match.empty) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

    const target = match.docs[0];
    const targetData = target.data();
    if (target.id === code.ownerId) return NextResponse.json({ error: 'already_owner' }, { status: 400 });
    if (targetData.role === 'super_admin') return NextResponse.json({ error: 'already_admin' }, { status: 400 });

    const actor = await superAdminActor(auth.uid);
    const grant = {
      codeId,
      uid: target.id,
      ownerId: String(code.ownerId || ''),
      email: String(targetData.email || email),
      name: String(targetData.displayName || ''),
      grantedBy: auth.uid,
      grantedByEmail: actor.email || '',
      grantedAt: FieldValue.serverTimestamp(),
      revokedAt: null,
      revokedBy: null,
    };
    await db.collection(BOOKLET_EDITORS_COLLECTION).doc(bookletGrantId(codeId, target.id)).set(grant);
    await recordAccessChange(codeId, 'grant', actor, { uid: target.id, email: grant.email, name: grant.name || undefined });

    return NextResponse.json({ success: true, editor: { uid: target.id, email: grant.email, name: grant.name } });
  } catch (error) {
    console.error('[booklet-editors] grant failed:', error);
    return NextResponse.json({ error: 'Failed to grant access' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthError(auth)) return auth.response;

  const body = await request.json().catch(() => ({}));
  const codeId = typeof body?.codeId === 'string' ? body.codeId : '';
  const uid = typeof body?.uid === 'string' ? body.uid : '';
  if (!CODE_ID.test(codeId) || !CODE_ID.test(uid)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  try {
    const ref = getAdminDb().collection(BOOKLET_EDITORS_COLLECTION).doc(bookletGrantId(codeId, uid));
    const grant = (await ref.get()).data();
    if (!grant || grant.revokedAt) return NextResponse.json({ success: true });

    // Kept (not deleted) so the audit trail shows who had access and until when.
    await ref.update({ revokedAt: FieldValue.serverTimestamp(), revokedBy: auth.uid });
    await recordAccessChange(codeId, 'revoke', await superAdminActor(auth.uid), {
      uid,
      email: grant.email || undefined,
      name: grant.name || undefined,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[booklet-editors] revoke failed:', error);
    return NextResponse.json({ error: 'Failed to revoke access' }, { status: 500 });
  }
}
