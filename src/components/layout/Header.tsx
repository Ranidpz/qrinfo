'use client';

import { Menu } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { clsx } from 'clsx';
import Image from 'next/image';

interface HeaderProps {
  onMenuClick?: () => void;
  direction?: 'rtl' | 'ltr';
}

export default function Header({ onMenuClick, direction = 'rtl' }: HeaderProps) {
  const isRTL = direction === 'rtl';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-bg-secondary border-b border-border">
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

        {/* Logo - always visible, on opposite side of sidebar */}
        {/* RTL: logo on LEFT (opposite sidebar on right), LTR: logo on RIGHT (opposite sidebar on left) */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 md:ms-auto"
        >
          <Image
            src="/theQ.png"
            alt="The Q"
            width={48}
            height={48}
            className="rounded-lg transition-transform duration-200 hover:scale-110"
          />
        </Link>
      </div>
    </header>
  );
}
