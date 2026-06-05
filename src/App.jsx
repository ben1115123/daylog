import { useState, useCallback } from 'react'
import Home from './components/Home.jsx'
import Spending from './components/Spending.jsx'
import Calendar from './components/Calendar.jsx'
import Settings from './components/Settings.jsx'
import Toast from './components/Toast.jsx'
import { NavLogIcon, NavChartIcon, NavCalendarIcon, NavSettingsIcon } from './Icons.jsx'
import './App.css'

export default function App() {
  const [tab, setTab] = useState('home')
  const [toast, setToast] = useState(null)
  const [refresh, setRefresh] = useState(0)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }, [])

  const onLogged = useCallback(() => {
    setRefresh(r => r + 1)
  }, [])

  const tabs = [
    { id: 'home',     label: 'Log',      Icon: NavLogIcon },
    { id: 'spending', label: 'Spending', Icon: NavChartIcon },
    { id: 'calendar', label: 'Calendar', Icon: NavCalendarIcon },
    { id: 'settings', label: 'More',     Icon: NavSettingsIcon },
  ]

  return (
    <div className="app">
      <div className="app-body">
        {tab === 'home'     && <Home     key={refresh} showToast={showToast} onLogged={onLogged} />}
        {tab === 'spending' && <Spending key={refresh} showToast={showToast} />}
        {tab === 'calendar' && <Calendar key={refresh} showToast={showToast} />}
        {tab === 'settings' && <Settings key={refresh} showToast={showToast} />}
      </div>
      <nav className="bottom-nav">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
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
