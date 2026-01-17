'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCards } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  ExternalLink,
  Play,
  Clock,
  AlertCircle,
  ThumbsUp,
  Home,
  Info,
  Phone,
  User,
  Users,
  Loader2,
  CheckCircle2,
  RefreshCw,
  QrCode,
  Camera,
} from 'lucide-react';
import {
  WeeklyCalendarConfig,
  CalendarCell,
  CalendarAttraction,
  DayOfWeek,
  Booth,
  BoothCell,
  BoothDayData,
  DAY_NAMES,
  DAY_NAMES_SHORT,
  PRESET_AVATARS,
  getTodayDayIndex,
  getWeekStartDate,
  isCurrentWeek,
  isPastDay,
  isToday,
  getDayDate,
  getCellsForDay,
  getCurrentTimePosition,
  getContrastTextColor,
  timeToMinutes,
  getTodayDateString,
  getActiveBooths,
  getCellsForBooth,
  formatBoothDate,
  getDayNameFromDate,
  isBoothSlotPast,
} from '@/types/weeklycal';

// Check if a time slot has already passed today
function isSlotPast(slotStartTime: string, slotEndTime: string, isTodayDay: boolean, isPastDayFlag: boolean): boolean {
  // If it's a past day, all slots are past
  if (isPastDayFlag) return true;
  // If it's not today, slots are not past (future day)
  if (!isTodayDay) return false;

  // For today, compare current time with slot START time
  // A slot is past only if current time is AFTER the slot STARTED
  // This means: if current time >= slot start time, the slot is considered "in progress or past"
  // But we want to mark as past only slots that have ENDED
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const slotEndMinutes = timeToMinutes(slotEndTime);

  // Slot is past only if current time is AFTER the slot ended
  return currentMinutes > slotEndMinutes;
}

import 'swiper/css';
import 'swiper/css/effect-cards';

interface WeeklyCalendarViewerProps {
  config: WeeklyCalendarConfig;
  codeId?: string;
  shortId?: string;
  ownerId?: string;
}

// Helper to get browser locale
function getBrowserLocale(): 'he' | 'en' {
  if (typeof window === 'undefined') return 'he';
  const lang = navigator.language || 'he';
  return lang.startsWith('he') ? 'he' : 'en';
}

// Extract YouTube ID
function extractYoutubeId(url: string): string | null {
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
}

export default function WeeklyCalendarViewer({
  config,
  codeId,
  shortId,
  ownerId,
}: WeeklyCalendarViewerProps) {
  const locale = getBrowserLocale();
  const isRTL = locale === 'he';

  // State
  const [showLanding, setShowLanding] = useState(true);
  const [currentDayIndex, setCurrentDayIndex] = useState(getTodayDayIndex());
  const [showPastWarning, setShowPastWarning] = useState(false);
  const [pendingDayIndex, setPendingDayIndex] = useState<number | null>(null);
  const [hasConfirmedPastViewing, setHasConfirmedPastViewing] = useState(false); // Track if user confirmed viewing past
  const [showAttractions, setShowAttractions] = useState(false);
  const [selectedAttraction, setSelectedAttraction] = useState<CalendarAttraction | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // RSVP State
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, number>>({});
  const [userRegistrations, setUserRegistrations] = useState<string[]>([]);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);

  // Booth Registration Modal State
  const [boothRegModal, setBoothRegModal] = useState<{
    isOpen: boolean;
    cell: BoothCell | null;
    slot: { startTime: string; endTime: string } | null;
  }>({ isOpen: false, cell: null, slot: null });
  const [boothRegName, setBoothRegName] = useState('');
  const [boothRegPhone, setBoothRegPhone] = useState('');
  const [boothRegCount, setBoothRegCount] = useState(1);
  const [boothRegSubmitting, setBoothRegSubmitting] = useState(false);

  // Enhanced Registration State (with verification)
  type ModalState = 'form' | 'verifying' | 'otp_input' | 'success' | 'error';
  const [boothRegModalState, setBoothRegModalState] = useState<ModalState>('form');
  const [boothRegAvatar, setBoothRegAvatar] = useState<string>('');
  const [boothRegAvatarType, setBoothRegAvatarType] = useState<'emoji' | 'photo' | 'none'>('none');
  const [boothRegAvatarLoading, setBoothRegAvatarLoading] = useState(false);
  const [boothRegOtp, setBoothRegOtp] = useState(['', '', '', '']);
  const [boothRegOtpError, setBoothRegOtpError] = useState<string | null>(null);
  const [boothRegRegistrationId, setBoothRegRegistrationId] = useState<string | null>(null);
  const [boothRegQrToken, setBoothRegQrToken] = useState<string | null>(null);
  const [boothRegResendCooldown, setBoothRegResendCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Remember today's index for past day checking
  const todayIndex = useMemo(() => getTodayDayIndex(), []);

  const swiperRef = useRef<SwiperType | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const currentActivityRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledToCurrentRef = useRef(false);

  // Check if booth mode
  const isBoothMode = config.mode === 'booths';

  // Get current week data (weekly mode)
  const currentWeekStart = getWeekStartDate(new Date());
  const currentWeek = useMemo(() => {
    if (isBoothMode) return null;
    return config.weeks.find((w) => isCurrentWeek(w.weekStartDate)) || config.weeks[0];
  }, [config.weeks, isBoothMode]);

  // Get current booth day data (booth mode)
  const todayDateString = getTodayDateString();
  const currentBoothDay = useMemo(() => {
    if (!isBoothMode) return null;
    return (config.boothDays || []).find((bd) => bd.date === todayDateString) || (config.boothDays || [])[0];
  }, [config.boothDays, isBoothMode, todayDateString]);

  // Get active booths for booth mode
  const activeBooths = useMemo(() => {
    if (!isBoothMode || !currentBoothDay) return [];
    const booths = currentBoothDay.booths.length > 0 ? currentBoothDay.booths : (config.defaultBooths || []);
    return getActiveBooths(booths);
  }, [isBoothMode, currentBoothDay, config.defaultBooths]);

  // Current booth index for swipe navigation (booth mode)
  const [currentBoothIndex, setCurrentBoothIndex] = useState(0);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Find the current slot index (the one we're in or the next upcoming)
  // Also determines which past activities to show (max 1)
  // And calculates the fraction within the current slot for precise indicator positioning
  const currentSlotInfo = useMemo(() => {
    if (!currentWeek) return { currentSlotIndex: -1, firstVisiblePastSlotIndex: -1, fractionWithinSlot: 0, isWithinSlot: false };

    const slots = currentWeek.timeSlots;
    if (!slots || slots.length === 0) return { currentSlotIndex: -1, firstVisiblePastSlotIndex: -1, fractionWithinSlot: 0, isWithinSlot: false };

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let currentSlotIndex = -1; // The slot we're in or next upcoming
    let lastPastSlotIndex = -1; // The last slot that has completely passed
    let fractionWithinSlot = 0; // How far through the current slot (0-1)
    let isWithinSlot = false; // True if we're actually inside a slot (not before/between/after)

    for (let i = 0; i < slots.length; i++) {
      const startMins = timeToMinutes(slots[i].startTime);
      const endMins = timeToMinutes(slots[i].endTime);

      if (currentMinutes < startMins) {
        // Current time is before this slot starts - this is the next upcoming
        currentSlotIndex = i;
        isWithinSlot = false;
        fractionWithinSlot = 0; // Show indicator at top of the card
        break;
      } else if (currentMinutes >= startMins && currentMinutes <= endMins) {
        // We're currently IN this slot
        currentSlotIndex = i;
        isWithinSlot = true;
        // Calculate fraction within this slot (0 = start, 1 = end)
        fractionWithinSlot = (currentMinutes - startMins) / (endMins - startMins);
        break;
      } else {
        // We've passed this slot entirely
        lastPastSlotIndex = i;
      }
    }

    // If we didn't find a current/upcoming slot, all slots are past
    if (currentSlotIndex === -1 && lastPastSlotIndex >= 0) {
      currentSlotIndex = lastPastSlotIndex;
      isWithinSlot = false;
      fractionWithinSlot = 1; // Show indicator at bottom
    }

    // Show only 1 past activity: the one just before the current
    // firstVisiblePastSlotIndex is the earliest past slot we'll show
    // (which means we hide anything before it)
    const firstVisiblePastSlotIndex = lastPastSlotIndex >= 0 ? lastPastSlotIndex : -1;

    return { currentSlotIndex, firstVisiblePastSlotIndex, lastPastSlotIndex, fractionWithinSlot, isWithinSlot };
  }, [currentWeek, currentTime]);

  // Auto-scroll to current activity when landing is dismissed
  useEffect(() => {
    if (!showLanding && !hasScrolledToCurrentRef.current && currentActivityRef.current && scrollContainerRef.current) {
      // Small delay to ensure DOM is ready, then fast scroll to current activity
      setTimeout(() => {
        if (currentActivityRef.current) {
          // Use smooth scroll for a quick animated effect
          currentActivityRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          hasScrolledToCurrentRef.current = true;
        }
      }, 150);
    }
  }, [showLanding]);

  // Auto-scroll when returning to today
  useEffect(() => {
    if (currentDayIndex === todayIndex && !showLanding && currentActivityRef.current) {
      // Small delay then scroll to current activity
      setTimeout(() => {
        currentActivityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [currentDayIndex, todayIndex, showLanding]);

  // Auto-scroll to current activity in booth mode
  useEffect(() => {
    if (isBoothMode && !showLanding && !hasScrolledToCurrentRef.current) {
      // Small delay to ensure DOM is ready, then scroll to current activity
      const timer = setTimeout(() => {
        if (currentActivityRef.current && scrollContainerRef.current) {
          currentActivityRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          hasScrolledToCurrentRef.current = true;
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isBoothMode, showLanding, currentBoothDay]);

  // OTP Resend Cooldown Timer
  useEffect(() => {
    if (boothRegResendCooldown > 0) {
      const timer = setTimeout(() => {
        setBoothRegResendCooldown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [boothRegResendCooldown]);

  // Get or create visitor ID
  const getVisitorId = (): string => {
    if (typeof window === 'undefined') return '';
    let visitorId = localStorage.getItem('visitorId');
    if (!visitorId) {
      visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('visitorId', visitorId);
    }
    return visitorId;
  };

  // Fetch RSVP registrations
  useEffect(() => {
    if (!codeId || !currentWeek || !config.enableRSVP) return;

    const fetchRegistrations = async () => {
      try {
        const visitorId = getVisitorId();
        const response = await fetch(
          `/api/weeklycal/register?codeId=${codeId}&weekStartDate=${currentWeek.weekStartDate}&visitorId=${visitorId}`
        );
        if (response.ok) {
          const data = await response.json();
          setRegistrationCounts(data.countsByCell || {});
          setUserRegistrations(data.userRegistrations || []);
          setUserCounts(data.userCounts || {});
        }
      } catch (error) {
        console.error('Failed to fetch registrations:', error);
      }
    };

    fetchRegistrations();
  }, [codeId, currentWeek, config.enableRSVP]);

  // Handle RSVP with count
  const handleRSVP = async (cellId: string, count: number, action: 'register' | 'unregister') => {
    if (!codeId || !currentWeek || rsvpLoading) return;

    setRsvpLoading(cellId);
    const visitorId = getVisitorId();

    try {
      const response = await fetch('/api/weeklycal/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          cellId,
          weekStartDate: currentWeek.weekStartDate,
          visitorId,
          action,
          count,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update counts
        setRegistrationCounts(prev => ({
          ...prev,
          [cellId]: data.registrationCount,
        }));
        // Update user registrations
        if (data.isRegistered) {
          setUserRegistrations(prev => [...prev, cellId]);
          setUserCounts(prev => ({ ...prev, [cellId]: count }));
        } else {
          setUserRegistrations(prev => prev.filter(id => id !== cellId));
          setUserCounts(prev => {
            const updated = { ...prev };
            delete updated[cellId];
            return updated;
          });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('RSVP API error:', response.status, errorData);
      }
    } catch (error) {
      console.error('RSVP network error:', error);
    } finally {
      setRsvpLoading(null);
    }
  };

  // Handle day change via swipe
  const handleSlideChange = (swiper: SwiperType) => {
    const newIndex = swiper.activeIndex;

    // Check if going to past day (only show warning once, and only when going backwards from today)
    if (
      config.showPastDayWarning &&
      !hasConfirmedPastViewing &&
      currentWeek &&
      isPastDay(currentWeek.weekStartDate, newIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6) &&
      newIndex < todayIndex
    ) {
      setShowPastWarning(true);
      setPendingDayIndex(newIndex);
      // Revert swipe
      swiper.slideTo(currentDayIndex);
    } else {
      setCurrentDayIndex(newIndex as DayOfWeek);
    }
  };

  // Confirm viewing past day
  const confirmPastDay = () => {
    if (pendingDayIndex !== null) {
      setCurrentDayIndex(pendingDayIndex as DayOfWeek);
      swiperRef.current?.slideTo(pendingDayIndex);
    }
    setShowPastWarning(false);
    setPendingDayIndex(null);
    setHasConfirmedPastViewing(true); // Don't show warning again
  };

  // Cancel viewing past day
  const cancelPastDay = () => {
    setShowPastWarning(false);
    setPendingDayIndex(null);
  };

  // Get cells for current day
  const dayCells = useMemo(() => {
    if (!currentWeek) return [];
    return getCellsForDay(currentWeek.cells, currentDayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6);
  }, [currentWeek, currentDayIndex]);

  // Active attractions
  const activeAttractions = useMemo(() => {
    return config.attractions.filter((a) => a.isActive);
  }, [config.attractions]);

  // Get current booth for booth mode (moved before boothTimeSlots to use booth's own time slots)
  const currentBooth = useMemo(() => {
    if (!isBoothMode || activeBooths.length === 0) return null;
    return activeBooths[currentBoothIndex] || null;
  }, [isBoothMode, activeBooths, currentBoothIndex]);

  // Get time slots for booth mode - prioritize booth's own time slots
  const boothTimeSlots = useMemo(() => {
    if (!isBoothMode) return [];
    // First priority: booth's own time slots (each booth can have its own schedule)
    if (currentBooth?.timeSlots && currentBooth.timeSlots.length > 0) {
      return currentBooth.timeSlots;
    }
    // Second priority: day's time slots
    if (currentBoothDay?.timeSlots && currentBoothDay.timeSlots.length > 0) {
      return currentBoothDay.timeSlots;
    }
    // Fallback: default time slots
    return config.defaultTimeSlots;
  }, [isBoothMode, currentBooth, currentBoothDay, config.defaultTimeSlots]);

  // Get cells for current booth (moved before early returns to maintain hook order)
  const boothCells = useMemo(() => {
    if (!isBoothMode || !currentBooth || !currentBoothDay) return [];
    return getCellsForBooth(currentBoothDay.cells, currentBooth.id);
  }, [isBoothMode, currentBooth, currentBoothDay]);

  // Check if all booth activities have passed for the day
  const allBoothActivitiesPast = useMemo(() => {
    if (!isBoothMode || !currentBoothDay || boothTimeSlots.length === 0) return false;
    // Check if every slot has passed
    return boothTimeSlots.every(slot => isBoothSlotPast(currentBoothDay.date, slot.endTime));
  }, [isBoothMode, currentBoothDay, boothTimeSlots]);

  // Fetch booth registrations (booth mode) - must be after currentBooth useMemo
  useEffect(() => {
    if (!codeId || !isBoothMode || !currentBoothDay || !currentBooth) return;

    const fetchBoothRegistrations = async () => {
      try {
        const visitorId = getVisitorId();
        const response = await fetch(
          `/api/weeklycal/register?codeId=${codeId}&boothDate=${currentBoothDay.date}&boothId=${currentBooth.id}&visitorId=${visitorId}`
        );
        if (response.ok) {
          const data = await response.json();
          setRegistrationCounts(data.countsByCell || {});
          setUserRegistrations(data.userRegistrations || []);
          setUserCounts(data.userCounts || {});
        }
      } catch (error) {
        console.error('Failed to fetch booth registrations:', error);
      }
    };

    fetchBoothRegistrations();
  }, [codeId, isBoothMode, currentBoothDay, currentBooth]);

  // Render Landing Screen
  if (showLanding) {
    const landing = config.branding.landing;
    const hasTextContent = landing.title || landing.subtitle || landing.enterButtonText;

    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ backgroundColor: landing.backgroundColor }}
        onClick={() => setShowLanding(false)}
      >
        {/* Splash Image */}
        {landing.splashImageUrl && (
          <div className="absolute inset-0">
            <img
              src={landing.splashImageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Dark overlay for text readability */}
            {(landing.imageOverlayOpacity ?? 30) > 0 && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: `rgba(0, 0, 0, ${(landing.imageOverlayOpacity ?? 30) / 100})`,
                }}
              />
            )}
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 text-center px-6 py-12">
          {/* Logo */}
          {landing.logoUrl && (
            <img
              src={landing.logoUrl}
              alt=""
              className="w-32 h-32 mx-auto mb-6 object-contain"
            />
          )}

          {/* Title */}
          {landing.title && (
            <h1
              className="text-3xl font-bold mb-2"
              style={{ color: landing.textColor }}
            >
              {landing.title}
            </h1>
          )}

          {/* Subtitle */}
          {landing.subtitle && (
            <p
              className="text-lg opacity-80 mb-8"
              style={{ color: landing.textColor }}
            >
              {landing.subtitle}
            </p>
          )}

          {/* Enter Button and hint - only show if there's text content */}
          {hasTextContent && (
            <>
              <button
                onClick={() => setShowLanding(false)}
                className="px-8 py-3 rounded-xl font-medium text-lg transition-all duration-300 hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: landing.buttonColor || '#3b82f6',
                  color: landing.textColor,
                }}
              >
                {landing.enterButtonText || (isRTL ? 'כניסה ללוח' : 'View Schedule')}
              </button>

              {/* Swipe hint */}
              <p
                className="mt-6 text-sm opacity-60 animate-pulse"
                style={{ color: landing.textColor }}
              >
                {isRTL ? 'לחצו או החליקו להמשך' : 'Tap or swipe to continue'}
              </p>
            </>
          )}
        </div>

        {/* FAB Buttons on Landing Page */}
        <div className="fixed bottom-6 end-6 z-30 flex flex-col gap-3">
          {/* Info FAB */}
          {config.notes?.enabled && config.notes?.content && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNotes(true);
              }}
              className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
              style={{
                backgroundColor: config.notes?.fabButtonColor || '#3b82f6',
              }}
            >
              <Info
                className="w-6 h-6"
                style={{ color: config.notes?.fabIconColor || '#ffffff' }}
              />
            </button>
          )}

        </div>
      </div>
    );
  }

  // No data for current mode
  if (isBoothMode && (!currentBoothDay || activeBooths.length === 0)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-bg-primary">
        <div className="text-center px-6">
          <Clock className="w-16 h-16 mx-auto mb-4 text-text-secondary opacity-50" />
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            {isRTL ? 'אין דוכנים פעילים' : 'No Active Booths'}
          </h2>
          <p className="text-text-secondary">
            {isRTL ? 'טרם הוגדרו דוכנים להיום' : 'No booths have been set up for today'}
          </p>
        </div>
      </div>
    );
  }

  // No week data (weekly mode)
  if (!isBoothMode && !currentWeek) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-bg-primary">
        <div className="text-center px-6">
          <Clock className="w-16 h-16 mx-auto mb-4 text-text-secondary opacity-50" />
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            {isRTL ? 'אין לוח זמנים' : 'No Schedule'}
          </h2>
          <p className="text-text-secondary">
            {isRTL ? 'טרם הוגדר לוח זמנים לשבוע זה' : 'No schedule has been set for this week'}
          </p>
        </div>
      </div>
    );
  }

  // Determine day background image URL (landing image or separate)
  const dayBgImageUrl = config.branding.useLandingImageForDays
    ? config.branding.landing.splashImageUrl
    : config.branding.dayBackgroundImageUrl;

  // ========== BOOTH MODE VIEWER ==========
  if (isBoothMode && currentBoothDay && activeBooths.length > 0) {
    return (
      <div
        className="fixed inset-0 flex flex-col"
        style={{
          backgroundColor: config.branding.dayBackgroundColor,
        }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Background Image Layer */}
        {dayBgImageUrl && (
          <div
            className={`fixed inset-0 pointer-events-none ${
              config.branding.dayBackgroundBlur ? 'blur-sm scale-105' : ''
            }`}
            style={{
              backgroundImage: `url(${dayBgImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
            }}
          />
        )}
        {dayBgImageUrl && (
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              backgroundColor: config.branding.dayBackgroundBlur
                ? `${config.branding.dayBackgroundColor}50`
                : `${config.branding.dayBackgroundColor}80`,
              backdropFilter: config.branding.dayBackgroundBlur ? 'blur(4px)' : undefined,
            }}
          />
        )}

        {/* Header */}
        <div
          className="sticky top-0 z-20 px-4 py-3 shadow-md"
          style={{
            backgroundColor: config.branding.headerBackgroundColor,
            color: config.branding.headerTextColor,
          }}
        >
          <div className="flex items-center justify-between">
            {/* Booth Navigation */}
            <button
              onClick={() => setCurrentBoothIndex(Math.max(0, currentBoothIndex - 1))}
              disabled={currentBoothIndex === 0}
              className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Current Booth Name & Date */}
            <div className="text-center">
              <div className="text-lg font-semibold">{currentBooth?.name}</div>
              <div className="text-sm opacity-70">
                {isRTL ? `יום ${getDayNameFromDate(currentBoothDay.date, locale)}` : getDayNameFromDate(currentBoothDay.date, locale)}
              </div>
              <div className="text-xs opacity-50">
                {formatBoothDate(currentBoothDay.date, locale)}
              </div>
            </div>

            <button
              onClick={() => setCurrentBoothIndex(Math.min(activeBooths.length - 1, currentBoothIndex + 1))}
              disabled={currentBoothIndex === activeBooths.length - 1}
              className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Booth Pills */}
          {activeBooths.length > 1 && (
            <div className="flex justify-center gap-2 mt-3 overflow-x-auto py-1">
              {activeBooths.map((booth, index) => (
                <button
                  key={booth.id}
                  onClick={() => setCurrentBoothIndex(index)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    index === currentBoothIndex
                      ? 'bg-white/20 scale-105'
                      : 'bg-white/5 opacity-70 hover:opacity-100'
                  }`}
                >
                  {booth.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Booth Content - Activities List */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative z-10 p-4">
          {/* Current Time Indicator - always show when it's today */}
          {(() => {
            const now = new Date();
            const isTodayBoothDay = currentBoothDay.date === todayDateString;
            if (!isTodayBoothDay) return null;

            const firstSlot = boothTimeSlots[0];
            const lastSlot = boothTimeSlots[boothTimeSlots.length - 1];
            if (!firstSlot || !lastSlot) return null;

            return (
              <div className="max-w-lg mx-auto mb-2">
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: config.branding.currentTimeIndicatorColor || '#ef4444' }}>
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: config.branding.currentTimeIndicatorColor || '#ef4444' }} />
                  <span>
                    {now.toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                  <div className="flex-1 h-0.5" style={{ backgroundColor: config.branding.currentTimeIndicatorColor || '#ef4444' }} />
                </div>
              </div>
            );
          })()}

          {/* Message when all activities have ended */}
          {allBoothActivitiesPast && (
            <div className="max-w-lg mx-auto mb-4 p-4 rounded-xl bg-white/10 text-center" ref={currentActivityRef}>
              <div className="text-lg font-semibold" style={{ color: config.branding.dayTextColor }}>
                {isRTL ? '🎉 הפעילויות להיום הסתיימו' : '🎉 Activities for today have ended'}
              </div>
              <p className="text-sm opacity-70 mt-1" style={{ color: config.branding.dayTextColor }}>
                {isRTL ? 'להלן הפעילויות שהתקיימו היום' : 'Here are the activities that took place today'}
              </p>
            </div>
          )}

          <div className="space-y-3 max-w-lg mx-auto">
            {(() => {
              let foundFirstNonPast = false;

              return boothTimeSlots.map((slot, slotIndex) => {
                const cell = boothCells.find(c => c.startSlotIndex === slotIndex);
                const isPast = isBoothSlotPast(currentBoothDay.date, slot.endTime);
                const currentCount = cell ? (registrationCounts[cell.id] || 0) : 0;
                const capacity = cell?.capacity || 0;
                const availableSlots = capacity > 0 ? Math.max(0, capacity - currentCount) : null;
                const isFull = capacity > 0 && currentCount >= capacity;
                const isUserRegistered = cell ? userRegistrations.includes(cell.id) : false;

                // Skip empty slots that are past
                if (!cell && isPast) return null;

                // Track first non-past slot for auto-scroll
                // Note: when all activities are past, the message above gets the ref
                const isFirstNonPast = !isPast && !foundFirstNonPast;
                if (isFirstNonPast) foundFirstNonPast = true;
                const shouldHaveRef = isFirstNonPast;

                return (
                  <div
                    key={slot.id}
                    ref={shouldHaveRef ? currentActivityRef : null}
                    className={`rounded-xl overflow-hidden transition-all ${
                      isPast ? 'opacity-50 grayscale' : ''
                    } ${!isPast && cell && !cell.isBreak ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}
                    style={{
                      backgroundColor: isPast
                        ? 'rgba(128,128,128,0.3)'
                        : cell?.backgroundColor || 'rgba(255,255,255,0.1)',
                    }}
                    onClick={() => {
                      if (!isPast && cell && !cell.isBreak && !isFull) {
                        setBoothRegModal({ isOpen: true, cell, slot: { startTime: slot.startTime, endTime: slot.endTime } });
                        // Pre-fill with saved name if exists
                        const savedName = localStorage.getItem('boothRegName') || '';
                        const savedPhone = localStorage.getItem('boothRegPhone') || '';
                        setBoothRegName(savedName);
                        setBoothRegPhone(savedPhone);
                        setBoothRegCount(isUserRegistered ? (userCounts[cell.id] || 1) : 1);
                      }
                    }}
                  >
                  {/* Time Header */}
                  <div
                    className="px-4 py-2 flex items-center gap-2 text-sm"
                    style={{
                      color: isPast ? '#9ca3af' : (cell ? getContrastTextColor(cell.backgroundColor) : config.branding.dayTextColor),
                      opacity: cell ? 1 : 0.7,
                    }}
                  >
                    <Clock className="w-4 h-4" />
                    <span>{slot.startTime} - {slot.endTime}</span>
                    {isPast && (
                      <span className="ms-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">
                        {isRTL ? 'עבר' : 'Past'}
                      </span>
                    )}
                  </div>

                  {/* Cell Content */}
                  {cell ? (
                    cell.isBreak ? (
                      // Break cell - show as inactive
                      <div
                        className="px-4 pb-4 text-center"
                        style={{ color: isPast ? '#9ca3af' : (cell.textColor || '#FFFFFF') }}
                      >
                        <div className="font-medium text-base opacity-80">
                          {isRTL ? 'הפסקה' : 'Break'}
                        </div>
                      </div>
                    ) : (
                      // Regular activity cell
                      <div
                        className="px-4 pb-4"
                        style={{ color: isPast ? '#9ca3af' : (cell.textColor || getContrastTextColor(cell.backgroundColor)) }}
                      >
                        <div className="font-semibold text-lg">{cell.title}</div>
                        {cell.description && (
                          <p className="text-sm opacity-80 mt-1">{cell.description}</p>
                        )}

                        {/* Capacity/Availability Info */}
                        {capacity > 0 && !isPast && (
                          <div className={`mt-2 text-sm font-medium ${
                            isFull ? 'text-red-300' : availableSlots !== null && availableSlots <= 3 ? 'text-amber-300' : 'text-green-300'
                          }`}>
                            <Users className="w-4 h-4 inline-block me-1" />
                            {isFull
                              ? (isRTL ? 'מלא!' : 'Full!')
                              : availableSlots !== null && availableSlots <= 3
                                ? (isRTL ? `כמעט מלא (${availableSlots} מקומות)` : `Almost full (${availableSlots} spots)`)
                                : (isRTL ? `נשארו ${availableSlots} מקומות` : `${availableSlots} spots left`)
                            }
                          </div>
                        )}

                        {/* User registration status */}
                        {isUserRegistered && !isPast && (
                          <div className="mt-2 text-sm font-medium text-green-300 flex items-center gap-1">
                            <ThumbsUp className="w-4 h-4 fill-current" />
                            {isRTL ? `נרשמת (${userCounts[cell.id] || 1})` : `Registered (${userCounts[cell.id] || 1})`}
                          </div>
                        )}

                        {/* CTA for non-past, non-full activities */}
                        {!isPast && !isFull && !isUserRegistered && (
                          <div className="mt-3 flex items-center justify-center">
                            <span className="px-4 py-2 rounded-full text-sm font-bold bg-white/25 hover:bg-white/35 transition-colors">
                              {isRTL ? 'לחצו להרשמה' : 'Tap to Register'}
                            </span>
                          </div>
                        )}

                        {cell.linkUrl && (
                          <a
                            href={cell.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors"
                          >
                            {cell.linkTitle || (isRTL ? 'קישור' : 'Link')}
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    )
                  ) : (
                    <div
                      className="px-4 pb-4 text-sm opacity-50"
                      style={{ color: config.branding.dayTextColor }}
                    >
                      {isRTL ? 'אין פעילות בשעה זו' : 'No activity at this time'}
                    </div>
                  )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Booth Registration Modal */}
        {boothRegModal.isOpen && boothRegModal.cell && boothRegModal.slot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => {
                if (boothRegModalState !== 'verifying') {
                  setBoothRegModal({ isOpen: false, cell: null, slot: null });
                  setBoothRegModalState('form');
                  setBoothRegOtp(['', '', '', '']);
                  setBoothRegOtpError(null);
                }
              }}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              {/* Modal Header */}
              <div
                className="p-4 text-white"
                style={{ backgroundColor: boothRegModal.cell.backgroundColor }}
              >
                <button
                  onClick={() => {
                    if (boothRegModalState !== 'verifying') {
                      setBoothRegModal({ isOpen: false, cell: null, slot: null });
                      setBoothRegModalState('form');
                      setBoothRegOtp(['', '', '', '']);
                      setBoothRegOtpError(null);
                    }
                  }}
                  className="absolute top-3 end-3 p-2 rounded-full bg-black/20 text-white hover:bg-black/30"
                  disabled={boothRegModalState === 'verifying'}
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="text-sm opacity-80 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {boothRegModal.slot.startTime} - {boothRegModal.slot.endTime}
                </div>
                <h3 className="text-xl font-bold mt-1">{boothRegModal.cell.title}</h3>
                {boothRegModal.cell.description && (
                  <p className="text-sm opacity-80 mt-1">{boothRegModal.cell.description}</p>
                )}
              </div>

              {/* Modal Content - Success State */}
              {boothRegModalState === 'success' && (
                <div className="p-6 text-center space-y-4">
                  <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {isRTL ? 'נרשמת בהצלחה!' : 'Registration Complete!'}
                  </h3>
                  {boothRegAvatar && (
                    <div className="text-4xl">{boothRegAvatar}</div>
                  )}
                  <p className="text-gray-600 dark:text-gray-400">
                    {isRTL
                      ? 'גשו לקוד הכניסה שלכם כאן או מהודעת הוואטסאפ שנשלחה אליכם'
                      : 'Access your entry code here or from the WhatsApp message sent to you'}
                  </p>
                  {boothRegQrToken && (
                    <a
                      href={`/${locale}/p/${boothRegQrToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
                    >
                      <QrCode className="w-5 h-5" />
                      {isRTL ? 'צפייה בקוד הכניסה' : 'View Entry Code'}
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setBoothRegModal({ isOpen: false, cell: null, slot: null });
                      setBoothRegModalState('form');
                      setBoothRegOtp(['', '', '', '']);
                      setBoothRegOtpError(null);
                      setBoothRegQrToken(null);
                    }}
                    className="w-full py-3 rounded-xl font-bold text-white bg-green-500 hover:bg-green-600"
                  >
                    {isRTL ? 'סגור' : 'Close'}
                  </button>
                </div>
              )}

              {/* Modal Content - OTP Input State */}
              {boothRegModalState === 'otp_input' && (
                <div className="p-6 space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      {isRTL ? 'הכניסו קוד אימות' : 'Enter Verification Code'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isRTL
                        ? `נשלח קוד ל-${boothRegPhone}`
                        : `Code sent to ${boothRegPhone}`}
                    </p>
                  </div>

                  {/* OTP Input Boxes */}
                  <div className="flex justify-center gap-3 py-4" dir="ltr">
                    {boothRegOtp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { otpInputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          const newOtp = [...boothRegOtp];
                          newOtp[index] = val;
                          setBoothRegOtp(newOtp);
                          setBoothRegOtpError(null);
                          // Auto-focus next input
                          if (val && index < 3) {
                            otpInputRefs.current[index + 1]?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          // Handle backspace to go to previous input
                          if (e.key === 'Backspace' && !boothRegOtp[index] && index > 0) {
                            otpInputRefs.current[index - 1]?.focus();
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
                          const newOtp = [...boothRegOtp];
                          for (let i = 0; i < pastedData.length; i++) {
                            newOtp[i] = pastedData[i];
                          }
                          setBoothRegOtp(newOtp);
                          // Focus the next empty input or last
                          const nextIndex = Math.min(pastedData.length, 3);
                          otpInputRefs.current[nextIndex]?.focus();
                        }}
                        className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ))}
                  </div>

                  {/* OTP Error */}
                  {boothRegOtpError && (
                    <div className="text-center text-red-600 dark:text-red-400 text-sm">
                      {boothRegOtpError}
                    </div>
                  )}

                  {/* Resend Button */}
                  <div className="text-center">
                    <button
                      onClick={async () => {
                        if (boothRegResendCooldown > 0 || !boothRegRegistrationId) return;
                        setBoothRegSubmitting(true);
                        try {
                          const response = await fetch('/api/weeklycal/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'send',
                              codeId,
                              phone: boothRegPhone,
                              registrationId: boothRegRegistrationId,
                              locale,
                            }),
                          });
                          if (response.ok) {
                            setBoothRegResendCooldown(60);
                            setBoothRegOtpError(null);
                          } else {
                            const errorData = await response.json().catch(() => ({}));
                            if (errorData.errorCode === 'RATE_LIMITED') {
                              setBoothRegOtpError(isRTL ? 'יותר מדי ניסיונות. נסו שוב מאוחר יותר' : 'Too many attempts. Try again later');
                            }
                          }
                        } catch (error) {
                          console.error('Resend OTP error:', error);
                        } finally {
                          setBoothRegSubmitting(false);
                        }
                      }}
                      disabled={boothRegResendCooldown > 0 || boothRegSubmitting}
                      className="text-blue-600 dark:text-blue-400 text-sm hover:underline disabled:opacity-50 disabled:no-underline flex items-center justify-center gap-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {boothRegResendCooldown > 0
                        ? (isRTL ? `שלח שוב (${boothRegResendCooldown})` : `Resend (${boothRegResendCooldown})`)
                        : (isRTL ? 'שלח שוב' : 'Resend code')}
                    </button>
                  </div>

                  {/* Verify Button */}
                  <button
                    onClick={async () => {
                      const code = boothRegOtp.join('');
                      if (code.length !== 4) {
                        setBoothRegOtpError(isRTL ? 'הכניסו קוד בן 4 ספרות' : 'Enter 4-digit code');
                        return;
                      }
                      setBoothRegSubmitting(true);
                      try {
                        const response = await fetch('/api/weeklycal/verify', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'verify',
                            codeId,
                            phone: boothRegPhone,
                            code,
                          }),
                        });
                        const data = await response.json();
                        if (response.ok && data.success) {
                          setBoothRegQrToken(data.qrToken);
                          setBoothRegModalState('success');
                          // Update user registrations
                          if (boothRegModal.cell) {
                            setUserRegistrations(prev => [...prev, boothRegModal.cell!.id]);
                            setUserCounts(prev => ({ ...prev, [boothRegModal.cell!.id]: boothRegCount }));
                          }
                        } else {
                          if (data.errorCode === 'INVALID_CODE') {
                            setBoothRegOtpError(isRTL
                              ? `קוד שגוי. נותרו ${data.attemptsRemaining} ניסיונות`
                              : `Invalid code. ${data.attemptsRemaining} attempts remaining`);
                          } else if (data.errorCode === 'EXPIRED') {
                            setBoothRegOtpError(isRTL ? 'הקוד פג תוקף. נסו שוב' : 'Code expired. Please try again');
                          } else if (data.errorCode === 'BLOCKED') {
                            setBoothRegOtpError(isRTL ? 'יותר מדי ניסיונות. נסו מאוחר יותר' : 'Too many attempts. Try again later');
                          } else {
                            setBoothRegOtpError(data.error || (isRTL ? 'שגיאה באימות' : 'Verification failed'));
                          }
                        }
                      } catch (error) {
                        console.error('Verify OTP error:', error);
                        setBoothRegOtpError(isRTL ? 'שגיאה באימות' : 'Verification failed');
                      } finally {
                        setBoothRegSubmitting(false);
                      }
                    }}
                    disabled={boothRegSubmitting || boothRegOtp.some(d => !d)}
                    className="w-full py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {boothRegSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      isRTL ? 'אמת' : 'Verify'
                    )}
                  </button>

                  {/* Back Button */}
                  <button
                    onClick={() => {
                      setBoothRegModalState('form');
                      setBoothRegOtp(['', '', '', '']);
                      setBoothRegOtpError(null);
                    }}
                    className="w-full py-2 text-gray-600 dark:text-gray-400 text-sm hover:underline"
                  >
                    {isRTL ? '← חזור לטופס' : '← Back to form'}
                  </button>
                </div>
              )}

              {/* Modal Content - Form State */}
              {boothRegModalState === 'form' && (
                <div className="p-6 space-y-4">
                  {/* Already Registered - Summary View */}
                  {userRegistrations.includes(boothRegModal.cell.id) ? (
                    <div className="text-center space-y-4">
                      {/* Success Icon */}
                      <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
                      </div>

                      {/* Status Message */}
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {isRTL ? 'רשומים לפעילות!' : 'Registered!'}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {isRTL ? 'ההרשמה שלכם לפעילות זו אושרה' : 'Your registration is confirmed'}
                        </p>
                      </div>

                      {/* Registration Summary */}
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4 text-start">
                        <div className="flex items-center gap-3">
                          {boothRegAvatar && (
                            <span className="text-3xl">{boothRegAvatar}</span>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{boothRegName}</p>
                            {userCounts[boothRegModal.cell.id] && userCounts[boothRegModal.cell.id] > 1 && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {isRTL ? `${userCounts[boothRegModal.cell.id]} אנשים` : `${userCounts[boothRegModal.cell.id]} people`}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2 pt-2">
                        {/* View QR Code Button - if has qrToken */}
                        <button
                          onClick={() => {
                            // Open QR landing page in new tab
                            // For now just close the modal - need to get qrToken from registration
                            setBoothRegModal({ isOpen: false, cell: null, slot: null });
                          }}
                          className="w-full py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 flex items-center justify-center gap-2"
                        >
                          <QrCode className="w-5 h-5" />
                          {isRTL ? 'צפייה בקוד הכניסה' : 'View Entry Code'}
                        </button>

                        {/* Cancel Registration */}
                        <button
                          onClick={async () => {
                            if (!codeId || !currentBoothDay || !currentBooth || !boothRegModal.cell) return;
                            setBoothRegSubmitting(true);

                            try {
                              const visitorId = getVisitorId();
                              const response = await fetch('/api/weeklycal/register', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  codeId,
                                  cellId: boothRegModal.cell.id,
                                  boothDate: currentBoothDay.date,
                                  boothId: currentBooth.id,
                                  visitorId,
                                  action: 'unregister',
                                }),
                              });

                              if (response.ok) {
                                const data = await response.json();
                                setRegistrationCounts(prev => ({ ...prev, [boothRegModal.cell!.id]: data.registrationCount }));
                                setUserRegistrations(prev => prev.filter(id => id !== boothRegModal.cell!.id));
                                setUserCounts(prev => {
                                  const updated = { ...prev };
                                  delete updated[boothRegModal.cell!.id];
                                  return updated;
                                });
                                setBoothRegModal({ isOpen: false, cell: null, slot: null });
                              }
                            } catch (error) {
                              console.error('Unregister error:', error);
                            } finally {
                              setBoothRegSubmitting(false);
                            }
                          }}
                          disabled={boothRegSubmitting}
                          className="w-full py-3 rounded-xl font-bold text-red-600 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50"
                        >
                          {boothRegSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                          ) : (
                            isRTL ? 'ביטול הרשמה' : 'Cancel Registration'
                          )}
                        </button>

                        {/* Close Button */}
                        <button
                          onClick={() => setBoothRegModal({ isOpen: false, cell: null, slot: null })}
                          className="w-full py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          {isRTL ? 'סגור' : 'Close'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* New Registration Form */
                    <>
                      {/* Avatar Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {isRTL ? 'בחרו אווטאר' : 'Choose avatar'}
                    </label>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {/* Camera/Selfie upload button */}
                      <label
                        className={`w-12 h-12 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                          boothRegAvatarType === 'photo'
                            ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500 scale-110'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        } ${boothRegAvatarLoading ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        {boothRegAvatarLoading ? (
                          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                        ) : boothRegAvatarType === 'photo' && boothRegAvatar ? (
                          <img
                            src={boothRegAvatar}
                            alt=""
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          <Camera className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          className="hidden"
                          disabled={boothRegAvatarLoading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !codeId) return;

                            setBoothRegAvatarLoading(true);
                            try {
                              // Upload to server immediately
                              const formData = new FormData();
                              formData.append('file', file);
                              formData.append('codeId', codeId);
                              formData.append('visitorId', getVisitorId());

                              const response = await fetch('/api/avatar/upload', {
                                method: 'POST',
                                body: formData,
                              });

                              if (response.ok) {
                                const data = await response.json();
                                setBoothRegAvatar(data.url);
                                setBoothRegAvatarType('photo');
                              } else {
                                const errorData = await response.json().catch(() => ({}));
                                alert(errorData.error || (isRTL ? 'שגיאה בהעלאת תמונה' : 'Failed to upload image'));
                              }
                            } catch (err) {
                              console.error('Avatar upload error:', err);
                              alert(isRTL ? 'שגיאה בהעלאת תמונה' : 'Failed to upload image');
                            } finally {
                              setBoothRegAvatarLoading(false);
                              // Reset input so same file can be selected again
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                      {PRESET_AVATARS.map((avatar) => (
                        <button
                          key={avatar.id}
                          onClick={() => {
                            setBoothRegAvatar(avatar.value);
                            setBoothRegAvatarType('emoji');
                          }}
                          className={`w-12 h-12 text-2xl rounded-xl transition-all ${
                            boothRegAvatar === avatar.value && boothRegAvatarType === 'emoji'
                              ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500 scale-110'
                              : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {avatar.value}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {isRTL ? 'שם' : 'Name'} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={boothRegName}
                        onChange={(e) => setBoothRegName(e.target.value)}
                        placeholder={isRTL ? 'הכניסו שם' : 'Enter name'}
                        className="w-full ps-10 pe-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        dir={isRTL ? 'rtl' : 'ltr'}
                      />
                    </div>
                  </div>

                  {/* Phone Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {isRTL ? 'טלפון' : 'Phone'} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        value={boothRegPhone}
                        onChange={(e) => setBoothRegPhone(e.target.value)}
                        placeholder={isRTL ? '050-1234567' : '050-1234567'}
                        className="w-full ps-10 pe-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        dir="ltr"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {isRTL ? 'נשלח קוד אימות בוואטסאפ' : 'Verification code will be sent via WhatsApp'}
                    </p>
                  </div>

                  {/* Count Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {isRTL ? 'כמה אנשים?' : 'How many people?'}
                    </label>
                    <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-xl p-2">
                      <button
                        onClick={() => setBoothRegCount(Math.max(1, boothRegCount - 1))}
                        className="w-10 h-10 rounded-lg bg-white dark:bg-gray-600 shadow flex items-center justify-center text-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-500"
                      >
                        −
                      </button>
                      <span className="flex-1 text-center text-2xl font-bold text-gray-900 dark:text-white">
                        {boothRegCount}
                      </span>
                      <button
                        onClick={() => setBoothRegCount(Math.min(10, boothRegCount + 1))}
                        className="w-10 h-10 rounded-lg bg-white dark:bg-gray-600 shadow flex items-center justify-center text-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-500"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons - Register Button */}
                  <div className="flex gap-3 pt-2">
                      <button
                        onClick={async () => {
                          if (!codeId || !currentBoothDay || !currentBooth || !boothRegModal.cell) return;

                          // Validate required fields
                          if (!boothRegName.trim()) {
                            return;
                          }
                          if (!boothRegPhone.trim()) {
                            return;
                          }

                          setBoothRegSubmitting(true);

                          // Save name and phone to localStorage
                          localStorage.setItem('boothRegName', boothRegName);
                          localStorage.setItem('boothRegPhone', boothRegPhone);

                          try {
                            const visitorId = getVisitorId();

                            // Step 1: Register (creates pending registration)
                            const regResponse = await fetch('/api/weeklycal/register', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                codeId,
                                cellId: boothRegModal.cell.id,
                                boothDate: currentBoothDay.date,
                                boothId: currentBooth.id,
                                visitorId,
                                nickname: boothRegName,
                                phone: boothRegPhone,
                                avatarUrl: boothRegAvatar,
                                avatarType: boothRegAvatarType,
                                action: 'register',
                                count: boothRegCount,
                                capacity: boothRegModal.cell.capacity,
                              }),
                            });

                            if (!regResponse.ok) {
                              const errorData = await regResponse.json().catch(() => ({}));
                              if (errorData.error === 'Capacity exceeded') {
                                alert(isRTL ? `הפעילות מלאה! נשארו רק ${errorData.availableSlots} מקומות` : `Activity is full! Only ${errorData.availableSlots} spots left`);
                              } else if (errorData.error === 'Phone already registered') {
                                alert(isRTL ? 'מספר הטלפון הזה כבר רשום לפעילות זו' : 'This phone number is already registered for this activity');
                              }
                              return;
                            }

                            const regData = await regResponse.json();
                            setBoothRegRegistrationId(regData.registrationId);
                            setRegistrationCounts(prev => ({ ...prev, [boothRegModal.cell!.id]: regData.registrationCount }));

                            // Step 2: Send OTP
                            setBoothRegModalState('verifying');
                            const otpResponse = await fetch('/api/weeklycal/verify', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'send',
                                codeId,
                                phone: boothRegPhone,
                                registrationId: regData.registrationId,
                                locale,
                              }),
                            });

                            if (otpResponse.ok) {
                              setBoothRegModalState('otp_input');
                              setBoothRegResendCooldown(60);
                              // Focus first OTP input
                              setTimeout(() => {
                                otpInputRefs.current[0]?.focus();
                              }, 100);
                            } else {
                              const otpError = await otpResponse.json().catch(() => ({}));
                              if (otpError.errorCode === 'SERVICE_NOT_CONFIGURED') {
                                // Skip verification if service not configured
                                setBoothRegModalState('success');
                                setUserRegistrations(prev => [...prev, boothRegModal.cell!.id]);
                                setUserCounts(prev => ({ ...prev, [boothRegModal.cell!.id]: boothRegCount }));
                              } else {
                                setBoothRegOtpError(isRTL ? 'שגיאה בשליחת קוד' : 'Failed to send code');
                                setBoothRegModalState('otp_input');
                              }
                            }
                          } catch (error) {
                            console.error('Registration error:', error);
                            setBoothRegModalState('form');
                          } finally {
                            setBoothRegSubmitting(false);
                          }
                        }}
                        disabled={boothRegSubmitting || !boothRegName.trim() || !boothRegPhone.trim()}
                        className="flex-1 py-3 rounded-xl font-bold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {boothRegSubmitting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <ThumbsUp className="w-5 h-5" />
                            {isRTL ? 'הרשמה' : 'Register'}
                          </>
                        )}
                      </button>
                  </div>
                    </>
                  )}
                </div>
              )}

              {/* Modal Content - Verifying State (loading) */}
              {boothRegModalState === 'verifying' && (
                <div className="p-6 text-center space-y-4">
                  <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {isRTL ? 'שולח קוד אימות...' : 'Sending verification code...'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FAB Buttons for Booth Mode */}
        <div className="fixed bottom-6 end-6 z-30 flex flex-col gap-3">
          {/* Notes/Info FAB */}
          {config.notes?.enabled && config.notes?.content && (
            <button
              onClick={() => setShowNotes(true)}
              className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
              style={{
                backgroundColor: config.notes?.fabButtonColor || '#3b82f6',
              }}
            >
              <Info
                className="w-6 h-6"
                style={{ color: config.notes?.fabIconColor || '#ffffff' }}
              />
            </button>
          )}

        </div>
      </div>
    );
  }

  // ========== WEEKLY MODE VIEWER ==========
  // At this point, currentWeek is guaranteed to be defined (checked in early returns above)
  const weekData = currentWeek!;

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        backgroundColor: config.branding.dayBackgroundColor,
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background Image Layer */}
      {dayBgImageUrl && (
        <div
          className={`fixed inset-0 pointer-events-none ${
            config.branding.dayBackgroundBlur ? 'blur-sm scale-105' : ''
          }`}
          style={{
            backgroundImage: `url(${dayBgImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
          }}
        />
      )}
      {/* Glassmorphism overlay for readability */}
      {dayBgImageUrl && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            backgroundColor: config.branding.dayBackgroundBlur
              ? `${config.branding.dayBackgroundColor}50`
              : `${config.branding.dayBackgroundColor}80`,
            backdropFilter: config.branding.dayBackgroundBlur ? 'blur(4px)' : undefined,
          }}
        />
      )}

      {/* Header */}
      <div
        className="sticky top-0 z-20 px-4 py-3 shadow-md"
        style={{
          backgroundColor: config.branding.headerBackgroundColor,
          color: config.branding.headerTextColor,
        }}
      >
        <div className="flex items-center justify-between">
          {/* Day Navigation */}
          <button
            onClick={() => {
              if (currentDayIndex > 0) {
                const newIndex = currentDayIndex - 1;
                if (
                  config.showPastDayWarning &&
                  !hasConfirmedPastViewing &&
                  isPastDay(weekData.weekStartDate, newIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6) &&
                  newIndex < todayIndex
                ) {
                  setShowPastWarning(true);
                  setPendingDayIndex(newIndex);
                } else {
                  setCurrentDayIndex(newIndex as DayOfWeek);
                  swiperRef.current?.slideTo(newIndex);
                }
              }
            }}
            disabled={currentDayIndex === 0}
            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Day Title */}
          <div className="text-center">
            <h1 className="text-xl font-bold">
              {isRTL ? `יום ${DAY_NAMES.he[currentDayIndex]}` : DAY_NAMES.en[currentDayIndex]}
            </h1>
            <p className="text-sm opacity-75">
              {getDayDate(weekData.weekStartDate, currentDayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6, locale)}
            </p>
          </div>

          {/* Day Navigation */}
          <button
            onClick={() => {
              if (currentDayIndex < 6) {
                const newIndex = currentDayIndex + 1;
                setCurrentDayIndex(newIndex as DayOfWeek);
                swiperRef.current?.slideTo(newIndex);
              }
            }}
            disabled={currentDayIndex === 6}
            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Day Pills */}
        <div className="flex justify-center gap-1 mt-2">
          {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
            const isPast = isPastDay(weekData.weekStartDate, dayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6);
            const isCurrent = dayIndex === currentDayIndex;
            const isTodayDay = isToday(weekData.weekStartDate, dayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6);

            return (
              <button
                key={dayIndex}
                onClick={() => {
                  if (config.showPastDayWarning && !hasConfirmedPastViewing && isPast && dayIndex < todayIndex) {
                    setShowPastWarning(true);
                    setPendingDayIndex(dayIndex);
                  } else {
                    setCurrentDayIndex(dayIndex as DayOfWeek);
                    swiperRef.current?.slideTo(dayIndex);
                  }
                }}
                className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                  isCurrent
                    ? 'bg-white text-gray-900 scale-110'
                    : isPast
                    ? 'bg-white/20 opacity-50'
                    : 'bg-white/20 hover:bg-white/30'
                } ${isTodayDay && !isCurrent ? 'ring-2 ring-white/50' : ''}`}
              >
                {isRTL ? DAY_NAMES_SHORT.he[dayIndex] : DAY_NAMES_SHORT.en[dayIndex]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Content - Swiper */}
      <div className="flex-1 overflow-hidden">
        <Swiper
          onSwiper={(swiper) => (swiperRef.current = swiper)}
          onSlideChange={handleSlideChange}
          initialSlide={currentDayIndex}
          spaceBetween={0}
          slidesPerView={1}
          dir={isRTL ? 'rtl' : 'ltr'}
          className="h-full"
        >
          {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
            const cells = getCellsForDay(
              weekData.cells,
              dayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6
            );
            const isPast = isPastDay(
              weekData.weekStartDate,
              dayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6
            );
            const isTodayDay = isToday(
              weekData.weekStartDate,
              dayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6
            );

            return (
              <SwiperSlide key={dayIndex}>
                <div
                  ref={isTodayDay ? scrollContainerRef : undefined}
                  className="h-full overflow-y-auto px-4 py-4"
                  style={{
                    opacity: isPast ? config.branding.pastDayOpacity : 1,
                  }}
                >
                  {/* Events */}
                  {cells.length > 0 ? (
                    <div className="space-y-3">
                      {weekData.timeSlots.map((slot, slotIndex) => {
                        const cell = cells.find((c) => c.startSlotIndex === slotIndex);
                        if (!cell) return null;

                        // Check if this slot has already passed
                        const slotIsPast = isSlotPast(slot.startTime, slot.endTime, isTodayDay, isPast);

                        // Is this the current/next activity? (for ref and time indicator)
                        const isCurrentActivity = isTodayDay && slotIndex === currentSlotInfo.currentSlotIndex;

                        // Show time indicator on top of current activity (or the last past if all past)
                        const showTimeIndicator =
                          isTodayDay &&
                          config.showCurrentTimeIndicator &&
                          isCurrentActivity;

                        return (
                          <div
                            key={cell.id}
                            ref={isCurrentActivity ? currentActivityRef : undefined}
                            className="relative"
                          >
                            {/* Time Indicator - positioned outside card when not within slot (before/between slots) */}
                            {showTimeIndicator && !currentSlotInfo.isWithinSlot && (
                              <div className="flex items-center pb-2 -mt-1 -mx-4">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0 z-10"
                                  style={{ backgroundColor: config.branding.currentTimeIndicatorColor }}
                                />
                                <div
                                  className="flex-1 h-0.5"
                                  style={{ backgroundColor: config.branding.currentTimeIndicatorColor }}
                                />
                              </div>
                            )}

                            {/* Time Indicator - spans full width at correct position within slot */}
                            {showTimeIndicator && currentSlotInfo.isWithinSlot && (
                              <div
                                className="absolute z-30 pointer-events-none flex items-center -mx-4 left-0 right-0"
                                style={{
                                  top: `${currentSlotInfo.fractionWithinSlot * 100}%`,
                                }}
                              >
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: config.branding.currentTimeIndicatorColor }}
                                />
                                <div
                                  className="flex-1 h-0.5"
                                  style={{ backgroundColor: config.branding.currentTimeIndicatorColor }}
                                />
                              </div>
                            )}

                            <div
                              className={`rounded-xl overflow-hidden shadow-md transition-all duration-300 hover:shadow-lg relative ${
                                slotIsPast ? 'opacity-50' : ''
                              }`}
                              style={{
                                backgroundColor: cell.backgroundColor,
                                color: cell.textColor || getContrastTextColor(cell.backgroundColor),
                              }}
                            >
                              {/* Cell Image */}
                              {cell.imageUrl && (
                                <div className="aspect-video w-full relative z-20">
                                  <img
                                    src={cell.imageUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}

                              {/* Cell Content */}
                              <div className="p-4 relative z-20">
                                {/* Time */}
                                <div className="flex items-center gap-1 text-sm mb-2">
                                  <Clock className="w-3.5 h-3.5 opacity-80" />
                                  <span className="opacity-75">
                                    {slot.startTime} - {slot.endTime}
                                  </span>
                                </div>

                                {/* Title */}
                                <h3 className="text-lg font-bold mb-1">{cell.title}</h3>

                                {/* Description */}
                                {cell.description && (
                                  <p className="text-sm opacity-80">{cell.description}</p>
                                )}

                                {/* Link Button */}
                                {cell.linkUrl && (
                                  <a
                                    href={cell.linkUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                                    style={{
                                      backgroundColor: 'rgba(255,255,255,0.2)',
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    {cell.linkTitle || (isRTL ? 'לפרטים נוספים' : 'Learn More')}
                                  </a>
                                )}

                                {/* RSVP Section */}
                                {config.enableRSVP && !slotIsPast && (
                                  <div className="mt-4 pt-3 border-t border-white/20">
                                    {/* Tooltip/explanation */}
                                    <p className="text-xs opacity-60 mb-2">
                                      {isRTL ? 'לחצו להירשם לפעילות וסמנו כמה אתם מגיעים' : 'Click to register and select how many are coming'}
                                    </p>
                                    <div className="flex items-center gap-3 flex-wrap">
                                      {/* Toggle RSVP Button */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const isRegistered = userRegistrations.includes(cell.id);
                                          if (isRegistered) {
                                            handleRSVP(cell.id, 0, 'unregister');
                                          } else {
                                            handleRSVP(cell.id, 1, 'register');
                                          }
                                        }}
                                        disabled={rsvpLoading === cell.id}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold transition-all shadow-sm ${
                                          userRegistrations.includes(cell.id)
                                            ? 'bg-green-500 text-white shadow-green-500/30'
                                            : 'bg-white/25 hover:bg-white/35'
                                        } ${rsvpLoading === cell.id ? 'opacity-50' : ''}`}
                                      >
                                        <ThumbsUp
                                          className={`w-5 h-5 ${
                                            userRegistrations.includes(cell.id) ? 'fill-current' : ''
                                          }`}
                                        />
                                        <span>{isRTL ? 'מגיעים' : 'Coming'}</span>
                                      </button>

                                      {/* Count +/- controls - only show when registered */}
                                      {userRegistrations.includes(cell.id) && (
                                        <div className="flex items-center bg-white/25 rounded-xl shadow-sm">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const currentCount = userCounts[cell.id] || 1;
                                              if (currentCount <= 1) {
                                                handleRSVP(cell.id, 0, 'unregister');
                                              } else {
                                                handleRSVP(cell.id, currentCount - 1, 'register');
                                              }
                                            }}
                                            disabled={rsvpLoading === cell.id}
                                            className="w-10 h-10 flex items-center justify-center text-xl font-bold hover:bg-white/20 rounded-s-xl disabled:opacity-30"
                                          >
                                            −
                                          </button>
                                          <span className="w-8 text-center text-lg font-bold">
                                            {userCounts[cell.id] || 1}
                                          </span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const currentCount = userCounts[cell.id] || 1;
                                              if (currentCount < 10) {
                                                handleRSVP(cell.id, currentCount + 1, 'register');
                                              }
                                            }}
                                            disabled={rsvpLoading === cell.id || (userCounts[cell.id] || 1) >= 10}
                                            className="w-10 h-10 flex items-center justify-center text-xl font-bold hover:bg-white/20 rounded-e-xl disabled:opacity-30"
                                          >
                                            +
                                          </button>
                                        </div>
                                      )}

                                      {/* Total count */}
                                      {(registrationCounts[cell.id] || 0) > 0 && (
                                        <span className="text-sm font-medium opacity-80">
                                          {isRTL
                                            ? `סה״כ נרשמו: ${registrationCounts[cell.id]}`
                                            : `${registrationCounts[cell.id]} registered`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center">
                      {/* Time Indicator for empty day (when it's today) */}
                      {isTodayDay && config.showCurrentTimeIndicator && (
                        <div className="w-full max-w-xs mb-6">
                          <div className="flex items-center">
                            <div
                              className="w-3 h-3 rounded-full -ms-1.5 flex-shrink-0"
                              style={{ backgroundColor: config.branding.currentTimeIndicatorColor }}
                            />
                            <div
                              className="flex-1 h-0.5"
                              style={{ backgroundColor: config.branding.currentTimeIndicatorColor }}
                            />
                            <span
                              className="ms-2 text-sm font-medium"
                              style={{ color: config.branding.currentTimeIndicatorColor }}
                            >
                              {currentTime.toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="text-center text-text-secondary">
                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg font-medium">
                          {isRTL ? 'אין פעילויות' : 'No Activities'}
                        </p>
                        <p className="text-sm opacity-75">
                          {isRTL
                            ? 'לא הוגדרו פעילויות ליום זה'
                            : 'No activities scheduled for this day'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>

      {/* FAB Buttons */}
      <div className="fixed bottom-6 end-6 z-30 flex flex-col gap-3">
        {/* Notes/Info FAB */}
        {config.notes?.enabled && config.notes?.content && (
          <button
            onClick={() => setShowNotes(true)}
            className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
            style={{
              backgroundColor: config.notes?.fabButtonColor || '#3b82f6',
            }}
          >
            <Info
              className="w-6 h-6"
              style={{ color: config.notes?.fabIconColor || '#ffffff' }}
            />
          </button>
        )}

        {/* Attractions FAB */}
        {activeAttractions.length > 0 && (
          <button
            onClick={() => setShowAttractions(true)}
            className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
            style={{
              backgroundColor: config.branding.headerBackgroundColor,
              color: config.branding.headerTextColor,
            }}
          >
            <Sparkles className="w-6 h-6" />
          </button>
        )}

      </div>

      {/* Past Day Warning Modal */}
      {showPastWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={cancelPastDay} />
          <div className="relative bg-white dark:bg-bg-card rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">
                {isRTL ? 'יום שעבר' : 'Past Day'}
              </h3>
              <p className="text-text-secondary mb-6">
                {isRTL
                  ? 'אתם עומדים לצפות בתוכנית של יום שכבר עבר. להמשיך?'
                  : 'You are about to view a schedule from a past day. Continue?'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={cancelPastDay}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-bg-secondary text-text-primary font-medium"
                >
                  {isRTL ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  onClick={confirmPastDay}
                  className="flex-1 px-4 py-2 rounded-lg bg-accent text-white font-medium"
                >
                  {isRTL ? 'המשך' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attractions Modal */}
      {showAttractions && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setShowAttractions(false)}
          />
          <div className="relative bg-white dark:bg-bg-card rounded-t-3xl shadow-xl w-full max-h-[80vh] overflow-hidden animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            {/* Header */}
            <div className="px-6 pb-4 flex items-center justify-between border-b border-border">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                {isRTL ? 'אטרקציות' : 'Attractions'}
              </h2>
              <div className="flex items-center gap-1">
                {/* Info button - show if notes enabled */}
                {config.notes?.enabled && config.notes?.content && (
                  <button
                    onClick={() => {
                      setShowAttractions(false);
                      setShowNotes(true);
                    }}
                    className="p-2 rounded-lg hover:bg-bg-secondary"
                    title={isRTL ? 'מידע' : 'Information'}
                  >
                    <Info className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowAttractions(false);
                    setShowLanding(true);
                  }}
                  className="p-2 rounded-lg hover:bg-bg-secondary"
                  title={isRTL ? 'חזרה לדף הבית' : 'Back to home'}
                >
                  <Home className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowAttractions(false)}
                  className="p-2 rounded-lg hover:bg-bg-secondary"
                  title={isRTL ? 'סגור' : 'Close'}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Attractions List */}
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
              {activeAttractions.map((attraction, index) => (
                <button
                  key={attraction.id}
                  onClick={() => {
                    setSelectedAttraction(attraction);
                    setShowAttractions(false);
                  }}
                  className="w-full p-4 bg-bg-secondary rounded-xl text-start hover:bg-bg-hover transition-all animate-bounce-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start gap-4">
                    {attraction.imageUrl && (
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={attraction.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-text-primary">{attraction.title}</h3>
                      {attraction.timeDisplay && attraction.dayIndex !== undefined && (
                        <p className="text-sm text-text-secondary mt-1">
                          {isRTL ? DAY_NAMES.he[attraction.dayIndex] : DAY_NAMES.en[attraction.dayIndex]}
                          {' · '}
                          {attraction.timeDisplay}
                        </p>
                      )}
                      {attraction.description && (
                        <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                          {attraction.description}
                        </p>
                      )}
                      {attraction.youtubeUrl && (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs text-accent">
                          <Play className="w-3 h-3" />
                          {isRTL ? 'צפייה בסרטון' : 'Watch Video'}
                        </span>
                      )}
                    </div>
                    <ChevronLeft className="w-5 h-5 text-text-secondary flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Animation Styles */}
          <style>{`
            @keyframes slide-up {
              from {
                transform: translateY(100%);
                opacity: 0;
              }
              to {
                transform: translateY(0);
                opacity: 1;
              }
            }
            @keyframes fade-in {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes bounce-in {
              0% {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
              }
              50% {
                transform: translateY(-5px) scale(1.02);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            .animate-slide-up {
              animation: slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards;
            }
            .animate-fade-in {
              animation: fade-in 0.25s ease-out forwards;
            }
            .animate-bounce-in {
              opacity: 0;
              animation: bounce-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
          `}</style>
        </div>
      )}

      {/* Selected Attraction Detail */}
      {selectedAttraction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedAttraction(null)}
          />
          <div className="relative bg-white dark:bg-bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden">
            {/* Close Button */}
            <button
              onClick={() => setSelectedAttraction(null)}
              className="absolute top-4 end-4 z-10 p-2 rounded-full bg-black/20 text-white hover:bg-black/30"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Image */}
            {selectedAttraction.imageUrl && (
              <div className="aspect-video w-full">
                <img
                  src={selectedAttraction.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div className="p-6">
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                {selectedAttraction.title}
              </h2>

              {selectedAttraction.timeDisplay && selectedAttraction.dayIndex !== undefined && (
                <p className="text-accent font-medium mb-4">
                  {isRTL ? DAY_NAMES.he[selectedAttraction.dayIndex] : DAY_NAMES.en[selectedAttraction.dayIndex]}
                  {' · '}
                  {selectedAttraction.timeDisplay}
                </p>
              )}

              {selectedAttraction.description && (
                <p className="text-text-secondary whitespace-pre-wrap mb-6">
                  {selectedAttraction.description}
                </p>
              )}

              {/* YouTube Embed */}
              {selectedAttraction.youtubeUrl && (
                <div className="aspect-video rounded-xl overflow-hidden bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYoutubeId(selectedAttraction.youtubeUrl)}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotes && config.notes?.enabled && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setShowNotes(false)}
          />
          <div
            className="relative rounded-2xl shadow-xl w-full max-w-lg max-h-[75vh] overflow-hidden animate-slide-up mx-4"
            style={{
              backgroundColor: config.notes?.useLandingImage ? 'transparent' : (config.notes?.backgroundColor || '#ffffff'),
            }}
          >
            {/* Background Image */}
            {config.notes?.useLandingImage && config.branding.landing.splashImageUrl && (
              <>
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${config.branding.landing.splashImageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                {/* Overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: `rgba(0, 0, 0, ${(config.notes?.imageOverlayOpacity ?? 50) / 100})`,
                  }}
                />
              </>
            )}

            {/* Content Container */}
            <div className="relative z-10 flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-white/20">
                <h2
                  className="text-lg font-bold flex items-center gap-2"
                  style={{ color: config.notes?.textColor || '#1f2937' }}
                >
                  <Info className="w-5 h-5" style={{ color: config.notes?.buttonColor || '#3b82f6' }} />
                  {config.notes?.title || (isRTL ? 'מידע' : 'Information')}
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setShowNotes(false);
                      setShowLanding(true);
                    }}
                    className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                    style={{ color: config.notes?.textColor || '#1f2937' }}
                    title={isRTL ? 'חזרה לדף הבית' : 'Back to home'}
                  >
                    <Home className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowNotes(false)}
                    className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                    style={{ color: config.notes?.textColor || '#1f2937' }}
                    title={isRTL ? 'סגור' : 'Close'}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Notes Content */}
              <div className="p-6 overflow-y-auto flex-1">
                <div
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className="prose prose-sm max-w-none [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-2 [&_li]:mb-1 [&_hr]:my-4 [&_p]:mb-2 [&_strong]:font-bold"
                  style={{ color: config.notes?.textColor || '#1f2937' }}
                  dangerouslySetInnerHTML={{ __html: config.notes?.content || '' }}
                />
              </div>

              {/* Close Button */}
              <div className="p-4">
                <button
                  onClick={() => setShowNotes(false)}
                  className="w-full py-3 rounded-xl font-medium text-white transition-all hover:opacity-90 active:scale-98"
                  style={{ backgroundColor: config.notes?.buttonColor || '#3b82f6' }}
                >
                  {config.notes?.buttonText || (isRTL ? 'הבנתי' : 'Got it')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
