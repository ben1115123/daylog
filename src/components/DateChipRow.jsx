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

  return (
    <div className="date-chip-row">
      <button type="button" className={`date-chip${isToday ? ' selected' : ''}`} onClick={() => onChange(today)}>
        Today · {dayOfWeek(today)}
      </button>
      <button type="button" className={`date-chip${isYesterday ? ' selected' : ''}`} onClick={() => onChange(yesterday)}>
        Yesterday · {dayOfWeek(yesterday)}
      </button>

      {/*
        The native <input type="date"> IS the Custom chip's tap target — it is
        stretched transparent over the whole chip rather than hidden beside it
        and opened with showPicker(). iOS Safari will not focus or open a picker
        on an input that is display:none, visibility:hidden or pointer-events:
        none, and its showPicker() support is inconsistent; letting the tap land
        on the input directly needs no JS at all. The label text underneath
        stays visible through the transparent input.
      */}
      <label className={`date-chip date-chip-custom${isCustom ? ' selected' : ''}`}>
        <span>{isCustom && value ? `${value} · ${dayOfWeek(value)}` : 'Custom'}</span>
        <input
          type="date"
          className="date-chip-native-input"
          value={isCustom ? value : ''}
          /* Cancelling out of the iOS picker can emit an empty value; keep the
             current date rather than clearing the entry's date entirely. */
          onChange={e => { if (e.target.value) onChange(e.target.value) }}
          style={{ colorScheme: 'dark' }}
        />
      </label>
    </div>
  )
}
