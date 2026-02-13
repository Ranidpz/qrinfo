'use client';

import { useState, useEffect } from 'react';
import { Accessibility, Plus, Minus, Eye, RotateCcw, X, FileText } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';

export default function AccessibilityButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [highContrast, setHighContrast] = useState(false);
  const locale = useLocale();
  const isHebrew = locale === 'he';

  const labels = {
    settings: isHebrew ? 'הגדרות נגישות' : 'Accessibility Settings',
    fontSize: isHebrew ? 'גודל טקסט' : 'Text Size',
    decreaseText: isHebrew ? 'הקטנת טקסט' : 'Decrease text',
    increaseText: isHebrew ? 'הגדלת טקסט' : 'Increase text',
    highContrast: isHebrew ? 'ניגודיות גבוהה' : 'High Contrast',
    reset: isHebrew ? 'איפוס הגדרות' : 'Reset Settings',
    statement: isHebrew ? 'הצהרת נגישות' : 'Accessibility Statement',
    close: isHebrew ? 'סגור' : 'Close',
  };

  // Load saved preferences
  useEffect(() => {
    const savedFontSize = localStorage.getItem('accessibility-font-size');
    const savedContrast = localStorage.getItem('accessibility-high-contrast');

    if (savedFontSize) {
      const size = parseInt(savedFontSize);
      setTimeout(() => setFontSize(size), 0);
      document.documentElement.style.fontSize = `${size}%`;
    }

    if (savedContrast === 'true') {
      setTimeout(() => setHighContrast(true), 0);
      document.documentElement.classList.add('high-contrast');
    }
  }, []);

  const adjustFontSize = (delta: number) => {
    const newSize = Math.min(150, Math.max(80, fontSize + delta));
    setFontSize(newSize);
    document.documentElement.style.fontSize = `${newSize}%`;
    localStorage.setItem('accessibility-font-size', newSize.toString());
  };

  const toggleContrast = () => {
    const newValue = !highContrast;
    setHighContrast(newValue);
    if (newValue) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    localStorage.setItem('accessibility-high-contrast', newValue.toString());
  };

  const resetAll = () => {
    setFontSize(100);
    setHighContrast(false);
    document.documentElement.style.fontSize = '100%';
    document.documentElement.classList.remove('high-contrast');
    localStorage.removeItem('accessibility-font-size');
    localStorage.removeItem('accessibility-high-contrast');
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 left-4 z-50 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hidden sm:flex items-center justify-center transition-all hover:scale-110"
        aria-label={labels.settings}
        title={labels.settings}
      >
        <Accessibility className="w-6 h-6" />
      </button>

      {/* Accessibility Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="fixed bottom-20 left-4 z-50 w-72 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden" dir={isHebrew ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900">
              <div className="flex items-center gap-2">
                <Accessibility className="w-5 h-5 text-blue-400" />
                <span className="font-semibold text-white">{labels.settings}</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                aria-label={labels.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Options */}
            <div className="p-4 space-y-4">
              {/* Font Size */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">{labels.fontSize}</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustFontSize(-10)}
                    disabled={fontSize <= 80}
                    className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    aria-label={labels.decreaseText}
                  >
                    <Minus className="w-4 h-4 text-white" />
                  </button>
                  <div className="flex-1 text-center text-white font-medium">
                    {fontSize}%
                  </div>
                  <button
                    onClick={() => adjustFontSize(10)}
                    disabled={fontSize >= 150}
                    className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    aria-label={labels.increaseText}
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* High Contrast */}
              <div>
                <button
                  onClick={toggleContrast}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    highContrast
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    <span>{labels.highContrast}</span>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-colors ${
                    highContrast ? 'bg-blue-400' : 'bg-gray-600'
                  }`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${
                      highContrast ? 'translate-x-0.5' : 'translate-x-4'
                    }`} />
                  </div>
                </button>
              </div>

              {/* Reset */}
              <button
                onClick={resetAll}
                className="w-full flex items-center justify-center gap-2 p-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{labels.reset}</span>
              </button>

              {/* Accessibility Statement Link */}
              <Link
                href={`/${locale}/accessibility`}
                className="w-full flex items-center justify-center gap-2 p-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <FileText className="w-4 h-4" />
                <span>{labels.statement}</span>
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Global styles for high contrast */}
      <style jsx global>{`
        .high-contrast {
          filter: contrast(1.2);
        }
        .high-contrast * {
          border-color: #fff !important;
        }
      `}</style>
    </>
  );
}
