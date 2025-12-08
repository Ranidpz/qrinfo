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
    <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-bg-secondary border-b border-border">
      <div className={clsx(
        "flex items-center justify-between h-full px-4 md:px-6",
        !isRTL && "flex-row-reverse"
      )}>
        {/* Menu button - only on mobile */}
        {/* LTR: hamburger on LEFT (near sidebar), RTL: hamburger on RIGHT (near sidebar) */}
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-bg-hover transition-colors md:hidden"
          aria-label="תפריט"
        >
          <Menu className="w-5 h-5 text-text-primary" />
        </button>

        {/* QR Icon - always visible, on opposite side of sidebar */}
        {/* RTL: logo on LEFT (opposite sidebar on right), LTR: logo on RIGHT (opposite sidebar on left) */}
        <Link
          href="/dashboard"
          className={clsx(
            "flex items-center gap-2",
            // On desktop, push logo to opposite side of sidebar
            isRTL ? "md:mr-auto" : "md:ml-auto"
          )}
        >
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <QrCode className="w-6 h-6 text-accent" />
          </div>
        </Link>
      </div>
    </header>
  );
}
