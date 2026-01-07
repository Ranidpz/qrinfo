import { NextResponse } from 'next/server';
import {
  getQChallengeLeaderboard,
  getQChallengeStats,
} from '@/lib/qchallenge-realtime';
import { QChallengeLeaderboardEntry } from '@/types/qchallenge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('codeId');
    const branchId = searchParams.get('branchId');
    const playerId = searchParams.get('playerId');
    const limitParam = searchParams.get('limit');

    if (!codeId) {
      return NextResponse.json(
        { success: false, error: 'Missing codeId' },
        { status: 400 }
      );
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    // Get leaderboard from Realtime DB
    let leaderboard = await getQChallengeLeaderboard(codeId);

    // Filter by branch if specified
    if (branchId) {
      leaderboard = leaderboard.filter(entry => entry.branchId === branchId);

      // Recalculate ranks for branch-filtered results
      leaderboard.forEach((entry, index) => {
        entry.rank = index + 1;
      });
    }

    // Get player's rank if specified and not in top results
    let playerRank: number | undefined;
    let playerEntry: QChallengeLeaderboardEntry | undefined;

    if (playerId) {
      playerEntry = leaderboard.find(entry => entry.visitorId === playerId);
      if (playerEntry) {
        playerRank = playerEntry.rank;
      }
    }

    // Apply limit
    const limitedLeaderboard = leaderboard.slice(0, limit);

    // Get stats
    const stats = await getQChallengeStats(codeId);

    return NextResponse.json({
      success: true,
      leaderboard: limitedLeaderboard,
      totalPlayers: stats?.totalPlayers || leaderboard.length,
      playerRank,
      playerEntry: playerEntry && playerEntry.rank > limit ? playerEntry : undefined,
      lastUpdated: stats?.lastUpdated || Date.now(),
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
