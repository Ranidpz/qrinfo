'use client';

import { Eye, TrendingUp, Clock, Smartphone } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { AnalyticsData } from '@/types';
import { formatHour } from '@/lib/analytics';

interface MetricsCardsProps {
  data: AnalyticsData;
}

export default function MetricsCards({ data }: MetricsCardsProps) {
  const t = useTranslations('analytics');
  const locale = useLocale();

  // Device labels based on locale
  const getDeviceLabel = (device: string) => {
    switch (device) {
      case 'desktop': return t('desktop');
      case 'mobile': return t('mobile');
      case 'tablet': return t('tablet');
      default: return device;
    }
  };

  const metrics = [
    {
      title: t('totalViews'),
      value: data.totalViews.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US'),
      icon: Eye,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: t('dailyAverage'),
      value: data.dailyAverage.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US'),
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: t('peakHour'),
      value: formatHour(data.peakHour),
      icon: Clock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: t('topDevice'),
      value: getDeviceLabel(data.topDevice),
      icon: Smartphone,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.title}
            className="card p-4 flex items-center gap-4"
          >
            <div className={`p-3 rounded-xl ${metric.bgColor}`}>
              <Icon className={`w-6 h-6 ${metric.color}`} />
            </div>
            <div>
              <p className="text-sm text-text-secondary">{metric.title}</p>
              <p className="text-2xl font-bold text-text-primary" dir="ltr">
                {metric.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
