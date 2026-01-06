'use client';

import { memo, useMemo } from 'react';
import { QStageVoter } from '@/types/qstage';

interface QStageVoterGridProps {
  voters: QStageVoter[];
  maxVisible?: number;
  likeColor?: string;
  dislikeColor?: string;
}

/**
 * QStageVoterGrid - Wall of faces showing who voted
 * Circular avatars with vote-colored rings, staggered entrance animation
 */
export const QStageVoterGrid = memo(function QStageVoterGrid({
  voters,
  maxVisible = 100,
  likeColor = '#00ff88',
  dislikeColor = '#ff3355',
}: QStageVoterGridProps) {
  // Limit visible voters
  const visibleVoters = useMemo(
    () => voters.slice(0, maxVisible),
    [voters, maxVisible]
  );

  // Calculate grid size based on voter count
  const gridSize = useMemo(() => {
    const count = visibleVoters.length;
    if (count <= 16) return 48;
    if (count <= 36) return 44;
    if (count <= 64) return 40;
    return 36;
  }, [visibleVoters.length]);

  if (visibleVoters.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center opacity-40">
          <div className="text-6xl mb-4">👥</div>
          <div className="text-lg font-medium text-white/60">
            Waiting for voters...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 overflow-hidden">
      {/* Grid container with glassmorphism */}
      <div
        className="h-full rounded-2xl p-4 overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Scrollable grid */}
        <div
          className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}px, 1fr))`,
            gap: '8px',
            alignContent: 'start',
          }}
        >
          {visibleVoters.map((voter, index) => (
            <VoterAvatar
              key={voter.visitorId}
              voter={voter}
              size={gridSize}
              index={index}
              likeColor={likeColor}
              dislikeColor={dislikeColor}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

// ============ VOTER AVATAR ============

interface VoterAvatarProps {
  voter: QStageVoter;
  size: number;
  index: number;
  likeColor: string;
  dislikeColor: string;
}

const VoterAvatar = memo(function VoterAvatar({
  voter,
  size,
  index,
  likeColor,
  dislikeColor,
}: VoterAvatarProps) {
  const isLike = voter.voteType === 'like';
  const ringColor = isLike ? likeColor : dislikeColor;
  const isEmoji = voter.avatarType === 'emoji';

  // Staggered animation delay (max 1 second total spread)
  const delay = Math.min(index * 30, 1000);

  return (
    <div
      className="relative animate-qstage-voter-enter"
      style={{
        width: size,
        height: size,
        animationDelay: `${delay}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {/* Glow ring */}
      <div
        className="absolute inset-[-3px] rounded-full animate-qstage-ring-pulse"
        style={{
          background: `linear-gradient(135deg, ${ringColor}, ${ringColor}88)`,
          boxShadow: `0 0 10px ${ringColor}60, 0 0 20px ${ringColor}30`,
          animationDelay: `${delay + 200}ms`,
        }}
      />

      {/* Avatar container */}
      <div
        className="absolute inset-[2px] rounded-full overflow-hidden"
        style={{
          background: isEmoji ? 'rgba(30, 41, 59, 0.9)' : 'transparent',
        }}
      >
        {isEmoji ? (
          // Emoji avatar
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ fontSize: size * 0.5 }}
          >
            {voter.avatarValue}
          </div>
        ) : (
          // Selfie avatar
          <img
            src={voter.avatarValue}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      {/* Judge badge */}
      {voter.isJudge && (
        <div
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
          style={{
            background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
            boxShadow: '0 0 8px #ffd70080',
          }}
        >
          👑
        </div>
      )}
    </div>
  );
});

export default QStageVoterGrid;
