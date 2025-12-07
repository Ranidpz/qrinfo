'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
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

  // Update html element with lang and dir attributes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
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
        "pt-16 min-h-screen",
        isRTL ? "md:mr-64" : "md:ml-64"
      )}>
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
