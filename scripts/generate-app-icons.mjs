// Home-screen app icons, one per experience type (Rani, 27.11.2026: every installed experience
// showed the same Q). Writes public/icons/experiences/{type}-{180|192|512}.png — static files, so
// iPhone (apple-touch-icon) and Android (manifest) both get them with no server work.
//
//   node scripts/generate-app-icons.mjs
//
// Design: a full-bleed colour gradient (no transparent corners — iOS and Android maskable crops
// cut into it) with the experience's catalog icon in white, inside the 80% maskable safe zone.
// קוד הגמדים gets the gnome's head instead of a line icon.
// 10 בול and Social Wall keep the icons they already had (see iconForType in src/lib/appIcons.ts).

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as lucide from 'lucide-react';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/icons/experiences');
const SIZES = [180, 192, 512];

// type → [lucide icon, gradient from, gradient to]. Icons match src/lib/experiences/catalog.ts.
const LINE_ICONS = {
  qtag: ['Tag', '#14b8a6', '#0f766e'],
  raffle: ['Gift', '#f43f5e', '#9f1239'],
  weeklycal: ['CalendarDays', '#38bdf8', '#0369a1'],
  qvote: ['Vote', '#8b5cf6', '#5b21b6'],
  qstage: ['Sparkles', '#d946ef', '#86198f'],
  selfiebeam: ['Camera', '#fb923c', '#c2410c'],
  wordcloud: ['Cloud', '#60a5fa', '#1d4ed8'],
  riddle: ['FileText', '#fbbf24', '#b45309'],
  minigames: ['Gamepad2', '#22c55e', '#15803d'],
  qchallenge: ['Trophy', '#facc15', '#a16207'],
  qbet: ['Goal', '#10b981', '#065f46'],
  qtreasure: ['Map', '#34d399', '#047857'],
  qhunt: ['Crosshair', '#ef4444', '#991b1b'],
  link: ['Link2', '#64748b', '#1e293b'],
  pdf: ['BookOpen', '#6366f1', '#3730a3'],
  image: ['Image', '#ec4899', '#9d174d'],
  gif: ['Image', '#ec4899', '#9d174d'],
  video: ['Play', '#f97316', '#9a3412'],
};

const GNOME_SRC = join(ROOT, '../../../hardware/קוד הגמדים/garden-gnome-selected.png');

function background(size, from, to) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="h" cx="0.3" cy="0.2" r="0.8">
      <stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#h)"/>
</svg>`);
}

async function lineIcon(type, iconName, from, to, size) {
  const Icon = lucide[iconName];
  if (!Icon) throw new Error(`lucide icon ${iconName} not found`);
  const glyph = Math.round(size * 0.5);
  const svg = renderToStaticMarkup(createElement(Icon, { size: glyph, color: '#ffffff', strokeWidth: 2 }));
  const glyphPng = await sharp(Buffer.from(svg)).resize(glyph, glyph).png().toBuffer();
  const off = Math.round((size - glyph) / 2);
  return sharp(background(size, from, to))
    .composite([{ input: glyphPng, left: off, top: off }])
    .png({ palette: true, quality: 95, compressionLevel: 9 })
    .toFile(join(OUT, `${type}-${size}.png`));
}

async function gnomeIcon(size) {
  // The head + hat, cut just above the white board the gnome holds; the beard runs off the
  // bottom edge like a bust.
  const head = await sharp(GNOME_SRC).extract({ left: 290, top: 20, width: 680, height: 492 }).png().toBuffer();
  const w = Math.round(size * 1.04);
  const big = await sharp(head).resize({ width: w }).png().toBuffer();
  const { height: bh } = await sharp(big).metadata();
  // Slightly wider than the icon: trim the beard's outer curls evenly so the face stays centred.
  const scaled = await sharp(big)
    .extract({ left: Math.round((w - size) / 2), top: 0, width: size, height: Math.min(bh, size) })
    .png()
    .toBuffer();
  const { height: h } = await sharp(scaled).metadata();
  return sharp(background(size, '#1e3a8a', '#0b1230'))
    .composite([{ input: scaled, left: 0, top: size - h }])
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(join(OUT, `thecode-${size}.png`));
}

mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  for (const [type, [icon, from, to]] of Object.entries(LINE_ICONS)) await lineIcon(type, icon, from, to, size);
  await gnomeIcon(size);
}
console.log(`wrote ${(Object.keys(LINE_ICONS).length + 1) * SIZES.length} icons to ${OUT}`);
