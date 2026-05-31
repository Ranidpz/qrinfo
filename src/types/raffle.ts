// Shared raffle types. The single source of truth (with runtime helpers and
// defaults) lives in `src/lib/raffle/types.ts`; this file re-exports the type
// shapes so they can be referenced from `src/types/index.ts` the same way the
// other experiences (qvote, qtag, …) reference their config types.
export type {
  RaffleConfig,
  RaffleParticipant,
  RaffleWinner,
  RaffleDisplayMode,
  RaffleBackgroundType,
  RaffleWinSound,
} from '@/lib/raffle/types';
