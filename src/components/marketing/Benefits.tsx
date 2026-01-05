'use client';

import { useTranslations } from 'next-intl';
import { RefreshCw, BarChart3, Languages, Ban, Plug } from 'lucide-react';

export default function Benefits() {
  const t = useTranslations('marketing.benefits');

  const benefits = [
    { icon: RefreshCw, key: 'realtime' },
    { icon: BarChart3, key: 'analytics' },
    { icon: Languages, key: 'bilingual' },
    { icon: Ban, key: 'adFree' },
    { icon: Plug, key: 'integrations' },
  ];

  return (
    <section className="py-16 md:py-24 bg-[var(--bg-primary)]">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-2xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">
            {t('title')}
          </h2>
        </div>

        {/* Benefits row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 max-w-6xl mx-auto">
          {benefits.map((benefit) => (
            <div
              key={benefit.key}
              className="group text-center"
            >
              {/* Icon circle */}
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:border-[var(--accent)] transition-all duration-300">
                <benefit.icon className="w-7 h-7 text-[var(--accent)] group-hover:text-white transition-colors duration-300" strokeWidth={1.5} />
              </div>

              {/* Title */}
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                {t(`${benefit.key}.title`)}
              </h3>

              {/* Description */}
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {t(`${benefit.key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
