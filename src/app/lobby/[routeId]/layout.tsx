'use client';

import { AuthProvider } from '@/contexts/AuthContext';

export default function LobbyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
