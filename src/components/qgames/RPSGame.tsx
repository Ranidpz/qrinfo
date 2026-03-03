'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RPSChoice, RPS_EMOJI, RTDBRPSRound, resolveRPS } from '@/types/qgames';
import { useRPSState, useCountdown, useQGamesSounds } from '@/hooks/useQGamesRealtime';
import { startNewRPSRound } from '@/lib/qgames-realtime';

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
  isRTL: boolean;
  t: (key: string) => string;
  isBotMatch?: boolean;
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
  isRTL,
  t,
  isBotMatch,
}: RPSGameProps) {
  const { state: rpsState } = useRPSState(isBotMatch ? '' : codeId, isBotMatch ? '' : matchId);
  const sounds = useQGamesSounds(enableSound);

  const [myChoice, setMyChoice] = useState<RPSChoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealPhase, setRevealPhase] = useState<'choosing' | 'waiting' | 'revealing' | 'scored'>('choosing');
  const [lastRoundWinner, setLastRoundWinner] = useState<string | null>(null);
  const [scoreAnimation, setScoreAnimation] = useState<{ player: 'p1' | 'p2'; show: boolean }>({ player: 'p1', show: false });
  const [displayScores, setDisplayScores] = useState({ p1: 0, p2: 0 });
  const revealTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const matchEndedRef = useRef(false);

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
    sounds.playReveal();

    // Show the reveal for 2 seconds then transition
    revealTimeoutRef.current = setTimeout(() => {
      // Update display scores
      const p1s = isBotMatch ? botScores.p1 : (rpsState?.player1Score ?? 0);
      const p2s = isBotMatch ? botScores.p2 : (rpsState?.player2Score ?? 0);
      setDisplayScores({ p1: p1s, p2: p2s });

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

      // Check if match is over
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

      // Start next round after 2.5s from reveal
      setTimeout(() => {
        const nextRound = currentRound + 1;
        if (isBotMatch) {
          setBotRound(nextRound);
          botTimerStartRef.current = Date.now();
        } else {
          startNewRPSRound(codeId, matchId, nextRound, subsequentTimer);
        }
        setMyChoice(null);
        setRevealPhase('choosing');
        setLastRoundWinner(null);
      }, 500);
    }, 2000);

    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    };
  }, [roundData?.revealed]);

  // Handle timer expiry (auto-lose if didn't choose)
  useEffect(() => {
    if (isExpired && revealPhase === 'choosing' && !myChoice) {
      // Timer expired without choosing - submit random choice
      handleChoose(['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)] as RPSChoice);
    }
  }, [isExpired]);

  // Reset state when round changes
  useEffect(() => {
    if (rpsState && !roundData?.revealed) {
      setMyChoice(null);
      setRevealPhase('choosing');
    }
  }, [currentRound]);

  const handleChoose = useCallback(async (choice: RPSChoice) => {
    if (myChoice || isSubmitting || revealPhase !== 'choosing') return;

    setMyChoice(choice);
    setRevealPhase('waiting');
    setIsSubmitting(true);
    sounds.playSelect();

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
          move: { choice },
        }),
      });

      const data = await response.json();
      if (!data.success) {
        console.error('Move failed:', data.error);
      }
    } catch (error) {
      console.error('Move error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [myChoice, isSubmitting, revealPhase, codeId, matchId, playerId, sounds, isBotMatch, botScores, timerDuration]);

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

  return (
    <div className="min-h-screen flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header: Score Display */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        {/* My side */}
        <div className="flex items-center gap-2 relative">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl ring-2 ring-blue-400/30">
            {myAvatar}
          </div>
          <div>
            <p className="text-white text-xs font-medium truncate max-w-[80px]">{myNickname}</p>
            <p className="text-2xl font-black text-white tabular-nums">{myScore}</p>
          </div>
          {/* Score pop */}
          {scoreAnimation.show && scoreAnimation.player === (isPlayer1 ? 'p1' : 'p2') && (
            <span className="absolute -top-2 right-0 text-emerald-400 font-black text-lg animate-bounce">+1</span>
          )}
        </div>

        {/* VS + Round */}
        <div className="text-center">
          <p className="text-white/30 text-xs uppercase tracking-widest">{t('round')} {currentRound + 1}</p>
          <p className="text-white/50 font-bold text-sm">{t('firstTo')} {firstTo}</p>
        </div>

        {/* Opponent side */}
        <div className="flex items-center gap-2 relative">
          <div>
            <p className="text-white text-xs font-medium truncate max-w-[80px] text-end">{oppNickname}</p>
            <p className="text-2xl font-black text-white tabular-nums text-end">{oppScore}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl ring-2 ring-red-400/30">
            {oppAvatar}
          </div>
          {scoreAnimation.show && scoreAnimation.player === (isPlayer1 ? 'p2' : 'p1') && (
            <span className="absolute -top-2 left-0 text-emerald-400 font-black text-lg animate-bounce">+1</span>
          )}
        </div>
      </div>

      {/* Timer bar */}
      <div className="px-4 mb-4">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${progress * 100}%`,
              background: progress > 0.3 ? '#10b981' : progress > 0.1 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
        <p className="text-center text-white/30 text-xs mt-1 tabular-nums">{Math.ceil(timeLeft)}s</p>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Reveal Phase: Show both choices */}
        {(revealPhase === 'revealing' || revealPhase === 'scored') && myRevealedChoice && oppRevealedChoice ? (
          <div className="flex flex-col items-center gap-6">
            {/* Opponent's choice */}
            <div className={`text-center transition-all duration-500 ${iLostRound ? 'scale-110' : iWonRound ? 'opacity-60 scale-90' : ''}`}>
              <div className="text-7xl mb-1 animate-in zoom-in duration-300">
                {RPS_EMOJI[oppRevealedChoice]}
              </div>
              <p className="text-white/50 text-sm">{oppNickname}</p>
            </div>

            {/* Result text */}
            <div className="text-center">
              {iWonRound && (
                <p className="text-emerald-400 font-black text-2xl animate-in zoom-in duration-300">
                  {t('youWonRound')} ✓
                </p>
              )}
              {iLostRound && (
                <p className="text-red-400 font-bold text-2xl animate-in zoom-in duration-300">
                  {t('youLostRound')}
                </p>
              )}
              {!iWonRound && !iLostRound && roundData?.winner === 'draw' && (
                <p className="text-yellow-400 font-bold text-2xl animate-in zoom-in duration-300">
                  {t('draw')} =
                </p>
              )}
            </div>

            {/* My choice */}
            <div className={`text-center transition-all duration-500 ${iWonRound ? 'scale-110' : iLostRound ? 'opacity-60 scale-90' : ''}`}>
              <div className="text-7xl mb-1 animate-in zoom-in duration-300" style={{ animationDelay: '100ms' }}>
                {RPS_EMOJI[myRevealedChoice]}
              </div>
              <p className="text-white/50 text-sm">{myNickname}</p>
            </div>
          </div>
        ) : revealPhase === 'waiting' && myChoice ? (
          /* Waiting for opponent */
          <div className="flex flex-col items-center gap-4">
            <div className="text-8xl animate-pulse">
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
          <div className="text-center mb-6">
            <p className="text-white/60 text-lg font-medium">{t('makeYourChoice')}</p>
          </div>
        )}
      </div>

      {/* Choice Buttons - always at bottom */}
      <div className="px-4 pb-8 pt-4">
        <div className="flex justify-center gap-3">
          {(['rock', 'paper', 'scissors'] as RPSChoice[]).map((choice) => {
            const isSelected = myChoice === choice;
            const isDisabled = myChoice !== null || revealPhase !== 'choosing';

            return (
              <button
                key={choice}
                onClick={() => handleChoose(choice)}
                disabled={isDisabled}
                className={`relative w-24 h-24 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
                  isSelected
                    ? 'bg-emerald-500/20 ring-2 ring-emerald-400 scale-105 shadow-lg shadow-emerald-500/20'
                    : isDisabled
                      ? 'bg-white/5 opacity-40'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95'
                }`}
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
