import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import TheCodeAdminDemo from './TheCodeAdminDemo';

// הקוד — operator demo on sample data (src/components/thecode/demo/adminDemo.ts). No code,
// Firestore or auth behind it; every change lives in memory until the tab is closed.
// Outside [locale] (middleware skips /play/).

export const metadata: Metadata = {
  title: 'קוד הגמדים — ניהול (הדגמה)',
  description: 'מסך המפעיל של קוד הגמדים: מקומות, גמדים, חידות, משפטים סודיים והדפסת לוחיות.',
  robots: { index: false, follow: false },
};

// Closed on the live site (Rani, 12.11.2026: "מיותר") — production sends visitors to the guide.
// Still runs on a local dev server (`next dev`), where the build sessions use it.
export default function TheCodeAdminDemoPage() {
  if (process.env.NODE_ENV === 'production') redirect('/play/the-code/guide');
  return <TheCodeAdminDemo />;
}
