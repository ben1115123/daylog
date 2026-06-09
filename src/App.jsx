import { useState, useCallback, useEffect } from 'react'
import Home from './components/Home.jsx'
import Spending from './components/Spending.jsx'
import Calendar from './components/Calendar.jsx'
import Settings from './components/Settings.jsx'
import Insights from './components/Insights.jsx'
import Onboarding from './components/Onboarding.jsx'
import Toast from './components/Toast.jsx'
import { NavLogIcon, NavChartIcon, NavCalendarIcon, NavInsightsIcon } from './Icons.jsx'
import { db } from './db.js'
import supabase from './supabase.js'
import { formatRM } from './utils.js'
import './App.css'

async function checkRecurring(showToast) {
  const today = new Date()
  const todayStr   = today.toISOString().split('T')[0]
  const dayOfMonth = today.getDate()
  const monthPrefix = todayStr.slice(0, 7)

  const [recurring, allExpenses] = await Promise.all([db.getRecurring(), db.getExpenses()])
  const thisMonth = allExpenses.filter(e => e.date?.startsWith(monthPrefix))

  for (const item of recurring.filter(r => r.active && r.day_of_month <= dayOfMonth)) {
    const alreadyLogged = thisMonth.some(
      e => e.description === item.description && e.category === item.category
    )
    if (alreadyLogged) continue
    await db.addExpense({ description: item.description, amount: item.amount, category: item.category, date: todayStr })
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
  const [tab, setTab]               = useState('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast]           = useState(null)
  const [refresh, setRefresh]       = useState(0)
  const [isOffline, setIsOffline]   = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(
    !localStorage.getItem('dl_onboarded')
  )

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
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
  }, [showToast])

  useEffect(() => {
    if (!showOnboarding) checkRecurring(showToast)
  }, [showOnboarding, showToast])

  const handleOnboardingComplete = (name, income, budget) => {
    const now = new Date()
    db.saveSettings({ ...db.getSettings(), name, totalBudget: budget })
    if (income > 0) db.saveIncome(now.getFullYear(), now.getMonth(), income)
    localStorage.setItem('dl_onboarded', 'true')
    setShowOnboarding(false)
    setRefresh(r => r + 1)
  }

  const handleTabChange = (id) => { setTab(id); setSettingsOpen(false) }

  const tabs = [
    { id: 'home',     label: 'Log',      Icon: NavLogIcon },
    { id: 'spending', label: 'Spending', Icon: NavChartIcon },
    { id: 'calendar', label: 'Calendar', Icon: NavCalendarIcon },
    { id: 'insights', label: 'Insights', Icon: NavInsightsIcon },
  ]

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <div className="app">
      {isOffline && <div className="offline-badge">offline</div>}
      <div className="app-body">
        {tab === 'home'     && <Home     key={refresh} showToast={showToast} onLogged={onLogged} />}
        {tab === 'spending' && <Spending key={refresh} showToast={showToast} />}
        {tab === 'calendar' && <Calendar key={refresh} showToast={showToast} />}
        {tab === 'insights' && (
          settingsOpen
            ? <Settings key={refresh} showToast={showToast} onBack={() => setSettingsOpen(false)} />
            : <Insights key={refresh} showToast={showToast} onSettings={() => setSettingsOpen(true)} />
        )}
      </div>
      <nav className="bottom-nav">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item ${tab === id ? 'active' : ''}`}
            onClick={() => handleTabChange(id)}
            aria-label={label}
          >
            <span className="nav-icon"><Icon /></span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
