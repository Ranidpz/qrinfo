import { isResendConfigured, sendEmail } from '@/lib/resend';
import type { ContentIntakeCommitResult, ContentIntakePreview } from './types';

const FATTAL_REPORT_EMAIL_TO = process.env.FATTAL_REPORT_EMAIL_TO || 'info@playzone.co.il';

export async function sendFattalCommitReportEmail(params: {
  runId: string;
  computerName?: string;
  status: ContentIntakeRunStatusForReport;
  preview: ContentIntakePreview;
  summary: ReturnType<typeof buildCommitSummary>;
  results: ContentIntakeCommitResult[];
  suggestedReplyAfterCommitHe: string;
  receivedAt?: string;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (!isResendConfigured()) {
    console.warn('[Content Intake Fattal Commit] Resend is not configured; skipping report email');
    return { sent: false, skipped: true };
  }

  const report = buildFattalReportEmail(params);
  const result = await sendEmail({
    to: FATTAL_REPORT_EMAIL_TO,
    subject: report.subject,
    html: report.html,
    text: report.text,
    idempotencyKey: `fattal-report/${params.runId}`,
  });

  if (!result.success) {
    console.error('[Content Intake Fattal Commit] Report email failed:', result.error);
    return { sent: false, error: 'Failed to send report email' };
  }

  return { sent: true };
}

type ContentIntakeRunStatusForReport = 'completed' | 'completed_with_issues';

export function buildFattalReportEmail(params: {
  runId: string;
  computerName?: string;
  status: ContentIntakeRunStatusForReport;
  preview: ContentIntakePreview;
  summary: ReturnType<typeof buildCommitSummary>;
  results: ContentIntakeCommitResult[];
  suggestedReplyAfterCommitHe: string;
  receivedAt?: string;
}) {
  const dateLabel = formatHebrewDate(params.receivedAt || params.preview.generatedAt);
  const computer = params.computerName?.trim() || 'שם המחשב לא תועד';
  const updated = params.results.filter(result => result.status === 'updated');
  const duplicates = params.results.filter(result => result.status === 'skipped_duplicate');
  const skipped = params.results.filter(result => result.status === 'skipped');
  const failed = params.results.filter(result => result.status === 'failed');
  const missing = params.preview.missingTargets.map(item => item.target.title);
  const summary = `עודכנו: ${updated.length} · כבר היו מעודכנים: ${duplicates.length} · לא עודכנו: ${skipped.length + failed.length}`;
  const actions = [
    ...(skipped.length ? ['בקשו בקבוצה קובץ עם שם החוויה או המיקום, והבהרה איזו גרסה נכונה אם נשלחו כמה.'] : []),
    ...(failed.length ? ['לא התקבל אישור לחלק מהעדכונים. פתחו את הסוכן במחשב המצוין ובדקו את ההודעה לפני ניסיון נוסף.'] : []),
    ...(missing.length ? ['בדקו אם נדרשת חוברת חדשה ליעדים שברשימת החוסרים.'] : []),
  ].join(' ') || 'אין צורך בפעולה.';
  const groups: [string, ContentIntakeCommitResult[]][] = [['עודכנו',updated],['כבר היו מעודכנים',duplicates],['לא עודכנו — דרושה הבהרה',skipped],['לא התקבל אישור לעדכון',failed]];
  const subject = `סוכן וואטסאפ | ${computer} | עודכנו ${updated.length} חוברות${skipped.length + failed.length ? ' — נדרשת בדיקה' : ''}`;
  const text = [
    'סיכום עדכון חוברות פתאל דרך וואטסאפ', `מחשב: ${computer}`, `מועד הבדיקה: ${dateLabel} (שעון ישראל)`, '',
    summary, `מה צריך לעשות: ${actions}`,
    ...groups.filter(([,items]) => items.length).map(([title,items]) => '\n'+sectionText(title,items.map(fileDetailsText))),
    ...(missing.length ? ['\nלא התקבל קובץ מתאים בבדיקה הזו: '+missing.join(', '), 'החוברות הקיימות ביעדים האלה לא שונו; הרשימה אינה מעידה שהן אינן מעודכנות.'] : []),
  ].join('\n');
  const html = `<div dir="rtl" lang="he" style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#111827;font-size:16px;line-height:1.55">
    <h2 style="font-size:20px;margin:0 0 12px">סיכום עדכון חוברות פתאל דרך וואטסאפ</h2>
    <p>מחשב: <b>${escapeHtml(computer)}</b><br>מועד הבדיקה: ${escapeHtml(dateLabel)} (שעון ישראל)</p>
    <p><b>${escapeHtml(summary)}</b></p><p>מה צריך לעשות: ${escapeHtml(actions)}</p>
    ${groups.filter(([,items])=>items.length).map(([title,items])=>fileSectionHtml(title,items)).join('')}
    ${missing.length ? sectionHtml('לא התקבל קובץ מתאים בבדיקה הזו',missing)+'<p>החוברות הקיימות ביעדים האלה לא שונו; הרשימה אינה מעידה שהן אינן מעודכנות.</p>' : ''}
    <p style="font-size:12px;color:#6b7280">הודעה אוטומטית ממערכת The Q</p></div>`;
  return {subject,text,html};
}

function fileDetails(result: ContentIntakeCommitResult): [string, string][] {
  const statuses = { updated: 'עודכן בהצלחה', skipped_duplicate: 'כבר עודכן — לא הועלה שוב', skipped: 'לא עודכן — נדרשת בדיקה', failed: 'לא התקבל אישור לעדכון' };
  const rows: [string, string][] = [
    ['שם החוויה במערכת', result.title || 'לא זוהתה חוויה'],
    [result.status === 'updated' || result.status === 'skipped_duplicate' ? 'שם הקובץ שהועלה' : 'שם הקובץ שהתקבל', result.filename],
    ['סטטוס', statuses[result.status]],
  ];
  if (result.status === 'updated' || result.status === 'skipped_duplicate') {
    rows.push([result.status === 'skipped_duplicate' ? 'מועד העדכון המקורי (שעון ישראל)' : 'מועד העדכון (שעון ישראל)', formatHebrewDate(result.updatedAt)]);
  } else if (result.status === 'skipped') {
    const reasons: Record<string,string> = {
      duplicate:'התקבלו כמה גרסאות לאותה חוויה. יש להבהיר איזו גרסה נכונה.',
      unmatched:'לא זוהה יעד לקובץ. יש להוסיף את שם החוויה או המיקום.',
      needs_review:'השיוך או התאריך דורשים הבהרה לפני העדכון.',
      manual_excluded:'הקובץ הוחרג מהעדכון בבדיקה ידנית.',
    };
    rows.push(['מה נדרש',reasons[result.reason || ''] || 'יש לבדוק את שיוך הקובץ ואת הגרסה לפני עדכון.']);
  } else {
    rows.push(['מה נדרש','בדקו בסוכן מה בוצע לפני ניסיון נוסף.']);
  }
  return rows;
}

function safePdfUrl(url?: string): string | null {
  try { const parsed = new URL(url || ''); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : null; }
  catch { return null; }
}
function fileDetailsText(result: ContentIntakeCommitResult): string {
  const rows = fileDetails(result).map(([label, value]) => `${label}: ${value}`);
  const pdf = ['updated','skipped_duplicate'].includes(result.status) ? safePdfUrl(result.url) : null;
  if (pdf) rows.push(`הקובץ שעלה: ${pdf}`);
  if (result.shortId) rows.push(`החוויה: https://qr.playzones.app/v/${encodeURIComponent(result.shortId)}`);
  return rows.join('\n   ');
}
function fileSectionHtml(title: string, results: ContentIntakeCommitResult[]): string {
  if (!results.length) return sectionHtml(title, []);
  return `<h3 style="margin:18px 0 8px;font-size:16px">${escapeHtml(title)}</h3>` + results.map(result => {
    const pdf = ['updated','skipped_duplicate'].includes(result.status) ? safePdfUrl(result.url) : null;
    const links = [
      ...(pdf ? [`<a href="${escapeHtml(pdf)}">פתיחת הקובץ שעלה</a>`] : []),
      ...(result.shortId ? [`<a href="https://qr.playzones.app/v/${encodeURIComponent(result.shortId)}">פתיחת החוויה</a>`] : []),
    ];
    return `<table dir="rtl" style="border-collapse:collapse;width:100%;table-layout:fixed;border:1px solid #e5e7eb;margin-bottom:14px">${fileDetails(result).map(([label, value]) => summaryRow(label, value)).join('')}${links.length ? `<tr><td colspan="2" style="padding:10px 12px">${links.join(' · ')}</td></tr>` : ''}</table>`;
  }).join('');
}

function sectionText(title: string, items: string[]): string {
  if (items.length === 0) return `${title}:\nאין`;
  return `${title}:\n${items.map((item, index) => `${index + 1}. ${item}`).join('\n')}`;
}

function sectionHtml(title: string, items: string[]): string {
  const body = items.length === 0
    ? '<p style="margin: 0 0 14px; color: #6b7280;">אין</p>'
    : `<ol style="margin: 0 0 14px; padding-right: 22px;">${items
      .map((item) => `<li style="margin: 4px 0;">${escapeHtml(item)}</li>`)
      .join('')}</ol>`;

  return `
    <h3 style="margin: 18px 0 8px; font-size: 16px;">${escapeHtml(title)}</h3>
    ${body}
  `;
}

function summaryRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 38%; vertical-align: top;">${escapeHtml(label)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; overflow-wrap: anywhere; word-break: break-word;"><bdi>${escapeHtml(value)}</bdi></td>
    </tr>
  `;
}

function formatHebrewDate(value?: string): string {
  if (!value) return 'לא תועד';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'לא תועד';

  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildCommitSummary(preview: ContentIntakePreview, results: ContentIntakeCommitResult[]) {
  return {
    totalFiles: preview.summary.totalFiles,
    matched: preview.summary.matched,
    updated: results.filter((result) => result.status === 'updated').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    skippedDuplicate: results.filter((result) => result.status === 'skipped_duplicate').length,
    failed: results.filter((result) => result.status === 'failed').length,
    missingTargets: preview.summary.missingTargets,
  };
}

export function buildCommitReply(preview: ContentIntakePreview, results: ContentIntakeCommitResult[]): string {
  const updated = results.filter((result) => result.status === 'updated');
  const duplicates = results.filter((result) => result.status === 'skipped_duplicate');
  const skipped = results.filter((result) => result.status === 'skipped');
  const failed = results.filter((result) => result.status === 'failed');
  const lines = [updated.length > 0
    ? 'תודה, עדכנתי את מה שהתקבל עד עכשיו ✅'
    : failed.length > 0 || skipped.length > 0
      ? 'העדכון דורש בדיקה; לא אושר עדכון חוברות חדשות.'
      : 'החוברות שהתקבלו כבר מעודכנות.'];
  const section = (title: string, items: string[]) => {
    if (items.length) lines.push('', `${title}:`, ...items.map((item, index) => `${index + 1}. ${item}`));
  };
  section('עודכנו', updated.map((item) => item.title || item.filename));
  section('כבר היו מעודכנים', duplicates.map((item) => item.title || item.filename));
  section('דורשים בדיקה', skipped.map((item) => item.filename));
  section('לא התקבל אישור לעדכון', failed.map((item) => item.title || item.filename));
  section('חסרים לי כרגע', preview.missingTargets.map((item) => item.target.title));
  return lines.join('\n');
}

export function hasCommitIssues(
  preview: ContentIntakePreview,
  results: ContentIntakeCommitResult[]
): boolean {
  return preview.summary.missingTargets > 0
    || results.some((result) => result.status === 'failed' || result.status === 'skipped');
}
