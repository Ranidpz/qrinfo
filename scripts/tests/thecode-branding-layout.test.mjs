// The opening-screen layout shared by the player and the operator preview (src/lib/thecode/brandingLayout.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { stub } from './load-ts.mjs';

const source = await readFile(new URL('../../src/lib/thecode/brandingLayout.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const L = await import(stub(outputText));

test('defaults: centred cover photo, logo at 50/12, scale 1', () => {
  assert.deepEqual(L.resolveLayout(undefined), { focus: { x: 50, y: 50 }, zoom: 1, logo: { x: 50, y: 12 }, logoScale: 1 });
  const s = L.brandingLayout(null);
  assert.equal(s.background.objectPosition, '50% 50%');
  assert.equal(s.background.transform, undefined);
  assert.equal(s.logo.transform, 'translate(-50%, -50%) scale(1)');
});

test('clamps every field to its range', () => {
  const r = L.resolveLayout({ backgroundFocus: { x: -5, y: 140 }, backgroundZoom: 9, logoPosition: { x: 101, y: -1 }, logoScale: 0.1 });
  assert.deepEqual(r, { focus: { x: 0, y: 100 }, zoom: 3, logo: { x: 100, y: 0 }, logoScale: 0.5 });
  assert.equal(L.resolveLayout({ logoScale: 7 }).logoScale, 2.5);
  assert.equal(L.resolveLayout({ backgroundZoom: Number.NaN }).zoom, 1);
});

test('zoom grows from the focus point; logo is centred on its point', () => {
  const s = L.brandingLayout({ backgroundFocus: { x: 20, y: 70 }, backgroundZoom: 1.5, logoPosition: { x: 30, y: 80 }, logoScale: 2 });
  assert.equal(s.background.objectPosition, '20% 70%');
  assert.equal(s.background.transform, 'scale(1.5)');
  assert.equal(s.background.transformOrigin, '20% 70%');
  assert.deepEqual([s.logo.left, s.logo.top, s.logo.transform], ['30%', '80%', 'translate(-50%, -50%) scale(2)']);
});

test('a logo counts as placed only once the venue moved or resized it', () => {
  assert.equal(L.isLogoPlaced({ logoUrl: 'https://x/l.png' }), false);
  assert.equal(L.isLogoPlaced({ logoUrl: 'https://x/l.png', logoScale: 1 }), true);
  assert.equal(L.isLogoPlaced({ logoUrl: 'https://x/l.png', logoPosition: { x: 50, y: 12 } }), true);
  assert.equal(L.isLogoPlaced({ logoPosition: { x: 50, y: 12 } }), false);
  assert.equal(L.tidy(12.345), 12.3);
});
