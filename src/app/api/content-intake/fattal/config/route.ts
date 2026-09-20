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
    const stored = (await db.collection('contentIntakeSettings').doc(`fattal-${ownerId}`).get()).data();
    const schedule = stored ? { checks: stored.checks, timeZone: 'Asia/Jerusalem', revision: stored.revision, effectiveAfter: stored.effectiveAfter } : defaultSchedule();
    if (acknowledge) {
      const body = await request.json();
      if (typeof body.agentId !== 'string' || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(body.agentId) || body.revision !== schedule.revision) return reply({ error: 'Invalid acknowledgment' }, 409);
      const id = createHash('sha256').update(`${ownerId}:${body.agentId}`).digest('hex');
      await db.collection('contentIntakeAgents').doc(id).set({ ownerId, agentId: body.agentId, scheduleRevision: body.revision, scheduleSyncedAt: FieldValue.serverTimestamp() }, { merge: true });
      return reply({ accepted: true });
    }
    return reply(schedule);
  } catch (error) { console.error('[Intake config]', error); return reply({ error: 'Unable to load schedule' }, 500); }
}
