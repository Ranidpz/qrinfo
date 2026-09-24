# Changelog

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
