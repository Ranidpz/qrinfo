'use client';

import { useTranslations } from 'next-intl';
import { QrCode, Sparkles, Share2, ArrowLeft } from 'lucide-react';

export default function HowItWorks() {
  const t = useTranslations('marketing.howItWorks');

  const steps = [
    {
      icon: QrCode,
      title: t('step1.title'),
      description: t('step1.description'),
      number: '01',
    },
    {
      icon: Sparkles,
      title: t('step2.title'),
      description: t('step2.description'),
      number: '02',
    },
    {
      icon: Share2,
      title: t('step3.title'),
      description: t('step3.description'),
      number: '03',
    },
  ];

  return (
    <section id="howitworks" className="py-16 md:py-24 bg-[var(--bg-secondary)]">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-2xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">
            {t('title')}
          </h2>
          <div className="w-16 h-1 bg-[var(--accent)] mx-auto rounded-full" />
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative group"
            >
              {/* Connector line (hidden on mobile and last item) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-0 right-0 h-[2px] bg-[var(--border)] -translate-x-1/2 rtl:translate-x-1/2 rtl:right-auto rtl:left-0">
                  <ArrowLeft className="absolute left-0 rtl:right-0 rtl:left-auto top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] rtl:rotate-180" />
                </div>
              )}

              <div className="relative bg-[var(--bg-card)] rounded-2xl p-6 md:p-8 border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[var(--accent)]/5 group-hover:-translate-y-1">
                {/* Step number */}
                <span className="absolute -top-3 -right-3 rtl:-left-3 rtl:right-auto w-10 h-10 flex items-center justify-center text-sm font-bold bg-[var(--accent)] text-white rounded-xl shadow-lg shadow-[var(--accent)]/25">
                  {step.number}
                </span>

                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <step.icon className="w-8 h-8 text-[var(--accent)]" strokeWidth={1.5} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-3">
                  {step.title}
                </h3>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
