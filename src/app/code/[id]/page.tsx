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
  Share2,
  Download,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { getQRCode, updateQRCode, deleteQRCode, canEditCode, canDeleteCode, updateUserStorage } from '@/lib/db';
import { subscribeToCodeViews } from '@/lib/analytics';
import { QRCode as QRCodeType, MediaItem, MediaSchedule } from '@/types';
import DeleteConfirm from '@/components/modals/DeleteConfirm';
import ScheduleModal from '@/components/modals/ScheduleModal';
import { clsx } from 'clsx';

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
  const prevViewsRef = useRef(0);

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

      router.push('/dashboard');
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

  const handleShareLink = () => {
    if (!code) return;
    const url = `${window.location.origin}/v/${code.shortId}`;
    if (navigator.share) {
      navigator.share({
        title: code.title,
        url: url,
      });
    } else {
      handleCopyLink();
    }
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
          >
            <ArrowRight className="w-5 h-5 text-text-secondary" />
          </button>
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-bold text-text-primary bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 py-1 -mx-2"
            />
            <div className="flex items-center gap-2 text-sm text-text-secondary mt-1">
              <span>{code.shortId}</span>
              <span>|</span>
              <div className="relative group">
                <span className={clsx(
                  "flex items-center gap-1 cursor-help transition-all",
                  isAnimating && "text-green-500 font-bold scale-110"
                )}>
                  <Eye className="w-3.5 h-3.5" />
                  {displayViews} צפיות
                </span>
                {/* Tooltip */}
                <div className="absolute bottom-full left-0 mb-2 p-2 bg-bg-card border border-border rounded-lg shadow-lg z-50 whitespace-nowrap text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-text-secondary">סה״כ צפיות:</span>
                      <span className="text-text-primary font-medium">{code.views}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-text-secondary">24 שעות אחרונות:</span>
                      <span className="text-accent font-medium">{views24h}</span>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 left-3 w-2 h-2 bg-bg-card border-r border-b border-border transform rotate-45"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || title === code.title}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            שמור
          </button>

          {user && canDeleteCode(code, user.id, user.role) && (
            <button
              onClick={() => setDeleteModal(true)}
              className="btn btn-danger flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              מחק
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Code & Links */}
        <div className="card space-y-6">
          <h2 className="text-lg font-semibold text-text-primary">קוד QR</h2>

          {/* QR Code */}
          <div ref={qrRef} className="flex justify-center p-6 bg-white rounded-xl">
            <QRCodeSVG
              value={viewUrl}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Hidden high-res QR for download */}
          <div ref={qrCanvasRef} className="hidden">
            <QRCodeCanvas
              value={viewUrl}
              size={1000}
              level="H"
              includeMargin={true}
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
              <Download className="w-4 h-4" />
              הורדת QR
            </button>
          </div>

          {/* Share buttons */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-text-secondary">שיתוף</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleShareWhatsApp}
                className="btn bg-[#25D366] text-white hover:bg-[#20BD5A] flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                WhatsApp
              </button>
              <button
                onClick={handleShareLink}
                className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                שיתוף לינק
              </button>
            </div>
          </div>
        </div>

        {/* Media List */}
        <div className="lg:col-span-2 card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">
              מדיה ({code.media.length})
            </h2>
            <label className="btn btn-primary flex items-center gap-2 cursor-pointer">
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              הוסף מדיה
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
          </div>

          {/* Media items */}
          <div className="space-y-3">
            {code.media.map((media, index) => (
              <div
                key={media.id}
                className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl group"
              >
                <div className="cursor-grab text-text-secondary">
                  <GripVertical className="w-5 h-5" />
                </div>

                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-lg bg-bg-primary flex items-center justify-center overflow-hidden flex-shrink-0">
                  {media.type === 'link' ? (
                    <LinkIcon className="w-6 h-6 text-text-secondary" />
                  ) : media.type === 'video' ? (
                    <Video className="w-6 h-6 text-text-secondary" />
                  ) : media.type === 'pdf' ? (
                    <FileText className="w-6 h-6 text-text-secondary" />
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
                  <p className="text-xs text-text-secondary truncate mt-1" dir="ltr">
                    {media.url}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {media.size > 0 && (
                      <span className="text-xs text-text-secondary">
                        {formatBytes(media.size)}
                      </span>
                    )}
                    {media.schedule?.enabled && (
                      <span className="text-xs text-accent flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatSchedule(media.schedule)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {/* Replace button */}
                  {media.type !== 'link' && (
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
                  )}

                  {/* Schedule button */}
                  <button
                    onClick={() => setScheduleModal({ isOpen: true, mediaId: media.id })}
                    className={clsx(
                      'p-2 rounded-lg hover:bg-bg-hover transition-colors',
                      media.schedule?.enabled ? 'text-accent' : 'text-text-secondary'
                    )}
                    title="תזמון"
                  >
                    <Clock className="w-4 h-4" />
                  </button>

                  {/* External link */}
                  <a
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {/* Delete */}
                  <button
                    onClick={() => handleRemoveMedia(media.id)}
                    className="p-2 rounded-lg hover:bg-danger/10 text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
    </div>
  );
}
