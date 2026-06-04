export const CATEGORIES = ['food', 'transport', 'grocery', 'rental', 'subscription', 'sports', 'shopping']

export const CAT_META = {
  food:         { label: 'Food',         color: '#ffb347', icon: '🍜' },
  transport:    { label: 'Transport',    color: '#5f9fff', icon: '🚗' },
  grocery:      { label: 'Grocery',      color: '#ff8fab', icon: '🛒' },
  rental:       { label: 'Rental',       color: '#a78bfa', icon: '🏠' },
  subscription: { label: 'Subscription', color: '#c8f065', icon: '📱' },
  sports:       { label: 'Sports',       color: '#5fffd7', icon: '🏋️' },
  shopping:     { label: 'Shopping',     color: '#ff5f5f', icon: '🛍️' },
}

export const PRESETS = [
  { id: 'rental',      label: 'Rental',      category: 'rental',       amount: 1000, icon: '🏠', isExpense: true },
  { id: 'tradingview', label: 'TradingView', category: 'subscription', amount: null, icon: '📈', isExpense: true },
  { id: 'gym',         label: 'Gym',         category: 'sports',       amount: null, icon: '🏋️', isExpense: false, isEvent: true },
  { id: 'grab',        label: 'Grab',        category: 'transport',    amount: null, icon: '🚗', isExpense: true },
  { id: 'groceries',   label: 'Groceries',   category: 'grocery',      amount: null, icon: '🛒', isExpense: true },
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
