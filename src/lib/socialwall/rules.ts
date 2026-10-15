// Social Wall — pure rules shared by the API routes, the phone and the big screen.
// No Firebase / Node imports: covered by scripts/tests/socialwall-rules.test.mjs.

import type { ResolvedSocialWallConfig, SocialWallGroup } from '@/types/socialwall';

export const MIN_POST_GAP_MS = 8000;
export const SESSION_LIMIT = 3; // devices signed in per member (phone + tablet + a re-install)
export const LIKED_CAP = 5000; // likedPosts kept on a member doc (~1MB doc limit is far away)
export const FEED_PAGE = 24;
export const SCREEN_LIMIT = 1500;
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

// Bidi overrides/isolates can make a name render reversed or hide text on the wall;
// C0/C1 controls break layouts. ZWJ/ZWNJ stay (emoji sequences, Hebrew/Arabic shaping).
const STRIP = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‎‏‪-‮⁠⁦-⁩﻿]/g;

/** Plain text only — rendered as text, never HTML. Cuts by code point so emoji are never split. */
export function cleanText(raw: unknown, max: number, { multiline = false } = {}): string {
  if (typeof raw !== 'string') return '';
  let s = raw.normalize('NFC').replace(STRIP, '');
  s = multiline
    ? s.replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : s.replace(/\s+/g, ' ');
  s = s.trim();
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max).join('').trim() : s;
}

export function validateName(raw: unknown, min: number, max: number): string | null {
  const name = cleanText(raw, max);
  return Array.from(name).length >= min ? name : null;
}

/** The chosen group, null when the event has no groups, undefined when the choice is invalid. */
export function resolveGroup(groupId: unknown, groups: SocialWallGroup[]): string | null | undefined {
  if (groups.length === 0) return null;
  if (typeof groupId !== 'string') return undefined;
  return groups.some((g) => g.id === groupId) ? groupId : undefined;
}

export const isValidPostId = (id: unknown): id is string =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);

export const isValidMemberId = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);

export const isValidSessionToken = (t: unknown): t is string => typeof t === 'string' && /^[a-f0-9]{48}$/.test(t);

/** "memberId.token" from the x-sw-session header. */
export function parseSession(header: string | null): { memberId: string; token: string } | null {
  if (!header) return null;
  const [memberId, token, extra] = header.split('.');
  if (extra !== undefined || !isValidMemberId(memberId) || !isValidSessionToken(token)) return null;
  return { memberId, token };
}

/** ms until this member may post again (0 = now). */
export function postWaitMs(lastPostAt: number | null | undefined, now: number): number {
  if (!lastPostAt) return 0;
  return Math.max(0, lastPostAt + MIN_POST_GAP_MS - now);
}

/** 'deleted' = tombstone (content and files gone) so deltas can tell phones to drop it. */
export type PostStatus = 'visible' | 'pending' | 'hidden' | 'deleted';
export type ScreenDecision = 'queued' | 'approved' | 'rejected';

export const initialPostStatus = (config: Pick<ResolvedSocialWallConfig, 'feedModeration'>): PostStatus =>
  config.feedModeration === 'pre' ? 'pending' : 'visible';

/**
 * Is a post on the big screen now, and when does it go up?
 * - only feed-visible posts; an operator's "not on screen" always wins;
 * - manual: only posts an operator approved for the screen;
 * - auto: approved posts at once, the rest screenDelaySec after they became visible
 *   (the operators' window to catch something before it is on the wall).
 */
export function screenEligibility(
  post: { status: PostStatus; screen: ScreenDecision; visibleAt: number | null },
  config: Pick<ResolvedSocialWallConfig, 'screenModeration' | 'screenDelaySec'>,
  now: number
): { onScreen: boolean; eligibleAt: number } {
  const never = { onScreen: false, eligibleAt: 0 };
  if (post.status !== 'visible' || post.screen === 'rejected' || !post.visibleAt) return never;
  if (post.screen === 'approved') return { onScreen: true, eligibleAt: post.visibleAt };
  if (config.screenModeration === 'manual') return never;
  const eligibleAt = post.visibleAt + config.screenDelaySec * 1000;
  return { onScreen: now >= eligibleAt, eligibleAt };
}

/** Group leaderboard for the wall: likes + posts per group, most likes first. */
export function groupTotals(
  posts: { groupId: string | null; likeCount: number; removed?: boolean }[],
  groups: SocialWallGroup[]
): { id: string; label: string; color?: string; likes: number; posts: number }[] {
  const totals = new Map(groups.map((g) => [g.id, { ...g, likes: 0, posts: 0 }]));
  for (const p of posts) {
    if (p.removed || !p.groupId) continue;
    const t = totals.get(p.groupId);
    if (!t) continue;
    t.likes += Math.max(0, p.likeCount || 0);
    t.posts += 1;
  }
  return [...totals.values()].sort((a, b) => b.likes - a.likes || b.posts - a.posts);
}

/** Feed cursor: "createdAtMs_postId" — stable even when two posts share a millisecond. */
export function encodeCursor(createdAt: number, id: string): string {
  return `${createdAt}_${id}`;
}

export function decodeCursor(cursor: unknown): { createdAt: number; id: string } | null {
  if (typeof cursor !== 'string') return null;
  const m = cursor.match(/^(\d{10,16})_([0-9a-f-]{36})$/);
  return m ? { createdAt: Number(m[1]), id: m[2] } : null;
}

/** Allowlist rows from a pasted/parsed sheet: keeps valid phones, last row wins on duplicates. */
export function normalizeAllowlistRows(
  rows: { phone?: unknown; name?: unknown; groupId?: unknown }[],
  normalizePhone: (raw: string) => string | null,
  groups: SocialWallGroup[]
): { entries: { phone: string; name: string; groupId: string | null }[]; rejected: number } {
  const byPhone = new Map<string, { phone: string; name: string; groupId: string | null }>();
  let rejected = 0;
  for (const row of rows) {
    const phone = typeof row.phone === 'string' || typeof row.phone === 'number' ? normalizePhone(String(row.phone)) : null;
    if (!phone) {
      rejected++;
      continue;
    }
    const group = resolveGroup(row.groupId, groups);
    byPhone.set(phone, { phone, name: cleanText(row.name, 60), groupId: group ?? null });
  }
  return { entries: [...byPhone.values()], rejected };
}
