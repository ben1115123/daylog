import { useState, useMemo, useEffect, useCallback } from 'react'
import { db, expandEvents } from '../db.js'
import { EVENT_CATS, EVENT_CAT_LIST, EVENT_CAT_META, REMINDER_OPTIONS, formatTime, formatDate } from '../utils.js'
import { RepeatIcon, PlusIcon, SyncFailedIcon } from '../Icons.jsx'
import { loadHolidaysForCalendar } from '../holidays.js'
import { todayISO, shiftISO, parseISODate, daysBetween } from '../lib/dates.js'
import { tempId, insertProvisional, commitProvisional, dropProvisional } from '../lib/optimistic.js'
import { undoTarget, UNDO_TIMED_OUT, UNDO_STALLED_MSG } from '../lib/undoDeadline.js'
import { beginFetch, markUndone, withoutUndone, releaseUndone } from '../lib/undoneRows.js'
import DLMark from './DLMark.jsx'
import Sheet from './Sheet.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import CategoryChipRow from './CategoryChipRow.jsx'
import DateChipRow from './DateChipRow.jsx'
import './Calendar.css'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOWS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

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
  if (dateStr === todayStr) return 'Today'
  if (dateStr === shiftISO(todayStr, 1)) return 'Tomorrow'
  return parseISODate(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function daysUntil(dateStr, todayStr) {
  return daysBetween(todayStr, dateStr)
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
    <Sheet
      title="New event"
      onClose={onCancel}
      footer={
        <>
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
        </>
      }
    >
      <div>
        <div className="sheet-field-label">Title</div>
        <input
          className="sheet-input"
          placeholder="Event title"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        />
      </div>
      <div>
        <div className="sheet-field-label">Date</div>
        <DateChipRow
          value={form.date}
          onChange={date => setForm(f => ({ ...f, date }))}
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
      <div>
        <div className="sheet-field-label">Remind me</div>
        <div className="sheet-toggle-row">
          {REMINDER_OPTIONS.map(([val, label]) => (
            <button
              key={val}
              className={`sheet-toggle ${form.reminder === val ? 'active' : ''}`}
              onClick={() => setForm(f => ({ ...f, reminder: val }))}
            >
              {label}
            </button>
          ))}
        </div>
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
        <CategoryChipRow
          categories={EVENT_CAT_LIST}
          meta={EVENT_CAT_META}
          icons={{}}
          value={form.category}
          onChange={category => setForm(f => ({ ...f, category }))}
        />
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
    </Sheet>
  )
}

export default function Calendar({ showToast }) {
  const now = new Date()
  const [year, setYear]         = useState(now.getFullYear())
  const [month, setMonth]       = useState(now.getMonth())
  const [selected, setSelected] = useState(todayISO())
  const [calView, setCalView]   = useState('grid')
  const [editId, setEditId]     = useState(null)
  const [addOpen, setAddOpen]   = useState(false)
  const [events, setEvents]     = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [holidays, setHolidays] = useState({})
  const [deleteId, setDeleteId] = useState(null)

  const todayStr = todayISO()

  /* `authoritative` as in Home's refreshRecent: passed only by an UNDO whose
     DELETE has resolved, so this fetch is the truth about those ids. Calendar
     is the worst case for the race it guards — `db.deleteEvent` reads
     `apple_uid` before deleting, which pushes the DELETE a whole round trip
     later than the refetch racing it. See undoneRows.js. */
  const loadEvents = useCallback(async ({ authoritative } = {}) => {
    const fetchSeq = beginFetch()
    const fetched = await db.getEvents()
    if (authoritative?.length) releaseUndone(fetchSeq, authoritative)
    const evs = withoutUndone(fetched, fetchSeq)
    /* Same guard as Home's refreshRecent: a provisional event is not in the
       database yet, so a wholesale replace would drop it and it would pop back
       when its write commits. Order does not matter here — expandEvents sorts
       the whole list by date before anything renders. */
    setEvents(prev => {
      const fetchedIds = new Set(evs.map(e => e.id))
      const inFlight = prev.filter(e => e.pending && !fetchedIds.has(e.id))
      return [...inFlight, ...evs]
    })
    setLoadingData(false)
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  /* Apple Calendar sync resolves a second or two after the event is saved, so
     patch the row in place rather than making the user reopen the screen. */
  useEffect(() => {
    const onSync = e => {
      const { id, error } = e.detail
      setEvents(prev => prev.map(ev => ev.id === id ? { ...ev, apple_sync_error: error } : ev))
    }
    window.addEventListener('daylog:sync', onSync)
    return () => window.removeEventListener('daylog:sync', onSync)
  }, [])

  useEffect(() => {
    loadHolidaysForCalendar(year, month).then(h => {
      console.log('[daylog] holidays loaded for', year, month + 1, h)
      setHolidays(h)
    })
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

  const handleDelete = (id) => setDeleteId(id)

  const confirmDelete = async () => {
    await db.deleteEvent(deleteId)
    setDeleteId(null)
    await loadEvents()
    showToast('Deleted')
  }

  const handleSaveEdit = async (id, updates) => {
    await db.updateEvent(id, updates)
    setEditId(null)
    await loadEvents()
    showToast('Event updated')
  }

  const handleAddEvent = async (event) => {
    /* Show it before the write, not after, and close the sheet on the tap
       rather than on the round trip. The pending promise rides along on the
       row so an UNDO tapped in the next second can wait for the real id
       instead of deleting a temp one Supabase has never seen. */
    const id = tempId()
    const pending = db.addEvent(event)
    const provisional = { ...event, id, pending }
    setEvents(list => insertProvisional(list, provisional))
    setAddOpen(false)

    /* This toast had no UNDO before. It has one now because it is the third
       entry point V1 tests, and the race it tests is only reachable through an
       UNDO — a sheet save with no way back could not be verified at all. */
    showToast('Event added', 'success', {
      label: 'UNDO',
      onClick: async () => {
        const realId = await undoTarget(provisional)
        if (realId === UNDO_TIMED_OUT) {
          showToast(UNDO_STALLED_MSG, 'error')
          return
        }
        /* Suppress before dropping — the refetch at the end of handleAddEvent
           is already in flight and still counts this event. See
           undoneRows.js. */
        markUndone(id, realId)
        setEvents(list => dropProvisional(dropProvisional(list, id), realId))
        try {
          if (realId) await db.deleteEvent(realId)
        } catch (err) {
          console.error('[daylog] undo delete failed:', err)
        }
        await loadEvents({ authoritative: [id, realId] })
      },
    })

    try {
      const row = await pending
      /* A resolved-but-empty result means no row was created; committing it
         would leave the entry on its temp id with `pending` stripped, which a
         later UNDO could not resolve. Drop it instead. */
      if (!row?.id) throw new Error('write returned no row')
      console.log('[daylog] event added:', row)
      setEvents(list => commitProvisional(list, id, row))
    } catch (err) {
      console.error('[daylog] event save failed:', err)
      setEvents(list => dropProvisional(list, id))
      showToast('Could not save — try again', 'error')
    }

    /* The refetch moved to after the commit. Run before it, as it was, it
       replaced `events` with a list that cannot contain the provisional row
       yet, so the event blinked out and back. */
    await loadEvents()
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
    /* The sheet has just closed with the user's finger where these buttons
       now are, and for the next 0.3-2.5s the only id this row has is a
       `temp:` one Supabase has never seen. `db.updateEvent` / `deleteEvent`
       swallow the error and flip the app to the offline badge, so a mistimed
       tap would look like a lost connection for no reason. Inert until the
       write lands. */
    const stillWriting = !!ev.pending

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
            {ev.apple_sync_error && (
              <span className="ev-sync-failed" title={`Not in Apple Calendar — ${ev.apple_sync_error}`}>
                <SyncFailedIcon size={11} />
              </span>
            )}
          </div>
          {ev.end_date && ev.end_date > ev.date && (
            <div className="ev-daterange">{formatDate(ev.date)} → {formatDate(ev.end_date)}</div>
          )}
          {ev.notes && <div className="ev-notes">{ev.notes}</div>}
        </div>
        <div className="ev-actions">
          {!ev.isRecurringInstance && (
            <button className="ev-btn" onClick={() => setEditId(editTarget)} title="Edit" disabled={stillWriting}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
          {!ev.isRecurringInstance && (
            <button className="ev-btn" onClick={() => exportICS(ev)} title="Export .ics" disabled={stillWriting}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          )}
          {!ev.isRecurringInstance && (
            <button className="ev-btn del" onClick={() => handleDelete(ev.id)} title="Delete" disabled={stillWriting}>
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
            <div className="screen-dl-mark"><DLMark /></div>
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
                              >
                                {pos === 'start' && (
                                  <span className="cal-span-bar-label">{ev.title}</span>
                                )}
                              </span>
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
        <AddEventForm
          defaultDate={selected || todayStr}
          onSave={handleAddEvent}
          onCancel={() => setAddOpen(false)}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete event?"
          message="This event will be permanently removed."
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
