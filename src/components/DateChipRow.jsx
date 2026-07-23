import { useRef } from 'react'

function todayStr() { return new Date().toISOString().split('T')[0] }
function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}
function dayOfWeek(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'short' })
}

export default function DateChipRow({ value, onChange }) {
  const today = todayStr()
  const yesterday = yesterdayStr()
  const isToday = value === today
  const isYesterday = value === yesterday
  const isCustom = !isToday && !isYesterday
  const customInputRef = useRef(null)

  const openCustom = () => {
    if (customInputRef.current?.showPicker) customInputRef.current.showPicker()
    else customInputRef.current?.focus()
  }

  return (
    <div className="date-chip-row">
      <button type="button" className={`date-chip${isToday ? ' selected' : ''}`} onClick={() => onChange(today)}>
        Today · {dayOfWeek(today)}
      </button>
      <button type="button" className={`date-chip${isYesterday ? ' selected' : ''}`} onClick={() => onChange(yesterday)}>
        Yesterday · {dayOfWeek(yesterday)}
      </button>
      <button type="button" className={`date-chip${isCustom ? ' selected' : ''}`} onClick={openCustom}>
        {isCustom && value ? `${value} · ${dayOfWeek(value)}` : 'Custom'}
      </button>
      <input
        ref={customInputRef}
        type="date"
        className="date-chip-native-input"
        value={isCustom ? value : ''}
        onChange={e => onChange(e.target.value)}
        style={{ colorScheme: 'dark' }}
      />
    </div>
  )
}
