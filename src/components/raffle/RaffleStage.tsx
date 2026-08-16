'use client';

import RaffleDisplay from './RaffleDisplay';
import RaffleCodeReveal from './RaffleCodeReveal';
import type { RaffleConfig, RaffleParticipant, RaffleWinner } from '@/lib/raffle/types';

interface RaffleStageProps {
  participants: RaffleParticipant[];
  config: RaffleConfig;
  onRequestDraw: () => RaffleWinner | null | Promise<RaffleWinner | null>;
  canShowPhones?: boolean;
  loading?: boolean;
}

// Picks the on-screen animation. Both implementations take the same props and
// the same draw callback, so switching styles never touches the draw logic.
// An absent `animationStyle` means the classic wheel — every raffle created
// before this option existed keeps behaving exactly as it did.
export default function RaffleStage(props: RaffleStageProps) {
  if (props.config.animationStyle === 'codeReveal') return <RaffleCodeReveal {...props} />;
  return <RaffleDisplay {...props} />;
}
