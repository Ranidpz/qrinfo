import type { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase-admin';
import TheCodeStaff from './TheCodeStaff';

// קוד הגמדים — the venue staff screen. Public URL, but nothing is shown before a WhatsApp code
// to a phone on the adventure's staff list. Resolved by shortId on the server (Admin SDK); only
// the PUBLIC title is passed down.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'קוד הגמדים — צוות',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

async function resolve(shortId: string): Promise<{ codeId: string; title: string } | null> {
  if (!/^[A-Za-z0-9_-]{4,20}$/.test(shortId)) return null;
  try {
    const snap = await getAdminDb().collection('codes').where('shortId', '==', shortId).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = doc.data() as { title?: string; media?: { type?: string; title?: string; thecodeConfig?: { title?: string } }[] };
    const m = (data.media || []).find((x) => x?.type === 'thecode');
    if (!m) return null;
    return { codeId: doc.id, title: m.thecodeConfig?.title || m.title || data.title || 'קוד הגמדים' };
  } catch (err) {
    console.error('[staff/thecode] resolve failed', err);
    return null;
  }
}

export default async function TheCodeStaffPage({ params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await params;
  const found = await resolve(shortId);
  return <TheCodeStaff codeId={found?.codeId ?? null} shortId={shortId} title={found?.title ?? ''} />;
}
