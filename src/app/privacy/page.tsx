import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'מדיניות פרטיות | The Q By Playzone',
  description: 'מדיניות הפרטיות של The Q By Playzone',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white py-12 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">מדיניות פרטיות</h1>
        <p className="text-gray-400 text-center mb-8">עודכן לאחרונה: דצמבר 2024</p>

        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">1. מבוא</h2>
            <p>
              ברוכים הבאים ל-The Q By Playzone (&quot;האפליקציה&quot;, &quot;השירות&quot;).
              אנו מכבדים את פרטיותך ומחויבים להגן על המידע האישי שלך.
              מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים ומגנים על המידע שלך.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">2. מידע שאנו אוספים</h2>
            <p className="mb-4">כאשר אתה משתמש בשירות שלנו, אנו עשויים לאסוף את המידע הבא:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li><strong>מידע מחשבון Google:</strong> שם, כתובת אימייל ותמונת פרופיל (בעת התחברות באמצעות Google)</li>
              <li><strong>תוכן שאתה יוצר:</strong> קודי QR, תמונות, סרטונים וחידות שאתה מעלה לשירות</li>
              <li><strong>נתוני שימוש:</strong> מידע על האופן שבו אתה משתמש בשירות</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">3. כיצד אנו משתמשים במידע</h2>
            <p className="mb-4">אנו משתמשים במידע שנאסף כדי:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>לספק ולתחזק את השירות</li>
              <li>לאפשר לך ליצור ולנהל קודי QR</li>
              <li>לשפר את חוויית המשתמש</li>
              <li>לתקשר איתך בנוגע לשירות</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">4. שיתוף מידע</h2>
            <p>
              אנו לא מוכרים, סוחרים או מעבירים את המידע האישי שלך לצדדים שלישיים,
              למעט ספקי שירות הנדרשים להפעלת השירות (כגון Firebase של Google).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">5. אבטחת מידע</h2>
            <p>
              אנו מיישמים אמצעי אבטחה מתאימים כדי להגן על המידע האישי שלך מפני גישה,
              שינוי, חשיפה או השמדה בלתי מורשית.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">6. הזכויות שלך</h2>
            <p className="mb-4">יש לך את הזכות:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>לגשת למידע האישי שלך</li>
              <li>לתקן מידע לא מדויק</li>
              <li>לבקש מחיקת המידע שלך</li>
              <li>לבטל את הסכמתך בכל עת</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">7. יצירת קשר</h2>
            <p>
              לשאלות בנוגע למדיניות פרטיות זו, ניתן לפנות אלינו בכתובת:{' '}
              <a href="mailto:admin@playzone.co.il" className="text-blue-400 hover:underline">
                admin@playzone.co.il
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-white">8. שינויים במדיניות</h2>
            <p>
              אנו עשויים לעדכן מדיניות פרטיות זו מעת לעת.
              שינויים יפורסמו בדף זה עם תאריך עדכון חדש.
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
