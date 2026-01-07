'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Mail, Calendar, MessageCircle } from 'lucide-react';

export default function Pricing() {
  const t = useTranslations('marketing.pricing');

  return (
    <section className="py-16 md:py-24 bg-[var(--bg-primary)]" id="pricing">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">
            {t('title')}
          </h2>
          <p className="text-base md:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Contact CTA Card */}
        <div className="max-w-2xl mx-auto">
          <div className="relative bg-gradient-to-br from-[var(--accent)]/5 to-[var(--accent)]/10 rounded-3xl p-8 md:p-12 border border-[var(--accent)]/20 overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--accent)]/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative text-center">
              {/* Icon */}
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-[var(--accent)]/30">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>

              {/* Title */}
              <h3 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3">
                {t('contactTitle')}
              </h3>

              {/* Description */}
              <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
                {t('contactDescription')}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-all shadow-lg shadow-[var(--accent)]/20 hover:shadow-xl hover:shadow-[var(--accent)]/30"
                >
                  <Mail className="w-5 h-5" />
                  {t('contactButton')}
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--bg-card)] text-[var(--text-primary)] font-medium border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
                >
                  <Calendar className="w-5 h-5" />
                  {t('demoButton')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
