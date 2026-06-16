import { useState, useRef, useEffect, useCallback } from 'react'
import { parseInput } from '../ai.js'
import { db } from '../db.js'
import { CAT_META, formatRM, formatDate, formatTime } from '../utils.js'
import { MicIcon, SendIcon, CAT_ICONS } from '../Icons.jsx'
import DLMark from './DLMark.jsx'
import { useStaggeredEntries } from '../hooks/useStaggeredEntries.js'
import './Home.css'

export default function Home({ showToast, onLogged }) {
  const settings = db.getSettings()
  const userName = settings.name || 'You'

  const [text, setText]               = useState('')
  const [loading, setLoading]         = useState(false)
  const [recent, setRecent]           = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [scrolled, setScrolled]       = useState(false)
  const [burstKey, setBurstKey]       = useState(null)
  const [chipRipple, setChipRipple]   = useState(null)

  const textareaRef         = useRef(null)
  const scrollRef           = useRef(null)
  const chipRippleTimer     = useRef(null)
  const burstTimer          = useRef(null)
  const recognitionRef      = useRef(null)
  const [recording, setRecording] = useState(false)

  const refreshRecent = useCallback(async () => {
    const [exp, evt, inc] = await Promise.all([
      db.getExpenses(),
      db.getUpcomingEvents(3),
      db.getIncome(),
    ])
    const items = [
      ...exp.slice(0, 4).map(e => ({ ...e, _type: 'expense' })),
      ...evt.map(e => ({ ...e, _type: 'event' })),
      ...inc.slice(0, 2).map(e => ({ ...e, _type: 'income' })),
    ]
      .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))
      .slice(0, 6)
    setRecent(items)
    setLoadingData(false)
  }, [])

  useEffect(() => { refreshRecent() }, [refreshRecent])

  const handleScroll = useCallback(() => {
    setScrolled((scrollRef.current?.scrollTop || 0) > 30)
  }, [])

  const isVisible = useStaggeredEntries(recent)

  const triggerBurst = () => {
    clearTimeout(burstTimer.current)
    const key = Date.now()
    setBurstKey(key)
    burstTimer.current = setTimeout(() => setBurstKey(null), 900)
  }

  const handleSend = async () => {
    const input = text.trim()
    if (!input || loading) return
    setText('')
    setLoading(true)
    try {
      const parsed = await parseInput(input)
      let logged = []
      if (parsed.expense) { await db.addExpense(parsed.expense); logged.push('expense') }
      if (parsed.event)   { await db.addEvent(parsed.event);     logged.push('event') }
      if (parsed.income)  { await db.addIncome(parsed.income);   logged.push('income') }
      if (logged.length === 0) { showToast('Could not parse that', 'error'); setLoading(false); return }
      triggerBurst()
      showToast(
        logged.length === 2 ? 'Logged expense + event' :
        logged[0] === 'expense' ? 'Expense logged' :
        logged[0] === 'income'  ? 'Income logged' : 'Event added'
      )
      await refreshRecent(); onLogged()
    } catch { showToast('Parse failed — check API key', 'error') }
    setLoading(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const QUICK_CHIPS = [
    { label: 'Gift',          category: 'shopping'      },
    { label: 'Sports',        category: 'sports'        },
    { label: 'Investment',    category: 'investment'    },
    { label: 'Shopping',      category: 'shopping'      },
    { label: 'Car',           category: 'transport'     },
    { label: 'Travel',        category: 'travel'        },
    { label: 'Health',        category: 'health'        },
    { label: 'Entertainment', category: 'entertainment' },
  ]

  const handleQuickChip = async (chip) => {
    const val = prompt(`Amount for ${chip.label}? (RM)`)
    if (!val) return
    const amount = parseFloat(val)
    if (isNaN(amount) || amount <= 0) return
    await db.addExpense({
      description: chip.label,
      amount,
      category: chip.category,
      date: new Date().toISOString().split('T')[0],
    })
    showToast(`${chip.label} — ${formatRM(amount)}`)
    refreshRecent(); onLogged()
  }

  const handleChipDown = (e, label) => {
    const rect = e.currentTarget.getBoundingClientRect()
    clearTimeout(chipRippleTimer.current)
    const key = Date.now()
    setChipRipple({ key, label, x: e.clientX - rect.left, y: e.clientY - rect.top })
    chipRippleTimer.current = setTimeout(() => setChipRipple(null), 600)
  }

  const toggleMic = () => {
    if (recording) { recognitionRef.current?.stop(); return }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { showToast('Voice input not supported', 'error'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-MY'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition
    recognition.onresult = (e) => { setText(e.results[0][0].transcript); showToast('Voice captured — edit and send') }
    recognition.onerror = () => showToast('Mic access denied', 'error')
    recognition.onend = () => setRecording(false)
    recognition.start()
    setRecording(true)
  }

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div
      ref={scrollRef}
      className={`screen home-screen${scrolled ? ' scrolled' : ''}`}
      onScroll={handleScroll}
    >
      <div className="home-header">
        <div className="home-topbar">
          <span className="home-brand"><DLMark /></span>
          <span className="home-topdate">{now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        </div>
        <div className="home-hero">
          <div className="home-subgreeting">{greeting},</div>
          <div className="home-greeting">{userName}.</div>
          <div className="home-datestr">{dateLabel}</div>
        </div>
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
            <div className="send-wrap">
              {burstKey !== null && (
                <>
                  <span key={`r1-${burstKey}`} className="send-ring send-ring-1" />
                  <span key={`r2-${burstKey}`} className="send-ring send-ring-2" />
                </>
              )}
              <button
                className={`send-btn ${text.trim() ? 'ready' : ''} ${loading ? 'loading' : ''}`}
                onClick={handleSend}
                disabled={loading}
                aria-label="Log entry"
              >
                {burstKey !== null && <span key={`rp-${burstKey}`} className="send-btn-ripple" />}
                {loading
                  ? <span className="dots"><span/><span/><span/></span>
                  : <SendIcon />
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="home-section">
        <div className="section-label" style={{ paddingLeft: 20 }}>Quick log</div>
        <div className="presets-row">
          {QUICK_CHIPS.map(chip => {
            const color = CAT_META[chip.category]?.color
            const isRippling = chipRipple?.label === chip.label
            return (
              <button
                key={chip.label}
                className={`preset-chip${isRippling ? ' chip-flash' : ''}`}
                onPointerDown={(e) => handleChipDown(e, chip.label)}
                onClick={() => handleQuickChip(chip)}
              >
                {isRippling && (
                  <span
                    key={chipRipple.key}
                    className="chip-ripple"
                    style={{ left: chipRipple.x, top: chipRipple.y }}
                  />
                )}
                <span className="preset-dot" style={{ background: color }} />
                {chip.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="home-section" style={{ marginTop: 24 }}>
        <div className="section-label">Recent</div>
        {loadingData ? (
          <div className="loading-wrap"><div className="spinner"/></div>
        ) : recent.length === 0 ? (
          <div className="empty">nothing logged yet</div>
        ) : (
          <div className="card">
            {recent.map((item, i) => {
              const isLast = i === recent.length - 1
              const vis = isVisible(i)
              if (item._type === 'income') {
                const meta = CAT_META[item.category]
                return (
                  <div key={item.id} className={`entry-row stagger-item${vis ? ' stagger-vis' : ''} ${isLast ? '' : 'bordered'}`}>
                    <span className="entry-icon-wrap" style={{ color: meta?.color, background: (meta?.color || '#fff') + '18' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </span>
                    <div className="entry-body">
                      <div className="entry-title">{item.description}</div>
                      {item.notes && <div className="entry-notes">{item.notes}</div>}
                      <div className="entry-sub">{meta?.label} · {formatDate(item.date)}</div>
                    </div>
                    <div className="entry-amount" style={{ color: meta?.color }}>+{formatRM(item.amount)}</div>
                  </div>
                )
              }
              if (item._type === 'expense') {
                const meta = CAT_META[item.category]
                const Icon = CAT_ICONS[item.category]
                return (
                  <div key={item.id} className={`entry-row stagger-item${vis ? ' stagger-vis' : ''} ${isLast ? '' : 'bordered'}`}>
                    <span className="entry-icon-wrap" style={{ color: meta?.color, background: meta?.color + '18' }}>
                      {Icon && <Icon size={14} />}
                    </span>
                    <div className="entry-body">
                      <div className="entry-title">{item.description}</div>
                      {item.notes && <div className="entry-notes">{item.notes}</div>}
                      <div className="entry-sub">{meta?.label} · {formatDate(item.date)}</div>
                    </div>
                    <div className="entry-amount">{formatRM(item.amount)}</div>
                  </div>
                )
              }
              return (
                <div key={item.id} className={`entry-row stagger-item${vis ? ' stagger-vis' : ''} ${isLast ? '' : 'bordered'}`}>
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
