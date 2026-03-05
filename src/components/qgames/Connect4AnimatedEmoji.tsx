'use client';

import { useState, useEffect } from 'react';

const C4_EMOJIS = ['🔴', '⚪'];

export default function Connect4AnimatedEmoji({ className = '' }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'visible' | 'exit' | 'enter'>('visible');

  useEffect(() => {
    const interval = setInterval(() => {
      // Slide out downward
      setPhase('exit');
      setTimeout(() => {
        setIndex(prev => (prev + 1) % C4_EMOJIS.length);
        // Enter from top
        setPhase('enter');
        setTimeout(() => {
          setPhase('visible');
        }, 30);
      }, 180);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`inline-block transition-all ease-in-out ${
        phase === 'exit'
          ? 'translate-y-4 opacity-0 scale-90 duration-180'
          : phase === 'enter'
            ? '-translate-y-4 opacity-0 scale-90 duration-0'
            : 'translate-y-0 opacity-100 scale-100 duration-200'
      } ${className}`}
    >
      {C4_EMOJIS[index]}
    </span>
  );
}
