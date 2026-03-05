'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RTDBC4State,
  C4_COLS,
  C4_ROWS,
  C4_CELLS,
  C4Marker,
  checkC4Winner,
  getC4WinLine,
  parseC4Board,
  getC4DropRow,
} from '@/types/qgames';
import { useC4State, useCountdown, useQGamesSounds } from '@/hooks/useQGamesRealtime';
import { startNewC4Round } from '@/lib/qgames-realtime';
import { useQGamesTheme } from './QGamesThemeContext';
import ExitGameButton from './ExitGameButton';

interface Connect4GameProps {
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

/** Bot AI: checks for winning/blocking moves, then picks random */
function botPickColumn(boardStr: string, botMarker: C4Marker): number {
  const board = parseC4Board(boardStr);
  const availableCols: number[] = [];
  for (let col = 0; col < C4_COLS; col++) {
    if (getC4DropRow(board, col) !== -1) availableCols.push(col);
  }
  if (availableCols.length === 0) return -1;

  // Check if bot can win
  for (const col of availableCols) {
    const row = getC4DropRow(board, col);
    const testBoard = [...board];
    testBoard[row * C4_COLS + col] = botMarker;
    if (checkC4Winner(testBoard)) return col;
  }

  // Check if bot needs to block opponent
  const oppMarker: C4Marker = botMarker === 'R' ? 'W' : 'R';
  for (const col of availableCols) {
    const row = getC4DropRow(board, col);
    const testBoard = [...board];
    testBoard[row * C4_COLS + col] = oppMarker;
    if (checkC4Winner(testBoard)) return col;
  }

  // Prefer center columns
  const centerPref = [3, 2, 4, 1, 5, 0, 6];
  for (const col of centerPref) {
    if (availableCols.includes(col)) return col;
  }

  return availableCols[Math.floor(Math.random() * availableCols.length)];
}

export default function Connect4Game({
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
}: Connect4GameProps) {
  const { state: c4State } = useC4State(isBotMatch ? '' : codeId, isBotMatch ? '' : matchId);
  const sounds = useQGamesSounds(enableSound);

  const [displayScores, setDisplayScores] = useState({ p1: 0, p2: 0 });
  const [scoreAnimation, setScoreAnimation] = useState<{ player: 'p1' | 'p2'; show: boolean }>({ player: 'p1', show: false });
  const [roundHistory, setRoundHistory] = useState<Array<{
    winner: 'p1' | 'p2' | 'draw';
    myColor: 'R' | 'W';
  }>>([]);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const matchEndedRef = useRef(false);
  const roundHandledRef = useRef(-1);

  // Bot state
  const [botState, setBotState] = useState<RTDBC4State | null>(null);
  const botTimerStartRef = useRef<number>(Date.now());
  const botThinkingRef = useRef(false);

  // Initialize bot state on mount
  useEffect(() => {
    if (isBotMatch) {
      const now = Date.now();
      botTimerStartRef.current = now;
      setBotState({
        board: '_'.repeat(42),
        currentTurn: player1Id,
        redPlayerId: player1Id,
        whitePlayerId: player2Id,
        winner: null,
        isDraw: false,
        moveCount: 0,
        lastCol: -1,
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
  const state = isBotMatch ? botState : c4State;
  const currentRound = state?.currentRound ?? 0;
  const isMyTurn = state ? state.currentTurn === playerId : false;
  const myColor: C4Marker = state ? (state.redPlayerId === playerId ? 'R' : 'W') : 'R';

  // Timer
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
    const delay = 800 + Math.random() * 1500;

    const timeout = setTimeout(() => {
      setBotState(prev => {
        if (!prev || prev.roundFinished) return prev;

        const botMarker: C4Marker = prev.redPlayerId === playerId ? 'W' : 'R';
        const col = botPickColumn(prev.board, botMarker);
        if (col === -1) return prev;

        const board = parseC4Board(prev.board);
        const row = getC4DropRow(board, col);
        if (row === -1) return prev;

        const cellIndex = row * C4_COLS + col;
        const boardChars = prev.board.split('');
        boardChars[cellIndex] = botMarker;
        const newBoard = boardChars.join('');
        const boardCells = parseC4Board(newBoard);
        const winnerMarker = checkC4Winner(boardCells);
        const winLine = getC4WinLine(boardCells);
        const moveCount = prev.moveCount + 1;

        const next: RTDBC4State = { ...prev, board: newBoard, moveCount, lastCol: col };

        if (winnerMarker) {
          const botId = isPlayer1 ? player2Id : player1Id;
          next.winner = botId;
          next.winLine = winLine;
          next.roundFinished = true;
          if (isPlayer1) next.player2Score += 1;
          else next.player1Score += 1;
        } else if (moveCount >= C4_CELLS) {
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

  // Handle round end
  useEffect(() => {
    if (!state || !state.roundFinished) return;
    if (roundHandledRef.current === state.currentRound) return;
    roundHandledRef.current = state.currentRound;

    setDisplayScores({ p1: state.player1Score, p2: state.player2Score });

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

    setRoundHistory(prev => [...prev, {
      winner: state.winner === player1Id ? 'p1' : state.winner === player2Id ? 'p2' : 'draw',
      myColor: state.redPlayerId === playerId ? 'R' : 'W',
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
        const redPlayer = nextRound % 2 === 0 ? player1Id : player2Id;
        const whitePlayer = nextRound % 2 === 0 ? player2Id : player1Id;
        setBotState({
          board: '_'.repeat(42),
          currentTurn: redPlayer,
          redPlayerId: redPlayer,
          whitePlayerId: whitePlayer,
          winner: null,
          isDraw: false,
          moveCount: 0,
          lastCol: -1,
          currentRound: nextRound,
          player1Score: state.player1Score,
          player2Score: state.player2Score,
          firstTo,
          timerStartedAt: now,
          timerDuration: turnTimer,
          winLine: null,
          roundFinished: false,
        });
        roundHandledRef.current = -1;
      } else if (isPlayer1) {
        startNewC4Round(
          codeId, matchId, nextRound,
          player1Id, player2Id,
          state.player1Score, state.player2Score,
          turnTimer, firstTo
        );
      }
    }, 2000);
  }, [state?.roundFinished, state?.currentRound]);

  // Handle column click
  const handleColumnClick = useCallback(async (col: number) => {
    if (!state || !isMyTurn || state.roundFinished) return;
    const board = parseC4Board(state.board);
    const dropRow = getC4DropRow(board, col);
    if (dropRow === -1) return; // Column full

    sounds.playSelect();

    if (isBotMatch) {
      setBotState(prev => {
        if (!prev || prev.roundFinished || prev.currentTurn !== playerId) return prev;
        const b = parseC4Board(prev.board);
        const row = getC4DropRow(b, col);
        if (row === -1) return prev;

        const cellIndex = row * C4_COLS + col;
        const marker: C4Marker = prev.redPlayerId === playerId ? 'R' : 'W';
        const boardChars = prev.board.split('');
        boardChars[cellIndex] = marker;
        const newBoard = boardChars.join('');
        const boardCells = parseC4Board(newBoard);
        const winnerMarker = checkC4Winner(boardCells);
        const winLine = getC4WinLine(boardCells);
        const moveCount = prev.moveCount + 1;

        const next: RTDBC4State = { ...prev, board: newBoard, moveCount, lastCol: col };

        if (winnerMarker) {
          next.winner = playerId;
          next.winLine = winLine;
          next.roundFinished = true;
          if (isPlayer1) next.player1Score += 1;
          else next.player2Score += 1;
        } else if (moveCount >= C4_CELLS) {
          next.isDraw = true;
          next.roundFinished = true;
        } else {
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
          gameType: 'connect4',
          move: { column: col },
        }),
      });
    } catch (error) {
      console.error('C4 move error:', error);
    }
  }, [state, isMyTurn, isBotMatch, codeId, matchId, playerId, isPlayer1, player1Id, player2Id, sounds]);

  // Handle timeout
  useEffect(() => {
    if (!isExpired || !state || state.roundFinished || !isMyTurn) return;

    const timerStart = isBotMatch ? botTimerStartRef.current : state.timerStartedAt;
    if (timerStart) {
      const actualElapsed = (Date.now() - timerStart) / 1000;
      if (actualElapsed < (state.timerDuration || turnTimer) - 0.5) return;
    }

    sounds.playLoseRound();

    if (isBotMatch) {
      setBotState(prev => {
        if (!prev || prev.roundFinished) return prev;
        const botId = isPlayer1 ? player2Id : player1Id;
        const next = { ...prev, roundFinished: true, winner: botId };
        if (isPlayer1) next.player2Score += 1;
        else next.player1Score += 1;
        return next;
      });
    } else {
      fetch('/api/qgames/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          matchId,
          playerId,
          gameType: 'connect4',
          move: { column: -1, timedOut: true },
        }),
      }).catch(console.error);
    }
  }, [isExpired, state?.roundFinished, isMyTurn, state?.currentRound]);

  // Render board
  const boardStr = state?.board ?? '_'.repeat(42);
  const cells = boardStr.split('');
  const winLine = state?.winLine;

  // Find ghost row for hovered column
  const ghostRow = hoveredCol !== null && isMyTurn && !state?.roundFinished
    ? getC4DropRow(parseC4Board(boardStr), hoveredCol)
    : -1;
  const ghostIndex = ghostRow >= 0 && hoveredCol !== null ? ghostRow * C4_COLS + hoveredCol : -1;

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
      <div className="flex items-center justify-between px-4 pt-14 pb-1.5">
        {/* My side */}
        <div className="flex items-center gap-2 relative">
          <AvatarCircle avatar={myAvatar} size="md" className="ring-2 ring-red-400/30" />
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
          <AvatarCircle avatar={oppAvatar} size="md" className="ring-2 ring-white/30" />
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
      <div className="text-center mb-2">
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
            {t('yourTurn') || t('makeYourChoice')} · {myColor === 'R' ? '🔴' : '⚪'}
          </p>
        ) : (
          <p className="text-white/40 text-sm">
            {t('opponentTurn') || t('waitingForOpponent')}
          </p>
        )}
      </div>

      {/* Connect 4 Board */}
      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        <div className="bg-blue-800/40 rounded-2xl p-2 border border-blue-600/20">
          {/* Column click zones */}
          <div className="grid grid-cols-7 gap-1" style={{ width: '100%', maxWidth: '320px' }}>
            {Array.from({ length: C4_CELLS }).map((_, i) => {
              const row = Math.floor(i / C4_COLS);
              const col = i % C4_COLS;
              const cell = cells[i];
              const isWinCell = winLine?.includes(i);
              const isEmpty = cell === '_';
              const isGhost = i === ghostIndex;
              const colFull = getC4DropRow(parseC4Board(boardStr), col) === -1;
              const canClickCol = isMyTurn && !state?.roundFinished && !colFull;

              return (
                <button
                  key={i}
                  onClick={() => canClickCol && handleColumnClick(col)}
                  onMouseEnter={() => canClickCol && setHoveredCol(col)}
                  onMouseLeave={() => setHoveredCol(null)}
                  disabled={!canClickCol}
                  className="aspect-square flex items-center justify-center"
                >
                  <div className={`w-full h-full rounded-full transition-all duration-200 ${
                    isWinCell
                      ? 'ring-2 ring-emerald-400 scale-105'
                      : ''
                  }`}>
                    {cell === 'R' && (
                      <div className={`w-full h-full rounded-full ${
                        isWinCell ? 'bg-red-400 shadow-lg shadow-red-500/50' : 'bg-red-500'
                      } animate-in zoom-in duration-200`} />
                    )}
                    {cell === 'W' && (
                      <div className={`w-full h-full rounded-full ${
                        isWinCell ? 'bg-gray-100 shadow-lg shadow-white/50' : 'bg-white'
                      } animate-in zoom-in duration-200`} />
                    )}
                    {isEmpty && isGhost && (
                      <div className={`w-full h-full rounded-full ${
                        myColor === 'R' ? 'bg-red-500/25' : 'bg-white/20'
                      }`} />
                    )}
                    {isEmpty && !isGhost && (
                      <div className={`w-full h-full rounded-full ${
                        canClickCol && hoveredCol === col ? 'bg-white/8' : 'bg-white/5'
                      }`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
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

      {/* Color indicator */}
      <div className="text-center pb-4">
        <p className="text-white/20 text-[10px]">
          {myColor === 'R' ? '🔴' : '⚪'} {myNickname} · {myColor === 'R' ? '⚪' : '🔴'} {oppNickname}
        </p>
      </div>
    </div>
  );
}
