import { useState, useRef, useEffect, useCallback } from 'react'
import { parseInput } from '../ai.js'
import { db, computeRecentMonths } from '../db.js'
import { CAT_META, CATEGORIES, formatRM, formatRMParts, formatDate, formatTime } from '../utils.js'
import { MicIcon, SendIcon, CAT_ICONS, BackIcon, SyncFailedIcon } from '../Icons.jsx'
import { todayISO, shiftMonth } from '../lib/dates.js'
import DLMark from './DLMark.jsx'
import Sheet from './Sheet.jsx'
import Calendar from './Calendar.jsx'
import EditEntrySheet from './EditEntrySheet.jsx'
import AmountInput from './AmountInput.jsx'
import { DonutChart } from './Spending.jsx'
import { useStaggeredEntries } from '../hooks/useStaggeredEntries.js'
import { useCountUp } from '../hooks/useCountUp.js'
import './Home.css'

/* ── Shared-element expand transition (FLIP) ──────────── */
function useExpand() {
  const ref = useRef(null)
  const [phase, setPhase] = useState('closed') // closed | opening | open | closing
  const rectRef = useRef({ top: 0, left: 0, width: 0, height: 0 })

  const open = useCallback(() => {
    const r = ref.current.getBoundingClientRect()
    rectRef.current = { top: r.top, left: r.left, width: r.width, height: r.height }
    setPhase('opening')
    requestAnimationFrame(() => setPhase('open'))
  }, [])

  const close = useCallback(() => {
    setPhase('closing')
    setTimeout(() => setPhase('closed'), 460)
  }, [])

  let overlayStyle = null
  if (phase === 'opening') {
    overlayStyle = { top: rectRef.current.top, left: rectRef.current.left, width: rectRef.current.width, height: rectRef.current.height, borderRadius: '16px', transition: 'none' }
  } else if (phase === 'open') {
    overlayStyle = { top: 0, left: 0, width: '100%', height: '100%', borderRadius: 0 }
  } else if (phase === 'closing') {
    overlayStyle = { top: rectRef.current.top, left: rectRef.current.left, width: rectRef.current.width, height: rectRef.current.height, borderRadius: '16px' }
  }

  return { ref, phase, open, close, overlayStyle }
}

/* ── Spending summary mini content (closed card + pinned overlay state) ── */
function SpendMini({ data, label, budget }) {
  const animTotal = useCountUp(data ? data.total : 0)
  if (!data) return <div className="loading-wrap"><div className="spinner"/></div>
  const savedPositive = data.saved >= 0
  const pct = budget > 0 ? Math.min(100, Math.round((data.total / budget) * 100)) : 0
  const amount = formatRMParts(animTotal)
  return (
    <div className="spend-mini">
      <div className="spend-mini-pill">{budget > 0 ? `${pct}%` : '—'}</div>
      <div className="spend-mini-label">{label}</div>
      <div className="big-number spend-mini-amount">
        <span className="rm-prefix">{amount.prefix}</span>{amount.value}
      </div>
      <div className="spend-mini-track">
        <div className="spend-mini-fill" style={{ width: pct + '%' }} />
      </div>
      <div className="spend-mini-foot">
        <span className={`spend-mini-saved ${savedPositive ? 'pos' : 'neg'}`}>
          {savedPositive ? 'saved ' : 'over by '}{formatRM(Math.abs(data.saved))}
        </span>
        <span className="spend-mini-chev"><BackIcon /></span>
      </div>
    </div>
  )
}

const SPEND_TABS = [
  ['lastMonth', 'Last month'],
  ['thisMonth', 'This month'],
  ['avg',       'Avg'],
]

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
  const [amountChip, setAmountChip]   = useState(null)
  const [amountVal, setAmountVal]     = useState('')

  const textareaRef         = useRef(null)
  const scrollRef           = useRef(null)
  const chipRippleTimer     = useRef(null)
  const burstTimer          = useRef(null)
  const recognitionRef      = useRef(null)
  const [recording, setRecording] = useState(false)

  /* ── Spending summary expand ─────────────────────────── */
  const spend                       = useExpand()
  const [spendTab, setSpendTab]     = useState('thisMonth')
  const [spendTabs, setSpendTabs]   = useState(null)
  const [editingEntry, setEditingEntry] = useState(null)
  const [committedTotal, setCommittedTotal] = useState(0)
  const [arcsDrawn, setArcsDrawn]   = useState(false)

  /* ── Upcoming events strip / calendar expand ─────────── */
  const cal                         = useExpand()
  const [upcoming, setUpcoming]     = useState([])

  const loadSpendOverview = useCallback(async () => {
    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth()
    const { year: py, month: pm } = shiftMonth(y, m, -1)

    const [thisExp, thisInc, lastExp, lastInc, allExp, allInc, recurring] = await Promise.all([
      db.getMonthExpenses(y, m),
      db.getMonthIncome(y, m),
      db.getMonthExpenses(py, pm),
      db.getMonthIncome(py, pm),
      db.getExpenses(),
      db.getIncome(),
      db.getRecurring(),
    ])

    setCommittedTotal(recurring.filter(r => r.active).reduce((s, r) => s + (r.amount || 0), 0))

    const buildTab = (exp, inc) => {
      const total       = exp.reduce((s, e) => s + (e.amount || 0), 0)
      const incomeTotal = inc.reduce((s, i) => s + (i.amount || 0), 0)
      const saved       = incomeTotal - total
      const savingsRate = incomeTotal > 0 ? Math.round((saved / incomeTotal) * 100) : 0
      const byCat = {}
      exp.forEach(e => { if (e.category) byCat[e.category] = (byCat[e.category] || 0) + (e.amount || 0) })
      const donutCats = CATEGORIES.map(cat => ({
        cat, amount: byCat[cat] || 0, color: CAT_META[cat]?.color, label: CAT_META[cat]?.label,
      })).filter(c => c.amount > 0)
      const biggest = exp.length
        ? exp.reduce((max, e) => (e.amount || 0) > (max?.amount || 0) ? e : max, null)
        : null
      const items = [
        ...exp.map(e => ({ ...e, _type: 'expense' })),
        ...inc.map(i => ({ ...i, _type: 'income' })),
      ].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      return { total, incomeTotal, saved, savingsRate, donutCats, biggest, entriesCount: exp.length, items }
    }

    const recentMonths = computeRecentMonths(allExp, 6)
    const n = recentMonths.length || 1
    const avgTotal  = recentMonths.reduce((s, mo) => s + mo.total, 0) / n
    const incomeByMonth = {}
    allInc.forEach(inc => {
      const prefix = inc.date?.slice(0, 7)
      if (prefix) incomeByMonth[prefix] = (incomeByMonth[prefix] || 0) + (inc.amount || 0)
    })
    const avgIncome      = recentMonths.reduce((s, mo) => s + (incomeByMonth[mo.key] || 0), 0) / n
    const avgSaved       = avgIncome - avgTotal
    const avgSavingsRate = avgIncome > 0 ? Math.round((avgSaved / avgIncome) * 100) : 0
    const avgByCat = {}
    allExp.forEach(e => {
      const prefix = e.date?.slice(0, 7)
      if (prefix && e.category && recentMonths.some(mo => mo.key === prefix)) {
        avgByCat[e.category] = (avgByCat[e.category] || 0) + (e.amount || 0) / n
      }
    })
    const avgDonutCats = CATEGORIES.map(cat => ({
      cat, amount: avgByCat[cat] || 0, color: CAT_META[cat]?.color, label: CAT_META[cat]?.label,
    })).filter(c => c.amount > 0)
    const avgBiggest = allExp.length
      ? allExp.reduce((max, e) => (e.amount || 0) > (max?.amount || 0) ? e : max, null)
      : null

    setSpendTabs({
      thisMonth: buildTab(thisExp, thisInc),
      lastMonth: buildTab(lastExp, lastInc),
      avg: {
        total: avgTotal, incomeTotal: avgIncome, saved: avgSaved, savingsRate: avgSavingsRate,
        donutCats: avgDonutCats, biggest: avgBiggest, entriesCount: Math.round(allExp.length / n),
        items: [],
      },
    })
  }, [])

  useEffect(() => { loadSpendOverview() }, [loadSpendOverview])

  useEffect(() => {
    if (spend.phase === 'open') {
      const t = setTimeout(() => setArcsDrawn(true), 300)
      return () => clearTimeout(t)
    }
    setArcsDrawn(false)
  }, [spend.phase])

  const refreshRecent = useCallback(async () => {
    const [exp, evt, inc, evtStrip] = await Promise.all([
      db.getExpenses(),
      db.getUpcomingEvents(3),
      db.getIncome(),
      db.getUpcomingEvents(5),
    ])
    const items = [
      ...exp.slice(0, 4).map(e => ({ ...e, _type: 'expense' })),
      ...evt.map(e => ({ ...e, _type: 'event' })),
      ...inc.slice(0, 2).map(e => ({ ...e, _type: 'income' })),
    ]
      .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))
      .slice(0, 6)
    setRecent(items)
    setUpcoming(evtStrip)
    setLoadingData(false)
  }, [])

  useEffect(() => { refreshRecent() }, [refreshRecent])

  /* Apple Calendar sync resolves a second or two after the event is saved, so
     patch the pill in place rather than waiting for the next refresh. */
  useEffect(() => {
    const onSync = e => {
      const { id, error } = e.detail
      const patch = list => list.map(it => it.id === id ? { ...it, apple_sync_error: error } : it)
      setUpcoming(patch)
      setRecent(patch)
    }
    window.addEventListener('daylog:sync', onSync)
    return () => window.removeEventListener('daylog:sync', onSync)
  }, [])

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
      const created = []
      if (parsed.expense) created.push(['expense', await db.addExpense(parsed.expense)])
      if (parsed.event)   created.push(['event',   await db.addEvent(parsed.event)])
      if (parsed.income)  created.push(['income',  await db.addIncome(parsed.income)])
      if (created.length === 0) { showToast('Could not parse that', 'error'); setLoading(false); return }
      triggerBurst()
      const msg =
        created.length === 2 ? 'Logged expense + event' :
        created[0][0] === 'expense' ? 'Expense logged' :
        created[0][0] === 'income'  ? 'Income logged' : 'Event added'
      showToast(msg, 'success', {
        label: 'UNDO',
        onClick: async () => {
          for (const [type, row] of created) {
            if (type === 'expense') await db.deleteExpense(row.id)
            else if (type === 'income') await db.deleteIncome(row.id)
            else await db.deleteEvent(row.id)
          }
          onLogged()
        },
      })
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

  const handleQuickChip = (chip) => {
    setAmountVal('')
    setAmountChip(chip)
  }

  const handleLogAmount = async () => {
    const amount = parseFloat(amountVal)
    if (isNaN(amount) || amount <= 0) return
    const chip = amountChip
    const row = await db.addExpense({
      description: chip.label,
      amount,
      category: chip.category,
      date: todayISO(),
    })
    showToast(`${chip.label} — ${formatRM(amount)}`, 'success', {
      label: 'UNDO',
      onClick: async () => { await db.deleteExpense(row.id); onLogged() },
    })
    setAmountChip(null)
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

  const dimmed = spend.phase !== 'closed' || cal.phase !== 'closed'

  return (
    <>
    <div
      ref={scrollRef}
      className={`screen home-screen${scrolled ? ' scrolled' : ''}${dimmed ? ' bg-dimmed' : ''}`}
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
        <div className="section-label">Spending</div>
        <div
          ref={spend.ref}
          className="card spend-card"
          style={{ visibility: spend.phase === 'closed' ? 'visible' : 'hidden' }}
          onClick={spend.phase === 'closed' ? spend.open : undefined}
        >
          <SpendMini data={spendTabs?.thisMonth} label="This month" budget={settings.totalBudget} />
        </div>
      </div>

      <div className="home-section" style={{ marginTop: 24 }}>
        <div className="section-label">Upcoming</div>
        <div
          ref={cal.ref}
          className={`card upcoming-strip${upcoming.length === 0 ? ' upcoming-strip-empty' : ''}`}
          style={{ visibility: cal.phase === 'closed' ? 'visible' : 'hidden' }}
          onClick={cal.phase === 'closed' ? cal.open : undefined}
        >
          {upcoming.length === 0 ? (
            <div className="empty">no upcoming events</div>
          ) : (
            <div className="upcoming-strip-row">
              {upcoming.map(ev => (
                <div
                  key={`${ev.id}-${ev.date}`}
                  className="upcoming-pill"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (ev.isRecurringInstance) { showToast('Edit repeating events from the Calendar', 'error'); return }
                    setEditingEntry({ ...ev, _type: 'event' })
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    e.stopPropagation()
                    if (ev.isRecurringInstance) { showToast('Edit repeating events from the Calendar', 'error'); return }
                    setEditingEntry({ ...ev, _type: 'event' })
                  }}
                >
                  <div className="upcoming-pill-date">
                    {formatDate(ev.date)}
                    {ev.apple_sync_error && (
                      <span className="pill-sync-failed" title={`Not in Apple Calendar — ${ev.apple_sync_error}`}>
                        <SyncFailedIcon size={10} />
                      </span>
                    )}
                  </div>
                  <div className="upcoming-pill-title">{ev.title}</div>
                </div>
              ))}
            </div>
          )}
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

    {spend.phase !== 'closed' && (
      <div className={`spend-card-overlay ${spend.phase}`} style={spend.overlayStyle}>
        <div className="spend-overlay-mini" style={{ opacity: spend.phase === 'open' ? 0 : 1 }}>
          <SpendMini data={spendTabs?.thisMonth} label="This month" budget={settings.totalBudget} />
        </div>

        <div className="spend-overlay-full" style={{ opacity: spend.phase === 'open' ? 1 : 0, pointerEvents: spend.phase === 'open' ? 'auto' : 'none' }}>
          <button className="spend-back" onClick={spend.close}><BackIcon /> back</button>

          {(() => {
            const data = spendTabs?.[spendTab]
            if (!data) return <div className="loading-wrap"><div className="spinner"/></div>
            const savedPositive = data.saved >= 0
            return (
              <>
                <div className="spend-overlay-header">
                  <div className="big-number spend-overlay-amount">
                    <span className="rm-prefix">{formatRMParts(data.total).prefix}</span>{formatRMParts(data.total).value}
                  </div>
                  <div className={`spend-overlay-saved ${savedPositive ? 'pos' : 'neg'}`}>
                    {savedPositive ? 'Saved ' : 'Over by '}{formatRM(Math.abs(data.saved))}
                    {data.incomeTotal > 0 && ` · ${data.savingsRate}% rate`}
                  </div>
                </div>

                <div className="spend-tabs">
                  {SPEND_TABS.map(([key, label]) => (
                    <button
                      key={key}
                      className={`spend-tab${spendTab === key ? ' active' : ''}`}
                      onClick={() => setSpendTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="spend-overlay-donut">
                  <DonutChart cats={data.donutCats} total={data.total} animate={arcsDrawn} />
                </div>

                <div className="spend-overlay-bars">
                  {data.donutCats.map((c, i) => {
                    const pct = data.total > 0 ? Math.round((c.amount / data.total) * 100) : 0
                    return (
                      <div key={c.cat} className="spend-bar-row">
                        <div className="spend-bar-label">
                          <span className="spend-bar-dot" style={{ background: c.color }} />
                          {c.label}
                        </div>
                        <div className="spend-bar-track">
                          <div
                            className="spend-bar-fill"
                            style={{
                              width: arcsDrawn ? `${pct}%` : '0%',
                              background: c.color,
                              transitionDelay: `${i * 0.06}s`,
                            }}
                          />
                        </div>
                        <div className="spend-bar-amount">{formatRM(c.amount)}</div>
                      </div>
                    )
                  })}
                </div>

                <div className="spend-stat-grid">
                  <div className="spend-stat-cell">
                    <div className="spend-stat-label">Biggest</div>
                    <div className="spend-stat-val">{data.biggest ? formatRM(data.biggest.amount) : '—'}</div>
                    {data.biggest && <div className="spend-stat-sub">{data.biggest.description}</div>}
                  </div>
                  <div className="spend-stat-cell">
                    <div className="spend-stat-label">Entries</div>
                    <div className="spend-stat-val">{data.entriesCount}</div>
                  </div>
                  <div className="spend-stat-cell">
                    <div className="spend-stat-label">Committed</div>
                    <div className="spend-stat-val">{formatRM(committedTotal)}<span className="spend-stat-unit">/mo</span></div>
                  </div>
                  <div className="spend-stat-cell">
                    <div className="spend-stat-label">Savings rate</div>
                    <div className="spend-stat-val" style={{ color: data.savingsRate >= 20 ? 'var(--accent)' : data.savingsRate > 0 ? 'var(--text)' : 'var(--red)' }}>
                      {data.incomeTotal > 0 ? `${data.savingsRate}%` : '—'}
                    </div>
                  </div>
                </div>

                {data.items.length > 0 && (
                  <div className="home-section" style={{ marginTop: 24, padding: 0 }}>
                    <div className="section-label">Entries</div>
                    <div className="card">
                      {data.items.map((item, i) => {
                        const isLast = i === data.items.length - 1
                        const meta = CAT_META[item.category]
                        const Icon = item._type === 'expense' ? CAT_ICONS[item.category] : null
                        return (
                          <div
                            key={`${item._type}-${item.id}`}
                            className={`entry-row ${isLast ? '' : 'bordered'}`}
                            onClick={() => setEditingEntry(item)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingEntry(item) } }}
                            role="button"
                            tabIndex={0}
                          >
                            <span className="entry-icon-wrap" style={{ color: meta?.color, background: (meta?.color || '#fff') + '18' }}>
                              {item._type === 'expense' ? (Icon && <Icon size={14} />) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                              )}
                            </span>
                            <div className="entry-body">
                              <div className="entry-title">{item.description}</div>
                              {item.notes && <div className="entry-notes">{item.notes}</div>}
                              <div className="entry-sub">{meta?.label} · {formatDate(item.date)}</div>
                            </div>
                            <div className="entry-amount" style={item._type === 'income' ? { color: meta?.color } : undefined}>
                              {item._type === 'income' ? '+' : ''}{formatRM(item.amount)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </div>
    )}

    {cal.phase !== 'closed' && (
      <div className={`cal-card-overlay ${cal.phase}`} style={cal.overlayStyle}>
        <div className="cal-overlay-mini" style={{ opacity: cal.phase === 'open' ? 0 : 1 }}>
          <div className="upcoming-strip-row">
            {upcoming.map(ev => (
              <div key={`${ev.id}-${ev.date}`} className="upcoming-pill">
                <div className="upcoming-pill-date">{formatDate(ev.date)}</div>
                <div className="upcoming-pill-title">{ev.title}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="cal-overlay-full" style={{ opacity: cal.phase === 'open' ? 1 : 0, pointerEvents: cal.phase === 'open' ? 'auto' : 'none' }}>
          <button className="cal-back" onClick={cal.close}><BackIcon /> back</button>
          <div className="cal-overlay-body">
            <Calendar showToast={showToast} />
          </div>
        </div>
      </div>
    )}

    {editingEntry && (
      <EditEntrySheet
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSave={async (updates) => {
          const prevEntry = editingEntry
          const type = prevEntry._type
          if (type === 'expense') await db.updateExpense(prevEntry.id, updates)
          else if (type === 'income') await db.updateIncome(prevEntry.id, updates)
          else await db.updateEvent(prevEntry.id, updates)
          await loadSpendOverview()
          await refreshRecent()
          const revert = {}
          for (const key of Object.keys(updates)) revert[key] = prevEntry[key]
          showToast('Entry updated', 'success', {
            label: 'UNDO',
            onClick: async () => {
              if (type === 'expense') await db.updateExpense(prevEntry.id, revert)
              else if (type === 'income') await db.updateIncome(prevEntry.id, revert)
              else await db.updateEvent(prevEntry.id, revert)
              await loadSpendOverview()
              await refreshRecent()
            },
          })
        }}
        onDelete={async () => {
          const prevEntry = editingEntry
          const type = prevEntry._type
          if (type === 'expense') await db.deleteExpense(prevEntry.id)
          else if (type === 'income') await db.deleteIncome(prevEntry.id)
          else await db.deleteEvent(prevEntry.id)
          setEditingEntry(null)
          await loadSpendOverview()
          await refreshRecent()
          showToast('Entry deleted', 'success', {
            label: 'UNDO',
            onClick: async () => {
              if (type === 'expense') await db.addExpense(prevEntry)
              else if (type === 'income') await db.addIncome(prevEntry)
              else await db.addEvent(prevEntry)
              await loadSpendOverview()
              await refreshRecent()
            },
          })
        }}
      />
    )}

      {amountChip && (
        <Sheet
          title={`Log ${amountChip.label}`}
          onClose={() => setAmountChip(null)}
          className="sheet-quicklog"
          footer={
            <>
              <button className="sheet-cancel" onClick={() => setAmountChip(null)}>Cancel</button>
              <button
                className="sheet-save"
                disabled={!amountVal || parseFloat(amountVal) <= 0}
                style={{ opacity: (!amountVal || parseFloat(amountVal) <= 0) ? 0.5 : 1 }}
                onClick={handleLogAmount}
              >
                Log
              </button>
            </>
          }
        >
          <AmountInput value={amountVal} onChange={setAmountVal} />
        </Sheet>
      )}
    </>
  )
}
