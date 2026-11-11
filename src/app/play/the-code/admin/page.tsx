import type { Metadata } from 'next';
import TheCodeAdminDemo from './TheCodeAdminDemo';

// הקוד — operator demo on sample data (src/components/thecode/demo/adminDemo.ts). No code,
// Firestore or auth behind it; every change lives in memory until the tab is closed.
// Outside [locale] (middleware skips /play/).

export const metadata: Metadata = {
  title: 'הקוד — ניהול (הדגמה)',
  description: 'מסך המפעיל של הקוד: מקומות, גמדים, חידות, משפטים סודיים והדפסת לוחיות.',
  robots: { index: false, follow: false },
};

export default function TheCodeAdminDemoPage() {
  return <TheCodeAdminDemo />;
}
