'use client';

import { useState, useEffect, useRef } from 'react';
import { X, FileText, Plus, Trash2, ImageIcon, Youtube, Loader2 } from 'lucide-react';
import { RiddleContent } from '@/types';

interface RiddleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: RiddleContent, imageFiles: File[]) => Promise<void>;
  loading?: boolean;
  initialContent?: RiddleContent;
}

// Preset color palettes
const backgroundColors = [
  '#1a1a2e', // Dark blue
  '#16213e', // Navy
  '#0f3460', // Deep blue
  '#1e3a5f', // Ocean
  '#1a1a1a', // Almost black
  '#2d2d2d', // Dark gray
  '#3d3d3d', // Gray
  '#4a4a4a', // Medium gray
  '#f5f5f5', // Light gray
  '#ffffff', // White
  '#fef3c7', // Cream
  '#dbeafe', // Light blue
  '#d1fae5', // Mint
  '#fce7f3', // Pink
  '#f3e8ff', // Lavender
  '#fed7aa', // Peach
];

const textColors = [
  '#ffffff', // White
  '#f8f8f8', // Off-white
  '#e5e5e5', // Light gray
  '#a0a0a0', // Gray
  '#1a1a1a', // Almost black
  '#000000', // Black
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
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
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialContent) {
        setTitle(initialContent.title);
        setContent(initialContent.content);
        setBackgroundColor(initialContent.backgroundColor);
        setTextColor(initialContent.textColor);
        setYoutubeUrl(initialContent.youtubeUrl || '');
        // For existing images, we show them as previews
        setImagePreviews(initialContent.images || []);
      } else {
        setTitle('');
        setContent('');
        setBackgroundColor('#1a1a2e');
        setTextColor('#ffffff');
        setYoutubeUrl('');
        setImagePreviews([]);
      }
      setImageFiles([]);
      setError('');
      setCustomBgColor('');
      setCustomTextColor('');
    }
  }, [isOpen, initialContent]);

  // Generate previews for newly added files
  useEffect(() => {
    const existingPreviews = initialContent?.images || [];
    const newPreviews: string[] = [];

    imageFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      newPreviews.push(url);
    });

    setImagePreviews([...existingPreviews, ...newPreviews]);

    return () => {
      newPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageFiles, initialContent?.images]);

  if (!isOpen) return null;

  const handleAddImages = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter((file) =>
      file.type.startsWith('image/')
    );
    setImageFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveImage = (index: number) => {
    const existingCount = initialContent?.images?.length || 0;
    if (index < existingCount) {
      // Removing an existing image (from initialContent)
      // We'll handle this by keeping track of which to remove
      const newExisting = [...(initialContent?.images || [])];
      newExisting.splice(index, 1);
      setImagePreviews([...newExisting, ...imageFiles.map((f) => URL.createObjectURL(f))]);
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
      setError('יש להזין כותרת');
      return;
    }

    if (youtubeUrl && !extractYoutubeId(youtubeUrl)) {
      setError('כתובת יוטיוב אינה תקינה');
      return;
    }

    const riddleContent: RiddleContent = {
      title: title.trim(),
      content: content.trim(),
      backgroundColor,
      textColor,
      youtubeUrl: youtubeUrl.trim() || undefined,
      images: initialContent?.images || [],
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
            כתב חידה
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
              כותרת <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
              placeholder="הזן כותרת לדף..."
              className="input w-full"
              autoFocus
            />
          </div>

          {/* Color Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Background Color */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                צבע רקע
              </label>
              <div className="flex flex-wrap gap-2">
                {backgroundColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setBackgroundColor(color)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      backgroundColor === color
                        ? 'border-accent scale-110'
                        : 'border-transparent hover:border-border'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={customBgColor || backgroundColor}
                  onChange={(e) => {
                    setCustomBgColor(e.target.value);
                    setBackgroundColor(e.target.value);
                  }}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  placeholder="#000000"
                  className="input flex-1 text-xs"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Text Color */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                צבע טקסט
              </label>
              <div className="flex flex-wrap gap-2">
                {textColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setTextColor(color)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      textColor === color
                        ? 'border-accent scale-110'
                        : 'border-transparent hover:border-border'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={customTextColor || textColor}
                  onChange={(e) => {
                    setCustomTextColor(e.target.value);
                    setTextColor(e.target.value);
                  }}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  placeholder="#ffffff"
                  className="input flex-1 text-xs"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Content Textarea */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              תוכן
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="הזן את תוכן ההודעה...&#10;&#10;תומך בעיצוב:&#10;*טקסט מודגש*&#10;_טקסט נטוי_&#10;~טקסט מחוק~"
              className="input w-full min-h-[150px] resize-y"
              rows={6}
            />
            <p className="text-xs text-text-secondary">
              תומך בעיצוב WhatsApp: *מודגש* | _נטוי_ | ~מחוק~
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              תצוגה מקדימה
            </label>
            <div
              className="rounded-xl p-6 min-h-[120px]"
              style={{ backgroundColor }}
            >
              <h3
                className="text-xl font-bold mb-3"
                style={{ color: textColor }}
              >
                {title || 'כותרת'}
              </h3>
              <p
                className="whitespace-pre-wrap"
                style={{ color: textColor }}
                dangerouslySetInnerHTML={{
                  __html: (content || 'תוכן ההודעה יופיע כאן...')
                    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
                    .replace(/_([^_]+)_/g, '<em>$1</em>')
                    .replace(/~([^~]+)~/g, '<del>$1</del>'),
                }}
              />
            </div>
          </div>

          {/* YouTube URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary flex items-center gap-2">
              <Youtube className="w-4 h-4 text-red-500" />
              סרטון יוטיוב
              <span className="text-text-secondary font-normal">(אופציונלי)</span>
            </label>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                setError('');
              }}
              placeholder="https://youtube.com/watch?v=... או https://youtu.be/..."
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
              תמונות
              <span className="text-text-secondary font-normal">(אופציונלי)</span>
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
                      className="absolute top-1 right-1 p-1 rounded-full bg-danger text-white hover:bg-danger/80 transition-colors"
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
              <span>הוסף תמונות</span>
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
              התמונות יישמרו בספריית התמונות וייספרו באחסון שלך
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 bg-bg-card border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !title.trim()}
            className="btn bg-accent text-white hover:bg-accent-hover disabled:opacity-50 min-w-[100px]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'שמור'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
