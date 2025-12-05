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
  Image,
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
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { getQRCode, updateQRCode, deleteQRCode, canEditCode, canDeleteCode, updateUserStorage, getUserFolders, createQRCode } from '@/lib/db';
import { subscribeToCodeViews } from '@/lib/analytics';
import { QRCode as QRCodeType, MediaItem, MediaSchedule, Folder, CodeWidgets } from '@/types';
import DeleteConfirm from '@/components/modals/DeleteConfirm';
import ScheduleModal from '@/components/modals/ScheduleModal';
import MediaLinkModal from '@/components/modals/MediaLinkModal';
import { clsx } from 'clsx';

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

  // Widgets state
  const [whatsappGroupLink, setWhatsappGroupLink] = useState('');

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
        setWhatsappGroupLink(codeData.widgets?.whatsapp?.groupLink || '');

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
    const canvas = qrCanvasRef.current.querySelector('canvas');
    if (!canvas) return;

    // Create download link
    const link = document.createElement('a');
    link.download = `${code.title}.png`;
    link.href = canvas.toDataURL('image/png');
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

      // Add to media array
      const newMedia: MediaItem = {
        id: `media_${Date.now()}`,
        url: uploadData.url,
        type: uploadData.type,
        size: uploadData.size,
        order: code.media.length,
        uploadedBy: user.id,
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

      // Update media in array
      const updatedMedia = code.media.map((m) =>
        m.id === mediaId
          ? {
              ...m,
              url: uploadData.url,
              type: uploadData.type,
              size: uploadData.size,
              uploadedBy: user.id,
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

  const handleSaveWhatsappWidget = async () => {
    if (!code) return;

    try {
      // Firebase doesn't accept undefined values, so we need to build the object carefully
      const updatedWidgets: CodeWidgets = {
        ...code.widgets,
      };

      if (whatsappGroupLink) {
        updatedWidgets.whatsapp = { enabled: true, groupLink: whatsappGroupLink };
      } else {
        // Remove the whatsapp widget by setting it to null (Firebase accepts null to delete fields)
        delete updatedWidgets.whatsapp;
      }

      await updateQRCode(code.id, { widgets: updatedWidgets });
      setCode((prev) => prev ? { ...prev, widgets: updatedWidgets } : null);
    } catch (error) {
      console.error('Error saving WhatsApp widget:', error);
      alert('שגיאה בשמירת הווידג׳ט. נסה שוב.');
    }
  };

  // Get the current media for link modal
  const currentMediaForLink = code?.media.find((m) => m.id === linkModal.mediaId);

  const getMediaIcon = (type: MediaItem['type']) => {
    switch (type) {
      case 'video':
        return <Video className="w-5 h-5" />;
      case 'pdf':
        return <FileText className="w-5 h-5" />;
      case 'link':
        return <LinkIcon className="w-5 h-5" />;
      default:
        return <Image className="w-5 h-5" />;
    }
  };

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
          <button
            onClick={handleQrToggle}
            className="w-full flex items-center justify-between"
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
          </button>

          {/* Collapsible QR Content */}
          {qrExpanded && (
            <div className="space-y-6">
              {/* QR Code */}
              <div ref={qrRef} className="flex justify-center p-4 bg-white rounded-xl">
                <QRCodeSVG
                  value={viewUrl}
                  size={220}
                  level="H"
                  marginSize={1}
                />
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
              <div className="flex items-center gap-2">
                <span>ווידג׳טים</span>
                {code.widgets?.whatsapp?.enabled && code.widgets?.whatsapp?.groupLink && (
                  <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                  </div>
                )}
              </div>
              {widgetsExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {/* Collapsible content */}
            {widgetsExpanded && (
              <div className="mt-3 space-y-3">
                {/* WhatsApp Group Link Widget */}
                <div className="space-y-2">
                  <label className="text-xs text-text-secondary flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    קישור לקבוצת WhatsApp
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={whatsappGroupLink}
                      onChange={(e) => setWhatsappGroupLink(e.target.value)}
                      placeholder="https://chat.whatsapp.com/..."
                      className="flex-1 px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                      dir="ltr"
                    />
                    <button
                      onClick={handleSaveWhatsappWidget}
                      disabled={whatsappGroupLink === (code.widgets?.whatsapp?.groupLink || '')}
                      className="px-3 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BD5A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-text-secondary">
                    הכפתור יופיע לצופה אחרי שנייה עם אנימציה
                  </p>
                </div>
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
            {/* Media count and add button */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">
                {code.media.length} פריטי מדיה
              </span>
              <Tooltip text="הוסף מדיה">
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

          {/* Media items */}
          <div className="space-y-3">
            {code.media.map((media, index) => (
              <div
                key={media.id}
                data-index={index}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, index)}
                onTouchStart={(e) => handleTouchStart(e, index)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={clsx(
                  'media-item flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-bg-secondary rounded-xl group transition-all duration-200',
                  draggedIndex === index && 'opacity-50 scale-[0.98]',
                  dragOverIndex === index && 'ring-2 ring-accent ring-offset-2 ring-offset-bg-primary'
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
                      {getMediaIcon(media.type)}
                      <span className="text-sm font-medium text-text-primary">
                        {media.type === 'link' ? 'לינק' : media.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-text-secondary">#{index + 1}</span>
                    </div>
                    <p className="text-xs text-text-secondary truncate mt-1 hidden sm:block" dir="ltr">
                      {media.url}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {media.size > 0 && (
                        <span className="text-xs text-text-secondary">
                          {formatBytes(media.size)}
                        </span>
                      )}
                      {media.schedule?.enabled && (
                        <span className="text-xs text-accent flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span className="hidden sm:inline">{formatSchedule(media.schedule)}</span>
                        </span>
                      )}
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
                  {/* Replace button */}
                  {media.type !== 'link' && (
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
    </div>
  );
}
