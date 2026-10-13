'use client';

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { clsx } from 'clsx';

const LENGTH = 6;

interface CodeBoxesProps {
  value: string[];
  onChange: (digits: string[]) => void;
  /** Called once with the full code — on paste, autofill, or the 6th typed digit. */
  onComplete: (code: string) => void;
  disabled?: boolean;
  error?: boolean;
  label: string;
  digitLabel: (n: number) => string;
}

export const emptyCode = () => Array<string>(LENGTH).fill('');

/**
 * Six segmented boxes. The first box takes iOS/Android one-time-code autofill
 * and pastes of any length; digits spread across the boxes and a full code
 * submits by itself — no button.
 */
export default function CodeBoxes({ value, onChange, onComplete, disabled, error, label, digitLabel }: CodeBoxesProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  // An emptied set (wrong code / new send) puts the cursor back on the first box.
  const isEmpty = value.every((d) => !d);
  useEffect(() => {
    if (isEmpty && !disabled) refs.current[0]?.focus();
  }, [isEmpty, disabled]);

  const fill = (start: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return;
    const next = [...value];
    // A whole code (paste/autofill) always starts at the first box.
    const from = digits.length >= LENGTH ? 0 : start;
    for (let i = 0; i < digits.length && from + i < LENGTH; i++) next[from + i] = digits[i];
    onChange(next);
    const focusAt = Math.min(from + digits.length, LENGTH - 1);
    refs.current[focusAt]?.focus();
    if (next.every(Boolean)) onComplete(next.join(''));
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...value];
      if (next[i]) {
        next[i] = '';
      } else if (i > 0) {
        next[i - 1] = '';
        refs.current[i - 1]?.focus();
      }
      onChange(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // The row is always LTR, so arrows move visually.
      e.preventDefault();
      const to = e.key === 'ArrowLeft' ? i - 1 : i + 1;
      refs.current[Math.max(0, Math.min(LENGTH - 1, to))]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const target = refs.current.findIndex((el) => el === document.activeElement);
    fill(target < 0 ? 0 : target, e.clipboardData.getData('text'));
  };

  return (
    <div role="group" aria-label={label} dir="ltr" className="flex justify-center gap-2" onPaste={handlePaste}>
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={digit}
          onChange={(e) => {
            const raw = e.target.value;
            if (!raw) return; // deletions are handled in onKeyDown
            // The new character is whichever one isn't the old digit.
            fill(i, raw.length > 1 && raw.length < LENGTH ? raw.replace(digit, '') : raw);
          }}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={i === 0 ? LENGTH : 2}
          disabled={disabled}
          aria-label={digitLabel(i + 1)}
          className={clsx(
            'w-11 h-14 sm:w-12 sm:h-14 text-center text-2xl font-semibold rounded-xl border bg-bg-secondary text-text-primary',
            'focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors disabled:opacity-50',
            error ? 'border-danger' : 'border-border'
          )}
        />
      ))}
    </div>
  );
}
