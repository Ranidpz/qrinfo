'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Search, Loader2, Shield, Crown, User as UserIcon, Check, X, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { formatPhoneForDisplay } from '@/lib/phone-utils';
import { isApprovedStatus } from '@/lib/auth/approval';
import { User, UserRole, STORAGE_LIMITS } from '@/types';
import { clsx } from 'clsx';

const ROLE_ICONS: Record<UserRole, React.ElementType> = {
  super_admin: Crown,
  producer: Shield,
  free: UserIcon,
};

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'text-yellow-500 bg-yellow-500/10',
  producer: 'text-accent bg-accent/10',
  free: 'text-text-secondary bg-bg-secondary',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const t = useTranslations('admin');
  const locale = useLocale();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Check if current user is super_admin
  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Load all users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData: User[] = [];

        usersSnapshot.forEach((doc) => {
          const data = doc.data();
          usersData.push({
            id: doc.id,
            email: data.email || '',
            displayName: data.displayName || '',
            role: data.role as UserRole,
            storageLimit: data.storageLimit,
            storageUsed: data.storageUsed,
            status: data.status,
            signupMethod: data.signupMethod,
            phone: data.phone,
            businessName: data.businessName,
            approvalRequestedAt: data.approvalRequestedAt?.toDate(),
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          });
        });

        setUsers(usersData);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'super_admin') {
      loadUsers();
    }
  }, [user]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdating(userId);

    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        storageLimit: STORAGE_LIMITS[newRole],
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, role: newRole, storageLimit: STORAGE_LIMITS[newRole] }
            : u
        )
      );
    } catch (error) {
      console.error('Error updating user role:', error);
      alert(t('roleUpdateError'));
    } finally {
      setUpdating(null);
    }
  };

  const handleApproval = async (userId: string, action: 'approve' | 'reject') => {
    setReviewing(userId);
    setNotice(null);
    try {
      const res = await fetchWithAuth('/api/admin/users/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId, action, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || String(res.status));
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: data.status } : u)));
      if (action === 'approve') setNotice(data.emailed ? t('approvedEmailed') : t('approvedNoEmail'));
    } catch (error) {
      console.error('Error reviewing user:', error);
      alert(t('approvalError'));
    } finally {
      setReviewing(null);
    }
  };

  const contactOf = (u: User) => u.email || (u.phone ? formatPhoneForDisplay(u.phone) : '');

  const METHOD_LABEL: Record<string, string> = {
    google: t('methodGoogle'),
    email: t('methodEmail'),
    phone: t('methodPhone'),
  };

  // Requests first (newest request on top), then those who never sent details.
  const awaiting = users
    .filter((u) => !isApprovedStatus(u.status))
    .sort((a, b) => (b.approvalRequestedAt?.getTime() ?? 0) - (a.approvalRequestedAt?.getTime() ?? 0));

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(query) ||
      u.displayName.toLowerCase().includes(query) ||
      (u.phone || '').includes(query.replace(/\D/g, '').replace(/^0/, '') || '~') ||
      (u.businessName || '').toLowerCase().includes(query)
    );
  });

  const formatStorage = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (user?.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary">{t('title')}</h1>
        <span className="text-sm text-text-secondary">
          {t('usersCount', { count: users.length })}
        </span>
      </div>

      {/* Join requests waiting for approval */}
      {awaiting.length > 0 && (
        <section className="card p-4 space-y-3 border-accent/30">
          <h2 className="flex items-center gap-2 font-semibold text-text-primary">
            <Clock className="w-4 h-4 text-accent" />
            {t('pendingTitle')}
            <span className="text-xs font-medium text-accent bg-accent/10 rounded-full px-2 py-0.5">{awaiting.filter((u) => u.status !== 'rejected').length}</span>
          </h2>
          <ul className="divide-y divide-border">
            {awaiting.map((u) => (
              <li key={u.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary truncate">
                    {u.displayName || contactOf(u)}
                    {u.businessName && <span className="text-text-secondary font-normal"> · {u.businessName}</span>}
                  </p>
                  <p className="text-sm text-text-secondary truncate" dir="ltr" style={{ textAlign: 'start' }}>{contactOf(u)}</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {u.signupMethod && <span>{METHOD_LABEL[u.signupMethod]} · </span>}
                    {u.status === 'rejected'
                      ? <span className="text-danger">{t('statusRejected')}</span>
                      : u.approvalRequestedAt
                        ? <span>{t('requestedAt')}: {u.approvalRequestedAt.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        : <span>{t('noRequestYet')}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {reviewing === u.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  ) : (
                    <>
                      <button type="button" onClick={() => handleApproval(u.id, 'approve')} className="btn btn-success px-4 py-2 text-sm">
                        <Check className="w-4 h-4" /> {t('approve')}
                      </button>
                      {u.status !== 'rejected' && (
                        <button type="button" onClick={() => handleApproval(u.id, 'reject')} className="btn btn-secondary px-4 py-2 text-sm">
                          <X className="w-4 h-4" /> {t('reject')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {notice && <p className="text-sm text-success" role="status">{notice}</p>}

      {/* Search */}
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
        <input
          type="text"
          placeholder={t('searchByNameOrEmail')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input ps-10 w-full"
          list="users-autocomplete"
        />
        <datalist id="users-autocomplete">
          {users.map((u) => (
            <option key={u.id} value={u.displayName} />
          ))}
          {users.filter((u) => u.email).map((u) => (
            <option key={`email-${u.id}`} value={u.email} />
          ))}
        </datalist>
      </div>

      {/* Users - Cards on mobile, Table on desktop */}
      {/* Mobile Cards View */}
      <div className="sm:hidden space-y-3">
        {filteredUsers.map((u) => {
          const isCurrentUser = u.id === user?.id;

          return (
            <div
              key={u.id}
              className="card p-4 space-y-3"
            >
              {/* User info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-5 h-5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary truncate">
                    {u.displayName}
                    {isCurrentUser && (
                      <span className="text-xs text-accent mr-2">{t('you')}</span>
                    )}
                  </p>
                  <p className="text-sm text-text-secondary truncate">{contactOf(u)}</p>
                </div>
              </div>

              {/* Role and Storage */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  {updating === u.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  ) : (
                    <select
                      value={u.role}
                      onChange={(e) =>
                        handleRoleChange(u.id, e.target.value as UserRole)
                      }
                      disabled={isCurrentUser}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-sm font-medium border-0 cursor-pointer',
                        ROLE_COLORS[u.role],
                        isCurrentUser && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <option value="free">{t('roleFree')}</option>
                      <option value="producer">{t('roleProducer')}</option>
                      <option value="super_admin">{t('roleSuperAdmin')}</option>
                    </select>
                  )}
                </div>
                <div className="text-left">
                  <div className="text-xs text-text-secondary">
                    {formatStorage(u.storageUsed)} / {formatStorage(u.storageLimit)}
                  </div>
                  <div className="w-20 h-1.5 bg-bg-secondary rounded-full mt-1">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{
                        width: `${Math.min(
                          (u.storageUsed / u.storageLimit) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Join date */}
              <div className="text-xs text-text-secondary pt-2 border-t border-border">
                {t('joined')}: {u.createdAt.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-right px-4 py-3 text-sm font-medium text-text-secondary">
                  {t('user')}
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-text-secondary">
                  {t('role')}
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-text-secondary">
                  {t('storageColumn')}
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-text-secondary">
                  {t('joined')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isCurrentUser = u.id === user?.id;

                return (
                  <tr
                    key={u.id}
                    className="border-b border-border last:border-0 hover:bg-bg-hover/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">
                            {u.displayName}
                            {isCurrentUser && (
                              <span className="text-xs text-accent mr-2">{t('you')}</span>
                            )}
                          </p>
                          <p className="text-sm text-text-secondary">{contactOf(u)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {updating === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(u.id, e.target.value as UserRole)
                          }
                          disabled={isCurrentUser}
                          className={clsx(
                            'px-3 py-1.5 rounded-lg text-sm font-medium border-0 cursor-pointer appearance-none',
                            ROLE_COLORS[u.role],
                            isCurrentUser && 'opacity-50 cursor-not-allowed'
                          )}
                          style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                        >
                          <option value="free">{t('roleFree')}</option>
                          <option value="producer">{t('roleProducer')}</option>
                          <option value="super_admin">{t('roleSuperAdmin')}</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <span className="text-text-primary">
                          {formatStorage(u.storageUsed)}
                        </span>
                        <span className="text-text-secondary">
                          {' '}
                          / {formatStorage(u.storageLimit)}
                        </span>
                      </div>
                      <div className="w-24 h-1.5 bg-bg-secondary rounded-full mt-1">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{
                            width: `${Math.min(
                              (u.storageUsed / u.storageLimit) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {u.createdAt.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12 text-text-secondary">
          {t('noUsersFound')}
        </div>
      )}
    </div>
  );
}
