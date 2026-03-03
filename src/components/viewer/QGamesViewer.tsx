'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  QGamesConfig,
  QGamesPlayer,
  QGameType,
  GAME_META,
  DEFAULT_QGAMES_CONFIG,
  DEFAULT_QGAMES_EMOJI_PALETTE,
} from '@/types/qgames';
import { getOrCreateVisitorId } from '@/lib/xp';
import { findOrWaitForOpponent, cancelMatchmaking } from '@/lib/qgames-matchmaking';
import {
  initQGamesSession,
  initRPSState,
  updateMatchStatus,
  leaveQueue,
  cleanupMatch,
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
  },
};

type ViewPhase = 'registration' | 'selector' | 'queue' | 'vs' | 'playing' | 'result' | 'leaderboard';

interface QGamesViewerProps {
  codeId: string;
  mediaId: string;
  initialConfig: QGamesConfig;
  shortId: string;
  locale?: 'he' | 'en';
}

export default function QGamesViewer({
  codeId,
  mediaId,
  initialConfig,
  shortId,
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

  // Result state
  const [resultData, setResultData] = useState<{
    isWinner: boolean;
    isDraw: boolean;
    myScore: number;
    oppScore: number;
    oppNickname: string;
    oppAvatar: string;
  } | null>(null);

  // Visitor ID
  const visitorIdRef = useRef<string | null>(null);
  useEffect(() => {
    visitorIdRef.current = getOrCreateVisitorId();
  }, []);

  // Real-time subscriptions
  const { entry: queueEntry } = useQGamesQueueEntry(
    codeId,
    phase === 'queue' ? visitorIdRef.current : null
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
        playerId: visitorIdRef.current,
        nickname,
        avatarType,
        avatarValue,
      }),
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error);

    setPlayer(data.player);
    setPhase('selector');
  }, [codeId]);

  const handleSelectGame = useCallback(async (gameType: QGameType) => {
    if (!player || !visitorIdRef.current) return;

    setSelectedGame(gameType);
    setPhase('queue');

    const result = await findOrWaitForOpponent(
      codeId,
      visitorIdRef.current,
      player.nickname,
      player.avatarType,
      player.avatarValue,
      gameType
    );

    if (result.type === 'matched' && result.matchId) {
      setMatchId(result.matchId);
      setPhase('vs');
    }
    // If 'waiting', the queue subscription will handle the match found event
  }, [codeId, player]);

  const handleCancelQueue = useCallback(async () => {
    if (visitorIdRef.current) {
      await cancelMatchmaking(codeId, visitorIdRef.current);
    }
    setSelectedGame(null);
    setPhase('selector');
  }, [codeId]);

  const handleVSCountdownComplete = useCallback(async () => {
    if (!matchId || !selectedGame) return;

    // Start the game
    await updateMatchStatus(codeId, matchId, 'playing');

    if (selectedGame === 'rps') {
      await initRPSState(codeId, matchId, config.rpsFirstTo, config.rpsFirstRoundTimer);
    }

    setPhase('playing');
  }, [codeId, matchId, selectedGame, config]);

  const handleMatchEnd = useCallback((winnerId: string | null, p1Score: number, p2Score: number) => {
    if (!match || !player) return;

    const isPlayer1 = match.player1Id === visitorIdRef.current;
    const iWon = winnerId === visitorIdRef.current;
    const isDraw = winnerId === null;

    setResultData({
      isWinner: iWon,
      isDraw,
      myScore: isPlayer1 ? p1Score : p2Score,
      oppScore: isPlayer1 ? p2Score : p1Score,
      oppNickname: isPlayer1 ? match.player2Nickname : match.player1Nickname,
      oppAvatar: isPlayer1 ? match.player2AvatarValue : match.player1AvatarValue,
    });

    // Persist match to Firestore
    fetch('/api/qgames/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codeId,
        matchId,
        playerId: visitorIdRef.current,
      }),
    }).catch(console.error);

    setPhase('result');
  }, [match, player, codeId, matchId]);

  const handlePlayAgain = useCallback(() => {
    setMatchId(null);
    setResultData(null);
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
    setPhase('selector');
  }, []);

  // ============ Render ============

  const bgColor = config.branding.backgroundColor || '#0a0f1a';
  const isPlayer1 = match?.player1Id === visitorIdRef.current;

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor }}>
      {phase === 'registration' && (
        <QGamesRegistration
          config={config}
          onRegister={handleRegister}
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
          enableWhatsApp={config.enableWhatsAppInvite}
          onCancel={handleCancelQueue}
          isRTL={isRTL}
          t={t}
        />
      )}

      {phase === 'vs' && match && (
        <QGamesVSScreen
          player1Nickname={match.player1Nickname}
          player1Avatar={match.player1AvatarValue}
          player2Nickname={match.player2Nickname}
          player2Avatar={match.player2AvatarValue}
          gameEmoji={GAME_META[selectedGame || 'rps']?.emoji || '✊'}
          onCountdownComplete={handleVSCountdownComplete}
          isRTL={isRTL}
        />
      )}

      {phase === 'playing' && match && selectedGame === 'rps' && (
        <RPSGame
          codeId={codeId}
          matchId={match.id}
          playerId={visitorIdRef.current || ''}
          isPlayer1={isPlayer1}
          player1Nickname={match.player1Nickname}
          player1Avatar={match.player1AvatarValue}
          player2Nickname={match.player2Nickname}
          player2Avatar={match.player2AvatarValue}
          firstTo={config.rpsFirstTo}
          firstRoundTimer={config.rpsFirstRoundTimer}
          subsequentTimer={config.rpsSubsequentTimer}
          enableSound={config.enableSound}
          onMatchEnd={handleMatchEnd}
          isRTL={isRTL}
          t={t}
        />
      )}

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
            currentPlayerId={visitorIdRef.current || undefined}
            onBack={() => setPhase(resultData ? 'result' : 'selector')}
            isRTL={isRTL}
            t={t}
          />
          <QGamesMatchHistory
            codeId={codeId}
            currentPlayerId={visitorIdRef.current || undefined}
            isRTL={isRTL}
            t={t}
          />
        </>
      )}
    </div>
  );
}
