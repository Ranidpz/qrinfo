import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const bgColor = searchParams.get('bg') || '#1a1a2e';
  const logoUrl = searchParams.get('logo') || 'https://qr.playzones.app/theQ.png';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bgColor,
        }}
      >
        <img
          src={logoUrl}
          width={400}
          height={400}
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    {
      width: 633,
      height: 633,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    }
  );
}
