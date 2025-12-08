'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { Languages } from 'lucide-react';
import { type Locale, localeNames } from '@/i18n/config';
import { useState, useRef, useEffect } from 'react';

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('language');
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ensure component is mounted before rendering (prevents hydration issues)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const switchLocale = (newLocale: Locale) => {
    // Set cookie for persistence
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
    router.replace(pathname, { locale: newLocale });
    setIsOpen(false);
  };

  const currentLanguageLabel = locale === 'he' ? 'עברית' : 'English';

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 text-indigo-500">
        <Languages className="w-4 h-4" />
        <span className="text-sm font-medium">—</span>
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 transition-colors"
      >
        <Languages className="w-4 h-4" />
        <span className="text-sm font-medium">{currentLanguageLabel}</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[160px] z-50">
          <button
            onClick={() => switchLocale('he')}
            className={`w-full flex items-center justify-center gap-3 px-4 py-3 text-sm transition-colors ${
              locale === 'he'
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-text-primary hover:bg-bg-hover'
            }`}
          >
            <span className="text-base font-medium">עב</span>
            <span>{localeNames.he}</span>
          </button>
          <button
            onClick={() => switchLocale('en')}
            className={`w-full flex items-center justify-center gap-3 px-4 py-3 text-sm transition-colors ${
              locale === 'en'
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-text-primary hover:bg-bg-hover'
            }`}
          >
            <span className="text-base font-medium">EN</span>
            <span>{localeNames.en}</span>
          </button>
        </div>
      )}
    </div>
  );
}
