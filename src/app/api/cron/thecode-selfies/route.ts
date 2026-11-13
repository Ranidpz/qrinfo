// GET /api/cron/thecode-selfies — daily (vercel.json). Deletes group selfies past their
// adventure's retention from R2 and clears `photo`. Protected by CRON_SECRET (fails closed).

import { NextRequest, NextResponse } from 'next/server';
import { isR2Configured } from '@/lib/r2-storage';
import { sweepSelfies } from '@/lib/thecode/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isR2Configured()) return NextResponse.json({ ok: false, error: 'notConfigured' }, { status: 503 });
  try {
    const result = await sweepSelfies();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('thecode selfie sweep error:', error);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
