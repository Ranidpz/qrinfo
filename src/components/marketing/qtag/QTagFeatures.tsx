'use client';

import { useTranslations } from 'next-intl';
import { Camera, QrCode, ScanLine, ShieldCheck, BarChart3, UserPlus, FileSpreadsheet, Image as ImageIcon } from 'lucide-react';

const featureIcons = [Camera, QrCode, ScanLine, ShieldCheck, BarChart3, UserPlus, FileSpreadsheet, ImageIcon];
const featureGradients = [
  'from-orange-500 to-amber-500',
  'from-pink-500 to-rose-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-purple-500 to-violet-500',
  'from-indigo-500 to-blue-500',
  'from-amber-500 to-yellow-500',
  'from-rose-500 to-pink-500',
];

export default function QTagFeatures() {
  const t = useTranslations('qtagMarketing.features');
  const items = t.raw('items') as Array<{ title: string; description: string }>;

  return (
    <section id="features" className="py-20 md:py-28 bg-[var(--bg-primary)]">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-[var(--text-primary)]">
            {t('title')}
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {items.map((item, index) => {
            const Icon = featureIcons[index];
            const gradient = featureGradients[index];

            return (
              <div
                key={index}
                className="group relative p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-orange-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/5"
              >
                {/* Icon */}
                <div className={`w-12 h-12 mb-4 rounded-xl bg-gradient-to-br ${gradient} p-0.5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                  <div className="w-full h-full rounded-xl bg-[var(--bg-card)] flex items-center justify-center">
                    <Icon className="w-6 h-6 text-orange-400 group-hover:text-pink-400 transition-colors" strokeWidth={1.5} />
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
