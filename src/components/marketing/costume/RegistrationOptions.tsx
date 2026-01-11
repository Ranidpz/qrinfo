'use client';

import { useTranslations } from 'next-intl';
import { Smartphone, Camera, Check, Sparkles } from 'lucide-react';

export default function RegistrationOptions() {
  const t = useTranslations('costumeCompetition.registration');
  const selfServiceBenefits = t.raw('selfService.benefits') as string[];
  const photoWallBenefits = t.raw('photoWall.benefits') as string[];

  return (
    <section className="py-20 md:py-28 bg-[var(--bg-primary)]">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-[var(--text-primary)]">
            {t('title')}
          </h2>
        </div>

        {/* Two-column comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Self-Service Option */}
          <div className="group relative p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10">
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r from-purple-500 to-pink-500" />

            {/* Icon */}
            <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Smartphone className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>

            {/* Title & Description */}
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
              {t('selfService.title')}
            </h3>
            <p className="text-[var(--text-secondary)] mb-6">
              {t('selfService.description')}
            </p>

            {/* Benefits list */}
            <ul className="space-y-3">
              {selfServiceBenefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="mt-0.5 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-green-500" strokeWidth={3} />
                  </div>
                  <span className="text-[var(--text-secondary)]">{benefit}</span>
                </li>
              ))}
            </ul>

            {/* Badge */}
            <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-400 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>ללא עלות נוספת</span>
            </div>
          </div>

          {/* Photo Wall Option */}
          <div className="group relative p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-amber-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10">
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r from-amber-500 to-orange-500" />

            {/* Premium badge */}
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold">
              PREMIUM
            </div>

            {/* Icon */}
            <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Camera className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>

            {/* Title & Description */}
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
              {t('photoWall.title')}
            </h3>
            <p className="text-[var(--text-secondary)] mb-6">
              {t('photoWall.description')}
            </p>

            {/* Benefits list */}
            <ul className="space-y-3">
              {photoWallBenefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="mt-0.5 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-green-500" strokeWidth={3} />
                  </div>
                  <span className="text-[var(--text-secondary)]">{benefit}</span>
                </li>
              ))}
            </ul>

            {/* Note */}
            <div className="mt-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              {t('photoWall.note')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
