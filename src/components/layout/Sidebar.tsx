'use client';

import { Home, Users, X, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { APP_VERSION } from '@/lib/version';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: 'super_admin' | 'producer' | 'free';
}

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  roles?: ('super_admin' | 'producer' | 'free')[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', icon: Home, label: 'ראשי' },
  { href: '/analytics', icon: BarChart3, label: 'אנליטיקס' },
  { href: '/admin/users', icon: Users, label: 'ניהול משתמשים', roles: ['super_admin'] },
];

export default function Sidebar({ isOpen, onClose, userRole = 'free' }: SidebarProps) {
  const pathname = usePathname();

  const filteredItems = navItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(userRole);
  });

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed right-0 top-16 h-[calc(100vh-4rem)] w-64 bg-bg-secondary border-l border-border z-50 transition-transform duration-300 md:translate-x-0',
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        )}
      >
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 rounded-lg hover:bg-bg-hover transition-colors md:hidden"
          aria-label="סגור תפריט"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>

        <nav className="p-4 pt-16 md:pt-4">
          <ul className="space-y-1">
            {filteredItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                      isActive
                        ? 'bg-accent text-white'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-4 right-4 left-4 text-center">
          <p className="text-xs text-text-secondary">
            By{' '}
            <a
              href="https://playzone.co.il"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Playzone
            </a>
          </p>
          <p className="text-[10px] text-text-secondary/60 mt-1">
            v{APP_VERSION}
          </p>
        </div>
      </aside>
    </>
  );
}
