import { useState, useRef } from 'react'
import { parseInput } from '../gemini.js'
import { db } from '../db.js'
import { PRESETS, CAT_META, formatRM, formatDate, formatTime } from '../utils.js'
import { MicIcon, SendIcon, CAT_ICONS } from '../Icons.jsx'
import './Home.css'

export default function Home({ showToast, onLogged }) {
  const settings = db.getSettings()
  const userName = settings.name || 'You'

  const [text, setText]       = useState('')
  const [loading, setLoading] = useState(false)
  const [recent, setRecent]   = useState(() => {
    const exp = db.getExpenses().slice(0, 4).map(e => ({ ...e, _type: 'expense' }))
    const evt = db.getUpcomingEvents(3).map(e => ({ ...e, _type: 'event' }))
    return [...exp, ...evt].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6)
  })
  const textareaRef  = useRef(null)
  const [recording, setRecording] = useState(false)
  const recorderRef  = useRef(null)

  const refreshRecent = () => {
    const exp = db.getExpenses().slice(0, 4).map(e => ({ ...e, _type: 'expense' }))
    const evt = db.getUpcomingEvents(3).map(e => ({ ...e, _type: 'event' }))
    setRecent([...exp, ...evt].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6))
  }

  const handleSend = async () => {
    const input = text.trim()
    if (!input || loading) return
    setText('')
    setLoading(true)
    try {
      const parsed = await parseInput(input)
      let logged = []
      if (parsed.expense) { db.addExpense(parsed.expense); logged.push('expense') }
      if (parsed.event)   { db.addEvent(parsed.event);   logged.push('event') }
      if (logged.length === 0) { showToast('Could not parse that', 'error'); setLoading(false); return }
      showToast(
        logged.length === 2 ? 'Logged expense + event' :
        logged[0] === 'expense' ? 'Expense logged' : 'Event added'
      )
      refreshRecent(); onLogged()
    } catch { showToast('Parse failed — check API key', 'error') }
    setLoading(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handlePreset = (preset) => {
    if (preset.isEvent && !preset.isExpense) {
      const today = new Date().toISOString().split('T')[0]
      db.addEvent({ title: preset.label + ' session', date: today, time: null, notes: null })
      showToast(`${preset.label} logged`)
      refreshRecent(); onLogged(); return
    }
    let amount = preset.amount
    if (!amount) {
      const val = prompt(`Amount for ${preset.label}? (RM)`)
      if (!val) return
      amount = parseFloat(val)
      if (isNaN(amount)) return
    }
    db.addExpense({ description: preset.label, amount, category: preset.category, date: new Date().toISOString().split('T')[0] })
    showToast(`${preset.label} — ${formatRM(amount)}`)
    refreshRecent(); onLogged()
  }

  const toggleMic = async () => {
    if (recording) { recorderRef.current?.stop(); setRecording(false); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      recorderRef.current = rec
      rec.start(); setRecording(true)
      rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); showToast('Voice captured — edit and send') }
    } catch { showToast('Mic access denied', 'error') }
  }

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="screen home-screen">

      <div className="home-topbar">
        <span className="home-brand">DAYLOG</span>
        <span className="home-topdate">{now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
      </div>

      <div className="home-hero">
        <div className="home-subgreeting">{greeting},</div>
        <div className="home-greeting">{userName}.</div>
        <div className="home-datestr">{dateLabel}</div>
      </div>

      <div className="home-input-wrap">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder='e.g. "grab home RM18" or "dentist Friday 3pm"'
          rows={2}
          disabled={loading}
        />
        <div className="home-input-footer">
          <span className="input-hint">enter to send</span>
          <div className="input-actions">
            <button
              className={`mic-btn ${recording ? 'active' : ''}`}
              onClick={toggleMic}
              aria-label={recording ? 'Stop recording' : 'Voice input'}
            >
              <MicIcon active={recording} />
            </button>
            <button
              className={`send-btn ${text.trim() ? 'ready' : ''} ${loading ? 'loading' : ''}`}
              onClick={handleSend}
              disabled={loading}
              aria-label="Log entry"
            >
              {loading
                ? <span className="dots"><span/><span/><span/></span>
                : <SendIcon />
              }
            </button>
          </div>
        </div>
      </div>

      <div className="home-section">
        <div className="section-label" style={{ paddingLeft: 20 }}>Quick log</div>
        <div className="presets-row">
          {PRESETS.map(p => {
            const color = CAT_META[p.category]?.color
            return (
              <button key={p.id} className="preset-chip" onClick={() => handlePreset(p)}>
                <span className="preset-dot" style={{ background: color }} />
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="home-section" style={{ marginTop: 24 }}>
        <div className="section-label">Recent</div>
        {recent.length === 0 ? (
          <div className="empty">nothing logged yet</div>
        ) : (
          <div className="card">
            {recent.map((item, i) => {
              const isLast = i === recent.length - 1
              if (item._type === 'expense') {
                const meta = CAT_META[item.category]
                const Icon = CAT_ICONS[item.category]
                return (
                  <div key={item.id} className={`entry-row ${isLast ? '' : 'bordered'}`}>
                    <span className="entry-icon-wrap" style={{ color: meta?.color, background: meta?.color + '18' }}>
                      {Icon && <Icon size={14} />}
                    </span>
                    <div className="entry-body">
                      <div className="entry-title">{item.description}</div>
                      <div className="entry-sub">{meta?.label} · {formatDate(item.date)}</div>
                    </div>
                    <div className="entry-amount">{formatRM(item.amount)}</div>
                  </div>
                )
              }
              return (
                <div key={item.id} className={`entry-row ${isLast ? '' : 'bordered'}`}>
                  <span className="entry-icon-wrap" style={{ color: 'var(--accent)', background: 'var(--accent-dim)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </span>
                  <div className="entry-body">
                    <div className="entry-title">{item.title}</div>
                    <div className="entry-sub">{formatDate(item.date)}{item.time ? ' · ' + formatTime(item.time) : ''}</div>
                  </div>
                  <div className="entry-badge">event</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
