import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  QGamesPlayer,
  QGamesInventoryItem,
  QGamesPrize,
  QGamesPrizeRarity,
  QGamesCustomPrize,
  QGAMES_PRIZE_CATALOG,
  RARITY_DROP_RATES,
  DEFAULT_POINTS_PER_PACK,
} from '@/types/qgames';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

/** Roll a rarity tier based on drop rates */
function rollRarity(): QGamesPrizeRarity {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const [rarity, rate] of Object.entries(RARITY_DROP_RATES)) {
    cumulative += rate;
    if (roll < cumulative) return rarity as QGamesPrizeRarity;
  }
  return 'common';
}

/** Roll a random cosmetic prize from the catalog */
function rollCosmeticPrize(): QGamesPrize {
  const rarity = rollRarity();
  const prizesOfRarity = QGAMES_PRIZE_CATALOG.filter(p => p.rarity === rarity);
  if (prizesOfRarity.length === 0) {
    // Fallback to common if somehow empty
    const commonPrizes = QGAMES_PRIZE_CATALOG.filter(p => p.rarity === 'common');
    return commonPrizes[Math.floor(Math.random() * commonPrizes.length)];
  }
  return prizesOfRarity[Math.floor(Math.random() * prizesOfRarity.length)];
}

/** Try to roll a custom (admin-defined) prize. Returns null if no hit. */
function tryRollCustomPrize(customPrizes: QGamesCustomPrize[]): QGamesCustomPrize | null {
  // Filter to available prizes (stock > claimed)
  const available = customPrizes.filter(p => p.claimed < p.totalStock);
  if (available.length === 0) return null;

  // Roll against each prize's dropChance
  for (const prize of available) {
    if (Math.random() * 100 < prize.dropChance) {
      return prize;
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(`qgames-pack:${ip}`, RATE_LIMITS.API);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { codeId, playerId } = body;

    if (!codeId || !playerId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();

    // Read player
    const playerRef = adminDb
      .collection('codes').doc(codeId)
      .collection('qgames_players').doc(playerId);

    // Use transaction to prevent race conditions
    const result = await adminDb.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);
      if (!playerDoc.exists) {
        return { error: 'Player not found', status: 404 };
      }

      const player = playerDoc.data() as QGamesPlayer;

      if (!player.unopenedPacks || player.unopenedPacks <= 0) {
        return { error: 'No packs to open', status: 400 };
      }

      // Read config for custom prizes
      const codeDoc = await transaction.get(adminDb.collection('codes').doc(codeId));
      const codeData = codeDoc.data();
      const gamesMedia = codeData?.media?.find(
        (m: { type: string }) => m.type === 'minigames'
      );
      const rewardsConfig = gamesMedia?.qgamesConfig?.rewards;
      const customPrizes: QGamesCustomPrize[] = rewardsConfig?.customPrizes || [];

      // Try custom prize first, then cosmetic
      const customWin = tryRollCustomPrize(customPrizes);

      let inventoryItem: QGamesInventoryItem;
      let isCustomPrize = false;
      let customPrizeId: string | null = null;

      if (customWin) {
        // Won an admin-defined prize
        isCustomPrize = true;
        customPrizeId = customWin.id;
        inventoryItem = {
          prizeId: customWin.id,
          type: 'title', // custom prizes display as special items
          rarity: 'legendary',
          nameEn: customWin.name,
          nameHe: customWin.name,
          value: customWin.name,
          earnedAt: Date.now(),
          isCustomPrize: true,
        };

        // Increment claimed count on custom prize
        const updatedCustomPrizes = customPrizes.map(p =>
          p.id === customWin.id ? { ...p, claimed: p.claimed + 1 } : p
        );

        // Update the custom prizes in the code document
        const mediaArray = codeData?.media || [];
        const mediaIndex = mediaArray.findIndex(
          (m: { type: string }) => m.type === 'minigames'
        );
        if (mediaIndex >= 0) {
          mediaArray[mediaIndex].qgamesConfig.rewards = {
            ...rewardsConfig,
            customPrizes: updatedCustomPrizes,
          };
          transaction.update(adminDb.collection('codes').doc(codeId), { media: mediaArray });
        }
      } else {
        // Roll cosmetic prize
        const prize = rollCosmeticPrize();
        inventoryItem = {
          prizeId: prize.id,
          type: prize.type,
          rarity: prize.rarity,
          nameEn: prize.nameEn,
          nameHe: prize.nameHe,
          value: prize.value,
          earnedAt: Date.now(),
        };
      }

      // Update player: decrement unopenedPacks, add to inventory
      const inventory = player.inventory || [];
      inventory.push(inventoryItem);

      transaction.update(playerRef, {
        unopenedPacks: player.unopenedPacks - 1,
        inventory,
      });

      return {
        success: true,
        prize: inventoryItem,
        isCustomPrize,
        customPrizeId,
        remainingPacks: player.unopenedPacks - 1,
      };
    });

    if ('error' in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Q.Games pack open error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to open pack' },
      { status: 500 }
    );
  }
}
