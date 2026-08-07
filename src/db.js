import supabase from './supabase.js'
import { todayISO, toISODate, parseISODate, monthKey, monthRange } from './lib/dates.js'

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

/* Records the outcome of a sync attempt on the row, in the offline cache, and
   on the window so an open screen can show it without a refetch. Only writes
   when the state actually changes — a successful sync of an event that was
   already fine costs no round trip. */
async function recordSyncOutcome(id, message) {
  const cache = lsLoad(CACHE.events, [])
  const idx = cache.findIndex(e => e.id === id)
  const previous = idx === -1 ? undefined : cache[idx].apple_sync_error
  if (previous === undefined ? message === null : previous === message) return

  if (idx !== -1) {
    cache[idx] = { ...cache[idx], apple_sync_error: message }
    lsSave(CACHE.events, cache)
  }
  window.dispatchEvent(new CustomEvent('daylog:sync', { detail: { id, error: message } }))
  try {
    await supabase.from('events').update({ apple_sync_error: message }).eq('id', id)
  } catch (err) {
    console.error('[daylog] could not record sync outcome:', err)
  }
}

/* ── In-flight Apple Calendar add syncs ────────────────────────────────
 *
 * The orphan this exists to stop: `addEvent` fires the CalDAV add without
 * awaiting it, and the add writes `apple_uid` back onto the row when it
 * lands — seconds later. `deleteEvent` used to read that column once and
 * act on whatever it found. Under optimistic UNDO the delete runs first
 * every time, read `null`, dropped the Supabase row, and left the iCloud
 * VEVENT with nothing in the database pointing at it. Measured in task 9:
 * the read at +4247ms, the write-back at +4317ms.
 *
 * So the fix is to stop guessing: park on the sync instead of polling the
 * row it has not written to yet. This map holds, per event id, a promise of
 * that add's outcome — the CalDAV resource URL, or null if no resource was
 * ever created (the invoke failed, the function reported failure, or it
 * returned no uid). `deleteEvent` awaits it when one is present.
 *
 * It is one registry, in the layer that owns the sync, deliberately. The
 * optimistic layer already parks on a promise for the *row* id
 * (`resolveUndoTarget`), and reusing that promise here would not work: it is
 * `addEvent`'s promise, and `addEvent` returns at the same moment it fires
 * the sync, so it resolves before the sync has even started. Same shape, a
 * different fact, one owner each — rather than two mechanisms racing to
 * answer one question.
 *
 * Entries are dropped once settled. That is safe rather than racy: the
 * promise only resolves after the `apple_uid` write-back has been awaited,
 * so a `deleteEvent` that arrives too late to find the entry finds the
 * column populated instead, and the fallback select is correct again. */
const pendingAppleAdd = new Map()

/* Never rejects and never resolves to undefined — `deleteEvent` awaits this
   inside its own try, and a throw here would skip the row delete entirely. */
function trackAppleAdd(id, promise) {
  const settled = promise.then(uid => uid ?? null, () => null)
  pendingAppleAdd.set(id, settled)
  settled.then(() => {
    if (pendingAppleAdd.get(id) === settled) pendingAppleAdd.delete(id)
  })
  return settled
}

/* Apple Calendar sync is deliberately non-blocking — the event is already in
   Supabase before this runs, and a CalDAV failure must never fail a save.
   It is no longer *silent*, though: a bare `catch {}` here is why a broken
   namespace parser went unnoticed for two months. Failures are logged and
   stored on the row as apple_sync_error, which the UI shows as a muted dot.

   Resolves to the CalDAV resource URL on a successful add, and to null on
   anything else — that value is what `pendingAppleAdd` hands `deleteEvent`. */
async function syncToAppleCalendar(action, event) {
  let message = null
  let uid = null
  try {
    const { data, error } = await supabase.functions.invoke('sync-calendar', { body: { action, event } })
    if (error) message = error.message || String(error)
    else if (!data?.success) message = data?.error || 'sync-calendar returned no result'
    else if (action === 'add' && data.uid && event.id) {
      uid = data.uid
      await supabase.from('events').update({ apple_uid: data.uid }).eq('id', event.id)
    }
  } catch (err) {
    message = err?.message || String(err)
  }

  if (message) console.error(`[daylog] Apple Calendar ${action} failed:`, message, { event })

  /* A delete has no row left to annotate — apple_sync_error is a column on
     the row that was just removed, so that channel is structurally closed.
     The other two channels of the same mechanism are not: the console line
     above, and the `daylog:sync` window event, which App.jsx turns into an
     error toast so a failed iCloud delete is visible rather than silent. */
  if (action === 'delete') {
    if (message) {
      window.dispatchEvent(new CustomEvent('daylog:sync', {
        detail: { id: event.id ?? null, error: message, action: 'delete' },
      }))
    }
    return null
  }
  if (!event.id) return uid
  await recordSyncOutcome(event.id, message)
  return uid
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
    const d = new Date(); d.setFullYear(d.getFullYear() + 1); return toISODate(d)
  })()
  const result = []
  base.forEach(ev => {
    if (!ev.recurring) { result.push(ev); return }
    const end = parseISODate(ceiling)
    let cur = parseISODate(ev.date), guard = 0
    while (cur <= end && guard++ < 500) {
      const dateStr = toISODate(cur)
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
      /* Still fire-and-forget as far as the save is concerned — but the
         promise is kept now instead of discarded, so an UNDO landing in the
         next second has something to wait on. */
      trackAppleAdd(data.id, syncToAppleCalendar('add', data))
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

  /* Slower than it looks, and deliberately so: the Supabase row is not
     removed until this knows the event's true Apple Calendar state. That
     costs nothing on screen — every UNDO handler calls `dropProvisional`
     before it awaits this, so the row is already gone from the list and the
     cleanup finishes behind it. */
  async deleteEvent(id) {
    try {
      const inFlight = pendingAppleAdd.get(id)
      /* An add still in flight: wait for it. The select below cannot answer
         for this event — the write-back has not happened yet, which is the
         whole bug. With no add in flight (the common case, deleting an older
         event) the column is authoritative and the select is right. */
      let appleUid = null
      if (inFlight) {
        appleUid = await inFlight
      } else {
        const { data: existing } = await supabase.from('events').select('apple_uid').eq('id', id).single()
        appleUid = existing?.apple_uid ?? null
      }
      /* Awaited, not fired and forgotten: iCloud first, then the row, so the
         uid is never destroyed before the resource it points at. A CalDAV
         failure is reported inside syncToAppleCalendar and does not throw,
         so the row still gets deleted either way. A resolved-null uid means
         no resource was ever created, and there is nothing to remove. */
      if (appleUid) await syncToAppleCalendar('delete', { id, apple_uid: appleUid })
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) throw error
    } catch {
      setOffline(true)
    }
    lsSave(CACHE.events, lsLoad(CACHE.events, []).filter(e => e.id !== id))
  },

  /* ── Month / range queries ─────────────────────────── */
  async getMonthExpenses(year, month) {
    const { prefix, start, end } = monthRange(year, month)
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', start)
        .lte('date', end)
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
    const today = todayISO()
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

  /* totalBudget is a divisor for every percentage in the app. Clearing the
     Settings field writes `+'' === 0`, which turns those into Infinity/NaN —
     so sanitize on read and on write rather than at each call site. */
  getSettings: () => {
    const s = { ...DEFAULT_SETTINGS, ...lsLoad(LS.settings, {}) }
    const budget = Number(s.totalBudget)
    s.totalBudget = Number.isFinite(budget) && budget > 0 ? budget : DEFAULT_SETTINGS.totalBudget
    return s
  },
  saveSettings: (v) => {
    const budget = Number(v.totalBudget)
    lsSave(LS.settings, {
      ...v,
      totalBudget: Number.isFinite(budget) && budget > 0 ? budget : DEFAULT_SETTINGS.totalBudget,
    })
  },

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

  async getMonthIncome(year, month) {
    const { prefix, start, end } = monthRange(year, month)
    try {
      const { data, error } = await supabase
        .from('income')
        .select('*')
        .gte('date', start)
        .lte('date', end)
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
