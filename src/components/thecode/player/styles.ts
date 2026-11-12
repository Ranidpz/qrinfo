// הקוד — the player's art direction: a night-time hotel turned into a vault.
// Deep indigo night, brass combination-lock tumblers for letters, cream type,
// mint for wins, coral for losses, flame for the hot streak.
// Motion is transform/opacity only; prefers-reduced-motion switches it all off.

export const THECODE_STYLE = `
.tc-root {
  --tc-night: #0B1030;
  --tc-deep: #161E52;
  --tc-panel: rgba(255, 244, 218, 0.06);
  --tc-line: rgba(255, 244, 218, 0.14);
  --tc-brass: #F4B740;
  --tc-brass-hi: #FFD978;
  --tc-brass-lo: #A8691A;
  --tc-cream: #FFF4DA;
  --tc-soft: rgba(255, 244, 218, 0.68);
  --tc-mint: #36E39A;
  --tc-coral: #FF5468;
  --tc-flame: #FF8A2B;
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  color: var(--tc-cream);
  background:
    radial-gradient(120% 70% at 50% -10%, #2A3384 0%, rgba(42, 51, 132, 0) 60%),
    radial-gradient(90% 60% at 50% 110%, #2B1747 0%, rgba(43, 23, 71, 0) 70%),
    var(--tc-night);
  font-family: var(--font-assistant), system-ui, sans-serif;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.tc-root *::-webkit-scrollbar { display: none; }
.tc-root * { scrollbar-width: none; }
.tc-root.tc-alarm { background: radial-gradient(100% 80% at 50% 30%, #6B1426 0%, #2A0714 70%), #1A0510; }
.tc-display { font-family: var(--tc-font-display), var(--font-assistant), sans-serif; letter-spacing: 0; }
.tc-num { font-family: var(--tc-font-display), sans-serif; font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; }

/* star dust */
.tc-stars { position: absolute; inset: 0; pointer-events: none; opacity: .55;
  background-image:
    radial-gradient(1.5px 1.5px at 12% 18%, #fff 50%, transparent 51%),
    radial-gradient(1px 1px at 72% 12%, #fff 50%, transparent 51%),
    radial-gradient(1.2px 1.2px at 40% 32%, #FFE7A8 50%, transparent 51%),
    radial-gradient(1px 1px at 88% 44%, #fff 50%, transparent 51%),
    radial-gradient(1.5px 1.5px at 22% 62%, #fff 50%, transparent 51%),
    radial-gradient(1px 1px at 60% 74%, #FFE7A8 50%, transparent 51%),
    radial-gradient(1.2px 1.2px at 8% 88%, #fff 50%, transparent 51%),
    radial-gradient(1px 1px at 92% 86%, #fff 50%, transparent 51%);
}

/* brass tumbler (a letter) */
.tc-tile {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 14px; color: #3A2205; font-weight: 800;
  background: linear-gradient(180deg, var(--tc-brass-hi) 0%, var(--tc-brass) 45%, #D9922A 100%);
  box-shadow: inset 0 2px 0 rgba(255,255,255,.55), inset 0 -4px 0 rgba(120, 66, 8, .45), 0 6px 0 #6E400C, 0 10px 18px rgba(0,0,0,.35);
}
.tc-tile::after { content: ''; position: absolute; inset: 0; border-radius: inherit;
  background: linear-gradient(180deg, rgba(255,255,255,.0) 0 46%, rgba(80,40,0,.18) 47% 53%, rgba(255,255,255,0) 54%); pointer-events: none; }
.tc-socket {
  display: inline-flex; align-items: center; justify-content: center; border-radius: 14px;
  background: rgba(0,0,0,.28); box-shadow: inset 0 3px 8px rgba(0,0,0,.55), inset 0 0 0 1.5px var(--tc-line);
  color: var(--tc-soft);
}

/* big buttons */
.tc-btn { display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
  min-height: 56px; padding: 0 1.4rem; border-radius: 18px; font-weight: 800; font-size: 1.15rem;
  transition: transform .12s ease, opacity .2s ease; cursor: pointer; }
.tc-btn:active { transform: translateY(3px) scale(.98); }
.tc-btn:focus-visible, .tc-key:focus-visible, .tc-chip:focus-visible { outline: 3px solid var(--tc-cream); outline-offset: 3px; }
.tc-btn-primary { color: #3A2205;
  background: linear-gradient(180deg, var(--tc-brass-hi), var(--tc-brass) 60%, #E09A2E);
  box-shadow: inset 0 2px 0 rgba(255,255,255,.5), 0 6px 0 #7A4710, 0 14px 26px rgba(244,183,64,.25); }
.tc-btn-primary:active { box-shadow: inset 0 2px 0 rgba(255,255,255,.5), 0 2px 0 #7A4710; }
.tc-btn-ghost { color: var(--tc-cream); background: var(--tc-panel); box-shadow: inset 0 0 0 1.5px var(--tc-line); }
.tc-btn:disabled { opacity: .4; pointer-events: none; }
.tc-chip { display: inline-flex; align-items: center; gap: .35rem; min-height: 44px; padding: 0 .85rem;
  border-radius: 999px; background: var(--tc-panel); box-shadow: inset 0 0 0 1.5px var(--tc-line); font-weight: 700; }

/* letter pad key */
.tc-key { display: flex; align-items: center; justify-content: center; height: 54px; border-radius: 14px;
  font-size: 1.6rem; font-weight: 800; color: var(--tc-cream);
  background: linear-gradient(180deg, #2B357E, #1F2763); box-shadow: inset 0 1.5px 0 rgba(255,255,255,.14), 0 4px 0 #0E1440;
  transition: transform .08s ease; }
.tc-key:active { transform: translateY(3px); box-shadow: inset 0 1.5px 0 rgba(255,255,255,.14), 0 1px 0 #0E1440; }
.tc-key[aria-pressed="true"] { color: #3A2205; background: linear-gradient(180deg, var(--tc-brass-hi), var(--tc-brass)); box-shadow: 0 4px 0 #7A4710; }
.tc-key:disabled { opacity: .35; }

/* ---------- motion ---------- */
@keyframes tc-pop { 0% { transform: scale(.2) rotate(-12deg); opacity: 0 } 60% { transform: scale(1.18) rotate(4deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
@keyframes tc-drop { 0% { transform: translateY(-60px) scale(1.4); opacity: 0 } 70% { transform: translateY(4px) scale(.96); opacity: 1 } 100% { transform: none } }
@keyframes tc-rise { 0% { transform: translateY(24px); opacity: 0 } 100% { transform: none; opacity: 1 } }
@keyframes tc-float-up { 0% { transform: translateY(6px) scale(.7); opacity: 0 } 15% { transform: translateY(0) scale(1.15); opacity: 1 } 100% { transform: translateY(-70px) scale(1); opacity: 0 } }
@keyframes tc-fall { 0% { transform: translateY(-4px) scale(.7); opacity: 0 } 15% { transform: translateY(0) scale(1.2); opacity: 1 } 100% { transform: translateY(90px) rotate(-8deg); opacity: 0 } }
@keyframes tc-shake { 0%,100% { transform: translateX(0) } 15% { transform: translateX(-12px) } 30% { transform: translateX(10px) } 45% { transform: translateX(-8px) } 60% { transform: translateX(6px) } 75% { transform: translateX(-3px) } }
@keyframes tc-wobble { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-7deg) } 75% { transform: rotate(7deg) } }
@keyframes tc-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
@keyframes tc-flicker { 0%,100% { transform: scale(1) rotate(-3deg) } 50% { transform: scale(1.12) rotate(3deg) } }
@keyframes tc-pulse-ring { 0% { transform: scale(.8); opacity: .7 } 100% { transform: scale(1.6); opacity: 0 } }
@keyframes tc-spin-slow { to { transform: rotate(360deg) } }
@keyframes tc-zzz { 0% { transform: translate(0,0) scale(.6); opacity: 0 } 30% { opacity: 1 } 100% { transform: translate(-26px,-46px) scale(1.2); opacity: 0 } }
@keyframes tc-confetti { 0% { transform: translate3d(0,-10vh,0) rotate(0); opacity: 1 } 100% { transform: translate3d(var(--dx), 110vh, 0) rotate(var(--rot)); opacity: .9 } }
@keyframes tc-lid { 0% { transform: rotateX(0) } 25% { transform: rotateX(-10deg) translateY(-4px) } 100% { transform: rotateX(90deg) translateY(-8px); opacity: 0 } }
@keyframes tc-lid-open { 0% { transform: scaleY(0); opacity: 0 } 1% { opacity: 1 } 70% { transform: scaleY(1.06) } 100% { transform: scaleY(1); opacity: 1 } }
@keyframes tc-latch { 0% { transform: translateY(0) } 100% { transform: translateY(-10px) rotate(-30deg); opacity: .0 } }
@keyframes tc-glow { 0% { transform: scale(.4); opacity: 0 } 40% { opacity: 1 } 100% { transform: scale(1.25); opacity: .85 } }
@keyframes tc-rays { to { transform: rotate(360deg) } }
@keyframes tc-stamp { 0% { transform: scale(2.4) rotate(-14deg); opacity: 0 } 60% { transform: scale(.92) rotate(-8deg); opacity: 1 } 100% { transform: scale(1) rotate(-8deg); opacity: 1 } }
@keyframes tc-dial { 0% { transform: rotate(0) } 100% { transform: rotate(var(--turn, 300deg)) } }

.tc-a-pop { animation: tc-pop .55s cubic-bezier(.2,.9,.3,1.3) both; }
.tc-a-drop { animation: tc-drop .5s cubic-bezier(.2,.9,.3,1.2) both; }
.tc-a-rise { animation: tc-rise .45s cubic-bezier(.2,.8,.2,1) both; }
.tc-a-shake { animation: tc-shake .5s ease both; }
.tc-a-wobble { animation: tc-wobble .6s ease-in-out 2; }
.tc-a-bob { animation: tc-bob 3.2s ease-in-out infinite; }
.tc-a-flicker { animation: tc-flicker .7s ease-in-out infinite; display: inline-block; }
.tc-a-stamp { animation: tc-stamp .5s cubic-bezier(.2,.9,.3,1.2) both; }
.tc-float-plus { animation: tc-float-up 1.25s ease-out both; color: var(--tc-mint); text-shadow: 0 2px 12px rgba(54,227,154,.5); }
.tc-float-minus { animation: tc-fall 1.35s ease-in both; color: var(--tc-coral); text-shadow: 0 2px 12px rgba(255,84,104,.5); }
.tc-ring { position: absolute; inset: 0; border-radius: 999px; border: 3px solid var(--tc-flame); animation: tc-pulse-ring 1.4s ease-out infinite; }
.tc-zzz { position: absolute; font-weight: 800; animation: tc-zzz 2.4s ease-out infinite; }
.tc-confetti-piece { position: absolute; top: 0; width: 9px; height: 15px; border-radius: 2px; animation: tc-confetti var(--dur) cubic-bezier(.25,.6,.35,1) var(--delay) both; }
.tc-lid { transform-origin: 50% 100%; animation: tc-lid .45s ease-in .55s both; }
.tc-lid-open { transform-origin: 50% 100%; animation: tc-lid-open .6s cubic-bezier(.2,.9,.3,1.2) .95s both; }
.tc-latch { animation: tc-latch .35s ease-in .25s both; }
.tc-glow { animation: tc-glow 1s ease-out 1s both; }
.tc-rays { animation: tc-rays 14s linear infinite; }
.tc-row-move { transition: transform .9s cubic-bezier(.3,.9,.3,1); }
@keyframes tc-scanline { 0% { transform: translateY(0); opacity: .2 } 50% { opacity: 1 } 100% { transform: translateY(var(--tc-scan-h, 220px)); opacity: .2 } }
.tc-scanline { animation: tc-scanline 2.2s ease-in-out infinite alternate; }
@keyframes tc-spin { to { transform: rotate(360deg) } }
.tc-spin { animation: tc-spin 1s linear infinite; }
.tc-delay-1 { animation-delay: .08s } .tc-delay-2 { animation-delay: .16s } .tc-delay-3 { animation-delay: .24s } .tc-delay-4 { animation-delay: .32s }

@media (prefers-reduced-motion: reduce) {
  .tc-root *, .tc-root *::before, .tc-root *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; animation-delay: 0ms !important; transition-duration: 1ms !important; }
  .tc-confetti-piece, .tc-ring, .tc-zzz { display: none; }
}
`;
