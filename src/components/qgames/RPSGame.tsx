'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RPSChoice, RPS_EMOJI, RTDBRPSRound, resolveRPS } from '@/types/qgames';
import { useRPSState, useCountdown, useQGamesSounds } from '@/hooks/useQGamesRealtime';
import { startNewRPSRound } from '@/lib/qgames-realtime';
import { useQGamesTheme } from './QGamesThemeContext';
import ExitGameButton from './ExitGameButton';

interface RPSGameProps {
  codeId: string;
  matchId: string;
  playerId: string;
  isPlayer1: boolean;
  player1Nickname: string;
  player1Avatar: string;
  player2Nickname: string;
  player2Avatar: string;
  firstTo: number;
  firstRoundTimer: number;
  subsequentTimer: number;
  enableSound: boolean;
  onMatchEnd: (winnerId: string | null, p1Score: number, p2Score: number) => void;
  onForfeit?: () => void;
  isRTL: boolean;
  t: (key: string) => string;
  isBotMatch?: boolean;
  opponentDisconnected?: boolean;
  disconnectStartTime?: number | null;
}

function DisconnectCountdownBanner({ startTime, duration, label }: { startTime: number; duration: number; label: string }) {
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      setProgress(remaining / duration);
    };
    tick();
    const interval = setInterval(tick, 50);
    return () => clearInterval(interval);
  }, [startTime, duration]);

  return (
    <div className="absolute inset-x-0 top-0 z-50 animate-in slide-in-from-top duration-300">
      <div className="bg-red-500/90 text-white text-center py-2 text-sm font-medium">
        {label}
      </div>
      <div className="h-1.5 bg-red-900/50">
        <div
          className="h-full bg-red-300"
          style={{ width: `${progress * 100}%`, transition: 'none' }}
        />
      </div>
    </div>
  );
}

function AvatarCircle({ avatar, size = 'md', className = '', style }: { avatar: string; size?: 'sm' | 'md' | 'lg'; className?: string; style?: React.CSSProperties }) {
  const sizeClasses = { sm: 'w-6 h-6 text-sm', md: 'w-12 h-12 text-2xl', lg: 'w-14 h-14 text-3xl' };
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0 ${className}`} style={style}>
      {avatar.startsWith('http') ? (
        <img src={avatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : avatar}
    </div>
  );
}

export default function RPSGame({
  codeId,
  matchId,
  playerId,
  isPlayer1,
  player1Nickname,
  player1Avatar,
  player2Nickname,
  player2Avatar,
  firstTo,
  firstRoundTimer,
  subsequentTimer,
  enableSound,
  onMatchEnd,
  onForfeit,
  isRTL,
  t,
  isBotMatch,
  opponentDisconnected,
  disconnectStartTime,
}: RPSGameProps) {
  const theme = useQGamesTheme();
  const { state: rpsState } = useRPSState(isBotMatch ? '' : codeId, isBotMatch ? '' : matchId);
  const sounds = useQGamesSounds(enableSound);

  const [myChoice, setMyChoice] = useState<RPSChoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealPhase, setRevealPhase] = useState<'choosing' | 'waiting' | 'revealing' | 'scored'>('choosing');
  const [lastRoundWinner, setLastRoundWinner] = useState<string | null>(null);
  const [scoreAnimation, setScoreAnimation] = useState<{ player: 'p1' | 'p2'; show: boolean }>({ player: 'p1', show: false });
  const [displayScores, setDisplayScores] = useState({ p1: 0, p2: 0 });

  // Track if current round was a timeout (player didn't answer)
  const [timedOut, setTimedOut] = useState(false);
  const timedOutRef = useRef(false);

  // Round history for visual log
  const [roundHistory, setRoundHistory] = useState<Array<{
    myChoice: RPSChoice;
    oppChoice: RPSChoice;
    winner: 'me' | 'opp' | 'draw';
    timedOut?: boolean;
    oppTimedOut?: boolean;
  }>>([]);
  const revealTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const matchEndedRef = useRef(false);
  const choiceSubmittedRef = useRef(false);
  const mutualTimeoutCountRef = useRef(0);

  // Ref to always read latest rpsState in timeouts (avoids stale closure)
  const rpsStateRef = useRef(rpsState);
  rpsStateRef.current = rpsState;

  // Bot state (local game loop)
  const [botRound, setBotRound] = useState(0);
  const [botRoundData, setBotRoundData] = useState<RTDBRPSRound | null>(null);
  const [botScores, setBotScores] = useState({ p1: 0, p2: 0 });
  const botTimerStartRef = useRef<number>(Date.now());

  // Start bot timer on mount and round changes
  useEffect(() => {
    if (isBotMatch) {
      botTimerStartRef.current = Date.now();
      setBotRoundData(null);
    }
  }, [isBotMatch, botRound]);

  // Current round data - use bot state or RTDB state
  const currentRound = isBotMatch ? botRound : (rpsState?.currentRound ?? 0);
  const roundData = isBotMatch ? botRoundData : (rpsState?.rounds?.[String(currentRound)] as RTDBRPSRound | undefined);
  const timerDuration = isBotMatch
    ? (botRound === 0 ? firstRoundTimer : subsequentTimer)
    : (roundData?.timerDuration ?? firstRoundTimer);

  const { timeLeft, isExpired, progress } = useCountdown(
    isBotMatch ? botTimerStartRef.current : (roundData?.timerStartedAt ?? null),
    roundData?.revealed ? null : timerDuration
  );

  // When round is revealed by server, show reveal animation
  useEffect(() => {
    if (!roundData?.revealed || revealPhase === 'revealing' || revealPhase === 'scored') return;
    if (!roundData.player1Choice || !roundData.player2Choice) return;

    setRevealPhase('revealing');
    setMyChoice(null); // Reset button highlight - revealed choices come from roundData
    sounds.playReveal();

    // Show the reveal for 2 seconds then transition
    revealTimeoutRef.current = setTimeout(() => {
      // Read latest scores via ref (avoids stale closure — scores arrive after revealed=true)
      const latestState = rpsStateRef.current;
      const p1s = isBotMatch ? botScores.p1 : (latestState?.player1Score ?? 0);
      const p2s = isBotMatch ? botScores.p2 : (latestState?.player2Score ?? 0);
      setDisplayScores({ p1: p1s, p2: p2s });

      // Add to round history
      const myC = isPlayer1 ? roundData.player1Choice! : roundData.player2Choice!;
      const oppC = isPlayer1 ? roundData.player2Choice! : roundData.player1Choice!;
      const oppDidTimeout = isPlayer1 ? !!roundData.player2TimedOut : !!roundData.player1TimedOut;
      setRoundHistory(prev => [...prev, {
        myChoice: myC,
        oppChoice: oppC,
        winner: roundData.winner === (isPlayer1 ? 'player1' : 'player2') ? 'me'
          : roundData.winner === (isPlayer1 ? 'player2' : 'player1') ? 'opp'
          : 'draw',
        timedOut: timedOutRef.current,
        oppTimedOut: oppDidTimeout,
      }]);

      // Track consecutive mutual timeouts
      if (timedOutRef.current && oppDidTimeout) {
        mutualTimeoutCountRef.current += 1;
      } else {
        mutualTimeoutCountRef.current = 0;
      }

      // Score animation
      if (roundData.winner === 'player1') {
        setScoreAnimation({ player: 'p1', show: true });
        sounds.playWinRound();
        setLastRoundWinner('p1');
      } else if (roundData.winner === 'player2') {
        setScoreAnimation({ player: 'p2', show: true });
        sounds.playWinRound();
        setLastRoundWinner('p2');
      } else {
        setLastRoundWinner(null);
      }

      setRevealPhase('scored');

      // Hide score animation after 1s
      setTimeout(() => {
        setScoreAnimation(prev => ({ ...prev, show: false }));
      }, 1000);

      // Check if match is over by score
      const p1Score = p1s;
      const p2Score = p2s;
      if (p1Score >= firstTo || p2Score >= firstTo) {
        if (!matchEndedRef.current) {
          matchEndedRef.current = true;
          const winnerId = p1Score >= firstTo
            ? (isPlayer1 ? playerId : 'opponent')
            : (isPlayer1 ? 'opponent' : playerId);
          // Delay to show final score
          setTimeout(() => onMatchEnd(winnerId, p1Score, p2Score), 1500);
        }
        return;
      }

      // Check if match should end due to 3 consecutive mutual timeouts
      if (mutualTimeoutCountRef.current >= 3) {
        if (!matchEndedRef.current) {
          matchEndedRef.current = true;
          const winnerId = p1Score > p2Score
            ? (isPlayer1 ? playerId : 'opponent')
            : p2Score > p1Score
              ? (isPlayer1 ? 'opponent' : playerId)
              : null; // true draw
          setTimeout(() => onMatchEnd(winnerId, p1Score, p2Score), 1500);
        }
        return;
      }

      // Start next round after 500ms from scored
      setTimeout(() => {
        const nextRound = currentRound + 1;
        if (isBotMatch) {
          setBotRoundData(null); // Clear BEFORE setBotRound to prevent stale revealed=true
          setBotRound(nextRound);
          botTimerStartRef.current = Date.now();
        } else if (isPlayer1) {
          // Only player1 starts new rounds to avoid duplicate writes
          startNewRPSRound(codeId, matchId, nextRound, subsequentTimer);
        }
        choiceSubmittedRef.current = false;
        setMyChoice(null);
        setRevealPhase('choosing');
        setLastRoundWinner(null);
        setTimedOut(false);
        timedOutRef.current = false;
      }, 500);
    }, 2000);

    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    };
  }, [roundData?.revealed]);

  const handleChoose = useCallback(async (choice: RPSChoice, isTimeout = false) => {
    if (choiceSubmittedRef.current || myChoice || isSubmitting || revealPhase !== 'choosing') return;
    choiceSubmittedRef.current = true;

    setMyChoice(choice);
    setRevealPhase('waiting');
    setIsSubmitting(true);
    if (!isTimeout) sounds.playSelect();

    if (isBotMatch) {
      // Bot mode: generate random choice after a short delay
      setTimeout(() => {
        const botChoices: RPSChoice[] = ['rock', 'paper', 'scissors'];
        const botChoice = botChoices[Math.floor(Math.random() * 3)];
        const result = resolveRPS(choice, botChoice);

        const newScores = { ...botScores };
        if (result === 'player1') newScores.p1 += 1;
        else if (result === 'player2') newScores.p2 += 1;

        setBotScores(newScores);
        setBotRoundData({
          player1Choice: choice,
          player2Choice: botChoice,
          winner: result,
          timerStartedAt: botTimerStartRef.current,
          timerDuration,
          revealed: true,
        });
        setIsSubmitting(false);
      }, 800 + Math.random() * 1200); // 0.8-2s delay for realism
      return;
    }

    try {
      const response = await fetch('/api/qgames/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          matchId,
          playerId,
          gameType: 'rps',
          move: { choice, ...(isTimeout && { timedOut: true }) },
        }),
      });

      if (!response.ok) {
        console.error('Move HTTP error:', response.status);
      } else {
        const data = await response.json();
        if (!data.success) {
          console.error('Move failed:', data.error);
        }
      }
    } catch (error) {
      console.error('Move error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [myChoice, isSubmitting, revealPhase, codeId, matchId, playerId, sounds, isBotMatch, botScores, timerDuration]);

  // Handle timer expiry - forfeit round (opponent wins)
  useEffect(() => {
    if (!isExpired || revealPhase !== 'choosing' || myChoice || choiceSubmittedRef.current) return;

    // Don't auto-submit during the gap between rounds (old round data still showing revealed)
    if (!isBotMatch && roundData?.revealed) return;

    // Defensive: verify actual time has elapsed (prevents stale isExpired from previous round)
    const timerStart = isBotMatch ? botTimerStartRef.current : roundData?.timerStartedAt;
    if (timerStart) {
      const actualElapsed = (Date.now() - timerStart) / 1000;
      if (actualElapsed < timerDuration - 0.5) return;
    }

    // Mark as timed out
    setTimedOut(true);
    timedOutRef.current = true;

    if (isBotMatch) {
      choiceSubmittedRef.current = true;
      // Forfeit: bot auto-wins this round with buzzer
      sounds.playLoseRound();
      const forfeitChoice: RPSChoice = 'rock';
      const botWinMap: Record<RPSChoice, RPSChoice> = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

      const newScores = { ...botScores };
      newScores.p2 += 1; // bot (player2) gets +1
      setBotScores(newScores);
      setBotRoundData({
        player1Choice: forfeitChoice,
        player2Choice: botWinMap[forfeitChoice],
        winner: 'player2',
        timerStartedAt: botTimerStartRef.current,
        timerDuration,
        revealed: true,
      });
    } else {
      // Online: submit random choice with timeout flag (opponent auto-wins)
      handleChoose(['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)] as RPSChoice, true);
    }
  }, [isExpired, revealPhase, myChoice, handleChoose, isBotMatch, sounds, botScores, timerDuration]);

  // Reset state when round changes (online matches)
  useEffect(() => {
    if (rpsState && !roundData?.revealed) {
      choiceSubmittedRef.current = false;
      setMyChoice(null);
      setRevealPhase('choosing');
    }
  }, [currentRound]);

  // Get opponent info based on player position
  const myNickname = isPlayer1 ? player1Nickname : player2Nickname;
  const myAvatar = isPlayer1 ? player1Avatar : player2Avatar;
  const oppNickname = isPlayer1 ? player2Nickname : player1Nickname;
  const oppAvatar = isPlayer1 ? player2Avatar : player1Avatar;
  const myScore = isPlayer1 ? displayScores.p1 : displayScores.p2;
  const oppScore = isPlayer1 ? displayScores.p2 : displayScores.p1;

  // Revealed choices
  const myRevealedChoice = roundData?.revealed
    ? (isPlayer1 ? roundData.player1Choice : roundData.player2Choice)
    : null;
  const oppRevealedChoice = roundData?.revealed
    ? (isPlayer1 ? roundData.player2Choice : roundData.player1Choice)
    : null;

  const iWonRound = roundData?.winner === (isPlayer1 ? 'player1' : 'player2');
  const iLostRound = roundData?.winner === (isPlayer1 ? 'player2' : 'player1');
  // Detect opponent timeout from RTDB (online matches)
  const oppTimedOut = roundData?.revealed
    ? (isPlayer1 ? !!roundData.player2TimedOut : !!roundData.player1TimedOut)
    : false;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden relative" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Exit button */}
      {onForfeit && <ExitGameButton onConfirm={onForfeit} isRTL={isRTL} t={t} />}

      {/* Disconnect countdown banner */}
      {opponentDisconnected && disconnectStartTime && (
        <DisconnectCountdownBanner
          startTime={disconnectStartTime}
          duration={5}
          label={t('opponentDisconnected')}
        />
      )}

      {/* Header: Score Display */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
        {/* My side */}
        <div className="flex items-center gap-2 relative">
          <AvatarCircle avatar={myAvatar} size="md" className="ring-2" style={{ '--tw-ring-color': `${theme.primaryColor}4d` } as React.CSSProperties} />
          <div>
            <p className="text-white text-xs font-medium truncate max-w-[80px]">{myNickname}</p>
            <p className="text-2xl font-black text-white tabular-nums">{myScore}</p>
          </div>
          {/* Score pop */}
          {scoreAnimation.show && scoreAnimation.player === (isPlayer1 ? 'p1' : 'p2') && (
            <span className="absolute -top-2 right-0 font-black text-lg animate-bounce" style={{ color: theme.accentColor }}>+1</span>
          )}
        </div>

        {/* VS + Round */}
        <div className="text-center">
          <p className="text-white/30 text-[10px] uppercase tracking-widest">{t('round')} {currentRound + 1}</p>
          <p className="text-white/50 font-bold text-xs">{t('firstTo')}{firstTo}{t('points')}</p>
        </div>

        {/* Opponent side */}
        <div className="flex items-center gap-2 relative">
          <div>
            <p className="text-white text-xs font-medium truncate max-w-[80px] text-end">{oppNickname}</p>
            <p className="text-2xl font-black text-white tabular-nums text-end">{oppScore}</p>
          </div>
          <AvatarCircle avatar={oppAvatar} size="md" className="ring-2" style={{ '--tw-ring-color': `${theme.accentColor}4d` } as React.CSSProperties} />
          {scoreAnimation.show && scoreAnimation.player === (isPlayer1 ? 'p2' : 'p1') && (
            <span className="absolute -top-2 left-0 font-black text-lg animate-bounce" style={{ color: theme.accentColor }}>+1</span>
          )}
        </div>
      </div>

      {/* Timer bar */}
      <div className="px-4 mb-2">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${progress * 100}%`,
              background: progress > 0.3 ? theme.accentColor : progress > 0.1 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
        <p className="text-center text-white/30 text-[10px] mt-0.5 tabular-nums">{Math.ceil(timeLeft)}s</p>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0">
        {/* Reveal Phase: Show both choices */}
        {(revealPhase === 'revealing' || revealPhase === 'scored') && myRevealedChoice && oppRevealedChoice ? (
          <div className="flex flex-col items-center gap-4">
            {/* Opponent's choice */}
            <div className={`text-center transition-all duration-500 ${iLostRound ? 'scale-110' : iWonRound ? 'opacity-60 scale-90' : ''}`}>
              <div className="text-6xl mb-1 animate-in zoom-in duration-300">
                {oppTimedOut ? '❌' : RPS_EMOJI[oppRevealedChoice]}
              </div>
              <p className="text-white/50 text-xs">{oppNickname}</p>
            </div>

            {/* Result text */}
            <div className="text-center">
              {iWonRound && (
                <p className="font-black text-xl animate-in zoom-in duration-300" style={{ color: theme.accentColor }}>
                  {t('youWonRound')} ✓
                </p>
              )}
              {iLostRound && timedOut && (
                <p className="text-red-400 font-bold text-xl animate-in zoom-in duration-300">
                  {t('didntAnswer')}
                </p>
              )}
              {iLostRound && !timedOut && (
                <p className="text-red-400 font-bold text-xl animate-in zoom-in duration-300">
                  {t('youLostRound')}
                </p>
              )}
              {!iWonRound && !iLostRound && roundData?.winner === 'draw' && timedOut && (
                <p className="text-yellow-400 font-bold text-xl animate-in zoom-in duration-300">
                  {t('didntAnswer')}
                </p>
              )}
              {!iWonRound && !iLostRound && roundData?.winner === 'draw' && !timedOut && (
                <p className="text-yellow-400 font-bold text-xl animate-in zoom-in duration-300">
                  {t('draw')}
                </p>
              )}
            </div>

            {/* My choice */}
            <div className={`text-center transition-all duration-500 ${iWonRound ? 'scale-110' : iLostRound ? 'opacity-60 scale-90' : ''}`}>
              <div className="text-6xl mb-1 animate-in zoom-in duration-300" style={{ animationDelay: '100ms' }}>
                {timedOut ? '❌' : RPS_EMOJI[myRevealedChoice]}
              </div>
              <p className="text-white/50 text-xs">{myNickname}</p>
            </div>
          </div>
        ) : revealPhase === 'waiting' && myChoice ? (
          /* Waiting for opponent */
          <div className="flex flex-col items-center gap-3">
            <div className="text-7xl animate-pulse">
              {RPS_EMOJI[myChoice]}
            </div>
            <p className="text-white/40 text-sm">{t('waitingForOpponent')}</p>
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : (
          /* Choosing phase - show large prompt */
          <div className="text-center">
            <p className="text-white/60 text-lg font-medium">{t('makeYourChoice')}</p>
          </div>
        )}
      </div>

      {/* Round History Strip - only completed rounds */}
      {roundHistory.length > 0 && (
        <div className="px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            {/* Avatars on left side */}
            <div className="flex flex-col items-center gap-[3px] shrink-0">
              <AvatarCircle avatar={oppAvatar} size="sm" className="ring-1" style={{ '--tw-ring-color': `${theme.accentColor}4d` } as React.CSSProperties} />
              <div className="h-0.5" />
              <AvatarCircle avatar={myAvatar} size="sm" className="ring-1" style={{ '--tw-ring-color': `${theme.primaryColor}4d` } as React.CSSProperties} />
            </div>
            {/* Completed rounds only - scrolls to show latest */}
            <div className="flex items-center gap-1 flex-1 overflow-x-auto justify-end" style={{ scrollbarWidth: 'none' }}>
              {roundHistory.map((entry, i) => {
                const isWin = entry.winner === 'me';
                const isLoss = entry.winner === 'opp';
                const isLatest = i === roundHistory.length - 1;
                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center gap-[3px] shrink-0 ${isLatest ? 'animate-in fade-in zoom-in-95 duration-300' : 'opacity-50'}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                        isLoss ? 'bg-red-500/15 ring-1 ring-red-400/40' : 'bg-white/5'
                      }`}
                    >
                      {entry.oppTimedOut ? '❌' : RPS_EMOJI[entry.oppChoice]}
                    </div>
                    <div className="flex items-center justify-center h-3">
                      <span className="text-[9px] text-white/30 font-medium leading-none">{i + 1}</span>
                    </div>
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                        isWin ? 'ring-1' : 'bg-white/5'
                      }`}
                      style={isWin ? {
                        backgroundColor: `${theme.accentColor}26`,
                        '--tw-ring-color': `${theme.accentColor}66`,
                      } as React.CSSProperties : undefined}
                    >
                      {entry.timedOut ? '❌' : RPS_EMOJI[entry.myChoice]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Choice Buttons - always at bottom */}
      <div className="px-4 pb-6 pt-2">
        <div className="flex justify-center gap-3">
          {(['rock', 'paper', 'scissors'] as RPSChoice[]).map((choice) => {
            const isSelected = myChoice === choice;
            const isDisabled = myChoice !== null || revealPhase !== 'choosing';

            return (
              <button
                key={choice}
                onClick={() => handleChoose(choice)}
                disabled={isDisabled}
                className={`relative w-[5.5rem] h-[5.5rem] rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 ${
                  isSelected
                    ? 'ring-2 scale-105 shadow-lg'
                    : isDisabled
                      ? 'bg-white/5 opacity-40'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95'
                }`}
                style={isSelected ? {
                  backgroundColor: `${theme.accentColor}33`,
                  '--tw-ring-color': theme.accentColor,
                  boxShadow: `0 10px 15px -3px ${theme.accentColor}33`,
                } as React.CSSProperties : undefined}
              >
                <span className="text-4xl">{RPS_EMOJI[choice]}</span>
                <span className="text-white/40 text-[10px] uppercase tracking-wider">{t(choice)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
