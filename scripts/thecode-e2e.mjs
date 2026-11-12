// הקוד — end-to-end check against a RUNNING dev server and the DEV Firebase project.
//
//   node scripts/thecode-e2e.mjs            # seed a test adventure, play a full game, keep it
//   node scripts/thecode-e2e.mjs --cleanup  # same, then delete everything it created
//
// Safety: refuses to run unless .env.local points at `qrinfo-dev` (public project id AND
// service account). It creates one auth user (`thecode-e2e-owner`), one code doc and its
// `thecode*` data — nothing else is touched. Base URL: THECODE_E2E_BASE (default :3250).

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const BASE = process.env.THECODE_E2E_BASE || 'http://localhost:3250';
const CLEANUP = process.argv.includes('--cleanup');
const OWNER_UID = 'thecode-e2e-owner';
const DEV_PROJECT = 'qrinfo-dev';

// ------------------------------------------------------------------ env
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

// ------------------------------------------------------------------ tiny test kit
let passed = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name} ${detail}`);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(method, path, { body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* not json */
  }
  return { status: res.status, json };
}

// ------------------------------------------------------------------ sample adventure
const SPOTS = ['הבריכה', 'הלובי', 'חדר האוכל', 'הגינה'].map((name, i) => ({
  id: `s${i + 1}`,
  name,
  hints: [`חפשו באזור של ${name}`, `ממש ליד ${name}`, `הביטו למטה, ליד ${name}`],
  isActive: true,
  // The pool is outdoors: its gnomes (1, 5, 9) may only be black / grey.
  ...(i === 0 ? { outdoor: true } : {}),
}));
const COLORS = [
  ['black', 'grey'], ['blue', 'yellow'], ['black', 'white'],
  ['green', 'black'], ['grey', 'black'], ['yellow', 'red'],
  ['white', 'purple'], ['brown', 'blue'], ['grey', 'grey'],
  ['yellow', 'purple'], ['black', 'brown'], ['white', 'blue'],
];
const ANSWERS = ['גשר', 'מזרקה', 'מנורה', 'דלת', 'חלון', 'כיסא', 'יונה', 'ורד', 'לוח', 'מפה', 'כובע', 'חבל'];
const GNOMES = ANSWERS.map((_, i) => ({
  id: `g${i + 1}`,
  number: i + 1,
  code: '',
  manualCode: '',
  spotId: `s${(i % 4) + 1}`,
  bodyColor: COLORS[i][0],
  hatColor: COLORS[i][1],
  isActive: true,
}));
const RIDDLES = ANSWERS.map((answerWord, i) => ({
  id: `r${i + 1}`,
  gnomeId: `g${i + 1}`,
  type: 'observe',
  text: `חידת בדיקה מספר ${i + 1}: מה רואים כאן ממש מולכם?`,
  answerWord,
  letter: '',
  acceptSoundAlike: true,
  hints: ['רמז ראשון לחידה', 'רמז שני לחידה'],
  difficulty: 1,
  status: 'published',
}));
const PHRASES = [
  { id: 'p1', text: 'גמד חכם', isActive: true },
  { id: 'p2', text: 'ים כחול', isActive: true },
];
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const lettersOf = (text) => [...text].filter((c) => c >= 'א' && c <= 'ת').map((c) => FINALS[c] || c);

// ------------------------------------------------------------------ run
async function main() {
  console.log(`\nהקוד e2e → ${BASE}  (project ${DEV_PROJECT})\n`);

  // --- owner token (custom token → id token), test code doc
  const customToken = await getAuth().createCustomToken(OWNER_UID);
  const signIn = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
  ).then((r) => r.json());
  const idToken = signIn.idToken;
  check('owner id token issued', !!idToken, JSON.stringify(signIn.error || ''));
  if (!idToken) return;

  const shortId = 'tc' + randomBytes(3).toString('hex');
  const codeRef = db.collection('codes').doc();
  const codeId = codeRef.id;
  await codeRef.set({
    shortId,
    ownerId: OWNER_UID,
    collaborators: [],
    title: 'הקוד — בדיקת מערכת',
    media: [{
      id: `media_${Date.now()}_0`, type: 'thecode', url: '', title: 'הקוד — בדיקת מערכת',
      thecodeConfig: { title: 'הקוד — בדיקת מערכת', status: 'draft', language: 'he' },
      createdAt: Timestamp.now(),
    }],
    widgets: {},
    views: 0,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log(`  test code: ${codeId}  shortId: ${shortId}\n`);

  // --- operator API
  console.log('operator');
  let r = await http('GET', `/api/thecode/admin?codeId=${codeId}`);
  check('admin GET without a token is refused', r.status === 401 || r.status === 403, `status ${r.status}`);
  r = await http('GET', `/api/thecode/admin?codeId=${codeId}`, { token: idToken });
  check('admin GET: new adventure, version 0', r.status === 200 && r.json?.version === 0, `status ${r.status}`);
  const baseConfig = r.json.config;

  const draft = { ...baseConfig, title: 'הקוד — בדיקת מערכת', status: 'draft', spots: SPOTS, gnomes: GNOMES, phrases: PHRASES };
  r = await http('PUT', '/api/thecode/admin', { token: idToken, body: { codeId, baseVersion: 0, config: draft, riddles: RIDDLES } });
  check('admin PUT: draft saved, version 1', r.status === 200 && r.json?.ok && r.json.version === 1, `status ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  let config = r.json.config;
  let riddles = r.json.riddles;
  check('server assigned a QR slug + manual code to every gnome', config.gnomes.every((g) => g.code?.length >= 10 && g.manualCode?.length === 6));
  check('server derived every riddle letter', riddles.every((x) => x.letter === lettersOf(x.answerWord)[0]));
  const errors = (r.json.issues || []).filter((i) => i.severity === 'error');
  check('no blocking issues in the sample adventure', errors.length === 0, JSON.stringify(errors));
  const colourIssues = (r.json.issues || []).filter((i) => i.code === 'GNOME_COLOR_UNAVAILABLE');
  check('every gnome is in a colour that is printed for its spot', colourIssues.length === 0, JSON.stringify(colourIssues));
  check('the outdoor flag of a spot is saved (and only where it is set)',
    r.json.config?.spots?.[0]?.outdoor === true && r.json.config.spots.slice(1).every((sp) => sp.outdoor === undefined));
  check('grey gnomes are accepted', r.json.config?.gnomes?.[0]?.hatColor === 'grey');

  r = await http('PUT', '/api/thecode/admin', { token: idToken, body: { codeId, baseVersion: 0, config, riddles } });
  check('stale version → 409 conflict', r.status === 409 && r.json?.error === 'conflict', `status ${r.status}`);

  r = await http('PUT', '/api/thecode/admin', { token: idToken, body: { codeId, baseVersion: 1, config: { ...config, status: 'published' }, riddles: [] } });
  check('publishing without riddles → 422 invalid, nothing saved', r.status === 422 && r.json?.error === 'invalid', `status ${r.status}`);

  // --- players before publishing: paused
  console.log('\nplayer');
  const play = async (auth, action) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await http('POST', '/api/thecode/play', { body: { codeId, ...(auth ? { auth } : {}), action } });
      if (res.json?.error === 'rateLimited') {
        await sleep(((res.json.retryAfterSeconds || 5) + 1) * 1000);
        continue;
      }
      return res;
    }
    return { status: 429, json: { ok: false, error: 'rateLimited' } };
  };
  r = await play(null, { type: 'state' });
  check('draft adventure is closed for players', r.json?.ok && r.json.snapshot.adventure.open === false);

  r = await http('PUT', '/api/thecode/admin', { token: idToken, body: { codeId, baseVersion: 1, config: { ...config, status: 'published' }, riddles } });
  check('published, version 2', r.status === 200 && r.json?.version === 2, `status ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  config = r.json.config;
  riddles = r.json.riddles;
  check('gnome codes survived the second save', config.gnomes.every((g, i) => g.code && g.id === `g${i + 1}`));
  const gnomeById = new Map(config.gnomes.map((g) => [g.id, g]));
  const riddleByGnome = new Map(riddles.map((x) => [x.gnomeId, x]));

  const codeDoc = (await codeRef.get()).data();
  const stub = codeDoc.media[0].thecodeConfig;
  check('public stub synced to published', stub?.status === 'published');
  const publicJson = JSON.stringify(codeDoc);
  check('the public code doc holds no phrase and no answer', !publicJson.includes('גמד חכם') && !publicJson.includes('מזרקה'));
  const idx = await db.collection('thecodeGnomeCodes').where('codeId', '==', codeId).get();
  check('gnome-code index: two docs per gnome', idx.size === config.gnomes.length * 2, `have ${idx.size}`);

  r = await http('GET', `/api/thecode/gnome?code=${config.gnomes[0].code}`);
  check('gnome lookup by QR slug', r.json?.ok && r.json.codeId === codeId && r.json.shortId === shortId && r.json.gnome?.number === 1);
  r = await http('GET', `/api/thecode/gnome?code=${config.gnomes[1].manualCode.toLowerCase()}`);
  check('gnome lookup by manual code, lower case', r.json?.ok && r.json.gnome?.number === 2);
  r = await http('GET', '/api/thecode/gnome?code=nosuchcode123');
  check('unknown gnome code → notFound', r.status === 404);

  r = await play(null, { type: 'scan', code: config.gnomes[0].code });
  check('scan without a profile → needRegister', r.json?.error === 'needRegister');
  r = await play(null, { type: 'register', familyName: '   ', emoji: '🦁' });
  check('empty family name → invalidName', r.json?.error === 'invalidName');
  r = await play(null, { type: 'register', familyName: 'משפחת בדיקה', emoji: '🦁' });
  check('register', r.json?.ok && !!r.json.auth?.token && r.json.snapshot.player?.points === 0, JSON.stringify(r.json).slice(0, 200));
  const auth = r.json.auth;
  const recoveryCode = r.json.snapshot.player.recoveryCode;

  r = await play({ playerId: auth.playerId, token: 'wrong-token' }, { type: 'state' });
  check('bad token → unauthorized', r.json?.error === 'unauthorized');

  // first scan starts the run
  r = await play(auth, { type: 'scan', code: config.gnomes[0].code });
  const firstOutcome = r.json?.event?.outcome?.kind;
  check('first scan starts a suitcase', firstOutcome === 'riddle' || firstOutcome === 'runStarted', firstOutcome);
  let snap = r.json.snapshot;
  check('target shown with a free zone hint', !!snap.run?.target && snap.run.target.locationHints.length === 1);

  // answering a gnome that was not scanned must be refused
  if (!snap.run.target.riddle) {
    r = await play(auth, { type: 'answer', slotIndex: snap.run.target.slotIndex, letter: 'א' });
    check('answer before scanning the gnome → noRiddle', r.json?.event?.outcome?.kind === 'noRiddle');
  }

  let didWrongScan = false;
  let didWrongAnswer = false;
  let didSoundAlike = false;
  let didHint = false;
  let didManual = false;
  let leaked = false;
  let guard = 0;
  while (snap.run && snap.run.state === 'collecting' && guard++ < 20) {
    const target = snap.run.target;
    const gnome = gnomeById.get(target.gnome.id);
    const riddle = riddleByGnome.get(gnome.id);

    if (!didWrongScan && !target.riddle) {
      const other = config.gnomes.find((g) => g.id !== gnome.id && !snap.album.found.some((f) => f.id === g.id));
      const before = snap.player.points;
      r = await play(auth, { type: 'scan', code: other.code });
      check('wrong gnome → "נא נא", first one free', r.json?.event?.outcome?.kind === 'wrongGnome' && r.json.event.outcome.penalty === 0);
      r = await play(auth, { type: 'scan', code: other.code });
      check('same wrong gnome again costs nothing', r.json?.event?.outcome?.penalty === 0 && r.json.snapshot.player.points === before);
      didWrongScan = true;
    }

    if (!target.riddle) {
      const viaManual = !didManual;
      r = await play(auth, { type: 'scan', code: viaManual ? gnome.manualCode : gnome.code });
      if (viaManual) {
        check('scan by the manual code opens the riddle', r.json?.event?.outcome?.kind === 'riddle');
        didManual = true;
      }
      snap = r.json.snapshot;
    }
    const shown = snap.run.target.riddle;
    if (!shown || shown.text !== riddle.text) {
      check('the right riddle is shown after the scan', false, JSON.stringify(shown));
      break;
    }
    const wire = JSON.stringify(r.json);
    if (ANSWERS.some((a) => wire.includes(a)) || PHRASES.some((p) => wire.includes(p.text))) leaked = true;

    if (!didHint) {
      r = await play(auth, { type: 'hint', hintKind: 'riddle' });
      check('first riddle hint is free', r.json?.event?.given === true && r.json.event.cost === 0);
      didHint = true;
    }
    const letter = lettersOf(riddle.answerWord)[0];
    if (!didWrongAnswer) {
      const wrong = letter === 'ז' ? 'ר' : 'ז';
      r = await play(auth, { type: 'answer', slotIndex: target.slotIndex, letter: wrong });
      check('wrong letter → wrong, no penalty on the first', r.json?.event?.outcome?.kind === 'wrong' && r.json.event.outcome.penalty === 0);
      didWrongAnswer = true;
    }
    const typed = letter === 'כ' && !didSoundAlike ? 'ק' : letter;
    const before = snap.player.points;
    r = await play(auth, { type: 'answer', slotIndex: target.slotIndex, letter: typed });
    const out = r.json?.event?.outcome;
    if (typed === 'ק') {
      check('sound-alike letter (ק for כ) accepted with a spelling tip', out?.kind === 'correct' && !!out.spellingTip && out.letter === 'כ');
      didSoundAlike = true;
    }
    if (out?.kind !== 'correct') {
      check('correct letter accepted', false, JSON.stringify(out));
      break;
    }
    if (r.json.snapshot.player.points !== before + out.points) check('points added exactly once', false);
    // a retry of the same answer must not pay twice
    const again = await play(auth, { type: 'answer', slotIndex: target.slotIndex, letter: typed });
    if (again.json.snapshot.player.points !== r.json.snapshot.player.points) check('retried answer pays nothing', false);
    snap = again.json.snapshot;
  }
  check('all letters collected → arranging', snap.run?.state === 'arranging', snap.run?.state);
  check('no answer or phrase text ever reached the phone', !leaked);
  check('hot streak or points earned', snap.player.points > 0);

  const collected = snap.run.collected.map((c) => c.letter).sort().join('');
  const phrase = PHRASES.find((p) => lettersOf(p.text).sort().join('') === collected);
  check('collected letters match one of the phrases', !!phrase, collected);
  check('arrange tray holds the same letters', snap.run.arrange.pool.slice().sort().join('') === collected);

  const right = lettersOf(phrase.text);
  const wrongOrder = right.slice().reverse();
  if (wrongOrder.join('') !== right.join('')) {
    r = await play(auth, { type: 'open', arrangement: wrongOrder });
    check('wrong arrangement → stays closed', r.json?.event?.opened === false && r.json.snapshot.run.state === 'arranging');
  }
  r = await play(auth, { type: 'arrangeHelp' });
  check('paid help fixes the first letter', r.json?.event?.given === true && r.json.snapshot.run.arrange.fixed[0] === right[0]);
  const beforeOpen = r.json.snapshot.player.points;
  r = await play(auth, { type: 'open', arrangement: right });
  check('right arrangement opens the suitcase', r.json?.event?.opened === true && r.json.snapshot.run.state === 'opened');
  check('suitcase bonus paid and phrase revealed', r.json.snapshot.player.points === beforeOpen + r.json.event.bonus && r.json.snapshot.run.suitcase?.phraseText === phrase.text);
  check('one suitcase counted', r.json.snapshot.player.suitcasesOpened === 1);
  const finalPoints = r.json.snapshot.player.points;

  // --- second device, leaderboard, operator views
  console.log('\nboard + operator views');
  r = await play(null, { type: 'recover', recoveryCode: recoveryCode.toLowerCase() });
  check('recovery code restores the family on another device', r.json?.ok && r.json.auth?.playerId === auth.playerId && r.json.auth.token !== auth.token);
  r = await play(auth, { type: 'state' });
  check('the first device still works', r.json?.ok && r.json.snapshot.player?.points === finalPoints);

  await sleep(6000); // leaderboard cache
  r = await http('GET', `/api/thecode/leaderboard?codeId=${codeId}&scope=week`);
  check('weekly board shows the family', r.json?.rows?.some((x) => x.id === auth.playerId && x.points === finalPoints), JSON.stringify(r.json).slice(0, 200));
  r = await http('GET', `/api/thecode/leaderboard?codeId=${codeId}&scope=all`);
  check('all-time board shows the family', r.json?.rows?.some((x) => x.id === auth.playerId));

  r = await http('GET', `/api/thecode/admin?codeId=${codeId}`, { token: idToken });
  const adminPlayer = r.json?.players?.find((p) => p.id === auth.playerId);
  check('operator sees the family with its points', adminPlayer?.points === finalPoints && adminPlayer.suitcases === 1);
  check('operator sees gnome scan stats', Object.values(r.json?.gnomeStats || {}).some((s) => s.scans > 0));
  check('operator sees riddle stats', Object.values(r.json?.riddleStats || {}).some((s) => s.correct > 0));
  check('operator view carries no token', !JSON.stringify(r.json.players).includes('tokenHash'));

  r = await http('PATCH', '/api/thecode/admin/players', { token: idToken, body: { codeId, playerId: auth.playerId, patch: { hidden: true } } });
  check('operator hides the family', r.status === 200);
  await sleep(6000);
  r = await http('GET', `/api/thecode/leaderboard?codeId=${codeId}&scope=all`);
  check('hidden family left the board', !r.json?.rows?.some((x) => x.id === auth.playerId));
  await http('PATCH', '/api/thecode/admin/players', { token: idToken, body: { codeId, playerId: auth.playerId, patch: { hidden: false } } });

  // --- second suitcase
  console.log('\nsecond suitcase');
  r = await play(auth, { type: 'newSuitcase' });
  check('a new suitcase starts with fresh gnomes', r.json?.event?.started === true && r.json.snapshot.run?.state === 'collecting');
  const second = r.json.snapshot;
  check('the new target was not found before', !!second.run?.target && !second.album.found.some((f) => f.id === second.run.target.gnome.id));

  // --- pages
  console.log('\npages');
  for (const path of [`/v/${shortId}`, `/g/${config.gnomes[0].code}`, `/lobby/thecode/${shortId}`]) {
    const res = await fetch(BASE + path);
    check(`page ${path.split('/').slice(0, 3).join('/')}… renders`, res.status === 200, `status ${res.status}`);
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) console.log('FAILED:\n - ' + failures.join('\n - '));

  if (CLEANUP) {
    for (const d of idx.docs) await d.ref.delete();
    for (const sub of ['thecode', 'thecodePlayers']) {
      const docs = await codeRef.collection(sub).get();
      for (const d of docs.docs) await d.ref.delete();
    }
    await codeRef.delete();
    await getAuth().deleteUser(OWNER_UID).catch(() => {});
    console.log('cleaned up.');
  } else {
    console.log(`\nkept for viewing:\n  game   ${BASE}/v/${shortId}\n  lobby  ${BASE}/lobby/thecode/${shortId}\n  gnome  ${BASE}/g/${config.gnomes[0].code}\n  codeId ${codeId}`);
  }
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error('e2e crashed:', e);
  process.exit(1);
});
