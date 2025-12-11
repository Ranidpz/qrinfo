'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { RefreshCw, Loader2, BarChart3, Radio } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import CodeSelector from '@/components/analytics/CodeSelector';
import DateRangePicker from '@/components/analytics/DateRangePicker';
import MetricsCards from '@/components/analytics/MetricsCards';
import ViewsChart from '@/components/analytics/ViewsChart';
import HourlyChart from '@/components/analytics/HourlyChart';
import LinkClicksSection from '@/components/analytics/LinkClicksSection';
import RSVPAnalyticsSection from '@/components/analytics/RSVPAnalyticsSection';
import AnalyticsGridLayout from '@/components/analytics/AnalyticsGridLayout';
import { getUserQRCodes, getAllUsers } from '@/lib/db';
import {
  getDateRange,
  aggregateAnalytics,
  getAllQRCodes,
  subscribeToViewLogs,
  subscribeToLinkClicks,
  aggregateLinkClicks,
  subscribeToRSVPRegistrations,
  aggregateRSVPStats,
  emptyRSVPStats,
  RSVPStats,
  CellInfo,
} from '@/lib/analytics';
import type { WeeklyCalendarConfig } from '@/types/weeklycal';
import { QRCode, User as UserType, DateRangePreset, AnalyticsData, LinkClickStats } from '@/types';

const emptyAnalytics: AnalyticsData = {
  totalViews: 0,
  dailyAverage: 0,
  peakHour: 12,
  topDevice: 'desktop',
  viewsByDay: [],
  viewsByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, views: 0 })),
  viewsByDevice: [],
};

const emptyLinkClickStats: LinkClickStats = {
  totalClicks: 0,
  clicksByLink: [],
};

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations('analytics');

  // State
  const [codes, setCodes] = useState<QRCode[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [selectedCodeIds, setSelectedCodeIds] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('month');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>(emptyAnalytics);
  const [linkClickStats, setLinkClickStats] = useState<LinkClickStats>(emptyLinkClickStats);
  const [rsvpStats, setRSVPStats] = useState<RSVPStats>(emptyRSVPStats);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  // Check if any selected code is a Weekly Calendar code
  const selectedWeeklyCalendarCodes = codes
    .filter(code => selectedCodeIds.includes(code.id))
    .filter(code => code.media.some(m => m.type === 'weeklycal'))
    .map(code => code.id);

  const isSuperAdmin = user?.role === 'super_admin';

  // Load codes on mount
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const loadCodes = async () => {
      try {
        if (isSuperAdmin) {
          const [allCodes, users] = await Promise.all([
            getAllQRCodes(),
            getAllUsers(),
          ]);
          setCodes(allCodes);
          setAllUsers(users);
        } else {
          const userCodes = await getUserQRCodes(user.id);
          setCodes(userCodes);
        }
      } catch (error) {
        console.error('Error loading codes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCodes();
  }, [user, authLoading, router, isSuperAdmin]);

  // Subscribe to real-time analytics when codes or date range changes
  useEffect(() => {
    if (selectedCodeIds.length === 0) {
      setAnalyticsData(emptyAnalytics);
      setLinkClickStats(emptyLinkClickStats);
      setRSVPStats(emptyRSVPStats);
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    const { start, end } = getDateRange(datePreset, customStart, customEnd);

    // Subscribe to real-time view logs
    const unsubscribeViews = subscribeToViewLogs(
      selectedCodeIds,
      start,
      end,
      (logs) => {
        const data = aggregateAnalytics(logs);
        setAnalyticsData(data);
        setLoadingData(false);
      },
      (error) => {
        console.error('Error in analytics subscription:', error);
        setLoadingData(false);
      }
    );

    // Subscribe to real-time link clicks
    const unsubscribeClicks = subscribeToLinkClicks(
      selectedCodeIds,
      start,
      end,
      (clicks) => {
        const stats = aggregateLinkClicks(clicks);
        setLinkClickStats(stats);
      },
      (error) => {
        console.error('Error in link clicks subscription:', error);
      }
    );

    // Cleanup subscriptions on unmount or when dependencies change
    return () => {
      unsubscribeViews();
      unsubscribeClicks();
    };
  }, [selectedCodeIds, datePreset, customStart, customEnd]);

  // Build cell info map from selected Weekly Calendar codes
  const cellInfoMap = useMemo(() => {
    const infoMap: Record<string, CellInfo> = {};

    codes
      .filter(code => selectedWeeklyCalendarCodes.includes(code.id))
      .forEach(code => {
        const weeklycalMedia = code.media.find(m => m.type === 'weeklycal');
        const config = weeklycalMedia?.weeklycalConfig as WeeklyCalendarConfig | undefined;
        if (!config) return;

        // Extract cell info from all weeks
        config.weeks.forEach(week => {
          week.cells.forEach(cell => {
            // Find the time slot for this cell
            const timeSlot = week.timeSlots[cell.startSlotIndex];
            const endSlotIndex = cell.startSlotIndex + (cell.rowSpan || 1) - 1;
            const endTimeSlot = week.timeSlots[endSlotIndex];

            infoMap[cell.id] = {
              title: cell.title,
              time: timeSlot && endTimeSlot
                ? `${timeSlot.startTime} - ${endTimeSlot.endTime}`
                : timeSlot?.startTime,
              dayIndex: cell.dayIndex,
            };
          });
        });
      });

    return infoMap;
  }, [codes, selectedWeeklyCalendarCodes]);

  // Subscribe to RSVP registrations for Weekly Calendar codes
  useEffect(() => {
    if (selectedWeeklyCalendarCodes.length === 0) {
      setRSVPStats(emptyRSVPStats);
      return;
    }

    // Subscribe to real-time RSVP registrations
    const unsubscribeRSVP = subscribeToRSVPRegistrations(
      selectedWeeklyCalendarCodes,
      (registrations) => {
        const stats = aggregateRSVPStats(registrations, cellInfoMap);
        setRSVPStats(stats);
      },
      (error) => {
        console.error('Error in RSVP subscription:', error);
      }
    );

    return () => {
      unsubscribeRSVP();
    };
  }, [selectedWeeklyCalendarCodes.join(','), cellInfoMap]);

  // With real-time listeners, this just provides visual feedback
  // The data updates automatically
  const handleRefresh = () => {
    if (selectedCodeIds.length > 0) {
      setLoadingData(true);
      // Brief loading indicator for UX feedback
      setTimeout(() => setLoadingData(false), 500);
    }
  };

  const handleCustomRangeChange = (start: Date, end: Date) => {
    setCustomStart(start);
    setCustomEnd(end);
  };

  // Show loading while checking auth
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-accent/10">
                <BarChart3 className="w-6 h-6 text-accent" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-text-primary">{t('title')}</h1>
              {selectedCodeIds.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-500">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span className="text-xs font-medium">{t('live')}</span>
                </div>
              )}
            </div>
            <button
              onClick={handleRefresh}
              disabled={loadingData || selectedCodeIds.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-bg-secondary border border-border hover:bg-bg-hover transition-colors disabled:opacity-50 w-full sm:w-auto"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
              <span>{t('refresh')}</span>
            </button>
          </div>

          {/* Filters */}
          <div className="card p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('selectCodes')}
                </label>
                <CodeSelector
                  codes={codes}
                  selectedIds={selectedCodeIds}
                  onChange={setSelectedCodeIds}
                  isSuperAdmin={isSuperAdmin}
                  allUsers={allUsers}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('dateRange')}
                </label>
                <DateRangePicker
                  preset={datePreset}
                  customStart={customStart}
                  customEnd={customEnd}
                  onPresetChange={setDatePreset}
                  onCustomRangeChange={handleCustomRangeChange}
                />
              </div>
            </div>
          </div>

          {/* Content */}
          {selectedCodeIds.length === 0 ? (
            <div className="card p-12 text-center">
              <BarChart3 className="w-16 h-16 text-text-secondary mx-auto mb-4 opacity-50" />
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                {t('selectCodesPrompt')}
              </h2>
              <p className="text-text-secondary">
                {t('selectCodesDescription')}
              </p>
            </div>
          ) : loadingData ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : (
            <AnalyticsGridLayout
              sections={[
                {
                  id: 'metrics',
                  component: <MetricsCards data={analyticsData} />,
                  title: t('totalViews'),
                  visible: true,
                },
                {
                  id: 'views',
                  component: <ViewsChart data={analyticsData.viewsByDay} />,
                  title: t('viewsOverTime'),
                  visible: true,
                },
                {
                  id: 'hourly',
                  component: <HourlyChart data={analyticsData.viewsByHour} />,
                  title: t('viewsByHour'),
                  visible: true,
                },
                {
                  id: 'linkClicks',
                  component: <LinkClicksSection stats={linkClickStats} />,
                  title: t('linkClicks'),
                  visible: true,
                },
                {
                  id: 'rsvp',
                  component: <RSVPAnalyticsSection stats={rsvpStats} />,
                  title: 'RSVP',
                  visible: selectedWeeklyCalendarCodes.length > 0,
                },
              ]}
            />
          )}
    </div>
  );
}
