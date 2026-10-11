'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Volume2, VolumeX } from 'lucide-react';
import RaffleConfetti from '@/components/raffle/RaffleConfetti';
import { NEON_STYLE, NeonBackdrop } from '@/components/viewer/tenbool/NeonSpace';
import { formatDiff } from '@/lib/tenbool/competition';
import { fetchBoard, type BoardData } from '@/lib/tenbool/client';
import {
  TENBOOL_DEFAULTS,
  resolveTenBoolSoundUrl,
  tenboolEffects,
  tenboolFont,
  tenboolFontStylesheet,
  type TenBoolConfig,
} from '@/types/tenbool';

// 10 בול phone mode, the big screen (/v/{shortId}?screen=board): a scan code to join, the winners
// (fewest attempts first) and the closest stops, refreshed every few seconds. Every new hit gets a
// few seconds of the whole screen - the player's selfie, name and attempt count - before it drops
// into its place on the list.

const POLL_MS = 2500;
const CELEBRATE_MS = 6500;
const CONFETTI_COLORS = ['#ff2b2b', '#ffd43b', '#22c55e', '#3b82f6', '#a855f7', '#ff7ab6', '#ffffff', '#f59e0b'];
const MEDALS = ['#ffd43b', '#d6dde6', '#e79a5a']; // gold, silver, bronze
const AVATAR_COLORS = ['#7F77DD', '#1D9E75', '#D85A30', '#378ADD', '#D4537E', '#639922', '#BA7517', '#993556'];

const BOARD_STYLE = `
@keyframes tbb-row-in { 0% { transform:translateX(-6vmin); opacity:0 } 100% { transform:none; opacity:1 } }
.tbb-row-in { animation: tbb-row-in .6s cubic-bezier(.2,1.2,.4,1) both }
@keyframes tbb-pop { 0% { transform:scale(.3); opacity:0 } 60% { transform:scale(1.08); opacity:1 } 100% { transform:scale(1) } }
.tbb-pop { animation: tbb-pop .7s cubic-bezier(.2,1.4,.4,1) both }
@keyframes tbb-rise { 0% { transform:translateY(4vmin); opacity:0 } 100% { transform:none; opacity:1 } }
.tbb-rise { animation: tbb-rise .6s ease-out both }
@keyframes tbb-breathe { 0%,100% { opacity:.55 } 50% { opacity:1 } }
.tbb-breathe { animation: tbb-breathe 2s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .tbb-row-in, .tbb-pop, .tbb-rise, .tbb-breathe { animation: none !important } }
`;

type Winner = BoardData['winners'][number];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}
function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const attemptsText = (n: number) => (n === 1 ? 'ניסיון ראשון' : `${n} ניסיונות`);

function Avatar({ winner, size }: { winner: Pick<Winner, 'id' | 'name' | 'photoUrl'>; size: string }) {
  return winner.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={winner.photoUrl} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="shrink-0 rounded-full flex items-center justify-center font-black text-white"
      style={{ width: size, height: size, background: colorFor(winner.id), fontSize: `calc(${size} * .4)` }}
    >
      {initials(winner.name)}
    </span>
  );
}

export default function TenBoolLeaderboard({
  codeId,
  shortId,
  title,
  config,
}: {
  codeId: string;
  shortId: string;
  title?: string;
  config?: TenBoolConfig;
}) {
  const [data, setData] = useState<BoardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [joinUrl, setJoinUrl] = useState('');
  const [queue, setQueue] = useState<Winner[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [soundOn, setSoundOn] = useState(false);
  const seenRef = useRef<Set<string> | null>(null);
  const soundOnRef = useRef(false);
  soundOnRef.current = soundOn;

  const fx = tenboolEffects(config);
  const font = tenboolFont(config);
  const fg = config?.textColor || TENBOOL_DEFAULTS.textColor;
  const successUrl = resolveTenBoolSoundUrl(config, 'success');

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/v/${shortId}`);
  }, [shortId]);

  useEffect(() => {
    if (font.id === 'assistant') return;
    const href = tenboolFontStylesheet(font.family);
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }, [font.id, font.family]);

  // Poll the board. The first load only marks what's already there; later hits are celebrated.
  useEffect(() => {
    let alive = true;
    let timer = 0;
    const load = async () => {
      try {
        const next = await fetchBoard(codeId);
        if (!alive) return;
        setFailed(false);
        setData(next);
        if (!seenRef.current) {
          seenRef.current = new Set(next.winners.map((w) => w.id));
        } else {
          const fresh = next.winners.filter((w) => !seenRef.current!.has(w.id)).sort((a, b) => a.wonAt - b.wonAt);
          if (fresh.length) {
            fresh.forEach((w) => seenRef.current!.add(w.id));
            setQueue((q) => [...q, ...fresh]);
          }
        }
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) timer = window.setTimeout(load, POLL_MS);
      }
    };
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [codeId]);

  // One celebration at a time; the row lights up on the list when its turn ends
  const current = queue[0] ?? null;
  useEffect(() => {
    if (!current) return;
    if (soundOnRef.current && successUrl) {
      const audio = new Audio(successUrl);
      audio.play().catch(() => {});
    }
    const t = window.setTimeout(() => {
      setFreshIds((s) => new Set(s).add(current.id));
      setQueue((q) => q.slice(1));
    }, CELEBRATE_MS);
    return () => clearTimeout(t);
  }, [current, successUrl]);

  const winners = data?.winners ?? [];
  const near = data?.near ?? [];
  const boardSize = data?.boardSize ?? 10;
  // Rows share the column height, so 3 rows are big and 20 still fit
  const rowH = `min(${Math.round(78 / Math.max(5, boardSize))}vh, 11vmin)`;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 overflow-hidden select-none"
      style={{
        top: 'var(--pwa-banner-h, 0px)', // start below the install banner while it shows
        transition: 'top .25s ease',
        fontFamily: `'${font.family}', var(--font-assistant), system-ui, sans-serif`,
        color: fg,
        backgroundColor: fx.neon ? fx.spaceTo : config?.backgroundColor || TENBOOL_DEFAULTS.backgroundColor,
        backgroundImage: !fx.neon && config?.backgroundImageUrl ? `url("${config.backgroundImageUrl}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <style>{BOARD_STYLE}</style>
      {fx.neon && (
        <>
          <style>{NEON_STYLE}</style>
          <NeonBackdrop from={fx.neonFrom} to={fx.neonTo} centre={fx.spaceFrom} edge={fx.spaceTo} stars={fx.neonStars} />
        </>
      )}

      <div className="relative h-full grid grid-rows-[auto_1fr] landscape:grid-rows-1 landscape:grid-cols-[1.6fr_1fr] gap-[3vmin] p-[3.5vmin]">
        {/* Winners */}
        <section className="min-h-0 flex flex-col gap-[1.6vmin]" aria-label="לוח המנצחים">
          <header className="flex items-center gap-[2vmin]">
            {config?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logoUrl} alt="" className="h-[9vmin] w-auto object-contain" />
            )}
            <div className="min-w-0">
              <h1 className="font-black leading-none text-[6vmin] truncate">{title || '10 בול'}</h1>
              <p className="opacity-70 text-[2.6vmin] mt-[.6vmin]">מי עצר על 10.00 בהכי מעט ניסיונות</p>
            </div>
          </header>

          {winners.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-[1.5vmin]">
              <div dir="ltr" className="font-black tabular-nums text-[16vmin] leading-none opacity-90">
                10.00
              </div>
              <p className="tbb-breathe font-bold text-[4vmin]">עוד אין בול. מי יהיה הראשון?</p>
            </div>
          ) : (
            <ol className="flex-1 min-h-0 flex flex-col gap-[1vmin]">
              {winners.map((w, i) => (
                <li
                  key={w.id}
                  className={`flex items-center gap-[2vmin] rounded-[2vmin] px-[2vmin] ${freshIds.has(w.id) ? 'tbb-row-in' : ''}`}
                  style={{
                    height: rowH,
                    background: i < 3 ? `${MEDALS[i]}26` : 'rgba(255,255,255,.07)',
                    boxShadow: i < 3 ? `inset 0 0 0 .3vmin ${MEDALS[i]}88` : undefined,
                  }}
                >
                  <span
                    className="shrink-0 w-[1.6em] text-center font-black tabular-nums"
                    style={{ color: i < 3 ? MEDALS[i] : undefined, fontSize: `calc(${rowH} * .45)` }}
                  >
                    {i + 1}
                  </span>
                  <Avatar winner={w} size={`calc(${rowH} * .78)`} />
                  <span className="flex-1 min-w-0 truncate font-bold" style={{ fontSize: `calc(${rowH} * .4)` }}>
                    {w.name}
                  </span>
                  <span className="shrink-0 font-black tabular-nums opacity-90" style={{ fontSize: `calc(${rowH} * .34)` }}>
                    {attemptsText(w.attempts)}
                  </span>
                </li>
              ))}
              {/* The empty places, dimmed, so the screen reads as a board waiting to fill */}
              {Array.from({ length: Math.max(0, boardSize - winners.length) }, (_, i) => (
                <li
                  key={`empty-${i}`}
                  aria-hidden="true"
                  className="flex items-center gap-[2vmin] rounded-[2vmin] px-[2vmin] opacity-25"
                  style={{ height: rowH, boxShadow: 'inset 0 0 0 .2vmin rgba(255,255,255,.35)' }}
                >
                  <span className="shrink-0 w-[1.6em] text-center font-black tabular-nums" style={{ fontSize: `calc(${rowH} * .45)` }}>
                    {winners.length + i + 1}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Join + closest */}
        <aside className="min-h-0 flex flex-col items-center gap-[2.5vmin] landscape:justify-center">
          <div className="rounded-[3vmin] bg-white p-[2vmin] shadow-2xl">
            {joinUrl && <QRCodeSVG value={joinUrl} size={512} level="M" className="block w-[30vmin] h-[30vmin]" />}
          </div>
          <div className="text-center">
            <div className="font-black text-[4.4vmin] leading-tight">סרקו ושחקו מהטלפון</div>
            <div className="opacity-70 text-[2.4vmin]">עצרו את הטיימר בדיוק על 10.00</div>
          </div>

          {data?.nearMisses && near.length > 0 && (
            <div className="w-full max-w-[60vmin] rounded-[2vmin] bg-black/25 px-[2.4vmin] py-[1.6vmin]">
              <div className="font-black text-[2.8vmin] mb-[.8vmin] opacity-90">הכי קרובים</div>
              <ul className="space-y-[.5vmin]">
                {near.map((n) => (
                  <li key={n.id} className="flex items-center gap-[1.5vmin] text-[2.6vmin]">
                    <span className="flex-1 min-w-0 truncate font-bold">{n.name}</span>
                    <span dir="ltr" className="font-black tabular-nums">
                      {formatDiff(n.diff)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data && data.stats.players > 0 && (
            <div className="opacity-60 text-[2.2vmin] tabular-nums">
              {data.stats.players} שחקנים · {data.stats.attempts} ניסיונות
            </div>
          )}
        </aside>
      </div>

      {current && (
        <div key={current.id} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-[3vmin] bg-black/80 backdrop-blur-sm text-white">
          <RaffleConfetti colors={CONFETTI_COLORS} glow="#ffffff" count={120} />
          <div className="tbb-pop rounded-full p-[1vmin]" style={{ background: `linear-gradient(135deg, ${fx.neonFrom}, #ffd43b)` }}>
            <Avatar winner={current} size="42vmin" />
          </div>
          <div className="tbb-rise text-center" style={{ animationDelay: '.25s' }}>
            <div className="font-black text-[13vmin] leading-none">בול!</div>
            <div className="font-black text-[7vmin] leading-tight mt-[1vmin]">{current.name}</div>
            <div className="text-[4vmin] opacity-85">{current.attempts === 1 ? 'כבר בניסיון הראשון' : `בניסיון ה-${current.attempts}`}</div>
          </div>
        </div>
      )}

      {failed && !data && (
        <div className="absolute inset-x-0 bottom-[4vmin] text-center text-[2.4vmin] opacity-70">מתחברים…</div>
      )}

      {/* Browsers only allow sound after a click on the page - one click here turns the hit sound on */}
      <button
        onClick={() => setSoundOn((v) => !v)}
        aria-label={soundOn ? 'השתיקו את צליל הבול' : 'הפעילו את צליל הבול'}
        title={soundOn ? 'השתיקו את צליל הבול' : 'הפעילו את צליל הבול'}
        className="absolute bottom-[2vmin] left-[2vmin] z-20 rounded-full p-[1.2vmin] opacity-30 hover:opacity-90 transition-opacity"
      >
        {soundOn ? <Volume2 className="w-[3vmin] h-[3vmin]" /> : <VolumeX className="w-[3vmin] h-[3vmin]" />}
      </button>
    </div>
  );
}
