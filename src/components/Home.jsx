import { useState, useRef, useEffect, useCallback } from 'react'
import { parseInput } from '../ai.js'
import { db, computeRecentMonths } from '../db.js'
import { CAT_META, CATEGORIES, formatRM, formatRMParts, formatDate, formatTime } from '../utils.js'
import { MicIcon, SendIcon, CAT_ICONS, BackIcon, SyncFailedIcon } from '../Icons.jsx'
import { todayISO, shiftMonth } from '../lib/dates.js'
import { tempId, insertProvisional, commitProvisional, dropProvisional } from '../lib/optimistic.js'
import { undoTarget, UNDO_TIMED_OUT, UNDO_STALLED_MSG } from '../lib/undoDeadline.js'
import { beginFetch, markUndone, withoutUndone, releaseUndone } from '../lib/undoneRows.js'
import DLMark from './DLMark.jsx'
import Sheet from './Sheet.jsx'
import Calendar from './Calendar.jsx'
import EditEntrySheet from './EditEntrySheet.jsx'
import AmountInput from './AmountInput.jsx'
import Skeleton from './Skeleton.jsx'
import { DonutChart } from './Spending.jsx'
import { useStaggeredEntries } from '../hooks/useStaggeredEntries.js'
import { useCountUp } from '../hooks/useCountUp.js'
import useDragDismiss from '../hooks/useDragDismiss.js'
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
    /* Must outlast the .closing transition in Home.css (280ms). */
    setTimeout(() => setPhase('closed'), 300)
  }, [])

  const { handlers: dragHandlers, offset: dragOffset, dragging } = useDragDismiss({
    axis: 'y',
    threshold: 80,
    onDismiss: close,
  })

  let overlayStyle = null
  if (phase === 'opening') {
    overlayStyle = { top: rectRef.current.top, left: rectRef.current.left, width: rectRef.current.width, height: rectRef.current.height, borderRadius: '16px', transition: 'none' }
  } else if (phase === 'open') {
    overlayStyle = {
      top: 0, left: 0, width: '100%', height: '100%', borderRadius: 0,
      transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
      transition: dragging ? 'none' : undefined,
    }
  } else if (phase === 'closing') {
    overlayStyle = { top: rectRef.current.top, left: rectRef.current.left, width: rectRef.current.width, height: rectRef.current.height, borderRadius: '16px' }
  }

  return { ref, phase, open, close, overlayStyle, dragHandlers, dragOffset }
}

/* ── Spending summary mini content (closed card + pinned overlay state) ── */
function SpendMini({ data, label, budget }) {
  const animTotal = useCountUp(data ? data.total : 0)
  if (!data) return (
    <div className="spend-mini">
      <div className="spend-mini-label"><Skeleton w={64} h={15} /></div>
      <div className="big-number spend-mini-amount"><Skeleton w={150} h={40} /></div>
      <div className="spend-mini-track"><Skeleton w="100%" h={4} r={99} /></div>
      <div className="spend-mini-foot"><Skeleton w={100} h={19.5} /></div>
    </div>
  )
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

/* Both halves of each pair together: an UNDO has to reverse whichever add it
   started, and pairing them here is what lets the send loop stay generic over
   the three entry types the parser can return. */
const ADDERS = {
  expense: { add: d => db.addExpense(d), remove: id => db.deleteExpense(id) },
  event:   { add: d => db.addEvent(d),   remove: id => db.deleteEvent(id) },
  income:  { add: d => db.addIncome(d),  remove: id => db.deleteIncome(id) },
}

/* `onLogged` is deliberately never called from this component any more.
 *
 * App.jsx implements it as `setRefresh(r => r + 1)` and renders us as
 * `<Home key={refresh}>` — calling it does not refresh Home, it *remounts*
 * Home. That is fatal to everything below: the provisional row is thrown away
 * the instant it is inserted, the UNDO closure is left holding setters from a
 * destroyed instance, and `useCountUp` restarts from 0 so the spending total
 * snaps up from zero instead of easing from the old figure to the new one.
 *
 * Everything it used to buy us is now done locally and precisely:
 * `refreshRecent()` for the list, `loadSpendOverview()` for the total. The
 * prop is kept on the signature so App's contract is unchanged; the other two
 * tabs are conditionally rendered and so remount on tab switch regardless.
 */
export default function Home({ showToast, onLogged }) { // eslint-disable-line no-unused-vars
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

    const fetchSeq = beginFetch()
    const [thisExp, thisInc, lastExp, lastInc, allExpRaw, allIncRaw, recurring] = await Promise.all([
      db.getMonthExpenses(y, m),
      db.getMonthIncome(y, m),
      db.getMonthExpenses(py, pm),
      db.getMonthIncome(py, pm),
      db.getExpenses(),
      db.getIncome(),
      db.getRecurring(),
    ])

    setCommittedTotal(recurring.filter(r => r.active).reduce((s, r) => s + (r.amount || 0), 0))

    /* The undo race reaches the total as well as the list: a fetch issued
       before the UNDO's DELETE lands still counts the row, so the spending
       card counts *up* to include an entry the user has just undone and then
       counts back down a couple of seconds later. Same suppression, same
       reason — see undoneRows.js. */
    const allExp = withoutUndone(allExpRaw, fetchSeq)
    const allInc = withoutUndone(allIncRaw, fetchSeq)

    const buildTab = (fetchedExp, fetchedInc) => {
      const exp = withoutUndone(fetchedExp, fetchSeq)
      const inc = withoutUndone(fetchedInc, fetchSeq)
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

  /* `authoritative` names the ids this particular refetch is allowed to settle:
     it is passed only by an UNDO handler whose DELETE has already resolved, so
     this fetch — and every fetch issued after it — tells the truth about them:
     gone if the delete worked, still there if it silently did not. Released
     before the result is applied, so a failed delete puts the row back on
     screen rather than hiding it forever. See undoneRows.js. */
  const refreshRecent = useCallback(async ({ authoritative } = {}) => {
    const fetchSeq = beginFetch()
    /* Released at issue time, not after the await. The caller only passes
       `authoritative` once its DELETE has settled, so these ids are already
       decided — and holding the release until this fetch's four legs return
       (~5s throttled) would wrongly suppress any shorter fetch issued during
       that window, which has a higher seq and is entitled to the row. */
    if (authoritative?.length) releaseUndone(fetchSeq, authoritative)
    const [expRaw, evtRaw, incRaw, evtStripRaw] = await Promise.all([
      db.getExpenses(),
      db.getUpcomingEvents(3),
      db.getIncome(),
      db.getUpcomingEvents(5),
    ])

    /* Filtered on the way out, against the number taken on the way in: the
       fetch this guards against was issued before the row was undone and comes
       back after. */
    const exp      = withoutUndone(expRaw, fetchSeq)
    const evt      = withoutUndone(evtRaw, fetchSeq)
    const inc      = withoutUndone(incRaw, fetchSeq)
    const evtStrip = withoutUndone(evtStripRaw, fetchSeq)

    const items = [
      ...exp.slice(0, 4).map(e => ({ ...e, _type: 'expense' })),
      ...evt.map(e => ({ ...e, _type: 'event' })),
      ...inc.slice(0, 2).map(e => ({ ...e, _type: 'income' })),
    ]
      .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))
      .slice(0, 6)
    /* A provisional row is not in the database yet, so replacing the list
       wholesale would drop it and it would pop back a moment later when its
       write commits. Keep every row still carrying a pending promise, ahead of
       the fetched ones — that is where the newest entry belongs anyway.
       Committed rows have no `pending` and so are not kept twice: by then the
       fetch returns them itself.

       `upcoming` gets no such guard: nothing inserts a provisional row into
       it. Events logged here go into `recent` only, and the strip catches up
       on the refetch that follows the commit.

       All three setters stay in one synchronous block after the single await,
       so React still batches them into a single render — the skeletons must
       not clear a tick before the rows they are standing in for. */
    setRecent(prev => {
      const fetchedIds = new Set(items.map(it => it.id))
      const inFlight = prev.filter(it => it.pending && !fetchedIds.has(it.id))
      return [...inFlight, ...items]
    })
    setUpcoming(evtStrip)
    setLoadingData(false)
  }, [])

  useEffect(() => { refreshRecent() }, [refreshRecent])

  /* Apple Calendar sync resolves a second or two after the event is saved, so
     patch the pill in place rather than waiting for the next refresh. */
  useEffect(() => {
    const onSync = e => {
      const { id, error, action } = e.detail
      /* A delete outcome has no row to land on — App raises a toast for it. */
      if (action === 'delete') return
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

    /* The parse gets its own try: only it can fail with "check API key". The
       writes below report their own failures, and folding them in here made a
       dropped Supabase insert look like a bad API key. */
    let parsed
    try {
      parsed = await parseInput(input)
    } catch {
      showToast('Parse failed — check API key', 'error')
      setLoading(false)
      return
    }

    /* The entry is unknown until the parse resolves, so the optimism starts
       here — what it saves is the database round trip, not the parse. */
    const created = []
    for (const type of ['expense', 'event', 'income']) {
      const draft = parsed?.[type]
      if (!draft) continue
      const id = tempId()
      const pending = ADDERS[type].add(draft)
      const provisional = { ...draft, id, pending, _type: type, created_at: new Date().toISOString() }
      created.push({ type, id, provisional })
      setRecent(list => insertProvisional(list, provisional))
    }

    if (created.length === 0) { showToast('Could not parse that', 'error'); setLoading(false); return }

    /* The burst and the released input are feedback for the tap, not for the
       database — both fire now, while the writes are still in flight. */
    triggerBurst()
    setLoading(false)

    const msg =
      created.length === 2 ? 'Logged expense + event' :
      created[0].type === 'expense' ? 'Expense logged' :
      created[0].type === 'income'  ? 'Income logged' : 'Event added'

    showToast(msg, 'success', {
      label: 'UNDO',
      onClick: async () => {
        const authoritative = []
        for (const { type, id, provisional } of created) {
          /* Resolve before deleting — UNDO can land while the write is still
             in flight, when the only id we have is one Supabase has never
             seen. Deleting that would clear the row from the list and leave
             the real one orphaned in the database. */
          const realId = await undoTarget(provisional)
          if (realId === UNDO_TIMED_OUT) { showToast(UNDO_STALLED_MSG, 'error'); continue }
          /* Suppress before dropping. The refetch this handler's own commit
             path started is already in flight and still counts this row; left
             alone it lands in a couple of seconds and puts the row back. */
          markUndone(id, realId)
          authoritative.push(id, realId)
          /* Drop by both ids: the row still carries its temp id if the write
             has not landed, and its real one if the commit below already
             swapped it in. `dropProvisional(list, null)` matches nothing, so
             the null case costs nothing. */
          setRecent(list => dropProvisional(dropProvisional(list, id), realId))
          /* The Upcoming strip needs the same drop. It is otherwise only
             corrected by the refetch below, which now waits on the CalDAV
             delete — so an undone event would sit there, tappable, for ~2s. */
          if (type === 'event') {
            setUpcoming(list => dropProvisional(dropProvisional(list, id), realId))
          }
          try {
            if (realId) await ADDERS[type].remove(realId)
          } catch (err) {
            /* db.js swallows delete errors today, so this is belt and braces —
               but a throw here must not skip the release below and strand the
               row in a suppressed state no refetch can clear. */
            console.error('[daylog] undo delete failed:', err)
          }
        }
        await refreshRecent({ authoritative })
        loadSpendOverview()
      },
    })

    /* Mapped rather than looped so every handler attaches in this tick — an
       await-in-a-loop leaves the later promises unhandled until their turn
       comes, and a rejection in that window is an unhandled rejection. */
    await Promise.all(created.map(async ({ id, provisional }) => {
      try {
        const row = await provisional.pending
        /* A resolved-but-empty result means no row was created. Committing it
           would leave the entry holding its temp id with `pending` stripped,
           and a later UNDO would have nothing left to resolve — the orphan
           case. Take the drop path instead. */
        if (!row?.id) throw new Error('write returned no row')
        setRecent(list => commitProvisional(list, id, row))
      } catch (err) {
        console.error('[daylog] NLP write failed:', err)
        setRecent(list => dropProvisional(list, id))
        showToast('Could not save — try again', 'error')
      }
    }))

    /* Refetch only now that the writes have settled: it re-sorts and re-caps
       the list at 6, and picks a new event up into the Upcoming strip. Run
       before the commit it would have replaced the provisional row with a
       list that cannot contain it yet. */
    await refreshRecent()
    loadSpendOverview()
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
    const draft = {
      description: chip.label,
      amount,
      category: chip.category,
      date: todayISO(),
    }

    /* Show it before the write, not after. The pending promise rides along on
       the row so an UNDO tapped in the next second can wait for the real id
       instead of deleting a temp one Supabase has never seen. */
    const id = tempId()
    const pending = ADDERS.expense.add(draft)
    const provisional = { ...draft, id, pending, _type: 'expense', created_at: new Date().toISOString() }
    setRecent(list => insertProvisional(list, provisional))
    setAmountChip(null)

    showToast(`${chip.label} — ${formatRM(amount)}`, 'success', {
      label: 'UNDO',
      onClick: async () => {
        const realId = await undoTarget(provisional)
        if (realId === UNDO_TIMED_OUT) { showToast(UNDO_STALLED_MSG, 'error'); return }
        /* Suppress before dropping — the refetch below this handler is already
           in flight and still counts this row. See undoneRows.js. */
        markUndone(id, realId)
        setRecent(list => dropProvisional(dropProvisional(list, id), realId))
        try {
          if (realId) await ADDERS.expense.remove(realId)
        } catch (err) {
          console.error('[daylog] undo delete failed:', err)
        }
        await refreshRecent({ authoritative: [id, realId] })
        loadSpendOverview()
      },
    })

    try {
      const row = await pending
      if (!row?.id) throw new Error('write returned no row')
      setRecent(list => commitProvisional(list, id, row))
    } catch (err) {
      console.error('[daylog] quick-log write failed:', err)
      setRecent(list => dropProvisional(list, id))
      showToast('Could not save — try again', 'error')
    }
    await refreshRecent()
    loadSpendOverview()
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
          className={`card upcoming-strip${!loadingData && upcoming.length === 0 ? ' upcoming-strip-empty' : ''}`}
          style={{ visibility: cal.phase === 'closed' ? 'visible' : 'hidden' }}
          onClick={cal.phase === 'closed' ? cal.open : undefined}
        >
          {loadingData ? (
            /* The strip scrolls horizontally, so its height is one pill's
               height regardless of how many pills land — three shells is
               simply what fits the 390px viewport, not a count guess.
               Bar heights are the real line boxes: the global line-height is
               1.5, so .upcoming-pill-date's 9px renders 13.5px tall and
               .upcoming-pill-title's 13px renders 19.5px. Wrapping the bars in
               the real classes lets the date's own margin-bottom do the
               spacing instead of us re-deriving it. */
            <div className="upcoming-strip-row">
              {[0, 1, 2].map(i => (
                <div key={i} className="upcoming-pill">
                  <div className="upcoming-pill-date"><Skeleton w={42} h={13.5} /></div>
                  <div className="upcoming-pill-title"><Skeleton w={78} h={19.5} /></div>
                </div>
              ))}
            </div>
          ) : upcoming.length === 0 ? (
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
          <div className="card">
            {/* refreshRecent caps `recent` at 6 (.slice(0, 6)) — matching that
                cap here, rather than an arbitrary smaller count, is what keeps
                this zero-shift once real rows land. */}
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`entry-row${i < 5 ? ' bordered' : ''}`}>
                <Skeleton w={30} h={30} />
                <div className="entry-body">
                  <Skeleton w="55%" h={21} />
                  <Skeleton w="30%" h={16.5} style={{ marginTop: 2 }} />
                </div>
              </div>
            ))}
          </div>
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
          <div className="overlay-drag-region" {...spend.dragHandlers}>
            <button className="spend-back" onClick={spend.close}><BackIcon /> back</button>
          </div>

          {(() => {
            const data = spendTabs?.[spendTab]
            /* This branch is unreachable in the brief's description ("upcoming
               pills") — that's a different part of the screen with no loading
               state of its own. This is the real `.loading-wrap` that lived at
               this line: the per-tab data inside the spending overlay. See the
               task report for the reasoning. */
            if (!data) return (
              <>
                <div className="spend-overlay-header">
                  <div className="big-number spend-overlay-amount"><Skeleton w={170} h={40} /></div>
                  <div className="spend-overlay-saved"><Skeleton w={110} h={18} /></div>
                </div>

                <div className="spend-tabs">
                  {SPEND_TABS.map(([key]) => (
                    <div key={key} className="spend-tab"><Skeleton w="100%" h={14} /></div>
                  ))}
                </div>

                <div className="spend-overlay-donut">
                  <Skeleton w={150} h={150} r={75} />
                </div>

                {/* Category count varies month to month (0 to ~18) — this
                    can't be pixel-matched the way the other three skeletons
                    are. 5 reflects a representative category count; see the
                    task report for the residual layout-shift risk this
                    carries when a month's category count differs. */}
                <div className="spend-overlay-bars">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="spend-bar-row">
                      <div className="spend-bar-label"><Skeleton w={70} h={18} /></div>
                      <div className="spend-bar-track"><Skeleton w="100%" h={5} r={99} /></div>
                      <Skeleton w={50} h={11} />
                    </div>
                  ))}
                </div>

                <div className="spend-stat-grid">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="spend-stat-cell">
                      <div className="spend-stat-label"><Skeleton w={50} h={13.5} /></div>
                      <div className="spend-stat-val"><Skeleton w={64} h={27} /></div>
                      {/* Matches "Biggest", the one stat cell with a sub-line
                          when the month has at least one expense — mirrored
                          here so the grid's first row doesn't grow when real
                          data lands. */}
                      {i === 0 && <div className="spend-stat-sub"><Skeleton w={70} h={15} /></div>}
                    </div>
                  ))}
                </div>
              </>
            )
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
          <div className="overlay-drag-region" {...cal.dragHandlers}>
            <button className="cal-back" onClick={cal.close}><BackIcon /> back</button>
          </div>
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
