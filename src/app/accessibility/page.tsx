import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'הצהרת נגישות | The Q By Playzone',
  description: 'הצהרת הנגישות של The Q By Playzone',
};

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white py-12 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה לאתר
        </Link>

        <h1 className="text-3xl font-bold mb-8 text-center">הצהרת נגישות</h1>
        <p className="text-gray-400 text-center mb-8">עודכן לאחרונה: דצמבר 2024</p>

        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">מחויבות לנגישות</h2>
            <p>
              אנו ב-The Q By Playzone מחויבים להנגשת האתר והשירותים שלנו לאנשים עם מוגבלויות.
              אנו פועלים להתאים את האתר לתקנות שוויון זכויות לאנשים עם מוגבלות
              (התאמות נגישות לשירות), התשע&quot;ג-2013.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">התאמות הנגישות באתר</h2>
            <p className="mb-4">האתר כולל את התאמות הנגישות הבאות:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>אפשרות להגדלה והקטנה של גודל הטקסט</li>
              <li>מצב ניגודיות גבוהה לשיפור הקריאות</li>
              <li>תמיכה בניווט באמצעות מקלדת</li>
              <li>תוויות נגישות לקוראי מסך</li>
              <li>מבנה דפים ברור והיררכי</li>
              <li>טקסט חלופי לתמונות</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">שימוש בתפריט הנגישות</h2>
            <p>
              לחצו על כפתור הנגישות הממוקם בצד שמאל למטה של המסך כדי לגשת להגדרות הנגישות.
              בתפריט תוכלו להתאים את גודל הטקסט ולהפעיל מצב ניגודיות גבוהה.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">תקן נגישות</h2>
            <p>
              אנו שואפים לעמוד בדרישות תקן WCAG 2.1 ברמה AA.
              אנו ממשיכים לעבוד על שיפור הנגישות של האתר באופן שוטף.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">דפדפנים וטכנולוגיות נתמכים</h2>
            <p className="mb-4">האתר מותאם לעבודה עם:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>Google Chrome (גרסה עדכנית)</li>
              <li>Mozilla Firefox (גרסה עדכנית)</li>
              <li>Apple Safari (גרסה עדכנית)</li>
              <li>Microsoft Edge (גרסה עדכנית)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">פנייה בנושא נגישות</h2>
            <p className="mb-4">
              נתקלתם בבעיית נגישות? נשמח לשמוע ולסייע!
              ניתן לפנות אלינו בנושאי נגישות בדרכים הבאות:
            </p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>
                דוא&quot;ל:{' '}
                <a href="mailto:admin@playzone.co.il" className="text-blue-400 hover:underline">
                  admin@playzone.co.il
                </a>
              </li>
              <li>נושא הפנייה: &quot;בעיית נגישות&quot;</li>
            </ul>
            <p className="mt-4">
              אנא פרטו בפנייתכם את הבעיה שנתקלתם בה, כולל הדף בו התגלתה הבעיה,
              ואנו נשתדל לטפל בה בהקדם האפשרי.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">רכז נגישות</h2>
            <p>
              שם: צוות Playzone<br />
              דוא&quot;ל:{' '}
              <a href="mailto:admin@playzone.co.il" className="text-blue-400 hover:underline">
                admin@playzone.co.il
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-700 text-center text-gray-500">
          <p>© {new Date().getFullYear()} The Q By Playzone. כל הזכויות שמורות.</p>
        </div>
      </div>
    </div>
  );
}
