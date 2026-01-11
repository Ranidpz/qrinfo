'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeft, Calendar, Mail, Sparkles } from 'lucide-react';

export default function CostumeCTA() {
  const t = useTranslations('costumeCompetition.cta');

  return (
    <section className="py-20 md:py-28 bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-amber-900/20" />

      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Urgency badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 animate-pulse">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-bold text-amber-300">{t('note')}</span>
          </div>

          {/* Main headline */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">
              {t('title')}
            </span>
          </h2>

          {/* Subtitle */}
          <p className="text-xl text-[var(--text-secondary)] mb-10 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:info@playzone.co.il?subject=תחרות תחפושות פורים 2026 - בקשת הצעת מחיר"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/30"
            >
              <Mail className="w-5 h-5" />
              {t('primary')}
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1 rtl:rotate-180 rtl:group-hover:translate-x-1" />
            </a>
            <a
              href="https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ3GXgJGDnAJxdLc0wC-tQVixJxLLl_yDDWX3t7h2fRJPSIoFMjFv0aYHvhFHqLXKELXfYqFWiMq"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] font-semibold rounded-xl hover:border-amber-500/50 hover:bg-amber-500/5 transition-all duration-300"
            >
              <Calendar className="w-5 h-5 text-amber-400" />
              {t('secondary')}
            </a>
          </div>

          {/* WhatsApp alternative */}
          <div className="mt-8 pt-8 border-t border-[var(--border)]">
            <a
              href="https://wa.me/972773006306"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span className="font-medium">או דברו איתנו בוואטסאפ</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
