'use client';

import { useState, useEffect } from 'react';
import { Home, Users, X, BarChart3, Moon, Sun, LogOut, User, LogIn, Bell, Plus, Trash2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { clsx } from 'clsx';
import { APP_VERSION, getLatestUpdate } from '@/lib/version';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { getNotifications, createNotification, deleteNotification, updateNotification, createVersionNotification } from '@/lib/db';
import { Notification } from '@/types';
import { intlLocales, type Locale } from '@/i18n/config';
import LanguageSwitcher from './LanguageSwitcher';

// WhatsApp icon component
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// Tooltip component
function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div className="relative inline-flex group/tooltip">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900 dark:border-t-gray-700" />
      </div>
    </div>
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
  direction?: 'rtl' | 'ltr';
}

interface NavItem {
  href: string;
  icon: React.ElementType;
  labelKey: string;
  roles?: ('super_admin' | 'producer' | 'free')[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', icon: Home, labelKey: 'dashboard' },
  { href: '/analytics', icon: BarChart3, labelKey: 'analytics' },
  { href: '/admin/users', icon: Users, labelKey: 'userManagement', roles: ['super_admin'] },
];

export default function Sidebar({ isOpen, onClose, userRole = 'free', userId, user, onSignOut, direction = 'rtl' }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const { theme, toggleTheme } = useTheme();
  const { signInWithGoogle } = useAuth();
  const isRTL = direction === 'rtl';

  // Translations
  const t = useTranslations('navigation');
  const tSidebar = useTranslations('sidebar');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tNotifications = useTranslations('notifications');

  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showNewNotificationForm, setShowNewNotificationForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'title' | 'message' | null>(null);
  const [editValue, setEditValue] = useState('');

  // Load notifications on mount and create version notification if needed
  useEffect(() => {
    async function loadNotifications() {
      try {
        // First, try to create version notification if it doesn't exist
        const latestUpdate = getLatestUpdate();
        await createVersionNotification(latestUpdate.version, latestUpdate.highlights);

        // Then load all notifications for current locale
        const notifs = await getNotifications(locale);
        setNotifications(notifs);
      } catch (error) {
        // Silently fail - notifications are optional and may have permission issues
      }
    }
    loadNotifications();
  }, [locale]);

  // Handle create notification - creates for current locale
  const handleCreateNotification = async () => {
    if (!newTitle.trim() || !newMessage.trim() || !userId) return;

    setIsSaving(true);
    try {
      // Create notification for the current locale
      const notification = await createNotification(newTitle, newMessage, userId, locale);
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

  // Start inline editing
  const startEditing = (notification: Notification, field: 'title' | 'message') => {
    setEditingId(notification.id);
    setEditingField(field);
    setEditValue(field === 'title' ? notification.title : notification.message);
  };

  // Save inline edit
  const saveEdit = async () => {
    if (!editingId || !editingField) return;

    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      cancelEdit();
      return;
    }

    try {
      await updateNotification(editingId, { [editingField]: trimmedValue });
      setNotifications(notifications.map(n =>
        n.id === editingId
          ? { ...n, [editingField]: trimmedValue }
          : n
      ));
    } catch (error) {
      console.error('Error updating notification:', error);
    } finally {
      cancelEdit();
    }
  };

  // Cancel inline edit
  const cancelEdit = () => {
    setEditingId(null);
    setEditingField(null);
    setEditValue('');
  };

  // Handle key press for inline editing
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && editingField === 'title') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // Handle key press for textarea (message)
  const handleMessageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // Format date for display based on locale
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(intlLocales[locale], {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Calculate total notification count
  const totalNotificationCount = notifications.length;

  const filteredItems = navItems.filter(item => {
    if (!item.roles) return true;
    // If user is not logged in, only show items without role requirements
    if (!user) return !item.roles;
    return item.roles.includes(userRole);
  });

  // Check if path matches (accounting for locale prefix)
  const isPathActive = (href: string) => {
    // Remove locale prefix from pathname for comparison
    const pathWithoutLocale = pathname.replace(/^\/(he|en)/, '');
    return pathWithoutLocale === href || pathWithoutLocale.startsWith(href + '/');
  };

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
          'fixed top-16 h-[calc(100vh-4rem)] w-64 bg-bg-secondary border-border z-40 transition-transform duration-300 flex flex-col',
          // Position: right for RTL, left for LTR
          isRTL ? 'right-0 border-l' : 'left-0 border-r',
          // Mobile: slide in/out
          isOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full'),
          // Desktop: always visible
          'md:translate-x-0'
        )}
      >
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className={clsx(
            "absolute top-4 p-2 rounded-lg hover:bg-bg-hover transition-colors md:hidden",
            isRTL ? "right-4" : "left-4"
          )}
          aria-label={t('closeMenu')}
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>

        {/* Scrollable content wrapper */}
        <div className="flex-1 overflow-y-auto">
          <nav className="p-4 pt-16 md:pt-4">
            <ul className="space-y-1">
              {filteredItems.map((item) => {
                const isActive = isPathActive(item.href);
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
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User section & Footer */}
          <div className="p-4 border-t border-border pb-8">
          {/* Action Buttons Row - Theme, Notifications, WhatsApp */}
          <div className="flex items-center justify-center gap-3 mb-4">
            {/* Theme Toggle Button */}
            <Tooltip text={theme === 'dark' ? tSidebar('themeLight') : tSidebar('themeDark')}>
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-purple-500" />
                ) : (
                  <Moon className="w-5 h-5 text-purple-500" />
                )}
              </button>
            </Tooltip>

            {/* Notifications Button */}
            <Tooltip text={tSidebar('notifications')}>
              <button
                onClick={() => setShowNotificationsModal(true)}
                className="relative p-2.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
              >
                <Bell className="w-5 h-5 text-blue-500" />
                {totalNotificationCount > 0 && (
                  <span className="absolute -top-1 -end-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {totalNotificationCount > 9 ? '9+' : totalNotificationCount}
                  </span>
                )}
              </button>
            </Tooltip>

            {/* WhatsApp Support Button */}
            <Tooltip text={tSidebar('whatsappSupport')}>
              <a
                href="https://wa.me/972773006306"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-2.5 rounded-full bg-green-500/10 hover:bg-green-500/20 transition-colors"
              >
                <WhatsAppIcon className="w-5 h-5 text-green-500" />
              </a>
            </Tooltip>
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
                <span>{tAuth('signOut')}</span>
              </button>
              {/* Language Switcher */}
              <div className="mt-2">
                <LanguageSwitcher />
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <button
                onClick={() => {
                  // Check if terms already accepted
                  const termsAccepted = localStorage.getItem('terms_accepted') === 'true';
                  if (termsAccepted) {
                    // Sign in directly
                    signInWithGoogle()
                      .then(() => onClose())
                      .catch((error) => console.error('Login error:', error));
                  } else {
                    // Redirect to login page for terms acceptance
                    router.push('/login');
                    onClose();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>{tAuth('signIn')}</span>
              </button>
              {/* Language Switcher */}
              <div className="mt-2">
                <LanguageSwitcher />
              </div>
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
        </div>
      </aside>

      {/* Notifications Modal */}
      {showNotificationsModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-bg-secondary rounded-xl max-w-md w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">{tNotifications('title')}</h2>
              <div className="flex items-center gap-2">
                {userRole === 'super_admin' && (
                  <button
                    onClick={() => setShowNewNotificationForm(true)}
                    className="p-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
                    title={tNotifications('addNotification')}
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
                  placeholder={tNotifications('notificationTitle')}
                  className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-secondary mb-2"
                />
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={tNotifications('notificationContent')}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-secondary resize-none mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateNotification}
                    disabled={isSaving || !newTitle.trim() || !newMessage.trim()}
                    className="flex-1 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? tCommon('saving') : tCommon('publish')}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewNotificationForm(false);
                      setNewTitle('');
                      setNewMessage('');
                    }}
                    className="px-4 py-2 rounded-lg bg-bg-hover text-text-secondary hover:bg-bg-primary transition-colors"
                  >
                    {tCommon('cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* All notifications (including version updates) */}
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 rounded-lg bg-bg-card border border-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Editable Title */}
                      {editingId === notification.id && editingField === 'title' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          onBlur={saveEdit}
                          autoFocus
                          className="w-full font-medium text-text-primary bg-bg-primary border border-accent rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      ) : (
                        <h3
                          className={clsx(
                            "font-medium text-text-primary",
                            userRole === 'super_admin' && "cursor-pointer hover:bg-bg-hover rounded px-1 -mx-1 transition-colors"
                          )}
                          onClick={() => userRole === 'super_admin' && startEditing(notification, 'title')}
                        >
                          {notification.title}
                        </h3>
                      )}

                      {/* Editable Message */}
                      {editingId === notification.id && editingField === 'message' ? (
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleMessageKeyDown}
                          onBlur={saveEdit}
                          autoFocus
                          rows={3}
                          className="w-full text-sm text-text-secondary bg-bg-primary border border-accent rounded px-2 py-1 mt-1 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                        />
                      ) : (
                        <p
                          className={clsx(
                            "text-sm text-text-secondary mt-1 whitespace-pre-wrap",
                            userRole === 'super_admin' && "cursor-pointer hover:bg-bg-hover rounded px-1 -mx-1 transition-colors"
                          )}
                          onClick={() => userRole === 'super_admin' && startEditing(notification, 'message')}
                        >
                          {notification.message}
                        </p>
                      )}

                      <p className="text-xs text-text-secondary/60 mt-2">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                    {userRole === 'super_admin' && (
                      <button
                        onClick={() => handleDeleteNotification(notification.id)}
                        className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors shrink-0"
                        title={tNotifications('deleteNotification')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Empty state */}
              {totalNotificationCount === 0 && (
                <p className="text-center text-text-secondary py-8">{tNotifications('noNotifications')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
