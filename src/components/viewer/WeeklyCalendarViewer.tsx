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
} from 'lucide-react';
import {
  WeeklyCalendarConfig,
  CalendarCell,
  CalendarAttraction,
  DayOfWeek,
  DAY_NAMES,
  DAY_NAMES_SHORT,
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

  // Remember today's index for past day checking
  const todayIndex = useMemo(() => getTodayDayIndex(), []);

  const swiperRef = useRef<SwiperType | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const currentActivityRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledToCurrentRef = useRef(false);

  // Get current week data
  const currentWeekStart = getWeekStartDate(new Date());
  const currentWeek = useMemo(() => {
    return config.weeks.find((w) => isCurrentWeek(w.weekStartDate)) || config.weeks[0];
  }, [config.weeks]);

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

        {/* Info FAB on Landing Page */}
        {config.notes?.enabled && config.notes?.content && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowNotes(true);
            }}
            className="fixed bottom-6 end-6 z-30 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
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
    );
  }

  // No week data
  if (!currentWeek) {
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
                  isPastDay(currentWeek.weekStartDate, newIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6) &&
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
              {getDayDate(currentWeek.weekStartDate, currentDayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6, locale)}
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
            const isPast = isPastDay(currentWeek.weekStartDate, dayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6);
            const isCurrent = dayIndex === currentDayIndex;
            const isTodayDay = isToday(currentWeek.weekStartDate, dayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6);

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
              currentWeek.cells,
              dayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6
            );
            const isPast = isPastDay(
              currentWeek.weekStartDate,
              dayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6
            );
            const isTodayDay = isToday(
              currentWeek.weekStartDate,
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
                      {currentWeek.timeSlots.map((slot, slotIndex) => {
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
