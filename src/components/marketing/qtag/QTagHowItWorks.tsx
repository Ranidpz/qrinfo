'use client';

import { useTranslations } from 'next-intl';
import { Settings, Share2, UserPlus, ScanLine } from 'lucide-react';

const stepIcons = [Settings, Share2, UserPlus, ScanLine];
const stepGradients = [
  'from-orange-500 to-amber-500',
  'from-pink-500 to-rose-500',
  'from-purple-500 to-violet-500',
  'from-blue-500 to-cyan-500',
];

export default function QTagHowItWorks() {
  const t = useTranslations('qtagMarketing.howItWorks');
  const steps = t.raw('steps') as Array<{ number: string; title: string; description: string }>;

  return (
    <section id="howitworks" className="py-20 md:py-28 bg-[var(--bg-secondary)]">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-[var(--text-primary)]">
            {t('title')}
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Steps */}
        <div className="relative max-w-5xl mx-auto">
          {/* Connection line - desktop */}
          <div className="hidden lg:block absolute top-24 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-orange-500 via-pink-500 to-blue-500 opacity-30" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step, index) => {
              const Icon = stepIcons[index];
              const gradient = stepGradients[index];

              return (
                <div
                  key={index}
                  className="relative flex flex-col items-center text-center group"
                >
                  {/* Step number badge */}
                  <div className="absolute -top-3 right-4 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 lg:top-0 lg:right-4 lg:left-auto lg:translate-x-0 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 text-xs font-bold text-orange-300">
                    {step.number}
                  </div>

                  {/* Icon container */}
                  <div className={`relative w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br ${gradient} p-0.5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                    <div className="w-full h-full rounded-2xl bg-[var(--bg-card)] flex items-center justify-center">
                      <Icon className={`w-9 h-9 absolute text-orange-400 group-hover:text-pink-400 transition-colors`} strokeWidth={1.5} />
                    </div>
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-300`} />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-[220px]">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
