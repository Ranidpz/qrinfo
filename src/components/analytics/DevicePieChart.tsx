'use client';

import { PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import { useTranslations } from 'next-intl';

interface DevicePieChartProps {
  data: { device: string; views: number }[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b'];

export default function DevicePieChart({ data }: DevicePieChartProps) {
  const t = useTranslations('analytics');

  // Get device label based on translation
  const getDeviceLabel = (device: string) => {
    switch (device) {
      case 'desktop': return t('desktop');
      case 'mobile': return t('mobile');
      case 'tablet': return t('tablet');
      default: return device;
    }
  };

  // Format data with translated labels
  const chartData = data.map((item) => ({
    ...item,
    name: getDeviceLabel(item.device),
  }));

  const total = data.reduce((sum, item) => sum + item.views, 0);

  if (total === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">{t('deviceDistribution')}</h3>
        <div className="h-[250px] flex items-center justify-center">
          <p className="text-text-secondary">{t('noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">{t('deviceDistribution')}</h3>
      <div className="flex justify-center" dir="ltr">
        <PieChart width={300} height={250}>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="views"
            nameKey="name"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
            }}
            formatter={(value: number | undefined, name: string | undefined) => [
              `${value ?? 0} (${Math.round(((value ?? 0) / total) * 100)}%)`,
              name ?? '',
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-text-primary text-sm">{value}</span>}
          />
        </PieChart>
      </div>
    </div>
  );
}
