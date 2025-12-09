/**
 * API endpoint for fetching recent winners for lobby display
 * GET /api/lobby/winners?routeId=xxx&limit=10
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecentWinners } from '@/lib/lottery';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get('routeId');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    if (!routeId) {
      return NextResponse.json(
        { error: 'routeId is required' },
        { status: 400 }
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: 'limit must be between 1 and 50' },
        { status: 400 }
      );
    }

    const winners = await getRecentWinners(routeId, limit);

    return NextResponse.json({
      success: true,
      winners,
      count: winners.length,
    });
  } catch (error) {
    console.error('Error fetching winners:', error);
    return NextResponse.json(
      { error: 'Failed to fetch winners' },
      { status: 500 }
    );
  }
}
