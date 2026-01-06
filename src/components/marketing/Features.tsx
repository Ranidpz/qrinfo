'use client';

import { useTranslations } from 'next-intl';
import { Link2, Calendar, BookOpen, Vote, Gamepad2, Camera, Mic2 } from 'lucide-react';

export default function Features() {
  const t = useTranslations('marketing.features');

  const features = [
    {
      icon: Link2,
      key: 'smartLinks',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Calendar,
      key: 'weeklySchedule',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: BookOpen,
      key: 'digitalBooklets',
      gradient: 'from-orange-500 to-amber-500',
    },
    {
      icon: Vote,
      key: 'voting',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: Gamepad2,
      key: 'gamification',
      gradient: 'from-red-500 to-rose-500',
    },
    {
      icon: Camera,
      key: 'selfieWall',
      gradient: 'from-indigo-500 to-violet-500',
    },
    {
      icon: Mic2,
      key: 'qstage',
      gradient: 'from-fuchsia-500 to-pink-500',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-[var(--bg-primary)]">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-2xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">
            {t('title')}
          </h2>
          <p className="text-base md:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={feature.key}
              className="group relative bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border)] hover:border-transparent transition-all duration-300 hover:shadow-xl overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Hover gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

              {/* Content */}
              <div className="relative">
                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg`}>
                  <feature.icon className="w-7 h-7 text-white" strokeWidth={1.5} />
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--accent)] transition-colors">
                  {t(`${feature.key}.title`)}
                </h3>

                {/* Description */}
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-4">
                  {t(`${feature.key}.description`)}
                </p>

                {/* Use case tag */}
                <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]">
                  {t(`${feature.key}.useCase`)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
