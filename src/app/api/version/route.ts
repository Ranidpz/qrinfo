import { NextResponse } from 'next/server';
import { APP_VERSION, getLatestUpdate } from '@/lib/version';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      version: APP_VERSION,
      latestUpdate: getLatestUpdate(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
