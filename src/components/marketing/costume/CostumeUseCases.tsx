'use client';

import { useTranslations } from 'next-intl';
import { Building2, Music, Sun, Tent, GraduationCap, PartyPopper } from 'lucide-react';

const useCaseIcons = [Building2, Music, Sun, Tent, GraduationCap, PartyPopper];
const useCaseGradients = [
  'from-blue-500 to-indigo-500',
  'from-purple-500 to-pink-500',
  'from-amber-500 to-yellow-500',
  'from-green-500 to-teal-500',
  'from-orange-500 to-red-500',
  'from-pink-500 to-rose-500',
];

export default function CostumeUseCases() {
  const t = useTranslations('costumeCompetition.useCases');
  const useCases = t.raw('items') as Array<{ title: string; description: string }>;

  return (
    <section className="py-20 md:py-28 bg-[var(--bg-primary)]">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-[var(--text-primary)]">
            {t('title')}
          </h2>
        </div>

        {/* Use cases grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
          {useCases.map((useCase, index) => {
            const Icon = useCaseIcons[index];
            const gradient = useCaseGradients[index];

            return (
              <div
                key={index}
                className="group flex flex-col items-center text-center p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                {/* Icon */}
                <div className={`w-14 h-14 mb-4 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                  <Icon className="w-7 h-7 text-white" strokeWidth={1.5} />
                </div>

                {/* Content */}
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                  {useCase.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {useCase.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
