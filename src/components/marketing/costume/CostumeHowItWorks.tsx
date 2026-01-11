'use client';

import { useTranslations } from 'next-intl';
import { Camera, CheckCircle, Vote, BarChart3, Trophy } from 'lucide-react';

const stepIcons = [Camera, CheckCircle, Vote, BarChart3, Trophy];
const stepGradients = [
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-purple-500 to-pink-500',
  'from-orange-500 to-amber-500',
  'from-amber-400 to-yellow-500',
];

export default function CostumeHowItWorks() {
  const t = useTranslations('costumeCompetition.howItWorks');
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
          <div className="hidden lg:block absolute top-24 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 opacity-30" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-4">
            {steps.map((step, index) => {
              const Icon = stepIcons[index];
              const gradient = stepGradients[index];

              return (
                <div
                  key={index}
                  className="relative flex flex-col items-center text-center group"
                >
                  {/* Step number badge */}
                  <div className="absolute -top-3 right-4 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 lg:top-0 lg:right-4 lg:left-auto lg:translate-x-0 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-amber-500/20 border border-purple-500/30 text-xs font-bold text-purple-300">
                    {step.number}
                  </div>

                  {/* Icon container */}
                  <div className={`relative w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br ${gradient} p-0.5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                    <div className="w-full h-full rounded-2xl bg-[var(--bg-card)] flex items-center justify-center">
                      <Icon className={`w-9 h-9 bg-gradient-to-br ${gradient} bg-clip-text`} style={{ color: 'transparent', stroke: `url(#gradient-${index})` }} />
                      {/* Fallback color */}
                      <Icon className={`w-9 h-9 absolute text-purple-400 group-hover:text-amber-400 transition-colors`} strokeWidth={1.5} />
                    </div>
                    {/* Glow effect */}
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-300`} />
                  </div>

                  {/* Arrow connector - mobile/tablet */}
                  {index < steps.length - 1 && (
                    <div className="hidden sm:block lg:hidden absolute -bottom-4 left-1/2 -translate-x-1/2 text-purple-500/50">
                      <svg className="w-6 h-6 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  )}

                  {/* Content */}
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-[200px]">
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
