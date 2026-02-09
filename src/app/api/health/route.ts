import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  const start = Date.now();
  try {
    const db = getAdminDb();
    await db.collection('_health').doc('ping').set({
      timestamp: FieldValue.serverTimestamp(),
      region: process.env.VERCEL_REGION || 'local',
    });

    return NextResponse.json({
      status: 'ok',
      latencyMs: Date.now() - start,
      region: process.env.VERCEL_REGION || 'local',
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: String(error), latencyMs: Date.now() - start },
      { status: 500 }
    );
  }
}
