import type { Metadata } from 'next';
import TheCodeAdminPage from './TheCodeAdminPage';

// הקוד — the operator's full-page admin for one adventure (auth + ownership required; the
// API enforces ownership, the page only routes guests to /login). Never indexed.

export const metadata: Metadata = {
  title: 'הקוד — ניהול',
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ codeId: string }> }) {
  const { codeId } = await params;
  return <TheCodeAdminPage codeId={codeId} />;
}
