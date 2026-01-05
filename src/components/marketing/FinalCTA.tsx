'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, QrCode } from 'lucide-react';

export default function FinalCTA() {
  const t = useTranslations('marketing.finalCta');

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)]">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="relative max-w-3xl mx-auto text-center">
          {/* Background decoration */}
          <div className="absolute inset-0 -m-4 md:-m-8 rounded-3xl bg-[var(--accent)]/5 blur-3xl" />

          {/* Content */}
          <div className="relative bg-[var(--bg-card)] rounded-2xl md:rounded-3xl p-6 sm:p-10 md:p-14 border border-[var(--border)] shadow-2xl shadow-[var(--accent)]/5">
            {/* QR Icon */}
            <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 mb-4 md:mb-6 rounded-xl md:rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20">
              <QrCode className="w-6 h-6 md:w-8 md:h-8 text-[var(--accent)]" strokeWidth={1.5} />
            </div>

            {/* Title */}
            <h2 className="text-2xl md:text-4xl font-bold text-[var(--text-primary)] mb-3 md:mb-4">
              {t('title')}
            </h2>

            {/* Subtitle */}
            <p className="text-base md:text-lg text-[var(--text-secondary)] mb-6 md:mb-8 max-w-xl mx-auto">
              {t('subtitle')}
            </p>

            {/* CTA Button */}
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-[var(--accent)] text-white font-semibold rounded-xl hover:bg-[var(--accent-hover)] transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-[var(--accent)]/25"
            >
              {t('cta')}
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1 rtl:rotate-180 rtl:group-hover:translate-x-1" />
            </Link>

            {/* Bottom note */}
            <p className="mt-4 md:mt-6 text-xs md:text-sm text-[var(--text-secondary)]">
              ללא צורך בכרטיס אשראי • חינם להתחלה
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
