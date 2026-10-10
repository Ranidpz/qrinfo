import { Facebook, Instagram, Youtube } from 'lucide-react';
import { SOCIAL } from '@/lib/landing/site';

// Playzone's Facebook / YouTube / Instagram (whichever are set in SOCIAL). Icon-only by default;
// `labels` shows the network names next to the icons. No hooks, so it works in server and client trees.

const NETWORKS = [
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'hover:text-[#1877F2]' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'hover:text-[#FF0000]' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'hover:text-[#E4405F]' },
] as const;

export default function SocialLinks({ labels = false, className = '' }: { labels?: boolean; className?: string }) {
  const live = NETWORKS.filter((n) => SOCIAL[n.id]);
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {live.map(({ id, name, icon: Icon, color }) => (
        <a
          key={id}
          href={SOCIAL[id]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={name}
          title={name}
          className={
            labels
              ? `inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors ${color}`
              : `inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] ${color}`
          }
        >
          <Icon className={labels ? 'h-5 w-5' : 'h-5 w-5'} aria-hidden="true" />
          {labels && name}
        </a>
      ))}
    </div>
  );
}
