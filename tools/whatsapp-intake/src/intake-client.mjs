import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function intakeHealth({ baseUrl, apiKey, workflowPath = '/api/content-intake/fattal' }) {
  const response = await fetch(`${baseUrl}${workflowPath}/health`, {
    headers: { 'x-content-intake-key': apiKey }, signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  return parseJsonResponse(response);
}

export async function previewBatch({ baseUrl, apiKey, ownerEmail, receivedAt, files, saveRun = false, workflowPath = "/api/content-intake/fattal", source = "manual" }) {
  const response = await fetch(`${baseUrl}${workflowPath}/preview`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-content-intake-key': apiKey,
    },
    signal: AbortSignal.timeout(90000), redirect: 'error',
    body: JSON.stringify({
      ownerEmail,
      receivedAt,
      saveRun,
      source,
      files: files.map((file) => ({
        id: localFileId(file),
        name: file.name,
        size: file.size,
        contentType: 'application/pdf',
        receivedAt: file.receivedAt || receivedAt,
        sourceMessageId: file.messageId,
        source,
      })),
    }),
  });

  const preview = await parseJsonResponse(response);
  if (preview.batchProtocolVersion !== 1) throw new Error('יש לפרוס את ה-API המעודכן לפני שימוש בסקריפט החדש');
  return preview;
}

export async function commitWithPayloadFallback(params) {
  const preview = await previewBatch({ ...params, saveRun: true });
  if (!preview.runId || !Array.isArray(preview.matches)) throw new Error('API did not return a saved batch preview');
  console.log(`מזהה חבילה למעקב: ${preview.runId}`);
  await params.onBatchStarted?.(preview.runId);
  const batchParams = { ...params, batchPreviewRunId: preview.runId };
  try {
    await commitBatch(batchParams);
  } catch (error) {
    if (!isPayloadTooLargeError(error)) throw error;
    console.warn('הבקשה גדולה מדי; מעדכן לפי המיפוי המלא ושולח דוח מאוחד בסיום.');
    for (const file of params.files) {
      const match = preview.matches.find((item) => item.file.id === localFileId(file));
      if (match?.status !== 'matched') continue;
      try {
        await commitBatch({ ...batchParams, files: [file] });
      } catch (itemError) {
        // A timeout may still be executing on the server. Do not retry a write.
        console.error(`לא התקבל אישור עבור ${file.name}: ${itemError.message}`);
        if (!itemError.status) throw itemError;
      }
    }
  }
  return finalizeBatch({ ...params, batchPreviewRunId: preview.runId });
}

export async function finalizeBatch({ baseUrl, apiKey, ownerEmail, batchPreviewRunId, workflowPath = '/api/content-intake/fattal' }) {
  const response = await fetch(`${baseUrl}${workflowPath}/report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-content-intake-key': apiKey },
    body: JSON.stringify({ ownerEmail, batchPreviewRunId }),
    signal: AbortSignal.timeout(90000), redirect: 'error',
  });
  const report = await parseJsonResponse(response);
  if (!Array.isArray(report.results) || !report.summary) throw new Error('API returned an invalid report');
  return report;
}

async function commitBatch({ baseUrl, apiKey, ownerEmail, receivedAt, files, batchPreviewRunId, workflowPath = "/api/content-intake/fattal", source = "manual" }) {
  const formData = new FormData();
  formData.set('ownerEmail', ownerEmail);
  formData.set('receivedAt', receivedAt);
  formData.set('source', source);
  formData.set('batchPreviewRunId', batchPreviewRunId);
  for (const [index, file] of files.entries()) {
    const buffer = await readFile(file.path);
    if (buffer.length !== file.size || createHash('sha256').update(buffer).digest('hex') !== file.sha256) {
      throw new Error(`הקובץ השתנה אחרי הבדיקה: ${file.name}`);
    }
    formData.append('files', new Blob([buffer], { type: 'application/pdf' }), file.name);
    formData.append(`sourceFileId:${index}`, localFileId(file));
    if (file.messageId) formData.append(`sourceMessageId:${index}`, file.messageId);
    if (file.receivedAt) formData.append(`receivedAt:${index}`, file.receivedAt);
  }
  const response = await fetch(`${baseUrl}${workflowPath}/commit`, {
    method: 'POST', headers: { 'x-content-intake-key': apiKey }, body: formData,
    signal: AbortSignal.timeout(90000), redirect: 'error',
  });
  const result = await parseJsonResponse(response);
  if (!Array.isArray(result.results) || result.reportEmail?.deferred !== true) {
    throw new Error('Server does not support batched reports; deploy the matching API before running this client');
  }
  return result;
}

async function parseJsonResponse(response) {
  const body = await response.text();
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    parsed = { raw: body };
  }

  if (!response.ok) {
    const error = new Error(`${response.status} ${response.statusText}: ${JSON.stringify(parsed)}`);
    error.status = response.status;
    error.parsed = parsed;
    throw error;
  }

  return parsed;
}

function isPayloadTooLargeError(error) {
  return error && typeof error === 'object' && error.status === 413;
}

export function localFileId(file) {
  const digest = createHash('sha256')
    .update(`${file.messageId || ""}:${file.name}:${file.sha256}`)
    .digest('hex')
    .slice(0, 16);
  return `local:${digest}`;
}
