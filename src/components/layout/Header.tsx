'use client';

import { Menu, QrCode } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { clsx } from 'clsx';

interface HeaderProps {
  onMenuClick?: () => void;
  direction?: 'rtl' | 'ltr';
}

export default function Header({ onMenuClick, direction = 'rtl' }: HeaderProps) {
  const isRTL = direction === 'rtl';

  return (
    <header className={clsx(
      "fixed top-0 left-0 right-0 z-50 h-16 bg-bg-secondary border-b border-border",
      // On desktop, add margin to account for sidebar
      isRTL ? "md:mr-64" : "md:ml-64"
    )}>
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        {/* Menu button for mobile - appears at start (right in RTL, left in LTR) */}
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-bg-hover transition-colors md:hidden"
          aria-label="תפריט"
        >
          <Menu className="w-5 h-5 text-text-primary" />
        </button>

        {/* Spacer for desktop */}
        <div className="hidden md:block" />

        {/* QR Icon - appears at end (left in RTL, right in LTR) */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <QrCode className="w-6 h-6 text-accent" />
          </div>
        </Link>
      </div>
    </header>
  );
}
