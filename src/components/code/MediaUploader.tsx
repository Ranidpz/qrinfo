'use client';

import { Upload, Image, Video, FileText, Link, Cloud, Gamepad2 } from 'lucide-react';
import { useState, useRef, DragEvent } from 'react';
import { clsx } from 'clsx';

interface MediaUploaderProps {
  onFileSelect: (file: File) => void;
  onLinkAdd?: (url: string) => void;
  onRiddleCreate?: () => void;
  onWordCloudCreate?: () => void;
  maxSize?: number; // bytes
  accept?: string[];
  disabled?: boolean;
}

export default function MediaUploader({
  onFileSelect,
  onLinkAdd,
  onRiddleCreate,
  onWordCloudCreate,
  maxSize = 5 * 1024 * 1024, // 5MB default
  disabled = false,
}: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'link' | 'riddle' | 'wordcloud' | 'minigames'>('upload');
  const [linkUrl, setLinkUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    setError(null);

    // Check file size
    if (file.size > maxSize) {
      setError(`הקובץ גדול מדי. מקסימום ${formatBytes(maxSize)}`);
      return;
    }

    // Check file type
    const validTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
      'application/pdf'
    ];

    if (!validTypes.includes(file.type)) {
      setError('סוג קובץ לא נתמך');
      return;
    }

    onFileSelect(file);
  };

  const handleLinkSubmit = () => {
    if (!linkUrl.trim()) return;
    setError(null);

    let url = linkUrl.trim();

    // Add https:// if no protocol specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      new URL(url);
      onLinkAdd?.(url);
      setLinkUrl('');
    } catch {
      setError('כתובת URL לא תקינה');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  return (
    <div className="card">
      {/* Tab buttons */}
      {(onLinkAdd || onRiddleCreate || onWordCloudCreate) && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('upload')}
            className={clsx(
              'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'upload'
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
            )}
          >
            העלאת תוכן
          </button>
          {onLinkAdd && (
            <button
              onClick={() => setActiveTab('link')}
              className={clsx(
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'link'
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
              )}
            >
              הוספת לינק
            </button>
          )}
          {onRiddleCreate && (
            <button
              onClick={() => setActiveTab('riddle')}
              className={clsx(
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'riddle'
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
              )}
            >
              כתב חידה
            </button>
          )}
          {onWordCloudCreate && (
            <button
              onClick={() => setActiveTab('wordcloud')}
              className={clsx(
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'wordcloud'
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
              )}
            >
              ענן מילים
            </button>
          )}
          <button
            onClick={() => setActiveTab('minigames')}
            className={clsx(
              'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'minigames'
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
            )}
          >
            מיניגיימס
          </button>
        </div>
      )}

      {activeTab === 'upload' ? (
        <>
          {/* Upload area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !disabled && fileInputRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
              isDragging
                ? 'border-accent bg-accent/10'
                : 'border-border hover:border-accent/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept="image/*,video/*,.pdf"
              className="hidden"
              disabled={disabled}
            />

            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-accent" />
              </div>

              <div>
                <h3 className="text-lg font-medium text-text-primary mb-1">
                  העלאת תוכן
                </h3>
                <p className="text-sm text-text-secondary">
                  גררו תוכן לכאן או לחצו לבחירה
                </p>
              </div>

              <div className="flex items-center gap-4 text-text-secondary">
                <span className="flex items-center gap-1 text-xs">
                  <Image className="w-4 h-4" />
                  תמונות
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <Video className="w-4 h-4" />
                  וידאו
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <FileText className="w-4 h-4" />
                  PDF
                </span>
              </div>

              <p className="text-xs text-text-secondary">
                גודל מקסימלי: {formatBytes(maxSize)}
                <br />
                JPG, PNG, WebP, GIF, MP4, WebM, PDF
              </p>
            </div>
          </div>
        </>
      ) : activeTab === 'link' ? (
        /* Link input */
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-bg-secondary rounded-xl">
            <Link className="w-6 h-6 text-text-secondary" />
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="הזינו כתובת URL..."
              className="input flex-1"
              dir="ltr"
            />
          </div>
          <button
            onClick={handleLinkSubmit}
            disabled={!linkUrl.trim()}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            צור חוויה
          </button>
        </div>
      ) : activeTab === 'riddle' ? (
        /* Riddle creation */
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4 p-6 bg-bg-secondary rounded-xl">
            <div className="w-20 h-20 rounded-xl overflow-hidden">
              <img
                src="/media/riddle.jpg"
                alt="כתב חידה"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-text-primary mb-1">
                כתב חידה
              </h3>
              <p className="text-sm text-text-secondary">
                צור דף נחיתה אינטראקטיבי עם טקסט, תמונות וסרטון יוטיוב
              </p>
            </div>
          </div>
          <button
            onClick={onRiddleCreate}
            disabled={disabled}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            צור כתב חידה
          </button>
        </div>
      ) : activeTab === 'wordcloud' ? (
        /* Word Cloud creation */
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4 p-6 bg-bg-secondary rounded-xl">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
              <Cloud className="w-7 h-7 text-accent" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-text-primary mb-1">
                ענן מילים
              </h3>
              <p className="text-sm text-text-secondary">
                צור ענן מילים אינטראקטיבי לאירועים עם QuizyCloud
              </p>
            </div>
          </div>
          <button
            onClick={onWordCloudCreate}
            disabled={disabled}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            צור ענן מילים
          </button>
        </div>
      ) : activeTab === 'minigames' ? (
        /* Minigames - coming soon */
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4 p-6 bg-bg-secondary rounded-xl">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
              <Gamepad2 className="w-7 h-7 text-accent" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-text-primary mb-1">
                מיניגיימס
              </h3>
              <p className="text-sm text-text-secondary">
                5 משחקים מאתגרים מהטלפון עם לוח תוצאות ענק על מסכי הענק באירוע
              </p>
            </div>
          </div>
          <button
            disabled
            className="btn w-full bg-bg-secondary text-text-secondary cursor-not-allowed"
          >
            בקרוב מאוד
          </button>
        </div>
      ) : null}

      {/* Error message */}
      {error && (
        <p className="mt-3 text-sm text-danger text-center">{error}</p>
      )}
    </div>
  );
}
