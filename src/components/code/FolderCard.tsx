'use client';

import { useState, useRef, useEffect } from 'react';
import { Folder as FolderIcon, Trash2, Edit2, Settings, Route } from 'lucide-react';
import { clsx } from 'clsx';
import { Folder, RouteConfig } from '@/types';
import RouteSettingsModal from '@/components/modals/RouteSettingsModal';

interface FolderCardProps {
  folder: Folder;
  codesCount: number;
  isOpen?: boolean;
  isDragOver?: boolean;
  ownerName?: string;
  locale?: 'he' | 'en';
  onOpen: () => void;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
  onRouteConfigUpdate?: (folderId: string, config: RouteConfig) => void;
  onDrop?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
}

export default function FolderCard({
  folder,
  codesCount,
  isOpen = false,
  isDragOver = false,
  ownerName,
  locale = 'he',
  onOpen,
  onDelete,
  onRename,
  onRouteConfigUpdate,
  onDrop,
  onDragOver,
  onDragLeave,
}: FolderCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [showRouteSettings, setShowRouteSettings] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== folder.name) {
      onRename?.(trimmedName);
    } else {
      setEditName(folder.name);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditName(folder.name);
      setIsEditing(false);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  return (
    <div
      className={clsx(
        'group relative bg-bg-card border rounded-xl p-4 transition-all cursor-pointer',
        isDragOver
          ? 'border-accent border-2 bg-accent/10 scale-105'
          : 'border-border hover:border-accent/50',
        isOpen && 'ring-2 ring-accent'
      )}
      onClick={() => !isEditing && onOpen()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDragLeave={onDragLeave}
    >
      {/* Folder icon and content */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="relative"
          style={{ color: folder.color || '#3b82f6' }}
        >
          <FolderIcon className="w-16 h-16" strokeWidth={1.5} fill="currentColor" fillOpacity={0.2} />
          {codesCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-white text-xs font-bold rounded-full flex items-center justify-center">
              {codesCount}
            </span>
          )}
        </div>

        {isEditing ? (
          <div className="flex items-center gap-1 w-full">
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-center text-sm font-medium bg-bg-secondary border border-accent rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent min-w-0"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span
              className="text-sm font-medium text-text-primary text-center truncate max-w-full px-1"
              onDoubleClick={handleDoubleClick}
              title={folder.name}
            >
              {folder.name}
            </span>
            {ownerName && (
              <span className="text-xs text-orange-500 font-medium truncate max-w-full">
                {ownerName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Route indicator */}
      {folder.routeConfig?.isRoute && (
        <div className="absolute top-2 right-2">
          <div className="p-1 rounded-full bg-green-500/20" title="מסלול XP פעיל">
            <Route className="w-3.5 h-3.5 text-green-400" />
          </div>
        </div>
      )}

      {/* Actions - show on hover */}
      <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowRouteSettings(true);
          }}
          className={clsx(
            "p-1.5 rounded-lg bg-bg-secondary transition-colors",
            folder.routeConfig?.isRoute
              ? "text-green-400 hover:text-green-300 hover:bg-green-500/10"
              : "text-text-secondary hover:text-accent hover:bg-accent/10"
          )}
          title="הגדרות מסלול"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="p-1.5 rounded-lg bg-bg-secondary text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
          title="שנה שם"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="p-1.5 rounded-lg bg-bg-secondary text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
          title="מחק ספריה"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Drag over indicator */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-accent/20 rounded-xl pointer-events-none">
          <span className="text-accent font-medium text-sm">שחרר כאן</span>
        </div>
      )}

      {/* Route Settings Modal */}
      <RouteSettingsModal
        folder={folder}
        isOpen={showRouteSettings}
        onClose={() => setShowRouteSettings(false)}
        onSave={(config) => onRouteConfigUpdate?.(folder.id, config)}
        locale={locale}
      />
    </div>
  );
}
