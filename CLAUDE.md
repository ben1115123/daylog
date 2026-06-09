# DayLog — CLAUDE.md

Smart calendar and spending tracker PWA. React + Vite. AI parsing via Anthropic Claude API (claude-haiku-4-5-20251001).

## Stack

- React 18, Vite 5, date-fns 3
- PWA via vite-plugin-pwa
- No UI library — all custom CSS
- Storage: Supabase (expenses + events) via `src/db.js`; localStorage for settings/budgets/income only
- AI: `src/ai.js` → Anthropic Messages API (`claude-haiku-4-5-20251001`)
- Icons: `src/Icons.jsx` — SVG components only, no emoji anywhere

## Commands

```bash
npm run dev      # dev server — localhost:5173
npm run build    # production build
npm run preview  # preview build
```

---

## Design Language

**Concept:** Award-winning dark product. Think Linear meets Mercury. Every pixel earns its place. The accent colour is a statement, used sparingly. Nothing decorative.

**Palette inspiration:** Zinc-950 dark (cooler, bluer near-black) with emerald sage accent — unusual for finance, intentionally distinctive. The green pops on dark zinc in a way warm stone never could.

---

### Colour Tokens (`src/index.css`)

| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#09090b` | App background — zinc-950 |
| `--bg2` | `#111113` | Card / elevated surface |
| `--bg3` | `#18181b` | Hover / active state |
| `--bg4` | `#27272a` | Track backgrounds / deep selected |
| `--border` | `rgba(255,255,255,0.06)` | Hairline borders |
| `--border2` | `rgba(255,255,255,0.13)` | Visible borders |
| `--text` | `#fafafa` | Primary — clean zinc-50 |
| `--text2` | `#a1a1aa` | Secondary — zinc-400 |
| `--text3` | `#52525b` | Tertiary / disabled / labels — zinc-600 |
| `--accent` | `#86efac` | Emerald sage — the *only* accent |
| `--accent-on` | `#052e16` | Text on accent backgrounds |
| `--accent-dim` | `rgba(134,239,172,0.08)` | Tinted surfaces (nav pill, selected states) |
| `--accent-border` | `rgba(134,239,172,0.20)` | Accent-tinted borders |
| `--red` | `#f87171` | Destructive / over-budget |
| `--amber` | `#fbbf24` | Warning |

**Accent rule:** `--accent` is emerald sage `#86efac`. Used sparingly — nav active pill, send button ready state, today date chip, remaining budget when positive, progress bar default. Never use it decoratively. Never introduce a second accent.

### Category Colours (Tailwind 400 palette)

| Category | Token | Value |
|----------|-------|-------|
| food | `--cat-food` | `#fb923c` |
| transport | `--cat-transport` | `#60a5fa` |
| grocery | `--cat-grocery` | `#f472b6` |
| rental | `--cat-rental` | `#a78bfa` |
| subscription | `--cat-subscription` | `#34d399` |
| sports | `--cat-sports` | `#facc15` |
| shopping | `--cat-shopping` | `#f87171` |

Icon bg tint formula: `color + '18'` (hex alpha ~9%). Always pair icon color + icon bg tint together.

---

### Typography

| Role | Font | Notes |
|------|------|-------|
| Display / headings / brand | Space Grotesk 300–700 | App name, screen headings, hero greeting |
| Body / UI | Inter 300–500 | Labels, descriptions, body text |
| Numbers / Dates / Mono labels | JetBrains Mono 300–500 | Amounts, dates, section labels, metadata |

**Rules:**
- `font-variant-numeric: tabular-nums` on all monetary and numeric display
- Space Grotesk for anything that needs character: screen headings (24px 600), hero greeting (48px 700), nav labels (9px 500 uppercase), save button
- JetBrains Mono for everything data-forward: amounts, percentages, dates, times, category labels, hints
- Section labels: 10px mono, uppercase, `letter-spacing: 0.16em`, color `--text3`
- Screen labels (subtitle above heading): 10px mono, `--text3`, `letter-spacing: 0.16em`, uppercase
- Screen headings: 24px Space Grotesk 600, `letter-spacing: -0.02em`

---

### Home Screen

The Home screen does **not** use `.screen-header`. Structure:

```
home-topbar      ← DAYLOG brand (accent, 11px, 700, 0.20em) | date (mono, text3)
home-hero        ← two-line greeting + mono date string, bordered bottom
home-input-wrap  ← borderless textarea + footer bar, bordered bottom
section: Quick log  ← preset-chip pills (dot + label)
section: Recent     ← entry-row with icon-wrap (svg icon + color bg tint)
```

**Greeting hierarchy:**
- `.home-subgreeting`: Space Grotesk 400, 18px, text2 — "Good morning,"
- `.home-greeting`: Space Grotesk 700, 48px, text — "Ben."
- `.home-datestr`: mono 11px, text3 — "Friday, 5 June"

**Entry icon wrap:** `width: 30px; height: 30px; border-radius: 6px` — holds SVG icon at 14px, colored with category color, bg = `color + '18'`.

---

### Spending Screen

```
screen-header: "Overview" label + "Spending" heading + month nav (SVG chevrons)

budget-hero card:
  spent (Space Grotesk 600, 32px)    remaining (accent when positive)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  (2px track)
  72% of RM 4,000 budget             14 entries

category rows: icon-wrap (30x30, rounded-xs, color+tint) + name + amounts + 2px track bar
expense rows: same icon-wrap pattern + title + sub + amount right
```

Progress track height: **2px**. Slightly heavier than before — balanced against the Space Grotesk number weight.

---

### Navigation

```css
.bottom-nav  { justify-content: space-around; padding: 6px 8px calc(6px + env(safe-area-inset-bottom)); gap: 4px; }
.nav-item    { flex: 1; padding: 8px 4px; border-radius: 10px; }
.nav-item.active { color: var(--accent); background: var(--accent-dim); }
.nav-label   { font-family: var(--font-display); font-size: 9px; font-weight: 500; letter-spacing: 0.08em; }
```

Active state: `color: var(--accent)` + subtle pill `background: var(--accent-dim)`. No line indicator. No animation. No scale effect.

---

### Cards

```css
background: var(--bg2);
border: 0.5px solid var(--border);
border-radius: 12px;
overflow: hidden;
```

**No glassmorphism.** No `backdrop-filter`. No box-shadow. No gradients. Solid surfaces only.
State layers: hover → `--bg3`. Selected → `--accent-dim` + `--accent-border` outline.

---

### Animations

| What | Spec |
|------|------|
| Screen enter | `fadeIn 0.15s ease` (slight Y translate) |
| Progress bar fill | `transition: width 0.35–0.4s ease` |
| Button state | `transition: all 0.15–0.18s ease` |
| Toast appear | `slideUp 0.18s ease` |
| Hover states | `transition: color/background 0.12–0.15s ease` |

No ambient animations. No floating. No glow. No gradient shimmer. Nothing decorative.

---

### Spacing System

| Context | Value |
|---------|-------|
| Screen-header padding | `max(52px, ...) 24px 20px` |
| Section horizontal padding | `20px` |
| Section top spacing | `28px` |
| Card row padding | `13px 16px` |
| Between cards | `8px` |
| Bottom content padding | `2.5rem` |

---

### What Never Belongs in This Codebase

- Emoji anywhere — UI, icons, empty states, toasts (use SVG from `src/Icons.jsx`)
- `backdrop-filter` / glassmorphism
- `box-shadow` (not even subtle ones)
- Gradient fills — buttons, progress bars, backgrounds, text
- `-webkit-background-clip: text` gradient text
- Ambient background animations or blob elements
- Glow effects
- Any animation > 400ms
- Bright accent colours other than `--accent` (#86efac)
- Multiple accent colours
- Pure black `#000000` or pure white `#ffffff`

---

## File Structure

```
src/
  App.jsx              # root shell, tab router, toast, offline badge, migration
  App.css              # app shell, bottom nav, screen-header, card, section, offline-badge
  index.css            # design tokens, global reset, keyframes, .spinner/.loading-wrap
  Icons.jsx            # ALL SVG icon components — category icons + action icons
  db.js                # Supabase CRUD (expenses, events) + localStorage (settings, budgets, income)
                       # Exports: db, expandEvents (sync), computeRecentMonths (sync), offlineMode
  supabase.js          # Supabase client (createClient from env vars)
  ai.js                # Anthropic Messages API (claude-haiku-4-5-20251001) + response parser
  utils.js             # CAT_META (no emoji — label + color only), CATEGORIES (18 incl. investment), QUICK_CHIPS, formatRM, formatDate, formatTime
  components/
    Home.jsx/css       # topbar + two-line hero greeting + borderless input + preset chips + recent
    Spending.jsx/css   # budget hero + category breakdown + expense list (all SVG icons)
    Calendar.jsx/css   # month grid + event list (SVG nav arrows)
    Settings.jsx/css   # budgets, name, API key, data actions (SVG category icons)
    Toast.jsx/css      # ephemeral feedback (mono text, dark surface)
```

## Architecture

- **expenses / events** → Supabase (`expenses`, `events` tables). All db methods are async.
- **settings / budgets / income** → localStorage only. Synchronous, no change.
- **Offline fallback** → after each fetch, cache to `dl_cache_expenses` / `dl_cache_events`. If Supabase fails, use cache silently. Offline state broadcast via `daylog:offline` window event; App.jsx shows `.offline-badge`.
- **One-time migration** → on app load, if `dl_expenses` / `dl_events` keys exist in localStorage, bulk insert to Supabase, then clear old keys.
- **Schema** → `supabase-schema.sql` (run once in Supabase Dashboard → SQL Editor).
- **Recurring event expansion** → `expandEvents(baseEvents)` is a pure sync function; Calendar.jsx keeps base events in state and computes expanded view via `useMemo`.

## Environment

```
VITE_ANTHROPIC_API_KEY=...    # .env.local — gitignored
VITE_SUPABASE_URL=...         # .env.local — gitignored
VITE_SUPABASE_ANON_KEY=...    # .env.local — gitignored
```

Add all three to Vercel environment variables dashboard.
