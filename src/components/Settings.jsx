import { useState } from 'react'
import { db, DEFAULT_BUDGETS } from '../db.js'
import { CATEGORIES, CAT_META } from '../utils.js'
import { CAT_ICONS, BackIcon } from '../Icons.jsx'
import './Settings.css'

export default function Settings({ showToast, onBack }) {
  const [settings, setSettings] = useState(db.getSettings())
  const [budgets, setBudgets] = useState(db.getBudgets())
  const [apiKey, setApiKey] = useState(localStorage.getItem('dl_openrouter_key') || '')

  const saveSettings = () => {
    db.saveSettings(settings)
    db.saveBudgets(budgets)
    if (apiKey) localStorage.setItem('dl_openrouter_key', apiKey)
    showToast('Settings saved')
  }

  const clearData = () => {
    if (confirm('Clear ALL data? This cannot be undone.')) {
      localStorage.clear()
      showToast('Data cleared')
      setTimeout(() => window.location.reload(), 500)
    }
  }

  const exportData = () => {
    const data = { expenses: db.getExpenses(), events: db.getEvents(), exported: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `daylog-export-${new Date().toISOString().split('T')[0]}.json`; a.click()
    showToast('Data exported')
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-header-row" style={{ marginBottom: 0 }}>
          {onBack && (
            <button className="back-btn" onClick={onBack} aria-label="Back">
              <BackIcon />
              <span>Back</span>
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div className="screen-label">Preferences</div>
            <div className="screen-heading">Settings</div>
          </div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 20 }}>
        <div className="section-label">Profile</div>
        <div className="card settings-card">
          <div className="setting-row bordered">
            <label className="setting-label">Name</label>
            <input
              className="setting-input"
              value={settings.name}
              onChange={e => setSettings(s => ({ ...s, name: e.target.value }))}
              placeholder="Your name"
            />
          </div>
          <div className="setting-row">
            <label className="setting-label">Monthly budget</label>
            <div className="setting-right">
              <span className="setting-unit">RM</span>
              <input
                className="setting-input num"
                type="number"
                value={settings.totalBudget}
                onChange={e => setSettings(s => ({ ...s, totalBudget: +e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 20 }}>
        <div className="section-label">Category budgets</div>
        <div className="card settings-card">
          {CATEGORIES.map((cat, i) => {
            const meta = CAT_META[cat]
            const Icon = CAT_ICONS[cat]
            return (
              <div key={cat} className={`setting-row ${i < CATEGORIES.length - 1 ? 'bordered' : ''}`}>
                <label className="setting-label">
                  <span className="setting-cat-icon" style={{ color: meta.color, background: meta.color + '18' }}>
                    {Icon && <Icon size={13} />}
                  </span>
                  {meta.label}
                </label>
                <div className="setting-right">
                  <span className="setting-unit">RM</span>
                  <input
                    className="setting-input num"
                    type="number"
                    value={budgets[cat]}
                    onChange={e => setBudgets(b => ({ ...b, [cat]: +e.target.value }))}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="section" style={{ marginTop: 20 }}>
        <div className="section-label">OpenRouter API key</div>
        <div className="card settings-card">
          <div className="setting-row">
            <input
              className="setting-input api-key"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-or-..."
            />
          </div>
        </div>
        <p className="setting-hint">Free key at openrouter.ai</p>
      </div>

      <div className="section" style={{ marginTop: 20 }}>
        <button className="save-btn" onClick={saveSettings}>Save settings</button>
      </div>

      <div className="section" style={{ marginTop: 32 }}>
        <div className="section-label">Data</div>
        <div className="card settings-card">
          <div className="setting-row bordered">
            <button className="data-btn" onClick={exportData}>Export data</button>
            <span className="setting-hint-inline">JSON backup</span>
          </div>
          <div className="setting-row">
            <button className="data-btn danger" onClick={clearData}>Clear all data</button>
            <span className="setting-hint-inline" style={{ color: 'var(--red)' }}>Cannot undo</span>
          </div>
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  )
}
