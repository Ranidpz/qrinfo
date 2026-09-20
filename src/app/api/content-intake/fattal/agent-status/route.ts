import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { hasValidServerApiKey } from '@/lib/server-api-key';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { resolveFattalOwnerId } from '@/lib/content-intake/fattal-server';
import { isResendConfigured, sendEmail } from '@/lib/resend';

const labels: Record<string, string> = {
  login_required: 'חיבור WhatsApp נותק. יש לפתוח את תוכנת האיסוף ולחבר שוב את החשבון העסקי.',
  run_failed: 'איסוף או עדכון החוברות דורש בדיקה. פרטי התקלה מופיעים בדוח המקומי של תוכנת האיסוף.',
  no_files: 'לא נמצאו חוברות בחלון הזמן שנבדק. לא בוצעה החלפה במערכת.',
  ready: 'החיבור ותהליך העדכון חזרו לפעול.',
};
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const integrationAuth = hasValidServerApiKey(request, 'CONTENT_INTAKE_API_KEY', ['x-content-intake-key']);
    if (!integrationAuth) {
      const auth = await requireSuperAdmin(request);
      if (isAuthError(auth)) return auth.response;
    }
    const body = await request.json();
    if (typeof body.agentId !== 'string' || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(body.agentId)
      || typeof body.state !== 'string' || !Object.hasOwn(labels, body.state)) {
      return NextResponse.json({ error: 'Invalid agent state' }, { status: 400 });
    }
    const ownerId = await resolveFattalOwnerId({ ownerEmail: body.ownerEmail, integrationAuth });
    if (!ownerId) return NextResponse.json({ error: 'Owner unavailable' }, { status: 403 });
    const key = createHash('sha256').update(`${ownerId}:${body.agentId}`).digest('hex');
    const db = getAdminDb();
    const ref = db.collection('contentIntakeAgents').doc(key);
    const eventId = randomUUID();
    const now = Date.now();
    const notify = await db.runTransaction(async (transaction) => {
      const previous = (await transaction.get(ref)).data();
      const changed = previous?.lastNotifiedState !== body.state;
      const recovery = body.state !== 'ready' || (previous?.lastNotifiedState && previous.lastNotifiedState !== 'ready');
      const allowed = changed && recovery && isResendConfigured() && now - Number(previous?.notificationAttemptAt || 0) > 60000;
      transaction.set(ref, {
        ownerId, agentId: body.agentId, state: body.state, updatedAt: FieldValue.serverTimestamp(),
        ...(allowed ? { notificationAttemptAt: now, notificationEventId: eventId } : {}),
      }, { merge: true });
      return allowed;
    });
    if (!notify) return NextResponse.json({ accepted: true, notified: false });
    const text = `תוכנת איסוף חוברות פתאל\n\n${labels[body.state]}\n\nמזהה התקנה: ${body.agentId}\nמועד: ${new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' }).format(new Date(now))}`;
    const result = await sendEmail({
      to: process.env.FATTAL_REPORT_EMAIL_TO || 'info@playzone.co.il',
      subject: body.state === 'ready' ? 'איסוף חוברות פתאל — החיבור חזר לפעול' : 'איסוף חוברות פתאל — נדרשת בדיקה',
      text, html: `<div dir="rtl" style="white-space:pre-line;font-family:Arial">${text}</div>`,
      idempotencyKey: `fattal-agent/${eventId}`,
    });
    if (result.success) await ref.set({ lastNotifiedState: body.state, lastNotifiedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ accepted: true, notified: result.success });
  } catch (error) {
    console.error('[Fattal agent status]', error);
    return NextResponse.json({ error: 'Failed to record agent status' }, { status: 500 });
  }
}
