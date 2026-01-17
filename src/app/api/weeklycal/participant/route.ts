import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * GET /api/weeklycal/participant?token={qrToken}
 * Get registration details by QR token (for landing page)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // First try to look up via the token mapping (fast, no index needed)
    const mappingDoc = await db.collection('qrTokenMappings').doc(token).get();

    let regDoc;
    let regData;
    let codeId: string;

    if (mappingDoc.exists) {
      // Use the mapping to fetch directly
      const mapping = mappingDoc.data()!;
      codeId = mapping.codeId;
      const registrationId = mapping.registrationId;

      const regRef = db.collection('codes').doc(codeId)
        .collection('cellRegistrations').doc(registrationId);
      regDoc = await regRef.get();

      if (!regDoc.exists) {
        return NextResponse.json(
          { error: 'Registration not found' },
          { status: 404 }
        );
      }

      regData = regDoc.data()!;
    } else {
      // Fallback: try collection group query (requires index)
      // This is for tokens created before the mapping was implemented
      try {
        const registrationsQuery = await db.collectionGroup('cellRegistrations')
          .where('qrToken', '==', token)
          .limit(1)
          .get();

        if (registrationsQuery.empty) {
          return NextResponse.json(
            { error: 'Registration not found' },
            { status: 404 }
          );
        }

        regDoc = registrationsQuery.docs[0];
        regData = regDoc.data();
        const parentId = regDoc.ref.parent.parent?.id;

        if (!parentId) {
          return NextResponse.json(
            { error: 'Invalid registration structure' },
            { status: 500 }
          );
        }

        codeId = parentId;

        // Create the mapping for future lookups
        await db.collection('qrTokenMappings').doc(token).set({
          codeId,
          registrationId: regDoc.id,
          createdAt: new Date(),
        });
      } catch (queryError) {
        console.error('[WeeklyCal Participant] Collection group query failed:', queryError);
        return NextResponse.json(
          { error: 'Registration not found' },
          { status: 404 }
        );
      }
    }

    // Get activity details from code config
    let activityName = '';
    let boothName = '';
    let activityTime = '';
    let activityDescription = '';
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
              activityName = cell.title || '';
              activityDescription = cell.description || '';
              backgroundColor = cell.backgroundColor || '#3B82F6';
              // Get time from time slots
              const slot = timeSlots[cell.startSlotIndex || 0];
              activityTime = slot?.startTime && slot?.endTime
                ? `${slot.startTime} - ${slot.endTime}`
                : '';
            }
            break;
          }
        }
      }
    }

    // Format response
    const registration = {
      id: regDoc.id,
      codeId,
      cellId: regData.cellId,
      visitorId: regData.visitorId,
      nickname: regData.nickname || '',
      phone: regData.phone ? maskPhone(regData.phone) : '',
      count: regData.count || 1,
      avatarUrl: regData.avatarUrl || null,
      avatarType: regData.avatarType || 'none',
      qrToken: regData.qrToken,
      isVerified: regData.isVerified || false,
      checkedIn: regData.checkedIn || false,
      checkedInAt: regData.checkedInAt instanceof Timestamp
        ? regData.checkedInAt.toDate().toISOString()
        : regData.checkedInAt || null,
      boothDate: regData.boothDate,
      boothId: regData.boothId,
      weekStartDate: regData.weekStartDate,
      registeredAt: regData.registeredAt instanceof Timestamp
        ? regData.registeredAt.toDate().toISOString()
        : regData.registeredAt || null,
      // Activity details
      activityName,
      boothName,
      activityTime,
      activityDescription,
      backgroundColor,
    };

    return NextResponse.json({ registration });

  } catch (error) {
    console.error('[WeeklyCal Participant] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registration', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Mask phone number for privacy: 052-123-4567 -> 052-***-4567
 */
function maskPhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 7) return phone;

  // Format: show first 3 and last 4, mask middle
  const firstPart = digits.slice(0, 3);
  const lastPart = digits.slice(-4);

  return `${firstPart}-***-${lastPart}`;
}
