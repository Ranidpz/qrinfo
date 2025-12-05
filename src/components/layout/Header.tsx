'use client';

import { Menu, QrCode } from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 h-16 bg-bg-secondary border-b border-border">
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

        {/* Left side - QR Icon */}
        <a href="/dashboard" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <QrCode className="w-6 h-6 text-accent" />
          </div>
        </a>
      </div>
    </header>
  );
}
