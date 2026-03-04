'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  QGamesConfig,
  QGamesPlayer,
  QGameType,
  GAME_META,
  DEFAULT_QGAMES_CONFIG,
  DEFAULT_QGAMES_EMOJI_PALETTE,
  is3PlayerGame,
} from '@/types/qgames';
import { getOrCreateVisitorId } from '@/lib/xp';
import { savePlayerSession, loadPlayerSession, clearPlayerSession } from '@/lib/qgames-session';
import { findOrWaitForOpponent, tryMatchFromQueue, cancelMatchmaking } from '@/lib/qgames-matchmaking';
import {
  initQGamesSession,
  initRPSState,
  initOOOState,
  updateMatchStatus,
  subscribeToQueue,
  updateQueueEntryAvatar,
  updateQueueEntryNickname,
  getRPSState,
  getOOOState,
  markQueueEntryBotMatch,
  leaveQueue,
} from '@/lib/qgames-realtime';
import {
  useQGamesQueueEntry,
  useQGamesMatch,
  useQGamesLeaderboard,
  useMatchPresence,
  useQueueWatcher,
  useViewerPresence,
} from '@/hooks/useQGamesRealtime';

import QGamesRegistration from '@/components/qgames/QGamesRegistration';
import QGamesSelector from '@/components/qgames/QGamesSelector';
import QGamesQueue from '@/components/qgames/QGamesQueue';
import QGamesVSScreen from '@/components/qgames/QGamesVSScreen';
import RPSGame from '@/components/qgames/RPSGame';
import OddOneOutGame from '@/components/qgames/OddOneOutGame';
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
    selectorTagline: 'בוחרים משחק ומאתגרים את החברים 🔥',
    rps: 'אבן נייר ומספריים',
    rpsDescription: 'מי ינצח? הראשון ל-3!',
    tictactoe: 'איקס מיקס דריקס',
    tictactoeDescription: '3 ברצף מנצחים!',
    memory: 'זיכרון',
    memoryDescription: 'מצאו את הזוגות!',
    viewLeaderboard: 'טבלת מובילים',
    searchingForOpponent: 'מחפשים לכם חברים לשחק',
    noOpponentYet: 'אין יריב כרגע?',
    dontWantToWait: 'לא רוצים לחכות?',
    inviteViaWhatsApp: 'שלחו הזמנה בוואטסאפ',
    round: 'סיבוב',
    firstTo: 'עד ',
    points: ' נקודות',
    rock: 'אבן',
    paper: 'נייר',
    scissors: 'מספריים',
    makeYourChoice: 'בחרו!',
    waitingForOpponent: 'מחכה לחבר...',
    youWonRound: 'ניצחת!',
    youLostRound: 'הפסדת',
    didntAnswer: 'לא ענה!',
    roundVoid: 'סיבוב פסול!',
    draw: 'תיקו!',
    youWon: 'ניצחת! 🎉',
    youLost: 'הפסדת',
    playAgain: 'שחקו שוב',
    backToGames: 'חזרה למשחקים',
    leaderboard: 'טבלת מובילים',
    noPlayersYet: 'עדיין אין שחקנים',
    you: 'אתה',
    pts: 'נק׳',
    recentMatches: 'משחקים אחרונים',
    takeSelfie: 'צלמו סלפי',
    or: 'או',
    share: 'שתף',
    joinAndPlay: 'הצטרפו למשחק!',
    challengeMessage: 'אתגר אותך למשחק! בוא נראה מי טוב יותר 🎮',
    challenge: 'אתגר',
    playNow: 'שחקו עכשיו!',
    // OOO translations
    oddoneout: 'משלוש יוצא אחד',
    oddoneoutDescription: 'כף או אגרוף? מי שונה - נפסל!',
    palm: 'כף',
    fist: 'אגרוף',
    searchingForOpponents: 'מחפשים לכם חברים לשחק',
    strike: 'סטרייק',
    strikes: 'סטרייקים',
    youGotStrike: 'קיבלת סטרייק!',
    youSurvived: 'שרדת!',
    allSame: 'כולם אותו דבר!',
    eliminated: 'הודח!',
    youSurvivedMatch: 'שרדת! 🎉',
    youWereEliminated: 'הודחת',
    waitingForPlayers: 'מחכה לשחקנים...',
    oddOneOut: 'היוצא מן הכלל',
    gameFor3Players: 'המשחק הזה ל-3 חברים',
    waiting1More: 'מחכים לעוד חבר אחד...',
    waiting2More: 'מחכים לעוד 2 חברים...',
    playersReady: 'מוכנים',
    opponentDisconnected: 'החבר/ה התנתקו מהמשחק',
    youWinByForfeit: 'ניצחת בהפסד טכני!',
    wantsToPlay: 'רוצה לשחק!',
    playRealOpponent: 'שחקו עכשיו!',
    later: 'אח"כ',
    games: 'משחקים',
    winsShort: 'נ',
    lossesShort: 'ה',
    drawsShort: 'ת',
    winsLabel: 'ניצחונות',
    lossesLabel: 'הפסדים',
    drawsLabel: 'תיקו',
    gamesPlayedLabel: 'משחקים שבוצעו',
    winRate: 'אחוז ניצחון',
    playerStats: 'סטטיסטיקות',
    score: 'ניקוד',
    close: 'סגור',
    allGames: 'הכל',
    byScore: 'ניקוד',
    byWinRate: 'ניצחונות',
    minGames: 'מינימום 3 משחקים',
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
    selectorTagline: 'Pick a game and challenge your friends 🔥',
    rps: 'Rock Paper Scissors',
    rpsDescription: 'Who will win? First to 3!',
    tictactoe: 'Tic-Tac-Toe',
    tictactoeDescription: '3 in a row wins!',
    memory: 'Memory Match',
    memoryDescription: 'Find the matching pairs!',
    viewLeaderboard: 'Leaderboard',
    searchingForOpponent: 'Looking for friends to play',
    noOpponentYet: 'No opponent yet?',
    dontWantToWait: "Don't want to wait?",
    inviteViaWhatsApp: 'Invite via WhatsApp',
    round: 'Round',
    firstTo: 'First to ',
    points: ' points',
    rock: 'Rock',
    paper: 'Paper',
    scissors: 'Scissors',
    makeYourChoice: 'Make your choice!',
    waitingForOpponent: 'Waiting for friend...',
    youWonRound: 'You won!',
    youLostRound: 'You lost',
    didntAnswer: "Didn't answer!",
    roundVoid: 'Round void!',
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
    // OOO translations
    oddoneout: 'Odd One Out',
    oddoneoutDescription: 'Palm or fist? The odd one gets a strike!',
    palm: 'Palm',
    fist: 'Fist',
    searchingForOpponents: 'Looking for friends to play',
    strike: 'Strike',
    strikes: 'Strikes',
    youGotStrike: 'You got a strike!',
    youSurvived: 'You survived!',
    allSame: 'All the same!',
    eliminated: 'Eliminated!',
    youSurvivedMatch: 'You Survived! 🎉',
    youWereEliminated: 'Eliminated',
    waitingForPlayers: 'Waiting for players...',
    oddOneOut: 'Odd One Out',
    gameFor3Players: 'This game needs 3 players',
    waiting1More: 'Waiting for 1 more friend...',
    waiting2More: 'Waiting for 2 more friends...',
    playersReady: 'ready',
    opponentDisconnected: 'Your friend left the game',
    youWinByForfeit: 'You win by forfeit!',
    wantsToPlay: 'wants to play!',
    playRealOpponent: 'Play now!',
    later: 'Later',
    games: 'games',
    winsShort: 'W',
    lossesShort: 'L',
    drawsShort: 'D',
    winsLabel: 'Wins',
    lossesLabel: 'Losses',
    drawsLabel: 'Draws',
    gamesPlayedLabel: 'Games Played',
    winRate: 'Win Rate',
    playerStats: 'Player Stats',
    score: 'Score',
    close: 'Close',
    allGames: 'All',
    byScore: 'Score',
    byWinRate: 'Win Rate',
    minGames: 'Min 3 games',
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

  // Phase state machine — restore from localStorage if returning player
  const [player, setPlayer] = useState<QGamesPlayer | null>(() => {
    if (typeof window === 'undefined') return null;
    return loadPlayerSession(codeId);
  });
  const [phase, setPhase] = useState<ViewPhase>(() => {
    if (typeof window === 'undefined') return 'registration';
    return loadPlayerSession(codeId) ? 'selector' : 'registration';
  });
  const [selectedGame, setSelectedGame] = useState<QGameType | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [isBotMatch, setIsBotMatch] = useState(false);
  const [opponentNotificationDismissed, setOpponentNotificationDismissed] = useState(false);

  // Bot match fake data
  const [botMatchData, setBotMatchData] = useState<{
    id: string;
    player1Id: string;
    player1Nickname: string;
    player1AvatarValue: string;
    player2Id: string;
    player2Nickname: string;
    player2AvatarValue: string;
    player3Id?: string;
    player3Nickname?: string;
    player3AvatarValue?: string;
  } | null>(null);

  // Result state
  const [resultData, setResultData] = useState<{
    isWinner: boolean;
    isDraw: boolean;
    myScore: number;
    oppScore: number;
    oppNickname: string;
    oppAvatar: string;
    // 3-player (OOO) result data
    is3Player?: boolean;
    thirdPlayerNickname?: string;
    thirdPlayerAvatar?: string;
    thirdPlayerScore?: number;
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

  // Track when disconnect countdown started (for visual countdown bar)
  const [disconnectStartTime, setDisconnectStartTime] = useState<number | null>(null);

  // Guard against concurrent match attempts
  const matchingRef = useRef(false);

  // Real-time subscriptions
  const { entry: queueEntry } = useQGamesQueueEntry(
    codeId,
    phase === 'queue' ? visitorId : null
  );
  const { match } = useQGamesMatch(codeId, matchId);
  const { entries: leaderboardEntries } = useQGamesLeaderboard(codeId);

  // Refs for disconnect forfeit handler (avoids stale closures & prevents timeout reset)
  const matchRef = useRef(match);
  matchRef.current = match;
  const playerRef = useRef(player);
  playerRef.current = player;

  // Compute opponent IDs for presence tracking
  const opponentIds = useMemo(() => {
    const activeMatch = isBotMatch ? null : match;
    if (!activeMatch || !visitorId) return [];
    const ids: string[] = [];
    if (activeMatch.player1Id !== visitorId) ids.push(activeMatch.player1Id);
    if (activeMatch.player2Id !== visitorId) ids.push(activeMatch.player2Id);
    if (activeMatch.player3Id && activeMatch.player3Id !== visitorId) ids.push(activeMatch.player3Id);
    return ids;
  }, [match, visitorId, isBotMatch]);

  // Viewer presence + live stats (active across all phases)
  const { viewerCount, activeMatches, matchesPerGame } = useViewerPresence(codeId, visitorId);

  // Track opponent presence during match
  const { opponentDisconnected } = useMatchPresence(
    codeId,
    matchId,
    visitorId,
    opponentIds,
    (phase === 'playing' || phase === 'result') && !isBotMatch
  );

  // Watch queue for real opponents during bot match
  const { waitingOpponents } = useQueueWatcher(
    codeId,
    visitorId,
    selectedGame,
    isBotMatch && (phase === 'vs' || phase === 'playing')
  );

  const showOpponentNotification = isBotMatch
    && !opponentNotificationDismissed
    && (phase === 'playing' || phase === 'vs')
    && (selectedGame && is3PlayerGame(selectedGame)
      ? waitingOpponents.length >= 2
      : waitingOpponents.length >= 1);

  // Initialize RTDB session on mount
  useEffect(() => {
    initQGamesSession(codeId);
  }, [codeId]);

  // Background validate cached player session
  useEffect(() => {
    if (!player || phase !== 'selector') return;
    const cached = loadPlayerSession(codeId);
    if (!cached) return; // Fresh registration, no need to validate

    fetch('/api/qgames/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codeId,
        playerId: visitorId,
        nickname: player.nickname,
        avatarType: player.avatarType,
        avatarValue: player.avatarValue,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          clearPlayerSession(codeId);
          setPlayer(null);
          setPhase('registration');
        } else {
          setPlayer(data.player);
          savePlayerSession(codeId, data.player);
        }
      })
      .catch(() => {}); // Network error — keep using cache
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Handle opponent disconnect during match
  useEffect(() => {
    if (!opponentDisconnected || phase !== 'playing' || isBotMatch) {
      setDisconnectStartTime(null);
      return;
    }

    // Record when countdown started (for visual countdown bar in game components)
    setDisconnectStartTime(Date.now());

    // 5-second grace period before declaring forfeit
    // Uses refs for match/player to avoid resetting timeout on RTDB updates
    const timeout = setTimeout(async () => {
      const activeMatch = matchRef.current;
      if (!activeMatch || !playerRef.current) return;

      // Mark match as abandoned
      if (matchId) {
        updateMatchStatus(codeId, matchId, 'abandoned');
      }

      const isP1 = activeMatch.player1Id === visitorId;
      const isP2 = activeMatch.player2Id === visitorId;

      // Read actual scores from RTDB
      let myScore = 0;
      let oppScore = 0;

      if (matchId && selectedGame === 'rps') {
        const rpsState = await getRPSState(codeId, matchId);
        if (rpsState) {
          myScore = isP1 ? rpsState.player1Score : rpsState.player2Score;
          oppScore = isP1 ? rpsState.player2Score : rpsState.player1Score;
        }
      } else if (matchId && selectedGame === 'oddoneout') {
        const oooState = await getOOOState(codeId, matchId);
        if (oooState) {
          // In OOO, lower strikes = better. Surviving player wins by forfeit.
          myScore = isP1 ? oooState.player1Strikes : isP2 ? oooState.player2Strikes : oooState.player3Strikes;
          // Pick the highest opponent strike count to show
          const oppStrikes = isP1
            ? Math.max(oooState.player2Strikes, oooState.player3Strikes)
            : isP2
              ? Math.max(oooState.player1Strikes, oooState.player3Strikes)
              : Math.max(oooState.player1Strikes, oooState.player2Strikes);
          oppScore = oppStrikes;
        }
      }

      if (selectedGame === 'oddoneout') {
        // For OOO, the disconnected player(s) lose — surviving player wins
        const oppNickname = isP1 ? activeMatch.player2Nickname : activeMatch.player1Nickname;
        const oppAvatar = isP1 ? activeMatch.player2AvatarValue : activeMatch.player1AvatarValue;
        setResultData({
          isWinner: true,
          isDraw: false,
          myScore,
          oppScore,
          oppNickname,
          oppAvatar,
          is3Player: true,
          thirdPlayerNickname: isP1 ? activeMatch.player3Nickname : isP2 ? activeMatch.player3Nickname : activeMatch.player2Nickname,
          thirdPlayerAvatar: isP1 ? activeMatch.player3AvatarValue : isP2 ? activeMatch.player3AvatarValue : activeMatch.player2AvatarValue,
          thirdPlayerScore: 0,
        });
      } else {
        const isDraw = myScore === oppScore;
        setResultData({
          isWinner: !isDraw,
          isDraw,
          myScore,
          oppScore,
          oppNickname: isP1 ? activeMatch.player2Nickname : activeMatch.player1Nickname,
          oppAvatar: isP1 ? activeMatch.player2AvatarValue : activeMatch.player1AvatarValue,
        });
      }

      // Persist forfeit
      if (matchId) {
        fetch('/api/qgames/forfeit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codeId, matchId, playerId: visitorId }),
        }).catch(console.error);
      }

      setPhase('result');
    }, 5000);

    return () => {
      clearTimeout(timeout);
      setDisconnectStartTime(null);
    };
    // match & player accessed via refs — not in deps to avoid resetting the timeout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponentDisconnected, phase, isBotMatch, codeId, matchId, visitorId, selectedGame]);

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
    savePlayerSession(codeId, data.player);
    setPhase('selector');
  }, [codeId, visitorId]);

  const handleSelectGame = useCallback(async (gameType: QGameType) => {
    if (!player || !visitorId) return;

    setSelectedGame(gameType);
    setPhase('queue');
    matchingRef.current = true; // Prevent "re-add" effect from double-matching

    try {
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
    } finally {
      matchingRef.current = false;
    }
  }, [codeId, player, visitorId, inviteFrom]);

  const handleCancelQueue = useCallback(async () => {
    if (visitorId) {
      await cancelMatchmaking(codeId, visitorId);
    }
    setSelectedGame(null);
    setPhase('selector');
  }, [codeId, visitorId]);

  const handleAvatarChange = useCallback(async (avatarType: 'emoji' | 'selfie', avatarValue: string) => {
    // Update local state + cache
    setPlayer(prev => {
      if (!prev) return prev;
      const updated = { ...prev, avatarType, avatarValue };
      savePlayerSession(codeId, updated);
      return updated;
    });
    // Update RTDB queue entry
    if (visitorId) {
      await updateQueueEntryAvatar(codeId, visitorId, avatarType, avatarValue);
    }
    // Update Firestore player profile
    fetch('/api/qgames/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codeId,
        playerId: visitorId,
        nickname: player?.nickname,
        avatarType,
        avatarValue,
      }),
    }).catch(console.error);
  }, [codeId, visitorId, player?.nickname]);

  const handleNameChange = useCallback(async (nickname: string) => {
    // Update local state + cache
    setPlayer(prev => {
      if (!prev) return prev;
      const updated = { ...prev, nickname };
      savePlayerSession(codeId, updated);
      return updated;
    });
    // Update RTDB queue entry
    if (visitorId) {
      await updateQueueEntryNickname(codeId, visitorId, nickname);
    }
    // Update Firestore player profile
    fetch('/api/qgames/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codeId,
        playerId: visitorId,
        nickname,
        avatarType: player?.avatarType,
        avatarValue: player?.avatarValue,
      }),
    }).catch(console.error);
  }, [codeId, visitorId, player?.avatarType, player?.avatarValue]);

  const handlePlayBot = useCallback(async () => {
    if (!player) return;

    // Stay in queue but invisible to matchmaking (ghost entry)
    if (visitorId) {
      await markQueueEntryBotMatch(codeId, visitorId, true);
    }

    setIsBotMatch(true);
    setOpponentNotificationDismissed(false);
    const is3P = selectedGame ? is3PlayerGame(selectedGame) : false;
    const fakeBotMatch = {
      id: `bot-${Date.now()}`,
      player1Id: visitorId,
      player1Nickname: player.nickname,
      player1AvatarValue: player.avatarValue,
      player2Id: 'bot-1',
      player2Nickname: isRTL ? 'בוט 1' : 'Bot 1',
      player2AvatarValue: '🤖',
      ...(is3P ? {
        player3Id: 'bot-2',
        player3Nickname: isRTL ? 'בוט 2' : 'Bot 2',
        player3AvatarValue: '🦾',
      } : {}),
    };
    setBotMatchData(fakeBotMatch);
    setPhase('vs');
  }, [player, visitorId, codeId, isRTL, selectedGame]);

  const handleVSCountdownComplete = useCallback(async () => {
    if (isBotMatch) {
      // Bot match: skip RTDB setup, go straight to playing
      setPhase('playing');
      return;
    }

    if (!matchId || !selectedGame) return;

    // Start the game — remove from queue first so no one else can match us
    if (visitorId) {
      leaveQueue(codeId, visitorId).catch(() => {});
    }
    await updateMatchStatus(codeId, matchId, 'playing');

    if (selectedGame === 'rps') {
      // Only player1 initializes RPS state to avoid timestamp race
      const isPlayer1 = match?.player1Id === visitorId;
      if (isPlayer1) {
        await initRPSState(codeId, matchId, config.rpsFirstTo, config.rpsFirstRoundTimer);
      }
    } else if (selectedGame === 'oddoneout') {
      // Only player1 initializes OOO state
      const isPlayer1 = match?.player1Id === visitorId;
      if (isPlayer1) {
        await initOOOState(codeId, matchId, config.oooMaxStrikes, config.oooFirstRoundTimer);
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

    // Mark match as finished in RTDB, then persist to Firestore
    if (!isBotMatch && matchId) {
      updateMatchStatus(codeId, matchId, 'finished', { finishedAt: Date.now() })
        .then(() => fetch('/api/qgames/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codeId, matchId, playerId: visitorId }),
        }))
        .catch(console.error);
    }

    setPhase('result');
  }, [match, player, codeId, matchId, isBotMatch, botMatchData, visitorId]);

  // 3-player match end (OOO) — loserId is the eliminated player, winnerIds are survivors
  const handleOOOMatchEnd = useCallback((loserId: string, p1Strikes: number, p2Strikes: number, p3Strikes: number) => {
    const activeMatch = isBotMatch ? botMatchData : match;
    if (!activeMatch || !player) return;

    const myId = visitorId;
    const iWon = loserId !== myId;

    // Determine my player number and order scores
    const isP1 = activeMatch.player1Id === myId;
    const isP2 = activeMatch.player2Id === myId;

    let myScore: number, oppScore: number, thirdScore: number;
    let oppNickname: string, oppAvatar: string, thirdNickname: string, thirdAvatar: string;

    if (isP1) {
      myScore = p1Strikes;
      oppScore = p2Strikes;
      thirdScore = p3Strikes;
      oppNickname = activeMatch.player2Nickname;
      oppAvatar = activeMatch.player2AvatarValue;
      thirdNickname = activeMatch.player3Nickname || '';
      thirdAvatar = activeMatch.player3AvatarValue || '';
    } else if (isP2) {
      myScore = p2Strikes;
      oppScore = p1Strikes;
      thirdScore = p3Strikes;
      oppNickname = activeMatch.player1Nickname;
      oppAvatar = activeMatch.player1AvatarValue;
      thirdNickname = activeMatch.player3Nickname || '';
      thirdAvatar = activeMatch.player3AvatarValue || '';
    } else {
      myScore = p3Strikes;
      oppScore = p1Strikes;
      thirdScore = p2Strikes;
      oppNickname = activeMatch.player1Nickname;
      oppAvatar = activeMatch.player1AvatarValue;
      thirdNickname = activeMatch.player2Nickname;
      thirdAvatar = activeMatch.player2AvatarValue;
    }

    setResultData({
      isWinner: iWon,
      isDraw: false,
      myScore,
      oppScore,
      oppNickname,
      oppAvatar,
      is3Player: true,
      thirdPlayerNickname: thirdNickname,
      thirdPlayerAvatar: thirdAvatar,
      thirdPlayerScore: thirdScore,
    });

    // Mark match as finished in RTDB, then persist to Firestore
    if (!isBotMatch && matchId) {
      updateMatchStatus(codeId, matchId, 'finished', { finishedAt: Date.now() })
        .then(() => fetch('/api/qgames/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codeId, matchId, playerId: visitorId }),
        }))
        .catch(console.error);
    }

    setPhase('result');
  }, [match, player, codeId, matchId, isBotMatch, botMatchData, visitorId]);

  const handlePlayAgain = useCallback(async () => {
    // Clean up ghost queue entry from bot match
    if (visitorId) {
      await cancelMatchmaking(codeId, visitorId);
    }
    setMatchId(null);
    setResultData(null);
    setIsBotMatch(false);
    setBotMatchData(null);
    if (selectedGame) {
      handleSelectGame(selectedGame);
    } else {
      setPhase('selector');
    }
  }, [selectedGame, handleSelectGame, codeId, visitorId]);

  const handleBackToSelector = useCallback(async () => {
    // Clean up ghost queue entry from bot match
    if (visitorId) {
      await cancelMatchmaking(codeId, visitorId);
    }
    setMatchId(null);
    setResultData(null);
    setSelectedGame(null);
    setIsBotMatch(false);
    setBotMatchData(null);
    setPhase('selector');
  }, [codeId, visitorId]);

  // Accept real opponent during bot match
  const handleAcceptRealMatch = useCallback(async () => {
    if (!player || !visitorId || !selectedGame) return;

    // Stop bot match
    setIsBotMatch(false);
    setBotMatchData(null);

    // Clear inBotMatch flag so matchmaking can find us
    await markQueueEntryBotMatch(codeId, visitorId, false);

    // Try to match with waiting opponent
    const result = await tryMatchFromQueue(
      codeId, visitorId, player.nickname, player.avatarType,
      player.avatarValue, selectedGame, inviteFrom || undefined
    );

    if (result.type === 'matched' && result.matchId) {
      setMatchId(result.matchId);
      setPhase('vs');
    } else {
      // Opponent may have left — go back to queue
      setPhase('queue');
    }
  }, [codeId, visitorId, player, selectedGame, inviteFrom]);

  const handleDismissOpponentNotification = useCallback(() => {
    setOpponentNotificationDismissed(true);
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
          initialNickname={player?.nickname}
          initialAvatarType={player?.avatarType}
          initialAvatarValue={player?.avatarValue}
        />
      )}

      {phase === 'selector' && player && (
        <QGamesSelector
          config={config}
          playerNickname={player.nickname}
          playerAvatar={player.avatarValue}
          onSelectGame={handleSelectGame}
          onViewLeaderboard={() => setPhase('leaderboard')}
          onEditProfile={() => {
            setPhase('registration');
          }}
          isRTL={isRTL}
          t={t}
          viewerCount={viewerCount}
          matchesPerGame={matchesPerGame}
        />
      )}

      {phase === 'queue' && selectedGame && (
        <QGamesQueue
          gameType={selectedGame}
          gameEmoji={GAME_META[selectedGame]?.emoji || '🎮'}
          gameName={t(GAME_META[selectedGame]?.labelKey || selectedGame)}
          playerAvatar={player?.avatarValue || '😎'}
          playerName={player?.nickname || ''}
          shortId={shortId}
          inviterVisitorId={visitorId}
          enableWhatsApp={config.enableWhatsAppInvite}
          onCancel={handleCancelQueue}
          onPlayBot={handlePlayBot}
          isRTL={isRTL}
          t={t}
          is3Player={is3PlayerGame(selectedGame)}
          emojiPalette={config.emojiPalette}
          allowSelfie={config.allowSelfie}
          ownerId={ownerId}
          codeId={codeId}
          onAvatarChange={handleAvatarChange}
          onNameChange={handleNameChange}
          viewerCount={viewerCount}
          activeMatches={activeMatches}
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
            player3Nickname={vsMatch.player3Nickname}
            player3Avatar={vsMatch.player3AvatarValue}
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
            opponentDisconnected={opponentDisconnected}
            disconnectStartTime={disconnectStartTime}
          />
        );
      })()}

      {phase === 'playing' && (match || botMatchData) && selectedGame === 'oddoneout' && (() => {
        const gameMatch = isBotMatch ? botMatchData : match;
        if (!gameMatch) return null;
        const playerNumber: 1 | 2 | 3 =
          gameMatch.player1Id === visitorId ? 1 :
          gameMatch.player2Id === visitorId ? 2 : 3;
        return (
          <OddOneOutGame
            codeId={codeId}
            matchId={gameMatch.id}
            playerId={visitorId || ''}
            playerNumber={playerNumber}
            player1Id={gameMatch.player1Id}
            player2Id={gameMatch.player2Id}
            player3Id={gameMatch.player3Id || ''}
            player1Nickname={gameMatch.player1Nickname}
            player1Avatar={gameMatch.player1AvatarValue}
            player2Nickname={gameMatch.player2Nickname}
            player2Avatar={gameMatch.player2AvatarValue}
            player3Nickname={gameMatch.player3Nickname || ''}
            player3Avatar={gameMatch.player3AvatarValue || ''}
            maxStrikes={config.oooMaxStrikes}
            firstRoundTimer={config.oooFirstRoundTimer}
            subsequentTimer={config.oooSubsequentTimer}
            enableSound={config.enableSound}
            onMatchEnd={handleOOOMatchEnd}
            isRTL={isRTL}
            t={t}
            isBotMatch={isBotMatch}
            opponentDisconnected={opponentDisconnected}
            disconnectStartTime={disconnectStartTime}
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
          is3Player={resultData.is3Player}
          thirdPlayerNickname={resultData.thirdPlayerNickname}
          thirdPlayerAvatar={resultData.thirdPlayerAvatar}
          thirdPlayerScore={resultData.thirdPlayerScore}
        />
      )}

      {phase === 'leaderboard' && (
        <>
          <QGamesLeaderboard
            entries={leaderboardEntries}
            currentPlayerId={visitorId || undefined}
            onBack={() => setPhase(resultData ? 'result' : 'selector')}
            shortId={shortId}
            enabledGames={config.enabledGames}
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

      {/* Real opponent notification during bot match */}
      {showOpponentNotification && (() => {
        const opp = waitingOpponents[0];
        if (!opp) return null;
        return (
          <div className="fixed inset-x-0 bottom-0 z-50 p-4 animate-in slide-in-from-bottom duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
            <div
              className="max-w-sm mx-auto rounded-2xl p-4 border shadow-2xl"
              style={{
                background: 'rgba(10, 15, 26, 0.95)',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                boxShadow: '0 0 40px rgba(16, 185, 129, 0.2)',
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl ring-2 ring-emerald-400/40 overflow-hidden shrink-0">
                  {opp.avatarValue.startsWith('http') ? (
                    <img src={opp.avatarValue} alt="" className="w-full h-full object-cover" />
                  ) : opp.avatarValue}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{opp.nickname}</p>
                  <p className="text-emerald-400 text-xs">{t('wantsToPlay')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAcceptRealMatch}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 text-white"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  {t('playRealOpponent')}
                </button>
                <button
                  onClick={handleDismissOpponentNotification}
                  className="px-4 py-2.5 rounded-xl text-white/40 text-sm transition-all active:scale-95 bg-white/5"
                >
                  {t('later')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Powered by The Q */}
      <div className="fixed bottom-2 inset-x-0 flex justify-center pointer-events-none z-10">
        <a
          href="https://qr.playzones.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/20 text-[10px] hover:text-white/40 transition-colors pointer-events-auto"
        >
          Powered by The Q
        </a>
      </div>
    </div>
  );
}
