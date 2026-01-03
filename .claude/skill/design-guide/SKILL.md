---
name: design-guide
description: Modern UI design system for building clean, professional interfaces. Use when creating ANY UI component, webpage, web app, React component, HTML interface, or visual design. Ensures consistent, accessible, and professional design across all UI work with specific guidelines for spacing, typography, colors, and interactions. Also includes Hebrew RTL support guidelines.
---

# Design Guide

Comprehensive design system for building modern, professional UIs. Apply these principles to ALL UI work.

## Core Design Principles

### 1. Clean and Minimal
- Embrace white space - let content breathe
- Avoid cluttered layouts
- Remove unnecessary elements
- One primary action per section when possible

### 2. Color System

**Base Palette:**
- Primary: Grays and off-whites (`#F9FAFB`, `#F3F4F6`, `#E5E7EB`, `#D1D5DB`)
- Dark text: `#111827`, `#374151`, `#6B7280`
- Borders: `#E5E7EB`, `#D1D5DB`

**Accent Color:**
- Choose ONE accent color for the entire design
- Use sparingly for CTAs, links, and key interactive elements
- Good options: `#10B981` (green), `#F59E0B` (amber), `#EF4444` (red), `#3B82F6` (blue) - but NOT gradients
- 60-30-10 rule: 60% neutral, 30% secondary neutral, 10% accent

**Color Anti-patterns:**
- ❌ NO purple/blue gradients
- ❌ NO rainbow gradients
- ❌ NO using every color in the palette
- ❌ NO multiple accent colors competing for attention

### 3. Spacing System (8px Grid)

Use only these spacing values:
- `8px` - Tight spacing (icon to text)
- `16px` - Default spacing (between related elements)
- `24px` - Medium spacing (between sections)
- `32px` - Large spacing (component padding)
- `48px` - Extra large (section separation)
- `64px` - Maximum (major layout sections)

Apply consistently to: padding, margin, gaps

### 4. Typography

**Hierarchy:**
- Headings: `32px`, `24px`, `20px` (bold or semibold)
- Body text: `16px` minimum (never smaller)
- Small text: `14px` (use sparingly for labels/captions)
- Line height: 1.5-1.6 for body, 1.2-1.3 for headings

**Font System:**
- Maximum 2 font families per design
- Prefer system fonts for performance: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Use font weight for hierarchy (400, 500, 600, 700)

**Anti-patterns:**
- ❌ Text smaller than 16px for body content
- ❌ Using 4+ different font sizes
- ❌ Mixing too many font weights

### 5. Shadows and Depth

Use subtle shadows, never heavy:
- Light: `box-shadow: 0 1px 3px rgba(0,0,0,0.1)`
- Medium: `box-shadow: 0 4px 6px rgba(0,0,0,0.1)`
- Large: `box-shadow: 0 10px 15px rgba(0,0,0,0.1)`

**Guidelines:**
- Cards: Choose either subtle shadow OR border, not both
- Buttons: Subtle shadow on default state
- Modals/dialogs: Medium to large shadow
- No shadows on flat design elements

### 6. Border Radius

Strategic use of rounded corners:
- Buttons: `6px` or `8px`
- Cards: `8px` or `12px`
- Small elements (badges, pills): `16px` or `9999px` (fully rounded)
- Input fields: `6px` or `8px`

Not everything needs to be rounded - keep some elements sharp for variety.

### 7. Interactive States

Every interactive element MUST have clear states:

**Buttons:**
```css
default: background + subtle shadow
hover: slightly darker + lift shadow
active: darker + pressed shadow
disabled: reduced opacity (0.5-0.6) + no hover
```

**Links:**
```css
default: accent color
hover: darker shade or underline
visited: optional distinct color
```

**Inputs:**
```css
default: border
focus: accent color border + subtle shadow
error: red border + red text
disabled: gray background + reduced opacity
```

### 8. Mobile-First Design

Always design with mobile in mind:
- Start with 375px viewport
- Touch targets minimum 44px × 44px
- Stack elements vertically on mobile
- Hide/collapse less important content
- Use responsive spacing (smaller on mobile)
- Test all interactions with touch in mind

## Component Guidelines

### Buttons

✅ **Good:**
- Padding: `12px 24px` (8px grid)
- Clear text (16px minimum)
- Subtle shadow: `0 1px 3px rgba(0,0,0,0.1)`
- Hover: lift effect with darker shade
- Solid colors (no gradients)
- Disabled state with opacity

❌ **Bad:**
- Gradient backgrounds
- Tiny text (12px or less)
- No hover state
- Inconsistent padding

### Cards

✅ **Good:**
- White/off-white background
- Choose ONE: `border: 1px solid #E5E7EB` OR subtle shadow
- Border radius: `8px` or `12px`
- Padding: `24px` or `32px`
- Clean content hierarchy

❌ **Bad:**
- Border AND heavy shadow
- Colored backgrounds everywhere
- Cluttered content
- No spacing between elements

### Forms

✅ **Good:**
- Labels above inputs (16px)
- Input height: `44px` minimum
- Spacing between fields: `16px` or `24px`
- Clear error states (red border + message)
- Focus states with accent color
- Placeholder text in gray (`#9CA3AF`)

❌ **Bad:**
- Labels inside inputs
- Tiny input fields
- No error messaging
- Inconsistent spacing
- Missing focus states

### Navigation

✅ **Good:**
- Clear active state (accent color or bold)
- Adequate spacing between items (16px minimum)
- Hover feedback
- Mobile: hamburger or bottom tab bar
- Consistent placement

❌ **Bad:**
- No active state indication
- Cramped menu items
- Inconsistent styles
- Poor mobile experience

## Hebrew Language Support

**When building apps in Hebrew, ALWAYS apply these rules:**

### Google Assistant Font

Use the Google Assistant font family for ALL Hebrew text:
```css
font-family: 'Assistant', -apple-system, sans-serif;
```

Import from Google Fonts (include all weights you need):
```html
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet">
```

**Weight Mapping:**
- Light: 200-300
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700
- Extrabold: 800

### RTL (Right-to-Left) Support

**CRITICAL:** Always set RTL direction for Hebrew content:

**HTML:**
```html
<html dir="rtl" lang="he">
  <head>
    <meta charset="UTF-8">
    <!-- Assistant font -->
    <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet">
  </head>
  <body>
    <!-- Content here -->
  </body>
</html>
```

**CSS:**
```css
html[lang="he"] {
  direction: rtl;
  font-family: 'Assistant', -apple-system, sans-serif;
}

body {
  text-align: right;
}

/* Use logical properties for RTL compatibility */
.container {
  margin-inline-start: 16px;  /* Instead of margin-left */
  padding-inline-end: 24px;   /* Instead of padding-right */
}

/* Flex/Grid RTL */
.flex-container {
  justify-content: flex-start; /* Will align to right in RTL */
}
```

**React/JSX:**
```jsx
function App() {
  return (
    <div dir="rtl" lang="he" className="font-assistant">
      {/* Hebrew content */}
    </div>
  );
}
```

**Tailwind CSS RTL:**
```jsx
// Tailwind automatically handles RTL when dir="rtl" is set
<div className="ms-4 pe-6">  {/* margin-start, padding-end */}
  <p className="text-start">טקסט בעברית</p>
</div>
```

**Key RTL Guidelines:**
- ✅ Flip layouts horizontally (navigation moves to right)
- ✅ Mirror directional icons (arrows, chevrons)
- ✅ Use `start`/`end` instead of `left`/`right` in flex/grid
- ✅ Text alignment defaults to `right`
- ✅ Form labels remain above inputs (don't flip vertically)
- ✅ Test thoroughly with real Hebrew content, not English placeholders

**Common RTL Mistakes:**
- ❌ Using `margin-left` instead of `margin-inline-start`
- ❌ Hardcoding `text-align: left`
- ❌ Not mirroring directional icons
- ❌ Testing with English text instead of Hebrew
- ❌ Forgetting to set `lang="he"`

### Hebrew + English Mixed Content

When mixing Hebrew and English:
```css
/* Hebrew as primary language */
html {
  direction: rtl;
  font-family: 'Assistant', -apple-system, sans-serif;
}

/* English text inline */
.english-text {
  direction: ltr;
  display: inline-block;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

## Quality Checklist

Before finalizing any UI, verify:

- [ ] Spacing follows 8px grid system
- [ ] Text is 16px minimum for body content
- [ ] ONE accent color used consistently
- [ ] No gradients (unless explicitly requested)
- [ ] All interactive elements have hover/active/disabled states
- [ ] Mobile responsive (test at 375px)
- [ ] Color contrast meets accessibility standards (4.5:1 for text)
- [ ] Touch targets are 44px minimum on mobile
- [ ] **For Hebrew: `dir="rtl"` set, `lang="he"` set, Assistant font loaded**
- [ ] **For Hebrew: Tested with actual Hebrew text (not English)**
- [ ] Clean, uncluttered layout with adequate white space

## Common Mistakes to Avoid

1. **Inconsistent spacing** - Always use the 8px grid
2. **Too many colors** - Stick to neutrals + ONE accent
3. **Tiny text** - Never go below 16px for body content
4. **Missing interactive states** - Every clickable element needs feedback
5. **Over-designed** - Simplicity is sophistication
6. **No mobile testing** - Always check responsive behavior
7. **Gradient fever** - Solid colors are cleaner and more professional
8. **Cluttered layouts** - When in doubt, add more white space
9. **Hebrew without RTL** - Always set `dir="rtl"` for Hebrew content
10. **Wrong Hebrew font** - Always use Assistant for Hebrew text

Remember: **Less is more.** A clean, simple design with excellent execution beats an over-designed interface every time.
