'use client';

import { MousePointer2, FileText, Image, MessageCircle } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { LinkClickStats, LinkSource } from '@/types';

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

export default function LinkClicksSection({ stats }: LinkClicksSectionProps) {
  const t = useTranslations('analytics');
  const locale = useLocale();

  // Format date based on locale
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get source label based on translation
  const getSourceLabel = (source: LinkSource): string => {
    switch (source) {
      case 'pdf': return t('pdfSource');
      case 'media': return t('mediaSource');
      case 'whatsapp': return t('whatsappSource');
      default: return source;
    }
  };

  if (stats.totalClicks === 0) {
    return (
      <div className="h-full flex flex-col min-h-0">
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="p-2 rounded-lg bg-accent/10">
            <MousePointer2 className="w-5 h-5 text-accent" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">{t('linkClicks')}</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-text-secondary">
          <MousePointer2 className="w-12 h-12 mb-3 opacity-30" />
          <p>{t('noClicksInRange')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <MousePointer2 className="w-5 h-5 text-accent" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">{t('linkClicks')}</h3>
        </div>
        <div className="text-sm text-text-secondary">
          {t('totalClicks')}: <span className="font-bold text-text-primary">{stats.totalClicks}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-bg-card">
            <tr className="border-b border-border">
              <th className="text-right py-3 px-2 text-sm font-medium text-text-secondary">{t('type')}</th>
              <th className="text-right py-3 px-2 text-sm font-medium text-text-secondary">{t('linkColumn')}</th>
              <th className="text-center py-3 px-2 text-sm font-medium text-text-secondary">{t('clicks')}</th>
              <th className="text-right py-3 px-2 text-sm font-medium text-text-secondary">{t('lastClickTime')}</th>
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
                        {getSourceLabel(item.source)}
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

