const KEYS = {
  expenses: 'dl_expenses',
  events:   'dl_events',
  budgets:  'dl_budgets',
  settings: 'dl_settings',
  income:   'dl_income',
}

const DEFAULT_BUDGETS = {
  food: 600, transport: 300, grocery: 400,
  rental: 1000, subscription: 200, sports: 150, shopping: 300
}

const DEFAULT_SETTINGS = {
  currency: 'RM',
  totalBudget: 3500,
  name: 'Ben'
}

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export const db = {
  /* ── Expenses ────────────────────────────────────── */
  getExpenses: () => load(KEYS.expenses, []),
  saveExpenses: (v) => save(KEYS.expenses, v),
  addExpense(exp) {
    const all = db.getExpenses()
    const newExp = { ...exp, id: Date.now() + Math.random(), createdAt: new Date().toISOString() }
    all.unshift(newExp)
    db.saveExpenses(all)
    return newExp
  },
  deleteExpense(id) {
    db.saveExpenses(db.getExpenses().filter(e => e.id !== id))
  },

  /* ── Events ──────────────────────────────────────── */
  getEvents: () => load(KEYS.events, []),
  saveEvents: (v) => save(KEYS.events, v),
  addEvent(event) {
    const all = db.getEvents()
    const newEvent = { ...event, id: Date.now() + Math.random(), createdAt: new Date().toISOString() }
    all.push(newEvent)
    all.sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1)
    db.saveEvents(all)
    return newEvent
  },
  deleteEvent(id) {
    db.saveEvents(db.getEvents().filter(e => e.id !== id))
  },

  /* Expand recurring events into concrete instances */
  getExpandedEvents(fromDate, toDate) {
    const base = db.getEvents()
    const today = fromDate || new Date().toISOString().split('T')[0]
    const ceiling = toDate || (() => {
      const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split('T')[0]
    })()
    const result = []

    base.forEach(ev => {
      if (!ev.recurring) {
        result.push(ev)
        return
      }
      const start = new Date(ev.date + 'T00:00:00')
      const end   = new Date(ceiling + 'T00:00:00')
      let cur = new Date(start)
      let guard = 0
      while (cur <= end && guard++ < 500) {
        const dateStr = cur.toISOString().split('T')[0]
        result.push({ ...ev, date: dateStr, isRecurringInstance: dateStr !== ev.date, _baseId: ev.id })
        if (ev.recurring === 'daily')   cur.setDate(cur.getDate() + 1)
        else if (ev.recurring === 'weekly')  cur.setDate(cur.getDate() + 7)
        else if (ev.recurring === 'monthly') cur.setMonth(cur.getMonth() + 1)
        else break
      }
    })

    result.sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1)
    return result
  },

  /* ── Budgets / Settings ──────────────────────────── */
  getBudgets: () => load(KEYS.budgets, DEFAULT_BUDGETS),
  saveBudgets: (v) => save(KEYS.budgets, v),

  getSettings: () => ({ ...DEFAULT_SETTINGS, ...load(KEYS.settings, {}) }),
  saveSettings: (v) => save(KEYS.settings, v),

  /* ── Month queries ───────────────────────────────── */
  getMonthExpenses(year, month) {
    const prefix = monthKey(year, month)
    return db.getExpenses().filter(e => e.date?.startsWith(prefix))
  },

  /* Last N calendar months, oldest first */
  getRecentMonths(count = 6) {
    const now = new Date()
    const result = []
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = d.getMonth()
      const expenses = db.getMonthExpenses(year, month)
      const total = expenses.reduce((s, e) => s + (e.amount || 0), 0)
      result.push({ year, month, total, key: monthKey(year, month) })
    }
    return result
  },

  /* ── Income (for savings view) ───────────────────── */
  getAllIncome: () => load(KEYS.income, {}),
  getIncome(year, month) {
    return db.getAllIncome()[monthKey(year, month)] || 0
  },
  saveIncome(year, month, amount) {
    const all = db.getAllIncome()
    all[monthKey(year, month)] = amount
    save(KEYS.income, all)
  },

  /* ── Legacy helper ───────────────────────────────── */
  getUpcomingEvents(limit = 10) {
    const today = new Date().toISOString().split('T')[0]
    return db.getExpandedEvents(today).filter(e => e.date >= today).slice(0, limit)
  }
}

export { DEFAULT_BUDGETS }
