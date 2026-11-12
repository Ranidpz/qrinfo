'use client';

// הקוד admin — small UI primitives. Semantic app tokens only (bg-bg-card, text-text-secondary,
// border-border, accent…) so dark mode follows the `dark` class like the dashboard.

import { useEffect, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { TheCodeColor } from '@/types/thecode';
import { THECODE_COLORS } from '@/components/thecode/GnomeFigure';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover shadow-sm disabled:hover:bg-accent',
  secondary: 'border border-border bg-bg-card text-text-primary hover:bg-bg-hover',
  ghost: 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
  danger: 'text-danger hover:bg-danger/10',
};

export function Button({
  variant = 'secondary',
  icon: Icon,
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: LucideIcon; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'min-h-9 px-3 text-sm',
        size === 'md' && 'min-h-11 px-4 text-[15px]',
        size === 'lg' && 'min-h-12 px-6 text-base',
        BUTTON[variant],
        className
      )}
    >
      {Icon && <Icon size={size === 'sm' ? 16 : 18} aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  className,
  tone = 'ghost',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; tone?: 'ghost' | 'danger' }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...rest}
      className={cx(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40',
        tone === 'danger' ? 'text-text-secondary hover:bg-danger/10 hover:text-danger' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
        className
      )}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}

/** RTL-safe switch: the thumb moves with `start-*`, never translateX. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  size = 'md',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const sm = size === 'sm';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cx(
        'relative shrink-0 rounded-full transition-colors disabled:opacity-50',
        sm ? 'h-5 w-9' : 'h-6 w-11',
        checked ? 'bg-success' : 'bg-gray-300 dark:bg-gray-600'
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 rounded-full bg-white shadow transition-all',
          sm ? 'size-4' : 'size-5',
          checked ? (sm ? 'start-[18px]' : 'start-[22px]') : 'start-0.5'
        )}
      />
    </button>
  );
}

/** Label + control row for settings-style forms. */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-sm text-text-secondary">{hint}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-text-primary">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-sm text-text-secondary">{hint}</span>}
    </label>
  );
}

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'accent';
const PILL: Record<Tone, string> = {
  neutral: 'bg-bg-hover text-text-secondary',
  success: 'bg-success/15 text-green-700 dark:text-green-400',
  danger: 'bg-danger/12 text-red-700 dark:text-red-400',
  warning: 'bg-warning/15 text-amber-700 dark:text-amber-400',
  accent: 'bg-accent/12 text-blue-700 dark:text-blue-300',
};

export function Pill({ tone = 'neutral', icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-medium', PILL[tone], className)}>
      {Icon && <Icon size={14} aria-hidden />}
      {children}
    </span>
  );
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('rounded-xl border border-border bg-bg-card', className)}>
      {children}
    </div>
  );
}

export function ScreenHeader({ title, summary, actions }: { title: string; summary?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-text-title">{title}</h1>
        {summary && <div className="mt-1 text-text-secondary">{summary}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <Icon size={32} className="text-text-secondary" aria-hidden />
      <div className="mt-4 text-lg font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-sm text-text-secondary">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** The eight palette colours as round swatches. */
export function ColorPicker({ value, onChange, label }: { value: TheCodeColor; onChange: (c: TheCodeColor) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {(Object.keys(THECODE_COLORS) as TheCodeColor[]).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          title={THECODE_COLORS[c].he}
          aria-label={THECODE_COLORS[c].he}
          onClick={() => onChange(c)}
          className={cx(
            'size-9 rounded-full border-2 transition-transform',
            value === c ? 'scale-110 border-accent ring-2 ring-accent/30' : 'border-black/15 hover:scale-105 dark:border-white/20'
          )}
          style={{ background: THECODE_COLORS[c].hex }}
        />
      ))}
    </div>
  );
}

/** A collector letter tile — the same letter the family sees. */
export function LetterTile({ letter, tone = 'neutral', size = 'md', badge }: { letter: string; tone?: 'neutral' | 'ok' | 'missing'; size?: 'sm' | 'md'; badge?: ReactNode }) {
  return (
    <span
      className={cx(
        'relative inline-flex items-center justify-center rounded-lg border-2 font-bold',
        size === 'sm' ? 'size-8 text-base' : 'size-11 text-xl',
        tone === 'ok' && 'border-success/50 bg-success/10 text-text-primary',
        tone === 'missing' && 'border-danger bg-danger/10 text-danger',
        tone === 'neutral' && 'border-border bg-bg-secondary text-text-primary'
      )}
    >
      {letter}
      {badge !== undefined && (
        <span className="absolute -bottom-2 -end-2 inline-flex min-w-5 items-center justify-center rounded-full bg-bg-card px-1 text-xs font-semibold text-text-secondary ring-1 ring-border">
          {badge}
        </span>
      )}
    </span>
  );
}

/** Number input with a fixed range, for rules. Typing is free; out-of-range snaps back on blur. */
export function NumberInput({ value, onChange, min, max, step = 1, suffix, label }: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; suffix?: string; label: string }) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : String(value);
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        className="input w-24 text-center"
        value={shown}
        min={min}
        max={max}
        step={step}
        onFocus={() => {
          setText(String(value));
          setFocused(true);
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => {
          setFocused(false);
          const n = Number(text);
          onChange(Number.isFinite(n) && text !== '' ? Math.min(max, Math.max(min, Math.round(n))) : value);
        }}
      />
      {suffix && <span className="text-sm text-text-secondary">{suffix}</span>}
    </div>
  );
}

/** A small segmented control (2–4 options). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-9 rounded-md px-3 text-sm font-medium transition-colors',
            value === o.value ? 'bg-accent/15 text-accent ring-1 ring-accent/40' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Modal panel; a bottom sheet on phones. Esc and backdrop close it. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-bg-card shadow-xl sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="סגירה" className="inline-flex size-10 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
