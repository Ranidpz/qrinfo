// Transactional emails for passwordless login + the approval gate.
// Plain inline-styled HTML (email clients ignore <style>), RTL for Hebrew,
// always paired with a plain-text version.

const BRAND = '#2563eb';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://qr.playzones.app';
const LOGO_URL = `${APP_URL}/theQ.png`;
export const ADMIN_NOTIFY_EMAIL = 'info@playzone.co.il';
export const SUPPORT_WHATSAPP = '972773006306';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type Locale = 'he' | 'en';

function layout(locale: Locale, inner: string): string {
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const align = locale === 'he' ? 'right' : 'left';
  const footer = locale === 'he'
    ? 'The Q מבית Playzone · הודעה אוטומטית, אין צורך להשיב'
    : 'The Q by Playzone · automated message, no need to reply';
  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#111827;" dir="${dir}">
        <tr><td align="center" style="padding:32px 24px 8px;">
          <img src="${LOGO_URL}" width="64" height="64" alt="The Q" style="display:block;border:0;border-radius:14px;" />
        </td></tr>
        <tr><td style="padding:8px 32px 32px;text-align:${align};font-size:16px;line-height:1.6;">
          ${inner}
        </td></tr>
      </table>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;margin:16px 0 0;">${footer}</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:24px auto 8px;">
    <tr><td style="border-radius:10px;background:${BRAND};">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;border-radius:10px;">${label}</a>
    </td></tr>
  </table>`;
}

// --- 1. Login code (+ optional one-click Firebase link) ---

export function loginCodeEmail(params: { code: string; link: string | null; locale: Locale }) {
  const { code, link, locale } = params;
  const he = locale === 'he';
  const spaced = code.split('').join(' ');

  const subject = he ? `${code} — קוד הכניסה שלכם ל-The Q` : `${code} is your The Q sign-in code`;
  const html = layout(locale, `
    <h1 style="font-size:22px;margin:0 0 8px;text-align:center;">${he ? 'קוד הכניסה שלכם' : 'Your sign-in code'}</h1>
    <p style="margin:0 0 20px;color:#4b5563;text-align:center;">${he ? 'הדביקו אותו בחלון הכניסה:' : 'Paste it into the sign-in window:'}</p>
    <div dir="ltr" style="text-align:center;font-family:'Courier New',monospace;font-size:34px;font-weight:bold;letter-spacing:6px;background:#eff6ff;color:${BRAND};border-radius:12px;padding:16px 8px;">${spaced}</div>
    <p style="margin:12px 0 0;color:#6b7280;font-size:14px;text-align:center;">${he ? 'הקוד תקף ל-10 דקות.' : 'The code is valid for 10 minutes.'}</p>
    ${link ? `
      <p style="margin:28px 0 0;color:#4b5563;text-align:center;">${he ? 'או היכנסו בלחיצה אחת:' : 'Or sign in with one click:'}</p>
      ${button(link, he ? 'כניסה ל-The Q' : 'Sign in to The Q')}` : ''}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
    <p style="margin:0;color:#9ca3af;font-size:13px;">${he
      ? 'לא ביקשתם קוד? אפשר פשוט להתעלם מהמייל הזה — בלי הקוד אף אחד לא יכול להיכנס לחשבון שלכם.'
      : "Didn't ask for a code? Just ignore this email — nobody can sign in without it."}</p>
  `);
  const text = he
    ? `קוד הכניסה שלכם ל-The Q: ${code}\nהקוד תקף ל-10 דקות.${link ? `\n\nאו היכנסו בלחיצה: ${link}` : ''}\n\nלא ביקשתם? התעלמו מהמייל.`
    : `Your The Q sign-in code: ${code}\nValid for 10 minutes.${link ? `\n\nOr sign in with one click: ${link}` : ''}\n\nDidn't ask? Ignore this email.`;
  return { subject, html, text };
}

// --- 2. New approval request → admin ---

export function approvalRequestAdminEmail(params: {
  displayName: string;
  businessName?: string;
  email?: string;
  phone?: string;
  method: string;
}) {
  const { displayName, businessName, email, phone, method } = params;
  const methodLabel: Record<string, string> = { google: 'גוגל', email: 'מייל (קוד)', phone: 'וואטסאפ (קוד)' };
  const rows: Array<[string, string]> = [
    ['שם', displayName],
    ...(businessName ? [['עסק', businessName] as [string, string]] : []),
    ...(email ? [['מייל', email] as [string, string]] : []),
    ...(phone ? [['טלפון', phone] as [string, string]] : []),
    ['דרך ההצטרפות', methodLabel[method] || method],
  ];
  const usersUrl = `${APP_URL}/he/admin/users`;
  const waLink = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null;

  const html = layout('he', `
    <h1 style="font-size:20px;margin:0 0 16px;">בקשת הצטרפות חדשה ל-The Q</h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${rows.map(([k, v]) => `<tr>
        <td style="padding:8px 0;color:#6b7280;width:110px;vertical-align:top;">${k}</td>
        <td style="padding:8px 0;font-weight:bold;">${escapeHtml(v)}</td>
      </tr>`).join('')}
    </table>
    ${button(usersUrl, 'לאישור בניהול המשתמשים')}
    ${waLink ? `<p style="text-align:center;margin:8px 0 0;"><a href="${waLink}" style="color:${BRAND};">שליחת הודעת וואטסאפ למבקש</a></p>` : ''}
  `);
  const text = `בקשת הצטרפות חדשה ל-The Q\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nלאישור: ${usersUrl}`;
  return { subject: `בקשת הצטרפות ל-The Q: ${displayName}`, html, text };
}

// --- 3. Approved → user ---

export function accountApprovedEmail(params: { displayName: string; locale: Locale }) {
  const { displayName, locale } = params;
  const he = locale === 'he';
  const dashboardUrl = `${APP_URL}/${locale}/dashboard`;
  const name = escapeHtml(displayName || '');

  const html = layout(locale, `
    <h1 style="font-size:22px;margin:0 0 12px;text-align:center;">${he ? `${name ? `${name}, ` : ''}החשבון שלכם אושר!` : `${name ? `${name}, ` : ''}your account is approved!`}</h1>
    <p style="margin:0;color:#4b5563;text-align:center;">${he
      ? 'ברוכים הבאים ל-The Q. מעכשיו אפשר ליצור קודים וחוויות.'
      : 'Welcome to The Q. You can start creating codes and experiences now.'}</p>
    ${button(dashboardUrl, he ? 'כניסה לדשבורד' : 'Open the dashboard')}
    <p style="margin:16px 0 0;color:#6b7280;font-size:14px;text-align:center;">${he
      ? 'שאלות? אנחנו זמינים בוואטסאפ:'
      : 'Questions? We are on WhatsApp:'} <a href="https://wa.me/${SUPPORT_WHATSAPP}" style="color:${BRAND};">wa.me/${SUPPORT_WHATSAPP}</a></p>
  `);
  const text = he
    ? `החשבון שלכם ב-The Q אושר!\nכניסה לדשבורד: ${dashboardUrl}`
    : `Your The Q account is approved!\nOpen the dashboard: ${dashboardUrl}`;
  return { subject: he ? 'החשבון שלכם ב-The Q אושר' : 'Your The Q account is approved', html, text };
}
