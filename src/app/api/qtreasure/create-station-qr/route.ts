import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Generate a unique short ID for QR codes
function generateShortId(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create a QR code for a Q.Treasure station
 * Uses Admin SDK to bypass Firestore auth rules (server-side operation)
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

    const db = getAdminDb();
    const shortId = generateShortId();
    const title = `תחנה ${stationOrder}: ${stationTitle}`;

    const codeData: Record<string, unknown> = {
      shortId,
      ownerId,
      collaborators: [],
      title,
      parentCodeShortId,
      media: [],
      widgets: {
        qrSign: {
          enabled: true,
          type: 'logo',
          value: '/theQ.png',
          color: '#000000',
          backgroundColor: '#ffffff',
          scale: 1.0,
        },
      },
      views: 0,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (folderId) {
      codeData.folderId = folderId;
    }

    const docRef = await db.collection('codes').add(codeData);

    return NextResponse.json({
      success: true,
      shortId,
      codeId: docRef.id,
      title,
    });
  } catch (error) {
    console.error('Error creating station QR:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create station QR code' },
      { status: 500 }
    );
  }
}
