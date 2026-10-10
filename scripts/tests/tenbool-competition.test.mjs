import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const c = await loadTs('../../src/lib/tenbool/competition.ts');

test('judging matches the on-screen stopwatch (truncated hundredths)', () => {
  assert.equal(c.diffFromTarget(10000), 0);
  assert.equal(c.diffFromTarget(10009.99), 0); // still shows 10.00
  assert.equal(c.diffFromTarget(10010), 1);
  assert.equal(c.diffFromTarget(9999.9), -1); // shows 09.99
  assert.equal(c.formatTime(9987), '09.98');
  assert.equal(c.formatDiff(-3), '-0.03');
  assert.equal(c.formatDiff(12), '+0.12');
});

test('timing check: a claim cannot exceed the real time that passed', () => {
  assert.equal(c.judgeTiming(10000, 10200), 'ok'); // normal
  assert.equal(c.judgeTiming(10000, 8500), 'ok'); // slow start request - within slack
  assert.equal(c.judgeTiming(10000, 7000), 'too-fast'); // claimed 10s after 7s
  assert.equal(c.judgeTiming(10000, 400), 'too-fast'); // scripted instant win
  assert.equal(c.judgeTiming(10000, 10000 + 130000), 'stale');
  assert.equal(c.judgeTiming(-1, 1000), 'bad-ms');
  assert.equal(c.judgeTiming(25000, 30000), 'bad-ms');
  assert.equal(c.judgeTiming('10000', 10000), 'bad-ms');
  assert.equal(c.judgeTiming(NaN, 10000), 'bad-ms');
});

test('winners: fewer attempts first, then first to hit', () => {
  const t = 1760000000000;
  const a = c.winRank(2, t + 5000);
  const b = c.winRank(3, t);
  const d = c.winRank(2, t + 1);
  assert.ok(d < a && a < b);
  assert.ok(Number.isSafeInteger(c.winRank(5000, t)));
  assert.ok(c.winRank(5000, t) > c.winRank(899, t));
});

test('lists: hit only after claim, closest only inside the last second, hidden off both', () => {
  const t = 1760000000000;
  const base = { won: false, claimed: false, hidden: false, wonAttempts: null, wonAt: null, bestAbsDiff: null, bestAt: null };
  assert.deepEqual(c.rankFields(base), { winRank: null, nearRank: null });
  assert.notEqual(c.rankFields({ ...base, bestAbsDiff: 99, bestAt: t }).nearRank, null); // 9.01 / 10.99
  assert.equal(c.rankFields({ ...base, bestAbsDiff: 100, bestAt: t }).nearRank, null); // 9.00 is out
  const won = { ...base, won: true, wonAttempts: 4, wonAt: t, bestAbsDiff: 0, bestAt: t };
  assert.deepEqual(c.rankFields(won), { winRank: null, nearRank: null }); // not claimed yet
  assert.equal(c.rankFields({ ...won, claimed: true }).winRank, c.winRank(4, t));
  assert.equal(c.rankFields({ ...won, claimed: true }).nearRank, null);
  assert.deepEqual(c.rankFields({ ...won, claimed: true, hidden: true }), { winRank: null, nearRank: null });
  assert.deepEqual(c.rankFields({ ...base, bestAbsDiff: 5, bestAt: t, hidden: true }), { winRank: null, nearRank: null });
  // closer beats earlier
  assert.ok(c.nearRank(3, t + 9999) < c.nearRank(4, t));
});

test('nicknames are cleaned for a public screen', () => {
  assert.equal(c.cleanNickname('  דנה   כהן '), 'דנה כהן');
  assert.equal(c.cleanNickname('a'), null);
  assert.equal(c.cleanNickname(42), null);
  assert.equal(c.cleanNickname('‮evil‬'), 'evil');
  assert.equal(Array.from(c.cleanNickname('א'.repeat(50))).length, c.NICKNAME_MAX);
  assert.match(c.randomNickname(() => 0.5), /^\S+ \S+/);
});
