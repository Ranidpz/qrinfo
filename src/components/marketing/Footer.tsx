'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';

// WhatsApp icon component
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export default function Footer() {
  const t = useTranslations('marketing.footer');

  return (
    <footer className="py-8 md:py-10 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/theQ.png"
              alt="The Q"
              width={48}
              height={48}
              className="rounded-lg transition-transform duration-200 hover:scale-110 w-10 h-10 md:w-12 md:h-12"
            />
          </Link>

          {/* Links */}
          <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm">
            <Link
              href="/login"
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {t('terms')}
            </Link>
            <Link
              href="/privacy"
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {t('privacy')}
            </Link>
            <a
              href="https://wa.me/972773006306"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-green-500 hover:text-green-400 transition-colors"
            >
              <WhatsAppIcon className="w-4 h-4" />
              {t('contact')}
            </a>
          </div>

          {/* Made by */}
          <div className="text-sm text-[var(--text-secondary)]">
            {t('madeBy')}{' '}
            <a
              href="https://playzone.co.il"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              Playzone
            </a>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-[var(--border)] text-center text-xs md:text-sm text-[var(--text-secondary)]">
          © {new Date().getFullYear()} The Q. {t('tagline')}
        </div>
      </div>
    </footer>
  );
}
