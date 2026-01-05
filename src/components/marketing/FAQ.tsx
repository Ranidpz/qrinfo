'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

export default function FAQ() {
  const t = useTranslations('marketing.faq');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const items = t.raw('items') as FAQItem[];

  return (
    <section className="py-16 md:py-24 bg-[var(--bg-secondary)]" id="faq">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-16">
          <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 mb-4 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20">
            <HelpCircle className="w-6 h-6 md:w-7 md:h-7 text-[var(--accent)]" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">
            {t('title')}
          </h2>
          <p className="text-base md:text-lg text-[var(--text-secondary)]">
            {t('subtitle')}
          </p>
        </div>

        {/* FAQ items */}
        <div className="max-w-3xl mx-auto space-y-2 md:space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden transition-all duration-200 hover:border-[var(--accent)]/30"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-4 md:p-5 text-right rtl:text-right ltr:text-left"
              >
                <span className="font-medium text-sm md:text-base text-[var(--text-primary)] pr-4 rtl:pr-0 rtl:pl-4">
                  {item.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-[var(--text-secondary)] flex-shrink-0 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="px-5 pb-5 pt-0">
                  <p className="text-[var(--text-secondary)] leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
