# UX Revamp Phase 0: Edit Experience Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `EditEntrySheet` with a first-class amount editor, category chip picker, and date chip picker, add swipe-to-dismiss/keyboard-aware sheet behavior, and add an undo toast covering every place an entry is created, edited, or deleted.

**Architecture:** Three new small, focused components (`AmountInput`, `CategoryChipRow`, `DateChipRow`) replace inline form fields inside `EditEntrySheet`. `Sheet.jsx` (shared by six call sites app-wide) gains swipe-dismiss and keyboard-avoidance without changing its public props. `Toast.jsx` gains an optional action button, used by `Home.jsx` — the single place in the app that owns entry create/edit/delete — to offer undo via snapshot-and-revert against `db.js`, whose existing `add*`/`update*`/`delete*` methods need no changes.

**Tech Stack:** React 18 (function components, hooks), plain CSS with the existing `src/index.css` custom-property design tokens, Vite 5 build, no test framework in this repo.

## Global Constraints

- No `box-shadow`, no `backdrop-filter`, no glow effects, no gradients — flat surfaces only (project-wide rule, verified against current `src/index.css`/`*.css`, which contain none today).
- No colors outside the existing token set. Accent is `--accent: #58a6ff` (blue) — never introduce green or a second accent.
- Fonts: `var(--font-display)` (Space Grotesk) for headings/buttons, `var(--font-sans)` (Inter) for body/labels, `var(--font-mono)` (JetBrains Mono) for numbers/dates/data values. Don't mix.
- Animation duration cap: ≤400ms for any single transition/animation, including the sheet's spring-open (per user decision during brainstorming: fast spring curve, clamped to ≤400ms, not a longer "true" spring).
- No emoji anywhere. Icons are SVG components from `src/Icons.jsx` only.
- `CATEGORIES`, `CAT_META`, `INCOME_CATEGORIES`, `EVENT_CATS`, `CAT_ICONS` (in `src/utils.js` and `src/Icons.jsx`) are the canonical category sources — do not redefine or fork them.
- This repo has no test runner (`package.json` has no test script, no vitest/jest/testing-library). Verification for every task is: `npm run build` succeeds (catches syntax/import errors — Vite build does not typecheck or lint), plus a manual behavior check described in the task. This is the existing project convention, not a gap introduced by this plan.
- Branch: `ux-revamp`, created off `master` in `daylog-clean/` before Task 1.
- Spec: `docs/superpowers/specs/2026-07-17-ux-revamp-phase0-edit-experience-design.md`.

---

### Task 0: Create the feature branch

**Files:** none

- [ ] **Step 1: Create and switch to the `ux-revamp` branch**

Run: `cd daylog-clean && git checkout -b ux-revamp`
Expected: `Switched to a new branch 'ux-revamp'`

---

### Task 1: Toast — add optional undo action

**Files:**
- Modify: `src/components/Toast.jsx`
- Modify: `src/components/Toast.css`
- Modify: `src/App.jsx:109-112` (`showToast`), `src/App.jsx:206` (render)

**Interfaces:**
- Produces: `showToast(msg: string, type?: 'success'|'error', action?: { label: string, onClick: () => void }): void` — exported behavior of `App.jsx`'s `showToast`, passed as a prop to `Home`/`Insights`/`Settings`. All later tasks that add undo call `showToast(msg, 'success', { label: 'UNDO', onClick })`.

- [ ] **Step 1: Rewrite `Toast.jsx` to render an optional action button**

```jsx
import './Toast.css'

export default function Toast({ msg, type = 'success', action }) {
  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-msg">{msg}</span>
      {action && (
        <button
          type="button"
          className="toast-action"
          onClick={(e) => { e.stopPropagation(); action.onClick() }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add action-button styling to `Toast.css`**

Add flex layout to the existing `.toast` rule and a new `.toast-action` rule. Replace:

```css
.toast {
  position: fixed;
  bottom: 84px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 12px;
  font-family: var(--font-mono);
  font-weight: 400;
  letter-spacing: 0.04em;
  white-space: nowrap;
  z-index: 100;
  animation: slideUp 0.18s ease;
  pointer-events: none;
}
```

with:

```css
.toast {
  position: fixed;
  bottom: 84px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px 10px 18px;
  border-radius: 999px;
  font-size: 12px;
  font-family: var(--font-mono);
  font-weight: 400;
  letter-spacing: 0.04em;
  white-space: nowrap;
  z-index: 100;
  animation: slideUp 0.18s ease;
  pointer-events: none;
}
.toast-msg { pointer-events: none; }
.toast-action {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
  flex-shrink: 0;
  pointer-events: auto;
}
```

(`.toast` itself keeps `pointer-events: none` so the toast never blocks taps behind it; `.toast-action` opts back in with `pointer-events: auto` so it alone is tappable.)

- [ ] **Step 3: Extend `showToast` in `App.jsx`**

Replace `App.jsx:109-112`:

```jsx
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])
```

with:

```jsx
  const showToast = useCallback((msg, type = 'success', action) => {
    setToast({ msg, type, action })
    setTimeout(() => setToast(null), action ? 5000 : 3000)
  }, [])
```

- [ ] **Step 4: Pass the action through in the render**

Replace `App.jsx:206`:

```jsx
      {toast && <Toast msg={toast.msg} type={toast.type} />}
```

with:

```jsx
      {toast && <Toast msg={toast.msg} type={toast.type} action={toast.action} />}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build succeeds, no errors.

- [ ] **Step 6: Manual check**

Run `npm run dev`, trigger any existing toast (e.g. tap a preset quick-log chip and log an amount). Confirm the toast still appears, centered, no action button (since no call site passes one yet), and auto-dismisses after ~3s exactly as before.

- [ ] **Step 7: Commit**

```bash
git add src/components/Toast.jsx src/components/Toast.css src/App.jsx
git commit -m "feat: add optional undo action button to Toast"
```

---

### Task 2: Sheet — swipe-to-dismiss, keyboard-aware, fast-spring open

**Files:**
- Modify: `src/components/Sheet.jsx`
- Modify: `src/components/Sheet.css`

**Interfaces:**
- Consumes: nothing new — `Sheet`'s existing props (`title`, `onClose`, `children`, `className`) are unchanged. All 6 existing call sites (`Calendar.jsx:580`, `Home.jsx:710`, `Settings.jsx:484,493`, `Spending.jsx:852,862`, and `EditEntrySheet.jsx` after Task 6) keep working with zero changes.
- Produces: swiping the sheet handle/header down past 80px now calls the same `onClose` the caller already passed — callers that want a "confirm before closing" gate (Task 6) wrap their own `onClose` before passing it in; `Sheet` itself has no new prop for this.

- [ ] **Step 1: Rewrite `Sheet.jsx`**

```jsx
import { useState, useRef, useEffect } from 'react'
import './Sheet.css'
import { XIcon } from '../Icons.jsx'

const DISMISS_THRESHOLD = 80

export default function Sheet({ title, onClose, children, className = '' }) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [kbOffset, setKbOffset] = useState(0)
  const startY = useRef(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKbOffset(offset)
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    onResize()
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    }
  }, [])

  const onTouchStart = (e) => {
    startY.current = e.touches[0].clientY
    setDragging(true)
  }
  const onTouchMove = (e) => {
    if (!dragging) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) setDragY(delta)
  }
  const onTouchEnd = () => {
    setDragging(false)
    if (dragY > DISMISS_THRESHOLD) onClose()
    setDragY(0)
  }

  const transform = `translateY(${dragY - kbOffset}px)`

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet${className ? ' ' + className : ''}`}
        style={{ transform, transition: dragging ? 'none' : 'transform 0.2s ease' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="sheet-drag-region"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="sheet-handle" />
          <div className="sheet-header">
            <div className="sheet-title">{title}</div>
            <button className="sheet-close" onClick={onClose} aria-label="Close">
              <XIcon size={16} />
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `Sheet.css`** — fast-spring open timing (≤400ms) and drag-region touch handling

Replace:

```css
.sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-height: 92dvh;
  background: var(--bg2);
  border: 0.5px solid var(--border2);
  border-bottom: none;
  border-radius: 20px 20px 0 0;
  animation: sheetUp 0.22s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

with:

```css
.sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-height: 92dvh;
  background: var(--bg2);
  border: 0.5px solid var(--border2);
  border-bottom: none;
  border-radius: 20px 20px 0 0;
  animation: sheetUp 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

Add a new rule right after `.sheet-handle`'s block:

```css
.sheet-drag-region { touch-action: none; }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds, no errors.

- [ ] **Step 4: Manual check**

`npm run dev`, open any existing sheet (e.g. Settings → "Add recurring expense"). Confirm: opens with a quick pop-in feel (not a slow slide); dragging the handle/header down and releasing past roughly a third of the header height closes it; releasing before that snaps back; dragging up does nothing (only downward drag tracked); tapping into a text field and bringing up the keyboard doesn't hide the sheet's bottom edge/save button off-screen.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sheet.jsx src/components/Sheet.css
git commit -m "feat: swipe-to-dismiss, keyboard-aware, fast-spring open for Sheet"
```

---

### Task 3: AmountInput component

**Files:**
- Create: `src/components/AmountInput.jsx`
- Modify: `src/components/Sheet.css` (append)

**Interfaces:**
- Produces: `<AmountInput value={string} onChange={(next: string) => void} />` — `value`/`onChange` carry the raw numeric string with no thousand separators (e.g. `"1000"`, `"12.5"`); the component formats separators for display only. Consumed by `EditEntrySheet` in Task 6.

- [ ] **Step 1: Create `AmountInput.jsx`**

```jsx
import { useRef } from 'react'

function formatThousands(raw) {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${withSep}.${decPart}` : withSep
}

export default function AmountInput({ value, onChange }) {
  const inputRef = useRef(null)

  const handleChange = (e) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
      onChange(raw)
    }
  }

  return (
    <div className="amount-input-wrap" onClick={() => inputRef.current?.focus()}>
      <span className="amount-input-prefix">RM</span>
      <input
        ref={inputRef}
        className="amount-input"
        type="text"
        inputMode="decimal"
        value={formatThousands(value)}
        onChange={handleChange}
        onFocus={(e) => e.target.select()}
        placeholder="0"
      />
    </div>
  )
}
```

- [ ] **Step 2: Append AmountInput styling to `Sheet.css`**

```css
/* ── Amount input (EditEntrySheet) ────────────────────── */
.amount-input-wrap {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  padding: 20px 0;
  cursor: text;
}
.amount-input-prefix {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 400;
  color: var(--text3);
}
.amount-input {
  font-family: var(--font-mono);
  font-size: 40px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text);
  background: none;
  border: none;
  outline: none;
  max-width: 220px;
  font-variant-numeric: tabular-nums;
}
.amount-input::placeholder { color: var(--text3); }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds (component isn't wired into any UI yet, so this only checks for syntax errors).

- [ ] **Step 4: Commit**

```bash
git add src/components/AmountInput.jsx src/components/Sheet.css
git commit -m "feat: add AmountInput component with live thousand-separator formatting"
```

---

### Task 4: CategoryChipRow component

**Files:**
- Create: `src/components/CategoryChipRow.jsx`
- Modify: `src/components/Sheet.css` (append)

**Interfaces:**
- Produces: `<CategoryChipRow categories={string[]} meta={Record<string,{label,color}>} icons={Record<string,Component>} value={string} onChange={(cat: string) => void} />`. Consumed by `EditEntrySheet` in Task 6, once per entry type (expense uses `CATEGORIES`/`CAT_META`, income uses `INCOME_CATEGORIES`/`CAT_META`, event uses a local `['', ...Object.keys(EVENT_CATS)]` list built in Task 6).

- [ ] **Step 1: Create `CategoryChipRow.jsx`**

```jsx
import { useEffect, useRef } from 'react'

export default function CategoryChipRow({ categories, meta, icons, value, onChange }) {
  const selectedRef = useRef(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [])

  return (
    <div className="cat-chip-row">
      {categories.map(cat => {
        const Icon = icons[cat]
        const isSelected = value === cat
        return (
          <button
            key={cat || 'none'}
            ref={isSelected ? selectedRef : null}
            type="button"
            className={`cat-chip${isSelected ? ' selected' : ''}`}
            onClick={() => onChange(cat)}
          >
            <span className="cat-chip-dot" style={{ background: meta[cat]?.color }} />
            {Icon && <Icon size={14} />}
            <span className="cat-chip-label">{meta[cat]?.label || 'None'}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Append chip-row styling to `Sheet.css`**

```css
/* ── Category chip row (EditEntrySheet) ───────────────── */
.cat-chip-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 2px 4px;
}
.cat-chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  background: var(--bg3);
  border: 0.5px solid var(--border2);
  border-radius: 999px;
  color: var(--text2);
  font-family: var(--font-sans);
  font-size: 13px;
  white-space: nowrap;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.cat-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.cat-chip.selected {
  background: rgba(88,166,255,0.15);
  border-color: var(--accent);
  color: var(--text);
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/CategoryChipRow.jsx src/components/Sheet.css
git commit -m "feat: add CategoryChipRow component"
```

---

### Task 5: DateChipRow component

**Files:**
- Create: `src/components/DateChipRow.jsx`
- Modify: `src/components/Sheet.css` (append)

**Interfaces:**
- Produces: `<DateChipRow value={string} onChange={(dateStr: string) => void} />` — `value`/`onChange` use `YYYY-MM-DD` strings, same format the rest of the codebase (`db.js`, `formatDate`) already uses. Consumed by `EditEntrySheet` in Task 6.

- [ ] **Step 1: Create `DateChipRow.jsx`**

```jsx
import { useRef } from 'react'

function todayStr() { return new Date().toISOString().split('T')[0] }
function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}
function dayOfWeek(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'short' })
}

export default function DateChipRow({ value, onChange }) {
  const today = todayStr()
  const yesterday = yesterdayStr()
  const isToday = value === today
  const isYesterday = value === yesterday
  const isCustom = !isToday && !isYesterday
  const customInputRef = useRef(null)

  const openCustom = () => {
    if (customInputRef.current?.showPicker) customInputRef.current.showPicker()
    else customInputRef.current?.focus()
  }

  return (
    <div className="date-chip-row">
      <button type="button" className={`date-chip${isToday ? ' selected' : ''}`} onClick={() => onChange(today)}>
        Today · {dayOfWeek(today)}
      </button>
      <button type="button" className={`date-chip${isYesterday ? ' selected' : ''}`} onClick={() => onChange(yesterday)}>
        Yesterday · {dayOfWeek(yesterday)}
      </button>
      <button type="button" className={`date-chip${isCustom ? ' selected' : ''}`} onClick={openCustom}>
        {isCustom && value ? `${value} · ${dayOfWeek(value)}` : 'Custom'}
      </button>
      <input
        ref={customInputRef}
        type="date"
        className="date-chip-native-input"
        value={isCustom ? value : ''}
        onChange={e => onChange(e.target.value)}
        style={{ colorScheme: 'dark' }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Append date-chip-row styling to `Sheet.css`**

```css
/* ── Date chip row (EditEntrySheet) ───────────────────── */
.date-chip-row {
  position: relative;
  display: flex;
  gap: 8px;
}
.date-chip {
  flex: 1;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg3);
  border: 0.5px solid var(--border2);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text2);
  transition: all 0.15s ease;
}
.date-chip.selected {
  background: rgba(88,166,255,0.15);
  border-color: var(--accent);
  color: var(--text);
}
.date-chip-native-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/DateChipRow.jsx src/components/Sheet.css
git commit -m "feat: add DateChipRow component"
```

---

### Task 6: EditEntrySheet rebuild

**Files:**
- Modify: `src/Icons.jsx` (append `CheckIcon`)
- Modify: `src/components/EditEntrySheet.jsx` (full rewrite)

**Interfaces:**
- Consumes: `AmountInput` (Task 3), `CategoryChipRow` (Task 4), `DateChipRow` (Task 5), `Sheet`'s swipe-aware `onClose` (Task 2), `Toast`'s action slot indirectly (via `Home.jsx` in Task 7 — this task does not call `showToast` itself).
- Produces: same public props as before — `<EditEntrySheet entry={entry} onSave={(updates) => Promise} onDelete={() => Promise} onClose={() => void} />`. `onSave`'s `updates` shape is unchanged from the current implementation (expense/income: `{description, amount, category, date, notes}`; event: `{title, date, time, category, notes}`), so `Home.jsx`'s existing `onSave`/`onDelete` handler bodies (rewired in Task 7) don't need to change their update-payload assumptions.

- [ ] **Step 1: Add `CheckIcon` to `Icons.jsx`**

Append after `EditIcon` (around line 200), matching the existing icon style (`{...s}` shared stroke props defined at the top of the file):

```jsx
export const CheckIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
```

- [ ] **Step 2: Rewrite `EditEntrySheet.jsx`**

```jsx
import { useRef, useState } from 'react'
import Sheet from './Sheet.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import AmountInput from './AmountInput.jsx'
import CategoryChipRow from './CategoryChipRow.jsx'
import DateChipRow from './DateChipRow.jsx'
import { CATEGORIES, CAT_META, INCOME_CATEGORIES, EVENT_CATS } from '../utils.js'
import { CAT_ICONS, CheckIcon } from '../Icons.jsx'

const TITLES = { expense: 'Edit expense', income: 'Edit income', event: 'Edit event' }
const EVENT_CAT_LIST = ['', ...Object.keys(EVENT_CATS)]
const EVENT_CAT_META = { '': { label: 'No category', color: 'var(--text3)' }, ...EVENT_CATS }

export default function EditEntrySheet({ entry, onSave, onDelete, onClose }) {
  const isEvent = entry._type === 'event'
  const initial = {
    description: entry.description || entry.title || '',
    amount: entry.amount != null ? String(entry.amount) : '',
    category: entry.category || (entry._type === 'income' ? INCOME_CATEGORIES[0] : entry._type === 'event' ? '' : CATEGORIES[0]),
    date: entry.date || '',
    time: entry.time || '',
    notes: entry.notes || '',
  }
  const initialRef = useRef(initial)
  const [form, setForm]           = useState(initial)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [saved, setSaved]         = useState(false)

  const dirty = Object.keys(initialRef.current).some(k => form[k] !== initialRef.current[k])

  const canSave = dirty && (isEvent
    ? form.description.trim() && form.date
    : form.description.trim() && form.amount !== '' && form.date)

  const handleSave = async () => {
    if (isEvent) {
      await onSave({
        title: form.description.trim(),
        date: form.date,
        time: form.time || null,
        category: form.category || null,
        notes: form.notes.trim() || null,
      })
    } else {
      await onSave({
        description: form.description.trim(),
        amount: parseFloat(form.amount) || 0,
        category: form.category,
        date: form.date,
        notes: form.notes.trim() || null,
      })
    }
    setSaved(true)
    setTimeout(onClose, 250)
  }

  const requestClose = () => {
    if (dirty) setDiscardOpen(true)
    else onClose()
  }

  const categoryProps = entry._type === 'income'
    ? { categories: INCOME_CATEGORIES, meta: CAT_META, icons: CAT_ICONS }
    : entry._type === 'event'
    ? { categories: EVENT_CAT_LIST, meta: EVENT_CAT_META, icons: CAT_ICONS }
    : { categories: CATEGORIES, meta: CAT_META, icons: CAT_ICONS }

  return (
    <Sheet title={TITLES[entry._type]} onClose={requestClose}>
      {!isEvent && (
        <AmountInput
          value={form.amount}
          onChange={v => setForm(f => ({ ...f, amount: v }))}
        />
      )}

      <div>
        <div className="sheet-field-label">{isEvent ? 'Title' : 'Description'}</div>
        <input
          className="sheet-input"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>

      <div>
        <div className="sheet-field-label">Date</div>
        <DateChipRow
          value={form.date}
          onChange={date => setForm(f => ({ ...f, date }))}
        />
      </div>

      {isEvent && (
        <div>
          <div className="sheet-field-label">Time</div>
          <input
            className="sheet-input"
            type="time"
            value={form.time}
            onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
            style={{ colorScheme: 'dark' }}
          />
        </div>
      )}

      <div>
        <div className="sheet-field-label">Category</div>
        <CategoryChipRow
          {...categoryProps}
          value={form.category}
          onChange={category => setForm(f => ({ ...f, category }))}
        />
      </div>

      <div>
        <div className="sheet-field-label">Notes (optional)</div>
        <input
          className="sheet-input"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />
      </div>

      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <button className="data-btn danger" onClick={() => setConfirmOpen(true)}>Delete</button>
      </div>

      <div className="sheet-actions">
        <button className="sheet-cancel" onClick={requestClose}>Cancel</button>
        <button
          className="sheet-save"
          disabled={!canSave || saved}
          style={{ opacity: canSave || saved ? 1 : 0.5 }}
          onClick={handleSave}
        >
          {saved ? <CheckIcon size={16} /> : 'Save'}
        </button>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title="Delete this entry?"
          message="You can undo this from the toast after deleting."
          confirmLabel="Delete"
          danger
          onConfirm={onDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      {discardOpen && (
        <ConfirmDialog
          title="Discard changes?"
          message="Your edits will be lost."
          confirmLabel="Discard"
          danger
          onConfirm={onClose}
          onCancel={() => setDiscardOpen(false)}
        />
      )}
    </Sheet>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds, no errors.

- [ ] **Step 4: Manual check**

`npm run dev`, tap an existing entry in Home's "Recent" list to open the edit sheet. Confirm: amount shows as a large mono number you can tap to select-all and retype (expense/income only, not events); category shows as a scrollable chip row with the current category pre-selected and scrolled into view; date shows as Today/Yesterday/Custom chips with day-of-week; Save is disabled until you change something, then shows a checkmark briefly before the sheet closes; tapping Delete shows a confirm mentioning undo (not "cannot be undone"); swiping the sheet down after making a change shows "Discard changes?"; swiping down with no changes closes immediately.

- [ ] **Step 5: Commit**

```bash
git add src/Icons.jsx src/components/EditEntrySheet.jsx
git commit -m "feat: rebuild EditEntrySheet with amount/category/date chip pickers"
```

---

### Task 7: Home.jsx — undo for edit save/delete

**Files:**
- Modify: `src/components/Home.jsx:684-707`

**Interfaces:**
- Consumes: `showToast(msg, type, action)` from Task 1, rebuilt `EditEntrySheet` from Task 6 (same `onSave`/`onDelete`/`onClose` prop contract as before).

- [ ] **Step 1: Replace the `EditEntrySheet` block in `Home.jsx`**

Replace lines 684-707:

```jsx
    {editingEntry && (
      <EditEntrySheet
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSave={async (updates) => {
          if (editingEntry._type === 'expense') await db.updateExpense(editingEntry.id, updates)
          else if (editingEntry._type === 'income') await db.updateIncome(editingEntry.id, updates)
          else await db.updateEvent(editingEntry.id, updates)
          setEditingEntry(null)
          await loadSpendOverview()
          await refreshRecent()
          showToast('Updated')
        }}
        onDelete={async () => {
          if (editingEntry._type === 'expense') await db.deleteExpense(editingEntry.id)
          else if (editingEntry._type === 'income') await db.deleteIncome(editingEntry.id)
          else await db.deleteEvent(editingEntry.id)
          setEditingEntry(null)
          await loadSpendOverview()
          await refreshRecent()
          showToast('Deleted')
        }}
      />
    )}
```

with:

```jsx
    {editingEntry && (
      <EditEntrySheet
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSave={async (updates) => {
          const prevEntry = editingEntry
          const type = prevEntry._type
          if (type === 'expense') await db.updateExpense(prevEntry.id, updates)
          else if (type === 'income') await db.updateIncome(prevEntry.id, updates)
          else await db.updateEvent(prevEntry.id, updates)
          setEditingEntry(null)
          await loadSpendOverview()
          await refreshRecent()
          const revert = {}
          for (const key of Object.keys(updates)) revert[key] = prevEntry[key]
          showToast('Entry updated', 'success', {
            label: 'UNDO',
            onClick: async () => {
              if (type === 'expense') await db.updateExpense(prevEntry.id, revert)
              else if (type === 'income') await db.updateIncome(prevEntry.id, revert)
              else await db.updateEvent(prevEntry.id, revert)
              await loadSpendOverview()
              await refreshRecent()
            },
          })
        }}
        onDelete={async () => {
          const prevEntry = editingEntry
          const type = prevEntry._type
          if (type === 'expense') await db.deleteExpense(prevEntry.id)
          else if (type === 'income') await db.deleteIncome(prevEntry.id)
          else await db.deleteEvent(prevEntry.id)
          setEditingEntry(null)
          await loadSpendOverview()
          await refreshRecent()
          showToast('Entry deleted', 'success', {
            label: 'UNDO',
            onClick: async () => {
              if (type === 'expense') await db.addExpense(prevEntry)
              else if (type === 'income') await db.addIncome(prevEntry)
              else await db.addEvent(prevEntry)
              await loadSpendOverview()
              await refreshRecent()
            },
          })
        }}
      />
    )}
```

(`db.addExpense`/`addIncome`/`addEvent` each build their insert row by reading only the specific fields they need off the object passed in — `description`/`amount`/`category`/`date`/`notes` for expense/income, `title`/`date`/`time`/`category`/`notes`/`recurring`/`end_date`/`reminder_minutes` for event — all of which are already present on `prevEntry` since it's a full row fetched from Supabase. Passing `prevEntry` straight through is correct and doesn't require field remapping.)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds, no errors.

- [ ] **Step 3: Manual check**

`npm run dev`. Edit an expense's amount, save, confirm the toast reads "Entry updated" with an UNDO button, tap UNDO, confirm the amount reverts in the Recent list. Delete an expense, confirm "Entry deleted" + UNDO, tap UNDO, confirm the expense reappears (note: it may move position in the list since it's re-inserted with a new id — that's expected). Repeat once for an income entry and once for an event, editing/deleting/undoing via both the Home "Recent" list and the spend-overlay list (tap the spending summary card to open it) — same `EditEntrySheet` instance handles both.

- [ ] **Step 4: Commit**

```bash
git add src/components/Home.jsx
git commit -m "feat: add undo toast for entry edit and delete"
```

---

### Task 8: Home.jsx — undo for NLP log and preset quick-log

**Files:**
- Modify: `src/components/Home.jsx:227-248` (`handleSend`)
- Modify: `src/components/Home.jsx:270-283` (`handleLogAmount`)

**Interfaces:**
- Consumes: `showToast(msg, type, action)` from Task 1. `onLogged` (already a prop of `Home`, passed from `App.jsx`) remains the mechanism that forces `Home` to remount with fresh data after a log or an undo of a log — this task's undo closures call only `db`, captured row ids, and `onLogged`, never `Home`'s own local `setRecent`/`refreshRecent`, because by the time the 5-second undo window is open, `onLogged()` has already fired once and swapped in a new `Home` instance whose local state is not the instance the closure was created in.

- [ ] **Step 1: Replace `handleSend` in `Home.jsx`**

Replace lines 227-248:

```jsx
  const handleSend = async () => {
    const input = text.trim()
    if (!input || loading) return
    setText('')
    setLoading(true)
    try {
      const parsed = await parseInput(input)
      let logged = []
      if (parsed.expense) { await db.addExpense(parsed.expense); logged.push('expense') }
      if (parsed.event)   { await db.addEvent(parsed.event);     logged.push('event') }
      if (parsed.income)  { await db.addIncome(parsed.income);   logged.push('income') }
      if (logged.length === 0) { showToast('Could not parse that', 'error'); setLoading(false); return }
      triggerBurst()
      showToast(
        logged.length === 2 ? 'Logged expense + event' :
        logged[0] === 'expense' ? 'Expense logged' :
        logged[0] === 'income'  ? 'Income logged' : 'Event added'
      )
      await refreshRecent(); onLogged()
    } catch { showToast('Parse failed — check API key', 'error') }
    setLoading(false)
  }
```

with:

```jsx
  const handleSend = async () => {
    const input = text.trim()
    if (!input || loading) return
    setText('')
    setLoading(true)
    try {
      const parsed = await parseInput(input)
      const created = []
      if (parsed.expense) created.push(['expense', await db.addExpense(parsed.expense)])
      if (parsed.event)   created.push(['event',   await db.addEvent(parsed.event)])
      if (parsed.income)  created.push(['income',  await db.addIncome(parsed.income)])
      if (created.length === 0) { showToast('Could not parse that', 'error'); setLoading(false); return }
      triggerBurst()
      const msg =
        created.length === 2 ? 'Logged expense + event' :
        created[0][0] === 'expense' ? 'Expense logged' :
        created[0][0] === 'income'  ? 'Income logged' : 'Event added'
      showToast(msg, 'success', {
        label: 'UNDO',
        onClick: async () => {
          for (const [type, row] of created) {
            if (type === 'expense') await db.deleteExpense(row.id)
            else if (type === 'income') await db.deleteIncome(row.id)
            else await db.deleteEvent(row.id)
          }
          onLogged()
        },
      })
      await refreshRecent(); onLogged()
    } catch { showToast('Parse failed — check API key', 'error') }
    setLoading(false)
  }
```

- [ ] **Step 2: Replace `handleLogAmount` in `Home.jsx`**

Replace lines 270-283:

```jsx
  const handleLogAmount = async () => {
    const amount = parseFloat(amountVal)
    if (isNaN(amount) || amount <= 0) return
    const chip = amountChip
    await db.addExpense({
      description: chip.label,
      amount,
      category: chip.category,
      date: new Date().toISOString().split('T')[0],
    })
    showToast(`${chip.label} — ${formatRM(amount)}`)
    setAmountChip(null)
    refreshRecent(); onLogged()
  }
```

with:

```jsx
  const handleLogAmount = async () => {
    const amount = parseFloat(amountVal)
    if (isNaN(amount) || amount <= 0) return
    const chip = amountChip
    const row = await db.addExpense({
      description: chip.label,
      amount,
      category: chip.category,
      date: new Date().toISOString().split('T')[0],
    })
    showToast(`${chip.label} — ${formatRM(amount)}`, 'success', {
      label: 'UNDO',
      onClick: async () => { await db.deleteExpense(row.id); onLogged() },
    })
    setAmountChip(null)
    refreshRecent(); onLogged()
  }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds, no errors.

- [ ] **Step 4: Manual check**

`npm run dev`. Type a natural-language entry (e.g. "coffee 8"), send it, confirm the resulting toast has an UNDO button; tap UNDO before the 5s window closes and confirm the entry disappears from Recent (the screen will visibly refresh since `onLogged()` remounts `Home`). Repeat via a preset quick-log chip (e.g. tap "Groceries", enter an amount, log it) and undo that too. Also let a toast run past 5 seconds without tapping UNDO and confirm the entry stays logged.

- [ ] **Step 5: Commit**

```bash
git add src/components/Home.jsx
git commit -m "feat: add undo toast for NLP log and preset quick-log"
```

---

## Final verification (after Task 8)

- [ ] Run `npm run build` one more time from a clean state to confirm the whole branch builds together.
- [ ] Full manual pass on an iOS Safari device or simulator (this app's actual target runtime): keyboard-aware save button, swipe-dismiss with and without unsaved changes, amount thousand-separator formatting (empty / single digit / 4+ digits / decimal), category chip auto-scroll for a category near the end of the row, and all four undo paths (edit, delete, NLP log, preset log).
- [ ] Confirm no regressions in Calendar/Settings/Spending-DonutChart-in-Home, since `Sheet.jsx` and `Toast.jsx` are shared by those screens too.
- [ ] Once verified on-device, proceed to superpowers:finishing-a-development-branch to merge `ux-revamp` independently, per the user's original instruction to ship Phase 0 first.
