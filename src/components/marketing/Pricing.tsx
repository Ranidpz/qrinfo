'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Check, Sparkles, Vote, Camera, Package } from 'lucide-react';

export default function Pricing() {
  const t = useTranslations('marketing.pricing');
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'events'>('subscriptions');

  const plans = [
    {
      key: 'free',
      featured: false,
      priceMonthly: 0,
      priceYearly: 0,
      cta: 'getStarted',
    },
    {
      key: 'business',
      featured: false,
      priceMonthly: 99,
      priceYearly: 990,
      cta: 'getStarted',
    },
    {
      key: 'pro',
      featured: true,
      priceMonthly: 299,
      priceYearly: 2990,
      cta: 'getStarted',
    },
    {
      key: 'enterprise',
      featured: false,
      priceMonthly: null,
      priceYearly: null,
      cta: 'contactUs',
    },
  ];

  // Calculate yearly discount percentage
  const getDiscount = (monthly: number, yearly: number) => {
    if (monthly === 0) return 0;
    const yearlyEquivalent = monthly * 12;
    const saved = yearlyEquivalent - yearly;
    return Math.round((saved / yearlyEquivalent) * 100);
  };

  // Calculate yearly savings amount
  const getSavings = (monthly: number, yearly: number) => {
    if (monthly === 0) return 0;
    return (monthly * 12) - yearly;
  };

  return (
    <section className="py-16 md:py-24 bg-[var(--bg-primary)]" id="pricing">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">
            {t('title')}
          </h2>
          <p className="text-base md:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Main tabs: Subscriptions vs Events */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-xl bg-[var(--bg-secondary)] p-1 border border-[var(--border)]">
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'subscriptions'
                  ? 'bg-[var(--accent)] text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              מנויים
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'events'
                  ? 'bg-[var(--accent)] text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('events.title')}
            </button>
          </div>
        </div>

        {/* Blue divider */}
        <div className="flex items-center justify-center gap-4 mb-8 md:mb-12">
          <div className="h-px w-12 md:w-16 bg-gradient-to-r from-transparent to-[var(--accent)]/50" />
          <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          <div className="h-px w-12 md:w-16 bg-gradient-to-l from-transparent to-[var(--accent)]/50" />
        </div>

        {activeTab === 'subscriptions' && (
          <>
            {/* Pricing cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-7xl mx-auto">
              {plans.map((plan) => {
                const isCustomPrice = plan.key === 'enterprise';
                const isFree = plan.key === 'free';
                const discount = plan.priceMonthly && plan.priceYearly
                  ? getDiscount(plan.priceMonthly, plan.priceYearly)
                  : 0;
                const savings = plan.priceMonthly && plan.priceYearly
                  ? getSavings(plan.priceMonthly, plan.priceYearly)
                  : 0;

                return (
                  <div
                    key={plan.key}
                    className={`relative rounded-2xl p-6 transition-all duration-300 ${
                      plan.featured
                        ? 'bg-gradient-to-b from-[var(--accent)]/10 to-[var(--bg-card)] border-2 border-[var(--accent)] shadow-xl shadow-[var(--accent)]/10 scale-105 z-10'
                        : 'bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)]/30'
                    }`}
                  >
                    {/* Popular badge */}
                    {plan.featured && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[var(--accent)] text-white text-xs font-semibold rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {t('popular')}
                      </div>
                    )}

                    {/* Plan name */}
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                      {t(`${plan.key}.name`)}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                      {t(`${plan.key}.description`)}
                    </p>

                    {/* Price */}
                    <div className="mb-6">
                      {isCustomPrice ? (
                        <span className="text-2xl font-bold text-[var(--text-primary)]">{t('enterprise.price')}</span>
                      ) : isFree ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-[var(--text-primary)]">{t('free.price')}</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Monthly price */}
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-[var(--text-primary)]">₪{plan.priceMonthly}</span>
                            <span className="text-[var(--text-secondary)]">{t('perMonth')}</span>
                          </div>

                          {/* Yearly price with discount */}
                          <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-bold text-green-600 dark:text-green-400">₪{plan.priceYearly}</span>
                              <span className="text-green-600 dark:text-green-400 text-sm">{t('perYear')}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-700 dark:text-green-300 font-medium">
                                {discount}% {t('discount')}
                              </span>
                              <span className="text-xs text-green-600 dark:text-green-400">
                                ({t('save')} ₪{savings})
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* CTA Button */}
                    <Link
                      href={plan.key === 'enterprise' ? '/contact' : '/login'}
                      className={`block w-full py-3 px-4 rounded-xl text-center font-medium transition-all ${
                        plan.featured
                          ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                      }`}
                    >
                      {t(plan.cta)}
                    </Link>

                    {/* Features list */}
                    <ul className="mt-6 space-y-3">
                      {(t.raw(`${plan.key}.features`) as string[]).map((feature: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-[var(--text-secondary)]">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'events' && (
          <div className="max-w-5xl mx-auto">
            <p className="text-center text-[var(--text-secondary)] mb-10">
              {t('events.subtitle')}
            </p>

            {/* Event packages grid */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Q.Vote packages */}
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden">
                <div className="px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center gap-3">
                  <Vote className="w-6 h-6 text-[var(--accent)]" />
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    {t('events.qvote.title')}
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  {['basic', 'pro', 'premium'].map((tier) => (
                    <div key={tier} className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">
                          {t(`events.qvote.${tier}.name`)}
                        </div>
                        <div className="text-sm text-[var(--text-secondary)]">
                          {t(`events.qvote.${tier}.participants`)} • {t(`events.qvote.${tier}.features`)}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-[var(--accent)]">
                        ₪{t(`events.qvote.${tier}.price`)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selfiebeam packages */}
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden">
                <div className="px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center gap-3">
                  <Camera className="w-6 h-6 text-[var(--accent)]" />
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    {t('events.selfiebeam.title')}
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  {['basic', 'pro', 'premium'].map((tier) => (
                    <div key={tier} className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">
                          {t(`events.selfiebeam.${tier}.name`)}
                        </div>
                        <div className="text-sm text-[var(--text-secondary)]">
                          {t(`events.selfiebeam.${tier}.limit`)}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-[var(--accent)]">
                        ₪{t(`events.selfiebeam.${tier}.price`)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bundle packages */}
            <div className="mt-8 bg-gradient-to-br from-[var(--accent)]/5 to-[var(--accent)]/10 rounded-2xl border border-[var(--accent)]/20 overflow-hidden">
              <div className="px-6 py-4 bg-[var(--accent)]/10 border-b border-[var(--accent)]/20 flex items-center gap-3">
                <Package className="w-6 h-6 text-[var(--accent)]" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  {t('events.bundle.title')}
                </h3>
                <span className="px-2 py-0.5 text-xs font-medium bg-[var(--accent)] text-white rounded-full">
                  חיסכון
                </span>
              </div>
              <div className="p-6 grid sm:grid-cols-2 gap-4">
                {['standard', 'full'].map((tier) => (
                  <div key={tier} className="p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {t(`events.bundle.${tier}.name`)}
                      </span>
                      <span className="text-2xl font-bold text-[var(--accent)]">
                        ₪{t(`events.bundle.${tier}.price`)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {t(`events.bundle.${tier}.includes`)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Validity note */}
            <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
              {t('events.validity')}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
