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
  ArrowLeft,
  Search,
  List,
  User,
  Phone,
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  Link2,
  Pencil,
  Trash2,
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
  const [linkCopied, setLinkCopied] = useState(false);
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
          (errorMessage) => {
            if (!errorMessage.includes('No QR code found')) {
              console.log('[Scanner] Scan error:', errorMessage);
            }
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
      {/* CSS to constrain scanner video */}
      <style jsx global>{`
        #qr-reader video {
          max-height: calc(100vh - 220px) !important;
          width: 100% !important;
          object-fit: cover !important;
          border-radius: 12px;
        }
        #qr-reader {
          border: none !important;
        }
        #qr-reader__scan_region {
          min-height: unset !important;
        }
        #qr-reader__dashboard {
          display: none !important;
        }
      `}</style>
      <div
        className="min-h-screen bg-gray-900 flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg text-white hover:bg-gray-700"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-white truncate max-w-[200px]">
          {eventTitle || (isRTL ? 'סורק כניסה' : 'Check-in Scanner')}
        </h1>
        <button
          onClick={() => {
            const url = `${window.location.origin}/${locale}/dashboard/calendar/${codeId}/checkin`;
            navigator.clipboard.writeText(url);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
          }}
          className="p-2 rounded-lg text-white hover:bg-gray-700 relative"
          title={isRTL ? 'העתק לינק' : 'Copy Link'}
        >
          <Link2 className="w-6 h-6" />
          {linkCopied && (
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              {isRTL ? 'הועתק!' : 'Copied!'}
            </span>
          )}
        </button>
      </div>

      {/* View Mode Tabs */}
      <div className="bg-gray-800 px-4 pb-4 flex gap-2">
        <button
          onClick={() => setViewMode('scanner')}
          className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
            viewMode === 'scanner'
              ? 'bg-green-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <Camera className="w-5 h-5" />
          {isRTL ? 'סורק' : 'Scanner'}
        </button>
        <button
          onClick={() => setViewMode('participants')}
          className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
            viewMode === 'participants'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <List className="w-5 h-5" />
          {isRTL ? 'משתתפים' : 'Participants'}
        </button>
      </div>

      {/* Main Content */}
      {viewMode === 'scanner' ? (
        /* Scanner View */
        <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
          <div
            id="qr-reader"
            className={`w-full max-w-lg mx-auto ${scanState !== 'scanning' ? 'opacity-30' : ''}`}
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          />

          {/* Scanning Overlay */}
          {scanState === 'scanning' && cameraReady && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-4 border-white/50 rounded-2xl relative">
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-lg" />
              </div>
            </div>
          )}

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
        /* Participants View - Modern Glass Design */
        <div className="flex-1 flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
          {/* Search with Glow Effect */}
          <div className="p-4 pb-2">
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

          {/* Stats Summary Bar */}
          {!loadingParticipants && filteredAndGroupedRegistrations.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between bg-gradient-to-r from-slate-800/80 to-slate-800/40 backdrop-blur rounded-xl px-4 py-3 border border-slate-700/30">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-slate-400 text-sm">
                      {registrations.filter(r => r.checkedIn).length}
                      <span className="text-slate-500 mx-1">/</span>
                      {registrations.length}
                      <span className="text-slate-500 mr-2">{isRTL ? ' נכנסו' : ' checked in'}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span className="text-slate-400 text-sm">
                      {registrations.reduce((sum, r) => sum + r.count, 0)}
                      <span className="text-slate-500 mr-2">{isRTL ? ' משתתפים' : ' people'}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Participants List */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
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
                          className="w-full p-5 flex items-center gap-4 text-right hover:bg-white/[0.02] transition-colors"
                        >
                          {/* Activity Icon */}
                          <div
                            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`,
                              boxShadow: `0 4px 20px ${accentColor}20`
                            }}
                          >
                            <Clock className="w-6 h-6" style={{ color: accentColor }} />
                          </div>

                          {/* Activity Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white text-lg mb-1 truncate">
                              {activity?.title || (isRTL ? 'פעילות' : 'Activity')}
                            </h3>
                            <div className="flex flex-wrap items-center gap-3 text-slate-400 text-sm">
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

                          {/* Stats */}
                          <div className="flex items-center gap-4 shrink-0">
                            {/* Progress Ring - Shows checked-in count */}
                            <div className="relative w-14 h-14">
                              <svg className="w-14 h-14 -rotate-90">
                                <circle
                                  cx="28"
                                  cy="28"
                                  r="24"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                  className="text-slate-700/50"
                                />
                                <circle
                                  cx="28"
                                  cy="28"
                                  r="24"
                                  stroke={accentColor}
                                  strokeWidth="4"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeDasharray={`${progress * 1.508} 150.8`}
                                  className="transition-all duration-500"
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-sm font-bold text-white">{checkedInCount}</span>
                                <span className="text-[10px] text-slate-500">/{regs.length}</span>
                              </div>
                            </div>

                            {/* People Count with Capacity */}
                            <div className="text-center px-3 py-2 rounded-xl bg-slate-800/50">
                              <div className="text-lg font-bold" style={{ color: accentColor }}>
                                {totalCount}
                                {activity?.capacity && (
                                  <span className="text-slate-500 text-sm font-normal">/{activity.capacity}</span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                                {isRTL ? 'אנשים' : 'people'}
                              </div>
                            </div>

                            {/* Expand Icon */}
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${isExpanded ? 'bg-white/10 rotate-180' : 'bg-slate-800/50'}`}
                            >
                              <ChevronDown className="w-5 h-5 text-slate-400" />
                            </div>
                          </div>
                        </button>

                        {/* Registrations List */}
                        {isExpanded && (
                          <div className="border-t border-slate-700/30 bg-slate-900/30">
                            {regs.map((reg, regIndex) => (
                              <div
                                key={reg.id}
                                className="p-4 flex items-center gap-4 border-b border-slate-800/50 last:border-0 hover:bg-white/[0.02] transition-colors"
                                style={{ animationDelay: `${regIndex * 30}ms` }}
                              >
                                {/* Avatar */}
                                <div className="relative">
                                  {reg.avatarType === 'emoji' && reg.avatarUrl ? (
                                    <div
                                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                      style={{ background: `${accentColor}15` }}
                                    >
                                      {reg.avatarUrl}
                                    </div>
                                  ) : reg.avatarType === 'photo' && reg.avatarUrl ? (
                                    <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-slate-700">
                                      <img
                                        src={reg.avatarUrl}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                                      <User className="w-5 h-5 text-slate-500" />
                                    </div>
                                  )}
                                  {/* Check-in indicator */}
                                  {reg.checkedIn && (
                                    <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-slate-900">
                                      <Check className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-semibold text-white truncate">{reg.nickname}</span>
                                    {reg.count > 1 && (
                                      <span
                                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                                        style={{ background: `${accentColor}20`, color: accentColor }}
                                      >
                                        +{reg.count - 1}
                                      </span>
                                    )}
                                  </div>
                                  {reg.phone && (
                                    <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                                      <Phone className="w-3.5 h-3.5" />
                                      <span dir="ltr">{reg.phone}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                  {/* Edit Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditReg(reg);
                                    }}
                                    className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                                    title={isRTL ? 'עריכה' : 'Edit'}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>

                                  {/* Delete Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingReg(reg);
                                    }}
                                    className="p-2 rounded-lg bg-slate-800/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                    title={isRTL ? 'מחיקה' : 'Delete'}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>

                                  {/* Status / Check-in */}
                                  {reg.checkedIn ? (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                      <Check className="w-4 h-4 text-emerald-500" />
                                      <span className="text-emerald-400 text-sm font-medium">
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
                                      className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"
                                      style={{
                                        background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                                        boxShadow: `0 4px 15px ${accentColor}40`
                                      }}
                                    >
                                      {isRTL ? 'אישור כניסה' : 'Check in'}
                                    </button>
                                  )}
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

      {/* Footer Instructions */}
      {viewMode === 'scanner' && scanState === 'scanning' && (
        <div className="bg-gray-800 p-4 text-center">
          <p className="text-white/70">
            {isRTL
              ? 'כוונו את המצלמה לקוד ה-QR של המשתתף'
              : 'Point the camera at the participant\'s QR code'}
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
