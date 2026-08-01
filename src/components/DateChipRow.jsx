import { useRef } from 'react'
import { todayISO, shiftISO, parseISODate } from '../lib/dates.js'

function dayOfWeek(dateStr) {
  return parseISODate(dateStr).toLocaleDateString('en-MY', { weekday: 'short' })
}

export default function DateChipRow({ value, onChange }) {
  const today = todayISO()
  const yesterday = shiftISO(today, -1)
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
