import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
export const runtime = 'nodejs';
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (isAuthError(auth)) return auth.response;
    const { id, action } = await request.json();
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id) || !['disconnect', 'reconnect'].includes(action)) return NextResponse.json({ error: 'Invalid computer action' }, { status: 400 });
    const db = getAdminDb();
    const ref = db.collection('contentIntakeAgents').doc(id);
    const result = await db.runTransaction(async tx => {
      const agent = (await tx.get(ref)).data();
      if (!agent?.remoteControl) return 'unavailable';
      const connectionRef = agent.connectionId ? db.collection('contentIntakeConnections').doc(agent.connectionId) : null;
      const connection = connectionRef ? (await tx.get(connectionRef)).data() : null;
      if (connectionRef && (!connection || connection.ownerId !== agent.ownerId || connection.agentId !== agent.agentId || (action === 'reconnect' && connection.revokedAt))) return 'unavailable';
      const disabledAt = action === 'disconnect' ? FieldValue.serverTimestamp() : null;
      tx.set(ref, { disabledAt, controlUpdatedBy: auth.uid, controlUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (connectionRef) tx.set(connectionRef, { disabledAt }, { merge: true });
      return 'ok';
    });
    return NextResponse.json(result === 'ok' ? { accepted: true } : { error: 'Computer unavailable or key revoked' }, { status: result === 'ok' ? 200 : 409, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error('[Intake computers]', error); return NextResponse.json({ error: 'Unable to update computer' }, { status: 500 }); }
}
