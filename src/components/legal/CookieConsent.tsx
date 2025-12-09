'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useLocale } from 'next-intl';

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const locale = useLocale();
  const isHebrew = locale === 'he';

  const content = {
    he: {
      message: 'אתר זה משתמש בעוגיות (Cookies) לצורך שיפור חוויית המשתמש וניתוח שימוש. בהמשך הגלישה אתה מסכים לשימוש בעוגיות.',
      privacyPolicy: 'מדיניות פרטיות',
      accept: 'הבנתי ומסכים',
      close: 'סגור',
    },
    en: {
      message: 'This site uses cookies to improve user experience and analyze usage. By continuing to browse, you agree to the use of cookies.',
      privacyPolicy: 'Privacy Policy',
      accept: 'I Understand',
      close: 'Close',
    },
  };

  const t = isHebrew ? content.he : content.en;

  useEffect(() => {
    // Check if user already accepted
    const accepted = localStorage.getItem('cookie-consent');
    if (!accepted) {
      // Small delay for better UX
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900 border-t border-gray-700 shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className={`text-sm text-gray-300 text-center ${isHebrew ? 'sm:text-right' : 'sm:text-left'}`} dir={isHebrew ? 'rtl' : 'ltr'}>
          {t.message}{' '}
          <a href={`/${locale}/privacy`} className="text-blue-400 hover:underline">
            {t.privacyPolicy}
          </a>
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={acceptCookies}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            {t.accept}
          </button>
          <button
            onClick={acceptCookies}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            aria-label={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
