'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy, Check } from 'lucide-react';
import { useState, useRef } from 'react';
import { QRSign } from '@/types';
import { ICON_PATHS } from '@/lib/iconPaths';
import * as LucideIcons from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface QRGeneratorProps {
  shortId: string;
  size?: number;
  title?: string;
  sign?: QRSign;
}

export default function QRGenerator({ shortId, size = 200, title, sign }: QRGeneratorProps) {
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

    // Create canvas with high resolution
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with padding - use larger size for better quality
    const downloadSize = 1000;
    const padding = 40;
    canvas.width = downloadSize + padding * 2;
    canvas.height = downloadSize + padding * 2;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Convert SVG to image
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, downloadSize, downloadSize);

      // Draw sign overlay if enabled
      if (sign?.enabled && sign.value) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const signRadius = downloadSize * 0.125; // 25% of QR / 2
        const scale = sign.scale ?? 1.0;

        // Draw background circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, signRadius, 0, Math.PI * 2);
        ctx.fillStyle = sign.backgroundColor;
        ctx.fill();

        // Draw content
        ctx.fillStyle = sign.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (sign.type === 'logo') {
          // Draw logo image
          const logoImg = new Image();
          logoImg.onload = () => {
            // Clip to circle (matches preview overflow-hidden)
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, signRadius, 0, Math.PI * 2);
            ctx.clip();

            // Logo = 70% of circle diameter, capped at 90% to prevent overflow at high scale
            const maxLogoSize = Math.min(signRadius * 2 * 0.7 * scale, signRadius * 2 * 0.9);
            const imgW = logoImg.naturalWidth;
            const imgH = logoImg.naturalHeight;
            const ratio = Math.min(maxLogoSize / imgW, maxLogoSize / imgH);
            const drawW = imgW * ratio;
            const drawH = imgH * ratio;
            ctx.drawImage(logoImg, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
            ctx.restore();

            // Download after logo is loaded
            const link = document.createElement('a');
            link.download = `qr-${shortId}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
          };
          logoImg.src = sign.value;
          return; // Exit early, download happens in onload
        } else if (sign.type === 'text') {
          const baseFontSize = signRadius * (sign.value.length === 1 ? 1.1 : sign.value.length === 2 ? 0.9 : 0.6);
          const fontSize = baseFontSize * scale;
          ctx.font = `bold ${fontSize}px Assistant, Arial, sans-serif`;
          ctx.fillText(sign.value, centerX, centerY);
        } else if (sign.type === 'emoji') {
          const fontSize = signRadius * 1.1 * scale;
          ctx.font = `${fontSize}px Arial, sans-serif`;
          ctx.fillText(sign.value, centerX, centerY);
        } else if (sign.type === 'icon') {
          // Draw icon using Path2D
          const iconData = ICON_PATHS[sign.value];
          if (iconData) {
            const iconSize = signRadius * 1.3 * scale;
            ctx.save();
            ctx.translate(centerX - iconSize / 2, centerY - iconSize / 2);
            ctx.scale(iconSize / 24, iconSize / 24);
            ctx.strokeStyle = sign.color;
            ctx.fillStyle = sign.color;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Parse and draw paths
            const paths = iconData.path.split(' M').map((p, i) => i === 0 ? p : 'M' + p);
            paths.forEach(pathStr => {
              const path = new Path2D(pathStr);
              if (iconData.fill) {
                ctx.fill(path);
              } else {
                ctx.stroke(path);
              }
            });
            ctx.restore();
          }
        }
      }

      // Download
      const link = document.createElement('a');
      link.download = `qr-${shortId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleDownloadSVG = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgClone = svg.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('width', '1000');
    svgClone.setAttribute('height', '1000');
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    if (sign?.enabled && sign.value) {
      const svgSize = 1000;
      const centerX = svgSize / 2;
      const centerY = svgSize / 2;
      const signRadius = svgSize * 0.125;
      const scale = sign.scale ?? 1.0;

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(centerX));
      circle.setAttribute('cy', String(centerY));
      circle.setAttribute('r', String(signRadius));
      circle.setAttribute('fill', sign.backgroundColor);
      svgClone.appendChild(circle);

      if (sign.type === 'logo') {
        const logoSize = signRadius * 1.5 * scale;
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', 'sign-clip');
        const clipCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        clipCircle.setAttribute('cx', String(centerX));
        clipCircle.setAttribute('cy', String(centerY));
        clipCircle.setAttribute('r', String(signRadius));
        clipPath.appendChild(clipCircle);
        defs.appendChild(clipPath);
        svgClone.insertBefore(defs, svgClone.firstChild);

        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('href', sign.value);
        img.setAttribute('x', String(centerX - logoSize / 2));
        img.setAttribute('y', String(centerY - logoSize / 2));
        img.setAttribute('width', String(logoSize));
        img.setAttribute('height', String(logoSize));
        img.setAttribute('clip-path', 'url(#sign-clip)');
        svgClone.appendChild(img);
      } else if (sign.type === 'text' || sign.type === 'emoji') {
        const isEmoji = sign.type === 'emoji';
        const baseFontSize = isEmoji
          ? signRadius * 1.1
          : signRadius * (sign.value.length === 1 ? 1.1 : sign.value.length === 2 ? 0.9 : 0.6);
        const fontSize = baseFontSize * scale;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(centerX));
        text.setAttribute('y', String(centerY));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('fill', sign.color);
        text.setAttribute('font-size', String(fontSize));
        text.setAttribute('font-family', 'Arial, sans-serif');
        if (!isEmoji) text.setAttribute('font-weight', 'bold');
        text.textContent = sign.value;
        svgClone.appendChild(text);
      } else if (sign.type === 'icon') {
        const iconData = ICON_PATHS[sign.value];
        if (iconData) {
          const iconSize = signRadius * 1.3 * scale;
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('transform', `translate(${centerX - iconSize / 2}, ${centerY - iconSize / 2}) scale(${iconSize / 24})`);

          const paths = iconData.path.split(' M').map((p, i) => i === 0 ? p : 'M' + p);
          paths.forEach(pathStr => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathStr);
            if (iconData.fill) {
              path.setAttribute('fill', sign.color);
            } else {
              path.setAttribute('fill', 'none');
              path.setAttribute('stroke', sign.color);
              path.setAttribute('stroke-width', '2');
              path.setAttribute('stroke-linecap', 'round');
              path.setAttribute('stroke-linejoin', 'round');
            }
            g.appendChild(path);
          });
          svgClone.appendChild(g);
        }
      }
    }

    const svgData = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `qr-${shortId}.svg`;
    link.href = blobUrl;
    link.click();
    URL.revokeObjectURL(blobUrl);
  };

  // Render sign overlay for SVG display
  const renderSignOverlay = () => {
    if (!sign?.enabled || !sign.value) return null;

    const scale = sign.scale ?? 1.0;
    const overlaySize = size * 0.25; // Fixed container size

    return (
      <div
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center shadow-md overflow-hidden"
        style={{
          width: overlaySize,
          height: overlaySize,
          backgroundColor: sign.backgroundColor,
        }}
      >
        {sign.type === 'logo' ? (
          <img
            src={sign.value}
            alt="Logo"
            style={{
              width: overlaySize * 0.7 * scale,
              height: overlaySize * 0.7 * scale,
              objectFit: 'contain',
            }}
          />
        ) : sign.type === 'icon' ? (
          (() => {
            const IconComponent = LucideIcons[sign.value as keyof typeof LucideIcons] as LucideIcon;
            return IconComponent ? (
              <IconComponent size={overlaySize * 0.55 * scale} color={sign.color} strokeWidth={2.5} />
            ) : null;
          })()
        ) : (
          <span
            style={{
              color: sign.color,
              fontFamily: 'var(--font-assistant), Arial, sans-serif',
              fontSize: (sign.type === 'emoji'
                ? overlaySize * 0.55
                : overlaySize * (sign.value.length === 1 ? 0.6 : sign.value.length === 2 ? 0.45 : 0.3)) * scale,
              fontWeight: sign.type === 'text' ? 700 : 400,
              lineHeight: 1,
              display: 'block',
              marginTop: '-0.1em',
            }}
          >
            {sign.value}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="card text-center">
      {title && (
        <h3 className="text-lg font-medium text-text-primary mb-4">{title}</h3>
      )}

      {/* QR Code with optional sign overlay */}
      <div
        ref={qrRef}
        className="inline-block p-4 bg-white rounded-xl mb-4 relative"
      >
        <QRCodeSVG
          value={url}
          size={size}
          level="H"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor={sign?.qrFgColor || '#000000'}
        />
        {renderSignOverlay()}
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

      {/* Download buttons */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={handleDownload}
          className="btn btn-primary"
        >
          <Download className="w-4 h-4" />
          PNG
        </button>
        <button
          onClick={handleDownloadSVG}
          className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover"
        >
          <Download className="w-4 h-4" />
          SVG
        </button>
      </div>
    </div>
  );
}
