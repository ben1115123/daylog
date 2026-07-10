# Scroll Clipping Fix + Entry Edit/Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix content clipped behind the fixed bottom tab bar on every scrollable screen, and let the user tap any logged expense/income/event to edit or delete it.

**Architecture:** (1) Measure the bottom nav's real rendered height in JS via `ResizeObserver` and expose it as a CSS custom property (`--tabbar-height`) on the app root; apply it as `padding-bottom` on the four real scroll containers. (2) Add a single reusable `EditEntrySheet` bottom-sheet component; wire it into the Spending-detail overlay's new entries list and into Home's Upcoming event pills; add the one missing db function (`updateIncome`) it needs.

**Tech Stack:** React 18 + Vite, plain CSS (CSS custom properties), Supabase JS client. No test framework is configured in this repo (`package.json` has no test script) — verification is `npm run build` (catches syntax/import errors) plus manual `npm run dev` browser checks, matching this project's existing verification style.

## Global Constraints

- No `box-shadow`, no `backdrop-filter`/glassmorphism, no gradients, no emoji, no second accent color — per `daylog-clean/CLAUDE.md` "What Never Belongs in This Codebase".
- Reuse existing design-system classes (`.card`, `.entry-row`, `.entry-icon-wrap`, `.sheet-input`, `.sheet-select`, `.sheet-cancel`, `.sheet-save`, `.data-btn.danger`) instead of inventing new ones, unless a layout genuinely has no existing equivalent.
- `Spending.jsx` (the standalone component) is dead code — not imported by `App.jsx`, only `DonutChart` is imported from it. Do not touch it or wire it up.
- Don't touch `.bottom-nav` itself — its current fixed-pixel padding is already correct (confirmed via git log: safe-area-inset was deliberately reverted in commit `6b9a5fe`).
- Do not modify `Home.jsx`'s "Recent" section — out of scope per user decision.

---

### Task 1: Measure bottom-nav height live, expose as `--tabbar-height`

**Files:**
- Modify: `src/index.css` (add fallback var)
- Modify: `src/App.jsx`
- Test: manual (`npm run build`, then `npm run dev` + DevTools)

**Interfaces:**
- Produces: CSS custom property `--tabbar-height` readable by any descendant of `.app`, always a `px` string, kept live-updated on resize/orientation change.

- [ ] **Step 1: Add a fallback value for `--tabbar-height` in `src/index.css`**

Open `src/index.css` and find the `:root { ... }` block that defines the other tokens (`--bg`, `--accent`, etc — near the top of the file). Add one line inside it:

```css
  --tabbar-height: 84px; /* fallback until JS measures the real nav height */
```

- [ ] **Step 2: Give the bottom nav a ref and measure it in `App.jsx`**

In `src/App.jsx`, the import line is:

```js
import { useState, useCallback, useEffect, useRef } from 'react'
```

`useRef` is already imported — no import changes needed.

Inside `export default function App() {`, alongside the other refs/state (near `const recurringChecked = useRef(false)`), add:

```js
  const navRef = useRef(null)
  const appRef = useRef(null)
```

Add a new `useEffect` (place it near the other `useEffect` calls, after the `recurringChecked` effect). Its dependency is `[showOnboarding]`, not `[]` — the real `<nav>` only exists in the DOM once the splash/onboarding gates have passed (see the early `return`s above this component's final JSX), so the effect must re-run when `showOnboarding` flips to `false` to find the now-mounted refs:

```js
  useEffect(() => {
    if (!navRef.current || !appRef.current) return
    const el = navRef.current
    const target = appRef.current
    const apply = () => {
      target.style.setProperty('--tabbar-height', `${el.getBoundingClientRect().height}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [showOnboarding])
```

- [ ] **Step 3: Attach the refs to the JSX**

Still in `src/App.jsx`, find the final returned JSX:

```jsx
  return (
    <div className="app">
      {isOffline && <div className="offline-badge">offline</div>}
      <div className="app-body">
        {tab === 'home'     && <Home     key={refresh} showToast={showToast} onLogged={onLogged} />}
        {tab === 'insights' && <Insights key={refresh} showToast={showToast} />}
        {tab === 'settings' && <Settings key={refresh} showToast={showToast} />}
      </div>
      <nav className="bottom-nav">
```

Change the two opening tags to attach the refs:

```jsx
  return (
    <div className="app" ref={appRef}>
      {isOffline && <div className="offline-badge">offline</div>}
      <div className="app-body">
        {tab === 'home'     && <Home     key={refresh} showToast={showToast} onLogged={onLogged} />}
        {tab === 'insights' && <Insights key={refresh} showToast={showToast} />}
        {tab === 'settings' && <Settings key={refresh} showToast={showToast} />}
      </div>
      <nav className="bottom-nav" ref={navRef}>
```

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: build succeeds with no errors (exit code 0).

- [ ] **Step 5: Verify live in the browser**

Run: `npm run dev`, open the printed local URL in a browser, open DevTools → Elements, select the `.app` div, and check its inline `style` attribute shows `--tabbar-height: <number>px` matching the visible nav's height (use the DevTools ruler/box model on `.bottom-nav` to confirm the number matches, roughly 80-90px).

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/App.jsx
git commit -m "feat: measure bottom-nav height live via ResizeObserver"
```

---

### Task 2: Apply `--tabbar-height` padding to the four scroll containers

**Files:**
- Modify: `src/App.css`
- Modify: `src/components/Home.css`
- Test: manual (`npm run build`, then `npm run dev` + scroll each screen)

**Interfaces:**
- Consumes: `--tabbar-height` custom property from Task 1 (falls back to the `84px` default from `index.css` if JS hasn't run yet).

- [ ] **Step 1: `.app-body` (backs Insights and Settings tabs)**

In `src/App.css`, find:

```css
.app-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
```

Change to:

```css
.app-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: var(--tabbar-height);
}
```

- [ ] **Step 2: `.home-screen` (Home tab's own scroll wrapper)**

In `src/components/Home.css`, find:

```css
.home-screen {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 3rem;
}
```

Change to:

```css
.home-screen {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: var(--tabbar-height);
}
```

- [ ] **Step 3: `.spend-overlay-full` (live Spending-detail view)**

In `src/components/Home.css`, find:

```css
.spend-overlay-full {
  padding: 52px 20px 40px;
}
```

Change to:

```css
.spend-overlay-full {
  padding: 52px 20px var(--tabbar-height);
}
```

- [ ] **Step 4: `.cal-overlay-full` (live Calendar-detail view)**

In `src/components/Home.css`, find the shared rule:

```css
.spend-overlay-full,
.cal-overlay-full {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  transition: opacity 0.3s ease 0.1s;
}
```

`.cal-overlay-full` has no per-selector padding rule of its own today (only the shared one above, and `.cal-overlay-body` beneath it may have its own padding — check for a `.cal-overlay-body` rule in the same file and leave it alone if it only sets horizontal/top padding). Add a new rule right after the shared block:

```css
.cal-overlay-full {
  padding-bottom: var(--tabbar-height);
}
```

(If `grep -n "cal-overlay-full" src/components/Home.css` shows an existing dedicated rule beyond the shared one, add `padding-bottom: var(--tabbar-height);` into that existing rule instead of creating a new one — don't create two rules for the same selector.)

- [ ] **Step 5: Verify it builds**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 6: Manually verify all four screens**

Run: `npm run dev`, open in a browser at a mobile width (~390px via DevTools device toolbar):
1. Log (Home) tab — scroll the Recent list to the very bottom, confirm the last entry row is fully visible above the nav.
2. Insights tab — scroll to the bottom, confirm the last element clears the nav.
3. Settings tab — scroll to the bottom, confirm the last element (e.g. "Clear all data") clears the nav.
4. From Home, tap the Spending card to expand it, scroll to the bottom of that overlay, confirm content clears the nav.
5. From Home, tap the Upcoming strip to expand the Calendar overlay, scroll to the bottom, confirm content clears the nav.

- [ ] **Step 7: Commit**

```bash
git add src/App.css src/components/Home.css
git commit -m "fix: add tabbar-height padding to all scroll containers so content isn't clipped"
```

---

### Task 3: Add `db.updateIncome`

**Files:**
- Modify: `src/db.js:414-421` (right before `deleteIncome`)
- Test: manual (`npm run build`)

**Interfaces:**
- Produces: `async function db.updateIncome(id, updates)` — same shape/contract as the existing `db.updateExpense(id, updates)` at `src/db.js:160-170`.

- [ ] **Step 1: Add the function**

In `src/db.js`, find:

```js
  async deleteIncome(id) {
    try {
      const { error } = await supabase.from('income').delete().eq('id', id)
      if (error) throw error
    } catch {
      setOffline(true)
    }
    lsSave(CACHE.income, lsLoad(CACHE.income, []).filter(e => e.id !== id))
  },
```

Add a new method directly above it (mirroring `updateExpense`'s structure exactly):

```js
  async updateIncome(id, updates) {
    try {
      const { error } = await supabase.from('income').update(updates).eq('id', id)
      if (error) throw error
    } catch {
      setOffline(true)
    }
    const cache = lsLoad(CACHE.income, [])
    const idx = cache.findIndex(e => e.id === id)
    if (idx !== -1) { cache[idx] = { ...cache[idx], ...updates }; lsSave(CACHE.income, cache) }
  },

  async deleteIncome(id) {
    try {
      const { error } = await supabase.from('income').delete().eq('id', id)
      if (error) throw error
    } catch {
      setOffline(true)
    }
    lsSave(CACHE.income, lsLoad(CACHE.income, []).filter(e => e.id !== id))
  },
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db.js
git commit -m "feat: add db.updateIncome to match updateExpense/updateEvent"
```

---

### Task 4: Create the `EditEntrySheet` component

**Files:**
- Create: `src/components/EditEntrySheet.jsx`
- Test: manual (`npm run build`; full interactive test happens in Tasks 5-6 once it's mounted)

**Interfaces:**
- Consumes: `Sheet` (default export, `src/components/Sheet.jsx`), `ConfirmDialog` (default export, `src/components/ConfirmDialog.jsx`), `CATEGORIES`/`CAT_META`/`INCOME_CATEGORIES`/`formatDate` (named exports, `src/utils.js`).
- Produces: default export `EditEntrySheet({ entry, onSave, onDelete, onClose })` where:
  - `entry` — object with `_type: 'expense' | 'income' | 'event'`, plus `id`, `date`, `notes`, `category`, and either (`description`, `amount`) for expense/income or (`title`, `time`) for event.
  - `onSave(updates)` — called with a plain object of the edited fields (same shape as `entry`, minus `id`/`_type`); caller is responsible for persisting it.
  - `onDelete()` — called only after the user confirms the destructive prompt; caller is responsible for actually deleting.
  - `onClose()` — called to dismiss without saving (backdrop tap, close button, or Cancel).

- [ ] **Step 1: Write the component**

Create `src/components/EditEntrySheet.jsx`:

```jsx
import { useState } from 'react'
import Sheet from './Sheet.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { CATEGORIES, CAT_META, INCOME_CATEGORIES } from '../utils.js'

const TITLES = { expense: 'Edit expense', income: 'Edit income', event: 'Edit event' }

export default function EditEntrySheet({ entry, onSave, onDelete, onClose }) {
  const isEvent = entry._type === 'event'
  const [form, setForm] = useState({
    description: entry.description || entry.title || '',
    amount: entry.amount ?? '',
    category: entry.category || (entry._type === 'income' ? INCOME_CATEGORIES[0] : CATEGORIES[0]),
    date: entry.date || '',
    time: entry.time || '',
    notes: entry.notes || '',
  })
  const [confirmOpen, setConfirmOpen] = useState(false)

  const canSave = isEvent
    ? form.description.trim() && form.date
    : form.description.trim() && form.amount && form.date

  const handleSave = () => {
    if (isEvent) {
      onSave({
        title: form.description.trim(),
        date: form.date,
        time: form.time || null,
        category: form.category || null,
        notes: form.notes.trim() || null,
      })
    } else {
      onSave({
        description: form.description.trim(),
        amount: parseFloat(form.amount) || 0,
        category: form.category,
        date: form.date,
        notes: form.notes.trim() || null,
      })
    }
  }

  return (
    <Sheet title={TITLES[entry._type]} onClose={onClose}>
      <div>
        <div className="sheet-field-label">{isEvent ? 'Title' : 'Description'}</div>
        <input
          className="sheet-input"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>

      {!isEvent && (
        <div className="sheet-row">
          <div>
            <div className="sheet-field-label">Amount (RM)</div>
            <input
              className="sheet-input"
              type="number"
              inputMode="decimal"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div>
            <div className="sheet-field-label">Date</div>
            <input
              className="sheet-input"
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>
      )}

      {isEvent && (
        <div className="sheet-row">
          <div>
            <div className="sheet-field-label">Date</div>
            <input
              className="sheet-input"
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={{ colorScheme: 'dark' }}
            />
          </div>
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
        </div>
      )}

      <div>
        <div className="sheet-field-label">Category</div>
        <select
          className="sheet-select"
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        >
          {entry._type === 'income'
            ? INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c === 'salary' ? 'Salary' : 'Trading'}</option>)
            : CATEGORIES.map(c => <option key={c} value={c}>{CAT_META[c]?.label}</option>)}
        </select>
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
        <button className="sheet-cancel" onClick={onClose}>Cancel</button>
        <button
          className="sheet-save"
          disabled={!canSave}
          style={{ opacity: canSave ? 1 : 0.5 }}
          onClick={handleSave}
        >
          Save
        </button>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title="Delete this entry?"
          message="This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={onDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </Sheet>
  )
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds with no errors (this component isn't mounted anywhere yet, so a successful build here just confirms no syntax/import errors — e.g. that `INCOME_CATEGORIES` really is exported from `utils.js`).

- [ ] **Step 3: Commit**

```bash
git add src/components/EditEntrySheet.jsx
git commit -m "feat: add EditEntrySheet component for editing/deleting log entries"
```

---

### Task 5: Wire entries list into the Spending-detail overlay

**Files:**
- Modify: `src/components/Home.jsx`
- Test: manual (`npm run build`, then `npm run dev` interactive check)

**Interfaces:**
- Consumes: `EditEntrySheet` (Task 4), `db.updateExpense`/`db.deleteExpense` (existing), `db.updateIncome`/`db.deleteIncome` (Task 3, existing).
- Produces: `editingEntry` state in `Home`, reused by Task 6.

- [ ] **Step 1: Import `EditEntrySheet`**

In `src/components/Home.jsx`, find the import block at the top (around line 1-11) and add:

```js
import EditEntrySheet from './EditEntrySheet.jsx'
```

- [ ] **Step 2: Add `editingEntry` state**

Find where `spendTab`/`spendTabs` state is declared:

```js
  const [spendTab, setSpendTab]     = useState('thisMonth')
  const [spendTabs, setSpendTabs]   = useState(null)
```

Add right after:

```js
  const [editingEntry, setEditingEntry] = useState(null)
```

- [ ] **Step 3: Extend `buildTab` to return raw `items`**

Find `buildTab` inside `loadSpendOverview`:

```js
    const buildTab = (exp, inc) => {
      const total       = exp.reduce((s, e) => s + (e.amount || 0), 0)
      const incomeTotal = inc.reduce((s, i) => s + (i.amount || 0), 0)
      const saved       = incomeTotal - total
      const savingsRate = incomeTotal > 0 ? Math.round((saved / incomeTotal) * 100) : 0
      const byCat = {}
      exp.forEach(e => { if (e.category) byCat[e.category] = (byCat[e.category] || 0) + (e.amount || 0) })
      const donutCats = CATEGORIES.map(cat => ({
        cat, amount: byCat[cat] || 0, color: CAT_META[cat]?.color, label: CAT_META[cat]?.label,
      })).filter(c => c.amount > 0)
      const biggest = exp.length
        ? exp.reduce((max, e) => (e.amount || 0) > (max?.amount || 0) ? e : max, null)
        : null
      return { total, incomeTotal, saved, savingsRate, donutCats, biggest, entriesCount: exp.length }
    }
```

Replace the `return` line, adding an `items` array built from both `exp` and `inc`:

```js
      const items = [
        ...exp.map(e => ({ ...e, _type: 'expense' })),
        ...inc.map(i => ({ ...i, _type: 'income' })),
      ].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      return { total, incomeTotal, saved, savingsRate, donutCats, biggest, entriesCount: exp.length, items }
```

- [ ] **Step 4: Give the `avg` tab an empty `items` array**

Find:

```js
    setSpendTabs({
      thisMonth: buildTab(thisExp, thisInc),
      lastMonth: buildTab(lastExp, lastInc),
      avg: {
        total: avgTotal, incomeTotal: avgIncome, saved: avgSaved, savingsRate: avgSavingsRate,
        donutCats: avgDonutCats, biggest: avgBiggest, entriesCount: Math.round(allExp.length / n),
      },
    })
```

Add `items: []` into the `avg` object:

```js
    setSpendTabs({
      thisMonth: buildTab(thisExp, thisInc),
      lastMonth: buildTab(lastExp, lastInc),
      avg: {
        total: avgTotal, incomeTotal: avgIncome, saved: avgSaved, savingsRate: avgSavingsRate,
        donutCats: avgDonutCats, biggest: avgBiggest, entriesCount: Math.round(allExp.length / n),
        items: [],
      },
    })
```

- [ ] **Step 5: Render the entries list under the stat grid**

Find the closing of `.spend-stat-grid` inside the spend overlay render (the four `spend-stat-cell` divs end with):

```jsx
                  <div className="spend-stat-cell">
                    <div className="spend-stat-label">Savings rate</div>
                    <div className="spend-stat-val" style={{ color: data.savingsRate >= 20 ? 'var(--accent)' : data.savingsRate > 0 ? 'var(--text)' : 'var(--red)' }}>
                      {data.incomeTotal > 0 ? `${data.savingsRate}%` : '—'}
                    </div>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </div>
    )}
```

Insert a new block right after the `.spend-stat-grid` closing `</div>` and before the `</>` fragment close:

```jsx
                  <div className="spend-stat-cell">
                    <div className="spend-stat-label">Savings rate</div>
                    <div className="spend-stat-val" style={{ color: data.savingsRate >= 20 ? 'var(--accent)' : data.savingsRate > 0 ? 'var(--text)' : 'var(--red)' }}>
                      {data.incomeTotal > 0 ? `${data.savingsRate}%` : '—'}
                    </div>
                  </div>
                </div>

                {data.items.length > 0 && (
                  <div className="home-section" style={{ marginTop: 24, padding: 0 }}>
                    <div className="section-label">Entries</div>
                    <div className="card">
                      {data.items.map((item, i) => {
                        const isLast = i === data.items.length - 1
                        const meta = CAT_META[item.category]
                        const Icon = item._type === 'expense' ? CAT_ICONS[item.category] : null
                        return (
                          <div
                            key={`${item._type}-${item.id}`}
                            className={`entry-row ${isLast ? '' : 'bordered'}`}
                            onClick={() => setEditingEntry(item)}
                            role="button"
                            tabIndex={0}
                          >
                            <span className="entry-icon-wrap" style={{ color: meta?.color, background: (meta?.color || '#fff') + '18' }}>
                              {item._type === 'expense' ? (Icon && <Icon size={14} />) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                              )}
                            </span>
                            <div className="entry-body">
                              <div className="entry-title">{item.description}</div>
                              {item.notes && <div className="entry-notes">{item.notes}</div>}
                              <div className="entry-sub">{meta?.label} · {formatDate(item.date)}</div>
                            </div>
                            <div className="entry-amount" style={item._type === 'income' ? { color: meta?.color } : undefined}>
                              {item._type === 'income' ? '+' : ''}{formatRM(item.amount)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </div>
    )}
```

Note: `.home-section` normally has `padding: 28px 20px 0` (see `Home.css`); passing `padding: 0` inline here avoids double horizontal padding since `.spend-overlay-full` already has `20px` horizontal padding of its own — verify visually in Step 8 and adjust the inline padding override if the entries list looks misaligned against the stat grid above it.

- [ ] **Step 6: Mount `EditEntrySheet` and wire save/delete**

Find the end of the component's returned JSX — the `cal-card-overlay` block closes the component. Find:

```jsx
        <div className="cal-overlay-full" style={{ opacity: cal.phase === 'open' ? 1 : 0, pointerEvents: cal.phase === 'open' ? 'auto' : 'none' }}>
          <button className="cal-back" onClick={cal.close}><BackIcon /> back</button>
          <div className="cal-overlay-body">
            <Calendar showToast={showToast} />
          </div>
        </div>
      </div>
    )}
```

This is followed by the closing of the component's outer fragment/return. Add the `EditEntrySheet` mount directly after this block (still inside the same enclosing return — check indentation matches the surrounding JSX):

```jsx
        <div className="cal-overlay-full" style={{ opacity: cal.phase === 'open' ? 1 : 0, pointerEvents: cal.phase === 'open' ? 'auto' : 'none' }}>
          <button className="cal-back" onClick={cal.close}><BackIcon /> back</button>
          <div className="cal-overlay-body">
            <Calendar showToast={showToast} />
          </div>
        </div>
      </div>
    )}

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

Run `grep -n "^    )$" src/components/Home.jsx` first if unsure exactly where the component's final closing parenthesis/tag is, so this new block lands inside the same `return (...)` rather than after it.

- [ ] **Step 7: Verify it builds**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 8: Manually verify**

Run `npm run dev`, open the app, tap the Spending card to expand it:
1. Confirm an "Entries" list appears below the stat grid for "This month" and "Last month" tabs, and is hidden for "Avg".
2. Tap a row → confirm the edit sheet opens pre-filled with that entry's data.
3. Change the amount and tap Save → confirm the sheet closes, a toast shows "Updated", and the entries list + totals refresh with the new amount.
4. Tap a row → tap Delete → confirm dialog appears → confirm → confirm the row disappears, totals refresh, toast shows "Deleted".

- [ ] **Step 9: Commit**

```bash
git add src/components/Home.jsx
git commit -m "feat: add tappable entries list with edit/delete to Spending-detail overlay"
```

---

### Task 6: Tap-to-edit on Home's Upcoming event cards

**Files:**
- Modify: `src/components/Home.jsx`
- Test: manual (`npm run build`, then `npm run dev` interactive check)

**Interfaces:**
- Consumes: `editingEntry`/`setEditingEntry` and the mounted `EditEntrySheet` from Task 5 (no new mount needed — same sheet instance handles events too, since `EditEntrySheet` already branches on `entry._type === 'event'`).

- [ ] **Step 1: Make each upcoming pill tappable**

Find the closed-state Upcoming strip:

```jsx
          {upcoming.length === 0 ? (
            <div className="empty">no upcoming events</div>
          ) : (
            <div className="upcoming-strip-row">
              {upcoming.map(ev => (
                <div key={`${ev.id}-${ev.date}`} className="upcoming-pill">
                  <div className="upcoming-pill-date">{formatDate(ev.date)}</div>
                  <div className="upcoming-pill-title">{ev.title}</div>
                </div>
              ))}
            </div>
          )}
```

The parent `.upcoming-strip` card has an `onClick={cal.open}` that expands the calendar — tapping a pill must not also trigger that. Change to:

```jsx
          {upcoming.length === 0 ? (
            <div className="empty">no upcoming events</div>
          ) : (
            <div className="upcoming-strip-row">
              {upcoming.map(ev => (
                <div
                  key={`${ev.id}-${ev.date}`}
                  className="upcoming-pill"
                  onClick={(e) => { e.stopPropagation(); setEditingEntry({ ...ev, _type: 'event' }) }}
                >
                  <div className="upcoming-pill-date">{formatDate(ev.date)}</div>
                  <div className="upcoming-pill-title">{ev.title}</div>
                </div>
              ))}
            </div>
          )}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Manually verify**

Run `npm run dev`, on the Home tab:
1. Tap an Upcoming pill directly → confirm the edit sheet opens (event fields: title, date, time, category, notes — no amount field) and the Calendar overlay does *not* expand.
2. Edit the time and Save → confirm toast "Updated" and the pill's data refreshes.
3. Tap a pill → Delete → confirm → confirm the event disappears from the strip, toast shows "Deleted".
4. Tap the Upcoming card in an area *without* a pill (e.g. empty space) → confirm the Calendar overlay still expands normally (regression check for the `stopPropagation` change).

- [ ] **Step 4: Commit**

```bash
git add src/components/Home.jsx
git commit -m "feat: tap-to-edit on Home upcoming event pills"
```

---

### Task 7: Full verification pass, then push

**Files:** none (verification + push only)

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: succeeds with no errors or warnings about missing exports.

- [ ] **Step 2: Full manual regression pass**

Run `npm run dev` at mobile width (~390px):
1. Re-run all scroll checks from Task 2, Step 6.
2. Re-run all edit/delete checks from Task 5, Step 8 and Task 6, Step 3.
3. Confirm no console errors during any of the above.

- [ ] **Step 3: Push**

```bash
git push
```

(Only after every check above passes — this is the point where the user asked for "commit and push once both are verified working".)
