import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { QTreasureConfig, QTreasureStation } from '@/types/qtreasure';

interface ResolveStationResult {
  found: boolean;
  mainCodeId?: string;
  mainCodeShortId?: string;
  stationId?: string;
  stationOrder?: number;
  totalStations?: number;
  gameTitle?: string;
}

/**
 * Resolve a station shortId to find the parent Q.Treasure game
 * This is used when someone scans a station QR directly
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const stationShortId = searchParams.get('stationShortId');

    if (!stationShortId) {
      return NextResponse.json(
        { found: false, error: 'Missing stationShortId parameter' },
        { status: 400 }
      );
    }

    // Search all codes for a Q.Treasure with this station shortId
    const codesRef = collection(db, 'codes');
    const codesSnapshot = await getDocs(query(codesRef));

    for (const codeDoc of codesSnapshot.docs) {
      const codeData = codeDoc.data();

      // Find qtreasure media item
      const qtreasureMedia = codeData.media?.find(
        (m: { type: string }) => m.type === 'qtreasure'
      );

      if (!qtreasureMedia?.qtreasureConfig) continue;

      const config: QTreasureConfig = qtreasureMedia.qtreasureConfig;

      // Check if any station has this shortId
      const station = config.stations.find(
        (s: QTreasureStation) => s.isActive && s.stationShortId === stationShortId
      );

      if (station) {
        const activeStations = config.stations.filter((s: QTreasureStation) => s.isActive);

        return NextResponse.json({
          found: true,
          mainCodeId: codeDoc.id,
          mainCodeShortId: codeData.shortId,
          stationId: station.id,
          stationOrder: station.order,
          totalStations: activeStations.length,
          gameTitle: config.branding?.gameTitle || 'ציד אוצרות',
        } as ResolveStationResult);
      }
    }

    // Not found - this shortId is not a station
    return NextResponse.json({ found: false } as ResolveStationResult);

  } catch (error) {
    console.error('Error resolving station:', error);
    return NextResponse.json(
      { found: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
