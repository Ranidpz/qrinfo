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

When building apps in Hebrew:

### Google Assistant Font

Use the Google Assistant font family:
```css
font-family: 'Assistant', -apple-system, sans-serif;
```

Import from Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### RTL (Right-to-Left) Support

Always include RTL directives:

```html
<html dir="rtl" lang="he">
```

```css
body {
  direction: rtl;
  text-align: right;
}

/* Use logical properties for RTL compatibility */
margin-inline-start: 16px; /* Instead of margin-left */
padding-inline-end: 24px;  /* Instead of padding-right */
```

**Key RTL Guidelines:**
- Flip layouts horizontally
- Navigation moves to the right
- Arrows and icons should mirror
- Use `start` and `end` instead of `left` and `right` in flex/grid
- Test with Hebrew content, not English

**Tailwind RTL:**
```jsx
// Use Tailwind's RTL-aware classes
<div className="ms-4 pe-6"> {/* margin-start, padding-end */}
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
- [ ] For Hebrew: RTL enabled, Google Assistant font loaded
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

Remember: **Less is more.** A clean, simple design with excellent execution beats an over-designed interface every time.
