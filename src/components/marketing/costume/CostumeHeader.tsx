'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function CostumeHeader() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[var(--bg-primary)]/90 backdrop-blur-lg border-b border-[var(--border)] shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-center h-16">
          <a href="https://qr.playzones.app" className="flex items-center gap-3 group">
            <Image
              src="/theQ.png"
              alt="The Q"
              width={40}
              height={40}
              className="rounded-lg transition-transform duration-200 group-hover:scale-110"
            />
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              The Q
            </span>
          </a>
        </div>
      </div>
    </header>
  );
}
