'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { CATALOG, CATEGORIES, type ExperienceCategory } from '@/lib/experiences/catalog';
import { landingPath } from '@/lib/landing/site';

// "חוויות שאפשר ליצור": rendered from the same catalogue as the "חוויות The Q" hub
// (src/lib/experiences/catalog.ts), so the two never drift. Each card opens the experience's
// landing page, or its card on the hub.

const GRADIENT: Record<ExperienceCategory, string> = {
  events: 'from-sky-500 to-blue-600',
  engagement: 'from-fuchsia-500 to-pink-500',
  games: 'from-amber-500 to-orange-500',
  tools: 'from-emerald-500 to-teal-600',
  rentals: 'from-violet-500 to-purple-600',
};

export default function Features() {
  const t = useTranslations('marketing.features');
  const locale = (useLocale() === 'en' ? 'en' : 'he') as Locale;
  const [category, setCategory] = useState<ExperienceCategory | 'all'>('all');
  const entries = category === 'all' ? CATALOG : CATALOG.filter((e) => e.category === category);
  const tabs: { id: ExperienceCategory | 'all'; label: string }[] = [
    { id: 'all', label: t('all') },
    ...CATEGORIES.map((c) => ({ id: c.id, label: c.title[locale] })),
  ];

  return (
    <section className="py-16 md:py-24 bg-[var(--bg-primary)]">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-8 md:mb-10">
          <h2 className="text-2xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">{t('title')}</h2>
          <p className="text-base md:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>

        {/* Category filter */}
        <div role="tablist" aria-label={t('title')} className="mb-8 flex flex-wrap justify-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={category === tab.id}
              onClick={() => setCategory(tab.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                category === tab.id
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Experience cards */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 max-w-6xl mx-auto">
          {entries.map((e) => {
            const Icon = e.icon;
            const href = e.landing ? `/${locale}${e.landing}` : `${landingPath(locale)}#${e.id}`;
            return (
              <li key={e.id}>
                <a
                  href={href}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-transparent hover:shadow-xl"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENT[e.category]} opacity-0 transition-opacity duration-300 group-hover:opacity-5`} />
                  <div className="relative flex items-center gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${GRADIENT[e.category]} shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                      <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
                    </span>
                    <h3 className="text-base font-semibold leading-snug text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
                      {e.name[locale]}
                    </h3>
                  </div>
                  <p className="relative mt-3 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">{e.pitch[locale]}</p>
                  <span className="relative mt-3 inline-flex w-fit items-center rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                    {e.tags[locale]}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>

        {/* All experiences + footer note */}
        <div className="text-center mt-10 md:mt-14 space-y-4">
          <a
            href={landingPath(locale)}
            className="inline-flex items-center gap-2 text-base font-semibold text-[var(--accent)] hover:underline"
          >
            {t('allExperiences')}
            <ArrowLeft className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
          </a>
          <p className="text-[var(--text-secondary)] text-sm md:text-base max-w-2xl mx-auto">{t('footerNote')}</p>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            {t('contactUs')}
          </a>
        </div>
      </div>
    </section>
  );
}
