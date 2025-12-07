'use client';

import { useState, useEffect } from 'react';
import { X, Search, User, Loader2, UserCog } from 'lucide-react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';

interface UserOption {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

interface TransferOwnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransfer: (newOwnerId: string, newOwnerName: string) => void;
  codeTitle: string;
  currentOwnerId: string;
}

export default function TransferOwnershipModal({
  isOpen,
  onClose,
  onTransfer,
  codeTitle,
  currentOwnerId,
}: TransferOwnershipModalProps) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);

  const t = useTranslations('modals');
  const tCommon = useTranslations('common');

  // Load all users on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadUsers = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('displayName'));
        const snapshot = await getDocs(q);

        const usersList: UserOption[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Exclude current owner
          if (doc.id !== currentOwnerId) {
            usersList.push({
              id: doc.id,
              displayName: data.displayName || t('noName'),
              email: data.email || '',
              role: data.role || 'free',
            });
          }
        });

        setUsers(usersList);
        setFilteredUsers(usersList);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [isOpen, currentOwnerId, t]);

  // Filter users based on search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = users.filter(
      (user) =>
        user.displayName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleTransfer = async () => {
    if (!selectedUser) return;

    setTransferring(true);
    try {
      await onTransfer(selectedUser.id, selectedUser.displayName);
      onClose();
    } catch (error) {
      console.error('Error transferring ownership:', error);
    } finally {
      setTransferring(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">{t('roleSuperAdmin')}</span>;
      case 'producer':
        return <span className="px-1.5 py-0.5 text-[10px] bg-accent/20 text-accent rounded">{t('roleProducer')}</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] bg-gray-500/20 text-gray-400 rounded">{t('roleFree')}</span>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-text-primary">{t('transferOwnership')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <p className="text-sm text-text-secondary mb-4">
            {t('transferCodeTo', { title: codeTitle })}
          </p>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder={t('searchUser')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pe-10 ps-4 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Users list */}
          <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[300px] border border-border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-secondary">
                <User className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">{t('noUsersFound')}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full p-3 text-start hover:bg-bg-hover transition-colors ${
                      selectedUser?.id === user.id ? 'bg-accent/10 border-s-2 border-accent' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary truncate">
                            {user.displayName}
                          </span>
                          {getRoleBadge(user.role)}
                        </div>
                        <p className="text-xs text-text-secondary truncate" dir="ltr">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected user preview */}
          {selectedUser && (
            <div className="mt-4 p-3 bg-accent/10 border border-accent/30 rounded-lg">
              <p className="text-sm text-text-secondary mb-1">{t('ownershipWillTransferTo')}</p>
              <p className="text-text-primary font-medium">{selectedUser.displayName}</p>
              <p className="text-xs text-text-secondary" dir="ltr">{selectedUser.email}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 btn bg-bg-secondary text-text-primary hover:bg-bg-hover"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleTransfer}
            disabled={!selectedUser || transferring}
            className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {transferring ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('transferring')}
              </>
            ) : (
              t('transfer')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
