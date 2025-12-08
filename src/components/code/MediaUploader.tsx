'use client';

import { Upload, Image, Video, FileText, Link, Cloud, Gamepad2, Camera } from 'lucide-react';
import { useState, useRef, DragEvent } from 'react';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';

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

  const t = useTranslations('uploader');
  const tMedia = useTranslations('media');

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
      setError(`${t('fileTooLarge')} ${formatBytes(maxSize)}`);
      return;
    }

    // Check file type
    const validTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
      'application/pdf'
    ];

    if (!validTypes.includes(file.type)) {
      setError(t('unsupportedFileType'));
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
      setError(t('invalidUrl'));
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
    icon: Icon,
    badge
  }: {
    tab: typeof activeTab;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={clsx(
        'relative flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-lg text-xs font-medium transition-all border',
        activeTab === tab
          ? 'bg-accent text-white border-accent shadow-md'
          : 'bg-white dark:bg-bg-secondary text-gray-600 dark:text-text-secondary border-gray-200 dark:border-border hover:border-accent/50 hover:text-accent'
      )}
    >
      {badge && (
        <span className="absolute -top-1.5 -right-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-sm whitespace-nowrap">
          {badge}
        </span>
      )}
      <Icon className="w-4 h-4" />
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Tab buttons - 3 columns grid */}
      {(onLinkAdd || onRiddleCreate || onWordCloudCreate) && (
        <div className="grid grid-cols-3 gap-2">
          <TabButton tab="upload" label={tMedia('image')} icon={Upload} />
          {onLinkAdd && <TabButton tab="link" label={tMedia('link')} icon={Link} />}
          {onRiddleCreate && <TabButton tab="riddle" label={tMedia('riddle')} icon={FileText} badge="XP" />}
          {onWordCloudCreate && <TabButton tab="wordcloud" label={tMedia('wordcloud')} icon={Cloud} />}
          {onSelfiebeamCreate && <TabButton tab="selfiebeam" label={tMedia('selfiebeam')} icon={Camera} />}
          <TabButton tab="minigames" label={tMedia('minigames')} icon={Gamepad2} />
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
              <div className="text-start">
                <p className="font-medium text-text-primary">{t('uploadFile')}</p>
                <p className="text-xs text-text-secondary">{t('imageVideoOrPdf')} ({t('upTo')} {formatBytes(maxSize)})</p>
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
                  {t('uploadContent')}
                </h3>
                <p className="text-sm text-text-secondary">
                  {t('dragOrClickToUpload')}
                </p>
              </div>

              <div className="flex items-center gap-4 text-text-secondary">
                <span className="flex items-center gap-1 text-xs">
                  <Image className="w-4 h-4" />
                  {t('images')}
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <Video className="w-4 h-4" />
                  {tMedia('video')}
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <FileText className="w-4 h-4" />
                  {tMedia('pdf')}
                </span>
              </div>

              <p className="text-xs text-text-secondary">
                {t('upTo')} {formatBytes(maxSize)} · JPG, PNG, WebP, GIF, MP4, WebM, PDF
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
              placeholder={t('enterUrl')}
              className="input flex-1 text-sm"
              dir="ltr"
            />
          </div>
          <button
            onClick={handleLinkSubmit}
            disabled={!linkUrl.trim()}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {t('createExperience')}
          </button>
        </div>
      ) : activeTab === 'riddle' ? (
        /* Riddle creation */
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src="/media/riddle.jpg"
                alt={tMedia('riddle')}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-start">
              <h3 className="font-medium text-text-primary mb-1">
                {tMedia('riddle')}
              </h3>
              <p className="text-xs text-text-secondary">
                {t('riddleDescription')}
              </p>
            </div>
          </div>
          <button
            onClick={onRiddleCreate}
            disabled={disabled}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {t('createRiddle')}
          </button>
        </div>
      ) : activeTab === 'wordcloud' ? (
        /* Word Cloud creation */
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Cloud className="w-6 h-6 text-accent" />
            </div>
            <div className="text-start">
              <h3 className="font-medium text-text-primary mb-1">
                {tMedia('wordcloud')}
              </h3>
              <p className="text-xs text-text-secondary">
                {t('wordCloudDescription')}
              </p>
            </div>
          </div>
          <button
            onClick={onWordCloudCreate}
            disabled={disabled}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {t('createWordCloud')}
          </button>
        </div>
      ) : activeTab === 'selfiebeam' ? (
        /* Selfiebeam creation */
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src="/media/SELFIEBEAM.jpg"
                alt={tMedia('selfiebeam')}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-start">
              <h3 className="font-medium text-text-primary mb-1">
                {tMedia('selfiebeam')}
              </h3>
              <p className="text-xs text-text-secondary">
                {t('selfiebeamDescription')}
              </p>
            </div>
          </div>
          <button
            onClick={onSelfiebeamCreate}
            disabled={disabled}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {t('createSelfiebeam')}
          </button>
        </div>
      ) : activeTab === 'minigames' ? (
        /* Minigames - coming soon */
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Gamepad2 className="w-6 h-6 text-accent" />
            </div>
            <div className="text-start">
              <h3 className="font-medium text-text-primary mb-1">
                {tMedia('minigames')}
              </h3>
              <p className="text-xs text-text-secondary">
                {t('minigamesDescription')}
              </p>
            </div>
          </div>
          <button
            disabled
            className="btn w-full bg-bg-secondary text-text-secondary cursor-not-allowed"
          >
            {t('comingSoon')}
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
