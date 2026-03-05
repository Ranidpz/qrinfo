'use client';

import { useState, useEffect } from 'react';

const RPS_EMOJIS = ['👊', '🖐', '✌️'];

export default function RPSAnimatedEmoji({ className = '' }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'visible' | 'bounce-out' | 'bounce-in'>('visible');

  useEffect(() => {
    const interval = setInterval(() => {
      // Bounce out (scale up then disappear)
      setPhase('bounce-out');
      setTimeout(() => {
        setIndex(prev => (prev + 1) % RPS_EMOJIS.length);
        // Bounce in (start small, overshoot, settle)
        setPhase('bounce-in');
        setTimeout(() => {
          setPhase('visible');
        }, 300);
      }, 200);
    }, 1100);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`inline-block ${className}`}
      style={{
        transition: phase === 'bounce-out'
          ? 'transform 200ms ease-in, opacity 200ms ease-in'
          : phase === 'bounce-in'
            ? 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 150ms ease-out'
            : 'transform 200ms ease, opacity 200ms ease',
        transform: phase === 'bounce-out'
          ? 'scale(1.3) translateY(-4px)'
          : phase === 'bounce-in'
            ? 'scale(1) translateY(0px)'
            : 'scale(1) translateY(0px)',
        opacity: phase === 'bounce-out' ? 0 : 1,
      }}
    >
      {RPS_EMOJIS[index]}
    </span>
  );
}
