'use client';

import { useState, useEffect, useRef, Fragment, useMemo } from 'react';
import {
  X,
  Calendar,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  Settings,
  Image as ImageIcon,
  Palette,
  Copy,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Search,
  Eye,
  EyeOff,
  Undo2,
  Minus,
  GripVertical,
  Check,
  Download,
  Info,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import {
  WeeklyCalendarConfig,
  WeekData,
  CalendarCell,
  TimeSlot,
  CalendarAttraction,
  CalendarNotes,
  DayOfWeek,
  DEFAULT_WEEKLYCAL_CONFIG,
  DEFAULT_CALENDAR_NOTES,
  DAY_NAMES,
  DAY_NAMES_SHORT,
  CELL_COLOR_PALETTE,
  generateId,
  getWeekStartDate,
  createEmptyWeek,
  getContrastTextColor,
  timeToMinutes,
  isCurrentWeek,
  getTodayDayIndex,
} from '@/types/weeklycal';
import MobilePreviewModal from './MobilePreviewModal';
import { QRCodeSVG } from 'qrcode.react';

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
  const img = await createImageBitmap(file);

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
      // Good enough, try higher quality
      minQ = quality;
    } else {
      // Too big, try lower quality
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

// Animated count component - animates from 0 to target value
function AnimatedCount({ value, duration = 800 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
      return;
    }

    // Only animate on first load
    if (!hasAnimated) {
      setHasAnimated(true);
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(eased * value));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    } else {
      // After first animation, update immediately
      setDisplayValue(value);
    }
  }, [value, duration, hasAnimated]);

  return <span>{displayValue}</span>;
}

interface WeeklyCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: WeeklyCalendarConfig, landingImageFile?: File, dayBgImageFile?: File) => Promise<void>;
  onUploadCellImage?: (file: File) => Promise<string | null>;
  onDeleteCellImage?: (url: string) => Promise<boolean>;
  loading?: boolean;
  initialConfig?: WeeklyCalendarConfig;
  shortId?: string;
  codeId?: string;
}

type TabType = 'schedule' | 'landing' | 'attractions' | 'notes' | 'settings';

// Color picker component
// Glassmorphism dark colors for visual identification
const GLASSMORPHISM_COLORS = ['#1a1a2e', '#0f172a', '#16213e', '#1e293b', '#27272a'];

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
          <label
            className={`relative w-8 h-8 rounded-lg border-2 cursor-pointer flex items-center justify-center transition-all ${
              customColor && !colors.includes(value)
                ? 'border-accent scale-110'
                : 'border-border hover:border-text-secondary'
            }`}
            style={{ backgroundColor: customColor || '#e5e5e5' }}
          >
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

export default function WeeklyCalendarModal({
  isOpen,
  onClose,
  onSave,
  onUploadCellImage,
  onDeleteCellImage,
  loading = false,
  initialConfig,
  shortId,
  codeId,
}: WeeklyCalendarModalProps) {
  const t = useTranslations('modals');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isRTL = locale === 'he';

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('schedule');

  // Config state
  const [config, setConfig] = useState<WeeklyCalendarConfig>(DEFAULT_WEEKLYCAL_CONFIG);

  // Current week being edited
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);

  // Cell editor state
  const [editingCell, setEditingCell] = useState<CalendarCell | null>(null);
  const [editingCellDayIndex, setEditingCellDayIndex] = useState<number>(-1);
  const [editingCellSlotIndex, setEditingCellSlotIndex] = useState<number>(-1);

  // Cell drag state (for moving/copying cells)
  const [draggingCell, setDraggingCell] = useState<CalendarCell | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ dayIndex: number; slotIndex: number } | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [fileDragOverCell, setFileDragOverCell] = useState<{ dayIndex: number; slotIndex: number } | null>(null);
  const [uploadingImageCell, setUploadingImageCell] = useState<{ dayIndex: number; slotIndex: number } | null>(null);

  // Landing image
  const [landingImageFile, setLandingImageFile] = useState<File | null>(null);
  const [landingImagePreview, setLandingImagePreview] = useState<string | null>(null);
  const [landingImageInfo, setLandingImageInfo] = useState<ImageFileInfo | null>(null);
  const [isDraggingLandingImage, setIsDraggingLandingImage] = useState(false);
  const [isCompressingLanding, setIsCompressingLanding] = useState(false);
  const [landingImageLoaded, setLandingImageLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Day background image
  const [isDraggingDayBgImage, setIsDraggingDayBgImage] = useState(false);
  const [dayBgImageFile, setDayBgImageFile] = useState<File | null>(null);
  const [dayBgImagePreview, setDayBgImagePreview] = useState<string | null>(null);
  const [dayBgImageInfo, setDayBgImageInfo] = useState<ImageFileInfo | null>(null);
  const [isCompressingDayBg, setIsCompressingDayBg] = useState(false);
  const dayBgImageInputRef = useRef<HTMLInputElement>(null);
  const notesContentRef = useRef<HTMLDivElement>(null);
  const notesContentInitialized = useRef(false);

  // Error state
  const [error, setError] = useState('');

  // Attractions state
  const [expandedAttractionId, setExpandedAttractionId] = useState<string | null>(null);
  const [attractionSearch, setAttractionSearch] = useState('');

  // Undo history for attraction descriptions (keyed by attraction id)
  const [descriptionHistory, setDescriptionHistory] = useState<Record<string, string[]>>({});

  // Attraction drag state for reordering
  const [draggingAttractionIndex, setDraggingAttractionIndex] = useState<number | null>(null);
  const [dragOverAttractionIndex, setDragOverAttractionIndex] = useState<number | null>(null);

  // Save confirmation state
  const [saved, setSaved] = useState(false);

  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);

  // Current time for time indicator
  const [currentTime, setCurrentTime] = useState(new Date());

  // RSVP registration counts for editor display
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, number>>({}); // Total attendees
  const [confirmationCounts, setConfirmationCounts] = useState<Record<string, number>>({}); // Number of people who confirmed

  // Delete time slot confirmation modal
  const [deleteSlotConfirm, setDeleteSlotConfirm] = useState<{
    show: boolean;
    slotIndex: number;
    affectedActivities: string[];
  }>({ show: false, slotIndex: -1, affectedActivities: [] });

  // Reset saved state after showing confirmation
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  // Update current time every minute for time indicator
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch RSVP registration counts for editor display (with auto-refresh)
  useEffect(() => {
    if (!isOpen || !codeId || !config.enableRSVP) return;

    const currentWeekData = config.weeks[currentWeekIndex];
    if (!currentWeekData) return;

    const fetchRegistrations = async () => {
      try {
        const response = await fetch(
          `/api/weeklycal/register?codeId=${codeId}&weekStartDate=${currentWeekData.weekStartDate}`
        );
        if (response.ok) {
          const data = await response.json();
          setRegistrationCounts(data.countsByCell || {});
          setConfirmationCounts(data.confirmationsByCell || {});
        }
      } catch (error) {
        console.error('Failed to fetch registration counts:', error);
      }
    };

    // Fetch immediately
    fetchRegistrations();

    // Auto-refresh every 3 seconds for real-time updates
    const interval = setInterval(fetchRegistrations, 3000);

    return () => clearInterval(interval);
  }, [isOpen, codeId, config.enableRSVP, config.weeks, currentWeekIndex]);

  // Get current week data
  const currentWeek = config.weeks[currentWeekIndex];

  // Check if viewing current week and today's day
  const isViewingCurrentWeek = currentWeek ? isCurrentWeek(currentWeek.weekStartDate) : false;
  const todayDayIndex = getTodayDayIndex();

  // Calculate time indicator position based on slot index
  const timeIndicatorPosition = useMemo(() => {
    if (!currentWeek || !isViewingCurrentWeek) return null;

    const slots = currentWeek.timeSlots;
    if (!slots || slots.length === 0) return null;

    const now = currentTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Find which slot contains the current time or which gap we're in
    for (let i = 0; i < slots.length; i++) {
      const startMins = timeToMinutes(slots[i].startTime);
      const endMins = timeToMinutes(slots[i].endTime);

      if (currentMinutes < startMins) {
        // Before this slot starts - position at the start of this slot
        return (i / slots.length) * 100;
      } else if (currentMinutes >= startMins && currentMinutes <= endMins) {
        // Within this slot - interpolate position within the slot
        const fraction = (currentMinutes - startMins) / (endMins - startMins);
        return ((i + fraction) / slots.length) * 100;
      }
      // Continue to next slot if we're past this one
    }

    // Past all slots
    return 100;
  }, [currentWeek, isViewingCurrentWeek, currentTime]);

  // Initialize
  useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        setConfig(initialConfig);
        if (initialConfig.branding.landing.splashImageUrl) {
          setLandingImagePreview(initialConfig.branding.landing.splashImageUrl);
        }
      } else {
        // Create initial week for current week
        const today = new Date();
        const weekStart = getWeekStartDate(today);
        const initialWeek = createEmptyWeek(weekStart, DEFAULT_WEEKLYCAL_CONFIG.defaultTimeSlots);

        setConfig({
          ...DEFAULT_WEEKLYCAL_CONFIG,
          weeks: [initialWeek],
        });
        setLandingImagePreview(null);
      }
      setLandingImageFile(null);
      setLandingImageLoaded(false);
      setError('');
      setActiveTab('schedule');
      setCurrentWeekIndex(0);
      setEditingCell(null);
      setEditingCellDayIndex(-1);
      setEditingCellSlotIndex(-1);
      setSaved(false);
    }
  }, [isOpen, initialConfig]);

  // Reset image loaded state when preview URL changes
  useEffect(() => {
    if (landingImagePreview) {
      // Preload image
      const img = new Image();
      img.onload = () => setLandingImageLoaded(true);
      img.onerror = () => setLandingImageLoaded(true); // Show even if error
      img.src = landingImagePreview;

      // Handle already-cached images (onload might not fire)
      if (img.complete) {
        setLandingImageLoaded(true);
      }
    } else {
      setLandingImageLoaded(false);
    }
  }, [landingImagePreview]);

  // Track shift key for drag operations (must be before early return)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey) setIsShiftPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.shiftKey) setIsShiftPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Initialize notes content editor when switching to notes tab
  useEffect(() => {
    if (activeTab === 'notes' && notesContentRef.current && !notesContentInitialized.current) {
      notesContentRef.current.innerHTML = config.notes?.content || '';
      notesContentInitialized.current = true;
    }
    // Reset initialization flag when leaving notes tab
    if (activeTab !== 'notes') {
      notesContentInitialized.current = false;
    }
  }, [activeTab, config.notes?.content]);

  if (!isOpen) return null;

  // Navigate weeks
  const goToPreviousWeek = () => {
    if (currentWeekIndex > 0) {
      setCurrentWeekIndex(currentWeekIndex - 1);
    }
  };

  const goToNextWeek = () => {
    if (currentWeekIndex < config.weeks.length - 1) {
      setCurrentWeekIndex(currentWeekIndex + 1);
    } else {
      // Create new week
      const lastWeek = config.weeks[config.weeks.length - 1];
      const lastDate = new Date(lastWeek?.weekStartDate || new Date());
      lastDate.setDate(lastDate.getDate() + 7);
      const newWeekStart = lastDate.toISOString().split('T')[0];
      const newWeek = createEmptyWeek(newWeekStart, config.defaultTimeSlots);

      setConfig({
        ...config,
        weeks: [...config.weeks, newWeek],
      });
      setCurrentWeekIndex(config.weeks.length);
    }
  };

  // Copy week
  const copyCurrentWeek = () => {
    if (!currentWeek) return;

    const lastWeek = config.weeks[config.weeks.length - 1];
    const lastDate = new Date(lastWeek?.weekStartDate || new Date());
    lastDate.setDate(lastDate.getDate() + 7);
    const newWeekStart = lastDate.toISOString().split('T')[0];

    const copiedWeek: WeekData = {
      ...currentWeek,
      id: generateId(),
      weekStartDate: newWeekStart,
      cells: currentWeek.cells.map((cell) => ({
        ...cell,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    };

    setConfig({
      ...config,
      weeks: [...config.weeks, copiedWeek],
    });
    setCurrentWeekIndex(config.weeks.length);
  };

  // Update cell
  const updateCell = (dayIndex: number, slotIndex: number, updates: Partial<CalendarCell>) => {
    if (!currentWeek) return;

    const existingCellIndex = currentWeek.cells.findIndex(
      (c) => c.dayIndex === dayIndex && c.startSlotIndex === slotIndex
    );

    let newCells: CalendarCell[];
    if (existingCellIndex >= 0) {
      newCells = currentWeek.cells.map((cell, i) =>
        i === existingCellIndex
          ? { ...cell, ...updates, updatedAt: new Date() }
          : cell
      );
    } else {
      // Create new cell
      const newCell: CalendarCell = {
        id: generateId(),
        dayIndex: dayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        startSlotIndex: slotIndex,
        rowSpan: 1,
        title: '',
        backgroundColor: CELL_COLOR_PALETTE[0],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...updates,
      };
      newCells = [...currentWeek.cells, newCell];
    }

    const updatedWeeks = config.weeks.map((week, i) =>
      i === currentWeekIndex ? { ...week, cells: newCells } : week
    );

    setConfig({ ...config, weeks: updatedWeeks });
  };

  // Delete cell
  const deleteCell = (dayIndex: number, slotIndex: number) => {
    if (!currentWeek) return;

    const newCells = currentWeek.cells.filter(
      (c) => !(c.dayIndex === dayIndex && c.startSlotIndex === slotIndex)
    );

    const updatedWeeks = config.weeks.map((week, i) =>
      i === currentWeekIndex ? { ...week, cells: newCells } : week
    );

    setConfig({ ...config, weeks: updatedWeeks });
  };

  // Get cell at position (only cells that START at this position)
  const getCellAt = (dayIndex: number, slotIndex: number): CalendarCell | undefined => {
    if (!currentWeek) return undefined;
    return currentWeek.cells.find(
      (c) => c.dayIndex === dayIndex && c.startSlotIndex === slotIndex
    );
  };

  // Check if position is covered by a spanning cell (but not where the cell starts)
  const isCoveredBySpan = (dayIndex: number, slotIndex: number): CalendarCell | null => {
    if (!currentWeek) return null;
    for (const cell of currentWeek.cells) {
      const cellColSpan = cell.colSpan || 1;
      const cellRowSpan = cell.rowSpan || 1;

      // Skip cells that start exactly at this position
      if (cell.dayIndex === dayIndex && cell.startSlotIndex === slotIndex) continue;

      // Check if this position is covered by the cell's span
      const dayInRange = dayIndex >= cell.dayIndex && dayIndex < cell.dayIndex + cellColSpan;
      const slotInRange = slotIndex >= cell.startSlotIndex && slotIndex < cell.startSlotIndex + cellRowSpan;

      if (dayInRange && slotInRange) {
        return cell;
      }
    }
    return null;
  };

  // Handle cell drag start
  const handleCellDragStart = (cell: CalendarCell, e: React.DragEvent) => {
    setDraggingCell(cell);
    e.dataTransfer.effectAllowed = 'copyMove';
    // Set drag image to be the element
    const target = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(target, target.offsetWidth / 2, target.offsetHeight / 2);
  };

  // Handle cell drag over
  const handleCellDragOver = (dayIndex: number, slotIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if it's a file being dragged
    const hasFiles = e.dataTransfer.types.includes('Files');
    if (hasFiles) {
      setFileDragOverCell({ dayIndex, slotIndex });
      e.dataTransfer.dropEffect = 'copy';
      return;
    }

    if (draggingCell) {
      setDragOverCell({ dayIndex, slotIndex });
      // Update shift state from event for visual feedback
      setIsShiftPressed(e.shiftKey);
      e.dataTransfer.dropEffect = e.shiftKey ? 'copy' : 'move';
    }
  };

  // Handle cell drag leave
  const handleCellDragLeave = () => {
    setDragOverCell(null);
    setFileDragOverCell(null);
  };

  // Handle image file drop on cell
  const handleCellImageDrop = async (dayIndex: number, slotIndex: number, file: File) => {
    if (!file.type.startsWith('image/') || !currentWeek) return;

    setUploadingImageCell({ dayIndex, slotIndex });
    setFileDragOverCell(null);

    try {
      let imageUrl: string;

      // Upload to storage if handler provided, otherwise use temporary blob URL
      if (onUploadCellImage) {
        const uploadedUrl = await onUploadCellImage(file);
        if (!uploadedUrl) {
          console.error('Failed to upload cell image');
          return;
        }
        imageUrl = uploadedUrl;
      } else {
        // Fallback to temporary blob URL (won't persist after refresh)
        imageUrl = URL.createObjectURL(file);
      }

      const existingCell = getCellAt(dayIndex, slotIndex);

      if (existingCell) {
        // Update existing cell with image
        updateCell(dayIndex, slotIndex, {
          imageUrl,
        });
      } else {
        // Create new cell with image
        updateCell(dayIndex, slotIndex, {
          title: isRTL ? 'פעילות חדשה' : 'New Activity',
          backgroundColor: CELL_COLOR_PALETTE[Math.floor(Math.random() * CELL_COLOR_PALETTE.length)],
          imageUrl,
        });
      }
    } catch (error) {
      console.error('Error uploading cell image:', error);
    } finally {
      setUploadingImageCell(null);
    }
  };

  // Handle cell drop
  const handleCellDrop = (targetDayIndex: number, targetSlotIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if it's a file drop
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleCellImageDrop(targetDayIndex, targetSlotIndex, files[0]);
      return;
    }

    setFileDragOverCell(null);

    if (!draggingCell || !currentWeek) {
      setDraggingCell(null);
      setDragOverCell(null);
      return;
    }

    // If dropping on same cell, do nothing
    if (draggingCell.dayIndex === targetDayIndex && draggingCell.startSlotIndex === targetSlotIndex) {
      setDraggingCell(null);
      setDragOverCell(null);
      return;
    }

    // Check shift key from the event for copy operation
    const shouldCopy = e.shiftKey;

    let newCells = [...currentWeek.cells];

    if (shouldCopy) {
      // COPY: Create new cell at target location
      const existingAtTarget = newCells.findIndex(
        c => c.dayIndex === targetDayIndex && c.startSlotIndex === targetSlotIndex
      );

      const copiedCell: CalendarCell = {
        ...draggingCell,
        id: generateId(),
        dayIndex: targetDayIndex as DayOfWeek,
        startSlotIndex: targetSlotIndex,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (existingAtTarget >= 0) {
        // Replace existing cell
        newCells[existingAtTarget] = copiedCell;
      } else {
        // Add new cell
        newCells.push(copiedCell);
      }
    } else {
      // MOVE: Remove from original location and place at target
      const originalCellIndex = newCells.findIndex(
        c => c.id === draggingCell.id
      );

      if (originalCellIndex >= 0) {
        // Remove original
        newCells.splice(originalCellIndex, 1);
      }

      // Check if target has a cell
      const existingAtTarget = newCells.findIndex(
        c => c.dayIndex === targetDayIndex && c.startSlotIndex === targetSlotIndex
      );

      const movedCell: CalendarCell = {
        ...draggingCell,
        dayIndex: targetDayIndex as DayOfWeek,
        startSlotIndex: targetSlotIndex,
        updatedAt: new Date(),
      };

      if (existingAtTarget >= 0) {
        // Replace existing cell
        newCells[existingAtTarget] = movedCell;
      } else {
        // Add moved cell
        newCells.push(movedCell);
      }
    }

    const updatedWeeks = config.weeks.map((week, i) =>
      i === currentWeekIndex ? { ...week, cells: newCells } : week
    );

    setConfig({ ...config, weeks: updatedWeeks });
    setDraggingCell(null);
    setDragOverCell(null);
  };

  // Handle cell drag end
  const handleCellDragEnd = () => {
    setDraggingCell(null);
    setDragOverCell(null);
  };

  // Add time slot
  const addTimeSlot = () => {
    if (!currentWeek) return;

    const lastSlot = currentWeek.timeSlots[currentWeek.timeSlots.length - 1];
    const newStartTime = lastSlot?.endTime || '18:00';
    const [hours, minutes] = newStartTime.split(':').map(Number);
    const endHours = hours + 1;
    const newEndTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    const newSlot: TimeSlot = {
      id: generateId(),
      startTime: newStartTime,
      endTime: newEndTime,
      order: currentWeek.timeSlots.length,
    };

    const updatedWeeks = config.weeks.map((week, i) =>
      i === currentWeekIndex
        ? { ...week, timeSlots: [...week.timeSlots, newSlot] }
        : week
    );

    setConfig({ ...config, weeks: updatedWeeks });
  };

  // Check for activities in a time slot before deleting
  const handleDeleteTimeSlot = (slotIndex: number) => {
    if (!currentWeek || currentWeek.timeSlots.length <= 1) return;

    // Find all activities that use this time slot
    const affectedCells = currentWeek.cells.filter((cell) => {
      // Check if cell starts at this slot OR spans into this slot
      const cellEndSlot = cell.startSlotIndex + (cell.rowSpan || 1) - 1;
      return cell.startSlotIndex === slotIndex ||
             (cell.startSlotIndex < slotIndex && cellEndSlot >= slotIndex);
    });

    if (affectedCells.length > 0) {
      // Show confirmation modal with affected activities
      const activityNames = affectedCells.map(cell =>
        cell.title || (isRTL ? 'פעילות ללא שם' : 'Unnamed activity')
      );
      setDeleteSlotConfirm({
        show: true,
        slotIndex,
        affectedActivities: activityNames,
      });
    } else {
      // No activities - delete directly
      executeDeleteTimeSlot(slotIndex);
    }
  };

  // Actually delete the time slot
  const executeDeleteTimeSlot = (slotIndex: number) => {
    if (!currentWeek || currentWeek.timeSlots.length <= 1) return;

    const updatedSlots = currentWeek.timeSlots.filter((_, i) => i !== slotIndex);
    // Remove cells that start at this slot, and adjust cells that span into it
    const updatedCells = currentWeek.cells
      .filter((c) => c.startSlotIndex !== slotIndex)
      .map((c) => {
        // Adjust startSlotIndex for cells after the deleted slot
        if (c.startSlotIndex > slotIndex) {
          return { ...c, startSlotIndex: c.startSlotIndex - 1 };
        }
        // Adjust rowSpan for cells that span into the deleted slot
        const cellEndSlot = c.startSlotIndex + (c.rowSpan || 1) - 1;
        if (cellEndSlot >= slotIndex && c.startSlotIndex < slotIndex) {
          return { ...c, rowSpan: Math.max(1, (c.rowSpan || 1) - 1) };
        }
        return c;
      });

    const updatedWeeks = config.weeks.map((week, i) =>
      i === currentWeekIndex
        ? { ...week, timeSlots: updatedSlots, cells: updatedCells }
        : week
    );

    setConfig({ ...config, weeks: updatedWeeks });
    setDeleteSlotConfirm({ show: false, slotIndex: -1, affectedActivities: [] });
  };

  // Update time slot
  const updateTimeSlot = (slotIndex: number, updates: Partial<TimeSlot>) => {
    if (!currentWeek) return;

    const updatedSlots = currentWeek.timeSlots.map((slot, i) =>
      i === slotIndex ? { ...slot, ...updates } : slot
    );

    const updatedWeeks = config.weeks.map((week, i) =>
      i === currentWeekIndex ? { ...week, timeSlots: updatedSlots } : week
    );

    setConfig({ ...config, weeks: updatedWeeks });
  };

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
    } catch (err) {
      console.error('Image compression error:', err);
      // Fallback to original file
      setLandingImageFile(file);
      setLandingImagePreview(URL.createObjectURL(file));
      setLandingImageInfo({ name: file.name, originalSize: file.size, compressedSize: file.size });
    }
    setIsCompressingLanding(false);
  };

  // Handle landing image
  const handleLandingImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processLandingImage(file);
    }
  };

  // Handle landing image drag and drop
  const handleLandingImageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLandingImage(true);
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
    if (file && file.type.startsWith('image/')) {
      processLandingImage(file);
    }
  };

  // Download image helper
  const downloadImage = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Process and compress day background image
  const processDayBgImage = async (file: File) => {
    setIsCompressingDayBg(true);
    try {
      const { blob, originalSize, compressedSize } = await compressImage(file);
      const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
      setDayBgImageFile(compressedFile);
      const url = URL.createObjectURL(blob);
      setDayBgImagePreview(url);
      setDayBgImageInfo({ name: file.name, originalSize, compressedSize });
      setConfig({
        ...config,
        branding: { ...config.branding, dayBackgroundImageUrl: url },
      });
    } catch (err) {
      console.error('Image compression error:', err);
      // Fallback to original file
      setDayBgImageFile(file);
      const url = URL.createObjectURL(file);
      setDayBgImagePreview(url);
      setDayBgImageInfo({ name: file.name, originalSize: file.size, compressedSize: file.size });
      setConfig({
        ...config,
        branding: { ...config.branding, dayBackgroundImageUrl: url },
      });
    }
    setIsCompressingDayBg(false);
  };

  // Remove undefined values recursively (Firebase doesn't accept undefined)
  const removeUndefinedValues = <T,>(obj: T): T => {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => removeUndefinedValues(item)) as T;
    }
    if (typeof obj === 'object') {
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = removeUndefinedValues(value);
        }
      }
      return cleaned as T;
    }
    return obj;
  };

  // Handle save
  const handleSave = async () => {
    if (config.weeks.length === 0) {
      setError(isRTL ? 'יש להגדיר לפחות שבוע אחד' : 'At least one week is required');
      return;
    }

    // Clean undefined values before saving to Firebase
    const cleanedConfig = removeUndefinedValues(config);
    await onSave(cleanedConfig, landingImageFile || undefined, dayBgImageFile || undefined);

    // Show saved confirmation (modal stays open)
    setSaved(true);
  };

  // Format week date range
  const formatWeekRange = (weekStartDate: string): string => {
    const start = new Date(weekStartDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const startStr = start.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', options);
    const endStr = end.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', options);

    return `${startStr} - ${endStr}`;
  };

  // Tab buttons
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'schedule', label: isRTL ? 'לוח זמנים' : 'Schedule', icon: <Calendar className="w-4 h-4" /> },
    { id: 'landing', label: isRTL ? 'דף נחיתה' : 'Landing', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'attractions', label: isRTL ? 'אטרקציות' : 'Attractions', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'notes', label: isRTL ? 'מידע' : 'Info', icon: <Info className="w-4 h-4" /> },
    { id: 'settings', label: isRTL ? 'הגדרות' : 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

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
        <div className="sticky top-0 z-10 bg-bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent" />
              {isRTL ? 'תוכנית שבועית' : 'Weekly Calendar'}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-accent text-white'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {tab.icon}
                {tab.label}
                {/* Attractions count badge */}
                {tab.id === 'attractions' && config.attractions.length > 0 && (
                  <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${
                    activeTab === 'attractions' ? 'bg-white/20' : 'bg-accent text-white'
                  }`}>
                    {config.attractions.length}
                  </span>
                )}
              </button>
            ))}

            {/* QR Code & Preview Button */}
            {shortId && (
              <div className="flex items-center gap-2 ms-auto">
                <div className="bg-white p-1 rounded-lg">
                  <QRCodeSVG
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/v/${shortId}`}
                    size={36}
                    level="M"
                  />
                </div>
                <button
                  onClick={() => setShowPreview(true)}
                  className="p-2 rounded-lg transition-all bg-bg-secondary text-text-secondary hover:bg-bg-hover"
                  title={isRTL ? 'תצוגה מקדימה' : 'Preview'}
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error */}
          {error && (
            <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg mb-4">
              {error}
            </p>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && currentWeek && (
            <div className="space-y-6">
              {/* Week Navigator */}
              <div className="flex items-center justify-between">
                <button
                  onClick={goToPreviousWeek}
                  disabled={currentWeekIndex === 0}
                  className="p-2 rounded-lg hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-4">
                  <span className="text-lg font-medium text-text-primary">
                    {formatWeekRange(currentWeek.weekStartDate)}
                  </span>
                  <button
                    onClick={copyCurrentWeek}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-bg-secondary rounded-lg hover:bg-bg-hover text-text-secondary"
                    title={isRTL ? 'העתק שבוע' : 'Copy week'}
                  >
                    <Copy className="w-4 h-4" />
                    {isRTL ? 'העתק' : 'Copy'}
                  </button>
                </div>

                <button
                  onClick={goToNextWeek}
                  className="p-2 rounded-lg hover:bg-bg-secondary"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>

              {/* Calendar Grid - CSS Grid for proper rowSpan support */}
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  {/* Days Header - matches grid body columns */}
                  <div
                    className="grid gap-1 mb-2"
                    style={{ gridTemplateColumns: '85px repeat(7, 1fr)' }}
                  >
                    <div className="p-2 text-center text-sm font-medium text-text-primary/70">
                      <Clock className="w-4 h-4 mx-auto" />
                    </div>
                    {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                      <div
                        key={dayIndex}
                        className="p-2 text-center text-sm font-medium text-text-primary bg-bg-secondary rounded-lg"
                      >
                        {isRTL ? DAY_NAMES.he[dayIndex] : DAY_NAMES.en[dayIndex]}
                      </div>
                    ))}
                  </div>

                  {/* Single CSS Grid for entire calendar body */}
                  <div className="relative">
                    {/* Current Time Indicator */}
                    {timeIndicatorPosition !== null && timeIndicatorPosition >= 0 && timeIndicatorPosition <= 100 && (
                      <div
                        className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                        style={{ top: `${timeIndicatorPosition}%` }}
                      >
                        <div className="w-2 h-2 rounded-full bg-red-500/70 -ms-1" />
                        <div className="flex-1 h-px bg-red-500/60" />
                      </div>
                    )}
                    <div
                      className="grid gap-1 overflow-visible"
                      style={{
                        gridTemplateColumns: '85px repeat(7, 1fr)',
                        gridTemplateRows: `repeat(${currentWeek.timeSlots.length}, minmax(72px, auto))`,
                      }}
                    >
                    {/* Render time slots and cells */}
                    {currentWeek.timeSlots.map((slot, slotIndex) => (
                      <Fragment key={slot.id}>
                        {/* Time Column Cell */}
                        <div
                          className="flex items-center gap-0.5 p-1 bg-bg-secondary rounded-lg"
                          style={{ gridRow: slotIndex + 1, gridColumn: 1 }}
                        >
                          <div className="flex flex-col">
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => updateTimeSlot(slotIndex, { startTime: e.target.value })}
                              className="w-[62px] text-xs bg-transparent border-none focus:ring-0 p-0 text-text-primary [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:ms-0"
                            />
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => updateTimeSlot(slotIndex, { endTime: e.target.value })}
                              className="w-[62px] text-xs bg-transparent border-none focus:ring-0 p-0 text-text-secondary [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:ms-0"
                            />
                          </div>
                          <button
                            onClick={() => handleDeleteTimeSlot(slotIndex)}
                            className="p-0.5 text-text-primary/60 hover:text-danger disabled:opacity-30"
                            disabled={currentWeek.timeSlots.length <= 1}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Day Cells for this row */}
                        {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                          const cell = getCellAt(dayIndex, slotIndex);
                          const coveringCell = isCoveredBySpan(dayIndex, slotIndex);
                          const isDragOver = dragOverCell?.dayIndex === dayIndex && dragOverCell?.slotIndex === slotIndex;
                          const isDragging = draggingCell?.dayIndex === dayIndex && draggingCell?.startSlotIndex === slotIndex;
                          const isFileDragOver = fileDragOverCell?.dayIndex === dayIndex && fileDragOverCell?.slotIndex === slotIndex;
                          const isUploading = uploadingImageCell?.dayIndex === dayIndex && uploadingImageCell?.slotIndex === slotIndex;
                          const cellColSpan = cell?.colSpan || 1;
                          const cellRowSpan = cell?.rowSpan || 1;

                          // If this position is covered by another cell's span, don't render
                          if (coveringCell) {
                            return null;
                          }

                          return (
                            <div
                              key={`cell-${dayIndex}-${slotIndex}`}
                              draggable={!!cell}
                              onDragStart={(e) => cell && handleCellDragStart(cell, e)}
                              onDragOver={(e) => handleCellDragOver(dayIndex, slotIndex, e)}
                              onDragLeave={handleCellDragLeave}
                              onDrop={(e) => handleCellDrop(dayIndex, slotIndex, e)}
                              onDragEnd={handleCellDragEnd}
                              onClick={() => {
                                setEditingCell(cell || null);
                                setEditingCellDayIndex(dayIndex);
                                setEditingCellSlotIndex(slotIndex);
                              }}
                              className={`p-2 rounded-lg border-2 transition-all cursor-pointer relative overflow-hidden ${
                                isFileDragOver
                                  ? 'border-green-500 bg-green-500/20 scale-[1.02]'
                                  : isDragOver
                                    ? 'border-accent bg-accent/20 scale-[1.02]'
                                    : isDragging
                                      ? 'opacity-50 border-accent'
                                      : cell
                                        ? 'border-transparent hover:border-accent/30'
                                        : 'border-dashed border-border hover:border-accent/50'
                              }`}
                              style={{
                                gridRow: cellRowSpan > 1 ? `${slotIndex + 1} / span ${cellRowSpan}` : slotIndex + 1,
                                gridColumn: cellColSpan > 1 ? `${dayIndex + 2} / span ${cellColSpan}` : dayIndex + 2,
                                backgroundColor: (isFileDragOver || isDragOver) ? undefined : (cell?.backgroundColor || 'transparent'),
                                color: cell?.textColor || getContrastTextColor(cell?.backgroundColor || '#ffffff'),
                                minHeight: '60px',
                              }}
                            >
                              {/* Cell with image - show image prominently */}
                              {cell?.imageUrl ? (
                                <div className="absolute inset-0 flex flex-col">
                                  {/* Image area */}
                                  <div
                                    className="flex-1 bg-cover bg-center rounded-t-md"
                                    style={{ backgroundImage: `url(${cell.imageUrl})` }}
                                  />
                                  {/* Title overlay at bottom - only if title exists */}
                                  {cell.title && (
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 rounded-b-md">
                                      <p className="text-sm font-medium text-white truncate">{cell.title}</p>
                                    </div>
                                  )}
                                  {/* Image replacement drop zone indicator */}
                                  {isFileDragOver && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-green-500/50 z-20 rounded-md">
                                      <div className="text-center text-white">
                                        <ImageIcon className="w-6 h-6 mx-auto" />
                                        <span className="text-xs">{isRTL ? 'החלף תמונה' : 'Replace'}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : cell ? (
                                /* Cell without image */
                                <div className="text-start relative z-10 h-full flex flex-col justify-center">
                                  <p className="text-sm font-medium truncate">{cell.title}</p>
                                  {cell.description && (
                                    <p className="text-xs opacity-75 truncate">{cell.description}</p>
                                  )}
                                </div>
                              ) : (
                                /* Empty cell */
                                <div className="h-full flex items-center justify-center">
                                  <Plus className="w-4 h-4 text-text-secondary opacity-50" />
                                </div>
                              )}

                              {/* Span indicator for cells with content */}
                              {cell && (cellColSpan > 1 || cellRowSpan > 1) && !cell.imageUrl && (
                                <div className="absolute bottom-1 end-1 text-[10px] opacity-60 bg-black/20 px-1 rounded">
                                  {cellColSpan > 1 && `${cellColSpan}${isRTL ? 'י' : 'd'}`}
                                  {cellColSpan > 1 && cellRowSpan > 1 && '·'}
                                  {cellRowSpan > 1 && `${cellRowSpan}${isRTL ? 'ש' : 'h'}`}
                                </div>
                              )}

                              {/* RSVP registration count badge with native tooltip */}
                              {cell && config.enableRSVP && registrationCounts[cell.id] > 0 && (
                                <div
                                  className="absolute top-1 end-1 z-[60] bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center cursor-help hover:bg-green-600 transition-colors"
                                  title={`${isRTL ? 'אישרו' : 'Confirmed'}: ${confirmationCounts[cell.id] || 0}\n${isRTL ? 'צפויים להגיע' : 'Expected'}: ${registrationCounts[cell.id]}`}
                                >
                                  <AnimatedCount value={registrationCounts[cell.id]} />
                                </div>
                              )}

                              {/* File drop indicator for empty cells */}
                              {isFileDragOver && !cell?.imageUrl && (
                                <div className="absolute inset-0 flex items-center justify-center bg-green-500/30 z-20 rounded-md">
                                  <ImageIcon className="w-6 h-6 text-green-600" />
                                </div>
                              )}
                              {/* Uploading indicator */}
                              {isUploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20 rounded-md">
                                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                                </div>
                              )}
                              {/* Drop indicator for cell drag */}
                              {isDragOver && !isFileDragOver && (
                                <div className="absolute inset-0 flex items-center justify-center bg-accent/30 rounded-md">
                                  <span className="text-lg">{isShiftPressed ? '📋' : '➡️'}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                    </div>
                  </div>

                  {/* Add Time Slot Button */}
                  <button
                    onClick={addTimeSlot}
                    className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-lg text-text-secondary hover:border-accent hover:text-accent transition-colors mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isRTL ? 'הוסף שעה' : 'Add Time Slot'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Landing Tab */}
          {activeTab === 'landing' && (
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
                        backgroundColor: config.branding.landing.backgroundColor,
                      }}
                    >
                      {/* Background Image */}
                      {landingImagePreview && (
                        <>
                          {/* Loading placeholder */}
                          {!landingImageLoaded && (
                            <div className="absolute inset-0 bg-bg-secondary animate-pulse" />
                          )}
                          <img
                            src={landingImagePreview}
                            alt=""
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${landingImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                          />
                        </>
                      )}
                      {/* Dark overlay for text readability */}
                      {landingImagePreview && landingImageLoaded && (config.branding.landing.imageOverlayOpacity ?? 30) > 0 && (
                        <div
                          className="absolute inset-0"
                          style={{ backgroundColor: `rgba(0, 0, 0, ${(config.branding.landing.imageOverlayOpacity ?? 30) / 100})` }}
                        />
                      )}

                      {/* Content */}
                      <div className="relative z-10 text-center">
                        {config.branding.landing.title && (
                          <h1
                            className="text-2xl font-bold mb-2"
                            style={{ color: config.branding.landing.textColor }}
                          >
                            {config.branding.landing.title}
                          </h1>
                        )}
                        {config.branding.landing.subtitle && (
                          <p
                            className="text-base opacity-80 mb-8"
                            style={{ color: config.branding.landing.textColor }}
                          >
                            {config.branding.landing.subtitle}
                          </p>
                        )}
                        {/* Show button only if there's button text OR title/subtitle */}
                        {(config.branding.landing.enterButtonText || config.branding.landing.title || config.branding.landing.subtitle) && (
                          <>
                            <button
                              className="px-6 py-2.5 rounded-full font-medium text-sm transition-transform hover:scale-105"
                              style={{
                                backgroundColor: config.branding.landing.buttonColor || '#3b82f6',
                                color: config.branding.landing.textColor,
                              }}
                            >
                              {config.branding.landing.enterButtonText || (isRTL ? 'כניסה ללוח' : 'View Schedule')}
                            </button>
                            <p
                              className="mt-4 text-xs opacity-60 animate-pulse"
                              style={{ color: config.branding.landing.textColor }}
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
                {/* Splash Image */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">
                    {isRTL ? 'תמונת נחיתה' : 'Splash Image'}
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
                          <p className="text-sm text-text-primary font-medium truncate">
                            {landingImageInfo?.name || (isRTL ? 'תמונה נבחרה' : 'Image selected')}
                          </p>
                          {landingImageInfo && (
                            <p className="text-xs text-text-secondary">
                              {formatFileSize(landingImageInfo.originalSize)} → {formatFileSize(landingImageInfo.compressedSize)}
                            </p>
                          )}
                          <p className="text-xs text-accent mt-0.5">
                            {isRTL ? 'לחצו להחלפה' : 'Click to replace'}
                          </p>
                        </div>
                        {/* Compact slider */}
                        <div
                          className="flex flex-col items-center gap-0.5 px-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] text-text-secondary whitespace-nowrap">
                            {config.branding.landing.imageOverlayOpacity ?? 30}%
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="80"
                            step="5"
                            value={config.branding.landing.imageOverlayOpacity ?? 30}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                branding: {
                                  ...config.branding,
                                  landing: {
                                    ...config.branding.landing,
                                    imageOverlayOpacity: parseInt(e.target.value),
                                  },
                                },
                              })
                            }
                            className="w-16 h-1.5 bg-bg-hover rounded-lg appearance-none cursor-pointer accent-accent"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (landingImagePreview) {
                              downloadImage(landingImagePreview, landingImageInfo?.name || 'landing.webp');
                            }
                          }}
                          className="p-2 rounded-lg bg-bg-hover hover:bg-accent/20 text-text-secondary hover:text-accent transition-all"
                          title={isRTL ? 'הורד תמונה' : 'Download image'}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLandingImageFile(null);
                            setLandingImagePreview(null);
                            setLandingImageInfo(null);
                            setConfig({
                              ...config,
                              branding: {
                                ...config.branding,
                                landing: { ...config.branding.landing, splashImageUrl: undefined },
                              },
                            });
                          }}
                          className="p-2 rounded-lg bg-danger/20 hover:bg-danger/30 text-danger transition-all"
                          title={isRTL ? 'מחק תמונה' : 'Delete image'}
                        >
                          <X className="w-4 h-4" />
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

                {/* Title */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">
                    {isRTL ? 'כותרת' : 'Title'}
                  </label>
                  <input
                    type="text"
                    value={config.branding.landing.title || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        branding: {
                          ...config.branding,
                          landing: { ...config.branding.landing, title: e.target.value },
                        },
                      })
                    }
                    placeholder={isRTL ? 'הכניסו כותרת...' : 'Enter title...'}
                    className="input w-full"
                  />
                </div>

                {/* Subtitle */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">
                    {isRTL ? 'תת-כותרת' : 'Subtitle'}
                  </label>
                  <input
                    type="text"
                    value={config.branding.landing.subtitle || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        branding: {
                          ...config.branding,
                          landing: { ...config.branding.landing, subtitle: e.target.value },
                        },
                      })
                    }
                    placeholder={isRTL ? 'הכניסו תת-כותרת...' : 'Enter subtitle...'}
                    className="input w-full"
                  />
                </div>

                {/* Button Text */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">
                    {isRTL ? 'טקסט כפתור' : 'Button Text'}
                  </label>
                  <input
                    type="text"
                    value={config.branding.landing.enterButtonText || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        branding: {
                          ...config.branding,
                          landing: { ...config.branding.landing, enterButtonText: e.target.value },
                        },
                      })
                    }
                    placeholder={isRTL ? 'כניסה ללוח' : 'View Schedule'}
                    className="input w-full"
                  />
                </div>

                {/* Colors */}
                <div className="grid grid-cols-3 gap-3">
                  <ColorPicker
                    colors={['#1a1a2e', '#0f172a', '#16213e', '#1e293b', '#27272a', '#ffffff', '#dbeafe', '#fef3c7']}
                    value={config.branding.landing.backgroundColor}
                    onChange={(color) =>
                      setConfig({
                        ...config,
                        branding: {
                          ...config.branding,
                          landing: { ...config.branding.landing, backgroundColor: color },
                        },
                      })
                    }
                    label={isRTL ? 'רקע' : 'Background'}
                  />

                  <ColorPicker
                    colors={['#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#f59e0b', '#1a1a2e', '#16213e', '#27272a']}
                    value={config.branding.landing.buttonColor || '#3b82f6'}
                    onChange={(color) =>
                      setConfig({
                        ...config,
                        branding: {
                          ...config.branding,
                          landing: { ...config.branding.landing, buttonColor: color },
                        },
                      })
                    }
                    label={isRTL ? 'כפתור' : 'Button'}
                  />

                  <ColorPicker
                    colors={['#ffffff', '#1f2937', '#fbbf24', '#fef3c7', '#fce7f3']}
                    value={config.branding.landing.textColor}
                    onChange={(color) =>
                      setConfig({
                        ...config,
                        branding: {
                          ...config.branding,
                          landing: { ...config.branding.landing, textColor: color },
                        },
                      })
                    }
                    label={isRTL ? 'טקסט' : 'Text'}
                  />
                </div>

                {/* Page Background Image */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <label className="text-sm font-medium text-text-primary">
                    {isRTL ? 'תמונת רקע לדפים' : 'Pages Background Image'}
                  </label>

                  {/* Use Landing Image Toggle - only show if landing image exists */}
                  {(landingImagePreview || config.branding.landing.splashImageUrl) && (
                    <label className="flex items-center justify-between cursor-pointer p-3 bg-bg-secondary rounded-lg">
                      <span className="text-sm text-text-primary">
                        {isRTL ? 'השתמש בתמונת הנחיתה' : 'Use landing image'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setConfig({
                            ...config,
                            branding: {
                              ...config.branding,
                              useLandingImageForDays: !config.branding.useLandingImageForDays,
                              // Clear separate day image when using landing
                              dayBackgroundImageUrl: !config.branding.useLandingImageForDays
                                ? undefined
                                : config.branding.dayBackgroundImageUrl,
                            },
                          })
                        }
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          config.branding.useLandingImageForDays
                            ? 'bg-accent'
                            : 'bg-bg-hover'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            config.branding.useLandingImageForDays
                              ? isRTL ? 'start-0.5' : 'start-[22px]'
                              : isRTL ? 'start-[22px]' : 'start-0.5'
                          }`}
                        />
                      </button>
                    </label>
                  )}

                  {/* Separate Image Upload - only show if NOT using landing image */}
                  {!config.branding.useLandingImageForDays && (
                    <>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!isCompressingDayBg) setIsDraggingDayBgImage(true);
                        }}
                        onDragLeave={() => setIsDraggingDayBgImage(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingDayBgImage(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file && file.type.startsWith('image/') && !isCompressingDayBg) {
                            processDayBgImage(file);
                          }
                        }}
                        onClick={() => !isCompressingDayBg && dayBgImageInputRef.current?.click()}
                        className={`relative h-20 rounded-xl overflow-hidden bg-bg-secondary border-2 border-dashed cursor-pointer transition-all ${
                          isDraggingDayBgImage
                            ? 'border-accent bg-accent/10 scale-[1.02]'
                            : 'border-border hover:border-accent'
                        } ${isCompressingDayBg ? 'opacity-70 cursor-wait' : ''}`}
                      >
                        {isCompressingDayBg ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-text-secondary">
                            <Loader2 className="w-6 h-6 mb-1 animate-spin" />
                            <span className="text-xs">{isRTL ? 'מכווץ תמונה...' : 'Compressing...'}</span>
                          </div>
                        ) : config.branding.dayBackgroundImageUrl ? (
                          <div className="flex items-center gap-3 p-3 h-full">
                            <img
                              src={config.branding.dayBackgroundImageUrl}
                              alt=""
                              className="h-full aspect-video object-cover rounded-lg"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-text-primary font-medium truncate">
                                {dayBgImageInfo?.name || (isRTL ? 'תמונת רקע נבחרה' : 'Background selected')}
                              </p>
                              {dayBgImageInfo && (
                                <p className="text-xs text-text-secondary">
                                  {formatFileSize(dayBgImageInfo.originalSize)} → {formatFileSize(dayBgImageInfo.compressedSize)}
                                </p>
                              )}
                              <p className="text-xs text-accent mt-0.5">
                                {isRTL ? 'לחצו להחלפה' : 'Click to replace'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (config.branding.dayBackgroundImageUrl) {
                                  downloadImage(config.branding.dayBackgroundImageUrl, dayBgImageInfo?.name || 'background.webp');
                                }
                              }}
                              className="p-1.5 bg-bg-hover rounded-lg text-text-secondary hover:text-accent"
                              title={isRTL ? 'הורד תמונה' : 'Download'}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDayBgImageFile(null);
                                setDayBgImagePreview(null);
                                setDayBgImageInfo(null);
                                setConfig({
                                  ...config,
                                  branding: { ...config.branding, dayBackgroundImageUrl: undefined },
                                });
                              }}
                              className="p-1.5 bg-danger/20 rounded-full text-danger hover:bg-danger/30"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-text-secondary">
                            <ImageIcon className="w-6 h-6 mb-1" />
                            <span className="text-xs">{isRTL ? 'גררו תמונה או לחצו לבחירה' : 'Drag image or click to select'}</span>
                          </div>
                        )}
                      </div>
                      <input
                        ref={dayBgImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            processDayBgImage(file);
                          }
                        }}
                      />
                    </>
                  )}

                  {/* Glassmorphism Blur Toggle - show when any background image is set */}
                  {(config.branding.useLandingImageForDays || config.branding.dayBackgroundImageUrl) && (
                    <label className="flex items-center justify-between cursor-pointer p-3 bg-bg-secondary rounded-lg">
                      <span className="text-sm text-text-primary">
                        {isRTL ? 'אפקט זכוכית (טשטוש)' : 'Glassmorphism (blur)'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setConfig({
                            ...config,
                            branding: {
                              ...config.branding,
                              dayBackgroundBlur: !config.branding.dayBackgroundBlur,
                            },
                          })
                        }
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          config.branding.dayBackgroundBlur
                            ? 'bg-accent'
                            : 'bg-bg-hover'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            config.branding.dayBackgroundBlur
                              ? isRTL ? 'start-0.5' : 'start-[22px]'
                              : isRTL ? 'start-[22px]' : 'start-0.5'
                          }`}
                        />
                      </button>
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Attractions Tab */}
          {activeTab === 'attractions' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="text"
                  value={attractionSearch}
                  onChange={(e) => setAttractionSearch(e.target.value)}
                  placeholder={isRTL ? 'חיפוש אטרקציות...' : 'Search attractions...'}
                  className="input w-full ps-10"
                />
              </div>

              {/* Attractions List */}
              <div className="space-y-2">
                {config.attractions
                  .filter((a) => !attractionSearch || a.title.toLowerCase().includes(attractionSearch.toLowerCase()))
                  .map((attraction, index) => {
                    const isExpanded = expandedAttractionId === attraction.id;
                    const actualIndex = config.attractions.findIndex((a) => a.id === attraction.id);
                    const isDragging = draggingAttractionIndex === actualIndex;
                    const isDragOver = dragOverAttractionIndex === actualIndex;

                    return (
                      <div
                        key={attraction.id}
                        draggable={!attractionSearch}
                        onDragStart={(e) => {
                          setDraggingAttractionIndex(actualIndex);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggingAttractionIndex(null);
                          setDragOverAttractionIndex(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (draggingAttractionIndex !== null && draggingAttractionIndex !== actualIndex) {
                            setDragOverAttractionIndex(actualIndex);
                          }
                        }}
                        onDragLeave={() => {
                          setDragOverAttractionIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggingAttractionIndex !== null && draggingAttractionIndex !== actualIndex) {
                            // Reorder attractions
                            const newAttractions = [...config.attractions];
                            const [draggedItem] = newAttractions.splice(draggingAttractionIndex, 1);
                            newAttractions.splice(actualIndex, 0, draggedItem);
                            // Update order field
                            const updatedAttractions = newAttractions.map((a, i) => ({ ...a, order: i }));
                            setConfig({ ...config, attractions: updatedAttractions });
                          }
                          setDraggingAttractionIndex(null);
                          setDragOverAttractionIndex(null);
                        }}
                        className={`bg-bg-secondary rounded-xl overflow-hidden transition-all ${
                          isDragging ? 'opacity-50 scale-95' : ''
                        } ${isDragOver ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-primary' : ''}`}
                      >
                        {/* Header Row - Always Visible */}
                        <div
                          className="flex items-center gap-2 p-3 cursor-pointer hover:bg-bg-hover transition-colors"
                        >
                          {/* Drag Handle */}
                          {!attractionSearch && (
                            <div
                              className="cursor-grab active:cursor-grabbing p-1 -ms-1 text-text-secondary hover:text-text-primary"
                              title={isRTL ? 'גררו לשינוי סדר' : 'Drag to reorder'}
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>
                          )}
                          <div
                            onClick={() => setExpandedAttractionId(isExpanded ? null : attraction.id)}
                            className="flex items-center gap-3 flex-1 min-w-0"
                          >
                            <ChevronDown
                              className={`w-5 h-5 text-text-secondary transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                            />
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: attraction.backgroundColor || '#3B82F6' }}
                            />
                            <span className="flex-1 font-medium text-text-primary truncate">
                              {attraction.title || (isRTL ? 'אטרקציה ללא שם' : 'Untitled Attraction')}
                            </span>
                          </div>
                          {attraction.startTime && (
                            <span className="text-xs text-text-secondary">
                              {attraction.startTime}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = [...config.attractions];
                              updated[actualIndex] = { ...updated[actualIndex], isActive: !attraction.isActive };
                              setConfig({ ...config, attractions: updated });
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              attraction.isActive
                                ? 'text-green-500 hover:bg-green-500/10'
                                : 'text-text-secondary hover:bg-bg-hover'
                            }`}
                            title={attraction.isActive ? (isRTL ? 'גלוי ללקוחות' : 'Visible') : (isRTL ? 'מוסתר מלקוחות' : 'Hidden')}
                          >
                            {attraction.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfig({
                                ...config,
                                attractions: config.attractions.filter((_, i) => i !== actualIndex),
                              });
                              if (isExpanded) setExpandedAttractionId(null);
                            }}
                            className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="p-4 pt-0 space-y-4 border-t border-border/50">
                            <input
                              type="text"
                              value={attraction.title}
                              onChange={(e) => {
                                const updated = [...config.attractions];
                                updated[actualIndex] = { ...updated[actualIndex], title: e.target.value };
                                setConfig({ ...config, attractions: updated });
                              }}
                              placeholder={isRTL ? 'כותרת' : 'Title'}
                              className="input w-full text-lg font-medium"
                            />

                            {/* Rich Text Description */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-1 p-1 bg-bg-card rounded-lg border border-border flex-wrap">
                                {/* Undo Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const history = descriptionHistory[attraction.id] || [];
                                    if (history.length > 0) {
                                      const previousText = history[history.length - 1];
                                      const newHistory = history.slice(0, -1);
                                      setDescriptionHistory({ ...descriptionHistory, [attraction.id]: newHistory });
                                      const updated = [...config.attractions];
                                      updated[actualIndex] = { ...updated[actualIndex], description: previousText };
                                      setConfig({ ...config, attractions: updated });
                                    }
                                  }}
                                  disabled={!descriptionHistory[attraction.id]?.length}
                                  className="p-2 rounded hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={isRTL ? 'בטל (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
                                >
                                  <Undo2 className="w-4 h-4" />
                                </button>
                                <div className="w-px h-5 bg-border mx-1" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const textarea = document.getElementById(`desc-${attraction.id}`) as HTMLTextAreaElement;
                                    if (textarea) {
                                      const start = textarea.selectionStart;
                                      const end = textarea.selectionEnd;
                                      const text = attraction.description || '';
                                      const selectedText = text.substring(start, end);
                                      // Save to history before changing
                                      const history = descriptionHistory[attraction.id] || [];
                                      setDescriptionHistory({ ...descriptionHistory, [attraction.id]: [...history, text].slice(-20) });
                                      const newText = text.substring(0, start) + `**${selectedText}**` + text.substring(end);
                                      const updated = [...config.attractions];
                                      updated[actualIndex] = { ...updated[actualIndex], description: newText };
                                      setConfig({ ...config, attractions: updated });
                                    }
                                  }}
                                  className="p-2 rounded hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
                                  title={isRTL ? 'מודגש' : 'Bold'}
                                >
                                  <Bold className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const textarea = document.getElementById(`desc-${attraction.id}`) as HTMLTextAreaElement;
                                    if (textarea) {
                                      const start = textarea.selectionStart;
                                      const end = textarea.selectionEnd;
                                      const text = attraction.description || '';
                                      const selectedText = text.substring(start, end);
                                      const history = descriptionHistory[attraction.id] || [];
                                      setDescriptionHistory({ ...descriptionHistory, [attraction.id]: [...history, text].slice(-20) });
                                      const newText = text.substring(0, start) + `*${selectedText}*` + text.substring(end);
                                      const updated = [...config.attractions];
                                      updated[actualIndex] = { ...updated[actualIndex], description: newText };
                                      setConfig({ ...config, attractions: updated });
                                    }
                                  }}
                                  className="p-2 rounded hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
                                  title={isRTL ? 'נטוי' : 'Italic'}
                                >
                                  <Italic className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const textarea = document.getElementById(`desc-${attraction.id}`) as HTMLTextAreaElement;
                                    if (textarea) {
                                      const start = textarea.selectionStart;
                                      const end = textarea.selectionEnd;
                                      const text = attraction.description || '';
                                      const selectedText = text.substring(start, end);
                                      const url = prompt(isRTL ? 'הכניסו קישור:' : 'Enter URL:');
                                      if (url) {
                                        const history = descriptionHistory[attraction.id] || [];
                                        setDescriptionHistory({ ...descriptionHistory, [attraction.id]: [...history, text].slice(-20) });
                                        const newText = text.substring(0, start) + `[${selectedText || 'קישור'}](${url})` + text.substring(end);
                                        const updated = [...config.attractions];
                                        updated[actualIndex] = { ...updated[actualIndex], description: newText };
                                        setConfig({ ...config, attractions: updated });
                                      }
                                    }
                                  }}
                                  className="p-2 rounded hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
                                  title={isRTL ? 'קישור' : 'Link'}
                                >
                                  <Link2 className="w-4 h-4" />
                                </button>
                                <div className="w-px h-5 bg-border mx-1" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const textarea = document.getElementById(`desc-${attraction.id}`) as HTMLTextAreaElement;
                                    if (textarea) {
                                      const start = textarea.selectionStart;
                                      const text = attraction.description || '';
                                      const history = descriptionHistory[attraction.id] || [];
                                      setDescriptionHistory({ ...descriptionHistory, [attraction.id]: [...history, text].slice(-20) });
                                      const newText = text.substring(0, start) + '\n## ' + text.substring(start);
                                      const updated = [...config.attractions];
                                      updated[actualIndex] = { ...updated[actualIndex], description: newText };
                                      setConfig({ ...config, attractions: updated });
                                    }
                                  }}
                                  className="p-2 rounded hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
                                  title={isRTL ? 'כותרת גדולה' : 'Heading 2'}
                                >
                                  <Heading2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const textarea = document.getElementById(`desc-${attraction.id}`) as HTMLTextAreaElement;
                                    if (textarea) {
                                      const start = textarea.selectionStart;
                                      const text = attraction.description || '';
                                      const history = descriptionHistory[attraction.id] || [];
                                      setDescriptionHistory({ ...descriptionHistory, [attraction.id]: [...history, text].slice(-20) });
                                      const newText = text.substring(0, start) + '\n### ' + text.substring(start);
                                      const updated = [...config.attractions];
                                      updated[actualIndex] = { ...updated[actualIndex], description: newText };
                                      setConfig({ ...config, attractions: updated });
                                    }
                                  }}
                                  className="p-2 rounded hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
                                  title={isRTL ? 'כותרת קטנה' : 'Heading 3'}
                                >
                                  <Heading3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const textarea = document.getElementById(`desc-${attraction.id}`) as HTMLTextAreaElement;
                                    if (textarea) {
                                      const start = textarea.selectionStart;
                                      const text = attraction.description || '';
                                      const history = descriptionHistory[attraction.id] || [];
                                      setDescriptionHistory({ ...descriptionHistory, [attraction.id]: [...history, text].slice(-20) });
                                      const newText = text.substring(0, start) + '\n---\n' + text.substring(start);
                                      const updated = [...config.attractions];
                                      updated[actualIndex] = { ...updated[actualIndex], description: newText };
                                      setConfig({ ...config, attractions: updated });
                                    }
                                  }}
                                  className="p-2 rounded hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
                                  title={isRTL ? 'קו מפריד' : 'Divider'}
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <div className="w-px h-5 bg-border mx-1" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const textarea = document.getElementById(`desc-${attraction.id}`) as HTMLTextAreaElement;
                                    if (textarea) {
                                      const start = textarea.selectionStart;
                                      const text = attraction.description || '';
                                      const history = descriptionHistory[attraction.id] || [];
                                      setDescriptionHistory({ ...descriptionHistory, [attraction.id]: [...history, text].slice(-20) });
                                      const newText = text.substring(0, start) + '\n- ' + text.substring(start);
                                      const updated = [...config.attractions];
                                      updated[actualIndex] = { ...updated[actualIndex], description: newText };
                                      setConfig({ ...config, attractions: updated });
                                    }
                                  }}
                                  className="p-2 rounded hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
                                  title={isRTL ? 'רשימת נקודות' : 'Bullet List'}
                                >
                                  <List className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const textarea = document.getElementById(`desc-${attraction.id}`) as HTMLTextAreaElement;
                                    if (textarea) {
                                      const start = textarea.selectionStart;
                                      const text = attraction.description || '';
                                      const history = descriptionHistory[attraction.id] || [];
                                      setDescriptionHistory({ ...descriptionHistory, [attraction.id]: [...history, text].slice(-20) });
                                      const newText = text.substring(0, start) + '\n1. ' + text.substring(start);
                                      const updated = [...config.attractions];
                                      updated[actualIndex] = { ...updated[actualIndex], description: newText };
                                      setConfig({ ...config, attractions: updated });
                                    }
                                  }}
                                  className="p-2 rounded hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
                                  title={isRTL ? 'רשימה ממוספרת' : 'Numbered List'}
                                >
                                  <ListOrdered className="w-4 h-4" />
                                </button>
                              </div>
                              <textarea
                                id={`desc-${attraction.id}`}
                                value={attraction.description || ''}
                                onChange={(e) => {
                                  const updated = [...config.attractions];
                                  updated[actualIndex] = { ...updated[actualIndex], description: e.target.value };
                                  setConfig({ ...config, attractions: updated });
                                }}
                                onKeyDown={(e) => {
                                  // Handle Ctrl+Z / Cmd+Z for undo
                                  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                                    e.preventDefault();
                                    const history = descriptionHistory[attraction.id] || [];
                                    if (history.length > 0) {
                                      const previousText = history[history.length - 1];
                                      const newHistory = history.slice(0, -1);
                                      setDescriptionHistory({ ...descriptionHistory, [attraction.id]: newHistory });
                                      const updated = [...config.attractions];
                                      updated[actualIndex] = { ...updated[actualIndex], description: previousText };
                                      setConfig({ ...config, attractions: updated });
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  // Save to history on blur (when user finishes editing)
                                  const text = e.target.value;
                                  const history = descriptionHistory[attraction.id] || [];
                                  const lastInHistory = history[history.length - 1];
                                  if (text && text !== lastInHistory) {
                                    setDescriptionHistory({ ...descriptionHistory, [attraction.id]: [...history, text].slice(-20) });
                                  }
                                }}
                                placeholder={isRTL ? 'תיאור (תומך בעיצוב טקסט)' : 'Description (supports formatting)'}
                                className="input w-full min-h-[100px] font-mono text-sm"
                              />
                            </div>

                            <input
                              type="text"
                              value={attraction.youtubeUrl || ''}
                              onChange={(e) => {
                                const updated = [...config.attractions];
                                updated[actualIndex] = { ...updated[actualIndex], youtubeUrl: e.target.value };
                                setConfig({ ...config, attractions: updated });
                              }}
                              placeholder={isRTL ? 'קישור YouTube' : 'YouTube URL'}
                              className="input w-full"
                              dir="ltr"
                            />

                            {/* Day Selection + Time */}
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...config.attractions];
                                    updated[actualIndex] = { ...updated[actualIndex], dayIndices: undefined, dayIndex: undefined };
                                    setConfig({ ...config, attractions: updated });
                                  }}
                                  className={`px-2.5 py-1.5 text-xs rounded-lg border transition-all ${
                                    !attraction.dayIndices || attraction.dayIndices.length === 0
                                      ? 'bg-accent text-white border-accent'
                                      : 'bg-bg-card text-text-secondary border-border hover:border-accent'
                                  }`}
                                >
                                  {isRTL ? 'כל השבוע' : 'All'}
                                </button>
                                {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                                  const isSelected = attraction.dayIndices?.includes(d as DayOfWeek);
                                  return (
                                    <button
                                      key={d}
                                      type="button"
                                      onClick={() => {
                                        const updated = [...config.attractions];
                                        const currentDays = attraction.dayIndices || [];
                                        let newDays: DayOfWeek[];
                                        if (isSelected) {
                                          newDays = currentDays.filter(day => day !== d);
                                        } else {
                                          newDays = [...currentDays, d as DayOfWeek].sort((a, b) => a - b);
                                        }
                                        updated[actualIndex] = { ...updated[actualIndex], dayIndices: newDays.length > 0 ? newDays : undefined };
                                        setConfig({ ...config, attractions: updated });
                                      }}
                                      className={`w-8 h-8 text-xs rounded-lg border transition-all ${
                                        isSelected
                                          ? 'bg-accent text-white border-accent'
                                          : 'bg-bg-card text-text-secondary border-border hover:border-accent'
                                      }`}
                                    >
                                      {isRTL ? DAY_NAMES_SHORT.he[d] : DAY_NAMES_SHORT.en[d]}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="flex items-center gap-1.5 ms-auto">
                                <Clock className="w-4 h-4 text-text-secondary" />
                                <input
                                  type="time"
                                  value={attraction.startTime || ''}
                                  onChange={(e) => {
                                    const updated = [...config.attractions];
                                    updated[actualIndex] = { ...updated[actualIndex], startTime: e.target.value };
                                    setConfig({ ...config, attractions: updated });
                                  }}
                                  className="input w-20 text-xs py-1"
                                />
                                <span className="text-text-secondary">-</span>
                                <input
                                  type="time"
                                  value={attraction.endTime || ''}
                                  onChange={(e) => {
                                    const updated = [...config.attractions];
                                    updated[actualIndex] = { ...updated[actualIndex], endTime: e.target.value };
                                    setConfig({ ...config, attractions: updated });
                                  }}
                                  className="input w-20 text-xs py-1"
                                />
                              </div>
                            </div>

                            {/* Colors & Background */}
                            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/50">
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-text-secondary">{isRTL ? 'רקע' : 'BG'}</label>
                                <div className="flex gap-1">
                                  {['#1a1a2e', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'].map((color) => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={() => {
                                        const updated = [...config.attractions];
                                        updated[actualIndex] = { ...updated[actualIndex], backgroundColor: color };
                                        setConfig({ ...config, attractions: updated });
                                      }}
                                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                                        attraction.backgroundColor === color
                                          ? 'border-white ring-2 ring-accent scale-110'
                                          : 'border-transparent hover:scale-105'
                                      }`}
                                      style={{ backgroundColor: color }}
                                    />
                                  ))}
                                  <input
                                    type="color"
                                    value={attraction.backgroundColor || '#1a1a2e'}
                                    onChange={(e) => {
                                      const updated = [...config.attractions];
                                      updated[actualIndex] = { ...updated[actualIndex], backgroundColor: e.target.value };
                                      setConfig({ ...config, attractions: updated });
                                    }}
                                    className="w-6 h-6 rounded-full border-0 cursor-pointer"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-text-secondary">{isRTL ? 'טקסט' : 'Text'}</label>
                                <div className="flex gap-1">
                                  {['#ffffff', '#1f2937', '#fef3c7'].map((color) => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={() => {
                                        const updated = [...config.attractions];
                                        updated[actualIndex] = { ...updated[actualIndex], textColor: color };
                                        setConfig({ ...config, attractions: updated });
                                      }}
                                      className={`w-6 h-6 rounded-full border transition-all ${
                                        attraction.textColor === color
                                          ? 'ring-2 ring-accent scale-110'
                                          : 'hover:scale-105'
                                      }`}
                                      style={{ backgroundColor: color, borderColor: color === '#ffffff' ? '#d1d5db' : color }}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ms-auto">
                                <label className="text-xs text-text-secondary">{isRTL ? 'תמונת רקע' : 'BG Image'}</label>
                                {attraction.backgroundImageUrl ? (
                                  <div className="flex items-center gap-1">
                                    <div
                                      className="w-8 h-8 rounded bg-cover bg-center border border-border"
                                      style={{ backgroundImage: `url(${attraction.backgroundImageUrl})` }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...config.attractions];
                                        updated[actualIndex] = { ...updated[actualIndex], backgroundImageUrl: undefined };
                                        setConfig({ ...config, attractions: updated });
                                      }}
                                      className="p-1 text-danger hover:bg-danger/10 rounded"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <label className="px-2 py-1 text-xs bg-bg-card border border-border rounded cursor-pointer hover:border-accent transition-colors">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const url = URL.createObjectURL(file);
                                          const updated = [...config.attractions];
                                          updated[actualIndex] = { ...updated[actualIndex], backgroundImageUrl: url };
                                          setConfig({ ...config, attractions: updated });
                                        }
                                      }}
                                    />
                                    <ImageIcon className="w-4 h-4" />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Add Attraction Button */}
              <button
                onClick={() => {
                  const newAttraction: CalendarAttraction = {
                    id: generateId(),
                    title: '',
                    order: config.attractions.length,
                    isActive: true,
                  };
                  setConfig({
                    ...config,
                    attractions: [...config.attractions, newAttraction],
                  });
                  setExpandedAttractionId(newAttraction.id);
                }}
                className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-lg text-text-secondary hover:border-accent hover:text-accent transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>{isRTL ? 'הוסף אטרקציה' : 'Add Attraction'}</span>
              </button>
            </div>
          )}

          {/* Info/מידע Tab */}
          {activeTab === 'notes' && (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Phone Preview - same size as Landing tab */}
              <div className="flex-shrink-0 flex justify-center">
                <div className="relative bg-gray-900 rounded-[2.5rem] p-2 shadow-xl">
                  {/* Phone inner bezel */}
                  <div className="relative bg-black rounded-[2rem] overflow-hidden">
                    {/* Screen */}
                    <div
                      className="relative w-[280px] h-[500px] overflow-hidden rounded-[1.8rem] flex flex-col"
                      style={{
                        backgroundColor: config.notes?.backgroundColor || '#ffffff',
                      }}
                    >
                      {/* Background Image */}
                      {config.notes?.useLandingImage && (landingImagePreview || config.branding.landing.splashImageUrl) && (
                        <>
                          <img
                            src={landingImagePreview || config.branding.landing.splashImageUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover z-0"
                          />
                          {/* Dark overlay */}
                          <div
                            className="absolute inset-0 z-[1]"
                            style={{ backgroundColor: `rgba(0, 0, 0, ${(config.notes?.imageOverlayOpacity ?? 50) / 100})` }}
                          />
                        </>
                      )}

                      {/* Content */}
                      <div className="relative z-10 flex-1 p-5 overflow-y-auto">
                        {/* Title */}
                        {config.notes?.title && (
                          <h1
                            className="text-xl font-bold mb-3"
                            style={{ color: config.notes?.textColor || '#1f2937' }}
                          >
                            {config.notes.title}
                          </h1>
                        )}
                        {/* Rich Content */}
                        <div
                          className="text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:ps-4 [&_ol]:list-decimal [&_ol]:ps-4 [&_hr]:my-3 [&_p]:mb-2"
                          style={{ color: config.notes?.textColor || '#1f2937' }}
                          dangerouslySetInnerHTML={{
                            __html: config.notes?.content || `<p style="opacity: 0.5">${isRTL ? 'התוכן יופיע כאן...' : 'Content will appear here...'}</p>`,
                          }}
                        />
                      </div>

                      {/* Close Button */}
                      <div className="relative z-10 p-4">
                        <button
                          className="w-full py-2.5 rounded-xl text-sm font-medium"
                          style={{
                            backgroundColor: config.notes?.buttonColor || '#3b82f6',
                            color: '#ffffff',
                          }}
                        >
                          {config.notes?.buttonText || 'הבנתי'}
                        </button>
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
                {/* Enable Toggle */}
                <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-xl">
                  <div className="flex items-center gap-3">
                    <Info className="w-5 h-5 text-accent" />
                    <div>
                      <span className="font-medium text-text-primary">
                        {isRTL ? 'הפעל דף מידע' : 'Enable Info Page'}
                      </span>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {isRTL ? 'כפתור מידע יופיע בדף הנחיתה ובצפיין' : 'Info button will appear on landing and viewer'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        notes: {
                          ...(config.notes || DEFAULT_CALENDAR_NOTES),
                          enabled: !config.notes?.enabled,
                        },
                      })
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      config.notes?.enabled ? 'bg-accent' : 'bg-bg-hover'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        config.notes?.enabled
                          ? isRTL ? 'start-0.5' : 'start-[22px]'
                          : isRTL ? 'start-[22px]' : 'start-0.5'
                      }`}
                    />
                  </button>
                </div>

                {config.notes?.enabled && (
                  <>
                    {/* Title */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-primary">
                        {isRTL ? 'כותרת' : 'Title'}
                      </label>
                      <input
                        type="text"
                        value={config.notes?.title || ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            notes: {
                              ...(config.notes || DEFAULT_CALENDAR_NOTES),
                              title: e.target.value,
                            },
                          })
                        }
                        placeholder={isRTL ? 'הכניסו כותרת...' : 'Enter title...'}
                        className="input w-full"
                      />
                    </div>

                    {/* Rich Text Content (replaces subtitle) */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-primary">
                        {isRTL ? 'תוכן' : 'Content'}
                      </label>

                      {/* Toolbar */}
                      <div className="flex items-center gap-1 p-2 bg-bg-secondary border border-border rounded-t-xl">
                        <button
                          type="button"
                          onClick={() => document.execCommand('formatBlock', false, 'h2')}
                          className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                          title={isRTL ? 'כותרת גדולה' : 'Heading 1'}
                        >
                          <Heading1 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => document.execCommand('formatBlock', false, 'h3')}
                          className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                          title={isRTL ? 'כותרת קטנה' : 'Heading 2'}
                        >
                          <Heading2 className="w-4 h-4" />
                        </button>
                        <div className="w-px h-5 bg-border mx-1" />
                        <button
                          type="button"
                          onClick={() => document.execCommand('bold', false)}
                          className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                          title={isRTL ? 'הדגשה' : 'Bold'}
                        >
                          <Bold className="w-4 h-4" />
                        </button>
                        <div className="w-px h-5 bg-border mx-1" />
                        <button
                          type="button"
                          onClick={() => document.execCommand('insertUnorderedList', false)}
                          className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                          title={isRTL ? 'רשימת נקודות' : 'Bullet List'}
                        >
                          <List className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => document.execCommand('insertOrderedList', false)}
                          className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                          title={isRTL ? 'רשימה ממוספרת' : 'Numbered List'}
                        >
                          <ListOrdered className="w-4 h-4" />
                        </button>
                        <div className="w-px h-5 bg-border mx-1" />
                        <button
                          type="button"
                          onClick={() => document.execCommand('insertHorizontalRule', false)}
                          className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                          title={isRTL ? 'קו מפריד' : 'Divider'}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Content Editable Area */}
                      <div
                        ref={notesContentRef}
                        contentEditable
                        suppressContentEditableWarning
                        dir={isRTL ? 'rtl' : 'ltr'}
                        className="min-h-[120px] max-h-[200px] overflow-y-auto p-4 bg-bg-secondary border border-t-0 border-border rounded-b-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 prose prose-sm max-w-none [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_hr]:my-4 [&_hr]:border-border"
                        onInput={(e) => {
                          // Update config on every input to keep preview in sync
                          setConfig({
                            ...config,
                            notes: {
                              ...(config.notes || DEFAULT_CALENDAR_NOTES),
                              content: e.currentTarget.innerHTML,
                            },
                          });
                        }}
                      />
                    </div>

                    {/* Button Text */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-primary">
                        {isRTL ? 'טקסט כפתור' : 'Button Text'}
                      </label>
                      <input
                        type="text"
                        value={config.notes?.buttonText || 'הבנתי'}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            notes: {
                              ...(config.notes || DEFAULT_CALENDAR_NOTES),
                              buttonText: e.target.value,
                            },
                          })
                        }
                        placeholder={isRTL ? 'הבנתי' : 'Got it'}
                        className="input w-full"
                      />
                    </div>

                    {/* Colors - same as Landing tab */}
                    <div className="grid grid-cols-3 gap-3">
                      <ColorPicker
                        colors={['#1a1a2e', '#0f172a', '#16213e', '#1e293b', '#27272a', '#ffffff', '#dbeafe', '#fef3c7']}
                        value={config.notes?.backgroundColor || '#ffffff'}
                        onChange={(color) =>
                          setConfig({
                            ...config,
                            notes: {
                              ...(config.notes || DEFAULT_CALENDAR_NOTES),
                              backgroundColor: color,
                            },
                          })
                        }
                        label={isRTL ? 'רקע' : 'Background'}
                      />

                      <ColorPicker
                        colors={['#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#f59e0b', '#1a1a2e', '#16213e', '#27272a']}
                        value={config.notes?.buttonColor || '#3b82f6'}
                        onChange={(color) =>
                          setConfig({
                            ...config,
                            notes: {
                              ...(config.notes || DEFAULT_CALENDAR_NOTES),
                              buttonColor: color,
                            },
                          })
                        }
                        label={isRTL ? 'כפתור' : 'Button'}
                      />

                      <ColorPicker
                        colors={['#ffffff', '#1f2937', '#fbbf24', '#fef3c7', '#fce7f3']}
                        value={config.notes?.textColor || '#1f2937'}
                        onChange={(color) =>
                          setConfig({
                            ...config,
                            notes: {
                              ...(config.notes || DEFAULT_CALENDAR_NOTES),
                              textColor: color,
                            },
                          })
                        }
                        label={isRTL ? 'טקסט' : 'Text'}
                      />
                    </div>

                    {/* Use Landing Image as Background */}
                    {(landingImagePreview || config.branding.landing.splashImageUrl) && (
                      <div className="pt-4 border-t border-border">
                        <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg">
                          <span className="text-sm text-text-primary flex-shrink-0">
                            {isRTL ? 'השתמש בתמונת דף הנחיתה' : 'Use landing page image'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setConfig({
                                ...config,
                                notes: {
                                  ...(config.notes || DEFAULT_CALENDAR_NOTES),
                                  useLandingImage: !config.notes?.useLandingImage,
                                },
                              })
                            }
                            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                              config.notes?.useLandingImage
                                ? 'bg-accent'
                                : 'bg-bg-hover'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                config.notes?.useLandingImage
                                  ? isRTL ? 'start-0.5' : 'start-[22px]'
                                  : isRTL ? 'start-[22px]' : 'start-0.5'
                              }`}
                            />
                          </button>
                          {/* Inline Opacity Slider */}
                          {config.notes?.useLandingImage && (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <input
                                type="range"
                                min="0"
                                max="80"
                                step="5"
                                value={config.notes?.imageOverlayOpacity ?? 50}
                                onChange={(e) =>
                                  setConfig({
                                    ...config,
                                    notes: {
                                      ...(config.notes || DEFAULT_CALENDAR_NOTES),
                                      imageOverlayOpacity: parseInt(e.target.value),
                                    },
                                  })
                                }
                                className="flex-1 h-1.5 bg-bg-hover rounded-lg appearance-none cursor-pointer accent-accent"
                              />
                              <span className="text-xs text-text-secondary w-8 text-center">
                                {config.notes?.imageOverlayOpacity ?? 50}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* FAB Button Colors - for landing page */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        {isRTL ? 'כפתור מידע בדף הנחיתה' : 'Info FAB on Landing Page'}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <ColorPicker
                          colors={['#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#f59e0b', '#1a1a2e', '#16213e', '#27272a']}
                          value={config.notes?.fabButtonColor || '#3b82f6'}
                          onChange={(color) =>
                            setConfig({
                              ...config,
                              notes: {
                                ...(config.notes || DEFAULT_CALENDAR_NOTES),
                                fabButtonColor: color,
                              },
                            })
                          }
                          label={isRTL ? 'צבע כפתור' : 'Button'}
                        />

                        <ColorPicker
                          colors={['#ffffff', '#1f2937', '#fbbf24', '#fef3c7', '#000000']}
                          value={config.notes?.fabIconColor || '#ffffff'}
                          onChange={(color) =>
                            setConfig({
                              ...config,
                              notes: {
                                ...(config.notes || DEFAULT_CALENDAR_NOTES),
                                fabIconColor: color,
                              },
                            })
                          }
                          label={isRTL ? 'צבע אייקון' : 'Icon'}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-xl mx-auto">
              {/* Viewer Behavior */}
              <div className="space-y-4 p-4 bg-bg-secondary rounded-xl">
                <h3 className="font-medium text-text-primary">
                  {isRTL ? 'התנהגות צפיין' : 'Viewer Behavior'}
                </h3>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-text-secondary">
                    {isRTL ? 'הצג אזהרה לימים שעברו' : 'Show past day warning'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        showPastDayWarning: !config.showPastDayWarning,
                      })
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      config.showPastDayWarning ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                        config.showPastDayWarning ? 'end-1' : 'start-1'
                      }`}
                    />
                  </button>
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-text-secondary">
                    {isRTL ? 'הצג מחוון שעה נוכחית' : 'Show current time indicator'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        showCurrentTimeIndicator: !config.showCurrentTimeIndicator,
                      })
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      config.showCurrentTimeIndicator ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                        config.showCurrentTimeIndicator ? 'end-1' : 'start-1'
                      }`}
                    />
                  </button>
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-text-secondary">
                    {isRTL ? 'אפשר הרשמה לפעילויות (מגיעים)' : 'Enable RSVP for activities'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        enableRSVP: !config.enableRSVP,
                      })
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      config.enableRSVP ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                        config.enableRSVP ? 'end-1' : 'start-1'
                      }`}
                    />
                  </button>
                </label>
              </div>

              {/* Branding Colors */}
              <div className="space-y-4 p-4 bg-bg-secondary rounded-xl">
                <h3 className="font-medium text-text-primary">
                  {isRTL ? 'צבעים' : 'Colors'}
                </h3>

                <ColorPicker
                  colors={['#1a1a2e', '#0f172a', '#16213e', '#1e293b', '#27272a', '#ffffff', '#3b82f6', '#22c55e', '#8b5cf6']}
                  value={config.branding.headerBackgroundColor}
                  onChange={(color) =>
                    setConfig({
                      ...config,
                      branding: { ...config.branding, headerBackgroundColor: color },
                    })
                  }
                  label={isRTL ? 'צבע רקע כותרת' : 'Header Background'}
                />

                <ColorPicker
                  colors={['#ffffff', '#1f2937', '#fbbf24', '#f87171', '#fef3c7']}
                  value={config.branding.headerTextColor}
                  onChange={(color) =>
                    setConfig({
                      ...config,
                      branding: { ...config.branding, headerTextColor: color },
                    })
                  }
                  label={isRTL ? 'צבע טקסט כותרת' : 'Header Text'}
                />

                <ColorPicker
                  colors={['#1a1a2e', '#0f172a', '#16213e', '#1e293b', '#27272a', '#ffffff', '#f3f4f6', '#fef3c7', '#dbeafe']}
                  value={config.branding.dayBackgroundColor}
                  onChange={(color) =>
                    setConfig({
                      ...config,
                      branding: { ...config.branding, dayBackgroundColor: color },
                    })
                  }
                  label={isRTL ? 'צבע רקע דף' : 'Page Background'}
                />

                <ColorPicker
                  colors={['#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#8B5CF6', '#ffffff']}
                  value={config.branding.currentTimeIndicatorColor}
                  onChange={(color) =>
                    setConfig({
                      ...config,
                      branding: { ...config.branding, currentTimeIndicatorColor: color },
                    })
                  }
                  label={isRTL ? 'צבע מחוון שעה' : 'Time Indicator Color'}
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">
                    {isRTL ? 'שקיפות ימים שעברו' : 'Past Day Opacity'}
                  </label>
                  <input
                    type="range"
                    min="0.2"
                    max="0.8"
                    step="0.1"
                    value={config.branding.pastDayOpacity}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        branding: {
                          ...config.branding,
                          pastDayOpacity: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-text-secondary text-center">
                    {Math.round(config.branding.pastDayOpacity * 100)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cell Editor Modal */}
        {editingCellDayIndex >= 0 && editingCellSlotIndex >= 0 && activeTab === 'schedule' && (
          <CellEditorPopover
            cell={editingCell}
            dayIndex={editingCellDayIndex}
            slotIndex={editingCellSlotIndex}
            isRTL={isRTL}
            maxSlots={currentWeek?.timeSlots.length || 1}
            onSave={(updates) => {
              updateCell(editingCellDayIndex, editingCellSlotIndex, updates);
              setEditingCell(null);
              setEditingCellDayIndex(-1);
              setEditingCellSlotIndex(-1);
            }}
            onDelete={() => {
              deleteCell(editingCellDayIndex, editingCellSlotIndex);
              setEditingCell(null);
              setEditingCellDayIndex(-1);
              setEditingCellSlotIndex(-1);
            }}
            onClose={() => {
              setEditingCell(null);
              setEditingCellDayIndex(-1);
              setEditingCellSlotIndex(-1);
            }}
            onUploadImage={onUploadCellImage}
            onDeleteImage={onDeleteCellImage}
          />
        )}

        {/* Footer */}
        <div className="sticky bottom-0 z-10 bg-bg-card border-t border-border px-6 py-4">
          {/* Help hints - only show in schedule tab */}
          {activeTab === 'schedule' && (
            <div className="text-xs text-text-secondary mb-3 text-center leading-relaxed">
              {isRTL ? (
                <>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-bg-secondary rounded text-[10px] font-mono">גרירה</kbd>
                    פעילות בין תאים
                  </span>
                  <span className="mx-2">•</span>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-bg-secondary rounded text-[10px] font-mono">Shift</kbd>
                    + גרירה לשכפול
                  </span>
                  <span className="mx-2">•</span>
                  <span>גררו תמונה לתא ריק להוספה</span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-bg-secondary rounded text-[10px] font-mono">Drag</kbd>
                    activities between cells
                  </span>
                  <span className="mx-2">•</span>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-bg-secondary rounded text-[10px] font-mono">Shift</kbd>
                    + drag to duplicate
                  </span>
                  <span className="mx-2">•</span>
                  <span>Drop image on empty cell</span>
                </>
              )}
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover disabled:opacity-50"
            >
              {tCommon('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={loading || saved}
              className={`btn min-w-[120px] flex items-center justify-center gap-2 transition-all duration-300 ${
                saved
                  ? 'bg-green-500 text-white scale-105'
                  : 'bg-accent text-white hover:bg-accent-hover'
              } disabled:opacity-100`}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : saved ? (
                <>
                  <Check className="w-5 h-5 animate-[bounce_0.5s_ease-in-out]" />
                  <span>{isRTL ? 'נשמר!' : 'Saved!'}</span>
                </>
              ) : (
                isRTL ? 'שמור' : 'Save'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Time Slot Confirmation Modal */}
      {deleteSlotConfirm.show && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteSlotConfirm({ show: false, slotIndex: -1, affectedActivities: [] })}
          />
          <div className="relative bg-bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-danger">
              <div className="p-2 rounded-lg bg-danger/10">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold">
                {isRTL ? 'מחיקת שעה' : 'Delete Time Slot'}
              </h3>
            </div>

            <div className="space-y-3">
              <p className="text-text-primary">
                {isRTL
                  ? 'שעה זו מכילה פעילויות שיימחקו:'
                  : 'This time slot contains activities that will be deleted:'}
              </p>
              <ul className="bg-bg-secondary rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
                {deleteSlotConfirm.affectedActivities.map((name, i) => (
                  <li key={i} className="text-sm text-text-secondary flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
                    {name}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-text-secondary">
                {isRTL
                  ? 'האם אתה בטוח שברצונך למחוק את השעה ואת כל הפעילויות בה?'
                  : 'Are you sure you want to delete this time slot and all its activities?'}
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setDeleteSlotConfirm({ show: false, slotIndex: -1, affectedActivities: [] })}
                className="px-4 py-2 rounded-lg bg-bg-secondary hover:bg-bg-hover text-text-primary transition-colors"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={() => executeDeleteTimeSlot(deleteSlotConfirm.slotIndex)}
                className="px-4 py-2 rounded-lg bg-danger hover:bg-danger/90 text-white transition-colors"
              >
                {isRTL ? 'מחק' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Preview Modal */}
      {shortId && (
        <MobilePreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          url={`/v/${shortId}?utm_source=preview`}
          title={isRTL ? 'תוכנית שבועית' : 'Weekly Calendar'}
        />
      )}
    </div>
  );
}

// Cell Editor Popover Component
function CellEditorPopover({
  cell,
  dayIndex,
  slotIndex,
  isRTL,
  maxSlots,
  onSave,
  onDelete,
  onClose,
  onUploadImage,
  onDeleteImage,
}: {
  cell: CalendarCell | null;
  dayIndex: number;
  slotIndex: number;
  isRTL: boolean;
  maxSlots: number;
  onSave: (updates: Partial<CalendarCell>) => void;
  onDelete: () => void;
  onClose: () => void;
  onUploadImage?: (file: File) => Promise<string | null>;
  onDeleteImage?: (url: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(cell?.title || '');
  const [description, setDescription] = useState(cell?.description || '');
  const [backgroundColor, setBackgroundColor] = useState(cell?.backgroundColor || CELL_COLOR_PALETTE[0]);
  const [linkUrl, setLinkUrl] = useState(cell?.linkUrl || '');
  const [linkTitle, setLinkTitle] = useState(cell?.linkTitle || '');
  const [rowSpan, setRowSpan] = useState(cell?.rowSpan || 1);
  const [colSpan, setColSpan] = useState(cell?.colSpan || 1);
  const [imageUrl, setImageUrl] = useState(cell?.imageUrl || '');
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [cellImageInfo, setCellImageInfo] = useState<ImageFileInfo | null>(null);
  const [isCompressingCell, setIsCompressingCell] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Calculate max spans based on position
  const maxRowSpan = maxSlots - slotIndex;
  const maxColSpan = 7 - dayIndex;

  // Don't show if no cell is being edited and we're not creating new
  if (!cell && dayIndex < 0) return null;

  // Allow save if has title OR has image (image can work alone)
  const canSave = title.trim() || imageUrl;

  const handleSave = () => {
    if (!canSave) return;

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      backgroundColor,
      textColor: getContrastTextColor(backgroundColor),
      linkUrl: linkUrl.trim() || undefined,
      linkTitle: linkTitle.trim() || undefined,
      rowSpan,
      colSpan: colSpan > 1 ? colSpan : undefined,
      imageUrl: imageUrl || undefined,
    });
  };

  const processCellImage = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;

    setIsCompressingCell(true);
    try {
      const { blob, originalSize, compressedSize } = await compressImage(file, 800);
      const compressedFile = new File([blob], file.name, { type: blob.type });

      // Upload to storage if handler provided
      if (onUploadImage) {
        const uploadedUrl = await onUploadImage(compressedFile);
        if (uploadedUrl) {
          setImageUrl(uploadedUrl);
          setCellImageInfo({
            name: file.name,
            originalSize,
            compressedSize,
          });
          return;
        }
      }

      // Fallback to blob URL (won't persist)
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      setCellImageInfo({
        name: file.name,
        originalSize,
        compressedSize,
      });
    } catch (error) {
      console.error('Image compression failed:', error);
      // Fallback to original
      if (onUploadImage) {
        const uploadedUrl = await onUploadImage(file);
        if (uploadedUrl) {
          setImageUrl(uploadedUrl);
          setCellImageInfo({
            name: file.name,
            originalSize: file.size,
            compressedSize: file.size,
          });
          return;
        }
      }
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setCellImageInfo({
        name: file.name,
        originalSize: file.size,
        compressedSize: file.size,
      });
    } finally {
      setIsCompressingCell(false);
    }
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImage(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processCellImage(file);
  };

  const downloadCellImage = () => {
    if (imageUrl && cellImageInfo) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = cellImageInfo.name.replace(/\.[^/.]+$/, '.webp');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-4 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-text-primary">
            {cell ? (isRTL ? 'עריכת פעילות' : 'Edit Activity') : (isRTL ? 'הוספת פעילות' : 'Add Activity')}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-bg-secondary rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Image Upload Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true); }}
          onDragLeave={() => setIsDraggingImage(false)}
          onDrop={handleImageDrop}
          onClick={() => !isCompressingCell && imageInputRef.current?.click()}
          className={`relative aspect-video rounded-xl overflow-hidden bg-bg-secondary border-2 border-dashed transition-all ${
            isCompressingCell
              ? 'border-accent/50 cursor-wait'
              : isDraggingImage
                ? 'border-accent bg-accent/10 scale-[1.02] cursor-pointer'
                : 'border-border hover:border-accent cursor-pointer'
          }`}
        >
          {isCompressingCell ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-text-secondary">
              <Loader2 className="w-8 h-8 mb-2 animate-spin text-accent" />
              <span className="text-sm">{isRTL ? 'מכווץ תמונה...' : 'Compressing image...'}</span>
            </div>
          ) : imageUrl ? (
            <>
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  // Delete from server if it's a real URL (not blob)
                  if (imageUrl && !imageUrl.startsWith('blob:') && onDeleteImage) {
                    await onDeleteImage(imageUrl);
                  }
                  setImageUrl('');
                  setCellImageInfo(null);
                }}
                className="absolute top-2 end-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 inset-x-2 text-center">
                <span className="text-xs bg-black/50 text-white px-2 py-1 rounded">
                  {isRTL ? 'לחצו או גררו להחלפה' : 'Click or drag to replace'}
                </span>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-text-secondary">
              <ImageIcon className="w-8 h-8 mb-2" />
              <span className="text-sm">{isRTL ? 'לחצו או גררו תמונה' : 'Click or drag image'}</span>
              <span className="text-xs opacity-60">{isRTL ? '(אופציונלי)' : '(optional)'}</span>
            </div>
          )}
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && processCellImage(e.target.files[0])}
        />

        {/* File Info & Download */}
        {imageUrl && cellImageInfo && (
          <div className="flex items-center justify-between p-2 bg-bg-secondary rounded-lg text-xs">
            <div className="flex-1 min-w-0">
              <p className="text-text-primary truncate font-medium">{cellImageInfo.name}</p>
              <p className="text-text-secondary">
                {formatFileSize(cellImageInfo.originalSize)} → {formatFileSize(cellImageInfo.compressedSize)}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadCellImage();
              }}
              className="p-1.5 hover:bg-bg-hover rounded-lg text-text-secondary hover:text-accent"
              title={isRTL ? 'הורדה' : 'Download'}
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isRTL ? (imageUrl ? 'כותרת (אופציונלי עם תמונה)' : 'כותרת הפעילות') : (imageUrl ? 'Title (optional with image)' : 'Activity Title')}
          className="input w-full"
          autoFocus={!imageUrl}
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={isRTL ? 'תיאור (אופציונלי)' : 'Description (optional)'}
          className="input w-full min-h-[60px]"
        />

        <ColorPicker
          colors={CELL_COLOR_PALETTE}
          value={backgroundColor}
          onChange={setBackgroundColor}
          label={isRTL ? 'צבע רקע' : 'Background Color'}
        />

        <input
          type="text"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder={isRTL ? 'קישור (אופציונלי)' : 'Link URL (optional)'}
          className="input w-full"
          dir="ltr"
        />

        {linkUrl && (
          <input
            type="text"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder={isRTL ? 'טקסט כפתור' : 'Button Text'}
            className="input w-full"
          />
        )}

        {/* Span Controls */}
        <div className="flex gap-4 p-3 bg-bg-secondary rounded-lg">
          <div className="flex-1">
            <label className="text-xs text-text-secondary mb-1 block">
              {isRTL ? 'מספר שעות' : 'Time Slots'}
            </label>
            <select
              value={rowSpan}
              onChange={(e) => setRowSpan(Number(e.target.value))}
              className="input w-full text-sm"
            >
              {Array.from({ length: maxRowSpan }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {isRTL ? (n === 1 ? 'שעה' : 'שעות') : (n === 1 ? 'slot' : 'slots')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-text-secondary mb-1 block">
              {isRTL ? 'מספר ימים' : 'Days'}
            </label>
            <select
              value={colSpan}
              onChange={(e) => setColSpan(Number(e.target.value))}
              className="input w-full text-sm"
            >
              {Array.from({ length: maxColSpan }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {isRTL ? (n === 1 ? 'יום' : 'ימים') : (n === 1 ? 'day' : 'days')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          {cell && (
            <button
              onClick={onDelete}
              className="btn bg-danger/10 text-danger hover:bg-danger/20 px-4"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover flex-1"
          >
            {isRTL ? 'ביטול' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="btn bg-accent text-white hover:bg-accent-hover flex-1 disabled:opacity-50"
          >
            {isRTL ? 'שמור' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
