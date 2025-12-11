import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

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

    const { codeId, cellId, weekStartDate, visitorId, nickname, action, count = 1 } = body;

    if (!codeId || !cellId || !weekStartDate || !visitorId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields', details: { codeId, cellId, weekStartDate, visitorId, action } },
        { status: 400 }
      );
    }

    if (action !== 'register' && action !== 'unregister') {
      return NextResponse.json(
        { error: 'Invalid action. Use "register" or "unregister"' },
        { status: 400 }
      );
    }

    // Document ID: visitorId_cellId_weekStartDate (ensures one registration per visitor per cell per week)
    const registrationId = `${visitorId}_${cellId}_${weekStartDate}`;
    console.log('WeeklyCal RSVP: Creating doc ref for', registrationId);

    try {
      const registrationRef = doc(db, 'codes', codeId, 'cellRegistrations', registrationId);

      if (action === 'register') {
        // Register for the cell with count (number of attendees)
        console.log('WeeklyCal RSVP: Registering with count', count);
        await setDoc(registrationRef, {
          codeId,
          cellId,
          weekStartDate,
          visitorId,
          nickname: nickname || null,
          count: Math.max(1, Math.min(10, count)), // Limit between 1-10
          registeredAt: serverTimestamp(),
        });
        console.log('WeeklyCal RSVP: Registration saved');
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

      // Filter by cellId and weekStartDate in code and sum counts
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.cellId === cellId && data.weekStartDate === weekStartDate) {
          totalAttendees += data.count || 1;
        }
      });
      console.log('WeeklyCal RSVP: Total attendees for cell:', totalAttendees);
    } catch (readError) {
      console.error('WeeklyCal RSVP: Firestore read error:', readError);
      // Still return success for the registration, just with count 0
      totalAttendees = action === 'register' ? count : 0;
    }

    return NextResponse.json({
      success: true,
      registrationCount: totalAttendees,
      isRegistered: action === 'register',
      count: action === 'register' ? count : 0,
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
    const weekStartDate = searchParams.get('weekStartDate');
    const visitorId = searchParams.get('visitorId');

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
          weekStartDate: data.weekStartDate,
          count: data.count || 1,
          registeredAt: data.registeredAt instanceof Timestamp
            ? data.registeredAt.toDate().toISOString()
            : data.registeredAt,
        };
      })
      .filter(reg => !weekStartDate || reg.weekStartDate === weekStartDate);

    // Group by cellId for counts
    const countsByCell: Record<string, number> = {}; // Sum of all attendees
    const confirmationsByCell: Record<string, number> = {}; // Number of registrations (people who confirmed)
    registrations.forEach(reg => {
      countsByCell[reg.cellId] = (countsByCell[reg.cellId] || 0) + reg.count;
      confirmationsByCell[reg.cellId] = (confirmationsByCell[reg.cellId] || 0) + 1;
    });

    // Check if current visitor is registered (if visitorId provided)
    let userRegistrations: string[] = [];
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
