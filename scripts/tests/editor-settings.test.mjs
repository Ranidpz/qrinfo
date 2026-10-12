import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const qvote = await loadTs('../../src/types/qvote.ts');
const qhunt = await loadTs('../../src/types/qhunt.ts');

const at = (iso) => new Date(iso).getTime();

test('Q.Vote: a passed schedule time opens voting even though the stored phase is registration', () => {
  const config = {
    currentPhase: 'registration',
    schedule: { voting: '2026-10-12T18:00:00.000Z', results: '2026-10-12T20:00:00.000Z' },
  };
  assert.equal(qvote.getEffectiveQVotePhase(config, at('2026-10-12T17:59:00Z')), 'registration');
  assert.equal(qvote.getEffectiveQVotePhase(config, at('2026-10-12T18:00:00Z')), 'voting');
  assert.equal(qvote.getEffectiveQVotePhase(config, at('2026-10-12T19:30:00Z')), 'voting');
  assert.equal(qvote.getEffectiveQVotePhase(config, at('2026-10-12T21:00:00Z')), 'results');
});

test('Q.Vote: a manual phase change wins over schedule times before it, not after it', () => {
  const config = {
    currentPhase: 'voting',
    phaseChangedAt: '2026-10-12T20:30:00.000Z', // reopened voting after results were scheduled
    schedule: { voting: '2026-10-12T18:00:00.000Z', results: '2026-10-12T20:00:00.000Z', calculating: '2026-10-12T22:00:00.000Z' },
  };
  assert.equal(qvote.getEffectiveQVotePhase(config, at('2026-10-12T21:00:00Z')), 'voting');
  assert.equal(qvote.getEffectiveQVotePhase(config, at('2026-10-12T22:01:00Z')), 'calculating');
});

test('Q.Vote: no schedule / empty schedule / bad dates fall back to the stored phase', () => {
  assert.equal(qvote.getEffectiveQVotePhase({ currentPhase: 'voting' }), 'voting');
  assert.equal(qvote.getEffectiveQVotePhase({ currentPhase: 'results', schedule: {} }), 'results');
  assert.equal(qvote.getEffectiveQVotePhase({ currentPhase: 'finals', schedule: { voting: 'not a date' } }), 'finals');
  assert.equal(qvote.getScheduledQVotePhase({ schedule: {} }), null);
});

const codes = [
  { codeType: 'red', isActive: true },
  { codeType: 'red', isActive: true },
  { codeType: 'red', isActive: false },
  { codeType: 'blue', isActive: true },
];

test('Q.Hunt: target = active codes of the player colour, or the config target', () => {
  assert.equal(qhunt.getQHuntTargetCount({ enableTypeBasedHunting: true, codes, targetCodeCount: 10 }, 'red'), 2);
  assert.equal(qhunt.getQHuntTargetCount({ enableTypeBasedHunting: false, codes, targetCodeCount: 10 }, 'red'), 10);
  assert.equal(qhunt.getQHuntTargetCount({ enableTypeBasedHunting: true, codes, targetCodeCount: 10 }), 10);
});

test('Q.Hunt: codes required before the voluntary End button', () => {
  const base = { enableTypeBasedHunting: false, codes, targetCodeCount: 10, requireAllCodesToFinish: false, minCodesToFinish: 0 };
  assert.equal(qhunt.getQHuntCodesRequiredToEnd(base), 0); // default: end any time
  assert.equal(qhunt.getQHuntCodesRequiredToEnd({ ...base, minCodesToFinish: 4 }), 4);
  assert.equal(qhunt.getQHuntCodesRequiredToEnd({ ...base, minCodesToFinish: 40 }), 10); // never more than exist
  assert.equal(qhunt.getQHuntCodesRequiredToEnd({ ...base, requireAllCodesToFinish: true, minCodesToFinish: 3 }), 10);
  assert.equal(qhunt.getQHuntCodesRequiredToEnd({ ...base, enableTypeBasedHunting: true, requireAllCodesToFinish: true }, 'red'), 2);
});
