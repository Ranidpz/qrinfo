'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations, useLocale } from 'next-intl';
import { formatDate } from '@/lib/analytics';

interface ViewsChartProps {
  data: { date: string; views: number }[];
}

export default function ViewsChart({ data }: ViewsChartProps) {
  const t = useTranslations('analytics');
  const locale = useLocale();

  // Format data for display
  const chartData = data.map((item) => ({
    ...item,
    displayDate: formatDate(item.date, locale === 'he' ? 'he-IL' : 'en-US'),
  }));

  if (data.length === 0) {
    return (
      <div className="h-full flex flex-col min-h-0">
        <h3 className="text-lg font-semibold text-text-primary mb-4 shrink-0">{t('viewsOverTime')}</h3>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p className="text-text-secondary">{t('noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <h3 className="text-lg font-semibold text-text-primary mb-4 shrink-0">{t('viewsOverTime')}</h3>
      <div className="flex-1 min-h-0" dir="ltr">
        <ResponsiveContainer width="100%" height="100%" debounce={50} minHeight={150}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="displayDate"
              stroke="var(--text-secondary)"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
            />
            <YAxis
              stroke="var(--text-secondary)"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
              }}
              labelStyle={{ color: 'var(--text-secondary)' }}
              formatter={(value: number | undefined) => [value ?? 0, t('views')]}
            />
            <Line
              type="monotone"
              dataKey="views"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#3b82f6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
