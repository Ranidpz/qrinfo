'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { OOOChoice, OOO_EMOJI, RTDBOOORound, resolveOOO } from '@/types/qgames';
import { useOOOState, useCountdown, useQGamesSounds } from '@/hooks/useQGamesRealtime';
import { startNewOOORound } from '@/lib/qgames-realtime';

interface OddOneOutGameProps {
  codeId: string;
  matchId: string;
  playerId: string;
  playerNumber: 1 | 2 | 3;
  player1Nickname: string;
  player1Avatar: string;
  player2Nickname: string;
  player2Avatar: string;
  player3Nickname: string;
  player3Avatar: string;
  maxStrikes: number;
  firstRoundTimer: number;
  subsequentTimer: number;
  enableSound: boolean;
  onMatchEnd: (loserId: string, p1Strikes: number, p2Strikes: number, p3Strikes: number) => void;
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

function AvatarCircle({ avatar, size = 'md', className = '' }: { avatar: string; size?: 'sm' | 'md'; className?: string }) {
  const sizeClasses = { sm: 'w-6 h-6 text-sm', md: 'w-10 h-10 text-xl' };
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0 ${className}`}>
      {avatar.startsWith('http') ? (
        <img src={avatar} alt="" className="w-full h-full object-cover" />
      ) : avatar}
    </div>
  );
}

function StrikeIndicator({ strikes, maxStrikes }: { strikes: number; maxStrikes: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: maxStrikes }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-all duration-300 ${
            i < strikes ? 'bg-red-500 shadow-sm shadow-red-500/50' : 'bg-white/15'
          }`}
        />
      ))}
    </div>
  );
}

export default function OddOneOutGame({
  codeId,
  matchId,
  playerId,
  playerNumber,
  player1Nickname,
  player1Avatar,
  player2Nickname,
  player2Avatar,
  player3Nickname,
  player3Avatar,
  maxStrikes,
  firstRoundTimer,
  subsequentTimer,
  enableSound,
  onMatchEnd,
  isRTL,
  t,
  isBotMatch,
  opponentDisconnected,
  disconnectStartTime,
}: OddOneOutGameProps) {
  const { state: oooState } = useOOOState(isBotMatch ? '' : codeId, isBotMatch ? '' : matchId);
  const sounds = useQGamesSounds(enableSound);

  const [myChoice, setMyChoice] = useState<OOOChoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealPhase, setRevealPhase] = useState<'choosing' | 'waiting' | 'revealing' | 'scored'>('choosing');
  const [displayStrikes, setDisplayStrikes] = useState({ p1: 0, p2: 0, p3: 0 });

  const [roundHistory, setRoundHistory] = useState<Array<{
    p1Choice: OOOChoice;
    p2Choice: OOOChoice;
    p3Choice: OOOChoice;
    loser: 'player1' | 'player2' | 'player3' | 'draw';
  }>>([]);

  const revealTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const matchEndedRef = useRef(false);
  const choiceSubmittedRef = useRef(false);

  // Bot state
  const [botRound, setBotRound] = useState(0);
  const [botRoundData, setBotRoundData] = useState<RTDBOOORound | null>(null);
  const [botStrikes, setBotStrikes] = useState({ p1: 0, p2: 0, p3: 0 });
  const botTimerStartRef = useRef<number>(Date.now());

  useEffect(() => {
    if (isBotMatch) {
      botTimerStartRef.current = Date.now();
      setBotRoundData(null);
    }
  }, [isBotMatch, botRound]);

  const currentRound = isBotMatch ? botRound : (oooState?.currentRound ?? 0);
  const roundData = isBotMatch ? botRoundData : (oooState?.rounds?.[String(currentRound)] as RTDBOOORound | undefined);
  const timerDuration = isBotMatch
    ? (botRound === 0 ? firstRoundTimer : subsequentTimer)
    : (roundData?.timerDuration ?? firstRoundTimer);

  const { timeLeft, isExpired, progress } = useCountdown(
    isBotMatch ? botTimerStartRef.current : (roundData?.timerStartedAt ?? null),
    roundData?.revealed ? null : timerDuration
  );

  // When round is revealed, show reveal animation
  useEffect(() => {
    if (!roundData?.revealed || revealPhase === 'revealing' || revealPhase === 'scored') return;
    if (!roundData.player1Choice || !roundData.player2Choice || !roundData.player3Choice) return;

    setRevealPhase('revealing');
    setMyChoice(null);
    sounds.playReveal();

    revealTimeoutRef.current = setTimeout(() => {
      const p1s = isBotMatch ? botStrikes.p1 : (oooState?.player1Strikes ?? 0);
      const p2s = isBotMatch ? botStrikes.p2 : (oooState?.player2Strikes ?? 0);
      const p3s = isBotMatch ? botStrikes.p3 : (oooState?.player3Strikes ?? 0);
      setDisplayStrikes({ p1: p1s, p2: p2s, p3: p3s });

      setRoundHistory(prev => [...prev, {
        p1Choice: roundData.player1Choice!,
        p2Choice: roundData.player2Choice!,
        p3Choice: roundData.player3Choice!,
        loser: roundData.loser as 'player1' | 'player2' | 'player3' | 'draw',
      }]);

      if (roundData.loser !== 'draw') {
        const loserIsMe = roundData.loser === `player${playerNumber}`;
        if (loserIsMe) {
          sounds.playLoseRound();
        } else {
          sounds.playWinRound();
        }
      }

      setRevealPhase('scored');

      // Check if match is over
      if (p1s >= maxStrikes || p2s >= maxStrikes || p3s >= maxStrikes) {
        if (!matchEndedRef.current) {
          matchEndedRef.current = true;
          const loserId = p1s >= maxStrikes ? 'p1'
            : p2s >= maxStrikes ? 'p2' : 'p3';
          const loserPlayerId = loserId === 'p1' ? (isBotMatch ? playerId : oooState?.player1Strikes !== undefined ? matchPlayerIds.p1 : playerId)
            : loserId === 'p2' ? matchPlayerIds.p2 : matchPlayerIds.p3;
          setTimeout(() => onMatchEnd(loserPlayerId, p1s, p2s, p3s), 1500);
        }
        return;
      }

      // Start next round
      setTimeout(() => {
        const nextRound = currentRound + 1;
        if (isBotMatch) {
          setBotRoundData(null);
          setBotRound(nextRound);
          botTimerStartRef.current = Date.now();
        } else if (playerNumber === 1) {
          startNewOOORound(codeId, matchId, nextRound, subsequentTimer);
        }
        choiceSubmittedRef.current = false;
        setMyChoice(null);
        setRevealPhase('choosing');
      }, 500);
    }, 2000);

    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    };
  }, [roundData?.revealed]);

  // Player ID mapping for match end
  const matchPlayerIds = {
    p1: isBotMatch ? playerId : 'player1',
    p2: isBotMatch ? 'bot-1' : 'player2',
    p3: isBotMatch ? 'bot-2' : 'player3',
  };

  // Use actual match player IDs from props context
  // In online mode, QGamesViewer passes the actual player IDs
  // We reconstruct them from the playerNumber mapping
  const getMatchPlayerId = (pNum: 1 | 2 | 3) => {
    if (isBotMatch) {
      return pNum === 1 ? playerId : pNum === 2 ? 'bot-1' : 'bot-2';
    }
    // For online, we don't have direct access to other player IDs here
    // The parent (QGamesViewer) will map playerNumber back to real IDs
    return `player${pNum}`;
  };

  const handleChoose = useCallback(async (choice: OOOChoice) => {
    if (choiceSubmittedRef.current || myChoice || isSubmitting || revealPhase !== 'choosing') return;
    choiceSubmittedRef.current = true;

    setMyChoice(choice);
    setRevealPhase('waiting');
    setIsSubmitting(true);
    sounds.playSelect();

    if (isBotMatch) {
      setTimeout(() => {
        const botChoices: OOOChoice[] = ['palm', 'fist'];
        const bot1Choice = botChoices[Math.floor(Math.random() * 2)];
        const bot2Choice = botChoices[Math.floor(Math.random() * 2)];

        // Player is always player1 in bot matches
        const result = resolveOOO(choice, bot1Choice, bot2Choice);

        const newStrikes = { ...botStrikes };
        if (result === 'player1') newStrikes.p1 += 1;
        else if (result === 'player2') newStrikes.p2 += 1;
        else if (result === 'player3') newStrikes.p3 += 1;

        setBotStrikes(newStrikes);
        setBotRoundData({
          player1Choice: choice,
          player2Choice: bot1Choice,
          player3Choice: bot2Choice,
          loser: result,
          timerStartedAt: botTimerStartRef.current,
          timerDuration,
          revealed: true,
        });
        setIsSubmitting(false);
      }, 800 + Math.random() * 1200);
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
          gameType: 'oddoneout',
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
  }, [myChoice, isSubmitting, revealPhase, codeId, matchId, playerId, sounds, isBotMatch, botStrikes, timerDuration]);

  // Handle timer expiry
  useEffect(() => {
    if (!isExpired || revealPhase !== 'choosing' || myChoice || choiceSubmittedRef.current) return;

    choiceSubmittedRef.current = true;

    if (isBotMatch) {
      sounds.playLoseRound();
      const botChoices: OOOChoice[] = ['palm', 'fist'];
      const myForced = botChoices[Math.floor(Math.random() * 2)];
      const bot1Choice = botChoices[Math.floor(Math.random() * 2)];
      const bot2Choice = botChoices[Math.floor(Math.random() * 2)];
      const result = resolveOOO(myForced, bot1Choice, bot2Choice);

      const newStrikes = { ...botStrikes };
      if (result === 'player1') newStrikes.p1 += 1;
      else if (result === 'player2') newStrikes.p2 += 1;
      else if (result === 'player3') newStrikes.p3 += 1;

      setBotStrikes(newStrikes);
      setBotRoundData({
        player1Choice: myForced,
        player2Choice: bot1Choice,
        player3Choice: bot2Choice,
        loser: result,
        timerStartedAt: botTimerStartRef.current,
        timerDuration,
        revealed: true,
      });
    } else {
      const randomChoice: OOOChoice = Math.random() < 0.5 ? 'palm' : 'fist';
      handleChoose(randomChoice);
    }
  }, [isExpired, revealPhase, myChoice, handleChoose, isBotMatch, sounds, botStrikes, timerDuration]);

  // Reset state when round changes (online matches)
  useEffect(() => {
    if (oooState && !roundData?.revealed) {
      choiceSubmittedRef.current = false;
      setMyChoice(null);
      setRevealPhase('choosing');
    }
  }, [currentRound]);

  // Player info arrays for rendering
  const players = [
    { num: 1, nickname: player1Nickname, avatar: player1Avatar, strikes: displayStrikes.p1 },
    { num: 2, nickname: player2Nickname, avatar: player2Avatar, strikes: displayStrikes.p2 },
    { num: 3, nickname: player3Nickname, avatar: player3Avatar, strikes: displayStrikes.p3 },
  ];

  const myIdx = playerNumber - 1;
  const otherPlayers = players.filter((_, i) => i !== myIdx);

  // Revealed choices
  const getChoice = (pNum: number) => {
    if (!roundData?.revealed) return null;
    if (pNum === 1) return roundData.player1Choice;
    if (pNum === 2) return roundData.player2Choice;
    return roundData.player3Choice;
  };

  const myRevealedChoice = getChoice(playerNumber);
  const isLoserRound = roundData?.loser === `player${playerNumber}`;
  const isDraw = roundData?.loser === 'draw';

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden relative" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Disconnect countdown banner */}
      {opponentDisconnected && disconnectStartTime && (
        <DisconnectCountdownBanner
          startTime={disconnectStartTime}
          duration={5}
          label={t('opponentDisconnected')}
        />
      )}

      {/* Header: 3-player strikes display */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1.5 gap-1">
        {players.map((p) => {
          const isMe = p.num === playerNumber;
          return (
            <div key={p.num} className={`flex items-center gap-1.5 flex-1 ${p.num === 2 ? 'justify-center' : p.num === 3 ? 'justify-end' : ''}`}>
              <AvatarCircle
                avatar={p.avatar}
                size="md"
                className={`ring-2 ${isMe ? 'ring-blue-400/40' : 'ring-white/10'}`}
              />
              <div className="min-w-0">
                <p className="text-white text-[10px] font-medium truncate max-w-[60px]">
                  {isMe ? t('you') : p.nickname}
                </p>
                <StrikeIndicator strikes={p.strikes} maxStrikes={maxStrikes} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Round info */}
      <div className="text-center pb-1">
        <p className="text-white/30 text-[10px] uppercase tracking-widest">{t('round')} {currentRound + 1}</p>
        <p className="text-white/40 text-[10px]">{maxStrikes} {t('strikes')} = {t('eliminated')}</p>
      </div>

      {/* Timer bar */}
      <div className="px-4 mb-2">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${progress * 100}%`,
              background: progress > 0.3 ? '#10b981' : progress > 0.1 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
        <p className="text-center text-white/30 text-[10px] mt-0.5 tabular-nums">{Math.ceil(timeLeft)}s</p>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0">
        {(revealPhase === 'revealing' || revealPhase === 'scored') && roundData?.revealed ? (
          /* Reveal: Show all 3 choices */
          <div className="flex flex-col items-center gap-3 w-full">
            {/* Other players' choices */}
            <div className="flex justify-center gap-6 w-full">
              {otherPlayers.map((p) => {
                const choice = getChoice(p.num);
                const isOddOne = roundData.loser === `player${p.num}`;
                return (
                  <div key={p.num} className={`text-center transition-all duration-500 ${isOddOne ? 'scale-110' : ''}`}>
                    <div className={`text-5xl mb-1 animate-in zoom-in duration-300 ${
                      isOddOne ? 'ring-4 ring-red-500/40 rounded-2xl p-2 bg-red-500/10' : ''
                    }`}>
                      {choice ? OOO_EMOJI[choice] : '❓'}
                    </div>
                    <p className={`text-xs ${isOddOne ? 'text-red-400 font-bold' : 'text-white/50'}`}>{p.nickname}</p>
                    {isOddOne && <p className="text-red-400 text-[10px] font-bold mt-0.5">{t('oddOneOut')}</p>}
                  </div>
                );
              })}
            </div>

            {/* Result text */}
            <div className="text-center my-1">
              {isLoserRound && (
                <p className="text-red-400 font-bold text-xl animate-in zoom-in duration-300">
                  {t('youGotStrike')} ✗
                </p>
              )}
              {!isLoserRound && !isDraw && (
                <p className="text-emerald-400 font-black text-xl animate-in zoom-in duration-300">
                  {t('youSurvived')} ✓
                </p>
              )}
              {isDraw && (
                <p className="text-yellow-400 font-bold text-xl animate-in zoom-in duration-300">
                  {t('allSame')} =
                </p>
              )}
            </div>

            {/* My choice */}
            <div className={`text-center transition-all duration-500 ${isLoserRound ? 'scale-110' : ''}`}>
              <div className={`text-5xl mb-1 animate-in zoom-in duration-300 ${
                isLoserRound ? 'ring-4 ring-red-500/40 rounded-2xl p-2 bg-red-500/10' : ''
              }`}>
                {myRevealedChoice ? OOO_EMOJI[myRevealedChoice] : '❓'}
              </div>
              <p className={`text-xs ${isLoserRound ? 'text-red-400 font-bold' : 'text-white/50'}`}>{t('you')}</p>
              {isLoserRound && <p className="text-red-400 text-[10px] font-bold mt-0.5">{t('oddOneOut')}</p>}
            </div>
          </div>
        ) : revealPhase === 'waiting' && myChoice ? (
          /* Waiting for others */
          <div className="flex flex-col items-center gap-3">
            <div className="text-7xl animate-pulse">
              {OOO_EMOJI[myChoice]}
            </div>
            <p className="text-white/40 text-sm">{t('waitingForPlayers')}</p>
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : (
          /* Choosing phase */
          <div className="text-center">
            <p className="text-white/60 text-lg font-medium">{t('makeYourChoice')}</p>
          </div>
        )}
      </div>

      {/* Round History Strip */}
      {roundHistory.length > 0 && (
        <div className="px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            {/* Player avatars on left */}
            <div className="flex flex-col items-center gap-[2px] shrink-0">
              {otherPlayers.map((p) => (
                <AvatarCircle key={p.num} avatar={p.avatar} size="sm" className="ring-1 ring-white/10" />
              ))}
              <div className="h-px" />
              <AvatarCircle avatar={players[myIdx].avatar} size="sm" className="ring-1 ring-emerald-400/30" />
            </div>
            {/* Rounds */}
            <div className="flex items-center gap-1 flex-1 overflow-x-auto justify-end" style={{ scrollbarWidth: 'none' }}>
              {roundHistory.map((entry, i) => {
                const myC = playerNumber === 1 ? entry.p1Choice : playerNumber === 2 ? entry.p2Choice : entry.p3Choice;
                const iAmLoser = entry.loser === `player${playerNumber}`;
                return (
                  <div key={i} className="flex flex-col items-center gap-[2px] animate-in fade-in zoom-in-95 duration-300 shrink-0">
                    {otherPlayers.map((p) => {
                      const c = p.num === 1 ? entry.p1Choice : p.num === 2 ? entry.p2Choice : entry.p3Choice;
                      const isOdd = entry.loser === `player${p.num}`;
                      return (
                        <div key={p.num} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                          isOdd ? 'bg-red-500/15 ring-1 ring-red-400/40' : 'bg-white/5'
                        }`}>
                          {OOO_EMOJI[c]}
                        </div>
                      );
                    })}
                    <div className={`w-4 h-0.5 rounded-full ${
                      entry.loser === 'draw' ? 'bg-yellow-400/60'
                        : iAmLoser ? 'bg-red-400 shadow-sm shadow-red-400/50'
                        : 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                    }`} />
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                      iAmLoser ? 'bg-red-500/15 ring-1 ring-red-400/40'
                        : entry.loser !== 'draw' ? 'bg-emerald-500/15 ring-1 ring-emerald-400/40'
                        : 'bg-white/5'
                    }`}>
                      {OOO_EMOJI[myC]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Choice Buttons */}
      <div className="px-4 pb-6 pt-2">
        <div className="flex justify-center gap-4">
          {(['palm', 'fist'] as OOOChoice[]).map((choice) => {
            const isSelected = myChoice === choice;
            const isDisabled = myChoice !== null || revealPhase !== 'choosing';

            return (
              <button
                key={choice}
                onClick={() => handleChoose(choice)}
                disabled={isDisabled}
                className={`relative w-[7rem] h-[7rem] rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
                  isSelected
                    ? 'bg-emerald-500/20 ring-2 ring-emerald-400 scale-105 shadow-lg shadow-emerald-500/20'
                    : isDisabled
                      ? 'bg-white/5 opacity-40'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95'
                }`}
              >
                <span className="text-5xl">{OOO_EMOJI[choice]}</span>
                <span className="text-white/40 text-xs uppercase tracking-wider">{t(choice)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
