import type { LucideIcon } from 'lucide-react';

// The shape every experience landing page fills in (see ExperienceLanding). One object per
// language; the template renders the same sections, in the same order, for every experience.

export interface IconItem {
  icon: LucideIcon;
  title: string;
  text: string;
  note?: string; // short highlighted line under the text
}

export interface PricingPlan {
  name: string;
  price: string;
  text: string;
  features: string[];
  cta: { label: string; kind: 'create' | 'contact' };
  highlight?: boolean;
}

export interface ExperienceLandingContent {
  name: string; // the experience's display name, e.g. "10 בול"
  meta: { title: string; description: string; ogAlt: string; keywords: string[] };
  hero: {
    eyebrow: string;
    title: string; // the page's only <h1>
    lead: string;
    ctaPrimary: string;
    ctaSecondary: string; // opens the full-screen demo
    chips: string[];
  };
  what: { title: string; paragraphs: string[] };
  howTo: { title: string; steps: { title: string; text: string }[]; extrasTitle?: string; extras?: IconItem[] };
  features: { id: string; title: string; intro: string; items: IconItem[]; footnote?: string };
  audience: { title: string; items: IconItem[] };
  customize: { title: string; intro: string; items: string[]; callout?: { icon: LucideIcon; title: string; text: string } };
  pricing: {
    title: string;
    intro: string;
    plans: PricingPlan[];
    contactTitle: string;
    whatsappText: string; // prefilled WhatsApp message
    emailSubject: string;
    labels: { whatsapp: string; email: string; call: string };
  };
  create: { title: string; steps: string[]; cta: string };
  faq: { title: string; items: { q: string; a: string }[] };
  final: { title: string; text: string; cta: string; secondary: string };
}
