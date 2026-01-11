'use client';

import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Share2, ExternalLink } from 'lucide-react';

const DEMO_URL = 'https://qr.playzones.app/v/qaEe3V';
const WHATSAPP_SHARE_URL = `https://wa.me/?text=${encodeURIComponent('בואו לנסות תחרות תחפושות דיגיטלית! ' + DEMO_URL)}`;

export default function CostumeDemo() {
  const t = useTranslations('costumeCompetition');

  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-purple-950/50 via-[var(--bg-secondary)] to-amber-950/30">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-green-500/20 border border-green-500/40">
              <Smartphone className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium text-green-300">נסו בעצמכם!</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-[var(--text-primary)]">
              רוצים לראות איך זה עובד?
            </h2>
            <p className="text-lg text-[var(--text-secondary)]">
              סרקו את הקוד והצביעו בתחרות לדוגמה
            </p>
          </div>

          {/* Demo card */}
          <div className="relative p-8 md:p-12 rounded-3xl bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl">
            {/* Gradient accent */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/5 via-transparent to-amber-500/5" />

            <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-12">
              {/* QR Code */}
              <div className="flex-shrink-0">
                <div className="p-4 bg-white rounded-2xl shadow-lg">
                  <QRCodeSVG
                    value={DEMO_URL}
                    size={180}
                    level="H"
                    includeMargin={false}
                    bgColor="#ffffff"
                    fgColor="#1a1a2e"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 text-center md:text-right">
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
                  תחרות תחפושות לדוגמה
                </h3>
                <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
                  סרקו את הקוד עם הטלפון והצביעו לתחפושת האהובה עליכם.
                  ככה בדיוק זה נראה למשתתפים באירוע שלכם!
                </p>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3">
                  <a
                    href={DEMO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all hover:scale-[1.02]"
                  >
                    <ExternalLink className="w-5 h-5" />
                    <span>פתחו בדפדפן</span>
                  </a>
                  <a
                    href={WHATSAPP_SHARE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-500 transition-all hover:scale-[1.02]"
                  >
                    <Share2 className="w-5 h-5" />
                    <span>שתפו בוואטסאפ</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Footer note */}
            <div className="relative mt-8 pt-6 border-t border-[var(--border)] text-center">
              <p className="text-sm text-[var(--text-secondary)]">
                💡 <span className="font-medium">טיפ:</span> שלחו את הלינק לחברים ובדקו איך ההצבעה עובדת בזמן אמת
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
