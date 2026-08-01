/* ── Local-timezone date utilities ────────────────────────────────────
 *
 * THE ONE PLACE calendar dates, month keys and month ranges are computed.
 *
 * Never use `new Date().toISOString().split('T')[0]` for a calendar date.
 * toISOString() is UTC, so for a user in Asia/Kuala_Lumpur (UTC+8) every
 * moment between 00:00 and 08:00 local resolves to the *previous* day.
 * That is what put the 1 Aug 2026 recurring entries into July.
 *
 * Everything here derives from the device's local timezone via getFullYear /
 * getMonth / getDate, so the date the user sees is the date that gets stored.
 */

/** Local YYYY-MM-DD for a Date (defaults to now). */
export function toISODate(d = new Date()) {
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Today as local YYYY-MM-DD. */
export function todayISO() {
  return toISODate(new Date())
}

/**
 * Parse YYYY-MM-DD into a local Date anchored at noon.
 * Noon rather than midnight so a DST or offset shift can never roll the day.
 */
export function parseISODate(str) {
  const [y, m, d] = String(str).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** Date `n` days from a Date or YYYY-MM-DD string. Returns a Date. */
export function addDays(dateOrStr, n) {
  const d = dateOrStr instanceof Date
    ? new Date(dateOrStr.getFullYear(), dateOrStr.getMonth(), dateOrStr.getDate(), 12)
    : parseISODate(dateOrStr)
  d.setDate(d.getDate() + n)
  return d
}

/** YYYY-MM-DD `n` days from a Date or YYYY-MM-DD string. */
export function shiftISO(dateOrStr, n) {
  return toISODate(addDays(dateOrStr, n))
}

/** Whole days from `fromStr` to `toStr`, both YYYY-MM-DD. */
export function daysBetween(fromStr, toStr) {
  return Math.round((parseISODate(toStr) - parseISODate(fromStr)) / 86400000)
}

/** `YYYY-MM` key. `month` is 0-indexed, matching Date#getMonth. */
export function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/**
 * Inclusive YYYY-MM-DD boundaries for a month. `month` is 0-indexed.
 * Both ends zero-padded so string comparison against text `date` columns
 * and PostgREST gte/lte on date columns behave identically.
 */
export function monthRange(year, month) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const prefix  = monthKey(year, month)
  return {
    prefix,
    start: `${prefix}-01`,
    end:   `${prefix}-${String(lastDay).padStart(2, '0')}`,
  }
}

/** { year, month } of the month `offset` months from (year, month). */
export function shiftMonth(year, month, offset) {
  const d = new Date(year, month + offset, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** Local Date at noon on the Sunday starting the week containing `d`. */
export function startOfWeek(d = new Date()) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12)
  r.setDate(r.getDate() - r.getDay())
  return r
}

/** Short month name, e.g. "Aug". `month` is 0-indexed. */
export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-MY', { month: 'short' })
}
