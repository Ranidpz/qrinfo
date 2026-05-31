# Changelog

All notable changes to this project will be documented in this file.

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
