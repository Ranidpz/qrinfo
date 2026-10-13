import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuthToken } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { isApprovedStatus } from '@/lib/auth/approval';
import { approvalRequestAdminEmail, ADMIN_NOTIFY_EMAIL } from '@/lib/auth/emails';
import { sendEmail, isResendConfigured } from '@/lib/resend';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// Re-submitting (e.g. fixing a typo in the name) updates the request but only
// re-notifies the admin after this long.
const RENOTIFY_MS = 6 * 60 * 60 * 1000;

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/**
 * A verified, still-pending user sends their join request: name (+ business),
 * which is what the admin sees when deciding. Emails the admin.
 */
export async function POST(request: NextRequest) {
  const limit = checkRateLimit(`request-approval:${getClientIp(request)}`, { maxRequests: 10, windowMs: 60 * 1000 });
  if (!limit.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  let body: { displayName?: unknown; businessName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const displayName = cleanText(body.displayName, 60);
  const businessName = cleanText(body.businessName, 80);
  if (displayName.length < 2) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }

  const db = getAdminDb();
  const ref = db.collection('users').doc(authResult.uid);
  const snap = await ref.get();
  const data = snap.data();
  if (!snap.exists || !data) {
    return NextResponse.json({ error: 'profile_missing' }, { status: 409 });
  }
  if (isApprovedStatus(data.status)) {
    return NextResponse.json({ ok: true, status: 'approved' });
  }

  const now = Date.now();
  const lastNotified = data.adminNotifiedAt?.toMillis?.() ?? 0;
  const shouldNotify = now - lastNotified > RENOTIFY_MS;

  await ref.update({
    displayName,
    businessName: businessName || FieldValue.delete(),
    // A rejected user who asks again goes back into the queue.
    status: 'pending',
    approvalRequestedAt: data.approvalRequestedAt ?? FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (shouldNotify && isResendConfigured()) {
    const mail = approvalRequestAdminEmail({
      displayName,
      businessName,
      email: data.email || undefined,
      phone: data.phone || undefined,
      method: data.signupMethod || 'google',
    });
    const sent = await sendEmail({ to: ADMIN_NOTIFY_EMAIL, ...mail });
    if (sent.success) {
      await ref.update({ adminNotifiedAt: FieldValue.serverTimestamp() });
    }
  }

  return NextResponse.json({ ok: true, status: 'pending' });
}
