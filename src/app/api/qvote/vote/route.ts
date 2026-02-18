import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { normalizePhoneNumber } from '@/lib/phone-utils';
import crypto from 'crypto';

// --- Config cache (per serverless instance, 30s TTL) ---
const configCache = new Map<string, { data: Record<string, unknown>; expiresAt: number }>();
const CONFIG_CACHE_TTL = 30_000;

// --- Origin validation ---
function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin) return true; // Same-origin requests may not send origin header
  if (!host) return false;
  const allowedHosts = [host, 'localhost:3000', 'localhost:3001'];
  return allowedHosts.some(h => origin.includes(h));
}

// --- Server-side fingerprint ---
function generateFingerprint(request: NextRequest, codeId: string): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return crypto.createHash('sha256')
    .update(`${ip}|${userAgent}|${codeId}`)
    .digest('hex');
}

// POST: Submit votes using Admin SDK
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // --- CSRF / Origin validation ---
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { error: 'Forbidden', errorCode: 'INVALID_ORIGIN' },
        { status: 403 }
      );
    }

    const { codeId, voterId, candidateIds, round = 1, categoryId, phone, sessionToken } = await request.json();

    if (!codeId || typeof codeId !== 'string') {
      return NextResponse.json(
        { error: 'codeId is required' },
        { status: 400 }
      );
    }

    if (!voterId || typeof voterId !== 'string') {
      return NextResponse.json(
        { error: 'voterId is required' },
        { status: 400 }
      );
    }

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return NextResponse.json(
        { error: 'candidateIds array is required' },
        { status: 400 }
      );
    }

    // Validate candidateIds are strings
    if (!candidateIds.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
      return NextResponse.json(
        { error: 'All candidateIds must be non-empty strings' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // --- Get code config (cached) ---
    let codeData: Record<string, unknown> | undefined;
    const cached = configCache.get(codeId);
    if (cached && cached.expiresAt > Date.now()) {
      codeData = cached.data;
    } else {
      const codeDoc = await db.collection('codes').doc(codeId).get();
      if (!codeDoc.exists) {
        return NextResponse.json(
          { error: 'Code not found' },
          { status: 404 }
        );
      }
      codeData = codeDoc.data() as Record<string, unknown>;
      configCache.set(codeId, { data: codeData, expiresAt: Date.now() + CONFIG_CACHE_TTL });
    }

    const media = codeData?.media as Array<{ type: string; qvoteConfig?: Record<string, unknown> }> | undefined;
    const qvoteMedia = media?.find((m) => m.type === 'qvote');
    const qvoteConfig = qvoteMedia?.qvoteConfig as Record<string, unknown> | undefined;
    const verificationConfig = qvoteConfig?.verification as Record<string, unknown> | undefined;

    // --- Fix 4: Validate voting phase ---
    const currentPhase = qvoteConfig?.currentPhase;
    if (currentPhase !== 'voting' && currentPhase !== 'finals') {
      return NextResponse.json(
        { error: 'Voting is not currently open', errorCode: 'VOTING_CLOSED' },
        { status: 403 }
      );
    }

    // --- Fix 5: Bound candidateIds length ---
    const maxSelections = (qvoteConfig?.maxSelectionsPerVoter as number) || 3;
    if (candidateIds.length > maxSelections) {
      return NextResponse.json(
        { error: `Maximum ${maxSelections} selections allowed`, errorCode: 'TOO_MANY_SELECTIONS' },
        { status: 400 }
      );
    }

    // --- Fix 2: Rate limiting (Firestore-based, distributed) ---
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipRateLimitKey = `vote_ip_${clientIp}`;
    const RATE_LIMIT_WINDOW = 60_000; // 1 minute
    const IP_RATE_LIMIT_MAX = 60; // 60 votes per IP per minute (cellular CGNAT can share IPs)

    const ipRateLimitResult = await db.runTransaction(async (transaction) => {
      const ref = db.collection('rateLimits').doc(ipRateLimitKey);
      const doc = await transaction.get(ref);
      const data = doc.data();
      const now = Date.now();

      if (!data || now > (data.resetAt as number)) {
        transaction.set(ref, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return { allowed: true };
      }
      if ((data.count as number) >= IP_RATE_LIMIT_MAX) {
        return { allowed: false };
      }
      transaction.update(ref, { count: FieldValue.increment(1) });
      return { allowed: true };
    });

    if (!ipRateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait.', errorCode: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': '5' } }
      );
    }

    // Per-voter rate limiting (10 votes per voter per minute)
    const voterRateLimitKey = `vote_voter_${voterId}_${codeId}`;
    const VOTER_RATE_LIMIT_MAX = 10;

    const voterRateLimitResult = await db.runTransaction(async (transaction) => {
      const ref = db.collection('rateLimits').doc(voterRateLimitKey);
      const doc = await transaction.get(ref);
      const data = doc.data();
      const now = Date.now();

      if (!data || now > (data.resetAt as number)) {
        transaction.set(ref, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return { allowed: true };
      }
      if ((data.count as number) >= VOTER_RATE_LIMIT_MAX) {
        return { allowed: false };
      }
      transaction.update(ref, { count: FieldValue.increment(1) });
      return { allowed: true };
    });

    if (!voterRateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many votes. Please wait.', errorCode: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': '5' } }
      );
    }

    // --- Fix 8: Server-side fingerprint for anonymous voting dedup ---
    const fingerprint = generateFingerprint(request, codeId);

    // If verification is enabled, validate session
    if (verificationConfig?.enabled) {
      if (!phone || !sessionToken) {
        return NextResponse.json(
          { error: 'Phone verification required', errorCode: 'VERIFICATION_REQUIRED' },
          { status: 401 }
        );
      }

      // Normalize phone and check verified voter
      const normalizedPhone = normalizePhoneNumber(phone);
      const voterNormalizedPhone = normalizedPhone.replace(/\D/g, '');
      const verifiedVoterId = `${codeId}_${voterNormalizedPhone}`;
      const voterDoc = await db.collection('verifiedVoters').doc(verifiedVoterId).get();

      if (!voterDoc.exists) {
        return NextResponse.json(
          { error: 'Phone not verified', errorCode: 'NOT_VERIFIED' },
          { status: 401 }
        );
      }

      const voterData = voterDoc.data();

      // Validate session token
      if (voterData?.sessionToken !== sessionToken) {
        return NextResponse.json(
          { error: 'Invalid session', errorCode: 'INVALID_SESSION' },
          { status: 401 }
        );
      }

      // Check session expiry
      const sessionExpiresAt = voterData?.sessionExpiresAt?.toDate();
      if (!sessionExpiresAt || new Date() > sessionExpiresAt) {
        return NextResponse.json(
          { error: 'Session expired', errorCode: 'SESSION_EXPIRED' },
          { status: 401 }
        );
      }

      // Check if there are categories - if so, allow one vote per category
      if (categoryId) {
        const existingCategoryVote = await db.collection('codes').doc(codeId)
          .collection('votes')
          .where('voterId', '==', voterId)
          .where('categoryId', '==', categoryId)
          .where('round', '==', round)
          .limit(1)
          .get();

        if (!existingCategoryVote.empty) {
          return NextResponse.json(
            { error: 'Already voted in this category', errorCode: 'ALREADY_VOTED_CATEGORY' },
            { status: 403 }
          );
        }
      } else {
        // No category - use the global vote limit
        const votesUsed = voterData?.votesUsed || 0;
        const maxVotes = voterData?.maxVotes || 1;
        if (votesUsed >= maxVotes) {
          return NextResponse.json(
            { error: 'Vote limit reached', errorCode: 'VOTE_LIMIT_REACHED', votesUsed, maxVotes },
            { status: 403 }
          );
        }

        // Increment votes used for this verified voter
        await db.collection('verifiedVoters').doc(verifiedVoterId).update({
          votesUsed: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      // --- Anonymous voting: check fingerprint for dedup ---
      const fingerprintVote = await db.collection('codes').doc(codeId)
        .collection('votes')
        .where('fingerprint', '==', fingerprint)
        .where('round', '==', round)
        .limit(1)
        .get();

      if (!fingerprintVote.empty) {
        return NextResponse.json(
          { error: 'Already voted from this device', errorCode: 'DUPLICATE_DEVICE' },
          { status: 403 }
        );
      }
    }

    const duplicates: string[] = [];
    let votesSubmitted = 0;

    // Use a transaction to ensure atomicity
    // Performance: Use getAll() instead of sequential gets
    await db.runTransaction(async (transaction) => {
      // PHASE 1: Read all vote documents at once
      const voteEntries = candidateIds.map((candidateId: string) => {
        const voteId = `${voterId}_${candidateId}_${round}`;
        const voteRef = db.collection('codes').doc(codeId).collection('votes').doc(voteId);
        return { voteId, voteRef, candidateId };
      });

      const voteRefs = voteEntries.map(e => e.voteRef);
      const voteSnaps = await transaction.getAll(...voteRefs);

      // PHASE 2: Perform all writes
      voteEntries.forEach((entry, i) => {
        const { voteId, voteRef, candidateId } = entry;
        const exists = voteSnaps[i].exists;

        if (exists) {
          duplicates.push(candidateId);
          return;
        }

        // Create vote document
        transaction.set(voteRef, {
          id: voteId,
          codeId,
          categoryId: categoryId || null,
          candidateId,
          voterId,
          round,
          fingerprint,
          phone: phone ? normalizePhoneNumber(phone) : null,
          createdAt: FieldValue.serverTimestamp(),
        });

        // Update candidate vote count
        const candidateRef = db.collection('codes').doc(codeId).collection('candidates').doc(candidateId);
        const voteField = round === 1 ? 'voteCount' : 'finalsVoteCount';
        transaction.update(candidateRef, {
          [voteField]: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });

        votesSubmitted++;
      });
    });

    // --- Fix 3: Atomic stats update using dedicated stats document ---
    if (votesSubmitted > 0) {
      try {
        const statsRef = db.collection('codes').doc(codeId)
          .collection('qvoteStats').doc('current');
        await statsRef.set({
          totalVotes: FieldValue.increment(votesSubmitted),
          totalVoters: FieldValue.increment(1),
          lastUpdated: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (statsError) {
        console.error('Error updating stats:', statsError);
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(JSON.stringify({
      event: 'vote_submitted',
      codeId,
      voterId: voterId.substring(0, 8),
      votesSubmitted,
      duplicates: duplicates.length,
      durationMs,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({
      success: votesSubmitted > 0,
      votesSubmitted,
      duplicates,
    });
  } catch (error) {
    console.error('Q.Vote submit vote error:', error);
    return NextResponse.json(
      { error: 'Failed to submit vote' },
      { status: 500 }
    );
  }
}
