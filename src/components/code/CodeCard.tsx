'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash2, RefreshCw, Globe, Copy, Image, Video, FileText, Eye, Printer, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { clsx } from 'clsx';
import { MediaType } from '@/types';

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
  isOwner?: boolean;
  isGlobal?: boolean;
  onDelete?: () => void;
  onRefresh?: () => void;
  onPublish?: () => void;
  onCopy?: () => void;
  onTitleChange?: (newTitle: string) => void;
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
  isOwner = true,
  isGlobal = false,
  onDelete,
  onRefresh,
  onPublish,
  onCopy,
  onTitleChange,
}: CodeCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

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
    <div className="group relative bg-bg-card border border-border rounded-xl overflow-hidden hover:border-accent/50 transition-all">
      {/* Thumbnail / Preview - QR Code for links, media preview for others */}
      <a href={`/code/${id}`} className="block aspect-video relative overflow-hidden bg-bg-secondary">
        {mediaType === 'link' ? (
          // Show QR code for links
          <div className="w-full h-full flex items-center justify-center bg-white p-4">
            <div ref={qrRef}>
              <QRCodeSVG
                value={viewUrl}
                size={120}
                level="H"
                includeMargin={false}
              />
            </div>
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

        {/* Views counter */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 text-xs bg-black/60 backdrop-blur-sm rounded text-white flex items-center gap-1">
          <Eye className="w-3 h-3" />
          {views}
        </div>
      </a>

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
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 p-2 pt-0">
        {isOwner && (
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
            title="מחק"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onRefresh}
          className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
          title="החלף מדיה"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <button
          onClick={onPublish}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            isGlobal
              ? 'text-success bg-success/10'
              : 'text-text-secondary hover:text-success hover:bg-success/10'
          )}
          title="פרסם"
        >
          <Globe className="w-4 h-4" />
        </button>

        <button
          onClick={handlePrint}
          className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
          title="הדפס QR"
        >
          <Printer className="w-4 h-4" />
        </button>

        <button
          onClick={onCopy}
          className="p-2 rounded-lg text-white bg-accent hover:bg-accent-hover transition-colors mr-auto"
          title="העתק לינק"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
