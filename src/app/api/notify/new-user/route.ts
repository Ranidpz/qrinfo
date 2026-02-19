import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { sendEmail, isResendConfigured } from '@/lib/resend';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://qr.playzones.app';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`notify-new-user:${clientIp}`, {
      maxRequests: 5,
      windowMs: 60 * 1000,
    });
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const authResult = await verifyAuthToken(request);
    if ('error' in authResult) return authResult.error;

    if (!isResendConfigured()) {
      console.warn('[Notify] Resend not configured, skipping new user notification');
      return NextResponse.json({ success: false, reason: 'not_configured' });
    }

    const { displayName, email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    const safeName = escapeHtml(displayName || 'N/A');
    const safeEmail = escapeHtml(email);
    const usersPageUrl = `${BASE_URL}/he/admin/users`;

    const result = await sendEmail({
      to: 'info@playzone.co.il',
      subject: `משתמש חדש ב-The Q: ${displayName || email}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">משתמש חדש נרשם ל-The Q</h2>
          <table style="border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 16px 8px 0; font-weight: bold; color: #555;">שם:</td>
              <td style="padding: 8px 0;">${safeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 16px 8px 0; font-weight: bold; color: #555;">אימייל:</td>
              <td style="padding: 8px 0;">${safeEmail}</td>
            </tr>
          </table>
          <p>
            <a href="${usersPageUrl}" style="display: inline-block; padding: 10px 20px; background-color: #7c3aed; color: #fff; text-decoration: none; border-radius: 6px;">
              צפה בניהול משתמשים
            </a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            הודעה אוטומטית מפלטפורמת The Q
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: result.success });
  } catch (error) {
    console.error('[Notify] New user notification error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
