'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  ArrowRight,
  Save,
  Trash2,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  Plus,
  GripVertical,
  Video,
  FileText,
  Loader2,
  Eye,
  CopyPlus,
  Printer,
  Clock,
  RefreshCw,
  Folder as FolderIcon,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Pencil,
  Camera,
  Cloud,
  Gamepad2,
  QrCode,
  MessageCircle,
  Vote,
  CalendarDays,
  Smartphone,
  LayoutGrid,
  Users,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Crosshair,
  Map,
  Trophy,
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { getQRCode, updateQRCode, deleteQRCode, canEditCode, canDeleteCode, updateUserStorage, getUserFolders, createQRCode, getSiblingCodes } from '@/lib/db';
import { subscribeToCodeViews } from '@/lib/analytics';
import { QRCode as QRCodeType, MediaItem, MediaSchedule, Folder, CodeWidgets, RiddleContent, SelfiebeamContent, QRSign, LandingPageConfig } from '@/types';
import { QVoteConfig } from '@/types/qvote';
import { getCandidates, bulkCreateCandidates } from '@/lib/qvote';
import { QStageConfig } from '@/types/qstage';
import { WeeklyCalendarConfig } from '@/types/weeklycal';
import { QHuntConfig } from '@/types/qhunt';
import { QTreasureConfig } from '@/types/qtreasure';
import { QChallengeConfig } from '@/types/qchallenge';

// Helper function to remove undefined values from an object (Firestore doesn't accept undefined)
function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  for (const key in obj) {
    const value = obj[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      // Recursively process arrays
      result[key] = value.map((item) => {
        if (item !== null && typeof item === 'object' && !(item instanceof Date)) {
          return removeUndefined(item as Record<string, unknown>);
        }
        return item;
      }) as T[typeof key];
    } else if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      result[key] = removeUndefined(value as Record<string, unknown>) as T[typeof key];
    } else {
      result[key] = value;
    }
  }
  return result;
}
import DeleteConfirm from '@/components/modals/DeleteConfirm';
import ScheduleModal from '@/components/modals/ScheduleModal';
import MediaLinkModal from '@/components/modals/MediaLinkModal';
import AddLinkModal from '@/components/modals/AddLinkModal';
import RiddleModal from '@/components/modals/RiddleModal';
import WordCloudModal from '@/components/modals/WordCloudModal';
import SelfiebeamModal from '@/components/modals/SelfiebeamModal';
import QVoteModal from '@/components/modals/QVoteModal';
import QStageModal from '@/components/modals/QStageModal';
import WeeklyCalendarModal from '@/components/modals/WeeklyCalendarModal';
import QRSignModal from '@/components/modals/QRSignModal';
import WhatsAppWidgetModal from '@/components/modals/WhatsAppWidgetModal';
import ContactWidgetModal from '@/components/modals/ContactWidgetModal';
import ReplaceMediaConfirm from '@/components/modals/ReplaceMediaConfirm';
import MobilePreviewModal from '@/components/modals/MobilePreviewModal';
import LandingPageModal from '@/components/modals/LandingPageModal';
import QHuntModal from '@/components/modals/QHuntModal';
import QTreasureModal from '@/components/modals/QTreasureModal';
import QChallengeModal from '@/components/modals/QChallengeModal';
import PDFSettingsModal, { DEFAULT_PDF_SETTINGS, PDFFlipbookSettings } from '@/components/editor/PDFSettingsModal';
import { shouldShowLandingPage } from '@/lib/landingPage';
import { clsx } from 'clsx';
import { Settings } from 'lucide-react';

// Link type detection
type LinkType = 'whatsapp' | 'phone' | 'sms' | 'email' | 'url';

function detectLinkType(url?: string): LinkType {
  if (!url) return 'url';
  try {
    if (url.startsWith('tel:')) return 'phone';
    if (url.startsWith('sms:')) return 'sms';
    if (url.startsWith('mailto:')) return 'email';
    const urlObj = new URL(url);
    if (urlObj.hostname === 'wa.me' || urlObj.hostname === 'api.whatsapp.com') return 'whatsapp';
    return 'url';
  } catch {
    return 'url';
  }
}

// Helper function to extract phone number from URL (works for WhatsApp, phone, SMS)
function extractPhoneFromUrl(url?: string): string {
  if (!url) return '';
  try {
    if (url.startsWith('tel:')) {
      return url.replace('tel:', '').split('?')[0];
    }
    if (url.startsWith('sms:')) {
      return url.replace('sms:', '').split('?')[0];
    }
    const urlObj = new URL(url);
    if (urlObj.hostname === 'wa.me') {
      return urlObj.pathname.slice(1) || '';
    }
    if (urlObj.hostname === 'api.whatsapp.com') {
      return urlObj.searchParams.get('phone') || '';
    }
    return '';
  } catch {
    return '';
  }
}

// Helper function to extract email from mailto URL
function extractEmailFromUrl(url?: string): string {
  if (!url || !url.startsWith('mailto:')) return '';
  return url.replace('mailto:', '').split('?')[0];
}

// Helper function to extract message from URL (WhatsApp text, SMS body, email body)
function extractMessageFromUrl(url?: string): string {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('text') || urlObj.searchParams.get('body') || '';
  } catch {
    return '';
  }
}

// Helper function to get link type label
function getLinkTypeLabel(url?: string): string {
  const type = detectLinkType(url);
  switch (type) {
    case 'whatsapp': return 'WhatsApp';
    case 'phone': return 'טלפון';
    case 'sms': return 'SMS';
    case 'email': return 'אימייל';
    default: return 'לינק';
  }
}

// Helper function to get PDF page count
async function getPdfPageCount(url: string): Promise<number> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    const pdf = await pdfjsLib.getDocument(url).promise;
    return pdf.numPages;
  } catch (error) {
    console.error('Error getting PDF page count:', error);
    return 0;
  }
}

// Custom Tooltip component for styled tooltips
function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-bg-card border border-border rounded-lg shadow-xl z-[9999] whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none">
        <span className="text-xs text-text-primary font-medium">{text}</span>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-bg-card border-r border-b border-border transform rotate-45" />
      </div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CodeEditPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations('code');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tUploader = useTranslations('uploader');
  const tMedia = useTranslations('media');
  const locale = useLocale();
  const { user, refreshUser } = useAuth();
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  const [code, setCode] = useState<QRCodeType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replacingMediaId, setReplacingMediaId] = useState<string | null>(null);
  const [scheduleModal, setScheduleModal] = useState<{ isOpen: boolean; mediaId: string | null }>({
    isOpen: false,
    mediaId: null,
  });
  const [displayViews, setDisplayViews] = useState(0);
  const [views24h, setViews24h] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [folder, setFolder] = useState<Folder | null>(null);
  const prevViewsRef = useRef(0);

  // Drag and drop state for media reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // File drag-drop state for replacing media
  const [fileDragOverMediaId, setFileDragOverMediaId] = useState<string | null>(null);
  const [replaceConfirmModal, setReplaceConfirmModal] = useState<{
    isOpen: boolean;
    file: File | null;
    mediaId: string | null;
  }>({ isOpen: false, file: null, mediaId: null });

  // File drag-drop state for adding new media (drag over media list area)
  const [isDraggingOverMediaArea, setIsDraggingOverMediaArea] = useState(false);

  // Link modal state
  const [linkModal, setLinkModal] = useState<{ isOpen: boolean; mediaId: string | null }>({
    isOpen: false,
    mediaId: null,
  });

  // Delete media confirmation modal state
  const [deleteMediaModal, setDeleteMediaModal] = useState<{ isOpen: boolean; mediaId: string | null }>({
    isOpen: false,
    mediaId: null,
  });

  // Add link modal state
  const [addLinkModalOpen, setAddLinkModalOpen] = useState(false);
  const [addingLink, setAddingLink] = useState(false);

  // Edit link modal state (for link-type media)
  const [editLinkModal, setEditLinkModal] = useState<{ isOpen: boolean; mediaId: string | null; url: string }>({
    isOpen: false,
    mediaId: null,
    url: '',
  });

  // Riddle modal state
  const [riddleModalOpen, setRiddleModalOpen] = useState(false);
  const [addingRiddle, setAddingRiddle] = useState(false);
  const [editingRiddleId, setEditingRiddleId] = useState<string | null>(null);

  // WordCloud modal state
  const [wordCloudModalOpen, setWordCloudModalOpen] = useState(false);
  const [addingWordCloud, setAddingWordCloud] = useState(false);

  // Selfiebeam modal state
  const [selfiebeamModalOpen, setSelfiebeamModalOpen] = useState(false);
  const [addingSelfiebeam, setAddingSelfiebeam] = useState(false);
  const [editingSelfiebeamId, setEditingSelfiebeamId] = useState<string | null>(null);

  // Q.Vote modal state
  const [qvoteModalOpen, setQvoteModalOpen] = useState(false);
  const [editingQVoteId, setEditingQVoteId] = useState<string | null>(null);
  const [addingQVote, setAddingQVote] = useState(false);

  // Weekly Calendar modal state
  const [weeklyCalModalOpen, setWeeklyCalModalOpen] = useState(false);
  const [editingWeeklyCalId, setEditingWeeklyCalId] = useState<string | null>(null);
  const [addingWeeklyCal, setAddingWeeklyCal] = useState(false);

  // Q.Stage modal state
  const [qstageModalOpen, setQstageModalOpen] = useState(false);
  const [editingQStageId, setEditingQStageId] = useState<string | null>(null);
  const [addingQStage, setAddingQStage] = useState(false);

  // Q.Hunt modal state
  const [qhuntModalOpen, setQhuntModalOpen] = useState(false);
  const [editingQHuntId, setEditingQHuntId] = useState<string | null>(null);
  const [addingQHunt, setAddingQHunt] = useState(false);

  // Q.Treasure modal state
  const [qtreasureModalOpen, setQtreasureModalOpen] = useState(false);
  const [editingQTreasureId, setEditingQTreasureId] = useState<string | null>(null);
  const [addingQTreasure, setAddingQTreasure] = useState(false);

  // Q.Challenge modal state
  const [qchallengeModalOpen, setQchallengeModalOpen] = useState(false);
  const [editingQChallengeId, setEditingQChallengeId] = useState<string | null>(null);
  const [addingQChallenge, setAddingQChallenge] = useState(false);

  // Widget modals state
  const [qrSignModalOpen, setQrSignModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [contactWidgetModal, setContactWidgetModal] = useState<{
    isOpen: boolean;
    type: 'phone' | 'email' | 'sms' | 'navigation';
  }>({ isOpen: false, type: 'phone' });

  // Mobile preview modal state
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  // Landing page modal state
  const [landingPageModalOpen, setLandingPageModalOpen] = useState(false);

  // PDF settings modal state
  const [pdfSettingsModal, setPdfSettingsModal] = useState<{ isOpen: boolean; mediaId: string | null }>({
    isOpen: false,
    mediaId: null,
  });

  // Create separate experience modal state
  const [createSeparateModal, setCreateSeparateModal] = useState<{
    isOpen: boolean;
    mediaId: string | null;
    loading: boolean;
  }>({ isOpen: false, mediaId: null, loading: false });

  // Sibling codes navigation state
  const [siblingCodes, setSiblingCodes] = useState<QRCodeType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

  // Read slide direction from sessionStorage and clear after animation
  useEffect(() => {
    const slideDir = sessionStorage.getItem('codeSlideDirection');
    if (slideDir === 'left' || slideDir === 'right') {
      setSlideDirection(slideDir);
      sessionStorage.removeItem('codeSlideDirection');
      // Clear animation after it completes
      const timer = setTimeout(() => {
        setSlideDirection(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [id]); // Run when code id changes

  // Collapse states with localStorage persistence
  const [qrExpanded, setQrExpanded] = useState(true);
  const [widgetsExpanded, setWidgetsExpanded] = useState(false);

  // Load collapse states from localStorage on mount
  useEffect(() => {
    const savedQrExpanded = localStorage.getItem('codeEdit_qrExpanded');
    const savedWidgetsExpanded = localStorage.getItem('codeEdit_widgetsExpanded');

    if (savedQrExpanded !== null) {
      setQrExpanded(savedQrExpanded === 'true');
    }
    if (savedWidgetsExpanded !== null) {
      setWidgetsExpanded(savedWidgetsExpanded === 'true');
    }
  }, []);

  // Save collapse states to localStorage
  const handleQrToggle = () => {
    const newValue = !qrExpanded;
    setQrExpanded(newValue);
    localStorage.setItem('codeEdit_qrExpanded', String(newValue));
  };

  const handleWidgetsToggle = () => {
    const newValue = !widgetsExpanded;
    setWidgetsExpanded(newValue);
    localStorage.setItem('codeEdit_widgetsExpanded', String(newValue));
  };

  // Load code data
  useEffect(() => {
    const loadCode = async () => {
      try {
        const codeData = await getQRCode(id);
        if (!codeData) {
          router.push('/dashboard');
          return;
        }

        // Check permissions
        if (user && !canEditCode(codeData, user.id, user.role)) {
          router.push('/dashboard');
          return;
        }

        setCode(codeData);
        setTitle(codeData.title);

        // Load folder info if code is in a folder
        if (codeData.folderId && user) {
          const userFolders = await getUserFolders(user.id);
          const codeFolder = userFolders.find(f => f.id === codeData.folderId);
          if (codeFolder) {
            setFolder(codeFolder);
          }
        }

        // Load sibling codes for navigation (in separate try-catch to not break main flow)
        if (user) {
          try {
            const siblings = await getSiblingCodes(user.id, codeData.folderId);
            setSiblingCodes(siblings);
            const idx = siblings.findIndex(c => c.id === codeData.id);
            setCurrentIndex(idx >= 0 ? idx : 0);
          } catch (siblingError) {
            console.error('Error loading sibling codes:', siblingError);
            // Don't redirect - just skip navigation feature
          }
        }
      } catch (error) {
        console.error('Error loading code:', error);
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadCode();
    }
  }, [id, user, router]);

  // Animate view counter when code.views changes
  useEffect(() => {
    if (!code) return;

    const startValue = prevViewsRef.current === code.views ? 0 : prevViewsRef.current;
    const endValue = code.views;
    const duration = startValue === 0 ? 1000 : 500;
    const startTime = Date.now();

    setIsAnimating(true);

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * easeOut);

      setDisplayViews(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        prevViewsRef.current = code.views;
      }
    };

    requestAnimationFrame(animate);
  }, [code?.views]);

  // Subscribe to real-time view counts for this code
  useEffect(() => {
    if (!code) return;

    const unsubscribe = subscribeToCodeViews(
      [code.id],
      (viewsData) => {
        setViews24h(viewsData[code.id] || 0);
      },
      (error) => {
        console.error('Error subscribing to views:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [code?.id]);

  // Load page count for PDFs that don't have it stored
  useEffect(() => {
    if (!code) return;

    const loadMissingPageCounts = async () => {
      const pdfsWithoutPageCount = code.media.filter(
        m => m.type === 'pdf' && !m.pageCount
      );

      if (pdfsWithoutPageCount.length === 0) return;

      const updatedMedia = [...code.media];
      let hasUpdates = false;

      for (const pdf of pdfsWithoutPageCount) {
        const pageCount = await getPdfPageCount(pdf.url);
        if (pageCount > 0) {
          const index = updatedMedia.findIndex(m => m.id === pdf.id);
          if (index !== -1) {
            updatedMedia[index] = { ...updatedMedia[index], pageCount };
            hasUpdates = true;
          }
        }
      }

      if (hasUpdates) {
        // Update in database and local state
        await updateQRCode(code.id, { media: updatedMedia });
        setCode(prev => prev ? { ...prev, media: updatedMedia } : null);
      }
    };

    loadMissingPageCounts();
  }, [code?.id, code?.media.length]);

  const handleSave = async () => {
    if (!code) return;

    setSaving(true);
    try {
      await updateQRCode(code.id, { title });
      setCode((prev) => prev ? { ...prev, title } : null);
    } catch (error) {
      console.error('Error saving:', error);
      alert(tErrors('saveError'));
    } finally {
      setSaving(false);
    }
  };

  // Navigation functions for sibling codes
  const navigateToPrevCode = () => {
    if (siblingCodes.length <= 1) return;
    const prevIndex = currentIndex === 0
      ? siblingCodes.length - 1
      : currentIndex - 1;
    sessionStorage.setItem('codeSlideDirection', 'right');
    router.push(`/code/${siblingCodes[prevIndex].id}`);
  };

  const navigateToNextCode = () => {
    if (siblingCodes.length <= 1) return;
    const nextIndex = currentIndex === siblingCodes.length - 1
      ? 0
      : currentIndex + 1;
    sessionStorage.setItem('codeSlideDirection', 'left');
    router.push(`/code/${siblingCodes[nextIndex].id}`);
  };

  // Keyboard navigation between sibling codes
  useEffect(() => {
    if (siblingCodes.length <= 1) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate if user is typing in an input/textarea or if a modal is open
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.closest('[role="dialog"]')
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateToPrevCode();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateToNextCode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [siblingCodes.length, currentIndex]);

  const handleDelete = async () => {
    if (!code || !user) return;

    try {
      // Calculate total size of media uploaded by this user
      const totalSize = code.media
        .filter((m) => m.uploadedBy === user.id)
        .reduce((sum, m) => sum + m.size, 0);

      // Delete media from Vercel Blob
      for (const media of code.media) {
        if (media.type !== 'link') {
          await fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: media.url }),
          });
        }
      }

      // Delete from Firestore
      await deleteQRCode(code.id);

      // Update user storage
      if (totalSize > 0) {
        await updateUserStorage(user.id, -totalSize);
        await refreshUser();
      }

      // Navigate back to folder or dashboard
      if (folder) {
        router.push(`/dashboard?folder=${folder.id}`);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert(tErrors('deleteError'));
    }
  };

  const handleCopyLink = () => {
    if (!code) return;
    const url = `${window.location.origin}/v/${code.shortId}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShareWhatsApp = async () => {
    if (!code || !qrCanvasRef.current) return;
    const url = `${window.location.origin}/v/${code.shortId}`;
    const text = `${code.title}\n${url}`;

    // Try to share with image using Web Share API (works on mobile)
    const canvas = qrCanvasRef.current.querySelector('canvas');
    if (canvas && navigator.canShare) {
      try {
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/png');
        });
        const file = new File([blob], `${code.title}.png`, { type: 'image/png' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            text: text,
            files: [file],
          });
          return;
        }
      } catch {
        // Fall through to WhatsApp URL
      }
    }

    // Fallback: open WhatsApp with text only
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleDownloadQR = () => {
    if (!code || !qrCanvasRef.current) return;

    // Get the hidden high-res canvas
    const sourceCanvas = qrCanvasRef.current.querySelector('canvas');
    if (!sourceCanvas) return;

    // Create a new canvas to draw on (with sign overlay)
    const downloadCanvas = document.createElement('canvas');
    const ctx = downloadCanvas.getContext('2d');
    if (!ctx) return;

    const size = sourceCanvas.width;
    downloadCanvas.width = size;
    downloadCanvas.height = size;

    // Draw QR code
    ctx.drawImage(sourceCanvas, 0, 0);

    // Draw sign overlay if enabled
    const sign = code.widgets?.qrSign;
    if (sign?.enabled && sign.value) {
      const centerX = size / 2;
      const centerY = size / 2;
      const signRadius = size * 0.125; // 25% of QR / 2

      // Draw background circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, signRadius, 0, Math.PI * 2);
      ctx.fillStyle = sign.backgroundColor;
      ctx.fill();

      // Draw content
      ctx.fillStyle = sign.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (sign.type === 'text') {
        const fontSize = signRadius * (sign.value.length <= 2 ? 0.9 : 0.6);
        ctx.font = `bold ${fontSize}px Assistant, Arial, sans-serif`;
        ctx.fillText(sign.value, centerX, centerY);
      } else if (sign.type === 'emoji') {
        const fontSize = signRadius * 1.1;
        ctx.font = `${fontSize}px Arial, sans-serif`;
        ctx.fillText(sign.value, centerX, centerY);
      } else if (sign.type === 'icon') {
        // Import icon paths dynamically
        const { ICON_PATHS } = require('@/lib/iconPaths');
        const iconData = ICON_PATHS[sign.value];
        if (iconData) {
          const iconSize = signRadius * 1.3;
          ctx.save();
          ctx.translate(centerX - iconSize / 2, centerY - iconSize / 2);
          ctx.scale(iconSize / 24, iconSize / 24);
          ctx.strokeStyle = sign.color;
          ctx.fillStyle = sign.color;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          const paths = iconData.path.split(' M').map((p: string, i: number) => i === 0 ? p : 'M' + p);
          paths.forEach((pathStr: string) => {
            const path = new Path2D(pathStr);
            if (iconData.fill) {
              ctx.fill(path);
            } else {
              ctx.stroke(path);
            }
          });
          ctx.restore();
        }
      }
    }

    // Create download link
    const link = document.createElement('a');
    link.download = `${code.title}.png`;
    link.href = downloadCanvas.toDataURL('image/png');
    link.click();
  };

  const handleDuplicate = async () => {
    if (!code || !user) return;

    try {
      // Create new code with same media references (no actual file copy)
      // Copy all media properties to preserve settings like pdfSettings
      const newCode = await createQRCode(
        user.id,
        `${code.title} ${t('duplicateSuffix')}`,
        code.media.map((m) => {
          const mediaData: Record<string, unknown> = {
            url: m.url,
            type: m.type,
            size: 0, // Don't count storage again since it's same file
            order: m.order,
            uploadedBy: user.id,
          };
          // Copy all optional properties if they exist
          if (m.filename) mediaData.filename = m.filename;
          if (m.title) mediaData.title = m.title;
          if (m.pageCount) mediaData.pageCount = m.pageCount;
          if (m.pdfSettings) mediaData.pdfSettings = m.pdfSettings;
          if (m.schedule) mediaData.schedule = m.schedule;
          if (m.linkUrl) mediaData.linkUrl = m.linkUrl;
          if (m.linkTitle) mediaData.linkTitle = m.linkTitle;
          if (m.riddleContent) mediaData.riddleContent = m.riddleContent;
          if (m.selfiebeamContent) mediaData.selfiebeamContent = m.selfiebeamContent;
          // Deep copy Q.Vote config but reset stats (votes are NOT copied)
          if (m.qvoteConfig) {
            mediaData.qvoteConfig = removeUndefined({
              ...m.qvoteConfig,
              categories: m.qvoteConfig.categories ? m.qvoteConfig.categories.map((c) => removeUndefined({ ...c })) : [],
              formFields: m.qvoteConfig.formFields ? m.qvoteConfig.formFields.map((f) => removeUndefined({ ...f })) : [],
              verification: m.qvoteConfig.verification ? removeUndefined({ ...m.qvoteConfig.verification }) : undefined,
              // Reset stats to zero for the duplicate
              stats: {
                totalCandidates: 0,
                approvedCandidates: 0,
                totalVoters: 0,
                totalVotes: 0,
                finalsVoters: 0,
                finalsVotes: 0,
                lastUpdated: new Date(),
              },
              // Reset phase to registration for fresh start
              currentPhase: 'registration',
            });
          }
          if (m.weeklycalConfig) mediaData.weeklycalConfig = m.weeklycalConfig;
          return mediaData as Omit<MediaItem, 'id' | 'createdAt'>;
        })
      );

      // If this is a Q.Vote code, copy candidates too (without votes)
      const hasQVote = code.media.some((m) => m.type === 'qvote');
      if (hasQVote) {
        try {
          // Get all candidates from original code
          const originalCandidates = await getCandidates(code.id);

          if (originalCandidates.length > 0) {
            // Prepare candidates for bulk creation (reset vote counts)
            const candidatesToCopy = originalCandidates.map((c) => ({
              name: c.name,
              formData: c.formData || {},
              photos: c.photos || [],
              categoryId: c.categoryId,
              categoryIds: c.categoryIds || [],
              source: c.source,
              isApproved: c.isApproved,
              isFinalist: false, // Reset finalist status
              isHidden: c.isHidden,
              displayOrder: c.displayOrder,
              visitorId: c.visitorId,
            }));

            // Create candidates in the new code
            const result = await bulkCreateCandidates(newCode.id, candidatesToCopy);
            console.log(`Duplicated ${result.success} candidates to new code ${newCode.id}`);
          }
        } catch (candidateError) {
          console.error('Error copying candidates:', candidateError);
          // Don't fail the entire operation if candidates fail to copy
        }
      }

      // Navigate to the new code
      router.push(`/code/${newCode.id}`);
    } catch (error) {
      console.error('Error duplicating code:', error);
      alert(tErrors('duplicateError'));
    }
  };

  // Create separate experience from a single media item
  const handleCreateSeparateExperience = async (deleteFromOriginal: boolean) => {
    if (!code || !user || !createSeparateModal.mediaId) return;

    const media = code.media.find(m => m.id === createSeparateModal.mediaId);
    if (!media) return;

    setCreateSeparateModal(prev => ({ ...prev, loading: true }));

    try {
      // Determine the title based on media type
      let newTitle = '';
      if (media.type === 'riddle' && media.riddleContent?.title) {
        newTitle = media.riddleContent.title;
      } else if (media.type === 'selfiebeam' && media.selfiebeamContent?.title) {
        newTitle = media.selfiebeamContent.title;
      } else if (media.type === 'weeklycal') {
        newTitle = tMedia('weeklycal') || 'לוח פעילות';
      } else if (media.type === 'qvote') {
        newTitle = 'Q.Vote';
      } else if (media.type === 'qstage') {
        newTitle = 'Q.Stage';
      } else if (media.title) {
        newTitle = media.title;
      } else if (media.filename) {
        newTitle = media.filename;
      } else {
        newTitle = media.type.toUpperCase();
      }

      // Build media data object, only including defined fields
      const mediaData: Record<string, unknown> = {
        url: media.url || '',
        type: media.type,
        size: 0, // Don't count storage again since it's same file
        order: 0,
        uploadedBy: user.id,
      };

      // Only add optional fields if they exist
      if (media.filename) mediaData.filename = media.filename;
      if (media.title) mediaData.title = media.title;
      if (media.linkUrl) mediaData.linkUrl = media.linkUrl;
      if (media.linkTitle) mediaData.linkTitle = media.linkTitle;
      if (media.riddleContent) mediaData.riddleContent = media.riddleContent;
      if (media.selfiebeamContent) mediaData.selfiebeamContent = media.selfiebeamContent;
      if (media.weeklycalConfig) mediaData.weeklycalConfig = media.weeklycalConfig;
      if (media.qvoteConfig) mediaData.qvoteConfig = media.qvoteConfig;
      if (media.qstageConfig) mediaData.qstageConfig = media.qstageConfig;
      if (media.pdfSettings) mediaData.pdfSettings = media.pdfSettings;
      if (media.pageCount) mediaData.pageCount = media.pageCount;
      if (media.schedule) mediaData.schedule = media.schedule;

      // Create new code with just this media item
      const newCode = await createQRCode(
        user.id,
        newTitle,
        [mediaData as Omit<MediaItem, 'id' | 'createdAt'>]
      );

      // If deleteFromOriginal, remove the media from current code
      if (deleteFromOriginal) {
        const updatedMedia = code.media.filter(m => m.id !== createSeparateModal.mediaId);
        await updateQRCode(code.id, { media: updatedMedia });
      }

      // Navigate to the new code
      router.push(`/code/${newCode.id}`);
    } catch (error) {
      console.error('Error creating separate experience:', error);
      alert(tErrors('createCodeError'));
      setCreateSeparateModal({ isOpen: false, mediaId: null, loading: false });
    }
  };

  // Drag and drop handlers for media reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && index !== draggedIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Touch drag & drop handlers for mobile/tablet
  const touchStartY = useRef<number>(0);
  const touchStartIndex = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    // Only handle if touch started on grip handle
    const target = e.target as HTMLElement;
    if (!target.closest('.drag-handle')) return;

    touchStartY.current = e.touches[0].clientY;
    touchStartIndex.current = index;
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartIndex.current === null || !code) return;

    const touch = e.touches[0];
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);

    // Find the media item element under the touch point
    const mediaItem = elements.find(el => el.classList.contains('media-item'));
    if (mediaItem) {
      const indexStr = mediaItem.getAttribute('data-index');
      if (indexStr !== null) {
        const index = parseInt(indexStr, 10);
        if (index !== touchStartIndex.current) {
          setDragOverIndex(index);
        }
      }
    }
  };

  const handleTouchEnd = async () => {
    if (touchStartIndex.current === null || dragOverIndex === null || !code) {
      handleDragEnd();
      touchStartIndex.current = null;
      return;
    }

    const fromIndex = touchStartIndex.current;
    const toIndex = dragOverIndex;

    if (fromIndex !== toIndex) {
      // Reorder the media array
      const newMedia = [...code.media];
      const [draggedItem] = newMedia.splice(fromIndex, 1);
      newMedia.splice(toIndex, 0, draggedItem);

      // Update order property for each item
      const reorderedMedia = newMedia.map((item, idx) => ({
        ...item,
        order: idx,
      }));

      // Update local state immediately for responsive UI
      setCode((prev) => prev ? { ...prev, media: reorderedMedia } : null);

      // Save to Firebase
      try {
        await updateQRCode(code.id, { media: reorderedMedia });
      } catch (error) {
        console.error('Error saving media order:', error);
        // Revert on error
        setCode((prev) => prev ? { ...prev, media: code.media } : null);
      }
    }

    handleDragEnd();
    touchStartIndex.current = null;
  };

  // File drag-drop handlers for replacing media items
  const handleFileDragOver = (e: React.DragEvent, mediaId: string, mediaType: string) => {
    // Only handle file drags, not internal reordering
    if (e.dataTransfer.types.includes('Files')) {
      // Don't allow dropping on links, riddles, selfiebeams, or wordclouds
      if (mediaType === 'link' || mediaType === 'riddle' || mediaType === 'selfiebeam' || mediaType === 'wordcloud') {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setFileDragOverMediaId(mediaId);
    }
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragOverMediaId(null);
  };

  const handleFileDrop = (e: React.DragEvent, mediaId: string, mediaType: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragOverMediaId(null);

    // Don't allow dropping on links, riddles, selfiebeams, or wordclouds
    if (mediaType === 'link' || mediaType === 'riddle' || mediaType === 'selfiebeam' || mediaType === 'wordcloud') {
      return;
    }

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];

    // Validate file type
    const validTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
      'application/pdf'
    ];

    if (!validTypes.includes(file.type)) {
      alert(tUploader('unsupportedFileType'));
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(tUploader('fileTooLarge') + ' 5MB');
      return;
    }

    // Show confirmation modal
    setReplaceConfirmModal({
      isOpen: true,
      file,
      mediaId,
    });
  };

  const handleConfirmReplace = () => {
    if (replaceConfirmModal.file && replaceConfirmModal.mediaId) {
      handleReplaceMedia(replaceConfirmModal.mediaId, replaceConfirmModal.file);
    }
    setReplaceConfirmModal({ isOpen: false, file: null, mediaId: null });
  };

  // Handlers for dragging files over the media list area to ADD new media
  const handleMediaAreaDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOverMediaArea(true);
    }
  };

  const handleMediaAreaDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the container (not entering a child)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDraggingOverMediaArea(false);
    }
  };

  const handleMediaAreaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverMediaArea(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];

    // Validate file type
    const validTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
      'application/pdf'
    ];

    if (!validTypes.includes(file.type)) {
      alert(tUploader('unsupportedFileType'));
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(tUploader('fileTooLarge') + ' 5MB');
      return;
    }

    // Add new media (not replace)
    handleAddMedia(file);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (!code || draggedIndex === null || draggedIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    // Reorder the media array
    const newMedia = [...code.media];
    const [draggedItem] = newMedia.splice(draggedIndex, 1);
    newMedia.splice(dropIndex, 0, draggedItem);

    // Update order property for each item
    const reorderedMedia = newMedia.map((item, idx) => ({
      ...item,
      order: idx,
    }));

    // Update local state immediately for responsive UI
    setCode((prev) => prev ? { ...prev, media: reorderedMedia } : null);
    handleDragEnd();

    // Save to Firebase
    try {
      await updateQRCode(code.id, { media: reorderedMedia });
    } catch (error) {
      console.error('Error saving media order:', error);
      // Revert on error
      setCode((prev) => prev ? { ...prev, media: code.media } : null);
    }
  };

  const handleAddMedia = async (file: File) => {
    if (!code || !user) return;

    setUploading(true);
    try {
      // Upload to Vercel Blob
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await uploadResponse.json();

      // Get PDF page count if it's a PDF file
      let pageCount: number | undefined;
      if (uploadData.type === 'pdf') {
        pageCount = await getPdfPageCount(uploadData.url);
      }

      // Add to media array
      const newMedia: MediaItem = {
        id: `media_${Date.now()}`,
        url: uploadData.url,
        type: uploadData.type,
        size: uploadData.size,
        order: code.media.length,
        uploadedBy: user.id,
        filename: uploadData.filename,
        pageCount,
        createdAt: new Date(),
      };

      const updatedMedia = [...code.media, newMedia];
      await updateQRCode(code.id, { media: updatedMedia });

      // Update user storage
      await updateUserStorage(user.id, uploadData.size);
      await refreshUser();

      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
    } catch (error) {
      console.error('Error adding media:', error);
      alert(tErrors('uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleReplaceMedia = async (mediaId: string, file: File) => {
    if (!code || !user) return;

    setReplacingMediaId(mediaId);
    try {
      const oldMedia = code.media.find((m) => m.id === mediaId);
      if (!oldMedia) return;

      // Upload new file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await uploadResponse.json();

      // Delete old file if not a link
      if (oldMedia.type !== 'link') {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: oldMedia.url }),
        });

        // Update storage: remove old, add new
        if (oldMedia.uploadedBy === user.id) {
          await updateUserStorage(user.id, uploadData.size - oldMedia.size);
        } else {
          await updateUserStorage(user.id, uploadData.size);
        }
        await refreshUser();
      }

      // Get PDF page count if it's a PDF file
      let pageCount: number | undefined;
      if (uploadData.type === 'pdf') {
        pageCount = await getPdfPageCount(uploadData.url);
      }

      // Update media in array
      const updatedMedia = code.media.map((m) =>
        m.id === mediaId
          ? {
              ...m,
              url: uploadData.url,
              type: uploadData.type,
              size: uploadData.size,
              uploadedBy: user.id,
              filename: uploadData.filename,
              pageCount,
            }
          : m
      );

      await updateQRCode(code.id, { media: updatedMedia });
      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
    } catch (error) {
      console.error('Error replacing media:', error);
      alert(tErrors('replaceFileError'));
    } finally {
      setReplacingMediaId(null);
    }
  };

  const handleRemoveMedia = async (mediaId: string) => {
    if (!code || !user) return;

    const mediaToRemove = code.media.find((m) => m.id === mediaId);
    if (!mediaToRemove) return;

    try {
      // Delete from Vercel Blob if not a link
      if (mediaToRemove.type !== 'link') {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: mediaToRemove.url }),
        });

        // Update user storage if they uploaded it
        if (mediaToRemove.uploadedBy === user.id) {
          await updateUserStorage(user.id, -mediaToRemove.size);
          await refreshUser();
        }
      }

      // Remove from array
      const updatedMedia = code.media.filter((m) => m.id !== mediaId);
      await updateQRCode(code.id, { media: updatedMedia });

      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
    } catch (error) {
      console.error('Error removing media:', error);
      alert(tErrors('deleteError'));
    }
  };

  const handleSaveSchedule = async (schedule: MediaSchedule | undefined) => {
    if (!code || !scheduleModal.mediaId) return;

    try {
      const updatedMedia = code.media.map((m) =>
        m.id === scheduleModal.mediaId
          ? { ...m, schedule }
          : m
      );

      await updateQRCode(code.id, { media: updatedMedia });
      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert(tErrors('saveError'));
    }
  };

  const handleSaveMediaLink = async (linkUrl: string | undefined, linkTitle: string | undefined) => {
    if (!code || !linkModal.mediaId) return;

    try {
      const updatedMedia = code.media.map((m) =>
        m.id === linkModal.mediaId
          ? { ...m, linkUrl: linkUrl || undefined, linkTitle: linkTitle || undefined }
          : m
      );

      await updateQRCode(code.id, { media: updatedMedia });
      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
    } catch (error) {
      console.error('Error saving media link:', error);
      alert(tErrors('saveError'));
    }
  };

  // Handler for saving PDF flipbook settings
  const handleSavePdfSettings = async (settings: PDFFlipbookSettings) => {
    if (!code || !pdfSettingsModal.mediaId) return;

    try {
      const updatedMedia = code.media.map((m) =>
        m.id === pdfSettingsModal.mediaId
          ? { ...m, pdfSettings: settings }
          : m
      );

      await updateQRCode(code.id, { media: updatedMedia });
      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
      setPdfSettingsModal({ isOpen: false, mediaId: null });
    } catch (error) {
      console.error('Error saving PDF settings:', error);
      alert(tErrors('saveError'));
    }
  };

  // Handler for adding a standalone link as media
  const handleAddLink = async (linkUrl: string, title?: string) => {
    if (!code || !user) return;

    setAddingLink(true);
    try {
      const newMedia: MediaItem = {
        id: `media_${Date.now()}`,
        url: linkUrl,
        type: 'link',
        size: 0,
        order: code.media.length,
        uploadedBy: user.id,
        title: title,
        createdAt: new Date(),
      };

      const updatedMedia = [...code.media, newMedia];
      await updateQRCode(code.id, { media: updatedMedia });
      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
      setAddLinkModalOpen(false);
    } catch (error) {
      console.error('Error adding link:', error);
      alert(tErrors('saveError'));
    } finally {
      setAddingLink(false);
    }
  };

  // Handler for updating an existing link media
  const handleUpdateLink = async (linkUrl: string, title?: string) => {
    if (!code || !editLinkModal.mediaId) return;

    try {
      const updatedMedia = code.media.map((m) =>
        m.id === editLinkModal.mediaId
          ? { ...m, url: linkUrl, title: title }
          : m
      );
      await updateQRCode(code.id, { media: updatedMedia });
      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
      setEditLinkModal({ isOpen: false, mediaId: null, url: '' });
    } catch (error) {
      console.error('Error updating link:', error);
      alert(tErrors('saveError'));
    }
  };

  // Handler for adding a wordcloud as media
  const handleAddWordCloud = async (linkUrl: string, title?: string) => {
    if (!code || !user) return;

    setAddingWordCloud(true);
    try {
      const newMedia: MediaItem = {
        id: `media_${Date.now()}`,
        url: linkUrl,
        type: 'wordcloud',
        size: 0,
        order: code.media.length,
        uploadedBy: user.id,
        title: title,
        createdAt: new Date(),
      };

      const updatedMedia = [...code.media, newMedia];
      await updateQRCode(code.id, { media: updatedMedia });
      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
      setWordCloudModalOpen(false);
    } catch (error) {
      console.error('Error adding wordcloud:', error);
      alert(tErrors('saveError'));
    } finally {
      setAddingWordCloud(false);
    }
  };

  // Handler for adding or editing a riddle
  const handleSaveRiddle = async (content: RiddleContent, imageFiles: File[]) => {
    if (!code || !user) return;

    setAddingRiddle(true);
    try {
      // Get the original images from the existing riddle (if editing)
      const existingRiddle = editingRiddleId
        ? code.media.find(m => m.id === editingRiddleId)?.riddleContent
        : null;
      const originalImages = existingRiddle?.images || [];

      // Find images that were removed (in original but not in content.images)
      const removedImages = originalImages.filter(
        (url) => !content.images?.includes(url)
      );

      // Delete removed images from Vercel Blob
      for (const imageUrl of removedImages) {
        try {
          await fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: imageUrl }),
          });
        } catch (error) {
          console.error('Failed to delete image from blob:', error);
        }
      }

      let uploadedImageUrls: string[] = [...(content.images || [])];
      let totalImageSize = 0;

      // Upload any new images
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.id);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Image upload failed');
        }

        const uploadData = await uploadResponse.json();
        uploadedImageUrls.push(uploadData.url);
        totalImageSize += uploadData.size;
      }

      let updatedMedia: MediaItem[];

      if (editingRiddleId) {
        // Update existing riddle
        const existingMedia = code.media.find(m => m.id === editingRiddleId);
        const oldSize = existingMedia?.size || 0;

        updatedMedia = code.media.map((m) =>
          m.id === editingRiddleId
            ? {
                ...m,
                title: content.title,
                size: oldSize + totalImageSize,
                riddleContent: {
                  ...content,
                  images: uploadedImageUrls,
                },
              }
            : m
        );
      } else {
        // Create new riddle media item
        const newMedia: MediaItem = {
          id: `media_${Date.now()}`,
          url: '', // Riddle doesn't have a direct URL
          type: 'riddle',
          size: totalImageSize,
          order: code.media.length,
          uploadedBy: user.id,
          title: content.title,
          riddleContent: {
            ...content,
            images: uploadedImageUrls,
          },
          createdAt: new Date(),
        };
        updatedMedia = [...code.media, newMedia];
      }

      await updateQRCode(code.id, { media: updatedMedia });

      // Update user storage if images were uploaded
      if (totalImageSize > 0) {
        await updateUserStorage(user.id, totalImageSize);
        await refreshUser();
      }

      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
      setRiddleModalOpen(false);
      setEditingRiddleId(null);
    } catch (error) {
      console.error('Error saving riddle:', error);
      alert(tErrors('createRiddleError'));
    } finally {
      setAddingRiddle(false);
    }
  };

  // Handler for adding or editing a selfiebeam
  const handleSaveSelfiebeam = async (content: SelfiebeamContent, imageFiles: File[], logoFiles: File[]) => {
    if (!code || !user) return;

    setAddingSelfiebeam(true);
    try {
      // Get the original images and logos from the existing selfiebeam (if editing)
      const existingSelfiebeam = editingSelfiebeamId
        ? code.media.find(m => m.id === editingSelfiebeamId)?.selfiebeamContent
        : null;
      const originalImages = existingSelfiebeam?.images || [];
      const originalLogos = existingSelfiebeam?.companyLogos || [];

      // Find images that were removed (in original but not in content.images)
      const removedImages = originalImages.filter(
        (url) => !content.images?.includes(url)
      );

      // Find logos that were removed
      const removedLogos = originalLogos.filter(
        (url) => !content.companyLogos?.includes(url)
      );

      // Delete removed images from Vercel Blob
      for (const imageUrl of removedImages) {
        try {
          await fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: imageUrl }),
          });
        } catch (error) {
          console.error('Failed to delete image from blob:', error);
        }
      }

      // Delete removed logos from Vercel Blob
      for (const logoUrl of removedLogos) {
        try {
          await fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: logoUrl }),
          });
        } catch (error) {
          console.error('Failed to delete logo from blob:', error);
        }
      }

      let uploadedImageUrls: string[] = [...(content.images || [])];
      let uploadedLogoUrls: string[] = [...(content.companyLogos || [])];
      let totalImageSize = 0;

      // Upload any new images
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.id);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Image upload failed');
        }

        const uploadData = await uploadResponse.json();
        uploadedImageUrls.push(uploadData.url);
        totalImageSize += uploadData.size;
      }

      // Upload any new logos
      for (const file of logoFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.id);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Logo upload failed');
        }

        const uploadData = await uploadResponse.json();
        uploadedLogoUrls.push(uploadData.url);
        totalImageSize += uploadData.size;
      }

      let updatedMedia: MediaItem[];

      // Build selfiebeamContent without undefined values for Firebase
      const selfiebeamContent: SelfiebeamContent = {
        title: content.title,
        content: content.content,
        backgroundColor: content.backgroundColor,
        textColor: content.textColor,
        images: uploadedImageUrls.length > 0 ? uploadedImageUrls : [],
        galleryEnabled: content.galleryEnabled || false,
        allowAnonymous: content.allowAnonymous ?? true,
        companyLogos: uploadedLogoUrls.length > 0 ? uploadedLogoUrls : [],
      };
      if (content.youtubeUrl) {
        selfiebeamContent.youtubeUrl = content.youtubeUrl;
      }

      if (editingSelfiebeamId) {
        // Update existing selfiebeam
        const existingMedia = code.media.find(m => m.id === editingSelfiebeamId);
        const oldSize = existingMedia?.size || 0;

        updatedMedia = code.media.map((m) =>
          m.id === editingSelfiebeamId
            ? {
                ...m,
                title: content.title,
                size: oldSize + totalImageSize,
                selfiebeamContent,
              }
            : m
        );
      } else {
        // Create new selfiebeam media item
        const newMedia: MediaItem = {
          id: `media_${Date.now()}`,
          url: '', // Selfiebeam doesn't have a direct URL
          type: 'selfiebeam',
          size: totalImageSize,
          order: code.media.length,
          uploadedBy: user.id,
          title: content.title,
          selfiebeamContent,
          createdAt: new Date(),
        };
        updatedMedia = [...code.media, newMedia];
      }

      await updateQRCode(code.id, { media: updatedMedia });

      // Update user storage if images were uploaded
      if (totalImageSize > 0) {
        await updateUserStorage(user.id, totalImageSize);
        await refreshUser();
      }

      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
      setSelfiebeamModalOpen(false);
      setEditingSelfiebeamId(null);
    } catch (error) {
      console.error('Error saving selfiebeam:', error);
      alert(tErrors('createSelfiebeamError'));
    } finally {
      setAddingSelfiebeam(false);
    }
  };

  // Handler for adding/editing Q.Vote
  const handleSaveQVote = async (config: QVoteConfig, landingImageFile?: File) => {
    if (!code || !user) return;

    setAddingQVote(true);
    try {
      let landingImageUrl: string | undefined;
      let totalImageSize = 0;

      // Upload landing image if provided
      if (landingImageFile) {
        const formData = new FormData();
        formData.append('file', landingImageFile);
        formData.append('userId', user.id);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload landing image');
        }

        const uploadData = await uploadResponse.json();
        landingImageUrl = uploadData.url;
        totalImageSize += uploadData.size;
      }

      // Create Q.Vote config with uploaded image URL (remove undefined values for Firestore)
      const qvoteConfig = removeUndefined({
        ...config,
        branding: {
          ...config.branding,
          landingImage: landingImageUrl || config.branding.landingImage,
          // Save image metadata if new image was uploaded
          ...(landingImageFile && landingImageUrl ? {
            landingImageName: landingImageFile.name,
            landingImageSize: totalImageSize,
          } : {}),
        },
      }) as QVoteConfig;

      let updatedMedia: MediaItem[];

      if (editingQVoteId) {
        // Editing existing Q.Vote
        updatedMedia = code.media.map((m) =>
          m.id === editingQVoteId
            ? { ...m, qvoteConfig, updatedAt: new Date() }
            : m
        );
      } else {
        // Create new Q.Vote media item
        const newMediaId = `media_${Date.now()}`;
        const newMedia: MediaItem = {
          id: newMediaId,
          url: '',
          type: 'qvote',
          size: totalImageSize,
          order: code.media.length,
          uploadedBy: user.id,
          title: 'Q.Vote',
          qvoteConfig,
          createdAt: new Date(),
        };
        updatedMedia = [...code.media, newMedia];
        // Set editing ID so subsequent saves update this item instead of creating new ones
        setEditingQVoteId(newMediaId);
      }

      // Clean all media items to remove undefined values
      const cleanedMedia = updatedMedia.map((m) => removeUndefined(m as unknown as Record<string, unknown>)) as unknown as MediaItem[];
      await updateQRCode(code.id, { media: cleanedMedia });

      // Update user storage if images were uploaded
      if (totalImageSize > 0) {
        await updateUserStorage(user.id, totalImageSize);
        await refreshUser();
      }

      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
      // Don't close modal - user will close it manually with X button
    } catch (error) {
      console.error('Error saving Q.Vote:', error);
      alert(tErrors('createCodeError'));
    } finally {
      setAddingQVote(false);
    }
  };

  // Handler for adding/editing Weekly Calendar
  const handleSaveWeeklyCal = async (config: WeeklyCalendarConfig, landingImageFile?: File, dayBgImageFile?: File) => {
    if (!code || !user) return;

    setAddingWeeklyCal(true);
    try {
      let finalConfig = { ...config };

      // Get existing media item to check for old images to delete
      const existingMedia = editingWeeklyCalId
        ? code.media.find(m => m.id === editingWeeklyCalId)
        : null;
      const existingConfig = existingMedia?.weeklycalConfig;

      // Check if landing image was deleted (old exists but new is undefined/empty)
      const oldLandingUrl = existingConfig?.branding?.landing?.splashImageUrl;
      const newLandingUrl = config.branding?.landing?.splashImageUrl;
      if (oldLandingUrl && !newLandingUrl && oldLandingUrl.includes('blob.vercel-storage.com')) {
        fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: oldLandingUrl }),
        }).catch(console.error);
      }

      // Upload landing image if provided
      if (landingImageFile) {
        // Delete old landing image if exists (being replaced)
        if (oldLandingUrl && oldLandingUrl.includes('blob.vercel-storage.com')) {
          fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: oldLandingUrl }),
          }).catch(console.error);
        }

        const formData = new FormData();
        formData.append('file', landingImageFile);
        formData.append('userId', user.id);
        formData.append('codeId', code.id);
        formData.append('folder', 'weeklycal');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (uploadRes.ok) {
          const { url } = await uploadRes.json();
          finalConfig = {
            ...finalConfig,
            branding: {
              ...finalConfig.branding,
              landing: {
                ...finalConfig.branding.landing,
                splashImageUrl: url,
              },
            },
          };
        }
      }

      // Check if day background image was deleted
      const oldDayBgUrl = existingConfig?.branding?.dayBackgroundImageUrl;
      const newDayBgUrl = config.branding?.dayBackgroundImageUrl;
      if (oldDayBgUrl && !newDayBgUrl && oldDayBgUrl.includes('blob.vercel-storage.com')) {
        fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: oldDayBgUrl }),
        }).catch(console.error);
      }

      // Upload day background image if provided
      if (dayBgImageFile) {
        // Delete old day background image if exists (being replaced)
        if (oldDayBgUrl && oldDayBgUrl.includes('blob.vercel-storage.com')) {
          fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: oldDayBgUrl }),
          }).catch(console.error);
        }

        const formData = new FormData();
        formData.append('file', dayBgImageFile);
        formData.append('userId', user.id);
        formData.append('codeId', code.id);
        formData.append('folder', 'weeklycal');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (uploadRes.ok) {
          const { url } = await uploadRes.json();
          finalConfig = {
            ...finalConfig,
            branding: {
              ...finalConfig.branding,
              dayBackgroundImageUrl: url,
            },
          };
        }
      }

      if (editingWeeklyCalId) {
        // Editing existing Weekly Calendar
        const updatedMedia = code.media.map((m) =>
          m.id === editingWeeklyCalId
            ? { ...m, weeklycalConfig: finalConfig, updatedAt: new Date() }
            : m
        );

        await updateQRCode(code.id, { media: updatedMedia });
        setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
        // Don't reset editingWeeklyCalId - keep it so subsequent saves update the same item
      } else {
        // Create new Weekly Calendar media item
        const newMediaId = `media_${Date.now()}`;
        const newMedia: MediaItem = {
          id: newMediaId,
          url: '',
          type: 'weeklycal',
          size: 0,
          order: code.media.length,
          uploadedBy: user.id,
          title: 'לוח פעילות',
          weeklycalConfig: finalConfig,
          createdAt: new Date(),
        };

        const updatedMedia = [...code.media, newMedia];
        await updateQRCode(code.id, { media: updatedMedia });
        setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
        // Set editing ID so subsequent saves update this item instead of creating new ones
        setEditingWeeklyCalId(newMediaId);
      }
      // Don't close modal - user will close it manually with X button
    } catch (error) {
      console.error('Error saving weekly calendar:', error);
      alert(tErrors('createCodeError'));
    } finally {
      setAddingWeeklyCal(false);
    }
  };

  // Handler for adding/editing Q.Stage
  const handleSaveQStage = async (config: QStageConfig, backgroundImageFile?: File, backgroundVideoFile?: File) => {
    if (!code || !user) return;

    setAddingQStage(true);
    try {
      let finalConfig = { ...config };
      let totalMediaSize = 0;

      // Get existing media item to check for old images to delete
      const existingMedia = editingQStageId
        ? code.media.find(m => m.id === editingQStageId)
        : null;
      const existingConfig = existingMedia?.qstageConfig;

      // Upload background image if provided
      if (backgroundImageFile) {
        // Delete old background image if exists (being replaced)
        const oldBgUrl = existingConfig?.backgroundImage;
        if (oldBgUrl && oldBgUrl.includes('blob.vercel-storage.com')) {
          fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: oldBgUrl }),
          }).catch(console.error);
        }

        const formData = new FormData();
        formData.append('file', backgroundImageFile);
        formData.append('userId', user.id);
        formData.append('codeId', code.id);
        formData.append('folder', 'qstage');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (uploadRes.ok) {
          const { url, size } = await uploadRes.json();
          finalConfig.backgroundImage = url;
          totalMediaSize += size || 0;
        }
      }

      // Upload background video if provided
      if (backgroundVideoFile) {
        // Delete old background video if exists (being replaced)
        const oldVideoUrl = existingConfig?.backgroundVideo;
        if (oldVideoUrl && oldVideoUrl.includes('blob.vercel-storage.com')) {
          fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: oldVideoUrl }),
          }).catch(console.error);
        }

        const formData = new FormData();
        formData.append('file', backgroundVideoFile);
        formData.append('userId', user.id);
        formData.append('codeId', code.id);
        formData.append('folder', 'qstage');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (uploadRes.ok) {
          const { url, size } = await uploadRes.json();
          finalConfig.backgroundVideo = url;
          totalMediaSize += size || 0;
        }
      }

      // Clean config for Firestore
      const qstageConfig = removeUndefined(finalConfig) as QStageConfig;

      let updatedMedia: MediaItem[];

      if (editingQStageId) {
        // Editing existing Q.Stage
        updatedMedia = code.media.map((m) =>
          m.id === editingQStageId
            ? { ...m, qstageConfig, updatedAt: new Date() }
            : m
        );
      } else {
        // Create new Q.Stage media item
        const newMediaId = `media_${Date.now()}`;
        const newMedia: MediaItem = {
          id: newMediaId,
          url: '',
          type: 'qstage',
          size: totalMediaSize,
          order: code.media.length,
          uploadedBy: user.id,
          title: 'Q.Stage',
          qstageConfig,
          createdAt: new Date(),
        };
        updatedMedia = [...code.media, newMedia];
        // Set editing ID so subsequent saves update this item instead of creating new ones
        setEditingQStageId(newMediaId);
      }

      await updateQRCode(code.id, { media: updatedMedia });

      // Update user storage if media was uploaded
      if (totalMediaSize > 0) {
        await updateUserStorage(user.id, totalMediaSize);
        await refreshUser();
      }

      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
      // Don't close modal - user will close it manually with X button
    } catch (error) {
      console.error('Error saving Q.Stage:', error);
      alert(tErrors('createCodeError'));
    } finally {
      setAddingQStage(false);
    }
  };

  // Handler for adding/editing Q.Hunt
  const handleSaveQHunt = async (config: QHuntConfig) => {
    if (!code || !user) return;

    setAddingQHunt(true);
    try {
      const qhuntConfig = { ...config };
      let updatedMedia: MediaItem[];

      if (editingQHuntId) {
        // Editing existing Q.Hunt
        updatedMedia = code.media.map((m) =>
          m.id === editingQHuntId
            ? { ...m, qhuntConfig, updatedAt: new Date() }
            : m
        );
      } else {
        // Create new Q.Hunt media item
        const newMediaId = `media_${Date.now()}`;
        const newMedia: MediaItem = {
          id: newMediaId,
          url: '',
          type: 'qhunt',
          size: 0,
          order: code.media.length,
          uploadedBy: user.id,
          title: 'Q.Hunt',
          qhuntConfig,
          createdAt: new Date(),
        };
        updatedMedia = [...code.media, newMedia];
        setEditingQHuntId(newMediaId);
      }

      await updateQRCode(code.id, { media: updatedMedia });
      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
    } catch (error) {
      console.error('Error saving Q.Hunt:', error);
      alert(tErrors('createCodeError'));
    } finally {
      setAddingQHunt(false);
    }
  };

  // Handler for adding/editing Q.Treasure
  const handleSaveQTreasure = async (config: QTreasureConfig) => {
    if (!code || !user) return;

    setAddingQTreasure(true);
    try {
      const qtreasureConfig = { ...config };
      let updatedMedia: MediaItem[];

      if (editingQTreasureId) {
        // Editing existing Q.Treasure
        updatedMedia = code.media.map((m) =>
          m.id === editingQTreasureId
            ? { ...m, qtreasureConfig, updatedAt: new Date() }
            : m
        );
      } else {
        // Create new Q.Treasure media item
        const newMediaId = `media_${Date.now()}`;
        const newMedia: MediaItem = {
          id: newMediaId,
          url: '',
          type: 'qtreasure',
          size: 0,
          order: code.media.length,
          uploadedBy: user.id,
          title: 'Q.Treasure',
          qtreasureConfig,
          createdAt: new Date(),
        };
        updatedMedia = [...code.media, newMedia];
        setEditingQTreasureId(newMediaId);
      }

      await updateQRCode(code.id, { media: updatedMedia });
      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
    } catch (error) {
      console.error('Error saving Q.Treasure:', error);
      alert(tErrors('createCodeError'));
    } finally {
      setAddingQTreasure(false);
    }
  };

  // Handler for adding/editing Q.Challenge
  const handleSaveQChallenge = async (config: QChallengeConfig, logoFile?: File, backgroundFile?: File) => {
    if (!code || !user) return;

    setAddingQChallenge(true);
    try {
      let logoUrl: string | undefined;
      let backgroundUrl: string | undefined;
      let totalSize = 0;

      // Get current media item for checking old files
      const currentMedia = editingQChallengeId
        ? code.media.find(m => m.id === editingQChallengeId)
        : undefined;
      const oldLogoUrl = currentMedia?.qchallengeConfig?.branding?.eventLogo;
      const oldBackgroundUrl = currentMedia?.qchallengeConfig?.branding?.backgroundImage;

      // Upload logo if provided
      if (logoFile) {
        // Delete old logo first if exists and different
        if (oldLogoUrl && oldLogoUrl !== config.branding.eventLogo) {
          try {
            await fetch('/api/upload', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: oldLogoUrl }),
            });
          } catch (e) {
            console.warn('Failed to delete old logo:', e);
          }
        }

        const formData = new FormData();
        formData.append('file', logoFile);
        formData.append('userId', user.id);
        formData.append('convertToWebp', 'false'); // Keep PNG for transparency

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          logoUrl = uploadData.url;
          totalSize += uploadData.size;
        }
      }

      // Upload background if provided
      if (backgroundFile) {
        // Delete old background first if exists and different
        if (oldBackgroundUrl && oldBackgroundUrl !== config.branding.backgroundImage) {
          try {
            await fetch('/api/upload', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: oldBackgroundUrl }),
            });
          } catch (e) {
            console.warn('Failed to delete old background:', e);
          }
        }

        const formData = new FormData();
        formData.append('file', backgroundFile);
        formData.append('userId', user.id);
        formData.append('convertToWebp', 'true'); // Convert background to webp for size

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          backgroundUrl = uploadData.url;
          totalSize += uploadData.size;
        }
      }

      // Handle case where background was removed (config has undefined but we had an old one)
      if (!config.branding.backgroundImage && oldBackgroundUrl && !backgroundFile) {
        try {
          await fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: oldBackgroundUrl }),
          });
        } catch (e) {
          console.warn('Failed to delete removed background:', e);
        }
      }

      // Create Q.Challenge config with uploaded URLs
      const qchallengeConfig = {
        ...config,
        branding: {
          ...config.branding,
          eventLogo: logoUrl || config.branding.eventLogo,
          backgroundImage: backgroundUrl || config.branding.backgroundImage,
        },
      };

      let updatedMedia: MediaItem[];

      if (editingQChallengeId) {
        // Editing existing Q.Challenge
        updatedMedia = code.media.map((m) =>
          m.id === editingQChallengeId
            ? { ...m, qchallengeConfig, updatedAt: new Date() }
            : m
        );
      } else {
        // Create new Q.Challenge media item
        const newMediaId = `media_${Date.now()}`;
        const newMedia: MediaItem = {
          id: newMediaId,
          url: '',
          type: 'qchallenge',
          size: totalSize,
          order: code.media.length,
          uploadedBy: user.id,
          title: 'Q.Challenge',
          qchallengeConfig,
          createdAt: new Date(),
        };
        updatedMedia = [...code.media, newMedia];
        setEditingQChallengeId(newMediaId);
      }

      await updateQRCode(code.id, { media: updatedMedia });
      setCode((prev) => prev ? { ...prev, media: updatedMedia } : null);
    } catch (error) {
      console.error('Error saving Q.Challenge:', error);
      alert(tErrors('createCodeError'));
    } finally {
      setAddingQChallenge(false);
    }
  };

  const handleSaveWhatsappWidget = async (config: CodeWidgets['whatsapp'] | undefined) => {
    if (!code) return;

    try {
      const updatedWidgets: CodeWidgets = {
        ...code.widgets,
      };

      if (config) {
        updatedWidgets.whatsapp = config;
      } else {
        delete updatedWidgets.whatsapp;
      }

      await updateQRCode(code.id, { widgets: updatedWidgets });
      setCode((prev) => prev ? { ...prev, widgets: updatedWidgets } : null);
    } catch (error) {
      console.error('Error saving WhatsApp widget:', error);
      alert(tErrors('saveError'));
    }
  };

  const handleSaveContactWidget = async (
    widgetType: 'phone' | 'email' | 'sms' | 'navigation',
    config: NonNullable<CodeWidgets[typeof widgetType]> | undefined
  ) => {
    if (!code) return;

    try {
      const updatedWidgets: CodeWidgets = {
        ...code.widgets,
      };

      if (config) {
        (updatedWidgets[widgetType] as typeof config) = config;
      } else {
        delete updatedWidgets[widgetType];
      }

      await updateQRCode(code.id, { widgets: updatedWidgets });
      setCode((prev) => prev ? { ...prev, widgets: updatedWidgets } : null);
    } catch (error) {
      console.error(`Error saving ${widgetType} widget:`, error);
      alert(tErrors('saveError'));
    }
  };

  const handleSaveQRSign = async (sign: QRSign | undefined) => {
    if (!code) return;

    try {
      const updatedWidgets: CodeWidgets = {
        ...code.widgets,
      };

      if (sign && sign.value) {
        updatedWidgets.qrSign = sign;
      } else {
        delete updatedWidgets.qrSign;
      }

      await updateQRCode(code.id, { widgets: updatedWidgets });
      setCode((prev) => prev ? { ...prev, widgets: updatedWidgets } : null);
    } catch (error) {
      console.error('Error saving QR sign:', error);
      alert(tErrors('saveError'));
    }
  };

  const handleTogglePWAEncourage = async () => {
    if (!code) return;

    try {
      const currentEnabled = code.widgets?.pwaEncourage?.enabled !== false; // Default is true
      const updatedWidgets: CodeWidgets = {
        ...code.widgets,
        pwaEncourage: { enabled: !currentEnabled },
      };

      await updateQRCode(code.id, { widgets: updatedWidgets });
      setCode((prev) => prev ? { ...prev, widgets: updatedWidgets } : null);
    } catch (error) {
      console.error('Error toggling PWA encourage:', error);
      alert(tErrors('saveError'));
    }
  };

  // Get the current media for link modal
  const currentMediaForLink = code?.media.find((m) => m.id === linkModal.mediaId);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatSchedule = (schedule?: MediaSchedule): string => {
    if (!schedule?.enabled) return '';
    const dateLocale = locale === 'he' ? 'he-IL' : 'en-US';
    const parts: string[] = [];
    if (schedule.startDate) {
      const dateStr = schedule.startDate.toLocaleDateString(dateLocale);
      parts.push(t('scheduleFrom', { date: dateStr }));
    }
    if (schedule.endDate) {
      const dateStr = schedule.endDate.toLocaleDateString(dateLocale);
      parts.push(t('scheduleTo', { date: dateStr }));
    }
    if (schedule.startTime && schedule.endTime) {
      parts.push(t('scheduleTime', { from: schedule.startTime, to: schedule.endTime }));
    } else if (schedule.startTime) {
      parts.push(`${schedule.startTime}`);
    } else if (schedule.endTime) {
      parts.push(`-${schedule.endTime}`);
    }
    return parts.join(' ');
  };

  // Check if schedule is currently active
  const isScheduleActive = (schedule?: MediaSchedule): boolean | null => {
    if (!schedule?.enabled) return null; // No schedule

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const { startDate, endDate, startTime, endTime } = schedule;

    // Check date range
    if (startDate && now < startDate) return false;
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      if (now > endOfDay) return false;
    }

    // Check time range
    if (startTime && currentTime < startTime) return false;
    if (endTime && currentTime > endTime) return false;

    return true;
  };

  // Check if landing page button should show (mixed media types)
  const shouldShowLandingPageButton = code && shouldShowLandingPage(code.media);

  // Handle save landing page config
  const handleSaveLandingPage = async (config: LandingPageConfig, backgroundImageFile?: File) => {
    if (!code || !user) return;

    let finalConfig = { ...config };

    // Upload background image if provided
    if (backgroundImageFile) {
      // Delete old image if exists
      const oldUrl = code.landingPageConfig?.backgroundImageUrl;
      if (oldUrl && oldUrl.includes('blob.vercel-storage.com')) {
        fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: oldUrl }),
        }).catch(console.error);
      }

      const formData = new FormData();
      formData.append('file', backgroundImageFile);
      formData.append('userId', user.id);
      formData.append('folder', 'landing');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const { url } = await uploadRes.json();
        finalConfig.backgroundImageUrl = url;
      }
    }

    await updateQRCode(code.id, { landingPageConfig: finalConfig });
    setCode(prev => prev ? { ...prev, landingPageConfig: finalConfig } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!code) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary">{t('codeNotFound')}</p>
      </div>
    );
  }

  const viewUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/v/${code.shortId}`;
  const currentMediaForSchedule = code.media.find((m) => m.id === scheduleModal.mediaId);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* QR Code & Links */}
        <div className="card space-y-4">
          {/* Collapsible QR Section Header with title and views */}
          <div
            onClick={handleQrToggle}
            className="w-full flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (folder) {
                    router.push(`/dashboard?folder=${folder.id}`);
                  } else {
                    router.push('/dashboard');
                  }
                }}
                className="p-1.5 rounded-lg hover:bg-bg-secondary transition-colors flex-shrink-0"
                title={folder ? t('backToFolder', { name: folder.name }) : t('backToDashboard')}
              >
                <ArrowRight className="w-4 h-4 text-text-secondary" />
              </button>
              <div className="min-w-0 text-right">
                <div className="flex items-center gap-2">
                  {folder && (
                    <span className="text-xs text-text-secondary flex items-center gap-1">
                      <FolderIcon className="w-3 h-3" style={{ color: folder.color }} />
                    </span>
                  )}
                  <h2 className="text-lg font-semibold text-text-primary truncate">{code.title}</h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <span>{code.shortId}</span>
                  <span>|</span>
                  <span className={clsx(
                    "flex items-center gap-1",
                    isAnimating && "text-green-500 font-bold"
                  )}>
                    <Eye className="w-3 h-3" />
                    {displayViews}
                  </span>
                  {views24h > 0 && (
                    <>
                      <span>|</span>
                      <span className="text-accent">{t('todayViews', { count: views24h })}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {qrExpanded ? (
              <ChevronUp className="w-5 h-5 text-text-secondary flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-text-secondary flex-shrink-0" />
            )}
          </div>

          {/* Collapsible QR Content */}
          {qrExpanded && (
            <div className="space-y-6">
              {/* QR Code */}
              <div ref={qrRef} className="flex justify-center p-4 bg-white rounded-xl relative">
                {/* QR Sign Button - overlaid on QR code */}
                <button
                  onClick={() => setQrSignModalOpen(true)}
                  className={clsx(
                    "absolute top-2 left-2 p-1.5 rounded-lg transition-all z-10",
                    code.widgets?.qrSign?.enabled
                      ? "bg-emerald-500/90 text-white hover:bg-emerald-600"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                  )}
                  title={t('qrSignTooltip')}
                >
                  <QrCode className="w-4 h-4" />
                </button>
                <div className="relative inline-block">
                  <QRCodeSVG
                    value={viewUrl}
                    size={220}
                    level="H"
                    marginSize={1}
                  />
                  {code.widgets?.qrSign?.enabled && code.widgets.qrSign.value && (() => {
                    const scale = code.widgets.qrSign.scale ?? 1.0;
                    const containerSize = 55; // Fixed - don't scale container to preserve QR readability
                    return (
                      <div
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center shadow-md overflow-hidden"
                        style={{
                          width: containerSize,
                          height: containerSize,
                          backgroundColor: code.widgets.qrSign.backgroundColor,
                        }}
                      >
                        {code.widgets.qrSign.type === 'logo' ? (
                          <img
                            src={code.widgets.qrSign.value}
                            alt="Logo"
                            style={{
                              width: containerSize * 0.7 * scale,
                              height: containerSize * 0.7 * scale,
                              objectFit: 'contain',
                            }}
                          />
                        ) : code.widgets.qrSign.type === 'icon' ? (
                          (() => {
                            const LucideIcons = require('lucide-react');
                            const IconComponent = LucideIcons[code.widgets.qrSign.value];
                            return IconComponent ? (
                              <IconComponent size={containerSize * 0.55 * scale} color={code.widgets.qrSign.color} strokeWidth={2.5} />
                            ) : null;
                          })()
                        ) : (
                          <span
                            style={{
                              color: code.widgets.qrSign.color,
                              fontFamily: 'var(--font-assistant), Arial, sans-serif',
                              fontSize: (code.widgets.qrSign.type === 'emoji' ? containerSize * 0.55 : (code.widgets.qrSign.value.length <= 2 ? containerSize * 0.45 : containerSize * 0.3)) * scale,
                              fontWeight: code.widgets.qrSign.type === 'text' ? 700 : 400,
                              lineHeight: 1,
                            }}
                          >
                            {code.widgets.qrSign.value}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Hidden high-res QR for download */}
              <div ref={qrCanvasRef} className="hidden">
                <QRCodeCanvas
                  value={viewUrl}
                  size={1000}
                  level="H"
                  marginSize={2}
                />
              </div>

              {/* Link */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-bg-secondary rounded-lg">
                  <LinkIcon className="w-4 h-4 text-text-secondary flex-shrink-0" />
                  <span className="text-sm text-text-primary truncate flex-1" dir="ltr">
                    {viewUrl}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="p-1.5 rounded hover:bg-bg-hover transition-colors"
                    title={t('copyLink')}
                  >
                    <Copy className={clsx('w-4 h-4', linkCopied ? 'text-success' : 'text-text-secondary')} />
                  </button>
                  <a
                    href={viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-bg-hover transition-colors"
                    title={t('openInNewWindow')}
                  >
                    <ExternalLink className="w-4 h-4 text-text-secondary" />
                  </a>
                </div>

                {linkCopied && (
                  <p className="text-sm text-success text-center">{tCommon('copied')}</p>
                )}
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMobilePreviewOpen(true)}
                  className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  {t('view')}
                </button>
                <button
                  onClick={handleDownloadQR}
                  className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  {t('printQR')}
                </button>
              </div>

              {/* Share buttons */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-text-secondary">{t('share')}</h3>
                <button
                  onClick={handleShareWhatsApp}
                  className="btn bg-[#25D366] text-white hover:bg-[#20BD5A] flex items-center justify-center gap-2 w-full"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  WhatsApp
                </button>
              </div>
            </div>
          )}

          {/* Widgets Section - Collapsible */}
          <div className="pt-4 border-t border-border">
            <button
              onClick={handleWidgetsToggle}
              className="w-full flex items-center justify-between text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              <span>{t('widgets')}</span>
              {widgetsExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {/* Collapsible content - Widget buttons grid */}
            {widgetsExpanded && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-text-secondary">{t('widgetsDescription')}</p>
                <div className="grid grid-cols-3 gap-2">
                {/* WhatsApp Widget Button */}
                <button
                  onClick={() => setWhatsappModalOpen(true)}
                  className={clsx(
                    "group relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                    code.widgets?.whatsapp?.enabled
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                      : "bg-bg-secondary border-border text-text-secondary hover:bg-bg-hover"
                  )}
                >
                  <div className={clsx(
                    "w-7 h-7 rounded-full flex items-center justify-center",
                    code.widgets?.whatsapp?.enabled ? "bg-emerald-500/20" : "bg-bg-hover"
                  )}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                  </div>
                  <span className="text-[11px] font-medium">WhatsApp</span>
                  {/* Styled Tooltip with status */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    <div className="flex items-center gap-1.5">
                      <span className={clsx("w-1.5 h-1.5 rounded-full", code.widgets?.whatsapp?.enabled ? "bg-emerald-500" : "bg-gray-500")} />
                      <span>{code.widgets?.whatsapp?.enabled ? t('active') : t('inactive')}</span>
                    </div>
                    <div className="mt-0.5 text-gray-300">{t('whatsappTooltip')}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </button>

                {/* Phone Widget Button */}
                <button
                  onClick={() => setContactWidgetModal({ isOpen: true, type: 'phone' })}
                  className={clsx(
                    "group relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                    code.widgets?.phone?.enabled
                      ? "bg-blue-500/10 border-blue-500 text-blue-500"
                      : "bg-bg-secondary border-border text-text-secondary hover:bg-bg-hover"
                  )}
                >
                  <div className={clsx(
                    "w-7 h-7 rounded-full flex items-center justify-center",
                    code.widgets?.phone?.enabled ? "bg-blue-500/20" : "bg-bg-hover"
                  )}>
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-medium">{t('phoneWidget') || 'טלפון'}</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    <div className="flex items-center gap-1.5">
                      <span className={clsx("w-1.5 h-1.5 rounded-full", code.widgets?.phone?.enabled ? "bg-blue-500" : "bg-gray-500")} />
                      <span>{code.widgets?.phone?.enabled ? t('active') : t('inactive')}</span>
                    </div>
                    <div className="mt-0.5 text-gray-300">{t('phoneWidgetTooltip') || 'כפתור חיוג ישיר'}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </button>

                {/* Email Widget Button */}
                <button
                  onClick={() => setContactWidgetModal({ isOpen: true, type: 'email' })}
                  className={clsx(
                    "group relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                    code.widgets?.email?.enabled
                      ? "bg-red-500/10 border-red-500 text-red-500"
                      : "bg-bg-secondary border-border text-text-secondary hover:bg-bg-hover"
                  )}
                >
                  <div className={clsx(
                    "w-7 h-7 rounded-full flex items-center justify-center",
                    code.widgets?.email?.enabled ? "bg-red-500/20" : "bg-bg-hover"
                  )}>
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-medium">{t('emailWidget') || 'מייל'}</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    <div className="flex items-center gap-1.5">
                      <span className={clsx("w-1.5 h-1.5 rounded-full", code.widgets?.email?.enabled ? "bg-red-500" : "bg-gray-500")} />
                      <span>{code.widgets?.email?.enabled ? t('active') : t('inactive')}</span>
                    </div>
                    <div className="mt-0.5 text-gray-300">{t('emailWidgetTooltip') || 'כפתור שליחת מייל'}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </button>

                {/* SMS Widget Button */}
                <button
                  onClick={() => setContactWidgetModal({ isOpen: true, type: 'sms' })}
                  className={clsx(
                    "group relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                    code.widgets?.sms?.enabled
                      ? "bg-purple-500/10 border-purple-500 text-purple-500"
                      : "bg-bg-secondary border-border text-text-secondary hover:bg-bg-hover"
                  )}
                >
                  <div className={clsx(
                    "w-7 h-7 rounded-full flex items-center justify-center",
                    code.widgets?.sms?.enabled ? "bg-purple-500/20" : "bg-bg-hover"
                  )}>
                    <MessageCircle className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-medium">SMS</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    <div className="flex items-center gap-1.5">
                      <span className={clsx("w-1.5 h-1.5 rounded-full", code.widgets?.sms?.enabled ? "bg-purple-500" : "bg-gray-500")} />
                      <span>{code.widgets?.sms?.enabled ? t('active') : t('inactive')}</span>
                    </div>
                    <div className="mt-0.5 text-gray-300">{t('smsWidgetTooltip') || 'כפתור שליחת SMS'}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </button>

                {/* Navigation Widget Button */}
                <button
                  onClick={() => setContactWidgetModal({ isOpen: true, type: 'navigation' })}
                  className={clsx(
                    "group relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                    code.widgets?.navigation?.enabled
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                      : "bg-bg-secondary border-border text-text-secondary hover:bg-bg-hover"
                  )}
                >
                  <div className={clsx(
                    "w-7 h-7 rounded-full flex items-center justify-center",
                    code.widgets?.navigation?.enabled ? "bg-emerald-500/20" : "bg-bg-hover"
                  )}>
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-medium">{t('navigationWidget') || 'ניווט'}</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    <div className="flex items-center gap-1.5">
                      <span className={clsx("w-1.5 h-1.5 rounded-full", code.widgets?.navigation?.enabled ? "bg-emerald-500" : "bg-gray-500")} />
                      <span>{code.widgets?.navigation?.enabled ? t('active') : t('inactive')}</span>
                    </div>
                    <div className="mt-0.5 text-gray-300">{t('navigationWidgetTooltip') || 'כפתור ניווט למיקום'}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </button>

                {/* PWA Encourage Toggle Button */}
                <button
                  onClick={handleTogglePWAEncourage}
                  className={clsx(
                    "group relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                    code.widgets?.pwaEncourage?.enabled !== false
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                      : "bg-bg-secondary border-border text-text-secondary hover:bg-bg-hover"
                  )}
                >
                  <div className={clsx(
                    "w-7 h-7 rounded-full flex items-center justify-center",
                    code.widgets?.pwaEncourage?.enabled !== false ? "bg-emerald-500/20" : "bg-bg-hover"
                  )}>
                    <Smartphone className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-medium">{t('pwaEncourage')}</span>
                  {/* Styled Tooltip with status */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    <div className="flex items-center gap-1.5">
                      <span className={clsx("w-1.5 h-1.5 rounded-full", code.widgets?.pwaEncourage?.enabled !== false ? "bg-emerald-500" : "bg-gray-500")} />
                      <span>{code.widgets?.pwaEncourage?.enabled !== false ? t('active') : t('inactive')}</span>
                    </div>
                    <div className="mt-0.5 text-gray-300">{t('pwaEncourageTooltip')}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </button>

                </div>
              </div>
            )}
          </div>
        </div>

        {/* Media List */}
        <div className={clsx(
          "lg:col-span-2 card space-y-4",
          slideDirection === 'left' && "animate-slide-left",
          slideDirection === 'right' && "animate-slide-right"
        )}>
          {/* Header with title edit, action buttons and media count */}
          <div className="flex flex-col gap-3">
            {/* Title row - full width on mobile for long names */}
            <div className="flex items-start sm:items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Navigation arrows - hidden on mobile, shown inline on desktop */}
              {siblingCodes.length > 1 && (
                <div className="hidden sm:flex items-center">
                  <button
                    onClick={navigateToNextCode}
                    className="p-1.5 rounded-lg hover:bg-bg-secondary transition-colors"
                    title={t('nextCode')}
                  >
                    <ChevronRight className="w-4 h-4 text-text-secondary" />
                  </button>
                  <button
                    onClick={navigateToPrevCode}
                    className="p-1.5 rounded-lg hover:bg-bg-secondary transition-colors"
                    title={t('prevCode')}
                  >
                    <ChevronLeft className="w-4 h-4 text-text-secondary" />
                  </button>
                </div>
              )}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full sm:flex-1 text-lg font-semibold text-text-primary bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 py-1 order-first sm:order-none"
                placeholder={t('codeName')}
              />
              {/* Action buttons - hidden on mobile, shown on desktop */}
              <div className="hidden sm:flex items-center gap-2">
                <Tooltip text={t('saveChanges')}>
                  <button
                    onClick={handleSave}
                    disabled={saving || title === code.title}
                    className="p-2 rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                  </button>
                </Tooltip>
                <Tooltip text={t('duplicateCode')}>
                  <button
                    onClick={handleDuplicate}
                    className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    <CopyPlus className="w-4 h-4" />
                  </button>
                </Tooltip>
                {user && canDeleteCode(code, user.id, user.role) && (
                  <Tooltip text={t('deleteCode')}>
                    <button
                      onClick={() => setDeleteModal(true)}
                      className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
            {/* Action buttons row - visible only on mobile */}
            <div className="flex sm:hidden items-center gap-2">
              <Tooltip text={t('saveChanges')}>
                <button
                  onClick={handleSave}
                  disabled={saving || title === code.title}
                  className="p-2 rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </button>
              </Tooltip>
              <Tooltip text={t('duplicateCode')}>
                <button
                  onClick={handleDuplicate}
                  className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors"
                >
                  <CopyPlus className="w-4 h-4" />
                </button>
              </Tooltip>
              {user && canDeleteCode(code, user.id, user.role) && (
                <Tooltip text={t('deleteCode')}>
                  <button
                    onClick={() => setDeleteModal(true)}
                    className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
              {/* Navigation arrows on mobile - at the end */}
              {siblingCodes.length > 1 && (
                <>
                  <div className="flex-1" />
                  <button
                    onClick={navigateToPrevCode}
                    className="p-2 rounded-lg bg-bg-secondary hover:bg-bg-hover transition-colors"
                    title={t('prevCode')}
                  >
                    <ChevronLeft className="w-4 h-4 text-text-secondary" />
                  </button>
                  <button
                    onClick={navigateToNextCode}
                    className="p-2 rounded-lg bg-bg-secondary hover:bg-bg-hover transition-colors"
                    title={t('nextCode')}
                  >
                    <ChevronRight className="w-4 h-4 text-text-secondary" />
                  </button>
                </>
              )}
            </div>
            {/* Media count and add buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">
                  {t('mediaItems', { count: code.media.length })}
                </span>
                {/* Landing Page Config Button - show when mixed types */}
                {shouldShowLandingPageButton && (
                  <button
                    onClick={() => setLandingPageModalOpen(true)}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                      code?.landingPageConfig?.enabled
                        ? "bg-accent text-white"
                        : "bg-amber-500/10 text-amber-600 border border-amber-500/30 hover:bg-amber-500/20"
                    )}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    {locale === 'he' ? 'עמוד נחיתה' : 'Landing Page'}
                    {!code?.landingPageConfig?.enabled && (
                      <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                        {locale === 'he' ? 'מומלץ' : 'Recommended'}
                      </span>
                    )}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {/* Add Riddle Button */}
                <Tooltip text={t('riddle')}>
                  <button
                    onClick={() => setRiddleModalOpen(true)}
                    className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center"
                  >
                    <ScrollText className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Add WordCloud Button */}
                <Tooltip text={t('wordCloud')}>
                  <button
                    onClick={() => setWordCloudModalOpen(true)}
                    className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center"
                  >
                    <Cloud className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Selfiebeam Button */}
                <Tooltip text={t('selfiebeam')}>
                  <button
                    onClick={() => setSelfiebeamModalOpen(true)}
                    className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Q.Vote Button */}
                <Tooltip text="Q.Vote">
                  <button
                    onClick={() => setQvoteModalOpen(true)}
                    className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center"
                  >
                    <Vote className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Weekly Calendar Button */}
                <Tooltip text={tMedia('weeklycal')}>
                  <button
                    onClick={() => setWeeklyCalModalOpen(true)}
                    className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center"
                  >
                    <CalendarDays className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Q.Stage Button */}
                <Tooltip text="Q.Stage">
                  <button
                    onClick={() => setQstageModalOpen(true)}
                    className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Minigames Button - Coming Soon */}
                <Tooltip text={t('minigamesComingSoon')}>
                  <button
                    disabled
                    className="p-2 rounded-lg bg-bg-secondary text-text-secondary cursor-not-allowed opacity-50 flex items-center justify-center"
                  >
                    <Gamepad2 className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Add Link Button */}
                <Tooltip text={t('addLink')}>
                  <button
                    onClick={() => setAddLinkModalOpen(true)}
                    className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center"
                  >
                    <LinkIcon className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Add Media Button */}
                <Tooltip text={t('addFile')}>
                  <label className="p-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer flex items-center justify-center">
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <input
                      type="file"
                      accept="image/*,video/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAddMedia(file);
                    }}
                    disabled={uploading}
                  />
                  </label>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Media items - entire area is drag-drop zone for adding new media */}
          <div
            className={clsx(
              "space-y-3 min-h-[200px] p-3 -m-3 rounded-xl transition-all",
              isDraggingOverMediaArea && "ring-2 ring-dashed ring-accent bg-accent/5"
            )}
            onDragOver={handleMediaAreaDragOver}
            onDragLeave={handleMediaAreaDragLeave}
            onDrop={handleMediaAreaDrop}
          >
            {code.media.map((media, index) => (
              <div
                key={media.id}
                data-index={index}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => {
                  handleDragOver(e, index);
                  handleFileDragOver(e, media.id, media.type);
                }}
                onDragLeave={handleFileDragLeave}
                onDragEnd={handleDragEnd}
                onDrop={(e) => {
                  // Check if it's a file drop or reordering drop
                  if (e.dataTransfer.types.includes('Files') && e.dataTransfer.files.length > 0) {
                    handleFileDrop(e, media.id, media.type);
                  } else {
                    handleDrop(e, index);
                  }
                }}
                onTouchStart={(e) => handleTouchStart(e, index)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={clsx(
                  'media-item flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-bg-secondary rounded-xl group transition-all duration-200',
                  draggedIndex === index && 'opacity-50 scale-[0.98]',
                  dragOverIndex === index && 'ring-2 ring-accent ring-offset-2 ring-offset-bg-primary',
                  fileDragOverMediaId === media.id && 'ring-2 ring-amber-500 ring-offset-2 ring-offset-bg-primary bg-amber-500/10'
                )}
              >
                {/* Top row: drag handle, thumbnail, info */}
                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                  <div className="drag-handle cursor-grab active:cursor-grabbing text-text-secondary hover:text-text-primary transition-colors touch-none">
                    <GripVertical className="w-5 h-5" />
                  </div>

                  {/* Thumbnail - hidden on mobile for non-image types */}
                  <div
                    className={clsx(
                      "rounded-lg bg-bg-primary flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-accent/50 transition-all",
                      media.type === 'image' ? "w-10 h-10 sm:w-16 sm:h-16" : "hidden sm:flex sm:w-16 sm:h-16"
                    )}
                    onClick={() => {
                      if (media.type === 'riddle') {
                        setEditingRiddleId(media.id);
                        setRiddleModalOpen(true);
                      } else if (media.type === 'selfiebeam') {
                        setEditingSelfiebeamId(media.id);
                        setSelfiebeamModalOpen(true);
                      } else if (media.type === 'weeklycal') {
                        setEditingWeeklyCalId(media.id);
                        setWeeklyCalModalOpen(true);
                      } else if (media.type === 'qvote') {
                        // Go directly to candidate management
                        router.push(`/code/${code.id}/candidates`);
                      } else if (media.type === 'qstage') {
                        setEditingQStageId(media.id);
                        setQstageModalOpen(true);
                      } else if (media.type === 'qhunt') {
                        setEditingQHuntId(media.id);
                        setQhuntModalOpen(true);
                      } else if (media.type === 'qtreasure') {
                        setEditingQTreasureId(media.id);
                        setQtreasureModalOpen(true);
                      } else if (media.type === 'qchallenge') {
                        setEditingQChallengeId(media.id);
                        setQchallengeModalOpen(true);
                      } else {
                        window.open(media.url, '_blank');
                      }
                    }}
                  >
                    {media.type === 'link' ? (
                      <LinkIcon className="w-6 h-6 text-text-secondary" />
                    ) : media.type === 'video' ? (
                      <Video className="w-6 h-6 text-text-secondary" />
                    ) : media.type === 'pdf' ? (
                      <FileText className="w-6 h-6 text-text-secondary" />
                    ) : media.type === 'riddle' ? (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: media.riddleContent?.backgroundColor || '#1a1a2e' }}
                      >
                        <ScrollText className="w-6 h-6" style={{ color: media.riddleContent?.textColor || '#fff' }} />
                      </div>
                    ) : media.type === 'selfiebeam' ? (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: media.selfiebeamContent?.backgroundColor || '#1a1a2e' }}
                      >
                        <Camera className="w-6 h-6" style={{ color: media.selfiebeamContent?.textColor || '#fff' }} />
                      </div>
                    ) : media.type === 'weeklycal' ? (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: media.weeklycalConfig?.branding?.landing?.backgroundColor || '#1a1a2e' }}
                      >
                        <CalendarDays className="w-6 h-6" style={{ color: media.weeklycalConfig?.branding?.landing?.textColor || '#fff' }} />
                      </div>
                    ) : media.type === 'qvote' ? (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: '#1a1a2e' }}
                      >
                        <Vote className="w-6 h-6 text-white" />
                      </div>
                    ) : media.type === 'qstage' ? (
                      <div
                        className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500"
                      >
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                    ) : media.type === 'qhunt' ? (
                      <div
                        className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500 to-pink-500"
                      >
                        <Crosshair className="w-6 h-6 text-white" />
                      </div>
                    ) : media.type === 'qtreasure' ? (
                      <div
                        className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-emerald-700"
                      >
                        <Map className="w-6 h-6 text-white" />
                      </div>
                    ) : media.type === 'qchallenge' ? (
                      <div
                        className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500"
                      >
                        <Trophy className="w-6 h-6 text-white" />
                      </div>
                    ) : (
                      <img
                        src={media.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {media.type === 'link' ? (
                          getLinkTypeLabel(media.url)
                        ) : media.type === 'riddle' ? (media.riddleContent?.title || tMedia('riddle'))
                          : media.type === 'selfiebeam' ? (media.selfiebeamContent?.title || tMedia('selfiebeam'))
                          : media.type === 'wordcloud' ? tMedia('wordcloud')
                          : media.type === 'weeklycal' ? (tMedia('weeklycal') || 'לוח פעילות')
                          : media.type === 'qvote' ? 'Q.Vote'
                          : media.type === 'qstage' ? 'Q.Stage'
                          : media.type === 'qhunt' ? 'Q.Hunt'
                          : media.type === 'qtreasure' ? 'Q.Treasure'
                          : media.type === 'qchallenge' ? 'Q.Challenge'
                          : media.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-text-secondary">#{index + 1}</span>
                    </div>
                    {media.type === 'link' && (
                      <p className="text-xs text-text-secondary truncate mt-0.5" dir="ltr">
                        {(() => {
                          const linkType = detectLinkType(media.url);
                          switch (linkType) {
                            case 'whatsapp':
                            case 'phone':
                            case 'sms':
                              return extractPhoneFromUrl(media.url) || '';
                            case 'email':
                              return extractEmailFromUrl(media.url);
                            default:
                              try {
                                return new URL(media.url).hostname;
                              } catch {
                                return media.url;
                              }
                          }
                        })()}
                      </p>
                    )}
                    {media.type !== 'riddle' && media.type !== 'selfiebeam' && media.type !== 'link' && media.type !== 'wordcloud' && media.type !== 'weeklycal' && media.type !== 'qvote' && media.type !== 'qstage' && media.type !== 'qhunt' && media.type !== 'qtreasure' && media.type !== 'qchallenge' && media.filename && (
                      <p className="text-xs text-text-secondary truncate mt-0.5" dir="ltr">
                        {media.filename}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                      {media.size > 0 && (
                        <span className="text-xs text-text-secondary">
                          {formatBytes(media.size)}
                        </span>
                      )}
                      {media.type === 'pdf' && media.pageCount && media.pageCount > 0 && (
                        <span className="text-xs text-text-secondary">
                          {media.pageCount} {media.pageCount === 1 ? t('page') : t('pages')}
                        </span>
                      )}
                      {media.schedule?.enabled && (() => {
                        const active = isScheduleActive(media.schedule);
                        return (
                          <span className={`text-[10px] sm:text-xs flex items-center gap-1 ${active ? 'text-green-500' : 'text-red-500'}`}>
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate max-w-[100px] sm:max-w-none">{formatSchedule(media.schedule)}</span>
                          </span>
                        );
                      })()}
                      {media.linkUrl && (
                        <span className="text-[10px] sm:text-xs text-accent flex items-center gap-1">
                          <LinkIcon className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[80px] sm:max-w-none">{media.linkTitle || new URL(media.linkUrl).hostname}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions - bottom row on mobile, inline on desktop */}
                <div className="flex items-center gap-1 justify-end border-t border-border/50 pt-2 sm:border-0 sm:pt-0">
                  {/* Edit button for riddle */}
                  {media.type === 'riddle' && (
                    <Tooltip text={t('edit')}>
                      <button
                        onClick={() => {
                          setEditingRiddleId(media.id);
                          setRiddleModalOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}

                  {/* Gallery button for riddle with gallery enabled */}
                  {media.type === 'riddle' && media.riddleContent?.galleryEnabled && (
                    <Tooltip text={t('selfieGallery', { count: code.userGallery?.length || 0 })}>
                      <a
                        href={`/gallery/${code.shortId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-bg-hover text-accent relative"
                      >
                        <Camera className="w-4 h-4" />
                        {(code.userGallery?.length || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {code.userGallery!.length > 9 ? '9+' : code.userGallery!.length}
                          </span>
                        )}
                      </a>
                    </Tooltip>
                  )}

                  {/* Edit button for selfiebeam */}
                  {media.type === 'selfiebeam' && (
                    <Tooltip text={t('edit')}>
                      <button
                        onClick={() => {
                          setEditingSelfiebeamId(media.id);
                          setSelfiebeamModalOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}

                  {/* Edit button for weeklycal - navigate to full page editor */}
                  {media.type === 'weeklycal' && (
                    <Tooltip text={t('edit')}>
                      <a
                        href={`/${locale}/dashboard/calendar/${code.id}`}
                        className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
                      >
                        <Pencil className="w-4 h-4" />
                      </a>
                    </Tooltip>
                  )}

                  {/* Manage Candidates button for qvote */}
                  {media.type === 'qvote' && (
                    <Tooltip text={locale === 'he' ? 'ניהול מועמדים' : 'Manage Candidates'}>
                      <a
                        href={`/code/${code.id}/candidates`}
                        className="p-2 rounded-lg hover:bg-bg-hover text-accent relative"
                      >
                        <Users className="w-4 h-4" />
                      </a>
                    </Tooltip>
                  )}

                  {/* Edit button for qstage */}
                  {media.type === 'qstage' && (
                    <Tooltip text={t('edit')}>
                      <button
                        onClick={() => {
                          setEditingQStageId(media.id);
                          setQstageModalOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}

                  {/* Edit button for qhunt */}
                  {media.type === 'qhunt' && (
                    <Tooltip text={t('edit')}>
                      <button
                        onClick={() => {
                          setEditingQHuntId(media.id);
                          setQhuntModalOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}

                  {/* Edit button for qtreasure */}
                  {media.type === 'qtreasure' && (
                    <Tooltip text={t('edit')}>
                      <button
                        onClick={() => {
                          setEditingQTreasureId(media.id);
                          setQtreasureModalOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}

                  {/* Edit button for qchallenge */}
                  {media.type === 'qchallenge' && (
                    <Tooltip text={t('edit')}>
                      <button
                        onClick={() => {
                          setEditingQChallengeId(media.id);
                          setQchallengeModalOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}

                  {/* Gallery button for selfiebeam with gallery enabled */}
                  {media.type === 'selfiebeam' && media.selfiebeamContent?.galleryEnabled && (
                    <Tooltip text={t('selfieGallery', { count: code.userGallery?.length || 0 })}>
                      <a
                        href={`/gallery/${code.shortId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-bg-hover text-accent relative"
                      >
                        <Camera className="w-4 h-4" />
                        {(code.userGallery?.length || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {code.userGallery!.length > 9 ? '9+' : code.userGallery!.length}
                          </span>
                        )}
                      </a>
                    </Tooltip>
                  )}

                  {/* PDF Settings button */}
                  {media.type === 'pdf' && (
                    <Tooltip text={locale === 'he' ? 'הגדרות חוברת' : 'Flipbook Settings'}>
                      <button
                        onClick={() => setPdfSettingsModal({ isOpen: true, mediaId: media.id })}
                        className={clsx(
                          'p-2 rounded-lg hover:bg-bg-hover transition-colors',
                          media.pdfSettings ? 'text-accent' : 'text-text-secondary'
                        )}
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}

                  {/* Link Settings button - for link-type media */}
                  {media.type === 'link' && (
                    <Tooltip text={locale === 'he' ? 'עריכת קישור' : 'Edit Link'}>
                      <button
                        onClick={() => setEditLinkModal({ isOpen: true, mediaId: media.id, url: media.url })}
                        className="p-2 rounded-lg hover:bg-bg-hover text-accent transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}

                  {/* Replace button - not for links, riddles, selfiebeams, weeklycal, qvote, qstage, qhunt, qtreasure, or qchallenge */}
                  {media.type !== 'link' && media.type !== 'riddle' && media.type !== 'selfiebeam' && media.type !== 'weeklycal' && media.type !== 'qvote' && media.type !== 'qstage' && media.type !== 'qhunt' && media.type !== 'qtreasure' && media.type !== 'qchallenge' && (
                    <Tooltip text={t('replaceFile')}>
                      <label className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary cursor-pointer">
                        {replacingMediaId === media.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        <input
                          type="file"
                          accept="image/*,video/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleReplaceMedia(media.id, file);
                          }}
                          disabled={replacingMediaId === media.id}
                        />
                      </label>
                    </Tooltip>
                  )}

                  {/* Schedule button */}
                  <Tooltip text={t('scheduleDisplay')}>
                    <button
                      onClick={() => setScheduleModal({ isOpen: true, mediaId: media.id })}
                      className={clsx(
                        'p-2 rounded-lg hover:bg-bg-hover transition-colors',
                        media.schedule?.enabled ? 'text-accent' : 'text-text-secondary'
                      )}
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                  </Tooltip>

                  {/* Link button - only for images/videos/pdfs */}
                  {media.type !== 'link' && (
                    <Tooltip text={media.linkUrl ? t('editLink') : t('addLink')}>
                      <button
                        onClick={() => setLinkModal({ isOpen: true, mediaId: media.id })}
                        className={clsx(
                          'p-2 rounded-lg hover:bg-bg-hover transition-colors',
                          media.linkUrl ? 'text-accent' : 'text-text-secondary'
                        )}
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}

                  {/* External link */}
                  <Tooltip text={t('openInNewWindow')}>
                    <a
                      href={media.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Tooltip>

                  {/* Create separate experience */}
                  <Tooltip text={t('createSeparateExperience')}>
                    <button
                      onClick={() => setCreateSeparateModal({ isOpen: true, mediaId: media.id, loading: false })}
                      className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  </Tooltip>

                  {/* Delete */}
                  <Tooltip text={t('deleteMediaItem')}>
                    <button
                      onClick={() => setDeleteMediaModal({ isOpen: true, mediaId: media.id })}
                      className="p-2 rounded-lg hover:bg-danger/10 text-danger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}

            {code.media.length === 0 ? (
              <div className={clsx(
                "text-center py-12 text-text-secondary border-2 border-dashed rounded-xl transition-all",
                isDraggingOverMediaArea ? "border-accent bg-accent/10" : "border-border"
              )}>
                <p>{t('noMedia')}</p>
                <p className="text-sm mt-1">{t('dragFileOrClick')}</p>
              </div>
            ) : (
              <div className={clsx(
                "text-center py-4 text-text-secondary/60 border-2 border-dashed rounded-xl transition-all mt-2",
                isDraggingOverMediaArea ? "border-accent bg-accent/10 text-accent" : "border-border/50"
              )}>
                <p className="text-sm">{t('dragFileOrClick')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <DeleteConfirm
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={handleDelete}
        title={code.title}
      />

      {/* Schedule modal */}
      <ScheduleModal
        isOpen={scheduleModal.isOpen}
        onClose={() => setScheduleModal({ isOpen: false, mediaId: null })}
        onSave={handleSaveSchedule}
        currentSchedule={currentMediaForSchedule?.schedule}
      />

      {/* Media link modal */}
      <MediaLinkModal
        isOpen={linkModal.isOpen}
        onClose={() => setLinkModal({ isOpen: false, mediaId: null })}
        onSave={handleSaveMediaLink}
        currentLinkUrl={currentMediaForLink?.linkUrl}
        currentLinkTitle={currentMediaForLink?.linkTitle}
      />

      {/* PDF settings modal */}
      <PDFSettingsModal
        isOpen={pdfSettingsModal.isOpen}
        onClose={() => setPdfSettingsModal({ isOpen: false, mediaId: null })}
        settings={code?.media.find(m => m.id === pdfSettingsModal.mediaId)?.pdfSettings || DEFAULT_PDF_SETTINGS}
        onSave={handleSavePdfSettings}
      />

      {/* Delete media confirmation modal */}
      {deleteMediaModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-text-primary mb-2">{t('deleteMediaTitle')}</h3>
            <p className="text-text-secondary mb-4">
              {t('deleteMediaConfirm')}
              <br />
              <span className="text-sm text-danger">{t('cannotUndo')}</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteMediaModal({ isOpen: false, mediaId: null })}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={() => {
                  if (deleteMediaModal.mediaId) {
                    handleRemoveMedia(deleteMediaModal.mediaId);
                  }
                  setDeleteMediaModal({ isOpen: false, mediaId: null });
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-danger hover:bg-danger/90 rounded-lg transition-colors"
              >
                {tCommon('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create separate experience confirmation modal */}
      {createSeparateModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-accent/10 rounded-lg">
                <QrCode className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary">{t('createSeparateExperienceTitle')}</h3>
            </div>
            <p className="text-text-secondary mb-6">
              {t('createSeparateExperienceConfirm')}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleCreateSeparateExperience(false)}
                disabled={createSeparateModal.loading}
                className="w-full px-4 py-3 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createSeparateModal.loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {tCommon('creating')}
                  </>
                ) : (
                  <>
                    <CopyPlus className="w-4 h-4" />
                    {t('createSeparateExperienceDuplicate')}
                  </>
                )}
              </button>
              <button
                onClick={() => handleCreateSeparateExperience(true)}
                disabled={createSeparateModal.loading}
                className="w-full px-4 py-3 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createSeparateModal.loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {tCommon('creating')}
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    {t('createSeparateExperienceMove')}
                  </>
                )}
              </button>
              <button
                onClick={() => setCreateSeparateModal({ isOpen: false, mediaId: null, loading: false })}
                disabled={createSeparateModal.loading}
                className="w-full px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {t('createSeparateExperienceCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Link Modal */}
      <AddLinkModal
        isOpen={addLinkModalOpen}
        onClose={() => setAddLinkModalOpen(false)}
        onSave={handleAddLink}
        loading={addingLink}
      />

      {/* Edit Link Modal */}
      <AddLinkModal
        isOpen={editLinkModal.isOpen}
        onClose={() => setEditLinkModal({ isOpen: false, mediaId: null, url: '' })}
        onSave={handleUpdateLink}
        editMode={true}
        initialUrl={editLinkModal.url}
      />

      {/* Riddle Modal */}
      <RiddleModal
        isOpen={riddleModalOpen}
        onClose={() => {
          setRiddleModalOpen(false);
          setEditingRiddleId(null);
        }}
        onSave={handleSaveRiddle}
        loading={addingRiddle}
        initialContent={editingRiddleId ? code?.media.find(m => m.id === editingRiddleId)?.riddleContent : undefined}
      />

      {/* WordCloud Modal */}
      <WordCloudModal
        isOpen={wordCloudModalOpen}
        onClose={() => setWordCloudModalOpen(false)}
        onSave={handleAddWordCloud}
        loading={addingWordCloud}
      />

      {/* Selfiebeam Modal */}
      <SelfiebeamModal
        isOpen={selfiebeamModalOpen}
        onClose={() => {
          setSelfiebeamModalOpen(false);
          setEditingSelfiebeamId(null);
        }}
        onSave={handleSaveSelfiebeam}
        loading={addingSelfiebeam}
        initialContent={editingSelfiebeamId ? code?.media.find(m => m.id === editingSelfiebeamId)?.selfiebeamContent : undefined}
      />

      {/* Q.Vote Modal */}
      <QVoteModal
        isOpen={qvoteModalOpen}
        onClose={() => {
          setQvoteModalOpen(false);
          setEditingQVoteId(null);
        }}
        onSave={handleSaveQVote}
        loading={addingQVote}
        initialConfig={editingQVoteId ? code?.media.find(m => m.id === editingQVoteId)?.qvoteConfig : undefined}
        shortId={code.shortId}
      />

      {/* Weekly Calendar Modal */}
      <WeeklyCalendarModal
        isOpen={weeklyCalModalOpen}
        onClose={() => {
          setWeeklyCalModalOpen(false);
          setEditingWeeklyCalId(null);
        }}
        onSave={handleSaveWeeklyCal}
        onUploadCellImage={async (file: File) => {
          if (!user || !code) return null;
          try {
            const formData = new FormData();
            // Rename file to include code ID in path
            const ext = file.name.split('.').pop() || 'jpg';
            const newFileName = `${code.id}_${Date.now()}.${ext}`;
            const renamedFile = new File([file], newFileName, { type: file.type });
            formData.append('file', renamedFile);
            formData.append('userId', user.id);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (res.ok) {
              const { url, filename } = await res.json();
              return url;
            }
            return null;
          } catch {
            return null;
          }
        }}
        onDeleteCellImage={async (url: string) => {
          try {
            const res = await fetch('/api/upload', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url }),
            });
            return res.ok;
          } catch {
            return false;
          }
        }}
        loading={addingWeeklyCal}
        initialConfig={editingWeeklyCalId ? code?.media.find(m => m.id === editingWeeklyCalId)?.weeklycalConfig : undefined}
        shortId={code.shortId}
        codeId={code.id}
      />

      {/* Q.Stage Modal */}
      <QStageModal
        isOpen={qstageModalOpen}
        onClose={() => {
          setQstageModalOpen(false);
          setEditingQStageId(null);
        }}
        onSave={handleSaveQStage}
        loading={addingQStage}
        initialConfig={editingQStageId ? code?.media.find(m => m.id === editingQStageId)?.qstageConfig : undefined}
        shortId={code.shortId}
      />

      {/* Q.Hunt Modal */}
      <QHuntModal
        isOpen={qhuntModalOpen}
        onClose={() => {
          setQhuntModalOpen(false);
          setEditingQHuntId(null);
        }}
        onSave={handleSaveQHunt}
        loading={addingQHunt}
        initialConfig={editingQHuntId ? code?.media.find(m => m.id === editingQHuntId)?.qhuntConfig : undefined}
      />

      {/* Q.Treasure Modal */}
      <QTreasureModal
        isOpen={qtreasureModalOpen}
        onClose={() => {
          setQtreasureModalOpen(false);
          setEditingQTreasureId(null);
        }}
        onSave={handleSaveQTreasure}
        loading={addingQTreasure}
        initialConfig={editingQTreasureId ? code?.media.find(m => m.id === editingQTreasureId)?.qtreasureConfig : undefined}
      />

      {/* Q.Challenge Modal */}
      <QChallengeModal
        isOpen={qchallengeModalOpen}
        onClose={() => {
          setQchallengeModalOpen(false);
          setEditingQChallengeId(null);
        }}
        onSave={handleSaveQChallenge}
        loading={addingQChallenge}
        initialConfig={editingQChallengeId ? code?.media.find(m => m.id === editingQChallengeId)?.qchallengeConfig : undefined}
        shortId={code.shortId}
      />

      {/* QR Sign Modal */}
      <QRSignModal
        isOpen={qrSignModalOpen}
        onClose={() => setQrSignModalOpen(false)}
        onSave={handleSaveQRSign}
        currentSign={code.widgets?.qrSign}
      />

      {/* WhatsApp Widget Modal */}
      <WhatsAppWidgetModal
        isOpen={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        onSave={handleSaveWhatsappWidget}
        currentConfig={code.widgets?.whatsapp}
      />

      {/* Contact Widget Modal */}
      <ContactWidgetModal
        isOpen={contactWidgetModal.isOpen}
        onClose={() => setContactWidgetModal(prev => ({ ...prev, isOpen: false }))}
        widgetType={contactWidgetModal.type}
        onSave={(config) => handleSaveContactWidget(contactWidgetModal.type, config as NonNullable<CodeWidgets[typeof contactWidgetModal.type]> | undefined)}
        currentConfig={code.widgets?.[contactWidgetModal.type]}
      />

      {/* Replace Media Confirmation Modal */}
      <ReplaceMediaConfirm
        isOpen={replaceConfirmModal.isOpen}
        onClose={() => setReplaceConfirmModal({ isOpen: false, file: null, mediaId: null })}
        onConfirm={handleConfirmReplace}
        currentMediaType={code.media.find(m => m.id === replaceConfirmModal.mediaId)?.type}
        currentFileName={code.media.find(m => m.id === replaceConfirmModal.mediaId)?.filename}
        newFileName={replaceConfirmModal.file?.name}
        mediaCount={code.media.length}
      />

      {/* Mobile Preview Modal */}
      <MobilePreviewModal
        isOpen={mobilePreviewOpen}
        onClose={() => setMobilePreviewOpen(false)}
        url={viewUrl}
        title={code.title}
      />

      {/* Landing Page Modal */}
      <LandingPageModal
        isOpen={landingPageModalOpen}
        onClose={() => setLandingPageModalOpen(false)}
        onSave={handleSaveLandingPage}
        initialConfig={code.landingPageConfig}
        shortId={code.shortId}
        mediaItems={code.media}
      />
    </div>
  );
}
