import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import {
  ArrowLeft,
  Building2,
  Cake,
  Check,
  ChevronDown,
  GraduationCap,
  Hash,
  Heart,
  Keyboard,
  MessageCircle,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  UtensilsCrossed,
  PartyPopper,
} from 'lucide-react';
import { LandingShell, JsonLd, Breadcrumbs } from '@/components/landing/LandingShell';
import TenBoolDemo from '@/components/landing/TenBoolDemo';
import { TENBOOL_CONTENT } from '@/lib/landing/tenbool-content';
import { LANDING_PAGES, SITE_URL, createHref, tenboolDemoSrc, isLandingLocale, landingAlternates, landingPath, landingUrl } from '@/lib/landing/site';

const SLUG = '10-bool';
const CARD = LANDING_PAGES.find((p) => p.slug === SLUG)!;
const OG_IMAGE = CARD.image;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLandingLocale(locale)) return {};
  const c = TENBOOL_CONTENT[locale].meta;
  return {
    title: { absolute: c.title },
    description: c.description,
    keywords: c.keywords,
    alternates: landingAlternates(locale, SLUG),
    openGraph: {
      title: c.title,
      description: c.description,
      url: landingPath(locale, SLUG),
      siteName: 'The Q',
      locale: locale === 'he' ? 'he_IL' : 'en_US',
      alternateLocale: locale === 'he' ? ['en_US'] : ['he_IL'],
      type: 'website',
      images: [{ url: OG_IMAGE, width: 633, height: 633, alt: c.ogAlt }],
    },
    twitter: { card: 'summary', title: c.title, description: c.description, images: [OG_IMAGE] },
  };
}

const MODE_ICON = { wins: Trophy, counter: Hash, lives: Heart } as const;
const AUDIENCE_ICON = [Building2, Users, Cake, GraduationCap, UtensilsCrossed, PartyPopper];

export default async function TenBoolLandingPage({ params }: Props) {
  const { locale } = await params;
  if (!isLandingLocale(locale)) notFound();
  setRequestLocale(locale);
  const c = TENBOOL_CONTENT[locale];
  const create = createHref(locale, 'tenbool');
  const pageUrl = landingUrl(locale, SLUG);
  const name = CARD.title[locale];
  const forward = <ArrowLeft className="h-5 w-5 ltr:rotate-180" aria-hidden="true" />;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': ['VideoGame', 'WebApplication'],
      '@id': `${pageUrl}#game`,
      name,
      alternateName: ['10 בול', '10 Bool', 'Ten Bool'],
      description: c.meta.description,
      url: pageUrl,
      image: `${SITE_URL}${OG_IMAGE}`,
      inLanguage: locale,
      applicationCategory: 'GameApplication',
      genre: ['Party game', 'Timing game'],
      operatingSystem: 'Any (web browser)',
      gamePlatform: ['Web browser', 'Mobile', 'Desktop'],
      playMode: ['SinglePlayer', 'MultiPlayer'],
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'ILS', availability: 'https://schema.org/InStock' },
      publisher: { '@type': 'Organization', name: 'Playzone', url: SITE_URL },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: locale,
      mainEntity: c.faq.items.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: c.breadcrumbs.home, item: `${SITE_URL}/${locale}/marketing` },
        { '@type': 'ListItem', position: 2, name: c.breadcrumbs.games, item: landingUrl(locale) },
        { '@type': 'ListItem', position: 3, name, item: pageUrl },
      ],
    },
  ];

  return (
    <LandingShell locale={locale} slug={SLUG}>
      <JsonLd data={jsonLd} />
      <main>
        {/* Hero: the pitch and the live game side by side */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_0%,rgba(245,158,11,0.18),transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-6 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:pb-20 lg:pt-12">
            <div>
              <Breadcrumbs
                items={[
                  { label: c.breadcrumbs.home, href: `/${locale}/marketing` },
                  { label: c.breadcrumbs.games, href: landingPath(locale) },
                  { label: name },
                ]}
              />
              <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-700 dark:text-amber-300">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {c.hero.eyebrow}
              </p>
              <h1 className="mt-4 text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">{c.hero.title}</h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-secondary">{c.hero.lead}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={create}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-7 py-3.5 text-base font-bold text-black shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-400 hover:shadow-amber-500/40 active:scale-[.98]"
                >
                  {c.hero.ctaPrimary}
                  {forward}
                </a>
                <a
                  href={tenboolDemoSrc('wins')}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-bg-card px-7 py-3.5 text-base font-semibold transition-colors hover:border-amber-500/50"
                >
                  {c.hero.ctaSecondary}
                </a>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-secondary">
                {c.hero.chips.map((chip) => (
                  <li key={chip} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    {chip}
                  </li>
                ))}
              </ul>
            </div>
            <TenBoolDemo labels={c.demo} />
          </div>
        </section>

        {/* What it is */}
        <section className="border-t border-border/60 bg-bg-secondary py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.what.title}</h2>
            <div className="mt-6 space-y-4 text-lg leading-relaxed text-text-secondary">
              {c.what.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* How to play */}
        <section id="how-to-play" className="scroll-mt-14 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.howTo.title}</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {c.howTo.steps.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-border bg-bg-card p-6">
                  <span
                    dir="ltr"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-lg font-black text-black"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-text-secondary">{s.text}</p>
                </li>
              ))}
            </ol>
            <h3 className="mt-12 text-2xl font-bold">{c.howTo.controlsTitle}</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {c.howTo.controls.map((ctl, i) => {
                const Icon = i === 0 ? Keyboard : Smartphone;
                return (
                  <div key={ctl.title} className="flex gap-4 rounded-2xl border border-border bg-bg-card p-6">
                    <Icon className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <div>
                      <h4 className="text-lg font-bold">{ctl.title}</h4>
                      <p className="mt-1.5 leading-relaxed text-text-secondary">{ctl.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Scoreboards */}
        <section id="modes" className="scroll-mt-14 border-y border-border/60 bg-bg-secondary py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.modes.title}</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-secondary">{c.modes.intro}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {c.modes.items.map((m) => {
                const Icon = MODE_ICON[m.id];
                return (
                  <article key={m.id} className="flex flex-col rounded-2xl border border-border bg-bg-card p-6">
                    <Icon className="h-7 w-7 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <h3 className="mt-4 text-xl font-bold">{m.title}</h3>
                    <p className="mt-2 flex-1 leading-relaxed text-text-secondary">{m.text}</p>
                    <p className="mt-4 text-sm font-semibold text-amber-700 dark:text-amber-300">{m.best}</p>
                  </article>
                );
              })}
            </div>
            <p className="mt-6 text-text-secondary">{c.modes.off}</p>
          </div>
        </section>

        {/* Who it's for */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.audience.title}</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.audience.items.map((a, i) => {
                const Icon = AUDIENCE_ICON[i % AUDIENCE_ICON.length];
                return (
                  <li key={a.title} className="rounded-2xl border border-border bg-bg-card p-6">
                    <Icon className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <h3 className="mt-3 text-lg font-bold">{a.title}</h3>
                    <p className="mt-1.5 leading-relaxed text-text-secondary">{a.text}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Branding + WhatsApp */}
        <section className="border-y border-border/60 bg-bg-secondary py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.customize.title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-text-secondary">{c.customize.intro}</p>
              <ul className="mt-6 space-y-3">
                {c.customize.items.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="self-start rounded-2xl border border-[#25D366]/30 bg-[#25D366]/10 p-6">
              <MessageCircle className="h-7 w-7 text-[#128C7E] dark:text-[#25D366]" aria-hidden="true" />
              <h2 className="mt-3 text-2xl font-bold">{c.share.title}</h2>
              <p className="mt-2 leading-relaxed text-text-secondary">{c.share.text}</p>
            </div>
          </div>
        </section>

        {/* Create */}
        <section id="create" className="scroll-mt-14 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.create.title}</h2>
            <ol className="mt-8 space-y-4">
              {c.create.steps.map((s, i) => (
                <li key={s} className="flex items-start gap-4">
                  <span
                    dir="ltr"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-500/50 font-bold text-amber-700 dark:text-amber-300"
                  >
                    {i + 1}
                  </span>
                  <span className="pt-1 text-lg leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
            <a
              href={create}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-7 py-3.5 text-base font-bold text-black shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-400 active:scale-[.98]"
            >
              {c.create.cta}
              {forward}
            </a>
          </div>
        </section>

        {/* FAQ - native <details>: the answers are in the HTML even while collapsed */}
        <section id="faq" className="scroll-mt-14 border-t border-border/60 bg-bg-secondary py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.faq.title}</h2>
            <div className="mt-8 space-y-3">
              {c.faq.items.map((f, i) => (
                <details
                  key={f.q}
                  open={i === 0}
                  className="group rounded-2xl border border-border bg-bg-card open:border-amber-500/40"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    <h3>{f.q}</h3>
                    <ChevronDown
                      className="h-5 w-5 shrink-0 text-text-secondary transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="px-5 pb-5 leading-relaxed text-text-secondary">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <p dir="ltr" className="font-black leading-none tabular-nums text-6xl text-amber-500 sm:text-7xl">
              10.00
            </p>
            <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{c.final.title}</h2>
            <p className="mt-3 text-lg text-text-secondary">{c.final.text}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={create}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-7 py-3.5 text-base font-bold text-black shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-400 active:scale-[.98]"
              >
                {c.final.cta}
                {forward}
              </a>
              <a
                href={tenboolDemoSrc('wins')}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-bg-card px-7 py-3.5 text-base font-semibold transition-colors hover:border-amber-500/50"
              >
                {c.final.secondary}
              </a>
            </div>
          </div>
        </section>
      </main>
    </LandingShell>
  );
}
