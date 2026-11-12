# הקוד (The Code) — product + engineering plan

Status: wave 1 DONE and merged into `feature/thecode` (engine + 36 tests, player demo,
operator demo — Rani approved both demos on 12.11.2026). Wave 2 DONE and merged (server, live player + in-page scanner, live operator admin +
dashboard). End-to-end verified on `qrinfo-dev` 12.11.2026: `node scripts/thecode-e2e.mjs`
(55 checks against a running dev server; refuses any project but `qrinfo-dev`).
Code released to `main` as v1.29.1 on 12.11.2026 (Rani's decision: no one uses the feature
yet, so it is tested on production) — HIDDEN: the create tab shows for super admins only.
Open items: §9.
Owner decisions were taken with Rani on 11.11.2026; this file is the source of truth
for every session working on the feature. Internal slug: `thecode`.

## 1. What it is

A permanent, self-paced QR adventure for families in a physical venue (hotels first).
Small 3D-printed gnomes (8–10 cm, screwed down, each with a fixed QR plate) stand
around the venue, usually 2–3 side by side at one spot. Every gnome has two colours:
body and hat. The system sends each family from gnome to gnome ("find the green gnome
with the red hat near the piano"). At the right gnome the family gets a riddle about
something in sight, taps the FIRST LETTER of the answer, and the letter drops into
their collector. When all letters are collected they arrange them into a secret
phrase, a virtual suitcase opens, and they score. Coming back later = a new suitcase
with gnomes and riddles they have not seen.

No app install, no AI at play time, no clock. Phone = scanner + one clear task.

## 2. Decisions (do not re-open without Rani)

- New standalone experience. Do NOT modify `qhunt` / `qtreasure` or reuse their data layer.
- Firebase (Firestore, Admin SDK only, behind one store module) + media on R2. No Supabase.
- QR = a gnome (a place). The letter belongs to the RIDDLE, not the gnome: a gnome's
  riddle bank may yield different letters. One riddle per gnome is enough to launch.
- Routing is per family and decided by the system; only the CURRENT target counts.
  Any other gnome is a wrong scan ("נא נא, זה לא הגמד שלכם").
- The family taps one letter on an in-app letter pad (adventure alphabet — never the
  phone keyboard). Sound-alike letters (ק for כ) are accepted with a spelling tip; the
  collector always gets the correct letter.
- Wrong scans: first N per target are free (operator setting 1–3, default 1), then a
  points penalty. Re-scanning the same wrong gnome never costs twice. Points never go
  below 0; collected letters are never taken away.
- No time competition. Points, suitcases, leaderboard, "hot player" streak (3 correct
  in a row → ×2 until a mistake).
- Identity: device-bound profile + short recovery code. WhatsApp OTP of a parent is an
  operator toggle (later phase; existing INFORU flow). Nickname + emoji only — no
  selfie, no full name.
- Several profiles on one phone (siblings) with a quick switcher.
- A disabled gnome/riddle mid-run is swapped for another source of the same letter;
  if none exists the letter is GIFTED (no points). A run must always be completable.
- When a family has no fresh content left: say so honestly ("פתחתם את כל המזוודות").
  Never invent content, never replay solved riddles for points.
- Presenter videos do not exist yet: text + animation everywhere, video is an optional
  layer on named triggers (`TheCodeTrigger`).
- Prize: the win is recorded and shown on screen/phone. Reception redemption UI later.
- Scanning happens INSIDE the game page (a "סרקו גמד" button opens the camera in the
  page — `html5-qrcode`, as in Q.Hunt). The phone's own camera also works: it opens
  `/g/{code}`; a known device lands straight on the result, a new device registers
  first and then continues with that gnome. A manual short code is the fallback.
- Nothing secret is world-readable: the whole adventure (spots, gnomes, phrases,
  rules, riddles) is server-only. The code doc carries only a public stub.
- Gaming feel is a requirement: huge count-up numbers, green +N, red −N, letter pop,
  confetti, hot-streak badge, short sounds with a mute toggle, one task per screen.

## 3. Model (see `src/types/thecode.ts`)

- `TheCodePublicConfig` — the only public part: `{title,status,language}` on the code's
  media item (`thecodeConfig`).
- `TheCodeConfig` — the full adventure (spots, gnomes, phrases, rules). SERVER-ONLY,
  stored with the riddles in one locked doc. The phrases are the secret.
- `TheCodeRiddle` — locked collection (answers). `letter` = first letter of `answerWord`.
- `TheCodePlayer` — locked collection. Holds the whole state incl. the current
  `TheCodeRun` (a saved plan: one slot per phrase letter → gnome + riddle), so every
  action is ONE transaction on ONE document.
- Letter rules live in `src/lib/thecode/letters.ts` (final forms, niqqud, sound-alikes,
  display). Everything uses them; nobody re-implements letter logic.

## 4. Engine rules (pure functions, `src/lib/thecode/engine.ts`)

Build a run (`buildRun`):
1. Candidate phrases = active, valid, not yet opened by this player.
2. A phrase is playable for a player if a matching exists: every phrase letter (repeats
   are separate slots) ↔ a DISTINCT active gnome (active spot) that has a published
   riddle with that letter which the player has NOT solved. Bipartite matching.
3. Preferences, in order: gnomes the player never found → spread over many spots →
   random. If the first scanned gnome can supply a letter, it is slot one, already active.
4. No playable phrase → `allDone`. Never start a run that cannot be finished.
5. Randomness is injected (`rng`) so tests are deterministic; the server passes crypto.

Play:
- `nextTarget` picks a pending slot, preferring a different spot from the last one.
  Once shown, the target is saved and survives closing the phone.
- `scan` → `riddle` | `wrongGnome` | `alreadySolved` | `gnomeAsleep` | `allDone` | `paused`.
- `answer` → `correct` (points, letter, streak, next target or `arranging`) | `wrong`
  (streak reset; after `freeWrongAnswers` → penalty + cooldown) | `cooldown`.
- `hint` → next location/riddle hint; first is free, then `hintCost`; breaks the streak.
- `repairRun` runs before every action: swaps or gifts slots whose gnome, spot or
  riddle is no longer usable, and re-targets if the target died.
- `arrange` checks the arrangement against the phrase; `openSuitcase` awards the bonus.

Validation (`validateAdventure`) returns `TheCodeIssue[]`; publish is blocked on any
`error`. It also reports how many fresh suitcases one family can open.

## 5. Edge cases and their handling

Scanning
- First scan on a new device → register → run built around that gnome.
- Camera scans open a NEW tab every time → all state is server-side, keyed by the
  device profile; nothing important lives in memory.
- In-app browsers (WhatsApp/Instagram scanners) isolate storage → detect
  (`src/lib/inAppBrowser.ts`) and ask to open in the real browser.
- Cleared storage / new phone → "יש לי קוד" on the register screen (recovery code).
- Two phones on one profile → both act on one doc in transactions; UI refetches on focus.
- Siblings on one phone → profile switcher; a scan acts for the active profile.
- Double tap / refresh / re-scan of the target → idempotent, same riddle, no double points.
- Re-scan of a gnome solved earlier in the run → "כבר פתרתם אותי", no penalty.
- Inactive gnome → "הגמד הזה ישן"; if it was the target → repair.
- Unknown/foreign code → friendly not-found. Paused adventure / outside
  `activeHours` → "המשחק בהפסקה", state untouched.
- A photographed QR can be opened remotely. Accepted for the MVP: the riddle still
  needs someone on site; revisit only if abuse shows up.
- Weak network: the answer is never awarded locally. Failed submit keeps the choice
  and offers retry; the server dedupes.

Content
- Phrase letters with no source → cannot publish; operator sees "חסרה חידה לאות ס׳".
- Repeated letters need distinct gnomes → handled by the matching.
- Final forms, niqqud, spaces, punctuation → `letters.ts`. Digits / other alphabet in a
  phrase → `PHRASE_INVALID_CHARS`.
- Answer starting with a sound-alike letter → warning to the operator, not an error.
- Two identical colour combos at one spot → error (the target would be ambiguous).
- Red/green pair at one spot → warning (colour-blind children). The on-screen target
  always shows the drawn gnome AND the colour names in words.
- Riddle edited so its letter changes while in live runs → those slots are repaired.
- Gnome moved to another spot → QR is permanent; only the config changes.
- All gnomes at one spot / spots without hints → warnings.

Scoring and abuse
- Brute-forcing a letter: penalty + cooldown after `freeWrongAnswers`.
- Random scanning: wrong-scan penalty after the free ones.
- Forged requests: player id + secret token; every rule enforced server-side.
- Hotel Wi-Fi = one public IP → rate limits are per player, IP limits generous.
- Offensive family names on a lobby screen → blocklist at registration + operator can
  hide a player from the board.

Privacy (minors)
- Nickname + emoji only. Phone only if the operator turns verification on (parent's).
- Locked collections (read + write `if false`), like `qbetEntries`.
- Auto-delete profiles after `retentionDays` of inactivity.

Operations
- "Setup mode": the operator walks the venue, scans each gnome in place → marks
  `verifiedOnSite` and proves there is reception at that spot.
- Silent gnome (no scans for days) → flagged as probably missing.
- Hard riddle (many wrong answers / hints) → flagged for rewriting.
- Leaderboard: this week + all time (hotel guests rotate).
- Video never blocks the game: muted autoplay, tap for sound, always skippable.

## 6. Phases

Wave 1 (parallel, one branch each off `feature/thecode`, disjoint files):
- A. Engine + tests — `src/lib/thecode/engine.ts`, `scripts/tests/thecode-*.test.mjs`.
- B. Player clickable demo — `src/app/play/the-code/page.tsx`,
  `src/components/thecode/player/**`, `src/components/thecode/GnomeFigure.tsx`.
- C. Admin clickable demo — `src/app/play/the-code/admin/page.tsx`,
  `src/components/thecode/admin/**`.
Demos run on sample data with NO server, for Rani's and the hotel's approval.

Wave 2 (parallel, one branch each off `feature/thecode`, disjoint files — see §8):
- S. Server: engine completion, store, API routes, Firestore rules, tests.
- P. Player: in-page scanner, `/g/{code}`, `/v` viewer, live game on the API, big-screen board.
- A. Operator: dashboard integration, live admin page, image drag-and-drop, real QR print.
Then the plan owner merges, integrates and tests end to end on `qrinfo-dev`.

Wave 3: presenter trigger layer, WhatsApp toggle, pilot on `qrinfo-dev`, release.

## 7. Working rules for every session

- Branch off `feature/thecode`; commit to your own branch; never push, merge, deploy or
  touch `main`. Stay inside your file list. Do not edit shared files
  (`src/types/thecode.ts`, `src/lib/thecode/letters.ts`) — report needed changes instead.
- All user-facing Hebrew is plural (סרקו / מצאו). Hebrew is RTL. Replies to Rani are
  in Hebrew only.
- No `require()`. `@/*` → `./src/*`. Follow `CLAUDE.md`.

## 8. Wave 2 architecture (decided 12.11.2026)

Wire contract: `src/types/thecode-api.ts` (types only; owned by the plan owner).

Storage — Firestore, Admin SDK only, every path locked (`read, write: if false`):
- `codes/{codeId}/thecode/adventure` — `{ version, config: TheCodeConfig, riddles:
  TheCodeRiddle[], updatedAt }`. ONE doc = one read per action. Ceiling ≈ 1,500
  riddles (1 MB); far above a venue's needs.
- `codes/{codeId}/thecode/stats` — counters written with `FieldValue.increment`
  (`gnomes.{id}.scans`, `gnomes.{id}.lastScanAt`, `riddles.{id}.correct|wrong|hints`).
  Blind writes — never read inside the play transaction.
- `codes/{codeId}/thecodePlayers/{playerId}` — `TheCodePlayer` + server fields:
  `tokenHashes: string[]` (sha256, max 5 devices), `week: { '2026-W46': { points,
  suitcases } }`, `originalName?`, `rate: { windowStart, count }`, `expireAt`
  (Firestore TTL = lastSeenAt + retentionDays; the TTL policy is a release step).
- `thecodeGnomeCodes/{code}` — `{ codeId, gnomeId }` for BOTH the QR slug and the
  manual code (two docs per gnome). Makes `/g/{code}` a single read and guarantees
  codes are globally unique. Created with create-if-absent; removed with the gnome.

Player API — one route, `POST /api/thecode/play` (`TheCodePlayRequest`):
1. origin check; resolve `scan` code → gnome (index doc, must belong to this codeId).
2. ONE transaction: read adventure + player → engine function → write player
   (+ blind stats increments). The response is always a full `TheCodeSnapshot` built
   on the server + an optional `TheCodePlayEvent` for the animation.
3. The snapshot never contains: answers, riddle letters, phrase text before the
   suitcase opens, riddles of gnomes not yet scanned, unfound gnomes' colours.
4. `serverNow` rides on every response; countdowns never trust the phone's clock.
5. Per-player rate limit lives in the player doc (no extra reads): 60 actions/min.
   Register / recover: Firestore-based per-IP limit, generous (hotel = one IP).
6. Leaderboards need no composite index: all-time = `orderBy('points','desc')`;
   weekly = `orderBy('week.<key>.points','desc')` (map sub-fields are auto-indexed,
   docs without the key drop out). Week key = venue zone, week starts Sunday.

Operator API — `/api/thecode/admin` (Bearer + `requireCodeOwner`):
- GET loads everything (`TheCodeAdminLoadResponse`); a never-saved adventure returns
  defaults with `version: 0`.
- PUT saves the whole adventure with optimistic locking (`baseVersion`); the server
  normalizes, re-derives riddle letters, maintains the gnome-code index and the public
  stub on the code doc, and refuses to publish while `validateAdventure` has errors.
- PATCH/DELETE `/players` — rename / hide / remove a family.
- The admin UI keeps its in-memory reducer (instant UI) and persists with a debounced
  PUT. A 409 means another tab saved → reload.

Routes
- `/g/{code}` (public, no locale; add `g/` to the middleware exclusion): resolves the
  gnome → renders the game client with a pending scan.
- `/v/{shortId}` → `TheCodeViewer`: the game home (resume, scanner, board).
- `/lobby/thecode/{shortId}`: big-screen leaderboard for the venue's TV.
- `/{locale}/thecode/{codeId}`: the operator's full-page admin (auth required).
- `/play/the-code` + `/play/the-code/admin` stay as demos on sample data.

More edge cases closed in wave 2
- Phrase edited or deleted mid-run → the run carries `phraseText`; arranging and
  opening use the snapshot, so a family is never stranded.
- A riddle may be answered only after its gnome was scanned as the target
  (`slot.scannedAt`) → no answering from the couch with forged requests.
- Refresh / new tab after a scan keeps the riddle on screen (`scannedAt` is saved).
- Collector order = `solvedAt`, never phrase order.
- Arrange tray order is derived from the run id (stable across refreshes); paid help
  positions are saved (`helpedPositions`).
- Wrong full arrangement: the server answers only yes/no (no per-position leak).
- Two tabs of the operator → optimistic locking. Two phones of one family → the
  transaction + idempotent actions (`replayed`).
- Adventure deleted / gnome removed → index doc gone → friendly "הגמד הזה כבר לא במשחק".
- A draft (unpublished) adventure behaves as paused for players.
- Family names: trimmed, ≤ 20 chars, control chars stripped, blocklist; emoji from the
  fixed list; a family appears on the board only once it has points.
- QR always encodes the PRODUCTION origin, even when printed from dev/preview.
- Camera permission denied / no camera → manual code entry stays available.
- In-app browsers (WhatsApp etc.): the existing gate (`src/lib/inAppBrowser.ts`).
- Default rule values = the approved demo's (100 per letter, 500 suitcase, hint 20,
  wrong scan 30, wrong answer 20, cooldown 12 s, arrange help 50).
- Left for wave 3: on-site setup scan by the operator's phone, English UI strings,
  presenter videos, WhatsApp verification, reception redemption.

## 9. Open items after wave 2 (12.11.2026)

Not verified yet: a real phone camera, a real paper print, the dashboard create flow and
the operator admin under a real login (the e2e drives the admin API with a test owner).

Why production and not a preview: Vercel preview deployments read `qrinfo-dev` on the
client but their Admin SDK points at PRODUCTION, so the game cannot work there and any
write would land in production data (verified 12.11.2026).

Before opening the feature to operators (each needs Rani's explicit OK):
1. Deploy `firestore.rules` to both projects (new locked paths, §8). Until then the paths
   are default-deny (no rule matches them) — safe, but not explicit.
2. Firestore TTL policy on collection group `thecodePlayers`, field `expireAt`.
3. Remove the super-admin gate on the uploader tab (`dashboard/page.tsx`,
   `onTheCodeCreate`) + a real changelog entry.
4. First paper print of the 36 × 42 mm gnome sticker: measure the QR (34 mm) and scan it
   seated in a DARK gnome — the white margin around the QR is only 1 mm.

Product follow-ups:
- Limit the colour palette per adventure to the filaments the operator really has
  (Rani prints with black, white, purple, blue, green, yellow — no red/orange).
- On-site setup scan from the operator's phone, English UI strings, presenter videos,
  WhatsApp verification, reception redemption (wave 3).
- Deleting a code does not yet remove its `thecode*` data and gnome-code index.
- Server notes for integrators: `docs/THE_CODE_SERVER_NOTES.md`.
