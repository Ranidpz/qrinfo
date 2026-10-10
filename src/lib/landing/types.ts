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
  // The experience's OWN colour (10 בול = gold): only its name and its numbers. Every action and
  // icon on the page uses the system accent instead.
  brandColor: string;
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
  demo: { title: string; text: string };
  steps: { title: string; items: { title: string; text: string }[] };
  ways: {
    title: string;
    items: {
      title: string;
      text: string;
      badge: string;
      soon?: string; // not live yet: a "coming soon" tag on the card
      // a photo, a phone showing the game, or a big screen with a scan code + live leaderboard
      visual: { image: LandingImage } | { phone: string } | { board: { scan: string; title: string; rows: { name: string; value: string }[] } };
    }[];
    chipsLabel?: string;
    chips?: { icon: LucideIcon; label: string }[];
    audience?: string; // one plain sentence
  };
  // What the owner can set (logo, colours, sounds, animated background...) + an optional demo of one
  customize?: { title: string; items: { icon: LucideIcon; label: string }[]; demo?: { label: string; href: string } };
  pricing: {
    title: string;
    plans: PricingPlan[];
    contactTitle: string;
    whatsappText: string; // prefilled WhatsApp message
    emailSubject: string;
    labels: { whatsapp: string; email: string; call: string };
  };
  // Something to rent for the event (e.g. the physical buzzer) - its own band with a photo
  addon?: {
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
  faq: { title: string; items: { q: string; a: string }[] };
  final: { title: string; text: string; cta: string; secondary: string; social: string; backdrop?: string }; // backdrop = a dim parallax photo
}
