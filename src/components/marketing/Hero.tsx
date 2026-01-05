'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { QrCode, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

export default function Hero() {
  const t = useTranslations('marketing.hero');

  return (
    <section className="relative min-h-[85vh] md:min-h-[90vh] flex items-center justify-center overflow-hidden pt-16 md:pt-16">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)]" />

      {/* Floating QR pattern - hidden on mobile, visible on tablet+ */}
      <div className="absolute inset-0 overflow-hidden opacity-20 dark:opacity-30 hidden md:block">
        <div className="absolute top-20 left-[10%] w-32 h-32 flex items-center justify-center rounded-2xl bg-[var(--bg-card)]/50 border border-[var(--border)] rotate-12 animate-float-slow">
          <QrCode className="w-12 h-12 text-[var(--accent)]" strokeWidth={1} />
        </div>
        <div className="absolute top-40 right-[15%] w-24 h-24 flex items-center justify-center rounded-xl bg-[var(--bg-card)]/50 border border-[var(--border)] -rotate-6 animate-float-medium">
          <QrCode className="w-10 h-10 text-[var(--accent)]" strokeWidth={1} />
        </div>
        <div className="absolute bottom-32 left-[20%] w-20 h-20 flex items-center justify-center rounded-lg bg-[var(--bg-card)]/50 border border-[var(--border)] rotate-3 animate-float-fast">
          <QrCode className="w-8 h-8 text-[var(--accent)]" strokeWidth={1} />
        </div>
        <div className="absolute bottom-20 right-[25%] w-28 h-28 flex items-center justify-center rounded-2xl bg-[var(--bg-card)]/50 border border-[var(--border)] -rotate-12 animate-float-slow">
          <QrCode className="w-11 h-11 text-[var(--accent)]" strokeWidth={1} />
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 text-center">
        {/* Q Logo with hover effect - clickable to scroll to How It Works */}
        <a href="#howitworks" className="inline-flex items-center justify-center mb-6 md:mb-8 animate-fade-in">
          <div className="group relative cursor-pointer">
            {/* Glow ring - appears on hover */}
            <div className="absolute inset-0 rounded-full bg-[var(--accent)]/0 group-hover:bg-[var(--accent)]/10 blur-xl scale-150 transition-all duration-500 ease-out group-hover:scale-[1.8]" />
            {/* Subtle rotating ring */}
            <div className="absolute inset-[-8px] rounded-full border-2 border-transparent group-hover:border-[var(--accent)]/20 transition-all duration-500 group-hover:rotate-90 group-hover:scale-110" />
            {/* Inner pulse ring */}
            <div className="absolute inset-[-4px] rounded-full border border-transparent group-hover:border-[var(--accent)]/30 transition-all duration-300 group-hover:scale-105" />
            <Image
              src="/theQ.png"
              alt="The Q"
              width={150}
              height={150}
              className="relative drop-shadow-2xl transition-transform duration-300 group-hover:scale-105 w-[100px] h-[100px] md:w-[150px] md:h-[150px]"
            />
          </div>
        </a>

        {/* Main headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in-up">
          <span className="text-[var(--text-primary)]">{t('title')}</span>
          <br />
          <span className="text-[var(--accent)] relative">
            {t('titleHighlight')}
            <svg className="absolute -bottom-2 left-0 w-full h-3 text-[var(--accent)]/20" viewBox="0 0 200 12" preserveAspectRatio="none">
              <path d="M0,6 Q50,0 100,6 T200,6" fill="none" stroke="currentColor" strokeWidth="4" />
            </svg>
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl md:text-2xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 animate-fade-in-up animation-delay-100">
          {t('subtitle')}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-200">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 px-8 py-4 bg-[var(--accent)] text-white font-semibold rounded-xl hover:bg-[var(--accent-hover)] transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-[var(--accent)]/25"
          >
            {t('cta')}
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1 rtl:rotate-180 rtl:group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Trust indicators */}
        <div className="mt-10 md:mt-16 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-[var(--text-secondary)] animate-fade-in-up animation-delay-300">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>ללא פרסומות</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>עדכון בזמן אמת</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>בטוח להדפסה</span>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 md:h-32 bg-gradient-to-t from-[var(--bg-primary)] to-transparent" />
    </section>
  );
}
