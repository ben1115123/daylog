export const CATEGORIES = [
  'food', 'transport', 'grocery', 'rental', 'subscription', 'sports', 'shopping',
  'coffee', 'dining', 'petrol', 'toll', 'online_shopping', 'health', 'entertainment', 'travel', 'utilities', 'education',
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
}

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
}

export function formatRM(amount) {
  if (amount == null) return '—'
  return `RM ${Number(amount).toFixed(0)}`
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (dateStr === today.toISOString().split('T')[0]) return 'Today'
  if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow'
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday'
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
}

export function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')}${ampm}`
}

export function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-MY', { month: 'short' })
}
