'use client';

import { Users, Calendar, UserCheck, TrendingUp, Clock } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { RSVPStats } from '@/lib/analytics';

interface RSVPAnalyticsSectionProps {
  stats: RSVPStats;
}

// Day names for display
const DAY_NAMES = {
  he: ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

export default function RSVPAnalyticsSection({ stats }: RSVPAnalyticsSectionProps) {
  const t = useTranslations('analytics');
  const locale = useLocale();
  const isRTL = locale === 'he';

  // Get day name by index
  const getDayName = (dayIndex?: number): string => {
    if (dayIndex === undefined) return '';
    return isRTL ? DAY_NAMES.he[dayIndex] : DAY_NAMES.en[dayIndex];
  };

  // Format date for display
  const formatWeekDate = (weekStartDate: string): string => {
    const date = new Date(weekStartDate);
    return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
      day: 'numeric',
      month: 'short',
    });
  };

  // Format date time for recent registrations
  const formatDateTime = (date: Date): string => {
    return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (stats.totalRegistrations === 0) {
    return (
      <div className="h-full flex flex-col min-h-0">
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="p-2 rounded-lg bg-green-500/10">
            <UserCheck className="w-5 h-5 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">
            {isRTL ? 'אישורי הגעה' : 'RSVP Registrations'}
          </h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-text-secondary">
          <UserCheck className="w-12 h-12 mb-3 opacity-30" />
          <p>{isRTL ? 'אין אישורי הגעה עדיין' : 'No RSVP registrations yet'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <UserCheck className="w-5 h-5 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">
            {isRTL ? 'אישורי הגעה' : 'RSVP Registrations'}
          </h3>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-auto space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-secondary rounded-xl p-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
            <UserCheck className="w-4 h-4" />
            <span>{isRTL ? 'אישרו הגעה' : 'Confirmed'}</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{stats.totalRegistrations}</p>
        </div>
        <div className="bg-bg-secondary rounded-xl p-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
            <Users className="w-4 h-4" />
            <span>{isRTL ? 'צפויים להגיע' : 'Expected'}</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{stats.totalAttendees}</p>
        </div>
        <div className="bg-bg-secondary rounded-xl p-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
            <Calendar className="w-4 h-4" />
            <span>{isRTL ? 'פעילויות' : 'Activities'}</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{stats.registrationsByCell.length}</p>
        </div>
        <div className="bg-bg-secondary rounded-xl p-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>{isRTL ? 'ממוצע לפעילות' : 'Avg per activity'}</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {stats.registrationsByCell.length > 0
              ? Math.round(stats.totalAttendees / stats.registrationsByCell.length)
              : 0}
          </p>
        </div>
      </div>

      {/* Registrations by Activity */}
      {stats.registrationsByCell.length > 0 && (
        <div>
          <h4 className="font-medium text-text-primary mb-3">
            {isRTL ? 'לפי פעילות' : 'By Activity'}
          </h4>
          <div className="space-y-2">
            {stats.registrationsByCell.slice(0, 10).map((item, index) => {
              const maxAttendees = Math.max(...stats.registrationsByCell.map(c => c.attendees));
              const percentage = maxAttendees > 0 ? (item.attendees / maxAttendees) * 100 : 0;

              return (
                <div key={item.cellId} className="relative">
                  <div
                    className="absolute inset-0 bg-green-500/10 rounded-lg transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                  <div className="relative flex items-center justify-between p-3 rounded-lg gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-sm font-medium text-text-secondary w-6 shrink-0">#{index + 1}</span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {item.cellTitle || item.cellId.substring(0, 12)}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          {item.cellTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {item.cellTime}
                            </span>
                          )}
                          {item.cellDayIndex !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-bg-secondary">
                              {getDayName(item.cellDayIndex)}
                            </span>
                          )}
                          <span>({formatWeekDate(item.weekStartDate)})</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-sm text-text-secondary hidden sm:block">
                        <span className="font-medium text-text-primary">{item.registrations}</span>
                        {' '}{isRTL ? 'אישרו' : 'confirmed'}
                      </div>
                      <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-600 text-sm font-bold min-w-[3rem] text-center">
                        {item.attendees}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Registrations by Week */}
      {stats.registrationsByWeek.length > 1 && (
        <div>
          <h4 className="font-medium text-text-primary mb-3">
            {isRTL ? 'לפי שבוע' : 'By Week'}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.registrationsByWeek.slice(0, 8).map((week) => (
              <div
                key={week.weekStartDate}
                className="bg-bg-secondary rounded-lg p-3 text-center"
              >
                <p className="text-xs text-text-secondary mb-1">
                  {isRTL ? 'שבוע' : 'Week'} {formatWeekDate(week.weekStartDate)}
                </p>
                <p className="text-lg font-bold text-text-primary">{week.attendees}</p>
                <p className="text-xs text-text-secondary">
                  {week.registrations} {isRTL ? 'אישורים' : 'confirmations'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Registrations */}
      {stats.recentRegistrations.length > 0 && (
        <div>
          <h4 className="font-medium text-text-primary mb-3">
            {isRTL ? 'אישורים אחרונים' : 'Recent Registrations'}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-2 px-2 text-sm font-medium text-text-secondary">
                    {isRTL ? 'מבקר' : 'Visitor'}
                  </th>
                  <th className="text-center py-2 px-2 text-sm font-medium text-text-secondary">
                    {isRTL ? 'מספר' : 'Count'}
                  </th>
                  <th className="text-start py-2 px-2 text-sm font-medium text-text-secondary">
                    {isRTL ? 'תאריך' : 'Date'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.recentRegistrations.map((reg) => (
                  <tr key={reg.id} className="border-b border-border/50 hover:bg-bg-secondary/50">
                    <td className="py-2 px-2 text-sm text-text-primary">
                      {reg.nickname || (isRTL ? 'אנונימי' : 'Anonymous')}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 font-bold text-sm">
                        {reg.count}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-sm text-text-secondary">
                      {formatDateTime(reg.registeredAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
