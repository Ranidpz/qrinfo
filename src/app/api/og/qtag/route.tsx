import { ImageResponse } from 'next/og';
import { safeOgLogoUrl } from '@/lib/ogLogo';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const bgParam = searchParams.get('bg');
  const bgColor = bgParam && /^#[0-9a-fA-F]{3,8}$/.test(bgParam) ? bgParam : '#1a1a2e';
  const logoUrl = safeOgLogoUrl(searchParams.get('logo'));

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
