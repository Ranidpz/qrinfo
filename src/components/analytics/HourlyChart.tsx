'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations, useLocale } from 'next-intl';
import { formatHour } from '@/lib/analytics';

interface HourlyChartProps {
  data: { hour: number; views: number }[];
}

export default function HourlyChart({ data }: HourlyChartProps) {
  const t = useTranslations('analytics');
  const locale = useLocale();

  // Find peak hour for highlighting
  const maxViews = Math.max(...data.map((d) => d.views));

  // Format data for display
  const chartData = data.map((item) => ({
    ...item,
    displayHour: formatHour(item.hour),
  }));

  const hasData = data.some(d => d.views > 0);
  const hourLabel = locale === 'he' ? 'שעה' : 'Hour';

  if (!hasData) {
    return (
      <div className="h-full flex flex-col min-h-0">
        <h3 className="text-lg font-semibold text-text-primary mb-4 shrink-0">{t('viewsByHour')}</h3>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p className="text-text-secondary">{t('noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <h3 className="text-lg font-semibold text-text-primary mb-4 shrink-0">{t('viewsByHour')}</h3>
      <div className="flex-1 min-h-0" dir="ltr">
        <ResponsiveContainer width="100%" height="100%" debounce={50} minHeight={150}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="displayHour"
              stroke="var(--text-secondary)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              interval={2}
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
              labelFormatter={(label) => `${hourLabel} ${label}`}
              formatter={(value: number) => [value, t('views')]}
            />
            <Bar dataKey="views" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.views === maxViews && maxViews > 0 ? '#22c55e' : '#3b82f6'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
