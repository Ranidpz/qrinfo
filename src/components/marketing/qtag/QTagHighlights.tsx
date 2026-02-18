'use client';

import { useTranslations } from 'next-intl';
import { ShieldCheck, Users, ScanLine, BarChart3, FileSpreadsheet, Check } from 'lucide-react';

export default function QTagHighlights() {
  const tScanner = useTranslations('qtagMarketing.highlights.scanner');
  const tDashboard = useTranslations('qtagMarketing.highlights.dashboard');
  const scannerPoints = tScanner.raw('points') as string[];
  const dashboardPoints = tDashboard.raw('points') as string[];

  return (
    <section className="py-20 md:py-28 bg-[var(--bg-secondary)]">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-20">

          {/* Scanner Sharing Highlight */}
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
            {/* Visual */}
            <div className="flex-shrink-0 w-full md:w-[280px]">
              <div className="relative mx-auto w-[200px] h-[200px] md:w-[280px] md:h-[280px]">
                {/* Background glow */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 blur-2xl" />
                {/* Main circle */}
                <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-orange-500/10 to-pink-500/10 border border-orange-500/20 flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                    <ShieldCheck className="w-8 h-8 text-white" strokeWidth={1.5} />
                  </div>
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
                      <Users className="w-5 h-5 text-orange-400" strokeWidth={1.5} />
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
                      <ScanLine className="w-5 h-5 text-pink-400" strokeWidth={1.5} />
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
                      <ScanLine className="w-5 h-5 text-purple-400" strokeWidth={1.5} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 text-center md:text-start">
              <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-4">
                {tScanner('title')}
              </h3>
              <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
                {tScanner('description')}
              </p>
              <ul className="space-y-3">
                {scannerPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-orange-400" strokeWidth={3} />
                    </div>
                    <span className="text-sm text-[var(--text-secondary)]">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Real-time Dashboard Highlight */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-10 md:gap-16">
            {/* Visual */}
            <div className="flex-shrink-0 w-full md:w-[280px]">
              <div className="relative mx-auto w-[200px] h-[200px] md:w-[280px] md:h-[280px]">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 blur-2xl" />
                <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <BarChart3 className="w-8 h-8 text-white" strokeWidth={1.5} />
                  </div>
                  {/* Mini stat cards */}
                  <div className="flex gap-2">
                    <div className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-center">
                      <div className="text-lg font-bold text-purple-400">247</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">arrived</div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-center">
                      <div className="text-lg font-bold text-blue-400">312</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">total</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 text-center md:text-start">
              <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-4">
                {tDashboard('title')}
              </h3>
              <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
                {tDashboard('description')}
              </p>
              <ul className="space-y-3">
                {dashboardPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-purple-400" strokeWidth={3} />
                    </div>
                    <span className="text-sm text-[var(--text-secondary)]">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
