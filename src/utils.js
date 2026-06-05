export const CATEGORIES = ['food', 'transport', 'grocery', 'rental', 'subscription', 'sports', 'shopping']

export const CAT_META = {
  food:         { label: 'Food',         color: '#fb923c' },
  transport:    { label: 'Transport',    color: '#60a5fa' },
  grocery:      { label: 'Grocery',      color: '#f472b6' },
  rental:       { label: 'Rental',       color: '#a78bfa' },
  subscription: { label: 'Subscription', color: '#34d399' },
  sports:       { label: 'Sports',       color: '#facc15' },
  shopping:     { label: 'Shopping',     color: '#f87171' },
}

export const PRESETS = [
  { id: 'rental',      label: 'Rental',      category: 'rental',       amount: 1000, isExpense: true },
  { id: 'tradingview', label: 'TradingView', category: 'subscription', amount: null, isExpense: true },
  { id: 'gym',         label: 'Gym',         category: 'sports',       amount: null, isExpense: false, isEvent: true },
  { id: 'grab',        label: 'Grab',        category: 'transport',    amount: null, isExpense: true },
  { id: 'groceries',   label: 'Groceries',   category: 'grocery',      amount: null, isExpense: true },
]

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
