'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Share2 } from 'lucide-react';
import ExitGameButton from './ExitGameButton';
import QGamesVSScreen from './QGamesVSScreen';
import {
  QGamesConfig,
  QGamesAvatarType,
  RTDBFroggerPlayer,
  DEFAULT_CHAT_PHRASES,
  QGamesRecord,
} from '@/types/qgames';
import LobbyChat from './LobbyChat';
import { useQGamesTheme } from '@/components/qgames/QGamesThemeContext';
import {
  createFroggerRoom,
  joinFroggerRoom,
  leaveFroggerRoom,
  findActiveFroggerRoom,
  startFroggerGame,
  updateFroggerPlayerPosition,
  eliminateFroggerPlayer,
  finishFroggerRoom,
} from '@/lib/qgames-realtime';
import { useFroggerRoom, useFroggerPlayers, useQGamesSounds, useGameRecord } from '@/hooks/useQGamesRealtime';
import {
  generateLanes,
  getEnemyPositions,
  getPlayerRect,
  checkPlayerEnemyCollision,
  assignColumns,
  getTotalColumns,
  TOTAL_ROWS,
  SAFE_ROW_TOP,
  PLAYER_BASE_SIZE,
  type FroggerLane,
  type EnemyPosition,
  type GridDimensions,
} from '@/lib/frogger-engine';

// ============ Types ============

interface FroggerGameProps {
  codeId: string;
  visitorId: string;
  playerNickname: string;
  playerAvatarType: QGamesAvatarType;
  playerAvatarValue: string;
  config: QGamesConfig;
  onMatchEnd: (results: FroggerGameResult) => void;
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

export interface FroggerGameResult {
  roomId: string;
  winnerId: string | null;
  winnerNickname: string;
  players: Array<{
    id: string;
    nickname: string;
    avatarType: QGamesAvatarType;
    avatarValue: string;
    score: number;
    screensCompleted: number;
    rank: number;
  }>;
}

type GamePhase = 'lobby' | 'countdown' | 'playing' | 'gameOver';

// ============ Helpers ============

function generateRoomId(): string {
  return `frog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Player colors for multiplayer (ring colors)
const PLAYER_COLORS = ['#EF4444', '#10B981', '#3B82F6', '#F59E0B'];

// ============ Translations ============

const translations = {
  he: {
    waitingForPlayers: 'ממתינים לשחקנים...',
    startGame: 'התחילו!',
    eliminated: 'הודחת!',
    screenComplete: 'שלב הושלם! +10',
    lastStanding: 'אחרון שורד!',
    score: 'ניקוד',
    level: 'שלב',
    tapToJump: 'לחצו לקפיצה!',
    playBot: 'שחקו עם בוט',
    dontWait: 'לא רוצים לחכות?',
    inviteWhatsApp: 'שלחו הזמנה בוואטסאפ',
    gameOver: 'המשחק נגמר!',
    winner: 'מנצח!',
    readyToStart: 'מוכנים להתחיל!',
    players: 'שחקנים',
    record: 'שיא',
    newRecord: 'שיא חדש!',
    previousRecord: 'השיא הקודם',
  },
  en: {
    waitingForPlayers: 'Waiting for players...',
    startGame: 'Start!',
    eliminated: 'Eliminated!',
    screenComplete: 'Screen Complete! +10',
    lastStanding: 'Last one standing!',
    score: 'Score',
    level: 'Level',
    tapToJump: 'Tap to jump!',
    playBot: 'Play vs Bot',
    dontWait: "Don't want to wait?",
    inviteWhatsApp: 'Invite via WhatsApp',
    gameOver: 'Game Over!',
    winner: 'Winner!',
    readyToStart: 'Ready to start!',
    players: 'Players',
    record: 'Record',
    newRecord: 'New Record!',
    previousRecord: 'Previous record',
  },
};

// ============ Game Over Component ============

function CountUpScore({ target, duration = 1200, delay = 0 }: { target: number; duration?: number; delay?: number }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (target <= 0) { setCurrent(target); return; }
    const delayTimer = setTimeout(() => {
      const startTime = performance.now();
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setCurrent(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(delayTimer);
  }, [target, duration, delay]);
  return <>{current}</>;
}

function FroggerGameOver({ players, visitorId, theme, isRTL, tr, onBack, currentRecord }: {
  players: Record<string, RTDBFroggerPlayer>;
  visitorId: string;
  theme: ReturnType<typeof useQGamesTheme>;
  isRTL: boolean;
  tr: typeof translations['he'];
  onBack: () => void;
  currentRecord: QGamesRecord | null;
}) {
  const sorted = useMemo(() =>
    Object.entries(players)
      .sort(([, a], [, b]) => {
        if (a.eliminatedAt === null && b.eliminatedAt !== null) return -1;
        if (a.eliminatedAt !== null && b.eliminatedAt === null) return 1;
        return b.score - a.score;
      }), [players]);

  // Check if someone beat the record (optimistic — server will also update)
  const myPlayer = players[visitorId];
  const bestNonBotScore = sorted
    .filter(([pid]) => !pid.startsWith('bot_'))
    .map(([, p]) => p.score)[0] || 0;
  const beatRecord = bestNonBotScore > 0 && (!currentRecord || bestNonBotScore > currentRecord.score);
  // The previous record holder (before this game set a new one)
  const prevRecord = beatRecord && currentRecord ? currentRecord : null;

  const RANK_MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center animate-in fade-in duration-500"
      style={{ backgroundColor: theme.backgroundColor }}
    >
      {/* Subtle decorative glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] rounded-full blur-[100px] opacity-30"
        style={{ backgroundColor: beatRecord ? '#F59E0B' : theme.primaryColor }}
      />

      <div className="w-full max-w-sm mx-4 flex flex-col items-center">
        {/* New Record celebration OR standard game over */}
        {beatRecord ? (
          <div className="animate-in zoom-in-50 duration-700 text-center mb-6">
            <div className="text-6xl mb-2 animate-bounce">🏆</div>
            <p className="text-2xl font-black" style={{ color: '#F59E0B', textShadow: '0 0 20px #F59E0B80' }}>
              {tr.newRecord}
            </p>
            <p className="text-4xl font-black mt-1 tabular-nums" style={{ color: '#F59E0B' }}>
              {bestNonBotScore}
            </p>
            {prevRecord && (
              <div className="flex items-center justify-center gap-2 mt-2 animate-in fade-in duration-700" style={{ animationDelay: '600ms', animationFillMode: 'both' }}>
                <span className="text-xs" style={{ color: theme.textSecondary }}>{tr.previousRecord}:</span>
                <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-xs flex-shrink-0"
                  style={{ border: `1px solid ${theme.textSecondary}40` }}>
                  {prevRecord.holderAvatarType === 'selfie' && prevRecord.holderAvatarValue?.startsWith('http') ? (
                    <img src={prevRecord.holderAvatarValue} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px]">{prevRecord.holderAvatarValue}</span>
                  )}
                </div>
                <span className="text-xs" style={{ color: theme.textSecondary }}>
                  {prevRecord.holderNickname} — {prevRecord.score}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in zoom-in-50 duration-700 text-center mb-6">
            <div className="text-6xl mb-2">🏆</div>
            <p className="text-2xl font-black" style={{ color: theme.textColor }}>
              {tr.gameOver}
            </p>
          </div>
        )}

        {/* Player results */}
        <div className="w-full space-y-3">
          {sorted.map(([pid, p], i) => {
            const isMe = pid === visitorId;
            const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
            const animDelay = 400 + i * 250;

            return (
              <div
                key={pid}
                className="animate-in slide-in-from-bottom-4 duration-500 ease-out"
                style={{ animationDelay: `${animDelay}ms`, animationFillMode: 'both' }}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{
                    backgroundColor: isMe ? `${theme.primaryColor}25` : `${theme.surfaceColor}`,
                    border: isMe ? `2px solid ${theme.primaryColor}50` : `1px solid ${theme.textSecondary}20`,
                    boxShadow: i === 0 ? `0 0 20px ${color}30` : undefined,
                  }}
                >
                  {/* Rank */}
                  <span className="text-2xl w-8 text-center flex-shrink-0">
                    {i < 3 ? RANK_MEDALS[i] : `#${i + 1}`}
                  </span>

                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-lg flex-shrink-0"
                    style={{ border: `2px solid ${color}`, backgroundColor: `${color}15` }}
                  >
                    {p.avatarType === 'selfie' && p.avatarValue?.startsWith('http') ? (
                      <img src={p.avatarValue} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{p.avatarValue}</span>
                    )}
                  </div>

                  {/* Name */}
                  <span className="text-sm font-semibold flex-1 truncate" style={{ color: theme.textColor }}>
                    {p.nickname}
                    {isMe && <span style={{ color: theme.textSecondary }}> {isRTL ? '(אני)' : '(me)'}</span>}
                  </span>

                  {/* Score with count-up */}
                  <span className="font-black text-lg tabular-nums" style={{ color }}>
                    <CountUpScore target={p.score} delay={animDelay + 300} />
                  </span>

                  {/* Eliminated indicator */}
                  {p.eliminated && <span className="text-sm">💀</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Back button */}
        <button
          onClick={onBack}
          className="mt-8 px-8 py-3 rounded-2xl font-bold text-white transition-all active:scale-95 animate-in fade-in duration-500"
          style={{
            backgroundColor: theme.primaryColor,
            animationDelay: `${400 + sorted.length * 250 + 400}ms`,
            animationFillMode: 'both',
          }}
        >
          {isRTL ? 'חזרה' : 'Back'}
        </button>
      </div>
    </div>
  );
}

// ============ Component ============

export default function FroggerGame({
  codeId,
  visitorId,
  playerNickname,
  playerAvatarType,
  playerAvatarValue,
  config,
  onMatchEnd,
  onBack,
  isRTL,
  t,
  shortId,
  enableWhatsApp,
  inviterVisitorId,
  viewerCount,
  onViewLeaderboard,
}: FroggerGameProps) {
  const theme = useQGamesTheme();
  const sounds = useQGamesSounds(config.enableSound);
  const tr = translations[isRTL ? 'he' : 'en'];
  const { record: currentRecord } = useGameRecord(codeId, 'frogger');

  // Room state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [localPhase, setLocalPhase] = useState<GamePhase>('lobby');
  const joinedRef = useRef(false);
  const matchEndedRef = useRef(false);

  // Player game state (local, authoritative for this player)
  const [myRow, setMyRow] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [myScreens, setMyScreens] = useState(0);
  const [mySizeMultiplier, setMySizeMultiplier] = useState(1.0);
  const [eliminated, setEliminated] = useState(false);
  const eliminatedRef = useRef(false);
  const [screenCompletePopup, setScreenCompletePopup] = useState(false);
  const [difficulty, setDifficulty] = useState(0);
  const gameSeedRef = useRef<number>(0);
  const lastTapRef = useRef(0);
  const gameFinishedRef = useRef(false);

  // Game engine state
  const [enemies, setEnemies] = useState<EnemyPosition[]>([]);
  const lanesRef = useRef<FroggerLane[] | null>(null);
  const gridRef = useRef<GridDimensions>({
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 390,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 844,
    rows: TOTAL_ROWS,
    rowHeight: (typeof window !== 'undefined' ? window.innerHeight : 844) / TOTAL_ROWS,
  });
  const gameStartRef = useRef<number | null>(null);
  const myColumnRef = useRef(2);

  // Subscribe to room and players
  const { room } = useFroggerRoom(codeId, roomId);
  const { players } = useFroggerPlayers(codeId, roomId);

  const playerCount = Object.keys(players).length;
  const alivePlayers = useMemo(() =>
    Object.entries(players).filter(([, p]) => !p.eliminated),
    [players]
  );

  // ============ Reset to lobby ============
  const resetToLobby = useCallback(() => {
    if (roomId) leaveFroggerRoom(codeId, roomId, visitorId).catch(() => {});
    setRoomId(null);
    setIsHost(false);
    setMyRow(0);
    setMyScore(0);
    setMyScreens(0);
    setMySizeMultiplier(1.0);
    setEliminated(false);
    eliminatedRef.current = false;
    setScreenCompletePopup(false);
    setDifficulty(0);
    setEnemies([]);
    lanesRef.current = null;
    gameStartRef.current = null;
    gameFinishedRef.current = false;
    botEliminatedRef.current = false;
    matchEndedRef.current = false;
    joinedRef.current = false;
    setLocalPhase('lobby');
  }, [roomId, codeId, visitorId]);

  // ============ Viewport measurement ============

  useEffect(() => {
    const updateGrid = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      gridRef.current = {
        viewportWidth: w,
        viewportHeight: h,
        rows: TOTAL_ROWS,
        rowHeight: h / TOTAL_ROWS,
      };
    };
    updateGrid();
    window.addEventListener('resize', updateGrid);
    return () => window.removeEventListener('resize', updateGrid);
  }, []);

  // ============ Join/Create Room on Mount ============

  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;

    window.scrollTo({ top: 0 });

    const init = async () => {
      const totalColumns = getTotalColumns();
      const existingRoomId = await findActiveFroggerRoom(codeId);

      if (existingRoomId) {
        // Count existing players to determine column
        const { getFroggerRoom } = await import('@/lib/qgames-realtime');
        const existingRoom = await getFroggerRoom(codeId, existingRoomId);
        const existingCount = existingRoom?.players ? Object.keys(existingRoom.players).length : 0;
        const columns = assignColumns(existingCount + 1, totalColumns);
        const myCol = columns[existingCount] ?? Math.floor(totalColumns / 2);

        const joined = await joinFroggerRoom(
          codeId, existingRoomId, visitorId,
          playerNickname, playerAvatarType, playerAvatarValue,
          myCol
        );
        if (joined) {
          setRoomId(existingRoomId);
          setIsHost(false);
          myColumnRef.current = myCol;
          return;
        }
      }

      // Create new room
      const newRoomId = generateRoomId();
      const columns = assignColumns(1, totalColumns);
      const myCol = columns[0];
      myColumnRef.current = myCol;

      await createFroggerRoom(
        codeId, newRoomId, visitorId,
        playerNickname, playerAvatarType, playerAvatarValue,
        config.froggerLanes ?? 5,
        config.froggerBaseSpeed ?? 3,
        config.froggerMaxPlayers ?? 4,
        myCol
      );
      setRoomId(newRoomId);
      setIsHost(true);
    };

    init();
  }, [codeId, visitorId, playerNickname, playerAvatarType, playerAvatarValue, config]);

  // ============ Cleanup on unmount ============

  useEffect(() => {
    return () => {
      if (roomId) {
        leaveFroggerRoom(codeId, roomId, visitorId).catch(() => {});
      }
    };
  }, [codeId, roomId, visitorId]);

  // ============ Start Game ============

  const handleStartGame = useCallback(async () => {
    if (!roomId || playerCount < 2) return;
    sounds.playCountdown();
    await startFroggerGame(codeId, roomId);
  }, [roomId, playerCount, codeId, sounds]);

  // ============ Bot play ============

  const handlePlayBot = useCallback(async () => {
    if (!roomId) return;
    const totalColumns = getTotalColumns();
    const columns = assignColumns(2, totalColumns);
    const botCol = columns[1];

    // Add a bot player
    await joinFroggerRoom(
      codeId, roomId, 'bot_frogger',
      '🤖 Bot', 'emoji', '🤖', botCol
    );
    // Start the game
    sounds.playCountdown();
    await startFroggerGame(codeId, roomId);
  }, [roomId, codeId, sounds]);

  // ============ WhatsApp invite ============

  const handleWhatsAppInvite = useCallback(() => {
    if (!shortId) return;
    const baseUrl = `https://qr.playzones.app/v/${shortId}`;
    const params = new URLSearchParams();
    if (inviterVisitorId) params.set('invite', inviterVisitorId);
    params.set('game', 'frogger');
    const shareUrl = `${baseUrl}?${params}`;
    const text = isRTL
      ? `🐸 בואו לשחק פרוגי! ${shareUrl}`
      : `🐸 Come play Frogger! ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }, [shortId, inviterVisitorId, isRTL]);

  // ============ Room status → local phase sync ============

  useEffect(() => {
    if (!room) return;

    if (room.status === 'playing' && localPhase === 'lobby') {
      // Game started: show VS screen
      setLocalPhase('countdown');
      gameStartRef.current = room.startedAt;
      gameSeedRef.current = room.gameSeed;

      // Initialize lanes from seed at difficulty 0
      lanesRef.current = generateLanes(room.gameSeed, room.lanes, room.baseSpeed, 0);

      // Update my column from room data
      const myData = room.players?.[visitorId];
      if (myData) {
        myColumnRef.current = myData.column;
      }
    }

    if (room.status === 'finished' && localPhase !== 'gameOver') {
      setLocalPhase('gameOver');
    }
  }, [room?.status, room?.startedAt, room?.gameSeed, localPhase, visitorId, room]);

  // ============ Countdown complete (from VS screen) ============

  const handleCountdownComplete = useCallback(() => {
    setLocalPhase('playing');
    sounds.playCountdown();
  }, [sounds]);

  // ============ Game Loop (requestAnimationFrame) ============

  useEffect(() => {
    if (localPhase !== 'playing' || !lanesRef.current || !gameStartRef.current) return;

    let animFrameId: number;

    const loop = () => {
      const elapsed = Date.now() - gameStartRef.current!;
      const grid = gridRef.current;
      const currentEnemies = getEnemyPositions(lanesRef.current!, elapsed, grid);
      setEnemies(currentEnemies);

      // Only check collision if not eliminated
      if (!eliminated) {
        const playerRect = getPlayerRect(
          myRow, myColumnRef.current, mySizeMultiplier,
          grid, getTotalColumns()
        );
        if (checkPlayerEnemyCollision(playerRect, currentEnemies)) {
          // Eliminated!
          handleElimination();
          return;
        }
      }

      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameId);
  // We use refs for mutable game state to avoid re-creating the loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localPhase, eliminated, myRow, mySizeMultiplier]);

  // ============ Elimination ============

  const handleElimination = useCallback(() => {
    if (eliminatedRef.current) return;
    eliminatedRef.current = true;
    setEliminated(true);
    sounds.playLoseMatch();

    if (roomId) {
      eliminateFroggerPlayer(codeId, roomId, visitorId).then(() => {
        // Direct game finish if bot is also eliminated (avoids race condition)
        if (isHost && botEliminatedRef.current && !gameFinishedRef.current) {
          gameFinishedRef.current = true;
          finishFroggerRoom(codeId, roomId).catch(console.error);
        }
      }).catch(console.error);
    }
  }, [roomId, codeId, visitorId, sounds, isHost]);

  // ============ Bot AI ============
  const botEliminatedRef = useRef(false);

  // Bot collision check (runs in game loop alongside player)
  useEffect(() => {
    if (localPhase !== 'playing' || !lanesRef.current || !gameStartRef.current || !roomId) return;
    const botPlayer = players['bot_frogger'];
    if (!botPlayer || botPlayer.eliminated || botEliminatedRef.current) return;

    const checkBot = setInterval(() => {
      const bp = players['bot_frogger'];
      if (!bp || bp.eliminated || botEliminatedRef.current) return;
      const elapsed = Date.now() - gameStartRef.current!;
      const grid = gridRef.current;
      const currentEnemies = getEnemyPositions(lanesRef.current!, elapsed, grid);
      const botRect = getPlayerRect(bp.row, bp.column, bp.sizeMultiplier, grid, getTotalColumns());
      if (checkPlayerEnemyCollision(botRect, currentEnemies)) {
        botEliminatedRef.current = true;
        eliminateFroggerPlayer(codeId, roomId, 'bot_frogger').then(() => {
          // Direct game finish if human is also eliminated (avoids race condition)
          if (isHost && eliminatedRef.current && !gameFinishedRef.current) {
            gameFinishedRef.current = true;
            finishFroggerRoom(codeId, roomId).catch(console.error);
          }
        }).catch(console.error);
      }
    }, 200); // Check 5x/sec for bot

    return () => clearInterval(checkBot);
  }, [localPhase, roomId, codeId, players]);

  // Bot jump logic
  useEffect(() => {
    if (localPhase !== 'playing' || !roomId) return;
    const botPlayer = players['bot_frogger'];
    if (!botPlayer || botPlayer.eliminated || botEliminatedRef.current) return;

    const botInterval = setInterval(() => {
      const bp = players['bot_frogger'];
      if (!bp || bp.eliminated || botEliminatedRef.current) return;

      const botRow = bp.row;
      const newRow = botRow + 1;
      let botScore = bp.score + 1;
      let botScreens = bp.screensCompleted;
      let botSize = bp.sizeMultiplier;
      let resetRow = newRow;

      if (newRow >= SAFE_ROW_TOP) {
        botScreens += 1;
        botSize = Math.round((botSize + 0.2) * 100) / 100;
        resetRow = 0;
        botScore += 10;
      }

      updateFroggerPlayerPosition(codeId, roomId, 'bot_frogger', {
        row: resetRow,
        score: botScore,
        screensCompleted: botScreens,
        sizeMultiplier: botSize,
      }).catch(console.error);
    }, 1200 + Math.random() * 1500); // Slower jumps (1.2-2.7s)

    return () => clearInterval(botInterval);
  }, [localPhase, roomId, codeId, players]);

  // ============ Host: detect game over (ALL eliminated) ============

  useEffect(() => {
    if (!isHost || localPhase !== 'playing' || !roomId) return;
    if (playerCount < 2) return;

    const alive = Object.entries(players).filter(([, p]) => !p.eliminated);
    if (alive.length === 0 && !gameFinishedRef.current) {
      gameFinishedRef.current = true;
      finishFroggerRoom(codeId, roomId).catch(console.error);
    }
  }, [isHost, localPhase, roomId, playerCount, players, codeId]);

  // ============ Game Over → report results ============

  useEffect(() => {
    if (localPhase !== 'gameOver' || matchEndedRef.current) return;
    matchEndedRef.current = true;

    // Build sorted results
    const sorted = Object.entries(players)
      .map(([id, p]) => ({
        id,
        nickname: p.nickname,
        avatarType: p.avatarType,
        avatarValue: p.avatarValue,
        score: p.score,
        screensCompleted: p.screensCompleted,
        eliminatedAt: p.eliminatedAt,
      }))
      .sort((a, b) => {
        // Non-eliminated first, then by score desc
        if (a.eliminatedAt === null && b.eliminatedAt !== null) return -1;
        if (a.eliminatedAt !== null && b.eliminatedAt === null) return 1;
        return b.score - a.score;
      });

    const winnerId = sorted[0]?.id || null;
    const winnerNickname = sorted[0]?.nickname || '';

    setTimeout(() => {
      onMatchEnd({
        roomId: roomId!,
        winnerId,
        winnerNickname,
        players: sorted.map((p, i) => ({
          ...p,
          rank: i + 1,
        })),
      });
    }, 2500);
  }, [localPhase, players, roomId, onMatchEnd]);

  // ============ Tap to Jump ============

  const handleTap = useCallback(() => {
    if (eliminated || localPhase !== 'playing') return;

    // Debounce: prevent double-jump from touch+click firing together
    const now = Date.now();
    if (now - lastTapRef.current < 250) return;
    lastTapRef.current = now;

    const newRow = myRow + 1;
    let newScore = myScore + 1;
    let newScreens = myScreens;
    let newSize = mySizeMultiplier;
    let resetRow = newRow;

    // Completed a screen
    if (newRow >= SAFE_ROW_TOP) {
      newScreens += 1;
      newSize = Math.round((newSize + 0.2) * 100) / 100;
      resetRow = 0;
      newScore += 10;
      sounds.playWinRound();

      // Increase difficulty and regenerate lanes
      const newDifficulty = newScreens;
      setDifficulty(newDifficulty);
      if (room) {
        lanesRef.current = generateLanes(gameSeedRef.current, room.lanes, room.baseSpeed, newDifficulty);
      }

      // Show popup
      setScreenCompletePopup(true);
      setTimeout(() => setScreenCompletePopup(false), 1200);
    } else {
      sounds.playSelect();
    }

    setMyRow(resetRow);
    setMyScore(newScore);
    setMyScreens(newScreens);
    setMySizeMultiplier(newSize);

    // Write to RTDB
    if (roomId) {
      updateFroggerPlayerPosition(codeId, roomId, visitorId, {
        row: resetRow,
        score: newScore,
        screensCompleted: newScreens,
        sizeMultiplier: newSize,
      }).catch(console.error);
    }
  }, [eliminated, localPhase, myRow, myScore, myScreens, mySizeMultiplier, roomId, codeId, visitorId, sounds, room]);

  // ============ Render Helpers ============

  const grid = gridRef.current;
  const rowHeight = grid.rowHeight;
  const totalColumns = getTotalColumns();
  const colWidth = grid.viewportWidth / totalColumns;

  // Get player position for rendering
  const getPlayerScreenPos = (row: number, column: number, sizeMul: number) => {
    const baseSize = rowHeight * PLAYER_BASE_SIZE;
    const size = baseSize * sizeMul;
    const x = column * colWidth + (colWidth - size) / 2;
    const y = (TOTAL_ROWS - 1 - row) * rowHeight + (rowHeight - size) / 2;
    return { x, y, size };
  };

  const myPos = getPlayerScreenPos(myRow, myColumnRef.current, mySizeMultiplier);

  // ============ RENDER ============

  return (
    <div
      className="fixed inset-0 flex flex-col select-none"
      style={{
        backgroundColor: theme.backgroundColor,
        touchAction: 'none',
        overscrollBehavior: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {/* Exit button */}
      <ExitGameButton
        onConfirm={() => {
          if (roomId) leaveFroggerRoom(codeId, roomId, visitorId).catch(() => {});
          onBack();
        }}
        isRTL={isRTL}
        t={t}
      />

      {/* ── LOBBY ── */}
      {localPhase === 'lobby' && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
          {/* Title */}
          <div className="text-center">
            <div className="text-6xl mb-2">🐸</div>
            <h2 className="text-2xl font-bold" style={{ color: theme.textColor }}>
              {isRTL ? 'פרוגי' : 'Frogger'}
            </h2>
            <p className="text-sm mt-1" style={{ color: theme.textSecondary }}>
              {isRTL ? 'קפצו בין המכשולים!' : 'Jump through obstacles!'}
            </p>
          </div>

          {/* Players in lobby */}
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ backgroundColor: `${theme.surfaceColor}80`, border: `1px solid ${theme.borderColor}` }}>
            <p className="text-xs font-medium mb-3 text-center" style={{ color: theme.textSecondary }}>
              {tr.players} ({playerCount}/{config.froggerMaxPlayers ?? 4})
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              {Object.entries(players).map(([pid, p], i) => (
                <div key={pid} className="flex flex-col items-center gap-1">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl overflow-hidden"
                    style={{
                      border: `3px solid ${PLAYER_COLORS[i % PLAYER_COLORS.length]}`,
                      backgroundColor: `${theme.surfaceColor}`,
                    }}
                  >
                    {p.avatarType === 'selfie' && p.avatarValue?.startsWith('http') ? (
                      <img src={p.avatarValue} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{p.avatarValue}</span>
                    )}
                  </div>
                  <span className="text-[10px] max-w-[60px] truncate" style={{ color: theme.textColor }}>
                    {p.nickname}
                    {pid === visitorId && (isRTL ? ' (אני)' : ' (me)')}
                  </span>
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: Math.max(0, (config.froggerMaxPlayers ?? 4) - playerCount) }).map((_, i) => (
                <div key={`empty-${i}`} className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center" style={{ borderColor: theme.borderColor }}>
                    <span className="text-lg" style={{ color: theme.textSecondary }}>?</span>
                  </div>
                  <span className="text-[10px]" style={{ color: theme.textSecondary }}>&nbsp;</span>
                </div>
              ))}
            </div>

            <p className="text-center text-xs mt-3" style={{ color: theme.textSecondary }}>
              {playerCount < 2 ? tr.waitingForPlayers : tr.readyToStart}
            </p>
          </div>

          {/* Start button */}
          {playerCount >= 2 && (
            <button
              onClick={handleStartGame}
              className="w-full max-w-sm py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-[0.97]"
              style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
            >
              {tr.startGame}
            </button>
          )}

          {/* Bot + WhatsApp */}
          {playerCount < 2 && (
            <div className="w-full max-w-sm">
              <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${theme.surfaceColor}80`, border: `1px solid ${theme.borderColor}` }}>
                <p className="text-sm mb-3" style={{ color: theme.textSecondary }}>
                  {tr.dontWait}
                </p>
                <button
                  onClick={handlePlayBot}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all active:scale-95 text-white mb-2"
                  style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
                >
                  🤖 {tr.playBot}
                </button>

                {enableWhatsApp && shortId && (
                  <button
                    onClick={handleWhatsAppInvite}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all active:scale-95 text-white"
                    style={{ background: '#25D366' }}
                  >
                    <Share2 className="w-4 h-4" />
                    {tr.inviteWhatsApp}
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

      {/* ── VS SCREEN + COUNTDOWN ── */}
      {localPhase === 'countdown' && (() => {
        const playerList = Object.entries(players);
        const me = playerList.find(([pid]) => pid === visitorId);
        const others = playerList.filter(([pid]) => pid !== visitorId);
        return (
          <QGamesVSScreen
            player1Nickname={me?.[1]?.nickname || playerNickname}
            player1Avatar={me?.[1]?.avatarValue || playerAvatarValue}
            player2Nickname={others[0]?.[1]?.nickname || '?'}
            player2Avatar={others[0]?.[1]?.avatarValue || '🤖'}
            player3Nickname={others[1]?.[1]?.nickname}
            player3Avatar={others[1]?.[1]?.avatarValue}
            gameEmoji="🐸"
            onCountdownComplete={handleCountdownComplete}
            isRTL={isRTL}
          />
        );
      })()}

      {/* ── PLAYING ── */}
      {(localPhase === 'playing' || localPhase === 'gameOver') && (
        <div
          className="flex-1 relative overflow-hidden"
          onTouchStart={(e) => {
            e.preventDefault();
            handleTap();
          }}
          onClick={handleTap}
          style={{ touchAction: 'none' }}
        >
          {/* HUD - Score & Level */}
          <div
            className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2"
            style={{ backgroundColor: `${theme.backgroundColor}cc` }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-lg"
                style={{ border: `2px solid ${PLAYER_COLORS[0]}` }}
              >
                {playerAvatarType === 'selfie' && playerAvatarValue?.startsWith('http') ? (
                  <img src={playerAvatarValue} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm">{playerAvatarValue}</span>
                )}
              </div>
              <span className="font-bold text-lg" style={{ color: theme.textColor }}>
                {myScore}
              </span>
            </div>

            <div className="text-center flex flex-col items-center gap-0.5">
              <span className="text-xs" style={{ color: theme.textSecondary }}>
                {tr.level} {myScreens + 1}
              </span>
              {currentRecord && (
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-all duration-300 ${myScore > currentRecord.score ? 'animate-pulse' : ''}`}
                  style={{
                    backgroundColor: myScore > currentRecord.score ? '#F59E0B30' : `${theme.surfaceColor}80`,
                    border: myScore > currentRecord.score ? '1px solid #F59E0B60' : 'none',
                  }}
                >
                  <span className="text-[10px]">🏆</span>
                  <span
                    className="text-[10px] font-bold tabular-nums"
                    style={{ color: myScore > currentRecord.score ? '#F59E0B' : theme.textSecondary }}
                  >
                    {currentRecord.score}
                  </span>
                </div>
              )}
            </div>

            {/* Other players scores */}
            <div className="flex items-center gap-2">
              {Object.entries(players)
                .filter(([pid]) => pid !== visitorId)
                .slice(0, 3)
                .map(([pid, p], i) => (
                  <div key={pid} className="flex items-center gap-1">
                    <span
                      className={`font-bold text-sm ${p.eliminated ? 'line-through opacity-50' : ''}`}
                      style={{ color: PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length] }}
                    >
                      {p.score}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Safe zones */}
          {/* Top safe zone */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: 0,
              height: rowHeight,
              backgroundColor: '#10B98120',
              borderBottom: `2px dashed #10B98140`,
            }}
          />
          {/* Bottom safe zone */}
          <div
            className="absolute left-0 right-0"
            style={{
              bottom: 0,
              height: rowHeight,
              backgroundColor: '#10B98120',
              borderTop: `2px dashed #10B98140`,
            }}
          />

          {/* Lane dividers (subtle) */}
          {Array.from({ length: TOTAL_ROWS - 1 }).map((_, i) => (
            <div
              key={`lane-${i}`}
              className="absolute left-0 right-0"
              style={{
                top: (i + 1) * rowHeight,
                height: 1,
                backgroundColor: `${theme.borderColor}30`,
              }}
            />
          ))}

          {/* Enemies */}
          {enemies.map((enemy, i) => (
            <div
              key={`e-${enemy.laneIndex}-${i}`}
              className="absolute rounded-full"
              style={{
                left: 0,
                top: 0,
                width: enemy.w,
                height: enemy.h,
                backgroundColor: enemy.color,
                borderRadius: enemy.h / 2,
                transform: `translate3d(${enemy.x}px, ${enemy.y}px, 0)`,
                willChange: 'transform',
              }}
            />
          ))}

          {/* Other players (from RTDB) */}
          {Object.entries(players)
            .filter(([pid]) => pid !== visitorId)
            .map(([pid, p], i) => {
              if (p.eliminated) return null;
              const pos = getPlayerScreenPos(p.row, p.column, p.sizeMultiplier);
              return (
                <div
                  key={pid}
                  className="absolute rounded-full overflow-hidden flex items-center justify-center transition-all duration-200"
                  style={{
                    left: 0,
                    top: 0,
                    width: pos.size,
                    height: pos.size,
                    transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                    border: `3px solid ${PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length]}`,
                    opacity: 0.7,
                    zIndex: 10,
                  }}
                >
                  {p.avatarType === 'selfie' && p.avatarValue?.startsWith('http') ? (
                    <img src={p.avatarValue} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">{p.avatarValue}</span>
                  )}
                </div>
              );
            })
          }

          {/* My player */}
          {!eliminated && (
            <div
              className="absolute rounded-full overflow-hidden flex items-center justify-center z-20 transition-all duration-150"
              style={{
                left: 0,
                top: 0,
                width: myPos.size,
                height: myPos.size,
                transform: `translate3d(${myPos.x}px, ${myPos.y}px, 0)`,
                border: `3px solid ${PLAYER_COLORS[0]}`,
                boxShadow: `0 0 12px ${PLAYER_COLORS[0]}60`,
              }}
            >
              {playerAvatarType === 'selfie' && playerAvatarValue?.startsWith('http') ? (
                <img src={playerAvatarValue} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">{playerAvatarValue}</span>
              )}
            </div>
          )}

          {/* Screen complete popup */}
          {screenCompletePopup && (
            <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
              <div
                className="text-2xl font-black px-6 py-3 rounded-2xl animate-in zoom-in-75 duration-300"
                style={{
                  backgroundColor: `${theme.surfaceColor}ee`,
                  color: '#10B981',
                  border: `2px solid #10B981`,
                }}
              >
                {tr.screenComplete}
              </div>
            </div>
          )}

          {/* Eliminated overlay */}
          {eliminated && localPhase === 'playing' && (
            <div className="absolute inset-0 flex items-center justify-center z-40"
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}>
              <div
                className="text-center px-8 py-6 rounded-3xl animate-in zoom-in-75 duration-300"
                style={{ backgroundColor: `${theme.surfaceColor}ee`, border: `2px solid #EF4444` }}
              >
                <div className="text-5xl mb-2">💀</div>
                <p className="text-xl font-bold" style={{ color: '#EF4444' }}>
                  {tr.eliminated}
                </p>
                <p className="text-sm mt-2" style={{ color: theme.textSecondary }}>
                  {tr.score}: {myScore}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    resetToLobby();
                  }}
                  className="mt-4 px-6 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                  style={{ backgroundColor: `${theme.textSecondary}80` }}
                >
                  {isRTL ? 'חזרה' : 'Back'}
                </button>
              </div>
            </div>
          )}

          {/* Game Over overlay */}
          {localPhase === 'gameOver' && (
            <FroggerGameOver
              players={players}
              visitorId={visitorId}
              theme={theme}
              isRTL={isRTL}
              tr={tr}
              currentRecord={currentRecord}
              onBack={resetToLobby}
            />
          )}

          {/* Tap hint (first 3 seconds) */}
          {localPhase === 'playing' && !eliminated && myRow === 0 && myScore === 0 && (
            <div className="absolute bottom-20 left-0 right-0 flex justify-center z-30 pointer-events-none animate-pulse">
              <div
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{ backgroundColor: `${theme.surfaceColor}cc`, color: theme.textSecondary }}
              >
                👆 {tr.tapToJump}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
