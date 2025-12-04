'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { QRCode, User } from '@/types';

interface CodeSelectorProps {
  codes: QRCode[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  isSuperAdmin: boolean;
  allUsers?: User[];
}

export default function CodeSelector({
  codes,
  selectedIds,
  onChange,
  isSuperAdmin,
  allUsers = [],
}: CodeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter codes by search
  const filteredCodes = codes.filter((code) =>
    code.title.toLowerCase().includes(search.toLowerCase()) ||
    code.shortId.toLowerCase().includes(search.toLowerCase())
  );

  // Group codes by owner (for super admin)
  const groupedCodes = isSuperAdmin
    ? filteredCodes.reduce((acc, code) => {
        const owner = allUsers.find((u) => u.id === code.ownerId);
        const ownerName = owner?.displayName || owner?.email || 'לא ידוע';
        if (!acc[ownerName]) {
          acc[ownerName] = [];
        }
        acc[ownerName].push(code);
        return acc;
      }, {} as Record<string, QRCode[]>)
    : { 'הקודים שלי': filteredCodes };

  const toggleCode = (codeId: string) => {
    if (selectedIds.includes(codeId)) {
      onChange(selectedIds.filter((id) => id !== codeId));
    } else {
      onChange([...selectedIds, codeId]);
    }
  };

  const selectAll = () => {
    onChange(filteredCodes.map((c) => c.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectedCount = selectedIds.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg border transition-colors',
          'bg-bg-secondary border-border hover:border-accent/50',
          isOpen && 'border-accent'
        )}
      >
        <span className="text-text-primary">
          {selectedCount === 0
            ? 'בחר קודים לניתוח'
            : selectedCount === 1
            ? codes.find((c) => c.id === selectedIds[0])?.title || 'קוד נבחר'
            : `${selectedCount} קודים נבחרו`}
        </span>
        <ChevronDown
          className={clsx(
            'w-5 h-5 text-text-secondary transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-bg-secondary border border-border rounded-lg shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חפש קוד..."
                className="w-full pr-10 pl-4 py-2 rounded-lg bg-bg-primary border border-border text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 p-3 border-b border-border">
            <button
              onClick={selectAll}
              className="text-xs text-accent hover:underline"
            >
              בחר הכל
            </button>
            <span className="text-text-secondary">|</span>
            <button
              onClick={clearAll}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              נקה בחירה
            </button>
          </div>

          {/* Code List */}
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(groupedCodes).map(([ownerName, ownerCodes]) => (
              <div key={ownerName}>
                {isSuperAdmin && (
                  <div className="px-4 py-2 text-xs font-medium text-text-secondary bg-bg-hover sticky top-0">
                    {ownerName}
                  </div>
                )}
                {ownerCodes.map((code) => (
                  <button
                    key={code.id}
                    onClick={() => toggleCode(code.id)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-bg-hover transition-colors',
                      selectedIds.includes(code.id) && 'bg-accent/10'
                    )}
                  >
                    <div
                      className={clsx(
                        'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0',
                        selectedIds.includes(code.id)
                          ? 'bg-accent border-accent'
                          : 'border-border'
                      )}
                    >
                      {selectedIds.includes(code.id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{code.title}</p>
                      <p className="text-xs text-text-secondary">
                        {code.shortId} · {code.views} צפיות
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ))}

            {filteredCodes.length === 0 && (
              <div className="p-4 text-center text-text-secondary text-sm">
                לא נמצאו קודים
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Tags */}
      {selectedCount > 0 && selectedCount <= 5 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedIds.map((id) => {
            const code = codes.find((c) => c.id === id);
            if (!code) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-sm"
              >
                {code.title}
                <button
                  onClick={() => toggleCode(id)}
                  className="hover:bg-accent/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
