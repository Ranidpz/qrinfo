'use client';

import { useTranslations } from 'next-intl';
import {
  Vote,
  UserPlus,
  Camera,
  Filter,
  Settings2,
  LayoutDashboard,
  Clock,
  Tablet,
  Palette,
  Shield
} from 'lucide-react';

const featureIcons = [Vote, UserPlus, Camera, Filter, Settings2, LayoutDashboard, Clock, Tablet, Palette, Shield];
const featureGradients = [
  'from-purple-500 to-pink-500',
  'from-blue-500 to-cyan-500',
  'from-orange-500 to-amber-500',
  'from-green-500 to-emerald-500',
  'from-indigo-500 to-violet-500',
  'from-red-500 to-rose-500',
  'from-fuchsia-500 to-pink-500',
  'from-cyan-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-green-500',
];

export default function CostumeFeatures() {
  const t = useTranslations('costumeCompetition.features');
  const features = t.raw('items') as Array<{ title: string; description: string }>;

  return (
    <section id="features" className="py-20 md:py-28 bg-[var(--bg-primary)]">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-[var(--text-primary)]">
            {t('title')}
          </h2>
          <p className="text-lg text-[var(--text-secondary)]">
            {t('subtitle')}
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
          {features.map((feature, index) => {
            const Icon = featureIcons[index];
            const gradient = featureGradients[index];

            return (
              <div
                key={index}
                className="group relative p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-transparent transition-all duration-300 hover:shadow-xl"
              >
                {/* Hover gradient border */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm`} />
                <div className="absolute inset-[1px] rounded-2xl bg-[var(--bg-card)] -z-10" />

                {/* Icon */}
                <div className={`w-14 h-14 mb-4 rounded-xl bg-gradient-to-br ${gradient} p-0.5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                  <div className="w-full h-full rounded-xl bg-[var(--bg-card)] flex items-center justify-center">
                    <Icon className="w-7 h-7 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" strokeWidth={1.5} />
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
