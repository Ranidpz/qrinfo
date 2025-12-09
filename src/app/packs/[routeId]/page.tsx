/**
 * Pack Opening Page
 * Shows pending packs for visitors or redirect to route start
 * URL: /packs/[routeId]
 */

import { Metadata } from 'next';
import PacksClient from './PacksClient';

interface PageProps {
  params: Promise<{ routeId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'פתיחת פרסים | Open Prizes',
    description: 'פתח את החבילות שלך וזכה בפרסים! | Open your packs and win prizes!',
  };
}

export default async function PacksPage({ params }: PageProps) {
  const { routeId } = await params;

  return <PacksClient routeId={routeId} />;
}
