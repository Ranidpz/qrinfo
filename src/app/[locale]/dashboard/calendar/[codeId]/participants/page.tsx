'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Phone,
  ArrowLeft,
  Download,
  RefreshCw,
  QrCode,
  Loader2,
} from 'lucide-react';

interface Registration {
  id: string;
  cellId: string;
  visitorId: string;
  nickname: string;
  phone: string;
  count: number;
  avatarUrl?: string;
  avatarType: 'photo' | 'emoji' | 'none';
  qrToken: string;
  isVerified: boolean;
  checkedIn: boolean;
  checkedInAt?: string;
  boothDate?: string;
  boothId?: string;
  registeredAt: string;
}

interface ActivityInfo {
  cellId: string;
  title: string;
  time: string;
  boothName: string;
  backgroundColor: string;
}

type FilterStatus = 'all' | 'verified' | 'pending' | 'checkedIn';

export default function ParticipantsListPage() {
  const params = useParams();
  const router = useRouter();
  const codeId = params.codeId as string;
  const locale = (params.locale as string) || 'he';
  const isRTL = locale === 'he';

  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [activities, setActivities] = useState<Record<string, ActivityInfo>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterActivity, setFilterActivity] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch registrations
  const fetchRegistrations = async () => {
    try {
      const response = await fetch(`/api/weeklycal/register?codeId=${codeId}`);
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setRegistrations(data.registrations || []);
    } catch (error) {
      console.error('Error fetching registrations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch code config for activity info
  const fetchCodeConfig = async () => {
    try {
      const response = await fetch(`/api/codes/${codeId}`);
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      const config = data.config;

      // Build activities map from booth days
      const activitiesMap: Record<string, ActivityInfo> = {};

      if (config?.boothDays) {
        for (const day of config.boothDays) {
          const booths = day.booths?.length > 0 ? day.booths : config.defaultBooths || [];
          for (const booth of booths) {
            for (const cell of booth.cells || []) {
              activitiesMap[cell.id] = {
                cellId: cell.id,
                title: cell.title || '',
                time: cell.startTime && cell.endTime ? `${cell.startTime}-${cell.endTime}` : '',
                boothName: booth.name || '',
                backgroundColor: cell.backgroundColor || '#3B82F6',
              };
            }
          }
        }
      }

      setActivities(activitiesMap);
    } catch (error) {
      console.error('Error fetching code config:', error);
    }
  };

  useEffect(() => {
    fetchRegistrations();
    fetchCodeConfig();
  }, [codeId]);

  // Refresh handler
  const handleRefresh = () => {
    setRefreshing(true);
    fetchRegistrations();
  };

  // Filter registrations
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = reg.nickname?.toLowerCase().includes(query);
        const matchesPhone = reg.phone?.includes(query);
        if (!matchesName && !matchesPhone) return false;
      }

      // Status filter
      if (filterStatus === 'verified' && !reg.isVerified) return false;
      if (filterStatus === 'pending' && reg.isVerified) return false;
      if (filterStatus === 'checkedIn' && !reg.checkedIn) return false;

      // Activity filter
      if (filterActivity !== 'all' && reg.cellId !== filterActivity) return false;

      return true;
    });
  }, [registrations, searchQuery, filterStatus, filterActivity]);

  // Get unique activities for filter
  const uniqueActivities = useMemo(() => {
    const activityIds = [...new Set(registrations.map((r) => r.cellId))];
    return activityIds.map((id) => ({
      id,
      title: activities[id]?.title || id,
    }));
  }, [registrations, activities]);

  // Stats
  const stats = useMemo(() => {
    const total = registrations.length;
    const verified = registrations.filter((r) => r.isVerified).length;
    const pending = registrations.filter((r) => !r.isVerified).length;
    const checkedIn = registrations.filter((r) => r.checkedIn).length;
    const totalPeople = registrations.reduce((sum, r) => sum + (r.count || 1), 0);
    return { total, verified, pending, checkedIn, totalPeople };
  }, [registrations]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Name', 'Phone', 'Count', 'Activity', 'Status', 'Checked In', 'Registered At'];
    const rows = filteredRegistrations.map((reg) => [
      reg.nickname || '',
      reg.phone || '',
      reg.count || 1,
      activities[reg.cellId]?.title || reg.cellId,
      reg.isVerified ? 'Verified' : 'Pending',
      reg.checkedIn ? 'Yes' : 'No',
      reg.registeredAt ? new Date(reg.registeredAt).toLocaleString() : '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `participants-${codeId}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Get status badge
  const getStatusBadge = (reg: Registration) => {
    if (reg.checkedIn) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          <CheckCircle2 className="w-3 h-3" />
          {isRTL ? 'נכנס' : 'Checked In'}
        </span>
      );
    }
    if (reg.isVerified) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          <CheckCircle2 className="w-3 h-3" />
          {isRTL ? 'מאומת' : 'Verified'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
        <Clock className="w-3 h-3" />
        {isRTL ? 'ממתין' : 'Pending'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
          <p className="mt-4 text-gray-600">{isRTL ? 'טוען...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {isRTL ? 'רשימת משתתפים' : 'Participants List'}
                </h1>
                <p className="text-sm text-gray-500">
                  {isRTL
                    ? `${stats.totalPeople} אנשים ב-${stats.total} הרשמות`
                    : `${stats.totalPeople} people in ${stats.total} registrations`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={() => router.push(`/${locale}/dashboard/calendar/${codeId}/checkin`)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">{isRTL ? 'סורק' : 'Scanner'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">{isRTL ? 'הרשמות' : 'Registrations'}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{stats.verified}</div>
            <div className="text-sm text-gray-500">{isRTL ? 'מאומתים' : 'Verified'}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-500">{isRTL ? 'ממתינים' : 'Pending'}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">{stats.checkedIn}</div>
            <div className="text-sm text-gray-500">{isRTL ? 'נכנסו' : 'Checked In'}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 pb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRTL ? 'חיפוש לפי שם או טלפון...' : 'Search by name or phone...'}
                className="w-full ps-10 pe-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{isRTL ? 'כל הסטטוסים' : 'All Statuses'}</option>
              <option value="verified">{isRTL ? 'מאומתים' : 'Verified'}</option>
              <option value="pending">{isRTL ? 'ממתינים' : 'Pending'}</option>
              <option value="checkedIn">{isRTL ? 'נכנסו' : 'Checked In'}</option>
            </select>

            {/* Activity Filter */}
            <select
              value={filterActivity}
              onChange={(e) => setFilterActivity(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{isRTL ? 'כל הפעילויות' : 'All Activities'}</option>
              {uniqueActivities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Participants List */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {filteredRegistrations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>{isRTL ? 'לא נמצאו משתתפים' : 'No participants found'}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredRegistrations.map((reg) => {
                const activity = activities[reg.cellId];
                return (
                  <div
                    key={reg.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {reg.avatarType === 'emoji' && reg.avatarUrl ? (
                          <div className="w-12 h-12 text-3xl flex items-center justify-center bg-gray-100 rounded-full">
                            {reg.avatarUrl}
                          </div>
                        ) : reg.avatarType === 'photo' && reg.avatarUrl ? (
                          <div className="w-12 h-12 rounded-full overflow-hidden">
                            <img
                              src={reg.avatarUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                            <Users className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 truncate">
                            {reg.nickname || (isRTL ? 'אנונימי' : 'Anonymous')}
                          </span>
                          {reg.count > 1 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              +{reg.count - 1}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {reg.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {reg.phone}
                            </span>
                          )}
                          {activity && (
                            <span
                              className="px-2 py-0.5 rounded text-xs text-white"
                              style={{ backgroundColor: activity.backgroundColor }}
                            >
                              {activity.title}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex-shrink-0">
                        {getStatusBadge(reg)}
                      </div>
                    </div>

                    {/* Check-in time */}
                    {reg.checkedIn && reg.checkedInAt && (
                      <div className="mt-2 text-xs text-gray-400 ps-16">
                        {isRTL ? 'נכנס ב-' : 'Checked in at '}
                        {new Date(reg.checkedInAt).toLocaleString(
                          locale === 'he' ? 'he-IL' : 'en-US',
                          { hour: '2-digit', minute: '2-digit' }
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
