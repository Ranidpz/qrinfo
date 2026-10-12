import { notFound } from 'next/navigation';
import { getRaffleContextByShortId, raffleTokenValid } from '@/lib/raffle/server';
import RaffleClient from './RaffleClient';

export const dynamic = 'force-dynamic';

// Public big-screen raffle page: /raffle/{shortId}?token=...
// Names only — phone numbers never reach the client. The config's secret token
// is stripped before sending to the browser; authorization is checked here.
export default async function RafflePage({
  params,
  searchParams,
}: {
  params: Promise<{ shortId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { shortId } = await params;
  const { token = '' } = await searchParams;

  const ctx = await getRaffleContextByShortId(shortId);
  if (!ctx) notFound();

  const config = ctx.config;
  const authorized = raffleTokenValid(config, token);

  // Never expose the secret token to the client.
  const { token: _secret, ...publicConfig } = config;
  void _secret;

  return (
    <RaffleClient
      config={publicConfig}
      codeId={ctx.codeId}
      token={token}
      authorized={authorized}
    />
  );
}
