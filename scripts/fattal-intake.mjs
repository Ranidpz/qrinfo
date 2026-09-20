#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile, stat, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parse as parseDotenv } from 'dotenv';

import { previewBatch, commitWithPayloadFallback } from '../tools/whatsapp-intake/src/intake-client.mjs';
export { previewBatch, commitWithPayloadFallback } from '../tools/whatsapp-intake/src/intake-client.mjs';

const DEFAULT_PORT = 4174;
const DEFAULT_OWNER_EMAIL = 'playzonest1@gmail.com';

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((error) => {
  console.error(`\nשגיאה: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadEnvFiles(options.startServer ? ['.env.local', '.env.fattal'] : ['.env.fattal'], { override: false });
  loadEnvFiles(options.envFiles, { override: true });
  normalizeFirebaseServiceAccountEnv();

  if (!options.dir) throw new Error('יש לבחור תיקיית PDF במפורש עם --dir');
  const dir = path.resolve(options.dir);
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
  if (Number.isNaN(Date.parse(receivedAt))) throw new Error('תאריך קבלה לא תקין');
  const port = options.port || DEFAULT_PORT;
  const baseUrl = options.baseUrl || `http://localhost:${port}`;

  const endpoint = new URL(baseUrl);
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname))) {
    throw new Error('API requires HTTPS, except for localhost');
  }
  const lock = path.join(tmpdir(), `fattal-intake-${createHash('sha256').update(`${baseUrl}:${ownerEmail}`).digest('hex').slice(0, 20)}.lock`);
  if (options.commit) {
    try { await mkdir(lock); } catch { throw new Error(`קיימת נעילת ריצה: ${lock}. יש לוודא שהריצה הקודמת הסתיימה לפני הסרת הנעילה.`); }
  }
  let server;
  try {
    if (options.startServer) {
      server = await startDevServer({ port, env: process.env });
    }

    const result = options.commit
      ? await commitWithPayloadFallback({ baseUrl, apiKey, ownerEmail, receivedAt, files })
      : await previewBatch({ baseUrl, apiKey, ownerEmail, receivedAt, files });

    if (options.reportFile) await writeFile(path.resolve(options.reportFile), JSON.stringify(result, null, 2), { mode: 0o600 });
    if (options.commit && (result.summary?.failed > 0 || result.summary?.skipped > 0 || result.reportEmail?.sent !== true)) process.exitCode = 2;

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
    if (options.commit) await rm(lock, { recursive: true, force: true });
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
    else if (arg === '--report-file') options.reportFile = next();
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
  npm run fattal:intake -- --dir "/path/to/today-pdfs" --start-server
  npm run fattal:intake -- --dir "/path/to/today-pdfs" --start-server --commit

ברירת מחדל:
  --dir <תיקיית PDF>      חובה; אין תיקיית תאריך ישנה כברירת מחדל
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

export async function collectPdfFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.pdf')) continue;
    const filePath = path.join(dir, entry.name);
    const fileStat = await stat(filePath);
    if (fileStat.size > 25 * 1024 * 1024) throw new Error(`PDF exceeds 25MB: ${entry.name}`);
    const buffer = await readFile(filePath);
    if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error(`Invalid PDF: ${entry.name}`);
    files.push({
      sha256: createHash('sha256').update(buffer).digest('hex'),
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

function printResult({ mode, dir, ownerEmail, receivedAt, result }) {
  console.log('\n==============================');
  console.log(mode === 'commit' ? 'פתאל - עדכון בפועל' : 'פתאל - בדיקה לפני עדכון');
  console.log('==============================');
  console.log(`תיקייה: ${dir}`);
  console.log(`משתמש יעד: ${ownerEmail}`);
  console.log(`תאריך קבלה: ${receivedAt}`);
  if (result.runId) console.log(`runId: ${result.runId}`);

  if (result.reportEmail) console.log(`דוח מייל: ${result.reportEmail.sent ? 'נשלח' : 'לא נשלח — נדרשת בדיקה'}`);
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
