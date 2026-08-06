import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import Home from './components/Home.jsx'
import Settings from './components/Settings.jsx'
import Insights from './components/Insights.jsx'
import Onboarding from './components/Onboarding.jsx'
import Splash from './components/Splash.jsx'
import Toast from './components/Toast.jsx'
import { NavLogIcon, NavInsightsIcon, NavSettingsIcon } from './Icons.jsx'
import { db } from './db.js'
import supabase from './supabase.js'
import { formatRM } from './utils.js'
import { toISODate, monthRange, todayISO } from './lib/dates.js'
import './App.css'

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

async function checkRecurring(showToast) {
  /* Every value below comes from the same local-time source. Previously the
     "already logged this month?" window was local while the date stamped on the
     new row was UTC — at 03:xx KL on the 1st that queried August, found nothing,
     and wrote the row into July, so it re-fired on every app open. */
  const today      = new Date()
  const todayStr   = toISODate(today)
  const dayOfMonth = today.getDate()
  const { start: startDate, end: endDate } = monthRange(today.getFullYear(), today.getMonth())

  const recurring = await db.getRecurring()
  for (const item of recurring.filter(r => r.active && r.day_of_month <= dayOfMonth)) {
    const { count, error } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('description', item.description)
      .gte('date', startDate)
      .lte('date', endDate)
    console.log(`[daylog] recurring check "${item.description}" ${startDate}→${endDate}: count=${count} error=${error?.message ?? null}`)
    if (error || count === null || count > 0) continue
    await db.addExpense({ description: item.description, amount: item.amount, category: item.category, date: todayStr })
    showToast(`Auto-logged: ${item.description} ${formatRM(item.amount)}`)
  }

  const recurringIncome = await db.getRecurringIncome()
  for (const item of recurringIncome.filter(r => r.active && r.day_of_month <= dayOfMonth)) {
    const { count, error } = await supabase
      .from('income')
      .select('*', { count: 'exact', head: true })
      .eq('description', item.description)
      .gte('date', startDate)
      .lte('date', endDate)
    console.log(`[daylog] recurring income check "${item.description}" ${startDate}→${endDate}: count=${count} error=${error?.message ?? null}`)
    if (error || count === null || count > 0) continue
    await db.addIncome({ description: item.description, amount: item.amount, category: item.category, date: todayStr })
    showToast(`Auto-logged: ${item.description} ${formatRM(item.amount)}`)
  }
}

async function migrateFromLocalStorage(showToast) {
  if (localStorage.getItem('dl_migrated')) return
  const oldExpenses = JSON.parse(localStorage.getItem('dl_expenses') || 'null')
  const oldEvents   = JSON.parse(localStorage.getItem('dl_events')   || 'null')
  if (!oldExpenses?.length && !oldEvents?.length) {
    localStorage.setItem('dl_migrated', 'true')
    return
  }
  showToast('Importing your data to cloud...')
  try {
    if (oldExpenses?.length) {
      const rows = oldExpenses.map(e => ({
        description: e.description,
        amount:      e.amount,
        category:    e.category,
        date:        e.date,
        created_at:  e.createdAt || e.created_at || new Date().toISOString(),
      }))
      const { error } = await supabase.from('expenses').insert(rows)
      if (error) throw error
    }
    if (oldEvents?.length) {
      const rows = oldEvents.map(e => ({
        title:      e.title,
        date:       e.date,
        time:       e.time      || null,
        category:   e.category  || null,
        notes:      e.notes     || null,
        recurring:  e.recurring || null,
        created_at: e.createdAt || e.created_at || new Date().toISOString(),
      }))
      const { error } = await supabase.from('events').insert(rows)
      if (error) throw error
    }
    localStorage.removeItem('dl_expenses')
    localStorage.removeItem('dl_events')
    localStorage.setItem('dl_migrated', 'true')
    showToast('Data imported successfully')
  } catch {
    showToast('Import failed — data kept locally', 'error')
  }
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [tab, setTab]               = useState('home')
  const [activeTab, setActiveTab]   = useState('home')
  const [toast, setToast]           = useState(null)
  const [refresh, setRefresh]       = useState(0)
  const [isOffline, setIsOffline]   = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(null)
  const recurringChecked = useRef(false)
  const appRef = useRef(null)
  /* Callback ref, not useRef: the nav mounts only after both the splash and the
     onboarding check clear, so an effect keyed on state has to guess which state
     change made it appear (that guess was already wrong once — see 0bb907b).
     A callback ref fires exactly when the node mounts, so the measurement can
     never be skipped or run against a stale element. */
  const [navEl, setNavEl] = useState(null)

  const showToast = useCallback((msg, type = 'success', action) => {
    setToast({ msg, type, action })
    setTimeout(() => setToast(null), action ? 5000 : 3000)
  }, [])

  const onLogged = useCallback(() => setRefresh(r => r + 1), [])

  useEffect(() => {
    const handler = (e) => setIsOffline(e.detail)
    window.addEventListener('daylog:offline', handler)
    return () => window.removeEventListener('daylog:offline', handler)
  }, [])

  useEffect(() => {
    migrateFromLocalStorage(showToast)
    db.seedRecurring()
    db.seedRecurringIncome()
    db.isOnboarded().then(done => setShowOnboarding(!done))
  }, [showToast])

  useEffect(() => {
    if (showOnboarding !== false) return
    if (recurringChecked.current) return
    recurringChecked.current = true
    checkRecurring(showToast)
  }, [showOnboarding, showToast])

  /* Measures the real bottom-nav height into --tabbar-height, which every
     scroll container uses to reserve space for the fixed nav.
     useLayoutEffect, not useEffect: the first measurement must land before
     paint, otherwise the first frame renders against the 84px CSS fallback. */
  useLayoutEffect(() => {
    const target = appRef.current
    if (!navEl || !target) return

    let last = -1
    const apply = (reason) => {
      const h = navEl.getBoundingClientRect().height
      if (h <= 0) return
      if (import.meta.env.DEV) {
        const delta = last < 0 ? 'first measurement' : `delta ${(h - last).toFixed(2)}px`
        console.log(`[tabbar] ${reason}: ${h.toFixed(2)}px (${delta})`)
      }
      if (Math.abs(h - last) < 0.5) return
      last = h
      target.style.setProperty('--tabbar-height', `${h}px`)
    }

    apply('layout-effect')

    /* border-box: the nav's height moves with padding-bottom
       (max(env(safe-area-inset-bottom), 20px)), and a padding-only change
       leaves the content box — the ResizeObserver default — untouched. */
    const ro = new ResizeObserver(() => apply('resize-observer'))
    try { ro.observe(navEl, { box: 'border-box' }) }
    catch { ro.observe(navEl) }

    const onResize = () => apply('window-resize')
    const onOrientation = () => {
      apply('orientationchange')
      requestAnimationFrame(() => apply('orientationchange-raf'))
    }
    const onViewport = () => apply('visualviewport-resize')

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrientation)
    window.visualViewport?.addEventListener('resize', onViewport)

    /* Webfont swap can change the nav label's line box. */
    let cancelled = false
    document.fonts?.ready.then(() => { if (!cancelled) apply('fonts-ready') })

    return () => {
      cancelled = true
      ro.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrientation)
      window.visualViewport?.removeEventListener('resize', onViewport)
    }
  }, [navEl])

  const handleOnboardingComplete = (name, income, budget) => {
    db.saveSettings({ ...db.getSettings(), name, totalBudget: budget })
    if (income > 0) db.addIncome({
      description: 'Salary',
      amount: income,
      category: 'salary',
      date: todayISO(),
    })
    db.setOnboarded()
    setShowOnboarding(false)
    setRefresh(r => r + 1)
  }

  const [tabFading, setTabFading] = useState(false)
  const fadeTimer = useRef(null)

  /* Sequential fade rather than a true crossfade: a real crossfade needs both
     screens mounted at once, which fires both components' Supabase fetches on
     every tab press. At 180ms total the two read the same.

     activeTab (pill) and tab (rendered body) are deliberately separate: the
     pill jumps to the tapped id immediately so the tap feels acknowledged,
     while tab — and therefore the body content — only catches up once the
     fade-out finishes. The guard below compares against activeTab, not tab,
     so a rapid tap back to the tab that's still mid-fade-out cancels and
     reverses cleanly instead of no-op'ing against a body that hasn't moved
     yet. */
  const handleTabChange = (id) => {
    if (id === activeTab) return
    setActiveTab(id)
    if (prefersReducedMotion()) { setTab(id); return }
    clearTimeout(fadeTimer.current)
    setTabFading(true)
    fadeTimer.current = setTimeout(() => {
      setTab(id)
      setTabFading(false)
    }, 80)
  }

  useEffect(() => () => clearTimeout(fadeTimer.current), [])

  const tabs = [
    { id: 'home',     label: 'Log',      Icon: NavLogIcon },
    { id: 'insights', label: 'Insights', Icon: NavInsightsIcon },
    { id: 'settings', label: 'Settings', Icon: NavSettingsIcon },
  ]

  if (!splashDone) return <Splash onDone={() => setSplashDone(true)} />

  if (showOnboarding === null) {
    return (
      <div className="loading-wrap" style={{ height: '100dvh' }}>
        <div className="spinner"/>
      </div>
    )
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <div className="app" ref={appRef}>
      {isOffline && <div className="offline-badge">offline</div>}
      <div className={`app-body${tabFading ? ' tab-fading' : ''}`}>
        {tab === 'home'     && <Home     key={refresh} showToast={showToast} onLogged={onLogged} />}
        {tab === 'insights' && <Insights key={refresh} showToast={showToast} />}
        {tab === 'settings' && <Settings key={refresh} showToast={showToast} />}
      </div>
      <nav className="bottom-nav" ref={setNavEl}>
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item ${activeTab === id ? 'active' : ''}`}
            onClick={() => handleTabChange(id)}
            aria-label={label}
          >
            <span className="nav-icon"><Icon /></span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>
      {toast && <Toast msg={toast.msg} type={toast.type} action={toast.action} />}
    </div>
  )
}
