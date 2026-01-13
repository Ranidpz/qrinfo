'use client';

import Image from 'next/image';

export default function CostumeFooter() {
  return (
    <footer className="py-8 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Logo and link to main site */}
          <a
            href="https://qr.playzones.app"
            className="flex items-center gap-3 group"
          >
            <Image
              src="/theQ.png"
              alt="The Q"
              width={36}
              height={36}
              className="rounded-lg transition-transform duration-200 group-hover:scale-110"
            />
            <span className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-purple-400 transition-colors">
              The Q
            </span>
          </a>

          <p className="text-sm text-[var(--text-secondary)]">
            פלטפורמת ההצבעה והאינטראקציה המובילה לאירועים
          </p>

          <a
            href="https://qr.playzones.app/he/marketing"
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            גלו את כל הפתרונות שלנו &larr;
          </a>

          {/* Made by */}
          <div className="mt-4 pt-4 border-t border-[var(--border)] w-full max-w-xs text-xs text-[var(--text-secondary)]">
            נבנה ע&quot;י{' '}
            <a
              href="https://playzone.co.il"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              Playzone
            </a>
            {' '}© {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </footer>
  );
}
