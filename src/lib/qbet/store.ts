// QBet participant store — FIRESTORE (Admin SDK, server-side only).
// Entries live under codes/{codeId}/qbetEntries/{phoneDigits}: the doc id IS
// the normalized phone's digits, which gives one-entry-per-phone for free and
// makes the registration upsert trivial. The subcollection is fully locked in
// firestore.rules (read/write: false) — phones never reach clients except via
// the owner-authenticated /api/qbet/entries route.

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

// Entry shape as exposed to the API routes (timestamps flattened to ISO strings).
export interface QBetEntryRecord {
  id: string; // doc id = phone digits
  codeId: string;
  phone: string; // normalized +972...
  fullName: string;
  locale: string;
  otpHash: string | null;
  otpExpiresAt: string | null; // ISO
  otpAttempts: number;
  otpLastSentAt: string | null; // ISO
  verified: boolean;
  verifiedAt: string | null; // ISO
  entryToken: string | null;
  predictionHome: number | null;
  predictionAway: number | null;
  predictedAt: string | null; // ISO
  createdAt: string | null; // ISO
  updatedAt: string | null; // ISO
}

function entriesCol(codeId: string) {
  return getAdminDb().collection('codes').doc(codeId).collection('qbetEntries');
}

function phoneDocId(phone: string): string {
  return phone.replace(/\D/g, '');
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function docToRecord(
  id: string,
  codeId: string,
  data: FirebaseFirestore.DocumentData
): QBetEntryRecord {
  return {
    id,
    codeId,
    phone: data.phone || '',
    fullName: data.fullName || '',
    locale: data.locale || 'he',
    otpHash: data.otpHash ?? null,
    otpExpiresAt: toIso(data.otpExpiresAt),
    otpAttempts: data.otpAttempts || 0,
    otpLastSentAt: toIso(data.otpLastSentAt),
    verified: !!data.verified,
    verifiedAt: toIso(data.verifiedAt),
    entryToken: data.entryToken ?? null,
    predictionHome: data.predictionHome ?? null,
    predictionAway: data.predictionAway ?? null,
    predictedAt: toIso(data.predictedAt),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export async function getEntry(
  codeId: string,
  phone: string
): Promise<QBetEntryRecord | null> {
  const snap = await entriesCol(codeId).doc(phoneDocId(phone)).get();
  if (!snap.exists) return null;
  return docToRecord(snap.id, codeId, snap.data()!);
}

// Registration upsert: (re)issues an OTP for this phone. Merge-set only touches
// the provided fields, so an already-verified entry keeps its verified flag +
// prediction (re-registering just re-proves phone ownership, e.g. on a new device).
export async function upsertRegistration(params: {
  codeId: string;
  phone: string;
  fullName: string;
  locale: string;
  otpHash: string;
  otpExpiresAt: Date;
}): Promise<void> {
  const ref = entriesCol(params.codeId).doc(phoneDocId(params.phone));
  const existing = await ref.get();
  const now = Timestamp.now();
  await ref.set(
    {
      codeId: params.codeId,
      phone: params.phone,
      fullName: params.fullName,
      locale: params.locale,
      otpHash: params.otpHash,
      otpExpiresAt: Timestamp.fromDate(params.otpExpiresAt),
      otpAttempts: 0,
      otpLastSentAt: now,
      updatedAt: now,
      ...(existing.exists ? {} : { verified: false, createdAt: now }),
    },
    { merge: true }
  );
}

export async function setOtpAttempts(
  codeId: string,
  entryId: string,
  attempts: number
): Promise<void> {
  await entriesCol(codeId).doc(entryId).update({
    otpAttempts: attempts,
    updatedAt: Timestamp.now(),
  });
}

export async function markVerified(
  codeId: string,
  entryId: string,
  entryToken: string
): Promise<void> {
  const now = Timestamp.now();
  await entriesCol(codeId).doc(entryId).update({
    verified: true,
    verifiedAt: now,
    entryToken,
    otpHash: null,
    otpExpiresAt: null,
    updatedAt: now,
  });
}

export async function savePrediction(
  codeId: string,
  entryId: string,
  home: number,
  away: number
): Promise<void> {
  const now = Timestamp.now();
  await entriesCol(codeId).doc(entryId).update({
    predictionHome: home,
    predictionAway: away,
    predictedAt: now,
    updatedAt: now,
  });
}

export async function listEntries(codeId: string): Promise<QBetEntryRecord[]> {
  const snap = await entriesCol(codeId).orderBy('createdAt', 'desc').get();
  return snap.docs.map((doc) => docToRecord(doc.id, codeId, doc.data()));
}

export async function deleteEntry(codeId: string, entryId: string): Promise<void> {
  await entriesCol(codeId).doc(entryId).delete();
}
