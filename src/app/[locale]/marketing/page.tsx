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
  description: 'צרו קודי QR דינמיים לחוויות דיגיטליות - לוחות שבועיים, הצבעות, גיימיפיקציה, קירות סלפי ועוד. עדכנו בזמן אמת בלי להדפיס מחדש.',
  keywords: ['QR code', 'dynamic QR', 'voting system', 'event management', 'digital experiences', 'selfie wall', 'gamification'],
  openGraph: {
    title: 'The Q - One Code. Endless Experiences.',
    description: 'צרו קודי QR דינמיים לחוויות דיגיטליות',
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
