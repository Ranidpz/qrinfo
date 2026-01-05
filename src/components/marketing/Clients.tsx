'use client';

import { useTranslations } from 'next-intl';

export default function Clients() {
  const t = useTranslations('marketing.clients');

  // Placeholder client logos - replace with actual client logos
  const placeholderLogos = [
    { name: 'Client 1', initials: 'C1' },
    { name: 'Client 2', initials: 'C2' },
    { name: 'Client 3', initials: 'C3' },
    { name: 'Client 4', initials: 'C4' },
    { name: 'Client 5', initials: 'C5' },
    { name: 'Client 6', initials: 'C6' },
  ];

  return (
    <section className="py-20 bg-[var(--bg-secondary)] border-y border-[var(--border)]">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
            {t('title')}
          </h2>
          <p className="text-[var(--text-secondary)]">
            {t('subtitle')}
          </p>
        </div>

        {/* Client logos */}
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-60">
          {placeholderLogos.map((client, index) => (
            <div
              key={index}
              className="w-24 h-12 flex items-center justify-center rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-sm hover:opacity-80 transition-opacity"
              title={`${client.name} - Placeholder for logo`}
            >
              {/* Replace this with actual <img> tags or Image components */}
              {client.initials}
            </div>
          ))}
        </div>

        {/* Note for adding real logos */}
        <p className="text-center text-xs text-[var(--text-secondary)] mt-8 opacity-50">
          {/* This comment is for the developer - remove in production */}
          {/* Add real client logos by replacing the placeholder divs above with Image components */}
        </p>
      </div>
    </section>
  );
}
