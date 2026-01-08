import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  // Fetch the actual PNG logo
  const logoUrl = 'https://qr.playzones.app/theQ.png';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a', // Dark slate-900
        }}
      >
        {/* The actual PNG logo */}
        <img
          src={logoUrl}
          width={450}
          height={450}
          style={{
            objectFit: 'contain',
          }}
        />
      </div>
    ),
    {
      width: 633,
      height: 633,
    }
  );
}
