'use client';

/**
 * QHuntManualEntry - Alphanumeric code input for manual entry
 *
 * Design: Neon Hunter - Arcade Gaming Vibe
 * - Big input with glow effect
 * - Virtual keyboard style
 */

import React, { useState, useRef, useEffect } from 'react';
import { QHUNT_TRANSLATIONS } from '@/types/qhunt';

interface QHuntManualEntryProps {
  onSubmit: (code: string) => Promise<void>;
  onCancel: () => void;
  isProcessing: boolean;
  lang: 'he' | 'en';
}

export function QHuntManualEntry({
  onSubmit,
  onCancel,
  isProcessing,
  lang,
}: QHuntManualEntryProps) {
  const t = QHUNT_TRANSLATIONS[lang];
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (code.trim().length < 3) return;
    await onSubmit(code.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  // Quick keys for common characters
  const quickKeys = ['A', 'B', 'C', 'D', 'E', 'F', '1', '2', '3', '4', '5', '6'];

  const handleQuickKey = (key: string) => {
    if (code.length < 12) {
      setCode(prev => prev + key);
    }
  };

  const handleBackspace = () => {
    setCode(prev => prev.slice(0, -1));
  };

  return (
    <div className="manual-entry">
      <div className="entry-header">
        <button className="back-btn" onClick={onCancel}>
          <span>←</span>
          <span>{lang === 'he' ? 'חזרה לסריקה' : 'Back to scan'}</span>
        </button>
      </div>

      <div className="entry-content">
        <h2 className="entry-title">{t.enterCode}</h2>

        <div className="code-input-container">
          <input
            ref={inputRef}
            type="text"
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="ABC123"
            maxLength={12}
            autoComplete="off"
            autoCapitalize="characters"
            disabled={isProcessing}
          />
          <div className="input-underline" />
        </div>

        {/* Quick keys */}
        <div className="quick-keys">
          {quickKeys.map(key => (
            <button
              key={key}
              className="quick-key"
              onClick={() => handleQuickKey(key)}
              disabled={isProcessing || code.length >= 12}
            >
              {key}
            </button>
          ))}
          <button
            className="quick-key backspace"
            onClick={handleBackspace}
            disabled={isProcessing || code.length === 0}
          >
            ⌫
          </button>
        </div>
      </div>

      <div className="entry-actions">
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={isProcessing || code.trim().length < 3}
        >
          {isProcessing ? (
            <span className="btn-loading" />
          ) : (
            <>
              <span>✓</span>
              {lang === 'he' ? 'אישור' : 'Submit'}
            </>
          )}
        </button>
      </div>

      <style jsx>{`
        .manual-entry {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          padding: 12px;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
        }

        .entry-header {
          flex-shrink: 0;
          margin-bottom: 16px;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          color: #fff;
          font-family: 'Assistant', sans-serif;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .back-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: #00ff88;
        }

        .entry-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          min-height: 0;
          overflow-y: auto;
        }

        .entry-title {
          font-size: 1.3rem;
          font-weight: 700;
          color: #fff;
          margin: 0;
          text-align: center;
          flex-shrink: 0;
        }

        .code-input-container {
          width: 100%;
          max-width: 300px;
          position: relative;
          flex-shrink: 0;
        }

        .code-input {
          width: 100%;
          padding: 16px;
          font-size: 1.8rem;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          letter-spacing: 0.15em;
          text-align: center;
          background: rgba(255, 255, 255, 0.08);
          border: 2px solid rgba(0, 255, 136, 0.3);
          border-radius: 16px;
          color: #00ff88;
          outline: none;
          text-transform: uppercase;
        }

        .code-input:focus {
          background: rgba(255, 255, 255, 0.12);
          border-color: #00ff88;
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
        }

        .code-input::placeholder {
          color: rgba(255, 255, 255, 0.3);
          letter-spacing: 0.1em;
        }

        .input-underline {
          display: none;
        }

        /* Quick keys */
        .quick-keys {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 6px;
          width: 100%;
          max-width: 320px;
          flex-shrink: 0;
        }

        .quick-key {
          aspect-ratio: 1;
          font-size: 1.2rem;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          color: #fff;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .quick-key:hover:not(:disabled) {
          background: rgba(0, 255, 136, 0.2);
          border-color: #00ff88;
          transform: scale(1.05);
        }

        .quick-key:active:not(:disabled) {
          transform: scale(0.95);
          background: rgba(0, 255, 136, 0.3);
        }

        .quick-key:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .quick-key.backspace {
          grid-column: span 2;
          aspect-ratio: auto;
          font-size: 1.4rem;
        }

        /* Actions - Fixed at bottom */
        .entry-actions {
          flex-shrink: 0;
          padding-top: 16px;
          padding-bottom: env(safe-area-inset-bottom, 8px);
        }

        .submit-btn {
          width: 100%;
          padding: 16px 32px;
          font-size: 1.2rem;
          font-weight: 700;
          font-family: 'Assistant', sans-serif;
          background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
          border: none;
          border-radius: 14px;
          color: #000;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(0, 255, 136, 0.4);
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px rgba(0, 255, 136, 0.6);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: #333;
          color: #666;
          box-shadow: none;
        }

        .btn-loading {
          width: 24px;
          height: 24px;
          border: 3px solid transparent;
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Mobile optimizations */
        @media (max-height: 600px) {
          .entry-content {
            gap: 12px;
          }
          .entry-title {
            font-size: 1.1rem;
          }
          .code-input {
            padding: 12px;
            font-size: 1.5rem;
          }
          .quick-keys {
            gap: 4px;
          }
          .quick-key {
            font-size: 1rem;
            border-radius: 8px;
          }
          .submit-btn {
            padding: 14px 24px;
            font-size: 1.1rem;
          }
        }
      `}</style>
    </div>
  );
}
