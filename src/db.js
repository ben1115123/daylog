import supabase from './supabase.js'

const CACHE = {
  expenses: 'dl_cache_expenses',
  events:   'dl_cache_events',
}

const LS = {
  budgets:  'dl_budgets',
  settings: 'dl_settings',
  income:   'dl_income',
}

const DEFAULT_BUDGETS = {
  food: 400, transport: 200, grocery: 400,
  rental: 1000, subscription: 200, sports: 150, shopping: 200,
  coffee: 100, dining: 200, petrol: 150, toll: 50,
  online_shopping: 150, health: 100, entertainment: 100,
  travel: 200, utilities: 100, education: 100,
}

const DEFAULT_SETTINGS = {
  currency: 'RM',
  totalBudget: 3500,
  name: '',
}

function lsLoad(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
function lsSave(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}
function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export let offlineMode = false

function setOffline(val) {
  if (offlineMode === val) return
  offlineMode = val
  window.dispatchEvent(new CustomEvent('daylog:offline', { detail: val }))
}

/* ── Pure sync helpers ───────────────────────────────── */

export function expandEvents(base, fromDate, toDate) {
  const ceiling = toDate || (() => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split('T')[0]
  })()
  const result = []
  base.forEach(ev => {
    if (!ev.recurring) { result.push(ev); return }
    const end = new Date(ceiling + 'T00:00:00')
    let cur = new Date(ev.date + 'T00:00:00'), guard = 0
    while (cur <= end && guard++ < 500) {
      const dateStr = cur.toISOString().split('T')[0]
      result.push({ ...ev, date: dateStr, isRecurringInstance: dateStr !== ev.date, _baseId: ev.id })
      if (ev.recurring === 'daily')        cur.setDate(cur.getDate() + 1)
      else if (ev.recurring === 'weekly')  cur.setDate(cur.getDate() + 7)
      else if (ev.recurring === 'monthly') cur.setMonth(cur.getMonth() + 1)
      else break
    }
  })
  result.sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1)
  return result
}

export function computeRecentMonths(allExpenses, count = 6) {
  const now = new Date()
  const result = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear(), month = d.getMonth()
    const prefix = monthKey(year, month)
    const expenses = allExpenses.filter(e => e.date?.startsWith(prefix))
    const total = expenses.reduce((s, e) => s + (e.amount || 0), 0)
    result.push({ year, month, total, key: prefix })
  }
  return result
}

/* ── db object ───────────────────────────────────────── */

export const db = {

  /* ── Expenses ──────────────────────────────────────── */
  async getExpenses() {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      lsSave(CACHE.expenses, data)
      setOffline(false)
      return data
    } catch {
      setOffline(true)
      return lsLoad(CACHE.expenses, [])
    }
  },

  async addExpense(exp) {
    const row = {
      description: exp.description,
      amount:      exp.amount,
      category:    exp.category,
      date:        exp.date,
    }
    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert(row)
        .select()
        .single()
      if (error) throw error
      const cache = lsLoad(CACHE.expenses, [])
      lsSave(CACHE.expenses, [data, ...cache])
      return data
    } catch {
      setOffline(true)
      const fallback = { ...row, id: Date.now() + Math.random(), created_at: new Date().toISOString() }
      const cache = lsLoad(CACHE.expenses, [])
      lsSave(CACHE.expenses, [fallback, ...cache])
      return fallback
    }
  },

  async updateExpense(id, updates) {
    try {
      const { error } = await supabase.from('expenses').update(updates).eq('id', id)
      if (error) throw error
    } catch {
      setOffline(true)
    }
    const cache = lsLoad(CACHE.expenses, [])
    const idx = cache.findIndex(e => e.id === id)
    if (idx !== -1) { cache[idx] = { ...cache[idx], ...updates }; lsSave(CACHE.expenses, cache) }
  },

  async deleteExpense(id) {
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    } catch {
      setOffline(true)
    }
    lsSave(CACHE.expenses, lsLoad(CACHE.expenses, []).filter(e => e.id !== id))
  },

  /* ── Events ────────────────────────────────────────── */
  async getEvents() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true })
      if (error) throw error
      lsSave(CACHE.events, data)
      setOffline(false)
      return data
    } catch {
      setOffline(true)
      return lsLoad(CACHE.events, [])
    }
  },

  async addEvent(event) {
    const row = {
      title:     event.title,
      date:      event.date,
      time:      event.time      || null,
      category:  event.category  || null,
      notes:     event.notes     || null,
      recurring: event.recurring || null,
    }
    try {
      const { data, error } = await supabase
        .from('events')
        .insert(row)
        .select()
        .single()
      if (error) throw error
      const cache = lsLoad(CACHE.events, [])
      cache.push(data)
      cache.sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1)
      lsSave(CACHE.events, cache)
      return data
    } catch {
      setOffline(true)
      const fallback = { ...row, id: Date.now() + Math.random(), created_at: new Date().toISOString() }
      const cache = lsLoad(CACHE.events, [])
      cache.push(fallback)
      cache.sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1)
      lsSave(CACHE.events, cache)
      return fallback
    }
  },

  async updateEvent(id, updates) {
    try {
      const { error } = await supabase.from('events').update(updates).eq('id', id)
      if (error) throw error
    } catch {
      setOffline(true)
    }
    const cache = lsLoad(CACHE.events, [])
    const idx = cache.findIndex(e => e.id === id)
    if (idx !== -1) { cache[idx] = { ...cache[idx], ...updates }; lsSave(CACHE.events, cache) }
  },

  async deleteEvent(id) {
    try {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) throw error
    } catch {
      setOffline(true)
    }
    lsSave(CACHE.events, lsLoad(CACHE.events, []).filter(e => e.id !== id))
  },

  /* ── Month / range queries ─────────────────────────── */
  async getMonthExpenses(year, month) {
    const prefix = monthKey(year, month)
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', `${prefix}-01`)
        .lte('date', `${prefix}-31`)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    } catch {
      setOffline(true)
      return lsLoad(CACHE.expenses, []).filter(e => e.date?.startsWith(prefix))
    }
  },

  async getExpandedEvents(fromDate, toDate) {
    const base = await db.getEvents()
    return expandEvents(base, fromDate, toDate)
  },

  async getUpcomingEvents(limit = 10) {
    const today = new Date().toISOString().split('T')[0]
    const base  = await db.getEvents()
    return expandEvents(base, today).filter(e => e.date >= today).slice(0, limit)
  },

  /* ── Budgets / Settings (localStorage) ─────────────── */
  getBudgets:   () => ({ ...DEFAULT_BUDGETS, ...lsLoad(LS.budgets, {}) }),
  saveBudgets:  (v) => lsSave(LS.budgets, v),
  getSettings:  () => ({ ...DEFAULT_SETTINGS, ...lsLoad(LS.settings, {}) }),
  saveSettings: (v) => lsSave(LS.settings, v),

  /* ── Income (localStorage) ──────────────────────────── */
  getAllIncome:  () => lsLoad(LS.income, {}),
  getIncome(year, month)          { return db.getAllIncome()[monthKey(year, month)] || 0 },
  saveIncome(year, month, amount) {
    const all = db.getAllIncome()
    all[monthKey(year, month)] = amount
    lsSave(LS.income, all)
  },
}

export { DEFAULT_BUDGETS }
