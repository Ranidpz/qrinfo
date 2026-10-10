'use client';

import { usePathname } from 'next/navigation';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { isLandingPathname } from '@/lib/landing/site';
import { AuthProvider } from '@/contexts/AuthContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    // Landing pages must be in the server HTML for search engines; they read nothing from the
    // browser while rendering, so they're safe to render before mount
    <ThemeProvider renderBeforeMount={isLandingPathname(pathname)}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
