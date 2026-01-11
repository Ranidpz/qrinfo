'use client';

import { useTranslations } from 'next-intl';
import { Shield, Smartphone, MessageSquare, ListChecks, Lock } from 'lucide-react';

const levelIcons = [Smartphone, MessageSquare, ListChecks];
const levelGradients = [
  'from-blue-500 to-cyan-500',
  'from-purple-500 to-pink-500',
  'from-amber-500 to-orange-500',
];
const levelBadges = ['בסיסי', 'מתקדם', 'מקסימום'];
const levelBadgeColors = [
  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'bg-amber-500/20 text-amber-400 border-amber-500/30',
];

export default function CostumeSecurity() {
  const t = useTranslations('costumeCompetition.security');
  const levels = t.raw('levels') as Array<{ level: string; method: string; description: string }>;

  return (
    <section className="py-20 md:py-28 bg-[var(--bg-secondary)]">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500">
            <Shield className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-[var(--text-primary)]">
            {t('title')}
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Security levels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {levels.map((level, index) => {
            const Icon = levelIcons[index];
            const gradient = levelGradients[index];
            const badgeColor = levelBadgeColors[index];

            return (
              <div
                key={index}
                className="group relative p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-green-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/10"
              >
                {/* Level indicator */}
                <div className="absolute top-4 right-4 flex items-center gap-1">
                  {[...Array(index + 1)].map((_, i) => (
                    <Lock key={i} className="w-4 h-4 text-green-500" fill="currentColor" />
                  ))}
                  {[...Array(2 - index)].map((_, i) => (
                    <Lock key={i} className="w-4 h-4 text-[var(--text-secondary)]/30" />
                  ))}
                </div>

                {/* Badge */}
                <div className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${badgeColor} mb-6`}>
                  {level.level}
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br ${gradient} p-0.5 group-hover:scale-110 transition-transform duration-300`}>
                  <div className="w-full h-full rounded-2xl bg-[var(--bg-card)] flex items-center justify-center">
                    <Icon className="w-8 h-8 text-[var(--text-primary)]" strokeWidth={1.5} />
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">
                  {level.method}
                </h3>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  {level.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
