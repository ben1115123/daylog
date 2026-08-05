# UX Revamp Phase 1: Motion & Feel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DayLog *feel* finished — crossfaded tabs, overlays that spring open and swipe closed, skeletons instead of spinners, logging that responds instantly, and numbers that ease to their new value — without adding a single feature.

**Architecture:** Three shared modules carry the phase so six features don't grow six implementations: `useDragDismiss` (one pointer-event drag with axis locking, adopted by `Sheet.jsx`, both Home overlays, and `InsightsMonthDetail`), `Skeleton` (one pulsing surface primitive), and an extended `useCountUp` that animates from its current displayed value rather than from zero. Optimistic logging is split into a pure reconciliation module (`src/lib/optimistic.js`) so the one genuinely subtle piece — an UNDO tapped before the Supabase write resolves — is unit-testable without React or a network.

**Tech Stack:** React 18 function components, plain CSS with `src/index.css` design tokens, Vite 5 build, Supabase JS client. Vitest is added in Task 8 **for `src/lib/optimistic.js` only**.

## Global Constraints

- Flat surfaces. No `box-shadow`, no `backdrop-filter`, no gradients, no glow. A skeleton pulses on **opacity only** — a travelling shimmer highlight is a gradient and is banned.
- No animation or transition longer than **400ms**. The one documented exception is the 1.2s count-up on first paint, which stays.
- `--accent` is `#58a6ff`. No green. No second accent.
- `viewport-fit=cover` in `index.html` and every `env(safe-area-inset-*)` rule stay exactly as they are.
- All date maths goes through `src/lib/dates.js`. No `new Date()` arithmetic, no `toISOString().slice(0,10)`.
- No emoji. Icons are SVG components from `src/Icons.jsx`.
- Every animation is disabled under `@media (prefers-reduced-motion: reduce)`, and the UI stays fully functional and reachable without it. The two JS-driven animations (`useCountUp`, `useDragDismiss`) check `matchMedia` directly, since neither can be gated by CSS.
- **Verification is `npm run build` plus the behaviour check written into each task.** This repo's gate has always been build + device pass; the bugs that have mattered here were integration and device-behaviour issues. Task 8 adds Vitest scoped to `src/lib/optimistic.js` and nothing else — do not extend it to components, do not add jsdom or Testing Library, do not write tests for the other tasks.
- Branch: `ux-phase1`, already created off `master`. Do not create it again.
- Spec: `docs/superpowers/specs/2026-08-06-ux-phase1-motion-and-feel-design.md`.

---

### Task 1: `useCountUp` animates from its current value

Item 5 of the spec. Do this first — it touches one hook and three call sites, and nothing else depends on it.

**Files:**
- Modify: `src/hooks/useCountUp.js` (whole file)
- Modify: `src/components/Spending.jsx:467-469`
- Modify: `src/components/Home.jsx` — the spending summary card total

**Interfaces:**
- Produces: `useCountUp(target: number, opts?: { mount?: number, change?: number }): number`. The old second-argument-is-a-duration form is gone; every call site is updated in this task.

- [ ] **Step 1: Rewrite the hook**

The current hook calls `setValue(0)` on every target change, so any change restarts from zero. Replace `src/hooks/useCountUp.js` entirely:

```js
import { useState, useEffect, useRef } from 'react'

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/* Animates to `target` from whatever is currently on screen — not from 0.
 *
 * The first real value still gets the long count-up; every later change eases
 * over `change` ms. "First real value" deliberately means the first *non-zero*
 * target: screens render with 0 while data loads, and without this a load
 * finishing would burn the mount animation on 0 -> 0 and leave the actual
 * number to snap in over 400ms. */
export function useCountUp(target, { mount = 1200, change = 400 } = {}) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)
  const shownRef = useRef(0)
  const hasCountedUpRef = useRef(false)

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    const from = shownRef.current
    const to = Number.isFinite(target) ? target : 0
    const duration = hasCountedUpRef.current ? change : mount
    if (to !== 0) hasCountedUpRef.current = true

    if (from === to || prefersReducedMotion()) {
      shownRef.current = to
      setValue(to)
      return
    }

    const start = performance.now()
    const tick = now => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const v = Math.round(from + (to - from) * eased)
      shownRef.current = v
      setValue(v)
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, mount, change])

  return value
}
```

- [ ] **Step 2: Update the Spending call sites**

`src/components/Spending.jsx:467-469` currently passes a bare number:

```js
  const animTotal     = useCountUp(loadingData ? 0 : total, 1200)
  const animRemaining = useCountUp(loadingData ? 0 : Math.abs(remaining), 1200)
  const animPct       = useCountUp(loadingData ? 0 : pct, 1200)
```

Replace with:

```js
  const animTotal     = useCountUp(loadingData ? 0 : total)
  const animRemaining = useCountUp(loadingData ? 0 : Math.abs(remaining))
  const animPct       = useCountUp(loadingData ? 0 : pct)
```

The defaults are `{ mount: 1200, change: 400 }`, so first paint is unchanged.

- [ ] **Step 3: Animate Home's spending card total**

Find the spending summary card in `src/components/Home.jsx` (the component rendering "THIS MONTH" and the `RM <total>` figure — around `Home.jsx:48`, the one that early-returns `<div className="loading-wrap">` when `!data`). Import the hook and wrap the total:

```js
import { useCountUp } from '../hooks/useCountUp.js'
```

Then inside that component, replace the raw total with the animated one. The figure must keep `font-variant-numeric: tabular-nums` so the digits don't jitter mid-count — confirm the existing class already sets it, and add it if not.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: clean.

Then `npm run dev` and check by hand:
1. Open Spending. The three hero numbers count up from 0 over ~1.2s. Unchanged from today.
2. Change month with the chevrons. The numbers now ease from the old month's value to the new one over ~400ms — they must **not** drop to 0 first.
3. In devtools, emulate `prefers-reduced-motion: reduce` and reload. Numbers appear at their final value immediately, no animation.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCountUp.js src/components/Spending.jsx src/components/Home.jsx
git commit -m "feat: count-up animates from current value, not from zero"
```

---

### Task 2: `useDragDismiss` shared drag hook

Item 2's foundation. Pure hook, no consumers yet — those are Tasks 3, 4 and 5.

**Files:**
- Create: `src/hooks/useDragDismiss.js`

**Interfaces:**
- Produces:
  - `resolveDrag(start: {x,y}, current: {x,y}, lockedAxis: 'x'|'y'|null, axis: 'x'|'y'): { axis: 'x'|'y'|null, offset: number }` — exported for reuse and inspection.
  - `LOCK_SLOP: number` (8).
  - `useDragDismiss({ axis?: 'x'|'y', threshold?: number, onDismiss?: () => void, onEnd?: ({ offset: number }) => void, clamp?: (raw: number) => number, enabled?: boolean }): { handlers: object, offset: number, dragging: boolean }`
- Consumed by: Task 3 (`Sheet.jsx`), Task 4 (`InsightsMonthDetail.jsx`), Task 5 (both Home overlays).

- [ ] **Step 1: Create the hook**

Create `src/hooks/useDragDismiss.js`:

```js
import { useRef, useState, useCallback } from 'react'

/* Below this the gesture is a tap, not a drag — and until it is exceeded we
   don't know whether the finger is going sideways or scrolling. */
export const LOCK_SLOP = 8

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/* Pure. Given the gesture's start point, the current point, the axis already
   locked (null until the slop is exceeded), and the axis this consumer cares
   about, return the locked axis and the offset along it.
   Offset is 0 whenever the gesture locked to the *other* axis. */
export function resolveDrag(start, current, lockedAxis, axis) {
  const dx = current.x - start.x
  const dy = current.y - start.y
  let locked = lockedAxis
  if (locked === null) {
    if (Math.abs(dx) < LOCK_SLOP && Math.abs(dy) < LOCK_SLOP) return { axis: null, offset: 0 }
    locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
  }
  if (locked !== axis) return { axis: locked, offset: 0 }
  return { axis: locked, offset: axis === 'y' ? dy : dx }
}

/* One drag implementation for sheets, overlays and the month pager.
 *
 * Pointer events rather than touch events: one code path for finger, mouse and
 * pen, and pointercancel gives us a reliable end when the browser takes the
 * gesture over.
 *
 * The axis is locked once, after LOCK_SLOP, and never revisited — so a
 * diagonal drift part-way through a vertical scroll cannot start dragging the
 * sheet sideways, and vice versa. This is the disambiguation Sheet.jsx never
 * had; it got away with it only because its drag region is the handle and
 * header, with no scroller underneath. */
export default function useDragDismiss({
  axis = 'y',
  threshold = 80,
  onDismiss,
  onEnd,
  clamp,
  enabled = true,
} = {}) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const gesture = useRef(null)
  const offsetRef = useRef(0)

  /* Default gate: a 'y' dismiss only tracks downward drags, so pulling up on a
     sheet does nothing rather than lifting it off its own bottom edge. */
  const apply = useCallback(raw => {
    const next = clamp ? clamp(raw) : (axis === 'y' ? Math.max(0, raw) : raw)
    offsetRef.current = next
    setOffset(next)
  }, [axis, clamp])

  const onPointerDown = useCallback(e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gesture.current = { x: e.clientX, y: e.clientY, axis: null }
  }, [])

  const onPointerMove = useCallback(e => {
    const g = gesture.current
    if (!g) return
    const { axis: locked, offset: raw } = resolveDrag(g, { x: e.clientX, y: e.clientY }, g.axis, axis)
    if (locked === null) return
    if (g.axis === null) {
      g.axis = locked
      if (locked === axis) setDragging(true)
    }
    if (g.axis !== axis) return
    apply(raw)
  }, [axis, apply])

  const end = useCallback(() => {
    const g = gesture.current
    gesture.current = null
    setDragging(false)
    const final = offsetRef.current
    apply(0)
    if (!g || g.axis !== axis) return
    if (onEnd) { onEnd({ offset: final }); return }
    if (axis === 'y' ? final > threshold : Math.abs(final) > threshold) onDismiss?.()
  }, [axis, apply, onEnd, onDismiss, threshold])

  return {
    handlers: enabled
      ? { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end }
      : {},
    /* Under reduced motion nothing follows the finger — but `end` still reads
       the real offset from the ref, so a drag past the threshold still
       dismisses. The gesture works; only the animation is gone. */
    offset: prefersReducedMotion() ? 0 : offset,
    dragging,
  }
}
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: clean. Nothing imports the hook yet, so there is no behaviour to check.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDragDismiss.js
git commit -m "feat: add useDragDismiss, one pointer-event drag with axis locking"
```

---

### Task 3: Adopt `useDragDismiss` in `Sheet.jsx`, then walk every sheet call site

This is verification step **V2** from the spec. It is blocking: pointer events do not behave like touch events on iOS Safari, particularly around `touch-action` and whether a drag initiates when it starts over a scrollable child.

**Files:**
- Modify: `src/components/Sheet.jsx:6` (drop `DISMISS_THRESHOLD`), `:12-13`, `:51-64` (the touch handlers), `:68-76` (`sheetStyle`), `:86-91` (the drag region element)
- Modify: `src/components/Sheet.css:39` (`.sheet-drag-region`)

**Interfaces:**
- Consumes: `useDragDismiss` from Task 2.
- Produces: no change to `Sheet`'s public props — `{ title, onClose, children, footer, className }` stay exactly as they are. Six call sites depend on this.

- [ ] **Step 1: Replace the touch handlers**

In `src/components/Sheet.jsx`, delete `const DISMISS_THRESHOLD = 80` (line 6), the `dragY`/`dragging` state (lines 12-13), and the three handlers `onTouchStart`/`onTouchMove`/`onTouchEnd` (lines 51-64). Add the import and the hook:

```js
import useDragDismiss from '../hooks/useDragDismiss.js'
```

```js
  const { handlers: dragHandlers, offset: dragY, dragging } = useDragDismiss({
    axis: 'y',
    threshold: 80,
    onDismiss: onClose,
  })
```

`sheetStyle` (lines 68-76) already reads `dragY` and `dragging`, so it needs no change — confirm it still compiles against the new names.

- [ ] **Step 2: Swap the handlers on the drag region**

Lines 86-91 currently spread three touch handlers onto `.sheet-drag-region`. Replace with:

```jsx
        <div className="sheet-drag-region" {...dragHandlers}>
```

- [ ] **Step 3: Keep `touch-action` correct**

`src/components/Sheet.css:39` is `.sheet-drag-region { touch-action: none; }`. Keep it. With pointer events, `touch-action: none` is what stops iOS Safari from claiming the gesture as a page scroll before `pointermove` ever fires — without it the drag silently does nothing on device. Add a comment recording why:

```css
/* touch-action: none is load-bearing — pointer events only deliver pointermove
   for a gesture the browser has not already claimed as a scroll. */
.sheet-drag-region { touch-action: none; }
```

- [ ] **Step 4: Walk all six sheet call sites (V2 — blocking)**

Run `npm run build` first; expected clean. Then `npm run dev` and open each sheet in a 390×844 viewport. For **each** of the six, confirm: it opens with the `sheetUp` spring, dragging the handle downward moves it, releasing past ~80px dismisses it, releasing short of that springs it back, and the X button and backdrop tap still close it.

| # | Sheet | How to reach it |
|---|-------|-----------------|
| 1 | Log \<chip\> (quick-log) | Home → tap a Quick log chip (`Home.jsx:767`) |
| 2 | New event | Home → Upcoming strip → Calendar → `+` (`Calendar.jsx:162`) |
| 3 | New recurring expense | Settings → recurring expenses → add (`Settings.jsx:22`) |
| 4 | New recurring income | Settings → recurring income → add (`Settings.jsx:91`) |
| 5 | New expense | Home → Spending card → add expense (`Spending.jsx:173`) |
| 6 | Log income | Home → Spending card → log income (`Spending.jsx:247`) |

- [ ] **Step 5: Confirm the keyboard handling survived**

The `visualViewport` effect and the `focusin` scroll-into-view effect (`Sheet.jsx:19-49`) were not touched, but they interact with the same element. In sheet #1 and sheet #2, focus a text field and confirm: the sheet lifts above the keyboard, and the focused field scrolls into view rather than sitting under it.

- [ ] **Step 6: Confirm a drag starting over a scrollable child does not dismiss**

Sheet #2 (New event) has a scrollable body. Start a drag inside `.sheet-body` and pull down. Expected: the body scrolls, the sheet does **not** move — the drag region is the header, and the body is not wired to the hook.

- [ ] **Step 7: Commit**

```bash
git add src/components/Sheet.jsx src/components/Sheet.css
git commit -m "refactor: Sheet drags via useDragDismiss, pointer events with axis lock"
```

---

### Task 4: Replace `InsightsMonthDetail`'s inline drag with the shared hook

**Files:**
- Modify: `src/components/InsightsMonthDetail.jsx:1` (imports), `:8-15` (constants), `:95-145` (state and the three handlers), `:176-192` (the viewport element)

**Interfaces:**
- Consumes: `useDragDismiss` from Task 2.

- [ ] **Step 1: Swap the implementation**

`InsightsMonthDetail.jsx` currently carries its own copy of this logic: `LOCK_SLOP`, `COMMIT_FRACTION`, `COMMIT_MAX`, `OVERSCROLL`, the `gesture` ref, and `onPointerDown`/`onPointerMove`/`endGesture`. Delete the `drag`/`dragging` state, the `gesture` ref, and all three handlers, plus the now-unused `LOCK_SLOP` constant. Keep `COMMIT_FRACTION`, `COMMIT_MAX` and `OVERSCROLL` — they are this consumer's policy, not the hook's.

Add:

```js
import useDragDismiss from '../hooks/useDragDismiss.js'
```

```js
  /* Rubber-band past the first and last month instead of letting the track
     drag freely off its own ends. */
  const clamp = useCallback(raw => {
    const atStart = index === 0 && raw > 0
    const atEnd = index === months.length - 1 && raw < 0
    return atStart || atEnd ? raw * OVERSCROLL : raw
  }, [index, months.length])

  const { handlers: dragHandlers, offset: drag, dragging } = useDragDismiss({
    axis: 'x',
    clamp,
    onEnd: ({ offset }) => {
      const width = viewportRef.current?.clientWidth || 1
      const commit = Math.min(COMMIT_MAX, width * COMMIT_FRACTION)
      if (offset <= -commit && index < months.length - 1) onIndex(index + 1)
      else if (offset >= commit && index > 0) onIndex(index - 1)
    },
  })
```

`useCallback` must be added to the React import on line 1.

- [ ] **Step 2: Swap the handlers on the viewport**

Lines 176-183 spread four pointer handlers onto `.md-viewport`. Replace them with `{...dragHandlers}`. The `ref={viewportRef}` and `className` stay.

- [ ] **Step 3: Verify**

Run: `npm run build` — expected clean.

Then in the browser: Insights → tap a trend bar → swipe left and right between months. Confirm the month changes past ~20% of the pane, springs back below that, rubber-bands at the first and last month, and that a **vertical** drag inside the pane scrolls the pane without changing month.

- [ ] **Step 4: Commit**

```bash
git add src/components/InsightsMonthDetail.jsx
git commit -m "refactor: month pager uses the shared drag hook"
```

---

### Task 5: Overlays — retune the expand, add swipe-down to dismiss

Item 2 of the spec.

**Files:**
- Modify: `src/components/Home.jsx:17-44` (`useExpand`), `:563-570` and `:696-710` (the two overlay elements)
- Modify: `src/components/Home.css:445-460` (the shared overlay transition block)

**Interfaces:**
- Consumes: `useDragDismiss` from Task 2.
- Produces: `useExpand()` returns `{ ref, phase, open, close, overlayStyle, dragHandlers, dragOffset }`. The first five are unchanged.

- [ ] **Step 1: Retime the CSS**

`src/components/Home.css` around line 452 currently runs the expand at 450ms on a material curve:

```css
  transition:
    top 0.45s cubic-bezier(0.4,0,0.2,1),
    left 0.45s cubic-bezier(0.4,0,0.2,1),
    width 0.45s cubic-bezier(0.4,0,0.2,1),
    height 0.45s cubic-bezier(0.4,0,0.2,1),
```

Bring it under budget and onto the app's spring. Note the closing curve is deliberately different:

```css
/* Open uses the sheetUp spring (Sheet.css) — the overshoot pushes the overlay a
   few px past the viewport edge mid-flight, which is invisible. Close runs
   fullscreen -> card rect, where that same overshoot would shrink the overlay
   below the card before settling back up, so it gets a settle curve instead. */
.spend-card-overlay,
.cal-card-overlay {
  transition:
    top 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
    left 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
    width 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
    height 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-radius 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.spend-card-overlay.closing,
.cal-card-overlay.closing {
  transition:
    top 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    left 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    width 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    height 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
```

Keep whatever other properties the existing block transitions; only the durations and curves change.

- [ ] **Step 2: Match the close timeout**

`Home.jsx:31` is `setTimeout(() => setPhase('closed'), 460)`. That number exists only to outlast the old 450ms transition. Change to `300` and comment it:

```js
    /* Must outlast the .closing transition in Home.css (280ms). */
    setTimeout(() => setPhase('closed'), 300)
```

- [ ] **Step 3: Add drag-to-dismiss to `useExpand`**

Inside `useExpand()`, after `close` is defined:

```js
  const { handlers: dragHandlers, offset: dragOffset, dragging } = useDragDismiss({
    axis: 'y',
    threshold: 80,
    onDismiss: close,
  })
```

Then fold the live drag into the open-phase style, so the overlay follows the finger and still reverses into the card on release:

```js
  } else if (phase === 'open') {
    overlayStyle = {
      top: 0, left: 0, width: '100%', height: '100%', borderRadius: 0,
      transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
      transition: dragging ? 'none' : undefined,
    }
  }
```

Return `dragHandlers` and `dragOffset` alongside the existing five values.

- [ ] **Step 4: Wire the handlers onto both overlays**

The drag must not start over the overlay's own scroller, or pulling down to scroll back up would dismiss it. Attach the handlers to the **back button's row only** — the `.spend-back` / `.cal-back` element's parent header area, which is the overlay's equivalent of a sheet's drag region.

At `Home.jsx:570` and `Home.jsx:710` the back buttons are:

```jsx
          <button className="spend-back" onClick={spend.close}><BackIcon /> back</button>
```

Wrap each in a drag region:

```jsx
          <div className="overlay-drag-region" {...spend.dragHandlers}>
            <button className="spend-back" onClick={spend.close}><BackIcon /> back</button>
          </div>
```

and the same for `cal` with `.cal-back`. Add to `Home.css`:

```css
/* Same load-bearing reason as .sheet-drag-region — pointer events only fire
   for a gesture the browser has not already claimed as a scroll. */
.overlay-drag-region { touch-action: none; }
```

- [ ] **Step 5: Reduced motion**

`Home.css` around line 690 already has a `prefers-reduced-motion` block listing `.spend-card-overlay`. Confirm both `.spend-card-overlay` and `.cal-card-overlay`, plus their `.closing` variants, are covered by `transition: none`.

- [ ] **Step 6: Verify**

Run: `npm run build` — expected clean.

In the browser at 390×844:
1. Tap the Spending card. It expands from the card's rect to fullscreen with a spring, in about a third of a second — noticeably faster than before.
2. Drag down from the "back" row. The overlay follows the finger.
3. Release past ~80px. It reverses **into the card**, not off the bottom of the screen.
4. Release short of ~80px. It springs back to fullscreen.
5. Scroll the overlay body downward. The overlay must not move.
6. Repeat 1-5 for the Upcoming strip → Calendar overlay.
7. With `prefers-reduced-motion: reduce`, both overlays still open, still close via the back button, and a drag past the threshold still dismisses — just without the follow-the-finger motion.

- [ ] **Step 7: Commit**

```bash
git add src/components/Home.jsx src/components/Home.css
git commit -m "feat: overlays spring open in 320ms and swipe down to dismiss"
```

---

### Task 6: Tab transitions

Item 1 of the spec.

**Files:**
- Modify: `src/App.jsx:207` (`handleTabChange`), `:232-236` (the `.app-body` block)
- Modify: `src/App.css` — `.app-body`

**Interfaces:**
- Produces: nothing other tasks consume.

- [ ] **Step 1: Stage the swap in `App.jsx`**

`handleTabChange` is currently `const handleTabChange = (id) => { setTab(id) }`. Replace with a fade-out, swap, fade-in:

```js
  const [tabFading, setTabFading] = useState(false)
  const fadeTimer = useRef(null)

  /* Sequential fade rather than a true crossfade: a real crossfade needs both
     screens mounted at once, which fires both components' Supabase fetches on
     every tab press. At 180ms total the two read the same. */
  const handleTabChange = (id) => {
    if (id === tab) return
    if (prefersReducedMotion()) { setTab(id); return }
    clearTimeout(fadeTimer.current)
    setTabFading(true)
    fadeTimer.current = setTimeout(() => {
      setTab(id)
      setTabFading(false)
    }, 80)
  }

  useEffect(() => () => clearTimeout(fadeTimer.current), [])
```

Add a module-level helper near the top of `App.jsx`:

```js
const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
```

`useRef` and `useEffect` must be in the React import if they aren't already.

- [ ] **Step 2: Apply the class**

`App.jsx:232` becomes:

```jsx
      <div className={`app-body${tabFading ? ' tab-fading' : ''}`}>
```

The nav pill is deliberately **not** part of this — it switches immediately so the tap feels acknowledged before the screen finishes swapping.

- [ ] **Step 3: Add the CSS**

In `src/App.css`, on the existing `.app-body` rule add the transition, then the faded state:

```css
.app-body {
  /* ...existing declarations, unchanged... */
  transition: opacity 0.1s ease;
}
.app-body.tab-fading { opacity: 0; }
```

The fade-out is 80ms (the timer) and the fade-in 100ms (the transition), 180ms total.

Add to the existing reduced-motion block in `App.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .app-body { transition: none; }
}
```

- [ ] **Step 4: Verify**

Run: `npm run build` — expected clean.

In the browser: tap between Log / Insights / Settings. The outgoing screen fades out and the incoming one fades in — no hard swap, and no white flash between them. Tap rapidly between all three: the screen must always settle on the tab whose pill is active, never on a stale one. Under `prefers-reduced-motion: reduce`, tabs swap instantly with no fade.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.css
git commit -m "feat: crossfade between tabs instead of a hard swap"
```

---

### Task 7: Skeleton states

Item 3 of the spec. **Requirement: zero layout shift.**

**Files:**
- Create: `src/components/Skeleton.jsx`
- Create: `src/components/Skeleton.css`
- Modify: `src/components/Home.jsx:48`, `:495`, `:574` (three `.loading-wrap` spinners)
- Modify: `src/components/Insights.jsx:224-230` (the fourth)

**Interfaces:**
- Produces: `<Skeleton w?: string|number, h?: string|number, r?: string|number />` — a pulsing block. `w` defaults to `'100%'`, `h` to `12`, `r` to `6`.

- [ ] **Step 1: Create the primitive**

`src/components/Skeleton.jsx`:

```jsx
import './Skeleton.css'

/* A placeholder surface. Sized by the caller to match the real content it
   stands in for — see the zero-layout-shift requirement in the plan. */
export default function Skeleton({ w = '100%', h = 12, r = 6, style }) {
  const px = v => (typeof v === 'number' ? `${v}px` : v)
  return (
    <div
      className="skeleton"
      aria-hidden="true"
      style={{ width: px(w), height: px(h), borderRadius: px(r), ...style }}
    />
  )
}
```

`src/components/Skeleton.css`:

```css
/* Opacity pulse only. A travelling shimmer highlight is a gradient, and
   gradients are banned project-wide. */
.skeleton {
  background: var(--bg3);
  animation: skeletonPulse 1.4s ease-in-out infinite;
}

@keyframes skeletonPulse {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; opacity: 0.7; }
}
```

The 1.4s pulse is a looping idle state, not a transition — the ≤400ms cap governs state changes, and a 400ms pulse would strobe. Record that in the commit message.

- [ ] **Step 2: Build the four skeleton layouts**

Each replaces a `.loading-wrap` spinner and must reuse the **same container classes** as the real markup, with heights matching the real content:

1. **Home spending card** (`Home.jsx:48`, the `if (!data) return ...` early return) — the card shell with a label bar, a large number bar, a progress track, and a footer line.
2. **Home entries list** (`Home.jsx:495`) — four `.entry-row` shells, each with a 30×30 rounded icon block and two text bars.
3. **Home upcoming pills** (`Home.jsx:574`) — three `.upcoming-pill` shells with a short date bar and a longer title bar.
4. **Insights** (`Insights.jsx:224-230`) — the trend card, the income card, and the stat pair, at the heights those cards actually render at.

Keep every wrapper element the real render uses. The skeleton replaces the *contents*, not the structure.

- [ ] **Step 3: Verify zero layout shift (blocking)**

Run `npm run build` — expected clean.

Then, for each of the four, measure rather than eyeball. With devtools open, select the skeleton's container and record `getBoundingClientRect().height`; let the data land; record it again. **The delta must be 0.** If it isn't, the skeleton's heights are wrong — fix the skeleton, not the real layout.

Throttle the network to "Slow 3G" so the skeletons stay up long enough to measure.

- [ ] **Step 4: Verify reduced motion**

With `prefers-reduced-motion: reduce`, skeletons render as static blocks at 0.7 opacity, no pulse, and still get replaced by real data.

- [ ] **Step 5: Commit**

```bash
git add src/components/Skeleton.jsx src/components/Skeleton.css src/components/Home.jsx src/components/Insights.jsx
git commit -m "feat: skeleton placeholders replace loading spinners"
```

---

### Task 8: `src/lib/optimistic.js` — the pure reconciliation module, with tests

This is the **only** task that adds test tooling, and it covers `src/lib/optimistic.js` and nothing else. Do not add jsdom, Testing Library, or component tests. Do not write tests for any other task in this plan.

**Files:**
- Create: `src/lib/optimistic.js`
- Create: `src/lib/optimistic.test.js`
- Modify: `package.json` (one devDependency, one script)

**Interfaces:**
- Produces:
  - `tempId(): string`
  - `isTempId(id: unknown): boolean`
  - `insertProvisional(list: object[], entry: object): object[]`
  - `commitProvisional(list: object[], id: string, realRow: object): object[]`
  - `dropProvisional(list: object[], id: string): object[]`
  - `resolveUndoTarget(entry: { id: string, pending?: Promise<object> }): Promise<string|null>`
- Consumed by: Task 9.

- [ ] **Step 1: Add Vitest**

```bash
npm i -D vitest
```

Then add to `package.json` scripts, beside the existing three:

```json
    "test": "vitest run"
```

No config file. Vitest reads the existing `vite.config.js`, and these tests are pure — the default `node` environment is correct.

- [ ] **Step 2: Write the failing tests**

Create `src/lib/optimistic.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  tempId, isTempId, insertProvisional, commitProvisional, dropProvisional,
  resolveUndoTarget,
} from './optimistic.js'

describe('temp ids', () => {
  it('are recognisable and unique', () => {
    const a = tempId(), b = tempId()
    expect(isTempId(a)).toBe(true)
    expect(a).not.toBe(b)
  })

  it('does not mistake a real uuid for a temp id', () => {
    expect(isTempId('15213098-a9e8-4765-971d-d81cf4cdc781')).toBe(false)
    expect(isTempId(undefined)).toBe(false)
  })
})

describe('list reconciliation', () => {
  it('inserts the provisional entry at the front', () => {
    const out = insertProvisional([{ id: 'a' }], { id: 't1' })
    expect(out.map(e => e.id)).toEqual(['t1', 'a'])
  })

  it('replaces the provisional entry with the real row, keeping position', () => {
    const list = [{ id: 't1', amount: 10 }, { id: 'a' }]
    const out = commitProvisional(list, 't1', { id: 'real', amount: 10 })
    expect(out.map(e => e.id)).toEqual(['real', 'a'])
    expect(out[0].pending).toBeUndefined()
  })

  it('drops the provisional entry on failure and leaves the rest alone', () => {
    const out = dropProvisional([{ id: 't1' }, { id: 'a' }], 't1')
    expect(out.map(e => e.id)).toEqual(['a'])
  })
})

describe('resolveUndoTarget — UNDO tapped before the write lands', () => {
  it('returns a real id immediately', async () => {
    expect(await resolveUndoTarget({ id: 'real-id' })).toBe('real-id')
  })

  it('waits for the pending write and returns the id it produced', async () => {
    let settle
    const pending = new Promise(res => { settle = res })
    const target = resolveUndoTarget({ id: tempId(), pending })
    settle({ id: 'row-from-supabase' })
    expect(await target).toBe('row-from-supabase')
  })

  it('returns null when the write failed — there is nothing to delete', async () => {
    const pending = Promise.reject(new Error('network'))
    expect(await resolveUndoTarget({ id: tempId(), pending })).toBe(null)
  })

  it('returns null for a temp id with no pending write', async () => {
    expect(await resolveUndoTarget({ id: tempId() })).toBe(null)
  })
})
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./optimistic.js"`.

- [ ] **Step 4: Implement**

Create `src/lib/optimistic.js`:

```js
/* Reconciliation for optimistically-inserted entries.
 *
 * The UI shows a provisional row with a temporary id before the Supabase write
 * resolves. This module is the only place that knows how that row is replaced
 * by its real one — and, the part that actually bites, what an UNDO tapped
 * before the write lands should delete. */

let counter = 0

export function tempId() {
  return `temp:${Date.now()}:${counter++}`
}

export function isTempId(id) {
  return typeof id === 'string' && id.startsWith('temp:')
}

export function insertProvisional(list, entry) {
  return [entry, ...list]
}

/* Keeps the row's position — the entry must not jump when its id firms up. */
export function commitProvisional(list, id, realRow) {
  return list.map(it => (it.id === id ? { ...it, ...realRow, pending: undefined } : it))
}

export function dropProvisional(list, id) {
  return list.filter(it => it.id !== id)
}

/* The id an UNDO should delete.
 *
 * UNDO can be tapped in the second between the optimistic insert and the write
 * resolving, when the only id we have is a temp one that Supabase has never
 * seen. Deleting that would remove the row from the UI and leave the real one
 * orphaned in the database. So: wait for the write, then delete what it
 * actually created. Null means there is nothing to delete — the write failed,
 * and the row was never there. */
export async function resolveUndoTarget(entry) {
  if (!entry) return null
  if (!isTempId(entry.id)) return entry.id
  if (!entry.pending) return null
  try {
    const row = await entry.pending
    return row?.id ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/optimistic.js src/lib/optimistic.test.js package.json package-lock.json
git commit -m "feat: pure optimistic-entry reconciliation, with tests for the undo race"
```

---

### Task 9: Wire optimistic logging into Home

Item 4 of the spec, and verification step **V1**.

**Files:**
- Modify: `src/components/Home.jsx:241-272` (`handleSend`), `:294-310` (`handleLogAmount`), and the sheet-save path
- Modify: `src/components/Home.jsx:194-211` (`refreshRecent`) if needed to avoid clobbering provisional rows

**Interfaces:**
- Consumes: everything Task 8 produces.

- [ ] **Step 1: Optimistic quick-log**

`handleLogAmount` (lines 294-310) currently awaits `db.addExpense` before doing anything visible. Restructure so the row appears first:

```js
  const handleLogAmount = async () => {
    const amount = parseFloat(amountVal)
    if (isNaN(amount) || amount <= 0) return
    const chip = amountChip
    const draft = {
      description: chip.label,
      amount,
      category: chip.category,
      date: todayISO(),
    }

    /* Show it before the write, not after. The pending promise rides along on
       the row so an UNDO tapped in the next second can wait for the real id
       instead of deleting a temp one Supabase has never seen. */
    const id = tempId()
    const pending = db.addExpense(draft)
    const provisional = { ...draft, id, pending, _type: 'expense', created_at: new Date().toISOString() }
    setRecent(list => insertProvisional(list, provisional))
    setAmountChip(null)
    onLogged()

    showToast(`${chip.label} — ${formatRM(amount)}`, 'success', {
      label: 'UNDO',
      onClick: async () => {
        const realId = await resolveUndoTarget(provisional)
        setRecent(list => dropProvisional(list, id))
        if (realId) await db.deleteExpense(realId)
        onLogged()
      },
    })

    try {
      const row = await pending
      setRecent(list => commitProvisional(list, id, row))
    } catch (err) {
      console.error('[daylog] quick-log write failed:', err)
      setRecent(list => dropProvisional(list, id))
      showToast('Could not save — try again', 'error')
    }
    onLogged()
  }
```

Import at the top of `Home.jsx`:

```js
import { tempId, insertProvisional, commitProvisional, dropProvisional, resolveUndoTarget } from '../lib/optimistic.js'
```

- [ ] **Step 2: Optimistic NLP send**

In `handleSend` (lines 241-272), the entry is unknown until `parseInput` resolves, so the optimism starts *after* the parse — what it saves is the database round trip, not the parse. The existing body awaits all three `db.add*` calls in sequence before anything appears. Replace the section from `const created = []` through `await refreshRecent(); onLogged()` with:

```js
      const ADDERS = {
        expense: [db.addExpense.bind(db), db.deleteExpense.bind(db)],
        event:   [db.addEvent.bind(db),   db.deleteEvent.bind(db)],
        income:  [db.addIncome.bind(db),  db.deleteIncome.bind(db)],
      }

      const created = []
      for (const type of ['expense', 'event', 'income']) {
        const draft = parsed[type]
        if (!draft) continue
        const [add] = ADDERS[type]
        const id = tempId()
        const pending = add(draft)
        const provisional = { ...draft, id, pending, _type: type, created_at: new Date().toISOString() }
        created.push({ type, id, provisional })
        setRecent(list => insertProvisional(list, provisional))
      }

      if (created.length === 0) { showToast('Could not parse that', 'error'); setLoading(false); return }
      triggerBurst()
      onLogged()

      const msg =
        created.length === 2 ? 'Logged expense + event' :
        created[0].type === 'expense' ? 'Expense logged' :
        created[0].type === 'income'  ? 'Income logged' : 'Event added'

      showToast(msg, 'success', {
        label: 'UNDO',
        onClick: async () => {
          for (const { type, id, provisional } of created) {
            /* Resolve before deleting — UNDO can land while the write is still
               in flight, when the only id we have is one Supabase has never
               seen. */
            const realId = await resolveUndoTarget(provisional)
            setRecent(list => dropProvisional(list, id))
            if (realId) await ADDERS[type][1](realId)
          }
          onLogged()
        },
      })

      for (const { id, provisional } of created) {
        try {
          const row = await provisional.pending
          setRecent(list => commitProvisional(list, id, row))
        } catch (err) {
          console.error('[daylog] NLP write failed:', err)
          setRecent(list => dropProvisional(list, id))
          showToast('Could not save — try again', 'error')
        }
      }
      onLogged()
```

Note `triggerBurst()` and the toast now fire before the writes settle, which is the point — the burst is feedback for the tap, not for the database.

- [ ] **Step 3: Optimistic sheet save**

Four sheets create an entry. The quick-log amount sheet (`Home.jsx:767`) is already done — its save handler *is* `handleLogAmount` from Step 1. The other three each own a save handler that currently awaits a `db.add*` before the sheet closes:

| Sheet | File | Save path |
|-------|------|-----------|
| New expense | `Spending.jsx:173` | the `onSave` passed to that `<Sheet>` |
| Log income | `Spending.jsx:247` | the `onSave` passed to that `<Sheet>` |
| New event | `Calendar.jsx:162` | `handleAdd`, which calls `db.addEvent` then `loadEvents()` |

For each, restructure to the same four beats as Step 1, in this order:

```js
    const id = tempId()
    const pending = db.addExpense(draft)          // or addIncome / addEvent
    const provisional = { ...draft, id, pending }
    setRows(list => insertProvisional(list, provisional))
    onCancel()                                     // close the sheet immediately

    try {
      const row = await pending
      setRows(list => commitProvisional(list, id, row))
    } catch (err) {
      console.error('[daylog] sheet save failed:', err)
      setRows(list => dropProvisional(list, id))
      showToast('Could not save — try again', 'error')
    }
```

`setRows` stands for whichever list state that screen renders — `expenses` in Spending, `events` in Calendar. Where the handler currently ends with a full refetch (`loadEvents()` in Calendar), that refetch must move *after* the commit or be dropped, otherwise it overwrites the provisional row before the write lands.

The two recurring-rule sheets in `Settings.jsx` create schedules, not entries — leave them alone.

- [ ] **Step 4: Stop `refreshRecent` clobbering provisional rows**

`refreshRecent` (lines 194-211) ends with `setRecent(items)` — replacing the list wholesale from the database. If it lands while a provisional row is still pending, that row vanishes and then reappears when the write commits. Guard it by keeping any row that is still in flight:

```js
    /* A provisional row is not in the database yet, so a refetch would drop it
       and it would pop back a moment later when its write commits. Keep every
       row still carrying a pending promise, ahead of the fetched ones. */
    setRecent(prev => {
      const inFlight = prev.filter(it => it.pending)
      const fetchedIds = new Set(items.map(it => it.id))
      return [...inFlight.filter(it => !fetchedIds.has(it.id)), ...items]
    })
```

Apply the same guard to `setUpcoming` if a provisional *event* can be in flight when it runs.

- [ ] **Step 5: Verify totals animate**

Logging an entry must move the spending total via Task 1's count-up — from the old figure to the new one, not from 0. Confirm by logging a quick-log entry and watching the Home spending card.

- [ ] **Step 6: V1 — the undo race (blocking)**

This is the step the whole task exists for. For **each** of the three entry points (NLP send, quick-log, sheet save):

1. Log an entry.
2. Tap UNDO within ~1 second — before the Supabase write can have resolved. Throttle the network to "Slow 3G" to widen the window.
3. Query the database directly and confirm the row is **actually gone**:

```bash
supabase db query --linked "select id, description, amount, created_at from expenses order by created_at desc limit 5"
```

The entry must not be there. A row removed from the UI while an orphan persists in Supabase is a failure, not a pass.

Then the failure path: block the Supabase request in devtools, log an entry, and confirm the row disappears from the list and an error toast appears.

- [ ] **Step 7: Commit**

```bash
git add src/components/Home.jsx src/components/Spending.jsx src/components/Calendar.jsx
git commit -m "feat: entries appear immediately, write async, undo waits for the real id"
```

---

### Task 10: Final sweep and push

**Files:** whichever the sweep turns up.

- [ ] **Step 1: Audit every duration**

Every transition and animation added or changed in this phase must be ≤400ms. Check with:

```bash
grep -rnE '(transition|animation)[^;]*[0-9.]+m?s' src/ | grep -vE '0\.[0-4][0-9]?s|[0-9]{1,3}ms|1\.2s'
```

Inspect each hit. The only permitted survivors are the 1.2s mount count-up and the 1.4s skeleton pulse (a looping idle state, not a state change).

- [ ] **Step 2: Audit reduced motion**

With `prefers-reduced-motion: reduce` set, walk the whole app: all three tabs, both overlays, all six sheets, the Insights month detail. Every screen must be reachable, every control must work, and nothing may animate.

- [ ] **Step 3: Confirm the untouchables**

```bash
grep -n 'viewport-fit=cover' index.html
grep -rn 'safe-area-inset' src/ | wc -l
grep -rn 'box-shadow\|backdrop-filter\|linear-gradient\|radial-gradient' src/*.css src/components/*.css
```

Expected: the viewport meta is present; the safe-area count is unchanged from `master`; the third command returns nothing outside `Splash.css`, which is allowed its orb gradients.

- [ ] **Step 4: Full verification**

```bash
npm run build
npm test
```

Both clean.

- [ ] **Step 5: Push the branch**

```bash
git push -u origin ux-phase1
```

Vercel builds the preview from the branch. Report the preview URL for the on-device pass.

---

## Notes for the implementer

- `src/lib/dates.js` is the only place date maths happens. If a task tempts you into `new Date()` arithmetic, you have taken a wrong turn.
- `--tabbar-height` is measured from the rendered nav in `App.jsx` and already includes its `safe-area-inset-bottom`. Never add that inset on top of it.
- `.screen` is the single place the bottom nav height is reserved. Do not add `padding-bottom` for the nav anywhere else.
- The Insights detail panel and both Home overlays are portalled or fixed at `z-index: 700` and paint *over* the nav. Inside them, the nav is not something to clear.
