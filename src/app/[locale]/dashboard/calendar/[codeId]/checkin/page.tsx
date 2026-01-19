'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  X,
  CheckCircle2,
  AlertCircle,
  Users,
  Clock,
  MapPin,
  Loader2,
  RefreshCw,
  Search,
  List,
  User,
  Phone,
  Check,
  ChevronDown,
  Calendar,
  Pencil,
  Trash2,
  Menu,
  Home,
} from 'lucide-react';

interface ScanResult {
  registration: {
    id: string;
    nickname: string;
    phone: string;
    count: number;
    avatarUrl?: string;
    avatarType: 'photo' | 'emoji' | 'none';
    qrToken: string;
    isVerified: boolean;
    checkedIn: boolean;
    checkedInAt?: string;
  };
  activity: {
    title: string;
    time: string;
    boothName: string;
    date: string;
    backgroundColor: string;
  };
  alreadyCheckedIn: boolean;
  checkedInAt?: string;
}

interface Registration {
  id: string;
  nickname: string;
  phone?: string;
  count: number;
  avatarUrl?: string;
  avatarType: 'photo' | 'emoji' | 'none';
  qrToken: string;
  isVerified: boolean;
  checkedIn: boolean;
  checkedInAt?: string;
  cellId: string;
  boothId?: string;
  boothDate?: string;
  registeredAt?: string;
}

interface ActivityInfo {
  cellId: string;
  boothId: string;
  boothDate: string;
  title: string;
  startTime?: string;
  endTime?: string;
  boothName?: string;
  backgroundColor?: string;
  capacity?: number;
}

type ScanState = 'scanning' | 'loading' | 'result' | 'error';
type ViewMode = 'scanner' | 'participants';

export default function CheckinScannerPage() {
  const params = useParams();
  const router = useRouter();
  const codeId = params.codeId as string;
  const locale = (params.locale as string) || 'he';
  const isRTL = locale === 'he';

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('scanner');

  // Event info
  const [eventTitle, setEventTitle] = useState<string>('');

  // Scanner state
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Participants list state
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [activities, setActivities] = useState<ActivityInfo[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<Registration | null>(null);
  const [deletingReg, setDeletingReg] = useState<Registration | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [editCount, setEditCount] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const autoResetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch event title
  useEffect(() => {
    const fetchEventTitle = async () => {
      try {
        const response = await fetch(`/api/codes/${codeId}`);
        if (response.ok) {
          const data = await response.json();
          setEventTitle(data.code?.title || '');
        }
      } catch (err) {
        console.error('Error fetching event title:', err);
      }
    };

    if (codeId) {
      fetchEventTitle();
    }
  }, [codeId]);

  // Initialize camera scanner
  useEffect(() => {
    if (viewMode !== 'scanner') return;

    const initScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          handleScan,
          () => {
            // Silence all scan errors (normal behavior when no QR visible)
          }
        );

        setCameraReady(true);
      } catch (err) {
        console.error('[Scanner] Failed to start camera:', err);
        setError(isRTL ? 'לא ניתן לגשת למצלמה' : 'Cannot access camera');
        setScanState('error');
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initScanner, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
        scannerRef.current = null;
      }
      if (autoResetTimerRef.current) {
        clearTimeout(autoResetTimerRef.current);
      }
    };
  }, [viewMode, isRTL]);

  // Fetch participants when switching to participants view
  useEffect(() => {
    if (viewMode !== 'participants' || !codeId) return;

    const fetchData = async () => {
      setLoadingParticipants(true);
      try {
        // Fetch code config first to get all booth days
        const codeResponse = await fetch(`/api/codes/${codeId}`);
        let config: {
          boothDays?: Array<{
            date: string;
            booths?: Array<{
              id: string;
              name: string;
              cells?: Array<{
                id: string;
                title?: string;
                startTime?: string;
                endTime?: string;
                backgroundColor?: string;
              }>;
            }>;
          }>;
          defaultBooths?: Array<{
            id: string;
            name: string;
            cells?: Array<{
              id: string;
              title?: string;
              startTime?: string;
              endTime?: string;
              backgroundColor?: string;
            }>;
          }>;
        } | null = null;

        if (codeResponse.ok) {
          const codeData = await codeResponse.json();
          // Config is stored in media[0].weeklycalConfig
          config = codeData.code?.media?.[0]?.weeklycalConfig;
        }

        // Fetch ALL registrations for this code (no date filter)
        const regResponse = await fetch(`/api/weeklycal/register?codeId=${codeId}`);
        if (regResponse.ok) {
          const regData = await regResponse.json();
          const allRegs = regData.registrations || [];
          setRegistrations(allRegs);

          // Build activity info from all booth days in config
          const activityList: ActivityInfo[] = [];

          if (config?.boothDays) {
            config.boothDays.forEach((day: {
              date: string;
              booths?: Array<{ id: string; name?: string; timeSlots?: Array<{ id: string; startTime?: string; endTime?: string }> }>;
              cells?: Array<{ id: string; boothId: string; title?: string; backgroundColor?: string; startSlotIndex?: number; capacity?: number }>;
              timeSlots?: Array<{ id: string; startTime?: string; endTime?: string }>;
            }) => {
              const booths = day.booths || config?.defaultBooths || [];
              const timeSlots = day.timeSlots || [];
              const cells = day.cells || [];

              // Cells are stored at the day level, not inside booths
              cells.forEach((cell) => {
                const booth = booths.find(b => b.id === cell.boothId);
                // Get time from time slots
                const slot = timeSlots[cell.startSlotIndex || 0];

                activityList.push({
                  cellId: cell.id,
                  boothId: cell.boothId,
                  boothDate: day.date,
                  title: cell.title || '',
                  startTime: slot?.startTime,
                  endTime: slot?.endTime,
                  boothName: booth?.name,
                  backgroundColor: cell.backgroundColor,
                  capacity: cell.capacity,
                });
              });
            });
          }

          setActivities(activityList);
        }
      } catch (err) {
        console.error('Error fetching participants:', err);
      } finally {
        setLoadingParticipants(false);
      }
    };

    fetchData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [viewMode, codeId]);

  // Handle QR code scan
  const handleScan = useCallback(async (decodedText: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    setScanState('loading');

    try {
      const response = await fetch('/api/weeklycal/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: decodedText,
          action: 'query',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.errorCode === 'NOT_FOUND') {
          setError(isRTL ? 'הרשמה לא נמצאה' : 'Registration not found');
        } else {
          setError(isRTL ? 'שגיאה בשליפת הנתונים' : 'Error fetching data');
        }
        setScanState('error');
        scheduleReset();
        return;
      }

      const data: ScanResult = await response.json();
      setScanResult(data);
      setScanState('result');

      if (data.alreadyCheckedIn) {
        scheduleReset(10000);
      }
    } catch (err) {
      console.error('[Scanner] Error processing scan:', err);
      setError(isRTL ? 'שגיאה בעיבוד הסריקה' : 'Error processing scan');
      setScanState('error');
      scheduleReset();
    }
  }, [isRTL]);

  const scheduleReset = (delay: number = 5000) => {
    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
    }
    autoResetTimerRef.current = setTimeout(() => {
      resetScanner();
    }, delay);
  };

  const resetScanner = () => {
    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
    }
    setScanState('scanning');
    setScanResult(null);
    setError(null);
    isProcessingRef.current = false;
  };

  const handleApproveCheckin = async () => {
    if (!scanResult) return;

    setScanState('loading');

    try {
      const response = await fetch('/api/weeklycal/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: scanResult.registration.qrToken,
          action: 'checkin',
        }),
      });

      if (!response.ok) {
        setError(isRTL ? 'שגיאה באישור כניסה' : 'Error approving check-in');
        setScanState('error');
        scheduleReset();
        return;
      }

      const data: ScanResult = await response.json();
      setScanResult(data);
      setScanState('result');
      scheduleReset(3000);
    } catch (err) {
      console.error('[Scanner] Error approving check-in:', err);
      setError(isRTL ? 'שגיאה באישור כניסה' : 'Error approving check-in');
      setScanState('error');
      scheduleReset();
    }
  };

  // Manual check-in from participants list
  const handleManualCheckin = async (qrToken: string, registrationId: string) => {
    try {
      const response = await fetch('/api/weeklycal/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken,
          action: 'checkin',
          codeId,        // Pass codeId for direct lookup
          registrationId, // Pass registrationId for direct lookup
        }),
      });

      if (response.ok) {
        // Update local state
        setRegistrations(prev =>
          prev.map(reg =>
            reg.qrToken === qrToken
              ? { ...reg, checkedIn: true, checkedInAt: new Date().toISOString() }
              : reg
          )
        );
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Check-in failed:', errorData);
        alert(isRTL ? 'שגיאה באישור כניסה' : 'Check-in failed');
      }
    } catch (err) {
      console.error('Error with manual check-in:', err);
      alert(isRTL ? 'שגיאה באישור כניסה' : 'Check-in failed');
    }
  };

  // Edit registration
  const handleEditReg = (reg: Registration) => {
    setEditingReg(reg);
    setEditNickname(reg.nickname);
    setEditCount(reg.count);
  };

  const handleSaveEdit = async () => {
    if (!editingReg) return;
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/weeklycal/register`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          registrationId: editingReg.id,
          nickname: editNickname,
          count: editCount,
        }),
      });

      if (response.ok) {
        setRegistrations(prev =>
          prev.map(reg =>
            reg.id === editingReg.id
              ? { ...reg, nickname: editNickname, count: editCount }
              : reg
          )
        );
        setEditingReg(null);
      }
    } catch (err) {
      console.error('Error updating registration:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete registration
  const handleDeleteReg = async () => {
    if (!deletingReg) return;
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/weeklycal/register`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          registrationId: deletingReg.id,
        }),
      });

      if (response.ok) {
        setRegistrations(prev => prev.filter(reg => reg.id !== deletingReg.id));
        setDeletingReg(null);
      }
    } catch (err) {
      console.error('Error deleting registration:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatCheckedInTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format booth date for display (e.g., "15/01" or "Jan 15")
  const formatBoothDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Filter and group registrations by activity (cellId + boothId + boothDate)
  const filteredAndGroupedRegistrations = useMemo(() => {
    // Filter by search query
    let filtered = registrations;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = registrations.filter(reg => {
        const nameMatch = reg.nickname?.toLowerCase().includes(query);
        const phoneMatch = reg.phone?.replace(/\D/g, '').includes(query.replace(/\D/g, ''));
        return nameMatch || phoneMatch;
      });
    }

    // Group by unique activity key (cellId + boothId + boothDate)
    const grouped: Record<string, { activity: ActivityInfo | null; registrations: Registration[] }> = {};

    filtered.forEach(reg => {
      // Create unique key for this activity instance
      const groupKey = `${reg.cellId}_${reg.boothId || ''}_${reg.boothDate || ''}`;

      if (!grouped[groupKey]) {
        // Find matching activity by cellId, boothId and boothDate
        const activity = activities.find(a =>
          a.cellId === reg.cellId &&
          a.boothId === reg.boothId &&
          a.boothDate === reg.boothDate
        ) || null;
        grouped[groupKey] = { activity, registrations: [] };
      }
      grouped[groupKey].registrations.push(reg);
    });

    // Sort by date then start time
    return Object.entries(grouped).sort(([, a], [, b]) => {
      const dateA = a.activity?.boothDate || '9999-99-99';
      const dateB = b.activity?.boothDate || '9999-99-99';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.activity?.startTime || '99:99';
      const timeB = b.activity?.startTime || '99:99';
      return timeA.localeCompare(timeB);
    });
  }, [registrations, activities, searchQuery]);

  // Auto-expand all slots when searching, collapse when search is cleared
  useEffect(() => {
    if (searchQuery.trim()) {
      // Expand all matching slots when searching
      const matchingSlotIds = filteredAndGroupedRegistrations.map(([cellId]) => cellId);
      setExpandedSlots(new Set(matchingSlotIds));
    } else {
      // Collapse all when search is cleared
      setExpandedSlots(new Set());
    }
  }, [searchQuery, filteredAndGroupedRegistrations]);

  const toggleSlot = (cellId: string) => {
    setExpandedSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cellId)) {
        newSet.delete(cellId);
      } else {
        newSet.add(cellId);
      }
      return newSet;
    });
  };

  return (
    <>
      {/* CSS to constrain scanner video and make layout responsive */}
      <style jsx global>{`
        #qr-reader {
          border: none !important;
          width: 100% !important;
          height: 100% !important;
          background: #000 !important;
        }
        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 16px;
        }
        #qr-reader__scan_region {
          min-height: unset !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        #qr-reader__scan_region > img {
          display: none !important;
        }
        #qr-reader__dashboard {
          display: none !important;
        }
        /* Use dvh for better mobile support */
        .checkin-container {
          height: 100vh;
          height: 100dvh;
        }
      `}</style>
      <div
        className="checkin-container bg-gray-900 flex flex-col overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
      {/* Header - Clean design with menu on left, logo on right */}
      <div className="bg-gradient-to-b from-gray-900 to-gray-900/95 px-4 py-3 flex items-center shrink-0 border-b border-gray-800">
        {/* Hamburger Menu Button - on start */}
        <button
          onClick={() => setMenuOpen(true)}
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Event Title */}
        <h1 className="text-base sm:text-lg font-semibold text-white truncate flex-1 mx-4 text-center">
          {eventTitle || (isRTL ? 'צ׳ק-אין' : 'Check-in')}
        </h1>

        {/* Q Logo - on end */}
        <div className="flex items-center gap-3">
          <img
            src="/theQ.png"
            alt="Q"
            className="w-8 h-8 object-contain"
          />
        </div>
      </div>

      {/* Slide-out Menu with animation */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />

        {/* Menu Panel */}
        <div
          className={`fixed top-0 ${isRTL ? 'right-0' : 'left-0'} h-full w-72 bg-gray-900 z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${
            menuOpen
              ? 'translate-x-0'
              : isRTL ? 'translate-x-full' : '-translate-x-full'
          }`}
          dir="rtl"
        >
          {/* Menu Header */}
          <div className="p-4 flex items-center justify-between border-b border-gray-800">
            <h2 className="text-white font-semibold">תפריט</h2>
            <button
              onClick={() => setMenuOpen(false)}
              className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Menu Items */}
          <div className="flex-1 py-4">
            <button
              onClick={() => {
                setViewMode('scanner');
                setMenuOpen(false);
              }}
              className={`w-full px-6 py-4 flex items-center gap-4 transition-all duration-200 ${
                viewMode === 'scanner'
                  ? 'bg-cyan-500/20 text-cyan-400 border-r-4 border-cyan-500'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Camera className="w-5 h-5" />
              <span className="font-medium">{isRTL ? 'סורק QR' : 'QR Scanner'}</span>
            </button>

            <button
              onClick={() => {
                setViewMode('participants');
                setMenuOpen(false);
              }}
              className={`w-full px-6 py-4 flex items-center gap-4 transition-all duration-200 ${
                viewMode === 'participants'
                  ? 'bg-cyan-500/20 text-cyan-400 border-r-4 border-cyan-500'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <List className="w-5 h-5" />
              <span className="font-medium">{isRTL ? 'רשימת משתתפים' : 'Participants List'}</span>
            </button>

            <div className="my-4 border-t border-gray-800" />

            <button
              onClick={() => {
                router.push(`/${locale}/dashboard/calendar`);
              }}
              className="w-full px-6 py-4 flex items-center gap-4 text-gray-300 hover:bg-gray-800 hover:text-white transition-all duration-200"
            >
              <Home className="w-5 h-5" />
              <span className="font-medium">{isRTL ? 'חזרה לאתר' : 'Back to Site'}</span>
            </button>
          </div>

          {/* Footer - Powered by The Q */}
          <div className="p-6 border-t border-gray-800">
            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm" dir="ltr">
              <span>Powered by</span>
              <img src="/theQ.png" alt="The Q" className="w-5 h-5 object-contain" />
              <span className="font-semibold text-cyan-400">The Q</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Takes remaining space */}
      {viewMode === 'scanner' ? (
        /* Scanner View - Fill available space */
        <div className="flex-1 relative overflow-hidden flex flex-col bg-black min-h-0">
          {/* Camera Container - Centered square */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72">
              {/* Camera feed - exact square */}
              <div
                id="qr-reader"
                className={`w-full h-full rounded-2xl overflow-hidden ${scanState !== 'scanning' ? 'opacity-30' : ''}`}
              />
              {/* Scanning frame overlay - on top of camera */}
              {scanState === 'scanning' && cameraReady && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-full h-full border-4 border-white/30 rounded-2xl relative">
                    <div className="absolute -top-0.5 -left-0.5 w-10 h-10 border-t-4 border-l-4 border-green-500 rounded-tl-xl" />
                    <div className="absolute -top-0.5 -right-0.5 w-10 h-10 border-t-4 border-r-4 border-green-500 rounded-tr-xl" />
                    <div className="absolute -bottom-0.5 -left-0.5 w-10 h-10 border-b-4 border-l-4 border-green-500 rounded-bl-xl" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-10 h-10 border-b-4 border-r-4 border-green-500 rounded-br-xl" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Loading Overlay */}
          {scanState === 'loading' && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-16 h-16 text-white animate-spin mx-auto" />
                <p className="mt-4 text-white text-lg">
                  {isRTL ? 'טוען...' : 'Loading...'}
                </p>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {scanState === 'error' && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-red-500 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                <div className="w-20 h-20 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {isRTL ? 'שגיאה' : 'Error'}
                </h2>
                <p className="text-white/90 mb-6">{error}</p>
                <button
                  onClick={resetScanner}
                  className="w-full py-3 bg-white text-red-500 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  {isRTL ? 'סרוק שוב' : 'Scan Again'}
                </button>
              </div>
            </div>
          )}

          {/* Result Overlay */}
          {scanState === 'result' && scanResult && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
              <div
                className="rounded-3xl p-6 max-w-md w-full shadow-2xl"
                style={{ backgroundColor: scanResult.activity.backgroundColor }}
              >
                {/* Avatar */}
                <div className="text-center mb-4">
                  {scanResult.registration.avatarType === 'emoji' && scanResult.registration.avatarUrl && (
                    <div className="text-7xl mb-2">{scanResult.registration.avatarUrl}</div>
                  )}
                  {scanResult.registration.avatarType === 'photo' && scanResult.registration.avatarUrl && (
                    <div className="w-24 h-24 mx-auto mb-2 rounded-full overflow-hidden border-4 border-white/30">
                      <img
                        src={scanResult.registration.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {scanResult.registration.avatarType === 'none' && (
                    <div className="w-24 h-24 mx-auto mb-2 rounded-full bg-white/20 flex items-center justify-center">
                      <Users className="w-12 h-12 text-white" />
                    </div>
                  )}
                </div>

                {/* Name */}
                <h2 className="text-3xl font-bold text-white text-center mb-4">
                  {scanResult.registration.nickname}
                </h2>

                {/* Activity Details */}
                <div className="bg-white/10 rounded-2xl p-4 mb-4 space-y-2">
                  <div className="flex items-center gap-3 text-white">
                    <span className="text-lg font-semibold">{scanResult.activity.title}</span>
                  </div>
                  {scanResult.activity.time && (
                    <div className="flex items-center gap-3 text-white/80">
                      <Clock className="w-5 h-5" />
                      <span>{scanResult.activity.time}</span>
                    </div>
                  )}
                  {scanResult.activity.boothName && (
                    <div className="flex items-center gap-3 text-white/80">
                      <MapPin className="w-5 h-5" />
                      <span>{scanResult.activity.boothName}</span>
                    </div>
                  )}
                  {scanResult.registration.count > 1 && (
                    <div className="flex items-center gap-3 text-white/80">
                      <Users className="w-5 h-5" />
                      <span>
                        {isRTL
                          ? `${scanResult.registration.count} אנשים`
                          : `${scanResult.registration.count} people`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status & Actions */}
                {scanResult.registration.checkedIn ? (
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 bg-yellow-500 text-white px-6 py-3 rounded-xl font-bold mb-4">
                      <CheckCircle2 className="w-6 h-6" />
                      <span>
                        {isRTL
                          ? `נכנס ב-${formatCheckedInTime(scanResult.checkedInAt!)}`
                          : `Checked in at ${formatCheckedInTime(scanResult.checkedInAt!)}`}
                      </span>
                    </div>
                    <button
                      onClick={resetScanner}
                      className="w-full py-3 bg-white/20 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                    >
                      {isRTL ? 'סגור' : 'Close'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-center mb-2">
                      <span className="inline-flex items-center gap-2 bg-green-500/20 text-white px-4 py-2 rounded-full">
                        {isRTL ? 'טרם נכנס' : 'Not yet checked in'}
                      </span>
                    </div>
                    <button
                      onClick={handleApproveCheckin}
                      className="w-full py-4 bg-green-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg"
                    >
                      <CheckCircle2 className="w-6 h-6" />
                      {isRTL ? 'אישור כניסה' : 'Approve Check-in'}
                    </button>
                    <button
                      onClick={resetScanner}
                      className="w-full py-3 bg-white/20 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                    >
                      {isRTL ? 'ביטול' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Participants View - Modern Glass Design - Fill available space */
        <div className="flex-1 flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 min-h-0 overflow-hidden">
          {/* Search with Glow Effect - Fixed height */}
          <div className="p-4 pb-2 shrink-0">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRTL ? 'חיפוש לפי שם או טלפון...' : 'Search by name or phone...'}
                  className="w-full py-4 pr-12 pl-5 rounded-2xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:bg-slate-800/80 transition-all duration-300"
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              </div>
            </div>
          </div>

          {/* Stats Summary Bar - Fixed height */}
          {!loadingParticipants && filteredAndGroupedRegistrations.length > 0 && (
            <div className="px-4 py-3 shrink-0">
              <div className="flex items-center justify-center gap-4 bg-gradient-to-r from-slate-800/80 to-slate-800/40 backdrop-blur rounded-xl px-3 py-2.5 border border-slate-700/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-slate-400 text-sm">
                    {registrations.filter(r => r.checkedIn).length}
                    <span className="text-slate-500 mx-1">/</span>
                    {registrations.length}
                    <span className="text-slate-500 mr-1">{isRTL ? ' נכנסו' : ' in'}</span>
                  </span>
                </div>
                <div className="w-px h-4 bg-slate-700" />
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span className="text-slate-400 text-sm">
                    {registrations.reduce((sum, r) => sum + r.count, 0)}
                    <span className="text-slate-500 mr-1">{isRTL ? ' משתתפים' : ' people'}</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Participants List - Scrollable area */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 min-h-0">
            {loadingParticipants ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-cyan-500 animate-spin" />
                  <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-cyan-400/30 animate-spin" style={{ animationDuration: '1.5s' }} />
                </div>
                <p className="mt-4 text-slate-400">{isRTL ? 'טוען משתתפים...' : 'Loading participants...'}</p>
              </div>
            ) : filteredAndGroupedRegistrations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center mb-6 border border-slate-700/50">
                  <Users className="w-10 h-10 text-slate-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-300 mb-2">
                  {searchQuery
                    ? (isRTL ? 'לא נמצאו תוצאות' : 'No results found')
                    : (isRTL ? 'אין נרשמים עדיין' : 'No registrations yet')}
                </h3>
                <p className="text-slate-500 text-sm">
                  {searchQuery
                    ? (isRTL ? 'נסו חיפוש אחר' : 'Try a different search')
                    : (isRTL ? 'המשתתפים יופיעו כאן לאחר הרשמה' : 'Participants will appear here after registration')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAndGroupedRegistrations.map(([cellId, { activity, registrations: regs }], groupIndex) => {
                  const isExpanded = expandedSlots.has(cellId);
                  const checkedInCount = regs.filter(r => r.checkedIn).length;
                  const totalCount = regs.reduce((sum, r) => sum + r.count, 0);
                  const progress = regs.length > 0 ? (checkedInCount / regs.length) * 100 : 0;
                  const accentColor = activity?.backgroundColor || '#06b6d4';

                  return (
                    <div
                      key={cellId}
                      className="group rounded-2xl overflow-hidden transition-all duration-300"
                      style={{
                        background: `linear-gradient(135deg, ${accentColor}15 0%, transparent 50%)`,
                        animationDelay: `${groupIndex * 50}ms`,
                      }}
                    >
                      {/* Activity Card */}
                      <div
                        className="relative backdrop-blur-sm border border-slate-700/30 rounded-2xl overflow-hidden"
                        style={{ borderColor: `${accentColor}30` }}
                      >
                        {/* Accent Line */}
                        <div
                          className="absolute top-0 left-0 right-0 h-1"
                          style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}50, transparent)` }}
                        />

                        {/* Time Slot Header */}
                        <button
                          onClick={() => toggleSlot(cellId)}
                          className="w-full p-3 sm:p-4 flex items-center gap-2 sm:gap-3 text-right hover:bg-white/[0.02] transition-colors"
                        >
                          {/* Activity Icon - Smaller on mobile */}
                          <div
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`,
                              boxShadow: `0 4px 20px ${accentColor}20`
                            }}
                          >
                            <Clock className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: accentColor }} />
                          </div>

                          {/* Activity Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white text-base sm:text-lg mb-0.5 truncate">
                              {activity?.title || (isRTL ? 'פעילות' : 'Activity')}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-400 text-xs sm:text-sm">
                              {activity?.boothDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" style={{ color: accentColor }} />
                                  <span style={{ color: accentColor }}>{formatBoothDate(activity.boothDate)}</span>
                                </span>
                              )}
                              {activity?.startTime && activity?.endTime && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md"
                                  style={{ background: `${accentColor}15` }}
                                >
                                  <Clock className="w-3.5 h-3.5" style={{ color: accentColor }} />
                                  <span dir="ltr" style={{ color: accentColor }}>{activity.startTime} - {activity.endTime}</span>
                                </span>
                              )}
                              {activity?.boothName && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {activity.boothName}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Stats - Compact on mobile */}
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            {/* Progress Ring - Smaller on mobile */}
                            <div className="relative w-10 h-10 sm:w-12 sm:h-12">
                              <svg className="w-10 h-10 sm:w-12 sm:h-12 -rotate-90">
                                <circle
                                  cx="50%"
                                  cy="50%"
                                  r="40%"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  fill="none"
                                  className="text-slate-700/50"
                                />
                                <circle
                                  cx="50%"
                                  cy="50%"
                                  r="40%"
                                  stroke={accentColor}
                                  strokeWidth="3"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeDasharray={`${progress * 1.26} 126`}
                                  className="transition-all duration-500"
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-xs sm:text-sm font-bold text-white">{checkedInCount}/{regs.length}</span>
                              </div>
                            </div>

                            {/* People Count - Hidden on small mobile */}
                            <div className="hidden sm:block text-center px-2 py-1.5 rounded-lg bg-slate-800/50">
                              <div className="text-base font-bold" style={{ color: accentColor }}>
                                {totalCount}
                                {activity?.capacity && (
                                  <span className="text-slate-500 text-xs font-normal">/{activity.capacity}</span>
                                )}
                              </div>
                              <div className="text-[9px] text-slate-500 uppercase">
                                {isRTL ? 'אנשים' : 'people'}
                              </div>
                            </div>

                            {/* Expand Icon */}
                            <div
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${isExpanded ? 'bg-white/10 rotate-180' : 'bg-slate-800/50'}`}
                            >
                              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                            </div>
                          </div>
                        </button>

                        {/* Registrations List */}
                        {isExpanded && (
                          <div className="border-t border-slate-700/30 bg-slate-900/30">
                            {regs.map((reg, regIndex) => (
                              <div
                                key={reg.id}
                                className="p-3 sm:p-4 border-b border-slate-800/50 last:border-0 hover:bg-white/[0.02] transition-colors"
                                style={{ animationDelay: `${regIndex * 30}ms` }}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Avatar */}
                                  <div className="relative shrink-0">
                                    {reg.avatarType === 'emoji' && reg.avatarUrl ? (
                                      <div
                                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-xl sm:text-2xl"
                                        style={{ background: `${accentColor}15` }}
                                      >
                                        {reg.avatarUrl}
                                      </div>
                                    ) : reg.avatarType === 'photo' && reg.avatarUrl ? (
                                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl overflow-hidden ring-2 ring-slate-700">
                                        <img
                                          src={reg.avatarUrl}
                                          alt=""
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                                        <User className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                                      </div>
                                    )}
                                    {/* Check-in indicator */}
                                    {reg.checkedIn && (
                                      <div className="absolute -bottom-1 -left-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-slate-900">
                                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className={`font-semibold text-sm sm:text-base truncate ${searchQuery.trim() ? 'text-yellow-300' : 'text-white'}`}>
                                        {reg.nickname}
                                      </span>
                                      {reg.count > 1 && (
                                        <span
                                          className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium shrink-0"
                                          style={{ background: `${accentColor}20`, color: accentColor }}
                                        >
                                          +{reg.count - 1}
                                        </span>
                                      )}
                                    </div>
                                    {reg.phone && (
                                      <div className={`flex items-center gap-1 text-xs sm:text-sm ${searchQuery.trim() && reg.phone?.replace(/\D/g, '').includes(searchQuery.replace(/\D/g, '')) ? 'text-yellow-300' : 'text-slate-500'}`}>
                                        <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                        <span dir="ltr">{reg.phone}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Actions - Compact buttons + status */}
                                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                    {/* Edit Button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditReg(reg);
                                      }}
                                      className="p-1.5 sm:p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                                      title={isRTL ? 'עריכה' : 'Edit'}
                                    >
                                      <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingReg(reg);
                                      }}
                                      className="p-1.5 sm:p-2 rounded-lg bg-slate-800/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                      title={isRTL ? 'מחיקה' : 'Delete'}
                                    >
                                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    </button>

                                    {/* Status / Check-in */}
                                    {reg.checkedIn ? (
                                      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                                        <span className="text-emerald-400 text-xs sm:text-sm font-medium">
                                          {reg.checkedInAt
                                            ? formatCheckedInTime(reg.checkedInAt)
                                            : (isRTL ? 'נכנס' : 'In')}
                                        </span>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleManualCheckin(reg.qrToken, reg.id);
                                        }}
                                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"
                                        style={{
                                          background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                                          boxShadow: `0 4px 15px ${accentColor}40`
                                        }}
                                      >
                                        {isRTL ? 'כניסה' : 'Check in'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Instructions - Fixed height */}
      {viewMode === 'scanner' && scanState === 'scanning' && (
        <div className="bg-gray-800 p-4 text-center shrink-0">
          <p className="text-white/70">
            {isRTL
              ? 'הציגו את קוד הכניסה שלכם למצלמה'
              : 'Show your entry QR code to the camera'}
          </p>
        </div>
      )}

      {/* Edit Modal */}
      {editingReg && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl w-full max-w-md p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-6">
              {isRTL ? 'עריכת משתתף' : 'Edit Participant'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  {isRTL ? 'שם' : 'Name'}
                </label>
                <input
                  type="text"
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none"
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  {isRTL ? 'מספר אנשים' : 'Number of people'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={editCount}
                  onChange={(e) => setEditCount(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingReg(null)}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                disabled={isUpdating}
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isUpdating}
                className="flex-1 px-4 py-3 rounded-xl bg-cyan-500 text-white font-semibold hover:bg-cyan-600 transition-colors disabled:opacity-50"
              >
                {isUpdating ? (isRTL ? 'שומר...' : 'Saving...') : (isRTL ? 'שמירה' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingReg && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl w-full max-w-md p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">
              {isRTL ? 'מחיקת משתתף' : 'Delete Participant'}
            </h3>
            <p className="text-slate-400 mb-6">
              {isRTL
                ? `האם למחוק את ${deletingReg.nickname} מהרשימה?`
                : `Are you sure you want to delete ${deletingReg.nickname}?`}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeletingReg(null)}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                disabled={isUpdating}
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={handleDeleteReg}
                disabled={isUpdating}
                className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isUpdating ? (isRTL ? 'מוחק...' : 'Deleting...') : (isRTL ? 'מחיקה' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
