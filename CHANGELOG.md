# Changelog

## [1.26.9] - 2026-10-11

- Buzzer product shot (`public/experiences/10-bool/buzzer-product.webp`) in the 10 Bool buzzer band (edges radial-masked into the navy band) and as a thumbnail on the buzzer card on the home page (`CatalogEntry.thumb`). Copy now matches the real buzzer: metal, heavy stable base, green or blue button that does not light up. The glowing render (`buzzer-glow.webp`) is decoration only: a dim backdrop (`final.backdrop`) behind the closing CTA, fixed/parallax on desktop.

## [1.26.8] - 2026-10-11

- Buzzer band (`addon.games` + `addon.idea` in the landing template): the games that work with the buzzer – 10 Bool (#demo), the raffle (home page card) and Frogger as "coming soon" – and a "got an idea for a buzzer game? talk to us" WhatsApp link. The buzzer card in the catalogue says the same.

## [1.26.7] - 2026-10-11

- Experience landing template redesigned from Rani's mockup (`ExperienceLanding.tsx` + `types.ts`): full-photo hero (text on the photo's dark right side via physical `lg:ml-auto`; photo on top on phones) with a stats strip, live demo, three steps, "ways to play" cards (photo / CSS phone) + scoreboard chips, pricing, a dark rental band (`addon`) with a photo, 5-question FAQ, dark closing CTA + social links. Copy cut to a line or two per block. Dark header with in-page nav + "create a game". Photos in `public/experiences/10-bool/` (AI-made illustrations - not shown as "real event" photos); the buzzer band crops the hero photo until a product shot exists.

## [1.26.6] - 2026-10-10

- Add a default-disabled, scoped Fattal cloud API with reviewed manifest binding, durable replacement receipts and read-only recovery. Notifications and cleanup remain unavailable. Legacy PDF replacement checks pending cloud claims.
- Replace the old installation walkthrough with a super-admin dot status and receipt view. Preserve legacy computer/connection controls and audit records; no credential provisioning, schedules or live uploads are enabled.

## [1.26.5] - 2026-10-10

- Playzone social profiles in one place, `SOCIAL` in `src/lib/landing/site.ts` (Facebook + YouTube; Instagram is an empty slot, rendered once it gets a url), shown by `components/landing/SocialLinks.tsx` in the home page footer, the experience-page footer, a "see it at a real event" strip in the experiences section and the experience pages' final section. Home page JSON-LD adds the `Organization` with `sameAs`. Footer "צור קשר" → "צרו קשר".

## [1.26.4] - 2026-10-10

- One list of every experience: the home page's "חוויות שאפשר ליצור" (`Features.tsx`, from `src/lib/experiences/catalog.ts`) gained everything the separate hub had – WhatsApp CTA per experience, demo + external links, add-on chips that jump to the buzzer card, card anchors (`/marketing#raffle`). `/[locale]/experiences` 301s to `/[locale]/marketing#features`; sidebar, landing header/breadcrumbs follow. Home page gets per-language title/description + an `ItemList` JSON-LD of all experiences.

## [1.26.3] - 2026-10-10

- 10 בול footer reads "10 בול · Powered by Playzone" (keyword anchor text) and links to the landing page with `?ref=game`; the WhatsApp share's landing link carries `?ref=share`. The landing page's canonical drops the query.
- `X-Robots-Tag: noindex, follow` (next.config `headers()`) on customer experience pages: `/v/`, `/gallery/`, `/lobby/`, `/packs/`, `/raffle/`, `/:locale/p/`. They stay out of search results, while their links are still followed.

## [1.25.6] - 2026-10-08

- Share text: "הצלחתי {N בולים מתוך M ניסיונות | N בולים עם K פסילות למתמודד}!!! נסו אתם {url}". The card's summary line uses "מתוך" too.

## [1.25.5] - 2026-10-08

- Small improvements.

## [1.25.4] - 2026-10-08

- `tenboolConfig.confetti` (absent = on): a 110-piece colourful burst (reuses `RaffleConfetti`) on every hit, on top of the win strobe, keyed per round.
- Install icon: `/api/og/tenbool?icon=<px>` renders the stopwatch as a square app icon. Used as the iPhone `apple-touch-icon` (180) on 10 בול pages and as all four manifest icons (192/512, any + maskable) in `/v/{shortId}/manifest.json` when the code's first media is `tenbool`.

## [1.25.3] - 2026-10-08

- Small improvements.

## [1.25.2] - 2026-10-08

- Small improvements.

## [1.25.1] - 2026-10-08

- Phones: the centre column (`stageRef`: logo, title, timer, hint, bar, share) follows the finger while swiping; past max(60px, 20% width) it slides off and the next mode slides in from the other side, else it snaps back. Corners stay put. Taps are ignored while it slides.
- Share card is now a 1080×1920 "screenshot" of the result screen: background (+ image if its host allows CORS), corners, logo, title, last time + hint, a small summary line and "Powered by Playzone". The last result is kept across the reset to idle.

## [1.25.0] - 2026-10-08

- Space now plays like Enter (buzzers map to either).
- Phones (`pointer: coarse`), from the 2nd hit, between rounds: a "שתפו בוואטסאפ" button. A 1080px PNG score card (title, 10.00, gold coins, "N בולים ב-M ניסיונות" or "…עם N פסילות למתמודד") is drawn on canvas whenever the score changes, because iOS only allows `navigator.share` straight inside the tap. Shared with `navigator.share({ files, text })`; falls back to `wa.me` text.
- `/api/og/tenbool`: link preview (stopwatch on 10.00 + gold coins, no Hebrew — Satori reverses RTL), bold digits from a Rubik 800 subset fetched at render time.
- Phones, regular board: the swipe tip shows again once after the first round's strobe.

## [1.24.4] - 2026-10-08

- Win dots are gold coins in every board mode (radial orange-gold, soft glow, a shine sweeping across every ~3.6s, staggered per dot via `--i`). Same size as a life. Green is now only ever a life. Shine is off under reduced motion.

## [1.24.3] - 2026-10-08

- `TenBoolViewer` toast (Assistant bold, top centre, fades out): on entry for 3s a swipe tip — "דפדפו בין המשחקים בחצים…" on desktop, "משכו את המסך…" when `(pointer: coarse)`; on each mode switch for 2.5s the mode name ("N פסילות למתמודד", "כמה פעמים עד 10 בול?", "משחק רגיל").
- A lost life now just bounces out (scale up, then to 0). The red `-1` and the drop are gone.

## [1.24.2] - 2026-10-08

- Lives never disappeared: the lost dot had both `.tenbool-life-in` and `.tenbool-fall`, and the later-declared `-in` animation overrode the fall. A lost life now uses only `.tenbool-life-lost` (flashes red, swells, drops) plus a red `-1` that falls from it.
- Counter `+1`: full size, 1.3s, shadowed. Under `prefers-reduced-motion` (common on iPhones) the `+1`, `-1` and lost life now fade instead of being hidden.

## [1.24.1] - 2026-10-08

- PWA install banner restored on 10 בול. `PWAInstallBanner` publishes its height as `--pwa-banner-h` on `<html>` (ResizeObserver, removed when it closes); `TenBoolViewer` sets `top: var(--pwa-banner-h, 0px)` so the scoreboard sits below the banner instead of under it.

## [1.24.0] - 2026-10-08

- `tenboolConfig.board`: `wins` (default, the green dots), `counter` (top-left misses-since-last-hit number with a floating +1; after a hit it spins down to 0 once the strobe ends), `lives` (N rings top-left, a miss drops one, a hit adds a gold dot top-right; a hit or running out ends the turn and the row rebuilds itself + returns to idle with presses ignored meanwhile), `off`. `lives` 1-9, default 3.
- `closenessBar`: a line under the timer; each stop lands a dot at ±1.00s scale (clamped), green on 10.00.
- Swipe left/right (touch) or ←/→ (keyboard) between rounds cycles wins → counter → lives on that screen only (not saved). In idle a touch now starts the round on release so a swipe can't start one; a running round still stops on pointerdown. Root uses `touch-action: none`.
- The PWA install banner is no longer shown on 10 בול (it covered the scoreboard corners).

## [1.23.0] - 2026-10-08

- `tenboolConfig` gains `logoUrl` + `logoSize` (% of screen height), `warningCues`, `winFlash`, `loseFlash`, `loseColor`. All optional and read through `tenboolEffects()`; absent = the original behaviour.
- Logo: drop an image anywhere on the settings window (or the upload button); uploaded as-is so PNG transparency is kept; size slider 8-50%.
- `warningCues: false` silences the 7/8/9/10 beeps and skips the red digits and red flash. The miss strobe colour comes from `--tb-lose`.

## [1.22.3] - 2026-10-08

- `tenbool`: the game and the settings preview show `code.title` (the name edited at the top of the code page) instead of `media.title`, which is only set at creation — renaming had no effect on the game.

## [1.22.2] - 2026-10-08

- `TenBoolViewer`: a green dot per exact 10.00, filling right to left at the top of the screen. The new dot waits out the 3.45s win strobe, then bounces in. In memory only — a refresh clears the board.
- Root is now `fixed inset-0` instead of `h-screen`: on iPhone Safari `100vh` runs under the bottom toolbar, which hid "Powered by Playzone".
- New sound slot `ten` (the beep on 10.00), default = the beep at 1.6x as before. The library drops `win` / `spin` (byte-identical to success / start; saved choices still resolve) and names the two buzzers by length.

## [1.22.1] - 2026-10-06

- Q.Treasure security (phase 0 of the overhaul): player + scan writes go through the Admin SDK via `src/lib/qtreasure/store.ts`; `register`/`start`/`scan` add rate limiting + origin checks; `phase` is owner-only (was unauthenticated); `resolve-station` uses indexed `shortId` lookups instead of scanning all codes. `firestore.rules`: `qtreasure_players` / `qtreasure_scans` create+update → `if false` (deployed with this release, both projects).
- Station order now resolves through `src/lib/qtreasure/route.ts` (per-player route support; `routeMode` absent = `fixed` = the old order). Players mid-game from the old code continue from `currentStationIndex`.
- Fonts: treasure screens referenced Cinzel / Crimson Text, which were never loaded (fell back to Georgia). Now Assistant + Geist Mono for digits.
- Not included: the Cliostro video tab and per-player route editor UI (still in progress).

## [1.22.0] - 2026-10-06

- `tenbool` settings (`TenBoolModal`, opened from the thumbnail or the pencil on the code page). Stored as `media.tenboolConfig`; every field optional, so codes without it play exactly as before. Types, sound library and resolvers in `src/types/tenbool.ts`.
- Sounds: each slot (start / beep / success / fail) picks any system sound (the four 10 בול sounds + the raffle buzzer, win and spin), an uploaded file, or silence. Uploads go to R2 through `/api/raffle/upload` with `feature=tenbool` (route now files them under `{uid}/{codeId}/tenbool/`; raffle uploads unchanged).
- Look: six Hebrew Google Fonts (loaded on page load, so play stays offline-safe), background colour, text colour, background image. Live preview at the top of the modal.
- `tenboolConfig` added to the `updateQRCode` media whitelist and to code duplication.

## [1.21.3] - 2026-10-06

- `TenBoolViewer`: removed the timer shake on a miss; only the red background strobe remains.

## [1.21.2] - 2026-10-06

- `TenBoolViewer`: a press stops any sound still playing (the 5.7s start sound used to run on under the result sound). Playing sources are tracked and cut on stop, reset and restart.
- Result strobes are hard cuts timed to the sounds: lose = 12 red/black flashes over the 1.2s fail sound + timer shake; win = 10 green/yellow/blue cycles over the 3.45s success sound + timer pop + bouncing "בול!". A red flash on every warning beep (7-10s). Reduced-motion users get a single solid colour.
- Idle prompt is now "תנו בבאזר או געו במסך כדי להתחיל" (the big screen runs on a physical buzzer mapped to Enter). Footer "Powered by Playzone" links to the main page in a new tab and doesn't count as a game tap.

## [1.21.1] - 2026-10-06

- `tenbool` on the code edit page: the thumbnail and the "open in new window" button opened the empty `media.url` (`about:blank`). Both now open the public game at `/v/{shortId}`.

## [1.21.0] - 2026-10-06

- New experience type `tenbool` ("10 בול"): start a timer and stop it at exactly 10.00. Enter on big screens (keyboard or a USB button mapped to Enter), a tap anywhere on phones. No settings; created in one click from the dashboard like the raffle.
- `TenBoolViewer` decodes its four sounds into Web Audio buffers on mount, so play needs no network after the page loads. The press is judged on the event's own timestamp and truncated to hundredths, so the time shown is the time judged.

## [1.20.28] - 2026-10-01

- Return from experience editing to its folder, including customer-owned folders for super admins.
- Keep folder navigation in the locale-preserving URL for browser Back and reload. Retain the user-scoped dashboard filter for the browser session.
- Persist dashboard hero dismissal in localStorage.

## [1.20.27] - 2026-10-01

- Agent 0.9.6 waits for missing message dates and can recover a previously read receipt date only for the same live message ID, group-derived key and exact normalized filename, after a fresh strict-identity PDF download matches the saved SHA-256. Verification downloads cannot overwrite the original cache.
- Reuse dates already read in the current scan only for the same materialized message/name. Never infer receipt dates from filenames, neighboring messages or the current day; unknown or changed undated PDFs remain blocked.
- Export bounded date inputs, date provenance and the specific failing message. 52 local runner/browser tests passed, including full virtualized-history collection with an undated known PDF, fresh PDF downloads and rejection of changed bytes or identities. Live acceptance on Michal's Mac remains pending.

## [1.20.26] - 2026-10-01

- Agent 0.9.5 reads only messages intersecting the chat viewport, waits for visible content to settle, and keeps offscreen empty shells from overwriting verified observations or proving an old date boundary.
- Preserve strict PDF preview/download identity, history overlap and missing-message checks. Real latest-boundary edits, additions and removals still require a fresh read; export bounded differences for support.
- 51 isolated runner/browser tests passed, including a complete virtualized-history scan downloading three fixture PDFs and tests for unhydrated shells and real message changes. No live WhatsApp send or production PDF update was performed; acceptance on Michal's Mac is still required.

## [1.20.25] - 2026-10-01

- Fix the stale 0.9.3 download-button label: both locales, the ZIP URL and checksum URL now derive from the agent package version. The already published 0.9.4 installer is unchanged.

## [1.20.24] - 2026-10-01

- WhatsApp Agent 0.9.4 reads semantic document buttons with a PDF label and document icon, while excluding quoted cards and plain-text filenames. Full preview/download identity verification remains mandatory.
- Wait for attachment content to stabilize, not only message IDs; retry a read-only scan if the same latest message changes during collection.
- Export bounded diagnostics for all observed message types, including ignored rows and unsupported document indicators.
- Group reports say a suitable booklet was not collected, and avoid also listing held targets as absent. Legacy uncertain reports remain reconciliation-only.
- Recognize shortened Hebrew Plaza names under the existing owner-approved Eilat rule; explicit areas override it.
- AI, verified reply-sender extraction and reconciliation against manual website updates are not added in this release. Live acceptance on Michal's Mac remains required.

## [1.20.23] - 2026-09-30

- WhatsApp Agent 0.9.3 adds a guided same-account reconnection confirmation followed by a read-only file scan. A refreshed approval timestamp no longer forces a new manual-completion cutoff.
- Preserve original cycle identity/start, cache, assignments, receipts and scheduled slots. Record an explicit same-account declaration in a separate audit event.
- Only allow reconfirmation while paused, without uncertain writes, and with matching integration, owner, group and account label. Changed scope remains blocked.
- Export bounded configured/approved scope fields for support; fresh preview remains required before enabling updates.

## [1.20.22] - 2026-09-30

- WhatsApp Agent 0.9.2 compares complete PDF names after whitespace, bidi and Unicode presentation normalization, with a bounded wait for preview labels.
- Exclude quoted message IDs and thumbnails from download selection; verify the browser-suggested download filename before saving and hashing bytes.
- Export expected, visible and downloaded filenames for failed attachment verification; close previews on both success and failure.
- 44 local runner/browser tests passed. The supplied report confirms active sleep prevention and synced scheduling, but does not prove recent uploads; validation on Michal’s Mac remains required.

## [1.20.19] - 2026-09-24

- WhatsApp Agent 0.9.0 separates connection, file review and activation into a guided native workflow with fixed header/footer and a dedicated Settings scene.
- Hide completed recovery controls; show the next required action and support export beside an actionable error. Keep Update Now available after review or while enabled.
- Exclude quoted/header message IDs from timeline extraction. Retry incomplete read-only scans once with a fresh browser context, retaining fail-closed checks for missing history.
- Export and display missing cached-file names and record failed scan attempt times. Do not restore unseen cached files or automatically retry writes.
- The screenshots show the earlier batch was verified; the exact missing-message cause still requires a fresh diagnostic from Michal.

## [1.20.18] - 2026-09-24

- WhatsApp Agent 0.8.2 inspects all visible message ancestors, excludes header/quote anchors and waits for delayed history layout. Ambiguous containers still block uploads.
- Show the app version in the window and flag installed runtime mismatches; highlight pending-operation recovery before a new scan.
- Preserve application error codes through Playwright wrappers and export bounded layout metrics without message text.
- Local browser regression checks and universal Mac build passed; the actual Michal DOM and pending batch still require live validation.

## [1.20.17] - 2026-09-24

- WhatsApp Agent 0.8.1 keeps migrated legacy notices reconcile-only even if their outbox was merely prepared, ensuring old UI-heavy wording cannot be sent by a later delivery retry.
- The explicit Update Now confirmation authorizes its group report even before scheduling is enabled; it does not change the saved schedule/reporting preference.

## [1.20.16] - 2026-09-24

- WhatsApp Agent 0.8.0 separates confirmed PDF updates from durable email/WhatsApp delivery, allowing later checks after a notification failure.
- Add owner-scoped read-only batch status and native recovery without reuploading confirmed files; uncertain writes remain blocked for investigation.
- Add Update Now, next check, last scan/outcome, upgrade-pause explanation and richer diagnostics; heartbeat uses the package version.
- Shorten new group notices to confirmed updates, held files, corrections and missing targets. Preserve old uncertain messages for reconciliation without duplicate sending.
- Keep existing keys, profiles and PDFs. Requires fresh validation on Michal's Mac; the release does not remotely recover her installation.

## [1.20.15] - 2026-09-24

- WhatsApp Agent 0.7.2 waits for stable newest messages, uses their actual scroll ancestor and supports column-reverse history.
- Require overlapping history windows, revisit the newest boundary, and reject scans that silently omit known in-window file messages. Explicitly observed deleted rows remain excluded.
- Export scan boundary diagnostics. Screenshots confirmed Club Dead Sea and two Royal messages remained present despite their omission from the 0.7.1 preview; live validation of the repaired scan is pending.

## [1.20.14] - 2026-09-24

- WhatsApp Agent 0.7.1 reads unquoted PDF labels next to image-only thumbnails, including nested filename spans. Unreadable attachment labels require review.
- Hide cached preview rows after a failed or newer empty scan; export installed version, scan time, preview protocol, pending state and file hashes for diagnosis. Require the assignment-capable API even for filename-only batches.
- Display receipt times with fractional ISO seconds correctly in Israel time.
- Local regression and packaging checks do not replace a fresh preview on Michal's Mac; live DOM/byte equality still need that verification.

## [1.20.13] - 2026-09-24

- WhatsApp Agent 0.7.0 updates confident matches while retaining unresolved files in a complete server-derived report.
- Compare per-target SHA-256 hashes; identical retransmissions dedupe, conflicting versions require clarification. Pin saved manifests to source identity and bytes.
- Ignore quoted document thumbnails; accept short caption/reply aliases only with explicit message identity and matching sender. Unsupported quote DOM remains unresolved; Michal live verification is pending.
- Add per-file manual assignment/exclusion and bounded diagnostic export in the Mac app. Upgrades pause scheduling for a new preview.
- Preserve original filenames, assignment provenance and update timestamps; use generic experience-name clarification messages and re-evaluate changed evidence without repeating unchanged reports.

## [1.20.12] - 2026-09-23

- Apply the owner-confirmed Eilat default to Leonardo Club filenames without an area; explicit Dead Sea and Tiberias names keep their own targets.
- Add Hebrew/English region regressions and retain review when the configured Eilat target is unavailable or the hotel is unidentified.
- Matching is corrected server-side; existing Mac 0.6.0 installations only need to run Preview again.

## [1.20.11] - 2026-09-20

- Explain the WhatsApp Agent workflow from a shared group through explicit experience matching, scheduled updates and confirmation reports.
- Remove Fattal branding from the page header; keep current PDF/Fattal scope and super-admin access explicit in connection setup.

## [1.20.10] - 2026-09-20

- Native universal Mac WhatsApp Agent 0.6.0 with guided connection, mapping preview, activation/pause and Open Downloads.
- Automatically install a private checksum-verified Node runtime and dedicated browser; preserve existing profiles and schedules on upgrade.
- Replace command-based website setup with three GUI steps and show each computer’s download path and retention behavior.
- Current archive is ad-hoc signed; Apple Developer ID signing and notarization remain required for broad distribution.

## [1.20.9] - 2026-09-20

- Rename booklet automation to WhatsApp Agent and replace repeated select rows with a full-width weekly calendar and shared times, preserving distinct schedules.
- Show computer names, reported activation, version and last contact, with confirmed disconnect/reconnection for super admins.
- Mac collector 0.5.0 registers unique installations, binds each scoped key to one computer and respects remote disconnection before work.

## [1.20.8] - 2026-09-20

- Super-admin-only booklet management with owner-scoped weekly check editor and filename guidance.
- Mac collector 0.4.0 polls and acknowledges schedule revisions; preserves local activation, applies future slots only and stops on sync failure.
- Verify all 12 standardized hotel names, scheduling/DST, scope, non-admin rejection and desktop/mobile controls.

## [1.20.7] - 2026-09-20

- Pair each experience title with its exact uploaded filename, Israel replacement timestamp and PDF/QR links in HTML and plain-text reports.
- Persist the transaction title and replacement timestamp in file and run audits; preserve original timestamps for already-uploaded files.

## [1.20.6] - 2026-09-20

- Verify WhatsApp message text including image-based emoji; reconcile the delivered report without duplicate sends.
- Mark resumed completed batches as healthy; Mac download updated to 0.3.1.

## [1.20.5] - 2026-09-20

- Booklet updates dashboard with owner selection, one-time scoped keys, revocation, Mac download and bilingual setup instructions.
- Mac installer connection import and explicit scheduling controls; production Fattal owner corrected from user confirmation.

## [1.20.4] - 2026-09-20

- Authorized WhatsApp group reports with persistent send acknowledgments and quiet followups at 12:00 and 14:00.
- Scoped intake health diagnostics without exposing production credentials.

## [1.20.3] - 2026-09-20

- Standalone macOS WhatsApp booklet collector with persistent business profile, verified PDF downloads, configurable scheduling and safe recovery.
- Owner-approved Eilat default for unqualified Herods, Leonardo Plaza and Royal filenames; explicit areas take precedence.
- Scoped intake authorization, full-batch matching across split uploads, consolidated server-side reports and operational notifications.

All notable changes to this project will be documented in this file.

## [1.14.2] - 2026-05-31

### Added
- Raffle editor: a **"delete all raffle data"** action (danger zone, Winners tab) that permanently removes all participants and winners for the event, behind a type-to-confirm dialog (type "מחיקה"). Supports the data-retention / privacy duty of deleting personal data after an event.

---

## [1.14.1] - 2026-05-31

### Changed
- Raffle big-screen control drawer now loads already-recorded winners from the server on open (owner), so a mid-event page refresh no longer loses the visible winners list. Non-owners (token-only) keep the local session list unchanged.

---

## [1.14.0] - 2026-05-31

### Added
- **"Raffle" (הגרלה) experience** — a black big-screen name draw for live events: an animated spinning wheel (7-slot reel, O(1) render that scales to thousands), spin/win/buzzer sounds, an editable silver-shine idle title, and a winner reveal with an animated border shine.
- Excel participant import (parsed client-side) with a duplicates report, plus a full management table — search, inline edit, delete, add, and a per-row WhatsApp link + phone copy.
- Atomic server-side draw and a **secure public big-screen link** (`/raffle/{shortId}?token=`): names only — phone numbers never leave the server. `/v/{shortId}` redirects raffle codes to the big screen.
- Raffle is a real media type, addable from both the dashboard and the code editor; background image/video and custom sounds upload to Cloudflare R2 in the owner's folder.

### Changed
- Dashboard cards now resolve the correct label + icon for every experience type from a single source-of-truth map (fixes experiences mislabeled as "image").

---

## [1.13.59] - 2026-05-24

### Fixed
- Dashboard storage badges now infer R2 from the public R2 URL and PDF replacements preserve storage metadata in Firestore.

---

## [1.13.58] - 2026-05-24

### Fixed
- PDF uploads now verify PDF content by signature and route `.pdf` files to the R2 PDF path even when the browser sends an imprecise MIME type.

---

## [1.13.57] - 2026-05-24

### Added
- Dashboard storage badge showing `R2` or `Blob` next to the file size.

---

## [1.13.56] - 2026-05-24

### Fixed
- Fattal booklet migration defaults now target `פתאל אילת`, `פתאל ים המלח`, and `פתאל טבריה`.

---

## [1.13.55] - 2026-05-24

### Added
- Cloudflare R2 storage path for PDF booklet uploads.
- Fattal booklet migration API scaffolding with per-user storage accounting.
- Storage delete compatibility for both Cloudflare R2 and Vercel Blob.

---

## [1.11.1] - 2026-02-08

### Fixed
- **QVote Logo Bug**: Fixed issue where logo would disappear after saving settings without changing the logo
  - Added fallback logic in `page.tsx` to preserve existing logo URL
  - Added fallback logic in `candidates/page.tsx` with complete file upload implementation
  - Logo now persists correctly across multiple saves

- **QVote Logo Deletion Bug**: Fixed Firestore error when deleting logo
  - Changed deletion logic to remove fields completely instead of setting to undefined
  - Added `removeUndefined` helper function to clean objects before Firestore saves
  - Prevents "Unsupported field value: undefined" errors

### Added
- **QVote Logo Animation**: Added smooth bounce-in animation when logo appears
  - Created `logo-bounce-in-fast` keyframe animation in `globals.css`
  - Applied animation to logo in `QVoteViewer.tsx`
  - 0.6s duration with elastic easing for professional feel

### Changed
- **Next.js Version**: Downgraded from 16.1.6 to 15.5.12
  - Resolved persistent Turbopack cache corruption issues
  - Improved development server stability
  - Better build reliability

- **QVote Modal UI**: Improved branding section layout
  - Landing image and logo now displayed side-by-side in same row
  - Better space utilization in settings modal
  - More compact and organized interface

### Security
- Enhanced `.gitignore` with Firebase credential patterns
- Verified no secrets exposed in codebase
- All environment variables properly configured

### Technical Details
- Added logo URL preservation logic to prevent data loss on subsequent saves
- Implemented proper field deletion for Firestore compatibility
- CSS animation uses GPU-accelerated transforms for smooth performance
- Grid layout optimization for better responsive design

---

## [1.11.0] - Previous Release
- QVote voting system
- QTreasure hunt features
- Multi-language support (Hebrew/English)
- Firebase integration
