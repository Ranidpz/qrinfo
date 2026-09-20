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

function buildFattalReportEmail(params: {
  runId: string;
  status: ContentIntakeRunStatusForReport;
  preview: ContentIntakePreview;
  summary: ReturnType<typeof buildCommitSummary>;
  results: ContentIntakeCommitResult[];
  suggestedReplyAfterCommitHe: string;
  receivedAt?: string;
}) {
  const dateLabel = formatHebrewDate(params.receivedAt || params.preview.generatedAt);
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
    sectionText('עודכנו', updated.map((result) => result.title || result.filename)),
    '',
    sectionText('כבר היו מעודכנים', skippedDuplicates.map((result) => result.title || result.filename)),
    '',
    sectionText('חסרים', missing),
    '',
    sectionText(
      'דורשים בדיקה ידנית',
      skipped.map((result) => `${result.filename}${result.reason ? ` - ${result.reason}` : ''}`)
    ),
    '',
    sectionText(
      'שגיאות',
      failed.map((result) => `${result.filename}${result.error ? ` - ${result.error}` : ''}`)
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
        ${summaryRow('תאריך', dateLabel)}
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

      ${sectionHtml('עודכנו', updated.map((result) => result.title || result.filename))}
      ${sectionHtml('כבר היו מעודכנים', skippedDuplicates.map((result) => result.title || result.filename))}
      ${sectionHtml('חסרים', missing)}
      ${sectionHtml(
        'דורשים בדיקה ידנית',
        skipped.map((result) => `${result.filename}${result.reason ? ` - ${result.reason}` : ''}`)
      )}
      ${sectionHtml(
        'שגיאות',
        failed.map((result) => `${result.filename}${result.error ? ` - ${result.error}` : ''}`)
      )}

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
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 190px;">${escapeHtml(label)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(value)}</td>
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

  if (hourInIsrael < 12) return 'פעימה 1 - 10:00';
  if (hourInIsrael < 15) return 'פעימה 2 - 12:00/14:00';
  return 'ריצה ידנית / השלמה מאוחרת';
}

function formatHebrewDate(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString('he-IL');

  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
