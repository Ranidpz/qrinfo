'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ArrowUpRight, Play } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { ADDONS, CATALOG, CATEGORIES, type CatalogEntry, type ExperienceCategory } from '@/lib/experiences/catalog';
import { CONTACT } from '@/lib/landing/site';
import SocialLinks from '@/components/landing/SocialLinks';

// "חוויות שאפשר ליצור" = the one place that lists every experience ("חוויות The Q"), rendered
// from src/lib/experiences/catalog.ts. /[locale]/experiences redirects here (#features), and each
// card carries its catalogue id so /marketing#raffle lands on it. Cards with a landing page link to
// it; oLeague links out; the rest open WhatsApp - no dead links.

const GRADIENT: Record<ExperienceCategory, string> = {
  events: 'from-sky-500 to-blue-600',
  engagement: 'from-fuchsia-500 to-pink-500',
  games: 'from-amber-500 to-orange-500',
  tools: 'from-emerald-500 to-teal-600',
  rentals: 'from-violet-500 to-purple-600',
};

const wa = (text: string) => `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`;

function ExperienceCard({ entry: e, locale, onAddon }: { entry: CatalogEntry; locale: Locale; onAddon: (id: string) => void }) {
  const t = useTranslations('marketing.features');
  const Icon = e.icon;
  const name = e.name[locale];
  const href = e.landing ? `/${locale}${e.landing}` : e.externalUrl;
  const external = !e.landing && !!e.externalUrl;
  return (
    <li
      id={e.id}
      className="group relative flex h-full scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-transparent hover:shadow-xl target:ring-2 target:ring-[var(--accent)]"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${GRADIENT[e.category]} opacity-0 transition-opacity duration-300 group-hover:opacity-5`} />
      <div className="relative flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${GRADIENT[e.category]} shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
        </span>
        <h3 className="text-base font-semibold leading-snug text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
          {href ? (
            // stretched link: the whole card opens the page
            <a href={href} {...(external ? { target: '_blank', rel: 'noopener' } : {})} className="after:absolute after:inset-0">
              {name}
            </a>
          ) : (
            name
          )}
        </h3>
      </div>
      <div className="relative mt-3 flex flex-1 items-start gap-3">
        <p className="flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">{e.pitch[locale]}</p>
        {e.thumb && (
          <span className="relative h-24 w-[4.8rem] shrink-0 overflow-hidden rounded-xl bg-[#0b0e1d]">
            <Image src={e.thumb} alt="" fill sizes="80px" className="object-cover" />
          </span>
        )}
      </div>
      <div className="relative mt-3 flex flex-wrap gap-2">
        <span className="inline-flex w-fit items-center rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
          {e.tags[locale]}
        </span>
        {e.addons?.map((a) => (
          <a
            key={a}
            href={`#${a}`}
            onClick={(ev) => {
              ev.preventDefault();
              onAddon(a);
            }}
            className="relative z-10 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 hover:border-amber-500/70 dark:text-amber-300"
          >
            + {ADDONS[a][locale]}
          </a>
        ))}
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
        {e.landing ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--accent)]">
            {t('open')}
            <ArrowLeft className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
          </span>
        ) : external ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--accent)]">
            {t('external')}
            <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          </span>
        ) : (
          <a
            href={wa(e.contact?.whatsapp[locale] ?? t('whatsappText', { name }))}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 text-[#128C7E] hover:underline dark:text-[#25D366]"
          >
            {e.contact?.cta[locale] ?? t('talk')}
          </a>
        )}
        {e.demo && (
          <a
            href={e.demo}
            target="_blank"
            rel="noopener"
            className="relative z-10 inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {t('demo')}
          </a>
        )}
      </div>
    </li>
  );
}

export default function Features() {
  const t = useTranslations('marketing.features');
  const locale = (useLocale() === 'en' ? 'en' : 'he') as Locale;
  const [category, setCategory] = useState<ExperienceCategory | 'all'>('all');
  const entries = category === 'all' ? CATALOG : CATALOG.filter((e) => e.category === category);
  const tabs: { id: ExperienceCategory | 'all'; label: string }[] = [
    { id: 'all', label: t('all') },
    ...CATEGORIES.map((c) => ({ id: c.id, label: c.title[locale] })),
  ];

  // An add-on chip jumps to that item's own card (e.g. the buzzer under "rentals"), even when
  // another tab is filtering it out
  const showCard = (id: string) => {
    setCategory('all');
    requestAnimationFrame(() => {
      history.replaceState(null, '', `#${id}`);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

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
          {entries.map((e) => (
            <ExperienceCard key={e.id} entry={e} locale={locale} onAddon={showCard} />
          ))}
        </ul>

        {/* Real events: photos + videos on our social pages */}
        <div className="mx-auto mt-10 flex max-w-6xl flex-col items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 sm:flex-row sm:items-center sm:justify-between md:mt-14">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('eventsTitle')}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)] md:text-base">{t('eventsText')}</p>
          </div>
          <SocialLinks labels className="shrink-0" />
        </div>

        {/* Can't find it? */}
        <div className="mx-auto mt-4 flex max-w-6xl flex-col items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--text-secondary)] md:text-base">{t('footerNote')}</p>
          <a
            href={wa(t('missingWhatsapp'))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#25D366] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#1ebe5b]"
          >
            {t('missingCta')}
          </a>
        </div>
      </div>
    </section>
  );
}
