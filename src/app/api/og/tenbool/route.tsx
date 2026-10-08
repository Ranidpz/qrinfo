import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// WhatsApp / social preview for "10 בול": a stopwatch on 10.00 with gold coins.
// No Hebrew text - Satori renders RTL Hebrew reversed (see CLAUDE.md).
// Bold digits: Satori only ships a regular weight, so fetch just the glyphs we draw.
async function loadDigitsFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch('https://fonts.googleapis.com/css2?family=Rubik:wght@800&text=10.', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1)' }, // an old UA gets a TTF Satori can read
      })
    ).text();
    const url = css.match(/src: url\((.+?)\) format/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const digits = await loadDigitsFont();
  const coin = {
    width: 46,
    height: 46,
    borderRadius: 9999,
    background: 'radial-gradient(circle at 35% 30%, #fff4b8 0%, #ffd43b 30%, #f59e0b 68%, #c2410c 100%)',
    boxShadow: '0 0 22px rgba(255,176,0,.7)',
  } as const;

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
          background: 'radial-gradient(circle at 50% 42%, #2a1206 0%, #0b0b0b 62%)',
        }}
      >
        {/* Stopwatch crown */}
        <div style={{ display: 'flex', width: 70, height: 34, borderRadius: 10, background: '#f59e0b', marginBottom: -6 }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 440,
            height: 440,
            borderRadius: 9999,
            border: '18px solid #f59e0b',
            boxShadow: '0 0 60px rgba(245,158,11,.45), inset 0 0 40px rgba(0,0,0,.6)',
            background: '#111',
          }}
        >
          <div style={{ display: 'flex', fontSize: 132, fontWeight: 800, color: '#fff', letterSpacing: -2, fontFamily: digits ? 'Digits' : undefined }}>
            10.00
          </div>
        </div>
        <div style={{ display: 'flex', gap: 22, marginTop: 34 }}>
          <div style={coin} />
          <div style={coin} />
          <div style={coin} />
        </div>
      </div>
    ),
    {
      width: 633,
      height: 633,
      fonts: digits ? [{ name: 'Digits', data: digits, weight: 800, style: 'normal' }] : undefined,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    }
  );
}
