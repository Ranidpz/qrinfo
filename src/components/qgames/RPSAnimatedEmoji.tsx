'use client';

import { useState, useEffect } from 'react';

const RPS_EMOJIS = ['👊', '🖐', '✌️'];

export default function RPSAnimatedEmoji({ className = '' }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsSwapping(true);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % RPS_EMOJIS.length);
        setIsSwapping(false);
      }, 200);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`inline-block transition-all duration-200 ${
        isSwapping
          ? '-translate-y-2 opacity-0 scale-75'
          : 'translate-y-0 opacity-100 scale-100'
      } ${className}`}
    >
      {RPS_EMOJIS[index]}
    </span>
  );
}
