import supabase from './supabase.js'

const CACHE = {
  expenses:         'dl_cache_expenses',
  events:           'dl_cache_events',
  recurring:        'dl_cache_recurring',
  income:           'dl_cache_income',
  recurring_income: 'dl_cache_recurring_income',
}

const LS = {
  budgets:  'dl_budgets',
  settings: 'dl_settings',
}

const DEFAULT_BUDGETS = {
  food: 400, transport: 200, grocery: 400,
  rental: 1000, subscription: 200, sports: 150, shopping: 200,
  coffee: 100, dining: 200, petrol: 150, toll: 50,
  online_shopping: 150, health: 100, entertainment: 100,
  travel: 200, utilities: 100, education: 100, investment: 200,
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

/* ── App-wide flags (Supabase-backed, port-independent) ─ */
async function getFlag(key) {
  try {
    const { data, error } = await supabase.from('app_state').select('value').eq('key', key).maybeSingle()
    if (error) throw error
    if (data) { lsSave('dl_flag_' + key, data.value); return data.value }
    return lsLoad('dl_flag_' + key, null)
  } catch {
    return lsLoad('dl_flag_' + key, null)
  }
}
async function setFlag(key, value) {
  lsSave('dl_flag_' + key, value)
  try { await supabase.from('app_state').upsert({ key, value }) } catch {}
}

async function syncToAppleCalendar(action, event) {
  try {
    const { data, error } = await supabase.functions.invoke('sync-calendar', { body: { action, event } })
    if (error || !data?.success) return
    if (action === 'add' && data.uid && event.id) {
      await supabase.from('events').update({ apple_uid: data.uid }).eq('id', event.id)
    }
  } catch {}
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
      notes:       exp.notes || null,
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
      title:            event.title,
      date:             event.date,
      time:             event.time      || null,
      category:         event.category  || null,
      notes:            event.notes     || null,
      recurring:        event.recurring || null,
      end_date:         event.end_date  || event.endDate || null,
      reminder_minutes: event.reminder_minutes ?? event.reminderMinutes ?? null,
    }
    console.log('[daylog] addEvent row:', row)
    try {
      const { data, error } = await supabase
        .from('events')
        .insert(row)
        .select()
        .single()
      if (error) throw error
      console.log('[daylog] addEvent success:', data)
      const cache = lsLoad(CACHE.events, [])
      cache.push(data)
      cache.sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1)
      lsSave(CACHE.events, cache)
      syncToAppleCalendar('add', data)
      return data
    } catch (err) {
      console.error('[daylog] addEvent error:', err)
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
      const { data: existing } = await supabase.from('events').select('apple_uid').eq('id', id).single()
      if (existing?.apple_uid) syncToAppleCalendar('delete', { id, apple_uid: existing.apple_uid })
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) throw error
    } catch {
      setOffline(true)
    }
    lsSave(CACHE.events, lsLoad(CACHE.events, []).filter(e => e.id !== id))
  },

  /* ── Month / range queries ─────────────────────────── */
  async getMonthExpenses(year, month) {
    const prefix  = monthKey(year, month)
    const lastDay = new Date(year, month + 1, 0).getDate()
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', `${prefix}-01`)
        .lte('date', `${prefix}-${lastDay}`)
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

  /* ── Recurring expenses ────────────────────────────── */
  async getRecurring() {
    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .order('day_of_month', { ascending: true })
      if (error) throw error
      lsSave(CACHE.recurring, data)
      setOffline(false)
      return data
    } catch {
      setOffline(true)
      return lsLoad(CACHE.recurring, [])
    }
  },

  async addRecurring(item) {
    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .insert({ ...item, active: true })
        .select()
        .single()
      if (error) throw error
      const cache = lsLoad(CACHE.recurring, [])
      lsSave(CACHE.recurring, [...cache, data])
      return data
    } catch {
      setOffline(true)
      const fallback = { ...item, active: true, id: Date.now() + Math.random(), created_at: new Date().toISOString() }
      const cache = lsLoad(CACHE.recurring, [])
      lsSave(CACHE.recurring, [...cache, fallback])
      return fallback
    }
  },

  async updateRecurring(id, updates) {
    try {
      const { error } = await supabase.from('recurring_expenses').update(updates).eq('id', id)
      if (error) throw error
    } catch {
      setOffline(true)
    }
    const cache = lsLoad(CACHE.recurring, [])
    const idx = cache.findIndex(r => r.id === id)
    if (idx !== -1) { cache[idx] = { ...cache[idx], ...updates }; lsSave(CACHE.recurring, cache) }
  },

  async deleteRecurring(id) {
    return db.updateRecurring(id, { active: false })
  },

  async seedRecurring() {
    if (await getFlag('recurring_seeded')) return
    try {
      const { count, error: countErr } = await supabase
        .from('recurring_expenses')
        .select('*', { count: 'exact', head: true })
      if (countErr) return  // permissions not ready yet — skip, retry next load
      if (count > 0) { await setFlag('recurring_seeded', 'true'); return }
      const defaults = [
        { description: 'Rental',           amount: 1000,  category: 'rental',       day_of_month: 1, active: true },
        { description: 'Gym Membership',   amount: 155,   category: 'subscription', day_of_month: 1, active: true },
        { description: 'TradingView',      amount: 38,    category: 'subscription', day_of_month: 1, active: true },
        { description: 'Subscriptions',    amount: 93.50, category: 'subscription', day_of_month: 1, active: true },
        { description: 'Seasonal Parking', amount: 120,   category: 'transport',    day_of_month: 1, active: true },
      ]
      const { error } = await supabase.from('recurring_expenses').insert(defaults)
      if (!error) await setFlag('recurring_seeded', 'true')
    } catch {}
  },

  /* ── Budgets / Settings (localStorage) ─────────────── */
  getBudgets:   () => ({ ...DEFAULT_BUDGETS, ...lsLoad(LS.budgets, {}) }),
  saveBudgets:  (v) => lsSave(LS.budgets, v),
  getSettings:  () => ({ ...DEFAULT_SETTINGS, ...lsLoad(LS.settings, {}) }),
  saveSettings: (v) => lsSave(LS.settings, v),

  /* ── Income ──────────────────────────────────────────── */
  async getIncome() {
    try {
      const { data, error } = await supabase
        .from('income')
        .select('*')
        .order('date', { ascending: false })
      if (error) throw error
      lsSave(CACHE.income, data)
      setOffline(false)
      return data
    } catch {
      setOffline(true)
      return lsLoad(CACHE.income, [])
    }
  },

  async addIncome(item) {
    const row = {
      description: item.description,
      amount:      item.amount,
      category:    item.category,
      date:        item.date,
      notes:       item.notes || null,
    }
    try {
      const { data, error } = await supabase
        .from('income')
        .insert(row)
        .select()
        .single()
      if (error) throw error
      const cache = lsLoad(CACHE.income, [])
      lsSave(CACHE.income, [data, ...cache])
      return data
    } catch {
      setOffline(true)
      const fallback = { ...row, id: Date.now() + Math.random(), created_at: new Date().toISOString() }
      const cache = lsLoad(CACHE.income, [])
      lsSave(CACHE.income, [fallback, ...cache])
      return fallback
    }
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

  async getMonthIncome(year, month) {
    const prefix  = monthKey(year, month)
    const lastDay = new Date(year, month + 1, 0).getDate()
    try {
      const { data, error } = await supabase
        .from('income')
        .select('*')
        .gte('date', `${prefix}-01`)
        .lte('date', `${prefix}-${lastDay}`)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    } catch {
      setOffline(true)
      return lsLoad(CACHE.income, []).filter(e => e.date?.startsWith(prefix))
    }
  },

  /* ── Recurring income ────────────────────────────────── */
  async getRecurringIncome() {
    try {
      const { data, error } = await supabase
        .from('recurring_income')
        .select('*')
        .order('day_of_month', { ascending: true })
      if (error) throw error
      lsSave(CACHE.recurring_income, data)
      setOffline(false)
      return data
    } catch {
      setOffline(true)
      return lsLoad(CACHE.recurring_income, [])
    }
  },

  async addRecurringIncome(item) {
    try {
      const { data, error } = await supabase
        .from('recurring_income')
        .insert({ ...item, active: true })
        .select()
        .single()
      if (error) throw error
      const cache = lsLoad(CACHE.recurring_income, [])
      lsSave(CACHE.recurring_income, [...cache, data])
      return data
    } catch {
      setOffline(true)
      const fallback = { ...item, active: true, id: Date.now() + Math.random(), created_at: new Date().toISOString() }
      const cache = lsLoad(CACHE.recurring_income, [])
      lsSave(CACHE.recurring_income, [...cache, fallback])
      return fallback
    }
  },

  async updateRecurringIncome(id, updates) {
    try {
      const { error } = await supabase.from('recurring_income').update(updates).eq('id', id)
      if (error) throw error
    } catch {
      setOffline(true)
    }
    const cache = lsLoad(CACHE.recurring_income, [])
    const idx = cache.findIndex(r => r.id === id)
    if (idx !== -1) { cache[idx] = { ...cache[idx], ...updates }; lsSave(CACHE.recurring_income, cache) }
  },

  async deleteRecurringIncome(id) {
    return db.updateRecurringIncome(id, { active: false })
  },

  async seedRecurringIncome() {
    if (await getFlag('recurring_income_seeded')) return
    try {
      const { count, error: countErr } = await supabase
        .from('recurring_income')
        .select('*', { count: 'exact', head: true })
      if (countErr) return
      if (count > 0) { await setFlag('recurring_income_seeded', 'true'); return }
      const defaults = [
        { description: 'Salary', amount: 3100, category: 'salary', day_of_month: 1, active: true },
      ]
      const { error } = await supabase.from('recurring_income').insert(defaults)
      if (!error) await setFlag('recurring_income_seeded', 'true')
    } catch {}
  },

  /* ── Onboarding flag ──────────────────────────────── */
  async isOnboarded() {
    return (await getFlag('onboarded')) === 'true'
  },
  async setOnboarded() {
    await setFlag('onboarded', 'true')
  },
}

export { DEFAULT_BUDGETS }
