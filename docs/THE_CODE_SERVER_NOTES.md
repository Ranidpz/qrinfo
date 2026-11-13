# הקוד — server hand-over (wave 2, session S)

Branch `claude/thecode-server-96eb2c`. Contract: `src/types/thecode-api.ts` (implemented as is,
no changes). Architecture: `docs/THE_CODE_PLAN.md` §8.

Files: `src/lib/thecode/engine.ts`, `src/lib/thecode/server/*` (pure), `src/lib/thecode/store.ts`
(the only Firestore module), `src/app/api/thecode/**`, `firestore.rules`,
`scripts/tests/thecode-{engine,letters,server,store}.test.mjs` (57 tests:
`node --test scripts/tests/thecode-*.test.mjs`).

**Not exercised against a real Firestore.** The store runs in tests on an in-memory fake of the
Admin API (flows, tokens, codes, locking, weekly points, stats). Real indexes, contention, TTL
and the rules themselves are untested — do that on `qrinfo-dev` during integration.

## POST /api/thecode/play

Body `TheCodePlayRequest`. Always JSON, always `Cache-Control: no-store`.
Success: `{ ok: true, serverNow, snapshot, event?, auth? }` — the snapshot is the truth; the
event only drives the one-off animation. Failure: `{ ok: false, error, retryAfterSeconds? }`.

| error | HTTP | when | client should |
|---|---|---|---|
| `badRequest` | 400 / 403 | bad JSON, bad codeId, unknown action, bad slotIndex/letter/arrangement, bad emoji, foreign Origin (403) | treat as a bug |
| `notFound` | 404 | no saved adventure for this codeId | "not found" screen |
| `unauthorized` | 401 | unknown player, bad token, player deleted, oldest of >5 devices | DROP the stored profile → register |
| `needRegister` | 401 | non-`state` action without `auth` | register screen |
| `invalidName` | 400 | register name empty / >20 / blocked word / no letter or digit | inline error on the name field |
| `recoveryNotFound` | 404 | recover code wrong / malformed | inline error |
| `rateLimited` | 429 | >60 actions/min per player; register >40 / recover >30 per IP per 10 min; >900/min per IP overall | wait `retryAfterSeconds`, then retry |
| `server` | 500 | anything else (logged server-side) | retry button |

Actions:
- `state` — works without `auth` (`snapshot.player === null`, `run === null`). With auth it also
  runs the repair (a disabled gnome mid-run is swapped/gifted and SAVED). Counts toward the
  60/min — refetch on focus / after an action, not on a timer.
- `register {familyName, emoji}` — returns `auth: {playerId, token}` ONCE (store it per
  adventure in localStorage). Name is cleaned (trim, collapse spaces, control/HTML chars
  stripped); emoji must be exactly one emoji grapheme. Registering does NOT scan: the `/g/{code}`
  flow sends `scan` right after `register`.
- `recover {recoveryCode}` — case-insensitive, dashes/spaces ignored. Returns a NEW token for this
  device (other devices keep working; max 5 tokens, oldest dropped).
- `scan {code}` — QR slug (case-sensitive, 12 chars) or manual code (6 chars, any case), or even a
  pasted `…/g/{slug}` URL. Event `{type:'scan', outcome, gnome?}`; `gnome` = the scanned gnome
  (absent for `unknownGnome`). Outcomes: `riddle` (riddle now in `snapshot.run.target.riddle`),
  `runStarted` (new suitcase, the scanned gnome is not in it → show the target), `wrongGnome
  {penalty, freeLeft}`, `alreadySolved`, `gnomeAsleep`, `arranging`, `allDone`, `paused`,
  `unknownGnome` (code not in THIS adventure, deleted gnome, foreign code). Re-scanning the
  target is idempotent.
- `answer {slotIndex, letter}` — `slotIndex` = `snapshot.run.target.slotIndex` at the time the
  riddle was shown. Outcomes: `correct {letter, points, hot, becameHot, spellingTip?, runState}`
  (a retry of a solved slot returns the same `correct` with nothing awarded), `wrong {penalty,
  cooldownUntil?, hintAvailable}`, `cooldown {cooldownUntil}`, `noRiddle` (not the target, or its
  gnome was NOT scanned yet), `paused`. Countdowns: `cooldownUntil - serverNow`.
- `hint {hintKind}` — event `{given, cost}`. First riddle hint free; the zone location hint
  comes free with every target, each further hint costs `min(points, hintCost)`. Hints reset
  the streak. Revealed hints are in the snapshot (`locationHints`, `riddle.hints`), the next
  cost in `nextLocationHintCost` / `riddle.nextHintCost` (`null` = no more).
- `arrangeHelp` — fixes the FIRST not-yet-fixed phrase position (left to right in letter order),
  cost `min(points, arrangeHelpCost)`. Event `{given, cost, position, letter}`; the truth is
  `snapshot.run.arrange.fixed`. `given:false` when not arranging / all fixed / paused.
- `open {arrangement}` — one letter per phrase position (final forms / niqqud ignored). Event
  `{opened, bonus}`. A wrong order answers only `opened:false` — no per-position feedback.
  Re-sending after opening is `opened:true, bonus:0`.
- `newSuitcase` — only when there is no run or it is opened. Event `{started}`; `false` = a run
  is still in progress, nothing fresh left (`snapshot.canStartNew === false`), or paused.

Snapshot notes (`src/lib/thecode/server/snapshot.ts`, leak-tested):
- `run.collected` is in the order letters were won (`solvedAt`), gifted letters included.
- `run.target.riddle` is `null` until the target gnome was scanned (survives refresh).
- `run.arrange.pool` is stable per run (derived from the run id) and never the solved order
  when another order exists. `wordLengths` gives the board shape; `fixed[i]` = paid help.
- `run.suitcase.phraseText` appears only once opened; `bonus` = the CURRENT rule value.
- `album.found` = found gnomes only (colours); `album.total` = active gnomes.
- `canStartNew` = a fresh suitcase exists AFTER the current run (the current phrase and its
  riddles count as used).
- `adventure.open === false` for draft, paused, or outside `activeHours` (Asia/Jerusalem).
- `player.hot` = the next correct answer is multiplied (`streak >= hotStreakAt`).

## GET /api/thecode/gnome?code=…

`TheCodeGnomeLookupResponse`; 200 or 404 `{ok:false, error:'notFound'}` (unknown code, gnome
removed, adventure never saved). Accepts slug or manual code (any case). Works for draft /
paused adventures too (the play call then says `paused`). Per-IP 120/min.

## GET /api/thecode/leaderboard?codeId=…&scope=week|all&playerId=…

`TheCodeLeaderboardResponse`, `s-maxage=5`. Default scope `week`. Top 20, hidden and zero-point
families skipped. `me` only when `playerId` is outside the rows and has points. `me.rank` counts
families with more points (hidden ones included — approximation). 404 `{ok:false,
error:'notFound'}` when the code doc or its `thecode` media item is missing. `title` comes from
the public stub. No "previous rank" yet (the player demo's rank animation needs it — not in the
contract).

## /api/thecode/admin (Bearer + `requireCodeOwner`, i.e. owner or super admin)

- `GET ?codeId=` → `TheCodeAdminLoadResponse`. Never saved → `version: 0` + defaults
  (`status: 'draft'`, approved demo rules, title from the stub or "הקוד"). Players = latest 500
  by `lastSeenAt`; `weekPoints` = current Sunday-week.
- `PUT` body `TheCodeAdminSaveRequest`. Statuses: 200 ok, 409 `conflict {version}` (reload),
  422 `invalid {issues}` (publish blocked, NOTHING saved — save again as draft to keep the
  edits), 400 `badRequest` (bad baseVersion, >60 spots / >200 gnomes / >40 phrases / >1500
  riddles, bad or duplicate ids `[A-Za-z0-9_-]{1,64}`, unknown colour), 500.
  - The response `config`/`riddles` are the NORMALIZED ones — replace local state with them
    (new gnomes get their `code` + `manualCode` only here).
  - Gnome `code` / `manualCode` from the client are ignored. Existing gnome (same id) keeps its
    stored codes; a new gnome gets a 12-char base62 slug + 6-char manual code from
    `crypto.randomBytes`, both indexed in `thecodeGnomeCodes`. Deleting a gnome deletes both
    index docs — its printed QR stops working ("unknownGnome"). Changing a gnome's id = delete +
    new codes, so the admin must never re-id a gnome.
  - Riddles of a gnome that is not in `config.gnomes` are DROPPED. `letter` is always
    re-derived from `answerWord`. Strings are trimmed/capped (title 80, spot name 80, hints 3×200,
    riddle text 500, answer 40, phrase 60); `photoUrl`/`imageUrl`/videos must be `https://`.
    Rules are clamped (freeWrongScans 1–3, cooldown ≤ 600 s, multiplier 1–10…); invalid
    `activeHours` are removed.
  - The public stub `media[i].thecodeConfig = {title,status,language}` is updated ONLY if the code
    doc already has a media item with `type: 'thecode'` — session A's create flow must add it.
  - `issues` (warnings + errors) come back on every successful save.
- `PATCH /api/thecode/admin/players` `{codeId, playerId, patch:{familyName?, hidden?}}` →
  `{ok:true, player: TheCodeAdminPlayer}` | 400 `invalidName` / `badRequest` | 404 `notFound`.
  The first rename stores `originalName`.
- `DELETE /api/thecode/admin/players` body `{codeId, playerId}` → `{ok:true}`. The family's phones
  get `unauthorized` next time.

## Engine changes for anyone calling it directly

- `DEFAULT_THECODE_RULES` = approved demo values (100 / 500 / 3 / ×2 / hint 20 / 1 free scan /
  30 / 2 free answers / 20 / 12 s / help 50).
- New: `arrangeHelp`, `arrangePool`, `startNewRun`, `hasFreshSuitcase`, `runPhraseText`,
  `hashSeed`. `scanGnome(player, gnomeId, ctx, {runId?})`.
- `TheCodeEngineScanOutcome` / `TheCodeEngineAnswerOutcome` are now plain aliases of the contract
  types. Unknown gnome ids → `unknownGnome` (was `gnomeAsleep`).
- Validation: `GNOMES_CLUSTERED` warning (≥ 3 active gnomes and ≥ 80 % at one spot);
  `PHRASE_LETTER_MISSING.dormantRiddleIds` = draft/disabled riddles or riddles on a switched-off
  gnome/spot that would give the letter.

## Release / integration checklist (plan owner)

1. Deploy `firestore.rules` to BOTH projects (with Rani's OK) — new locked paths:
   `codes/{id}/thecode/{doc}`, `codes/{id}/thecodePlayers/{id}`, `/thecodeGnomeCodes/{code}`.
2. Firestore TTL policy on collection group `thecodePlayers`, field `expireAt` (both projects).
3. `npm run security:check` currently FAILS on the contract file: `TheCodeAuth.token` in
   `src/types/thecode-api.ts` is flagged as a secret-like field. It is the device token returned
   once to the client (only its sha256 is stored) → add
   `src/types/thecode-api.ts#token` to `secretFields` in `scripts/security-allowlist.json` with
   that reason (plan-owner files, not edited here).
4. Watch the stats doc: every scan/answer/hint writes `codes/{id}/thecode/stats` — Firestore's
   ~1 sustained write/s per doc is fine for one hotel; shard it if a venue gets busier.
5. Middleware: add `g/` to the i18n exclusion (session P).

---

# Wave 3 — big screen live + group selfies (server, 13.11.2026)

New files: `src/lib/thecode/server/{lobby,presign,photo}.ts` (pure),
`src/app/api/thecode/{lobby-scan,photo,admin/photo,admin/lobby-video-url}/route.ts`,
`src/app/api/cron/thecode-selfies/route.ts`, tests `scripts/tests/thecode-wave3.test.mjs` + wave-3
cases in `thecode-store.test.mjs` (82 tests in all). `scripts/thecode-e2e.mjs` extended (NOT run
here — the worktree has no `.env.local`).

## Public live doc `codes/{codeId}/thecodeLobby/live` (TheCodeLobbyLive)
- Rules: `read: if true; write: if false` — NOT deployed.
- `events` (newest last, ≤ 20): `joined` on register, `hot` when an answer makes the group hot
  (`becameHot`, not on replays), `suitcase` on a real open (not on replays). Written in a small
  transaction right AFTER the play transaction, awaited; a failure is logged and never fails the
  player's action. Event `id` = `{playerId}_{rand}` (player ids are already public on the board) —
  that is how a group's banners are found again.
- Hidden groups: no new events; hiding a group (PATCH hidden:true) and deleting it remove its
  existing banners. Removing / replacing / expiring a selfie strips that photo URL from banners.
- `photoUrl` on an event only when selfies are on and the photo has not expired at that moment.
- `lobbyScans` / `lastLobbyScanAt`: `POST /api/thecode/lobby-scan {codeId}` (same-origin, 6/min per
  IP per code, 120/min per code; 404 when the code has no `thecode` media item → no junk docs).
- `videos`: replaced (not merged) from `config.lobby.videos` on EVERY admin save, so clearing a slot
  clears it live. The doc is created by the first admin save (or first scan/event).

## Selfies
- `POST /api/thecode/photo` multipart `codeId, playerId, token, file`. Checked by BYTES (webp
  `RIFF…WEBP` or jpeg `FF D8 FF`), ≤ 400 KB. Errors (JSON `{ok:false,error}`): 400 badRequest/empty,
  401 unauthorized, 404 notFound, 409 **selfieOff** (not in TheCodePlayError — the UI should handle
  it), 413 tooLarge, 415 badType, 429 rateLimited (60/min per IP, 10 per 10 min per group),
  503 notConfigured (no R2). Success `{ok:true, photoUrl}`.
- Key `{ownerId}/thecode-{shortId}/selfies/{playerId}-{rand}.webp|.jpg` (extension follows the real
  type). Upload first, then one transaction swaps `player.photo = {url,key,takenAt}`; the previous
  object is deleted afterwards.
- `DELETE /api/thecode/photo` JSON `{codeId, auth:{playerId,token}}` → `{ok:true, photoUrl:null}`
  (allowed even with selfies off). `DELETE /api/thecode/admin/photo {codeId, playerId}` (owner).
- `photoUrl` appears in `snapshot.player` and leaderboard rows only while selfies are on AND the
  photo is younger than `retentionDays` — expired photos disappear before the sweep runs.
- `config.selfie` is always saved RESOLVED (`resolveSelfie`: on/off + 1–90 days, default 14).
- Index `thecodeSelfies/{sha(key)}` (locked) = one doc per R2 object. Removals mark it
  `takenAt: 0, removed: true` and delete it once R2 confirmed the delete.
- Cron `GET /api/cron/thecode-selfies` daily 03:00 UTC (vercel.json), `Authorization: Bearer
  CRON_SECRET` (fails closed). Per due index doc: R2 delete FIRST (a failure keeps the doc → retried
  next day), then clears `photo` if it is still that key, strips banners, deletes the index doc.
  ≤ 400 per run.
- `TheCodeAdminPlayer.photoUrl` (admin GET + the PATCH reply): only an unexpired photo.
- NOT done: the selfie bytes do not count toward the owner's `storageUsed`.

## updateProfile (play action)
`{ type: 'updateProfile', familyName?, emoji? }` — at least one field (else `badRequest`); name rules =
register (`invalidName`), emoji rules = register (`badRequest`); counts toward the 60/min; no event
and no lobby banner; an operator rename's `originalName` is kept. Answer = the usual snapshot.

## Big-screen videos
- `POST /api/thecode/admin/lobby-video-url` `{codeId, slot, contentType, size}` (owner) →
  `{ok:true, uploadUrl, publicUrl}`; 400 badRequest, 413 tooLarge (> 100 MB), 503 notConfigured.
- The URL is a SigV4 presigned PUT (own signer in `server/presign.ts`, verified against the AWS
  reference vector — no new npm dependency) that SIGNS `content-type` and `content-length`: the
  browser must PUT with exactly that `Content-Type`, and the file must be exactly `size` bytes.
  Valid 10 minutes. Key `{ownerId}/thecode-{shortId}/lobby/{slot}-{time}-{rand}.mp4|webm`.
  R2 bucket CORS must allow PUT from the app origin. NOT verified: our R2 token is object-scoped and
  cannot read bucket CORS; per earlier notes the bucket (`theq-media-prod`) allows only GET/HEAD
  today, and the Q.Treasure presigned upload that would need PUT is still unreleased. Needed rule
  (Cloudflare dashboard → R2 → bucket → CORS): AllowedOrigins `https://qr.playzones.app`,
  `http://localhost:3000` (+ the local dev ports in use); AllowedMethods `PUT` (keep GET, HEAD);
  AllowedHeaders `content-type`; MaxAgeSeconds 3600.
- Save keeps only `https` URLs on our R2 public base ending in .mp4/.webm, slots idle/explain/after.

## next.config.ts
`/lobby/:path*` gets the same `frame-ancestors` CSP as `/v/:path*`; `X-Frame-Options: SAMEORIGIN`
now applies to everything except `/v/` and `/lobby/`.

## Release checklist additions
1. Rules deploy (both projects, Rani's OK): `codes/{id}/thecodeLobby/{doc}` (public read) and
   `/thecodeSelfies/{id}` (locked).
2. `CRON_SECRET` must exist in Vercel (already used by `/api/cron/qgames-reset`).
3. Run `node scripts/thecode-e2e.mjs --cleanup` against a LOCAL server on `qrinfo-dev` (never a
   Vercel preview).
