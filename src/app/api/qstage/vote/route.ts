import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { QStageVote, QStageStats, QStageVoter, QStageConfig } from '@/types/qstage';
import {
  addVoteToLive,
  triggerSuccessEvent,
  recordThresholdCrossing,
} from '@/lib/qstage-realtime';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      codeId,
      visitorId,
      voteType,
      avatarType,
      avatarValue,
      isJudge = false,
      judgeId,
      weight = 1,
    } = body;

    // Validate required fields
    if (!codeId || !visitorId || !voteType || !avatarType || !avatarValue) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate vote type
    if (!['like', 'dislike'].includes(voteType)) {
      return NextResponse.json(
        { error: 'Invalid vote type' },
        { status: 400 }
      );
    }

    // Check if code exists and get config
    const codeRef = doc(db, 'codes', codeId);
    const codeDoc = await getDoc(codeRef);

    if (!codeDoc.exists()) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    // Find QStage media item
    const codeData = codeDoc.data();
    const qstageMedia = codeData.media?.find(
      (m: { type: string }) => m.type === 'qstage'
    );

    if (!qstageMedia?.qstageConfig) {
      return NextResponse.json(
        { error: 'QStage not configured' },
        { status: 400 }
      );
    }

    const config: QStageConfig = qstageMedia.qstageConfig;

    // Check if voting is open
    if (config.currentPhase !== 'voting') {
      return NextResponse.json(
        { error: 'Voting is not open' },
        { status: 400 }
      );
    }

    // Check for existing vote
    const voteRef = doc(db, 'codes', codeId, 'qstage_votes', visitorId);
    const existingVote = await getDoc(voteRef);

    if (existingVote.exists()) {
      return NextResponse.json(
        { error: 'Already voted' },
        { status: 400 }
      );
    }

    // Create vote document
    const vote: QStageVote = {
      visitorId,
      voteType,
      avatarType,
      avatarValue,
      isJudge,
      judgeId: isJudge ? judgeId : undefined,
      weight,
      votedAt: Date.now(),
    };

    // Save vote to Firestore
    await setDoc(voteRef, vote);

    // Create voter object for real-time display
    const voter: QStageVoter = {
      visitorId,
      avatarType,
      avatarValue,
      voteType,
      votedAt: Date.now(),
      isJudge,
      weight,
    };

    // Update real-time database
    try {
      await addVoteToLive(codeId, voter);
    } catch (rtdbError) {
      console.error('Error updating Realtime DB:', rtdbError);
      // Don't fail the vote if Realtime DB update fails
    }

    // Update stats in Firestore (denormalized for fast reads)
    await runTransaction(db, async (transaction) => {
      const codeSnap = await transaction.get(codeRef);
      if (!codeSnap.exists()) return;

      const data = codeSnap.data();
      const mediaIndex = data.media?.findIndex(
        (m: { type: string }) => m.type === 'qstage'
      );

      if (mediaIndex === -1) return;

      const currentStats: QStageStats = data.media[mediaIndex].qstageConfig?.stats || {
        totalVoters: 0,
        totalLikes: 0,
        totalDislikes: 0,
        likePercent: 0,
        judgeVotes: 0,
        lastUpdated: Date.now(),
      };

      const newLikes = currentStats.totalLikes + (voteType === 'like' ? weight : 0);
      const newDislikes = currentStats.totalDislikes + (voteType === 'dislike' ? weight : 0);
      const totalWeighted = newLikes + newDislikes;
      const newLikePercent = totalWeighted > 0 ? Math.round((newLikes / totalWeighted) * 100) : 0;
      const prevLikePercent = currentStats.likePercent;

      const updatedStats: QStageStats = {
        totalVoters: currentStats.totalVoters + 1,
        totalLikes: newLikes,
        totalDislikes: newDislikes,
        likePercent: newLikePercent,
        judgeVotes: currentStats.judgeVotes + (isJudge ? 1 : 0),
        lastUpdated: Date.now(),
      };

      // Update media array with new stats
      const updatedMedia = [...data.media];
      updatedMedia[mediaIndex] = {
        ...updatedMedia[mediaIndex],
        qstageConfig: {
          ...updatedMedia[mediaIndex].qstageConfig,
          stats: updatedStats,
        },
      };

      transaction.update(codeRef, { media: updatedMedia });

      // Check for threshold crossings
      const successThreshold = config.successThreshold || 65;
      const thresholds = config.thresholds || [];

      // Check if we crossed success threshold
      if (prevLikePercent < successThreshold && newLikePercent >= successThreshold) {
        try {
          await triggerSuccessEvent(codeId);
        } catch (e) {
          console.error('Error triggering success:', e);
        }
      }

      // Check for other threshold crossings
      for (const threshold of thresholds) {
        if (prevLikePercent < threshold.percentage && newLikePercent >= threshold.percentage) {
          try {
            await recordThresholdCrossing(codeId, threshold.percentage);
          } catch (e) {
            console.error('Error recording threshold:', e);
          }
          break; // Only record highest crossed threshold
        }
      }
    });

    return NextResponse.json({
      success: true,
      vote: {
        type: voteType,
        weight,
      },
    });
  } catch (error) {
    console.error('Error submitting vote:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
