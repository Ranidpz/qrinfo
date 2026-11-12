import type { Metadata } from 'next';
import Print3DDemo from './Print3DDemo';

// הדפסה בתלת־ממד — clickable demo for Rani's approval (docs/QR_3D_PRINT_PLAN.md phase 1).
// Sample codes only: no Firestore, no auth, nothing is downloaded. Outside [locale] (middleware skips /play/).

export const metadata: Metadata = {
  title: 'הדפסה בתלת־ממד (הדגמה)',
  description: 'לוחיות QR קבועות למדפסת תלת־ממד: לוחית לגמד, בסיס שחור לקיר, מעמד ומחזיק מפתחות.',
  robots: { index: false, follow: false },
};

export default function Print3DDemoPage() {
  return <Print3DDemo />;
}
