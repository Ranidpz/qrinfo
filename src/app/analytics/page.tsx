'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2, BarChart3, Radio } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import CodeSelector from '@/components/analytics/CodeSelector';
import DateRangePicker from '@/components/analytics/DateRangePicker';
import MetricsCards from '@/components/analytics/MetricsCards';
import ViewsChart from '@/components/analytics/ViewsChart';
import HourlyChart from '@/components/analytics/HourlyChart';
import DevicePieChart from '@/components/analytics/DevicePieChart';
import { getUserQRCodes, getAllUsers } from '@/lib/db';
import {
  getDateRange,
  aggregateAnalytics,
  getAllQRCodes,
  subscribeToViewLogs,
} from '@/lib/analytics';
import { QRCode, User, DateRangePreset, AnalyticsData } from '@/types';

const emptyAnalytics: AnalyticsData = {
  totalViews: 0,
  dailyAverage: 0,
  peakHour: 12,
  topDevice: 'desktop',
  viewsByDay: [],
  viewsByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, views: 0 })),
  viewsByDevice: [],
};

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [codes, setCodes] = useState<QRCode[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedCodeIds, setSelectedCodeIds] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('month');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>(emptyAnalytics);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

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
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    const { start, end } = getDateRange(datePreset, customStart, customEnd);

    // Subscribe to real-time updates
    const unsubscribe = subscribeToViewLogs(
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

    // Cleanup subscription on unmount or when dependencies change
    return () => {
      unsubscribe();
    };
  }, [selectedCodeIds, datePreset, customStart, customEnd]);

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
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userRole={user?.role}
      />

      <main className="pt-16 md:mr-64">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-accent/10">
                <BarChart3 className="w-6 h-6 text-accent" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary">אנליטיקס</h1>
              {selectedCodeIds.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-500">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span className="text-xs font-medium">חי</span>
                </div>
              )}
            </div>
            <button
              onClick={handleRefresh}
              disabled={loadingData || selectedCodeIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-secondary border border-border hover:bg-bg-hover transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">רענון</span>
            </button>
          </div>

          {/* Filters */}
          <div className="card p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  בחירת קודים
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
                  טווח תאריכים
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
                בחר קודים לצפייה באנליטיקס
              </h2>
              <p className="text-text-secondary">
                בחר קוד אחד או יותר מהרשימה למעלה כדי לראות את הסטטיסטיקות
              </p>
            </div>
          ) : loadingData ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Metrics Cards */}
              <MetricsCards data={analyticsData} />

              {/* Main Chart */}
              <ViewsChart data={analyticsData.viewsByDay} />

              {/* Secondary Charts */}
              <div className="grid md:grid-cols-2 gap-6">
                <HourlyChart data={analyticsData.viewsByHour} />
                <DevicePieChart data={analyticsData.viewsByDevice} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
