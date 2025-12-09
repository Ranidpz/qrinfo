'use client';

import Link from 'next/link';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useLocale } from 'next-intl';

export default function PrivacyPolicyPage() {
  const locale = useLocale();
  const isHebrew = locale === 'he';
  const ArrowIcon = isHebrew ? ArrowRight : ArrowLeft;

  const content = {
    he: {
      title: 'מדיניות פרטיות',
      lastUpdated: 'עודכן לאחרונה: דצמבר 2024',
      backToSite: 'חזרה לאתר',
      sections: [
        {
          title: '1. מבוא',
          content: 'ברוכים הבאים ל-The Q By Playzone ("האפליקציה", "השירות"). אנו מכבדים את פרטיותך ומחויבים להגן על המידע האישי שלך. מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים ומגנים על המידע שלך.',
        },
        {
          title: '2. מידע שאנו אוספים',
          content: 'כאשר אתה משתמש בשירות שלנו, אנו עשויים לאסוף את המידע הבא:',
          list: [
            'מידע מחשבון Google: שם, כתובת אימייל ותמונת פרופיל (בעת התחברות באמצעות Google)',
            'תוכן שאתה יוצר: קודי QR, תמונות, סרטונים וחידות שאתה מעלה לשירות',
            'נתוני שימוש: מידע על האופן שבו אתה משתמש בשירות',
          ],
        },
        {
          title: '3. כיצד אנו משתמשים במידע',
          content: 'אנו משתמשים במידע שנאסף כדי:',
          list: [
            'לספק ולתחזק את השירות',
            'לאפשר לך ליצור ולנהל קודי QR',
            'לשפר את חוויית המשתמש',
            'לתקשר איתך בנוגע לשירות',
          ],
        },
        {
          title: '4. שיתוף מידע',
          content: 'אנו לא מוכרים, סוחרים או מעבירים את המידע האישי שלך לצדדים שלישיים, למעט ספקי שירות הנדרשים להפעלת השירות (כגון Firebase של Google).',
        },
        {
          title: '5. אבטחת מידע',
          content: 'אנו מיישמים אמצעי אבטחה מתאימים כדי להגן על המידע האישי שלך מפני גישה, שינוי, חשיפה או השמדה בלתי מורשית.',
        },
        {
          title: '6. הזכויות שלך',
          content: 'יש לך את הזכות:',
          list: [
            'לגשת למידע האישי שלך',
            'לתקן מידע לא מדויק',
            'לבקש מחיקת המידע שלך',
            'לבטל את הסכמתך בכל עת',
          ],
        },
        {
          title: '7. יצירת קשר',
          content: 'לשאלות בנוגע למדיניות פרטיות זו, ניתן לפנות אלינו בכתובת:',
          email: 'admin@playzone.co.il',
        },
        {
          title: '8. שינויים במדיניות',
          content: 'אנו עשויים לעדכן מדיניות פרטיות זו מעת לעת. שינויים יפורסמו בדף זה עם תאריך עדכון חדש.',
        },
      ],
      copyright: '© {year} The Q By Playzone. כל הזכויות שמורות.',
    },
    en: {
      title: 'Privacy Policy',
      lastUpdated: 'Last updated: December 2024',
      backToSite: 'Back to site',
      sections: [
        {
          title: '1. Introduction',
          content: 'Welcome to The Q By Playzone ("the Application", "the Service"). We respect your privacy and are committed to protecting your personal information. This privacy policy explains how we collect, use, and protect your information.',
        },
        {
          title: '2. Information We Collect',
          content: 'When you use our service, we may collect the following information:',
          list: [
            'Google Account Information: name, email address, and profile picture (when signing in with Google)',
            'Content you create: QR codes, images, videos, and riddles you upload to the service',
            'Usage data: information about how you use the service',
          ],
        },
        {
          title: '3. How We Use Information',
          content: 'We use the collected information to:',
          list: [
            'Provide and maintain the service',
            'Allow you to create and manage QR codes',
            'Improve user experience',
            'Communicate with you about the service',
          ],
        },
        {
          title: '4. Information Sharing',
          content: 'We do not sell, trade, or transfer your personal information to third parties, except for service providers required to operate the service (such as Google Firebase).',
        },
        {
          title: '5. Information Security',
          content: 'We implement appropriate security measures to protect your personal information from unauthorized access, modification, disclosure, or destruction.',
        },
        {
          title: '6. Your Rights',
          content: 'You have the right to:',
          list: [
            'Access your personal information',
            'Correct inaccurate information',
            'Request deletion of your information',
            'Withdraw your consent at any time',
          ],
        },
        {
          title: '7. Contact Us',
          content: 'For questions regarding this privacy policy, you can contact us at:',
          email: 'admin@playzone.co.il',
        },
        {
          title: '8. Policy Changes',
          content: 'We may update this privacy policy from time to time. Changes will be posted on this page with a new update date.',
        },
      ],
      copyright: '© {year} The Q By Playzone. All rights reserved.',
    },
  };

  const t = isHebrew ? content.he : content.en;

  return (
    <div className="min-h-screen bg-gray-900 text-white py-12 px-4" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8 transition-colors"
        >
          <ArrowIcon className="w-4 h-4" />
          {t.backToSite}
        </Link>

        <h1 className="text-3xl font-bold mb-8 text-center">{t.title}</h1>
        <p className="text-gray-400 text-center mb-8">{t.lastUpdated}</p>

        <div className="space-y-8 text-gray-300">
          {t.sections.map((section, index) => (
            <section key={index}>
              <h2 className="text-xl font-semibold mb-4 text-white">{section.title}</h2>
              <p className={section.list ? 'mb-4' : ''}>{section.content}</p>
              {section.list && (
                <ul className={`list-disc space-y-2 ${isHebrew ? 'list-inside mr-4' : 'list-inside ml-4'}`}>
                  {section.list.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
              {section.email && (
                <a href={`mailto:${section.email}`} className="text-blue-400 hover:underline">
                  {section.email}
                </a>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-gray-700 text-center text-gray-500">
          <p>{t.copyright.replace('{year}', new Date().getFullYear().toString())}</p>
        </div>
      </div>
    </div>
  );
}
