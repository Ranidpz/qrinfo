import { ArrowLeft, CalendarDays, Check, ChevronDown, Mail, Sparkles } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { ExperienceLandingContent } from '@/lib/landing/types';
import { CONTACT, SITE_URL, createHref, landingPath, landingUrl } from '@/lib/landing/site';
import { LandingShell, JsonLd, Breadcrumbs } from './LandingShell';

// The one template every experience landing page uses (modelled on the costume-competition page):
// hero + live demo, what it is, how it works, features, who it's for, branding, pricing + contact,
// create steps, FAQ, final CTA. Server-rendered, so all of it is in the HTML for search engines.

const CRUMB = { he: 'חוויות', en: 'Experiences' } as const;

const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-7 py-3.5 text-base font-bold text-black shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-400 hover:shadow-amber-500/40 active:scale-[.98]';
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-bg-card px-7 py-3.5 text-base font-semibold transition-colors hover:border-amber-500/50';
const accentText = 'text-amber-700 dark:text-amber-300';
const accentIcon = 'text-amber-600 dark:text-amber-400';
const h2 = 'text-3xl font-bold tracking-tight sm:text-4xl';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

export default function ExperienceLanding({
  locale,
  slug,
  experience,
  content: c,
  demo,
  playHref,
  entityJsonLd,
}: {
  locale: Locale;
  slug: string;
  experience: string; // the dashboard create key, e.g. 'tenbool'
  content: ExperienceLandingContent;
  demo: React.ReactNode;
  playHref: string; // full-screen demo
  entityJsonLd: Record<string, unknown>; // the experience itself (VideoGame / WebApplication / ...)
}) {
  const create = createHref(locale, experience);
  const pageUrl = landingUrl(locale, slug);
  const whatsapp = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(c.pricing.whatsappText)}`;
  const mail = `mailto:${CONTACT.email}?subject=${encodeURIComponent(c.pricing.emailSubject)}`;
  const forward = <ArrowLeft className="h-5 w-5 ltr:rotate-180" aria-hidden="true" />;

  const jsonLd = [
    { '@context': 'https://schema.org', '@id': `${pageUrl}#experience`, url: pageUrl, inLanguage: locale, ...entityJsonLd },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: locale,
      mainEntity: c.faq.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'The Q', item: `${SITE_URL}/${locale}/marketing` },
        { '@type': 'ListItem', position: 2, name: CRUMB[locale], item: landingUrl(locale) },
        { '@type': 'ListItem', position: 3, name: c.name, item: pageUrl },
      ],
    },
  ];

  return (
    <LandingShell locale={locale} slug={slug}>
      <JsonLd data={jsonLd} />
      <main>
        {/* Hero: the pitch and the live demo side by side */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_0%,rgba(245,158,11,0.18),transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-6 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:pb-20 lg:pt-12">
            <div>
              <Breadcrumbs
                items={[
                  { label: 'The Q', href: `/${locale}/marketing` },
                  { label: CRUMB[locale], href: landingPath(locale) },
                  { label: c.name },
                ]}
              />
              <p className={`mt-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-medium ${accentText}`}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {c.hero.eyebrow}
              </p>
              <h1 className="mt-4 text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">{c.hero.title}</h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-secondary">{c.hero.lead}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href={create} className={primaryBtn}>
                  {c.hero.ctaPrimary}
                  {forward}
                </a>
                <a href={playHref} target="_blank" rel="noopener" className={secondaryBtn}>
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
            {demo}
          </div>
        </section>

        {/* What it is */}
        <section className="border-t border-border/60 bg-bg-secondary py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className={h2}>{c.what.title}</h2>
            <div className="mt-6 space-y-4 text-lg leading-relaxed text-text-secondary">
              {c.what.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-14 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className={h2}>{c.howTo.title}</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {c.howTo.steps.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-border bg-bg-card p-6">
                  <span dir="ltr" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-lg font-black text-black">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-text-secondary">{s.text}</p>
                </li>
              ))}
            </ol>
            {c.howTo.extras && (
              <>
                {c.howTo.extrasTitle && <h3 className="mt-12 text-2xl font-bold">{c.howTo.extrasTitle}</h3>}
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {c.howTo.extras.map(({ icon: Icon, title, text }) => (
                    <div key={title} className="flex gap-4 rounded-2xl border border-border bg-bg-card p-6">
                      <Icon className={`h-6 w-6 shrink-0 ${accentIcon}`} aria-hidden="true" />
                      <div>
                        <h4 className="text-lg font-bold">{title}</h4>
                        <p className="mt-1.5 leading-relaxed text-text-secondary">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Features */}
        <section id={c.features.id} className="scroll-mt-14 border-y border-border/60 bg-bg-secondary py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className={h2}>{c.features.title}</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-secondary">{c.features.intro}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {c.features.items.map(({ icon: Icon, title, text, note }) => (
                <article key={title} className="flex flex-col rounded-2xl border border-border bg-bg-card p-6">
                  <Icon className={`h-7 w-7 ${accentIcon}`} aria-hidden="true" />
                  <h3 className="mt-4 text-xl font-bold">{title}</h3>
                  <p className="mt-2 flex-1 leading-relaxed text-text-secondary">{text}</p>
                  {note && <p className={`mt-4 text-sm font-semibold ${accentText}`}>{note}</p>}
                </article>
              ))}
            </div>
            {c.features.footnote && <p className="mt-6 text-text-secondary">{c.features.footnote}</p>}
          </div>
        </section>

        {/* Who it's for */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className={h2}>{c.audience.title}</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.audience.items.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-2xl border border-border bg-bg-card p-6">
                  <Icon className={`h-6 w-6 ${accentIcon}`} aria-hidden="true" />
                  <h3 className="mt-3 text-lg font-bold">{title}</h3>
                  <p className="mt-1.5 leading-relaxed text-text-secondary">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Branding (+ an optional callout) */}
        <section className="border-y border-border/60 bg-bg-secondary py-16 sm:py-20">
          <div className={`mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 ${c.customize.callout ? 'lg:grid-cols-[1.4fr_1fr]' : ''}`}>
            <div>
              <h2 className={h2}>{c.customize.title}</h2>
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
            {c.customize.callout && (
              <div className="self-start rounded-2xl border border-[#25D366]/30 bg-[#25D366]/10 p-6">
                <c.customize.callout.icon className="h-7 w-7 text-[#128C7E] dark:text-[#25D366]" aria-hidden="true" />
                <h3 className="mt-3 text-2xl font-bold">{c.customize.callout.title}</h3>
                <p className="mt-2 leading-relaxed text-text-secondary">{c.customize.callout.text}</p>
              </div>
            )}
          </div>
        </section>

        {/* Pricing + contact */}
        <section id="pricing" className="scroll-mt-14 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className={h2}>{c.pricing.title}</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-secondary">{c.pricing.intro}</p>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {c.pricing.plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`flex flex-col rounded-2xl border bg-bg-card p-6 sm:p-8 ${
                    plan.highlight ? 'border-amber-500/50 shadow-xl shadow-amber-500/10' : 'border-border'
                  }`}
                >
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="mt-2 text-3xl font-black">{plan.price}</p>
                  <p className="mt-3 leading-relaxed text-text-secondary">{plan.text}</p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.cta.kind === 'create' ? (
                    <a href={create} className={`mt-7 ${plan.highlight ? primaryBtn : secondaryBtn}`}>
                      {plan.cta.label}
                    </a>
                  ) : (
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={`mt-7 ${plan.highlight ? primaryBtn : secondaryBtn}`}>
                      <WhatsAppIcon className="h-5 w-5" />
                      {plan.cta.label}
                    </a>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-border bg-bg-secondary p-5 sm:flex-row sm:justify-between">
              <p className="font-semibold">{c.pricing.contactTitle}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#128C7E] hover:bg-bg-hover dark:text-[#25D366]">
                  <WhatsAppIcon className="h-4 w-4" />
                  {c.pricing.labels.whatsapp}
                </a>
                <a href={mail} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {c.pricing.labels.email}
                </a>
                <a href={CONTACT.calendar} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {c.pricing.labels.call}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Create */}
        <section id="create" className="scroll-mt-14 border-t border-border/60 bg-bg-secondary py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className={h2}>{c.create.title}</h2>
            <ol className="mt-8 space-y-4">
              {c.create.steps.map((s, i) => (
                <li key={s} className="flex items-start gap-4">
                  <span dir="ltr" className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-500/50 font-bold ${accentText}`}>
                    {i + 1}
                  </span>
                  <span className="pt-1 text-lg leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
            <a href={create} className={`mt-8 ${primaryBtn}`}>
              {c.create.cta}
              {forward}
            </a>
          </div>
        </section>

        {/* FAQ - native <details>: the answers are in the HTML even while collapsed */}
        <section id="faq" className="scroll-mt-14 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className={h2}>{c.faq.title}</h2>
            <div className="mt-8 space-y-3">
              {c.faq.items.map((f, i) => (
                <details key={f.q} open={i === 0} className="group rounded-2xl border border-border bg-bg-card open:border-amber-500/40">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    <h3>{f.q}</h3>
                    <ChevronDown className="h-5 w-5 shrink-0 text-text-secondary transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="px-5 pb-5 leading-relaxed text-text-secondary">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border/60 bg-bg-secondary py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className={h2}>{c.final.title}</h2>
            <p className="mt-3 text-lg text-text-secondary">{c.final.text}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a href={create} className={primaryBtn}>
                {c.final.cta}
                {forward}
              </a>
              <a href={playHref} target="_blank" rel="noopener" className={secondaryBtn}>
                {c.final.secondary}
              </a>
            </div>
          </div>
        </section>
      </main>
    </LandingShell>
  );
}
