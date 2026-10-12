import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { maskPhoneNumber } from '@/lib/phone-utils';
import { authorizeScanner } from '@/lib/qtag/scannerAuth.server';

// The scanner polls this every few seconds; several door phones may share one venue IP.
const SCANNER_LIST_LIMIT = { maxRequests: 120, windowMs: 60 * 1000 };

function toMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

/**
 * Guest list for the Q.Tag door scanner (replaces the public client read of qtagGuests).
 * Owner → full phones; PIN holder / open scanner → masked phones. QR tokens are never returned —
 * the scanner checks guests in by id through /api/qtag/scanner-action.
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`scanner-guests:${clientIp}`, SCANNER_LIST_LIMIT);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { codeId, scannerPin } = await request.json();
    if (typeof codeId !== 'string' || !codeId) {
      return NextResponse.json({ error: 'codeId is required' }, { status: 400 });
    }

    const access = await authorizeScanner(request, codeId, scannerPin, clientIp);
    if (!access.ok) {
      return NextResponse.json({ error: access.error, code: access.code }, { status: access.status });
    }

    const snapshot = await getAdminDb().collection('codes').doc(codeId).collection('qtagGuests').get();
    const isOwner = access.access === 'owner';

    const guests = snapshot.docs.map((d) => {
      const g = d.data();
      const phone = typeof g.phone === 'string' ? g.phone : '';
      return {
        id: d.id,
        codeId,
        name: g.name || '',
        phone: isOwner ? phone : (phone ? maskPhoneNumber(phone) : ''),
        plusOneCount: g.plusOneCount || 0,
        plusOneDetails: g.plusOneDetails || [],
        isVerified: !!g.isVerified,
        status: g.status || 'registered',
        arrivedAt: toMillis(g.arrivedAt),
        arrivedMarkedBy: g.arrivedMarkedBy || null,
        qrSentViaWhatsApp: !!g.qrSentViaWhatsApp,
        registeredAt: toMillis(g.registeredAt),
        registeredByAdmin: !!g.registeredByAdmin,
      };
    });

    return NextResponse.json({ access: access.access, shortId: access.shortId || null, guests });
  } catch (error) {
    console.error('[QTag scanner-guests] Error:', error);
    return NextResponse.json({ error: 'Failed to load guests' }, { status: 500 });
  }
}
