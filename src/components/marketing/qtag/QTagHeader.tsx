'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ArrowRight, Ticket } from 'lucide-react';
import { useLocale } from 'next-intl';

export default function QTagHeader() {
  const t = useTranslations('qtagMarketing.header');
  const locale = useLocale();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[var(--bg-primary)]/90 backdrop-blur-lg border-b border-[var(--border)] shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <a href={`/${locale}/dashboard`} className="flex items-center gap-3 group">
            <Image
              src="/theQ.png"
              alt="The Q"
              width={40}
              height={40}
              className="rounded-lg transition-transform duration-200 group-hover:scale-110"
            />
            <span className="hidden sm:inline text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              {t('backToDashboard')}
            </span>
          </a>
          <a
            href={`/${locale}/dashboard?create=qtag`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-sm font-semibold rounded-lg hover:from-orange-400 hover:to-pink-400 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-orange-500/25"
          >
            <Ticket className="w-4 h-4" />
            {t('cta')}
          </a>
        </div>
      </div>
    </header>
  );
}
