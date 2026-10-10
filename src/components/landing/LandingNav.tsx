'use client';

import { useEffect, useRef, useState } from 'react';

// In-page navigation for a landing page: smooth-scrolls to a section, and follows the scroll -
// the section on screen is the highlighted item, with an indicator sliding under it.
// Desktop/tablet: a row in the header. Phones: a scrollable row of pills under the header.

type Item = { label: string; href: string }; // href = '#section-id'

export default function LandingNav({ items }: { items: Item[] }) {
  const [active, setActive] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  const clickLockRef = useRef(0);

  // Scrollspy: the section crossing the middle band of the screen is the active one
  useEffect(() => {
    const ids = items.map((i) => i.href.slice(1));
    const sections = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() < clickLockRef.current) return; // a click's smooth scroll is still running
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
        else if (window.scrollY < 200) setActive(null);
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [items]);

  // Slide the indicator under the active desktop item; keep the active phone pill in view
  useEffect(() => {
    const row = rowRef.current;
    const el = active ? row?.querySelector<HTMLElement>(`[data-id="${active}"]`) : null;
    if (row && el) {
      const r = row.getBoundingClientRect();
      const e = el.getBoundingClientRect();
      setBar({ x: e.left - r.left, w: e.width });
    } else setBar(null);
    const pill = active ? pillsRef.current?.querySelector<HTMLElement>(`[data-id="${active}"]`) : null;
    pill?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', href);
    setActive(target.id);
    clickLockRef.current = Date.now() + 900;
  };

  const linkClass = (id: string) =>
    `relative inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
      active === id ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
    }`;

  return (
    <>
      {/* desktop + tablet */}
      <div ref={rowRef} className="relative hidden items-center gap-1 md:flex">
        {items.map((i) => (
          <a key={i.href} href={i.href} data-id={i.href.slice(1)} onClick={(e) => go(e, i.href)} className={linkClass(i.href.slice(1))}>
            {i.label}
          </a>
        ))}
        <span
          aria-hidden="true"
          className="absolute -bottom-[9px] left-0 h-0.5 rounded-full bg-accent transition-all duration-300 ease-out"
          style={{ transform: `translateX(${bar?.x ?? 0}px)`, width: bar?.w ?? 0, opacity: bar ? 1 : 0 }}
        />
      </div>
      {/* phones: a second row under the header */}
      <div
        ref={pillsRef}
        className="absolute inset-x-0 top-full flex gap-2 overflow-x-auto border-b border-border/60 bg-bg-primary/90 px-4 py-2 backdrop-blur-lg [scrollbar-width:none] md:hidden"
      >
        {items.map((i) => {
          const id = i.href.slice(1);
          return (
            <a
              key={i.href}
              href={i.href}
              data-id={id}
              onClick={(e) => go(e, i.href)}
              className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                active === id ? 'border-accent bg-accent text-white' : 'border-border bg-bg-card text-text-secondary'
              }`}
            >
              {i.label}
            </a>
          );
        })}
      </div>
    </>
  );
}
