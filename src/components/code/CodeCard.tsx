'use client';

import { Trash2, RefreshCw, Globe, Copy, Image, Video, FileText, Link as LinkIcon, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import { MediaType } from '@/types';

interface CodeCardProps {
  id: string;
  shortId: string;
  title: string;
  thumbnail?: string;
  mediaType: MediaType;
  fileSize?: number;
  views: number;
  isOwner?: boolean;
  isGlobal?: boolean;
  onDelete?: () => void;
  onRefresh?: () => void;
  onPublish?: () => void;
  onCopy?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getMediaIcon(type: MediaType) {
  switch (type) {
    case 'image':
    case 'gif':
      return Image;
    case 'video':
      return Video;
    case 'pdf':
      return FileText;
    case 'link':
      return LinkIcon;
    default:
      return Image;
  }
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
  fileSize,
  views,
  isOwner = true,
  isGlobal = false,
  onDelete,
  onRefresh,
  onPublish,
  onCopy,
}: CodeCardProps) {
  const MediaIcon = getMediaIcon(mediaType);

  return (
    <div className="group relative bg-bg-card border border-border rounded-xl overflow-hidden hover:border-accent/50 transition-all">
      {/* Thumbnail / Preview */}
      <a href={`/code/${id}`} className="block aspect-video relative overflow-hidden bg-bg-secondary">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MediaIcon className="w-12 h-12 text-text-secondary/50" />
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
        <h3 className="font-medium text-text-primary truncate mb-1">
          {title}
        </h3>
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
