'use client';

import { useState } from 'react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import UpdateNotification from '@/components/notifications/UpdateNotification';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary overflow-x-hidden pt-16">
      <Header
        onMenuClick={() => setSidebarOpen(true)}
      />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userRole={user?.role}
        userId={user?.id}
        user={user ? {
          displayName: user.displayName,
          email: user.email,
        } : null}
        onSignOut={signOut}
      />

      {/* Main content */}
      <main className="md:mr-64 min-h-[calc(100vh-4rem)] relative z-0">
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* Update notification popup */}
      <UpdateNotification />
    </div>
  );
}
