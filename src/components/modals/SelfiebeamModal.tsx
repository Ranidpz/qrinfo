'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, FileText, Trash2, Loader2, Camera, Users, Pipette, Building2,
  Palette, Settings as SettingsIcon, Images, ShieldCheck, Monitor, Smartphone, ImagePlus, Zap, Copy, Check,
} from 'lucide-react';
import { SelfiebeamContent } from '@/types';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import SelfiebeamPhotoManager from './SelfiebeamPhotoManager';
import SelfiebeamBeamSettings from './SelfiebeamBeamSettings';

interface SelfiebeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Resolves to the persisted content on success (so the modal can reconcile its
  // logo state and show a "saved" confirmation without closing); void/undefined
  // means the parent handled closing/navigation or the save failed.
  onSave: (content: SelfiebeamContent, logoFiles: File[]) => Promise<SelfiebeamContent | void>;
  loading?: boolean;
  initialContent?: SelfiebeamContent;
  codeId?: string; // present when editing an existing code → enables live photo management
  mediaId?: string; // the selfiebeam media item id (present when editing) → enables instant token save
  ownerId?: string;
  shortId?: string; // present when editing → enables the "open beam display" link
}

type TabKey = 'design' | 'settings' | 'photos';

// Preset color palettes - 6 colors each
const backgroundColors = ['#1a1a2e', '#1a1a1a', '#ffffff', '#fef3c7', '#dbeafe', '#fce7f3'];
const textColors = ['#ffffff', '#1a1a1a', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6'];

function ToggleRow({
  label, description, checked, onChange,
}: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        {description && <p className="text-xs text-text-secondary mt-1">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-accent' : 'bg-border'}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'right-1' : 'left-1'}`} />
      </button>
    </div>
  );
}

export default function SelfiebeamModal({
  isOpen,
  onClose,
  onSave,
  loading = false,
  initialContent,
  codeId,
  mediaId,
  ownerId,
  shortId,
}: SelfiebeamModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('photos');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#1a1a2e');
  const [textColor, setTextColor] = useState('#ffffff');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [customBgColor, setCustomBgColor] = useState('');
  const [customTextColor, setCustomTextColor] = useState('');
  const [galleryEnabled, setGalleryEnabled] = useState(false);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [autoApprove, setAutoApprove] = useState(true);
  const [maxUploadsPerUser, setMaxUploadsPerUser] = useState(3);
  const [photographerToken, setPhotographerToken] = useState('');
  const [photographerLinkCopied, setPhotographerLinkCopied] = useState(false);
  const [photographerOnly, setPhotographerOnly] = useState(false);
  const [logoFiles, setLogoFiles] = useState<File[]>([]);
  const [logoPreviews, setLogoPreviews] = useState<string[]>([]);
  const [existingLogos, setExistingLogos] = useState<string[]>([]);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  // Preserve any legacy content.images so we don't wipe old data (beam reads userGallery now).
  const [legacyImages, setLegacyImages] = useState<string[]>([]);
  const logoInputRef = useRef<HTMLInputElement>(null);
  // Tracks which item we last initialized the form for, so a Save (which mutates
  // the parent's code state → new initialContent reference) doesn't reset the
  // active tab / fields while the user keeps editing.
  const initKeyRef = useRef<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = useTranslations('modals');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (!isOpen) {
      // Reset so reopening the modal re-initializes from fresh data.
      initKeyRef.current = null;
      setJustSaved(false);
      return;
    }
    // Re-initialize only when the modal opens or switches to a different item —
    // NOT on every initialContent reference change. A Save updates the parent's
    // code state (new initialContent reference) but we want the user's tab and
    // edits to stay put so they can keep working.
    const itemKey = mediaId ?? '__create__';
    if (initKeyRef.current === itemKey) return;
    initKeyRef.current = itemKey;

    // Photos is the primary surface; fall back to Design when creating a new code (no codeId yet)
    setActiveTab(codeId ? 'photos' : 'design');
    if (initialContent) {
      setTitle(initialContent.title);
      setContent(initialContent.content);
      setBackgroundColor(initialContent.backgroundColor);
      setTextColor(initialContent.textColor);
      setYoutubeUrl(initialContent.youtubeUrl || '');
      setGalleryEnabled(initialContent.galleryEnabled || false);
      setAllowAnonymous(initialContent.allowAnonymous ?? true);
      setAutoApprove(initialContent.autoApprove ?? true);
      setMaxUploadsPerUser(initialContent.maxUploadsPerUser ?? 3);
      setPhotographerToken(initialContent.photographerToken ?? '');
      setPhotographerOnly(initialContent.photographerOnly ?? false);
      setLogoPreviews(initialContent.companyLogos || []);
      setExistingLogos(initialContent.companyLogos || []);
      setLegacyImages(initialContent.images || []);
    } else {
      setTitle('');
      setContent('');
      setBackgroundColor('#1a1a2e');
      setTextColor('#ffffff');
      setYoutubeUrl('');
      setGalleryEnabled(false);
      setAllowAnonymous(true);
      setAutoApprove(true);
      setMaxUploadsPerUser(3);
      setLogoPreviews([]);
      setExistingLogos([]);
      setLegacyImages([]);
    }
    setLogoFiles([]);
    setError('');
    setCustomBgColor('');
    setCustomTextColor('');
  }, [isOpen, initialContent, codeId, mediaId]);

  // Clear the pending "saved" timer on unmount.
  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  // Generate previews for newly added logo files
  useEffect(() => {
    const newPreviews: string[] = logoFiles.map((file) => URL.createObjectURL(file));
    setLogoPreviews([...existingLogos, ...newPreviews]);
    return () => newPreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [logoFiles, existingLogos]);

  if (!isOpen) return null;

  const handleAddLogos = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    setLogoFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveLogo = (index: number) => {
    const existingCount = existingLogos.length;
    if (index < existingCount) {
      setExistingLogos((prev) => prev.filter((_, i) => i !== index));
    } else {
      setLogoFiles((prev) => prev.filter((_, i) => i !== index - existingCount));
    }
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    handleAddLogos(e.dataTransfer.files);
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
      setError(t('riddleTitleRequired'));
      setActiveTab('design');
      return;
    }
    if (youtubeUrl && !extractYoutubeId(youtubeUrl)) {
      setError(t('riddleYoutubeError'));
      setActiveTab('design');
      return;
    }

    const selfiebeamContent: SelfiebeamContent = {
      title: title.trim(),
      content: content.trim(),
      backgroundColor,
      textColor,
      youtubeUrl: youtubeUrl.trim() || undefined,
      images: legacyImages, // preserved, not edited here (beam reads userGallery)
      galleryEnabled,
      allowAnonymous,
      autoApprove,
      maxUploadsPerUser,
      photographerToken: photographerToken || undefined,
      photographerOnly,
      companyLogos: existingLogos,
    };

    const saved = await onSave(selfiebeamContent, logoFiles);

    // Stay-open save: on success the parent returns the persisted content. Adopt
    // its final logo URLs and drop the pending File objects so a follow-up Save
    // doesn't re-upload them, then flash a "saved" confirmation without closing.
    if (saved && typeof saved === 'object') {
      setExistingLogos(saved.companyLogos || []);
      setLogoFiles([]);
      setJustSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setJustSaved(false), 2500);
    }
  };

  const tabs: { key: TabKey; label: string; icon: typeof Palette; disabled?: boolean }[] = [
    { key: 'photos', label: t('selfiebeamTabPhotos'), icon: Images },
    { key: 'design', label: t('selfiebeamTabDesign'), icon: Palette },
    { key: 'settings', label: t('selfiebeamTabSettings'), icon: SettingsIcon },
  ];

  // Photographer link: an unguessable handle (not a secret) that unlocks unlimited uploads
  // for staff while the public link stays capped. Persisted to Firestore the moment the toggle
  // flips (when editing an existing code) so the link works immediately — no Save needed.
  const togglePhotographerLink = async (enabled: boolean) => {
    const token = enabled ? (photographerToken || crypto.randomUUID().replace(/-/g, '').slice(0, 12)) : '';
    setPhotographerToken(token);
    setPhotographerLinkCopied(false);

    if (!codeId) return; // brand-new code with no doc yet — token persists on Save instead
    try {
      const ref = doc(db, 'codes', codeId);
      const snap = await getDoc(ref);
      const media = (snap.data()?.media || []) as Array<{ id: string; type?: string; selfiebeamContent?: SelfiebeamContent }>;
      // Target the edited media item by id; if the id wasn't passed (some open paths don't set
      // it), fall back to every selfiebeam item so the token still saves.
      let touched = 0;
      const nextMedia = media.map((m) => {
        const isTarget = mediaId ? m.id === mediaId : m.type === 'selfiebeam';
        if (isTarget && m.selfiebeamContent) {
          touched++;
          return { ...m, selfiebeamContent: { ...m.selfiebeamContent, photographerToken: token } };
        }
        return m;
      });
      if (!touched) {
        console.warn('Photographer token: no selfiebeam media item matched — will persist on Save.');
        return;
      }
      await updateDoc(ref, { media: nextMedia });
    } catch (err) {
      console.error('Failed to persist photographer token:', err);
    }
  };

  const photographerLink = shortId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/v/${shortId}?pk=${photographerToken}`
    : '';

  const copyPhotographerLink = async () => {
    if (!photographerLink) return;
    try {
      await navigator.clipboard.writeText(photographerLink);
      setPhotographerLinkCopied(true);
      setTimeout(() => setPhotographerLinkCopied(false), 2000);
    } catch {
      // clipboard blocked — user can still select the field manually
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-bg-card border-b border-border px-6 py-4 flex items-center justify-between gap-3 rounded-t-2xl">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            {t('selfiebeam')}
          </h2>
          <div className="flex items-center gap-2">
            {shortId && (
              <a
                href={`/gallery/${shortId}`}
                target="_blank"
                rel="noopener noreferrer"
                title={t('selfiebeamOpenBeam')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors text-sm font-medium"
              >
                <Monitor className="w-4 h-4" />
                {t('selfiebeamOpenBeam')}
              </a>
            )}
            {shortId && galleryEnabled && (
              <a
                href={`/v/${shortId}`}
                target="_blank"
                rel="noopener noreferrer"
                title={t('selfiebeamOpenUpload')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors text-sm font-medium border border-border"
              >
                <Smartphone className="w-4 h-4" />
                {t('selfiebeamOpenUpload')}
              </a>
            )}
            {shortId && galleryEnabled && photographerToken && (
              <a
                href={photographerLink}
                target="_blank"
                rel="noopener noreferrer"
                title={t('selfiebeamOpenPhotographer')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors text-sm font-medium"
              >
                <Zap className="w-4 h-4" />
                {t('selfiebeamOpenPhotographer')}
              </a>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-border">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body (scrolls) */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* ===== DESIGN TAB ===== */}
          {activeTab === 'design' && (
            <>
              {/* Experience name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  {t('selfiebeamName')} <span className="text-danger">{t('required')}</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setError(''); }}
                  placeholder={t('riddleEnterTitle')}
                  className="input w-full"
                  autoFocus
                />
              </div>

              {/* ===== Big screen (the beam) ===== */}
              <div className="space-y-4 p-4 bg-bg-secondary rounded-xl">
                <div className="flex items-start gap-2">
                  <Monitor className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-text-primary">{t('selfiebeamBeamSection')}</h3>
                    <p className="text-xs text-text-secondary">{t('selfiebeamBeamSectionDesc')}</p>
                  </div>
                </div>

                {codeId ? (
                  <SelfiebeamBeamSettings codeId={codeId} />
                ) : (
                  <p className="text-xs text-text-secondary">{t('selfiebeamPhotosNeedSave')}</p>
                )}

                <div className="h-px bg-border" />

                {/* Logos on the beam */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-accent" />
                    {t('selfiebeamLogosOnBeam')}
                  </label>
                  {logoPreviews.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {logoPreviews.map((preview, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-bg-card border border-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preview} alt="" className="w-full h-full object-contain p-1" />
                          <button
                            onClick={() => handleRemoveLogo(index)}
                            className="absolute top-1 end-1 p-1 rounded-full bg-danger text-white hover:bg-danger/80 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDraggingLogo(false); }}
                    onDrop={handleLogoDrop}
                    onClick={() => logoInputRef.current?.click()}
                    className={`w-full flex flex-col items-center justify-center gap-1.5 p-3 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                      isDraggingLogo ? 'border-accent bg-accent/10' : 'border-border hover:border-accent hover:text-accent text-text-secondary'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                    <span className="text-sm">{t('selfiebeamDragLogoHere')}</span>
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleAddLogos(e.target.files)} />
                </div>
              </div>

              {/* ===== Phone capture screen ===== */}
              <div className="space-y-4 p-4 bg-bg-secondary rounded-xl">
                <div className="flex items-start gap-2">
                  <Smartphone className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-text-primary">{t('selfiebeamPhoneSection')}</h3>
                    <p className="text-xs text-text-secondary">{t('selfiebeamPhoneSectionDesc')}</p>
                  </div>
                </div>

                {galleryEnabled ? (
                  <>
                    {/* Message to participant */}
                    <div className="space-y-2">
                      <label className="text-sm text-text-secondary">{t('selfiebeamPhoneMessage')}</label>
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={t('selfiebeamPhoneMessagePlaceholder')}
                        className="input w-full min-h-[64px] resize-y"
                        rows={2}
                      />
                    </div>

                    {/* Phone colors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm text-text-secondary">{t('riddleBackgroundColor')}</label>
                        <div className="flex items-center gap-2">
                          {backgroundColors.map((color) => (
                            <button
                              key={color}
                              onClick={() => { setBackgroundColor(color); setCustomBgColor(''); }}
                              className={`w-7 h-7 rounded-lg border-2 transition-all ${
                                backgroundColor === color && !customBgColor ? 'border-accent scale-110' : 'border-border hover:border-text-secondary'
                              }`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                          <label
                            className="relative w-7 h-7 rounded-lg border-2 border-border cursor-pointer flex items-center justify-center"
                            style={{ backgroundColor: customBgColor || '#e5e5e5' }}
                          >
                            <Pipette className="w-3.5 h-3.5 text-text-secondary" />
                            <input
                              type="color"
                              value={customBgColor || backgroundColor}
                              onChange={(e) => { setCustomBgColor(e.target.value); setBackgroundColor(e.target.value); }}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-text-secondary">{t('riddleTextColor')}</label>
                        <div className="flex items-center gap-2">
                          {textColors.map((color) => (
                            <button
                              key={color}
                              onClick={() => { setTextColor(color); setCustomTextColor(''); }}
                              className={`w-7 h-7 rounded-lg border-2 transition-all ${
                                textColor === color && !customTextColor ? 'border-accent scale-110' : 'border-border hover:border-text-secondary'
                              }`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                          <label
                            className="relative w-7 h-7 rounded-lg border-2 border-border cursor-pointer flex items-center justify-center"
                            style={{ backgroundColor: customTextColor || '#e5e5e5' }}
                          >
                            <Pipette className="w-3.5 h-3.5 text-text-secondary" />
                            <input
                              type="color"
                              value={customTextColor || textColor}
                              onChange={(e) => { setCustomTextColor(e.target.value); setTextColor(e.target.value); }}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-text-secondary">{t('selfiebeamPhoneDisabledHint')}</p>
                )}
              </div>
            </>
          )}

          {/* ===== SETTINGS TAB ===== */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="space-y-4 p-4 bg-bg-secondary rounded-xl">
                <div className="flex items-center gap-3">
                  <Camera className="w-5 h-5 text-accent" />
                  <h3 className="font-medium text-text-primary">{t('riddleSelfieGallery')}</h3>
                </div>

                <ToggleRow label={t('riddleAllowSelfie')} checked={galleryEnabled} onChange={setGalleryEnabled} />

                {galleryEnabled && (
                  <>
                    <div className="h-px bg-border" />
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowAnonymous}
                        onChange={(e) => setAllowAnonymous(e.target.checked)}
                        className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                      />
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-text-secondary" />
                        <span className="text-sm text-text-secondary">{t('riddleAllowAnonymous')}</span>
                      </div>
                    </label>

                    <div className="h-px bg-border" />
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <ToggleRow
                          label={t('selfiebeamAutoApprove')}
                          description={t('selfiebeamAutoApproveDesc')}
                          checked={autoApprove}
                          onChange={setAutoApprove}
                        />
                      </div>
                    </div>

                    {/* Public link upload cap — always governs the freely-shared /v/{shortId} link */}
                    <div className="h-px bg-border" />
                    <div className="flex items-start gap-3">
                      <ImagePlus className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <span className="text-sm font-medium text-text-primary">{t('selfiebeamMaxUploads')}</span>
                            <p className="text-xs text-text-secondary mt-1">{t('selfiebeamMaxUploadsDesc')}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {[1, 2, 3].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setMaxUploadsPerUser(n)}
                                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                                  maxUploadsPerUser === n ? 'bg-accent text-white' : 'bg-bg-card text-text-secondary hover:text-text-primary border border-border'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Photographer link — a SEPARATE unlimited link for staff. The public link
                        above stays capped; both feed the same beam. */}
                    <div className="h-px bg-border" />
                    <div className="flex items-start gap-3">
                      <Zap className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <ToggleRow
                          label={t('selfiebeamPhotographerMode')}
                          description={t('selfiebeamPhotographerModeDesc')}
                          checked={!!photographerToken}
                          onChange={togglePhotographerLink}
                        />
                        {photographerToken && shortId && (
                          <div className="flex items-center gap-2">
                            <input
                              readOnly
                              value={photographerLink}
                              onFocus={(e) => e.currentTarget.select()}
                              className="flex-1 min-w-0 px-3 py-2 text-xs bg-black/20 border border-border rounded-lg text-text-primary outline-none"
                              dir="ltr"
                            />
                            <button
                              type="button"
                              onClick={copyPhotographerLink}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 shrink-0"
                            >
                              {photographerLinkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              {photographerLinkCopied ? t('selfiebeamCopied') : t('selfiebeamCopyLink')}
                            </button>
                          </div>
                        )}
                        {photographerToken && !shortId && (
                          <p className="text-xs text-amber-400">{t('selfiebeamPhotographerSaveFirst')}</p>
                        )}

                        {/* Photographer-only: hide uploads on the public link */}
                        {photographerToken && (
                          <div className="pt-1">
                            <ToggleRow
                              label={t('selfiebeamPhotographerOnly')}
                              description={t('selfiebeamPhotographerOnlyDesc')}
                              checked={photographerOnly}
                              onChange={setPhotographerOnly}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {galleryEnabled && (
                <p className="text-xs text-text-secondary whitespace-pre-line px-1">{t('riddleSelfieDescription')}</p>
              )}
            </div>
          )}

          {/* ===== PHOTOS TAB ===== */}
          {activeTab === 'photos' && (
            codeId && ownerId ? (
              <SelfiebeamPhotoManager codeId={codeId} ownerId={ownerId} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-text-secondary">
                <Images className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm max-w-xs">{t('selfiebeamPhotosNeedSave')}</p>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="bg-bg-card border-t border-border px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover disabled:opacity-50"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !title.trim()}
            className={`btn text-white disabled:opacity-50 min-w-[110px] transition-colors ${
              justSaved ? 'bg-success hover:bg-success' : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />{tCommon('saving')}</span>
            ) : justSaved ? (
              <span className="flex items-center gap-2"><Check className="w-5 h-5" />{tCommon('saved')}</span>
            ) : (
              tCommon('save')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
