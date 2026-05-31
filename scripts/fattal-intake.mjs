#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parse as parseDotenv } from 'dotenv';

const DEFAULT_PORT = 4174;
const DEFAULT_DIR = path.join(homedir(), 'Desktop', 'פתאל 28');
const DEFAULT_OWNER_EMAIL = 'playzonest1@gmail.com';
const DEFAULT_TEMP_ENV_FILE = '/private/tmp/qr-vercel-production.env';

main().catch((error) => {
  console.error(`\nשגיאה: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadEnvFiles(['.env.local'], { override: false });
  loadEnvFiles([DEFAULT_TEMP_ENV_FILE, ...options.envFiles], { override: true });
  normalizeFirebaseServiceAccountEnv();

  const dir = path.resolve(options.dir || DEFAULT_DIR);
  const files = await collectPdfFiles(dir);
  if (files.length === 0) {
    throw new Error(`לא נמצאו קבצי PDF בתיקייה: ${dir}`);
  }

  if (!process.env.CONTENT_INTAKE_API_KEY && options.startServer) {
    process.env.CONTENT_INTAKE_API_KEY = randomBytes(24).toString('hex');
  }

  const apiKey = options.apiKey || process.env.CONTENT_INTAKE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'חסר CONTENT_INTAKE_API_KEY. אפשר למשוך env מ-Vercel לקובץ זמני או להעביר --api-key.'
    );
  }

  const ownerEmail = options.ownerEmail || process.env.FATTAL_BOOKLETS_OWNER_EMAIL || DEFAULT_OWNER_EMAIL;
  const receivedAt = options.receivedAt || new Date().toISOString();
  const port = options.port || DEFAULT_PORT;
  const baseUrl = options.baseUrl || `http://localhost:${port}`;

  let server;
  try {
    if (options.startServer) {
      server = await startDevServer({ port, env: process.env });
    }

    const result = options.commit
      ? await commitWithPayloadFallback({ baseUrl, apiKey, ownerEmail, receivedAt, files })
      : await previewBatch({ baseUrl, apiKey, ownerEmail, receivedAt, files });

    printResult({
      mode: options.commit ? 'commit' : 'preview',
      dir,
      ownerEmail,
      receivedAt,
      result,
    });
  } finally {
    if (server) {
      server.kill('SIGTERM');
    }
  }
}

function parseArgs(args) {
  const options = {
    commit: false,
    startServer: false,
    envFiles: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = () => {
      index += 1;
      if (!args[index]) throw new Error(`חסר ערך עבור ${arg}`);
      return args[index];
    };

    if (arg === '--commit') options.commit = true;
    else if (arg === '--preview') options.commit = false;
    else if (arg === '--start-server') options.startServer = true;
    else if (arg === '--dir') options.dir = next();
    else if (arg === '--base-url') options.baseUrl = next();
    else if (arg === '--owner-email') options.ownerEmail = next();
    else if (arg === '--received-at') options.receivedAt = next();
    else if (arg === '--api-key') options.apiKey = next();
    else if (arg === '--env-file') options.envFiles.push(next());
    else if (arg === '--port') options.port = Number(next());
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`ארגומנט לא מוכר: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
שימוש:
  npm run fattal:intake -- --start-server
  npm run fattal:intake -- --start-server --commit

ברירת מחדל:
  --dir "${DEFAULT_DIR}"
  --owner-email ${DEFAULT_OWNER_EMAIL}
  --base-url http://localhost:${DEFAULT_PORT}

אפשרויות:
  --preview              הרצת בדיקה בלבד. ברירת מחדל.
  --commit               עדכון אמיתי של ה-PDFים במערכת.
  --start-server         מרים Next dev server מקומי עבור ה-API.
  --env-file <path>      טוען משתני סביבה נוספים.
  --api-key <key>        מפתח Content Intake אם לא נמצא ב-env.
`);
}

function loadEnvFiles(files, { override }) {
  for (const file of files) {
    if (!file || !existsSync(file)) continue;
    const absolutePath = path.resolve(file);
    const contents = existsSync(absolutePath)
      ? readFileSync(absolutePath, 'utf8')
      : '';

    const parsed = parseDotenv(contents);
    for (const [key, rawValue] of Object.entries(parsed)) {
      if (!override && process.env[key]) continue;
      process.env[key] = rawValue;
    }
  }
}

function normalizeFirebaseServiceAccountEnv() {
  const value = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!value) return;

  try {
    JSON.parse(value);
    return;
  } catch {
    // Vercel env pull may materialize the private key with literal newlines inside
    // the JSON string. JSON.parse requires those newlines to be escaped.
  }

  const normalized = value.replace(
    /("private_key"\s*:\s*")([\s\S]*?)(")/,
    (_match, prefix, privateKey, suffix) =>
      `${prefix}${privateKey.replace(/\r?\n/g, '\\n')}${suffix}`
  );

  JSON.parse(normalized);
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = normalized;
}

async function collectPdfFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.pdf')) continue;
    const filePath = path.join(dir, entry.name);
    const fileStat = await stat(filePath);
    files.push({
      path: filePath,
      name: entry.name,
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
    });
  }

  return files.sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

async function startDevServer({ port, env }) {
  const child = spawn(
    'npm',
    ['run', 'dev', '--', '--port', String(port)],
    {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    if (/Ready|Local|Next\.js|started server/i.test(text)) {
      process.stdout.write(text);
    }
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    if (!/warn/i.test(text)) process.stderr.write(text);
  });

  child.once('exit', (code) => {
    if (code && code !== 0) {
      console.error(`Next dev server exited with code ${code}`);
    }
  });

  await waitForServer(`http://localhost:${port}/api/health`, child);
  return child;
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('שרת הפיתוח נסגר לפני שהיה מוכן');
    }

    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Keep waiting.
    }

    await sleep(1000);
  }

  throw new Error('שרת הפיתוח לא עלה בזמן');
}

async function previewBatch({ baseUrl, apiKey, ownerEmail, receivedAt, files, saveRun = true }) {
  const response = await fetch(`${baseUrl}/api/content-intake/fattal/preview`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-content-intake-key': apiKey,
    },
    body: JSON.stringify({
      ownerEmail,
      receivedAt,
      saveRun,
      source: 'manual',
      files: files.map((file) => ({
        id: localFileId(file),
        name: file.name,
        size: file.size,
        contentType: 'application/pdf',
        receivedAt,
        source: 'manual',
      })),
    }),
  });

  return parseJsonResponse(response);
}

async function commitWithPayloadFallback(params) {
  try {
    return await commitBatch(params);
  } catch (error) {
    if (!isPayloadTooLargeError(error)) throw error;

    console.warn('\nהבקשה גדולה מדי לשליחה אחת. עובר לעדכון קובץ-קובץ...');
    return commitFilesIndividually(params);
  }
}

async function commitBatch({ baseUrl, apiKey, ownerEmail, receivedAt, files }) {
  const formData = new FormData();
  formData.set('ownerEmail', ownerEmail);
  formData.set('receivedAt', receivedAt);
  formData.set('source', 'manual');

  for (const file of files) {
    const buffer = await readFile(file.path);
    formData.append(
      'files',
      new Blob([buffer], { type: 'application/pdf' }),
      file.name
    );
    formData.append(`sourceFileId:${file.name}`, localFileId(file));
  }

  const response = await fetch(`${baseUrl}/api/content-intake/fattal/commit`, {
    method: 'POST',
    headers: {
      'x-content-intake-key': apiKey,
    },
    body: formData,
  });

  return parseJsonResponse(response);
}

async function commitFilesIndividually({ baseUrl, apiKey, ownerEmail, receivedAt, files }) {
  const preview = await previewBatch({
    baseUrl,
    apiKey,
    ownerEmail,
    receivedAt,
    files,
    saveRun: false,
  });

  const results = [];
  for (const [index, file] of files.entries()) {
    console.log(`מעדכן ${index + 1}/${files.length}: ${file.name}`);
    try {
      const singleResult = await commitBatch({
        baseUrl,
        apiKey,
        ownerEmail,
        receivedAt,
        files: [file],
      });

      if (Array.isArray(singleResult.results)) {
        results.push(...singleResult.results);
      } else {
        results.push({
          fileId: localFileId(file),
          filename: file.name,
          status: 'failed',
          error: 'Update returned no result',
        });
      }
    } catch (error) {
      results.push({
        fileId: localFileId(file),
        filename: file.name,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Update failed',
      });
    }
  }

  const suggestedReplyAfterCommitHe = buildCommitReply(preview, results);

  return {
    success: !hasCommitIssues(preview, results),
    status: hasCommitIssues(preview, results) ? 'completed_with_issues' : 'completed',
    preview,
    summary: {
      totalFiles: preview.summary?.totalFiles || files.length,
      matched: preview.summary?.matched || 0,
      updated: results.filter((result) => result.status === 'updated').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      skippedDuplicate: results.filter((result) => result.status === 'skipped_duplicate').length,
      failed: results.filter((result) => result.status === 'failed').length,
      missingTargets: preview.summary?.missingTargets || 0,
    },
    results,
    suggestedReplyAfterCommitHe,
  };
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

function buildCommitReply(preview, results) {
  const updated = results.filter((result) => result.status === 'updated');
  const skippedDuplicates = results.filter((result) => result.status === 'skipped_duplicate');
  const skipped = results.filter((result) => result.status === 'skipped');
  const failed = results.filter((result) => result.status === 'failed');
  const missingTitles = Array.isArray(preview.missingTargets)
    ? preview.missingTargets.map((missing) => missing.target?.title).filter(Boolean)
    : [];
  const updatedTitles = updated.map((result) => result.title).filter(Boolean);

  if (skipped.length === 0 && failed.length === 0 && missingTitles.length === 0) {
    const lines = ['תודה, בוצע ✅'];
    if (updated.length > 0) {
      lines.push(`עודכנו ${updated.length} חוברות${updatedTitles.length ? `: ${updatedTitles.join(', ')}` : ''}`);
    }
    if (skippedDuplicates.length > 0) {
      lines.push(`קבצים שכבר היו מעודכנים דולגו: ${skippedDuplicates.length}`);
    }
    return lines.join('\n');
  }

  const lines = ['תודה, עדכנתי את מה שהתקבל ✅'];
  if (updated.length > 0) {
    lines.push(`עודכנו ${updated.length} חוברות${updatedTitles.length ? `: ${updatedTitles.join(', ')}` : ''}`);
  }
  if (skippedDuplicates.length > 0) {
    lines.push(`קבצים שכבר היו מעודכנים דולגו: ${skippedDuplicates.length}`);
  }
  if (skipped.length > 0) {
    lines.push(`דורשים בדיקה ידנית: ${skipped.length} קבצים`);
  }
  if (failed.length > 0) {
    lines.push(`לא הצלחתי לעדכן: ${failed.length} קבצים`);
  }
  if (missingTitles.length > 0) {
    lines.push(`חסרים לי קבצים עבור: ${missingTitles.join(', ')}`);
  }
  return lines.join('\n');
}

function hasCommitIssues(preview, results) {
  return (preview.summary?.missingTargets || 0) > 0
    || results.some((result) => result.status === 'failed' || result.status === 'skipped');
}

function localFileId(file) {
  const digest = createHash('sha256')
    .update(`${file.name}:${file.size}:${Math.round(file.mtimeMs)}`)
    .digest('hex')
    .slice(0, 16);
  return `local:${digest}`;
}

function printResult({ mode, dir, ownerEmail, receivedAt, result }) {
  console.log('\n==============================');
  console.log(mode === 'commit' ? 'פתאל - עדכון בפועל' : 'פתאל - בדיקה לפני עדכון');
  console.log('==============================');
  console.log(`תיקייה: ${dir}`);
  console.log(`משתמש יעד: ${ownerEmail}`);
  console.log(`תאריך קבלה: ${receivedAt}`);
  if (result.runId) console.log(`runId: ${result.runId}`);

  const summary = result.summary || {};
  console.log('\nסיכום:');
  for (const [key, value] of Object.entries(summary)) {
    console.log(`- ${key}: ${value}`);
  }

  if (Array.isArray(result.matches)) {
    console.log('\nהתאמות:');
    for (const match of result.matches) {
      console.log(`- ${match.file?.name} -> ${match.target?.title || 'לא זוהה'} (${match.status}, ${match.confidence})`);
      if (Array.isArray(match.reasons) && match.reasons.length > 0) {
        console.log(`  סיבות: ${match.reasons.join(' | ')}`);
      }
      if (Array.isArray(match.warnings) && match.warnings.length > 0) {
        console.log(`  אזהרות: ${match.warnings.join(' | ')}`);
      }
    }
  }

  if (Array.isArray(result.results)) {
    console.log('\nתוצאות עדכון:');
    for (const item of result.results) {
      console.log(`- ${item.filename} -> ${item.title || 'ללא יעד'} (${item.status})${item.error ? `: ${item.error}` : ''}`);
    }
  }

  if (Array.isArray(result.missingTargets) && result.missingTargets.length > 0) {
    console.log('\nחסרים:');
    for (const missing of result.missingTargets) {
      console.log(`- ${missing.target?.title}`);
    }
  }

  if (result.preview?.missingTargets?.length > 0) {
    console.log('\nחסרים:');
    for (const missing of result.preview.missingTargets) {
      console.log(`- ${missing.target?.title}`);
    }
  }

  if (result.suggestedReplyAfterCommitHe || result.preview?.suggestedReplyAfterCommitHe) {
    console.log('\nנוסח וואטסאפ:');
    console.log(result.suggestedReplyAfterCommitHe || result.preview.suggestedReplyAfterCommitHe);
  }
}
