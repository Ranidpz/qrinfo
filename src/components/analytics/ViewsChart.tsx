'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { formatDate } from '@/lib/analytics';

interface ViewsChartProps {
  data: { date: string; views: number }[];
  title?: string;
}

export default function ViewsChart({ data, title = 'צפיות לאורך זמן' }: ViewsChartProps) {
  // Format data for display
  const chartData = data.map((item) => ({
    ...item,
    displayDate: formatDate(item.date),
  }));

  if (data.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">{title}</h3>
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-text-secondary">אין נתונים להצגה</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">{title}</h3>
      <div className="overflow-x-auto" dir="ltr">
        <LineChart width={700} height={300} data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
            formatter={(value: number) => [value, 'צפיות']}
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
      </div>
    </div>
  );
}
