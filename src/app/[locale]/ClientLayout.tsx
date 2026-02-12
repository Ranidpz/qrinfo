'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import CookieConsent from '@/components/legal/CookieConsent';
import AccessibilityButton from '@/components/legal/AccessibilityButton';
import { useAuth } from '@/contexts/AuthContext';
import { clsx } from 'clsx';

interface ClientLayoutProps {
  children: React.ReactNode;
  locale: string;
  direction: 'rtl' | 'ltr';
}

export default function ClientLayout({ children, locale, direction }: ClientLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();
  const isRTL = direction === 'rtl';
  const pathname = usePathname();

  // Check if we're on a full-screen page (no app shell needed)
  const isFullScreenPage = pathname?.includes('/marketing') ||
    pathname?.includes('/costume-competition') ||
    pathname?.includes('/checkin') ||
    pathname?.includes('/scanner');

  // Update html element with lang and dir attributes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  // Full-screen pages get their own layout without sidebar/header
  if (isFullScreenPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-bg-primary overflow-x-hidden">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} direction={direction} />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userRole={user?.role}
        userId={user?.id}
        user={user ? { displayName: user.displayName, email: user.email } : null}
        onSignOut={signOut}
        direction={direction}
      />
      <main className={clsx(
        "min-h-screen pt-16",
        // Desktop: margin for sidebar
        isRTL ? "md:mr-64" : "md:ml-64"
      )}>
        <div className="p-4 sm:p-6">{children}</div>
      </main>

      {/* Legal components - only show for logged in users (dashboard area) */}
      {user && (
        <>
          <CookieConsent />
          <AccessibilityButton />
        </>
      )}
    </div>
  );
}
