'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, HelpCircle } from 'lucide-react';

export default function CostumeFAQ() {
  const t = useTranslations('costumeCompetition.faq');
  const faqItems = t.raw('items') as Array<{ question: string; answer: string }>;
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 md:py-28 bg-[var(--bg-secondary)]">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500">
            <HelpCircle className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-[var(--text-primary)]">
            {t('title')}
          </h2>
        </div>

        {/* FAQ items */}
        <div className="max-w-3xl mx-auto space-y-4">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={index}
                className={`rounded-2xl border transition-all duration-300 ${
                  isOpen
                    ? 'bg-[var(--bg-card)] border-purple-500/50 shadow-lg shadow-purple-500/10'
                    : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-purple-500/30'
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-right"
                >
                  <span className={`text-lg font-medium transition-colors ${isOpen ? 'text-purple-400' : 'text-[var(--text-primary)]'}`}>
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-[var(--text-secondary)] transition-transform duration-300 flex-shrink-0 mr-4 ${
                      isOpen ? 'rotate-180 text-purple-400' : ''
                    }`}
                  />
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 pb-6 text-[var(--text-secondary)] leading-relaxed">
                    {item.answer}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
