'use client';

import { MousePointer2, FileText, Image, MessageCircle } from 'lucide-react';
import { LinkClickStats, LinkSource } from '@/types';
import { linkSourceLabels } from '@/lib/analytics';

interface LinkClicksSectionProps {
  stats: LinkClickStats;
}

const sourceIcons: Record<LinkSource, typeof FileText> = {
  pdf: FileText,
  media: Image,
  whatsapp: MessageCircle,
};

const sourceColors: Record<LinkSource, { text: string; bg: string }> = {
  pdf: { text: 'text-red-500', bg: 'bg-red-500/10' },
  media: { text: 'text-blue-500', bg: 'bg-blue-500/10' },
  whatsapp: { text: 'text-green-500', bg: 'bg-green-500/10' },
};

function formatUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Shorten long URLs
    const hostname = urlObj.hostname;
    const path = urlObj.pathname;
    if (path.length > 30) {
      return `${hostname}${path.substring(0, 27)}...`;
    }
    return `${hostname}${path}`;
  } catch {
    // If not a valid URL, truncate if too long
    return url.length > 40 ? url.substring(0, 37) + '...' : url;
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LinkClicksSection({ stats }: LinkClicksSectionProps) {
  if (stats.totalClicks === 0) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-accent/10">
            <MousePointer2 className="w-5 h-5 text-accent" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">קליקים על לינקים</h3>
        </div>
        <div className="text-center py-8 text-text-secondary">
          <MousePointer2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>אין קליקים בטווח התאריכים הנבחר</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <MousePointer2 className="w-5 h-5 text-accent" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">קליקים על לינקים</h3>
        </div>
        <div className="text-sm text-text-secondary">
          סה"כ: <span className="font-bold text-text-primary">{stats.totalClicks}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-right py-3 px-2 text-sm font-medium text-text-secondary">סוג</th>
              <th className="text-right py-3 px-2 text-sm font-medium text-text-secondary">לינק</th>
              <th className="text-center py-3 px-2 text-sm font-medium text-text-secondary">קליקים</th>
              <th className="text-right py-3 px-2 text-sm font-medium text-text-secondary">קליק אחרון</th>
            </tr>
          </thead>
          <tbody>
            {stats.clicksByLink.map((item, index) => {
              const Icon = sourceIcons[item.source];
              const colors = sourceColors[item.source];
              return (
                <tr key={index} className="border-b border-border/50 hover:bg-bg-secondary/50 transition-colors">
                  <td className="py-3 px-2">
                    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg ${colors.bg}`}>
                      <Icon className={`w-4 h-4 ${colors.text}`} />
                      <span className={`text-xs font-medium ${colors.text}`}>
                        {linkSourceLabels[item.source]}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-text-primary hover:text-accent transition-colors"
                      dir="ltr"
                    >
                      {formatUrl(item.url)}
                    </a>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-full bg-accent/10 text-accent font-bold text-sm">
                      {item.count}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-sm text-text-secondary">
                    {formatDate(item.lastClick)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
