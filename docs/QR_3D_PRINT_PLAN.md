# הדפסה תלת־ממדית — QR plaques for the Bambu Lab printer (PLAN)

Status: PLAN ONLY (12.11.2026). No product code yet. Interface-first: the first build step is a
clickable demo Rani approves by screen recording (§9 phase 1) — nothing past it starts before that.
Internal slug: `print3d`.

Rani's ask: "every QR code we make is a permanent code — add printing for the 3D printer: a Bambu
Lab print file from the system for every code, with instructions everywhere we have a print option."

Depends on the physical scan test of the gnome plaque made in the parallel hardware session
(`hardware/thecode-gnomes/`, Python CAD + `qrmatrix.mjs`). That test is **gate 0**: it decides
whether printed QR scans at all, and its numbers (module size, depth, plate surface) become the
presets here. This plan builds on its result, it does not replace it. Paper stickers
(PrintScreen, 36 × 42 mm) stay the fallback and the outdoor default.

---

## 1. Where the app prints / downloads a QR today

| # | Surface | File | Output today | Library | One / many | 3D button? |
|---|---|---|---|---|---|---|
| 1 | Code page — QR panel | `src/app/[locale]/code/[id]/page.tsx` (~3600–3735; `handleDownloadQR` ~805) | Button "הדפסת QR" actually **downloads a 2000 px PNG** (hidden `QRCodeCanvas`, level H, margin 2, custom `qrFgColor`, centre "sign" overlay drawn on canvas). WhatsApp share sends the same PNG. `handleDownloadSVG` (~917) exists but **no button calls it**. | `qrcode.react` | one | **YES — phase 2 (main entry)** |
| 2 | הקוד — print screen | `src/components/thecode/admin/PrintScreen.tsx` | `window.print()` A4 sticker sheet: gnome size 36×42 (20/page) or large 45×60; QR 34 mm, level M, `marginSize 0`, always production origin (`plateUrl` → `SITE_URL/g/{code}`), manual code under it; filters all/uninstalled + by spot | `qrcode.react` (`QRCodeSVG`) | many | **YES — phase 2/3 (gnome plaque)** |
| 3 | Dashboard code card | `src/components/code/CodeCard.tsx` (~846–912) | Shows QR only (140 px for links, 44 px corner badge for the rest). No download, no print. | `qrcode.react` | one per card | phase 4 (menu item → same modal) |
| 4 | Dashboard folder | `src/app/[locale]/dashboard/page.tsx` | No QR print at all today. | — | many | phase 3 (batch "all codes in folder") |
| 5 | Q.Vote candidates page | `src/app/[locale]/code/[id]/candidates/page.tsx` (~1561) | 96 px "click to test" QR, no print | `qrcode.react` | one | later, only if asked |
| 6 | WeeklyCal modal | `src/components/modals/WeeklyCalendarModal.tsx` (~1798) | 36 px QR in the tab bar, no print | `qrcode.react` | one | no (uses the code page) |
| 7 | Q.Challenge modal | `src/components/modals/QChallengeModal.tsx` (~495) | 120 px click-to-open QR | `qrcode.react` | one | no (uses the code page) |
| 8 | Q.Hunt modal | `src/components/modals/QHuntModal.tsx` (~345, ~668, print window ~769) | print window of every hunt code (`/v/{shortId}?code=`) + single-code modal + JSON export | `qrcode` (`toDataURL`) | many | **out of scope** — Q.Hunt is frozen/unfinished; do not touch |
| 9 | Q.Treasure modal | `src/components/modals/QTreasureModal.tsx` (~188–250) | "print all station QRs" window (creates station codes server-side first) | `qrcode` | many | **out of scope** — do not touch |
| 10 | Q.Tag personal entry QR | `src/components/viewer/QTagViewer.tsx`, `src/app/[locale]/p/[token]/page.tsx` (save PNG), scanner page | Per-guest ticket, revocable | `qrcode.react` | one | **never** — not a permanent code |
| 11 | On-screen only | `src/app/lobby/[routeId]/LobbyClient.tsx`, `viewer/tenbool/TenBoolLeaderboard.tsx`, `viewer/socialwall/ShareSheet.tsx`, legacy `src/app/code/[id]/page.tsx` | QR shown on a screen | `qrcode.react` | one | no |
| 12 | Dead code | `src/components/code/QRGenerator.tsx` | PNG 1000 px + SVG download — **imported nowhere** | `qrcode.react` | one | no (leave) |

Booklets (Fattal PDFs) have no QR surface of their own; their QR comes from the code page (#1).
Hotel-room plaques for booklets are a natural use of the flat plaque with screw holes.

Findings worth fixing along the way (in the 3D path only — do not change the PNG flow silently):
- The code page builds `viewUrl` from `window.location.origin`. A permanent 3D plaque printed from a
  preview/dev host would encode a dev URL forever. **The 3D generator always encodes `SITE_URL`**
  (`src/lib/landing/site.ts`), like PrintScreen already does.
- The code page uses level H + custom fg colour + centre sign. For 3D: always black on white, no
  sign (phase 1–4), level **M** → bigger modules for the same size.

QR libraries already in `package.json`: `qrcode` (`QRCode.create(url).modules` gives the matrix —
exactly what `hardware/thecode-gnomes/qrmatrix.mjs` uses), `qrcode.react` (rendering), `jsqr`
(decode — used for the self-check, §5.6), `html5-qrcode` (in-page scanner). `three@0.81` exists
only as a transitive dependency of `3d-flip-book` — **do not use it**.

---

## 2. Shapes and sizes (first set — keep it short)

All plaques: white body, black modules + text, **printed face-down** (face on the plate = flat,
matte on textured PEI), two-colour only in the first 2 layers. Sizes in mm.

| Shape | Presets (outer W × H × thickness → QR side) | Mounting | Phase |
|---|---|---|---|
| **Gnome plaque** (הקוד) | 37.1 × 43.1 × 1.2 → QR 32.6 (2-module quiet zone inside) + 6 mm code band; 2 locating pegs on the back | clicks into the gnome socket 37.5 × 43.5 (0.2 play/side) | 2 |
| **Flat plaque** | S 40 × 48 × 2 → QR 32 · M 60 × 70 × 2.4 → QR 50 · L 100 × 115 × 3 → QR 85 | none (glue / double-sided tape) | 2 (M only) → 4 |
| **Flat plaque + screw holes** | same sizes, +10 mm band top and bottom with Ø 4.4 countersunk holes outside the code | 2 wood screws 3.5–4 mm | 4 |
| **Table stand** | plaque M + a separate wedge foot (75°) with a 2.5 mm slot, both on the same plate | slide plaque into foot | 4 |
| **Keychain** | 30 × 40 × 2 → QR 25, 4 mm hole in a top tab | key ring | 4 (experimental) |

Gnome-plaque numbers come from the hardware session (socket 37.5 × 43.5, plaque 1.2 thick, module
1.12 mm, text band 6 mm, cap ≈ 4.8). One source of truth: `src/lib/print3d/presets.ts` with a
comment "keep in sync with `hardware/thecode-gnomes`" (same convention as `G` in PrintScreen).
Note from that session: gnomes printed before this have a 0.4 mm socket; a 1.2 mm plaque stands
0.8 proud there → glue. New gnomes need `PAD_DEPTH 1.2` + the two peg holes.

Rules every preset obeys (checked in code, shown as a warning, never silently "fixed"):
- **Module ≥ 1.0 mm** (0.4 nozzle draws ≈ 0.42 lines; under 0.8 mm the black bleeds). Keychain at
  25 mm with 29 modules + 4 quiet = 0.76 mm → marked "ניסיוני".
- **Quiet zone ≥ 2 modules of white** on every side, inside the plaque (4 is the spec; 2 is what
  the gnome size allows and what gate 0 tests).
- **Normal polarity only** (black modules on white). Never invert — many phone scanners fail on
  light-on-dark.
- **URL kept short** → version 3 (29 × 29) at level M: `https://qr.playzones.app/v/{shortId}` and
  `/g/{12 chars}` both fit (v3-M holds 42 bytes). If a URL pushes it to v4, the UI says the modules
  shrink and suggests a larger size.

---

## 3. Two-colour build (what is inside the file)

Layer stack, face-down (z = 0 is the plate = the visible face):

```
z 0.0–0.4   FACE SLAB (2 layers @0.2)  black = modules + text   white = everything else
z 0.4–T     BACK BODY                   white only (rounded rectangle)
z T–T+h     back details                pegs (gnome) / debossed batch number (−0.6 into the back)
```

- **Mirroring**: the model is mirrored in X so the face reads correctly once lifted off the plate.
  Text and QR both. (Mirrored QR scans unreliably on iPhone — getting this wrong = dead plaque.)
- **Black depth 0.4 mm** (2 layers) is enough to be opaque; only these 2 layers have colour
  changes. Swaps are per **layer**, not per object → a full plate of 36 plaques costs the same ≈ 2–3
  filament swaps as one plaque. That is why batch printing is cheap.
- **Optional text under the QR** (manual code / short text) in the same face slab, black.
- **Optional number on the back** (batch #), debossed 0.6 mm on the top surface (prints up, no
  colour change) — used to sort plaques after printing.

### How the two colours are separated (no CSG library in the browser)
Everything on the face is axis-aligned (QR modules, a pixel font), so the face slab is built as a
**grid**, not with booleans:
1. Rasterise the face into cells: QR modules at module resolution; text with the built-in block font
   (§5.3). Every cell is black or white.
2. Black cells → greedy rectangle merge → boxes (part "black"). White cells of the same grid →
   boxes (part "white face"). A v3 QR becomes ≈ 150–250 rectangles, not 841 cubes.
3. The rounded outer border of the face slab and the back body are built from convex / star-shaped
   pieces (centre rectangles + quarter-disc corners; around a screw hole: fan from each square
   corner to its quarter arc) → each piece is a simple prism, triangulated as a fan. No earcut.
4. Screw holes alternative: Bambu "negative part" cylinders in the same object (subtracted at slice
   time). Decided in the phase-2 spike.

**Spike (phase 2, day 1)** — open three hand-made variants in Bambu Studio and keep the first that
slices with zero repair warnings and the right colours on layers 1–2:
A) explicit complement (above — default), B) one white body + black boxes as a **modifier** that
switches filament, C) overlapping normal parts. Record the result here.

### Mesh size
Gnome plaque ≈ 3–6 k triangles (QR + 6 glyphs + body + pegs). A plate of 36 ≈ 150–200 k triangles
→ ≈ 10–15 MB of XML, ≈ 2–3 MB zipped. The white back body is identical for every plaque of a preset
→ one mesh resource reused through `<component>` transforms. Vertices written with 3 decimals.
Strings built in chunks (array join) and streamed into the zipper — no single giant string.

---

## 4. Output file

**Primary: one `.3mf` per plate, ready for Bambu Studio** (open → Slice → Print).

3MF = an OPC zip:
```
[Content_Types].xml
_rels/.rels
3D/3dmodel.model                 core 3MF: <object> meshes (mm), one object per plaque,
                                 parts "white" + "black" as components, <build> items placed on the plate
Metadata/model_settings.config   Bambu: per object/part <metadata key="extruder" value="1|2"/>,
                                 part subtype (normal_part / negative_part), names, plate + instances
Metadata/project_settings.config Bambu: filament colours (#FFFFFF, #000000) so "send" auto-maps
                                 project filaments to the matching AMS slots — only if a minimal
                                 file is accepted (spike)
```
- The hardware session already writes a plain 3MF from Python (`make3mf.py`, core spec only, one
  multi-part object) — Bambu opens it as a multi-part object without asking. We extend that with
  `model_settings.config` so the filament per part is pre-assigned (that session found the Bambu
  part-filament dropdown hard to drive, so pre-assignment really matters).
- Exact Bambu keys are verified by saving a 2-part project from Bambu Studio and diffing its
  `Metadata/` — not guessed. If Bambu rejects the minimal `project_settings.config`, we drop it:
  the file still opens with both parts on filament 1/2, and the instructions say which is which.
- Object names: `#07 · X5MYGN` (number + manual code) so the Bambu object list = the print list.
- **Fallback: 2 STL files** (white.stl + black.stl) in a zip, for other slicers. Phase 4.

### Client-side only
Generated **in the browser** — no API route, no Vercel function, no storage, nothing uploaded (the
repo's Excel lesson; also no 4.5 MB body limit to fight). The file is a `Blob` → download.

### New dependency
- **`fflate`** (zip, ≈ 8 KB gz, zero deps, sync + streaming, deflate). The only new package. Why: a
  3MF must be a zip and nothing in `package.json` writes zips. Fallback with zero deps: a ~60-line
  STORE-only zip writer (no compression → plate files 10–15 MB instead of 2–3 MB). Decide in phase 2.
- No `three`, no font library, no CSG library. Preview is SVG (§6).

---

## 5. Building blocks (planned files, all pure + unit-tested)

```
src/lib/print3d/presets.ts   shapes, sizes, rules (§2), filaments (§7), H2D plate (§5.5)
src/lib/print3d/matrix.ts    url → module grid via QRCode.create(url, {errorCorrectionLevel:'M'}); mirror
src/lib/print3d/font.ts      block pixel font (§5.3)
src/lib/print3d/rects.ts     grid → merged rectangles (greedy)
src/lib/print3d/mesh.ts      rectangles / convex prisms → indexed mesh; pegs; back number
src/lib/print3d/plaque.ts    preset + {url, text, number} → { white, black } meshes
src/lib/print3d/plate.ts     N plaques → positions on the plate, plate splitting
src/lib/print3d/threemf.ts   meshes + names + filaments → 3MF bytes (fflate)
src/lib/print3d/selfcheck.ts raster of the black part's top view, un-mirrored → jsQR → must equal url
src/components/print3d/Print3DModal.tsx   the UI (§6), one component for every surface
scripts/tests/print3d-*.test.mjs          node --test
```

### 5.3 Text as geometry
- **Phase 2–3: built-in block font** (5 × 7 cells) for exactly what we print: the manual-code
  alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (`UNAMBIGUOUS` in `src/lib/thecode/server/codes.ts`)
  + 0–9 + `#`. At 4.8 mm cap a cell is 0.69 mm (> nozzle line), 6 chars ≈ 25 mm wide. Zero deps,
  perfect rectangles, same mesher as the QR.
- **Phase 4: short Hebrew text** ("סרקו אותי", a venue name): draw it with Canvas2D in the app font at
  10 px/mm, threshold, then the same rectangle merge (0.1 mm steps are below what a 0.4 nozzle
  draws). No font-outline library. Bold weight only; min cap 5 mm.

### 5.5 Plate (Bambu Lab H2D)
- Build area: 325 × 320 single nozzle, **300 × 320 when both nozzles print**. Layout uses
  **290 × 300** safe area minus a corner for the prime tower (≈ 40 × 40).
- Gap 5 mm. Gnome plaque 37.1 × 43.1 → ≈ 6 × 6 = **36 per plate** (exact count computed and shown).
- More codes than fit → several plates → one 3MF per plate (`…-plate-1-of-3.3mf`), or one 3MF with
  several Bambu plates if the spike shows it is easy.
- Order: by gnome/code number, row-major as seen in Bambu Studio. The debossed back number makes
  the physical order irrelevant.

### 5.6 Self-check (before the download button turns on)
Render the generated **black part** (not just the matrix) top-down, un-mirror, decode with `jsqr`;
the result must equal the URL exactly — per plaque, like `qrmatrix.mjs` does. Any failure → that
plaque is refused with a clear message. Also checks: module ≥ min, quiet zone ≥ 2, version ≤ 4.

---

## 6. UI — one modal, opened from every print surface

Button label: **"הדפסה בתלת־ממד"** (icon `Box` from lucide) next to the existing print/download
button. Opens `Print3DModal` (fixed positioning, per the repo lesson).

Layout (RTL, Hebrew, plural form):
1. **Shape** (segmented): לוחית לגמד · לוחית שטוחה · לוחית עם חורים · מעמד לשולחן · מחזיק מפתחות
   (only the shapes the surface allows — הקוד shows "לוחית לגמד" first).
2. **Size** (S / M / L, with the real QR size in cm).
3. **Text under the code** (none / manual code / short text) + **number on the back** (toggle).
4. **Preview**: SVG of the face, toggle "כך זה נראה" / "כך זה מודפס (הפוך)", plus a small layer
   diagram (white body, 2 black layers). Shows module size in mm and the green self-check tick.
5. **Batch line** (many codes): "36 לוחיות בפלטה אחת · 2 פלטות" + which codes.
6. **Download** button: "הורידו קובץ לבמבו" → `.3mf`.

### Instructions panel (always visible next to the button; collapsible after first use)
1. פתחו את הקובץ בתוכנה של במבו — הוא נפתח מוכן, עם שני צבעים.
2. ודאו שעל הפלטה יש משטח מחוספס (textured PEI) — הוא נותן פנים מט בלי ברק.
3. במסך השליחה בדקו שהלבן משויך לחריץ עם הלבן והשחור לחריץ עם השחור.
4. הלוחית מודפסת עם הפנים כלפי מטה — זה בכוונה. הקוד הפוך בתוכנה ויוצא נכון.
5. לפני פלטה מלאה הדפיסו לוחית אחת וסרקו אותה: באייפון, באנדרואיד ובסורק של המשחק.
6. הורידו מהפלטה אחרי שהתקררה, כדי שהלוחית לא תתעקם.
7. הרכבה: לגמד — לחצו עד שהפינים נכנסים לחורים. לקיר — דבק או ברגים. בחוץ — ראו הערה.

Warnings shown in place (never blocking silently): outdoor spot (§7), modules < 1 mm, URL not on
the production domain, a gnome without a code yet ("ממתין לשמירה", same rule as PrintScreen).

### Surfaces (where the button appears)
- Code page QR panel (#1): one code, shapes flat / holes / stand / keychain.
- הקוד PrintScreen (#2): third option next to the two sticker sizes, **"לוחיות להדפסה בתלת־ממד"**,
  honouring the same filters (all / uninstalled / spot). Many codes → batch.
- Dashboard card menu (#3) and folder header (#4): later.
- Q.Hunt / Q.Treasure (#8, #9): not touched. Q.Tag personal tickets: never.

---

## 7. Colours — only what Rani really has

- Indoor PLA: black, white, blue, purple, yellow, red, brown, green (`THECODE_PALETTE.indoor` in
  `src/lib/thecode/engine.ts`). Outdoor (ASA/ABS): black + grey (`THECODE_PALETTE.outdoor`).
- `presets.ts` gets its own `PRINT3D_FILAMENTS` list with the same idea (one line per real spool,
  material + hex + indoor/outdoor), and the code allows **only** combinations that scan:
  **QR = black on white, always.** Other colours may only be used for parts that carry no code
  (stand foot, keychain tab, back details) — phase 4.
- **Outdoor problem**: grey vs black is too little contrast for a QR, and white PLA in the Eilat sun
  softens (~55 °C) and yellows. Options, in order:
  1. Outdoor spot → the app defaults to the **paper sticker under clear laminate** (current fallback)
     and shows why.
  2. Buy one spool of **white ASA (or PETG)** → add it to `PRINT3D_FILAMENTS.outdoor` → the
     outdoor plaque is white ASA + black ASA. One line of config once the spool exists.
  3. Grey + black is NOT offered unless gate-0-style scan tests pass on a real printed sample.

---

## 8. Who sees it

- **Now**: super admins only — same gate as the הקוד create tab (`super_admin` role). The modal is
  mounted only when the gate passes.
- **Later — clients**: two possible products, Rani's choice:
  a) **Self-service file** for clients who own a printer: open the button to a plan tier. Note:
     the file is generated client-side, so the gate is a UI gate (anyone could make a QR STL
     elsewhere anyway — the value is convenience + correctness, not secrecy). Needs: an i18n pass
     (`en.json` + `he.json` together), the English instructions, a feature flag on the user/plan.
  b) **"שלט QR מודפס" service** (Rani prints and ships): an order button instead of a download →
     order doc in a new Admin-SDK collection behind a store module (rules `if false`), an email to
     Rani via Resend, payment out of scope. Only after (a) proves the plaques scan.

---

## 9. Phases

**Gate 0 — physical scan test (hardware session, in progress).** Gnome plaque from the Python CAD,
printed face-down on textured PEI, scanned. Outcome decides the presets (module size, black depth,
quiet zone, plate). If it fails, the fixes there (bigger QR, 3 black layers, smooth plate) flow here
before phase 2. Paper stickers stay meanwhile.

**Phase 1 — clickable DEMO (interface-first, no backend, no file).**
Route `/play/print-3d` (like `/play/the-code/admin`), sample code + sample adventure, the whole
modal (§6): shapes, sizes, text, preview face / mirrored, layer diagram, batch line, instructions,
warnings. The download button shows "בהדגמה". Rani screen-records and approves.
Done when: Rani approves the flow and the wording.

**Phase 2 — one shape, one code, real file.**
Spike first (§3: separation variants, Bambu `Metadata` keys, fflate vs store-zip). Then the pure
library (§5) + tests (decode of generated geometry, mesh closed, zip opens, Bambu keys present).
First shape: **gnome plaque** from PrintScreen for one gnome + **flat plaque M** on the code page.
Done when: the app's 3MF opens in Bambu Studio with colours assigned, slices without repair
warnings, prints, and scans in every test of §10 — and matches the hardware session's plaque.

**Phase 3 — batch.**
Plate layout, multi-plate split, back numbers, object names, PrintScreen "לוחיות בתלת־ממד" for all
gnomes of an adventure (with its filters); folder batch on the dashboard.
Done when: a full plate of real gnome codes prints in one go and every plaque scans + is identified.

**Phase 4 — more shapes + surfaces.**
Screw holes, table stand, keychain, Hebrew text, STL-zip fallback, dashboard card menu.

**Phase 5 — open to clients** (§8, Rani's decision).

---

## 10. Risks and how we verify scanning

| Risk | Mitigation |
|---|---|
| Printed QR doesn't scan (bleed, small modules) | gate 0; min module 1.0 mm; self-check decode of the real geometry; test plaque before each batch |
| QR printed mirrored | mirroring in one place (`matrix.ts`), test decodes the un-mirrored top view and FAILS on the raw view |
| Glare on the face | textured PEI → matte face; instructions say so |
| Dev URL baked into a permanent plaque | generator only ever encodes `SITE_URL` |
| Outdoor: low contrast / PLA softens | outdoor → sticker by default; white ASA when bought |
| Bambu ignores our metadata | spike diffs a real Bambu project; fallback = parts named "white"/"black" + instructions |
| Big plates slow in the browser | rectangle merge, shared back body, chunked strings; target < 3 s for 36 plaques |
| Old gnomes have a 0.4 mm socket | instructions: glue; new gnomes get 1.2 mm socket + peg holes |

**Scan test protocol** (every new preset, and the first plaque of every batch):
- iPhone camera app, Android camera app (Google Lens), and our in-page scanner (`html5-qrcode` in
  `GnomeScanner.tsx`) — all three must open the right page.
- Distance 15 / 30 / 60 cm; angle straight, 30°, 45°; light: daylight, indoor lamp, dim corridor
  (phone flash off). Plaque mounted in a real gnome.
- Pass = every combination opens within ~2 s. Results logged in this file per preset.
