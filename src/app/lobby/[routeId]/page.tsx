/**
 * Lobby Display Page
 * Full-screen display for showing recent winners on a big TV screen
 * URL: /lobby/[routeId]?locale=he|en
 */

import { Metadata } from 'next';
import LobbyClient from './LobbyClient';

interface PageProps {
  params: Promise<{ routeId: string }>;
  searchParams: Promise<{ locale?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { locale } = await searchParams;
  const isHebrew = locale !== 'en';
  return {
    title: isHebrew ? `תצוגת לובי` : `Lobby Display`,
    description: isHebrew ? 'תצוגת זוכים למסכי לובי' : 'Winner display for lobby screens',
  };
}

export default async function LobbyPage({ params, searchParams }: PageProps) {
  const { routeId } = await params;
  const { locale } = await searchParams;
  const validLocale = (locale === 'en' ? 'en' : 'he') as 'he' | 'en';

  return <LobbyClient routeId={routeId} locale={validLocale} />;
}
