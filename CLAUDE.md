# DayLog — CLAUDE.md

Smart calendar and spending tracker PWA. React + Vite. AI parsing via Gemini 1.5 Flash.

## Stack

- React 18, Vite 5, date-fns 3
- PWA via vite-plugin-pwa
- No UI library — all custom CSS
- Storage: localStorage via `src/db.js`
- AI: `src/gemini.js` → Gemini 1.5 Flash

## Commands

```bash
npm run dev      # dev server — localhost:5173
npm run build    # production build
npm run preview  # preview build
```

---

## Design Language

**Concept:** Mercury meets Notion. Understated confidence. Every screen should feel like a well-designed finance app someone would pay $10/month for.

**Mercury influence:** Deep dark backgrounds, precise typography, serious data presentation, generous whitespace, hairline borders, nothing decorative.

**Notion influence:** Editorial spacing, clean hierarchy, small-caps mono labels, sections feel distinct without heavy dividers, monospace used purposefully for metadata.

---

### Colour Tokens (`src/index.css`)

| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#0e0e0f` | App background — warm near-black |
| `--bg2` | `#161617` | Card / elevated surface |
| `--bg3` | `#1e1e20` | Hover / active state |
| `--bg4` | `#252527` | Deep selected / track backgrounds |
| `--border` | `rgba(255,255,255,0.055)` | Hairline borders |
| `--border2` | `rgba(255,255,255,0.10)` | Visible borders |
| `--text` | `#f0ede8` | Primary — warm white, never pure |
| `--text2` | `#78756f` | Secondary — muted mid-tone |
| `--text3` | `#46433e` | Tertiary / disabled / labels |
| `--accent` | `#a39a8e` | Warm stone — the *only* accent colour |
| `--accent-on` | `#0e0e0f` | Text on accent backgrounds |
| `--accent-dim` | `rgba(163,154,142,0.09)` | Tinted surfaces |
| `--red` | `#c86060` | Destructive / over-budget |
| `--amber` | `#b89050` | Warning (distinct from accent) |

**Accent rule:** `--accent` is warm stone, desaturated, restrained. It is used sparingly — nav active state, screen-title labels, send/save buttons. Never use a bright colour as accent. Never use multiple accent colours.

---

### Typography

| Role | Font | Notes |
|------|------|-------|
| Editorial headline | Fraunces (italic, opsz 300) | Home screen greeting only — "Morning, Ben." |
| Body / UI | Inter 300–500 | All labels, descriptions, UI copy |
| Numbers / Dates / Mono labels | JetBrains Mono 300–500 | Amounts, dates, section labels, metadata |

**Rules:**
- `font-variant-numeric: tabular-nums` on all monetary and numeric display — prevents layout shift when numbers update
- Monospace for everything data-forward: amounts, percentages, dates, times, category labels
- Section labels: 10px mono, uppercase, `letter-spacing: 0.16–0.18em`, color `--text3`
- Screen titles (e.g. "Overview", "Schedule"): 10px mono, `--accent`, `letter-spacing: 0.18em`, uppercase
- Screen headings: 22px Inter 400, `letter-spacing: -0.02em`
- Home greeting: 36px Fraunces italic 300, `letter-spacing: -0.01em`

---

### Cards

```css
background: var(--bg2);       /* subtle lift from --bg */
border: 0.5px solid var(--border);
border-radius: 12px;
overflow: hidden;
```

**No glassmorphism.** No `backdrop-filter`. No box-shadow. No gradients. Solid surface only.
State layers: hover → `--bg3`, selected → `--bg4` or `--accent-dim`.

---

### Home Screen Structure

The Home screen does **not** use `.screen-header`. It has its own editorial structure:

```
home-hero        ← Fraunces italic greeting + mono date, not sticky
─ border ─
home-input-section  ← borderless textarea, the focal point
─ border ─
section: Quick log  ← dot chips (colored dot + text label)
section: Recent     ← card with entry rows (dot + description + amount)
```

**Input area:** No card wrapper. No border around the textarea. It breathes. The send button only activates (accent fill) when there is text. The mic button is a subtle outline circle.

**Preset chips:** `○ Label` pattern — a 6px color-coded dot plus plain text. No emoji in the chip. Chips are transparent by default, `--bg2` on hover.

**Recent entries:** Replace the icon-box with a 6px category dot (`entry-cat-dot`). Description + mono meta below. Amount right-aligned in mono.

---

### Spending Screen

Budget numbers are large, mono, tabular — Mercury-style financial dashboard:

```
spent                    remaining
RM 2,450                 RM 550
━━━━━━━━━━━━━━━━━━━━━━  (1px track)
72% of RM 4,000 budget   14 entries
```

Progress track height: **1px**. Not 2px. Not 3px. 1px is the right weight for this aesthetic.
Category rows: small emoji at 70% opacity for functional identification. No coloured box.

---

### Navigation

```css
.bottom-nav  { padding: 12px 0 calc(12px + env(safe-area-inset-bottom)); }
.nav-item    { gap: 5px; padding: 6px 0; }
.nav-label   { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.07em; }
```

Active state: `color: var(--accent)` + a 1px solid stone indicator line at the top of the nav area. No glow. No animation. No pill. No scale effect.

---

### Animations

The minimal list — anything not on this list does not belong:

| What | Spec |
|------|------|
| Screen enter | `fadeIn 0.15s ease` |
| Progress bar fill | `transition: width 0.35–0.4s ease` |
| Button state | `transition: all 0.15–0.18s ease` |
| Toast appear | `slideUp 0.18s ease` |
| Hover states | `transition: color/background 0.12–0.15s ease` |

No ambient animations. No floating elements. No glow pulse. No gradient shimmer. No decorative motion of any kind.

---

### Spacing System

| Context | Value |
|---------|-------|
| Screen-header padding | `52px 24px 20px` |
| Section horizontal padding | `24px` |
| Section top spacing | `28px` |
| Card row padding | `14px 18px` |
| Between cards | `8px` |
| Bottom content padding | `2.5rem` |

Never go below 14px for a row's vertical padding. Mercury-level generosity — nothing cramped.

---

### What Never Belongs in This Codebase

- `backdrop-filter` / glassmorphism of any kind
- `box-shadow` (not even subtle ones)
- Gradient fills — buttons, progress bars, backgrounds, text
- `-webkit-background-clip: text` gradient text effects
- Ambient background animations or blob elements
- Glow effects (`text-shadow`, coloured `box-shadow`)
- Any animation > 400ms
- Bright accent colours — only `--accent` (warm stone `#a39a8e`)
- Emoji as structural navigation or UI icons (SVG only)
- Pure black `#000000` or pure white `#ffffff`
- Multiple accent colours (one restrained accent only)

---

## File Structure

```
src/
  App.jsx              # root shell, tab router, toast
  App.css              # app shell, bottom nav, screen-header, card, section
  index.css            # design tokens, global reset, keyframes
  db.js                # localStorage CRUD (expenses, events, settings, budgets)
  gemini.js            # Gemini 1.5 Flash API + response parser
  utils.js             # CAT_META, PRESETS, formatRM, formatDate, formatTime
  components/
    Home.jsx/css       # editorial hero + borderless input + dot chips + recent
    Spending.jsx/css   # budget hero + category breakdown + expense list
    Calendar.jsx/css   # month grid + event list
    Settings.jsx/css   # budgets, name, API key, data actions
    Toast.jsx/css      # ephemeral feedback (mono text, dark surface)
```

## Environment

```
VITE_GEMINI_API_KEY=...   # .env.local — gitignored
```

Fallback: `localStorage.getItem('dl_gemini_key')`
