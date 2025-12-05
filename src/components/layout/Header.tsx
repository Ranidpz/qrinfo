'use client';

import { Menu } from 'lucide-react';
import Image from 'next/image';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 h-16 bg-[#0a1628] border-b border-border">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        {/* Right side - Hamburger Menu for mobile */}
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-bg-hover transition-colors md:hidden"
          aria-label="תפריט"
        >
          <Menu className="w-5 h-5 text-text-primary" />
        </button>

        {/* Spacer for desktop */}
        <div className="hidden md:block" />

        {/* Left side - Logo */}
        <a href="/dashboard" className="flex items-center">
          <Image
            src="/QLogo.jpg"
            alt="QR.info Logo"
            width={40}
            height={40}
            className="rounded-lg"
          />
        </a>
      </div>
    </header>
  );
}
