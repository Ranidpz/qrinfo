---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
---

# Frontend Design

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

## Workflow

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

Before coding, understand the context and commit to a BOLD aesthetic direction:

**Purpose:** What problem does this interface solve? Who uses it?

**Tone:** Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc.

There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.

**Constraints:** Technical requirements (framework, performance, accessibility).

**Differentiation:** What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL:** Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:

## Aesthetic Principles

### 1. Typography
**Choose fonts that are beautiful, unique, and interesting.**

Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.

**Hebrew Language Exception:**
When the content is in Hebrew (עברית), use these specific rules:
- **Font:** Always use "Assistant" from Google Fonts for Hebrew text
- **Direction:** Set `dir="rtl"` on the HTML element or use `direction: rtl` in CSS
- **Text Alignment:** Default to `text-align: right` for Hebrew content
- **Example CSS:**
```css
html[lang="he"] {
  direction: rtl;
  font-family: 'Assistant', sans-serif;
}
```
- Import the font: `<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet">`

### 2. Color & Theme
**Commit to a cohesive aesthetic.**

Use CSS variables for consistency. Consider gradients, duotones, or monochromatic schemes. Background treatments create atmosphere: noise textures, organic shapes, mesh gradients, or geometric patterns.

### 3. Animation & Interaction
**Use animations for effects and micro-interactions with focus on high-impact moments.**

**Well-orchestrated page loads:**
- Staggered reveals using animation-delay
- Scroll-triggering and hover states that surprise
- One orchestrated page load creates more delight than scattered micro-interactions

**Anti-Pattern:** Random micro-interactions without purpose or cohesion

### 4. Layout & Composition
**Create unexpected layouts that break conventional patterns.**

Asymmetry, overlapping elements, diagonal arrangements, or unconventional grid systems. The layout should feel intentional and support the aesthetic vision.

### 5. Depth & Atmosphere
**Create atmosphere and depth rather than defaulting to solid colors.**

Use shadows, gradients, blur effects, or layered elements. Even minimal designs benefit from subtle atmospheric effects.

## Anti-Patterns to Avoid

**NEVER use generic AI-generated aesthetics like:**
- Overused font families (Inter, Roboto, Arial, system fonts)
- Cliched color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context.

**No design should be the same.** Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

## Implementation Guidelines

**IMPORTANT:** Match implementation complexity to the aesthetic vision.

- **Maximalist designs** need elaborate code with extensive animations and effects
- **Minimalist or refined designs** need restraint, precision, and careful attention to spacing, typography, and subtle details

Elegance comes from executing the vision well.

## Examples of Good Aesthetic Directions

- **Brutalist Museum:** Raw concrete textures, bold sans-serif typography, stark black/white with one accent color, sharp edges, brutally functional
- **Organic Garden:** Soft rounded corners, earth tones with sage green accents, handwritten fonts paired with serif body text, illustrations of plants, gentle animations
- **Retro Synthwave:** Neon gradients (pink/purple/cyan), grid backgrounds, chrome text effects, 80s-inspired geometric shapes, glow effects
- **Swiss Minimalism:** Perfect grid system, single typeface (Neue Haas Grotesk), strict use of whitespace, red accent only, mathematical precision
- **Art Deco Luxury:** Gold accents, geometric patterns, elegant serif fonts, dark backgrounds, symmetrical compositions, glamorous feel
- **Playful Toy:** Bright primary colors, chunky rounded UI, fun animations, 3D effects with shadows, approachable and friendly

Remember: The goal is to create something MEMORABLE that serves the user's needs while avoiding generic, forgettable design.
