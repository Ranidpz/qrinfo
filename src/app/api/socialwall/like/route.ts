import { NextRequest, NextResponse } from 'next/server';
import { isValidPostId } from '@/lib/socialwall/rules';
import { SocialWallError, getAuthedMember, isValidCodeId, loadSocialWall, setLike } from '@/lib/socialwall/store';
import { errorResponse, guardPublic, readJson, sessionHeader } from '@/lib/socialwall/server';

// Member: like / unlike. Idempotent ({on} is the desired state, not a toggle), so a double tap or
// a retried request can never count twice.
export async function POST(request: NextRequest) {
  const blocked = guardPublic(request, 'like');
  if (blocked) return blocked;
  try {
    const body = await readJson(request);
    const { codeId, postId, on } = body;
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    if (!isValidPostId(postId)) throw new SocialWallError('INVALID_POST_ID', 400);
    if (typeof on !== 'boolean') throw new SocialWallError('BAD_REQUEST', 400);
    await loadSocialWall(codeId);
    const { memberId } = await getAuthedMember(codeId, sessionHeader(request));
    const { likeCount } = await setLike(codeId, memberId, postId, on);
    return NextResponse.json({ success: true, liked: on, likeCount });
  } catch (error) {
    return errorResponse(error, 'like');
  }
}
