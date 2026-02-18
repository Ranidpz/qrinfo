'use client';

import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import { Ticket, ScanLine, Users, ArrowLeft, ChevronDown } from 'lucide-react';

export default function QTagHero() {
  const t = useTranslations('qtagMarketing.hero');
  const locale = useLocale();

  return (
    <section className="relative min-h-[auto] md:min-h-[90vh] flex items-center justify-center overflow-hidden pt-20 pb-12 md:pt-16 md:pb-0">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/60 via-[var(--bg-primary)] to-purple-950/40" />

      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-pink-900/20" />

      {/* Floating decorative elements */}
      <div className="absolute inset-0 overflow-hidden opacity-30 dark:opacity-40 hidden md:block">
        <div className="absolute top-24 left-[8%] w-28 h-28 flex items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 rotate-12 animate-float-slow backdrop-blur-sm">
          <Ticket className="w-12 h-12 text-orange-400" strokeWidth={1.5} />
        </div>

        <div className="absolute top-32 right-[12%] w-24 h-24 flex items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 -rotate-6 animate-float-medium backdrop-blur-sm">
          <ScanLine className="w-10 h-10 text-pink-400" strokeWidth={1.5} />
        </div>

        <div className="absolute bottom-40 left-[15%] w-20 h-20 flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-orange-500/20 border border-purple-500/30 rotate-6 animate-float-fast backdrop-blur-sm">
          <Users className="w-8 h-8 text-purple-400" strokeWidth={1.5} />
        </div>

        <div className="absolute bottom-28 right-[18%] w-32 h-32 flex items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 -rotate-12 animate-float-slow backdrop-blur-sm">
          <Ticket className="w-14 h-14 text-orange-300" strokeWidth={1.5} />
        </div>

        <div className="absolute top-[45%] left-[5%] w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20 animate-float-medium backdrop-blur-sm">
          <ScanLine className="w-6 h-6 text-pink-300" strokeWidth={1.5} />
        </div>

        <div className="absolute top-[55%] right-[8%] w-18 h-18 flex items-center justify-center rounded-full bg-gradient-to-br from-purple-500/10 to-orange-500/10 border border-purple-500/20 animate-float-fast backdrop-blur-sm">
          <Users className="w-7 h-7 text-purple-300" strokeWidth={1.5} />
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 text-center">
        {/* Q Logo */}
        <div className="inline-flex items-center justify-center mb-6 md:mb-8 animate-fade-in">
          <div className="group relative cursor-pointer">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500/20 to-purple-500/20 blur-2xl scale-150 transition-all duration-500 ease-out group-hover:scale-[2] group-hover:opacity-80" />
            <div className="absolute inset-[-12px] rounded-full border-2 border-transparent bg-gradient-to-r from-orange-500/30 via-transparent to-purple-500/30 transition-all duration-700 group-hover:rotate-180" style={{ backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' }} />
            <Image
              src="/theQ.png"
              alt="The Q"
              width={140}
              height={140}
              className="relative drop-shadow-2xl transition-transform duration-300 group-hover:scale-105 w-[90px] h-[90px] md:w-[140px] md:h-[140px]"
            />
          </div>
        </div>

        {/* Subtitle badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-gradient-to-r from-orange-500/20 to-purple-500/20 border border-orange-500/30 backdrop-blur-sm animate-fade-in">
          <Ticket className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium bg-gradient-to-r from-orange-300 to-purple-300 bg-clip-text text-transparent">
            Q.Tag
          </span>
          <ScanLine className="w-4 h-4 text-purple-400" />
        </div>

        {/* Main headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 animate-fade-in-up">
          <span className="bg-gradient-to-r from-orange-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            {t('title')}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-[var(--text-secondary)] mb-4 animate-fade-in-up animation-delay-100">
          {t('subtitle')}
        </p>

        {/* Description */}
        <p className="text-base sm:text-lg md:text-xl text-[var(--text-secondary)] max-w-3xl mx-auto mb-10 animate-fade-in-up animation-delay-100 leading-relaxed">
          {t('description')}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-200">
          <a
            href={`/${locale}/dashboard?create=qtag`}
            className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-600 text-white font-semibold rounded-xl hover:from-orange-400 hover:to-pink-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-orange-500/25"
          >
            {t('cta')}
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1 rtl:rotate-180 rtl:group-hover:translate-x-1" />
          </a>
          <a
            href="#features"
            className="group inline-flex items-center gap-2 px-8 py-4 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] font-semibold rounded-xl hover:border-orange-500/50 hover:bg-orange-500/5 transition-all duration-300"
          >
            <ChevronDown className="w-5 h-5 text-orange-400" />
            {t('ctaSecondary')}
          </a>
        </div>

        {/* Trust indicators */}
        <div className="mt-12 md:mt-16 pb-8 md:pb-16 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-[var(--text-secondary)] animate-fade-in-up animation-delay-300">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-card)]/50 border border-[var(--border)]/50 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>{t('trust1')}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-card)]/50 border border-[var(--border)]/50 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>{t('trust2')}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-card)]/50 border border-[var(--border)]/50 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>{t('trust3')}</span>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="hidden md:block absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--bg-primary)] to-transparent" />
    </section>
  );
}
