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

## Design

### 1. Toast system — generalized for undo

`Toast.jsx` currently renders a bare message string, always auto-dismisses at 3000ms, no interactive element.

- `Toast` component gains an optional `action: { label, onClick }` prop.
- When `action` is present: duration is 5000ms (was 3000ms); toast renders `{msg}` + a `toast-action` button styled as inline text-button (accent color, no border/bg of its own).
- Tapping the action button calls `onClick()` then dismisses the toast immediately (no double-fire, no waiting for the timer).
- `App.jsx`'s `showToast(msg, type)` extends to `showToast(msg, type, action)`. All ~20 existing call sites keep working unchanged since `action` is optional and defaults to `undefined`.
- Visual style unchanged otherwise: surface-2 bg, 1px border, `slideUp 0.18s ease`, positioned above the tab bar.

### 2. Undo data flow — snapshot-and-revert

No new persistence layer. Each mutation site captures state before calling `db.js`, and reverses it via a plain `db.js` call on undo.

- **Edit save** (Home.jsx, Spending.jsx): capture the full pre-edit entry object before calling `db.updateExpense/updateEvent/updateIncome`. Undo → re-call `update*` with the captured snapshot, then revert local list state the same way the normal save path does.
- **Delete**: capture the full entry object before calling `db.delete*`. Undo → call the matching `db.add*` with the snapshot's fields. This re-inserts as a **new row with a new id** (Supabase auto-generates ids on insert; `db.js` has no id-preserving insert path). Data content is identical; id is not. This is an accepted, standard re-insert-on-undo tradeoff — not a bug to fix.
- **NLP log** (`Home.jsx` `onLogged`): the created row is already returned from `db.add*`. Undo → `db.delete*(newRow.id)`, revert local list state.
- **Preset quick-log**: same pattern as NLP log — capture returned row, undo deletes it by id.
- Every mutation site remains responsible for its own local React state revert after the undo db call resolves, mirroring how it already handles normal save/delete.

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
- `src/App.jsx` — `showToast` action param, undo wiring for NLP-logged entries
- `src/components/Home.jsx` — undo snapshots for edit/delete/NLP-log/preset-log
- `src/components/Spending.jsx` — undo snapshots for edit/delete

Not touched: `db.js` schema/methods, Supabase tables, Calendar/Insights/Settings visuals, any other screen's layout.

## Testing / Verification

- `npm run build` must pass after implementation.
- Manual on-device pass (iOS Safari, since that's the target runtime):
  - Keyboard-aware save button visibility on amount focus
  - Swipe-down dismiss, both with and without unsaved changes
  - Undo round-trip for all four mutation paths: expense edit, expense delete, NLP-parsed log, preset quick-log (and income/event edit-delete via Spending/Home)
  - Amount thousand-separator formatting: empty input, single digit, 4+ digit number, decimal entry
  - Category chip auto-scroll-to-selected on sheet open, for a category near the end of the row
- No regression check: existing Home/Spending/Calendar/Settings screens unaffected — this phase only touches the edit sheet, toast, and their direct callers.

## Out of scope (deferred to later specs)

Phases 1-5 from the original UX revamp request: tab crossfades, overlay-sheet conversion for Spending/Calendar, skeleton loading states, optimistic UI, smart suggestion chips, rotating placeholders, safe-to-spend hero number, lead-insight sentence, categorical palette expansion, serif personality, pull-to-refresh, offline write queue. These get their own brainstorm → spec → plan cycle after Phase 0 merges.
