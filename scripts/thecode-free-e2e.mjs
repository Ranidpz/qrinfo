// קוד הגמדים — FREE mode end-to-end check against a RUNNING dev server and the DEV Firebase project.
//
//   node scripts/thecode-free-e2e.mjs            # seed a free adventure, play it, keep it for viewing
//   node scripts/thecode-free-e2e.mjs --cleanup  # same, then delete everything it created
//
// Safety (same as scripts/thecode-e2e.mjs): refuses to run unless .env.local points at `qrinfo-dev`
// (public project id AND service account). Creates one auth user, one code doc and its thecode
// data. Base URL: THECODE_E2E_BASE (default :3250). Never against a Vercel preview (it writes prod).

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const BASE = process.env.THECODE_E2E_BASE || 'http://localhost:3250';
const CLEANUP = process.argv.includes('--cleanup');
const OWNER_UID = 'thecode-free-e2e-owner';
const DEV_PROJECT = 'qrinfo-dev';

const env = {};
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
  env[m[1]] = v;
}
let serviceAccount;
try {
  serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY);
} catch {
  serviceAccount = JSON.parse(Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8'));
}
if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== DEV_PROJECT || serviceAccount.project_id !== DEV_PROJECT) {
  console.error(`REFUSING: this script only runs against ${DEV_PROJECT}.`);
  process.exit(2);
}
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

let passed = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { passed += 1; console.log(`  ok   ${name}`); } else { failures.push(name); console.log(`  FAIL ${name} ${detail}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function http(method, path, { body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* not json */ }
  return { status: res.status, json };
}

// ------------------------------------------------------------------ a small free adventure
const SPOTS = ['הלובי', 'הגינה'].map((name, i) => ({ id: `s${i + 1}`, name, hints: [`ליד ${name}`, `ממש ב${name}`], isActive: true }));
const COLORS = [['blue', 'yellow'], ['green', 'red'], ['purple', 'white'], ['brown', 'green']];
const GNOMES = COLORS.map(([bodyColor, hatColor], i) => ({
  id: `g${i + 1}`, number: i + 1, code: '', manualCode: '', spotId: `s${(i % 2) + 1}`, bodyColor, hatColor, isActive: true,
}));
// Two riddles per gnome (the first of g1 is "אריה", the second "בננה").
const WORDS = [['אריה', 'בננה'], ['דג', 'הר'], ['גזר', 'ורד'], ['זברה', 'חתול']];
const RIDDLES = WORDS.flatMap((ws, i) => ws.map((answerWord, k) => ({
  id: `r${i + 1}${'ab'[k]}`, gnomeId: `g${i + 1}`, type: 'observe', text: `חידה חופשית ${i + 1}${'ab'[k]}: מה אני?`,
  answerWord, letter: '', acceptSoundAlike: true, hints: ['רמז סודי'], difficulty: 1, status: 'published',
})));

async function main() {
  console.log(`\nקוד הגמדים — free e2e → ${BASE}  (project ${DEV_PROJECT})\n`);
  const customToken = await getAuth().createCustomToken(OWNER_UID);
  const signIn = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) },
  ).then((r) => r.json());
  const idToken = signIn.idToken;
  check('owner id token issued', !!idToken, JSON.stringify(signIn.error || ''));
  if (!idToken) return;

  const shortId = 'tf' + randomBytes(3).toString('hex');
  const codeRef = db.collection('codes').doc();
  const codeId = codeRef.id;
  await codeRef.set({
    shortId, ownerId: OWNER_UID, collaborators: [], title: 'קוד הגמדים — משחק חופשי (בדיקה)',
    media: [{ id: `media_${Date.now()}_0`, type: 'thecode', url: '', title: 'קוד הגמדים — משחק חופשי (בדיקה)',
      thecodeConfig: { title: 'קוד הגמדים — משחק חופשי (בדיקה)', status: 'draft', language: 'he' }, createdAt: Timestamp.now() }],
    widgets: {}, views: 0, isActive: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  });
  console.log(`  test code: ${codeId}  shortId: ${shortId}\n`);

  // --- operator: a FREE adventure with no phrase at all can be published
  console.log('operator');
  let r = await http('GET', `/api/thecode/admin?codeId=${codeId}`, { token: idToken });
  const base = r.json.config;
  const config0 = {
    ...base, title: 'קוד הגמדים — משחק חופשי (בדיקה)', status: 'published', spots: SPOTS, gnomes: GNOMES, phrases: [],
    mode: 'free', free: { refreshMinutes: 1, attemptsPerRiddle: 2, screenHint: 'בלובי, מול הקבלה', introVideo: 'https://evil.example/x.mp4' },
  };
  r = await http('PUT', '/api/thecode/admin', { token: idToken, body: { codeId, baseVersion: 0, config: config0, riddles: RIDDLES } });
  check('free adventure without phrases publishes', r.status === 200 && r.json?.ok, `status ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  const config = r.json.config;
  check('mode + free settings kept, foreign video dropped', config.mode === 'free' && config.free?.refreshMinutes === 1 && !config.free?.introVideo,
    JSON.stringify(config.free));
  const pub = (await codeRef.get()).data().media[0].thecodeConfig;
  check('public stub says mode free', pub.mode === 'free', JSON.stringify(pub));
  const lobby0 = (await codeRef.collection('thecodeLobby').doc('live').get()).data();
  check('big screen doc says mode free', lobby0?.mode === 'free', JSON.stringify(lobby0));
  const codeOf = (id) => config.gnomes.find((g) => g.id === id).code;

  // --- /g lookup tells the phone it is free mode + where the screen is
  r = await http('GET', `/api/thecode/gnome?code=${codeOf('g1')}`);
  check('gnome lookup: mode free + screen hint', r.json?.ok && r.json.mode === 'free' && r.json.screenHint === 'בלובי, מול הקבלה', JSON.stringify(r.json).slice(0, 200));

  // --- player
  console.log('\nplayer');
  const play = async (auth, action) => (await http('POST', '/api/thecode/play', { body: { codeId, ...(auth ? { auth } : {}), action } })).json;
  let res = await play(null, { type: 'state' });
  check('state without a group: mode free, no board', res?.ok && res.snapshot.adventure.mode === 'free' && !res.snapshot.free, JSON.stringify(res).slice(0, 200));
  res = await play(null, { type: 'register', familyName: 'הבודקים החופשיים', emoji: '🍄' });
  check('register', res?.ok && !!res.auth, JSON.stringify(res).slice(0, 200));
  const auth = res.auth;
  check('board: 4 gnomes awake', res.snapshot.free?.gnomes?.length === 4 && res.snapshot.free.gnomes.every((g) => g.status === 'awake'));
  const live1 = (await codeRef.collection('thecodeLobby').doc('live').get()).data();
  check('big screen got the "joined" event', (live1?.events || []).some((e) => e.kind === 'joined' && e.familyName === 'הבודקים החופשיים'));

  res = await play(auth, { type: 'scan', code: codeOf('g1') });
  check('scan g1 → riddle r1a', res?.ok && res.event?.type === 'freeScan' && res.event.outcome.kind === 'riddle' && res.snapshot.free.riddle?.riddleId === 'r1a',
    JSON.stringify(res?.event));
  const text = JSON.stringify(res.snapshot);
  check('snapshot carries no answer / hint / other riddle', !['אריה', 'בננה', 'רמז סודי', 'חידה חופשית 2'].some((w) => text.includes(w)));

  res = await play(auth, { type: 'freeAnswer', gnomeId: 'g1', riddleId: 'r1a', letter: 'ב' });
  check('wrong first letter → 1 attempt left', res?.event?.outcome?.kind === 'wrong' && res.event.outcome.attemptsLeft === 1, JSON.stringify(res?.event));
  res = await play(auth, { type: 'freeAnswer', gnomeId: 'g1', riddleId: 'r1a', letter: 'א' });
  check('right on the 2nd try → half points + the answer word', res?.event?.outcome?.kind === 'correct' && res.event.outcome.points === 50 && res.event.outcome.answerWord === 'אריה',
    JSON.stringify(res?.event));
  const again = await play(auth, { type: 'freeAnswer', gnomeId: 'g1', riddleId: 'r1a', letter: 'א' });
  check('a retried answer is not scored twice', again?.snapshot?.player?.points === 50, String(again?.snapshot?.player?.points));
  check('g1 asleep on the board', res.snapshot.free.gnomes.find((g) => g.gnome.id === 'g1').status === 'asleep');
  res = await play(auth, { type: 'scan', code: codeOf('g1') });
  check('scanning the sleeping gnome → asleep', res?.event?.outcome?.kind === 'asleep');

  res = await play(auth, { type: 'scan', code: codeOf('g2') });
  res = await play(auth, { type: 'freeAnswer', gnomeId: 'g2', riddleId: 'r2a', letter: 'ת' });
  res = await play(auth, { type: 'freeAnswer', gnomeId: 'g2', riddleId: 'r2a', letter: 'ש' });
  check('two wrong → failed, no points lost', res?.event?.outcome?.kind === 'failed' && res.snapshot.player.points === 50, JSON.stringify(res?.event));

  res = await play(auth, { type: 'freeHint', gnomeId: 'g3' });
  check('location hint bought for points', res?.event?.outcome?.kind === 'hint' && res.snapshot.player.points === 30, JSON.stringify(res?.event));

  res = await play(auth, { type: 'scan', code: 'NOTAGNOME12' });
  check('foreign code → unknownGnome', res?.event?.outcome?.kind === 'unknownGnome');

  // --- wake-up: refreshMinutes = 1
  console.log('\nwaiting 62 s for the gnomes to wake…');
  await sleep(62_000);
  res = await play(auth, { type: 'scan', code: codeOf('g1') });
  check('after the refresh g1 asks its NEXT riddle (r1b)', res?.event?.outcome?.kind === 'riddle' && res.snapshot.free.riddle?.riddleId === 'r1b', JSON.stringify(res?.event));

  // --- leaderboard + round reset
  r = await http('GET', `/api/thecode/leaderboard?codeId=${codeId}&scope=screen`);
  check('the group is on the big-screen board', (r.json?.rows || []).some((x) => x.familyName === 'הבודקים החופשיים' && x.points === 30), JSON.stringify(r.json).slice(0, 300));
  r = await http('POST', '/api/thecode/admin/reset', { token: idToken, body: { codeId, confirm: 'איפוס' } });
  const after = (await codeRef.collection('thecodePlayers').doc(auth.playerId).get()).data();
  check('round reset clears the free state', r.status === 200 && after && after.free === undefined && after.points === 0, `status ${r.status}`);

  // --- pages
  console.log('\npages');
  for (const path of [`/v/${shortId}`, `/g/${codeOf('g1')}`, `/lobby/thecode/${shortId}`]) {
    const p = await fetch(BASE + path);
    check(`page ${path.split('/').slice(0, 3).join('/')}… renders`, p.status === 200, `status ${p.status}`);
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) console.log('FAILED:\n - ' + failures.join('\n - '));
  if (CLEANUP) {
    const idx = await db.collection('thecodeGnomeCodes').where('codeId', '==', codeId).get();
    for (const d of idx.docs) await d.ref.delete();
    for (const sub of ['thecode', 'thecodePlayers', 'thecodeLobby']) {
      const docs = await codeRef.collection(sub).get();
      for (const d of docs.docs) await d.ref.delete();
    }
    await codeRef.delete();
    await getAuth().deleteUser(OWNER_UID).catch(() => {});
    console.log('cleaned up.');
  } else {
    console.log(`\nkept for viewing:\n  game   ${BASE}/v/${shortId}\n  lobby  ${BASE}/lobby/thecode/${shortId}\n  gnome  ${BASE}/g/${codeOf('g1')}\n  codeId ${codeId}`);
  }
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error('free e2e crashed:', e); process.exit(1); });
