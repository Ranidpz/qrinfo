'use client';

import { useState, useEffect, use } from 'react';
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
  Settings,
  Share2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { getQRCode, updateQRCode, deleteQRCode, canEditCode, canDeleteCode, updateUserStorage } from '@/lib/db';
import { QRCode as QRCodeType, MediaItem } from '@/types';
import DeleteConfirm from '@/components/modals/DeleteConfirm';
import { clsx } from 'clsx';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CodeEditPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [code, setCode] = useState<QRCodeType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [uploading, setUploading] = useState(false);

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
            <p className="text-sm text-text-secondary mt-1">
              {code.shortId} | {code.views} צפיות
            </p>
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
          <div className="flex justify-center p-6 bg-white rounded-xl">
            <QRCodeSVG
              value={viewUrl}
              size={200}
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
            <button className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover flex items-center justify-center gap-2">
              <Share2 className="w-4 h-4" />
              שיתוף
            </button>
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
                  {media.size > 0 && (
                    <p className="text-xs text-text-secondary mt-1">
                      {formatBytes(media.size)}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
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
    </div>
  );
}
