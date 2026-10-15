'use client';

// On-site staff moderation: /v/{shortId}#mod=<token>. The token stays in the URL fragment (never
// sent to the server or its logs) and goes out only in the x-sw-mod header; the server compares it
// against codes/{id}/private/secrets. No account needed — the producer's crew runs it from a phone.

import { useCallback, useState } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import type { SocialWallGroup } from '@/types/socialwall';
import { ModerationPanel, MembersPanel, type SwRequest } from '@/components/socialwall/ModerationPanel';

export default function StaffView({
  codeId, token, groups, eventTitle,
}: {
  codeId: string;
  token: string;
  groups: SocialWallGroup[];
  eventTitle: string;
}) {
  const [tab, setTab] = useState<'posts' | 'members'>('posts');
  const request: SwRequest = useCallback(
    (path, init) => {
      const headers = new Headers(init?.headers);
      headers.set('x-sw-mod', token);
      return fetch(path, { ...init, headers, cache: 'no-store' });
    },
    [token]
  );

  return (
    <div className="fixed inset-0 bg-bg-primary text-text-primary overflow-y-auto" dir="rtl" style={{ top: 'var(--pwa-banner-h, 0px)' }}>
      <header className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur border-b border-border px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-accent" />
          <div className="min-w-0">
            <h1 className="font-bold leading-tight truncate">ניהול תמונות</h1>
            <p className="text-xs text-text-secondary truncate">{eventTitle}</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-3">
          {([
            ['posts', 'תמונות', ShieldCheck],
            ['members', 'משתתפים', Users],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`h-9 px-4 rounded-full text-sm font-semibold flex items-center gap-1.5 ${tab === key ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </header>
      <main className="p-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        {tab === 'posts' ? (
          <ModerationPanel codeId={codeId} groups={groups} request={request} compact />
        ) : (
          <MembersPanel codeId={codeId} groups={groups} request={request} eventTitle={eventTitle} />
        )}
      </main>
    </div>
  );
}
