'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
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
  List,
  User,
  Check,
  Menu,
  Home,
  UserPlus,
} from 'lucide-react';

interface GuestResult {
  id: string;
  name: string;
  phone: string;
  plusOneCount: number;
  plusOneDetails: { name?: string; gender?: string }[];
  status: string;
  isVerified: boolean;
  registeredAt: string;
  arrivedAt?: string;
}

interface ScanResult {
  guest: GuestResult;
  alreadyArrived: boolean;
  checkedInAt?: string;
}

type ScannerState = 'scanning' | 'loading' | 'result' | 'error';
type ViewMode = 'scanner' | 'list';

export default function QTagScannerPage() {
  const params = useParams();
  const codeId = params.codeId as string;

  // Scanner state
  const [scannerState, setScannerState] = useState<ScannerState>('scanning');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('scanner');
  const [menuOpen, setMenuOpen] = useState(false);

  // Scanner ref
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const processingRef = useRef(false);

  // Guest list state
  const [guests, setGuests] = useState<GuestResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingGuests, setLoadingGuests] = useState(false);

  // Stats
  const [stats, setStats] = useState({ registered: 0, arrived: 0, pending: 0 });

  // Initialize scanner
  useEffect(() => {
    if (viewMode !== 'scanner') return;

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
  }, [viewMode]);

  // Fetch guest list
  const fetchGuests = useCallback(async () => {
    setLoadingGuests(true);
    try {
      const res = await fetchWithAuth(`/api/qtag/guests?codeId=${codeId}`);
      if (res.ok) {
        const data = await res.json();
        setGuests(data.guests || []);

        // Calculate stats
        const total = data.guests?.length || 0;
        const arrived = data.guests?.filter((g: GuestResult) => g.status === 'arrived').length || 0;
        setStats({ registered: total, arrived, pending: total - arrived });
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingGuests(false);
    }
  }, [codeId]);

  // Fetch guests on list view or after check-in
  useEffect(() => {
    if (viewMode === 'list') {
      fetchGuests();
    }
  }, [viewMode, fetchGuests]);

  // Periodic refresh for list mode
  useEffect(() => {
    if (viewMode !== 'list') return;
    const interval = setInterval(fetchGuests, 10000);
    return () => clearInterval(interval);
  }, [viewMode, fetchGuests]);

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

      // Query first, then checkin
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
    } catch (err) {
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

  // Manual check-in from list
  const handleManualCheckin = async (guest: GuestResult) => {
    if (guest.status === 'arrived') return;

    try {
      const res = await fetch('/api/qtag/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: guest.id, action: 'checkin' }),
      });

      if (res.ok) {
        fetchGuests();
      }
    } catch {
      // Silent fail
    }
  };

  // Filtered guests for search
  const filteredGuests = guests.filter(g => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return g.name.toLowerCase().includes(q) || g.phone.includes(q);
  });

  // ── Scanner View ──
  const renderScanner = () => (
    <div className="flex flex-col h-dvh bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur-md z-10">
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg hover:bg-white/10">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold font-assistant">Q.Tag Scanner</h1>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400">
            {stats.arrived}
          </span>
          <span className="text-gray-400">/</span>
          <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
            {stats.registered}
          </span>
        </div>
      </div>

      {/* Menu dropdown */}
      {menuOpen && (
        <div className="absolute top-14 start-4 z-50 bg-gray-800 rounded-xl shadow-2xl border border-white/10 overflow-hidden">
          <button
            onClick={() => { setViewMode('list'); setMenuOpen(false); }}
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 w-full text-start"
          >
            <List className="w-4 h-4" />
            <span className="font-assistant">Guest List</span>
          </button>
          <button
            onClick={() => { setViewMode('scanner'); setMenuOpen(false); }}
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 w-full text-start"
          >
            <Camera className="w-4 h-4" />
            <span className="font-assistant">Scanner</span>
          </button>
        </div>
      )}

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
    </div>
  );

  // ── Guest List View ──
  const renderGuestList = () => (
    <div className="flex flex-col h-dvh bg-gray-950 text-white" dir="rtl">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-900/80 backdrop-blur-md space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setViewMode('scanner')}
            className="p-2 rounded-lg hover:bg-white/10"
          >
            <Camera className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold font-assistant">Guest List</h1>
          <button onClick={fetchGuests} className="p-2 rounded-lg hover:bg-white/10">
            {loadingGuests ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex gap-2 text-xs">
          <div className="flex-1 text-center py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="text-blue-400 font-bold text-lg">{stats.registered}</div>
            <div className="text-gray-400">Registered</div>
          </div>
          <div className="flex-1 text-center py-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="text-green-400 font-bold text-lg">{stats.arrived}</div>
            <div className="text-gray-400">Arrived</div>
          </div>
          <div className="flex-1 text-center py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="text-amber-400 font-bold text-lg">{stats.pending}</div>
            <div className="text-gray-400">Pending</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-assistant text-sm"
            dir="rtl"
          />
        </div>
      </div>

      {/* Guest list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {filteredGuests.length === 0 && !loadingGuests && (
          <div className="text-center py-12 text-gray-500">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-assistant">No guests found</p>
          </div>
        )}

        {filteredGuests.map((guest) => (
          <div
            key={guest.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/5"
          >
            {/* Status indicator */}
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
              guest.status === 'arrived' ? 'bg-green-400' : 'bg-gray-500'
            }`} />

            {/* Guest info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold font-assistant truncate">{guest.name}</span>
                {guest.plusOneCount > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 flex-shrink-0">
                    +{guest.plusOneCount}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400" dir="ltr">{guest.phone}</div>
            </div>

            {/* Check-in button or status */}
            {guest.status === 'arrived' ? (
              <div className="flex items-center gap-1 text-green-400 text-xs flex-shrink-0">
                <Check className="w-4 h-4" />
                <span className="font-assistant">Arrived</span>
              </div>
            ) : (
              <button
                onClick={() => handleManualCheckin(guest)}
                className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30 transition-colors font-assistant flex-shrink-0"
              >
                Check In
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return viewMode === 'scanner' ? renderScanner() : renderGuestList();
}
