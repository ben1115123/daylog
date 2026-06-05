import { useState } from 'react'
import { db } from '../db.js'
import { formatTime } from '../utils.js'
import './Calendar.css'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOWS = ['Su','Mo','Tu','We','Th','Fr','Sa']

const ChevLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const ChevRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

export default function Calendar({ showToast }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState(now.toISOString().split('T')[0])
  const events = db.getEvents()

  const todayStr = now.toISOString().split('T')[0]
  const eventDates = new Set(events.map(e => e.date))

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const selectedEvents = selected
    ? events.filter(e => e.date === selected)
    : events.filter(e => e.date >= todayStr).slice(0, 8)

  const handleDelete = (id) => {
    if (confirm('Delete this event?')) { db.deleteEvent(id); showToast('Deleted') }
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
    showToast('.ics downloaded — add to Calendar')
  }

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push({ day: prevDays - firstDay + 1 + i, type: 'prev' })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, type: 'curr' })
  const rem = 42 - cells.length
  for (let i = 1; i <= rem; i++) cells.push({ day: i, type: 'next' })

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-header-row">
          <div>
            <div className="screen-label">Schedule</div>
            <div className="screen-heading">Calendar</div>
          </div>
          <div className="month-nav-cal">
            <button onClick={prevMonth} aria-label="Previous month"><ChevLeft /></button>
            <span>{MONTHS[month].slice(0,3)} {year}</span>
            <button onClick={nextMonth} aria-label="Next month"><ChevRight /></button>
          </div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 16 }}>
        <div className="cal-grid-wrap card">
          <div className="cal-dows">
            {DOWS.map(d => <div key={d} className="cal-dow">{d}</div>)}
          </div>
          <div className="cal-grid">
            {cells.map((cell, i) => {
              if (cell.type !== 'curr') return <div key={i} className="cal-cell other">{cell.day}</div>
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(cell.day).padStart(2,'0')}`
              const isToday = dateStr === todayStr
              const hasEv = eventDates.has(dateStr)
              const isSel = dateStr === selected
              return (
                <div
                  key={i}
                  className={`cal-cell ${isToday ? 'today' : ''} ${isSel && !isToday ? 'selected' : ''}`}
                  onClick={() => setSelected(isSel ? null : dateStr)}
                >
                  {cell.day}
                  {hasEv && <span className={`ev-dot ${isToday ? 'ev-dot-light' : ''}`} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 20, paddingBottom: 32 }}>
        <div className="section-label">{selected ? `Events — ${selected}` : 'Upcoming'}</div>
        {selectedEvents.length === 0 ? (
          <div className="empty">{selected ? 'nothing on this day' : 'no upcoming events'}</div>
        ) : (
          <div className="card">
            {selectedEvents.map((ev, i) => (
              <div key={ev.id} className={`ev-row ${i < selectedEvents.length - 1 ? 'bordered' : ''}`}>
                <div className="ev-time">{ev.time ? formatTime(ev.time) : 'all day'}</div>
                <div className="ev-dot-line" />
                <div className="ev-body">
                  <div className="ev-title">{ev.title}</div>
                  {ev.notes && <div className="ev-notes">{ev.notes}</div>}
                </div>
                <div className="ev-actions">
                  <button className="ev-btn" onClick={() => exportICS(ev)} title="Export .ics">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </button>
                  <button className="ev-btn del" onClick={() => handleDelete(ev.id)} title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
