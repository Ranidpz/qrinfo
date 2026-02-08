'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash2, RefreshCw, Globe, Copy, Image, Video, FileText, Eye, UserCog, User, Clock, Check, Files, Upload, Route, CheckCircle, XCircle, Pencil } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { clsx } from 'clsx';
import { useTranslations, useLocale } from 'next-intl';
import { MediaType, CodeWidgets, ViewMode, PendingReplacement } from '@/types';
import ReplaceMediaConfirm from '@/components/modals/ReplaceMediaConfirm';
import ReplaceMediaOptionsModal from '@/components/modals/ReplaceMediaOptionsModal';
import ScheduleReplacementModal from '@/components/modals/ScheduleReplacementModal';
import PendingReplacementBadge from '@/components/code/PendingReplacementBadge';

// Custom Tooltip component for instant display
function Tooltip({ children, text, position = 'top' }: { children: React.ReactNode; text: string; position?: 'top' | 'bottom' }) {
  const isTop = position === 'top';
  return (
    <div className="relative group/tooltip">
      {children}
      <div className={clsx(
        "absolute left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-75 z-[100] pointer-events-none shadow-lg",
        isTop ? "bottom-full mb-2" : "top-full mt-2"
      )}>
        {text}
        <div className={clsx(
          "absolute left-1/2 -translate-x-1/2 border-4 border-transparent",
          isTop ? "top-full border-t-gray-900" : "bottom-full border-b-gray-900"
        )} />
      </div>
    </div>
  );
}

interface CodeCardProps {
  id: string;
  shortId: string;
  title: string;
  thumbnail?: string;
  mediaType: MediaType;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  views: number;
  views24h?: number;
  updatedAt?: Date;
  isOwner?: boolean;
  isGlobal?: boolean;
  isInRoute?: boolean; // Whether this code is in a route-enabled folder
  isGuest?: boolean; // Hide action buttons for guests
  ownerName?: string;
  isSuperAdmin?: boolean;
  isDragging?: boolean;
  widgets?: CodeWidgets;
  viewMode?: ViewMode;
  mediaCount?: number; // Total number of media items in this code
  replaceStatus?: 'success' | 'error' | null; // Status indicator after file replace
  uploadProgress?: number | null; // Upload progress percentage (0-100)
  pendingReplacement?: PendingReplacement; // Scheduled replacement info
  onDelete?: () => void;
  onRefresh?: () => void;
  onReplaceFile?: (file: File) => void;
  onPublish?: () => void;
  onCopy?: () => void;
  onTitleChange?: (newTitle: string) => void;
  onTransferOwnership?: () => void;
  onDuplicate?: () => void;
  onToggleGlobal?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onScheduleReplacement?: (file: File, scheduledAt: Date) => void;
  onCancelScheduledReplacement?: () => void;
  onEdit?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Removed - now using translations via useTranslations('media')

export default function CodeCard({
  id,
  shortId,
  title,
  thumbnail,
  mediaType,
  mediaUrl,
  fileName,
  fileSize,
  views,
  views24h = 0,
  updatedAt,
  isOwner = true,
  isGlobal = false,
  isInRoute = false,
  isGuest = false,
  ownerName,
  isSuperAdmin = false,
  isDragging = false,
  widgets,
  viewMode = 'grid',
  mediaCount = 1,
  replaceStatus,
  uploadProgress,
  pendingReplacement,
  onDelete,
  onRefresh,
  onReplaceFile,
  onPublish,
  onCopy,
  onTitleChange,
  onTransferOwnership,
  onDuplicate,
  onToggleGlobal,
  onDragStart,
  onDragEnd,
  onScheduleReplacement,
  onCancelScheduledReplacement,
  onEdit,
}: CodeCardProps) {
  const tMedia = useTranslations('media');
  const tCard = useTranslations('card');
  const locale = useLocale();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [displayViews, setDisplayViews] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [replaceConfirmModal, setReplaceConfirmModal] = useState<{ isOpen: boolean; file: File | null }>({
    isOpen: false,
    file: null,
  });
  const [replaceOptionsModal, setReplaceOptionsModal] = useState<{ isOpen: boolean; file: File | null }>({
    isOpen: false,
    file: null,
  });
  const [scheduleModal, setScheduleModal] = useState<{ isOpen: boolean; file: File | null }>({
    isOpen: false,
    file: null,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const prevViewsRef = useRef(views);

  // Detect link type from URL
  type LinkType = 'whatsapp' | 'phone' | 'sms' | 'email' | 'url';

  const detectLinkType = (url?: string): LinkType => {
    if (!url) return 'url';
    try {
      if (url.startsWith('tel:')) return 'phone';
      if (url.startsWith('sms:')) return 'sms';
      if (url.startsWith('mailto:')) return 'email';
      const urlObj = new URL(url);
      if (urlObj.hostname === 'wa.me' || urlObj.hostname === 'api.whatsapp.com') return 'whatsapp';
      return 'url';
    } catch {
      return 'url';
    }
  };

  // Extract phone number from URL (works for WhatsApp, phone, SMS)
  const extractPhoneFromUrl = (url?: string): string => {
    if (!url) return '';
    try {
      if (url.startsWith('tel:')) {
        return url.replace('tel:', '').split('?')[0];
      }
      if (url.startsWith('sms:')) {
        return url.replace('sms:', '').split('?')[0];
      }
      const urlObj = new URL(url);
      if (urlObj.hostname === 'wa.me') {
        return urlObj.pathname.slice(1) || '';
      }
      if (urlObj.hostname === 'api.whatsapp.com') {
        return urlObj.searchParams.get('phone') || '';
      }
      return '';
    } catch {
      return '';
    }
  };

  // Extract email from mailto URL
  const extractEmailFromUrl = (url?: string): string => {
    if (!url || !url.startsWith('mailto:')) return '';
    return url.replace('mailto:', '').split('?')[0];
  };

  // Get link type label
  const getLinkTypeLabel = (url?: string): string => {
    const type = detectLinkType(url);
    switch (type) {
      case 'whatsapp': return 'WhatsApp';
      case 'phone': return tMedia('phone') || 'טלפון';
      case 'sms': return 'SMS';
      case 'email': return tMedia('email') || 'אימייל';
      default: return tMedia('link');
    }
  };

  // Get translated media label
  const getMediaLabel = (type: MediaType): string => {
    // Check link type for special handling
    if (type === 'link') {
      return getLinkTypeLabel(mediaUrl);
    }
    switch (type) {
      case 'image': return tMedia('image');
      case 'gif': return 'GIF';
      case 'video': return tMedia('video');
      case 'pdf': return tMedia('pdf');
      case 'wordcloud': return tMedia('wordcloud');
      case 'riddle': return tMedia('riddle');
      case 'selfiebeam': return tMedia('selfiebeam');
      case 'weeklycal': return tMedia('weeklycal');
      case 'qvote': return 'Q.Vote';
      default: return tMedia('image');
    }
  };

  // Animate counter on mount (from 0) and on view updates (from previous value)
  useEffect(() => {
    const startValue = prevViewsRef.current === views ? 0 : prevViewsRef.current;
    const endValue = views;
    const duration = startValue === 0 ? 1000 : 500; // Longer animation on first load
    const startTime = Date.now();

    setTimeout(() => setIsAnimating(true), 0);

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * easeOut);

      setDisplayViews(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        prevViewsRef.current = views;
      }
    };

    requestAnimationFrame(animate);
  }, [views]);

  // Format full date and time for tooltip
  const formatFullDateTime = (date: Date): string => {
    return date.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format relative time with translations
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return tCard('now');
    if (diffMins < 60) return tCard('minutesAgo', { count: diffMins });
    if (diffHours < 24) return tCard('hoursAgo', { count: diffHours });
    if (diffDays < 7) return tCard('daysAgo', { count: diffDays });
    // Show date and time for older items
    return date.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short' });
  };

  const viewUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/v/${shortId}`
    : `/v/${shortId}`;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmedTitle = editTitle.trim();
    if (trimmedTitle && trimmedTitle !== title) {
      onTitleChange?.(trimmedTitle);
    } else {
      setEditTitle(title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditTitle(title);
      setIsEditing(false);
    }
  };

  // Handle copy with animation
  const handleCopyClick = () => {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle file replacement
  const handleReplaceClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onReplaceFile?.(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // Handle file drag over card
  const handleFileDragOver = (e: React.DragEvent) => {
    // Only handle file drops, not card drags
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsFileDragOver(true);
    }
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragOver(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragOver(false);

    // Only handle file drops
    if (!e.dataTransfer.types.includes('Files')) return;
    if (!onReplaceFile || isGuest) return;

    const file = e.dataTransfer.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
      'application/pdf'
    ];

    if (!validTypes.includes(file.type)) return;

    // Show options modal (replace now or schedule)
    setReplaceOptionsModal({ isOpen: true, file });
  };

  const handleConfirmReplace = () => {
    if (replaceConfirmModal.file) {
      onReplaceFile?.(replaceConfirmModal.file);
    }
    setReplaceConfirmModal({ isOpen: false, file: null });
  };

  // Handle "Replace Now" from options modal
  const handleReplaceNow = () => {
    if (replaceOptionsModal.file) {
      setReplaceConfirmModal({ isOpen: true, file: replaceOptionsModal.file });
    }
    setReplaceOptionsModal({ isOpen: false, file: null });
  };

  // Handle "Schedule Replacement" from options modal
  const handleOpenSchedule = () => {
    if (replaceOptionsModal.file) {
      setScheduleModal({ isOpen: true, file: replaceOptionsModal.file });
    }
    setReplaceOptionsModal({ isOpen: false, file: null });
  };

  // Handle scheduling confirmation
  const handleScheduleConfirm = (scheduledAt: Date) => {
    if (scheduleModal.file && onScheduleReplacement) {
      onScheduleReplacement(scheduleModal.file, scheduledAt);
    }
    setScheduleModal({ isOpen: false, file: null });
  };

  // Get display info based on media type
  const getMediaInfo = () => {
    if (mediaType === 'link' && mediaUrl) {
      const linkType = detectLinkType(mediaUrl);
      switch (linkType) {
        case 'whatsapp':
        case 'phone':
        case 'sms': {
          const phone = extractPhoneFromUrl(mediaUrl);
          return phone || '';
        }
        case 'email': {
          return extractEmailFromUrl(mediaUrl);
        }
        default: {
          try {
            const url = new URL(mediaUrl);
            return url.hostname;
          } catch {
            return mediaUrl;
          }
        }
      }
    }
    return fileName || '';
  };

  const MediaIcon = mediaType === 'video' ? Video : mediaType === 'pdf' ? FileText : Image;

  // List view - compact horizontal row
  if (viewMode === 'list') {
    return (
      <>
      <div
        className={clsx(
          "group relative bg-bg-card border-2 rounded-lg transition-all",
          isDragging && "opacity-50 scale-95",
          isFileDragOver
            ? "border-accent bg-accent/5"
            : "border-border hover:border-accent/50"
        )}
        draggable={isOwner && !isEditing}
        onDragStart={(e) => {
          if (isEditing) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData('text/plain', id);
          e.dataTransfer.effectAllowed = 'move';
          onDragStart?.();
        }}
        onDragEnd={() => onDragEnd?.()}
        onDragOver={handleFileDragOver}
        onDragLeave={handleFileDragLeave}
        onDrop={handleFileDrop}
      >
        {/* File drag overlay */}
        {isFileDragOver && (
          <div className="absolute inset-0 z-20 bg-accent/10 backdrop-blur-sm rounded-lg flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-accent">
              <Upload className="w-5 h-5" />
              <span className="text-sm font-medium">{tCard('dropToReplace')}</span>
            </div>
          </div>
        )}
        {/* Replace status overlay */}
        {replaceStatus && (
          <div className={clsx(
            "absolute inset-0 z-20 backdrop-blur-sm rounded-lg flex items-center justify-center pointer-events-none transition-opacity",
            replaceStatus === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'
          )}>
            <div className={clsx(
              "flex items-center gap-2",
              replaceStatus === 'success' ? 'text-green-500' : 'text-red-500'
            )}>
              {replaceStatus === 'success' ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
            </div>
          </div>
        )}
        {/* Upload progress overlay */}
        {uploadProgress !== null && uploadProgress !== undefined && (
          <div className="absolute inset-0 z-20 bg-bg-card/80 backdrop-blur-sm rounded-lg flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 bg-bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="text-sm font-medium text-accent">{uploadProgress}%</span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 p-3">
          {/* Small thumbnail/icon */}
          <a href={`/code/${id}`} className="flex-shrink-0 w-12 h-12 rounded-lg bg-bg-secondary overflow-hidden flex items-center justify-center">
            {mediaType === 'link' ? (
              <QRCodeSVG value={viewUrl} size={40} level="L" bgColor="transparent" fgColor="currentColor" className="text-text-primary" />
            ) : mediaType === 'pdf' ? (
              <FileText className="w-6 h-6 text-red-500" />
            ) : mediaType === 'riddle' ? (
              <img src="/media/riddle.jpg" alt={title} className="w-full h-full object-cover" />
            ) : mediaType === 'selfiebeam' ? (
              <img src="/media/SELFIEBEAM.jpg" alt={title} className="w-full h-full object-cover" />
            ) : thumbnail ? (
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
            ) : (
              <MediaIcon className="w-6 h-6 text-text-secondary/50" />
            )}
          </a>

          {/* Title and info */}
          <div className="flex-1 min-w-0">
            <a href={`/code/${id}`} className="block">
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSave}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.preventDefault()}
                  className="w-full font-medium text-text-primary bg-bg-secondary border border-accent rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
              ) : (
                <h3
                  onClick={(e) => {
                    if (isOwner) {
                      e.preventDefault();
                      setIsEditing(true);
                    }
                  }}
                  className={clsx(
                    'font-medium text-text-primary truncate text-sm',
                    isOwner && 'cursor-pointer hover:text-accent transition-colors'
                  )}
                >
                  {title}
                </h3>
              )}
            </a>
            <div className="flex items-center gap-3 text-xs text-text-secondary mt-0.5">
              <span className="font-mono" dir="ltr">{shortId}</span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {displayViews}
              </span>
              {updatedAt && (
                <span className="hidden sm:flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(updatedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="px-2 py-0.5 text-xs font-medium bg-bg-secondary rounded text-text-secondary">
              {getMediaLabel(mediaType)}
            </span>
            {pendingReplacement && (
              <PendingReplacementBadge
                scheduledAt={pendingReplacement.scheduledAt}
                onCancel={onCancelScheduledReplacement}
                locale={locale as 'he' | 'en'}
                compact
              />
            )}
            {isGlobal && (
              <span className="px-2 py-0.5 text-xs font-medium bg-success/20 rounded text-success flex items-center gap-1">
                <Globe className="w-3 h-3" />
              </span>
            )}
            {isInRoute && (
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 rounded text-emerald-400 flex items-center gap-1" title="מסלול XP פעיל">
                <Route className="w-3 h-3" />
                XP
              </span>
            )}
            {widgets?.whatsapp?.groupLink && (
              <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
            )}
          </div>

          {/* Actions - hidden for guests */}
          {!isGuest && (
            <div className="flex items-center gap-1">
              {isOwner && (
                <button onClick={onDelete} className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {onEdit && (
                <button onClick={onEdit} className="p-1.5 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {isSuperAdmin && onToggleGlobal && (
                <button
                  onClick={onToggleGlobal}
                  className={clsx(
                    'p-1.5 rounded-lg transition-colors',
                    isGlobal ? 'text-success bg-success/10' : 'text-text-secondary hover:text-success hover:bg-success/10'
                  )}
                >
                  <Globe className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleCopyClick}
                className={clsx(
                  'p-1.5 rounded-lg transition-all',
                  copied ? 'text-white bg-success' : 'text-white bg-accent hover:bg-accent-hover'
                )}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.gif" onChange={handleFileChange} className="hidden" />
      </div>

      {/* Replace media confirmation modal */}
      <ReplaceMediaConfirm
        isOpen={replaceConfirmModal.isOpen}
        onClose={() => setReplaceConfirmModal({ isOpen: false, file: null })}
        onConfirm={handleConfirmReplace}
        currentMediaType={mediaType}
        currentFileName={fileName}
        newFileName={replaceConfirmModal.file?.name}
        mediaCount={mediaCount}
      />

      {/* Replace options modal (replace now or schedule) */}
      <ReplaceMediaOptionsModal
        isOpen={replaceOptionsModal.isOpen}
        onClose={() => setReplaceOptionsModal({ isOpen: false, file: null })}
        onReplaceNow={handleReplaceNow}
        onScheduleReplacement={handleOpenSchedule}
        currentMediaType={mediaType}
        currentFileName={fileName}
        newFileName={replaceOptionsModal.file?.name}
        hasExistingScheduledReplacement={!!pendingReplacement}
        existingScheduledDate={pendingReplacement?.scheduledAt}
      />

      {/* Schedule replacement modal */}
      <ScheduleReplacementModal
        isOpen={scheduleModal.isOpen}
        onClose={() => setScheduleModal({ isOpen: false, file: null })}
        onSchedule={handleScheduleConfirm}
        currentFileName={fileName}
        newFileName={scheduleModal.file?.name}
      />
      </>
    );
  }

  // Grid view - original card layout
  return (
    <>
    <div
      className={clsx(
        "group relative bg-bg-card border-2 rounded-xl transition-all",
        isDragging && "opacity-50 scale-95",
        isFileDragOver
          ? "border-accent bg-accent/5 scale-[1.02]"
          : "border-border hover:border-accent/50"
      )}
      draggable={isOwner && !isEditing}
      onDragStart={(e) => {
        if (isEditing) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
      onDrop={handleFileDrop}
    >
      {/* File drag overlay */}
      {isFileDragOver && (
        <div className="absolute inset-0 z-20 bg-accent/10 backdrop-blur-sm rounded-xl flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-accent">
            <Upload className="w-8 h-8" />
            <span className="text-sm font-medium">{tCard('dropToReplace')}</span>
          </div>
        </div>
      )}
      {/* Replace status overlay */}
      {replaceStatus && (
        <div className={clsx(
          "absolute inset-0 z-20 backdrop-blur-sm rounded-xl flex items-center justify-center pointer-events-none transition-opacity",
          replaceStatus === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'
        )}>
          <div className={clsx(
            "flex flex-col items-center gap-2",
            replaceStatus === 'success' ? 'text-green-500' : 'text-red-500'
          )}>
            {replaceStatus === 'success' ? (
              <CheckCircle className="w-12 h-12" />
            ) : (
              <XCircle className="w-12 h-12" />
            )}
          </div>
        </div>
      )}
      {/* Upload progress overlay */}
      {uploadProgress !== null && uploadProgress !== undefined && (
        <div className="absolute inset-0 z-20 bg-bg-card/80 backdrop-blur-sm rounded-xl flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-32 h-2 bg-bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-lg font-medium text-accent">{uploadProgress}%</span>
          </div>
        </div>
      )}
      {/* Thumbnail / Preview - QR Code for links, media preview for others */}
      <a href={`/code/${id}`} className="block aspect-[4/3] relative overflow-hidden rounded-t-xl bg-bg-secondary">
        {mediaType === 'link' ? (
          // Show QR code for links - larger and centered
          <div className="w-full h-full flex items-center justify-center p-4">
            <div ref={qrRef}>
              <QRCodeSVG
                value={viewUrl}
                size={140}
                level="H"
                includeMargin={false}
                bgColor="transparent"
                fgColor="currentColor"
                className="text-text-primary"
              />
            </div>
          </div>
        ) : mediaType === 'pdf' ? (
          // PDF preview with nice styling
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-red-500/10 to-red-600/20">
            <div className="w-16 h-20 bg-white rounded-lg shadow-lg flex items-center justify-center relative">
              <FileText className="w-10 h-10 text-red-500" />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
                PDF
              </div>
            </div>
            {fileName && (
              <span className="text-xs text-text-secondary truncate max-w-[80%] px-2">{fileName}</span>
            )}
          </div>
        ) : mediaType === 'riddle' ? (
          <img
            src="/media/riddle.jpg"
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : mediaType === 'selfiebeam' ? (
          <img
            src="/media/SELFIEBEAM.jpg"
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <MediaIcon className="w-12 h-12 text-text-secondary/50" />
            {fileName && (
              <span className="text-xs text-text-secondary/70 truncate max-w-[80%]">{fileName}</span>
            )}
          </div>
        )}

        {/* Mini QR Code overlay - shown for all except links */}
        {mediaType !== 'link' && (
          <div className="absolute top-2 left-2 w-14 h-14 bg-white rounded-lg shadow-lg p-1.5 opacity-90 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <QRCodeSVG
              value={viewUrl}
              size={44}
              level="M"
              includeMargin={false}
            />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 right-2 flex gap-1.5">
          <span className="px-2 py-0.5 text-xs font-medium bg-bg-card/80 backdrop-blur-sm rounded text-text-primary">
            {getMediaLabel(mediaType)}
          </span>
          {isGlobal && (
            <span className="px-2 py-0.5 text-xs font-medium bg-success/80 backdrop-blur-sm rounded text-white flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {tCard('global')}
            </span>
          )}
        </div>

        {/* Widget indicators at bottom - show when groupLink exists */}
        {widgets?.whatsapp?.groupLink && (
          <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
            <Tooltip text={tCard('whatsappWidgetActive')}>
              <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg shadow-[#25D366]/30">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
            </Tooltip>
          </div>
        )}

      </a>

      {/* Info Section */}
      <div className="p-3 space-y-2">
        {/* Title - editable */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full font-medium text-text-primary bg-bg-secondary border border-accent rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <h3
            onClick={() => isOwner && setIsEditing(true)}
            className={clsx(
              'font-medium text-text-primary truncate',
              isOwner && 'cursor-pointer hover:text-accent transition-colors'
            )}
            title={isOwner ? tCard('clickToEdit') : title}
          >
            {title}
          </h3>
        )}

        {/* Meta info row - shortId and file size */}
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span className="font-mono" dir="ltr">{shortId}</span>
          {fileSize !== undefined && fileSize > 0 && (
            <span className="bg-bg-secondary px-1.5 py-0.5 rounded">{formatBytes(fileSize)}</span>
          )}
        </div>

        {/* Pending replacement badge */}
        {pendingReplacement && (
          <PendingReplacementBadge
            scheduledAt={pendingReplacement.scheduledAt}
            onCancel={onCancelScheduledReplacement}
            locale={locale as 'he' | 'en'}
          />
        )}

        {/* Views and time row */}
        <div className="flex items-center justify-between text-xs">
          {/* Views with tooltip */}
          <div
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <div className={clsx(
              "flex items-center gap-1.5 px-2 py-1 bg-bg-secondary rounded cursor-help transition-all",
              isAnimating && "ring-1 ring-green-500"
            )}>
              <Eye className="w-3.5 h-3.5 text-text-secondary" />
              <span className={clsx(
                "font-medium",
                isAnimating ? "text-green-500" : "text-text-primary"
              )}>
                {displayViews}
              </span>
              <span className="text-text-secondary">{tCard('views')}</span>
            </div>

            {/* Views Tooltip */}
            {showTooltip && (
              <div className="absolute bottom-full left-0 mb-2 p-2.5 bg-bg-card border border-border rounded-lg shadow-xl z-[9999] whitespace-nowrap pointer-events-none">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-text-secondary text-xs">{tCard('total')}:</span>
                    <span className="text-text-primary font-semibold">{views}</span>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-text-secondary text-xs">{tCard('last24h')}:</span>
                    <span className="text-accent font-semibold">{views24h}</span>
                  </div>
                </div>
                <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-bg-card border-r border-b border-border transform rotate-45" />
              </div>
            )}
          </div>

          {/* Last updated */}
          {updatedAt && (
            <Tooltip text={formatFullDateTime(updatedAt)} position="top">
              <div className="flex items-center gap-1 text-text-secondary cursor-help">
                <Clock className="w-3 h-3" />
                <span>{formatRelativeTime(updatedAt)}</span>
              </div>
            </Tooltip>
          )}
        </div>

        {/* Owner badge - only show if ownerName exists */}
        {ownerName && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-border">
            <User className={clsx("w-3.5 h-3.5", isOwner ? "text-text-secondary" : "text-orange-500")} />
            <span className={clsx("text-xs truncate flex-1", isOwner ? "text-text-secondary" : "text-orange-500 font-medium")}>{ownerName}</span>
            {isSuperAdmin && onTransferOwnership && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onTransferOwnership();
                }}
                className="p-1 rounded text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                title={tCard('transferOwnership')}
              >
                <UserCog className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input for replacement */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,.gif"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Actions Bar - hidden for guests */}
      {!isGuest && (
        <div className="flex flex-wrap items-center gap-1 p-2 border-t border-border/50">
          {/* Delete - owner only */}
          {isOwner && (
            <Tooltip text={tCard('delete')}>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Tooltip>
          )}

          {/* Replace file */}
          <Tooltip text={tCard('replaceFile')}>
            <button
              onClick={handleReplaceClick}
              className="p-1.5 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </Tooltip>

          {/* Duplicate - creates a copy */}
          {onDuplicate && (
            <Tooltip text={tCard('duplicateCode')}>
              <button
                onClick={onDuplicate}
                className="p-1.5 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
              >
                <Files className="w-4 h-4" />
              </button>
            </Tooltip>
          )}

          {/* Edit - for special types like weeklycal */}
          {onEdit && (
            <Tooltip text={tCard('edit') || 'עריכה'}>
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </Tooltip>
          )}

          {/* Global toggle - super admin only */}
          {isSuperAdmin && onToggleGlobal && (
            <Tooltip text={isGlobal ? tCard('removeGlobal') : tCard('makeGlobal')}>
              <button
                onClick={onToggleGlobal}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors',
                  isGlobal
                    ? 'text-success bg-success/10'
                    : 'text-text-secondary hover:text-success hover:bg-success/10'
                )}
              >
                <Globe className="w-4 h-4" />
              </button>
            </Tooltip>
          )}

          {/* Spacer */}
          <div className="flex-1 min-w-[8px]" />

          {/* Copy link - primary action */}
          <Tooltip text={copied ? tCard('copied') : tCard('copyLink')}>
            <button
              onClick={handleCopyClick}
              className={clsx(
                'p-1.5 rounded-lg transition-all',
                copied
                  ? 'text-white bg-success scale-105'
                  : 'text-white bg-accent hover:bg-accent-hover'
              )}
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </Tooltip>
        </div>
      )}
    </div>

    {/* Replace media confirmation modal */}
    <ReplaceMediaConfirm
      isOpen={replaceConfirmModal.isOpen}
      onClose={() => setReplaceConfirmModal({ isOpen: false, file: null })}
      onConfirm={handleConfirmReplace}
      currentMediaType={mediaType}
      currentFileName={fileName}
      newFileName={replaceConfirmModal.file?.name}
      mediaCount={mediaCount}
    />

    {/* Replace options modal (replace now or schedule) */}
    <ReplaceMediaOptionsModal
      isOpen={replaceOptionsModal.isOpen}
      onClose={() => setReplaceOptionsModal({ isOpen: false, file: null })}
      onReplaceNow={handleReplaceNow}
      onScheduleReplacement={handleOpenSchedule}
      currentMediaType={mediaType}
      currentFileName={fileName}
      newFileName={replaceOptionsModal.file?.name}
      hasExistingScheduledReplacement={!!pendingReplacement}
      existingScheduledDate={pendingReplacement?.scheduledAt}
    />

    {/* Schedule replacement modal */}
    <ScheduleReplacementModal
      isOpen={scheduleModal.isOpen}
      onClose={() => setScheduleModal({ isOpen: false, file: null })}
      onSchedule={handleScheduleConfirm}
      currentFileName={fileName}
      newFileName={scheduleModal.file?.name}
    />
    </>
  );
}
