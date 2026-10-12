import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendOTP, sendTemplateMessage } from '@/lib/inforu';
import { sendQTagQRWhatsApp, type SendQTagQRParams } from '@/lib/qtag-whatsapp';
import { maskPhoneNumber } from '@/lib/phone-utils';
import { DEFAULT_MESSAGE_QUOTA, type INFORUSendResult, type VerificationMethod } from '@/types/verification';

/**
 * THE way to send a paid message (INFORU WhatsApp/SMS). Every send:
 *  1. passes durable anti-abuse caps (Firestore, shared by all serverless instances):
 *     per phone per code, and per code per hour — stops SMS-pumping / cost attacks;
 *  2. is counted on the code owner's users/{uid}.messageQuota.used and logged to messageLogs.
 * Owner-limit ENFORCEMENT is phase 1 (plans); set MESSAGE_QUOTA_ENFORCE=true to block at the limit.
 * Never import sendOTP / sendTemplateMessage / sendQTagQRWhatsApp anywhere else
 * (scripts/security-check.mjs fails the build on it).
 */

const PER_PHONE = { max: 5, windowMs: 10 * 60 * 1000 };
const PER_CODE = { max: 600, windowMs: 60 * 60 * 1000 };

export interface PaidSendContext {
  codeId: string;
  /** What is being sent, for the log (e.g. 'qtag-otp', 'qtag-qr', 'weeklycal-qr'). */
  kind: string;
  /** Skip the per-phone cap (owner-triggered sends from the dashboard). */
  ownerTriggered?: boolean;
}

type GuardResult = { ok: true; ownerId: string | null } | { ok: false; reason: 'MESSAGE_LIMIT' | 'QUOTA_EXCEEDED' };

function capDocId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 40)}`;
}

/** Sliding-window counter in rateLimits/{id} (Admin-only collection). true = allowed and recorded. */
async function takeSlot(id: string, max: number, windowMs: number): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection('rateLimits').doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const recent = ((snap.data()?.sends as number[] | undefined) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return false;
    recent.push(now);
    tx.set(ref, { sends: recent, expiresAt: new Date(now + windowMs) });
    return true;
  });
}

async function guard(ctx: PaidSendContext, phone: string): Promise<GuardResult> {
  const db = getAdminDb();
  let ownerId: string | null = null;
  try {
    ownerId = ((await db.collection('codes').doc(ctx.codeId).get()).data()?.ownerId as string) || null;

    const digits = phone.replace(/\D/g, '');
    if (!ctx.ownerTriggered && !(await takeSlot(capDocId('paid_phone', ctx.codeId, digits), PER_PHONE.max, PER_PHONE.windowMs))) {
      return { ok: false, reason: 'MESSAGE_LIMIT' };
    }
    if (!(await takeSlot(capDocId('paid_code', ctx.codeId), PER_CODE.max, PER_CODE.windowMs))) {
      return { ok: false, reason: 'MESSAGE_LIMIT' };
    }

    if (process.env.MESSAGE_QUOTA_ENFORCE === 'true' && ownerId) {
      const quota = (await db.collection('users').doc(ownerId).get()).data()?.messageQuota;
      if (quota && typeof quota.limit === 'number' && (quota.used || 0) >= quota.limit) {
        return { ok: false, reason: 'QUOTA_EXCEEDED' };
      }
    }
  } catch (err) {
    // Never take a live event down over a guard hiccup — fail open, but log it.
    console.error('[paidSend] guard error (allowing send):', err);
  }
  return { ok: true, ownerId };
}

async function record(ctx: PaidSendContext, ownerId: string | null, phone: string, method: string, result: INFORUSendResult | { success: boolean; error?: string }) {
  try {
    const db = getAdminDb();
    const writes: Promise<unknown>[] = [
      db.collection('messageLogs').add({
        userId: ownerId,
        codeId: ctx.codeId,
        kind: ctx.kind,
        phone,
        method,
        status: result.success ? 'sent' : 'failed',
        ...(result.success ? {} : { errorMessage: String(result.error || '').slice(0, 200) }),
        cost: result.success ? 1 : 0,
        createdAt: FieldValue.serverTimestamp(),
      }),
    ];
    if (result.success && ownerId) {
      const userRef = db.collection('users').doc(ownerId);
      writes.push(userRef.get().then((u) =>
        u.data()?.messageQuota
          ? userRef.update({ 'messageQuota.used': FieldValue.increment(1) })
          : userRef.set({ messageQuota: { ...DEFAULT_MESSAGE_QUOTA, used: 1 } }, { merge: true })
      ));
    }
    await Promise.all(writes);
  } catch (err) {
    console.error(`[paidSend] failed to record ${ctx.kind} to ${maskPhoneNumber(phone)}:`, err);
  }
}

function blocked(reason: string): INFORUSendResult {
  return { success: false, error: reason } as INFORUSendResult;
}

export async function guardedSendOTP(
  ctx: PaidSendContext,
  phone: string,
  code: string,
  method: VerificationMethod,
  locale: 'he' | 'en' = 'he'
): Promise<{ result: INFORUSendResult; methodUsed: 'whatsapp' | 'sms'; blockedReason?: string }> {
  const g = await guard(ctx, phone);
  if (!g.ok) return { result: blocked(g.reason), methodUsed: method === 'sms' ? 'sms' : 'whatsapp', blockedReason: g.reason };
  const sent = await sendOTP(phone, code, method, locale);
  await record(ctx, g.ownerId, phone, sent.methodUsed, sent.result);
  return sent;
}

export async function guardedSendTemplate(
  ctx: PaidSendContext,
  phone: string,
  templateName: string,
  parameters: string[],
  method: 'whatsapp' | 'sms' = 'whatsapp'
): Promise<INFORUSendResult> {
  const g = await guard(ctx, phone);
  if (!g.ok) return blocked(g.reason);
  const result = await sendTemplateMessage(phone, templateName, parameters, method);
  await record(ctx, g.ownerId, phone, method, result);
  return result;
}

export async function guardedSendQTagQR(
  ctx: PaidSendContext,
  params: SendQTagQRParams
): Promise<Awaited<ReturnType<typeof sendQTagQRWhatsApp>>> {
  const g = await guard(ctx, params.guestPhone);
  if (!g.ok) return { success: false, error: g.reason };
  const result = await sendQTagQRWhatsApp(params);
  await record(ctx, g.ownerId, params.guestPhone, 'whatsapp', result);
  return result;
}
