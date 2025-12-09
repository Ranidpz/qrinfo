/**
 * Lottery System for Pack Opening
 * Handles prize drawing with weighted drop rates and fallback logic
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  runTransaction,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Prize, PrizeRarity, PendingPack, PackOpening, Visitor } from '@/types';

// Rarity order for fallback (from highest to lowest)
const RARITY_ORDER: PrizeRarity[] = ['legendary', 'epic', 'rare', 'common'];

/**
 * Get all available prizes for a route
 */
export async function getAvailablePrizes(routeId: string): Promise<Prize[]> {
  const q = query(
    collection(db, 'prizes'),
    where('routeId', '==', routeId),
    where('isActive', '==', true)
  );

  const snapshot = await getDocs(q);
  const prizes: Prize[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    // Only include prizes with remaining inventory
    if (data.claimed < data.totalAvailable) {
      prizes.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as Prize);
    }
  });

  return prizes;
}

/**
 * Draw a random prize based on drop rates
 * Returns null if no prizes are available
 */
export async function drawPrize(routeId: string): Promise<{
  prize: Prize | null;
  fallbackUsed: boolean;
}> {
  const prizes = await getAvailablePrizes(routeId);

  if (prizes.length === 0) {
    return { prize: null, fallbackUsed: false };
  }

  // Calculate total weight
  const totalWeight = prizes.reduce((sum, p) => sum + p.dropRate, 0);

  if (totalWeight === 0) {
    return { prize: null, fallbackUsed: false };
  }

  // Generate random number between 0 and totalWeight
  let random = Math.random() * totalWeight;

  // Select prize based on weighted random
  for (const prize of prizes) {
    random -= prize.dropRate;
    if (random <= 0) {
      return { prize, fallbackUsed: false };
    }
  }

  // Fallback to first available prize (shouldn't happen normally)
  return { prize: prizes[0], fallbackUsed: true };
}

/**
 * Get fallback prize when the selected rarity is exhausted
 * Tries lower rarities in order
 */
export async function getFallbackPrize(
  routeId: string,
  excludeRarity?: PrizeRarity
): Promise<Prize | null> {
  const prizes = await getAvailablePrizes(routeId);

  // Try each rarity level from lowest to highest (more likely to have inventory)
  const fallbackOrder = [...RARITY_ORDER].reverse();

  for (const rarity of fallbackOrder) {
    if (rarity === excludeRarity) continue;

    const available = prizes.find((p) => p.rarity === rarity);
    if (available) {
      return available;
    }
  }

  return null;
}

/**
 * Claim a prize atomically using Firestore transaction
 * This prevents race conditions when multiple users claim the same prize
 */
export async function claimPrize(
  visitorId: string,
  pendingPackId: string
): Promise<PackOpening | null> {
  return runTransaction(db, async (transaction) => {
    // 1. Get pending pack
    const pendingPackRef = doc(db, 'pendingPacks', pendingPackId);
    const pendingPackSnap = await transaction.get(pendingPackRef);

    if (!pendingPackSnap.exists()) {
      throw new Error('Pack not found');
    }

    const pendingPack = pendingPackSnap.data() as PendingPack;

    if (pendingPack.opened) {
      throw new Error('Pack already opened');
    }

    if (pendingPack.visitorId !== visitorId) {
      throw new Error('Pack does not belong to this visitor');
    }

    // 2. Get visitor for nickname
    const visitorRef = doc(db, 'visitors', visitorId);
    const visitorSnap = await transaction.get(visitorRef);
    const visitor = visitorSnap.exists() ? (visitorSnap.data() as Visitor) : null;
    const nickname = visitor?.nickname || 'Player';

    // 3. Get available prizes for this route
    const prizesQuery = query(
      collection(db, 'prizes'),
      where('routeId', '==', pendingPack.routeId),
      where('isActive', '==', true)
    );

    const prizesSnap = await getDocs(prizesQuery);
    const availablePrizes: Prize[] = [];

    prizesSnap.forEach((doc) => {
      const data = doc.data();
      if (data.claimed < data.totalAvailable) {
        availablePrizes.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Prize);
      }
    });

    if (availablePrizes.length === 0) {
      throw new Error('No prizes available');
    }

    // 4. Draw a prize
    const totalWeight = availablePrizes.reduce((sum, p) => sum + p.dropRate, 0);
    let random = Math.random() * totalWeight;
    let selectedPrize = availablePrizes[0];

    for (const prize of availablePrizes) {
      random -= prize.dropRate;
      if (random <= 0) {
        selectedPrize = prize;
        break;
      }
    }

    // 5. Verify prize is still available and increment claimed count
    const prizeRef = doc(db, 'prizes', selectedPrize.id);
    const prizeSnap = await transaction.get(prizeRef);
    const prizeData = prizeSnap.data();

    if (!prizeData || prizeData.claimed >= prizeData.totalAvailable) {
      // Prize was claimed by another user during transaction
      // Try to find a fallback prize
      const fallbackPrize = availablePrizes.find(
        (p) => p.id !== selectedPrize.id && p.claimed < p.totalAvailable
      );

      if (!fallbackPrize) {
        throw new Error('All prizes claimed, please try again');
      }

      selectedPrize = fallbackPrize;
      const fallbackRef = doc(db, 'prizes', fallbackPrize.id);
      transaction.update(fallbackRef, {
        claimed: increment(1),
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.update(prizeRef, {
        claimed: increment(1),
        updatedAt: serverTimestamp(),
      });
    }

    // 6. Mark pending pack as opened
    transaction.update(pendingPackRef, {
      opened: true,
    });

    // 7. Decrement visitor's pending pack count
    if (visitorSnap.exists()) {
      const currentCount = visitor?.pendingPackCount || 0;
      transaction.update(visitorRef, {
        pendingPackCount: Math.max(0, currentCount - 1),
        updatedAt: serverTimestamp(),
      });
    }

    // 8. Create pack opening record
    const openingRef = doc(collection(db, 'packOpenings'));
    const openingData: Omit<PackOpening, 'openedAt'> & { openedAt: ReturnType<typeof serverTimestamp> } = {
      id: openingRef.id,
      visitorId,
      visitorNickname: nickname,
      routeId: pendingPack.routeId,
      prizeId: selectedPrize.id,
      prizeName: selectedPrize.name,
      prizeNameEn: selectedPrize.nameEn,
      prizeRarity: selectedPrize.rarity,
      prizeImageUrl: selectedPrize.imageUrl || '',
      openedAt: serverTimestamp(),
      redeemed: false,
    };

    transaction.set(openingRef, openingData);

    // Return the opening data
    return {
      ...openingData,
      openedAt: new Date(),
    } as PackOpening;
  });
}

/**
 * Get pending packs for a visitor in a specific route
 */
export async function getPendingPacks(
  visitorId: string,
  routeId?: string
): Promise<PendingPack[]> {
  let q;

  if (routeId) {
    q = query(
      collection(db, 'pendingPacks'),
      where('visitorId', '==', visitorId),
      where('routeId', '==', routeId),
      where('opened', '==', false)
    );
  } else {
    q = query(
      collection(db, 'pendingPacks'),
      where('visitorId', '==', visitorId),
      where('opened', '==', false)
    );
  }

  const snapshot = await getDocs(q);
  const packs: PendingPack[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    packs.push({
      id: doc.id,
      ...data,
      earnedAt: data.earnedAt?.toDate(),
    } as PendingPack);
  });

  return packs;
}

/**
 * Get pack opening history for a visitor
 */
export async function getPackOpenings(
  visitorId: string,
  routeId?: string,
  limit = 10
): Promise<PackOpening[]> {
  let q;

  if (routeId) {
    q = query(
      collection(db, 'packOpenings'),
      where('visitorId', '==', visitorId),
      where('routeId', '==', routeId)
    );
  } else {
    q = query(
      collection(db, 'packOpenings'),
      where('visitorId', '==', visitorId)
    );
  }

  const snapshot = await getDocs(q);
  const openings: PackOpening[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    openings.push({
      id: doc.id,
      ...data,
      openedAt: data.openedAt?.toDate(),
      redeemedAt: data.redeemedAt?.toDate(),
    } as PackOpening);
  });

  // Sort by openedAt descending and limit
  return openings
    .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())
    .slice(0, limit);
}

/**
 * Get recent winners for lobby display (epic/legendary only)
 */
export async function getRecentWinners(
  routeId: string,
  limit = 10
): Promise<PackOpening[]> {
  const q = query(
    collection(db, 'packOpenings'),
    where('routeId', '==', routeId),
    where('prizeRarity', 'in', ['epic', 'legendary'])
  );

  const snapshot = await getDocs(q);
  const winners: PackOpening[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    winners.push({
      id: doc.id,
      ...data,
      openedAt: data.openedAt?.toDate(),
      redeemedAt: data.redeemedAt?.toDate(),
    } as PackOpening);
  });

  // Sort by openedAt descending and limit
  return winners
    .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())
    .slice(0, limit);
}
