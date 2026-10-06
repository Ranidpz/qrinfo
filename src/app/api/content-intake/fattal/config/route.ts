import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { authenticateIntakeKey, resolveFattalOwnerId } from '@/lib/content-intake/fattal-server';
import { defaultSchedule } from '@/lib/content-intake/schedule';
export const runtime = 'nodejs';
const reply = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: NextRequest) { return handle(request, false); }
export async function POST(request: NextRequest) { return handle(request, true); }
async function handle(request: NextRequest, acknowledge: boolean) {
  try {
    const integrationAuth = await authenticateIntakeKey(request);
    if (!integrationAuth) return reply({ error: 'Unauthorized' }, 401);
    const ownerId = await resolveFattalOwnerId({ integrationAuth });
    if (!ownerId) return reply({ error: 'Forbidden' }, 403);
    const db = getAdminDb();
    const body = acknowledge ? await request.json() : null;
    const agentId = acknowledge ? body.agentId : new URL(request.url).searchParams.get('agentId');
    if ((acknowledge || agentId !== null) && (typeof agentId !== 'string' || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(agentId))) return reply({ error: 'Invalid computer' }, 400);
    const ref = agentId ? db.collection('contentIntakeAgents').doc(createHash('sha256').update(`${ownerId}:${agentId}`).digest('hex')) : null;
    const connectionId = typeof integrationAuth === 'object' ? integrationAuth.connectionId : null;
    const connectionRef = connectionId ? db.collection('contentIntakeConnections').doc(connectionId) : null;
    const settingsRef = db.collection('contentIntakeSettings').doc(`fattal-${ownerId}`);
    const stored = (await settingsRef.get()).data();
    const schedule = stored ? { checks: stored.checks, timeZone: 'Asia/Jerusalem', revision: stored.revision, effectiveAfter: stored.effectiveAfter } : defaultSchedule();
    if (!acknowledge) {
      const [agent, connection] = await Promise.all([ref?.get(), connectionRef?.get()]);
      if (agent?.data()?.disabledAt || connection?.data()?.disabledAt || connection?.data()?.revokedAt) return reply({ error: 'Computer disconnected' }, 403);
      if (connection?.data()?.agentId && connection.data()!.agentId !== agentId) return reply({ error: 'Key belongs to another computer' }, 409);
      return reply(schedule);
    }
    if (!ref || body.revision !== schedule.revision) return reply({ error: 'Invalid acknowledgment' }, 409);
    const registration = body.runnerVersion !== undefined;
    if (registration && (typeof body.runnerVersion !== 'string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(body.runnerVersion) || typeof body.computerName !== 'string' || !body.computerName.trim() || body.computerName.length > 80 || /[\x00-\x1f]/.test(body.computerName) || typeof body.scheduleEnabled !== 'boolean' || typeof body.autoCommit !== 'boolean')) return reply({ error: 'Invalid computer status' }, 400);
    const accepted = await db.runTransaction(async tx => {
      const [agent, connection, latestSettings] = await Promise.all([tx.get(ref), connectionRef ? tx.get(connectionRef) : Promise.resolve(null), tx.get(settingsRef)]);
      if ((latestSettings.data()?.revision || 'default-v1') !== body.revision) return false;
      const record = connection?.data();
      if (agent.data()?.disabledAt || (connectionRef && (!record || record.revokedAt || record.disabledAt || record.ownerId !== ownerId || (record.agentId && record.agentId !== agentId)))) return false;
      tx.set(ref, { ownerId, agentId, scheduleRevision: body.revision, scheduleSyncedAt: FieldValue.serverTimestamp(),
        ...(registration ? { computerName: record?.name || body.computerName.trim(), runnerVersion: body.runnerVersion, scheduleEnabled: body.scheduleEnabled, autoCommit: body.autoCommit, lastSeenAt: FieldValue.serverTimestamp(), remoteControl: true, connectionId } : {}),
      }, { merge: true });
      if (registration && connectionRef) tx.set(connectionRef, { agentId }, { merge: true });
      return true;
    });
    return accepted ? reply({ accepted: true }) : reply({ error: 'Computer disconnected or key unavailable' }, 403);
  } catch (error) { console.error('[Intake config]', error); return reply({ error: 'Unable to load schedule' }, 500); }
}
