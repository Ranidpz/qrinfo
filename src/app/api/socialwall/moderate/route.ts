import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { deleteStoredObjectByUrl } from '@/lib/media-storage';
import { adjustStorageUsed } from '@/lib/storage-guard';
import { decodeCursor, encodeCursor, isValidMemberId, isValidPostId, screenEligibility } from '@/lib/socialwall/rules';
import {
  SocialWallError,
  audit,
  blockMember,
  bumpRev,
  deletePostDoc,
  isValidCodeId,
  listAudit,
  listForModeration,
  loadSocialWall,
  moderatePost,
  unblockMember,
  type ModerationFilter,
  type PostAction,
} from '@/lib/socialwall/store';
import { authorizeOperator, errorResponse, readJson } from '@/lib/socialwall/server';

const LIMIT = { maxRequests: 600, windowMs: 60 * 1000 };
const PAGE = 40;
const FILTERS: ModerationFilter[] = ['all', 'pending', 'hidden'];
const POST_ACTIONS: PostAction[] = ['approve', 'hide', 'show', 'screen_approve', 'screen_reject', 'pin', 'unpin'];

// Operators (owner or the on-site staff link): the moderation queue.
//   ?codeId&filter=all|pending|hidden&cursor=   posts, newest first
//   ?codeId&audit=1                             the last operator actions
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(`socialwall-mod:${getClientIp(request)}`, LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  try {
    const params = request.nextUrl.searchParams;
    const codeId = params.get('codeId');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const wall = await loadSocialWall(codeId);
    const op = await authorizeOperator(request, wall);
    if ('response' in op) return op.response;

    if (params.get('audit') === '1') return NextResponse.json({ entries: await listAudit(codeId) });

    const filterRaw = params.get('filter') as ModerationFilter;
    const filter = FILTERS.includes(filterRaw) ? filterRaw : 'all';
    const items = await listForModeration(codeId, filter, decodeCursor(params.get('cursor')), PAGE);
    const now = Date.now();
    const last = items[items.length - 1];
    return NextResponse.json({
      posts: items.filter(({ post }) => post.status !== 'deleted').map(({ id, post }) => ({
        id,
        memberId: post.memberId,
        authorName: post.authorName,
        groupId: post.groupId,
        caption: post.caption,
        cardUrl: post.cardUrl,
        fullUrl: post.fullUrl,
        width: post.width,
        height: post.height,
        likeCount: Math.max(0, post.likeCount || 0),
        status: post.status,
        screen: post.screen,
        pinned: !!post.pinned,
        createdAt: post.createdAt,
        ...screenEligibility(post, wall.config, now),
      })),
      nextCursor: filter === 'all' && items.length === PAGE && last ? encodeCursor(last.post.createdAt, last.id) : null,
      serverTime: now,
    });
  } catch (error) {
    return errorResponse(error, 'moderate-list');
  }
}

// Operators: act on a post ({action, postId}) or a member ({action: block|unblock, memberId}).
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`socialwall-mod:${getClientIp(request)}`, LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  try {
    const body = await readJson(request);
    const { codeId, action, postId, memberId } = body;
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const wall = await loadSocialWall(codeId);
    const op = await authorizeOperator(request, wall);
    if ('response' in op) return op.response;

    if (action === 'block' || action === 'unblock') {
      if (!isValidMemberId(memberId)) throw new SocialWallError('INVALID_MEMBER', 400);
      if (action === 'block') {
        const hidden = await blockMember(codeId, memberId, op.actor);
        return NextResponse.json({ success: true, hidden });
      }
      await unblockMember(codeId, memberId, op.actor);
      return NextResponse.json({ success: true });
    }

    if (!isValidPostId(postId)) throw new SocialWallError('INVALID_POST_ID', 400);

    if (action === 'delete') {
      const removed = await deletePostDoc(codeId, postId, op.actor);
      if (removed) {
        await Promise.all(
          (removed.storageUrls || []).map((url) =>
            deleteStoredObjectByUrl(url).catch((error) => console.error('[socialwall] file delete failed:', error))
          )
        );
        await adjustStorageUsed(wall.ownerId, -(removed.bytes || 0));
        await audit(codeId, { action: 'post:delete', actor: op.actor, postId });
        await bumpRev(codeId);
      }
      return NextResponse.json({ success: true });
    }

    if (!POST_ACTIONS.includes(action as PostAction)) throw new SocialWallError('BAD_ACTION', 400);
    await moderatePost(codeId, postId, action as PostAction, op.actor);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'moderate');
  }
}
