import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// Check if name looks like a real name (not a filename)
function isRealName(name: string | undefined): boolean {
  if (!name) return false;
  if (name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) return false;
  if (name.match(/^(IMG|DSC|Photo|Screenshot|Firefly|Adobe|DCIM|image)/i)) return false;
  if (name.match(/^\d{5,}/)) return false;
  if (name.match(/[_-]\d+$/)) return false;
  if (name.match(/^[A-Za-z0-9_-]+\s*\(\d+\)$/)) return false;
  return true;
}

// GET: Fetch all votes grouped by voter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('codeId');

    if (!codeId) {
      return NextResponse.json(
        { error: 'codeId is required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Fetch votes and candidates in parallel
    const [votesSnapshot, candidatesSnapshot] = await Promise.all([
      db.collection('codes').doc(codeId).collection('votes').get(),
      db.collection('codes').doc(codeId).collection('candidates').get(),
    ]);

    // Build candidate lookup map
    const candidateMap = new Map<string, { name: string; photo: string | null }>();
    candidatesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const rawName = data.name || data.formData?.name || '';
      candidateMap.set(doc.id, {
        name: isRealName(rawName) ? rawName : '',
        photo: data.photos?.[0]?.thumbnailUrl || data.photos?.[0]?.url || null,
      });
    });

    // Fetch categories from qvoteConfig
    const codeDoc = await db.collection('codes').doc(codeId).get();
    const codeData = codeDoc.data();
    const qvoteMedia = codeData?.media?.find((m: { type: string }) => m.type === 'qvote');
    const categories = qvoteMedia?.qvoteConfig?.categories || [];
    const categoryMap = new Map<string, string>(
      categories.map((c: { id: string; name: string }) => [c.id, c.name])
    );

    // Group votes by voterId
    const voterMap = new Map<string, {
      voterId: string;
      phone: string | null;
      votes: {
        candidateId: string;
        candidateName: string;
        candidatePhoto: string | null;
        categoryId?: string;
        categoryName?: string;
        round: number;
        createdAt: string;
      }[];
      firstVoteAt: string;
      totalVotes: number;
    }>();

    votesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const voterId = data.voterId;
      const candidate = candidateMap.get(data.candidateId);
      const createdAt = data.createdAt?.toDate?.() || new Date();
      const createdAtISO = createdAt.toISOString();

      if (!voterMap.has(voterId)) {
        voterMap.set(voterId, {
          voterId,
          phone: data.phone || null,
          votes: [],
          firstVoteAt: createdAtISO,
          totalVotes: 0,
        });
      }

      const voter = voterMap.get(voterId)!;

      voter.votes.push({
        candidateId: data.candidateId,
        candidateName: candidate?.name || '',
        candidatePhoto: candidate?.photo || null,
        categoryId: data.categoryId || undefined,
        categoryName: data.categoryId ? categoryMap.get(data.categoryId) : undefined,
        round: data.round || 1,
        createdAt: createdAtISO,
      });

      voter.totalVotes++;

      // Track earliest vote
      if (createdAtISO < voter.firstVoteAt) {
        voter.firstVoteAt = createdAtISO;
      }

      // Update phone if this vote has it and we don't have it yet
      if (data.phone && !voter.phone) {
        voter.phone = data.phone;
      }
    });

    // Sort voters by newest first
    const voters = Array.from(voterMap.values())
      .sort((a, b) => b.firstVoteAt.localeCompare(a.firstVoteAt));

    return NextResponse.json({
      voters,
      totalVoters: voters.length,
      totalVotes: votesSnapshot.size,
    });
  } catch (error) {
    console.error('[QVote Voters API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voters' },
      { status: 500 }
    );
  }
}
