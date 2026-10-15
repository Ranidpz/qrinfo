// Social Wall store — FIRESTORE + RTDB through the Admin SDK only (server-side).
//
//   codes/{id}/swMembers/{memberId}    participants (phone, OTP state, session hashes, likes)
//   codes/{id}/swPosts/{postId}        posts; postId is the phone-made UUID, so a retried upload
//                                      can never create a second post
//   codes/{id}/swAllowlist/{digits}    the HR list (allowlist access modes)
//   codes/{id}/swAudit/{auto}          every operator action (who hid what, when)
//   RTDB socialwall/{codeId}           { rev, control } — public read, server write. `rev` is a
//                                      bare counter the phones and the wall listen to, then pull
//                                      the delta from the API; no content ever goes through RTDB.
//
// All four subcollections are `allow read, write: if false` in firestore.rules. Timestamps are
// server-clock milliseconds (one clock for ordering, cursors and the screen delay).
//
// NO composite indexes (nothing to forget on deploy, same idea as 10 בול's rank fields): a post is
// in the feed exactly when the numeric `feedAt` exists, and in its department's feed exactly when
// `gfeed.<groupId>` exists — both are single-field orderBys Firestore indexes on its own. Every
// status change goes through feedFields(); other lists filter one equality field and sort in memory.

import crypto from 'crypto';
import { AggregateField, FieldPath, FieldValue } from 'firebase-admin/firestore';
import { ServerValue } from 'firebase-admin/database';
import { getAdminDb, getAdminRtdb } from '@/lib/firebase-admin';
import {
  resolveSocialWallConfig,
  DEFAULT_SOCIALWALL_CONTROL,
  type ResolvedSocialWallConfig,
  type SocialWallConfig,
  type SocialWallControl,
  type SocialWallPostView,
  type SocialWallScreenPost,
  type SocialWallScreenState,
} from '@/types/socialwall';
import {
  FEED_PAGE,
  LIKED_CAP,
  SCREEN_LIMIT,
  SESSION_LIMIT,
  initialPostStatus,
  parseSession,
  postWaitMs,
  screenEligibility,
  type PostStatus,
  type ScreenDecision,
} from './rules';

export class SocialWallError extends Error {
  constructor(public code: string, public status = 400, public extra?: Record<string, unknown>) {
    super(code);
  }
}

export interface MemberDoc {
  name: string;
  groupId: string | null;
  status: 'active' | 'pending' | 'blocked';
  sessionHashes: string[];
  phone: string | null;
  otpHash: string | null;
  otpExpiresAt: number | null;
  otpAttempts: number;
  otpLastSentAt: number | null;
  postCount: number;
  lastPostAt: number | null;
  likedPosts: string[];
  createdAt: number;
  lastSeenAt: number;
}

export interface PostDoc {
  memberId: string;
  authorName: string;
  groupId: string | null;
  caption: string;
  fullUrl: string;
  cardUrl: string;
  storageUrls: string[];
  bytes: number;
  width: number;
  height: number;
  status: PostStatus;
  screen: ScreenDecision;
  visibleAt: number | null;
  likeCount: number;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  moderatedBy?: string;
  moderatedAt?: number;
}

export interface AllowlistEntry {
  phone: string;
  name: string;
  groupId: string | null;
}

export interface LoadedSocialWall {
  codeId: string;
  mediaId: string;
  ownerId: string;
  shortId: string;
  title: string;
  config: ResolvedSocialWallConfig;
  /** The raw media item (for resolveMediaSecret). */
  media: Record<string, unknown> & { id?: string };
}

const db = () => getAdminDb();
const codeRef = (codeId: string) => db().collection('codes').doc(codeId);
const membersCol = (codeId: string) => codeRef(codeId).collection('swMembers');
const postsCol = (codeId: string) => codeRef(codeId).collection('swPosts');
const allowCol = (codeId: string) => codeRef(codeId).collection('swAllowlist');
const auditCol = (codeId: string) => codeRef(codeId).collection('swAudit');
const rtdbRef = (codeId: string, path = '') => getAdminRtdb().ref(`socialwall/${codeId}${path ? `/${path}` : ''}`);

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
export const newSessionToken = () => crypto.randomBytes(24).toString('hex');
const newMemberId = () => crypto.randomBytes(16).toString('hex');
const phoneDigits = (phone: string) => phone.replace(/\D/g, '');
/** Phone modes: one member per phone per event, so the doc id is derived from both. */
export const phoneMemberId = (codeId: string, phone: string) =>
  crypto.createHash('sha256').update(`sw:${codeId}:${phoneDigits(phone)}`).digest('hex').slice(0, 32);

/** The feed-membership fields for a post in `status` (see header). `remove` = delete them. */
function feedFields(status: PostStatus, createdAt: number, groupId: string | null, remove: boolean) {
  if (status === 'visible') {
    return { feedAt: createdAt, gfeed: groupId ? { [groupId]: createdAt } : {} };
  }
  return remove ? { feedAt: FieldValue.delete(), gfeed: FieldValue.delete() } : {};
}

export function isValidCodeId(codeId: unknown): codeId is string {
  return typeof codeId === 'string' && /^[a-zA-Z0-9]{10,30}$/.test(codeId);
}

// ---------------------------------------------------------------- code

export async function loadSocialWall(codeId: string): Promise<LoadedSocialWall> {
  const doc = await codeRef(codeId).get();
  if (!doc.exists) throw new SocialWallError('NOT_FOUND', 404);
  const data = doc.data()!;
  const media = (data.media || []).find((m: { type?: string }) => m.type === 'socialwall');
  if (!media) throw new SocialWallError('NOT_FOUND', 404);
  return {
    codeId,
    mediaId: media.id as string,
    ownerId: data.ownerId as string,
    shortId: data.shortId as string,
    title: (data.title as string) || '',
    config: resolveSocialWallConfig(media.socialWallConfig as SocialWallConfig | undefined),
    media,
  };
}

// ---------------------------------------------------------------- control + pulse

export async function getControl(codeId: string): Promise<SocialWallControl> {
  const snap = await rtdbRef(codeId).once('value');
  const v = (snap.val() || {}) as { rev?: number; control?: Partial<SocialWallControl> };
  return {
    rev: typeof v.rev === 'number' ? v.rev : 0,
    screen: (['live', 'frozen', 'slate'] as const).includes(v.control?.screen as SocialWallScreenState)
      ? (v.control!.screen as SocialWallScreenState)
      : DEFAULT_SOCIALWALL_CONTROL.screen,
    uploads: v.control?.uploads !== false,
  };
}

export async function setControl(codeId: string, patch: { screen?: SocialWallScreenState; uploads?: boolean }) {
  const update: Record<string, unknown> = { 'control/at': ServerValue.TIMESTAMP };
  if (patch.screen) update['control/screen'] = patch.screen;
  if (typeof patch.uploads === 'boolean') update['control/uploads'] = patch.uploads;
  await rtdbRef(codeId).update(update);
}

/** Tell every phone and the wall that something changed. Never fails the caller's write. */
export async function bumpRev(codeId: string): Promise<void> {
  try {
    await rtdbRef(codeId, 'rev').set(ServerValue.increment(1));
  } catch (error) {
    console.error('[socialwall] rev bump failed:', error);
  }
}

export async function recordScreenBeat(codeId: string): Promise<void> {
  await rtdbRef(codeId, 'beat').set(ServerValue.TIMESTAMP);
}

export async function audit(
  codeId: string,
  entry: { action: string; actor: string; postId?: string; memberId?: string; detail?: string }
): Promise<void> {
  try {
    await auditCol(codeId).add({ ...entry, at: Date.now() });
  } catch (error) {
    console.error('[socialwall] audit write failed:', error);
  }
}

// ---------------------------------------------------------------- members

function toMember(data: FirebaseFirestore.DocumentData): MemberDoc {
  return {
    name: data.name || '',
    groupId: data.groupId ?? null,
    status: data.status === 'blocked' ? 'blocked' : data.status === 'pending' ? 'pending' : 'active',
    sessionHashes: Array.isArray(data.sessionHashes) ? data.sessionHashes : [],
    phone: data.phone ?? null,
    otpHash: data.otpHash ?? null,
    otpExpiresAt: data.otpExpiresAt ?? null,
    otpAttempts: data.otpAttempts || 0,
    otpLastSentAt: data.otpLastSentAt ?? null,
    postCount: data.postCount || 0,
    lastPostAt: data.lastPostAt ?? null,
    likedPosts: Array.isArray(data.likedPosts) ? data.likedPosts : [],
    createdAt: data.createdAt || 0,
    lastSeenAt: data.lastSeenAt || 0,
  };
}

function sessionMatches(member: MemberDoc, token: string): boolean {
  const b = Buffer.from(hashToken(token), 'hex');
  return member.sessionHashes.some((h) => {
    const a = Buffer.from(h, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

/** The member behind the x-sw-session header. 401 when missing/stale, 403 when blocked. */
export async function getAuthedMember(codeId: string, header: string | null) {
  const session = parseSession(header);
  if (!session) throw new SocialWallError('UNAUTHORIZED', 401);
  const ref = membersCol(codeId).doc(session.memberId);
  const snap = await ref.get();
  if (!snap.exists) throw new SocialWallError('UNAUTHORIZED', 401);
  const member = toMember(snap.data()!);
  if (!sessionMatches(member, session.token)) throw new SocialWallError('UNAUTHORIZED', 401);
  if (member.status === 'blocked') throw new SocialWallError('BLOCKED', 403);
  if (member.status !== 'active') throw new SocialWallError('UNAUTHORIZED', 401);
  return { ref, memberId: session.memberId, member };
}

async function assertRoom(codeId: string, maxMembers: number) {
  const count = (await membersCol(codeId).count().get()).data().count;
  if (count >= maxMembers) throw new SocialWallError('EVENT_FULL', 409);
}

const nextHashes = (existing: string[], token: string) => [...existing.slice(-(SESSION_LIMIT - 1)), hashToken(token)];

/** Open access: a fresh member per join (a new device = a new member). */
export async function joinOpen(codeId: string, name: string, groupId: string | null, maxMembers: number) {
  await assertRoom(codeId, maxMembers);
  const memberId = newMemberId();
  const token = newSessionToken();
  const now = Date.now();
  await membersCol(codeId).doc(memberId).create({
    name,
    groupId,
    status: 'active',
    sessionHashes: [hashToken(token)],
    phone: null,
    postCount: 0,
    lastPostAt: null,
    likedPosts: [],
    createdAt: now,
    lastSeenAt: now,
  });
  return { memberId, token, name, groupId };
}

export async function getAllowlistEntry(codeId: string, phone: string): Promise<AllowlistEntry | null> {
  const snap = await allowCol(codeId).doc(phoneDigits(phone)).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return { phone: d.phone, name: d.name || '', groupId: d.groupId ?? null };
}

export async function getPhoneMember(codeId: string, phone: string) {
  const ref = membersCol(codeId).doc(phoneMemberId(codeId, phone));
  const snap = await ref.get();
  return { ref, member: snap.exists ? toMember(snap.data()!) : null };
}

/** Phone access without OTP (allowlist only) or right after a verified OTP: sign the member in. */
export async function activatePhoneMember(
  codeId: string,
  phone: string,
  name: string,
  groupId: string | null,
  maxMembers: number
) {
  const { ref, member } = await getPhoneMember(codeId, phone);
  if (member?.status === 'blocked') throw new SocialWallError('BLOCKED', 403);
  if (!member) await assertRoom(codeId, maxMembers);
  const token = newSessionToken();
  const now = Date.now();
  await ref.set(
    {
      name,
      groupId,
      phone,
      status: 'active',
      sessionHashes: nextHashes(member?.sessionHashes || [], token),
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      lastSeenAt: now,
      ...(member ? {} : { postCount: 0, lastPostAt: null, likedPosts: [], createdAt: now }),
    },
    { merge: true }
  );
  return { memberId: ref.id, token, name, groupId };
}

/** Phone + WhatsApp: park the OTP on the (possibly new, still 'pending') member doc. */
export async function saveMemberOtp(
  codeId: string,
  phone: string,
  otpHash: string,
  expiresAt: number,
  maxMembers: number
) {
  const { ref, member } = await getPhoneMember(codeId, phone);
  if (member?.status === 'blocked') throw new SocialWallError('BLOCKED', 403);
  if (!member) await assertRoom(codeId, maxMembers);
  const now = Date.now();
  await ref.set(
    {
      phone,
      otpHash,
      otpExpiresAt: expiresAt,
      otpAttempts: 0,
      otpLastSentAt: now,
      ...(member
        ? {}
        : { name: '', groupId: null, status: 'pending', sessionHashes: [], postCount: 0, lastPostAt: null, likedPosts: [], createdAt: now, lastSeenAt: now }),
    },
    { merge: true }
  );
}

export async function bumpOtpAttempts(codeId: string, phone: string, attempts: number) {
  await membersCol(codeId).doc(phoneMemberId(codeId, phone)).update({ otpAttempts: attempts });
}

// ---------------------------------------------------------------- posts

function toPost(data: FirebaseFirestore.DocumentData): PostDoc {
  return data as PostDoc;
}

export function toFeedView(id: string, p: PostDoc, me?: { memberId: string; liked: Set<string> }): SocialWallPostView {
  const mine = !!me && p.memberId === me.memberId;
  return {
    id,
    authorName: p.authorName,
    groupId: p.groupId,
    caption: p.caption,
    fullUrl: p.fullUrl,
    cardUrl: p.cardUrl,
    width: p.width,
    height: p.height,
    likeCount: Math.max(0, p.likeCount || 0),
    likedByMe: me ? me.liked.has(id) : undefined,
    mine: mine || undefined,
    status: mine && (p.status === 'pending' || p.status === 'hidden') ? p.status : undefined,
    createdAt: p.createdAt,
  };
}

/** Cheap checks before spending the upload; createPost re-checks inside the transaction. */
export function assertCanPost(member: MemberDoc, config: ResolvedSocialWallConfig, now: number) {
  if (member.postCount >= config.maxPostsPerMember) throw new SocialWallError('POST_LIMIT', 429);
  const wait = postWaitMs(member.lastPostAt, now);
  if (wait > 0) throw new SocialWallError('TOO_FAST', 429, { retryAfterMs: wait });
}

export async function getPost(codeId: string, postId: string) {
  const snap = await postsCol(codeId).doc(postId).get();
  return snap.exists ? toPost(snap.data()!) : null;
}

/**
 * Create the post doc. Idempotent on postId: a retry of an upload that already landed returns the
 * existing post ('existing'), and the caller deletes the just-uploaded duplicate files.
 */
export async function createPost(params: {
  codeId: string;
  postId: string;
  memberId: string;
  config: ResolvedSocialWallConfig;
  caption: string;
  fullUrl: string;
  cardUrl: string;
  storageUrls: string[];
  bytes: number;
  width: number;
  height: number;
}): Promise<{ result: 'created' | 'existing'; post: PostDoc }> {
  const memberRef = membersCol(params.codeId).doc(params.memberId);
  const postRef = postsCol(params.codeId).doc(params.postId);
  return db().runTransaction(async (tx) => {
    const [memberSnap, postSnap] = await Promise.all([tx.get(memberRef), tx.get(postRef)]);
    if (postSnap.exists) {
      const existing = toPost(postSnap.data()!);
      if (existing.memberId !== params.memberId || existing.status === 'deleted') throw new SocialWallError('CONFLICT', 409);
      return { result: 'existing' as const, post: existing };
    }
    if (!memberSnap.exists) throw new SocialWallError('UNAUTHORIZED', 401);
    const member = toMember(memberSnap.data()!);
    if (member.status !== 'active') throw new SocialWallError('BLOCKED', 403);
    const now = Date.now();
    assertCanPost(member, params.config, now);
    const status = initialPostStatus(params.config);
    const post: PostDoc = {
      memberId: params.memberId,
      authorName: member.name,
      groupId: member.groupId,
      caption: params.caption,
      fullUrl: params.fullUrl,
      cardUrl: params.cardUrl,
      storageUrls: params.storageUrls,
      bytes: params.bytes,
      width: params.width,
      height: params.height,
      status,
      screen: 'queued',
      visibleAt: status === 'visible' ? now : null,
      likeCount: 0,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    tx.create(postRef, { ...post, ...feedFields(status, now, member.groupId, false) });
    tx.update(memberRef, { postCount: FieldValue.increment(1), lastPostAt: now, lastSeenAt: now });
    return { result: 'created' as const, post };
  });
}

/**
 * Delete a post: the files go (caller), the doc stays as a tombstone with no content so the
 * feed/screen deltas (updatedAt > since) tell every phone to drop it. Returns the post as it was.
 */
export async function deletePostDoc(codeId: string, postId: string, actor: string): Promise<PostDoc | null> {
  const ref = postsCol(codeId).doc(postId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const post = toPost(snap.data()!);
    if (post.status === 'deleted') return null;
    const now = Date.now();
    tx.update(ref, {
      status: 'deleted',
      caption: '',
      fullUrl: '',
      cardUrl: '',
      storageUrls: [],
      bytes: 0,
      pinned: false,
      updatedAt: now,
      moderatedBy: actor,
      moderatedAt: now,
      ...feedFields('deleted', post.createdAt, post.groupId, true),
    });
    return post;
  });
}

/**
 * Like / unlike. The member doc holds the liked ids (one read we already pay for auth, and it
 * makes "liked by me" free on every feed page). Only the member doc is read in the transaction;
 * the post gets a blind increment, so a popular post never serialises everyone's likes on a read.
 */
export async function setLike(codeId: string, memberId: string, postId: string, on: boolean) {
  const post = await getPost(codeId, postId);
  if (!post || post.status !== 'visible') throw new SocialWallError('NOT_FOUND', 404);
  const memberRef = membersCol(codeId).doc(memberId);
  const postRef = postsCol(codeId).doc(postId);
  const changed = await db().runTransaction(async (tx) => {
    const snap = await tx.get(memberRef);
    if (!snap.exists) throw new SocialWallError('UNAUTHORIZED', 401);
    const liked = toMember(snap.data()!).likedPosts;
    const has = liked.includes(postId);
    if (has === on) return false;
    if (on && liked.length >= LIKED_CAP) throw new SocialWallError('LIKE_LIMIT', 429);
    tx.update(memberRef, { likedPosts: on ? FieldValue.arrayUnion(postId) : FieldValue.arrayRemove(postId) });
    tx.update(postRef, { likeCount: FieldValue.increment(on ? 1 : -1), updatedAt: Date.now() });
    return true;
  });
  return { changed, likeCount: Math.max(0, post.likeCount + (changed ? (on ? 1 : -1) : 0)) };
}

/** Cursor = the last post of the previous page. Its snapshot carries the implicit __name__
 *  tie-break; if it has since left the feed, fall back to its timestamp. */
async function cursorStart(codeId: string, cursor: { createdAt: number; id: string }, field: string | FieldPath) {
  const snap = await postsCol(codeId).doc(cursor.id).get();
  return snap.exists && snap.get(field) !== undefined ? snap : cursor.createdAt;
}

export async function listFeed(
  codeId: string,
  opts: { groupId?: string | null; cursor?: { createdAt: number; id: string } | null; limit?: number }
) {
  const field = opts.groupId ? new FieldPath('gfeed', opts.groupId) : 'feedAt';
  let q = postsCol(codeId).orderBy(field, 'desc');
  if (opts.cursor) q = q.startAfter(await cursorStart(codeId, opts.cursor, field));
  const snap = await q.limit(opts.limit || FEED_PAGE).get();
  return snap.docs.map((d) => ({ id: d.id, post: toPost(d.data()) })).filter(({ post }) => post.status === 'visible');
}

export async function listMine(codeId: string, memberId: string, limit = 60) {
  const snap = await postsCol(codeId).where('memberId', '==', memberId).get();
  return snap.docs
    .map((d) => ({ id: d.id, post: toPost(d.data()) }))
    .sort((a, b) => b.post.createdAt - a.post.createdAt)
    .slice(0, limit);
}

/** Everything that changed after `since` (any status) — callers decide what a viewer may see. */
export async function listChangedSince(codeId: string, since: number, limit = 300) {
  const snap = await postsCol(codeId).where('updatedAt', '>', since).orderBy('updatedAt').limit(limit).get();
  return { items: snap.docs.map((d) => ({ id: d.id, post: toPost(d.data()) })), truncated: snap.size >= limit };
}

export function toScreenPost(
  id: string,
  p: PostDoc,
  config: ResolvedSocialWallConfig,
  now: number
): SocialWallScreenPost {
  const { onScreen, eligibleAt } = screenEligibility(p, config, now);
  return {
    id,
    authorName: p.authorName,
    groupId: p.groupId,
    caption: p.caption,
    fullUrl: p.fullUrl,
    cardUrl: p.cardUrl,
    width: p.width,
    height: p.height,
    likeCount: Math.max(0, p.likeCount || 0),
    pinned: !!p.pinned,
    createdAt: p.createdAt,
    onScreen,
    eligibleAt,
    removed: p.status !== 'visible' || undefined,
  };
}

export async function listScreen(codeId: string) {
  const snap = await postsCol(codeId).orderBy('feedAt', 'desc').limit(SCREEN_LIMIT).get();
  return snap.docs.map((d) => ({ id: d.id, post: toPost(d.data()) })).filter(({ post }) => post.status === 'visible');
}

// ---------------------------------------------------------------- department stats

/**
 * Photos + likes per department over the whole event (the feed's "hottest department" card and,
 * later, the wall). One aggregate per group on its index-free `gfeed.<groupId>` field — billed
 * per 1000 index entries, so it stays cheap; the route caches it for a few seconds per code.
 */
export async function groupStats(codeId: string, groups: { id: string }[]) {
  return Promise.all(
    groups.map(async (g) => {
      const snap = await postsCol(codeId)
        .where(new FieldPath('gfeed', g.id), '>=', 0)
        .aggregate({ posts: AggregateField.count(), likes: AggregateField.sum('likeCount') })
        .get();
      const d = snap.data();
      return { id: g.id, posts: d.posts || 0, likes: Math.max(0, d.likes || 0) };
    })
  );
}

// ---------------------------------------------------------------- moderation (operators)

export type ModerationFilter = 'all' | 'pending' | 'hidden';

export async function listForModeration(
  codeId: string,
  filter: ModerationFilter,
  cursor: { createdAt: number; id: string } | null,
  limit = 40
) {
  if (filter !== 'all') {
    // Pending / hidden queues are short: one equality query, newest first in memory, no paging.
    const snap = await postsCol(codeId).where('status', '==', filter).limit(500).get();
    return snap.docs
      .map((d) => ({ id: d.id, post: toPost(d.data()) }))
      .sort((a, b) => b.post.createdAt - a.post.createdAt);
  }
  let q = postsCol(codeId).orderBy('createdAt', 'desc');
  if (cursor) q = q.startAfter(await cursorStart(codeId, cursor, 'createdAt'));
  const snap = await q.limit(limit).get();
  // Tombstones are dropped here, so a page can come back a little short — the cursor still moves on.
  return snap.docs.map((d) => ({ id: d.id, post: toPost(d.data()) }));
}

export type PostAction = 'approve' | 'hide' | 'show' | 'screen_approve' | 'screen_reject' | 'pin' | 'unpin';

export async function moderatePost(codeId: string, postId: string, action: PostAction, actor: string) {
  const ref = postsCol(codeId).doc(postId);
  const now = Date.now();
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new SocialWallError('NOT_FOUND', 404);
    const p = toPost(snap.data()!);
    if (p.status === 'deleted') throw new SocialWallError('NOT_FOUND', 404);
    const patch: Partial<PostDoc> = { updatedAt: now, moderatedBy: actor, moderatedAt: now };
    switch (action) {
      case 'approve': // pre-moderation: into the feed and straight onto the wall
        patch.status = 'visible';
        patch.visibleAt = p.visibleAt || now;
        if (p.screen === 'queued') patch.screen = 'approved';
        break;
      case 'show':
        patch.status = 'visible';
        patch.visibleAt = p.visibleAt || now;
        break;
      case 'hide':
        patch.status = 'hidden';
        patch.pinned = false;
        break;
      case 'screen_approve':
        patch.screen = 'approved';
        if (p.status === 'pending') {
          patch.status = 'visible';
          patch.visibleAt = now;
        }
        break;
      case 'screen_reject':
        patch.screen = 'rejected';
        patch.pinned = false;
        break;
      case 'pin':
        if (p.status !== 'visible') throw new SocialWallError('NOT_VISIBLE', 409);
        patch.pinned = true;
        patch.screen = 'approved';
        break;
      case 'unpin':
        patch.pinned = false;
        break;
    }
    const nextStatus = patch.status ?? p.status;
    const feed = nextStatus !== p.status ? feedFields(nextStatus, p.createdAt, p.groupId, true) : {};
    tx.update(ref, { ...patch, ...feed });
  });
  await audit(codeId, { action: `post:${action}`, actor, postId });
  await bumpRev(codeId);
}

/** Block: sign the member out everywhere, keep them out, hide every post they made. */
export async function blockMember(codeId: string, memberId: string, actor: string): Promise<number> {
  const ref = membersCol(codeId).doc(memberId);
  const snap = await ref.get();
  if (!snap.exists) throw new SocialWallError('NOT_FOUND', 404);
  await ref.update({ status: 'blocked', sessionHashes: [] });
  const all = await postsCol(codeId).where('memberId', '==', memberId).get();
  const docs = all.docs.filter((d) => ['visible', 'pending'].includes(d.get('status')));
  const now = Date.now();
  for (let i = 0; i < docs.length; i += 450) {
    const batch = db().batch();
    docs.slice(i, i + 450).forEach((d) =>
      batch.update(d.ref, {
        status: 'hidden', pinned: false, updatedAt: now, moderatedBy: actor, moderatedAt: now,
        ...feedFields('hidden', 0, null, true),
      })
    );
    await batch.commit();
  }
  await audit(codeId, { action: 'member:block', actor, memberId, detail: `${docs.length} posts hidden` });
  await bumpRev(codeId);
  return docs.length;
}

export async function unblockMember(codeId: string, memberId: string, actor: string) {
  const ref = membersCol(codeId).doc(memberId);
  const snap = await ref.get();
  if (!snap.exists) throw new SocialWallError('NOT_FOUND', 404);
  // A phone member signs in again with their phone; an open member gets back in on a new join.
  await ref.update({ status: 'active' });
  await audit(codeId, { action: 'member:unblock', actor, memberId });
}

export async function getMemberPublic(codeId: string, memberId: string) {
  const snap = await membersCol(codeId).doc(memberId).get();
  return snap.exists ? toMember(snap.data()!) : null;
}

export async function listMembers(codeId: string) {
  const snap = await membersCol(codeId).orderBy('createdAt', 'desc').get();
  return snap.docs.map((d) => ({ id: d.id, member: toMember(d.data()) }));
}

export async function listAudit(codeId: string, limit = 100) {
  const snap = await auditCol(codeId).orderBy('at', 'desc').limit(limit).get();
  return snap.docs.map((d) => d.data() as { action: string; actor: string; postId?: string; memberId?: string; detail?: string; at: number });
}

// ---------------------------------------------------------------- allowlist (owner)

export async function upsertAllowlist(codeId: string, entries: AllowlistEntry[], replace: boolean) {
  if (replace) await deleteCollection(allowCol(codeId));
  for (let i = 0; i < entries.length; i += 450) {
    const batch = db().batch();
    entries.slice(i, i + 450).forEach((e) => batch.set(allowCol(codeId).doc(phoneDigits(e.phone)), e));
    await batch.commit();
  }
}

export async function listAllowlist(codeId: string): Promise<AllowlistEntry[]> {
  const snap = await allowCol(codeId).get();
  return snap.docs.map((d) => d.data() as AllowlistEntry);
}

export async function removeAllowlistEntry(codeId: string, phone: string) {
  await allowCol(codeId).doc(phoneDigits(phone)).delete();
}

// ---------------------------------------------------------------- purge

async function deleteCollection(col: FirebaseFirestore.CollectionReference): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await col.limit(450).get();
    if (snap.empty) return total;
    const batch = db().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
}

/** All storage URLs of every post (for the purge), page by page. */
export async function allPostStorage(codeId: string): Promise<{ urls: string[]; bytes: number }> {
  const urls: string[] = [];
  let bytes = 0;
  const snap = await postsCol(codeId).select('storageUrls', 'bytes').get();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (Array.isArray(data.storageUrls)) urls.push(...data.storageUrls);
    bytes += data.bytes || 0;
  });
  return { urls, bytes };
}

/** Delete every post, member, allowlist row and audit entry. Files are the caller's job (urls returned first). */
export async function purgeDocs(codeId: string) {
  const posts = await deleteCollection(postsCol(codeId));
  const members = await deleteCollection(membersCol(codeId));
  await deleteCollection(allowCol(codeId));
  await deleteCollection(auditCol(codeId));
  await rtdbRef(codeId).remove();
  return { posts, members };
}
