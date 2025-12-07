'use client';

import { Upload, Image, Video, FileText, Link, Cloud, Gamepad2, Camera } from 'lucide-react';
import { useState, useRef, DragEvent } from 'react';
import { clsx } from 'clsx';

interface MediaUploaderProps {
  onFileSelect: (file: File) => void;
  onLinkAdd?: (url: string) => void;
  onRiddleCreate?: () => void;
  onWordCloudCreate?: () => void;
  onSelfiebeamCreate?: () => void;
  maxSize?: number; // bytes
  accept?: string[];
  disabled?: boolean;
}

export default function MediaUploader({
  onFileSelect,
  onLinkAdd,
  onRiddleCreate,
  onWordCloudCreate,
  onSelfiebeamCreate,
  maxSize = 5 * 1024 * 1024, // 5MB default
  disabled = false,
}: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'link' | 'riddle' | 'wordcloud' | 'selfiebeam' | 'minigames'>('upload');
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

  // Tab button component for cleaner code
  const TabButton = ({
    tab,
    label,
    icon: Icon
  }: {
    tab: typeof activeTab;
    label: string;
    icon: React.ElementType;
  }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={clsx(
        'flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors',
        activeTab === tab
          ? 'bg-accent text-white'
          : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Tab buttons - 3 columns grid */}
      {(onLinkAdd || onRiddleCreate || onWordCloudCreate) && (
        <div className="grid grid-cols-3 gap-2">
          <TabButton tab="upload" label="מדיה" icon={Upload} />
          {onLinkAdd && <TabButton tab="link" label="לינק" icon={Link} />}
          {onRiddleCreate && <TabButton tab="riddle" label="כתב חידה" icon={FileText} />}
          {onWordCloudCreate && <TabButton tab="wordcloud" label="ענן מילים" icon={Cloud} />}
          {onSelfiebeamCreate && <TabButton tab="selfiebeam" label="סלפי בים" icon={Camera} />}
          <TabButton tab="minigames" label="מיניגיימס" icon={Gamepad2} />
        </div>
      )}

      {activeTab === 'upload' ? (
        <>
          {/* Mobile: Compact upload button */}
          <div className="sm:hidden">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept="image/*,video/*,.pdf"
              className="hidden"
              disabled={disabled}
            />
            <button
              onClick={() => !disabled && fileInputRef.current?.click()}
              disabled={disabled}
              className={clsx(
                'w-full flex items-center justify-center gap-3 py-4 px-4 rounded-xl border-2 border-dashed transition-all',
                'border-border hover:border-accent/50 hover:bg-accent/5',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-accent" />
              </div>
              <div className="text-right">
                <p className="font-medium text-text-primary">העלאת קובץ</p>
                <p className="text-xs text-text-secondary">תמונה, וידאו או PDF (עד {formatBytes(maxSize)})</p>
              </div>
            </button>
          </div>

          {/* Desktop: Full drag & drop area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !disabled && fileInputRef.current?.click()}
            className={clsx(
              'hidden sm:block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
              isDragging
                ? 'border-accent bg-accent/10'
                : 'border-border hover:border-accent/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <input
              type="file"
              onChange={handleFileChange}
              accept="image/*,video/*,.pdf"
              className="hidden"
              disabled={disabled}
            />

            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-accent" />
              </div>

              <div>
                <h3 className="text-base font-medium text-text-primary mb-1">
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
                עד {formatBytes(maxSize)} · JPG, PNG, WebP, GIF, MP4, WebM, PDF
              </p>
            </div>
          </div>
        </>
      ) : activeTab === 'link' ? (
        /* Link input */
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl">
            <Link className="w-5 h-5 text-text-secondary flex-shrink-0" />
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="הזינו כתובת URL..."
              className="input flex-1 text-sm"
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
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src="/media/riddle.jpg"
                alt="כתב חידה"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-right">
              <h3 className="font-medium text-text-primary mb-1">
                כתב חידה
              </h3>
              <p className="text-xs text-text-secondary">
                דף נחיתה אינטראקטיבי עם טקסט, תמונות וסרטון
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
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Cloud className="w-6 h-6 text-accent" />
            </div>
            <div className="text-right">
              <h3 className="font-medium text-text-primary mb-1">
                ענן מילים
              </h3>
              <p className="text-xs text-text-secondary">
                ענן מילים אינטראקטיבי לאירועים עם QuizyCloud
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
      ) : activeTab === 'selfiebeam' ? (
        /* Selfiebeam creation */
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src="/media/SELFIEBEAM.jpg"
                alt="סלפי בים"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-right">
              <h3 className="font-medium text-text-primary mb-1">
                סלפי בים
              </h3>
              <p className="text-xs text-text-secondary">
                קיר סלפי לאירועים - גלריית סלפי משותפת
              </p>
            </div>
          </div>
          <button
            onClick={onSelfiebeamCreate}
            disabled={disabled}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            צור סלפי בים
          </button>
        </div>
      ) : activeTab === 'minigames' ? (
        /* Minigames - coming soon */
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Gamepad2 className="w-6 h-6 text-accent" />
            </div>
            <div className="text-right">
              <h3 className="font-medium text-text-primary mb-1">
                מיניגיימס
              </h3>
              <p className="text-xs text-text-secondary">
                5 משחקים מאתגרים עם לוח תוצאות על מסכי הענק
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
        <p className="text-sm text-danger text-center">{error}</p>
      )}
    </div>
  );
}
