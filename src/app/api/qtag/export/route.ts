import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { formatPhoneForDisplay } from '@/lib/phone-utils';
import { requireCodeOwner, isAuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('codeId');

    if (!codeId) {
      return NextResponse.json({ error: 'codeId is required' }, { status: 400 });
    }

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const db = getAdminDb();

    // Get code info for filename
    const codeDoc = await db.collection('codes').doc(codeId).get();
    const eventName = codeDoc.exists
      ? (codeDoc.data()?.media?.find((m: { type: string }) => m.type === 'qtag')?.qtagConfig?.eventName || 'QTag')
      : 'QTag';

    // Fetch all guests
    const guestsSnap = await db.collection('codes').doc(codeId)
      .collection('qtagGuests')
      .orderBy('registeredAt', 'desc')
      .get();

    const data = guestsSnap.docs.map(doc => {
      const d = doc.data();
      const registeredAt = d.registeredAt instanceof Timestamp
        ? d.registeredAt.toDate()
        : d.registeredAt ? new Date(d.registeredAt) : null;
      const arrivedAt = d.arrivedAt instanceof Timestamp
        ? d.arrivedAt.toDate()
        : d.arrivedAt ? new Date(d.arrivedAt) : null;

      return {
        'Name': d.name,
        'Phone': formatPhoneForDisplay(d.phone || ''),
        '+1 Count': d.plusOneCount || 0,
        '+1 Name': d.plusOneDetails?.[0]?.name || '',
        '+1 Gender': d.plusOneDetails?.[0]?.gender === 'male' ? 'Male' : d.plusOneDetails?.[0]?.gender === 'female' ? 'Female' : '',
        'Status': d.status === 'arrived' ? 'Arrived' : d.status === 'cancelled' ? 'Cancelled' : 'Registered',
        'Registered At': registeredAt ? registeredAt.toLocaleString('he-IL') : '',
        'Arrived At': arrivedAt ? arrivedAt.toLocaleString('he-IL') : '',
        'Verified': d.isVerified ? 'Yes' : 'No',
      };
    });

    // Dynamic import to avoid Vercel serverless bundling issues
    const XLSX = await import('xlsx');

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Guests');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // Name
      { wch: 15 }, // Phone
      { wch: 10 }, // +1 Count
      { wch: 20 }, // +1 Name
      { wch: 10 }, // +1 Gender
      { wch: 12 }, // Status
      { wch: 20 }, // Registered At
      { wch: 20 }, // Arrived At
      { wch: 8 },  // Verified
    ];

    // Use base64 → Buffer for maximum Vercel serverless compatibility
    const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const buffer = Buffer.from(base64, 'base64');

    const sanitizedName = eventName.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '-');
    const dateStr = new Date().toISOString().split('T')[0];

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="qtag-${sanitizedName}-${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[QTag Export] Error:', error instanceof Error ? error.message : error);
    console.error('[QTag Export] Stack:', error instanceof Error ? error.stack : 'no stack');
    return NextResponse.json(
      { error: 'Failed to export' },
      { status: 500 }
    );
  }
}
