import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuthToken } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FATTAL_BOOKLET_TARGETS } from '@/lib/content-intake/fattal';
import { loadMappedFattalTargets } from '@/lib/content-intake/fattal-server';

export const runtime = 'nodejs';
const reply = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function identity(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if ('error' in auth) return auth;
  const user = (await getAdminDb().collection('users').doc(auth.uid).get()).data();
  return { uid: auth.uid, admin: user?.role === 'super_admin' };
}
export async function GET(request: NextRequest) {
  try {
    const auth = await identity(request);
    if ('error' in auth) return auth.error;
    const db = getAdminDb();
    const codes = await db.collection('codes').where('shortId', 'in', FATTAL_BOOKLET_TARGETS.map(t => t.shortId)).get();
    const visible = codes.docs.filter(d => !d.data().parentCodeShortId && (auth.admin || d.data().ownerId === auth.uid));
    const ids = [...new Set(visible.map(d => String(d.data().ownerId)))];
    const owners = await Promise.all(ids.map(async id => {
      const user = (await db.collection('users').doc(id).get()).data();
      return { id, name: String(user?.displayName || ''), email: String(user?.email || ''), targets: visible.filter(d => d.data().ownerId === id).map(d => ({ shortId: d.data().shortId, title: d.data().title })) };
    }));
    const selected = request.nextUrl.searchParams.get('ownerId') || ids[0];
    if (!selected || !ids.includes(selected)) return reply({ owners, connections: [], agents: [] });
    const [connections, agents] = await Promise.all([
      db.collection('contentIntakeConnections').where('ownerId', '==', selected).get(),
      db.collection('contentIntakeAgents').where('ownerId', '==', selected).get(),
    ]);
    return reply({ owners, connections: connections.docs.map(d => ({ id: d.id, name: d.data().name, revoked: !!d.data().revokedAt, createdAt: d.data().createdAt?.toDate().toISOString() || null })),
      agents: agents.docs.map(d => ({ id: d.data().agentId, state: d.data().state, updatedAt: d.data().updatedAt?.toDate().toISOString() || null })) });
  } catch { return reply({ error: 'Unable to load connections' }, 500); }
}
export async function POST(request: NextRequest) {
  try {
    const auth = await identity(request);
    if ('error' in auth) return auth.error;
    const body = await request.json();
    if (typeof body.ownerId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.ownerId) || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80) return reply({ error: 'Invalid connection' }, 400);
    if (!auth.admin && body.ownerId !== auth.uid) return reply({ error: 'Forbidden' }, 403);
    const targets = await loadMappedFattalTargets(body.ownerId);
    if (!targets.length) return reply({ error: 'No eligible booklets for this owner' }, 400);
    const db = getAdminDb();
    const owner = (await db.collection('users').doc(body.ownerId).get()).data();
    if (!owner?.email) return reply({ error: 'Owner email unavailable' }, 400);
    const id = randomBytes(16).toString('hex');
    const key = `tq_ci_${id}.${randomBytes(32).toString('hex')}`;
    await db.collection('contentIntakeConnections').doc(id).create({
      ownerId: body.ownerId, ownerEmail: owner.email, name: body.name.trim(), workflow: 'fattal-booklets',
      keyHash: createHash('sha256').update(key).digest('hex'), createdBy: auth.uid, createdAt: FieldValue.serverTimestamp(), revokedAt: null,
    });
    return reply({ id, key, ownerEmail: owner.email });
  } catch { return reply({ error: 'Unable to create connection' }, 500); }
}
export async function DELETE(request: NextRequest) {
  try {
    const auth = await identity(request);
    if ('error' in auth) return auth.error;
    const { id } = await request.json();
    if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) return reply({ error: 'Invalid connection' }, 400);
    const db = getAdminDb();
    const ref = db.collection('contentIntakeConnections').doc(id);
    const record = (await ref.get()).data();
    if (!record || (!auth.admin && record.ownerId !== auth.uid)) return reply({ error: 'Forbidden' }, 403);
    await ref.update({ revokedAt: FieldValue.serverTimestamp(), revokedBy: auth.uid });
    return reply({ revoked: true });
  } catch { return reply({ error: 'Unable to revoke connection' }, 500); }
}
