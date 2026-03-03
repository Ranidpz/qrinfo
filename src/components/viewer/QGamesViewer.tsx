'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  QGamesConfig,
  QGamesPlayer,
  QGameType,
  GAME_META,
  DEFAULT_QGAMES_CONFIG,
  DEFAULT_QGAMES_EMOJI_PALETTE,
} from '@/types/qgames';
import { getOrCreateVisitorId } from '@/lib/xp';
import { findOrWaitForOpponent, tryMatchFromQueue, cancelMatchmaking } from '@/lib/qgames-matchmaking';
import {
  initQGamesSession,
  initRPSState,
  updateMatchStatus,
  subscribeToQueue,
} from '@/lib/qgames-realtime';
import {
  useQGamesQueueEntry,
  useQGamesMatch,
  useQGamesLeaderboard,
} from '@/hooks/useQGamesRealtime';

import QGamesRegistration from '@/components/qgames/QGamesRegistration';
import QGamesSelector from '@/components/qgames/QGamesSelector';
import QGamesQueue from '@/components/qgames/QGamesQueue';
import QGamesVSScreen from '@/components/qgames/QGamesVSScreen';
import RPSGame from '@/components/qgames/RPSGame';
import QGamesResult from '@/components/qgames/QGamesResult';
import QGamesLeaderboard from '@/components/qgames/QGamesLeaderboard';
import QGamesMatchHistory from '@/components/qgames/QGamesMatchHistory';

// ============ Translations ============
const translations: Record<string, Record<string, string>> = {
  he: {
    joinToPlay: 'הצטרפו לשחק!',
    chooseAvatar: 'בחרו אווטר',
    enterNickname: 'הכינוי שלכם',
    nicknameMinLength: 'לפחות 2 תווים',
    registrationError: 'שגיאה בהרשמה',
    registering: 'נרשם...',
    letsPlay: 'בואו נשחק! 🎮',
    selectGame: 'בחרו משחק',
    rps: 'אבן נייר ומספריים',
    rpsDescription: 'מי ינצח? הראשון ל-3!',
    tictactoe: 'איקס מיקס דריקס',
    tictactoeDescription: '3 ברצף מנצחים!',
    memory: 'זיכרון',
    memoryDescription: 'מצאו את הזוגות!',
    viewLeaderboard: 'טבלת מובילים',
    searchingForOpponent: 'מחפש יריב',
    noOpponentYet: 'אין יריב כרגע?',
    inviteViaWhatsApp: 'שלח הזמנה בוואטסאפ',
    round: 'סיבוב',
    firstTo: 'ראשון ל-',
    rock: 'אבן',
    paper: 'נייר',
    scissors: 'מספריים',
    makeYourChoice: 'בחרו!',
    waitingForOpponent: 'מחכה ליריב...',
    youWonRound: 'ניצחת!',
    youLostRound: 'הפסדת',
    draw: 'תיקו!',
    youWon: 'ניצחת! 🎉',
    youLost: 'הפסדת',
    playAgain: 'שחק שוב',
    backToGames: 'חזרה למשחקים',
    leaderboard: 'טבלת מובילים',
    noPlayersYet: 'עדיין אין שחקנים',
    you: 'אתה',
    pts: 'נק׳',
    recentMatches: 'משחקים אחרונים',
    takeSelfie: 'צלם סלפי',
    or: 'או',
    share: 'שתף',
    joinAndPlay: 'הצטרפו למשחק!',
    challengeMessage: 'אתגר אותך למשחק! בוא נראה מי טוב יותר 🎮',
    challenge: 'אתגר',
    playNow: 'שחקו עכשיו!',
  },
  en: {
    joinToPlay: 'Join the game!',
    chooseAvatar: 'Choose avatar',
    enterNickname: 'Your nickname',
    nicknameMinLength: 'At least 2 characters',
    registrationError: 'Registration error',
    registering: 'Registering...',
    letsPlay: "Let's play! 🎮",
    selectGame: 'Choose a game',
    rps: 'Rock Paper Scissors',
    rpsDescription: 'Who will win? First to 3!',
    tictactoe: 'Tic-Tac-Toe',
    tictactoeDescription: '3 in a row wins!',
    memory: 'Memory Match',
    memoryDescription: 'Find the matching pairs!',
    viewLeaderboard: 'Leaderboard',
    searchingForOpponent: 'Looking for opponent',
    noOpponentYet: 'No opponent yet?',
    inviteViaWhatsApp: 'Invite via WhatsApp',
    round: 'Round',
    firstTo: 'First to ',
    rock: 'Rock',
    paper: 'Paper',
    scissors: 'Scissors',
    makeYourChoice: 'Make your choice!',
    waitingForOpponent: 'Waiting for opponent...',
    youWonRound: 'You won!',
    youLostRound: 'You lost',
    draw: 'Draw!',
    youWon: 'You Won! 🎉',
    youLost: 'You Lost',
    playAgain: 'Play Again',
    backToGames: 'Back to Games',
    leaderboard: 'Leaderboard',
    noPlayersYet: 'No players yet',
    you: 'You',
    pts: 'pts',
    recentMatches: 'Recent Matches',
    takeSelfie: 'Take Selfie',
    or: 'or',
    share: 'Share',
    joinAndPlay: 'Join and play!',
    challengeMessage: 'I challenge you to a game! Let\'s see who\'s better 🎮',
    challenge: 'Challenge',
    playNow: 'Play Now!',
  },
};

type ViewPhase = 'registration' | 'selector' | 'queue' | 'vs' | 'playing' | 'result' | 'leaderboard';

interface QGamesViewerProps {
  codeId: string;
  mediaId: string;
  initialConfig: QGamesConfig;
  shortId: string;
  ownerId: string;
  locale?: 'he' | 'en';
}

export default function QGamesViewer({
  codeId,
  initialConfig,
  shortId,
  ownerId,
  locale,
}: QGamesViewerProps) {
  // Config merge with defaults
  const [config] = useState<QGamesConfig>(() => ({
    ...DEFAULT_QGAMES_CONFIG,
    ...initialConfig,
    branding: {
      ...DEFAULT_QGAMES_CONFIG.branding,
      ...initialConfig.branding,
    },
    emojiPalette: initialConfig.emojiPalette?.length
      ? initialConfig.emojiPalette
      : DEFAULT_QGAMES_EMOJI_PALETTE,
  }));

  // Determine language
  const lang = config.language === 'auto' ? (locale || 'he') : config.language;
  const isRTL = lang === 'he';
  const t = (key: string) => translations[lang]?.[key] || translations.en[key] || key;

  // Phase state machine
  const [phase, setPhase] = useState<ViewPhase>('registration');
  const [player, setPlayer] = useState<QGamesPlayer | null>(null);
  const [selectedGame, setSelectedGame] = useState<QGameType | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [isBotMatch, setIsBotMatch] = useState(false);

  // Bot match fake data
  const [botMatchData, setBotMatchData] = useState<{
    id: string;
    player1Id: string;
    player1Nickname: string;
    player1AvatarValue: string;
    player2Id: string;
    player2Nickname: string;
    player2AvatarValue: string;
  } | null>(null);

  // Result state
  const [resultData, setResultData] = useState<{
    isWinner: boolean;
    isDraw: boolean;
    myScore: number;
    oppScore: number;
    oppNickname: string;
    oppAvatar: string;
  } | null>(null);

  // Visitor ID (state instead of ref so React Compiler allows render-time access)
  const [visitorId] = useState<string>(() => getOrCreateVisitorId());

  // Read invite param from URL (WhatsApp direct invite)
  const [inviteFrom] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('invite');
    }
    return null;
  });

  // Guard against concurrent match attempts
  const matchingRef = useRef(false);

  // Real-time subscriptions
  const { entry: queueEntry } = useQGamesQueueEntry(
    codeId,
    phase === 'queue' ? visitorId : null
  );
  const { match } = useQGamesMatch(codeId, matchId);
  const { entries: leaderboardEntries } = useQGamesLeaderboard(codeId);

  // Initialize RTDB session on mount
  useEffect(() => {
    initQGamesSession(codeId);
  }, [codeId]);

  // Watch queue entry for match found
  useEffect(() => {
    if (phase === 'queue' && queueEntry?.status === 'matched' && queueEntry.matchId) {
      setMatchId(queueEntry.matchId);
      setPhase('vs');
    }
  }, [queueEntry, phase]);

  // Watch full queue for opponents while waiting (fixes race condition)
  useEffect(() => {
    if (phase !== 'queue' || !selectedGame || !player || !visitorId) return;

    const unsubscribe = subscribeToQueue(codeId, async (entries) => {
      if (matchingRef.current) return;

      const hasOpponent = entries.some(
        e => e.gameType === selectedGame && e.status === 'waiting' && e.id !== visitorId
      );

      if (hasOpponent) {
        matchingRef.current = true;
        try {
          const result = await tryMatchFromQueue(
            codeId, visitorId, player.nickname, player.avatarType,
            player.avatarValue, selectedGame, inviteFrom || undefined
          );
          if (result.type === 'matched' && result.matchId) {
            setMatchId(result.matchId);
            setPhase('vs');
          }
        } finally {
          matchingRef.current = false;
        }
      }
    });

    return () => unsubscribe();
  }, [phase, codeId, selectedGame, visitorId, player, inviteFrom]);

  // Re-add to queue if entry is removed while waiting (disconnect recovery)
  useEffect(() => {
    if (phase !== 'queue' || matchingRef.current) return;
    if (!selectedGame || !player || !visitorId) return;
    if (queueEntry !== null) return;

    const reJoin = async () => {
      matchingRef.current = true;
      try {
        const result = await findOrWaitForOpponent(
          codeId, visitorId, player.nickname, player.avatarType,
          player.avatarValue, selectedGame, inviteFrom || undefined
        );
        if (result.type === 'matched' && result.matchId) {
          setMatchId(result.matchId);
          setPhase('vs');
        }
      } finally {
        matchingRef.current = false;
      }
    };

    reJoin();
  }, [queueEntry, phase, codeId, visitorId, selectedGame, player, inviteFrom]);

  // ============ Handlers ============

  const handleRegister = useCallback(async (
    nickname: string,
    avatarType: 'emoji' | 'selfie',
    avatarValue: string
  ) => {
    const response = await fetch('/api/qgames/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codeId,
        playerId: visitorId,
        nickname,
        avatarType,
        avatarValue,
      }),
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error);

    setPlayer(data.player);
    setPhase('selector');
  }, [codeId, visitorId]);

  const handleSelectGame = useCallback(async (gameType: QGameType) => {
    if (!player || !visitorId) return;

    setSelectedGame(gameType);
    setPhase('queue');

    const result = await findOrWaitForOpponent(
      codeId,
      visitorId,
      player.nickname,
      player.avatarType,
      player.avatarValue,
      gameType,
      inviteFrom || undefined
    );

    if (result.type === 'matched' && result.matchId) {
      setMatchId(result.matchId);
      setPhase('vs');
    }
    // If 'waiting', the queue watcher will handle matching when opponent appears
  }, [codeId, player, visitorId, inviteFrom]);

  const handleCancelQueue = useCallback(async () => {
    if (visitorId) {
      await cancelMatchmaking(codeId, visitorId);
    }
    setSelectedGame(null);
    setPhase('selector');
  }, [codeId, visitorId]);

  const handlePlayBot = useCallback(async () => {
    if (!player) return;

    // Cancel any active matchmaking
    if (visitorId) {
      await cancelMatchmaking(codeId, visitorId);
    }

    setIsBotMatch(true);
    const fakeBotMatch = {
      id: `bot-${Date.now()}`,
      player1Id: visitorId,
      player1Nickname: player.nickname,
      player1AvatarValue: player.avatarValue,
      player2Id: 'bot',
      player2Nickname: isRTL ? 'בוט' : 'Bot',
      player2AvatarValue: '🤖',
    };
    setBotMatchData(fakeBotMatch);
    setPhase('vs');
  }, [player, visitorId, codeId, isRTL]);

  const handleVSCountdownComplete = useCallback(async () => {
    if (isBotMatch) {
      // Bot match: skip RTDB setup, go straight to playing
      setPhase('playing');
      return;
    }

    if (!matchId || !selectedGame) return;

    // Start the game
    await updateMatchStatus(codeId, matchId, 'playing');

    if (selectedGame === 'rps') {
      // Only player1 initializes RPS state to avoid timestamp race
      const isPlayer1 = match?.player1Id === visitorId;
      if (isPlayer1) {
        await initRPSState(codeId, matchId, config.rpsFirstTo, config.rpsFirstRoundTimer);
      }
    }

    setPhase('playing');
  }, [codeId, matchId, selectedGame, config, isBotMatch, match, visitorId]);

  const handleMatchEnd = useCallback((winnerId: string | null, p1Score: number, p2Score: number) => {
    const activeMatch = isBotMatch ? botMatchData : match;
    if (!activeMatch || !player) return;

    const isP1 = activeMatch.player1Id === visitorId;
    const iWon = winnerId === visitorId;
    const isDraw = winnerId === null;

    setResultData({
      isWinner: iWon,
      isDraw,
      myScore: isP1 ? p1Score : p2Score,
      oppScore: isP1 ? p2Score : p1Score,
      oppNickname: isP1 ? activeMatch.player2Nickname : activeMatch.player1Nickname,
      oppAvatar: isP1 ? activeMatch.player2AvatarValue : activeMatch.player1AvatarValue,
    });

    // Persist match to Firestore (skip for bot matches)
    if (!isBotMatch) {
      fetch('/api/qgames/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          matchId,
          playerId: visitorId,
        }),
      }).catch(console.error);
    }

    setPhase('result');
  }, [match, player, codeId, matchId, isBotMatch, botMatchData, visitorId]);

  const handlePlayAgain = useCallback(() => {
    setMatchId(null);
    setResultData(null);
    setIsBotMatch(false);
    setBotMatchData(null);
    if (selectedGame) {
      handleSelectGame(selectedGame);
    } else {
      setPhase('selector');
    }
  }, [selectedGame, handleSelectGame]);

  const handleBackToSelector = useCallback(() => {
    setMatchId(null);
    setResultData(null);
    setSelectedGame(null);
    setIsBotMatch(false);
    setBotMatchData(null);
    setPhase('selector');
  }, []);

  // ============ Render ============

  const bgColor = config.branding.backgroundColor || '#0a0f1a';

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor }}>
      {phase === 'registration' && (
        <QGamesRegistration
          config={config}
          onRegister={handleRegister}
          ownerId={ownerId}
          codeId={codeId}
          isRTL={isRTL}
          t={t}
        />
      )}

      {phase === 'selector' && player && (
        <QGamesSelector
          config={config}
          playerNickname={player.nickname}
          playerAvatar={player.avatarValue}
          onSelectGame={handleSelectGame}
          onViewLeaderboard={() => setPhase('leaderboard')}
          isRTL={isRTL}
          t={t}
        />
      )}

      {phase === 'queue' && selectedGame && (
        <QGamesQueue
          gameEmoji={GAME_META[selectedGame]?.emoji || '🎮'}
          gameName={t(GAME_META[selectedGame]?.labelKey || selectedGame)}
          playerAvatar={player?.avatarValue || '😎'}
          shortId={shortId}
          inviterVisitorId={visitorId}
          enableWhatsApp={config.enableWhatsAppInvite}
          onCancel={handleCancelQueue}
          onPlayBot={handlePlayBot}
          isRTL={isRTL}
          t={t}
        />
      )}

      {phase === 'vs' && (match || botMatchData) && (() => {
        const vsMatch = isBotMatch ? botMatchData : match;
        if (!vsMatch) return null;
        return (
          <QGamesVSScreen
            player1Nickname={vsMatch.player1Nickname}
            player1Avatar={vsMatch.player1AvatarValue}
            player2Nickname={vsMatch.player2Nickname}
            player2Avatar={vsMatch.player2AvatarValue}
            gameEmoji={GAME_META[selectedGame || 'rps']?.emoji || '✊'}
            onCountdownComplete={handleVSCountdownComplete}
            isRTL={isRTL}
          />
        );
      })()}

      {phase === 'playing' && (match || botMatchData) && selectedGame === 'rps' && (() => {
        const gameMatch = isBotMatch ? botMatchData : match;
        if (!gameMatch) return null;
        const isP1 = gameMatch.player1Id === visitorId;
        return (
          <RPSGame
            codeId={codeId}
            matchId={gameMatch.id}
            playerId={visitorId || ''}
            isPlayer1={isP1}
            player1Nickname={gameMatch.player1Nickname}
            player1Avatar={gameMatch.player1AvatarValue}
            player2Nickname={gameMatch.player2Nickname}
            player2Avatar={gameMatch.player2AvatarValue}
            firstTo={config.rpsFirstTo}
            firstRoundTimer={config.rpsFirstRoundTimer}
            subsequentTimer={config.rpsSubsequentTimer}
            enableSound={config.enableSound}
            onMatchEnd={handleMatchEnd}
            isRTL={isRTL}
            t={t}
            isBotMatch={isBotMatch}
          />
        );
      })()}

      {phase === 'result' && resultData && player && (
        <QGamesResult
          isWinner={resultData.isWinner}
          isDraw={resultData.isDraw}
          myScore={resultData.myScore}
          oppScore={resultData.oppScore}
          myNickname={player.nickname}
          myAvatar={player.avatarValue}
          oppNickname={resultData.oppNickname}
          oppAvatar={resultData.oppAvatar}
          gameName={t(GAME_META[selectedGame || 'rps']?.labelKey || 'rps')}
          onPlayAgain={handlePlayAgain}
          onBackToSelector={handleBackToSelector}
          onViewLeaderboard={() => setPhase('leaderboard')}
          isRTL={isRTL}
          t={t}
        />
      )}

      {phase === 'leaderboard' && (
        <>
          <QGamesLeaderboard
            entries={leaderboardEntries}
            currentPlayerId={visitorId || undefined}
            onBack={() => setPhase(resultData ? 'result' : 'selector')}
            onChallenge={() => setPhase('selector')}
            shortId={shortId}
            isRTL={isRTL}
            t={t}
          />
          <QGamesMatchHistory
            codeId={codeId}
            currentPlayerId={visitorId || undefined}
            isRTL={isRTL}
            t={t}
          />
        </>
      )}
    </div>
  );
}
