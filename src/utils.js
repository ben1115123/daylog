import { todayISO, shiftISO, parseISODate } from './lib/dates.js'

/* Date helpers live in src/lib/dates.js — the single local-timezone date path.
   Re-exported here so existing `import { todayStr } from './utils.js'` call
   sites keep working without a second, competing implementation. */
export { todayISO as todayStr, monthLabel } from './lib/dates.js'

export const CATEGORIES = [
  'food', 'transport', 'grocery', 'rental', 'subscription', 'sports', 'shopping',
  'coffee', 'dining', 'petrol', 'toll', 'online_shopping', 'health', 'entertainment', 'travel', 'utilities', 'education', 'investment',
]

export const CAT_META = {
  food:            { label: 'Food',              color: '#fb923c' },
  transport:       { label: 'Transport',         color: '#60a5fa' },
  grocery:         { label: 'Grocery',           color: '#f472b6' },
  rental:          { label: 'Rental',            color: '#a78bfa' },
  subscription:    { label: 'Subscription',      color: '#34d399' },
  sports:          { label: 'Sports',            color: '#facc15' },
  shopping:        { label: 'Shopping',          color: '#f87171' },
  coffee:          { label: 'Coffee & Drinks',   color: '#a0714f' },
  dining:          { label: 'Dining Out',        color: '#ffb347' },
  petrol:          { label: 'Petrol',            color: '#58a6ff' },
  toll:            { label: 'Toll & Highway',    color: '#8b949e' },
  online_shopping: { label: 'Online Shopping',   color: '#f0883e' },
  health:          { label: 'Health & Pharmacy', color: '#26a69a' },
  entertainment:   { label: 'Entertainment',     color: '#9c27b0' },
  travel:          { label: 'Travel',            color: '#29b6f6' },
  utilities:       { label: 'Utilities',         color: '#78909c' },
  education:       { label: 'Education',         color: '#5c6bc0' },
  investment:      { label: 'Investment',        color: '#4ade80' },
  salary:          { label: 'Salary',            color: '#58a6ff' },
  trading:         { label: 'Trading',           color: '#4ade80' },
}

export const INCOME_CATEGORIES = ['salary', 'trading']

export const PRESETS = [
  { id: 'rental',          label: 'Rental',     category: 'rental',          amount: 1000, isExpense: true, recurring: 'monthly', recurringDay: 1 },
  { id: 'tradingview',     label: 'TradingView',category: 'subscription',    amount: null, isExpense: true },
  { id: 'gym',             label: 'Gym',        category: 'sports',          amount: null, isExpense: false, isEvent: true },
  { id: 'grab',            label: 'Grab',       category: 'transport',       amount: null, isExpense: true },
  { id: 'groceries',       label: 'Groceries',  category: 'grocery',         amount: null, isExpense: true },
  { id: 'coffee',          label: 'Coffee',     category: 'coffee',          amount: null, isExpense: true },
  { id: 'petrol',          label: 'Petrol',     category: 'petrol',          amount: null, isExpense: true },
  { id: 'online_shopping', label: 'Online',     category: 'online_shopping', amount: null, isExpense: true },
]

export const EVENT_CATS = {
  work:     { label: 'Work',     color: '#60a5fa' },
  personal: { label: 'Personal', color: '#a78bfa' },
  health:   { label: 'Health',   color: '#26a69a' },
  social:   { label: 'Social',   color: '#fb923c' },
  finance:  { label: 'Finance',  color: '#facc15' },
  travel:   { label: 'Travel',   color: '#38bdf8' },
}

export const EVENT_CAT_LIST = ['', ...Object.keys(EVENT_CATS)]
export const EVENT_CAT_META = { '': { label: 'No category', color: 'var(--text3)' }, ...EVENT_CATS }

export const REMINDER_OPTIONS = [
  ['', 'None'],
  ['15', '15 min'],
  ['30', '30 min'],
  ['60', '1 hour'],
  ['1440', '1 day'],
]

export function formatRM(amount) {
  if (amount == null) return '—'
  return `RM ${Number(amount).toFixed(0)}`
}

export function formatRMParts(amount) {
  if (amount == null) return { prefix: '—', value: '' }
  return { prefix: 'RM', value: Number(amount).toFixed(0) }
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const today = todayISO()
  if (dateStr === today) return 'Today'
  if (dateStr === shiftISO(today, 1)) return 'Tomorrow'
  if (dateStr === shiftISO(today, -1)) return 'Yesterday'
  return parseISODate(dateStr).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
}

export function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')}${ampm}`
}

