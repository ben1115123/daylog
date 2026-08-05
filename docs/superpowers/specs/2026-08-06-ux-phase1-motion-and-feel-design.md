# UX Revamp Phase 1 — Motion & Feel

**Date:** 2026-08-06
**Branch:** `ux-phase1`
**Status:** approved

## Goal

DayLog is functionally complete but feels static: tabs swap hard, overlays and
sheets appear without a sense of where they came from, loading is a spinner,
logging an entry blocks on a network round trip, and numbers snap to their new
value. This phase is about *feel* only. No new features, no data model changes
beyond what motion needs.

## Constraints

These come from `CLAUDE.md` and are not negotiable in this phase:

- Flat surfaces. No `box-shadow`, no `backdrop-filter`, no gradients, no glow.
- No animation longer than 400ms. The existing 1.2s count-up on mount is the
  one documented exception and stays.
- `--accent` is `#58a6ff`. No green, no second accent.
- `viewport-fit=cover` and the `env(safe-area-inset-*)` padding stay as they are.
- All date maths goes through `src/lib/dates.js`. No `new Date()` arithmetic.
- Every animation is disabled under `prefers-reduced-motion: reduce`, and the UI
  stays fully functional and reachable without it.

## Corrections to the original brief

Three premises in the request did not match the code. Two were wrong, one right:

1. **"Overlay sheets appear instantly."** They do not. `useExpand()` in
   `Home.jsx` runs a shared-element expand — it captures the tapped card's
   rect and animates `top/left/width/height` to fullscreen over **450ms**,
   which is itself over the 400ms budget. Decision: keep the expand, retune it.
2. **"Reuse Sheet.jsx's gesture disambiguation."** `Sheet.jsx` has none. Its
   drag is touch-only, starts on any `touchstart`, and works today only because
   `.sheet-drag-region` is the handle plus header with no scroller under it.
   The axis-lock disambiguation lives in `InsightsMonthDetail.jsx`. Decision:
   extract one shared hook and adopt it in all four places.
3. **"The fast-spring easing already used by Sheet.jsx."** Correct.
   `Sheet.css` line 20: `animation: sheetUp 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)`.
   This is the canonical spring token for the phase.

## Shared modules

Three pieces of shared machinery, so six features do not grow six
implementations.

### `src/hooks/useDragDismiss.js`

Pointer-event drag with axis locking.

```
useDragDismiss({ axis = 'y', threshold = 80, onDismiss, enabled = true })
  → { handlers, offset, dragging }
```

- Pointer events, not touch events — one code path for finger, mouse and pen.
- Axis is locked **once**, after an 8px slop, and never revisited. A diagonal
  drift part-way through a scroll cannot start dragging the sheet.
- Only drags in the positive direction for `axis: 'y'` (down-to-dismiss);
  the horizontal variant drags both ways for month paging.
- `offset` is the live pixel delta for the consumer to apply as a transform.
  The hook never touches the DOM itself.
- Under `prefers-reduced-motion`, dragging past `threshold` still dismisses;
  only the follow-the-finger transform and the spring-back are dropped.

Consumers: `Sheet.jsx`, the spending overlay, the calendar overlay, and
`InsightsMonthDetail.jsx` (which replaces its inline copy of this logic).

### `src/components/Skeleton.jsx` + `Skeleton.css`

One primitive: `<Skeleton w h r />` — a `--bg2` block with an opacity pulse
(1.4s, `0.5 → 1 → 0.5`). Pulse is opacity only. No shimmer sweep, because a
travelling highlight is a gradient and gradients are banned.

### `useCountUp` (extended)

```
useCountUp(target, { mount = 1200, change = 400 })
```

Currently resets to `0` and counts up on every target change. It will instead
animate **from the value it is currently showing** to the new target: 1200ms
on first paint (unchanged behaviour), 400ms for every later change. Under
reduced motion it returns `target` directly.

## Features

### 1. Tab transitions

`App.jsx` fades `.app-body` out, swaps the mounted screen, fades it back in:
80ms out, 100ms in, 180ms total.

Not a simultaneous crossfade. A true crossfade requires both screens mounted at
once, which fires both components' Supabase fetches on every tab press. The
sequential fade is visually equivalent at this duration and costs nothing.

The nav pill's active state is unchanged — it switches immediately, so the tap
feels acknowledged before the screen has finished swapping.

### 2. Overlays as proper sheets

`useExpand()` keeps its shared-element expand. Changes:

- Open: 450ms → **320ms `cubic-bezier(0.34, 1.56, 0.64, 1)`** (the `sheetUp`
  token). The overshoot pushes the overlay slightly past the viewport edge
  mid-flight, which is invisible.
- Close: **280ms `cubic-bezier(0.32, 0.72, 0, 1)`**. Deliberately *not* the
  overshoot curve — closing runs fullscreen → card rect, and an overshoot there
  would shrink the overlay below the card before settling back up.
- `useExpand`'s hardcoded `setTimeout(() => setPhase('closed'), 460)` drops to
  match the new close duration.
- `useDragDismiss({ axis: 'y' })` on the overlay body translates it down under
  the finger. Past 80px it calls `close()`, so a swipe-down still reverses the
  expand back into the originating card rather than sliding off-screen.

### 3. Skeleton states

Four skeleton layouts replace four `.loading-wrap` spinners:

| Screen | Replaces | Mirrors |
|--------|----------|---------|
| Home spending card | `Home.jsx:48` | `.spend-summary` rows |
| Home upcoming pills | `Home.jsx:574` | `.upcoming-pill` × 3 |
| Home entries list | `Home.jsx:495` | `.entry-row` × 4 |
| Insights charts | `Insights.jsx:224` | trend card, income card, stat pair |

**Requirement: zero layout shift.** Each skeleton is built from the *same*
container classes as the real markup with heights fixed to the real content's
height. Verified by measuring the bounding box of each container before and
after data lands — the delta must be 0.

### 4. Optimistic logging

Three entry points: NLP send (`Home.jsx handleSend`), quick-log
(`Home.jsx handleLogAmount`), and sheet save — meaning the four sheets that
create an entry: quick-log amount (`Home.jsx:767`), New expense
(`Spending.jsx:173`), Log income (`Spending.jsx:247`), New event
(`Calendar.jsx:162`). The two recurring-rule sheets in `Settings.jsx` create
schedules, not entries, and are out of scope.

Flow: insert a provisional row with a temporary id into `recent` / `upcoming`,
adjust the displayed totals, then run the Supabase write. On success, swap the
provisional row for the real one. On failure, remove it and show an error
toast. The write never blocks the UI.

NLP is optimistic only *after* `parseInput` resolves — the entry is unknown
until Claude answers, so what is saved there is the database round trip, not
the parse. Quick-log and sheet save are optimistic from the tap.

**Undo cooperation.** The existing UNDO toast deletes by `row.id`. With an
optimistic insert that id may still be temporary when UNDO is tapped. Each
provisional entry therefore carries its pending write promise; UNDO awaits that
promise, then deletes the *resolved* id.

This race is the highest-risk part of the phase and gets an explicit
verification step, not an incidental one — see Verification below.

### 5. Number transitions on change

`useCountUp` per above. Applied to Spending's three hero numbers
(`Spending.jsx:467-469`) and Home's spending card total, so that logging,
editing, deleting and undoing all ease the number rather than snapping it.

### 6. Reduced motion

New CSS joins the existing `@media (prefers-reduced-motion: reduce)` blocks in
each stylesheet. The two JS-driven animations check `matchMedia` directly,
since neither can be gated by CSS:

- `useCountUp` returns `target` immediately.
- `useDragDismiss` still dismisses past the threshold; it drops the
  follow-the-finger transform and the spring-back.

## Verification

Build must pass, and each item gets an on-device iOS Safari check. Two steps
are called out because they are where this phase can quietly break things.

### V1 — Optimistic/undo race (named step, blocking)

1. Log an entry.
2. Tap UNDO within ~1 second — before the Supabase write has resolved.
3. Query Supabase directly and confirm the row is **actually deleted**, not
   merely removed from the UI while an orphan row persists in the database.

Run for all three entry points (NLP, quick-log, sheet save) and for the
failure path (write rejects → row disappears, error toast shows).

### V2 — Every sheet call site after the gesture swap (named step, blocking)

Pointer events do not behave like touch events on iOS Safari, particularly
around `touch-action` and whether a drag initiates when it starts over a
scrollable child. `.sheet-drag-region` currently carries `touch-action: none`.

Walk all six call sites and confirm each still opens, drags, and dismisses:

| Sheet | File |
|-------|------|
| Log \<chip\> (quick-log) | `Home.jsx:767` |
| New event | `Calendar.jsx:162` |
| New recurring expense | `Settings.jsx:22` |
| New recurring income | `Settings.jsx:91` |
| New expense | `Spending.jsx:173` |
| Log income | `Spending.jsx:247` |

Also confirm the keyboard handling is intact: focusing a field still scrolls it
above the keyboard, and the sheet still lifts by `visualViewport` offset.

### V3 — General

- `npm run build` clean.
- No animation or transition over 400ms anywhere (excluding the documented
  1.2s mount count-up).
- Zero layout shift when skeletons are replaced by real data.
- Under `prefers-reduced-motion: reduce`, every screen and overlay is reachable
  and every control works.

## Out of scope

Nothing here changes what the app *does*. No new screens, no schema changes, no
Apple Calendar work, no changes to parsing. Phase 2 items from the roadmap are
not started.
