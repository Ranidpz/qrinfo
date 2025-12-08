'use client';

import { useState, useEffect, useRef } from 'react';
import { X, FileText, Plus, Trash2, ImageIcon, Youtube, Loader2, Camera, Users, Pipette } from 'lucide-react';
import { RiddleContent } from '@/types';
import DOMPurify from 'isomorphic-dompurify';
import { useTranslations } from 'next-intl';

// Format text with WhatsApp-style formatting (with XSS protection)
function formatContent(text: string): string {
  // First sanitize the input to remove any malicious HTML
  const sanitized = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
  // Then apply formatting
  const formatted = sanitized
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~([^~]+)~/g, '<del>$1</del>');
  // Sanitize again to ensure only our tags are present
  return DOMPurify.sanitize(formatted, { ALLOWED_TAGS: ['strong', 'em', 'del'] });
}

interface RiddleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: RiddleContent, imageFiles: File[]) => Promise<void>;
  loading?: boolean;
  initialContent?: RiddleContent;
}

// Preset color palettes - 6 colors each
const backgroundColors = [
  '#1a1a2e', // Dark blue
  '#1a1a1a', // Almost black
  '#ffffff', // White
  '#fef3c7', // Cream
  '#dbeafe', // Light blue
  '#fce7f3', // Pink
];

const textColors = [
  '#ffffff', // White
  '#1a1a1a', // Almost black
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#ef4444', // Red
  '#8b5cf6', // Purple
];

export default function RiddleModal({
  isOpen,
  onClose,
  onSave,
  loading = false,
  initialContent,
}: RiddleModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#1a1a2e');
  const [textColor, setTextColor] = useState('#ffffff');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [customBgColor, setCustomBgColor] = useState('');
  const [customTextColor, setCustomTextColor] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]); // Track existing images that weren't deleted
  const [galleryEnabled, setGalleryEnabled] = useState(false);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = useTranslations('modals');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (isOpen) {
      if (initialContent) {
        setTitle(initialContent.title);
        setContent(initialContent.content);
        setBackgroundColor(initialContent.backgroundColor);
        setTextColor(initialContent.textColor);
        setYoutubeUrl(initialContent.youtubeUrl || '');
        // For existing images, we show them as previews and track them
        setImagePreviews(initialContent.images || []);
        setExistingImages(initialContent.images || []);
        setGalleryEnabled(initialContent.galleryEnabled || false);
        setAllowAnonymous(initialContent.allowAnonymous ?? true);
      } else {
        setTitle('');
        setContent('');
        setBackgroundColor('#1a1a2e');
        setTextColor('#ffffff');
        setYoutubeUrl('');
        setImagePreviews([]);
        setExistingImages([]);
        setGalleryEnabled(false);
        setAllowAnonymous(true);
      }
      setImageFiles([]);
      setError('');
      setCustomBgColor('');
      setCustomTextColor('');
    }
  }, [isOpen, initialContent]);

  // Generate previews for newly added files
  useEffect(() => {
    const newPreviews: string[] = [];

    imageFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      newPreviews.push(url);
    });

    setImagePreviews([...existingImages, ...newPreviews]);

    return () => {
      newPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageFiles, existingImages]);

  if (!isOpen) return null;

  const handleAddImages = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter((file) =>
      file.type.startsWith('image/')
    );
    setImageFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveImage = (index: number) => {
    const existingCount = existingImages.length;
    if (index < existingCount) {
      // Removing an existing image - update existingImages state
      setExistingImages((prev) => prev.filter((_, i) => i !== index));
    } else {
      // Removing a newly added file
      const fileIndex = index - existingCount;
      setImageFiles((prev) => prev.filter((_, i) => i !== fileIndex));
    }
  };

  const extractYoutubeId = (url: string): string | null => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError(t('riddleTitleRequired'));
      return;
    }

    if (youtubeUrl && !extractYoutubeId(youtubeUrl)) {
      setError(t('riddleYoutubeError'));
      return;
    }

    const riddleContent: RiddleContent = {
      title: title.trim(),
      content: content.trim(),
      backgroundColor,
      textColor,
      youtubeUrl: youtubeUrl.trim() || undefined,
      images: existingImages, // Use the tracked existing images (after deletions)
      galleryEnabled,
      allowAnonymous,
    };

    await onSave(riddleContent, imageFiles);
  };

  const youtubeId = extractYoutubeId(youtubeUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            {t('riddle')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error */}
          {error && (
            <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              {t('riddleTitle')} <span className="text-danger">{t('required')}</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
              placeholder={t('riddleEnterTitle')}
              className="input w-full"
              autoFocus
            />
          </div>

          {/* Color Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Background Color */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                {t('riddleBackgroundColor')}
              </label>
              <div className="flex items-center gap-2">
                {backgroundColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setBackgroundColor(color);
                      setCustomBgColor('');
                    }}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      backgroundColor === color && !customBgColor
                        ? 'border-accent scale-110'
                        : 'border-border hover:border-text-secondary'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                {/* Custom Color Picker */}
                <label
                  className={`relative w-8 h-8 rounded-lg border-2 cursor-pointer flex items-center justify-center transition-all ${
                    customBgColor && !backgroundColors.includes(backgroundColor)
                      ? 'border-accent scale-110'
                      : 'border-border hover:border-text-secondary'
                  }`}
                  style={{ backgroundColor: customBgColor || '#e5e5e5' }}
                >
                  <Pipette className="w-4 h-4 text-text-secondary" />
                  <input
                    type="color"
                    value={customBgColor || backgroundColor}
                    onChange={(e) => {
                      setCustomBgColor(e.target.value);
                      setBackgroundColor(e.target.value);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Text Color */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                {t('riddleTextColor')}
              </label>
              <div className="flex items-center gap-2">
                {textColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setTextColor(color);
                      setCustomTextColor('');
                    }}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      textColor === color && !customTextColor
                        ? 'border-accent scale-110'
                        : 'border-border hover:border-text-secondary'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                {/* Custom Color Picker */}
                <label
                  className={`relative w-8 h-8 rounded-lg border-2 cursor-pointer flex items-center justify-center transition-all ${
                    customTextColor && !textColors.includes(textColor)
                      ? 'border-accent scale-110'
                      : 'border-border hover:border-text-secondary'
                  }`}
                  style={{ backgroundColor: customTextColor || '#e5e5e5' }}
                >
                  <Pipette className="w-4 h-4 text-text-secondary" />
                  <input
                    type="color"
                    value={customTextColor || textColor}
                    onChange={(e) => {
                      setCustomTextColor(e.target.value);
                      setTextColor(e.target.value);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Content Textarea */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              {t('riddleContent')}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('riddleContentPlaceholder')}
              className="input w-full min-h-[150px] resize-y"
              rows={6}
            />
            <p className="text-xs text-text-secondary">
              {t('riddleWhatsappFormatting')}
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              {t('riddlePreview')}
            </label>
            <div
              className="rounded-xl p-6 min-h-[120px]"
              style={{ backgroundColor }}
            >
              <h3
                className="text-xl font-bold mb-3"
                style={{ color: textColor }}
              >
                {title || t('riddleTitlePlaceholder')}
              </h3>
              <p
                className="whitespace-pre-wrap"
                style={{ color: textColor }}
                dangerouslySetInnerHTML={{
                  __html: formatContent(content || t('riddleContentPreviewPlaceholder')),
                }}
              />
            </div>
          </div>

          {/* YouTube URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary flex items-center gap-2">
              <Youtube className="w-4 h-4 text-red-500" />
              {t('riddleYoutube')}
              <span className="text-text-secondary font-normal">({t('optional')})</span>
            </label>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                setError('');
              }}
              placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
              className="input w-full"
              dir="ltr"
            />
            {youtubeId && (
              <div className="mt-2 rounded-lg overflow-hidden aspect-video bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>

          {/* Images */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-accent" />
              {t('riddleImages')}
              <span className="text-text-secondary font-normal">({t('optional')})</span>
            </label>

            {/* Image Grid */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {imagePreviews.map((preview, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-lg overflow-hidden bg-bg-secondary"
                  >
                    <img
                      src={preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 end-1 p-1 rounded-full bg-danger text-white hover:bg-danger/80 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Images Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-lg text-text-secondary hover:border-accent hover:text-accent transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('riddleAddImages')}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleAddImages(e.target.files)}
            />
            <p className="text-xs text-text-secondary">
              {t('riddleImagesSaved')}
            </p>
          </div>

          {/* Gallery Settings */}
          <div className="space-y-3 p-4 bg-bg-secondary rounded-xl">
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 text-accent" />
              <h3 className="font-medium text-text-primary">{t('riddleSelfieGallery')}</h3>
            </div>

            {/* Enable Gallery Toggle */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-text-secondary">
                {t('riddleAllowSelfie')}
              </span>
              <button
                type="button"
                onClick={() => setGalleryEnabled(!galleryEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  galleryEnabled ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                    galleryEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </label>

            {/* Allow Anonymous Option */}
            {galleryEnabled && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAnonymous}
                  onChange={(e) => setAllowAnonymous(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                />
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm text-text-secondary">
                    {t('riddleAllowAnonymous')}
                  </span>
                </div>
              </label>
            )}

            {galleryEnabled && (
              <p className="text-xs text-text-secondary whitespace-pre-line">
                {t('riddleSelfieDescription')}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 bg-bg-card border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover disabled:opacity-50"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !title.trim()}
            className="btn bg-accent text-white hover:bg-accent-hover disabled:opacity-50 min-w-[100px]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              tCommon('save')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
