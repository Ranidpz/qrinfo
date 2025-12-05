'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash2, RefreshCw, Globe, Copy, Image, Video, FileText, Eye, ExternalLink, UserCog, User, Clock, Check, Files, MessageCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { clsx } from 'clsx';
import { MediaType, CodeWidgets } from '@/types';

// Custom Tooltip component for instant display
function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-opacity duration-100 z-[100] pointer-events-none">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
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
  ownerName?: string;
  isSuperAdmin?: boolean;
  isDragging?: boolean;
  widgets?: CodeWidgets;
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
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getMediaLabel(type: MediaType): string {
  switch (type) {
    case 'image':
      return 'תמונה';
    case 'gif':
      return 'GIF';
    case 'video':
      return 'וידאו';
    case 'pdf':
      return 'PDF';
    case 'link':
      return 'לינק';
    default:
      return 'מדיה';
  }
}

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
  ownerName,
  isSuperAdmin = false,
  isDragging = false,
  widgets,
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
}: CodeCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [displayViews, setDisplayViews] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const prevViewsRef = useRef(views);

  // Animate counter on mount (from 0) and on view updates (from previous value)
  useEffect(() => {
    const startValue = prevViewsRef.current === views ? 0 : prevViewsRef.current;
    const endValue = views;
    const duration = startValue === 0 ? 1000 : 500; // Longer animation on first load
    const startTime = Date.now();

    setIsAnimating(true);

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

  // Format relative time in Hebrew
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'עכשיו';
    if (diffMins < 60) return `לפני ${diffMins} דקות`;
    if (diffHours < 24) return `לפני ${diffHours} שעות`;
    if (diffDays < 7) return `לפני ${diffDays} ימים`;
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
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

  // Get display info based on media type
  const getMediaInfo = () => {
    if (mediaType === 'link' && mediaUrl) {
      try {
        const url = new URL(mediaUrl);
        return url.hostname;
      } catch {
        return mediaUrl;
      }
    }
    return fileName || '';
  };

  const MediaIcon = mediaType === 'video' ? Video : mediaType === 'pdf' ? FileText : Image;

  return (
    <div
      className={clsx(
        "group relative bg-bg-card border border-border rounded-xl hover:border-accent/50 transition-all",
        isDragging && "opacity-50 scale-95"
      )}
      draggable={isOwner}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
    >
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
              גלובלי
            </span>
          )}
        </div>

        {/* Widget indicators at bottom - only show when widget is enabled AND has a valid groupLink */}
        {widgets?.whatsapp?.enabled && widgets?.whatsapp?.groupLink && (
          <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
            <Tooltip text="ווידג׳ט WhatsApp פעיל">
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
            title={isOwner ? 'לחץ לעריכה' : title}
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
              <span className="text-text-secondary">צפיות</span>
            </div>

            {/* Views Tooltip */}
            {showTooltip && (
              <div className="absolute bottom-full left-0 mb-2 p-2.5 bg-bg-card border border-border rounded-lg shadow-xl z-[9999] whitespace-nowrap pointer-events-none">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-text-secondary text-xs">סה״כ:</span>
                    <span className="text-text-primary font-semibold">{views}</span>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-text-secondary text-xs">24 שעות:</span>
                    <span className="text-accent font-semibold">{views24h}</span>
                  </div>
                </div>
                <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-bg-card border-r border-b border-border transform rotate-45" />
              </div>
            )}
          </div>

          {/* Last updated */}
          {updatedAt && (
            <div className="flex items-center gap-1 text-text-secondary" title={updatedAt.toLocaleString('he-IL')}>
              <Clock className="w-3 h-3" />
              <span>{formatRelativeTime(updatedAt)}</span>
            </div>
          )}
        </div>

        {/* Owner badge - only show if ownerName exists */}
        {ownerName && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-border">
            <User className="w-3.5 h-3.5 text-text-secondary" />
            <span className="text-xs text-text-secondary truncate flex-1">{ownerName}</span>
            {isSuperAdmin && onTransferOwnership && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onTransferOwnership();
                }}
                className="p-1 rounded text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                title="העבר בעלות"
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

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-t border-border/50">
        {/* Delete - owner only */}
        {isOwner && (
          <Tooltip text="מחק">
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </Tooltip>
        )}

        {/* Replace file */}
        <Tooltip text="החלף קובץ">
          <button
            onClick={handleReplaceClick}
            className="p-1.5 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </Tooltip>

        {/* Duplicate - creates a copy */}
        {onDuplicate && (
          <Tooltip text="שכפל קוד">
            <button
              onClick={onDuplicate}
              className="p-1.5 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
            >
              <Files className="w-4 h-4" />
            </button>
          </Tooltip>
        )}

        {/* Global toggle - super admin only */}
        {isSuperAdmin && onToggleGlobal && (
          <Tooltip text={isGlobal ? 'הסר מגלובלי' : 'הפוך לגלובלי'}>
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
        <Tooltip text={copied ? 'הועתק!' : 'העתק לינק'}>
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
    </div>
  );
}
