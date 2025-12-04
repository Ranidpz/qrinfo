'use client';

import { useState } from 'react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';

// Mock user - will be replaced with real auth
const mockUser = {
  displayName: 'משתמש לדוגמה',
  email: 'user@example.com',
  role: 'producer' as const,
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header
        onMenuClick={() => setSidebarOpen(true)}
        user={mockUser}
      />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userRole={mockUser.role}
      />

      {/* Main content */}
      <main className="md:mr-64 min-h-[calc(100vh-4rem)]">
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
