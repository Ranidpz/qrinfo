import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const selfie = searchParams.get('selfie');
  const name = searchParams.get('name');
  const game = searchParams.get('game');

  // No selfie → default Q logo
  if (!selfie) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0f1a',
          }}
        >
          <img
            src="https://qr.playzones.app/theQ.png"
            width={450}
            height={450}
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
          backgroundColor: '#0a0f1a',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Circular selfie with purple border */}
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '6px solid #8b5cf6',
            boxShadow: '0 0 60px rgba(139, 92, 246, 0.3)',
            display: 'flex',
          }}
        >
          <img
            src={selfie}
            width={280}
            height={280}
            style={{ objectFit: 'cover' }}
          />
        </div>

        {/* Player name */}
        {name && (
          <div
            style={{
              marginTop: 24,
              color: 'white',
              fontSize: 36,
              fontWeight: 700,
              textAlign: 'center',
              maxWidth: 500,
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            {name}
          </div>
        )}

        {/* Game subtitle */}
        <div
          style={{
            marginTop: 12,
            color: 'rgba(255,255,255,0.6)',
            fontSize: 24,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {game ? `🎮 ${game}` : '🎮 Q.Games'}
        </div>

        {/* Small Q logo branding */}
        <img
          src="https://qr.playzones.app/theQ.png"
          width={60}
          height={60}
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            objectFit: 'contain',
            opacity: 0.7,
          }}
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
