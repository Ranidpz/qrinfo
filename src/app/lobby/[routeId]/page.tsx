/**
 * Lobby Display Page
 * Full-screen display for showing recent winners on a big screen
 * URL: /lobby/[routeId]?locale=he|en
 */

import { Metadata } from 'next';
import LobbyClient from './LobbyClient';

interface PageProps {
  params: Promise<{ routeId: string }>;
  searchParams: Promise<{ locale?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { routeId } = await params;
  return {
    title: `Lobby Display - ${routeId}`,
    description: 'Winner display for lobby screens',
  };
}

export default async function LobbyPage({ params, searchParams }: PageProps) {
  const { routeId } = await params;
  const search = await searchParams;
  const locale = (search.locale === 'en' ? 'en' : 'he') as 'he' | 'en';

  return <LobbyClient routeId={routeId} locale={locale} />;
}
