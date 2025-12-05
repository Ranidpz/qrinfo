'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash2, RefreshCw, Globe, Copy, Image, Video, FileText, Eye, Printer, ExternalLink, UserCog, User, Clock, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { clsx } from 'clsx';
import { MediaType } from '@/types';

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
  onDelete?: () => void;
  onRefresh?: () => void;
  onReplaceFile?: (file: File) => void;
  onPublish?: () => void;
  onCopy?: () => void;
  onTitleChange?: (newTitle: string) => void;
  onTransferOwnership?: () => void;
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
  onDelete,
  onRefresh,
  onReplaceFile,
  onPublish,
  onCopy,
  onTitleChange,
  onTransferOwnership,
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

  const handlePrint = async () => {
    // Create high-res QR code for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrSize = 1000; // High resolution for print

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>QR Code - ${title}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .qr-container {
            text-align: center;
            padding: 40px;
            border: 2px solid #e5e7eb;
            border-radius: 16px;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 20px;
            color: #1f2937;
          }
          .qr-wrapper {
            display: inline-block;
            padding: 20px;
            background: white;
            border-radius: 12px;
          }
          .url {
            margin-top: 20px;
            font-size: 14px;
            color: #6b7280;
            direction: ltr;
          }
          .shortId {
            margin-top: 8px;
            font-size: 18px;
            font-weight: bold;
            color: #3b82f6;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <h1>${title}</h1>
          <div class="qr-wrapper" id="qr"></div>
          <p class="shortId">${shortId}</p>
          <p class="url">${viewUrl}</p>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
        <script>
          QRCode.toCanvas(document.createElement('canvas'), '${viewUrl}', {
            width: ${qrSize},
            margin: 2,
            errorCorrectionLevel: 'H'
          }, function(error, canvas) {
            if (error) console.error(error);
            document.getElementById('qr').appendChild(canvas);
            canvas.style.width = '300px';
            canvas.style.height = '300px';
            setTimeout(() => window.print(), 500);
          });
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
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
        "group relative bg-bg-card border border-border rounded-xl overflow-hidden hover:border-accent/50 transition-all",
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
      <a href={`/code/${id}`} className="block aspect-[4/3] relative overflow-hidden bg-bg-secondary">
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

      </a>

      {/* Views counter - moved outside the link, above info section */}
      <div
        className="absolute top-[calc(75%-2rem)] left-2 z-10"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className={clsx(
          "px-2 py-0.5 text-xs bg-black/60 backdrop-blur-sm rounded text-white flex items-center gap-1 cursor-help transition-all",
          isAnimating && "scale-110"
        )}>
          <Eye className="w-3 h-3" />
          <span className={clsx(isAnimating && "text-green-400 font-bold")}>
            {displayViews}
          </span>
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-0 mb-2 p-2 bg-bg-card border border-border rounded-lg shadow-lg z-50 whitespace-nowrap text-xs">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-text-secondary">סה״כ צפיות:</span>
                <span className="text-text-primary font-medium">{views}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-text-secondary">24 שעות אחרונות:</span>
                <span className="text-accent font-medium">{views24h}</span>
              </div>
            </div>
            <div className="absolute -bottom-1 left-3 w-2 h-2 bg-bg-card border-r border-b border-border transform rotate-45"></div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full font-medium text-text-primary bg-bg-secondary border border-accent rounded px-2 py-0.5 mb-1 focus:outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <h3
            onClick={() => isOwner && setIsEditing(true)}
            className={clsx(
              'font-medium text-text-primary truncate mb-1',
              isOwner && 'cursor-pointer hover:text-accent transition-colors'
            )}
            title={isOwner ? 'לחץ לעריכה' : undefined}
          >
            {title}
          </h3>
        )}

        {/* Media details */}
        <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
          {mediaType === 'link' ? (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-accent truncate"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span className="truncate" dir="ltr">{getMediaInfo()}</span>
            </a>
          ) : (
            <div className="flex items-center gap-1 truncate">
              <MediaIcon className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{getMediaInfo()}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span dir="ltr">{shortId}</span>
          {fileSize !== undefined && fileSize > 0 && (
            <span>{formatBytes(fileSize)}</span>
          )}
        </div>

        {/* Last updated */}
        {updatedAt && (
          <div className="flex items-center gap-1 text-xs text-text-secondary mt-1" title={updatedAt.toLocaleString('he-IL')}>
            <Clock className="w-3 h-3" />
            <span>עודכן {formatRelativeTime(updatedAt)}</span>
          </div>
        )}

        {/* Owner badge */}
        {ownerName && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border">
            <User className="w-3 h-3 text-text-secondary" />
            <span className="text-xs text-text-secondary truncate">{ownerName}</span>
            {isSuperAdmin && onTransferOwnership && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onTransferOwnership();
                }}
                className="mr-auto p-1 rounded text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
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

      {/* Actions */}
      <div className="flex items-center gap-1 p-2 pt-0">
        {isOwner && (
          <Tooltip text="מחק">
            <button
              onClick={onDelete}
              className="p-2 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </Tooltip>
        )}

        <Tooltip text="החלף קובץ">
          <button
            onClick={handleReplaceClick}
            className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </Tooltip>

        <Tooltip text={isGlobal ? 'מפורסם' : 'פרסם'}>
          <button
            onClick={onPublish}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              isGlobal
                ? 'text-success bg-success/10'
                : 'text-text-secondary hover:text-success hover:bg-success/10'
            )}
          >
            <Globe className="w-4 h-4" />
          </button>
        </Tooltip>

        <Tooltip text="הדפס QR">
          <button
            onClick={handlePrint}
            className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>
        </Tooltip>

        <Tooltip text={copied ? 'הועתק!' : 'העתק לינק'}>
          <button
            onClick={handleCopyClick}
            className={clsx(
              'p-2 rounded-lg transition-all mr-auto',
              copied
                ? 'text-white bg-success scale-110'
                : 'text-white bg-accent hover:bg-accent-hover'
            )}
          >
            {copied ? (
              <Check className="w-4 h-4 animate-[bounce_0.3s_ease-out]" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
