'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RTDBTTTState,
  checkTTTWinner,
  getWinLine,
  parseTTTBoard,
} from '@/types/qgames';
import { useTTTState, useCountdown, useQGamesSounds } from '@/hooks/useQGamesRealtime';
import { startNewTTTRound } from '@/lib/qgames-realtime';
import { useQGamesTheme } from './QGamesThemeContext';
import ExitGameButton from './ExitGameButton';

interface TicTacToeGameProps {
  codeId: string;
  matchId: string;
  playerId: string;
  isPlayer1: boolean;
  player1Id: string;
  player2Id: string;
  player1Nickname: string;
  player1Avatar: string;
  player2Nickname: string;
  player2Avatar: string;
  firstTo: number;
  turnTimer: number;
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

function AvatarCircle({ avatar, size = 'md', className = '' }: { avatar: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = { sm: 'w-6 h-6 text-sm', md: 'w-12 h-12 text-2xl', lg: 'w-14 h-14 text-3xl' };
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0 ${className}`}>
      {avatar.startsWith('http') ? (
        <img src={avatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : avatar}
    </div>
  );
}

export default function TicTacToeGame({
  codeId,
  matchId,
  playerId,
  isPlayer1,
  player1Id,
  player2Id,
  player1Nickname,
  player1Avatar,
  player2Nickname,
  player2Avatar,
  firstTo,
  turnTimer,
  enableSound,
  onMatchEnd,
  onForfeit,
  isRTL,
  t,
  isBotMatch,
  opponentDisconnected,
  disconnectStartTime,
}: TicTacToeGameProps) {
  const { state: tttState } = useTTTState(isBotMatch ? '' : codeId, isBotMatch ? '' : matchId);
  const sounds = useQGamesSounds(enableSound);

  const [displayScores, setDisplayScores] = useState({ p1: 0, p2: 0 });
  const [scoreAnimation, setScoreAnimation] = useState<{ player: 'p1' | 'p2'; show: boolean }>({ player: 'p1', show: false });
  const [roundHistory, setRoundHistory] = useState<Array<{
    winner: 'p1' | 'p2' | 'draw';
    myMarker: 'X' | 'O';
  }>>([]);

  const matchEndedRef = useRef(false);
  const roundHandledRef = useRef(-1);
  const tttStateRef = useRef(tttState);
  tttStateRef.current = tttState;

  // Bot state
  const [botState, setBotState] = useState<RTDBTTTState | null>(null);
  const botTimerStartRef = useRef<number>(Date.now());
  const botThinkingRef = useRef(false);

  // Initialize bot state on mount
  useEffect(() => {
    if (isBotMatch) {
      const now = Date.now();
      botTimerStartRef.current = now;
      setBotState({
        board: '_________',
        currentTurn: player1Id,
        xPlayerId: player1Id,
        oPlayerId: player2Id,
        winner: null,
        isDraw: false,
        moveCount: 0,
        currentRound: 0,
        player1Score: 0,
        player2Score: 0,
        firstTo,
        timerStartedAt: now,
        timerDuration: turnTimer,
        winLine: null,
        roundFinished: false,
      });
    }
  }, [isBotMatch, player1Id, player2Id, firstTo, turnTimer]);

  // Current state (bot or online)
  const state = isBotMatch ? botState : tttState;
  const currentRound = state?.currentRound ?? 0;
  const isMyTurn = state ? state.currentTurn === playerId : false;
  const myMarker = state ? (state.xPlayerId === playerId ? 'X' : 'O') : 'X';

  // Timer — only active when it's someone's turn and round not finished
  const timerActive = state && !state.roundFinished;
  const { timeLeft, isExpired, progress } = useCountdown(
    timerActive ? (isBotMatch ? botTimerStartRef.current : (state?.timerStartedAt ?? null)) : null,
    timerActive ? (state?.timerDuration ?? turnTimer) : null
  );

  // Player info
  const myNickname = isPlayer1 ? player1Nickname : player2Nickname;
  const myAvatar = isPlayer1 ? player1Avatar : player2Avatar;
  const oppNickname = isPlayer1 ? player2Nickname : player1Nickname;
  const oppAvatar = isPlayer1 ? player2Avatar : player1Avatar;
  const myScore = isPlayer1 ? displayScores.p1 : displayScores.p2;
  const oppScore = isPlayer1 ? displayScores.p2 : displayScores.p1;

  // Bot move logic
  useEffect(() => {
    if (!isBotMatch || !botState || botState.roundFinished || botThinkingRef.current) return;
    if (botState.currentTurn === playerId) return; // Player's turn

    botThinkingRef.current = true;
    const delay = 1000 + Math.random() * 2000;

    const timeout = setTimeout(() => {
      setBotState(prev => {
        if (!prev || prev.roundFinished) return prev;
        const board = prev.board.split('');
        const emptyCells = board.reduce<number[]>((acc, c, i) => c === '_' ? [...acc, i] : acc, []);
        if (emptyCells.length === 0) return prev;

        const botCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const botMarker = prev.xPlayerId === playerId ? 'O' : 'X';
        board[botCell] = botMarker;
        const newBoard = board.join('');
        const boardCells = parseTTTBoard(newBoard);
        const winnerMarker = checkTTTWinner(boardCells);
        const winLine = getWinLine(boardCells);
        const moveCount = prev.moveCount + 1;

        const next = { ...prev, board: newBoard, moveCount };

        if (winnerMarker) {
          // Bot wins the round
          const botIsP1 = !isPlayer1;
          next.winner = botIsP1 ? player1Id : player2Id;
          next.winLine = winLine;
          next.roundFinished = true;
          if (botIsP1) next.player1Score += 1;
          else next.player2Score += 1;
        } else if (moveCount >= 9) {
          next.isDraw = true;
          next.roundFinished = true;
        } else {
          next.currentTurn = playerId;
          next.timerStartedAt = Date.now();
          botTimerStartRef.current = Date.now();
        }

        return next;
      });
      botThinkingRef.current = false;
    }, delay);

    return () => {
      clearTimeout(timeout);
      botThinkingRef.current = false;
    };
  }, [isBotMatch, botState?.currentTurn, botState?.roundFinished, botState?.currentRound, playerId, isPlayer1, player1Id, player2Id]);

  // Handle round end (both bot and online)
  useEffect(() => {
    if (!state || !state.roundFinished) return;
    if (roundHandledRef.current === state.currentRound) return;
    roundHandledRef.current = state.currentRound;

    // Update display scores
    setDisplayScores({ p1: state.player1Score, p2: state.player2Score });

    // Play sound and animate
    if (state.winner) {
      const winnerIsP1 = state.winner === player1Id;
      setScoreAnimation({ player: winnerIsP1 ? 'p1' : 'p2', show: true });
      if (state.winner === playerId) {
        sounds.playWinRound();
      } else {
        sounds.playLoseRound();
      }
      setTimeout(() => setScoreAnimation(prev => ({ ...prev, show: false })), 1000);
    } else {
      sounds.playReveal();
    }

    // Add to round history
    setRoundHistory(prev => [...prev, {
      winner: state.winner === player1Id ? 'p1' : state.winner === player2Id ? 'p2' : 'draw',
      myMarker: state.xPlayerId === playerId ? 'X' : 'O',
    }]);

    // Check if match is over
    if (state.winner && (state.player1Score >= firstTo || state.player2Score >= firstTo)) {
      if (!matchEndedRef.current) {
        matchEndedRef.current = true;
        const winnerId = state.player1Score >= firstTo ? player1Id : player2Id;
        setTimeout(() => onMatchEnd(winnerId, state.player1Score, state.player2Score), 2000);
      }
      return;
    }

    // Start next round after 2s
    setTimeout(() => {
      const nextRound = state.currentRound + 1;
      if (isBotMatch) {
        const now = Date.now();
        botTimerStartRef.current = now;
        const xPlayer = nextRound % 2 === 0 ? player1Id : player2Id;
        const oPlayer = nextRound % 2 === 0 ? player2Id : player1Id;
        setBotState({
          board: '_________',
          currentTurn: xPlayer,
          xPlayerId: xPlayer,
          oPlayerId: oPlayer,
          winner: null,
          isDraw: false,
          moveCount: 0,
          currentRound: nextRound,
          player1Score: state.player1Score,
          player2Score: state.player2Score,
          firstTo,
          timerStartedAt: now,
          timerDuration: turnTimer,
          winLine: null,
          roundFinished: false,
        });
        roundHandledRef.current = -1; // Reset for new round
      } else if (isPlayer1) {
        // Only player1 starts new rounds to avoid duplicates
        startNewTTTRound(
          codeId, matchId, nextRound,
          player1Id, player2Id,
          state.player1Score, state.player2Score,
          turnTimer, firstTo
        );
      }
    }, 2000);
  }, [state?.roundFinished, state?.currentRound]);

  // Handle cell click
  const handleCellClick = useCallback(async (cellIndex: number) => {
    if (!state || !isMyTurn || state.roundFinished) return;
    const board = state.board.split('');
    if (board[cellIndex] !== '_') return;

    sounds.playSelect();

    if (isBotMatch) {
      setBotState(prev => {
        if (!prev || prev.roundFinished || prev.currentTurn !== playerId) return prev;
        const b = prev.board.split('');
        if (b[cellIndex] !== '_') return prev;

        const marker = prev.xPlayerId === playerId ? 'X' : 'O';
        b[cellIndex] = marker;
        const newBoard = b.join('');
        const boardCells = parseTTTBoard(newBoard);
        const winnerMarker = checkTTTWinner(boardCells);
        const winLine = getWinLine(boardCells);
        const moveCount = prev.moveCount + 1;

        const next = { ...prev, board: newBoard, moveCount };

        if (winnerMarker) {
          next.winner = playerId;
          next.winLine = winLine;
          next.roundFinished = true;
          if (isPlayer1) next.player1Score += 1;
          else next.player2Score += 1;
        } else if (moveCount >= 9) {
          next.isDraw = true;
          next.roundFinished = true;
        } else {
          // Switch to bot's turn
          const botId = isPlayer1 ? player2Id : player1Id;
          next.currentTurn = botId;
          next.timerStartedAt = Date.now();
          botTimerStartRef.current = Date.now();
        }

        return next;
      });
      return;
    }

    // Online: send move to API
    try {
      await fetch('/api/qgames/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          matchId,
          playerId,
          gameType: 'tictactoe',
          move: { cellIndex },
        }),
      });
    } catch (error) {
      console.error('TTT move error:', error);
    }
  }, [state, isMyTurn, isBotMatch, codeId, matchId, playerId, isPlayer1, player1Id, player2Id, sounds]);

  // Handle timeout
  useEffect(() => {
    if (!isExpired || !state || state.roundFinished || !isMyTurn) return;

    // Verify actual time elapsed
    const timerStart = isBotMatch ? botTimerStartRef.current : state.timerStartedAt;
    if (timerStart) {
      const actualElapsed = (Date.now() - timerStart) / 1000;
      if (actualElapsed < (state.timerDuration || turnTimer) - 0.5) return;
    }

    sounds.playLoseRound();

    if (isBotMatch) {
      // Forfeit: bot wins the round
      setBotState(prev => {
        if (!prev || prev.roundFinished) return prev;
        const botId = isPlayer1 ? player2Id : player1Id;
        const next = { ...prev, roundFinished: true, winner: botId };
        if (isPlayer1) next.player2Score += 1;
        else next.player1Score += 1;
        return next;
      });
    } else {
      // Send timeout to API
      fetch('/api/qgames/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          matchId,
          playerId,
          gameType: 'tictactoe',
          move: { cellIndex: -1, timedOut: true },
        }),
      }).catch(console.error);
    }
  }, [isExpired, state?.roundFinished, isMyTurn, state?.currentRound]);

  // Render board
  const board = state?.board ?? '_________';
  const cells = board.split('');
  const winLine = state?.winLine;

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
          <AvatarCircle avatar={myAvatar} size="md" className="ring-2 ring-blue-400/30" />
          <div>
            <p className="text-white text-xs font-medium truncate max-w-[80px]">{myNickname}</p>
            <p className="text-2xl font-black text-white tabular-nums">{myScore}</p>
          </div>
          {scoreAnimation.show && scoreAnimation.player === (isPlayer1 ? 'p1' : 'p2') && (
            <span className="absolute -top-2 right-0 text-emerald-400 font-black text-lg animate-bounce">+1</span>
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
          <AvatarCircle avatar={oppAvatar} size="md" className="ring-2 ring-red-400/30" />
          {scoreAnimation.show && scoreAnimation.player === (isPlayer1 ? 'p2' : 'p1') && (
            <span className="absolute -top-2 left-0 text-emerald-400 font-black text-lg animate-bounce">+1</span>
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
              background: progress > 0.3 ? '#10b981' : progress > 0.1 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
        <p className="text-center text-white/30 text-[10px] mt-0.5 tabular-nums">{Math.ceil(timeLeft)}s</p>
      </div>

      {/* Turn indicator */}
      <div className="text-center mb-3">
        {state?.roundFinished ? (
          <p className={`font-bold text-base animate-in zoom-in duration-300 ${
            state.winner === playerId ? 'text-emerald-400' :
            state.isDraw ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {state.winner === playerId ? t('youWonRound') + ' ✓' :
             state.isDraw ? t('roundDraw') || t('draw') :
             t('youLostRound')}
          </p>
        ) : isMyTurn ? (
          <p className="text-emerald-400 font-medium text-sm animate-pulse">
            {t('yourTurn') || t('makeYourChoice')} · {myMarker === 'X' ? '❌' : '⭕'}
          </p>
        ) : (
          <p className="text-white/40 text-sm">
            {t('opponentTurn') || t('waitingForOpponent')}
          </p>
        )}
      </div>

      {/* 3x3 Board */}
      <div className="flex-1 flex items-center justify-center px-6 min-h-0">
        <div className="grid grid-cols-3 gap-2 w-[280px]">
          {cells.map((cell, i) => {
            const isWinCell = winLine?.includes(i);
            const isEmpty = cell === '_';
            const canClick = isMyTurn && isEmpty && !state?.roundFinished;

            return (
              <button
                key={i}
                onClick={() => canClick && handleCellClick(i)}
                disabled={!canClick}
                className={`aspect-square rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isWinCell
                    ? 'bg-emerald-500/20 ring-2 ring-emerald-400 scale-105'
                    : isEmpty && canClick
                      ? 'bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95'
                      : isEmpty
                        ? 'bg-white/5 border border-white/5'
                        : 'bg-white/5'
                }`}
              >
                {cell === 'X' && (
                  <span className={`text-5xl font-black transition-all duration-300 ${
                    isWinCell ? 'text-emerald-400 scale-110' : 'text-blue-400'
                  } animate-in zoom-in duration-200`}>
                    ✕
                  </span>
                )}
                {cell === 'O' && (
                  <span className={`text-5xl font-black transition-all duration-300 ${
                    isWinCell ? 'text-emerald-400 scale-110' : 'text-red-400'
                  } animate-in zoom-in duration-200`}>
                    ○
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Round History Strip */}
      {roundHistory.length > 0 && (
        <div className="px-3 py-1.5">
          <div className="flex items-center gap-1.5 justify-center">
            {roundHistory.map((entry, i) => {
              const isLatest = i === roundHistory.length - 1;
              return (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 transition-all ${
                    entry.winner === (isPlayer1 ? 'p1' : 'p2')
                      ? 'bg-emerald-500/15 ring-1 ring-emerald-400/40'
                      : entry.winner === 'draw'
                        ? 'bg-yellow-500/15 ring-1 ring-yellow-400/40'
                        : 'bg-red-500/15 ring-1 ring-red-400/40'
                  } ${isLatest ? 'animate-in fade-in zoom-in-95 duration-300' : 'opacity-50'}`}
                >
                  {entry.winner === (isPlayer1 ? 'p1' : 'p2') ? '✓' : entry.winner === 'draw' ? '=' : '✗'}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Marker indicator */}
      <div className="text-center pb-4">
        <p className="text-white/20 text-[10px]">
          {myMarker === 'X' ? '❌' : '⭕'} {myNickname} · {myMarker === 'X' ? '⭕' : '❌'} {oppNickname}
        </p>
      </div>
    </div>
  );
}
