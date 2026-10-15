import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const r = await loadTs('../../src/lib/socialwall/rules.ts');
const t = await loadTs('../../src/types/socialwall.ts');

test('cleanText: strips bidi overrides and controls, keeps emoji and Hebrew', () => {
  assert.equal(r.cleanText('  דני‮ כהן\u0007 ', 40), 'דני כהן');
  assert.equal(r.cleanText('צוות מנצח! 😍👨‍👩‍👧', 40), 'צוות מנצח! 😍👨‍👩‍👧');
  assert.equal(r.cleanText(42, 10), '');
  assert.equal(r.cleanText('a\n\n\n\nb', 10, { multiline: true }), 'a\n\nb');
  assert.equal(r.cleanText('a\nb', 10), 'a b');
});

test('cleanText: cuts by code point, never splits an emoji', () => {
  const out = r.cleanText('ab😍😍😍', 3);
  assert.equal(out, 'ab😍');
  assert.equal(Array.from(out).length, 3);
});

test('names: length counted after cleaning', () => {
  assert.equal(r.validateName('  א ', 2, 40), null);
  assert.equal(r.validateName('‮‮', 2, 40), null);
  assert.equal(r.validateName('שירה לוי', 2, 40), 'שירה לוי');
  assert.equal(r.validateName('x'.repeat(80), 2, 40).length, 40);
});

test('groups: null without groups, undefined for an unknown id', () => {
  const groups = [{ id: 'hr', label: 'HR' }, { id: 'rnd', label: 'R&D' }];
  assert.equal(r.resolveGroup('x', []), null);
  assert.equal(r.resolveGroup('hr', groups), 'hr');
  assert.equal(r.resolveGroup('nope', groups), undefined);
  assert.equal(r.resolveGroup(undefined, groups), undefined);
});

test('ids and sessions', () => {
  assert.ok(r.isValidPostId('3f2b8c1e-9d4a-4b7e-8c2f-1a2b3c4d5e6f'));
  assert.ok(!r.isValidPostId('3F2B8C1E-9D4A-4B7E-8C2F-1A2B3C4D5E6F'));
  assert.ok(!r.isValidPostId('../../etc'));
  const id = 'a'.repeat(32);
  const tok = 'b'.repeat(48);
  assert.deepEqual(r.parseSession(`${id}.${tok}`), { memberId: id, token: tok });
  assert.equal(r.parseSession(`${id}.${tok}.x`), null);
  assert.equal(r.parseSession(`${id}.short`), null);
  assert.equal(r.parseSession(null), null);
});

test('posting pace', () => {
  const now = 1_760_000_000_000;
  assert.equal(r.postWaitMs(null, now), 0);
  assert.equal(r.postWaitMs(now - 2000, now), r.MIN_POST_GAP_MS - 2000);
  assert.equal(r.postWaitMs(now - 60_000, now), 0);
});

test('screen: manual only shows approved; auto waits for the delay; hidden/rejected never', () => {
  const now = 1_760_000_000_000;
  const auto = { screenModeration: 'auto', screenDelaySec: 60 };
  const manual = { screenModeration: 'manual', screenDelaySec: 60 };
  const fresh = { status: 'visible', screen: 'queued', visibleAt: now - 10_000 };
  const old = { status: 'visible', screen: 'queued', visibleAt: now - 61_000 };

  assert.deepEqual(r.screenEligibility(fresh, auto, now), { onScreen: false, eligibleAt: now + 50_000 });
  assert.equal(r.screenEligibility(old, auto, now).onScreen, true);
  assert.equal(r.screenEligibility({ ...fresh, screen: 'approved' }, auto, now).onScreen, true);
  assert.equal(r.screenEligibility(old, manual, now).onScreen, false);
  assert.equal(r.screenEligibility({ ...old, screen: 'approved' }, manual, now).onScreen, true);
  assert.equal(r.screenEligibility({ ...old, screen: 'rejected' }, auto, now).onScreen, false);
  assert.equal(r.screenEligibility({ ...old, status: 'hidden', screen: 'approved' }, auto, now).onScreen, false);
  assert.equal(r.screenEligibility({ ...old, status: 'deleted' }, auto, now).onScreen, false);
  assert.equal(r.screenEligibility({ status: 'pending', screen: 'queued', visibleAt: null }, auto, now).onScreen, false);
});

test('pre-moderation starts posts as pending', () => {
  assert.equal(r.initialPostStatus({ feedModeration: 'pre' }), 'pending');
  assert.equal(r.initialPostStatus({ feedModeration: 'post' }), 'visible');
});

test('group totals: likes first, removed and unknown groups ignored', () => {
  const groups = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
  const totals = r.groupTotals(
    [
      { groupId: 'a', likeCount: 3 },
      { groupId: 'b', likeCount: 10 },
      { groupId: 'b', likeCount: 2, removed: true },
      { groupId: 'zzz', likeCount: 50 },
      { groupId: null, likeCount: 50 },
      { groupId: 'a', likeCount: -4 },
    ],
    groups
  );
  assert.deepEqual(totals.map((g) => [g.id, g.likes, g.posts]), [['b', 10, 1], ['a', 3, 2]]);
});

test('cursor round-trip and junk', () => {
  const id = '3f2b8c1e-9d4a-4b7e-8c2f-1a2b3c4d5e6f';
  assert.deepEqual(r.decodeCursor(r.encodeCursor(1760000000123, id)), { createdAt: 1760000000123, id });
  assert.equal(r.decodeCursor('1_x'), null);
  assert.equal(r.decodeCursor(undefined), null);
});

test('allowlist rows: invalid phones counted, duplicates collapse, bad groups dropped', () => {
  const groups = [{ id: 'hr', label: 'HR' }];
  const norm = (raw) => (/^0?5\d{8}$/.test(raw.replace(/\D/g, '')) ? '+972' + raw.replace(/\D/g, '').replace(/^0/, '') : null);
  const { entries, rejected } = r.normalizeAllowlistRows(
    [
      { phone: '050-1234567', name: 'דני', groupId: 'hr' },
      { phone: '0501234567', name: 'דני כהן', groupId: 'nope' },
      { phone: 'abc', name: 'x' },
      { phone: 521234567, name: 'רוני' },
    ],
    norm,
    groups
  );
  assert.equal(rejected, 1);
  assert.deepEqual(entries, [
    { phone: '+972501234567', name: 'דני כהן', groupId: null },
    { phone: '+972521234567', name: 'רוני', groupId: null },
  ]);
});

test('config resolver: defaults, clamps and enum fallbacks', () => {
  const d = t.resolveSocialWallConfig(undefined);
  assert.equal(d.access, 'open');
  assert.equal(d.feedModeration, 'post');
  assert.equal(d.screenDelaySec, 60);
  const c = t.resolveSocialWallConfig({
    access: 'everyone',
    screenDelaySec: 99999,
    maxPostsPerMember: -3,
    captionMax: 5000,
    groups: [{ id: 'a', label: 'A' }, { id: '', label: 'x' }, { id: 'b', label: '  ' }, null],
    eventEndsAt: 'not a date',
  });
  assert.equal(c.access, 'open');
  assert.equal(c.screenDelaySec, 600);
  assert.equal(c.maxPostsPerMember, 1);
  assert.equal(c.captionMax, 280);
  assert.deepEqual(c.groups.map((g) => g.id), ['a']);
  assert.equal(c.eventEndsAt, null);
  assert.ok(t.accessNeedsOtp('allowlist_whatsapp') && !t.accessNeedsOtp('allowlist'));
  assert.ok(t.accessUsesAllowlist('allowlist') && !t.accessUsesAllowlist('whatsapp'));
});
