'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  ScrollText,
  Pencil,
  Camera,
  Cloud,
  Gamepad2,
  QrCode,
  MessageCircle,
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { getQRCode, updateQRCode, deleteQRCode, canEditCode, canDeleteCode, updateUserStorage, getUserFolders, createQRCode } from '@/lib/db';
import { subscribeToCodeViews } from '@/lib/analytics';
import { QRCode as QRCodeType, MediaItem, MediaSchedule, Folder, CodeWidgets, RiddleContent, SelfiebeamContent, QRSign } from '@/types';
import DeleteConfirm from '@/components/modals/DeleteConfirm';
import ScheduleModal from '@/components/modals/ScheduleModal';
import MediaLinkModal from '@/components/modals/MediaLinkModal';
import AddLinkModal from '@/components/modals/AddLinkModal';
import RiddleModal from '@/components/modals/RiddleModal';
import WordCloudModal from '@/components/modals/WordCloudModal';
import SelfiebeamModal from '@/components/modals/SelfiebeamModal';
import QRSignModal from '@/components/modals/QRSignModal';
import WhatsAppWidgetModal from '@/components/modals/WhatsAppWidgetModal';
import ReplaceMediaConfirm from '@/components/modals/ReplaceMediaConfirm';
import { clsx } from 'clsx';

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

  // Widget modals state
  const [qrSignModalOpen, setQrSignModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);

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
      alert('שגיאה בשמירה. נסה שוב.');
    } finally {
      setSaving(false);
    }
  };

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
      alert('שגיאה במחיקה. נסה שוב.');
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
      const newCode = await createQRCode(
        user.id,
        `${code.title} (עותק)`,
        code.media.map((m) => ({
          url: m.url,
          type: m.type,
          size: 0, // Don't count storage again since it's same file
          order: m.order,
          uploadedBy: user.id,
        }))
      );

      // Navigate to the new code
      router.push(`/code/${newCode.id}`);
    } catch (error) {
      console.error('Error duplicating code:', error);
      alert('שגיאה בשכפול הקוד. נסה שוב.');
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
      alert('סוג קובץ לא נתמך');
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('הקובץ גדול מדי. מקסימום 5MB');
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
      alert('שגיאה בהעלאת הקובץ. נסה שוב.');
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
      alert('שגיאה בהחלפת הקובץ. נסה שוב.');
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
      alert('שגיאה במחיקת המדיה. נסה שוב.');
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
      alert('שגיאה בשמירת התזמון. נסה שוב.');
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
      alert('שגיאה בשמירת הלינק. נסה שוב.');
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
      alert('שגיאה בהוספת הלינק. נסה שוב.');
    } finally {
      setAddingLink(false);
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
      alert('שגיאה בהוספת ענן המילים. נסה שוב.');
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
      alert('שגיאה בשמירת כתב החידה. נסה שוב.');
    } finally {
      setAddingRiddle(false);
    }
  };

  // Handler for adding or editing a selfiebeam
  const handleSaveSelfiebeam = async (content: SelfiebeamContent, imageFiles: File[]) => {
    if (!code || !user) return;

    setAddingSelfiebeam(true);
    try {
      // Get the original images from the existing selfiebeam (if editing)
      const existingSelfiebeam = editingSelfiebeamId
        ? code.media.find(m => m.id === editingSelfiebeamId)?.selfiebeamContent
        : null;
      const originalImages = existingSelfiebeam?.images || [];

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

      // Build selfiebeamContent without undefined values for Firebase
      const selfiebeamContent: SelfiebeamContent = {
        title: content.title,
        content: content.content,
        backgroundColor: content.backgroundColor,
        textColor: content.textColor,
        images: uploadedImageUrls.length > 0 ? uploadedImageUrls : [],
        galleryEnabled: content.galleryEnabled || false,
        allowAnonymous: content.allowAnonymous ?? true,
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
      alert('שגיאה בשמירת סלפי בים. נסה שוב.');
    } finally {
      setAddingSelfiebeam(false);
    }
  };

  const handleSaveWhatsappWidget = async (groupLink: string | undefined) => {
    if (!code) return;

    try {
      const updatedWidgets: CodeWidgets = {
        ...code.widgets,
      };

      if (groupLink) {
        updatedWidgets.whatsapp = { enabled: true, groupLink };
      } else {
        delete updatedWidgets.whatsapp;
      }

      await updateQRCode(code.id, { widgets: updatedWidgets });
      setCode((prev) => prev ? { ...prev, widgets: updatedWidgets } : null);
    } catch (error) {
      console.error('Error saving WhatsApp widget:', error);
      alert('שגיאה בשמירת הווידג׳ט. נסה שוב.');
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
      alert('שגיאה בשמירת הסימן. נסה שוב.');
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
    const parts: string[] = [];
    if (schedule.startDate) {
      parts.push(`מ-${schedule.startDate.toLocaleDateString('he-IL')}`);
    }
    if (schedule.endDate) {
      parts.push(`עד ${schedule.endDate.toLocaleDateString('he-IL')}`);
    }
    if (schedule.startTime) {
      parts.push(`${schedule.startTime}`);
    }
    if (schedule.endTime) {
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
        <p className="text-text-secondary">הקוד לא נמצא</p>
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
                title={folder ? `חזור ל${folder.name}` : 'חזור לדשבורד'}
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
                      <span className="text-accent">+{views24h} היום</span>
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
              <div ref={qrRef} className="flex justify-center p-4 bg-white rounded-xl">
                <div className="relative inline-block">
                  <QRCodeSVG
                    value={viewUrl}
                    size={220}
                    level="H"
                    marginSize={1}
                  />
                  {code.widgets?.qrSign?.enabled && code.widgets.qrSign.value && (
                    <div
                      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center shadow-md"
                      style={{
                        width: 55,
                        height: 55,
                        backgroundColor: code.widgets.qrSign.backgroundColor,
                      }}
                    >
                      {code.widgets.qrSign.type === 'icon' ? (
                        (() => {
                          const LucideIcons = require('lucide-react');
                          const IconComponent = LucideIcons[code.widgets.qrSign.value];
                          return IconComponent ? (
                            <IconComponent size={30} color={code.widgets.qrSign.color} strokeWidth={2.5} />
                          ) : null;
                        })()
                      ) : (
                        <span
                          style={{
                            color: code.widgets.qrSign.color,
                            fontFamily: 'var(--font-assistant), Arial, sans-serif',
                            fontSize: code.widgets.qrSign.type === 'emoji' ? 30 : (code.widgets.qrSign.value.length <= 2 ? 24 : 16),
                            fontWeight: code.widgets.qrSign.type === 'text' ? 700 : 400,
                            lineHeight: 1,
                          }}
                        >
                          {code.widgets.qrSign.value}
                        </span>
                      )}
                    </div>
                  )}
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
                    title="העתק לינק"
                  >
                    <Copy className={clsx('w-4 h-4', linkCopied ? 'text-success' : 'text-text-secondary')} />
                  </button>
                  <a
                    href={viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-bg-hover transition-colors"
                    title="פתח בחלון חדש"
                  >
                    <ExternalLink className="w-4 h-4 text-text-secondary" />
                  </a>
                </div>

                {linkCopied && (
                  <p className="text-sm text-success text-center">הלינק הועתק!</p>
                )}
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  צפייה
                </a>
                <button
                  onClick={handleDownloadQR}
                  className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  הדפסת QR
                </button>
              </div>

              {/* Share buttons */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-text-secondary">שיתוף</h3>
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
              <span>ווידג׳טים</span>
              {widgetsExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {/* Collapsible content - Widget buttons grid */}
            {widgetsExpanded && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {/* QR Sign Widget Button */}
                <button
                  onClick={() => setQrSignModalOpen(true)}
                  className={clsx(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                    code.widgets?.qrSign?.enabled
                      ? "bg-accent/10 border-accent text-accent"
                      : "bg-bg-secondary border-border text-text-secondary hover:bg-bg-hover"
                  )}
                >
                  <div className={clsx(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    code.widgets?.qrSign?.enabled ? "bg-accent/20" : "bg-bg-hover"
                  )}>
                    {code.widgets?.qrSign?.enabled && code.widgets.qrSign.value ? (
                      code.widgets.qrSign.type === 'icon' ? (
                        (() => {
                          const LucideIcons = require('lucide-react');
                          const IconComponent = LucideIcons[code.widgets.qrSign.value];
                          return IconComponent ? (
                            <IconComponent size={20} className="text-accent" />
                          ) : <QrCode className="w-5 h-5" />;
                        })()
                      ) : (
                        <span className="text-sm font-bold">{code.widgets.qrSign.value}</span>
                      )
                    ) : (
                      <QrCode className="w-5 h-5" />
                    )}
                  </div>
                  <span className="text-sm font-medium">סימן QR</span>
                  <span className={clsx(
                    "text-xs px-2 py-0.5 rounded-full",
                    code.widgets?.qrSign?.enabled
                      ? "bg-accent/20 text-accent"
                      : "bg-bg-hover text-text-secondary"
                  )}>
                    {code.widgets?.qrSign?.enabled ? 'פעיל' : 'כבוי'}
                  </span>
                </button>

                {/* WhatsApp Widget Button */}
                <button
                  onClick={() => setWhatsappModalOpen(true)}
                  className={clsx(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                    code.widgets?.whatsapp?.enabled
                      ? "bg-[#25D366]/10 border-[#25D366] text-[#25D366]"
                      : "bg-bg-secondary border-border text-text-secondary hover:bg-bg-hover"
                  )}
                >
                  <div className={clsx(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    code.widgets?.whatsapp?.enabled ? "bg-[#25D366]/20" : "bg-bg-hover"
                  )}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium">WhatsApp</span>
                  <span className={clsx(
                    "text-xs px-2 py-0.5 rounded-full",
                    code.widgets?.whatsapp?.enabled
                      ? "bg-[#25D366]/20 text-[#25D366]"
                      : "bg-bg-hover text-text-secondary"
                  )}>
                    {code.widgets?.whatsapp?.enabled ? 'פעיל' : 'כבוי'}
                  </span>
                </button>

              </div>
            )}
          </div>
        </div>

        {/* Media List */}
        <div className="lg:col-span-2 card space-y-4">
          {/* Header with title edit, action buttons and media count */}
          <div className="flex flex-col gap-3">
            {/* Title edit row - title only on mobile, title + buttons on desktop */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 text-lg font-semibold text-text-primary bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 py-1"
                placeholder="שם הקוד"
              />
              {/* Action buttons - hidden on mobile, shown on desktop */}
              <div className="hidden sm:flex items-center gap-2">
                <Tooltip text="שמור שינויים">
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
                <Tooltip text="שכפל קוד">
                  <button
                    onClick={handleDuplicate}
                    className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    <CopyPlus className="w-4 h-4" />
                  </button>
                </Tooltip>
                {user && canDeleteCode(code, user.id, user.role) && (
                  <Tooltip text="מחק קוד">
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
              <Tooltip text="שמור שינויים">
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
              <Tooltip text="שכפל קוד">
                <button
                  onClick={handleDuplicate}
                  className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors"
                >
                  <CopyPlus className="w-4 h-4" />
                </button>
              </Tooltip>
              {user && canDeleteCode(code, user.id, user.role) && (
                <Tooltip text="מחק קוד">
                  <button
                    onClick={() => setDeleteModal(true)}
                    className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
            </div>
            {/* Media count and add buttons */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">
                {code.media.length} פריטי מדיה
              </span>
              <div className="flex items-center gap-2">
                {/* Add Riddle Button */}
                <Tooltip text="כתב חידה">
                  <button
                    onClick={() => setRiddleModalOpen(true)}
                    className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center"
                  >
                    <ScrollText className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Add WordCloud Button */}
                <Tooltip text="ענן מילים">
                  <button
                    onClick={() => setWordCloudModalOpen(true)}
                    className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center"
                  >
                    <Cloud className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Selfiebeam Button */}
                <Tooltip text="סלפי בים">
                  <button
                    onClick={() => setSelfiebeamModalOpen(true)}
                    className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Minigames Button - Coming Soon */}
                <Tooltip text="מיניגיימס - בקרוב">
                  <button
                    disabled
                    className="p-2 rounded-lg bg-bg-secondary text-text-secondary cursor-not-allowed opacity-50 flex items-center justify-center"
                  >
                    <Gamepad2 className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Add Link Button */}
                <Tooltip text="הוסף לינק">
                  <button
                    onClick={() => setAddLinkModalOpen(true)}
                    className="p-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center"
                  >
                    <LinkIcon className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Add Media Button */}
                <Tooltip text="הוסף קובץ">
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

          {/* Media items */}
          <div className="space-y-3">
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
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="drag-handle cursor-grab active:cursor-grabbing text-text-secondary hover:text-text-primary transition-colors touch-none">
                    <GripVertical className="w-5 h-5" />
                  </div>

                  {/* Thumbnail */}
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-bg-primary flex items-center justify-center overflow-hidden flex-shrink-0">
                    {media.type === 'link' ? (
                      <LinkIcon className="w-5 h-5 sm:w-6 sm:h-6 text-text-secondary" />
                    ) : media.type === 'video' ? (
                      <Video className="w-5 h-5 sm:w-6 sm:h-6 text-text-secondary" />
                    ) : media.type === 'pdf' ? (
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-text-secondary" />
                    ) : media.type === 'riddle' ? (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: media.riddleContent?.backgroundColor || '#1a1a2e' }}
                      >
                        <ScrollText className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: media.riddleContent?.textColor || '#fff' }} />
                      </div>
                    ) : media.type === 'selfiebeam' ? (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: media.selfiebeamContent?.backgroundColor || '#1a1a2e' }}
                      >
                        <Camera className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: media.selfiebeamContent?.textColor || '#fff' }} />
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
                        {media.type === 'link' ? 'לינק' : media.type === 'riddle' ? (media.riddleContent?.title || 'כתב חידה') : media.type === 'selfiebeam' ? (media.selfiebeamContent?.title || 'סלפי בים') : media.type === 'wordcloud' ? 'ענן מילים' : media.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-text-secondary">#{index + 1}</span>
                    </div>
                    {media.type !== 'riddle' && media.type !== 'selfiebeam' && media.type !== 'link' && media.type !== 'wordcloud' && media.filename && (
                      <p className="text-xs text-text-secondary truncate mt-1" dir="ltr">
                        {media.filename}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {media.size > 0 && (
                        <span className="text-xs text-text-secondary">
                          {formatBytes(media.size)}
                        </span>
                      )}
                      {media.type === 'pdf' && media.pageCount && media.pageCount > 0 && (
                        <span className="text-xs text-text-secondary">
                          {media.pageCount} {media.pageCount === 1 ? 'עמוד' : 'עמודים'}
                        </span>
                      )}
                      {media.schedule?.enabled && (() => {
                        const active = isScheduleActive(media.schedule);
                        return (
                          <span className={`text-xs flex items-center gap-1 ${active ? 'text-green-500' : 'text-red-500'}`}>
                            <Clock className="w-3 h-3" />
                            <span className="hidden sm:inline">{formatSchedule(media.schedule)}</span>
                          </span>
                        );
                      })()}
                      {media.linkUrl && (
                        <span className="text-xs text-accent flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" />
                          <span className="hidden sm:inline">{media.linkTitle || new URL(media.linkUrl).hostname}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions - bottom row on mobile, inline on desktop */}
                <div className="flex items-center gap-1 justify-end border-t border-border/50 pt-2 sm:border-0 sm:pt-0">
                  {/* Edit button for riddle */}
                  {media.type === 'riddle' && (
                    <Tooltip text="ערוך">
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
                    <Tooltip text={`גלריית סלפי (${code.userGallery?.length || 0})`}>
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
                    <Tooltip text="ערוך">
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

                  {/* Gallery button for selfiebeam with gallery enabled */}
                  {media.type === 'selfiebeam' && media.selfiebeamContent?.galleryEnabled && (
                    <Tooltip text={`גלריית סלפי (${code.userGallery?.length || 0})`}>
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

                  {/* Replace button - not for links, riddles, or selfiebeams */}
                  {media.type !== 'link' && media.type !== 'riddle' && media.type !== 'selfiebeam' && (
                    <Tooltip text="החלף קובץ">
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
                  <Tooltip text="תזמון הצגה">
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
                    <Tooltip text={media.linkUrl ? 'ערוך לינק' : 'הוסף לינק'}>
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
                  <Tooltip text="פתח בחלון חדש">
                    <a
                      href={media.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Tooltip>

                  {/* Delete */}
                  <Tooltip text="מחק מדיה">
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

            {code.media.length === 0 && (
              <div className="text-center py-12 text-text-secondary">
                <p>אין מדיה בקוד זה</p>
                <p className="text-sm mt-1">הוסף תמונה, וידאו, PDF או לינק</p>
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

      {/* Delete media confirmation modal */}
      {deleteMediaModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-text-primary mb-2">מחיקת מדיה</h3>
            <p className="text-text-secondary mb-4">
              האם אתה בטוח שברצונך למחוק את פריט המדיה הזה?
              <br />
              <span className="text-sm text-danger">פעולה זו אינה ניתנת לביטול.</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteMediaModal({ isOpen: false, mediaId: null })}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                ביטול
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
                מחק
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
        currentGroupLink={code.widgets?.whatsapp?.groupLink}
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
    </div>
  );
}
