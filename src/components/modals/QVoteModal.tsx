'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Vote, Loader2, Plus, Trash2, GripVertical, Pipette, ImageIcon, Settings, Sparkles, Palette, Eye } from 'lucide-react';
import MobilePreviewModal from './MobilePreviewModal';
import { useTranslations, useLocale } from 'next-intl';
import {
  QVoteConfig,
  QVoteFormField,
  QVoteCategory,
  QVoteBranding,
  QVotePhase,
  QVoteMessages,
  DEFAULT_QVOTE_CONFIG,
} from '@/types/qvote';

// Image file info type
interface ImageFileInfo {
  name: string;
  originalSize: number;
  compressedSize: number;
}

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Compress image to WebP with max 800KB target
async function compressImage(file: File, maxSizeKB: number = 800): Promise<{ blob: Blob; originalSize: number; compressedSize: number }> {
  const originalSize = file.size;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Try createImageBitmap first, fall back to Image element for broader format support
  let img: ImageBitmap | HTMLImageElement;
  try {
    img = await createImageBitmap(file);
  } catch {
    // Fallback: use Image element (supports more formats in some browsers)
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load image'));
      image.src = URL.createObjectURL(file);
    });
  }

  // Calculate dimensions - max 1920px for any dimension
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

  // Try different quality levels to hit target size
  const targetBytes = maxSizeKB * 1024;
  let quality = 0.85;
  let blob: Blob | null = null;

  // Binary search for optimal quality
  let minQ = 0.1;
  let maxQ = 0.95;

  for (let i = 0; i < 5; i++) {
    blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/webp', quality);
    });

    if (blob.size <= targetBytes) {
      minQ = quality;
    } else {
      maxQ = quality;
    }
    quality = (minQ + maxQ) / 2;
  }

  // Final compression with best found quality
  blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/webp', Math.min(maxQ, 0.9));
  });

  return { blob: blob!, originalSize, compressedSize: blob!.size };
}

interface QVoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: QVoteConfig, landingImageFile?: File) => Promise<void>;
  loading?: boolean;
  initialConfig?: QVoteConfig;
  shortId?: string;
}

// Preset colors for branding (including glassmorphism dark colors)
const presetColors = {
  background: ['#ffffff', '#1a1a2e', '#0f172a', '#16213e', '#1e293b', '#27272a', '#fef3c7', '#dbeafe'],
  text: ['#1f2937', '#ffffff', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#fbbf24'],
  button: ['#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#f59e0b', '#1a1a2e', '#16213e', '#27272a'],
};

export default function QVoteModal({
  isOpen,
  onClose,
  onSave,
  loading = false,
  initialConfig,
  shortId,
}: QVoteModalProps) {
  const t = useTranslations('modals');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isRTL = locale === 'he';

  // Tab state - branding is default
  const [activeTab, setActiveTab] = useState<'basic' | 'form' | 'branding' | 'advanced'>('branding');

  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);

  // Basic settings
  const [title, setTitle] = useState('');
  const [maxPhotosPerCandidate, setMaxPhotosPerCandidate] = useState(3);
  const [maxSelectionsPerVoter, setMaxSelectionsPerVoter] = useState(3);
  const [showVoteCount, setShowVoteCount] = useState(false);
  const [showNames, setShowNames] = useState(true);
  const [enableCropping, setEnableCropping] = useState(true);
  const [allowSelfRegistration, setAllowSelfRegistration] = useState(true);
  const [enableFinals, setEnableFinals] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<QVotePhase>('registration');

  // Button texts per phase (with defaults)
  const defaultButtonTexts = {
    registration: isRTL ? 'להרשמה' : 'Register',
    preparation: isRTL ? 'מכינים...' : 'Preparing...',
    voting: isRTL ? 'להצבעה' : 'Vote Now',
    finals: isRTL ? 'לשלב הגמר' : 'Finals',
  };
  const [buttonTexts, setButtonTexts] = useState<Record<string, string>>(defaultButtonTexts);

  // Form fields
  const [formFields, setFormFields] = useState<QVoteFormField[]>([]);

  // Categories
  const [categories, setCategories] = useState<QVoteCategory[]>([]);

  // Branding
  const [branding, setBranding] = useState<QVoteBranding>(DEFAULT_QVOTE_CONFIG.branding);
  const [landingImageFile, setLandingImageFile] = useState<File | null>(null);
  const [landingImagePreview, setLandingImagePreview] = useState<string | null>(null);
  const [landingImageInfo, setLandingImageInfo] = useState<ImageFileInfo | null>(null);
  const [isDraggingLandingImage, setIsDraggingLandingImage] = useState(false);
  const [isCompressingLanding, setIsCompressingLanding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gamification
  const [gamificationEnabled, setGamificationEnabled] = useState(false);
  const [xpPerVote, setXpPerVote] = useState(10);
  const [xpForPackThreshold, setXpForPackThreshold] = useState(50);

  // Custom messages
  const defaultMessages: QVoteMessages = {
    registrationSuccess: isRTL ? 'נרשמתם בהצלחה!' : 'Registered successfully!',
    waitForApproval: isRTL ? 'ההרשמה שלכם תאושר בקרוב' : 'Your registration will be approved soon',
    alreadyRegistered: isRTL ? 'כבר נרשמת לתחרות' : 'You are already registered',
  };
  const [messages, setMessages] = useState<QVoteMessages>(defaultMessages);

  // Error state
  const [error, setError] = useState('');

  // Track if modal was just opened (to reset tab only on open)
  const wasOpenRef = useRef(false);

  // Initialize state from props
  useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        setTitle(initialConfig.formFields[0]?.label || '');
        setMaxPhotosPerCandidate(initialConfig.maxPhotosPerCandidate);
        setMaxSelectionsPerVoter(initialConfig.maxSelectionsPerVoter);
        setShowVoteCount(initialConfig.showVoteCount);
        setShowNames(initialConfig.showNames);
        setEnableCropping(initialConfig.enableCropping);
        setAllowSelfRegistration(initialConfig.allowSelfRegistration);
        setEnableFinals(initialConfig.enableFinals);
        setCurrentPhase(initialConfig.currentPhase);
        // Load button texts from config or use defaults
        if (initialConfig.branding.buttonTexts) {
          setButtonTexts({
            registration: initialConfig.branding.buttonTexts.registration || defaultButtonTexts.registration,
            preparation: initialConfig.branding.buttonTexts.preparation || defaultButtonTexts.preparation,
            voting: initialConfig.branding.buttonTexts.voting || defaultButtonTexts.voting,
            finals: initialConfig.branding.buttonTexts.finals || defaultButtonTexts.finals,
          });
        } else {
          setButtonTexts(defaultButtonTexts);
        }
        setFormFields(initialConfig.formFields);
        setCategories(initialConfig.categories);
        setBranding(initialConfig.branding);
        setGamificationEnabled(initialConfig.gamification.enabled);
        setXpPerVote(initialConfig.gamification.xpPerVote);
        setXpForPackThreshold(initialConfig.gamification.xpForPackThreshold);
        if (initialConfig.branding.landingImage) {
          setLandingImagePreview(initialConfig.branding.landingImage);
          // Load saved image metadata if available
          if (initialConfig.branding.landingImageName && initialConfig.branding.landingImageSize) {
            setLandingImageInfo({
              name: initialConfig.branding.landingImageName,
              originalSize: initialConfig.branding.landingImageSize,
              compressedSize: initialConfig.branding.landingImageSize,
            });
          }
        }
        // Load custom messages
        if (initialConfig.messages) {
          setMessages({
            registrationSuccess: initialConfig.messages.registrationSuccess || defaultMessages.registrationSuccess,
            waitForApproval: initialConfig.messages.waitForApproval || defaultMessages.waitForApproval,
            alreadyRegistered: initialConfig.messages.alreadyRegistered || defaultMessages.alreadyRegistered,
          });
        } else {
          setMessages(defaultMessages);
        }
      } else {
        // Reset to defaults
        setTitle('');
        setMaxPhotosPerCandidate(3);
        setMaxSelectionsPerVoter(3);
        setShowVoteCount(false);
        setShowNames(true);
        setEnableCropping(true);
        setAllowSelfRegistration(true);
        setEnableFinals(false);
        setCurrentPhase('registration');
        setButtonTexts(defaultButtonTexts);
        setFormFields([
          { id: 'name', label: isRTL ? 'שם מלא' : 'Full Name', labelEn: 'Full Name', required: true, order: 0 },
        ]);
        setCategories([]);
        setBranding(DEFAULT_QVOTE_CONFIG.branding);
        setGamificationEnabled(false);
        setXpPerVote(10);
        setXpForPackThreshold(50);
        setLandingImagePreview(null);
        setMessages(defaultMessages);
      }
      setLandingImageFile(null);
      setLandingImageInfo(null);
      setError('');
      // Only reset tab when modal first opens (not on config updates)
      if (!wasOpenRef.current) {
        setActiveTab('branding');
      }
      wasOpenRef.current = true;
    } else {
      wasOpenRef.current = false;
    }
  }, [isOpen, initialConfig, isRTL]);

  // Process and compress landing image
  const processLandingImage = async (file: File) => {
    setIsCompressingLanding(true);
    try {
      const { blob, originalSize, compressedSize } = await compressImage(file);
      const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
      setLandingImageFile(compressedFile);
      const url = URL.createObjectURL(blob);
      setLandingImagePreview(url);
      setLandingImageInfo({ name: file.name, originalSize, compressedSize });
    } catch (error) {
      console.error('Error compressing image:', error);
    } finally {
      setIsCompressingLanding(false);
    }
  };

  // Handle landing image selection
  const handleLandingImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !isCompressingLanding) {
      processLandingImage(file);
    }
  };

  // Handle landing image drag and drop
  const handleLandingImageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isCompressingLanding) setIsDraggingLandingImage(true);
  };

  const handleLandingImageDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLandingImage(false);
  };

  const handleLandingImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLandingImage(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/') && !isCompressingLanding) {
      processLandingImage(file);
    }
  };

  // Add form field
  const addFormField = () => {
    const newField: QVoteFormField = {
      id: `field_${Date.now()}`,
      label: '',
      labelEn: '',
      required: false,
      order: formFields.length,
    };
    setFormFields([...formFields, newField]);
  };

  // Update form field
  const updateFormField = (index: number, updates: Partial<QVoteFormField>) => {
    const updated = [...formFields];
    updated[index] = { ...updated[index], ...updates };
    setFormFields(updated);
  };

  // Remove form field
  const removeFormField = (index: number) => {
    if (formFields.length <= 1) return; // Keep at least one field
    setFormFields(formFields.filter((_, i) => i !== index));
  };

  // Add category
  const addCategory = () => {
    const newCategory: QVoteCategory = {
      id: `cat_${Date.now()}`,
      name: '',
      nameEn: '',
      order: categories.length,
      isActive: true,
    };
    setCategories([...categories, newCategory]);
  };

  // Update category
  const updateCategory = (index: number, updates: Partial<QVoteCategory>) => {
    const updated = [...categories];
    updated[index] = { ...updated[index], ...updates };
    setCategories(updated);
  };

  // Remove category
  const removeCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  // Update branding color
  const updateBrandingColor = (key: keyof QVoteBranding['colors'], value: string) => {
    setBranding({
      ...branding,
      colors: {
        ...branding.colors,
        [key]: value,
      },
    });
  };

  // Handle save
  const handleSave = async () => {
    // Validate
    if (formFields.length === 0) {
      setError(isRTL ? 'יש להגדיר לפחות שדה אחד בטופס' : 'At least one form field is required');
      return;
    }

    const hasEmptyLabel = formFields.some(f => !f.label.trim());
    if (hasEmptyLabel) {
      setError(isRTL ? 'יש למלא את שם השדה לכל השדות' : 'All form fields must have a label');
      return;
    }

    // Build config
    const config: QVoteConfig = {
      formFields: formFields.map((f, i) => ({ ...f, order: i })),
      categories: categories.map((c, i) => ({ ...c, order: i })),
      currentPhase,
      enableFinals,
      schedule: {},
      scheduleMode: 'manual',
      maxPhotosPerCandidate,
      maxSelectionsPerVoter,
      showVoteCount,
      showNames,
      enableCropping,
      allowSelfRegistration,
      gamification: {
        enabled: gamificationEnabled,
        xpPerVote,
        xpForPackThreshold,
      },
      branding: {
        ...branding,
        landingImage: landingImagePreview || undefined,
        buttonTexts: {
          registration: buttonTexts.registration,
          preparation: buttonTexts.preparation,
          voting: buttonTexts.voting,
          finals: buttonTexts.finals,
        },
      },
      messages: {
        registrationSuccess: messages.registrationSuccess,
        waitForApproval: messages.waitForApproval,
        alreadyRegistered: messages.alreadyRegistered,
      },
    };

    await onSave(config, landingImageFile || undefined);
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'branding', label: isRTL ? 'מיתוג' : 'Branding', icon: Palette },
    { id: 'form', label: isRTL ? 'שדות טופס' : 'Form Fields', icon: Vote },
    { id: 'basic', label: isRTL ? 'הגדרות בסיסיות' : 'Basic Settings', icon: Settings },
    { id: 'advanced', label: isRTL ? 'מתקדם' : 'Advanced', icon: Sparkles },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Vote className="w-5 h-5 text-accent" />
            Q.Vote
          </h2>
          <div className="flex items-center gap-2">
            {shortId && (
              <button
                onClick={() => setShowPreview(true)}
                className="p-2 rounded-lg bg-bg-secondary hover:bg-bg-hover text-text-secondary"
                title={isRTL ? 'תצוגה מקדימה' : 'Preview'}
              >
                <Eye className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border px-4 shrink-0">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error */}
          {error && (
            <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          {/* Basic Settings Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* Voting Settings */}
              <div className="space-y-4">
                <h3 className="font-medium text-text-primary">
                  {isRTL ? 'הגדרות הצבעה' : 'Voting Settings'}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-text-secondary">
                      {isRTL ? 'מקסימום תמונות למועמד' : 'Max photos per candidate'}
                    </label>
                    <select
                      value={maxPhotosPerCandidate}
                      onChange={(e) => setMaxPhotosPerCandidate(Number(e.target.value))}
                      className="input w-full"
                    >
                      {[1, 2, 3].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-text-secondary">
                      {isRTL ? 'מקסימום בחירות למצביע' : 'Max selections per voter'}
                    </label>
                    <select
                      value={maxSelectionsPerVoter}
                      onChange={(e) => setMaxSelectionsPerVoter(Number(e.target.value))}
                      className="input w-full"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Toggle settings */}
                <div className="space-y-3">
                  <ToggleSetting
                    label={isRTL ? 'הצג מספר הצבעות' : 'Show vote count'}
                    description={isRTL ? 'הצגת מספר ההצבעות ליד כל מועמד' : 'Display vote counts next to each candidate'}
                    value={showVoteCount}
                    onChange={setShowVoteCount}
                  />

                  <ToggleSetting
                    label={isRTL ? 'הצג שמות מועמדים' : 'Show candidate names'}
                    description={isRTL ? 'הצגת שמות המועמדים (אחרת אנונימי)' : 'Display candidate names (otherwise anonymous)'}
                    value={showNames}
                    onChange={setShowNames}
                  />

                  <ToggleSetting
                    label={isRTL ? 'אפשר חיתוך תמונות' : 'Enable image cropping'}
                    description={isRTL ? 'אפשר למועמדים לחתוך תמונות בהעלאה' : 'Allow candidates to crop images on upload'}
                    value={enableCropping}
                    onChange={setEnableCropping}
                  />

                  <ToggleSetting
                    label={isRTL ? 'אפשר הרשמה עצמית' : 'Allow self registration'}
                    description={isRTL ? 'מועמדים יכולים להירשם בעצמם' : 'Candidates can register themselves'}
                    value={allowSelfRegistration}
                    onChange={setAllowSelfRegistration}
                  />

                  <ToggleSetting
                    label={isRTL ? 'אפשר שלב גמר' : 'Enable finals stage'}
                    description={isRTL ? 'הוספת שלב גמר עם הצבעה נוספת' : 'Add a finals stage with additional voting'}
                    value={enableFinals}
                    onChange={setEnableFinals}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Fields Tab */}
          {activeTab === 'form' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-text-primary">
                  {isRTL ? 'שדות טופס רישום' : 'Registration Form Fields'}
                </h3>
                <button
                  onClick={addFormField}
                  className="btn bg-accent text-white hover:bg-accent-hover text-sm px-3 py-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {isRTL ? 'הוסף שדה' : 'Add Field'}
                </button>
              </div>

              <p className="text-sm text-text-secondary">
                {isRTL
                  ? 'הגדר את השדות שיופיעו בטופס ההרשמה למועמדים'
                  : 'Define the fields that will appear in the candidate registration form'}
              </p>

              <div className="space-y-3">
                {formFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-start gap-3 p-4 bg-bg-secondary rounded-xl"
                  >
                    <GripVertical className="w-5 h-5 text-text-secondary mt-2 cursor-move shrink-0" />

                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateFormField(index, { label: e.target.value })}
                          placeholder={isRTL ? 'שם השדה (עברית)' : 'Field label'}
                          className="input"
                        />
                        <input
                          type="text"
                          value={field.labelEn || ''}
                          onChange={(e) => updateFormField(index, { labelEn: e.target.value })}
                          placeholder={isRTL ? 'שם השדה (אנגלית)' : 'Field label (English)'}
                          className="input"
                          dir="ltr"
                        />
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateFormField(index, { required: e.target.checked })}
                          className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                        />
                        <span className="text-sm text-text-secondary">
                          {isRTL ? 'שדה חובה' : 'Required field'}
                        </span>
                      </label>
                    </div>

                    <button
                      onClick={() => removeFormField(index)}
                      disabled={formFields.length <= 1}
                      className="p-2 rounded-lg hover:bg-danger/10 text-danger disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Categories Section */}
              <div className="pt-6 border-t border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-text-primary">
                    {isRTL ? 'קטגוריות' : 'Categories'}
                    <span className="text-sm text-text-secondary font-normal ms-2">
                      ({isRTL ? 'אופציונלי' : 'optional'})
                    </span>
                  </h3>
                  <button
                    onClick={addCategory}
                    className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover text-sm px-3 py-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    {isRTL ? 'הוסף קטגוריה' : 'Add Category'}
                  </button>
                </div>

                {categories.length === 0 ? (
                  <p className="text-sm text-text-secondary text-center py-4">
                    {isRTL
                      ? 'ללא קטגוריות - כל המועמדים יופיעו ברשימה אחת'
                      : 'No categories - all candidates will appear in one list'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {categories.map((category, index) => (
                      <div
                        key={category.id}
                        className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl"
                      >
                        <input
                          type="text"
                          value={category.name}
                          onChange={(e) => updateCategory(index, { name: e.target.value })}
                          placeholder={isRTL ? 'שם הקטגוריה' : 'Category name'}
                          className="input flex-1"
                        />
                        <input
                          type="text"
                          value={category.nameEn || ''}
                          onChange={(e) => updateCategory(index, { nameEn: e.target.value })}
                          placeholder={isRTL ? 'באנגלית' : 'In English'}
                          className="input flex-1"
                          dir="ltr"
                        />
                        <button
                          onClick={() => removeCategory(index)}
                          className="p-2 rounded-lg hover:bg-danger/10 text-danger shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Phone Preview */}
              <div className="flex-shrink-0 flex justify-center">
                <div className="relative bg-gray-900 rounded-[2.5rem] p-2 shadow-xl">
                  {/* Phone inner bezel */}
                  <div className="relative bg-black rounded-[2rem] overflow-hidden">
                    {/* Screen */}
                    <div
                      className="relative w-[280px] h-[500px] overflow-hidden rounded-[1.8rem] flex flex-col items-center justify-center p-6"
                      style={{
                        backgroundColor: branding.colors.background,
                      }}
                    >
                      {/* Background Image */}
                      {landingImagePreview && (
                        <img
                          src={landingImagePreview}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}
                      {/* Dark overlay for text readability */}
                      {landingImagePreview && (branding.imageOverlayOpacity ?? 30) > 0 && (
                        <div
                          className="absolute inset-0"
                          style={{ backgroundColor: `rgba(0, 0, 0, ${(branding.imageOverlayOpacity ?? 30) / 100})` }}
                        />
                      )}

                      {/* Content */}
                      <div className="relative z-10 text-center">
                        {branding.landingTitle && (
                          <h1
                            className="text-2xl font-bold mb-2"
                            style={{ color: branding.colors.text }}
                          >
                            {branding.landingTitle}
                          </h1>
                        )}
                        {branding.landingSubtitle && (
                          <p
                            className="text-base opacity-80 mb-8"
                            style={{ color: branding.colors.text }}
                          >
                            {branding.landingSubtitle}
                          </p>
                        )}
                        {/* Show button only if there's title, subtitle, or button text */}
                        {(branding.landingTitle || branding.landingSubtitle || buttonTexts[currentPhase]) && (
                          <>
                            <button
                              className="px-6 py-2.5 rounded-full font-medium text-sm transition-transform hover:scale-105"
                              style={{
                                backgroundColor: branding.colors.buttonBackground,
                                color: branding.colors.buttonText,
                              }}
                            >
                              {buttonTexts[currentPhase] || defaultButtonTexts[currentPhase as keyof typeof defaultButtonTexts]}
                            </button>
                            <p
                              className="mt-4 text-xs opacity-60 animate-pulse"
                              style={{ color: branding.colors.text }}
                            >
                              {isRTL ? 'לחצו או החליקו להמשך' : 'Tap or swipe to continue'}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Home indicator */}
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/30 rounded-full z-10" />
                  </div>

                  {/* Side buttons */}
                  <div className="absolute right-[-2px] top-20 w-1 h-10 bg-gray-700 rounded-r-sm" />
                  <div className="absolute left-[-2px] top-16 w-1 h-6 bg-gray-700 rounded-l-sm" />
                  <div className="absolute left-[-2px] top-24 w-1 h-10 bg-gray-700 rounded-l-sm" />
                </div>
              </div>

              {/* Form Controls */}
              <div className="flex-1 space-y-5">
                {/* Landing Image */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">
                    {isRTL ? 'תמונת נחיתה' : 'Landing Image'}
                  </label>
                  <div
                    onClick={() => !isCompressingLanding && fileInputRef.current?.click()}
                    onDragOver={handleLandingImageDragOver}
                    onDragLeave={handleLandingImageDragLeave}
                    onDrop={handleLandingImageDrop}
                    className={`relative h-24 rounded-xl overflow-hidden bg-bg-secondary border-2 border-dashed cursor-pointer transition-all ${
                      isDraggingLandingImage
                        ? 'border-accent bg-accent/10 scale-[1.02]'
                        : 'border-border hover:border-accent'
                    } ${isCompressingLanding ? 'opacity-70 cursor-wait' : ''}`}
                  >
                    {isCompressingLanding ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-text-secondary">
                        <Loader2 className="w-8 h-8 mb-1 animate-spin" />
                        <span className="text-sm">{isRTL ? 'מכווץ תמונה...' : 'Compressing...'}</span>
                      </div>
                    ) : landingImagePreview ? (
                      <div className="flex items-center gap-3 p-3 h-full">
                        <img
                          src={landingImagePreview}
                          alt="Landing"
                          className="h-full aspect-video object-cover rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          {landingImageInfo ? (
                            <>
                              <p className="text-sm text-text-primary font-medium truncate">
                                {landingImageInfo.name}
                              </p>
                              <p className="text-xs text-success" dir="ltr">
                                {formatFileSize(landingImageInfo.compressedSize)}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-text-primary font-medium">
                              {isRTL ? 'תמונה קיימת' : 'Existing image'}
                            </p>
                          )}
                          <p className="text-xs text-accent mt-0.5">
                            {isRTL ? 'לחצו להחלפה' : 'Click to replace'}
                          </p>
                        </div>
                        {/* Overlay slider */}
                        <div
                          className="flex flex-col items-center gap-0.5 px-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] text-text-secondary whitespace-nowrap">
                            {branding.imageOverlayOpacity ?? 30}%
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="80"
                            step="5"
                            value={branding.imageOverlayOpacity ?? 30}
                            onChange={(e) =>
                              setBranding({
                                ...branding,
                                imageOverlayOpacity: parseInt(e.target.value),
                              })
                            }
                            className="w-16 h-1.5 bg-bg-hover rounded-lg appearance-none cursor-pointer accent-accent"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLandingImageFile(null);
                            setLandingImagePreview(null);
                            setLandingImageInfo(null);
                            setBranding({ ...branding, landingImage: undefined });
                          }}
                          className="p-2 rounded-lg bg-danger/20 hover:bg-danger/30 text-danger transition-all"
                          title={isRTL ? 'מחק תמונה' : 'Delete image'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-text-secondary">
                        <ImageIcon className="w-8 h-8 mb-1" />
                        <span className="text-sm">{isRTL ? 'לחצו או גררו תמונה' : 'Click or drag image'}</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLandingImageSelect}
                  />
                </div>

                {/* Title & Phase Selector Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">
                      {isRTL ? 'כותרת' : 'Title'}
                    </label>
                    <input
                      type="text"
                      value={branding.landingTitle || ''}
                      onChange={(e) =>
                        setBranding({
                          ...branding,
                          landingTitle: e.target.value,
                        })
                      }
                      placeholder={isRTL ? 'הכניסו כותרת...' : 'Enter title...'}
                      className="input w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">
                      {isRTL ? 'שלב נוכחי' : 'Current Phase'}
                    </label>
                    <select
                      value={currentPhase}
                      onChange={(e) => setCurrentPhase(e.target.value as QVotePhase)}
                      className="input w-full"
                    >
                      <option value="registration">{isRTL ? 'הרשמה' : 'Registration'}</option>
                      <option value="preparation">{isRTL ? 'מכינים' : 'Preparation'}</option>
                      <option value="voting">{isRTL ? 'הצבעה' : 'Voting'}</option>
                      {enableFinals && (
                        <option value="finals">{isRTL ? 'גמר' : 'Finals'}</option>
                      )}
                      <option value="results">{isRTL ? 'תוצאות' : 'Results'}</option>
                    </select>
                  </div>
                </div>

                {/* Subtitle */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">
                    {isRTL ? 'תת-כותרת' : 'Subtitle'}
                  </label>
                  <input
                    type="text"
                    value={branding.landingSubtitle || ''}
                    onChange={(e) =>
                      setBranding({
                        ...branding,
                        landingSubtitle: e.target.value,
                      })
                    }
                    placeholder={isRTL ? 'הכניסו תת-כותרת...' : 'Enter subtitle...'}
                    className="input w-full"
                  />
                </div>

                {/* Button Text Per Phase */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-text-primary">
                    {isRTL ? 'טקסט כפתור לפי שלב' : 'Button Text Per Phase'}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-text-secondary">
                        {isRTL ? 'הרשמה' : 'Registration'}
                      </label>
                      <input
                        type="text"
                        value={buttonTexts.registration || ''}
                        onChange={(e) =>
                          setButtonTexts({ ...buttonTexts, registration: e.target.value })
                        }
                        placeholder={defaultButtonTexts.registration}
                        className="input w-full text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-text-secondary">
                        {isRTL ? 'מכינים' : 'Preparation'}
                      </label>
                      <input
                        type="text"
                        value={buttonTexts.preparation || ''}
                        onChange={(e) =>
                          setButtonTexts({ ...buttonTexts, preparation: e.target.value })
                        }
                        placeholder={defaultButtonTexts.preparation}
                        className="input w-full text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-text-secondary">
                        {isRTL ? 'הצבעה' : 'Voting'}
                      </label>
                      <input
                        type="text"
                        value={buttonTexts.voting || ''}
                        onChange={(e) =>
                          setButtonTexts({ ...buttonTexts, voting: e.target.value })
                        }
                        placeholder={defaultButtonTexts.voting}
                        className="input w-full text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-text-secondary">
                        {isRTL ? 'גמר' : 'Finals'}
                      </label>
                      <input
                        type="text"
                        value={buttonTexts.finals || ''}
                        onChange={(e) =>
                          setButtonTexts({ ...buttonTexts, finals: e.target.value })
                        }
                        placeholder={defaultButtonTexts.finals}
                        className="input w-full text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <ColorPicker
                    label={isRTL ? 'רקע' : 'Background'}
                    value={branding.colors.background}
                    onChange={(v) => updateBrandingColor('background', v)}
                    presets={presetColors.background}
                  />

                  <ColorPicker
                    label={isRTL ? 'טקסט' : 'Text'}
                    value={branding.colors.text}
                    onChange={(v) => updateBrandingColor('text', v)}
                    presets={presetColors.text}
                  />

                  <ColorPicker
                    label={isRTL ? 'כפתור' : 'Button'}
                    value={branding.colors.buttonBackground}
                    onChange={(v) => updateBrandingColor('buttonBackground', v)}
                    presets={presetColors.button}
                  />

                  <ColorPicker
                    label={isRTL ? 'טקסט כפתור' : 'Btn Text'}
                    value={branding.colors.buttonText}
                    onChange={(v) => updateBrandingColor('buttonText', v)}
                    presets={['#ffffff', '#1f2937']}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              {/* Gamification */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <h3 className="font-medium text-text-primary">
                    {isRTL ? 'גיימיפיקציה' : 'Gamification'}
                  </h3>
                </div>

                <ToggleSetting
                  label={isRTL ? 'הפעל מערכת XP' : 'Enable XP system'}
                  description={isRTL ? 'מצביעים צוברים נקודות וזוכים בפרסים' : 'Voters earn points and win prizes'}
                  value={gamificationEnabled}
                  onChange={setGamificationEnabled}
                />

                {gamificationEnabled && (
                  <div className="space-y-4 p-4 bg-bg-secondary rounded-xl">
                    <div className="space-y-2">
                      <label className="text-sm text-text-secondary">
                        {isRTL ? 'נקודות XP לכל הצבעה' : 'XP per vote'}
                      </label>
                      <input
                        type="number"
                        value={xpPerVote}
                        onChange={(e) => setXpPerVote(Number(e.target.value))}
                        min={1}
                        max={100}
                        className="input w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-text-secondary">
                        {isRTL ? 'סף XP לפתיחת חבילה' : 'XP threshold for pack opening'}
                      </label>
                      <input
                        type="number"
                        value={xpForPackThreshold}
                        onChange={(e) => setXpForPackThreshold(Number(e.target.value))}
                        min={10}
                        max={1000}
                        className="input w-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Messages */}
              <div className="space-y-4">
                <h3 className="font-medium text-text-primary">
                  {isRTL ? 'הודעות מותאמות' : 'Custom Messages'}
                </h3>
                <p className="text-sm text-text-secondary">
                  {isRTL
                    ? 'הודעות אלה יוצגו למשתתפים בשלבים השונים'
                    : 'These messages will be shown to participants at different stages'}
                </p>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm text-text-secondary">
                      {isRTL ? 'הודעת הצלחה בהרשמה' : 'Registration success message'}
                    </label>
                    <input
                      type="text"
                      value={messages.registrationSuccess || ''}
                      onChange={(e) => setMessages({ ...messages, registrationSuccess: e.target.value })}
                      placeholder={defaultMessages.registrationSuccess}
                      className="input w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-text-secondary">
                      {isRTL ? 'הודעת המתנה לאישור' : 'Wait for approval message'}
                    </label>
                    <input
                      type="text"
                      value={messages.waitForApproval || ''}
                      onChange={(e) => setMessages({ ...messages, waitForApproval: e.target.value })}
                      placeholder={defaultMessages.waitForApproval}
                      className="input w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-text-secondary">
                      {isRTL ? 'הודעת כבר נרשמת' : 'Already registered message'}
                    </label>
                    <input
                      type="text"
                      value={messages.alreadyRegistered || ''}
                      onChange={(e) => setMessages({ ...messages, alreadyRegistered: e.target.value })}
                      placeholder={defaultMessages.alreadyRegistered}
                      className="input w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-bg-card border-t border-border px-6 py-4 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover disabled:opacity-50"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
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

      {/* Mobile Preview Modal */}
      {shortId && (
        <MobilePreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          url={`/v/${shortId}?utm_source=preview`}
          title="Q.Vote"
        />
      )}
    </div>
  );
}

// Toggle Setting Component
function ToggleSetting({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-xl">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && (
          <p className="text-xs text-text-secondary mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          value ? 'bg-accent' : 'bg-border'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
            value ? 'right-1' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}

// Color Picker Component
// Glassmorphism dark colors for visual identification
const GLASSMORPHISM_COLORS = ['#1a1a2e', '#0f172a', '#16213e', '#1e293b', '#27272a'];

function ColorPicker({
  label,
  value,
  onChange,
  presets,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets: string[];
}) {
  const isGlassmorphism = (color: string) =>
    GLASSMORPHISM_COLORS.includes(color.toLowerCase());

  return (
    <div className="space-y-2">
      <label className="text-sm text-text-secondary">{label}</label>
      <div className="flex items-center gap-2 flex-wrap">
        {presets.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`relative w-8 h-8 rounded-lg border-2 transition-all ${
              value === color
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
        <label
          className={`relative w-8 h-8 rounded-lg border-2 cursor-pointer flex items-center justify-center transition-all ${
            !presets.includes(value)
              ? 'border-accent scale-110'
              : 'border-border hover:border-text-secondary'
          }`}
          style={{ backgroundColor: value }}
        >
          <Pipette className="w-4 h-4 text-text-secondary mix-blend-difference" />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}
