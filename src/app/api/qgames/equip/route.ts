import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { QGamesPlayer, QGamesPrizeType } from '@/types/qgames';
import { updateLeaderboardEntry } from '@/lib/qgames-realtime';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

const EQUIP_SLOTS: Record<QGamesPrizeType, keyof QGamesPlayer> = {
  title: 'equippedTitle',
  avatar_border: 'equippedBorder',
  celebration: 'equippedCelebration',
};

export async function POST(request: Request) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(`qgames-equip:${ip}`, RATE_LIMITS.API);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { codeId, playerId, prizeId, action } = body;

    if (!codeId || !playerId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // action: 'equip' (default) or 'unequip'
    const isUnequip = action === 'unequip';

    const adminDb = getAdminDb();
    const playerRef = adminDb
      .collection('codes').doc(codeId)
      .collection('qgames_players').doc(playerId);

    const playerDoc = await playerRef.get();
    if (!playerDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const player = playerDoc.data() as QGamesPlayer;
    const inventory = player.inventory || [];

    if (isUnequip) {
      // Find what type the currently equipped item is by prizeId
      const item = inventory.find(i => i.prizeId === prizeId);
      if (!item) {
        return NextResponse.json(
          { success: false, error: 'Item not found in inventory' },
          { status: 400 }
        );
      }
      const slot = EQUIP_SLOTS[item.type];
      if (!slot) {
        return NextResponse.json(
          { success: false, error: 'Invalid prize type' },
          { status: 400 }
        );
      }

      await playerRef.update({ [slot]: null });
    } else {
      // Equip: verify player owns the prize
      if (!prizeId) {
        return NextResponse.json(
          { success: false, error: 'Missing prizeId' },
          { status: 400 }
        );
      }

      const item = inventory.find(i => i.prizeId === prizeId);
      if (!item) {
        return NextResponse.json(
          { success: false, error: 'Item not found in inventory' },
          { status: 400 }
        );
      }

      const slot = EQUIP_SLOTS[item.type];
      if (!slot) {
        return NextResponse.json(
          { success: false, error: 'Invalid prize type' },
          { status: 400 }
        );
      }

      await playerRef.update({ [slot]: prizeId });
    }

    // Update RTDB leaderboard entry if title or border changed
    const updatedDoc = await playerRef.get();
    const updatedPlayer = updatedDoc.data() as QGamesPlayer;

    await updateLeaderboardEntry(codeId, {
      id: updatedPlayer.id,
      nickname: updatedPlayer.nickname,
      avatarType: updatedPlayer.avatarType,
      avatarValue: updatedPlayer.avatarValue,
      score: updatedPlayer.score,
      wins: updatedPlayer.totalWins,
      losses: updatedPlayer.totalLosses,
      draws: updatedPlayer.totalDraws,
      gamesPlayed: updatedPlayer.totalGamesPlayed,
      rank: 0, // Will be recalculated
      lastPlayedAt: updatedPlayer.lastPlayedAt,
      rankId: updatedPlayer.rankId || 'rookie',
      equippedTitle: updatedPlayer.equippedTitle || null,
      equippedBorder: updatedPlayer.equippedBorder || null,
    });

    return NextResponse.json({
      success: true,
      equippedTitle: updatedPlayer.equippedTitle || null,
      equippedBorder: updatedPlayer.equippedBorder || null,
      equippedCelebration: updatedPlayer.equippedCelebration || null,
    });
  } catch (error) {
    console.error('Q.Games equip error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to equip item' },
      { status: 500 }
    );
  }
}
