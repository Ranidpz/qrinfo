'use client';

import Link from 'next/link';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useLocale } from 'next-intl';

export default function AccessibilityPage() {
  const locale = useLocale();
  const isHebrew = locale === 'he';
  const ArrowIcon = isHebrew ? ArrowRight : ArrowLeft;

  const content = {
    he: {
      title: 'הצהרת נגישות',
      lastUpdated: 'עודכן לאחרונה: דצמבר 2025',
      backToSite: 'חזרה לאתר',
      sections: [
        {
          title: 'מחויבות לנגישות',
          content: 'אנו ב-The Q By Playzone מחויבים להנגשת האתר והשירותים שלנו לאנשים עם מוגבלויות. אנו פועלים להתאים את האתר לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013.',
        },
        {
          title: 'התאמות הנגישות באתר',
          content: 'האתר כולל את התאמות הנגישות הבאות:',
          list: [
            'אפשרות להגדלה והקטנה של גודל הטקסט',
            'מצב ניגודיות גבוהה לשיפור הקריאות',
            'תמיכה בניווט באמצעות מקלדת',
            'תוויות נגישות לקוראי מסך',
            'מבנה דפים ברור והיררכי',
            'טקסט חלופי לתמונות',
          ],
        },
        {
          title: 'שימוש בתפריט הנגישות',
          content: 'לחצו על כפתור הנגישות הממוקם בצד שמאל למטה של המסך כדי לגשת להגדרות הנגישות. בתפריט תוכלו להתאים את גודל הטקסט ולהפעיל מצב ניגודיות גבוהה.',
        },
        {
          title: 'תקן נגישות',
          content: 'אנו שואפים לעמוד בדרישות תקן WCAG 2.1 ברמה AA. אנו ממשיכים לעבוד על שיפור הנגישות של האתר באופן שוטף.',
        },
        {
          title: 'דפדפנים וטכנולוגיות נתמכים',
          content: 'האתר מותאם לעבודה עם:',
          list: [
            'Google Chrome (גרסה עדכנית)',
            'Mozilla Firefox (גרסה עדכנית)',
            'Apple Safari (גרסה עדכנית)',
            'Microsoft Edge (גרסה עדכנית)',
          ],
        },
        {
          title: 'פנייה בנושא נגישות',
          content: 'נתקלתם בבעיית נגישות? נשמח לשמוע ולסייע! ניתן לפנות אלינו בנושאי נגישות:',
          list: [
            'דוא"ל: info@playzone.co.il',
            'נושא הפנייה: "בעיית נגישות"',
          ],
          note: 'אנא פרטו בפנייתכם את הבעיה שנתקלתם בה, כולל הדף בו התגלתה הבעיה, ואנו נשתדל לטפל בה בהקדם האפשרי.',
        },
        {
          title: 'רכז נגישות',
          content: 'שם: צוות Playzone',
          email: 'info@playzone.co.il',
        },
      ],
      copyright: '© {year} The Q By Playzone. כל הזכויות שמורות.',
    },
    en: {
      title: 'Accessibility Statement',
      lastUpdated: 'Last updated: December 2025',
      backToSite: 'Back to site',
      sections: [
        {
          title: 'Commitment to Accessibility',
          content: 'We at The Q By Playzone are committed to making our website and services accessible to people with disabilities. We work to comply with accessibility standards and regulations.',
        },
        {
          title: 'Accessibility Features',
          content: 'The site includes the following accessibility features:',
          list: [
            'Option to increase and decrease text size',
            'High contrast mode for improved readability',
            'Keyboard navigation support',
            'Accessible labels for screen readers',
            'Clear and hierarchical page structure',
            'Alternative text for images',
          ],
        },
        {
          title: 'Using the Accessibility Menu',
          content: 'Click the accessibility button located at the bottom left of the screen to access accessibility settings. In the menu, you can adjust text size and enable high contrast mode.',
        },
        {
          title: 'Accessibility Standard',
          content: 'We strive to meet WCAG 2.1 Level AA requirements. We continue to work on improving site accessibility on an ongoing basis.',
        },
        {
          title: 'Supported Browsers and Technologies',
          content: 'The site is optimized to work with:',
          list: [
            'Google Chrome (latest version)',
            'Mozilla Firefox (latest version)',
            'Apple Safari (latest version)',
            'Microsoft Edge (latest version)',
          ],
        },
        {
          title: 'Accessibility Inquiries',
          content: 'Encountered an accessibility issue? We would love to hear from you and help! You can contact us regarding accessibility:',
          list: [
            'Email: info@playzone.co.il',
            'Subject: "Accessibility Issue"',
          ],
          note: 'Please describe the issue you encountered in your inquiry, including the page where the issue was found, and we will try to address it as soon as possible.',
        },
        {
          title: 'Accessibility Coordinator',
          content: 'Name: Playzone Team',
          email: 'info@playzone.co.il',
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
              {section.note && (
                <p className="mt-4">{section.note}</p>
              )}
              {section.email && (
                <p className="mt-2">
                  <a href={`mailto:${section.email}`} className="text-blue-400 hover:underline">
                    {section.email}
                  </a>
                </p>
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
