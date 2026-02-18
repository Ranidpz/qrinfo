'use client';

import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';

export default function QTagFooter() {
  const t = useTranslations('qtagMarketing.footer');
  const locale = useLocale();

  return (
    <footer className="py-8 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <a
            href={`/${locale}/dashboard`}
            className="flex items-center gap-3 group"
          >
            <Image
              src="/theQ.png"
              alt="The Q"
              width={36}
              height={36}
              className="rounded-lg transition-transform duration-200 group-hover:scale-110"
            />
            <span className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-orange-400 transition-colors">
              The Q
            </span>
          </a>

          <p className="text-sm text-[var(--text-secondary)]">
            {t('product')}
          </p>

          <a
            href={`/${locale}/marketing`}
            className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
          >
            {t('backToDashboard')} &larr;
          </a>

          <div className="mt-4 pt-4 border-t border-[var(--border)] w-full max-w-xs text-xs text-[var(--text-secondary)]">
            Built by{' '}
            <a
              href="https://playzone.co.il"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              Playzone
            </a>
            {' '}&copy; {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </footer>
  );
}
