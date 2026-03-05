'use client';

import { useState, useEffect, useRef } from 'react';

const EMOJI_PAIRS = [
  ['🧠', '🃏'],
  ['🃏', '❓'],
  ['❓', '🧠'],
];

export default function MemoryAnimatedEmoji() {
  const [showBack, setShowBack] = useState(false);
  const [frontEmoji, setFrontEmoji] = useState(EMOJI_PAIRS[0][0]);
  const [backEmoji, setBackEmoji] = useState(EMOJI_PAIRS[0][1]);
  const [isFlipping, setIsFlipping] = useState(false);
  const pairRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFlipping(true);
      setTimeout(() => {
        setShowBack(prev => !prev);
      }, 200);
      setTimeout(() => {
        setIsFlipping(false);
      }, 400);
      // After flip settles, load next pair
      setTimeout(() => {
        const next = (pairRef.current + 1) % EMOJI_PAIRS.length;
        pairRef.current = next;
        setFrontEmoji(EMOJI_PAIRS[next][0]);
        setBackEmoji(EMOJI_PAIRS[next][1]);
      }, 1200);
    }, 1400);

    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className="inline-block"
      style={{ perspective: '200px' }}
    >
      <span
        className="inline-block transition-transform duration-[400ms] ease-in-out"
        style={{
          transform: isFlipping ? 'rotateY(90deg)' : 'rotateY(0deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {showBack ? backEmoji : frontEmoji}
      </span>
    </span>
  );
}
