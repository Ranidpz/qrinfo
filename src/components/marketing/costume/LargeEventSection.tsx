'use client';

import { useTranslations } from 'next-intl';
import { Users, Filter, Vote, ArrowDown, CheckCircle2 } from 'lucide-react';

export default function LargeEventSection() {
  const t = useTranslations('costumeCompetition.largeEvents');
  const flow = t.raw('flow') as string[];

  return (
    <section className="py-20 md:py-28 bg-[var(--bg-secondary)] overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-purple-500/10 border border-purple-500/30">
            <Users className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">600+ משתתפים</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-[var(--text-primary)]">
            {t('title')}
          </h2>
          <p className="text-xl text-[var(--text-secondary)]">
            {t('subtitle')}
          </p>
        </div>

        {/* Funnel visualization */}
        <div className="max-w-4xl mx-auto">
          <div className="relative flex flex-col items-center gap-6">
            {flow.map((step, index) => {
              const isFirst = index === 0;
              const isLast = index === flow.length - 1;
              const width = isFirst ? 'w-full' : isLast ? 'w-3/5' : 'w-4/5';
              const Icon = isFirst ? Users : isLast ? Vote : Filter;
              const gradient = isFirst
                ? 'from-purple-500/20 to-pink-500/20 border-purple-500/40'
                : isLast
                  ? 'from-green-500/20 to-emerald-500/20 border-green-500/40'
                  : 'from-amber-500/20 to-orange-500/20 border-amber-500/40';
              const iconColor = isFirst ? 'text-purple-400' : isLast ? 'text-green-400' : 'text-amber-400';

              return (
                <div key={index} className="w-full flex flex-col items-center">
                  {/* Step box */}
                  <div className={`${width} relative p-6 rounded-2xl bg-gradient-to-r ${gradient} border backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-[var(--bg-card)] flex items-center justify-center ${iconColor}`}>
                        <Icon className="w-6 h-6" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${iconColor}`}>
                            שלב {index + 1}
                          </span>
                        </div>
                        <p className="text-[var(--text-primary)] font-medium mt-1">
                          {step}
                        </p>
                      </div>
                      {isLast && (
                        <CheckCircle2 className="w-8 h-8 text-green-500" strokeWidth={1.5} />
                      )}
                    </div>
                  </div>

                  {/* Arrow connector */}
                  {index < flow.length - 1 && (
                    <div className="py-2">
                      <ArrowDown className="w-6 h-6 text-[var(--text-secondary)] animate-bounce" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Benefit callout */}
          <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 text-center">
            <div className="flex items-center justify-center gap-3 text-green-400">
              <CheckCircle2 className="w-6 h-6" />
              <p className="text-lg font-medium">{t('benefit')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
