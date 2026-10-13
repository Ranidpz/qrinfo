import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { accountApprovedEmail } from '@/lib/auth/emails';
import { sendEmail, isResendConfigured } from '@/lib/resend';

export const dynamic = 'force-dynamic';

/** Super admin approves or rejects a join request. Approval emails the user once. */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthError(auth)) return auth.response;

  let body: { uid?: unknown; action?: unknown; locale?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const uid = typeof body.uid === 'string' ? body.uid : '';
  const action = body.action;
  if (!uid || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const ref = getAdminDb().collection('users').doc(uid);
  const snap = await ref.get();
  const data = snap.data();
  if (!snap.exists || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (action === 'reject') {
    await ref.update({
      status: 'rejected',
      rejectedAt: FieldValue.serverTimestamp(),
      reviewedBy: auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  await ref.update({
    status: 'approved',
    approvedAt: FieldValue.serverTimestamp(),
    reviewedBy: auth.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  let emailed = false;
  if (data.email && !data.approvalEmailSentAt && isResendConfigured()) {
    const mail = accountApprovedEmail({
      displayName: data.displayName || '',
      locale: body.locale === 'en' ? 'en' : 'he',
    });
    const sent = await sendEmail({ to: data.email, ...mail, idempotencyKey: `approved-${uid}` });
    if (sent.success) {
      emailed = true;
      await ref.update({ approvalEmailSentAt: FieldValue.serverTimestamp() });
    }
  }

  return NextResponse.json({ ok: true, status: 'approved', emailed });
}
