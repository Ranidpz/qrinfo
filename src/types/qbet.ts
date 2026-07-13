// Shared QBet ("הימור") types. The single source of truth (with runtime helpers
// and defaults) lives in `src/lib/qbet/types.ts`; this file re-exports the type
// shapes so they can be referenced from `src/types/index.ts` the same way the
// other experiences (raffle, qvote, qtag, …) reference their config types.
export type { QBetConfig, QBetTeam, QBetResult, QBetEntry } from '@/lib/qbet/types';
