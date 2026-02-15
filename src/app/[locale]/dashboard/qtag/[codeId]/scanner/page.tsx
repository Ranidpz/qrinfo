'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Virtuoso } from 'react-virtuoso';
import { useQTagGuests } from '@/hooks/useQTagGuests';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  X,
  CheckCircle2,
  AlertCircle,
  Users,
  Clock,
  Loader2,
  Search,
  Check,
  Trash2,
  ChevronDown,
  Download,
  UserPlus,
  Plus,
  Minus,
  Lock,
  QrCode,
  SwitchCamera,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import { formatPhoneForDisplay } from '@/lib/phone-utils';
import type { QTagGuest } from '@/types/qtag';

interface ScanResult {
  guest: {
    id: string;
    name: string;
    phone: string;
    plusOneCount: number;
    plusOneDetails: { name?: string; gender?: string }[];
    status: string;
    isVerified: boolean;
    registeredAt: string;
    arrivedAt?: string;
  };
  alreadyArrived: boolean;
  checkedInAt?: string;
}

type ScannerState = 'scanning' | 'loading' | 'result' | 'error';
type ViewMode = 'scanner' | 'list';
type FilterTab = 'all' | 'registered' | 'arrived' | 'cancelled';

// Memoized guest row for scanner — prevents re-rendering all visible rows on single change
const ScannerGuestRow = memo(function ScannerGuestRow({
  guest,
  isExpanded,
  onToggle,
  onCheckIn,
  onDelete,
  deleting,
  t,
}: {
  guest: QTagGuest;
  isExpanded: boolean;
  onToggle: () => void;
  onCheckIn: () => void;
  onDelete: () => void;
  deleting: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 transition-colors overflow-hidden mb-1.5">
      <div className="flex items-center gap-3 px-3 sm:px-4 py-3 w-full">
        {/* Tappable area: name + expand toggle */}
        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(e) => { if (e.key === 'Enter') onToggle(); }}
          className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer"
        >
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            guest.status === 'arrived' ? 'bg-green-400' :
            guest.status === 'cancelled' ? 'bg-red-400' : 'bg-gray-500'
          }`} />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="font-semibold text-white text-sm font-assistant truncate">
              {guest.name}
            </span>
            {guest.plusOneCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 flex-shrink-0">
                +{guest.plusOneCount}
              </span>
            )}
            {guest.isVerified && (
              <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-white/30 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
        {/* Check-in button: separate touch target, not nested */}
        <button
          type="button"
          onClick={onCheckIn}
          className={`min-h-[44px] min-w-[60px] px-3 py-2 rounded-lg text-xs font-medium transition-all font-assistant flex-shrink-0 ${
            guest.status === 'arrived'
              ? 'bg-green-500/20 text-green-400 active:bg-green-500/40'
              : 'bg-white/5 text-white/50 active:bg-white/15 active:text-white'
          }`}
        >
          {guest.status === 'arrived' ? t('qtagArrivedStatus') : t('qtagCheckIn')}
        </button>
      </div>
      {isExpanded && (
        <div className="px-3 sm:px-4 pb-3 pt-0 border-t border-white/5 space-y-2.5">
          <div className="flex items-center gap-3 text-xs text-white/50 pt-2.5 flex-wrap">
            {guest.phone && <span dir="ltr">{guest.phone}</span>}
            {guest.phone && <span className="text-white/20">|</span>}
            {guest.status === 'arrived' && guest.arrivedAt ? (
              <span className="text-green-400/70">
                {t('qtagArrivedStatus')} {new Date(guest.arrivedAt).toLocaleString('he-IL', {
                  hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
                })}
              </span>
            ) : (
              <span>
                {new Date(guest.registeredAt).toLocaleString('he-IL', {
                  hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
                })}
              </span>
            )}
          </div>
          {guest.plusOneCount > 0 && guest.plusOneDetails && guest.plusOneDetails.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Users className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {guest.plusOneDetails
                  .filter(p => p.name)
                  .map(p => p.name)
                  .join(', ') || `+${guest.plusOneCount}`}
              </span>
            </div>
          )}
          <div className="flex items-center pt-1">
            <button
              onClick={onDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400/70 bg-red-500/10 hover:bg-red-500/15 transition-all disabled:opacity-50 font-assistant ms-auto"
            >
              {deleting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />}
              {t('qtagDeleteConfirmYes')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default function QTagScannerPage() {
  const params = useParams();
  const codeId = params.codeId as string;
  const t = useTranslations('modals');

  // PIN gate state
  const [pinRequired, setPinRequired] = useState<boolean | null>(null); // null = loading
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const expectedPinRef = useRef<string>('');

  // Scanner state
  const [scannerState, setScannerState] = useState<ScannerState>('scanning');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [viewMode, _setViewMode] = useState<ViewMode>('scanner');
  const setViewMode = useCallback((mode: ViewMode) => {
    _setViewMode(mode);
    window.scrollTo({ top: 0 });
  }, []);

  // Scanner ref
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const processingRef = useRef(false);

  // Guest list state (real-time via shared hook)
  const { guests, stats, loading: loadingGuests } = useQTagGuests(codeId);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  // Delete state
  const [deletingGuestId, setDeletingGuestId] = useState<string | null>(null);
  const [confirmDeleteGuest, setConfirmDeleteGuest] = useState<{ id: string; name: string } | null>(null);
  const [expandedGuestId, setExpandedGuestId] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Registration QR modal state
  const [showRegQR, setShowRegQR] = useState(false);
  const [shortId, setShortId] = useState<string | null>(null);

  // Quick-add state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPlusOne, setQuickAddPlusOne] = useState(0);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  // Undo check-in state
  const [undoingCheckin, setUndoingCheckin] = useState(false);
  const autoResetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Responsive layout detection - lg+ shows split view
  const [isWideScreen, setIsWideScreen] = useState(false);

  // Resizable split panel (desktop only)
  const SCANNER_MIN_WIDTH = 300;
  const SCANNER_MAX_RATIO = 0.6;
  const SCANNER_DEFAULT_WIDTH = 420;
  const SCANNER_WIDTH_KEY = 'qtag-scanner-panel-width';
  const [scannerWidth, setScannerWidth] = useState(SCANNER_DEFAULT_WIDTH);
  const isDraggingDivider = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const [scannerRestartKey, setScannerRestartKey] = useState(0);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsWideScreen(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsWideScreen(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Load saved scanner panel width from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SCANNER_WIDTH_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= SCANNER_MIN_WIDTH) {
          setScannerWidth(parsed);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Clamp scanner width on window resize
  useEffect(() => {
    const handleResize = () => {
      const maxWidth = window.innerWidth * SCANNER_MAX_RATIO;
      setScannerWidth(prev => Math.min(prev, maxWidth));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drag divider handlers (desktop only)
  const handleDividerPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingDivider.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = scannerWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [scannerWidth]);

  const handleDividerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingDivider.current) return;
    const isRTL = document.documentElement.dir === 'rtl';
    const deltaX = e.clientX - dragStartX.current;
    const adjustedDelta = isRTL ? -deltaX : deltaX;
    const maxWidth = window.innerWidth * SCANNER_MAX_RATIO;
    const newWidth = Math.min(
      Math.max(dragStartWidth.current + adjustedDelta, SCANNER_MIN_WIDTH),
      maxWidth
    );
    setScannerWidth(newWidth);
  }, []);

  const handleDividerPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingDivider.current) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    isDraggingDivider.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    try {
      localStorage.setItem(SCANNER_WIDTH_KEY, String(scannerWidth));
    } catch { /* ignore */ }
    // Restart scanner so qrbox overlay recalculates for new panel size
    setScannerRestartKey(k => k + 1);
  }, [scannerWidth]);

  const handleDividerDoubleClick = useCallback(() => {
    setScannerWidth(SCANNER_DEFAULT_WIDTH);
    try {
      localStorage.setItem(SCANNER_WIDTH_KEY, String(SCANNER_DEFAULT_WIDTH));
    } catch { /* ignore */ }
    setScannerRestartKey(k => k + 1);
  }, []);

  // Fetch scanner PIN from code document
  useEffect(() => {
    if (!db || !codeId) return;

    const fetchPin = async () => {
      try {
        const codeDoc = await getDoc(doc(db, 'codes', codeId));
        if (codeDoc.exists()) {
          const data = codeDoc.data();
          // Extract shortId for registration QR
          if (data.shortId) setShortId(data.shortId);
          // scannerPin is inside the media item's qtagConfig
          const media = data.media || [];
          const qtagMedia = media.find((m: { qtagConfig?: unknown }) => m.qtagConfig);
          const pin = qtagMedia?.qtagConfig?.scannerPin;
          if (pin && pin.trim()) {
            expectedPinRef.current = pin.trim();
            setPinRequired(true);
          } else {
            setPinRequired(false);
            setPinUnlocked(true);
          }
        } else {
          setPinRequired(false);
          setPinUnlocked(true);
        }
      } catch (err) {
        console.error('[QTag] Failed to fetch scanner PIN:', err);
        // On error, allow access (don't block scanner)
        setPinRequired(false);
        setPinUnlocked(true);
      }
    };

    fetchPin();
  }, [codeId]);

  // Handle PIN submission
  const handlePinSubmit = () => {
    if (pinValue.trim() === expectedPinRef.current) {
      setPinUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPinValue('');
    }
  };

  // Debounced search for performance with large guest lists
  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  // Initialize scanner (only after PIN is unlocked)
  // On desktop (lg+), always init scanner. On mobile, only when in scanner view.
  useEffect(() => {
    if ((!isWideScreen && viewMode !== 'scanner') || !pinUnlocked) return;

    let html5Qrcode: Html5Qrcode | null = null;

    const initScanner = async () => {
      try {
        html5Qrcode = new Html5Qrcode('qtag-scanner');
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode },
          {
            fps: 10,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const size = Math.min(
                Math.max(Math.min(viewfinderWidth, viewfinderHeight) * 0.7, 200),
                350
              );
              return { width: size, height: size };
            },
            aspectRatio: 1,
          },
          handleScanSuccess,
          () => {} // Ignore scan failures
        );

        setScannerReady(true);
      } catch (err) {
        console.error('Failed to start scanner:', err);
        setScanError(t('qtagCameraError'));
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initScanner, 300);

    return () => {
      clearTimeout(timer);
      if (html5Qrcode?.isScanning) {
        html5Qrcode.stop().catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, pinUnlocked, isWideScreen, scannerRestartKey, facingMode]);

  // Handle successful QR scan
  const handleScanSuccess = async (decodedText: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    setScannerState('loading');

    try {
      // Parse QR data - supports both URL format (new) and JSON format (legacy)
      let qrToken: string | undefined;
      try {
        const parsed = JSON.parse(decodedText);
        if (parsed.t === 'qtag' && parsed.tk) {
          qrToken = parsed.tk;
        }
      } catch {
        // Not JSON - try URL format (supports ?token= and #token)
        try {
          const url = new URL(decodedText);
          qrToken = url.searchParams.get('token') || undefined;
          // Hash fragment format: /v/{shortId}#{token} (privacy-safe, hash not sent to server)
          if (!qrToken && url.hash) {
            const hashValue = url.hash.slice(1);
            if (/^[A-Fa-f0-9]{32}$/.test(hashValue)) {
              qrToken = hashValue;
            }
          }
        } catch {
          // Neither JSON nor URL
        }
      }
      if (!qrToken) {
        setScannerState('error');
        setScanError(t('qtagInvalidQR'));
        autoResetScanner(3000);
        return;
      }

      const res = await fetch('/api/qtag/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken, action: 'checkin' }),
      });

      const data = await res.json();

      if (!res.ok) {
        setScannerState('error');
        setScanError(data.errorCode === 'NOT_FOUND' ? t('qtagGuestNotFound') : data.error);
        autoResetScanner(3000);
        return;
      }

      setScanResult(data);
      setScannerState('result');
      autoResetScanner(4000);
    } catch {
      setScannerState('error');
      setScanError(t('qtagConnectionError'));
      autoResetScanner(3000);
    }
  };

  // Auto-reset scanner after showing result
  const autoResetScanner = (delayMs: number) => {
    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
    }
    autoResetTimerRef.current = setTimeout(() => {
      dismissOverlay();
    }, delayMs);
  };

  // Dismiss result/error overlay (tap or auto)
  const dismissOverlay = () => {
    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
      autoResetTimerRef.current = null;
    }
    setScannerState('scanning');
    setScanResult(null);
    setScanError(null);
    processingRef.current = false;
    setUndoingCheckin(false);
  };

  // Undo check-in from scanner overlay
  const handleUndoCheckin = async () => {
    if (!scanResult || undoingCheckin) return;

    // Cancel auto-reset while processing
    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
      autoResetTimerRef.current = null;
    }

    setUndoingCheckin(true);
    try {
      const res = await fetchWithAuth('/api/qtag/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          guestId: scanResult.guest.id,
          status: 'registered',
        }),
      });

      if (res.ok) {
        // Reset scanner immediately
        setScannerState('scanning');
        setScanResult(null);
        setScanError(null);
        processingRef.current = false;
        setUndoingCheckin(false);
      } else {
        console.error('[QTag] Undo check-in failed:', res.status);
        setUndoingCheckin(false);
        autoResetScanner(3000);
      }
    } catch (err) {
      console.error('[QTag] Undo check-in error:', err);
      setUndoingCheckin(false);
      autoResetScanner(3000);
    }
  };

  // Toggle arrival status (same as modal)
  const toggleArrival = useCallback(async (guest: QTagGuest) => {
    const newStatus = guest.status === 'arrived' ? 'registered' : 'arrived';
    try {
      const res = await fetchWithAuth('/api/qtag/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          guestId: guest.id,
          status: newStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[QTag] Check-in failed:', res.status, data);
      }
    } catch (err) {
      console.error('[QTag] Check-in error:', err);
    }
  }, [codeId]);

  // Delete guest
  const handleDeleteClick = useCallback((guest: QTagGuest) => {
    setConfirmDeleteGuest({ id: guest.id, name: guest.name });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!confirmDeleteGuest) return;
    setDeletingGuestId(confirmDeleteGuest.id);
    try {
      const res = await fetchWithAuth(`/api/qtag/guests?codeId=${codeId}&guestId=${confirmDeleteGuest.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[QTag] Delete failed:', res.status, data);
      }
    } catch (err) {
      console.error('[QTag] Delete error:', err);
    } finally {
      setDeletingGuestId(null);
      setConfirmDeleteGuest(null);
    }
  }, [codeId, confirmDeleteGuest]);

  // Export to Excel (client-side generation)
  const handleExport = () => {
    setExporting(true);
    try {
      const rows = guests.map(g => ({
        'Name': g.name,
        'Phone': formatPhoneForDisplay(g.phone || ''),
        '+1 Count': g.plusOneCount || 0,
        '+1 Name': g.plusOneDetails?.[0]?.name || '',
        '+1 Gender': g.plusOneDetails?.[0]?.gender === 'male' ? 'Male' : g.plusOneDetails?.[0]?.gender === 'female' ? 'Female' : '',
        'Status': g.status === 'arrived' ? 'Arrived' : g.status === 'cancelled' ? 'Cancelled' : 'Registered',
        'Registered At': g.registeredAt ? new Date(g.registeredAt).toLocaleString('he-IL') : '',
        'Arrived At': g.arrivedAt ? new Date(g.arrivedAt).toLocaleString('he-IL') : '',
        'Verified': g.isVerified ? 'Yes' : 'No',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 10 },
        { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 8 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Guests');
      XLSX.writeFile(workbook, `qtag-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  // Quick-add guest
  const handleQuickAdd = async () => {
    setQuickAddLoading(true);
    setQuickAddError(null);
    try {
      const res = await fetchWithAuth('/api/qtag/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          name: quickAddName.trim() || undefined,
          plusOneCount: quickAddPlusOne,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setQuickAddError(data.error || 'Failed to add guest');
        return;
      }
      // Success - reset and close
      setShowQuickAdd(false);
      setQuickAddName('');
      setQuickAddPlusOne(0);
    } catch {
      setQuickAddError('Connection error');
    } finally {
      setQuickAddLoading(false);
    }
  };

  // Memoized filtered guest list
  const filteredGuests = useMemo(() => {
    return guests.filter(g => {
      if (activeFilter === 'registered' && g.status !== 'registered') return false;
      if (activeFilter === 'arrived' && g.status !== 'arrived') return false;
      if (activeFilter === 'cancelled' && g.status !== 'cancelled') return false;

      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (g.name.toLowerCase().includes(q)) return true;
        if (g.phone.includes(q)) return true;
        if (g.plusOneDetails?.some(p => p.name?.toLowerCase().includes(q))) return true;
        return false;
      }

      return true;
    });
  }, [guests, activeFilter, debouncedSearch]);

  // Memoized tab counts
  const filterTabs = useMemo(() => [
    { key: 'all' as FilterTab, label: t('qtagFilterAll'), count: guests.length },
    { key: 'registered' as FilterTab, label: t('qtagFilterRegistered'), count: guests.filter(g => g.status === 'registered').length },
    { key: 'arrived' as FilterTab, label: t('qtagFilterArrived'), count: guests.filter(g => g.status === 'arrived').length },
    { key: 'cancelled' as FilterTab, label: t('qtagFilterCancelled'), count: guests.filter(g => g.status === 'cancelled').length },
  ], [guests, t]);

  // ── Scanner View ──
  const renderScanner = () => (
    <div className="flex flex-col h-full bg-gray-950 text-white relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur-md z-10">
        <button onClick={() => setViewMode('list')} className="p-2 rounded-lg hover:bg-white/10 lg:hidden">
          <Users className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold font-assistant">Q.Tag Scanner</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>
          <button onClick={() => setViewMode('list')} className="flex items-center gap-2 text-xs cursor-pointer hover:opacity-80 transition-opacity lg:pointer-events-none">
            <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400">
              {stats.totalArrived}
            </span>
            <span className="text-gray-400">/</span>
            <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
              {stats.totalRegistered}
            </span>
          </button>
        </div>
      </div>

      {/* Scanner area */}
      <div className="flex-1 relative">
        {/* Camera view */}
        <div
          id="qtag-scanner"
          className="w-full h-full"
          ref={scannerContainerRef}
          style={{ display: scannerState === 'scanning' ? 'block' : 'none' }}
        />

        {/* Loading overlay */}
        {scannerState === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
            <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
          </div>
        )}

        {/* Result overlay - tap anywhere to dismiss */}
        {scannerState === 'result' && scanResult && (
          <div
            className="absolute inset-0 flex items-center justify-center p-6 bg-gray-950/90 backdrop-blur-sm cursor-pointer"
            onClick={dismissOverlay}
          >
            <div
              className={`w-full max-w-sm rounded-2xl p-6 text-center space-y-4 ${
                scanResult.alreadyArrived ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-green-500/10 border border-green-500/30'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {scanResult.alreadyArrived ? (
                <AlertCircle className="w-16 h-16 text-amber-400 mx-auto" />
              ) : (
                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
              )}

              <h2 className="text-2xl font-bold font-assistant">
                {scanResult.guest.name}
              </h2>

              {scanResult.guest.plusOneCount > 0 && (
                <div className="flex items-center justify-center gap-2 text-gray-300">
                  <Users className="w-4 h-4" />
                  <span>+{scanResult.guest.plusOneCount}</span>
                </div>
              )}

              <div className={`text-lg font-semibold ${
                scanResult.alreadyArrived ? 'text-amber-400' : 'text-green-400'
              }`}>
                {scanResult.alreadyArrived ? t('qtagAlreadyCheckedIn') : t('qtagCheckedIn')}
              </div>

              {scanResult.guest.registeredAt && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {t('qtagRegisteredAt')} {new Date(scanResult.guest.registeredAt).toLocaleString('he-IL', {
                      hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
                    })}
                  </span>
                </div>
              )}

              {/* Undo check-in button */}
              <button
                onClick={handleUndoCheckin}
                disabled={undoingCheckin}
                className="mt-2 px-4 py-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white text-sm font-assistant transition-all disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
              >
                {undoingCheckin ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
                {t('qtagUndoCheckin')}
              </button>
            </div>
          </div>
        )}

        {/* Error overlay - tap anywhere to dismiss */}
        {scannerState === 'error' && (
          <div
            className="absolute inset-0 flex items-center justify-center p-6 bg-gray-950/90 backdrop-blur-sm cursor-pointer"
            onClick={dismissOverlay}
          >
            <div className="w-full max-w-sm rounded-2xl p-6 text-center space-y-4 bg-red-500/10 border border-red-500/30">
              <X className="w-16 h-16 text-red-400 mx-auto" />
              <p className="text-red-400 text-lg font-semibold font-assistant">
                {scanError || t('qtagScanFailed')}
              </p>
            </div>
          </div>
        )}

        {/* Scan prompt overlay when scanning */}
        {scannerState === 'scanning' && scannerReady && (
          <div className="absolute bottom-8 inset-x-0 flex justify-center">
            <div className="px-6 py-3 rounded-full bg-black/60 backdrop-blur-md text-white text-sm font-assistant">
              {t('qtagScanPrompt')}
            </div>
          </div>
        )}
      </div>

      {/* FAB - Quick Add (mobile scanner only, desktop shows in list panel) */}
      <button
        onClick={() => { setShowQuickAdd(true); window.scrollTo({ top: 0 }); }}
        className="absolute bottom-6 left-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all active:scale-95 z-10 lg:hidden"
      >
        <UserPlus className="w-6 h-6" />
      </button>
    </div>
  );

  // ── Guest List View ──
  const renderGuestList = () => (
    <div className="flex flex-col h-full bg-[#1a1a2e] text-white relative" dir="rtl">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-white font-assistant">{t('qtagGuestManagement')}</h2>
            <p className="text-xs text-white/40 mt-0.5">{t('qtagRealTimeUpdates')}</p>
          </div>
          <div className="flex items-center gap-1">
            {shortId && (
              <button
                onClick={() => { setShowRegQR(true); window.scrollTo({ top: 0 }); }}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
              >
                <QrCode className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setViewMode('scanner')}
              className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white lg:hidden"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-2 px-4 sm:px-6 py-3 border-b border-white/5">
        <StatBadge label={t('qtagPending')} value={stats.totalRegistered - stats.totalArrived} color="amber" />
        <StatBadge label={t('qtagArrived')} value={stats.totalArrived} total={stats.totalArrivedGuests} color="green" t={t} />
        <StatBadge label={t('qtagRegistered')} value={stats.totalRegistered} total={stats.totalGuests} color="blue" t={t} />
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-white/5 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('qtagSearchGuests')}
            className="w-full ps-10 pe-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-assistant text-sm"
            dir="rtl"
          />
        </div>

        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs font-assistant"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {t('qtagExport')}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 sm:px-6 py-2 border-b border-white/5 overflow-x-auto">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all font-assistant whitespace-nowrap ${
              activeFilter === tab.key
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Guest list */}
      <div className="flex-1 min-h-0">
        {loadingGuests ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-assistant">{t('qtagNoGuests')}</p>
          </div>
        ) : (
          <Virtuoso
            data={filteredGuests}
            overscan={200}
            style={{ height: '100%' }}
            itemContent={(_index, guest) => (
              <div className="px-4 sm:px-6 first:pt-2 last:pb-2">
                <ScannerGuestRow
                  guest={guest}
                  isExpanded={expandedGuestId === guest.id}
                  onToggle={() => setExpandedGuestId(expandedGuestId === guest.id ? null : guest.id)}
                  onCheckIn={() => toggleArrival(guest)}
                  onDelete={() => handleDeleteClick(guest)}
                  deleting={deletingGuestId === guest.id}
                  t={t}
                />
              </div>
            )}
          />
        )}
      </div>

      {/* FAB - Quick Add */}
      <button
        onClick={() => { setShowQuickAdd(true); window.scrollTo({ top: 0 }); }}
        className="absolute bottom-6 left-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all active:scale-95 z-10"
      >
        <UserPlus className="w-6 h-6" />
      </button>

      {/* Delete confirmation dialog */}
      {confirmDeleteGuest && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1e1e38] border border-white/10 rounded-xl p-6 mx-6 max-w-sm w-full shadow-2xl" dir="rtl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold font-assistant text-sm">{t('qtagDeleteConfirm')}</h3>
                <p className="text-white/40 text-xs mt-0.5 font-assistant">{confirmDeleteGuest.name}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmDelete}
                disabled={!!deletingGuestId}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium text-sm transition-all font-assistant disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingGuestId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('qtagDeleteConfirmYes')}
              </button>
              <button
                onClick={() => setConfirmDeleteGuest(null)}
                disabled={!!deletingGuestId}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white font-medium text-sm transition-all font-assistant"
              >
                {t('qtagDeleteConfirmNo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Loading state while checking PIN requirement
  if (pinRequired === null) {
    return (
      <div className="flex items-center justify-center h-dvh bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  // PIN gate
  if (pinRequired && !pinUnlocked) {
    return (
      <div className="flex items-center justify-center h-dvh bg-gray-950 px-6" dir="rtl">
        <div className="w-full max-w-xs space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-assistant">{t('qtagEnterPin')}</h1>
            <p className="text-sm text-white/40 mt-1 font-assistant">{t('qtagEnterPinDescription')}</p>
          </div>
          <div className="space-y-3">
            <input
              type="tel"
              inputMode="numeric"
              value={pinValue}
              onChange={(e) => { setPinValue(e.target.value.replace(/\D/g, '')); setPinError(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePinSubmit(); }}
              placeholder="••••"
              maxLength={6}
              autoFocus
              className={`w-full text-center text-2xl tracking-[0.5em] px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${
                pinError ? 'border-red-500/50 shake' : 'border-white/10'
              }`}
              dir="ltr"
            />
            {pinError && (
              <p className="text-red-400 text-xs font-assistant">{t('qtagPinError')}</p>
            )}
            <button
              onClick={handlePinSubmit}
              disabled={!pinValue.trim()}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm font-assistant transition-all disabled:opacity-40 disabled:hover:bg-blue-600"
            >
              {t('qtagPinSubmit')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-dvh flex bg-gray-950">
        {/* Scanner panel - always visible on lg+, toggle on mobile */}
        <div
          className={`h-full overflow-hidden ${
            isWideScreen
              ? 'flex-shrink-0'
              : viewMode === 'scanner' ? 'w-full' : 'hidden'
          }`}
          style={isWideScreen ? { width: scannerWidth } : undefined}
        >
          {renderScanner()}
        </div>

        {/* Resizable divider - desktop only */}
        {isWideScreen && (
          <div
            className="h-full flex-shrink-0 relative group"
            style={{ width: 1 }}
            onPointerDown={handleDividerPointerDown}
            onPointerMove={handleDividerPointerMove}
            onPointerUp={handleDividerPointerUp}
            onDoubleClick={handleDividerDoubleClick}
          >
            {/* Visible line */}
            <div className="absolute inset-y-0 start-0 w-px bg-white/10 group-hover:bg-blue-500/50 transition-colors" />
            {/* Wider invisible hit area */}
            <div className="absolute inset-y-0 -start-2.5 w-6 cursor-col-resize" />
            {/* Drag handle indicator (centered dots) */}
            <div className="absolute top-1/2 -translate-y-1/2 -start-1.5 w-3 h-8 rounded-full bg-white/5 group-hover:bg-white/15 flex flex-col items-center justify-center gap-0.5 transition-opacity opacity-0 group-hover:opacity-100">
              <div className="w-0.5 h-0.5 rounded-full bg-white/40" />
              <div className="w-0.5 h-0.5 rounded-full bg-white/40" />
              <div className="w-0.5 h-0.5 rounded-full bg-white/40" />
            </div>
          </div>
        )}

        {/* Guest list panel - always visible on lg+, toggle on mobile */}
        <div className={`h-full ${
          isWideScreen
            ? 'flex-1 min-w-0'
            : viewMode === 'list' ? 'w-full' : 'hidden'
        }`}>
          {renderGuestList()}
        </div>
      </div>

      {/* Registration QR modal */}
      {showRegQR && shortId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowRegQR(false)}
        >
          <div
            className="bg-[#1e1e38] border border-white/10 rounded-xl p-6 mx-6 max-w-sm w-full shadow-2xl"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold font-assistant text-base">{t('qtagRegistrationLink')}</h3>
              <button
                onClick={() => setShowRegQR(false)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="bg-white rounded-xl p-4">
                <QRCodeSVG
                  value={`${process.env.NEXT_PUBLIC_BASE_URL || 'https://qr.playzones.app'}/v/${shortId}`}
                  size={220}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <p className="text-white/40 text-xs font-assistant">{t('qtagScanToRegister')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick-add modal (shared across both views) */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1e1e38] border border-white/10 rounded-xl p-6 mx-6 max-w-sm w-full shadow-2xl" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold font-assistant text-base">{t('qtagQuickAdd')}</h3>
              <button
                onClick={() => { setShowQuickAdd(false); setQuickAddError(null); }}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Name input */}
            <div className="mb-4">
              <label className="text-xs text-white/50 font-assistant mb-1.5 block">{t('qtagGuestName')}</label>
              <input
                type="text"
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                placeholder={t('qtagGuestNamePlaceholder')}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-assistant text-sm"
                dir="rtl"
                autoFocus
              />
            </div>

            {/* Plus-one counter */}
            <div className="mb-5">
              <label className="text-xs text-white/50 font-assistant mb-1.5 block">{t('qtagPlusOneGuests')}</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuickAddPlusOne(Math.max(0, quickAddPlusOne - 1))}
                  disabled={quickAddPlusOne === 0}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:hover:bg-white/5"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-xl font-bold text-white w-8 text-center font-assistant">{quickAddPlusOne}</span>
                <button
                  onClick={() => setQuickAddPlusOne(Math.min(10, quickAddPlusOne + 1))}
                  disabled={quickAddPlusOne === 10}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:hover:bg-white/5"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Error */}
            {quickAddError && (
              <p className="text-red-400 text-xs font-assistant mb-3">{quickAddError}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleQuickAdd}
              disabled={quickAddLoading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm font-assistant transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {quickAddLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('qtagAdding')}
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  {t('qtagAddGuest')}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function StatBadge({ label, value, total, color, t }: {
  label: string;
  value: number;
  total?: number;
  color: 'blue' | 'green' | 'amber';
  t?: (key: string) => string;
}) {
  const colors = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  };

  return (
    <div className={`flex-1 text-center py-2 rounded-lg border ${colors[color]}`}>
      <div className="font-bold text-lg">{value}</div>
      <div className="text-[10px] text-white/40">
        {label}
        {total !== undefined && total !== value && t ? ` (${total} ${t('qtagTotal')})` : ''}
      </div>
    </div>
  );
}
