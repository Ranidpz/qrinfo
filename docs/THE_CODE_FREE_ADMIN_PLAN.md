# קוד הגמדים — operator admin for FREE mode (plan, 24.11.2026)

Status: PLAN — waiting for Rani's decisions (D1–D8 below). Nothing built yet.
Branch: `claude/thecode-free-admin-9ca5ea`.

Rani (24.11.2026): "the interface still has leftovers from the previous mode … adapt it to the
content of the new free-mode game" + "we already have gnomes ready and everything".

## Ground rules

- **Guided mode (absent `mode`) stays byte-for-byte.** Every change is gated on
  `config.mode === 'free'`. `engine.ts` is not edited. Existing tests + `scripts/thecode-e2e.mjs`
  must pass unedited.
- **Gnomes and their printed QR are kept.** Nothing in this plan creates, deletes or renumbers a
  gnome, or touches `code` / `manualCode`. Migration = the same gnomes, shown and checked the
  free-game way. Riddles are kept too (guided riddles are valid free riddles: same shape).
  Phrases are kept in the data (hidden), so switching back to guided loses nothing.
- Not touched: `src/components/thecode/free/*`, `LobbyStage.tsx`, the troll image (other session).
- No rules deploy needed (no new collection).

## Free game in one paragraph (what the admin must describe)

Any awake gnome may be scanned. It asks its CURRENT riddle; the group answers with the first
letter, `attemptsPerRiddle` tries (2nd right = ½). Then the gnome sleeps for that group for
`free.refreshMinutes` and next time asks its NEXT riddle (same order for every group, wraps to
the first). Location hints are bought with `hintCost` (today: the SPOT's hints). Points + hot
streak as before. No letters collection, no phrase, no suitcase, no wrong-scan penalty, no
cooldown, no timer. The phone's "how to play" is a fixed 4-line intro + Cliostro's clip.

## Audit — (a) still right · (b) guided-only → hide in free · (c) needs a free version

Seen in the in-memory admin (`/play/the-code/admin?mock=1`, switched to free) and in code.

### Tabs
- סקירה (c) · מקומות (a, wording c) · גמדים (c) · חידות (c) · **משפטים (b)** · הדפסה (a) ·
  מצב התקנה (a) · קבוצות (c) · הגדרות (c).
- Red error count on סקירה (c): today counts guided colour errors + free "no riddle" errors.

### Issues (report.ts / engine)
| code | free | why |
|---|---|---|
| PHRASE_* , NO_ACTIVE_PHRASE, guided FEW_FRESH_ROUNDS | b | already dropped in free (report.ts + store.ts) |
| DUPLICATE_COLORS_AT_SPOT (error, blocks publish on the SERVER too) | b | no colour hunt: scanning a look-alike just plays that gnome |
| CONFUSABLE_COLORS_AT_SPOT ("נראה כמו גמד 16", "נבדלים רק …") | b | same |
| GNOME_COLOR_UNAVAILABLE (outdoor filament) | a | physical printing, not gameplay |
| GNOME_WITHOUT_RIDDLE (free = error) | c | wording + severity → D3 |
| free FEW_FRESH_ROUNDS ("רק 2 חידות") | c | fix link goes to משפטים, button "לאותיות"; not folded (one line per gnome); threshold fixed 3 → D2 |
| SPOT_WITHOUT_HINT | c | free meaning: no location hint can be bought for the gnomes there |
| RIDDLE_AMBIGUOUS_LETTER | a | still answered by first letter (but shown in raw engine wording — free issues skip `reword`) |
| GNOME_NOT_VERIFIED, GNOME_SPOT_MISSING, GNOMES_CLUSTERED | a | |
| Field alerts: gnome missing, riddle too hard | a | stats are recorded in free mode too |

### סקירה
- Status card pause text "קבוצות שבאמצע מזוודה" (c); "קבוצות ימשיכו לשחק רק במשפטים התקינים" (c).
- Readiness subtitle "בודקת שכל משפט סודי אפשר להשלים" (c). Bank-fill button tied to PHRASE errors (c → free fill).
- Stats "מזוודות חדשות לקבוצה" + "משפטים מוכנים" (b) → free stats (c).
- Getting-started step "משפטים סודיים" (b); step "חידות: חידה לכל גמד" (c).

### גמדים
- Colour badges "זהה לגמד N" / "נראה כמו גמד N" + spot colour banner (b). They also feed "דורשים טיפול".
- "בלי חידה" badge + tip "קבוצות לא יישלחו אליו" (c).
- Delete text "קבוצות שנשלחו אליו יקבלו את האות מגמד אחר" (c). Active toggle text "יקבלו את האות ממקום אחר" (c).
- Editor riddle count "חידה אחת / N חידות" (c: vs the free target, + order note).
- Location hints per gnome (new, D4).
- Production dialog colour suggestions (a — keeps the phone board readable; never blocks in free).

### חידות
- Header "האות הראשונה של התשובה נכנסת לאוסף" (c). Target "כדאי 2 עד 5" (c → D2).
- Gnome list "אותיות: א, ב" (b). Letter finder "מחפשים חידה לאות" (b).
- **Order matters** in free mode (every group gets riddle 1, then 2…) — no way to reorder today (c, new).
- Riddle card: "רמזים לפתרון" + "רמת קושי" are unused by the free game (b, D5). Answer hint "רק האות הראשונה שלה נאספת" (c).
- Delete text "קבוצות שבאמצע מזוודה…" (c).
- Bank picker "חסרה במשפטים" flags (b). One-click fill `planBankFill` = phrase letters from different gnomes (b → free fill, D6).

### קבוצות
- Suitcases column + delete text "המזוודות" (c → riddles solved; needs `solved` on the admin player).

### הגדרות
- Mode switch: free text only "החליפו רק יחד עם סבב חדש" (c: confirm that offers the new round, D7).
- ניקוד: "נקודות לכל אות" (c → per riddle); "בונוס פתיחת מזוודה" (b); רצף חם (a);
  "מחיר רמז: הרמז הראשון חינם … ושובר את הרצף" (c: every location hint costs, never breaks the streak).
- טעויות section (free wrong scans, scan penalty, free wrong answers, penalty, cooldown) (b) — the
  free attempts already live in the FreeModeCard. "אותיות שנאספו לא נלקחות" (b).
- `wrapRiddles` exists in the engine but has no switch (c, D8).
- "איך משחקים" card — the free phone never shows it (fixed intro) (b, with a one-line note).
- Branding placeholder "מצאו את הגמדים ופתחו את המזוודה" (c). Language row "לוח האותיות" (a).
- Selfie, big screen, staff, activity hours, privacy, new round (a).

## Plan

### P1 — one switch for every screen
`isFree(config)` helper + `TABS` filtered (no משפטים in free). A `target.tab === 'phrases'` in free
falls back to סקירה. Notice/fix links never point at a hidden tab.

### P2 — report + issues (`adminLive/report.ts`, `admin/nav.ts`)
- Free: drop DUPLICATE/CONFUSABLE colour issues; reword every remaining issue in operator Hebrew
  (free wording for GNOME_WITHOUT_RIDDLE, FEW_FRESH_ROUNDS, SPOT_WITHOUT_HINT).
- Free FEW_FRESH_ROUNDS → `{tab:'riddles', gnomeId}`, label "הוסיפו חידות"; folded into one line
  ("לגמדים 3, 5, 7 יש פחות מ־3 חידות").
- `AdventureReport.free` = `{ gnomesReady, gnomesNoRiddle, minRiddles, repeatAfterMinutes }`
  for the overview.
- Server `saveAdventure` (`store.ts`, no new import): in free mode also ignore the two colour codes
  so a look-alike pair never blocks publishing.

### P3 — סקירה
Free status/pause texts; readiness subtitle "בודקת שלכל גמד יש חידות ושאפשר למצוא אותו";
stats: "גמדים מוכנים X/Y" · "חידות במשחק" · "חידה חוזרת אחרי" (e.g. "3 שעות") · "גמד מתעורר כל";
steps: מקומות → גמדים → חידות (N לכל גמד) → הגדרות משחק חופשי → פרסום; free bank-fill button.

### P4 — גמדים
Hide colour badges/banners/attention criterion; free texts for "בלי חידה", delete, toggle;
riddle count vs target; per-gnome location hints field (D4).

### P5 — חידות
Free header + target line ("3 חידות = חידה חוזרת אחרי 3 שעות"); numbered riddles with ↑/↓ (new
action `moveRiddle`, reorders the riddles array — the order the engine already uses); a note that
moving/deleting mid-season can make a group skip or repeat one riddle (adding at the end is safe);
hide letters chips, letter finder, "חסרה במשפטים", solving hints + difficulty (D5); free delete text;
free one-click fill (P6).

### P6 — bank fill for free (`riddleBank.ts`, new `planFreeBankFill`)
Every active gnome on an active spot is topped up to the target count (D2). Answers unique in the
adventure (as today), place-matched, easiest first, and consecutive riddles of one gnome start with
different letters. Existing riddles untouched. Same preview dialog → add as published. Tests.

### P7 — קבוצות
Admin player gains optional `solved` (riddles solved; free state `solved` / `solvedRiddleIds`);
column "חידות" instead of suitcases in free; free delete text. Server: one field in the admin load.

### P8 — הגדרות
Free: points label per riddle; hide suitcase bonus + the whole טעויות section; hint price text;
`wrapRiddles` switch (D8); hide "איך משחקים" with a note; free welcome placeholder; mode switch
confirm (D7).

### P9 — location hints per gnome (D4, recommended)
`TheCodeGnome.hints?: string[]` (0–3, optional = today). Free engine: a gnome's location hints =
its spot's hints, then its own (general → exact). Server normalize keeps the field (trim, ≤3,
≤160 chars). Never on the public stub; the phone still gets a hint only after buying it.
Guided game ignores the field. Tests in `thecode-engine-free`.

### Tests
- New `scripts/tests/thecode-free-admin.test.mjs`: report in free (no colour issues, wording, fold,
  targets), `planFreeBankFill`, guided report unchanged for the same fixture.
- `thecode-engine-free`: hint chain spot → gnome.
- All `node --test scripts/tests/thecode-*.test.mjs` + both e2e (`thecode-e2e.mjs`,
  `thecode-free-e2e.mjs`) on a local server against `qrinfo-dev`. Visual pass on the mock admin.

## Decisions for Rani
- D1 Hide the משפטים tab in free mode (data kept). Recommended: yes.
- D2 Riddles per gnome: minimum 3 (warning below), and the screen shows when a group meets a
  repeat ("חידה חוזרת אחרי 3 שעות"). Rule of thumb: wake every hour → 5+; every day → 3 for a
  3-night stay. Recommended: minimum 3, fill target 5.
- D3 A gnome with no riddle: today it BLOCKS publishing. Recommended: a warning only (the phone shows
  it as "סיים"); blocks only when no gnome has a riddle.
- D4 Location hints on the gnome card (after the spot's hints). Recommended: yes.
- D5 Hide "רמזים לפתרון" and "רמת קושי" on a riddle in free mode (kept in the data). Recommended: yes.
- D6 Free one-click fill from the bank. Recommended: yes.
- D7 Switching the mode asks first and offers "סבב חדש" when groups already played. Recommended: yes.
- D8 Switch "אחרי החידה האחרונה: מתחילים מההתחלה / הגמד נשאר ישן". Recommended: yes (default = start over).
