'use client';

import { useState, useEffect } from 'react';

export default function FroggerAnimatedEmoji() {
  const [jumping, setJumping] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setJumping(true);
      setTimeout(() => setJumping(false), 300);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`inline-block transition-transform duration-300 ${jumping ? '-translate-y-2' : ''}`}
    >
      🐸
    </span>
  );
}
