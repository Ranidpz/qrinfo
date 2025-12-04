'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy, Check } from 'lucide-react';
import { useState, useRef } from 'react';

interface QRGeneratorProps {
  shortId: string;
  size?: number;
  title?: string;
}

export default function QRGenerator({ shortId, size = 200, title }: QRGeneratorProps) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/v/${shortId}`
    : `/v/${shortId}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with padding
    const padding = 20;
    canvas.width = size + padding * 2;
    canvas.height = size + padding * 2;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Convert SVG to image
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size);

      // Download
      const link = document.createElement('a');
      link.download = `qr-${shortId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="card text-center">
      {title && (
        <h3 className="text-lg font-medium text-text-primary mb-4">{title}</h3>
      )}

      {/* QR Code */}
      <div
        ref={qrRef}
        className="inline-block p-4 bg-white rounded-xl mb-4"
      >
        <QRCodeSVG
          value={url}
          size={size}
          level="H"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>

      {/* Short URL */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <code
          dir="ltr"
          className="text-sm text-text-secondary bg-bg-secondary px-3 py-1.5 rounded-lg"
        >
          {url}
        </code>
        <button
          onClick={handleCopy}
          className="p-2 rounded-lg hover:bg-bg-hover transition-colors"
          title="העתק לינק"
        >
          {copied ? (
            <Check className="w-4 h-4 text-success" />
          ) : (
            <Copy className="w-4 h-4 text-text-secondary" />
          )}
        </button>
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        className="btn btn-primary"
      >
        <Download className="w-4 h-4" />
        הורד QR Code
      </button>
    </div>
  );
}
