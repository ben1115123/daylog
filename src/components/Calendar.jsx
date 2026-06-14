import { useState, useMemo, useEffect, useCallback } from 'react'
import { db, expandEvents } from '../db.js'
import { EVENT_CATS, formatTime, formatDate } from '../utils.js'
import { RepeatIcon, PlusIcon } from '../Icons.jsx'
import { loadHolidaysForCalendar } from '../holidays.js'
import Sheet from './Sheet.jsx'
import './Calendar.css'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOWS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

const REMINDER_OPTIONS = [
  ['', 'None'],
  ['15', '15 mins before'],
  ['30', '30 mins before'],
  ['60', '1 hour before'],
  ['1440', '1 day before'],
]

const ChevL = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const ChevR = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

function agendaDateLabel(dateStr, todayStr) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  if (dateStr === todayStr) return 'Today'
  if (dateStr === tomorrowStr) return 'Tomorrow'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function daysUntil(dateStr, todayStr) {
  return Math.round((new Date(dateStr + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000)
}

function EventCatDot({ category }) {
  const meta = EVENT_CATS[category]
  return <span className="ev-cat-dot" style={{ background: meta?.color || 'var(--text3)' }}/>
}

/* ── Edit event form ─────────────────────────────────── */
function EditEventForm({ ev, onSave, onCancel }) {
  const [form, setForm] = useState({
    title:     ev.title     || '',
    date:      ev.date      || '',
    time:      ev.time      || '',
    endDate:   ev.end_date  || '',
    category:  ev.category  || '',
    recurring: ev.recurring || '',
    reminder:  ev.reminder_minutes != null ? String(ev.reminder_minutes) : '',
    notes:     ev.notes     || '',
  })
  const [multiDay, setMultiDay] = useState(!!ev.end_date)

  return (
    <div className="ev-edit-form">
      <input
        className="ev-edit-input"
        placeholder="Event title"
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
      />
      <div className="ev-edit-row">
        <input
          className="ev-edit-input"
          type="date"
          value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          style={{ colorScheme: 'dark' }}
        />
        <input
          className="ev-edit-input"
          type="time"
          value={form.time}
          onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
          style={{ colorScheme: 'dark', maxWidth: 100 }}
        />
      </div>
      <div className="sheet-toggle-row">
        <button
          className={`sheet-toggle ${multiDay ? 'active' : ''}`}
          onClick={() => setMultiDay(m => !m)}
        >
          Multi-day event
        </button>
      </div>
      {multiDay && (
        <input
          className="ev-edit-input"
          type="date"
          value={form.endDate}
          onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
          style={{ colorScheme: 'dark' }}
          placeholder="End date"
        />
      )}
      <div className="ev-edit-row">
        <select
          className="ev-edit-select"
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        >
          <option value="">No category</option>
          {Object.entries(EVENT_CATS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          className="ev-edit-select"
          value={form.recurring}
          onChange={e => setForm(f => ({ ...f, recurring: e.target.value }))}
        >
          <option value="">No repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <select
        className="ev-edit-select"
        value={form.reminder}
        onChange={e => setForm(f => ({ ...f, reminder: e.target.value }))}
        style={{ width: '100%' }}
      >
        {REMINDER_OPTIONS.map(([val, label]) => (
          <option key={val} value={val}>{val === '' ? 'No reminder' : label}</option>
        ))}
      </select>
      <div className="ev-edit-actions">
        <button className="edit-cancel" onClick={onCancel}>Cancel</button>
        <button
          className="edit-save"
          onClick={() => onSave({
            ...form,
            time:             form.time      || null,
            category:         form.category  || null,
            recurring:        form.recurring || null,
            notes:            form.notes     || null,
            end_date:         multiDay && form.endDate ? form.endDate : null,
            reminder_minutes: form.reminder ? Number(form.reminder) : null,
          })}
        >
          Save
        </button>
      </div>
    </div>
  )
}

/* ── Add event form (bottom sheet) ───────────────────── */
function AddEventForm({ defaultDate, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: '', date: defaultDate || '', time: '', endDate: '', category: '', notes: '', recurring: '', reminder: '',
  })
  const [multiDay, setMultiDay] = useState(false)

  const canSave = form.title.trim() && form.date

  return (
    <>
      <div>
        <div className="sheet-field-label">Title</div>
        <input
          className="sheet-input"
          placeholder="Event title"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        />
      </div>
      <div className="sheet-row">
        <div>
          <div className="sheet-field-label">Date</div>
          <input
            className="sheet-input"
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            style={{ colorScheme: 'dark' }}
          />
        </div>
        <div>
          <div className="sheet-field-label">Time (optional)</div>
          <input
            className="sheet-input"
            type="time"
            value={form.time}
            onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
            style={{ colorScheme: 'dark' }}
          />
        </div>
      </div>
      <div>
        <div className="sheet-field-label">Remind me</div>
        <select
          className="sheet-select"
          value={form.reminder}
          onChange={e => setForm(f => ({ ...f, reminder: e.target.value }))}
        >
          {REMINDER_OPTIONS.map(([val, label]) => (
            <option key={val} value={val}>{val === '' ? 'None' : label}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="sheet-field-label">Multi-day event</div>
        <div className="sheet-toggle-row">
          <button
            className={`sheet-toggle ${multiDay ? 'active' : ''}`}
            onClick={() => setMultiDay(m => !m)}
          >
            {multiDay ? 'Yes' : 'No'}
          </button>
        </div>
      </div>
      {multiDay && (
        <div>
          <div className="sheet-field-label">End date</div>
          <input
            className="sheet-input"
            type="date"
            value={form.endDate}
            min={form.date}
            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
            style={{ colorScheme: 'dark' }}
          />
        </div>
      )}
      <div>
        <div className="sheet-field-label">Category</div>
        <select
          className="sheet-select"
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        >
          <option value="">No category</option>
          {Object.entries(EVENT_CATS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="sheet-field-label">Notes (optional)</div>
        <input
          className="sheet-input"
          placeholder="Brief notes"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />
      </div>
      <div>
        <div className="sheet-field-label">Repeat</div>
        <div className="sheet-toggle-row">
          {[['', 'None'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([val, label]) => (
            <button
              key={val}
              className={`sheet-toggle ${form.recurring === val ? 'active' : ''}`}
              onClick={() => setForm(f => ({ ...f, recurring: val }))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="sheet-actions">
        <button className="sheet-cancel" onClick={onCancel}>Cancel</button>
        <button
          className="sheet-save"
          disabled={!canSave}
          style={{ opacity: canSave ? 1 : 0.5 }}
          onClick={() => onSave({
            title: form.title.trim(),
            date: form.date,
            time: form.time || null,
            category: form.category || null,
            notes: form.notes.trim() || null,
            recurring: form.recurring || null,
            end_date: multiDay && form.endDate ? form.endDate : null,
            reminder_minutes: form.reminder ? Number(form.reminder) : null,
          })}
        >
          Save
        </button>
      </div>
    </>
  )
}

export default function Calendar({ showToast }) {
  const now = new Date()
  const [year, setYear]         = useState(now.getFullYear())
  const [month, setMonth]       = useState(now.getMonth())
  const [selected, setSelected] = useState(now.toISOString().split('T')[0])
  const [calView, setCalView]   = useState('grid')
  const [editId, setEditId]     = useState(null)
  const [addOpen, setAddOpen]   = useState(false)
  const [events, setEvents]     = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [holidays, setHolidays] = useState({})

  const todayStr = now.toISOString().split('T')[0]

  const loadEvents = useCallback(async () => {
    const evs = await db.getEvents()
    setEvents(evs)
    setLoadingData(false)
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  useEffect(() => {
    loadHolidaysForCalendar(year, month).then(setHolidays)
  }, [year, month])

  const allExpanded = useMemo(() => expandEvents(events), [events])
  const eventDates  = useMemo(() => new Set(allExpanded.map(e => e.date)), [allExpanded])
  const spanEvents  = useMemo(() => events.filter(e => e.end_date && e.end_date > e.date), [events])

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const selectedEvents = selected
    ? allExpanded.filter(e => e.date === selected)
    : allExpanded.filter(e => e.date >= todayStr).slice(0, 8)

  const nextEvent = allExpanded.find(e => e.date >= todayStr)
  const countdown = nextEvent ? daysUntil(nextEvent.date, todayStr) : null

  const agendaEvents = useMemo(() => {
    const upcoming = allExpanded.filter(e => e.date >= todayStr).slice(0, 60)
    const grouped = {}
    upcoming.forEach(ev => { if (!grouped[ev.date]) grouped[ev.date] = []; grouped[ev.date].push(ev) })
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))
  }, [allExpanded, todayStr])

  const handleDelete = async (id) => {
    if (confirm('Delete this event?')) {
      await db.deleteEvent(id)
      await loadEvents()
      showToast('Deleted')
    }
  }

  const handleSaveEdit = async (id, updates) => {
    await db.updateEvent(id, updates)
    setEditId(null)
    await loadEvents()
    showToast('Event updated')
  }

  const handleAddEvent = async (event) => {
    await db.addEvent(event)
    setAddOpen(false)
    await loadEvents()
    showToast('Event added')
  }

  const exportICS = (event) => {
    const dt = event.date.replace(/-/g, '')
    const time = event.time ? event.time.replace(':', '') + '00' : null
    const dtStart = time ? `DTSTART:${dt}T${time}` : `DTSTART;VALUE=DATE:${dt}`
    const dtEnd   = time ? `DTEND:${dt}T${time}`   : `DTEND;VALUE=DATE:${dt}`
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\n${dtStart}\n${dtEnd}\nSUMMARY:${event.title}\n${event.notes ? 'DESCRIPTION:' + event.notes + '\n' : ''}END:VEVENT\nEND:VCALENDAR`
    const blob = new Blob([ics], { type: 'text/calendar' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = event.title.replace(/\s+/g, '_') + '.ics'; a.click()
    showToast('.ics downloaded')
  }

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays    = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push({ day: prevDays - firstDay + 1 + i, type: 'prev' })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, type: 'curr' })
  const rem = 42 - cells.length
  for (let i = 1; i <= rem; i++) cells.push({ day: i, type: 'next' })

  const renderEventRow = (ev, isLast) => {
    const baseId = ev._baseId ? ev._baseId + ev.date : ev.id
    const editTarget = ev._baseId || ev.id

    if (editId === editTarget) {
      const baseEvent = events.find(e => e.id === editTarget)
      return (
        <div key={baseId} className={`ev-edit-wrap ${isLast ? '' : 'bordered'}`}>
          <EditEventForm
            ev={baseEvent || ev}
            onSave={(updates) => handleSaveEdit(editTarget, updates)}
            onCancel={() => setEditId(null)}
          />
        </div>
      )
    }

    return (
      <div key={baseId} className={`ev-row ${isLast ? '' : 'bordered'}`}>
        <div className="ev-time">{ev.time ? formatTime(ev.time) : 'all day'}</div>
        <EventCatDot category={ev.category} />
        <div className="ev-body">
          <div className="ev-title-row">
            <span className="ev-title">{ev.title}</span>
            {ev.recurring && <span className="ev-repeat"><RepeatIcon size={11} /></span>}
            {ev.end_date && ev.end_date > ev.date && (
              <span className="ev-range">→ {formatDate(ev.end_date)}</span>
            )}
          </div>
          {ev.notes && <div className="ev-notes">{ev.notes}</div>}
        </div>
        <div className="ev-actions">
          {!ev.isRecurringInstance && (
            <button className="ev-btn" onClick={() => setEditId(editTarget)} title="Edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
          {!ev.isRecurringInstance && (
            <button className="ev-btn" onClick={() => exportICS(ev)} title="Export .ics">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          )}
          {!ev.isRecurringInstance && (
            <button className="ev-btn del" onClick={() => handleDelete(ev.id)} title="Delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    )
  }

  if (loadingData) return (
    <div className="screen">
      <div className="loading-wrap" style={{ height: '100dvh' }}>
        <div className="spinner"/>
      </div>
    </div>
  )

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-header-row">
          <div>
            <div className="screen-label">Schedule</div>
            <div className="screen-heading">Calendar</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="add-btn" onClick={() => setAddOpen(true)} aria-label="Add event">
              <PlusIcon size={18} />
            </button>
            <div className="month-nav-cal">
              <button onClick={prevMonth} aria-label="Prev"><ChevL /></button>
              <span>{MONTHS[month].slice(0,3)} {year}</span>
              <button onClick={nextMonth} aria-label="Next"><ChevR /></button>
            </div>
          </div>
        </div>
        <div className="cal-view-tabs">
          <button className={`cal-view-tab ${calView === 'grid' ? 'active' : ''}`} onClick={() => setCalView('grid')}>Grid</button>
          <button className={`cal-view-tab ${calView === 'agenda' ? 'active' : ''}`} onClick={() => setCalView('agenda')}>Agenda</button>
        </div>
      </div>

      {nextEvent && countdown !== null && (
        <div className="countdown-strip">
          <span className="countdown-label">Next</span>
          <span className="countdown-title">{nextEvent.title}</span>
          <span className="countdown-days">
            {countdown === 0 ? 'today' : countdown === 1 ? 'tomorrow' : `in ${countdown} days`}
          </span>
        </div>
      )}

      {calView === 'grid' && (
        <>
          <div className="section" style={{ marginTop: 12 }}>
            <div className="cal-grid-wrap card">
              <div className="cal-dows">{DOWS.map(d => <div key={d} className="cal-dow">{d}</div>)}</div>
              <div className="cal-grid">
                {cells.map((cell, i) => {
                  if (cell.type !== 'curr') return <div key={i} className="cal-cell other">{cell.day}</div>
                  const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(cell.day).padStart(2,'0')}`
                  const isToday = dateStr === todayStr
                  const hasEv = eventDates.has(dateStr)
                  const isSel = dateStr === selected
                  const isHoliday = !!holidays[dateStr]
                  const spans = spanEvents.filter(e => dateStr >= e.date && dateStr <= e.end_date)
                  return (
                    <div key={i}
                      className={`cal-cell ${isToday ? 'today' : ''} ${isSel && !isToday ? 'selected' : ''}`}
                      onClick={() => setSelected(isSel ? null : dateStr)}
                    >
                      {cell.day}
                      {isHoliday && <span className="holiday-dot"/>}
                      {hasEv && <span className={`ev-dot ${isToday ? 'ev-dot-light' : ''}`}/>}
                      {spans.length > 0 && (
                        <div className="cal-span-bars">
                          {spans.slice(0, 2).map(ev => {
                            const pos = dateStr === ev.date ? 'start' : dateStr === ev.end_date ? 'end' : 'mid'
                            return (
                              <span
                                key={ev.id}
                                className={`cal-span-bar span-${pos}`}
                                style={{ background: EVENT_CATS[ev.category]?.color || 'var(--accent)' }}
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="section" style={{ marginTop: 20, paddingBottom: 32 }}>
            <div className="section-label">{selected ? formatDate(selected) : 'Upcoming'}</div>
            {selected && holidays[selected] && (
              <div className="holiday-label">{holidays[selected]}</div>
            )}
            {selectedEvents.length === 0 ? (
              <div className="empty">{selected ? 'nothing on this day' : 'no upcoming events'}</div>
            ) : (
              <div className="card">
                {selectedEvents.map((ev, i) => renderEventRow(ev, i === selectedEvents.length - 1))}
              </div>
            )}
          </div>
        </>
      )}

      {calView === 'agenda' && (
        <div className="section" style={{ marginTop: 12, paddingBottom: 32 }}>
          {agendaEvents.length === 0 ? (
            <div className="empty">no upcoming events</div>
          ) : (
            agendaEvents.map(([dateStr, evs]) => (
              <div key={dateStr} className="agenda-group">
                <div className="agenda-date-label">{agendaDateLabel(dateStr, todayStr)}</div>
                <div className="card">
                  {evs.map((ev, i) => renderEventRow(ev, i === evs.length - 1))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {addOpen && (
        <Sheet title="New event" onClose={() => setAddOpen(false)}>
          <AddEventForm
            defaultDate={selected || todayStr}
            onSave={handleAddEvent}
            onCancel={() => setAddOpen(false)}
          />
        </Sheet>
      )}
    </div>
  )
}
