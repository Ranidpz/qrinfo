'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import ExitGameButton from './ExitGameButton';
import {
  RTDBMemoryState,
  RTDBMemoryPlayer,
  MemoryPhase,
  QGamesConfig,
  MEMORY_EMOJI_POOL,
  QGamesAvatarType,
  DEFAULT_CHAT_PHRASES,
} from '@/types/qgames';
import LobbyChat from './LobbyChat';
import { useQGamesTheme } from '@/components/qgames/QGamesThemeContext';
import MemoryAnimatedEmoji from './MemoryAnimatedEmoji';
import {
  createMemoryRoom,
  joinMemoryRoom,
  leaveMemoryRoom,
  findActiveMemoryRoom,
  startMemoryRound,
  setMemoryPhase,
  submitMemoryRoundResult,
  updateMemoryPlayerStats,
  finishMemoryRoom,
  deleteMemoryRoom,
} from '@/lib/qgames-realtime';
import { useMemoryRoom, useMemoryPlayers, useCountdown, useQGamesSounds } from '@/hooks/useQGamesRealtime';

// ============ Types ============

interface MemoryGameProps {
  codeId: string;
  visitorId: string;
  playerNickname: string;
  playerAvatarType: QGamesAvatarType;
  playerAvatarValue: string;
  config: QGamesConfig;
  onMatchEnd: (results: MemoryGameResult) => void;
  onBack: () => void;
  onForfeit?: () => void;
  isRTL: boolean;
  t: (key: string) => string;
  shortId?: string;
  enableWhatsApp?: boolean;
  inviterVisitorId?: string;
  viewerCount?: number;
  onViewLeaderboard?: () => void;
}

export interface MemoryGameResult {
  roomId: string;
  winnerId: string | null;
  winnerNickname: string;
  players: Array<{
    id: string;
    nickname: string;
    avatarType: QGamesAvatarType;
    avatarValue: string;
    score: number;
    strikes: number;
    rank: number;
  }>;
}

type GamePhase = 'lobby' | 'countdown' | 'memorize' | 'recall' | 'results' | 'gameOver';

// ============ Helpers ============

function generateRoomId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Pick N random emojis from pool (no duplicates) */
function pickRandom(pool: string[], count: number): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** Generate round data: target emojis + 9 shuffled options */
function generateRound(difficulty: number): { targets: string[]; options: string[] } {
  const targets = pickRandom(MEMORY_EMOJI_POOL, difficulty);
  const remaining = MEMORY_EMOJI_POOL.filter(e => !targets.includes(e));
  const fillers = pickRandom(remaining, 9 - difficulty);
  const options = [...targets, ...fillers].sort(() => Math.random() - 0.5);
  return { targets, options };
}

/** Get difficulty for a given round number (0-indexed) */
function getDifficulty(round: number): number {
  if (round < 3) return 3;
  if (round < 6) return 4;
  return 5;
}

// ============ Component ============

export default function MemoryGame({
  codeId,
  visitorId,
  playerNickname,
  playerAvatarType,
  playerAvatarValue,
  config,
  onMatchEnd,
  onBack,
  onForfeit,
  isRTL,
  t,
  shortId,
  enableWhatsApp,
  inviterVisitorId,
  viewerCount,
  onViewLeaderboard,
}: MemoryGameProps) {
  const theme = useQGamesTheme();
  const sounds = useQGamesSounds(config.enableSound);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [localPhase, setLocalPhase] = useState<GamePhase>('lobby');
  const [selections, setSelections] = useState<string[]>([]);
  const [roundFailed, setRoundFailed] = useState(false);
  const [roundSubmitted, setRoundSubmitted] = useState(false);
  const [countdownNum, setCountdownNum] = useState(3);
  const [showingResults, setShowingResults] = useState(false);
  const [isBotMatch, setIsBotMatch] = useState(false);
  const [scorePopup, setScorePopup] = useState<{ points: number; key: number } | null>(null);
  const joinedRef = useRef(false);
  const phaseAdvancedRef = useRef(false);
  const botSubmittedRoundRef = useRef(-1);
  const applyingResultsRef = useRef(false);
  const advancingRef = useRef(false);

  // Subscribe to room and players
  const { room } = useMemoryRoom(codeId, roomId);
  const { players } = useMemoryPlayers(codeId, roomId);

  // Countdown timer for recall phase
  const recallTimer = useCountdown(
    room?.phase === 'recall' ? room.phaseStartedAt : null,
    room?.phase === 'recall' ? (room.recallDuration / 1000) : null
  );

  // Memorize timer
  const memorizeTimer = useCountdown(
    room?.phase === 'memorize' ? room.phaseStartedAt : null,
    room?.phase === 'memorize' ? (room.memorizeDuration / 1000) : null
  );

  const playerCount = Object.keys(players).length;
  const activePlayers = useMemo(() =>
    Object.entries(players).filter(([, p]) => !p.eliminated),
    [players]
  );
  const myPlayer = players[visitorId];
  const amEliminated = myPlayer?.eliminated ?? false;

  // ============ Join/Create Room on Mount ============

  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;

    const init = async () => {
      // Try to find an existing lobby
      const existingRoomId = await findActiveMemoryRoom(codeId);

      if (existingRoomId) {
        // Join existing room
        const joined = await joinMemoryRoom(
          codeId, existingRoomId, visitorId,
          playerNickname, playerAvatarType, playerAvatarValue
        );
        if (joined) {
          setRoomId(existingRoomId);
          setIsHost(false);
          return;
        }
      }

      // Create new room
      const newRoomId = generateRoomId();
      await createMemoryRoom(
        codeId, newRoomId, visitorId,
        playerNickname, playerAvatarType, playerAvatarValue,
        config.memoryMaxStrikes,
        config.memoryMemorizeTimer,
        config.memoryRecallTimer
      );
      setRoomId(newRoomId);
      setIsHost(true);
    };

    init();
  }, [codeId, visitorId, playerNickname, playerAvatarType, playerAvatarValue, config]);

  // ============ Sync local phase from room state ============

  useEffect(() => {
    if (!room) return;

    if (room.status === 'lobby') {
      setLocalPhase('lobby');
      return;
    }

    if (room.status === 'finished') {
      setLocalPhase('gameOver');
      return;
    }

    // Map RTDB phase to local phase
    if (room.phase === 'countdown') {
      setLocalPhase('countdown');
      setSelections([]);
      setRoundFailed(false);
      setRoundSubmitted(false);
      phaseAdvancedRef.current = false;
      applyingResultsRef.current = false;
      advancingRef.current = false;
    } else if (room.phase === 'memorize') {
      setLocalPhase('memorize');
    } else if (room.phase === 'recall') {
      setLocalPhase('recall');
    } else if (room.phase === 'results') {
      setLocalPhase('results');
      setShowingResults(true);
    }
  }, [room?.status, room?.phase, room?.currentRound]);

  // ============ Countdown 3-2-1 Animation ============

  useEffect(() => {
    if (localPhase !== 'countdown' || !room) return;

    setCountdownNum(3);
    sounds.playCountdown();

    const t2 = setTimeout(() => { setCountdownNum(2); sounds.playCountdown(); }, 1000);
    const t1 = setTimeout(() => { setCountdownNum(1); sounds.playCountdown(); }, 2000);
    const tGo = setTimeout(() => {
      // Host advances to memorize phase
      if (isHost && roomId) {
        setMemoryPhase(codeId, roomId, 'memorize');
      }
    }, 3000);

    return () => { clearTimeout(t2); clearTimeout(t1); clearTimeout(tGo); };
  }, [localPhase, room?.currentRound, isHost, codeId, roomId, sounds]);

  // ============ Memorize → Recall Transition (host) ============

  useEffect(() => {
    if (localPhase !== 'memorize' || !isHost || !roomId || !room) return;
    if (phaseAdvancedRef.current) return;

    const timer = setTimeout(() => {
      phaseAdvancedRef.current = true;
      setMemoryPhase(codeId, roomId, 'recall');
    }, room.memorizeDuration);

    return () => clearTimeout(timer);
  }, [localPhase, isHost, codeId, roomId, room?.memorizeDuration, room?.currentRound]);

  // ============ Recall Timeout (auto-submit) ============

  useEffect(() => {
    if (localPhase !== 'recall' || roundSubmitted || amEliminated) return;

    if (recallTimer.isExpired) {
      handleAutoSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recallTimer.isExpired, localPhase, roundSubmitted, amEliminated]);

  // ============ Check all players submitted → advance to results (host) ============

  useEffect(() => {
    if (localPhase !== 'recall' || !isHost || !roomId || !room) return;

    const allActive = Object.entries(players).filter(([, p]) => !p.eliminated);
    const allSubmitted = allActive.every(([, p]) => p.roundResult != null);

    if (allSubmitted && allActive.length > 0) {
      // All active players submitted — show results
      applyRoundResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, localPhase, isHost]);

  // ============ Results → Next Round or Game Over (host) ============
  // (effect is below advanceOrEnd definition to avoid ref-before-define)

  // ============ Handlers ============

  const handleStartGame = useCallback(async () => {
    if (!roomId || playerCount < 2) return;
    setIsHost(true); // Whoever starts becomes the host (manages phase transitions)

    const round = 0;
    const difficulty = getDifficulty(round);
    const { targets, options } = generateRound(difficulty);
    await startMemoryRound(codeId, roomId, round, difficulty, targets, options);
  }, [roomId, codeId, playerCount]);

  const handlePlayBot = useCallback(async () => {
    if (!roomId) return;

    // Add bot player to existing room
    await joinMemoryRoom(
      codeId, roomId, 'bot-1',
      isRTL ? 'בוט' : 'Bot', 'emoji', '🤖'
    );

    setIsBotMatch(true);
    setIsHost(true); // Bot starter manages phase transitions

    // Start game immediately
    const round = 0;
    const difficulty = getDifficulty(round);
    const { targets, options } = generateRound(difficulty);
    await startMemoryRound(codeId, roomId, round, difficulty, targets, options);
  }, [roomId, codeId, isRTL]);

  // ============ Bot Auto-Submit during Recall ============

  useEffect(() => {
    if (!isBotMatch || localPhase !== 'recall' || !roomId || !room) return;
    if (botSubmittedRoundRef.current >= room.currentRound) return;

    const delay = 1500 + Math.random() * 2000; // 1.5-3.5s
    const timer = setTimeout(() => {
      if (botSubmittedRoundRef.current >= room.currentRound) return;
      botSubmittedRoundRef.current = room.currentRound;

      const difficulty = room.difficulty;
      // Bot accuracy decreases with difficulty
      const rand = Math.random();
      let correctCount: number;
      let failed: boolean;

      if (difficulty <= 3) {
        // Easy: 50% all correct, 50% fail at random point
        if (rand < 0.5) { correctCount = difficulty; failed = false; }
        else { correctCount = Math.floor(Math.random() * difficulty); failed = true; }
      } else if (difficulty <= 4) {
        // Medium: 35% all correct
        if (rand < 0.35) { correctCount = difficulty; failed = false; }
        else { correctCount = Math.floor(Math.random() * difficulty); failed = true; }
      } else {
        // Hard: 20% all correct
        if (rand < 0.2) { correctCount = difficulty; failed = false; }
        else { correctCount = Math.floor(Math.random() * difficulty); failed = true; }
      }

      submitMemoryRoundResult(codeId, roomId, 'bot-1', {
        selections: room.targetEmojis.slice(0, correctCount),
        correctCount,
        failed,
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [isBotMatch, localPhase, roomId, room?.currentRound, codeId, room?.difficulty, room?.targetEmojis]);

  const handleSelectEmoji = useCallback((emoji: string) => {
    if (roundFailed || roundSubmitted || amEliminated || localPhase !== 'recall') return;
    if (!room) return;

    const targetIndex = selections.length;
    const isCorrect = room.targetEmojis[targetIndex] === emoji;

    sounds.playSelect();
    const newSelections = [...selections, emoji];
    setSelections(newSelections);

    if (!isCorrect) {
      // Wrong pick — round fails
      setRoundFailed(true);
      sounds.playLoseRound();
      // Submit result
      submitRoundResult(newSelections, targetIndex, true);
    } else if (newSelections.length === room.difficulty) {
      // All correct!
      sounds.playWinRound();
      submitRoundResult(newSelections, newSelections.length, false);
    }
  }, [roundFailed, roundSubmitted, amEliminated, localPhase, room, selections, sounds]);

  const submitRoundResult = useCallback(async (
    sels: string[],
    correctCount: number,
    failed: boolean
  ) => {
    if (roundSubmitted || !roomId) return;
    setRoundSubmitted(true);

    await submitMemoryRoundResult(codeId, roomId, visitorId, {
      selections: sels,
      correctCount,
      failed,
    });
  }, [roundSubmitted, codeId, roomId, visitorId]);

  const handleAutoSubmit = useCallback(() => {
    if (roundSubmitted || !room) return;
    // Timer expired — submit what we have + mark as failed (incomplete)
    const correctCount = selections.length;
    const failed = selections.length < room.difficulty;
    submitRoundResult(selections, correctCount, failed);
  }, [roundSubmitted, room, selections, submitRoundResult]);

  const applyRoundResults = useCallback(async () => {
    if (!roomId || !room) return;
    if (applyingResultsRef.current) return; // Prevent double call from RTDB race
    applyingResultsRef.current = true;

    // Update each active player's score and strikes
    const updates: Promise<void>[] = [];
    let myRoundPoints = 0;
    for (const [pid, p] of Object.entries(players)) {
      if (p.eliminated) continue;

      const result = p.roundResult;
      if (!result) continue;

      let roundPoints = result.correctCount;

      // Time bonus for perfect rounds (no fail): 1-3 extra points based on speed
      if (!result.failed && result.correctCount === room.difficulty && result.submittedAt) {
        const timeTaken = (result.submittedAt - room.phaseStartedAt) / 1000;
        const maxTime = room.recallDuration / 1000;
        const ratio = timeTaken / maxTime;
        if (ratio < 0.25) roundPoints += 3;
        else if (ratio < 0.5) roundPoints += 2;
        else if (ratio < 0.75) roundPoints += 1;
      }

      if (pid === visitorId) myRoundPoints = roundPoints;

      const newScore = p.score + roundPoints;
      const newStrikes = p.strikes + (result.failed ? 1 : 0);
      const newEliminated = newStrikes >= room.maxStrikes;

      updates.push(
        updateMemoryPlayerStats(codeId, roomId, pid, newScore, newStrikes, newEliminated)
      );
    }
    await Promise.all(updates);

    // Show score popup for local player
    if (myRoundPoints > 0) {
      setScorePopup({ points: myRoundPoints, key: Date.now() });
    }

    // Show results phase
    await setMemoryPhase(codeId, roomId, 'results');
  }, [roomId, room, players, codeId, visitorId]);

  const advanceOrEnd = useCallback(async () => {
    if (!roomId || !room) return;
    if (advancingRef.current) return; // Prevent double call
    advancingRef.current = true;

    // Re-read players to get updated elimination status
    const stillAlive = Object.entries(players).filter(([, p]) => !p.eliminated);

    if (stillAlive.length <= 1) {
      // Game over
      await finishMemoryRoom(codeId, roomId);
      return;
    }

    // Start next round
    const nextRound = room.currentRound + 1;
    const difficulty = getDifficulty(nextRound);
    const { targets, options } = generateRound(difficulty);
    await startMemoryRound(codeId, roomId, nextRound, difficulty, targets, options);
  }, [roomId, room, players, codeId]);

  // Results → Next Round or Game Over (host) — placed after advanceOrEnd definition
  const advanceOrEndRef = useRef(advanceOrEnd);
  advanceOrEndRef.current = advanceOrEnd;

  useEffect(() => {
    if (!showingResults || !isHost || !roomId) return;

    const timer = setTimeout(() => {
      setShowingResults(false);
      setScorePopup(null);
      advanceOrEndRef.current();
    }, 3000);

    return () => clearTimeout(timer);
  }, [showingResults, isHost, roomId]);

  const handleWhatsAppInvite = useCallback(() => {
    if (!shortId) return;
    const baseUrl = `https://qr.playzones.app/v/${shortId}`;
    const params = new URLSearchParams();
    if (inviterVisitorId) params.set('invite', inviterVisitorId);
    params.set('game', 'memory');
    const shareUrl = `${baseUrl}?${params}`;
    const gameName = isRTL ? 'זיכרון' : 'Memory';
    const message = isRTL
      ? `🎮 בוא נשחק ${gameName}! ${shareUrl}`
      : `🎮 Let's play ${gameName}! ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  }, [shortId, inviterVisitorId, isRTL]);

  const handleBack = useCallback(async () => {
    if (roomId) {
      if (isHost && room?.status === 'lobby') {
        await deleteMemoryRoom(codeId, roomId);
      } else {
        await leaveMemoryRoom(codeId, roomId, visitorId);
      }
    }
    onBack();
  }, [roomId, isHost, room?.status, codeId, visitorId, onBack]);

  const handleGameOver = useCallback(() => {
    if (!room || !roomId) return;

    // Build rankings
    const ranked = Object.entries(players)
      .map(([pid, p]) => ({
        id: pid,
        nickname: p.nickname,
        avatarType: p.avatarType,
        avatarValue: p.avatarValue,
        score: p.score,
        strikes: p.strikes,
        rank: 0,
      }))
      .sort((a, b) => {
        // Non-eliminated first, then by score desc, then by strikes asc
        const aElim = a.strikes >= room.maxStrikes ? 1 : 0;
        const bElim = b.strikes >= room.maxStrikes ? 1 : 0;
        if (aElim !== bElim) return aElim - bElim;
        if (b.score !== a.score) return b.score - a.score;
        return a.strikes - b.strikes;
      });

    ranked.forEach((p, i) => { p.rank = i + 1; });

    const winner = ranked[0];

    onMatchEnd({
      roomId,
      winnerId: winner?.id || null,
      winnerNickname: winner?.nickname || '',
      players: ranked,
    });
  }, [room, roomId, players, onMatchEnd]);

  // ============ Render ============

  if (!roomId || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.backgroundColor }}>
        <div className="animate-spin w-8 h-8 border-2 rounded-full" style={{ borderColor: theme.primaryColor, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: theme.backgroundColor, direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Exit button during active gameplay */}
      {onForfeit && localPhase !== 'lobby' && localPhase !== 'gameOver' && (
        <ExitGameButton onConfirm={onForfeit} isRTL={isRTL} t={t} />
      )}

      {/* ── LOBBY ── */}
      {localPhase === 'lobby' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative">
          {/* Back button */}
          <button
            onClick={handleBack}
            className="absolute top-4 p-2 transition-colors"
            style={{ [isRTL ? 'right' : 'left']: 12, color: theme.textSecondary }}
          >
            <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>

          {/* Player profile with pulsing rings */}
          <div className="relative mb-3">
            <div className="absolute inset-0 w-28 h-28 rounded-full border-2 animate-ping" style={{ animationDuration: '2s', borderColor: `${theme.accentColor}33` }} />
            <div className="absolute inset-0 w-28 h-28 rounded-full border-2 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s', borderColor: `${theme.accentColor}1a` }} />
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center text-5xl relative z-10 ring-2 overflow-hidden"
              style={{ backgroundColor: theme.surfaceColor, '--tw-ring-color': `${theme.accentColor}4d` } as React.CSSProperties}
            >
              {playerAvatarValue.startsWith('http') ? (
                <img src={playerAvatarValue} alt="" className="w-full h-full object-cover" />
              ) : playerAvatarValue}
            </div>
          </div>

          {/* Player name */}
          <span className="text-sm font-medium mb-4" style={{ color: theme.textSecondary }}>
            {playerNickname}
          </span>

          {/* Game title */}
          <h2 className="font-bold text-lg mb-0.5" style={{ color: theme.textColor }}>
            <MemoryAnimatedEmoji /> {isRTL ? 'זיכרון' : 'Memory Challenge'}
          </h2>

          {/* Searching text */}
          <p className="text-sm mb-3" style={{ color: theme.textSecondary }}>
            {isRTL ? 'מחפשים לכם חברים לשחק.' : 'Looking for friends to play.'}
          </p>

          {/* Player slots (up to 6) */}
          <div className="w-full max-w-sm mb-4">
            <div className="rounded-2xl p-4" style={{ backgroundColor: `${theme.surfaceColor}80`, border: `1px solid ${theme.borderColor}` }}>
              {/* Count indicator */}
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${playerCount > 0 ? 'animate-pulse' : ''}`} style={{ backgroundColor: theme.accentColor }} />
                <span className="font-bold text-lg" style={{ color: theme.accentColor }}>{playerCount}</span>
                <span className="text-lg" style={{ color: theme.textSecondary }}>/</span>
                <span className="font-bold text-lg" style={{ color: theme.textSecondary }}>6</span>
                <span className="text-sm ms-1" style={{ color: theme.textSecondary }}>{isRTL ? 'שחקנים' : 'players'}</span>
              </div>

              {/* Avatar slots row */}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {/* Connected players */}
                {Object.entries(players).map(([pid, p]) => (
                  <div key={pid} className="flex flex-col items-center gap-1 animate-in zoom-in duration-300">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-2xl ring-2 overflow-hidden"
                      style={{
                        backgroundColor: theme.surfaceColor,
                        '--tw-ring-color': pid === visitorId ? `${theme.accentColor}66` : `${theme.primaryColor}40`,
                      } as React.CSSProperties}
                    >
                      {p.avatarType === 'emoji' ? p.avatarValue : (
                        p.avatarValue?.startsWith('http')
                          ? <img src={p.avatarValue} alt="" className="w-full h-full object-cover" />
                          : p.avatarValue
                      )}
                    </div>
                    <span className="text-[10px] font-medium truncate max-w-[60px]" style={{ color: pid === visitorId ? theme.accentColor : theme.textSecondary }}>
                      {pid === visitorId ? (isRTL ? 'אתה' : 'You') : p.nickname}
                    </span>
                  </div>
                ))}

                {/* Empty slots */}
                {Array.from({ length: Math.max(0, 6 - playerCount) }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center" style={{ borderColor: `${theme.borderColor}` }}>
                      <span className="text-lg" style={{ color: theme.textSecondary }}>?</span>
                    </div>
                    <span className="text-[10px]" style={{ color: theme.textSecondary }}>&nbsp;</span>
                  </div>
                ))}
              </div>

              {/* Status message */}
              <p className="text-center text-xs mt-3" style={{ color: theme.textSecondary }}>
                {playerCount < 2
                  ? (isRTL ? 'ממתינים לעוד שחקנים...' : 'Waiting for more players...')
                  : (isRTL ? 'מוכנים להתחיל!' : 'Ready to start!')
                }
              </p>
            </div>
          </div>

          {/* Start button (any player with 2+ players) */}
          {playerCount >= 2 && (
            <button
              onClick={handleStartGame}
              className="w-full max-w-sm py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-[0.97] mb-3"
              style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
            >
              {isRTL ? 'התחילו!' : 'Start!'}
            </button>
          )}

          {/* Bot + WhatsApp options */}
          {playerCount < 2 && (
            <div className="w-full max-w-sm">
              <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${theme.surfaceColor}80`, border: `1px solid ${theme.borderColor}` }}>
                <p className="text-sm mb-3" style={{ color: theme.textSecondary }}>
                  {isRTL ? 'לא רוצים לחכות?' : "Don't want to wait?"}
                </p>

                {/* Play vs Bot */}
                <button
                  onClick={handlePlayBot}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all active:scale-95 text-white mb-2"
                  style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
                >
                  🤖 {isRTL ? 'שחקו עם בוט' : 'Play vs Bot'}
                </button>

                {/* WhatsApp invite */}
                {enableWhatsApp && shortId && (
                  <button
                    onClick={handleWhatsAppInvite}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all active:scale-95 text-white"
                    style={{ background: '#25D366' }}
                  >
                    <Share2 className="w-4 h-4" />
                    {isRTL ? 'שלחו הזמנה בוואטסאפ' : 'Invite via WhatsApp'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lobby Chat */}
      {localPhase === 'lobby' && config.chatEnabled !== false && (
        <LobbyChat
          codeId={codeId}
          visitorId={visitorId}
          playerNickname={playerNickname}
          playerAvatarType={playerAvatarType}
          playerAvatarValue={playerAvatarValue}
          phrases={config.chatPhrases?.length ? config.chatPhrases : DEFAULT_CHAT_PHRASES}
          connectedPlayers={Object.entries(players)
            .filter(([pid]) => pid !== visitorId)
            .map(([pid, p]) => ({ id: pid, nickname: p.nickname, avatarType: p.avatarType, avatarValue: p.avatarValue }))}
          isRTL={isRTL}
          onViewLeaderboard={onViewLeaderboard}
          viewerCount={viewerCount}
        />
      )}

      {/* ── COUNTDOWN 3-2-1 ── */}
      {localPhase === 'countdown' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div
              key={countdownNum}
              className="text-9xl font-black animate-in zoom-in-50 duration-300"
              style={{ color: theme.primaryColor }}
            >
              {countdownNum}
            </div>
            <p className="text-lg mt-4" style={{ color: theme.textSecondary }}>
              {isRTL ? `סיבוב ${(room.currentRound || 0) + 1}` : `Round ${(room.currentRound || 0) + 1}`}
            </p>
            <p className="text-sm mt-1" style={{ color: theme.textSecondary }}>
              {isRTL ? `זכרו ${room.difficulty} אימוג׳ים` : `Remember ${room.difficulty} emojis`}
            </p>
          </div>
        </div>
      )}

      {/* ── MEMORIZE ── */}
      {localPhase === 'memorize' && (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Timer bar */}
          <div className="w-full max-w-sm h-2 rounded-full overflow-hidden mb-8" style={{ backgroundColor: theme.surfaceColor }}>
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${memorizeTimer.progress * 100}%`,
                backgroundColor: theme.accentColor,
              }}
            />
          </div>

          <p className="text-sm mb-4 font-medium" style={{ color: theme.textSecondary }}>
            {isRTL ? 'זכרו את הסדר מימין לשמאל!' : 'Remember the order, right to left!'}
          </p>

          {/* Target emojis displayed */}
          <div className={`flex items-center justify-center ${(room.targetEmojis || []).length > 4 ? 'gap-2' : 'gap-4'}`}>
            {(room.targetEmojis || []).map((emoji, i) => (
              <div
                key={i}
                className={`rounded-2xl flex items-center justify-center animate-in zoom-in-50 duration-300 ${
                  (room.targetEmojis || []).length > 4 ? 'w-14 h-14 text-3xl' : 'w-16 h-16 text-4xl'
                }`}
                style={{
                  animationDelay: `${i * 150}ms`,
                  animationFillMode: 'backwards',
                  backgroundColor: theme.surfaceColor,
                  border: `2px solid ${theme.primaryColor}40`,
                }}
              >
                {emoji}
              </div>
            ))}
          </div>

          <p className="text-xs mt-6" style={{ color: theme.textSecondary }}>
            {isRTL ? `${room.difficulty} אימוג׳ים` : `${room.difficulty} emojis`}
          </p>
        </div>
      )}

      {/* ── RECALL (guessing) ── */}
      {localPhase === 'recall' && (
        <div className="flex-1 flex flex-col items-center px-4 py-6">
          {/* Timer bar */}
          <div className="w-full max-w-sm h-2 rounded-full overflow-hidden mb-3" style={{ backgroundColor: theme.surfaceColor }}>
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${recallTimer.progress * 100}%`,
                backgroundColor: recallTimer.timeLeft < 3 ? '#ef4444' : theme.primaryColor,
              }}
            />
          </div>

          {/* Status + timer */}
          <p className="text-sm mb-1 font-medium" style={{ color: theme.textColor }}>
            {amEliminated
              ? (isRTL ? 'נפסלת! ⛔' : 'Eliminated! ⛔')
              : roundFailed
                ? (isRTL ? 'טעות! ❌' : 'Wrong! ❌')
                : roundSubmitted
                  ? (isRTL ? 'מצוין! ✅' : 'Perfect! ✅')
                  : (isRTL ? 'בחרו לפי הסדר מימין לשמאל' : 'Pick in order, right to left')}
          </p>
          <p className="text-xs mb-4 tabular-nums" style={{ color: recallTimer.timeLeft < 3 ? '#ef4444' : theme.textSecondary }}>
            {Math.ceil(recallTimer.timeLeft)}s
          </p>

          {/* Target squares (same style as memorize phase — empty slots to fill) */}
          <div className={`flex items-center justify-center mb-6 ${room.difficulty > 4 ? 'gap-2' : 'gap-4'}`}>
            {Array.from({ length: room.difficulty }).map((_, i) => {
              const emoji = selections[i];
              const isCorrect = emoji && room.targetEmojis[i] === emoji;
              const isWrong = emoji && room.targetEmojis[i] !== emoji;
              const isNextSlot = !emoji && i === selections.length && !roundFailed && !roundSubmitted && !amEliminated;

              return (
                <div
                  key={i}
                  className={`rounded-2xl flex items-center justify-center transition-all ${
                    room.difficulty > 4 ? 'w-14 h-14 text-3xl' : 'w-16 h-16 text-4xl'
                  } ${emoji ? 'animate-in zoom-in-50 duration-200' : ''} ${isNextSlot ? 'animate-pulse' : ''}`}
                  style={{
                    backgroundColor: isWrong
                      ? 'rgba(239,68,68,0.15)'
                      : isCorrect
                        ? `${theme.accentColor}15`
                        : isNextSlot
                          ? 'rgba(16,185,129,0.12)'
                          : theme.surfaceColor,
                    border: `2px solid ${
                      isWrong ? '#ef4444' : isCorrect ? theme.accentColor : isNextSlot ? '#10b981' : `${theme.primaryColor}40`
                    }`,
                  }}
                >
                  {emoji || (
                    <span className="text-lg font-bold" style={{ color: isNextSlot ? '#10b981' : `${theme.textSecondary}40` }}>{i + 1}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Instruction */}
          {!roundFailed && !roundSubmitted && !amEliminated && (
            <p className="text-xs mb-3" style={{ color: theme.textSecondary }}>
              {isRTL ? 'בחרו מלמטה מימין לשמאל:' : 'Pick from below, right to left:'}
            </p>
          )}

          {/* Options grid (3x3) */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
            {(room.options || []).map((emoji, i) => {
              const isSelected = selections.includes(emoji);
              const disabled = roundFailed || roundSubmitted || amEliminated || isSelected;

              return (
                <button
                  key={i}
                  onClick={() => handleSelectEmoji(emoji)}
                  disabled={disabled}
                  className={`aspect-square rounded-2xl text-3xl flex items-center justify-center transition-all active:scale-90 animate-in zoom-in-50 duration-200 ${
                    isSelected ? 'opacity-25 scale-90' : disabled ? 'opacity-50' : 'hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: isSelected ? theme.borderColor : theme.surfaceColor,
                    border: `2px solid ${theme.borderColor}`,
                    animationDelay: `${i * 50}ms`,
                    animationFillMode: 'backwards',
                  }}
                >
                  {emoji}
                </button>
              );
            })}
          </div>

          {/* Player status bar */}
          <div className="w-full max-w-sm mt-auto pt-4 flex flex-wrap gap-2 justify-center">
            {Object.entries(players).map(([pid, p]) => {
              if (p.eliminated) return null;
              const hasSubmitted = p.roundResult != null;
              return (
                <div
                  key={pid}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                  style={{
                    backgroundColor: hasSubmitted ? `${theme.accentColor}20` : theme.surfaceColor,
                    border: `1px solid ${hasSubmitted ? theme.accentColor : theme.borderColor}`,
                    color: hasSubmitted ? theme.accentColor : theme.textSecondary,
                  }}
                >
                  {p.avatarType === 'selfie' && p.avatarValue?.startsWith('http') ? (
                    <img src={p.avatarValue} alt="" className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <span>{p.avatarValue || '🎮'}</span>
                  )}
                  <span>{p.nickname}</span>
                  {hasSubmitted && <span>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ROUND RESULTS ── */}
      {localPhase === 'results' && room.status !== 'finished' && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative">
          {/* Score popup animation */}
          {scorePopup && (
            <div
              key={scorePopup.key}
              className="absolute top-8 animate-in zoom-in-50 duration-500"
              style={{ color: theme.accentColor }}
            >
              <span className="text-4xl font-black animate-bounce">+{scorePopup.points}</span>
            </div>
          )}

          <h3 className="text-xl font-bold mb-1" style={{ color: theme.textColor }}>
            {isRTL ? `תוצאות סיבוב ${(room.currentRound || 0) + 1}` : `Round ${(room.currentRound || 0) + 1} Results`}
          </h3>
          <p className="text-xs mb-6" style={{ color: theme.textSecondary }}>
            {isRTL ? 'הסדר הנכון:' : 'Correct order:'} {(room.targetEmojis || []).join(' ')}
          </p>

          <div className="w-full max-w-sm space-y-2">
            {Object.entries(players)
              .sort(([, a], [, b]) => b.score - a.score)
              .map(([pid, p]) => {
                const result = p.roundResult;
                const justEliminated = p.strikes >= room.maxStrikes;

                return (
                  <div
                    key={pid}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${justEliminated ? 'opacity-50' : ''}`}
                    style={{
                      backgroundColor: theme.surfaceColor,
                      border: `1px solid ${
                        result?.failed ? 'rgba(239,68,68,0.3)' : `${theme.accentColor}30`
                      }`,
                    }}
                  >
                    {p.avatarType === 'selfie' && p.avatarValue?.startsWith('http') ? (
                      <img src={p.avatarValue} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="text-2xl">{p.avatarValue || '🎮'}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate" style={{ color: theme.textColor }}>
                          {p.nickname}
                          {pid === visitorId && <span className="text-xs" style={{ color: theme.accentColor }}> ({isRTL ? 'אתה' : 'You'})</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: theme.textSecondary }}>
                          {isRTL ? `${p.score} נק׳` : `${p.score} pts`}
                        </span>
                        {p.strikes > 0 && (
                          <span className="text-xs text-red-400">
                            {'❌'.repeat(p.strikes)}
                          </span>
                        )}
                        {justEliminated && (
                          <span className="text-xs text-red-400 font-medium">
                            {isRTL ? 'הודח!' : 'OUT!'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-lg">
                      {!result ? '⏳' : result.failed ? '❌' : '✅'}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── GAME OVER ── */}
      {localPhase === 'gameOver' && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div
            className="text-6xl mb-4"
            style={{
              animation: 'bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              opacity: 0,
            }}
          >
            🏆
          </div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{
              color: theme.textColor,
              animation: 'slideUp 0.5s ease-out 0.2s forwards',
              opacity: 0,
            }}
          >
            {isRTL ? 'המשחק נגמר!' : 'Game Over!'}
          </h2>

          {/* Final rankings */}
          <div className="w-full max-w-sm space-y-2 mt-4 mb-8">
            {Object.entries(players)
              .sort(([, a], [, b]) => {
                const aElim = a.strikes >= room.maxStrikes ? 1 : 0;
                const bElim = b.strikes >= room.maxStrikes ? 1 : 0;
                if (aElim !== bElim) return aElim - bElim;
                if (b.score !== a.score) return b.score - a.score;
                return a.strikes - b.strikes;
              })
              .map(([pid, p], idx) => (
                <div
                  key={pid}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    backgroundColor: idx === 0 ? `${theme.primaryColor}15` : theme.surfaceColor,
                    border: `1px solid ${idx === 0 ? `${theme.primaryColor}40` : theme.borderColor}`,
                    animation: `slideUpBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.4 + idx * 0.15}s forwards`,
                    opacity: 0,
                    transform: 'translateY(30px)',
                  }}
                >
                  <span className="text-lg font-bold w-8 text-center" style={{ color: idx === 0 ? theme.primaryColor : theme.textSecondary }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  {p.avatarType === 'selfie' && p.avatarValue?.startsWith('http') ? (
                    <img src={p.avatarValue} alt="" className="w-10 h-10 rounded-full object-cover" style={{ border: `2px solid ${idx === 0 ? theme.primaryColor : theme.borderColor}` }} />
                  ) : (
                    <span className="text-2xl">{p.avatarValue || '🎮'}</span>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-sm" style={{ color: theme.textColor }}>
                      {p.nickname}
                      {pid === visitorId && <span className="text-xs" style={{ color: theme.accentColor }}> ({isRTL ? 'אתה' : 'You'})</span>}
                    </p>
                    <p className="text-xs" style={{ color: theme.textSecondary }}>
                      {p.score} {isRTL ? 'נק׳' : 'pts'} · {p.strikes} {'❌'}
                    </p>
                  </div>
                </div>
              ))}
          </div>

          {/* Action buttons */}
          <button
            onClick={handleGameOver}
            className="w-full max-w-sm py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-[0.97]"
            style={{
              background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
              animation: `slideUp 0.4s ease-out ${0.4 + Object.keys(players).length * 0.15 + 0.2}s forwards`,
              opacity: 0,
            }}
          >
            {isRTL ? 'חזרה למשחקים' : 'Back to Games'}
          </button>

          <style>{`
            @keyframes bounceIn {
              0% { opacity: 0; transform: scale(0.3); }
              50% { transform: scale(1.1); }
              100% { opacity: 1; transform: scale(1); }
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideUpBounce {
              0% { opacity: 0; transform: translateY(30px) scale(0.95); }
              60% { transform: translateY(-5px) scale(1.02); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
