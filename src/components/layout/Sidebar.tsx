'use client';

import { useState, useEffect } from 'react';
import { Home, Users, X, BarChart3, Moon, Sun, LogOut, User, LogIn, Bell, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { APP_VERSION } from '@/lib/version';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { getNotifications, createNotification, deleteNotification } from '@/lib/db';
import { Notification } from '@/types';

// WhatsApp icon component
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: 'super_admin' | 'producer' | 'free';
  userId?: string;
  user?: {
    displayName: string;
    email: string;
  } | null;
  onSignOut?: () => void;
}

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  roles?: ('super_admin' | 'producer' | 'free')[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', icon: Home, label: 'דשבורד' },
  { href: '/analytics', icon: BarChart3, label: 'אנליטיקס' },
  { href: '/admin/users', icon: Users, label: 'ניהול משתמשים', roles: ['super_admin'] },
];

export default function Sidebar({ isOpen, onClose, userRole = 'free', userId, user, onSignOut }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { signInWithGoogle } = useAuth();

  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showNewNotificationForm, setShowNewNotificationForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load notifications on mount
  useEffect(() => {
    async function loadNotifications() {
      try {
        const notifs = await getNotifications();
        setNotifications(notifs);
      } catch (error) {
        // Silently fail - notifications are optional and may have permission issues
        // console.error('Error loading notifications:', error);
      }
    }
    loadNotifications();
  }, []);

  // Handle create notification
  const handleCreateNotification = async () => {
    if (!newTitle.trim() || !newMessage.trim() || !userId) return;

    setIsSaving(true);
    try {
      const notification = await createNotification(newTitle, newMessage, userId);
      setNotifications([notification, ...notifications]);
      setNewTitle('');
      setNewMessage('');
      setShowNewNotificationForm(false);
    } catch (error) {
      console.error('Error creating notification:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete notification
  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const filteredItems = navItems.filter(item => {
    if (!item.roles) return true;
    // If user is not logged in, only show items without role requirements
    if (!user) return !item.roles;
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
          'fixed right-0 top-16 h-[calc(100vh-4rem)] w-64 bg-bg-secondary border-l border-border z-50 transition-transform duration-300 md:translate-x-0 flex flex-col overflow-y-auto pb-safe',
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 rounded-lg hover:bg-bg-hover transition-colors md:hidden"
          aria-label="סגור תפריט"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>

        <nav className="p-4 pt-16 md:pt-4 flex-1">
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

          {/* Theme Toggle */}
          <div className="mt-6 pt-4 border-t border-border">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
              <span>{theme === 'dark' ? 'מצב יום' : 'מצב לילה'}</span>
            </button>
          </div>
        </nav>

        {/* User section & Footer */}
        <div className="p-4 border-t border-border">
          {/* Action Buttons Row - WhatsApp & Notifications */}
          <div className="flex items-center justify-center gap-3 mb-4">
            {/* Notifications Button */}
            <button
              onClick={() => setShowNotificationsModal(true)}
              className="relative p-2.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
              title="התראות"
            >
              <Bell className="w-5 h-5 text-blue-500" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            {/* WhatsApp Support Button */}
            <a
              href="https://wa.me/972773006306"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-full bg-green-500/10 hover:bg-green-500/20 transition-colors"
              title="תמיכה בווטסאפ"
            >
              <WhatsAppIcon className="w-5 h-5 text-green-500" />
            </a>
          </div>

          {/* User Info or Login Button */}
          {user ? (
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{user.displayName}</p>
                  <p className="text-xs text-text-secondary truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-danger bg-danger/10 hover:bg-danger/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>התנתק</span>
              </button>
            </div>
          ) : (
            <div className="mb-4">
              <button
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                    onClose();
                  } catch (error) {
                    console.error('Login error:', error);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>התחבר</span>
              </button>
            </div>
          )}

          {/* Credits */}
          <div className="text-center">
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
        </div>
      </aside>

      {/* Notifications Modal */}
      {showNotificationsModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-bg-secondary rounded-xl max-w-md w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">התראות</h2>
              <div className="flex items-center gap-2">
                {userRole === 'super_admin' && (
                  <button
                    onClick={() => setShowNewNotificationForm(true)}
                    className="p-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
                    title="הוסף התראה"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowNotificationsModal(false);
                    setShowNewNotificationForm(false);
                  }}
                  className="p-2 rounded-lg hover:bg-bg-hover transition-colors"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>
            </div>

            {/* New Notification Form (Admin Only) */}
            {showNewNotificationForm && userRole === 'super_admin' && (
              <div className="p-4 border-b border-border bg-bg-card">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="כותרת ההתראה"
                  className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-secondary mb-2"
                />
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="תוכן ההתראה"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-secondary resize-none mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateNotification}
                    disabled={isSaving || !newTitle.trim() || !newMessage.trim()}
                    className="flex-1 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? 'שומר...' : 'פרסם'}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewNotificationForm(false);
                      setNewTitle('');
                      setNewMessage('');
                    }}
                    className="px-4 py-2 rounded-lg bg-bg-hover text-text-secondary hover:bg-bg-primary transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <p className="text-center text-text-secondary py-8">אין התראות</p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-3 rounded-lg bg-bg-card border border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-text-primary">{notification.title}</h3>
                        <p className="text-sm text-text-secondary mt-1 whitespace-pre-wrap">{notification.message}</p>
                        <p className="text-xs text-text-secondary/60 mt-2">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>
                      {userRole === 'super_admin' && (
                        <button
                          onClick={() => handleDeleteNotification(notification.id)}
                          className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors shrink-0"
                          title="מחק התראה"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
