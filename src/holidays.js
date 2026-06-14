const NAGER_URL = (year) => `https://date.nager.at/api/v3/PublicHolidays/${year}/MY`

// National holidays apply everywhere (h.global). State holidays only kept for
// Selangor (MY-10) and Kuala Lumpur (MY-14) since that's where Ben is based.
const RELEVANT_COUNTIES = ['MY-10', 'MY-14']

// Nager.Date does not cover Malaysia (not in their AvailableCountries list, as
// of 2026 — every /PublicHolidays/{year}/MY request returns 204 No Content).
// Fall back to a bundled list (national + Selangor/KL) so the calendar still
// shows holidays. Update this yearly — Islamic dates shift each year.
const FALLBACK_HOLIDAYS = {
  2026: {
    '2026-01-01': "New Year's Day",
    '2026-02-01': 'Thaipusam / Federal Territory Day',
    '2026-02-17': 'Chinese New Year',
    '2026-02-18': 'Chinese New Year (Day 2)',
    '2026-03-21': 'Hari Raya Aidilfitri',
    '2026-03-22': 'Hari Raya Aidilfitri (Day 2)',
    '2026-05-01': 'Labour Day',
    '2026-05-27': 'Hari Raya Haji',
    '2026-05-31': 'Wesak Day',
    '2026-06-01': "Agong's Birthday",
    '2026-06-17': 'Awal Muharram',
    '2026-08-25': "Prophet Muhammad's Birthday",
    '2026-08-31': 'Merdeka Day',
    '2026-09-16': 'Malaysia Day',
    '2026-11-08': 'Deepavali',
    '2026-12-11': "Sultan of Selangor's Birthday",
    '2026-12-25': 'Christmas Day',
  },
}

function cacheKey(year) {
  return `dl_holidays_${year}`
}

export async function getHolidays(year) {
  const key = cacheKey(year)
  const cached = localStorage.getItem(key)
  if (cached) {
    try { return JSON.parse(cached) } catch {}
  }
  try {
    const res = await fetch(NAGER_URL(year))
    if (!res.ok) throw new Error('fetch failed')
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) throw new Error('no data')
    const map = {}
    data
      .filter(h => h.global || h.counties?.some(c => RELEVANT_COUNTIES.includes(c)))
      .forEach(h => { map[h.date] = h.name })
    localStorage.setItem(key, JSON.stringify(map))
    return map
  } catch {
    const map = FALLBACK_HOLIDAYS[year] || {}
    localStorage.setItem(key, JSON.stringify(map))
    return map
  }
}

// Loads holidays for the given year, plus next year's once December rolls around.
export async function loadHolidaysForCalendar(year, month) {
  const holidays = await getHolidays(year)
  if (month === 11) {
    const next = await getHolidays(year + 1)
    return { ...holidays, ...next }
  }
  return holidays
}
