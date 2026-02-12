import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { normalizePhoneNumber, isValidIsraeliMobile } from '@/lib/phone-utils';
import crypto from 'crypto';
import { sendQTagQRWhatsApp } from '@/lib/qtag-whatsapp';

// Generate cryptographically secure QR token for check-in
function generateQRToken(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`qtag-register:${clientIp}`, RATE_LIMITS.API);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { codeId, name, phone, plusOneCount = 0, plusOneDetails } = body;

    // Validate required fields
    if (!codeId || !name || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields (codeId, name, phone)' },
        { status: 400 }
      );
    }

    // Validate name
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return NextResponse.json(
        { error: 'Name must be 2-50 characters' },
        { status: 400 }
      );
    }

    // Validate phone
    if (!isValidIsraeliMobile(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number', errorCode: 'INVALID_PHONE' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const validPlusOne = Math.max(0, Math.min(10, Math.floor(plusOneCount)));

    const db = getAdminDb();

    // Load code and check config
    const codeDoc = await db.collection('codes').doc(codeId).get();
    if (!codeDoc.exists) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    const codeData = codeDoc.data()!;
    const qtagMedia = codeData.media?.find((m: { type: string }) => m.type === 'qtag');
    if (!qtagMedia?.qtagConfig) {
      return NextResponse.json(
        { error: 'Q.Tag not configured for this code' },
        { status: 400 }
      );
    }

    const config = qtagMedia.qtagConfig;

    // Check phase
    if (config.currentPhase !== 'registration') {
      return NextResponse.json(
        { error: 'Registration is not open', errorCode: 'REGISTRATION_CLOSED' },
        { status: 403 }
      );
    }

    // Validate plusOneCount against config
    if (validPlusOne > 0 && !config.allowPlusOne) {
      return NextResponse.json(
        { error: 'Plus-one is not allowed for this event' },
        { status: 400 }
      );
    }

    if (validPlusOne > (config.maxGuestsPerRegistration || 1)) {
      return NextResponse.json(
        { error: `Maximum ${config.maxGuestsPerRegistration} additional guests allowed` },
        { status: 400 }
      );
    }

    // Check phone uniqueness
    const existingGuest = await db.collection('codes').doc(codeId)
      .collection('qtagGuests')
      .where('phone', '==', normalizedPhone)
      .limit(1)
      .get();

    if (!existingGuest.empty) {
      const existingData = existingGuest.docs[0].data();

      // Allow re-registration if the previous registration was not verified
      if (!existingData.isVerified) {
        // Clean up the old unverified registration
        const oldBatch = db.batch();
        oldBatch.delete(existingGuest.docs[0].ref);

        // Clean up old token mapping
        if (existingData.qrToken) {
          oldBatch.delete(db.collection('qrTokenMappings').doc(existingData.qrToken));
        }

        // Decrement stats
        const oldStatsRef = db.collection('codes').doc(codeId)
          .collection('qtagStats').doc('current');
        const oldStatsDoc = await oldStatsRef.get();
        if (oldStatsDoc.exists) {
          oldBatch.update(oldStatsRef, {
            totalRegistered: FieldValue.increment(-1),
            totalGuests: FieldValue.increment(-(1 + (existingData.plusOneCount || 0))),
            lastUpdated: FieldValue.serverTimestamp(),
          });
        }

        await oldBatch.commit();
      } else {
        return NextResponse.json(
          { error: 'Phone number already registered', errorCode: 'PHONE_EXISTS' },
          { status: 409 }
        );
      }
    }

    // Check capacity
    if (config.maxRegistrations && config.maxRegistrations > 0) {
      const statsDoc = await db.collection('codes').doc(codeId)
        .collection('qtagStats').doc('current').get();
      const currentCount = statsDoc.exists ? (statsDoc.data()?.totalRegistered || 0) : 0;
      if (currentCount >= config.maxRegistrations) {
        return NextResponse.json(
          { error: 'Event is full', errorCode: 'CAPACITY_FULL' },
          { status: 409 }
        );
      }
    }

    // Generate QR token
    const qrToken = generateQRToken();
    const guestRef = db.collection('codes').doc(codeId).collection('qtagGuests').doc();

    // Build guest document
    const guestData = {
      id: guestRef.id,
      codeId,
      name: trimmedName,
      phone: normalizedPhone,
      plusOneCount: validPlusOne,
      plusOneDetails: plusOneDetails || [],
      qrToken,
      isVerified: !config.verification?.enabled, // Auto-verified if verification disabled
      status: 'registered',
      qrSentViaWhatsApp: false,
      registeredAt: FieldValue.serverTimestamp(),
      registeredByAdmin: false,
    };

    // Use batch write for atomicity
    const batch = db.batch();

    // Create guest document
    batch.set(guestRef, guestData);

    // Create qrTokenMapping for fast check-in lookup
    const tokenRef = db.collection('qrTokenMappings').doc(qrToken);
    batch.set(tokenRef, {
      codeId,
      guestId: guestRef.id,
      type: 'qtag',
      createdAt: FieldValue.serverTimestamp(),
    });

    // Initialize or increment stats
    const statsRef = db.collection('codes').doc(codeId)
      .collection('qtagStats').doc('current');
    const statsDoc = await statsRef.get();

    if (!statsDoc.exists) {
      batch.set(statsRef, {
        totalRegistered: 1,
        totalGuests: 1 + validPlusOne,
        totalArrived: 0,
        totalArrivedGuests: 0,
        lastUpdated: FieldValue.serverTimestamp(),
      });
    } else {
      batch.update(statsRef, {
        totalRegistered: FieldValue.increment(1),
        totalGuests: FieldValue.increment(1 + validPlusOne),
        lastUpdated: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    // Fire-and-forget: Send QR link via WhatsApp if auto-verified (verification disabled)
    if (guestData.isVerified && config.sendQrViaWhatsApp !== false) {
      sendQTagQRWhatsApp({
        codeId,
        guestId: guestRef.id,
        guestName: trimmedName,
        guestPhone: normalizedPhone,
        qrToken,
        shortId: codeData.shortId,
        eventName: config.eventName || '',
      }).catch(err => console.error('[QTag Register] WhatsApp send error (non-blocking):', err));
    }

    return NextResponse.json({
      success: true,
      guestId: guestRef.id,
      qrToken,
      phone: normalizedPhone,
      isVerified: guestData.isVerified,
    });
  } catch (error) {
    console.error('Q.Tag register error:', error);
    return NextResponse.json(
      { error: 'Failed to register', details: String(error) },
      { status: 500 }
    );
  }
}
