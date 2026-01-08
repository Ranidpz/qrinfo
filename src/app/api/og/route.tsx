import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'The Q';
  const description = searchParams.get('description') || '';
  const siteName = searchParams.get('site') || 'qr.playzones.app';

  // Dark background color (matching the site's dark theme)
  const bgColor = '#0f172a'; // slate-900

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bgColor,
          padding: '40px',
        }}
      >
        {/* Q Logo - using SVG inline since we can't load external images easily in edge */}
        <svg
          width="280"
          height="280"
          viewBox="0 0 200 200"
          style={{ marginBottom: '30px' }}
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="qGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          {/* Q shape */}
          <circle
            cx="100"
            cy="90"
            r="70"
            fill="none"
            stroke="url(#qGradient)"
            strokeWidth="18"
          />
          {/* Q tail */}
          <line
            x1="140"
            y1="130"
            x2="180"
            y2="180"
            stroke="url(#qGradient)"
            strokeWidth="18"
            strokeLinecap="round"
          />
        </svg>

        {/* Title */}
        <div
          style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: 'white',
            textAlign: 'center',
            marginBottom: '16px',
            maxWidth: '90%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>

        {/* Description */}
        {description && (
          <div
            style={{
              fontSize: '28px',
              color: '#94a3b8', // slate-400
              textAlign: 'center',
              marginBottom: '20px',
            }}
          >
            {description}
          </div>
        )}

        {/* Site name */}
        <div
          style={{
            fontSize: '20px',
            color: '#64748b', // slate-500
            textAlign: 'center',
          }}
        >
          {siteName}
        </div>
      </div>
    ),
    {
      width: 633,
      height: 633,
    }
  );
}
