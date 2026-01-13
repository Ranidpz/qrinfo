'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Drama, Sparkles, Crown, ArrowLeft } from 'lucide-react';

export default function CostumeHero() {
  const t = useTranslations('costumeCompetition.hero');

  return (
    <section className="relative min-h-[auto] md:min-h-[90vh] flex items-center justify-center overflow-hidden pt-20 pb-12 md:pt-16 md:pb-0">
      {/* Gradient background with Purim colors */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-[var(--bg-primary)] to-amber-950/30" />

      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-purple-900/20" />

      {/* Floating decorative elements - masks and crowns */}
      <div className="absolute inset-0 overflow-hidden opacity-30 dark:opacity-40 hidden md:block">
        {/* Top left - Drama mask */}
        <div className="absolute top-24 left-[8%] w-28 h-28 flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rotate-12 animate-float-slow backdrop-blur-sm">
          <Drama className="w-12 h-12 text-purple-400" strokeWidth={1.5} />
        </div>

        {/* Top right - Crown */}
        <div className="absolute top-32 right-[12%] w-24 h-24 flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 -rotate-6 animate-float-medium backdrop-blur-sm">
          <Crown className="w-10 h-10 text-amber-400" strokeWidth={1.5} />
        </div>

        {/* Bottom left - Sparkles */}
        <div className="absolute bottom-40 left-[15%] w-20 h-20 flex items-center justify-center rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 rotate-6 animate-float-fast backdrop-blur-sm">
          <Sparkles className="w-8 h-8 text-pink-400" strokeWidth={1.5} />
        </div>

        {/* Bottom right - Drama mask */}
        <div className="absolute bottom-28 right-[18%] w-32 h-32 flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30 -rotate-12 animate-float-slow backdrop-blur-sm">
          <Drama className="w-14 h-14 text-amber-300" strokeWidth={1.5} />
        </div>

        {/* Extra decorative - small sparkle */}
        <div className="absolute top-[45%] left-[5%] w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 animate-float-medium backdrop-blur-sm">
          <Sparkles className="w-6 h-6 text-purple-300" strokeWidth={1.5} />
        </div>

        {/* Extra decorative - small crown */}
        <div className="absolute top-[55%] right-[8%] w-18 h-18 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 animate-float-fast backdrop-blur-sm">
          <Crown className="w-7 h-7 text-amber-300" strokeWidth={1.5} />
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 text-center">
        {/* Q Logo with Purim glow effect */}
        <div className="inline-flex items-center justify-center mb-6 md:mb-8 animate-fade-in">
          <div className="group relative cursor-pointer">
            {/* Outer glow ring - purple/gold gradient */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/20 to-amber-500/20 blur-2xl scale-150 transition-all duration-500 ease-out group-hover:scale-[2] group-hover:opacity-80" />
            {/* Rotating accent ring */}
            <div className="absolute inset-[-12px] rounded-full border-2 border-transparent bg-gradient-to-r from-purple-500/30 via-transparent to-amber-500/30 transition-all duration-700 group-hover:rotate-180" style={{ backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' }} />
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
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-gradient-to-r from-purple-500/20 to-amber-500/20 border border-purple-500/30 backdrop-blur-sm animate-fade-in">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium bg-gradient-to-r from-purple-300 to-amber-300 bg-clip-text text-transparent">
            {t('subtitle')}
          </span>
          <Sparkles className="w-4 h-4 text-purple-400" />
        </div>

        {/* Main headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in-up">
          <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">
            {t('title')}
          </span>
        </h1>

        {/* Description */}
        <p className="text-lg sm:text-xl md:text-2xl text-[var(--text-secondary)] max-w-3xl mx-auto mb-10 animate-fade-in-up animation-delay-100 leading-relaxed">
          {t('description')}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-200">
          <a
            href="mailto:info@playzone.co.il?subject=תחרות תחפושות - בקשת הצעת מחיר"
            className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-purple-600 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/25"
          >
            {t('cta')}
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1 rtl:rotate-180 rtl:group-hover:translate-x-1" />
          </a>
          <a
            href="https://wa.me/972773006306"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-8 py-4 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] font-semibold rounded-xl hover:border-purple-500/50 hover:bg-purple-500/5 transition-all duration-300"
          >
            <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
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
