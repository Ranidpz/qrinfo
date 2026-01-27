import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

// Generate unique QR token for check-in
function generateQRToken(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}${random}`.toUpperCase();
}

// POST: Register or unregister for a cell
export async function POST(request: NextRequest) {
  try {
    // Check if db is available
    if (!db) {
      console.error('WeeklyCal RSVP: Firestore db not initialized');
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`weeklycal-rsvp:${clientIp}`, RATE_LIMITS.API);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('WeeklyCal RSVP: Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const {
      codeId,
      cellId,
      weekStartDate,  // Weekly mode
      boothDate,      // Booth mode - date string
      boothId,        // Booth mode - booth ID
      visitorId,
      nickname,
      phone,          // Phone number for uniqueness check
      avatarUrl,      // Avatar image URL or emoji
      avatarType = 'none', // 'photo' | 'emoji' | 'none'
      action,
      count = 1,
      capacity,       // Optional capacity for validation
      overbookingPercentage, // Optional overbooking percentage (0-50, default 10)
      maxRegistrationsPerPhone, // Max times same phone can register for this booth per day (default: 1)
    } = body;

    // Either weekStartDate (weekly mode) or boothDate+boothId (booth mode) required
    const isBoothMode = boothDate && boothId;
    const hasDateContext = weekStartDate || isBoothMode;

    if (!codeId || !cellId || !hasDateContext || !visitorId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields', details: { codeId, cellId, weekStartDate, boothDate, boothId, visitorId, action } },
        { status: 400 }
      );
    }

    if (action !== 'register' && action !== 'unregister') {
      return NextResponse.json(
        { error: 'Invalid action. Use "register" or "unregister"' },
        { status: 400 }
      );
    }

    // Document ID: ensures one registration per visitor per cell per context (week or booth day)
    // Weekly mode: visitorId_cellId_weekStartDate
    // Booth mode: visitorId_cellId_boothDate_boothId
    const registrationId = isBoothMode
      ? `${visitorId}_${cellId}_${boothDate}_${boothId}`
      : `${visitorId}_${cellId}_${weekStartDate}`;
    console.log('WeeklyCal RSVP: Creating doc ref for', registrationId, isBoothMode ? '(booth mode)' : '(weekly mode)');

    try {
      const registrationRef = doc(db, 'codes', codeId, 'cellRegistrations', registrationId);

      if (action === 'register') {
        // Get all registrations for this cell to check capacity and phone uniqueness
        const registrationsRef = collection(db, 'codes', codeId, 'cellRegistrations');
        const snapshot = await getDocs(registrationsRef);

        // Filter registrations for this cell and context
        const cellRegistrations = snapshot.docs.filter(docSnap => {
          const data = docSnap.data();
          const matchesCell = data.cellId === cellId;
          const matchesContext = isBoothMode
            ? (data.boothDate === boothDate && data.boothId === boothId)
            : (data.weekStartDate === weekStartDate);
          return matchesCell && matchesContext;
        });

        // Phone uniqueness check - if phone is provided, check it's not already registered
        if (phone && phone.trim()) {
          const normalizedPhone = phone.replace(/\D/g, ''); // Remove non-digits for comparison
          const existingPhoneReg = cellRegistrations.find(docSnap => {
            const data = docSnap.data();
            const regPhone = (data.phone || '').replace(/\D/g, '');
            // Check if same phone (not same visitor updating their own registration)
            return regPhone === normalizedPhone && data.visitorId !== visitorId;
          });

          if (existingPhoneReg) {
            console.log('WeeklyCal RSVP: Phone already registered', phone);
            return NextResponse.json(
              {
                error: 'Phone already registered',
                message: 'מספר הטלפון הזה כבר רשום לפעילות זו',
              },
              { status: 409 }
            );
          }

          // Check max registrations per phone per booth per day (in booth mode)
          if (isBoothMode && maxRegistrationsPerPhone !== undefined && maxRegistrationsPerPhone > 0) {
            const normalizedPhone = phone.replace(/\D/g, '');
            // Count all registrations for this phone in this booth on this day (across all slots)
            const phoneBoothRegs = snapshot.docs.filter(docSnap => {
              const data = docSnap.data();
              const regPhone = (data.phone || '').replace(/\D/g, '');
              return regPhone === normalizedPhone &&
                data.boothId === boothId &&
                data.boothDate === boothDate &&
                data.visitorId !== visitorId; // Don't count own registration
            });

            if (phoneBoothRegs.length >= maxRegistrationsPerPhone) {
              console.log('WeeklyCal RSVP: Max registrations per booth exceeded', { phone, boothId, count: phoneBoothRegs.length, max: maxRegistrationsPerPhone });
              return NextResponse.json(
                {
                  error: 'Max registrations per booth exceeded',
                  message: maxRegistrationsPerPhone === 1
                    ? 'מספר הטלפון הזה כבר רשום לחוויה זו היום'
                    : `מספר הטלפון הזה כבר רשום ${phoneBoothRegs.length} פעמים לחוויה זו היום (מקסימום ${maxRegistrationsPerPhone})`,
                  currentRegistrations: phoneBoothRegs.length,
                  maxAllowed: maxRegistrationsPerPhone,
                },
                { status: 409 }
              );
            }
          }
        }

        // Capacity validation if capacity is provided
        if (capacity !== undefined && capacity > 0) {
          // Apply overbooking percentage (default 10%, max 50%)
          const overbookingPct = Math.max(0, Math.min(50, overbookingPercentage ?? 10));
          const effectiveCapacity = Math.floor(capacity * (1 + overbookingPct / 100));
          console.log('WeeklyCal RSVP: Checking capacity', { capacity, overbookingPct, effectiveCapacity });

          // Calculate current count for this cell (excluding current visitor)
          let currentCount = 0;
          cellRegistrations.forEach(docSnap => {
            const data = docSnap.data();
            if (data.visitorId !== visitorId) {
              currentCount += data.count || 1;
            }
          });

          // Check if new registration would exceed effective capacity (with overbooking)
          const requestedCount = Math.max(1, Math.min(10, count));
          if (currentCount + requestedCount > effectiveCapacity) {
            const availableSlots = Math.max(0, effectiveCapacity - currentCount);
            console.log('WeeklyCal RSVP: Capacity exceeded', { currentCount, requestedCount, capacity, effectiveCapacity, availableSlots });
            return NextResponse.json(
              {
                error: 'Capacity exceeded',
                currentCount,
                capacity,
                effectiveCapacity,
                availableSlots,
                overbookingApplied: overbookingPct > 0,
              },
              { status: 409 }
            );
          }
        }

        // Generate QR token for check-in
        const qrToken = generateQRToken();

        // Register for the cell with count (number of attendees)
        console.log('WeeklyCal RSVP: Registering with count', count, 'qrToken:', qrToken);
        const registrationData: Record<string, unknown> = {
          codeId,
          cellId,
          visitorId,
          nickname: nickname || null,
          phone: phone || null,  // Store phone for uniqueness check
          count: Math.max(1, Math.min(10, count)), // Limit between 1-10
          registeredAt: serverTimestamp(),
          // Avatar/Profile
          avatarUrl: avatarUrl || null,
          avatarType: avatarType || 'none',
          // QR Token for check-in
          qrToken,
          // Verification & Check-in status
          isVerified: false,
          checkedIn: false,
        };

        // Add context fields based on mode
        if (isBoothMode) {
          registrationData.boothDate = boothDate;
          registrationData.boothId = boothId;
        } else {
          registrationData.weekStartDate = weekStartDate;
        }

        await setDoc(registrationRef, registrationData);
        console.log('WeeklyCal RSVP: Registration saved with qrToken:', qrToken);

        // Create qrTokenMappings for fast check-in lookup (using admin SDK)
        try {
          const adminDb = getAdminDb();
          await adminDb.collection('qrTokenMappings').doc(qrToken).set({
            codeId,
            registrationId,
            createdAt: FieldValue.serverTimestamp(),
          });
          console.log('WeeklyCal RSVP: Created qrTokenMapping for', qrToken);
        } catch (mappingError) {
          // Don't fail registration if mapping creation fails
          console.error('WeeklyCal RSVP: Failed to create qrTokenMapping:', mappingError);
        }
      } else {
        // Unregister from the cell
        console.log('WeeklyCal RSVP: Unregistering');
        await deleteDoc(registrationRef);
        console.log('WeeklyCal RSVP: Unregistration complete');
      }
    } catch (writeError) {
      console.error('WeeklyCal RSVP: Firestore write error:', writeError);
      return NextResponse.json(
        { error: 'Failed to write to database', details: String(writeError) },
        { status: 500 }
      );
    }

    // Get updated count for this cell
    let totalAttendees = 0;
    try {
      console.log('WeeklyCal RSVP: Fetching updated counts');
      const registrationsRef = collection(db, 'codes', codeId, 'cellRegistrations');
      const snapshot = await getDocs(registrationsRef);

      // Filter by cellId and context (weekStartDate or boothDate+boothId) and sum counts
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const matchesCell = data.cellId === cellId;
        const matchesContext = isBoothMode
          ? (data.boothDate === boothDate && data.boothId === boothId)
          : (data.weekStartDate === weekStartDate);

        if (matchesCell && matchesContext) {
          totalAttendees += data.count || 1;
        }
      });
      console.log('WeeklyCal RSVP: Total attendees for cell:', totalAttendees);
    } catch (readError) {
      console.error('WeeklyCal RSVP: Firestore read error:', readError);
      // Still return success for the registration, just with count 0
      totalAttendees = action === 'register' ? count : 0;
    }

    // Get the qrToken for the response (need to re-read for register action)
    let responseQrToken: string | undefined;
    let responseRegistrationId: string | undefined;
    if (action === 'register') {
      try {
        const registrationRef = doc(db, 'codes', codeId, 'cellRegistrations', registrationId);
        const regDoc = await getDoc(registrationRef);
        if (regDoc.exists()) {
          responseQrToken = regDoc.data()?.qrToken;
          responseRegistrationId = regDoc.id;
        }
      } catch (e) {
        console.error('WeeklyCal RSVP: Error fetching qrToken:', e);
      }
    }

    return NextResponse.json({
      success: true,
      registrationCount: totalAttendees,
      isRegistered: action === 'register',
      count: action === 'register' ? count : 0,
      qrToken: responseQrToken,
      registrationId: responseRegistrationId,
    });
  } catch (error) {
    console.error('WeeklyCal RSVP error:', error);
    return NextResponse.json(
      { error: 'Failed to process registration', details: String(error) },
      { status: 500 }
    );
  }
}

// GET: Get registrations for a cell or all cells
export async function GET(request: NextRequest) {
  try {
    // Check if db is available
    if (!db) {
      console.error('WeeklyCal GET: Firestore db not initialized');
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('codeId');
    const qrToken = searchParams.get('token');                // Get by QR token
    const weekStartDate = searchParams.get('weekStartDate');  // Weekly mode
    const boothDate = searchParams.get('boothDate');          // Booth mode
    const boothId = searchParams.get('boothId');              // Booth mode
    const visitorId = searchParams.get('visitorId');

    // If token is provided, find registration by qrToken (for landing page / check-in)
    if (qrToken) {
      console.log('WeeklyCal GET: Finding registration by token:', qrToken);

      // Need to search across all codes if codeId not provided
      if (codeId) {
        const registrationsRef = collection(db, 'codes', codeId, 'cellRegistrations');
        const snapshot = await getDocs(registrationsRef);

        const registration = snapshot.docs.find(docSnap =>
          docSnap.data().qrToken === qrToken
        );

        if (!registration) {
          return NextResponse.json(
            { error: 'Registration not found' },
            { status: 404 }
          );
        }

        const data = registration.data();
        return NextResponse.json({
          registration: {
            id: registration.id,
            codeId: data.codeId,
            cellId: data.cellId,
            visitorId: data.visitorId,
            nickname: data.nickname,
            phone: data.phone,
            count: data.count || 1,
            avatarUrl: data.avatarUrl,
            avatarType: data.avatarType || 'none',
            qrToken: data.qrToken,
            isVerified: data.isVerified || false,
            checkedIn: data.checkedIn || false,
            checkedInAt: data.checkedInAt instanceof Timestamp
              ? data.checkedInAt.toDate().toISOString()
              : data.checkedInAt,
            boothDate: data.boothDate,
            boothId: data.boothId,
            weekStartDate: data.weekStartDate,
            registeredAt: data.registeredAt instanceof Timestamp
              ? data.registeredAt.toDate().toISOString()
              : data.registeredAt,
          },
        });
      } else {
        return NextResponse.json(
          { error: 'codeId is required when using token' },
          { status: 400 }
        );
      }
    }

    const isBoothMode = boothDate && boothId;

    if (!codeId) {
      return NextResponse.json(
        { error: 'codeId is required' },
        { status: 400 }
      );
    }

    // Get all registrations for the code (simple query, filter in code)
    console.log('WeeklyCal GET: Fetching registrations for code:', codeId);
    const registrationsRef = collection(db, 'codes', codeId, 'cellRegistrations');
    const snapshot = await getDocs(registrationsRef);
    console.log('WeeklyCal GET: Found', snapshot.docs.length, 'registrations');

    // Filter and map registrations
    const registrations = snapshot.docs
      .map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          cellId: data.cellId,
          visitorId: data.visitorId,
          nickname: data.nickname,
          phone: data.phone,
          avatarUrl: data.avatarUrl,
          avatarType: data.avatarType || 'none',
          qrToken: data.qrToken,
          isVerified: data.isVerified || false,
          checkedIn: data.checkedIn || false,
          checkedInAt: data.checkedInAt instanceof Timestamp
            ? data.checkedInAt.toDate().toISOString()
            : data.checkedInAt,
          weekStartDate: data.weekStartDate,
          boothDate: data.boothDate,
          boothId: data.boothId,
          count: data.count || 1,
          registeredAt: data.registeredAt instanceof Timestamp
            ? data.registeredAt.toDate().toISOString()
            : data.registeredAt,
        };
      })
      .filter(reg => {
        // Filter by context
        if (isBoothMode) {
          // Full booth mode: filter by both date and booth
          return reg.boothDate === boothDate && reg.boothId === boothId;
        } else if (boothDate) {
          // Just booth date (for editor): filter by date only, all booths
          return reg.boothDate === boothDate;
        } else if (weekStartDate) {
          return reg.weekStartDate === weekStartDate;
        }
        return true; // No filter - return all
      });

    // Group by cellId for counts
    const countsByCell: Record<string, number> = {}; // Sum of all attendees
    const confirmationsByCell: Record<string, number> = {}; // Number of registrations (people who confirmed)
    registrations.forEach(reg => {
      countsByCell[reg.cellId] = (countsByCell[reg.cellId] || 0) + reg.count;
      confirmationsByCell[reg.cellId] = (confirmationsByCell[reg.cellId] || 0) + 1;
    });

    // Check if current visitor is registered (if visitorId provided)
    const userRegistrations: string[] = [];
    const userCounts: Record<string, number> = {};
    if (visitorId) {
      registrations
        .filter(reg => reg.visitorId === visitorId)
        .forEach(reg => {
          userRegistrations.push(reg.cellId);
          userCounts[reg.cellId] = reg.count;
        });
    }

    return NextResponse.json({
      registrations,
      countsByCell,
      confirmationsByCell,
      userRegistrations,
      userCounts,
      total: registrations.reduce((sum, reg) => sum + reg.count, 0),
    });
  } catch (error) {
    console.error('WeeklyCal get registrations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registrations', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH: Update registration (admin only - name, count)
export async function PATCH(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { codeId, registrationId, nickname, count } = body;

    if (!codeId || !registrationId) {
      return NextResponse.json(
        { error: 'Missing codeId or registrationId' },
        { status: 400 }
      );
    }

    const registrationRef = doc(db, 'codes', codeId, 'cellRegistrations', registrationId);
    const regDoc = await getDoc(registrationRef);

    if (!regDoc.exists()) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (nickname !== undefined) updates.nickname = nickname;
    if (count !== undefined) updates.count = Math.max(1, Math.min(10, count));

    await setDoc(registrationRef, updates, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WeeklyCal PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update registration', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE: Remove registration (admin only)
export async function DELETE(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Accept both URL params and body
    const { searchParams } = new URL(request.url);
    let codeId = searchParams.get('codeId');
    let registrationId = searchParams.get('registrationId');

    // If not in URL, try body
    if (!codeId || !registrationId) {
      try {
        const body = await request.json();
        codeId = body.codeId || codeId;
        registrationId = body.registrationId || registrationId;
      } catch {
        // Body parsing failed, continue with URL params
      }
    }

    if (!codeId || !registrationId) {
      return NextResponse.json(
        { error: 'Missing codeId or registrationId' },
        { status: 400 }
      );
    }

    const registrationRef = doc(db, 'codes', codeId, 'cellRegistrations', registrationId);
    const regDoc = await getDoc(registrationRef);

    if (!regDoc.exists()) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Also delete the token mapping if it exists
    const regData = regDoc.data();
    if (regData?.qrToken) {
      try {
        // Use admin API for token mapping deletion
        // For now, just log - token mappings are cleaned up lazily
        console.log('WeeklyCal DELETE: Registration had qrToken:', regData.qrToken);
      } catch (e) {
        console.error('WeeklyCal DELETE: Error cleaning token mapping:', e);
      }
    }

    await deleteDoc(registrationRef);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WeeklyCal DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete registration', details: String(error) },
      { status: 500 }
    );
  }
}
