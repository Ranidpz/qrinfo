import type { Metadata } from 'next';
import { Secular_One } from 'next/font/google';
import GnomeFigure from '@/components/thecode/GnomeFigure';
import { DEFAULT_THECODE_RULES as R } from '@/lib/thecode/engine';
import type { TheCodeColor } from '@/types/thecode';
import s from './guide.module.css';

// הקוד — the public guide: how to play, why gnomes have colours, points, tips,
// what organizers prepare, and the common questions. Static, no data behind it.
// Outside [locale] like the demos (middleware skips /play/). Not indexed while the
// experience is still hidden behind super admin — flip `robots` when it opens.
// Wording rule (Rani, 12.11.2026): "קבוצה/קבוצות" and "מארגנים/המקום" — never
// "משפחה" or a hotel as the fixed audience.

const display = Secular_One({ subsets: ['hebrew', 'latin'], weight: '400', variable: '--tc-font-display' });

// The share card (WhatsApp, Facebook, LinkedIn…). Without its own openGraph the page inherited
// the site-wide The Q card. Image = scripts/thecode-og-image.mjs (no text: rasterisers mangle
// Hebrew). WhatsApp caches a card per URL — a changed card needs a new URL (e.g. ?v=2).
const SHARE_TITLE = 'קוד הגמדים — המדריך';
const SHARE_TEXT = 'איך משחקים במשחק החיפוש לקבוצות: מוצאים גמדים, פותרים חידות, אוספים אותיות ופותחים מזוודה סודית. וגם מה המארגנים מכינים.';
const SHARE_IMAGE = '/play/the-code/guide-og.png';

export const metadata: Metadata = {
  title: { absolute: SHARE_TITLE },
  description: SHARE_TEXT,
  robots: { index: false, follow: false },
  openGraph: {
    title: SHARE_TITLE,
    description: SHARE_TEXT,
    url: '/play/the-code/guide',
    siteName: 'The Q',
    locale: 'he_IL',
    type: 'article',
    images: [{ url: SHARE_IMAGE, width: 1200, height: 630, alt: 'חמישה גמדים צבעוניים' }],
  },
  twitter: { card: 'summary_large_image', title: SHARE_TITLE, description: SHARE_TEXT, images: [SHARE_IMAGE] },
};

const PARADE: Array<[TheCodeColor, TheCodeColor]> = [
  ['blue', 'yellow'], ['red', 'blue'], ['purple', 'black'], ['green', 'white'], ['yellow', 'purple'],
];

const STEPS: Array<[string, string]> = [
  ['סורקים גמד', 'מכוונים את מצלמת הטלפון לקוד של גמד כלשהו, ובוחרים שם וסמל לקבוצה.'],
  ['מקבלים יעד', 'המשחק נותן רמז למקום, ומראה איך נראה הגמד שמחכה לכם שם.'],
  ['מוצאים את הגמד שלכם', 'במקום עומדים כמה גמדים. סורקים רק את זה שבצבעים שקיבלתם.'],
  ['פותרים חידה', 'הגמד שואל חידה על מה שרואים סביבו, או שאלת ידע. בוחרים את האות הראשונה של התשובה.'],
  ['אוספים אות', 'תשובה נכונה מוסיפה אות לאוסף ונקודות לקבוצה, ומיד מגיע היעד הבא.'],
  ['פותחים את המזוודה', 'כשכל האותיות אצלכם, מסדרים אותן למשפט הסודי והמזוודה נפתחת.'],
];

const SPOT: Array<{ body: TheCodeColor; hat: TheCodeColor; bodyHe: string; hatHe: string; mine?: boolean }> = [
  { body: 'red', hat: 'blue', bodyHe: 'גוף אדום', hatHe: 'כובע כחול' },
  { body: 'blue', hat: 'yellow', bodyHe: 'גוף כחול', hatHe: 'כובע צהוב', mine: true },
  { body: 'purple', hat: 'black', bodyHe: 'גוף סגול', hatHe: 'כובע שחור' },
];

const FACTS: Array<{ value: string; tone: 'plus' | 'minus' | 'plain'; text: string }> = [
  { value: `+${R.pointsPerLetter}`, tone: 'plus', text: 'על כל אות שנאספה' },
  { value: `+${R.suitcaseBonus}`, tone: 'plus', text: 'על פתיחת מזוודה' },
  { value: `×${R.hotMultiplier}`, tone: 'plain', text: `שחקן חם: אחרי ${R.hotStreakAt === 3 ? 'שלוש' : R.hotStreakAt} תשובות נכונות ברצף` },
  { value: `−${R.hintCost}`, tone: 'minus', text: 'על רמז נוסף. הרמז הראשון תמיד בחינם' },
  { value: `−${R.wrongScanPenalty}`, tone: 'minus', text: R.freeWrongScans === 1 ? 'על סריקת גמד לא נכון, מהטעות השנייה' : 'על סריקת גמד לא נכון, אחרי הטעויות החינמיות' },
];

const BLOCKS: Array<[string, string]> = [
  ['מקומות', 'נקודות במתחם שבהן עומדים גמדים: הכניסה, החצר, הספרייה. לכל מקום כותבים רמזים מדורגים, מהכללי אל המדויק.'],
  ['גמדים', 'שניים עד ארבעה בכל מקום, כל אחד בצירוף צבעים אחר. לכל גמד קוד קבוע שלא משתנה לעולם.'],
  ['חידות', 'הסתובבו במקום שבו עומד כל גמד וכתבו לו שתיים עד חמש חידות על מה שרואים סביבו, או שאלות ידע, למשל על המוצרים והשירות של החברה. האות הראשונה של התשובה היא האות שהקבוצה אוספת. רעיונות: "מצאו את האגרטל עם הפרחים הצהובים. מה הצבע שלו?", "יש כאן תמונה של סירה. מה הצבע של המפרש בתמונה?", "לכו שלושה צעדים אחורה. מה אתם רואים בתקרה?"'],
  ['משפטים סודיים', 'כמה משפטים קצרים, למשל שם המקום. כל קבוצה מקבלת משפט אחר, וכל מזוודה חדשה היא משפט חדש.'],
];

const AUTO = [
  'בונה לכל קבוצה מסלול משלה, לפי האותיות של המשפט שלה.',
  'מפזרת את המסלול בין המקומות, כך שלא כולם מצטופפים באותה פינה.',
  'לא נותנת לקבוצה חידה שכבר פתרה, גם לא במזוודה הבאה.',
  'מתריעה כשחסר תוכן: אות שאף גמד לא נותן, או שני גמדים זהים באותו מקום.',
  'גמד נעלם או נשבר? מכבים אותו במסך הניהול, והמשחק מדלג עליו.',
  'מציגה לוח מובילים שבועי, ומראה אילו חידות קשות מדי.',
];

// A sample of the lobby board (src/app/lobby/thecode/[shortId]/TheCodeLobby.tsx) — same columns.
const MEDALS = ['🥇', '🥈', '🥉'];
const BOARD = [
  { emoji: '🐬', name: 'הדולפינים', bags: 2, pts: 1840 },
  { emoji: '🦉', name: 'הינשופים', bags: 1, pts: 1260 },
  { emoji: '🐯', name: 'הנמרים', bags: 1, pts: 980 },
  { emoji: '🐢', name: 'הצבים', bags: 0, pts: 430 },
];

const FAQ: Array<[string, string]> = [
  ['אפשר לראות איפה כל קבוצה נמצאת?', 'לא את המקום במתחם. המסך הגדול והמסך של המארגנים מראים כמה נקודות ומזוודות יש לכל קבוצה ומתי שיחקה לאחרונה.'],
  ['שתי קבוצות שסורקות אותו גמד מקבלות אותה חידה?', 'תלוי בכמה חידות נכתבו לגמד. עם חידה אחת כולן מקבלות אותה. עם כמה חידות, כל קבוצה מקבלת את זו שנותנת את האות שחסרה לה.'],
  ['אם משחקים מאה ילדים, הראשונים לא יגלו לכולם את התשובות?', 'אפשר לגלות תשובה, אבל היא שווה מעט. לכל קבוצה מסלול אחר, אי אפשר לענות בלי לסרוק את הגמד עצמו, וגמד עם כמה חידות שואל בדרך כלל קבוצות שונות שאלות שונות. לאירוע גדול כדאי לכתוב שתיים עד שלוש חידות לכל גמד.'],
  ['מה קורה אם סורקים גמד בלי להיות במשחק?', 'הסריקה פותחת את המשחק. נרשמים כקבוצה ומקבלים את היעד הראשון.'],
  ['מה אם הילדים נתקעים בחידה?', 'יש רמזים. הראשון בחינם, והבאים עולים מעט נקודות. אחרי כמה ניסיונות שגויים יורדות מעט נקודות ויש המתנה קצרה לפני הניסיון הבא.'],
  ['אפשר לשחק יותר מפעם אחת?', 'כן. אחרי שמזוודה נפתחת אפשר להתחיל מזוודה חדשה, עם משפט אחר וחידות שעוד לא פתרתם.'],
  ['אילו פרטים המשחק שומר?', 'שם הקבוצה שבחרתם, הסמל והנקודות. לא צריך שם מלא, כתובת או פרטים אישיים אחרים.'],
];

export default function TheCodeGuidePage() {
  return (
    <div className={`${display.variable} ${s.page}`}>
      <main className={s.wrap} lang="he" dir="rtl">
        <header className={s.hero}>
          <div className={s.parade} aria-hidden="true">
            {PARADE.map(([body, hat], i) => (
              <GnomeFigure key={i} bodyColor={body} hatColor={hat} size={i === 0 ? 76 : 56} />
            ))}
          </div>
          <h1>קוד הגמדים</h1>
          <p className={s.lead}>
            משחק חיפוש לקבוצות, בכל מקום: מלון, בית ספר, קניון, פארק או משרדי חברה. מוצאים גמדים, פותרים חידות, אוספים אותיות ופותחים מזוודה סודית.
          </p>
          <nav className={s.jump} aria-label="חלקי המדריך">
            <a href="#players">לשחקנים</a>
            <a href="#screens">המסכים</a>
            <a href="#organizers">למארגנים</a>
            <a href="#faq">שאלות נפוצות</a>
          </nav>
        </header>

        <section id="players" className={s.section}>
          <div className={s.head}>
            <span className={s.eyebrow}>לשחקנים</span>
            <h2>איך משחקים</h2>
            <p className={s.soft}>צריך רק טלפון עם מצלמה. אין אפליקציה להתקין ואין שעון שרץ.</p>
          </div>
          <ol className={s.steps}>
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className={s.num}>{i + 1}</span>
                <div><b>{title}</b><span className={s.stepText}>{text}</span></div>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.section}>
          <div className={s.head}>
            <h2>למה לגמדים יש צבעים</h2>
            <p className={s.soft}>בכל מקום עומדים שניים עד ארבעה גמדים. הצבעים של הגוף והכובע אומרים לכם מי מהם שלכם.</p>
          </div>
          <div className={s.scene}>
            <div className={s.spot}>
              <h3>הכניסה</h3>
              <div className={s.row}>
                {SPOT.map((g) => (
                  <div key={g.body} className={`${s.who} ${g.mine ? s.mine : ''}`}>
                    <GnomeFigure bodyColor={g.body} hatColor={g.hat} size={64} />
                    <small>{g.bodyHe}<br />{g.hatHe}</small>
                    <span className={`${s.tag} ${g.mine ? s.yes : s.no}`}>{g.mine ? 'הגמד שלכם' : 'של קבוצה אחרת'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={s.phone} aria-label="מסך היעד בטלפון">
              <span className={s.eyebrow}>על המסך שלכם</span>
              <h3>היעד הבא</h3>
              <div className={s.hint}>רמז: ליד דלת הכניסה</div>
              <GnomeFigure bodyColor="blue" hatColor="yellow" size={52} />
              <div className={s.chips}>
                <span className={s.chip}><span className={s.dot} style={{ background: '#3B82F6' }} />גוף כחול</span>
                <span className={s.chip}><span className={s.dot} style={{ background: '#F5C518' }} />כובע צהוב</span>
              </div>
            </div>
          </div>
          <ul className={s.tips}>
            <li>לכל גמד חידה משלו, ולכל קבוצה מסלול משלה ומשפט סודי משלה.</li>
            <li>סרקתם גמד לא נכון? הוא יגיד לכם &quot;נא נא&quot;. הטעות הראשונה בחינם, אחריה יורדות נקודות.</li>
          </ul>
        </section>

        <section className={s.section}>
          <div className={s.head}>
            <h2>נקודות</h2>
            <p className={s.soft}>אלה ערכי ברירת המחדל. המארגנים יכולים לשנות אותם.</p>
          </div>
          <dl className={s.facts}>
            {FACTS.map((f) => (
              <div key={f.text}>
                <dt className={f.tone === 'plain' ? undefined : s[f.tone]}>{f.value}</dt>
                <dd>{f.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={s.section}>
          <div className={s.head}>
            <h2>פגשתם קבוצה אחרת ליד הגמדים?</h2>
            <p className={s.soft}>מותר לשאול. ומותר גם לא לגלות.</p>
          </div>
          <div className={s.talk}>
            <p className={`${s.bubble} ${s.ask}`}>ראיתם אולי גמד עם גוף כחול וכובע צהוב?</p>
            <p className={`${s.bubble} ${s.answer}`}>ראינו אותו, שם ליד העציץ!</p>
            <p className={`${s.bubble} ${s.answer}`}>ראינו... אבל את זה תמצאו לבד.</p>
          </div>
          <ul className={s.tips}>
            <li>עזרה במציאת הגמד לא מגלה את התשובה. החידה שלכם מחכה רק לכם.</li>
            <li>הסתכלו טוב על שני הצבעים, גוף וכובע, לפני שסורקים.</li>
            <li>לא ממהרים. אין תחרות על זמן, רק על נקודות.</li>
            <li>אפשר לעצור ולהמשיך מחר. הכול נשמר, ויש קוד שחזור למקרה שמחליפים טלפון.</li>
            <li>לוח המובילים מוצג על מסך גדול במקום.</li>
          </ul>
        </section>

        <section id="screens" className={s.section}>
          <div className={s.head}>
            <h2>מה רואים על המסכים</h2>
            <p className={s.soft}>שני מסכים: הטלפון של כל קבוצה, ומסך גדול אחד במקום שכולם רואים.</p>
          </div>
          <div className={s.scene}>
            <div className={s.tv} aria-label="דוגמה למסך הגדול">
              <div className={s.tvHead}>
                <span className={s.tvTitle}>קוד הגמדים</span>
                <span className={s.tvTabs}><span className={s.tvTabOn}>השבוע</span><span>כל הזמנים</span></span>
              </div>
              <ol className={s.tvRows}>
                {BOARD.map((r, i) => (
                  <li key={r.name} className={i < 3 ? s.tvTop : undefined}>
                    <span className={s.tvRank}>{MEDALS[i] ?? i + 1}</span>
                    <span aria-hidden>{r.emoji}</span>
                    <span className={s.tvName}>{r.name}</span>
                    <span className={s.tvBags}>🧳 {r.bags}</span>
                    <span className={s.tvPts}>{r.pts.toLocaleString('en-US')}</span>
                  </li>
                ))}
              </ol>
              <div className={s.tvFoot}>מצאו גמד, סרקו את הקוד שעליו והצטרפו למשחק!</div>
            </div>
            <div className={s.blocksCol}>
              <article><h3>המסך הגדול</h3><p>עשר הקבוצות המובילות: מקום, שם וסמל, כמה מזוודות פתחו וכמה נקודות יש להן. שלוש הראשונות מקבלות מדליה. המסך מתחלף לבד בין &quot;השבוע&quot; ל&quot;כל הזמנים&quot; ומתעדכן כל רבע דקה. אין בו כפתורים: פותחים אותו פעם אחת על מסך או טלוויזיה, וזהו.</p></article>
              <article><h3>בטלפון של הקבוצה</h3><p>הנקודות, האותיות שנאספו והיעד הבא. כשהמזוודה נפתחת: חגיגה על המסך, בונוס של {R.suitcaseBonus} נקודות, המקום של הקבוצה בטבלה ואלבום הגמדים שמצאה. משם אפשר להתחיל מזוודה חדשה.</p></article>
            </div>
          </div>
          <ul className={s.tips}>
            <li>המסך הגדול מראה את מצב הנקודות של כל קבוצה, לא איפה היא עומדת עכשיו במתחם.</li>
            <li>המארגנים רואים במסך הניהול את כל הקבוצות: נקודות, מזוודות ומתי שיחקו לאחרונה. אפשר לשנות שם או להסתיר קבוצה מהלוח.</li>
            <li>המערכת לא מחלקת פרסים. המארגנים מחליטים, למשל פרס לקבוצה שבראש הטבלה בסוף השבוע או למי שפתחה מזוודה.</li>
          </ul>
        </section>

        <section id="organizers" className={`${s.section} ${s.band}`}>
          <div className={s.head}>
            <span className={s.eyebrow}>למארגנים</span>
            <h2>מה מכינים</h2>
            <p className={s.soft}>ארבעה דברים, פעם אחת, במסך הניהול. מהרגע שהם מוכנים המשחק רץ לבד.</p>
          </div>
          <div className={s.blocks}>
            {BLOCKS.map(([title, text]) => (
              <article key={title}><h3>{title}</h3><p>{text}</p></article>
            ))}
          </div>
          <div className={s.auto}>
            <h3>מה המערכת עושה לבד</h3>
            <ul className={s.tips}>
              {AUTO.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        </section>

        <section id="faq" className={s.section}>
          <div className={s.head}>
            <h2>שאלות נפוצות</h2>
          </div>
          <div className={s.faq}>
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className={s.footer}>
          <span>קוד הגמדים — חוויה של The Q</span>
        </footer>
      </main>
    </div>
  );
}
