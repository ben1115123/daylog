const KEYS = { expenses: 'dl_expenses', events: 'dl_events', budgets: 'dl_budgets', settings: 'dl_settings' }

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

export const db = {
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

  getEvents: () => load(KEYS.events, []),
  saveEvents: (v) => save(KEYS.events, v),
  addEvent(event) {
    const all = db.getEvents()
    const newEvent = { ...event, id: Date.now() + Math.random(), createdAt: new Date().toISOString() }
    all.push(newEvent)
    all.sort((a, b) => new Date(a.date + (a.time || '')) - new Date(b.date + (b.time || '')))
    db.saveEvents(all)
    return newEvent
  },
  deleteEvent(id) {
    db.saveEvents(db.getEvents().filter(e => e.id !== id))
  },

  getBudgets: () => load(KEYS.budgets, DEFAULT_BUDGETS),
  saveBudgets: (v) => save(KEYS.budgets, v),

  getSettings: () => ({ ...DEFAULT_SETTINGS, ...load(KEYS.settings, {}) }),
  saveSettings: (v) => save(KEYS.settings, v),

  getMonthExpenses(year, month) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    return db.getExpenses().filter(e => e.date?.startsWith(prefix))
  },

  getUpcomingEvents(limit = 10) {
    const today = new Date().toISOString().split('T')[0]
    return db.getEvents().filter(e => e.date >= today).slice(0, limit)
  }
}

export { DEFAULT_BUDGETS }
