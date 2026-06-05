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
import { PRESETS } from './utils.js'
import './App.css'

function checkRecurring(showToast) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const dayOfMonth = today.getDate()
  const dayOfWeek  = today.getDay()
  const existing   = db.getExpenses().filter(e => e.date === todayStr)

  PRESETS.filter(p => p.recurring && p.amount && p.isExpense).forEach(preset => {
    const alreadyLogged = existing.some(
      e => e.description === preset.label && e.category === preset.category
    )
    if (alreadyLogged) return

    let due = false
    if (preset.recurring === 'monthly') due = dayOfMonth === (preset.recurringDay || 1)
    if (preset.recurring === 'weekly')  due = dayOfWeek  === (preset.recurringDay ?? 1)
    if (!due) return

    db.addExpense({ description: preset.label, amount: preset.amount, category: preset.category, date: todayStr })
    showToast(`Auto-logged: ${preset.label}`)
  })
}

export default function App() {
  const [tab, setTab]               = useState('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast]           = useState(null)
  const [refresh, setRefresh]       = useState(0)
  const [showOnboarding, setShowOnboarding] = useState(
    !localStorage.getItem('dl_onboarded')
  )

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const onLogged = useCallback(() => setRefresh(r => r + 1), [])

  useEffect(() => {
    if (!showOnboarding) checkRecurring(showToast)
  }, [showOnboarding])

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
