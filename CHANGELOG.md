# Changelog

All notable changes to this project will be documented in this file.

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
