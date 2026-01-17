import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

interface CheckinResponse {
  registration: {
    id: string;
    nickname: string;
    phone: string;
    count: number;
    avatarUrl?: string;
    avatarType: 'photo' | 'emoji' | 'none';
    qrToken: string;
    isVerified: boolean;
    checkedIn: boolean;
    checkedInAt?: string;
    registeredAt: string;
  };
  activity: {
    title: string;
    time: string;
    boothName: string;
    date: string;
    backgroundColor: string;
  };
  alreadyCheckedIn: boolean;
  checkedInAt?: string;
}

/**
 * POST /api/weeklycal/checkin
 * Query or process check-in for a registration
 *
 * Body: { qrToken: string, action: 'query' | 'checkin', adminId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qrToken, action, adminId, codeId: requestCodeId, registrationId: requestRegistrationId } = body;

    if (!qrToken || !action) {
      return NextResponse.json(
        { error: 'qrToken and action are required' },
        { status: 400 }
      );
    }

    if (action !== 'query' && action !== 'checkin') {
      return NextResponse.json(
        { error: 'Invalid action. Use "query" or "checkin"' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Variables for registration lookup
    let codeId: string | null = null;
    let registrationId: string | null = null;
    let regDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    // Method 1: Direct lookup if codeId and registrationId provided
    if (requestCodeId && requestRegistrationId) {
      regDoc = await db.collection('codes').doc(requestCodeId)
        .collection('cellRegistrations').doc(requestRegistrationId).get();

      if (regDoc.exists) {
        codeId = requestCodeId;
        registrationId = requestRegistrationId;

        // Create mapping for future lookups if it doesn't exist
        const tokenMappingDoc = await db.collection('qrTokenMappings').doc(qrToken).get();
        if (!tokenMappingDoc.exists) {
          await db.collection('qrTokenMappings').doc(qrToken).set({
            codeId,
            registrationId,
            createdAt: FieldValue.serverTimestamp(),
          });
          console.log('[WeeklyCal Checkin] Created qrTokenMapping for', qrToken);
        }
      }
    }

    // Method 2: Try qrTokenMappings if direct lookup didn't work
    if (!regDoc || !regDoc.exists) {
      const tokenMappingDoc = await db.collection('qrTokenMappings').doc(qrToken).get();
      if (tokenMappingDoc.exists) {
        const mapping = tokenMappingDoc.data()!;
        codeId = mapping.codeId as string;
        registrationId = mapping.registrationId as string;

        // Get the registration document directly
        regDoc = await db.collection('codes').doc(codeId)
          .collection('cellRegistrations').doc(registrationId).get();
      }
    }

    // Method 3: Fallback to collection group query
    if (!regDoc || !regDoc.exists) {
      try {
        const registrationsQuery = await db.collectionGroup('cellRegistrations')
          .where('qrToken', '==', qrToken)
          .limit(1)
          .get();

        if (!registrationsQuery.empty) {
          regDoc = registrationsQuery.docs[0];
          codeId = regDoc.ref.parent.parent?.id || null;
          registrationId = regDoc.id;

          // Create mapping for future lookups
          if (codeId && registrationId) {
            await db.collection('qrTokenMappings').doc(qrToken).set({
              codeId,
              registrationId,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }
      } catch (error) {
        console.error('[WeeklyCal Checkin] Collection group query failed:', error);
        // Continue - regDoc will be null and we'll return NOT_FOUND
      }
    }

    if (!regDoc || !regDoc.exists) {
      return NextResponse.json(
        { error: 'Registration not found', errorCode: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const regData = regDoc.data()!;

    if (!codeId) {
      return NextResponse.json(
        { error: 'Invalid registration structure' },
        { status: 500 }
      );
    }

    // Get activity details from code config
    let activityTitle = '';
    let activityTime = '';
    let boothName = '';
    let boothDate = regData.boothDate || '';
    let backgroundColor = '#3B82F6';

    const codeDoc = await db.collection('codes').doc(codeId).get();
    if (codeDoc.exists) {
      const codeData = codeDoc.data()!;
      // Config is stored in media[0].weeklycalConfig
      const config = codeData.media?.[0]?.weeklycalConfig;

      if (config?.boothDays) {
        for (const day of config.boothDays) {
          if (day.date === regData.boothDate) {
            const booths = day.booths?.length > 0 ? day.booths : config.defaultBooths || [];
            const booth = booths.find((b: { id: string }) => b.id === regData.boothId);
            if (booth) {
              boothName = booth.name || '';
            }
            // Cells are stored at the day level, not inside booths
            const cells = day.cells || [];
            const timeSlots = day.timeSlots || [];
            const cell = cells.find((c: { id: string }) => c.id === regData.cellId);
            if (cell) {
              activityTitle = cell.title || '';
              backgroundColor = cell.backgroundColor || '#3B82F6';
              // Get time from time slots
              const slot = timeSlots[cell.startSlotIndex || 0];
              activityTime = slot?.startTime && slot?.endTime
                ? `${slot.startTime}-${slot.endTime}`
                : '';
            }
            break;
          }
        }
      }
    }

    // Check if already checked in
    const alreadyCheckedIn = regData.checkedIn === true;
    const checkedInAt = regData.checkedInAt instanceof Timestamp
      ? regData.checkedInAt.toDate().toISOString()
      : regData.checkedInAt || null;

    // If action is 'checkin', mark as checked in
    if (action === 'checkin' && !alreadyCheckedIn) {
      await regDoc.ref.update({
        checkedIn: true,
        checkedInAt: FieldValue.serverTimestamp(),
        checkedInBy: adminId || null,
      });

      console.log('[WeeklyCal Checkin] Registration checked in:', regDoc.id);
    }

    // Build response
    const response: CheckinResponse = {
      registration: {
        id: regDoc.id,
        nickname: regData.nickname || '',
        phone: maskPhone(regData.phone || ''),
        count: regData.count || 1,
        avatarUrl: regData.avatarUrl || null,
        avatarType: regData.avatarType || 'none',
        qrToken: regData.qrToken,
        isVerified: regData.isVerified || false,
        checkedIn: action === 'checkin' ? true : alreadyCheckedIn,
        checkedInAt: action === 'checkin' && !alreadyCheckedIn
          ? new Date().toISOString()
          : checkedInAt,
        registeredAt: regData.registeredAt instanceof Timestamp
          ? regData.registeredAt.toDate().toISOString()
          : regData.registeredAt || '',
      },
      activity: {
        title: activityTitle,
        time: activityTime,
        boothName,
        date: boothDate,
        backgroundColor,
      },
      alreadyCheckedIn: action === 'checkin' ? alreadyCheckedIn : alreadyCheckedIn,
      checkedInAt: action === 'checkin' && !alreadyCheckedIn
        ? new Date().toISOString()
        : checkedInAt,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[WeeklyCal Checkin] Error:', error);
    return NextResponse.json(
      { error: 'Check-in failed', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Mask phone number for privacy
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return phone;
  const firstPart = digits.slice(0, 3);
  const lastPart = digits.slice(-4);
  return `${firstPart}-***-${lastPart}`;
}
