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
npm run dev      # dev server, localhost:5173
npm run build    # production build
npm run preview  # preview build
```

## Design Language

**Vibe:** Premium, minimal, dark. Revolut meets Notion. Confident and clean.

### Colour Tokens (`src/index.css`)

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0e0e0f` | App background (warm near-black) |
| `--bg2` | `#161617` | Card surface |
| `--bg3` | `#1e1e20` | Hover / active surface |
| `--bg4` | `#262628` | Deep hover / selected |
| `--border` | `rgba(255,255,255,0.06)` | Hairline borders |
| `--border2` | `rgba(255,255,255,0.11)` | Visible borders |
| `--text` | `#f0ede8` | Primary text (warm off-white) |
| `--text2` | `#88857f` | Secondary text |
| `--text3` | `#4c4945` | Tertiary / disabled |
| `--accent` | `#c8a97a` | Champagne amber — primary accent |
| `--accent-on` | `#0e0e0f` | Text on accent backgrounds |
| `--accent-dim` | `rgba(200,169,122,0.10)` | Tinted surfaces |
| `--red` | `#d96b6b` | Destructive / over-budget |
| `--amber` | `#d4a043` | Warning (distinct from accent) |

### Typography

- **Body / UI:** Inter — weights 300, 400, 500
- **Numbers / Labels:** JetBrains Mono — always use for amounts, dates, codes
- **Numbers rule:** `font-variant-numeric: tabular-nums` on all monetary/numeric display
- **Screen heading:** 24px / weight 400 / letter-spacing -0.02em
- **Section label:** 10px mono / uppercase / letter-spacing 0.14em / color `--text3`
- **Brand label (screen-title):** 10px mono / uppercase / color `--accent`

### Cards

```css
background: var(--bg2);
border: 0.5px solid var(--border);
border-radius: 12px;   /* --radius */
overflow: hidden;
```

No glassmorphism. No `backdrop-filter`. Solid surfaces only.
Hover states use `--bg3`. Selected uses `--bg4` or `--accent-dim`.

### Navigation (bottom)

- 4 tabs: Log, Spending, Calendar, More
- SVG icons (Lucide-style, strokeWidth 1.6) — no emoji
- Active: `color: var(--accent)` + 1.5px solid amber indicator bar at top
- Inactive: `color: var(--text3)`
- Background: `--bg2`, `border-top: 0.5px solid var(--border)`
- No glow, no pill, no animation on active state

### Animations

Keep it subtle — this is a finance app, not a demo.

| Use | Spec |
|-----|------|
| Screen enter | `fadeIn 0.15s ease` |
| Progress bar fill | `transition: width 0.35–0.4s ease` |
| Button state change | `transition: all 0.15–0.2s ease` |
| Toast appear | `slideUp 0.2s ease` |

No ambient blobs. No glow pulse. No floating animations. No gradient text.
Respect `prefers-reduced-motion` (browser handles via CSS transitions).

### Spacing

- Section padding: `20px` horizontal, `20px` top
- Card row padding: `13px 16px`
- Gap between cards: `8px`
- Screen header bottom padding: `16px`
- Bottom safe area: always use `env(safe-area-inset-bottom)`

### Accent Usage

Accent (`--accent` champagne amber) is used for:
- Active nav indicator
- `screen-title` label colour
- Send button (ready state)
- Save button background
- Today cell in calendar
- Event dots
- Remaining budget (positive)

Do **not** use accent for progress bar fills (use the category colour or `--accent` for budget bar).
Do **not** add gradients to accent elements — solid only.

### What to Avoid

- Glassmorphism (`backdrop-filter`)
- Gradient fills on buttons or progress bars
- Glow / box-shadow effects on interactive elements
- Gradient text (`-webkit-background-clip: text`)
- Ambient background animations
- Emoji as structural icons (category emoji in data are acceptable)
- `backdrop-filter` anywhere
- Animations longer than 400ms
- Pure black (`#000000`) — use `--bg` (`#0e0e0f`)
- Pure white — use `--text` (`#f0ede8`)

## File Structure

```
src/
  App.jsx          # root, tab routing, toast state
  App.css          # shell, nav, screen, card, section
  index.css        # CSS tokens, global reset, keyframes
  db.js            # localStorage CRUD
  gemini.js        # Gemini API call + response parser
  utils.js         # CAT_META, PRESETS, formatRM, formatDate
  components/
    Home.jsx/css   # log screen — textarea, presets, recent
    Spending.jsx/css # budget overview + category breakdown
    Calendar.jsx/css # month grid + event list
    Settings.jsx/css # budgets, name, API key, data actions
    Toast.jsx/css  # ephemeral feedback pill
```

## Environment

```
VITE_GEMINI_API_KEY=...   # in .env.local (gitignored)
```

Also reads `localStorage.getItem('dl_gemini_key')` as fallback.
