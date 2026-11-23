'use client';

// קוד הגמדים — the big screen's "a new group joined" moment (free-mode plan, stage 4; DEMO for
// approval). The game starts at the screen, so every registration gets its own celebration:
// the screen dims → confetti → the group's selfie / symbol big in the middle with its name →
// the photo shrinks and flies up into the selfie parade (the top band), where it keeps walking.
// Overlay only: it sits on top of the live stage (LobbyStage is not changed) and calls onDone
// when it has finished, so the caller adds the group to the board at that moment.

import { useEffect, useState } from 'react';
import GnomeConfetti from '@/components/thecode/player/GnomeConfetti';
import { Avatar, isPhotoAvatar } from '@/components/thecode/player/Avatar';

export interface JoinEvent { key: number; name: string; avatar: string }

/** How long the group stays in the middle, then the flight to the parade. */
export const JOIN_SHOW_MS = 3400;
export const JOIN_FLY_MS = 1300;

const STYLE = `
@keyframes tcj-dim { from { opacity: 0 } to { opacity: 1 } }
@keyframes tcj-undim { from { opacity: 1 } to { opacity: 0 } }
@keyframes tcj-in { 0% { transform: scale(.2) rotate(-10deg); opacity: 0 } 55% { transform: scale(1.12) rotate(3deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
@keyframes tcj-fly { 0% { transform: translateY(0) scale(1); opacity: 1 } 70% { opacity: 1 } 100% { transform: translateY(-40vh) scale(.28); opacity: 0 } }
@keyframes tcj-ring { 0% { box-shadow: 0 0 0 0 rgba(244,183,64,.7) } 100% { box-shadow: 0 0 0 5vh rgba(244,183,64,0) } }
@keyframes tcj-text { 0% { opacity: 0; transform: translateY(3vh) } 100% { opacity: 1; transform: none } }
@keyframes tcj-text-out { to { opacity: 0 } }
.tcj-dim { animation: tcj-dim .5s ease both; }
.tcj-dim.out { animation: tcj-undim ${JOIN_FLY_MS}ms ease both; }
.tcj-face { animation: tcj-in .8s cubic-bezier(.2,.9,.3,1.25) both; }
.tcj-face.out { animation: tcj-fly ${JOIN_FLY_MS}ms cubic-bezier(.5,0,.3,1) both; }
.tcj-ring { border-radius: 50%; animation: tcj-ring 1.4s ease-out .5s 2; }
.tcj-text { animation: tcj-text .6s ease .45s both; }
.tcj-text.out { animation: tcj-text-out .4s ease both; }
@media (prefers-reduced-motion: reduce) { .tcj-dim, .tcj-face, .tcj-ring, .tcj-text { animation: none !important; } }
`;

export default function JoinCelebration({ event, onDone }: { event: JoinEvent; onDone(): void }) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setOut(true), JOIN_SHOW_MS);
    const b = setTimeout(onDone, JOIN_SHOW_MS + JOIN_FLY_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [event.key, onDone]);
  const photo = isPhotoAvatar(event.avatar);
  return (
    <div dir="rtl" lang="he" aria-live="polite" className="pointer-events-none fixed inset-0 z-[45]">
      <style>{STYLE}</style>
      <div className={`tcj-dim absolute inset-0 ${out ? 'out' : ''}`}
        style={{ background: 'radial-gradient(60% 60% at 50% 45%, rgba(20,14,60,.72), rgba(3,4,18,.9))' }} />
      {!out && <GnomeConfetti position="fixed" burstKey={`join-${event.key}`} count={200} origin={{ x: '50%', y: '42%' }} />}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3vh]">
        <div className={`tcj-face ${out ? 'out' : ''}`}>
          <div className="tcj-ring">
            {photo ? (
              <Avatar value={event.avatar} size={260} cssSize="30vh" />
            ) : (
              <span className="flex h-[30vh] w-[30vh] items-center justify-center rounded-full"
                style={{ background: 'radial-gradient(circle, #3E2C74, #141a48)', boxShadow: '0 0 0 1vh var(--tc-brass)' }}>
                <Avatar value={event.avatar} size={200} cssSize="20vh" />
              </span>
            )}
          </div>
        </div>
        <div className={`tcj-text text-center ${out ? 'out' : ''}`}>
          <p className="tc-display text-[4.4vh] leading-none" style={{ color: 'var(--tc-soft)' }}>קבוצה חדשה במשחק!</p>
          <p className="tc-display mt-[1.6vh] text-[9vh] leading-none" style={{ color: 'var(--tc-brass)', textShadow: '0 4px 0 #6E400C, 0 18px 40px rgba(244,183,64,.4)' }}>
            {event.name}
          </p>
          <p className="mt-[2vh] text-[3.4vh] font-bold" style={{ color: 'var(--tc-cream)' }}>
            {photo ? 'ברוכים הבאים! חפשו אותם במצעד הגמדים' : 'ברוכים הבאים! צאו לחפש את הגמדים'}
          </p>
        </div>
      </div>
    </div>
  );
}
