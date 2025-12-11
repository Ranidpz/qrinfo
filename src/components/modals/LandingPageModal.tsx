'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Palette,
  Check,
  Upload,
  Trash2,
  Smartphone,
  Image as ImageIcon,
  Images,
  Video,
  FileText,
  ExternalLink,
  ScrollText,
  Cloud,
  Camera,
  Vote,
  CalendarDays,
  File as FileIcon,
  Type,
  Sparkles,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { LandingPageConfig, MediaItem, DEFAULT_LANDING_PAGE_CONFIG } from '@/types';
import { groupMediaForLandingPage, LandingPageButton } from '@/lib/landingPage';
import LandingPageViewer from '@/components/viewer/LandingPageViewer';

// Icon mapping - same as LandingPageViewer
const IconMap: Record<string, React.FC<{ className?: string }>> = {
  Image: ImageIcon,
  Images: Images,
  Video: Video,
  FileText: FileText,
  ExternalLink: ExternalLink,
  ScrollText: ScrollText,
  Cloud: Cloud,
  Camera: Camera,
  Vote: Vote,
  CalendarDays: CalendarDays,
  File: FileIcon,
};

// Get icon component from icon name
function getIconComponent(iconName: string): React.FC<{ className?: string }> {
  return IconMap[iconName] || FileIcon;
}

// Glassmorphism dark colors for visual identification
const GLASSMORPHISM_COLORS = ['#1a1a2e', '#0f172a', '#16213e', '#1e293b', '#27272a'];

// Color picker component
function ColorPicker({
  colors,
  value,
  onChange,
  label,
  allowCustom = true,
}: {
  colors: string[];
  value: string;
  onChange: (color: string) => void;
  label: string;
  allowCustom?: boolean;
}) {
  const [customColor, setCustomColor] = useState('');

  const isGlassmorphism = (color: string) =>
    GLASSMORPHISM_COLORS.includes(color.toLowerCase());

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-text-primary">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => {
              onChange(color);
              setCustomColor('');
            }}
            className={`relative w-8 h-8 rounded-lg border-2 transition-all ${
              value === color && !customColor
                ? 'border-accent scale-110'
                : 'border-border hover:border-text-secondary'
            }`}
            style={{ backgroundColor: color }}
            title={isGlassmorphism(color) ? `${color} (Glass)` : color}
          >
            {isGlassmorphism(color) && (
              <Sparkles className="absolute inset-0 m-auto w-4 h-4 text-white/70" />
            )}
          </button>
        ))}
        {allowCustom && (
          <label className="relative w-8 h-8 rounded-lg border-2 border-border hover:border-text-secondary cursor-pointer flex items-center justify-center bg-bg-secondary transition-all">
            <Palette className="w-4 h-4 text-text-secondary" />
            <input
              type="color"
              value={customColor || value}
              onChange={(e) => {
                setCustomColor(e.target.value);
                onChange(e.target.value);
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
        )}
      </div>
    </div>
  );
}

interface LandingPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: LandingPageConfig, backgroundImageFile?: File) => Promise<void>;
  loading?: boolean;
  initialConfig?: LandingPageConfig;
  shortId?: string;
  mediaItems: MediaItem[];
}

export default function LandingPageModal({
  isOpen,
  onClose,
  onSave,
  loading,
  initialConfig,
  shortId,
  mediaItems,
}: LandingPageModalProps) {
  const t = useTranslations('code');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isRTL = locale === 'he';

  // State
  const [config, setConfig] = useState<LandingPageConfig>(DEFAULT_LANDING_PAGE_CONFIG);
  const [backgroundImageFile, setBackgroundImageFile] = useState<File | null>(null);
  const [backgroundImagePreview, setBackgroundImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Initialize config
  useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        setConfig(initialConfig);
        if (initialConfig.backgroundImageUrl) {
          setBackgroundImagePreview(initialConfig.backgroundImageUrl);
        }
      } else {
        setConfig(DEFAULT_LANDING_PAGE_CONFIG);
        setBackgroundImagePreview(null);
      }
      setBackgroundImageFile(null);
      setSaved(false);
    }
  }, [isOpen, initialConfig]);

  // Auto-dismiss saved message
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  // Image compression
  const compressImage = useCallback(
    async (file: File, maxSizeKB: number = 800): Promise<Blob> => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = await createImageBitmap(file);

      // Resize to max 1920px
      const maxDim = 1920;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Binary search for optimal quality
      let minQ = 0.1,
        maxQ = 0.95;
      let blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/webp', 0.8)
      );

      const targetBytes = maxSizeKB * 1024;
      for (let i = 0; i < 5; i++) {
        const quality = (minQ + maxQ) / 2;
        blob = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b!), 'image/webp', quality)
        );
        if (blob.size <= targetBytes) {
          minQ = quality;
        } else {
          maxQ = quality;
        }
      }

      return blob;
    },
    []
  );

  // Process image
  const processImage = useCallback(
    async (file: File) => {
      try {
        const compressed = await compressImage(file);
        const previewUrl = URL.createObjectURL(compressed);
        setBackgroundImagePreview(previewUrl);
        setBackgroundImageFile(new File([compressed], 'landing-bg.webp', { type: 'image/webp' }));
      } catch (error) {
        console.error('Error processing image:', error);
      }
    },
    [compressImage]
  );

  // Handle image drop
  const handleImageDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        processImage(file);
      }
    },
    [processImage]
  );

  // Handle file input
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
        processImage(file);
      }
    },
    [processImage]
  );

  // Remove background image
  const removeBackgroundImage = useCallback(() => {
    if (backgroundImagePreview && !backgroundImagePreview.startsWith('http')) {
      URL.revokeObjectURL(backgroundImagePreview);
    }
    setBackgroundImagePreview(null);
    setBackgroundImageFile(null);
    setConfig((prev) => ({ ...prev, backgroundImageUrl: undefined }));
  }, [backgroundImagePreview]);

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(config, backgroundImageFile || undefined);
      setSaved(true);
    } catch (error) {
      console.error('Error saving landing page config:', error);
    } finally {
      setSaving(false);
    }
  };

  // Preview buttons
  const previewButtons = useMemo(() => {
    return groupMediaForLandingPage(mediaItems, locale as 'he' | 'en');
  }, [mediaItems, locale]);

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div className="bg-bg-primary rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-xl font-bold text-text-primary">
              {isRTL ? 'עמוד נחיתה' : 'Landing Page'}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-secondary hover:bg-bg-hover text-text-primary transition-colors"
              >
                <Smartphone className="w-4 h-4" />
                {isRTL ? 'תצוגה מקדימה' : 'Preview'}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="flex gap-6">
              {/* Settings */}
              <div className="flex-1 space-y-6">
                {/* Enable toggle */}
                <div className="flex items-center justify-between bg-bg-secondary rounded-xl p-4">
                  <div>
                    <h3 className="font-medium text-text-primary">
                      {isRTL ? 'הפעל עמוד נחיתה' : 'Enable Landing Page'}
                    </h3>
                    <p className="text-sm text-text-secondary mt-1">
                      {isRTL
                        ? 'הצג עמוד עם כפתורים במקום גלילה'
                        : 'Show page with buttons instead of swiper'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                    className={`relative w-14 h-8 rounded-full transition-colors ${
                      config.enabled ? 'bg-accent' : 'bg-bg-hover'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
                        config.enabled
                          ? isRTL
                            ? 'start-1'
                            : 'start-7'
                          : isRTL
                          ? 'start-7'
                          : 'start-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Content Section */}
                <div className="space-y-4">
                  <h3 className="font-medium text-text-primary">
                    {isRTL ? 'תוכן' : 'Content'}
                  </h3>

                  <div>
                    <label className="text-sm font-medium text-text-primary block mb-2">
                      {isRTL ? 'כותרת' : 'Title'}
                    </label>
                    <input
                      type="text"
                      value={config.title || ''}
                      onChange={(e) => setConfig({ ...config, title: e.target.value })}
                      placeholder={isRTL ? 'הכניסו כותרת...' : 'Enter title...'}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-text-primary block mb-2">
                      {isRTL ? 'כותרת משנה' : 'Subtitle'}
                    </label>
                    <input
                      type="text"
                      value={config.subtitle || ''}
                      onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                      placeholder={isRTL ? 'כותרת משנה (אופציונלי)...' : 'Subtitle (optional)...'}
                      className="input w-full"
                    />
                  </div>

                  {/* Button Titles - inline in Content section */}
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Type className="w-4 h-4 text-text-secondary" />
                      <span className="text-sm font-medium text-text-primary">
                        {isRTL ? 'כותרות כפתורים' : 'Button Titles'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {previewButtons.map((button) => {
                        const Icon = getIconComponent(button.icon);
                        const customTitle = config.buttonTitles?.[button.id] || '';
                        return (
                          <div
                            key={button.id}
                            className="flex items-center gap-2 bg-bg-secondary rounded-lg p-2"
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: config.buttonColor, color: config.buttonTextColor }}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <input
                              type="text"
                              value={customTitle}
                              onChange={(e) => {
                                const newTitles = { ...config.buttonTitles };
                                if (e.target.value) {
                                  newTitles[button.id] = e.target.value;
                                } else {
                                  delete newTitles[button.id];
                                }
                                setConfig({ ...config, buttonTitles: newTitles });
                              }}
                              placeholder={button.title}
                              className="input flex-1 text-sm py-1.5"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Background Section */}
                <div className="space-y-4">
                  <h3 className="font-medium text-text-primary">
                    {isRTL ? 'רקע' : 'Background'}
                  </h3>

                  {/* Background Image Upload */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                    }}
                    onDrop={handleImageDrop}
                    className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                      isDragging
                        ? 'border-accent bg-accent/10 scale-[1.02]'
                        : 'border-border hover:border-text-secondary'
                    }`}
                  >
                    {backgroundImagePreview ? (
                      <div className="relative">
                        <img
                          src={backgroundImagePreview}
                          alt="Background"
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          onClick={removeBackgroundImage}
                          className="absolute top-2 end-2 p-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <Upload className="w-8 h-8 mx-auto text-text-secondary mb-2" />
                        <p className="text-sm text-text-secondary">
                          {isRTL ? 'גרור תמונה או לחץ להעלאה' : 'Drag image or click to upload'}
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileInput}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Background Options */}
                  {backgroundImagePreview && (
                    <div className="space-y-4">
                      <label className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">
                          {isRTL ? 'טשטוש רקע' : 'Blur Background'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setConfig({ ...config, backgroundBlur: !config.backgroundBlur })
                          }
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            config.backgroundBlur ? 'bg-accent' : 'bg-bg-hover'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                              config.backgroundBlur
                                ? isRTL
                                  ? 'start-0.5'
                                  : 'start-[22px]'
                                : isRTL
                                ? 'start-[22px]'
                                : 'start-0.5'
                            }`}
                          />
                        </button>
                      </label>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-text-primary">
                            {isRTL ? 'כיסוי כהה' : 'Dark Overlay'}
                          </span>
                          <span className="text-xs text-text-secondary">
                            {config.imageOverlayOpacity ?? 40}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="80"
                          step="5"
                          value={config.imageOverlayOpacity ?? 40}
                          onChange={(e) =>
                            setConfig({ ...config, imageOverlayOpacity: parseInt(e.target.value) })
                          }
                          className="w-full h-2 bg-bg-hover rounded-lg appearance-none cursor-pointer accent-accent"
                        />
                      </div>
                    </div>
                  )}

                  {/* Background Color */}
                  <ColorPicker
                    colors={['#1a1a2e', '#0f172a', '#16213e', '#1e293b', '#27272a', '#1e3a5f', '#312e81', '#ffffff', '#dbeafe', '#fef3c7']}
                    value={config.backgroundColor}
                    onChange={(color) => setConfig({ ...config, backgroundColor: color })}
                    label={isRTL ? 'צבע רקע' : 'Background Color'}
                  />
                </div>

                {/* Button Styling */}
                <div className="space-y-4">
                  <h3 className="font-medium text-text-primary">
                    {isRTL ? 'עיצוב כפתורים' : 'Button Styling'}
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <ColorPicker
                      colors={['#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#f59e0b', '#1a1a2e', '#16213e', '#27272a']}
                      value={config.buttonColor}
                      onChange={(color) => setConfig({ ...config, buttonColor: color })}
                      label={isRTL ? 'צבע כפתור' : 'Button Color'}
                    />

                    <ColorPicker
                      colors={['#ffffff', '#1f2937', '#fbbf24', '#fef3c7', '#fce7f3']}
                      value={config.buttonTextColor}
                      onChange={(color) => setConfig({ ...config, buttonTextColor: color })}
                      label={isRTL ? 'צבע טקסט' : 'Text Color'}
                    />
                  </div>

                  {/* Button Style */}
                  <div>
                    <label className="text-sm font-medium text-text-primary block mb-2">
                      {isRTL ? 'סגנון כפתור' : 'Button Style'}
                    </label>
                    <div className="flex gap-2">
                      {(['solid', 'outline', 'glass'] as const).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setConfig({ ...config, buttonStyle: style })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            config.buttonStyle === style
                              ? 'bg-accent text-white'
                              : 'bg-bg-secondary text-text-primary hover:bg-bg-hover'
                          }`}
                        >
                          {style === 'solid'
                            ? isRTL
                              ? 'מלא'
                              : 'Solid'
                            : style === 'outline'
                            ? isRTL
                              ? 'מתאר'
                              : 'Outline'
                            : isRTL
                            ? 'זכוכית'
                            : 'Glass'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Button Layout */}
                  <div>
                    <label className="text-sm font-medium text-text-primary block mb-2">
                      {isRTL ? 'פריסה' : 'Layout'}
                    </label>
                    <div className="flex gap-2">
                      {(['list', 'grid'] as const).map((layout) => (
                        <button
                          key={layout}
                          type="button"
                          onClick={() => setConfig({ ...config, buttonLayout: layout })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            config.buttonLayout === layout
                              ? 'bg-accent text-white'
                              : 'bg-bg-secondary text-text-primary hover:bg-bg-hover'
                          }`}
                        >
                          {layout === 'list'
                            ? isRTL
                              ? 'רשימה'
                              : 'List'
                            : isRTL
                            ? 'רשת'
                            : 'Grid'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Panel */}
              <div className="hidden lg:block w-[320px] flex-shrink-0">
                <div className="sticky top-0">
                  <h3 className="text-sm font-medium text-text-primary mb-3">
                    {isRTL ? 'תצוגה מקדימה' : 'Preview'}
                  </h3>
                  <div className="relative bg-gray-900 rounded-[2.5rem] p-2 shadow-xl">
                    {/* Phone frame */}
                    <div className="relative w-full h-[540px] overflow-hidden rounded-[2rem] bg-black">
                      {/* Preview content */}
                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={{ backgroundColor: config.backgroundColor }}
                      >
                        {/* Background image */}
                        {backgroundImagePreview && (
                          <>
                            <div
                              className={`absolute inset-0 bg-cover bg-center ${
                                config.backgroundBlur ? 'blur-md scale-105' : ''
                              }`}
                              style={{
                                backgroundImage: `url(${backgroundImagePreview})`,
                              }}
                            />
                            {(config.imageOverlayOpacity ?? 40) > 0 && (
                              <div
                                className="absolute inset-0"
                                style={{
                                  backgroundColor: `rgba(0, 0, 0, ${
                                    (config.imageOverlayOpacity ?? 40) / 100
                                  })`,
                                }}
                              />
                            )}
                          </>
                        )}

                        {/* Content preview */}
                        <div className="relative z-10 h-full flex flex-col p-4">
                          {/* Title */}
                          {config.title && (
                            <h2
                              className="text-lg font-bold text-center mb-1"
                              style={{ color: config.buttonTextColor }}
                            >
                              {config.title}
                            </h2>
                          )}
                          {config.subtitle && (
                            <p
                              className="text-xs text-center opacity-70 mb-4"
                              style={{ color: config.buttonTextColor }}
                            >
                              {config.subtitle}
                            </p>
                          )}

                          {/* Buttons preview */}
                          <div className="flex-1 flex flex-col justify-center">
                            <div
                              className={
                                config.buttonLayout === 'grid'
                                  ? 'grid grid-cols-2 gap-2'
                                  : 'flex flex-col gap-2'
                              }
                            >
                              {previewButtons.slice(0, 4).map((button, index) => (
                                <div
                                  key={button.id}
                                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${
                                    config.buttonStyle === 'outline'
                                      ? 'border-2 bg-transparent'
                                      : config.buttonStyle === 'glass'
                                      ? 'backdrop-blur bg-white/10 border border-white/20'
                                      : ''
                                  }`}
                                  style={{
                                    backgroundColor:
                                      config.buttonStyle === 'outline' ||
                                      config.buttonStyle === 'glass'
                                        ? 'transparent'
                                        : config.buttonColor,
                                    borderColor:
                                      config.buttonStyle === 'outline'
                                        ? config.buttonColor
                                        : undefined,
                                    color: config.buttonTextColor,
                                  }}
                                >
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/20"
                                    style={
                                      config.buttonStyle === 'outline'
                                        ? { backgroundColor: `${config.buttonColor}30` }
                                        : undefined
                                    }
                                  >
                                    {(() => {
                                      const Icon = getIconComponent(button.icon);
                                      return <Icon className="w-4 h-4" />;
                                    })()}
                                  </div>
                                  <span className="text-sm font-medium truncate flex-1">
                                    {config.buttonTitles?.[button.id] || button.title}
                                  </span>
                                </div>
                              ))}
                              {previewButtons.length > 4 && (
                                <div
                                  className="text-center text-xs opacity-50 py-2"
                                  style={{ color: config.buttonTextColor }}
                                >
                                  +{previewButtons.length - 4} {isRTL ? 'עוד' : 'more'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            {saved ? (
              <p className="text-sm text-success flex items-center gap-2">
                <Check className="w-4 h-4" />
                {isRTL ? 'נשמר בהצלחה!' : 'Saved successfully!'}
              </p>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-bg-secondary hover:bg-bg-hover text-text-primary transition-colors"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="px-6 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50"
              >
                {saving ? (isRTL ? 'שומר...' : 'Saving...') : tCommon('save')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
          <div className="relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-white">
                <Smartphone className="w-5 h-5" />
                <span>{isRTL ? 'תצוגה מקדימה במובייל' : 'Mobile Preview'}</span>
                <span className="text-white/50 mx-2">|</span>
                <a
                  href={shortId ? `/v/${shortId}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-accent hover:underline"
                >
                  {isRTL ? 'פתח בחלון חדש' : 'Open in new tab'}
                </a>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Phone frame */}
            <div className="relative bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
              <div className="relative w-[375px] h-[700px] overflow-hidden rounded-[2.3rem] bg-black">
                <LandingPageViewer
                  config={{
                    ...config,
                    backgroundImageUrl: backgroundImagePreview || config.backgroundImageUrl,
                  }}
                  media={mediaItems}
                  title=""
                  codeId=""
                  shortId=""
                  ownerId=""
                  onOpenViewer={() => {}}
                />
              </div>
              {/* Pagination dots */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                <span className="w-2 h-2 rounded-full bg-white" />
                <span className="w-2 h-2 rounded-full bg-white/30" />
                <span className="w-2 h-2 rounded-full bg-white/30" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
