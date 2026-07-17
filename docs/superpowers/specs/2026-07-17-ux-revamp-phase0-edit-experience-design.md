# DayLog UX Revamp — Phase 0: Edit Experience Overhaul

Status: approved, ready for planning
Branch: `ux-revamp`
Scope: this spec covers Phase 0 only (edit sheet + undo). Phases 1-5 (motion, log flow, information hierarchy, visual identity, PWA polish) from the original request are a backlog to be spec'd separately after Phase 0 ships and is verified on-device.

## Context

`EditEntrySheet.jsx` works but is basic: plain number input for amount, a `<select>` dropdown for category, a bare date input, no gesture dismissal, no undo. This phase makes editing/deleting/logging entries feel first-class while keeping every existing capability (expense/income/event editing, delete-with-confirm) intact.

**Constraint note:** `daylog-clean/CLAUDE.md` describes an emerald/zinc palette that does not match the actual current codebase (`src/index.css` uses `--accent: #58a6ff` blue on `#0d1117`). That nested doc is stale on color; treat the live `src/index.css` tokens as ground truth. Its flat-surface rules (no `box-shadow`, no `backdrop-filter`, no glow, animations capped at 400ms) **do** match the top-level project instructions and are treated as binding throughout this spec.

## Decisions made during brainstorming

1. **Spring vs 400ms cap**: use a fast spring curve (cubic-bezier overshoot) but clamp total sheet-open duration to ≤400ms. Reads as spring without violating the animation-length rule.
2. **Undo scope**: undo applies everywhere an entry is created, edited, or deleted — edit-sheet save/delete (Home + Spending overlay), NLP-parsed log, and preset-chip quick-log. Not spec-literal-only.
3. **Category chip layout**: horizontal-scroll single row (matches existing Home "Quick log" preset-chip pattern), not a wrapping grid.

## Correction — found during plan-writing

The original design assumed `Spending.jsx` renders an edit sheet reachable from a "Spending overlay." That's wrong. Two corrections to file scope:

1. **`Spending.jsx`'s default export is orphaned** — never imported/rendered anywhere in the app (only its named export `DonutChart` is used, by `Home.jsx`). Its inline `EditExpenseForm` and delete-confirm flow are unreachable dead code. Out of scope for Phase 0 — not touched, not fixed, just noted. (Worth a cleanup ticket later, not now — YAGNI.)
2. **The actual "spend overlay" lives inside `Home.jsx`** (`.spend-overlay-full`, opened via the `spend` `useExpand()` hook). Its expense/income list (`Home.jsx:531-630`) already shares the *same* `editingEntry` state and the *same* single `EditEntrySheet` instance (`Home.jsx:684-707`) as the "Recent" list on the base screen and the upcoming-events pills. There is exactly one edit/delete code path in the whole app, and it lives entirely in `Home.jsx`.

This simplifies Phase 0: all undo wiring for edit/delete happens once, in `Home.jsx`. `Spending.jsx` is removed from the file list below.

## Design

### 1. Toast system — generalized for undo

`Toast.jsx` currently renders a bare message string, always auto-dismisses at 3000ms, no interactive element.

- `Toast` component gains an optional `action: { label, onClick }` prop.
- When `action` is present: duration is 5000ms (was 3000ms); toast renders `{msg}` + a `toast-action` button styled as inline text-button (accent color, no border/bg of its own).
- Tapping the action button calls `onClick()` then dismisses the toast immediately (no double-fire, no waiting for the timer).
- `App.jsx`'s `showToast(msg, type)` extends to `showToast(msg, type, action)`. All ~20 existing call sites keep working unchanged since `action` is optional and defaults to `undefined`.
- Visual style unchanged otherwise: surface-2 bg, 1px border, `slideUp 0.18s ease`, positioned above the tab bar.

### 2. Undo data flow — snapshot-and-revert

No new persistence layer. Each mutation site captures state before calling `db.js`, and reverses it via a plain `db.js` call on undo. All of this lives in `Home.jsx` — see correction above.

- **Edit save** (`Home.jsx:688-696`, the `EditEntrySheet` `onSave` handler): capture the full pre-edit `editingEntry` object before calling `db.updateExpense/updateEvent/updateIncome`. Undo → re-call the matching `update*` with the captured snapshot, then `loadSpendOverview()` + `refreshRecent()` (both already-stable local `useCallback`s Home calls after every save/delete — no `onLogged()` / remount involved on this path).
- **Delete** (`Home.jsx:697-705`, `onDelete` handler): capture the full entry object before calling `db.delete*`. Undo → call the matching `db.add*` with the snapshot's fields. This re-inserts as a **new row with a new id** (Supabase auto-generates ids on insert; `db.js` has no id-preserving insert path). Data content is identical; id is not. Accepted, standard re-insert-on-undo tradeoff — not a bug to fix. Then `loadSpendOverview()` + `refreshRecent()`, same as above.
- **NLP log** (`Home.jsx:227-248`, `handleSend`): `db.addExpense/addEvent/addIncome` currently discard their return value — change to capture the created row(s). `onLogged()` is called right after logging, which changes `App.jsx`'s `refresh` key and **fully remounts `Home`**. The undo closure passed to `showToast` must therefore only close over stable, App-owned things — `db`, the captured row id(s), and `onLogged` (a stable `useCallback` in `App.jsx`) — never Home's local `setRecent`/`refreshRecent`, which belong to the pre-remount instance and would silently no-op after remount. Undo → `db.delete*(id)` for each logged row, then `onLogged()` to force the fresh remount/reload that reflects the deletion.
- **Preset quick-log** (`Home.jsx:270-283`, `handleLogAmount`): same pattern and same remount constraint as NLP log — capture the returned row, undo deletes it by id then calls `onLogged()`.
- On the edit/delete path (no remount), the mutation site is responsible for its own local state revert as today. On the log path (remount happens), undo relies on the remount's fresh data load instead of local state patching.

### 3. EditEntrySheet rebuild

**Amount editor** — new `AmountInput` sub-component, expense/income only (events have no amount):
- Large mono display at top of sheet (~40px, matches existing `.big-number` styling), tap anywhere in it to focus the underlying input.
- `inputMode="decimal"` for the correct iOS numeric keyboard.
- `onFocus` selects all existing text so typing replaces rather than appends.
- Live thousand-separator formatting as digits are typed: raw numeric value kept in state, display value formatted (e.g. `1,000` while typing, not just on blur).

**Category picker** — new `CategoryChipRow` sub-component:
- Horizontal-scroll row of pill chips, one per category. Each chip = color dot (`CAT_META[cat].color`) + icon (`CAT_ICONS[cat]`, already exists — no new icon work) + label.
- Selected chip: `background: rgba(88,166,255,0.15)`, `border-color: var(--accent)`.
- Tap = instant selection, no confirm step.
- On sheet open, the row auto-scrolls so the currently-selected chip is in view.
- Income entries use `INCOME_CATEGORIES`, events use `EVENT_CATS` (including a "no category" option) — same chip component, different source list, matching current `EditEntrySheet` branching.

**Date picker** — new `DateChipRow` sub-component:
- "Today" / "Yesterday" / "Custom" chips.
- Today/Yesterday set the date directly and display inline day-of-week (e.g. "Today · Thu") so the choice is self-checking without opening a calendar.
- "Custom" reveals the existing native `<input type="date">`; once a custom date is set, its chip shows the date + computed day-of-week label.
- Events additionally keep the existing time input, unchanged, alongside the date row.

**Sheet behavior** — extend `Sheet.jsx` (shared by all sheets, not just EditEntrySheet):
- Swipe-down-to-dismiss: touch handlers on the drag handle + header region, `translateY` follows the finger, release past a threshold closes, else snaps back.
- Open animation: fast spring curve, ≤400ms total (per decision #1 above).
- Keyboard-aware: `visualViewport` resize listener shifts sheet content so the save button is never hidden behind the iOS keyboard.
- Save button: full-width, `disabled` until at least one field differs from the sheet's initial snapshot, briefly swaps to a checkmark (~250ms) on successful save before the sheet closes.
- Swipe-down while there are unsaved changes → reuse the existing `ConfirmDialog` component ("Discard changes?") before actually closing; swipe-down with no changes closes immediately.

### 4. Files touched

New:
- `src/components/AmountInput.jsx`
- `src/components/CategoryChipRow.jsx`
- `src/components/DateChipRow.jsx`
- (CSS for the above likely folds into `Sheet.css` rather than new files — decide at implementation time based on size)

Modified:
- `src/components/Toast.jsx`, `Toast.css` — action slot
- `src/components/Sheet.jsx`, `Sheet.css` — swipe dismiss, keyboard-aware, spring open
- `src/components/EditEntrySheet.jsx` — wire in the three new sub-components
- `src/App.jsx` — `showToast` action param
- `src/components/Home.jsx` — undo snapshots for edit/delete (`EditEntrySheet` handlers) and NLP-log/preset-log (`handleSend`/`handleLogAmount`)

Not touched: `db.js` schema/methods, Supabase tables, Calendar/Insights/Settings visuals, `Spending.jsx` (orphaned, see correction above), any other screen's layout.

## Testing / Verification

- `npm run build` must pass after implementation.
- Manual on-device pass (iOS Safari, since that's the target runtime):
  - Keyboard-aware save button visibility on amount focus
  - Swipe-down dismiss, both with and without unsaved changes
  - Undo round-trip for all mutation paths in `Home.jsx`: expense/income/event edit, expense/income/event delete, NLP-parsed log, preset quick-log — exercised both from the base "Recent" list and from the spend-overlay list (same `EditEntrySheet` instance, both entry points)
  - Amount thousand-separator formatting: empty input, single digit, 4+ digit number, decimal entry
  - Category chip auto-scroll-to-selected on sheet open, for a category near the end of the row
- No regression check: existing Home/Spending/Calendar/Settings screens unaffected — this phase only touches the edit sheet, toast, and their direct callers.

## Out of scope (deferred to later specs)

Phases 1-5 from the original UX revamp request: tab crossfades, overlay-sheet conversion for Spending/Calendar, skeleton loading states, optimistic UI, smart suggestion chips, rotating placeholders, safe-to-spend hero number, lead-insight sentence, categorical palette expansion, serif personality, pull-to-refresh, offline write queue. These get their own brainstorm → spec → plan cycle after Phase 0 merges.
