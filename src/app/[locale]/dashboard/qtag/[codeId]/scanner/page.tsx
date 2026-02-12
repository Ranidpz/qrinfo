'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { collection, doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  Download,
  UserPlus,
  Plus,
  Minus,
  Lock,
} from 'lucide-react';
import type { QTagGuest, QTagStats } from '@/types/qtag';

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
  const [viewMode, setViewMode] = useState<ViewMode>('scanner');

  // Scanner ref
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const processingRef = useRef(false);

  // Guest list state (real-time)
  const [guests, setGuests] = useState<QTagGuest[]>([]);
  const [stats, setStats] = useState<QTagStats>({
    totalRegistered: 0, totalGuests: 0, totalArrived: 0, totalArrivedGuests: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [loadingGuests, setLoadingGuests] = useState(true);

  // Delete state
  const [deletingGuestId, setDeletingGuestId] = useState<string | null>(null);
  const [confirmDeleteGuest, setConfirmDeleteGuest] = useState<{ id: string; name: string } | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Quick-add state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPlusOne, setQuickAddPlusOne] = useState(0);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  // Fetch scanner PIN from code document
  useEffect(() => {
    if (!db || !codeId) return;

    const fetchPin = async () => {
      try {
        const codeDoc = await getDoc(doc(db, 'codes', codeId));
        if (codeDoc.exists()) {
          const data = codeDoc.data();
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

  // Real-time guest updates via Firestore onSnapshot
  useEffect(() => {
    if (!db || !codeId) return;

    setLoadingGuests(true);
    const guestsRef = collection(db, 'codes', codeId, 'qtagGuests');
    const unsubscribe = onSnapshot(guestsRef, (snapshot) => {
      const guestList: QTagGuest[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          codeId: data.codeId,
          name: data.name,
          phone: data.phone,
          plusOneCount: data.plusOneCount || 0,
          plusOneDetails: data.plusOneDetails || [],
          qrToken: data.qrToken,
          isVerified: data.isVerified || false,
          verifiedAt: data.verifiedAt instanceof Timestamp ? data.verifiedAt.toDate() : undefined,
          status: data.status || 'registered',
          arrivedAt: data.arrivedAt instanceof Timestamp ? data.arrivedAt.toDate() : undefined,
          arrivedMarkedBy: data.arrivedMarkedBy,
          qrSentViaWhatsApp: data.qrSentViaWhatsApp || false,
          qrSentAt: data.qrSentAt instanceof Timestamp ? data.qrSentAt.toDate() : undefined,
          registeredAt: data.registeredAt instanceof Timestamp ? data.registeredAt.toDate() : new Date(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
          registeredByAdmin: data.registeredByAdmin || false,
        };
      });

      // Sort by registeredAt descending
      guestList.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
      setGuests(guestList);

      // Compute stats
      const arrived = guestList.filter(g => g.status === 'arrived');
      setStats({
        totalRegistered: guestList.filter(g => g.status !== 'cancelled').length,
        totalGuests: guestList.reduce((sum, g) => g.status !== 'cancelled' ? sum + 1 + g.plusOneCount : sum, 0),
        totalArrived: arrived.length,
        totalArrivedGuests: arrived.reduce((sum, g) => sum + 1 + g.plusOneCount, 0),
      });

      setLoadingGuests(false);
    });

    return () => unsubscribe();
  }, [codeId]);

  // Initialize scanner (only after PIN is unlocked)
  useEffect(() => {
    if (viewMode !== 'scanner' || !pinUnlocked) return;

    let html5Qrcode: Html5Qrcode | null = null;

    const initScanner = async () => {
      try {
        html5Qrcode = new Html5Qrcode('qtag-scanner');
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          handleScanSuccess,
          () => {} // Ignore scan failures
        );

        setScannerReady(true);
      } catch (err) {
        console.error('Failed to start scanner:', err);
        setScanError('Failed to access camera. Please allow camera permission.');
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
  }, [viewMode, pinUnlocked]);

  // Handle successful QR scan
  const handleScanSuccess = async (decodedText: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    setScannerState('loading');

    try {
      // Parse QR data
      let qrToken: string;
      try {
        const parsed = JSON.parse(decodedText);
        if (parsed.t !== 'qtag' || !parsed.tk) {
          throw new Error('Not a Q.Tag QR code');
        }
        qrToken = parsed.tk;
      } catch {
        setScannerState('error');
        setScanError('QR code is not valid for this event');
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
        setScanError(data.errorCode === 'NOT_FOUND' ? 'Guest not found' : data.error);
        autoResetScanner(3000);
        return;
      }

      setScanResult(data);
      setScannerState('result');
      autoResetScanner(4000);
    } catch {
      setScannerState('error');
      setScanError('Connection error. Please try again.');
      autoResetScanner(3000);
    }
  };

  // Auto-reset scanner after showing result
  const autoResetScanner = (delayMs: number) => {
    setTimeout(() => {
      setScannerState('scanning');
      setScanResult(null);
      setScanError(null);
      processingRef.current = false;
    }, delayMs);
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

  // Export to Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetchWithAuth(`/api/qtag/export?codeId=${codeId}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qtag-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Silent
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

  // Filter guests
  const filteredGuests = guests.filter(g => {
    // Tab filter
    if (activeFilter === 'registered' && g.status !== 'registered') return false;
    if (activeFilter === 'arrived' && g.status !== 'arrived') return false;
    if (activeFilter === 'cancelled' && g.status !== 'cancelled') return false;

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return g.name.toLowerCase().includes(q) || g.phone.includes(q);
    }

    return true;
  });

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: t('qtagFilterAll'), count: guests.length },
    { key: 'registered', label: t('qtagFilterRegistered'), count: guests.filter(g => g.status === 'registered').length },
    { key: 'arrived', label: t('qtagFilterArrived'), count: guests.filter(g => g.status === 'arrived').length },
    { key: 'cancelled', label: t('qtagFilterCancelled'), count: guests.filter(g => g.status === 'cancelled').length },
  ];

  // ── Scanner View ──
  const renderScanner = () => (
    <div className="flex flex-col h-dvh bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur-md z-10">
        <button onClick={() => setViewMode('list')} className="p-2 rounded-lg hover:bg-white/10">
          <Users className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold font-assistant">Q.Tag Scanner</h1>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400">
            {stats.totalArrived}
          </span>
          <span className="text-gray-400">/</span>
          <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
            {stats.totalRegistered}
          </span>
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

        {/* Result overlay */}
        {scannerState === 'result' && scanResult && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-gray-950/90 backdrop-blur-sm">
            <div className={`w-full max-w-sm rounded-2xl p-6 text-center space-y-4 ${
              scanResult.alreadyArrived ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-green-500/10 border border-green-500/30'
            }`}>
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
                {scanResult.alreadyArrived ? 'Already Checked In' : 'Checked In!'}
              </div>

              {scanResult.guest.registeredAt && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Registered: {new Date(scanResult.guest.registeredAt).toLocaleString('he-IL', {
                      hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error overlay */}
        {scannerState === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-gray-950/90 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl p-6 text-center space-y-4 bg-red-500/10 border border-red-500/30">
              <X className="w-16 h-16 text-red-400 mx-auto" />
              <p className="text-red-400 text-lg font-semibold font-assistant">
                {scanError || 'Scan failed'}
              </p>
            </div>
          </div>
        )}

        {/* Scan prompt overlay when scanning */}
        {scannerState === 'scanning' && scannerReady && (
          <div className="absolute bottom-8 inset-x-0 flex justify-center">
            <div className="px-6 py-3 rounded-full bg-black/60 backdrop-blur-md text-white text-sm font-assistant">
              Point camera at guest QR code
            </div>
          </div>
        )}
      </div>

      {/* FAB - Quick Add */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="absolute bottom-6 left-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all active:scale-95 z-10"
      >
        <UserPlus className="w-6 h-6" />
      </button>
    </div>
  );

  // ── Guest List View ──
  const renderGuestList = () => (
    <div className="flex flex-col h-dvh bg-[#1a1a2e] text-white relative" dir="rtl">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-white font-assistant">{t('qtagGuestManagement')}</h2>
            <p className="text-xs text-white/40 mt-0.5">{t('qtagRealTimeUpdates')}</p>
          </div>
          <button
            onClick={() => setViewMode('scanner')}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
          >
            <Camera className="w-5 h-5" />
          </button>
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
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 space-y-1.5">
        {loadingGuests && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        )}

        {!loadingGuests && filteredGuests.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-assistant">{t('qtagNoGuests')}</p>
          </div>
        )}

        {filteredGuests.map((guest) => (
          <div
            key={guest.id}
            className="flex items-center gap-3 px-3 sm:px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors"
          >
            {/* Status dot */}
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              guest.status === 'arrived' ? 'bg-green-400' :
              guest.status === 'cancelled' ? 'bg-red-400' : 'bg-gray-500'
            }`} />

            {/* Guest info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2 text-[11px] text-white/40 mt-0.5">
                <span dir="ltr">{guest.phone}</span>
                <span>|</span>
                <Clock className="w-3 h-3" />
                {guest.status === 'arrived' && guest.arrivedAt ? (
                  <span className="text-green-400/70">
                    {new Date(guest.arrivedAt).toLocaleString('he-IL', {
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
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Toggle arrival */}
              <button
                onClick={() => toggleArrival(guest)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all font-assistant ${
                  guest.status === 'arrived'
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                {guest.status === 'arrived' ? t('qtagArrivedStatus') : t('qtagCheckIn')}
              </button>

              {/* Delete */}
              <button
                onClick={() => handleDeleteClick(guest)}
                disabled={deletingGuestId === guest.id}
                className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
              >
                {deletingGuestId === guest.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FAB - Quick Add */}
      <button
        onClick={() => setShowQuickAdd(true)}
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
      {viewMode === 'scanner' ? renderScanner() : renderGuestList()}

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
