'use client';

import { useEffect, useState } from 'react';
import TenBoolViewer from '@/components/viewer/TenBoolViewer';
import TenBoolPhonePlay from '@/components/viewer/tenbool/TenBoolPhonePlay';
import TenBoolLeaderboard from '@/components/viewer/tenbool/TenBoolLeaderboard';
import { tenboolCompetition, type TenBoolConfig } from '@/types/tenbool';

// Picks the 10 בול screen: the buzzer game (default), or in phone mode the player's game on
// /v/{shortId} and the leaderboard on /v/{shortId}?screen=board (the code the board shows is the plain link).
export default function TenBoolExperience({
  codeId,
  shortId,
  title,
  config,
}: {
  codeId: string;
  shortId: string;
  title?: string;
  config?: TenBoolConfig;
}) {
  const phone = tenboolCompetition(config).phone;
  // Read after mount: the page is server-rendered without the query string
  const [screen, setScreen] = useState<'board' | 'play' | null>(null);
  useEffect(() => {
    setScreen(new URLSearchParams(window.location.search).get('screen') === 'board' ? 'board' : 'play');
  }, []);

  if (!phone) return <TenBoolViewer title={title} config={config} />;
  if (screen === null) return <div className="fixed inset-0" style={{ background: config?.backgroundColor || '#000' }} />;
  if (screen === 'board') return <TenBoolLeaderboard codeId={codeId} shortId={shortId} title={title} config={config} />;
  return <TenBoolPhonePlay codeId={codeId} title={title} config={config} />;
}
