import Image from 'next/image';
import { ArrowLeft, CalendarDays, Check, ChevronDown, Mail } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { ExperienceLandingContent, LandingImage } from '@/lib/landing/types';
import { CONTACT, SITE_URL, createHref, experiencesHref, landingUrl } from '@/lib/landing/site';
import { LandingShell, JsonLd, Breadcrumbs } from './LandingShell';
import SocialLinks from './SocialLinks';

// The one template every experience landing page uses: a photo hero with a stats strip, the live
// demo, three steps, the ways to play, pricing, an optional rental add-on band, FAQ and a closing
// call to action. Short sections, server-rendered, so it all reaches search engines as HTML.

const CRUMB = { he: 'חוויות', en: 'Experiences' } as const;
const NAVY = 'bg-[#0b0e1d]';

const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-7 py-3.5 text-base font-bold text-black shadow-lg shadow-amber-400/20 transition-all hover:bg-amber-300 active:scale-[.98]';
const outlineDark =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:border-amber-400 hover:text-amber-300';
const outlineLight =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-bg-card px-7 py-3.5 text-base font-semibold transition-colors hover:border-amber-500/60';
const kicker = 'text-xs font-bold uppercase ltr:tracking-[0.2em] text-violet-600 dark:text-violet-400';
const h2 = 'mt-2 text-3xl font-black tracking-tight sm:text-4xl';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

function Photo({ image, sizes, priority }: { image: LandingImage; sizes: string; priority?: boolean }) {
  return (
    <Image
      src={image.src}
      alt={image.alt}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover"
      style={image.position ? { objectPosition: image.position } : undefined}
    />
  );
}

// "10 בול" -> "10 " + amber "בול."
function BigName({ name }: { name: string }) {
  const i = name.lastIndexOf(' ');
  return (
    <span className="block text-6xl font-black leading-none tracking-tight sm:text-7xl lg:text-8xl">
      {i > 0 ? name.slice(0, i + 1) : ''}
      <span className="text-amber-400">{i > 0 ? name.slice(i + 1) : name}.</span>
    </span>
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
  const wa = (text: string) => `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`;
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
        { '@type': 'ListItem', position: 2, name: c.name, item: pageUrl },
      ],
    },
  ];

  return (
    <LandingShell
      locale={locale}
      slug={slug}
      nav={[
        { label: c.nav.how, href: '#how-it-works' },
        { label: c.nav.ways, href: '#ways' },
        { label: c.nav.pricing, href: '#pricing' },
      ]}
      cta={{ label: c.nav.cta, href: create }}
    >
      <JsonLd data={jsonLd} />
      <main>
        {/* ---------- Hero: full photo, text on its dark side; on phones the photo sits on top ---------- */}
        <section className={`relative overflow-hidden ${NAVY} text-white`}>
          <div className="relative aspect-[16/10] lg:absolute lg:inset-0 lg:aspect-auto">
            <Photo image={c.hero.image} sizes="100vw" priority />
            <div className="absolute inset-0 hidden bg-gradient-to-l from-[#0b0e1d] via-[#0b0e1d]/75 to-transparent lg:block" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0b0e1d] to-transparent lg:hidden" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-2 sm:px-6 lg:py-24">
            {/* ml-auto (not ms-auto): the photo's dark side is on the right in both languages */}
            <div className="lg:ml-auto lg:w-[48%]">
              <div className="hidden text-white/60 lg:block [&_a:hover]:text-white [&_span]:text-white/80">
                <Breadcrumbs
                  items={[
                    { label: 'The Q', href: `/${locale}/marketing` },
                    { label: CRUMB[locale], href: experiencesHref(locale) },
                    { label: c.name },
                  ]}
                />
              </div>
              <p className="flex items-center gap-3 text-sm font-semibold text-amber-300 lg:mt-6">
                <span className="h-0.5 w-8 bg-amber-400" aria-hidden="true" />
                {c.hero.eyebrow}
              </p>
              <h1 className="mt-4">
                <BigName name={c.name} />
                <span className="mt-5 block text-2xl font-bold leading-snug sm:text-3xl lg:text-4xl">
                  {c.hero.tagline.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">{c.hero.lead}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#demo" className={primaryBtn}>
                  {c.hero.ctaSecondary}
                  {forward}
                </a>
                <a href={create} className={outlineDark}>
                  {c.hero.ctaPrimary}
                </a>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70">
                {c.hero.chips.map((chip) => (
                  <li key={chip} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    {chip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {c.hero.stats && (
            <div className="relative border-t border-white/10 bg-[#0f1430]/90">
              <dl className="mx-auto grid max-w-4xl grid-cols-4 gap-2 px-4 py-4 text-center sm:px-6">
                {c.hero.stats.map((s) => (
                  <div key={s.label} className="flex flex-col-reverse items-center gap-0.5 sm:flex-row-reverse sm:justify-center sm:gap-2">
                    <dt className="text-xs text-white/60 sm:text-sm">{s.label}</dt>
                    <dd dir="ltr" className="text-lg font-black tabular-nums text-amber-300 sm:text-xl">
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>

        {/* ---------- Try it ---------- */}
        <section id="demo" className="scroll-mt-14 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <p className={kicker}>{c.demo.kicker}</p>
            <h2 className={h2}>{c.demo.title}</h2>
            <p className="mx-auto mt-3 max-w-xl leading-relaxed text-text-secondary">{c.demo.text}</p>
            <div className="mt-8 text-start">{demo}</div>
          </div>
        </section>

        {/* ---------- Three steps ---------- */}
        <section id="how-it-works" className="scroll-mt-14 border-t border-border/60 bg-bg-secondary py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <p className={kicker}>{c.steps.kicker}</p>
              <h2 className={h2}>{c.steps.title}</h2>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {c.steps.items.map((s, i) => (
                <li key={s.title} className="relative overflow-hidden rounded-2xl border border-border bg-bg-card p-6">
                  <span dir="ltr" aria-hidden="true" className="absolute end-4 top-2 text-6xl font-black text-violet-500/15">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="relative mt-6 text-xl font-bold">{s.title}</h3>
                  <p className="relative mt-2 leading-relaxed text-text-secondary">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Ways to play ---------- */}
        <section id="ways" className="scroll-mt-14 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <p className={kicker}>{c.ways.kicker}</p>
              <h2 className={h2}>{c.ways.title}</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {c.ways.items.map((w) => (
                <article key={w.title} className="overflow-hidden rounded-2xl border border-border bg-bg-card">
                  <div className={`relative aspect-[16/10] overflow-hidden ${NAVY}`}>
                    {'image' in w.visual ? (
                      <Photo image={w.visual.image} sizes="(min-width: 768px) 50vw, 100vw" />
                    ) : (
                      // a phone showing the game - CSS only
                      <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#2b2470,#0b0e1d_70%)]">
                        <div className="h-[78%] w-[30%] min-w-[120px] -rotate-6 rounded-[2rem] border-4 border-white/20 bg-black p-1.5 shadow-2xl">
                          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-[1.6rem] bg-gradient-to-b from-[#1b1f4b] to-black text-white">
                            <span className="text-xs opacity-60">{c.name}</span>
                            <span dir="ltr" className="text-4xl font-black tabular-nums">
                              {w.visual.phone}
                            </span>
                            <span className="mt-2 flex gap-1" aria-hidden="true">
                              <span className="h-2 w-2 rounded-full bg-amber-400" />
                              <span className="h-2 w-2 rounded-full bg-amber-400" />
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    <span className="absolute start-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      {w.badge}
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold">{w.title}</h3>
                    <p className="mt-2 leading-relaxed text-text-secondary">{w.text}</p>
                  </div>
                </article>
              ))}
            </div>
            {c.ways.chips && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm">
                {c.ways.chipsLabel && <span className="text-text-secondary">{c.ways.chipsLabel}</span>}
                {c.ways.chips.map(({ icon: Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-card px-3 py-1.5 font-medium">
                    <Icon className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
            )}
            {c.ways.audience && <p className="mt-4 text-center text-sm text-text-secondary">{c.ways.audience.join(' · ')}</p>}
          </div>
        </section>

        {/* ---------- Pricing ---------- */}
        <section id="pricing" className="scroll-mt-14 border-t border-border/60 bg-bg-secondary py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="text-center">
              <p className={kicker}>{c.pricing.kicker}</p>
              <h2 className={h2}>{c.pricing.title}</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {c.pricing.plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`flex flex-col rounded-2xl border p-6 sm:p-8 ${
                    plan.highlight ? `${NAVY} border-violet-500/40 text-white` : 'border-border bg-bg-card'
                  }`}
                >
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className={`mt-1 text-3xl font-black ${plan.highlight ? 'text-amber-300' : 'text-violet-600 dark:text-violet-400'}`}>{plan.price}</p>
                  <p className={`mt-3 leading-relaxed ${plan.highlight ? 'text-white/70' : 'text-text-secondary'}`}>{plan.text}</p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className={`mt-0.5 h-5 w-5 shrink-0 ${plan.highlight ? 'text-amber-300' : 'text-emerald-500'}`} aria-hidden="true" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.cta.kind === 'create' ? (
                    <a href={create} className={`mt-7 ${outlineLight}`}>
                      {plan.cta.label}
                      {forward}
                    </a>
                  ) : (
                    <a href={wa(c.pricing.whatsappText)} target="_blank" rel="noopener noreferrer" className={`mt-7 ${primaryBtn}`}>
                      <WhatsAppIcon className="h-5 w-5" />
                      {plan.cta.label}
                    </a>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <p className="text-sm font-semibold">{c.pricing.contactTitle}:</p>
              <div className="flex flex-wrap items-center justify-center gap-1">
                <a href={wa(c.pricing.whatsappText)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#128C7E] hover:bg-bg-hover dark:text-[#25D366]">
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

        {/* ---------- Rental add-on (the buzzer) ---------- */}
        {c.addon && (
          <section id="buzzer" className={`scroll-mt-14 ${NAVY} py-16 text-white sm:py-20`}>
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[1.1fr_1fr]">
              <div>
                <p className="flex items-center gap-3 text-xs font-bold uppercase ltr:tracking-[0.2em] text-violet-300">
                  <span className="h-0.5 w-8 bg-violet-400" aria-hidden="true" />
                  {c.addon.kicker}
                </p>
                <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{c.addon.title}</h2>
                <p className="mt-4 max-w-xl leading-relaxed text-white/75">{c.addon.text}</p>
                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/80">
                  {c.addon.points.map((p) => (
                    <li key={p} className="flex items-center gap-1.5">
                      <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
                {c.addon.games && (
                  <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-white/60">{c.addon.games.label}</span>
                    {c.addon.games.items.map((g) =>
                      g.href ? (
                        <a key={g.name} href={g.href} className="rounded-full border border-white/20 px-3 py-1.5 font-semibold text-white transition-colors hover:border-amber-400 hover:text-amber-300">
                          {g.name}
                        </a>
                      ) : (
                        <span key={g.name} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/20 px-3 py-1.5 font-semibold text-white/70">
                          {g.name}
                          {g.soon && <span className="rounded-full bg-violet-500/30 px-2 py-0.5 text-[11px] text-violet-200">{g.soon}</span>}
                        </span>
                      ),
                    )}
                  </div>
                )}
                <a href={wa(c.addon.whatsappText)} target="_blank" rel="noopener noreferrer" className={`mt-8 ${primaryBtn}`}>
                  <WhatsAppIcon className="h-5 w-5" />
                  {c.addon.cta}
                </a>
                {c.addon.idea && (
                  <p className="mt-4 text-sm text-white/60">
                    {c.addon.idea.text}{' '}
                    <a href={wa(c.addon.idea.whatsappText)} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#25D366] hover:underline">
                      {c.addon.idea.cta}
                    </a>
                  </p>
                )}
              </div>
              <div className="relative mx-auto aspect-[4/5] w-full max-w-sm [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_80%)]">
                <Photo image={c.addon.image} sizes="(min-width: 768px) 384px, 100vw" />
              </div>
            </div>
          </section>
        )}

        {/* ---------- FAQ: native <details>, answers stay in the HTML while collapsed ---------- */}
        <section id="faq" className="scroll-mt-14 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="text-center">
              <p className={kicker}>{c.faq.kicker}</p>
              <h2 className={h2}>{c.faq.title}</h2>
            </div>
            <div className="mt-8 space-y-3">
              {c.faq.items.map((f) => (
                <details key={f.q} className="group rounded-2xl border border-border bg-bg-card open:border-amber-500/40">
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

        {/* ---------- Closing call to action ---------- */}
        <section className={`relative overflow-hidden ${NAVY} py-16 text-center text-white sm:py-24`}>
          {c.final.backdrop && (
            // dim photo behind the text; fixed (parallax) on desktop only - iOS ignores background-attachment
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-contain bg-center bg-no-repeat opacity-25 lg:bg-fixed"
              style={{ backgroundImage: `url(${c.final.backdrop})` }}
            />
          )}
          <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
            <p className="text-xs font-bold uppercase ltr:tracking-[0.2em] text-violet-300">{c.final.kicker}</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{c.final.title}</h2>
            <p className="mt-4 text-lg text-white/70">{c.final.text}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a href={create} className={primaryBtn}>
                {c.final.cta}
                {forward}
              </a>
              <a href={playHref} target="_blank" rel="noopener" className={outlineDark}>
                {c.final.secondary}
              </a>
            </div>
            <div className="mt-10 flex flex-col items-center gap-3">
              <p className="text-sm text-white/60">{c.final.social}</p>
              <SocialLinks labels />
            </div>
          </div>
        </section>
      </main>
    </LandingShell>
  );
}
