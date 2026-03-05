'use client';

import { useState, useEffect } from 'react';

const OOO_EMOJIS = ['✊', '🖐', '✊', '🖐', '🖐', '✊'];

export default function OOOAnimatedEmoji({ className = '' }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'visible' | 'exit' | 'enter'>('visible');

  useEffect(() => {
    const interval = setInterval(() => {
      // Slide out to the left
      setPhase('exit');
      setTimeout(() => {
        setIndex(prev => (prev + 1) % OOO_EMOJIS.length);
        // Enter from the right
        setPhase('enter');
        setTimeout(() => {
          setPhase('visible');
        }, 30);
      }, 180);
    }, 900);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`inline-block transition-all ease-in-out ${
        phase === 'exit'
          ? '-translate-x-4 opacity-0 scale-90 duration-180'
          : phase === 'enter'
            ? 'translate-x-4 opacity-0 scale-90 duration-0'
            : 'translate-x-0 opacity-100 scale-100 duration-200'
      } ${className}`}
    >
      {OOO_EMOJIS[index]}
    </span>
  );
}
