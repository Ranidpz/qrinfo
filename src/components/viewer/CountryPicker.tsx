'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import {
  searchCountries,
  countryName,
  type SelfiebeamCountry,
} from '@/lib/selfiebeam/countries';

interface CountryPickerLabels {
  placeholder: string;
  noResults: string;
  clear: string;
}

interface CountryPickerProps {
  value: SelfiebeamCountry | null;
  onChange: (country: SelfiebeamCountry | null) => void;
  locale: 'he' | 'en';
  labels: CountryPickerLabels;
}

// Searchable country autocomplete with flag thumbnails. Optional — the participant can
// leave it empty. RTL/LTR follows the viewer locale.
export default function CountryPicker({ value, onChange, locale, labels }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  const results = useMemo(() => searchCountries(query), [query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const select = (country: SelfiebeamCountry) => {
    onChange(country);
    setOpen(false);
    setQuery('');
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full" dir={dir}>
      {/* Selected state — flag + name + clear */}
      {value && !open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-800 hover:border-gray-300 transition-colors"
        >
          <img src={value.flag} alt="" className="w-7 h-5 object-cover rounded-sm shadow-sm shrink-0" />
          <span className="flex-1 text-start truncate">{countryName(value, locale)}</span>
          <span
            role="button"
            tabIndex={0}
            aria-label={labels.clear}
            onClick={(e) => { e.stopPropagation(); clear(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); clear(); } }}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </span>
        </button>
      ) : (
        // Search input
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" style={dir === 'rtl' ? { right: 14 } : { left: 14 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={labels.placeholder}
            className="w-full py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
            style={dir === 'rtl' ? { paddingRight: 40, paddingLeft: 40 } : { paddingLeft: 40, paddingRight: 40 }}
          />
          <ChevronDown className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" style={dir === 'rtl' ? { left: 14 } : { right: 14 }} />
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">{labels.noResults}</div>
          ) : (
            results.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => select(country)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-start hover:bg-gray-50 transition-colors ${
                  value?.code === country.code ? 'bg-blue-50' : ''
                }`}
              >
                <img src={country.flag} alt="" className="w-7 h-5 object-cover rounded-sm shadow-sm shrink-0" />
                <span className="flex-1 text-gray-800 truncate">{countryName(country, locale)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
