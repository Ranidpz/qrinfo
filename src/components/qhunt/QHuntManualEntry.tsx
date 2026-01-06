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
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 16px;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
        }

        .entry-header {
          margin-bottom: 24px;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: #ffffff10;
          border: 1px solid #ffffff20;
          border-radius: 10px;
          color: #fff;
          font-family: 'Assistant', sans-serif;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .back-btn:hover {
          background: #ffffff20;
          border-color: var(--qhunt-primary);
        }

        .entry-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 24px;
        }

        .entry-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          margin: 0;
          text-align: center;
        }

        .code-input-container {
          width: 100%;
          max-width: 300px;
          position: relative;
        }

        .code-input {
          width: 100%;
          padding: 20px;
          font-size: 2rem;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          letter-spacing: 0.2em;
          text-align: center;
          background: #ffffff08;
          border: none;
          border-radius: 16px;
          color: var(--qhunt-primary);
          outline: none;
          text-transform: uppercase;
        }

        .code-input:focus {
          background: #ffffff12;
        }

        .code-input::placeholder {
          color: #ffffff30;
          letter-spacing: 0.1em;
        }

        .input-underline {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 3px;
          background: var(--qhunt-primary);
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .code-input:focus + .input-underline {
          width: 80%;
          box-shadow: 0 0 10px var(--qhunt-primary);
        }

        /* Quick keys */
        .quick-keys {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          width: 100%;
          max-width: 320px;
        }

        .quick-key {
          aspect-ratio: 1;
          font-size: 1.3rem;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          background: #ffffff10;
          border: 2px solid #ffffff20;
          border-radius: 12px;
          color: #fff;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .quick-key:hover:not(:disabled) {
          background: var(--qhunt-primary)20;
          border-color: var(--qhunt-primary);
          transform: scale(1.05);
        }

        .quick-key:active:not(:disabled) {
          transform: scale(0.95);
        }

        .quick-key:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .quick-key.backspace {
          grid-column: span 2;
          aspect-ratio: auto;
          font-size: 1.5rem;
        }

        /* Actions */
        .entry-actions {
          padding-top: 24px;
        }

        .submit-btn {
          width: 100%;
          padding: 18px 32px;
          font-size: 1.3rem;
          font-weight: 700;
          font-family: 'Assistant', sans-serif;
          background: linear-gradient(135deg, var(--qhunt-success), var(--qhunt-success)cc);
          border: none;
          border-radius: 16px;
          color: #000;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px var(--qhunt-success)40;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px var(--qhunt-success)60;
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
      `}</style>
    </div>
  );
}
