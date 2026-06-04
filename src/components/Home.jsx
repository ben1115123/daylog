import { useState, useRef } from 'react'
import { parseInput } from '../gemini.js'
import { db } from '../db.js'
import { PRESETS, CAT_META, formatRM, formatDate, formatTime } from '../utils.js'
import './Home.css'

const MicIcon = ({ active }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {active
      ? <><rect x="4" y="4" width="16" height="16" rx="2"/></>
      : <><path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
    }
  </svg>
)

export default function Home({ showToast, onLogged }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState(() => {
    const exp = db.getExpenses().slice(0, 4).map(e => ({ ...e, _type: 'expense' }))
    const evt = db.getUpcomingEvents(3).map(e => ({ ...e, _type: 'event' }))
    return [...exp, ...evt].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6)
  })
  const textareaRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef(null)

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
      refreshRecent()
      onLogged()
    } catch {
      showToast('Parse failed — check API key', 'error')
    }
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
      rec.start()
      setRecording(true)
      rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); showToast('Voice captured — edit and send') }
    } catch { showToast('Mic access denied', 'error') }
  }

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Morning' : now.getHours() < 18 ? 'Afternoon' : 'Evening'
  const todayLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="screen">

      {/* ── Editorial hero ──────────────────────────── */}
      <div className="home-hero">
        <div className="home-date">{todayLabel}</div>
        <div className="home-greeting">{greeting}, Ben.</div>
      </div>

      {/* ── Input — borderless focal point ──────────── */}
      <div className="home-input-section">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder='e.g. "grab home RM18" or "dentist Friday 3pm"'
          rows={2}
          disabled={loading}
        />
        <div className="home-input-bar">
          <span className="char-hint">enter to log</span>
          <div className="home-input-actions">
            <button
              className={`mic-btn ${recording ? 'active' : ''}`}
              onClick={toggleMic}
              aria-label={recording ? 'Stop recording' : 'Start recording'}
            >
              <MicIcon active={recording} />
            </button>
            <button
              className={`send-btn ${loading ? 'loading' : ''} ${text.trim() ? 'ready' : ''}`}
              onClick={handleSend}
              disabled={loading}
              aria-label="Send"
            >
              {loading
                ? <span className="dots"><span/><span/><span/></span>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick log ────────────────────────────────── */}
      <div className="section" style={{ marginTop: 8 }}>
        <div className="section-label">Quick log</div>
        <div className="presets-row">
          {PRESETS.map(p => (
            <button key={p.id} className="preset-chip" onClick={() => handlePreset(p)}>
              <span className="preset-dot" style={{ background: CAT_META[p.category]?.color }} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Recent ───────────────────────────────────── */}
      <div className="section" style={{ marginTop: 32 }}>
        <div className="section-label">Recent</div>
        {recent.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">—</span>
            nothing logged yet
          </div>
        ) : (
          <div className="card">
            {recent.map((item, i) => (
              <div key={item.id} className={`entry-row ${i < recent.length - 1 ? 'bordered' : ''}`}>
                {item._type === 'expense' ? (
                  <>
                    <span
                      className="entry-cat-dot"
                      style={{ background: CAT_META[item.category]?.color }}
                    />
                    <div className="entry-body">
                      <div className="entry-title">{item.description}</div>
                      <div className="entry-sub">{CAT_META[item.category]?.label} · {formatDate(item.date)}</div>
                    </div>
                    <div className="entry-amount">{formatRM(item.amount)}</div>
                  </>
                ) : (
                  <>
                    <span className="entry-cat-dot" style={{ background: 'var(--blue)' }} />
                    <div className="entry-body">
                      <div className="entry-title">{item.title}</div>
                      <div className="entry-sub">{formatDate(item.date)}{item.time ? ' · ' + formatTime(item.time) : ''}</div>
                    </div>
                    <div className="entry-label">event</div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
