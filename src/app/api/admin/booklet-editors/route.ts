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

// Booklets per request in a bulk grant (the admin screen grants to many at once).
const MAX_BULK = 100;

function serializeGrant(grant: FirebaseFirestore.DocumentData) {
  return {
    uid: grant.uid,
    email: grant.email || '',
    name: grant.name || '',
    grantedAt: grant.grantedAt?.toDate?.()?.toISOString() || null,
    grantedByEmail: grant.grantedByEmail || '',
  };
}

/** A grant counts only while it is not revoked and was made under the current owner. */
function isActiveGrant(grant: FirebaseFirestore.DocumentData, ownerId: unknown) {
  return !grant.revokedAt && !!ownerId && grant.ownerId === ownerId;
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthError(auth)) return auth.response;

  const db = getAdminDb();
  const codeId = request.nextUrl.searchParams.get('codeId');

  try {
    // One booklet: its editors.
    if (codeId !== null) {
      if (!CODE_ID.test(codeId)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
      const [snap, codeDoc] = await Promise.all([
        db.collection(BOOKLET_EDITORS_COLLECTION).where('codeId', '==', codeId).get(),
        db.collection('codes').doc(codeId).get(),
      ]);
      const ownerId = codeDoc.data()?.ownerId;
      const editors = snap.docs.map((doc) => doc.data()).filter((g) => isActiveGrant(g, ownerId)).map(serializeGrant);
      return NextResponse.json({ editors });
    }

    // Every booklet (code with a PDF), with its owner and active editors — for the bulk screen.
    const [codesSnap, grantsSnap] = await Promise.all([
      db.collection('codes').select('title', 'shortId', 'ownerId', 'media', 'updatedAt').get(),
      db.collection(BOOKLET_EDITORS_COLLECTION).get(),
    ]);
    const booklets = codesSnap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .filter(({ data }) => hasPdfMedia(data.media));

    const ownerIds = [...new Set(booklets.map(({ data }) => String(data.ownerId || '')).filter(Boolean))];
    const ownerDocs = ownerIds.length ? await db.getAll(...ownerIds.map((id) => db.collection('users').doc(id))) : [];
    const owners = new Map(ownerDocs.map((doc) => [doc.id, doc.data() || {}]));

    const grantsByCode = new Map<string, FirebaseFirestore.DocumentData[]>();
    for (const doc of grantsSnap.docs) {
      const grant = doc.data();
      const list = grantsByCode.get(grant.codeId) || [];
      list.push(grant);
      grantsByCode.set(grant.codeId, list);
    }

    return NextResponse.json({
      booklets: booklets.map(({ id, data }) => {
        const owner = owners.get(String(data.ownerId || '')) || {};
        return {
          codeId: id,
          shortId: String(data.shortId || ''),
          title: String(data.title || ''),
          ownerEmail: String(owner.email || ''),
          ownerName: String(owner.displayName || ''),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
          editors: (grantsByCode.get(id) || []).filter((g) => isActiveGrant(g, data.ownerId)).map(serializeGrant),
        };
      }),
    });
  } catch (error) {
    console.error('[booklet-editors] list failed:', error);
    return NextResponse.json({ error: 'Failed to load editors' }, { status: 500 });
  }
}

type GrantResult = 'granted' | 'already' | 'not_found' | 'not_a_booklet' | 'owner';

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthError(auth)) return auth.response;

  const body = await request.json().catch(() => ({}));
  // `codeIds` (bulk screen) or a single `codeId` (code page).
  const rawIds: unknown[] = Array.isArray(body?.codeIds) ? body.codeIds : [body?.codeId];
  const codeIds = [...new Set(rawIds.filter((id): id is string => typeof id === 'string' && CODE_ID.test(id)))];
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (codeIds.length === 0 || codeIds.length !== rawIds.length || codeIds.length > MAX_BULK
    || !email || email.length > 254 || !email.includes('@')) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const single = !Array.isArray(body?.codeIds);

  try {
    const db = getAdminDb();
    const users = db.collection('users');
    let match = await users.where('email', '==', email).limit(1).get();
    if (match.empty && email !== email.toLowerCase()) {
      match = await users.where('email', '==', email.toLowerCase()).limit(1).get();
    }
    if (match.empty) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

    const target = match.docs[0];
    const targetData = target.data();
    if (targetData.role === 'super_admin') return NextResponse.json({ error: 'already_admin' }, { status: 400 });
    if (targetData.status != null && targetData.status !== 'approved') {
      return NextResponse.json({ error: 'not_approved' }, { status: 400 });
    }

    const actor = await superAdminActor(auth.uid);
    const editor = { uid: target.id, email: String(targetData.email || email), name: String(targetData.displayName || '') };
    const codeDocs = await db.getAll(...codeIds.map((id) => db.collection('codes').doc(id)));
    const grantDocs = await db.getAll(...codeIds.map((id) => db.collection(BOOKLET_EDITORS_COLLECTION).doc(bookletGrantId(id, target.id))));

    const results: { codeId: string; status: GrantResult }[] = [];
    for (let i = 0; i < codeIds.length; i++) {
      const codeId = codeIds[i];
      const code = codeDocs[i].data();
      if (!code) { results.push({ codeId, status: 'not_found' }); continue; }
      if (!hasPdfMedia(code.media)) { results.push({ codeId, status: 'not_a_booklet' }); continue; }
      if (target.id === code.ownerId) { results.push({ codeId, status: 'owner' }); continue; }
      const existing = grantDocs[i].data();
      if (existing && isActiveGrant(existing, code.ownerId)) { results.push({ codeId, status: 'already' }); continue; }

      await grantDocs[i].ref.set({
        codeId,
        uid: target.id,
        ownerId: String(code.ownerId || ''),
        email: editor.email,
        name: editor.name,
        grantedBy: auth.uid,
        grantedByEmail: actor.email || '',
        grantedAt: FieldValue.serverTimestamp(),
        revokedAt: null,
        revokedBy: null,
      });
      await recordAccessChange(codeId, 'grant', actor, { uid: target.id, email: editor.email, name: editor.name || undefined });
      results.push({ codeId, status: 'granted' });
    }

    if (single) {
      const status = results[0].status;
      if (status === 'not_found') return NextResponse.json({ error: 'Code not found' }, { status: 404 });
      if (status === 'not_a_booklet') return NextResponse.json({ error: 'not_a_booklet' }, { status: 400 });
      if (status === 'owner') return NextResponse.json({ error: 'already_owner' }, { status: 400 });
    }
    return NextResponse.json({ success: true, editor, results });
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
