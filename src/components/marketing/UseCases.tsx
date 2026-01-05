'use client';

import { useTranslations } from 'next-intl';
import { Film, Hotel, PartyPopper, Landmark, UtensilsCrossed, Building } from 'lucide-react';

export default function UseCases() {
  const t = useTranslations('marketing.useCases');

  const useCases = [
    { icon: Film, key: 'productions' },
    { icon: Hotel, key: 'hotels' },
    { icon: PartyPopper, key: 'events' },
    { icon: Landmark, key: 'museums' },
    { icon: UtensilsCrossed, key: 'restaurants' },
    { icon: Building, key: 'corporate' },
  ];

  return (
    <section className="py-16 md:py-24 bg-[var(--bg-secondary)]">
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

        {/* Use cases grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 max-w-5xl mx-auto">
          {useCases.map((useCase, index) => (
            <div
              key={useCase.key}
              className="group flex items-start gap-4 p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/5 transition-all duration-300"
            >
              {/* Icon */}
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center group-hover:bg-[var(--accent)] transition-colors duration-300">
                <useCase.icon className="w-6 h-6 text-[var(--accent)] group-hover:text-white transition-colors duration-300" strokeWidth={1.5} />
              </div>

              {/* Content */}
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                  {t(`${useCase.key}.title`)}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {t(`${useCase.key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
