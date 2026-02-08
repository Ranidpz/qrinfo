import { NextResponse } from 'next/server';
import { createQRCode } from '@/lib/db';

/**
 * Create a QR code for a Q.Treasure station
 * This QR will redirect to the main game with the station parameter
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      ownerId,
      stationTitle,
      stationOrder,
      parentCodeShortId,
      folderId,
    }: {
      ownerId: string;
      stationTitle: string;
      stationOrder: number;
      parentCodeShortId: string;
      folderId?: string;
    } = body;

    if (!ownerId || !stationTitle || !parentCodeShortId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create a QR code that will be identified as a station
    // The station shortId will be used to redirect to the main game
    const title = `תחנה ${stationOrder}: ${stationTitle}`;

    // Create empty media - the station QR just needs to exist
    // The viewer will detect it's a station and redirect appropriately
    const qrCode = await createQRCode(
      ownerId,
      title,
      [], // Empty media - station logic handled by resolve-station API
      folderId
    );

    return NextResponse.json({
      success: true,
      shortId: qrCode.shortId,
      codeId: qrCode.id,
      title: qrCode.title,
    });
  } catch (error) {
    console.error('Error creating station QR:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create station QR code' },
      { status: 500 }
    );
  }
}
