// 3D-printed QR plaques: geometry + 3MF, end to end in Node (node --test scripts/tests/print3d.test.mjs).
// Loads the real TS sources through jiti (already in node_modules via Tailwind).
import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const lib = (f) => jiti.import(new URL(`../../src/lib/print3d/${f}.ts`, import.meta.url).pathname);
const { qrMatrix, decodes, mirrored } = await lib('matrix');
const { PLAQUES, baseFor, perPlate } = await lib('presets');
const { buildPlaque, buildBase } = await lib('build');
const { buildJob, faceDecodes, FILAMENT_BLACK, FILAMENT_WHITE } = await lib('job');
const { faceDesign, addressLines } = await lib('face');

const URL1 = 'https://qr.playzones.app/g/Dm0LobbyA1x9';

/** Closed-surface check: every edge used exactly twice, once in each direction. */
function watertight(mesh) {
  const edges = new Map();
  const t = mesh.t;
  for (let i = 0; i < t.length; i += 3) {
    for (const [a, b] of [[t[i], t[i + 1]], [t[i + 1], t[i + 2]], [t[i + 2], t[i]]]) {
      const k = `${a}>${b}`;
      edges.set(k, (edges.get(k) || 0) + 1);
    }
  }
  for (const [k, n] of edges) {
    const [a, b] = k.split('>');
    if (n !== 1 || edges.get(`${b}>${a}`) !== 1) return false;
  }
  return true;
}

test('matrix decodes; a mirrored matrix does not', () => {
  const m = qrMatrix(URL1);
  assert.equal(m.version, 3);
  assert.ok(decodes(m));
  assert.equal(decodes(mirrored(m)), false);
});

test('standard plaque: face geometry decodes as a phone sees it', () => {
  const m = qrMatrix(URL1);
  const p = buildPlaque(PLAQUES.standard, m, ['K7MP2Q'], 7);
  assert.ok(faceDecodes(p, URL1));
  assert.ok(watertight(p.white) && watertight(p.black), 'every piece is a closed prism');
});

test('module and text sizes on the standard plaque match the gnome CAD', () => {
  const d = faceDesign(37.1, 43.1, qrMatrix(URL1), ['K7MP2Q']);
  assert.ok(Math.abs(d.layout.module - 1.124) < 0.002);
  assert.ok(Math.abs(d.layout.qr - 32.6) < 0.05);
  assert.ok(d.textCell >= 0.6 && !d.textTooSmall);
});

test('web address fits a large plaque but is too small on the standard one', () => {
  const m = qrMatrix('https://qr.playzones.app/v/dMo3Dq');
  const lines = addressLines(m.url);
  assert.deepEqual(lines, ['qr.playzones.app', 'v/dMo3Dq']);
  assert.ok(faceDesign(37.1, 43.1, m, lines).textTooSmall);
  assert.equal(faceDesign(60, 70, m, lines).textTooSmall, false);
});

test('base: both mounts are closed, pocket depth = plaque thickness', () => {
  for (const mount of ['screws', 'tape']) {
    const { mesh, base } = buildBase(PLAQUES.standard, mount);
    assert.ok(watertight(mesh), mount);
    assert.equal(base.pocketDepth, PLAQUES.standard.t);
    assert.equal(base.pocketW, 37.5);
    assert.equal(base.pocketH, 43.5);
  }
  assert.equal(baseFor(PLAQUES.standard, 'screws').t, 4.8);
  assert.equal(baseFor(PLAQUES.standard, 'tape').t, 3.6);
});

test('job: gnome batch → one plate, Bambu filament per part, everything decodes', () => {
  const items = Array.from({ length: 6 }, (_, i) => ({ number: i + 1, url: `https://qr.playzones.app/g/Dm0Test${String(i).padStart(5, '0')}`, lines: ['K7MP2Q'], name: `#${i + 1}` }));
  const job = buildJob({ shape: 'base', size: 'standard', mount: 'screws', backNumber: true, items, title: 't' });
  assert.deepEqual(job.failed, []);
  assert.deepEqual(job.files.map((f) => f.kind), ['plaques', 'bases']);
  const z = unzipSync(job.files[0].bytes);
  const cfg = strFromU8(z['Metadata/model_settings.config']);
  assert.equal((cfg.match(new RegExp(`key="extruder" value="${FILAMENT_WHITE}"`, 'g')) || []).length, 12); // object default + its white part
  assert.ok(cfg.includes(`key="extruder" value="${FILAMENT_BLACK}"`));
  assert.ok(strFromU8(z['3D/3dmodel.model']).includes('<build>'));
});

test('plate counts', () => {
  assert.equal(perPlate(37.1, 43.1, true), 41);
  const b = baseFor(PLAQUES.standard, 'screws');
  assert.equal(perPlate(b.w, b.h, false), 25);
});

test('50 plaques split into two plates', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ number: i + 1, url: `https://qr.playzones.app/g/Dm0Many${String(i).padStart(5, '0')}`, lines: [], name: `#${i + 1}` }));
  const job = buildJob({ shape: 'gnome', size: 'standard', mount: 'screws', backNumber: false, items, title: 't' });
  assert.deepEqual(job.files.map((f) => f.pieces), [41, 9]);
});

test('a plaque built WITHOUT the face-down mirror is refused', async () => {
  const m = qrMatrix(URL1);
  const p = buildPlaque(PLAQUES.standard, mirrored(m), [], null); // double mirror = wrong on the bed
  assert.equal(faceDecodes(p, URL1), false);
});
