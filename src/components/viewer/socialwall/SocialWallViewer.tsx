'use client';

// Social Wall — the participant app on /v/{shortId}. A closed, Instagram-style network for one
// event: welcome → join (open / WhatsApp / HR list / both) → feed with group filter, likes,
// posting and "my photos". Live updates ride the RTDB rev pulse (src/lib/socialwall/store.ts).
// Root is `fixed inset-0` under the PWA banner (iOS Safari's toolbar covers the bottom of 100vh).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ref as rtdbRef, onValue } from 'firebase/database';
import { Heart, Home, Plus, User, X, Pencil, Trash2, Camera, Lock, ExternalLink, ArrowUp } from 'lucide-react';
import { realtimeDb } from '@/lib/firebase';
import { compressImage } from '@/lib/imageCompression';
import { isInAppBrowser, openCurrentUrlInBrowser } from '@/lib/inAppBrowser';
import {
  resolveSocialWallConfig,
  type SocialWallConfig,
  type SocialWallGroup,
  type SocialWallPostView,
} from '@/types/socialwall';
import { SwApiError, loadSession, newPostId, saveSession, swApi, uploadPost, type StoredSession } from './api';
import { errorText, socialWallStrings, type SocialWallStrings } from './i18n';
import { PostCard, UploadCard, type LocalUpload } from './PostCard';
import Composer, { type ComposerResult } from './Composer';
import JoinFlow, { ProfileForm } from './JoinFlow';
import { useFeed } from './useFeed';
import StaffView from './StaffView';
import { Avatar, PoweredBy, PostSkeleton, PrimaryButton, SW_STYLE, Spinner, SecondaryButton } from './ui';

type Phase = 'boot' | 'welcome' | 'join' | 'profile' | 'app' | 'blocked';
type Tab = 'feed' | 'me';

interface Props {
  codeId: string;
  shortId: string;
  title?: string;
  config?: SocialWallConfig;
}

// ------------------------------------------------------------------ module-scope screens

function Welcome({
  config, t, title, onStart,
}: {
  config: ReturnType<typeof resolveSocialWallConfig>; t: SocialWallStrings; title: string; onStart: () => void;
}) {
  const b = config.branding;
  return (
    <div className="min-h-full flex flex-col px-6 pt-[max(24px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))]">
      <div className="flex justify-center pt-4 sw-enter">
        {b.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.logoUrl} alt={title} className="h-12 max-w-[70%] object-contain" />
        ) : (
          <div className="text-2xl font-black tracking-tight text-gray-900">{title}</div>
        )}
      </div>
      <div className="text-center mt-7 sw-enter" style={{ animationDelay: '80ms' }}>
        <h1 className="text-[28px] leading-tight font-black text-gray-900 whitespace-pre-line">{b.welcomeTitle || title}</h1>
        {(b.welcomeSubtitle || !b.welcomeTitle) && (
          <p className="mt-2 text-[17px] text-gray-600">{b.welcomeSubtitle || t.privateEvent}</p>
        )}
      </div>
      <div className="relative mt-7 flex-1 min-h-[220px] max-h-[46dvh] rounded-[28px] overflow-hidden shadow-xl shadow-black/10 sw-scale-in" style={{ animationDelay: '160ms' }}>
        {b.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover sw-kenburns" />
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--sw-primary), var(--sw-secondary))' }}>
            <Camera className="absolute inset-0 m-auto w-20 h-20 text-white/80" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent" />
      </div>
      <div className="mt-7 space-y-3 sw-enter" style={{ animationDelay: '240ms' }}>
        <PrimaryButton onClick={onStart}>
          <Camera className="w-5 h-5" />
          {t.join}
        </PrimaryButton>
        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <Lock className="w-3.5 h-3.5" />
          {t.privateEvent}
        </div>
      </div>
      <div className="mt-5">
        <PoweredBy label={t.poweredBy} />
      </div>
    </div>
  );
}

function Lightbox({
  post, t, locale, group, onClose, onLike, onDelete,
}: {
  post: SocialWallPostView; t: SocialWallStrings; locale: 'he' | 'en'; group?: SocialWallGroup;
  onClose: () => void; onLike: (p: SocialWallPostView, on: boolean) => void; onDelete?: (p: SocialWallPostView) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col sw-fade" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-3 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        <button type="button" onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-full text-white active:bg-white/10" aria-label={t.close}>
          <X className="w-7 h-7" />
        </button>
        {post.mine && onDelete && (
          <button type="button" onClick={() => onDelete(post)} className="w-11 h-11 flex items-center justify-center rounded-full text-white active:bg-white/10" aria-label={t.deletePost}>
            <Trash2 className="w-6 h-6" />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center" onClick={onClose}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.fullUrl} alt={post.caption || post.authorName} className="max-w-full max-h-full object-contain sw-scale-in" onClick={(e) => e.stopPropagation()} />
      </div>
      <div className="px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] text-white">
        <div className="flex items-center gap-3">
          <Avatar name={post.authorName} color={group?.color} size={36} />
          <div className="min-w-0 flex-1">
            <div className="font-bold truncate">{post.authorName}</div>
            {group && <div className="text-xs text-white/60">{group.label}</div>}
          </div>
          {post.status !== 'pending' && (
            <button type="button" onClick={() => onLike(post, !post.likedByMe)} className="flex items-center gap-1.5 min-h-[44px] px-2" aria-pressed={!!post.likedByMe} aria-label={t.like}>
              <Heart className={`w-7 h-7 ${post.likedByMe ? 'text-[#ef4444] fill-[#ef4444]' : 'text-white'}`} />
              <span className="font-bold tabular-nums">{post.likeCount.toLocaleString(locale)}</span>
            </button>
          )}
        </div>
        {post.caption && <p className="mt-2 text-[15px] text-white/90 whitespace-pre-line break-words">{post.caption}</p>}
      </div>
    </div>
  );
}

function ConfirmDialog({ text, confirm, cancel, onConfirm, onCancel }: { text: string; confirm: string; cancel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" role="alertdialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 sw-fade" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl sw-scale-in">
        <p className="text-[17px] font-semibold text-gray-900 text-center">{text}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <SecondaryButton onClick={onCancel}>{cancel}</SecondaryButton>
          <button type="button" onClick={onConfirm} className="min-h-[48px] rounded-2xl bg-red-600 text-white font-bold active:scale-[.98] transition-transform">
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center text-center px-10 py-20 sw-enter">
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg mb-5" style={{ background: 'linear-gradient(135deg, var(--sw-primary), var(--sw-secondary))' }}>
        <Camera className="w-10 h-10" />
      </div>
      <h3 className="text-xl font-bold text-gray-900">{title}</h3>
      <p className="mt-1.5 text-gray-500">{text}</p>
    </div>
  );
}

// ------------------------------------------------------------------ the app

/** #mod=<token> on the URL = the on-site staff moderation link (fragment: never sent to the server). */
function staffTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.hash.match(/(?:^#|&)mod=([a-f0-9]{32})\b/);
  return m ? m[1] : null;
}

export default function SocialWallViewer(props: Props) {
  const [staffToken] = useState(staffTokenFromHash);
  if (staffToken) {
    const config = resolveSocialWallConfig(props.config);
    return <StaffView codeId={props.codeId} token={staffToken} groups={config.groups} eventTitle={config.eventTitle || props.title || ''} />;
  }
  return <ParticipantApp {...props} />;
}

function ParticipantApp({ codeId, title, config: rawConfig }: Props) {
  const config = useMemo(() => resolveSocialWallConfig(rawConfig), [rawConfig]);
  const locale = config.locale;
  const t = socialWallStrings[locale];
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const eventTitle = config.eventTitle || title || 'Social Wall';
  const groupsById = useMemo(() => new Map(config.groups.map((g) => [g.id, g])), [config.groups]);

  const [phase, setPhase] = useState<Phase>('boot');
  const [session, setSession] = useState<StoredSession | null>(null);
  const [tab, setTab] = useState<Tab>('feed');
  const [group, setGroup] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [uploadsOpen, setUploadsOpen] = useState(true);
  const [postsLeft, setPostsLeft] = useState<number | null>(null);
  const [composer, setComposer] = useState<{ file: File | null } | null>(null);
  const [uploads, setUploads] = useState<LocalUpload[]>([]);
  const [lightbox, setLightbox] = useState<SocialWallPostView | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SocialWallPostView | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [inApp, setInApp] = useState(false);
  const [inAppDismissed, setInAppDismissed] = useState(false);
  const [mine, setMine] = useState<SocialWallPostView[] | null>(null);
  const filesRef = useRef(new Map<string, File>());
  const pickerRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3200);
  }, []);

  // ---- boot: restore and check the stored session
  useEffect(() => {
    setInApp(isInAppBrowser());
    const stored = loadSession(codeId);
    if (!stored) {
      setPhase('welcome');
      return;
    }
    setSession(stored);
    swApi
      .me(codeId, stored.session)
      .then((me) => {
        const next = { ...stored, name: me.name, groupId: me.groupId };
        setSession(next);
        saveSession(codeId, next);
        setPostsLeft(me.postsLeft);
        setUploadsOpen(me.control.uploads);
        setPhase(me.needsProfile ? 'profile' : 'app');
      })
      .catch((e) => {
        if (e instanceof SwApiError && e.status === 403) setPhase('blocked');
        else if (e instanceof SwApiError && e.status === 401) {
          saveSession(codeId, null);
          setSession(null);
          setPhase('welcome');
        } else setPhase('app'); // offline / server hiccup: keep the member in, the feed retries
      });
  }, [codeId]);

  // ---- live pulse + control (RTDB: a counter and two switches, no content)
  useEffect(() => {
    if (phase !== 'app') return;
    const unsub = onValue(rtdbRef(realtimeDb, `socialwall/${codeId}`), (snap) => {
      const v = snap.val() || {};
      setRev(typeof v.rev === 'number' ? v.rev : 0);
      setUploadsOpen(v.control?.uploads !== false);
    });
    return () => unsub();
  }, [codeId, phase]);

  const onAuthError = useCallback(
    (e: SwApiError) => {
      if (e.status === 403 && e.code === 'BLOCKED') {
        setPhase('blocked');
        return;
      }
      if (e.status === 401) {
        saveSession(codeId, null);
        setSession(null);
        setPhase('welcome');
      }
    },
    [codeId]
  );

  const feed = useFeed({ codeId, session: phase === 'app' ? session?.session ?? null : null, group, rev, onAuthError });
  const { loadMore, addPost } = feed;

  // "New photos" pill: someone else posted while this member is scrolled down the feed
  const [newPill, setNewPill] = useState(false);
  const topIdRef = useRef<string | null>(null);
  const topId = feed.posts[0]?.id ?? null;
  useEffect(() => {
    const prev = topIdRef.current;
    topIdRef.current = topId;
    if (!prev || !topId || prev === topId || feed.posts[0]?.mine) return;
    if ((scrollRef.current?.scrollTop || 0) > 300) setNewPill(true);
  }, [topId, feed.posts]);
  const onFeedScroll = useCallback(() => {
    if (newPill && (scrollRef.current?.scrollTop || 0) < 120) setNewPill(false);
  }, [newPill]);

  // ---- infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || tab !== 'feed') return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { root: scrollRef.current, rootMargin: '900px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, tab]);

  // ---- Android back button closes overlays instead of leaving the app
  const overlayOpen = !!lightbox || !!composer || !!confirmDelete || editingProfile;
  useEffect(() => {
    if (!overlayOpen) return;
    history.pushState({ sw: true }, '');
    const onPop = () => {
      setLightbox(null);
      setComposer(null);
      setConfirmDelete(null);
      setEditingProfile(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [overlayOpen]);
  const closeOverlay = useCallback(() => {
    if (history.state?.sw) history.back();
    else {
      setLightbox(null);
      setComposer(null);
      setConfirmDelete(null);
      setEditingProfile(false);
    }
  }, []);

  // ---- my posts (Me tab)
  const loadMine = useCallback(async () => {
    if (!session) return;
    try {
      const res = await swApi.mine(codeId, session.session);
      setMine(res.posts);
    } catch (e) {
      if (e instanceof SwApiError) onAuthError(e);
    }
  }, [codeId, session, onAuthError]);
  useEffect(() => {
    if (tab === 'me' && phase === 'app') void loadMine();
  }, [tab, phase, loadMine, rev]);

  // ---- joining
  const onJoined = (res: { session: string; memberId: string; name: string; groupId: string | null; needsProfile: boolean }) => {
    const s = { session: res.session, memberId: res.memberId, name: res.name, groupId: res.groupId };
    saveSession(codeId, s);
    setSession(s);
    setPhase(res.needsProfile ? 'profile' : 'app');
    if (!res.needsProfile) {
      swApi.me(codeId, res.session).then((me) => setPostsLeft(me.postsLeft)).catch(() => {});
    }
  };

  const saveProfile = async (name: string, groupId: string | null) => {
    if (!session) return;
    const res = await swApi.updateProfile(codeId, session.session, { name, groupId });
    const next = { ...session, name: res.name, groupId: res.groupId };
    saveSession(codeId, next);
    setSession(next);
    if (phase === 'profile') setPhase('app');
    else closeOverlay();
  };

  // ---- posting
  const startUpload = useCallback(
    async (upload: LocalUpload) => {
      if (!session) return;
      const file = filesRef.current.get(upload.id);
      if (!file) return;
      const patch = (p: Partial<LocalUpload>) => setUploads((list) => list.map((u) => (u.id === upload.id ? { ...u, ...p } : u)));
      patch({ state: 'uploading', progress: 0.03, error: undefined });
      try {
        let body: Blob = file;
        try {
          const c = await compressImage(file, { maxWidth: 2048, maxHeight: 2048, maxSizeKB: 1400, quality: 0.86 });
          if (c.blob.size > 0) body = c.blob;
        } catch {
          /* undecodable here (e.g. HEIC on desktop): send the original, the server re-encodes */
        }
        const res = await uploadPost({
          codeId,
          session: session.session,
          postId: upload.id,
          caption: upload.caption,
          file: body,
          onProgress: (f) => patch({ progress: 0.05 + f * 0.95 }),
        });
        addPost(res.post);
        setPostsLeft(res.postsLeft);
        setUploads((list) => list.filter((u) => u.id !== upload.id));
        filesRef.current.delete(upload.id);
        // Keep the local preview a moment so the card swap does not flash
        setTimeout(() => URL.revokeObjectURL(upload.previewUrl), 4000);
      } catch (e) {
        const code = e instanceof SwApiError ? e.code : undefined;
        if (e instanceof SwApiError && (e.status === 401 || e.code === 'BLOCKED')) onAuthError(e);
        patch({ state: 'failed', error: errorText(t, code) });
      }
    },
    [codeId, session, addPost, onAuthError, t]
  );

  const onCompose = (r: ComposerResult) => {
    const upload: LocalUpload = {
      id: newPostId(),
      previewUrl: r.previewUrl,
      caption: r.caption,
      width: r.width,
      height: r.height,
      progress: 0,
      state: 'uploading',
      createdAt: Date.now(),
    };
    filesRef.current.set(upload.id, r.file);
    setUploads((list) => [upload, ...list]);
    closeOverlay();
    setTab('feed');
    setGroup(null);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    void startUpload(upload);
  };

  const discardUpload = (u: LocalUpload) => {
    setUploads((list) => list.filter((x) => x.id !== u.id));
    filesRef.current.delete(u.id);
    URL.revokeObjectURL(u.previewUrl);
  };

  const blockedReason = !uploadsOpen ? t.uploadsClosed : postsLeft === 0 ? t.postLimit : null;

  const openComposer = () => {
    if (blockedReason) {
      setComposer({ file: null });
      return;
    }
    pickerRef.current?.click(); // inside the tap: the only way iOS opens the picker
  };

  const onPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setComposer({ file });
  };

  // ---- deleting my post
  const doDelete = async () => {
    const post = confirmDelete;
    if (!post || !session) return;
    closeOverlay();
    setLightbox(null);
    feed.removePost(post.id);
    setMine((m) => m?.filter((p) => p.id !== post.id) ?? m);
    try {
      await swApi.deletePost(codeId, session.session, post.id);
    } catch (e) {
      showToast(errorText(t, e instanceof SwApiError ? e.code : undefined));
      void feed.reload();
    }
  };

  const { toggleLike } = feed;
  const onLike = useCallback(
    (post: SocialWallPostView, on: boolean) => {
      void toggleLike(post, on);
      setLightbox((cur) => (cur && cur.id === post.id ? { ...cur, likedByMe: on, likeCount: Math.max(0, cur.likeCount + (on === !!cur.likedByMe ? 0 : on ? 1 : -1)) } : cur));
      setMine((list) => list?.map((p) => (p.id === post.id ? { ...p, likedByMe: on, likeCount: Math.max(0, p.likeCount + (on === !!p.likedByMe ? 0 : on ? 1 : -1)) } : p)) ?? list);
    },
    [toggleLike]
  );
  const onOpen = useCallback((post: SocialWallPostView) => setLightbox(post), []);
  const onAskDelete = useCallback((post: SocialWallPostView) => setConfirmDelete(post), []);

  const themeStyle = {
    '--sw-primary': config.branding.primaryColor || '#6d28d9',
    '--sw-secondary': config.branding.secondaryColor || config.branding.primaryColor || '#2563eb',
    top: 'var(--pwa-banner-h, 0px)',
  } as React.CSSProperties;

  // ------------------------------------------------------------------ render

  const shell = (children: React.ReactNode) => (
    <div className="sw-root fixed inset-x-0 bottom-0 bg-white text-gray-900 overflow-hidden" style={themeStyle} dir={dir} lang={locale}>
      <style>{SW_STYLE}</style>
      {children}
    </div>
  );

  if (phase === 'boot') {
    return shell(
      <div className="h-full flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (phase === 'blocked') {
    return shell(
      <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-4">
        <Lock className="w-12 h-12 text-gray-400" />
        <p className="text-lg font-semibold text-gray-800">{t.blocked}</p>
      </div>
    );
  }

  if (phase === 'welcome') {
    return shell(
      <div className="h-full overflow-y-auto sw-scroll">
        <Welcome config={config} t={t} title={eventTitle} onStart={() => setPhase('join')} />
      </div>
    );
  }

  if (phase === 'join' || phase === 'profile') {
    return shell(
      <div className="h-full overflow-y-auto sw-scroll">
        <div className="min-h-full flex flex-col px-6 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
          <div className="flex justify-center pt-2 sw-enter">
            {config.branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.branding.logoUrl} alt={eventTitle} className="h-10 max-w-[60%] object-contain" />
            ) : (
              <div className="text-xl font-black">{eventTitle}</div>
            )}
          </div>
          <div className="mt-8 mb-7 sw-enter" style={{ animationDelay: '60ms' }}>
            <h1 className="text-[26px] font-black text-gray-900">{t.joinTitle}</h1>
            <p className="mt-1 text-gray-500">{t.joinSubtitle}</p>
          </div>
          {phase === 'join' ? (
            <JoinFlow codeId={codeId} config={config} t={t} dir={dir} onJoined={onJoined} />
          ) : (
            <ProfileForm config={config} t={t} initialName={session?.name || ''} initialGroup={session?.groupId || null} onSave={saveProfile} saveLabel={t.continue} />
          )}
          <div className="mt-auto pt-10">
            <PoweredBy label={t.poweredBy} />
          </div>
        </div>
      </div>
    );
  }

  // ---- the app
  const myName = session?.name || '';
  const myGroup = session?.groupId ? groupsById.get(session.groupId) : undefined;

  return shell(
    <div className="h-full flex flex-col">
      <input ref={pickerRef} type="file" accept="image/*" className="hidden" onChange={onPickerChange} />

      {/* Top bar */}
      <header className="shrink-0 bg-white/95 backdrop-blur border-b border-gray-100 pt-[env(safe-area-inset-top)] z-20">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="w-10" />
          {config.branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.branding.logoUrl} alt={eventTitle} className="h-8 max-w-[55%] object-contain" />
          ) : (
            <div className="text-lg font-black truncate max-w-[60%]">{eventTitle}</div>
          )}
          <button type="button" onClick={() => setTab('me')} aria-label={t.me} className="w-10 h-10 flex items-center justify-center">
            <Avatar name={myName || '?'} color={myGroup?.color} size={32} />
          </button>
        </div>
        {tab === 'feed' && config.groups.length > 0 && (
          <div className="sw-chips flex gap-2 overflow-x-auto px-4 pb-3">
            {[{ id: null as string | null, label: t.all }, ...config.groups.map((g) => ({ id: g.id as string | null, label: g.label }))].map((g) => {
              const active = group === g.id;
              return (
                <button
                  key={g.id ?? '__all'}
                  type="button"
                  onClick={() => {
                    setGroup(g.id);
                    scrollRef.current?.scrollTo({ top: 0 });
                  }}
                  className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold transition-all active:scale-95 ${active ? 'text-white shadow' : 'bg-gray-100 text-gray-700'}`}
                  style={active ? { background: 'linear-gradient(135deg, var(--sw-primary), var(--sw-secondary))' } : undefined}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {inApp && !inAppDismissed && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-100 px-4 py-3 flex items-start gap-3 sw-fade">
          <ExternalLink className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-amber-900">{t.inAppTitle}</div>
            <div className="text-xs text-amber-800 mt-0.5">{t.inAppText}</div>
            <div className="flex gap-3 mt-2">
              <button type="button" onClick={openCurrentUrlInBrowser} className="text-xs font-bold text-amber-900 underline min-h-[32px]">{t.openInBrowser}</button>
              <button type="button" onClick={() => setInAppDismissed(true)} className="text-xs text-amber-800 min-h-[32px]">{t.dismiss}</button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main ref={scrollRef} onScroll={onFeedScroll} className="relative flex-1 min-h-0 overflow-y-auto sw-scroll bg-gray-50">
        {newPill && tab === 'feed' && (
          <div className="sticky top-3 z-10 h-0 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setNewPill(false);
                scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-1.5 h-10 px-4 rounded-full text-white text-sm font-bold shadow-xl sw-scale-in"
              style={{ background: 'linear-gradient(135deg, var(--sw-primary), var(--sw-secondary))' }}
            >
              <ArrowUp className="w-4 h-4" />
              {t.newPosts}
            </button>
          </div>
        )}
        {tab === 'feed' ? (
          <div className="max-w-[560px] mx-auto">
            {uploads.map((u) => (
              <div key={u.id} className="mb-2">
                <UploadCard upload={u} name={myName} color={myGroup?.color} t={t} onRetry={() => void startUpload(u)} onDiscard={() => discardUpload(u)} />
              </div>
            ))}
            {feed.loading && !feed.posts.length ? (
              <div className="space-y-2">
                <PostSkeleton />
                <PostSkeleton />
              </div>
            ) : feed.posts.length === 0 && !uploads.length ? (
              <EmptyState title={t.emptyFeedTitle} text={t.emptyFeedText} />
            ) : (
              <div className="space-y-2">
                {feed.posts.map((p, i) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    index={i}
                    group={p.groupId ? groupsById.get(p.groupId) : undefined}
                    t={t}
                    locale={locale}
                    onLike={onLike}
                    onOpen={onOpen}
                    onDelete={onAskDelete}
                  />
                ))}
              </div>
            )}
            <div ref={sentinelRef} className="h-24 flex items-center justify-center">
              {feed.loadingMore && <Spinner className="w-6 h-6" />}
            </div>
          </div>
        ) : (
          <div className="max-w-[560px] mx-auto bg-white min-h-full">
            <div className="px-5 pt-6 pb-5 flex items-center gap-4 sw-enter">
              <Avatar name={myName || '?'} color={myGroup?.color} size={76} />
              <div className="min-w-0 flex-1">
                <div className="text-xl font-black truncate">{myName}</div>
                {myGroup && <div className="text-gray-500 truncate">{myGroup.label}</div>}
                <button type="button" onClick={() => setEditingProfile(true)} className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-gray-100 text-sm font-semibold text-gray-800 active:bg-gray-200">
                  <Pencil className="w-3.5 h-3.5" />
                  {t.editProfile}
                </button>
              </div>
            </div>
            <div className="mx-5 mb-5 grid grid-cols-2 rounded-2xl bg-gray-50 border border-gray-100 text-center sw-enter" style={{ animationDelay: '60ms' }}>
              <div className="py-3">
                <div className="text-2xl font-black tabular-nums">{mine?.length ?? '–'}</div>
                <div className="text-xs text-gray-500">{t.photos}</div>
              </div>
              <div className="py-3 border-s border-gray-100">
                <div className="text-2xl font-black tabular-nums">{mine ? mine.reduce((s, p) => s + p.likeCount, 0) : '–'}</div>
                <div className="text-xs text-gray-500">{t.likes}</div>
              </div>
            </div>
            {postsLeft !== null && postsLeft <= 10 && (
              <p className="px-5 -mt-2 mb-4 text-sm text-gray-500">{t.postsLeft}: {postsLeft}</p>
            )}
            {mine === null ? (
              <div className="py-16 flex justify-center"><Spinner className="w-7 h-7" /></div>
            ) : mine.length === 0 ? (
              <EmptyState title={t.emptyMineTitle} text={t.emptyMineText} />
            ) : (
              <div className="grid grid-cols-3 gap-0.5 pb-6">
                {mine.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => setLightbox(p)} className="relative aspect-square bg-gray-100 overflow-hidden sw-fade" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.cardUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    {p.status === 'pending' && <div className="absolute inset-0 bg-white/50" />}
                    <span className="absolute bottom-1.5 start-1.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-white text-xs font-bold">
                      <Heart className="w-3 h-3 fill-white" />
                      {p.likeCount}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="shrink-0 bg-white/95 backdrop-blur border-t border-gray-100 pb-[env(safe-area-inset-bottom)] z-20">
        <div className="h-16 max-w-[560px] mx-auto grid grid-cols-3 items-center">
          <button
            type="button"
            onClick={() => {
              if (tab === 'feed') scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              setTab('feed');
            }}
            className={`flex flex-col items-center gap-0.5 min-h-[48px] justify-center ${tab === 'feed' ? 'text-[var(--sw-primary)]' : 'text-gray-500'}`}
          >
            <Home className="w-6 h-6" strokeWidth={tab === 'feed' ? 2.6 : 2} />
            <span className="text-[11px] font-semibold">{t.feed}</span>
          </button>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={openComposer}
              aria-label={t.upload}
              className="w-14 h-14 -mt-5 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-black/20 active:scale-90 transition-transform"
              style={{ background: 'linear-gradient(135deg, var(--sw-primary), var(--sw-secondary))' }}
            >
              <Plus className="w-8 h-8" strokeWidth={2.6} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setTab('me')}
            className={`flex flex-col items-center gap-0.5 min-h-[48px] justify-center ${tab === 'me' ? 'text-[var(--sw-primary)]' : 'text-gray-500'}`}
          >
            <User className="w-6 h-6" strokeWidth={tab === 'me' ? 2.6 : 2} />
            <span className="text-[11px] font-semibold">{t.me}</span>
          </button>
        </div>
      </nav>

      {composer && (
        <Composer t={t} captionMax={config.captionMax} onClose={closeOverlay} onSubmit={onCompose} blockedReason={blockedReason} initialFile={composer.file} />
      )}
      {lightbox && (
        <Lightbox
          post={lightbox}
          t={t}
          locale={locale}
          group={lightbox.groupId ? groupsById.get(lightbox.groupId) : undefined}
          onClose={closeOverlay}
          onLike={onLike}
          onDelete={onAskDelete}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog text={t.deleteConfirm} confirm={t.delete} cancel={t.cancel} onConfirm={doDelete} onCancel={closeOverlay} />
      )}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 sw-fade" onClick={closeOverlay} />
          <div className="relative bg-white rounded-t-[28px] p-5 pb-[max(20px,env(safe-area-inset-bottom))] sw-sheet">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{t.editProfile}</h2>
              <button type="button" onClick={closeOverlay} className="w-11 h-11 -me-2 flex items-center justify-center rounded-full active:bg-gray-100" aria-label={t.close}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <ProfileForm config={config} t={t} initialName={myName} initialGroup={session?.groupId || null} onSave={saveProfile} saveLabel={t.save} />
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-[70] flex justify-center px-6 pointer-events-none">
          <div className="rounded-full bg-gray-900 text-white text-sm font-semibold px-5 py-3 shadow-xl sw-scale-in">{toast}</div>
        </div>
      )}
    </div>
  );
}
