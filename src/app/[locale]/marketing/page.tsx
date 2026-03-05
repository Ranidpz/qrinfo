import { Metadata } from 'next';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import Hero from '@/components/marketing/Hero';
import HowItWorks from '@/components/marketing/HowItWorks';
import Features from '@/components/marketing/Features';
import UseCases from '@/components/marketing/UseCases';
import Benefits from '@/components/marketing/Benefits';
import Clients from '@/components/marketing/Clients';
import Pricing from '@/components/marketing/Pricing';
import FAQ from '@/components/marketing/FAQ';
import FinalCTA from '@/components/marketing/FinalCTA';
import Footer from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'The Q - One Code. Endless Experiences.',
  description: 'Create dynamic QR codes for interactive experiences - voting, multiplayer games, event registration & check-in, treasure hunts, trivia, selfie walls, schedules, gamification and more. Update in real-time without reprinting. | צרו קודי QR דינמיים לחוויות אינטראקטיביות - הצבעות, משחקי מולטיפלייר, רישום לאירועים, ציד אוצרות, טריוויה, קירות סלפי ועוד.',
  keywords: ['QR code', 'dynamic QR', 'interactive QR', 'voting system', 'Q.Vote', 'event management', 'event registration', 'check-in', 'Q.Tag', 'digital experiences', 'selfie wall', 'gamification', 'Q.Games', 'multiplayer games', 'mini games', 'trivia', 'Q.Challenge', 'treasure hunt', 'Q.Hunt', 'Q.Treasure', 'Q.Stage', 'oLeague', 'tournament', 'weekly schedule', 'Q.Cal'],
  openGraph: {
    title: 'The Q - One Code. Endless Experiences.',
    description: 'Create dynamic QR codes for interactive digital experiences | צרו קודי QR דינמיים לחוויות אינטראקטיביות',
    type: 'website',
  },
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <MarketingHeader />
      <main>
        <Hero />
        <HowItWorks />
        <section id="features">
          <Features />
        </section>
        <section id="usecases">
          <UseCases />
        </section>
        <Benefits />
        {/* <Clients /> - Hidden for now */}
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
