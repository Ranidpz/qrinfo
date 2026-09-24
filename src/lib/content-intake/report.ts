import { isResendConfigured, sendEmail } from '@/lib/resend';
import type { ContentIntakeCommitResult, ContentIntakePreview } from './types';

const FATTAL_REPORT_EMAIL_TO = process.env.FATTAL_REPORT_EMAIL_TO || 'info@playzone.co.il';

export async function sendFattalCommitReportEmail(params: {
  runId: string;
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
  status: ContentIntakeRunStatusForReport;
  preview: ContentIntakePreview;
  summary: ReturnType<typeof buildCommitSummary>;
  results: ContentIntakeCommitResult[];
  suggestedReplyAfterCommitHe: string;
  receivedAt?: string;
}) {
  const dateLabel = formatHebrewDate(params.preview.generatedAt);
  const reportSlotLabel = getFattalReportSlotLabel(params.receivedAt || params.preview.generatedAt);
  const statusLabel = params.status === 'completed' ? 'הושלם' : 'הושלם עם חוסרים / בדיקה';
  const updated = params.results.filter((result) => result.status === 'updated');
  const skippedDuplicates = params.results.filter((result) => result.status === 'skipped_duplicate');
  const skipped = params.results.filter((result) => result.status === 'skipped');
  const failed = params.results.filter((result) => result.status === 'failed');
  const missing = params.preview.missingTargets.map((item) => item.target.title);

  const text = [
    `דוח עדכון חוברות פתאל - ${dateLabel}`,
    '',
    'הבוט של פלייזון סיים עדכון חוברות פתאל.',
    `מועד הבדיקה: ${dateLabel} (שעון ישראל)`,
    `פעימת דיווח: ${reportSlotLabel}`,
    `סטטוס: ${statusLabel}`,
    `מזהה ריצה: ${params.runId}`,
    '',
    `סה"כ קבצים: ${params.summary.totalFiles}`,
    `הותאמו: ${params.summary.matched}`,
    `עודכנו בפועל: ${params.summary.updated}`,
    `כבר היו מעודכנים: ${params.summary.skippedDuplicate}`,
    `דורשים בדיקה ידנית: ${params.summary.skipped}`,
    `נכשלו: ${params.summary.failed}`,
    `חסרים: ${params.summary.missingTargets}`,
    '',
    sectionText('עודכנו', updated.map(fileDetailsText)),
    '',
    sectionText('כבר היו מעודכנים', skippedDuplicates.map(fileDetailsText)),
    '',
    sectionText('חסרים', missing),
    '',
    sectionText(
      'דורשים בדיקה ידנית',
      skipped.map(fileDetailsText)
    ),
    '',
    sectionText(
      'שגיאות',
      failed.map(fileDetailsText)
    ),
    '',
    'הודעה מוצעת לוואטסאפ:',
    params.suggestedReplyAfterCommitHe,
  ].join('\n');

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #111827; line-height: 1.55;">
      <h2 style="margin: 0 0 12px; color: #111827;">דוח עדכון חוברות פתאל</h2>
      <p style="margin: 0 0 16px;">הבוט של פלייזון סיים עדכון חוברות פתאל.</p>

      <table style="border-collapse: collapse; width: 100%; margin: 0 0 20px; background: #f9fafb; border: 1px solid #e5e7eb;">
        ${summaryRow('מועד הבדיקה (שעון ישראל)', dateLabel)}
        ${summaryRow('פעימת דיווח', reportSlotLabel)}
        ${summaryRow('סטטוס', statusLabel)}
        ${summaryRow('מזהה ריצה', params.runId)}
        ${summaryRow('סה"כ קבצים', String(params.summary.totalFiles))}
        ${summaryRow('הותאמו', String(params.summary.matched))}
        ${summaryRow('עודכנו בפועל', String(params.summary.updated))}
        ${summaryRow('כבר היו מעודכנים', String(params.summary.skippedDuplicate))}
        ${summaryRow('דורשים בדיקה ידנית', String(params.summary.skipped))}
        ${summaryRow('נכשלו', String(params.summary.failed))}
        ${summaryRow('חסרים', String(params.summary.missingTargets))}
      </table>

      ${fileSectionHtml('עודכנו', updated)}
      ${fileSectionHtml('כבר היו מעודכנים', skippedDuplicates)}
      ${sectionHtml('חסרים', missing)}
      ${fileSectionHtml('דורשים בדיקה ידנית', skipped)}
      ${fileSectionHtml('שגיאות', failed)}

      <h3 style="margin: 20px 0 8px; font-size: 16px;">הודעה מוצעת לוואטסאפ</h3>
      <pre style="white-space: pre-wrap; direction: rtl; text-align: right; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; font-family: Arial, sans-serif;">${escapeHtml(params.suggestedReplyAfterCommitHe)}</pre>

      <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
        הודעה אוטומטית ממערכת The Q
      </p>
    </div>
  `;

  return {
    subject: `דוח עדכון חוברות פתאל - ${dateLabel}`,
    html,
    text,
  };
}

function fileDetails(result: ContentIntakeCommitResult): [string, string][] {
  const statuses = { updated: 'עודכן בהצלחה', skipped_duplicate: 'כבר עודכן — לא הועלה שוב', skipped: 'לא עודכן — נדרשת בדיקה', failed: 'לא התקבל אישור לעדכון' };
  const rows: [string, string][] = [
    ['שם החוויה במערכת', result.title || 'לא זוהתה חוויה'],
    [result.status === 'updated' || result.status === 'skipped_duplicate' ? 'שם הקובץ שהועלה' : 'שם הקובץ שהתקבל', result.filename],
    ['סטטוס', statuses[result.status]],
  ];
  if (result.shortId || result.codeId) rows.push(['מזהה חוויה', result.shortId || result.codeId!]);
  if (result.status === 'updated' || result.status === 'skipped_duplicate') {
    rows.push([result.status === 'skipped_duplicate' ? 'מועד העדכון המקורי (שעון ישראל)' : 'מועד העדכון (שעון ישראל)', formatHebrewDate(result.updatedAt)]);
  }
  if (result.assignmentReason) rows.push(['מקור השיוך', result.assignmentReason]);
  if (result.sourceMessageId) rows.push(['מזהה הודעת המקור', result.sourceMessageId]);
  if (result.reason) rows.push(['פירוט', result.reason]);
  if (result.error) rows.push(['שגיאה', result.error]);
  if (result.warning) rows.push(['הערה', result.warning]);
  return rows;
}

function safePdfUrl(url?: string): string | null {
  try { const parsed = new URL(url || ''); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : null; }
  catch { return null; }
}
function fileDetailsText(result: ContentIntakeCommitResult): string {
  const rows = fileDetails(result).map(([label, value]) => `${label}: ${value}`);
  const pdf = safePdfUrl(result.url);
  if (pdf) rows.push(`הקובץ שעלה: ${pdf}`);
  if (result.shortId) rows.push(`החוויה: https://qr.playzones.app/v/${encodeURIComponent(result.shortId)}`);
  return rows.join('\n   ');
}
function fileSectionHtml(title: string, results: ContentIntakeCommitResult[]): string {
  if (!results.length) return sectionHtml(title, []);
  return `<h3 style="margin:18px 0 8px;font-size:16px">${escapeHtml(title)}</h3>` + results.map(result => {
    const pdf = safePdfUrl(result.url);
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

function getFattalReportSlotLabel(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'ריצה ידנית';

  const hourInIsrael = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    hour12: false,
  }).format(date));

  if (hourInIsrael < 12) return 'חלון בוקר — בדיקה מתוזמנת ב־10:05';
  if (hourInIsrael < 14) return 'חלון בדיקת המשך — 12:00';
  if (hourInIsrael < 15) return 'חלון בדיקת המשך — 14:00';
  return 'ריצה ידנית / השלמה מאוחרת';
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
