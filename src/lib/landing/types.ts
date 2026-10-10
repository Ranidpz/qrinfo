import type { LucideIcon } from 'lucide-react';

// The shape every experience landing page fills in (see ExperienceLanding). One object per
// language; the template renders the same short sections, in the same order, for every
// experience. Keep every text to a line or two - the page is meant to be read in a scroll.

export interface LandingImage {
  src: string; // under /public
  alt: string;
  position?: string; // CSS object-position for crops, e.g. '20% 60%'
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
  nav: { how: string; ways: string; pricing: string; cta: string };
  hero: {
    eyebrow: string;
    tagline: string[]; // the lines under the big name (part of the <h1>)
    lead: string;
    ctaPrimary: string; // create your own
    ctaSecondary: string; // opens the full-screen demo
    chips: string[];
    image: LandingImage;
    stats?: { value: string; label: string }[];
  };
  demo: { kicker: string; title: string; text: string };
  steps: { kicker: string; title: string; items: { title: string; text: string }[] };
  ways: {
    kicker: string;
    title: string;
    items: { title: string; text: string; badge: string; visual: { image: LandingImage } | { phone: string } }[];
    chipsLabel?: string;
    chips?: { icon: LucideIcon; label: string }[];
    audience?: string[];
  };
  pricing: {
    kicker: string;
    title: string;
    plans: PricingPlan[];
    contactTitle: string;
    whatsappText: string; // prefilled WhatsApp message
    emailSubject: string;
    labels: { whatsapp: string; email: string; call: string };
  };
  // Something to rent for the event (e.g. the physical buzzer) - its own band with a photo
  addon?: {
    kicker: string;
    title: string;
    text: string;
    points: string[];
    cta: string;
    whatsappText: string;
    image: LandingImage;
    // What else the rented item works with: href = its page / card, soon = not live yet
    games?: { label: string; items: { name: string; href?: string; soon?: string }[] };
    idea?: { text: string; cta: string; whatsappText: string }; // "thought of a game? talk to us"
  };
  faq: { kicker: string; title: string; items: { q: string; a: string }[] };
  final: { kicker: string; title: string; text: string; cta: string; secondary: string; social: string; backdrop?: string }; // backdrop = a dim parallax photo
}
