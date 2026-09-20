import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { loadMappedFattalTargets } from '@/lib/content-intake/fattal-server';
import { defaultSchedule, validateChecks } from '@/lib/content-intake/schedule';
export const runtime = 'nodejs';
const reply = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: NextRequest) { return handle(request, false); }
export async function PATCH(request: NextRequest) { return handle(request, true); }
async function handle(request: NextRequest, save: boolean) {
  try {
    const auth = await requireSuperAdmin(request);
    if (isAuthError(auth)) return auth.response;
    const ownerId = request.nextUrl.searchParams.get('ownerId') || '';
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(ownerId) || !(await loadMappedFattalTargets(ownerId)).length) return reply({ error: 'Invalid owner' }, 400);
    const db = getAdminDb();
    const ref = db.collection('contentIntakeSettings').doc(`fattal-${ownerId}`);
    if (!save) {
      const data = (await ref.get()).data();
      return reply(data ? { checks: data.checks, revision: data.revision, effectiveAfter: data.effectiveAfter, timeZone: 'Asia/Jerusalem' } : defaultSchedule());
    }
    const body = await request.json();
    const checks = validateChecks(body.checks);
    if (!checks || typeof body.revision !== 'string') return reply({ error: 'Invalid schedule' }, 400);
    const result = await db.runTransaction(async tx => {
      const previous = (await tx.get(ref)).data();
      if ((previous?.revision || 'default-v1') !== body.revision) return null;
      const schedule = { checks, timeZone: 'Asia/Jerusalem', revision: randomUUID(), effectiveAfter: new Date().toISOString() };
      tx.set(ref, { ...schedule, ownerId, updatedBy: auth.uid, updatedAt: FieldValue.serverTimestamp() });
      return schedule;
    });
    return result ? reply(result) : reply({ error: 'Schedule changed; reload before saving' }, 409);
  } catch (error) { console.error('[Intake settings]', error); return reply({ error: 'Unable to update schedule' }, 500); }
}
