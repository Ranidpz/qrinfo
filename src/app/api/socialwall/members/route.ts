import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { maskPhoneNumber } from '@/lib/phone-utils';
import { isValidCodeId, listMembers, loadSocialWall } from '@/lib/socialwall/store';
import { authorizeOperator, errorResponse } from '@/lib/socialwall/server';

// Operators: who joined. Full phones for the owner only; the staff link sees them masked.
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(`socialwall-members:${getClientIp(request)}`, { maxRequests: 60, windowMs: 60 * 1000 });
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  try {
    const codeId = request.nextUrl.searchParams.get('codeId');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const wall = await loadSocialWall(codeId);
    const op = await authorizeOperator(request, wall);
    if ('response' in op) return op.response;
    const members = await listMembers(codeId);
    return NextResponse.json({
      members: members
        .filter(({ member }) => member.status !== 'pending')
        .map(({ id, member }) => ({
          id,
          name: member.name,
          groupId: member.groupId,
          status: member.status,
          phone: member.phone ? (op.isOwner ? member.phone : maskPhoneNumber(member.phone)) : null,
          postCount: member.postCount,
          likesGiven: member.likedPosts.length,
          createdAt: member.createdAt,
        })),
    });
  } catch (error) {
    return errorResponse(error, 'members');
  }
}
