# Scroll clipping fix + entry edit/delete — Design

Date: 2026-07-10

## Problem 1: Scroll clipping

`.bottom-nav` is `position: fixed`, removed from flow. `.app` is `display:flex; flex-direction:column`, so `.app-body` (`flex:1`) fills the *entire* remaining height, extending underneath the fixed nav rather than stopping above it. Any scroll container's last ~80px of content is unreachable.

Scroll containers affected:
- `.app-body` (App.css) — backs Insights.jsx and Settings.jsx (`<div className="screen">` directly)
- `.home-screen` (Home.css) — Home's own scroll wrapper, already has a hardcoded `padding-bottom: 3rem`
- `.spend-overlay-full` (Home.css) — the live "Spending detail" view (donut/bars/stat-grid), embedded inline in Home via shared-element expand; has hardcoded `padding: 52px 20px 40px`
- `.cal-overlay-full` (Home.css) — the live "Calendar detail" view, same expand pattern

`Spending.jsx`'s own `.screen` root is **not** a live scroll container — that component isn't imported by `App.jsx` (confirmed via grep); only `DonutChart` is imported from it. It's dead code from an earlier redesign pass and out of scope here.

### Fix

Don't hardcode a guessed pixel value for the nav height (it depends on font metrics / future edits). Instead measure it live:

- In `App.jsx`, attach a `ref` to `.bottom-nav` and a `ResizeObserver` (set up once, in a `useEffect`) that writes the observed height as `--tabbar-height` (px string) onto the `.app` root's inline style.
- `.bottom-nav` itself is unchanged — it's already correct.
- Add `padding-bottom: var(--tabbar-height)` to the four containers above, replacing their existing hardcoded bottom padding (`3rem` / `40px`) — the var *is* the full clearance needed, no additive fudge factor.
- Default/fallback: initialize the CSS var to a sane static value (e.g. `84px`, matching current nav's rendered height) before the first observer callback fires, so there's no flash of clipped content before JS measures.

### Verification
Run dev server, scroll each of the 4 screens (Log/Home, Insights, Settings, and the Spending-detail + Calendar-detail overlays reached from Home) to the very bottom and confirm the last row/element fully clears the nav and is tappable.

## Problem 2: Edit/delete log entries

### Data layer
`db.js` has `updateExpense`, `deleteExpense`, `updateEvent`, `deleteEvent`, `deleteIncome` — but **no `updateIncome`**. Add it, mirroring `updateExpense`'s shape (Supabase update + cache patch, `setOffline(true)` on failure).

### New shared component: `EditEntrySheet`
A new file, `src/components/EditEntrySheet.jsx` (+ reuses `Sheet.css` classes, no new stylesheet needed unless a field layout doesn't already have a class). Renders inside the existing `<Sheet>` component (bottom slide-up, matches Add-expense/Add-income sheets already in the app).

Props: `entry` (the row being edited, with a `_type` of `'expense' | 'income' | 'event'`), `onSave(updates)`, `onDelete()`, `onClose()`.

Fields by type:
- **expense**: description, amount, category (`CATEGORIES`), date, notes
- **income**: description, amount, category (`INCOME_CATEGORIES`), date, notes
- **event**: title, date, time, category (optional), notes

Footer: `sheet-actions` with a red-text "Delete" button (styled like Settings' "Clear all data" destructive action) which opens `ConfirmDialog` (existing component, `danger` prop) before actually calling delete. Separately, a normal Save button persists edits.

### Spending-detail entries list (Home.jsx spend-overlay-full)
- `buildTab()` (inside `loadSpendOverview`) currently discards the raw `exp`/`inc` arrays after computing aggregates. Extend it to also return `items`: expense + income rows merged, each tagged `_type`, sorted by `date` descending.
- `avg` tab's `items` is `[]` (it's a synthetic 6-month average — no real rows to edit) — the Entries section is hidden entirely when `spendTab === 'avg'`.
- New section rendered below the existing `.spend-stat-grid`, reusing `.card` / `.entry-row` styling from Home's Recent list for visual consistency. Rows tappable → open `EditEntrySheet` for that row.
- On save: call `db.updateExpense`/`db.updateIncome` → `loadSpendOverview()` to refresh aggregates + list → `showToast('Updated')`.
- On delete: call `db.deleteExpense`/`db.deleteIncome` → `loadSpendOverview()` → `showToast('Deleted')`.

### Upcoming event cards (Home.jsx upcoming strip)
- Each `.upcoming-pill` becomes tappable, opening `EditEntrySheet` with `_type: 'event'` for that item.
- On save: `db.updateEvent` → `refreshRecent()` (repopulates `upcoming` + `recent`) → toast.
- On delete: `db.deleteEvent` → `refreshRecent()` → toast.
- Home's "Recent" section (mixed expense/income/event list further down) is explicitly **out of scope** — stays read-only.

### Out of scope
- `Spending.jsx` (orphaned/unrouted) is not touched or wired up.
- No changes to Insights.jsx.
