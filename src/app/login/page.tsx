import { redirect } from 'next/navigation';

// Legacy un-prefixed login (the i18n middleware already redirects /login).
// Kept only as a safety net: the real page is /{locale}/login, which offers
// Google + email/WhatsApp code and the invite-only waitlist.
export default function LegacyLoginPage() {
  redirect('/he/login');
}
