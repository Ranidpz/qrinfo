'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import WeeklyCalendarModal from '@/components/modals/WeeklyCalendarModal';
import { WeeklyCalendarConfig, DEFAULT_WEEKLYCAL_CONFIG } from '@/types/weeklycal';

// Remove undefined values recursively (Firebase doesn't accept undefined)
function removeUndefinedValues<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedValues(item)) as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export default function CalendarEditorPage() {
  const router = useRouter();
  const params = useParams();
  const locale = useLocale();
  const { user } = useAuth();
  const codeId = params.codeId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<WeeklyCalendarConfig | null>(null);
  const [shortId, setShortId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Load code data
  useEffect(() => {
    const loadCode = async () => {
      if (!codeId || !db) {
        setError('Invalid code ID');
        setLoading(false);
        return;
      }

      try {
        const codeRef = doc(db, 'codes', codeId);
        const codeSnap = await getDoc(codeRef);

        if (!codeSnap.exists()) {
          setError('Code not found');
          setLoading(false);
          return;
        }

        const data = codeSnap.data();

        // Check if this is a weeklycal code - type is in media[0].type
        const mediaType = data.media?.[0]?.type;
        if (mediaType !== 'weeklycal') {
          setError('This code is not a weekly calendar');
          setLoading(false);
          return;
        }

        setShortId(data.shortId || '');
        // Config is stored in media[0].weeklycalConfig
        setConfig(data.media[0].weeklycalConfig as WeeklyCalendarConfig || DEFAULT_WEEKLYCAL_CONFIG);
        setLoading(false);
      } catch (err) {
        console.error('Error loading code:', err);
        setError('Failed to load calendar');
        setLoading(false);
      }
    };

    loadCode();
  }, [codeId]);

  // Handle save
  const handleSave = useCallback(async (
    newConfig: WeeklyCalendarConfig,
    landingImageFile?: File,
    dayBgImageFile?: File
  ) => {
    if (!codeId || !db || !user) return;

    setSaving(true);
    try {
      console.log('Save started, config mode:', newConfig.mode);
      console.log('Config keys:', Object.keys(newConfig));

      // Upload images if provided
      let landingImageUrl = newConfig.branding?.landing?.splashImageUrl;
      let dayBgImageUrl = newConfig.branding?.dayBackgroundImageUrl;

      if (landingImageFile) {
        const formData = new FormData();
        formData.append('file', landingImageFile);
        formData.append('userId', user.id);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const { url } = await res.json();
          landingImageUrl = url;
        }
      }

      if (dayBgImageFile) {
        const formData = new FormData();
        formData.append('file', dayBgImageFile);
        formData.append('userId', user.id);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const { url } = await res.json();
          dayBgImageUrl = url;
        }
      }

      const configToSave = {
        ...newConfig,
        branding: {
          ...(newConfig.branding || {}),
          landing: {
            ...(newConfig.branding?.landing || {}),
            splashImageUrl: landingImageUrl,
          },
          dayBackgroundImageUrl: dayBgImageUrl,
        },
      };

      // Clean config before saving (Firebase doesn't accept undefined values)
      const cleanedConfig = removeUndefinedValues(configToSave);
      console.log('Cleaned config for Firebase save');

      // Update Firestore - config is stored in media[0].weeklycalConfig
      const codeRef = doc(db, 'codes', codeId);
      const codeSnap = await getDoc(codeRef);
      if (codeSnap.exists()) {
        const data = codeSnap.data();
        const updatedMedia = [...(data.media || [])];
        if (updatedMedia[0]) {
          updatedMedia[0] = {
            ...updatedMedia[0],
            weeklycalConfig: cleanedConfig,
          };
        }
        console.log('Updating Firestore...');
        await updateDoc(codeRef, {
          media: updatedMedia,
          updatedAt: serverTimestamp(),
        });
        console.log('Firestore update complete');
      }

      setConfig(cleanedConfig);
      // Stay on the page - user can continue editing or click X to close
    } catch (err) {
      console.error('Error saving:', err);
      console.error('Error details:', err instanceof Error ? err.message : String(err));
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack');
      alert('Failed to save changes: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }, [codeId, user, locale, router]);

  // Handle cancel/close
  const handleClose = useCallback(() => {
    router.push(`/${locale}/dashboard`);
  }, [locale, router]);

  // Handle image upload
  const handleUploadCellImage = useCallback(async (file: File): Promise<string | null> => {
    if (!user) return null;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const { url } = await res.json();
        return url;
      }
      return null;
    } catch {
      return null;
    }
  }, [user]);

  // Handle image delete
  const handleDeleteCellImage = useCallback(async (url: string): Promise<boolean> => {
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
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // Error state
  if (error || !config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary gap-4">
        <p className="text-text-secondary">{error || 'Failed to load calendar'}</p>
        <button
          onClick={() => router.push(`/${locale}/dashboard`)}
          className="btn bg-accent text-white hover:bg-accent-hover"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <WeeklyCalendarModal
      fullPage={true}
      isOpen={true}
      onClose={handleClose}
      onSave={handleSave}
      onUploadCellImage={handleUploadCellImage}
      onDeleteCellImage={handleDeleteCellImage}
      loading={saving}
      initialConfig={config}
      shortId={shortId}
      codeId={codeId}
    />
  );
}
