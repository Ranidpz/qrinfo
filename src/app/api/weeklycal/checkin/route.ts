import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { CheckinScenario } from '@/types/weeklycal';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { maskPhoneNumber } from '@/lib/phone-utils';

interface ScannerContext {
  currentCellId: string;
  currentSlotIndex: number;
  currentDate: string;
  currentBoothId?: string;
}

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
    cellId: string;
    boothId?: string;
    startSlotIndex?: number;
  };
  activity: {
    title: string;
    time: string;
    boothName: string;
    date: string;
    backgroundColor: string;
    cellId: string;
    startSlotIndex: number;
  };
  alreadyCheckedIn: boolean;
  checkedInAt?: string;
  // New fields
  scenario?: CheckinScenario;
  participationsToday: number;
  // Transfer result
  transferred?: boolean;
  transferredFrom?: string;
  transferredTo?: string;
}

/**
 * POST /api/weeklycal/checkin
 * Query, check-in, or transfer a registration
 *
 * Body: {
 *   qrToken: string,
 *   action: 'query' | 'checkin' | 'transfer',
 *   adminId?: string,
 *   scannerContext?: { currentCellId, currentSlotIndex, currentDate, currentBoothId }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - prevent brute-force token guessing
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`weeklycal-checkin:${clientIp}`, RATE_LIMITS.CHECKIN);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      qrToken,
      action,
      adminId,
      codeId: requestCodeId,
      registrationId: requestRegistrationId,
      scannerContext,
    } = body;

    if (!qrToken || !action) {
      return NextResponse.json(
        { error: 'qrToken and action are required' },
        { status: 400 }
      );
    }

    if (action !== 'query' && action !== 'checkin' && action !== 'transfer') {
      return NextResponse.json(
        { error: 'Invalid action. Use "query", "checkin", or "transfer"' },
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
    const boothDate = regData.boothDate || '';
    let backgroundColor = '#3B82F6';
    let regCellStartSlotIndex = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dayConfig: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cells: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let timeSlots: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let booths: any[] = [];

    const codeDoc = await db.collection('codes').doc(codeId).get();
    if (codeDoc.exists) {
      const codeData = codeDoc.data()!;
      // Config is stored in media[0].weeklycalConfig
      const config = codeData.media?.[0]?.weeklycalConfig;

      if (config?.boothDays) {
        for (const day of config.boothDays) {
          if (day.date === regData.boothDate) {
            dayConfig = day;
            booths = day.booths?.length > 0 ? day.booths : config.defaultBooths || [];
            const booth = booths.find((b: { id: string }) => b.id === regData.boothId);
            if (booth) {
              boothName = booth.name || '';
            }
            // Cells are stored at the day level, not inside booths
            cells = day.cells || [];
            timeSlots = day.timeSlots || [];
            const cell = cells.find((c: { id: string }) => c.id === regData.cellId);
            if (cell) {
              activityTitle = cell.title || '';
              backgroundColor = cell.backgroundColor || '#3B82F6';
              regCellStartSlotIndex = cell.startSlotIndex || 0;
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

    // Determine check-in scenario if scannerContext is provided
    let scenario: CheckinScenario | undefined = undefined;
    if (scannerContext && regData.boothDate && regData.cellId) {
      const sc = scannerContext as ScannerContext;

      if (regData.boothDate !== sc.currentDate) {
        scenario = 'WRONG_DATE';
      } else if (regCellStartSlotIndex === sc.currentSlotIndex) {
        scenario = 'ON_TIME';
      } else if (regCellStartSlotIndex > sc.currentSlotIndex) {
        scenario = 'EARLY'; // Their slot is later
      } else {
        scenario = 'LATE'; // Their slot has passed
      }
    }

    // Calculate today's participation count for this phone
    let participationsToday = 0;
    if (regData.phone) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const normalizedPhone = regData.phone.replace(/\D/g, '');

        // Query all checked-in registrations for this code and date
        const participationsQuery = await db.collection('codes').doc(codeId)
          .collection('cellRegistrations')
          .where('checkedIn', '==', true)
          .where('boothDate', '==', today)
          .get();

        participationsQuery.docs.forEach(doc => {
          const data = doc.data();
          const docPhone = (data.phone || '').replace(/\D/g, '');
          if (docPhone === normalizedPhone) {
            participationsToday++;
          }
        });
      } catch (err) {
        console.error('[WeeklyCal Checkin] Error counting participations:', err);
      }
    }

    // Check if already checked in
    const alreadyCheckedIn = regData.checkedIn === true;
    const checkedInAt = regData.checkedInAt instanceof Timestamp
      ? regData.checkedInAt.toDate().toISOString()
      : regData.checkedInAt || null;

    // Handle transfer action
    if (action === 'transfer' && scannerContext) {
      const sc = scannerContext as ScannerContext;

      // Verify dates match (can only transfer within same day)
      if (regData.boothDate !== sc.currentDate) {
        return NextResponse.json(
          { error: 'Cannot transfer to different day', errorCode: 'WRONG_DATE' },
          { status: 400 }
        );
      }

      // Check if already registered for target cell
      if (regData.cellId === sc.currentCellId) {
        return NextResponse.json(
          { error: 'Already registered for this slot', errorCode: 'SAME_SLOT' },
          { status: 400 }
        );
      }

      // Check capacity of target cell
      const targetCell = cells.find((c: { id: string }) => c.id === sc.currentCellId);
      if (!targetCell) {
        return NextResponse.json(
          { error: 'Target slot not found', errorCode: 'SLOT_NOT_FOUND' },
          { status: 404 }
        );
      }

      // Get target booth for capacity settings
      const targetBoothId = sc.currentBoothId || targetCell.boothId;
      const targetBooth = booths.find((b: { id: string }) => b.id === targetBoothId);

      // Get current registrations for target cell
      const targetRegsQuery = await db.collection('codes').doc(codeId)
        .collection('cellRegistrations')
        .where('cellId', '==', sc.currentCellId)
        .where('boothDate', '==', sc.currentDate)
        .get();

      const currentTargetCount = targetRegsQuery.docs.reduce((sum, doc) =>
        sum + (doc.data().count || 1), 0);

      // Calculate effective capacity with overbooking
      const targetCapacity = targetCell.capacity || targetBooth?.defaultCapacity || 10;
      const overbookingPct = targetCell.overbookingPercentage ?? targetBooth?.overbookingPercentage ?? 10;
      const effectiveCapacity = Math.floor(targetCapacity * (1 + overbookingPct / 100));

      if (currentTargetCount + (regData.count || 1) > effectiveCapacity) {
        return NextResponse.json({
          error: 'Target slot is full',
          errorCode: 'CAPACITY_EXCEEDED',
          currentCount: currentTargetCount,
          capacity: targetCapacity,
          effectiveCapacity,
        }, { status: 409 });
      }

      // Perform the transfer
      const oldCellId = regData.cellId;
      const oldBoothId = regData.boothId;

      // Create new registration ID (since cellId is part of the ID)
      const newRegistrationId = `${regData.visitorId}_${sc.currentCellId}_${regData.boothDate}_${targetBoothId}`;

      // Check if already exists at target
      const existingTargetReg = await db.collection('codes').doc(codeId)
        .collection('cellRegistrations').doc(newRegistrationId).get();

      if (existingTargetReg.exists) {
        return NextResponse.json({
          error: 'Already registered for target slot',
          errorCode: 'ALREADY_REGISTERED',
        }, { status: 409 });
      }

      // Create new document with updated cellId
      const newRegData = {
        ...regData,
        cellId: sc.currentCellId,
        boothId: targetBoothId,
        transferredFrom: oldCellId,
        transferredFromBoothId: oldBoothId,
        transferredAt: FieldValue.serverTimestamp(),
        checkedIn: true,
        checkedInAt: FieldValue.serverTimestamp(),
        checkedInBy: adminId || null,
      };

      await db.collection('codes').doc(codeId)
        .collection('cellRegistrations').doc(newRegistrationId).set(newRegData);

      // Delete old document
      await regDoc.ref.delete();

      // Update QR token mapping
      await db.collection('qrTokenMappings').doc(qrToken).update({
        registrationId: newRegistrationId,
      });

      console.log('[WeeklyCal Checkin] Registration transferred:', oldCellId, '->', sc.currentCellId);

      // Get new activity details
      const newCell = cells.find((c: { id: string }) => c.id === sc.currentCellId);
      const newSlot = timeSlots[newCell?.startSlotIndex || 0];
      const newActivityTime = newSlot?.startTime && newSlot?.endTime
        ? `${newSlot.startTime}-${newSlot.endTime}`
        : '';
      const newBoothObj = booths.find((b: { id: string }) => b.id === targetBoothId);

      // Return transfer success response
      return NextResponse.json({
        registration: {
          id: newRegistrationId,
          nickname: regData.nickname || '',
          phone: maskPhoneNumber(regData.phone || ''),
          count: regData.count || 1,
          avatarUrl: regData.avatarUrl || null,
          avatarType: regData.avatarType || 'none',
          qrToken: regData.qrToken,
          isVerified: regData.isVerified || false,
          checkedIn: true,
          checkedInAt: new Date().toISOString(),
          registeredAt: regData.registeredAt instanceof Timestamp
            ? regData.registeredAt.toDate().toISOString()
            : regData.registeredAt || '',
          cellId: sc.currentCellId,
          boothId: targetBoothId,
          startSlotIndex: newCell?.startSlotIndex || 0,
        },
        activity: {
          title: newCell?.title || '',
          time: newActivityTime,
          boothName: newBoothObj?.name || boothName,
          date: boothDate,
          backgroundColor: newCell?.backgroundColor || '#3B82F6',
          cellId: sc.currentCellId,
          startSlotIndex: newCell?.startSlotIndex || 0,
        },
        alreadyCheckedIn: false,
        checkedInAt: new Date().toISOString(),
        scenario: 'ON_TIME', // After transfer, they're now on time
        participationsToday: participationsToday + 1, // Increment since we just checked them in
        transferred: true,
        transferredFrom: oldCellId,
        transferredTo: sc.currentCellId,
      });
    }

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
        phone: maskPhoneNumber(regData.phone || ''),
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
        cellId: regData.cellId,
        boothId: regData.boothId,
        startSlotIndex: regCellStartSlotIndex,
      },
      activity: {
        title: activityTitle,
        time: activityTime,
        boothName,
        date: boothDate,
        backgroundColor,
        cellId: regData.cellId,
        startSlotIndex: regCellStartSlotIndex,
      },
      alreadyCheckedIn: action === 'checkin' ? alreadyCheckedIn : alreadyCheckedIn,
      checkedInAt: action === 'checkin' && !alreadyCheckedIn
        ? new Date().toISOString()
        : checkedInAt,
      scenario,
      participationsToday: action === 'checkin' && !alreadyCheckedIn
        ? participationsToday + 1
        : participationsToday,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[WeeklyCal Checkin] Error:', error);
    return NextResponse.json(
      { error: 'Check-in failed' },
      { status: 500 }
    );
  }
}
