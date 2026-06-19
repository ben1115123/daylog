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

3 tabs, each `flex: 1` (33% width):

| Tab | id | Component | Icon |
|-----|----|-----------|------|
| Log | `home` | `Home.jsx` | `NavLogIcon` |
| Insights | `insights` | `Insights.jsx` | `NavInsightsIcon` |
| Settings | `settings` | `Settings.jsx` (no `onBack`, no gear icon — direct tab) | `NavSettingsIcon` |

`Spending.jsx` and `Calendar.jsx` are **not** nav tabs. They're reached from Home via shared-element expand overlays:
- Spending summary card on Home → custom expand overview (uses `DonutChart` exported from `Spending.jsx`, not the whole screen)
- Upcoming-events strip on Home → expands into `<Calendar/>` embedded inline

```css
.bottom-nav  { padding-top: 10px; padding-bottom: env(safe-area-inset-bottom, 16px); padding-left: env(safe-area-inset-left, 0px); padding-right: env(safe-area-inset-right, 0px); gap: 4px; }
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
| Progress bar fill | count-up via `useCountUp` hook, 1.2s ease-out cubic |
| Button state | `transition: all 0.15–0.18s ease` |
| Toast appear | `slideUp 0.18s ease` |
| Hover states | `transition: color/background 0.12–0.15s ease` |
| Splash logo in | `splashIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Home header collapse | `0.4s cubic-bezier(0.4, 0, 0.2, 1)` on max-height + opacity |
| Send burst rings | `sendRing1/2` keyframes, 0.5s + 0.7s, border: 2px solid #58a6ff |
| Chip ripple | `chipRippleAnim` 0.5s scale(0) → scale(4) opacity 0 |
| Entry stagger | `0.5s ease` opacity + translateY, 150ms between items |

All animations guarded by `@media (prefers-reduced-motion: reduce)`.

### DL Logo Mark

`src/components/DLMark.jsx` — shared logo used in Splash + all screen headers.
- Italic bold **D** in `#e6edf3` + light **L** in `#58a6ff`, Georgia serif
- CSS in `src/index.css` (`.dl-mark`, `.dl-mark em`, `.dl-mark b`)
- In screen headers: `.screen-dl-mark { font-size: 18px }` wrapper in `App.css`
- In Home topbar: `.home-brand` wrapper (22px → 16px on scroll)
- In Splash: `.splash-logo` wrapper (56px)

### Splash Screen

`src/components/Splash.jsx` / `Splash.css` — Siri-style orbiting-ellipse splash, shown for 2.2s on every app open.
- Rendered in `App.jsx` before the main app (before onboarding check)
- Black `#000` background. 4 blurred SVG ellipses (`rx:72 ry:20`) orbit the centre at different speeds/angles (`#0066ff` 8s CW, `#ff5500` 6s CCW @60deg, `#00e5ff` 10s CW @120deg, white highlight 3px 5s CW), each behind a `feGaussianBlur` filter + a radial-gradient glow circle
- Radial-gradient vignette + top/bottom linear fades keep the centre (DL logo, 44px Georgia) and screen edges clean against the glow
- Tagline "your day · your money" + 3 loading dots (first pulses blue) fade in at 500ms
- Animation sequence: logo spring-in 0ms → tagline/dots 500ms → fade-out 1850ms → done 2200ms

### Custom Hooks

`src/hooks/useCountUp.js` — `useCountUp(target, duration=1200)` → animated integer (ease-out cubic). Re-triggers when `target` changes (month switch).

`src/hooks/useStaggeredEntries.js` — `useStaggeredEntries(items)` → `isVisible(index)` function. Apply `.stagger-item` + `.stagger-vis` CSS classes to rows.

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
  holidays.js          # Malaysia public holiday lookup — getHolidays(year), loadHolidaysForCalendar(year, month)
  hooks/
    useCountUp.js           # count-up animation hook (Spending hero numbers)
    useStaggeredEntries.js  # staggered fade-up hook (Home recent, Spending expenses)
  components/
    DLMark.jsx         # shared DL logo mark (italic D + light L, Georgia serif)
    Splash.jsx/css     # 1.9s launch splash — DL logo, wordmark, tagline, loading dots
    Home.jsx/css       # sticky collapsing header, input, burst send, chip ripple, stagger recent
    Spending.jsx/css   # budget hero (count-up), category breakdown, stagger expense list
    Calendar.jsx/css   # month grid + event list, multi-day span bars, holiday dots
    Settings.jsx/css   # budgets, name, API key, data actions (SVG category icons)
    Toast.jsx/css      # ephemeral feedback (mono text, dark surface)
```

## Architecture

- **expenses / events / income** → Supabase (`expenses`, `events`, `income`, `recurring_income` tables). All db methods are async. `expenses` and `income` have an optional `notes text` column.
- **settings / budgets** → localStorage only. Synchronous, no change.
- **Income categories**: `salary` (#58a6ff) and `trading` (#4ade80) — separate from expense CATEGORIES, defined in `INCOME_CATEGORIES` in utils.js.
- **Offline fallback** → after each fetch, cache to `dl_cache_expenses` / `dl_cache_events` / `dl_cache_income` / `dl_cache_recurring_income`. If Supabase fails, use cache silently. Offline state broadcast via `daylog:offline` window event; App.jsx shows `.offline-badge`.
- **One-time migration** → on app load, if `dl_expenses` / `dl_events` keys exist in localStorage, bulk insert to Supabase, then clear old keys.
- **Schema** → `supabase-schema.sql` (run once in Supabase Dashboard → SQL Editor). Includes `ALTER TABLE` migrations — safe to re-run.
- **Recurring event expansion** → `expandEvents(baseEvents)` is a pure sync function; Calendar.jsx keeps base events in state and computes expanded view via `useMemo`.

### Multi-day events
- `events.end_date` (date, nullable) — when set and later than `date`, the event spans a range.
- Add/Edit event forms in Calendar.jsx have a "Multi-day event" toggle that reveals an end-date picker.
- The month grid renders a coloured span bar (`.cal-span-bars` / `.cal-span-bar`) across each day the event covers, with rounded ends only on the start/end day.
- `ai.js` parses ranges like "team trip fri to sun" into `event.date` (start) + `event.endDate`, mapped to `end_date` by `db.addEvent`.

### Malaysia public holidays
- `src/holidays.js` → `loadHolidaysForCalendar(year, month)`, called from Calendar.jsx on year/month change.
- Tries Nager.Date (`date.nager.at/api/v3/PublicHolidays/{year}/MY`) first, caches result in `localStorage` as `dl_holidays_{year}`.
- **Nager.Date does not currently support Malaysia** (MY absent from `AvailableCountries`, 204 on every request) — falls back to a bundled `FALLBACK_HOLIDAYS` map (national + Selangor/MY-10 + KL/MY-14). Update this map yearly; Islamic dates shift.
- Grid shows a muted amber dot (`.holiday-dot`) on holiday dates; tapping the date shows the holiday name (`.holiday-label`) above the day's event list.
- December auto-fetches next year's holidays too.

### Apple Calendar sync (CalDAV)
- `supabase/functions/sync-calendar/index.ts` — Deno Edge Function. Connects to `caldav.icloud.com` using `APPLE_ID` / `APPLE_APP_PASSWORD` Edge Function secrets (never exposed to the client).
  - `action: 'add'` — discovers the user's calendar collection (PROPFIND principal → calendar-home-set → first VEVENT-capable calendar), builds an iCal VEVENT (with `VALARM` if `reminder_minutes` set), PUTs it, returns `{ success, uid }` where `uid` is the full CalDAV resource URL.
  - `action: 'delete'` — DELETEs the stored resource URL (`event.apple_uid`).
- `db.js` → `syncToAppleCalendar(action, event)` is called (fire-and-forget, errors swallowed) after `addEvent`/before `deleteEvent`. On successful add, `events.apple_uid` is updated with the returned resource URL so delete can target it later.
- `events.reminder_minutes` (integer, nullable) — set via the "Remind me" dropdown (None / 15m / 30m / 1h / 1 day) in the event sheet, passed through to the VALARM trigger.
- Deploy: `supabase functions deploy sync-calendar`. Secrets: `supabase secrets set APPLE_ID=... APPLE_APP_PASSWORD=...` (use an app-specific password from appleid.apple.com).

## Environment

```
VITE_ANTHROPIC_API_KEY=...    # .env.local — gitignored
VITE_SUPABASE_URL=...         # .env.local — gitignored
VITE_SUPABASE_ANON_KEY=...    # .env.local — gitignored
```

Add all three to Vercel environment variables dashboard.
