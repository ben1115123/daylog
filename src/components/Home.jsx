import { useState, useRef } from 'react'
import { parseInput } from '../gemini.js'
import { db } from '../db.js'
import { PRESETS, CAT_META, formatRM, formatDate, formatTime } from '../utils.js'
import './Home.css'

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
      if (parsed.event) { db.addEvent(parsed.event); logged.push('event') }
      if (logged.length === 0) { showToast('Hmm, could not parse that', 'error'); setLoading(false); return }
      showToast(logged.length === 2 ? '✓ Logged expense + event' : logged[0] === 'expense' ? '✓ Expense logged' : '✓ Event added')
      refreshRecent()
      onLogged()
    } catch (e) {
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
      showToast(`✓ ${preset.label} logged`)
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
    showToast(`✓ ${preset.label} — ${formatRM(amount)}`)
    refreshRecent(); onLogged()
  }

  const toggleMic = async () => {
    if (recording) {
      recorderRef.current?.stop()
      setRecording(false)
      return
    }
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

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-title">DayLog</div>
        <div className="screen-heading">{greeting}, Ben</div>
      </div>

      <div className="section" style={{ marginTop: 20 }}>
        <div className="input-card card">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={'e.g. "grab home RM18" or "dentist Friday 3pm"'}
            rows={2}
            disabled={loading}
          />
          <div className="input-actions">
            <button className={`mic-btn ${recording ? 'active' : ''}`} onClick={toggleMic}>
              {recording ? '⏹' : '🎙'}
            </button>
            <div className="char-hint">Enter to send</div>
            <button className={`send-btn ${loading ? 'loading' : ''} ${text.trim() ? 'ready' : ''}`} onClick={handleSend} disabled={loading}>
              {loading ? <span className="dots"><span/><span/><span/></span> : '↑'}
            </button>
          </div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 20 }}>
        <div className="section-label">Quick log</div>
        <div className="presets-row">
          {PRESETS.map(p => (
            <button key={p.id} className="preset-btn" onClick={() => handlePreset(p)}>
              <span className="preset-icon">{p.icon}</span>
              <span className="preset-label">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="section" style={{ marginTop: 24 }}>
        <div className="section-label">Recent</div>
        {recent.length === 0 ? (
          <div className="empty"><span className="empty-icon">◎</span>nothing logged yet</div>
        ) : (
          <div className="card">
            {recent.map((item, i) => (
              <div key={item.id} className={`entry-row ${i < recent.length - 1 ? 'bordered' : ''}`}>
                {item._type === 'expense' ? (
                  <>
                    <span className="entry-icon" style={{ background: CAT_META[item.category]?.color + '22', color: CAT_META[item.category]?.color }}>
                      {CAT_META[item.category]?.icon}
                    </span>
                    <div className="entry-body">
                      <div className="entry-title">{item.description}</div>
                      <div className="entry-sub">{CAT_META[item.category]?.label} · {formatDate(item.date)}</div>
                    </div>
                    <div className="entry-amount">{formatRM(item.amount)}</div>
                  </>
                ) : (
                  <>
                    <span className="entry-icon" style={{ background: '#5f9fff22', color: '#5f9fff' }}>📅</span>
                    <div className="entry-body">
                      <div className="entry-title">{item.title}</div>
                      <div className="entry-sub">{formatDate(item.date)}{item.time ? ' · ' + formatTime(item.time) : ''}</div>
                    </div>
                    <div className="entry-amount" style={{ fontSize: 11, color: 'var(--text3)' }}>event</div>
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
