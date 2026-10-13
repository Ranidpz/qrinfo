import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const x = await loadTs('../../src/lib/qvoteXp/logic.ts');
const d = await loadTs('../../src/lib/prizeDraw.ts');

test('settings: absent or junk config means off with the editor defaults', () => {
  assert.deepEqual(x.resolveGamification(undefined), { enabled: false, xpPerVote: 10, xpForPackThreshold: 50 });
  assert.deepEqual(x.resolveGamification({ enabled: 'yes', xpPerVote: 'abc' }), { enabled: false, xpPerVote: 10, xpForPackThreshold: 50 });
  assert.deepEqual(x.resolveGamification({ enabled: true, xpPerVote: 500, xpForPackThreshold: 1 }), { enabled: true, xpPerVote: 100, xpForPackThreshold: 10 });
  assert.deepEqual(x.resolveGamification({ enabled: true, xpPerVote: 12.6, xpForPackThreshold: 75 }), { enabled: true, xpPerVote: 13, xpForPackThreshold: 75 });
});

test('a vote slot (round + category) pays XP once — vote changes cannot farm packs', () => {
  const slot = x.voteSlotKey(1, 'cat-a');
  assert.equal(slot, 'r1:cat-a');
  assert.equal(x.voteSlotKey(2, null), 'r2:_');
  assert.equal(x.voteSlotKey(undefined, ''), 'r1:_');

  const first = x.computeVoteAward({ xpPerVote: 10, votesSubmitted: 3, slotKey: slot, awardedSlots: [] });
  assert.deepEqual(first, { earned: 30, awardedSlots: ['r1:cat-a'] });

  const again = x.computeVoteAward({ xpPerVote: 10, votesSubmitted: 3, slotKey: slot, awardedSlots: first.awardedSlots });
  assert.equal(again.earned, 0);
  assert.deepEqual(again.awardedSlots, ['r1:cat-a']);

  const otherCategory = x.computeVoteAward({ xpPerVote: 10, votesSubmitted: 1, slotKey: 'r1:cat-b', awardedSlots: first.awardedSlots });
  assert.deepEqual(otherCategory, { earned: 10, awardedSlots: ['r1:cat-a', 'r1:cat-b'] });

  // All picks were duplicates → nothing new was cast → no XP, slot stays open.
  assert.deepEqual(x.computeVoteAward({ xpPerVote: 10, votesSubmitted: 0, slotKey: 'r2:_', awardedSlots: [] }), { earned: 0, awardedSlots: [] });
});

test('packs: one per threshold crossed, never negative', () => {
  assert.equal(x.packsEarned(49, 50), 0);
  assert.equal(x.packsEarned(50, 50), 1);
  assert.equal(x.packsEarned(149, 50), 2);
  assert.equal(x.packsEarned(0, 50), 0);
  assert.equal(x.packsEarned(100, 0), 0);
  assert.equal(x.packsAvailable(150, 50, 1), 2);
  assert.equal(x.packsAvailable(150, 50, 3), 0);
  assert.equal(x.packsAvailable(150, 200, 1), 0); // threshold raised after opening
  assert.deepEqual(x.packProgress(70, 50), { current: 20, needed: 50, percent: 40 });
  assert.deepEqual(x.packProgress(100, 50), { current: 0, needed: 50, percent: 0 });
});

test('voter ids: only the visitor-id shape becomes a doc id', () => {
  assert.equal(x.isValidVoterId('3f2a1b4c-1d2e-4f00-8a9b-0c1d2e3f4a5b'), true);
  assert.equal(x.isValidVoterId('abc'), false);
  assert.equal(x.isValidVoterId('../../users/x'), false);
  assert.equal(x.isValidVoterId('a/b-cdefghij'), false);
  assert.equal(x.isValidVoterId(42), false);
});

test('prize input: validated and stripped before it reaches Firestore', () => {
  const ok = x.sanitizePrizeInput({ name: ' <b>Free</b> coffee ', nameEn: 'Coffee', rarity: 'rare', dropRate: 20, totalAvailable: 5 });
  assert.deepEqual(ok, { ok: true, value: { name: 'Free coffee', nameEn: 'Coffee', rarity: 'rare', dropRate: 20, totalAvailable: 5, isActive: true } });
  assert.equal(x.sanitizePrizeInput({ name: '', rarity: 'rare', dropRate: 1, totalAvailable: 1 }).ok, false);
  assert.equal(x.sanitizePrizeInput({ name: 'a', rarity: 'mythic', dropRate: 1, totalAvailable: 1 }).ok, false);
  assert.equal(x.sanitizePrizeInput({ name: 'a', rarity: 'rare', dropRate: 101, totalAvailable: 1 }).ok, false);
  assert.equal(x.sanitizePrizeInput({ name: 'a', rarity: 'rare', dropRate: 5, totalAvailable: 1.5 }).ok, false);
  assert.equal(x.sanitizePrizeInput({ name: 'a', rarity: 'rare', dropRate: 5, totalAvailable: 3, isActive: false }).value.isActive, false);
});

test('prize draw: weighted, only in-stock active prizes, never empty while stock remains', () => {
  const prizes = [
    { id: 'a', dropRate: 70, totalAvailable: 5, claimed: 0, isActive: true },
    { id: 'b', dropRate: 30, totalAvailable: 1, claimed: 1, isActive: true }, // out of stock
    { id: 'c', dropRate: 30, totalAvailable: 9, claimed: 0, isActive: false }, // inactive
    { id: 'd', dropRate: 30, totalAvailable: 2, claimed: 1, isActive: true },
  ];
  const pool = d.drawablePrizes(prizes);
  assert.deepEqual(pool.map((p) => p.id), ['a', 'd']);
  assert.equal(d.pickWeightedPrize(pool, () => 0).id, 'a');
  assert.equal(d.pickWeightedPrize(pool, () => 0.69).id, 'a');
  assert.equal(d.pickWeightedPrize(pool, () => 0.71).id, 'd');
  assert.equal(d.pickWeightedPrize(pool, () => 0.9999999).id, 'd');
  assert.equal(d.pickWeightedPrize([], Math.random), null);
  assert.equal(d.pickWeightedPrize([{ id: 'z', dropRate: 0 }, { id: 'y', dropRate: 0 }], () => 0.5).id, 'z');

  // Distribution sanity: ~70/30 over many draws.
  let a = 0;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 10000; i++) if (d.pickWeightedPrize(pool, rand).id === 'a') a++;
  assert.ok(a > 6700 && a < 7300, `expected ~7000, got ${a}`);
});
