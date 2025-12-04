'use client';

import { Menu, Moon, Sun, User, LogOut, Settings } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useState } from 'react';

interface HeaderProps {
  onMenuClick?: () => void;
  user?: {
    displayName: string;
    email: string;
  } | null;
  onSignOut?: () => void;
}

export default function Header({ onMenuClick, user, onSignOut }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-50 h-16 bg-bg-secondary border-b border-border">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        {/* Right side - Logo & Menu */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-bg-hover transition-colors md:hidden"
            aria-label="תפריט"
          >
            <Menu className="w-5 h-5 text-text-primary" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">QR</span>
            </div>
            <span className="font-bold text-xl text-text-primary hidden sm:block">
              QR.info
            </span>
          </div>
        </div>

        {/* Left side - Theme toggle & User */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-bg-hover transition-colors"
            aria-label={theme === 'dark' ? 'מצב יום' : 'מצב לילה'}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-text-secondary" />
            ) : (
              <Moon className="w-5 h-5 text-text-secondary" />
            )}
          </button>

          {/* User Menu */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-bg-hover transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-accent" />
                </div>
                <span className="hidden md:block text-sm text-text-primary">
                  {user.displayName}
                </span>
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute left-0 top-full mt-2 w-48 bg-bg-card border border-border rounded-lg shadow-lg z-20">
                    <div className="p-3 border-b border-border">
                      <p className="text-sm font-medium text-text-primary">{user.displayName}</p>
                      <p className="text-xs text-text-secondary truncate">{user.email}</p>
                    </div>
                    <div className="p-1">
                      <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover rounded-md transition-colors">
                        <Settings className="w-4 h-4" />
                        הגדרות
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onSignOut?.();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-bg-hover rounded-md transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        התנתק
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <a
              href="/login"
              className="btn btn-primary text-sm"
            >
              התחברות
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
