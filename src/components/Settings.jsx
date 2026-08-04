import { useState, useEffect, useMemo } from 'react'
import { db, DEFAULT_BUDGETS } from '../db.js'
import supabase from '../supabase.js'
import { CATEGORIES, CAT_META, INCOME_CATEGORIES, formatRM } from '../utils.js'
import { CAT_ICONS, BackIcon, PlusIcon } from '../Icons.jsx'
import { todayISO } from '../lib/dates.js'
import DLMark from './DLMark.jsx'
import Sheet from './Sheet.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import AmountInput from './AmountInput.jsx'
import CategoryChipRow from './CategoryChipRow.jsx'
import './Settings.css'

/* ── Add recurring form (bottom sheet) ───────────────── */
function AddRecurringForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    description: '', amount: '', category: 'subscription', day_of_month: '1',
  })
  const canSave = form.description.trim() && form.amount && form.day_of_month

  return (
    <Sheet
      title="New recurring expense"
      onClose={onCancel}
      footer={
        <>
          <button className="sheet-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="sheet-save"
            disabled={!canSave}
            style={{ opacity: canSave ? 1 : 0.5 }}
            onClick={() => onSave({
              description: form.description.trim(),
              amount:      parseFloat(form.amount) || 0,
              category:    form.category,
              day_of_month: parseInt(form.day_of_month) || 1,
            })}
          >
            Save
          </button>
        </>
      }
    >
      <AmountInput
        value={form.amount}
        onChange={v => setForm(f => ({ ...f, amount: v }))}
      />
      <div>
        <div className="sheet-field-label">Description</div>
        <input
          className="sheet-input"
          placeholder="e.g. Netflix, Gym, Rent"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div>
        <div className="sheet-field-label">Day of month</div>
        <input
          className="sheet-input"
          type="number"
          min="1" max="31"
          placeholder="1"
          value={form.day_of_month}
          onChange={e => setForm(f => ({ ...f, day_of_month: e.target.value }))}
          inputMode="numeric"
        />
      </div>
      <div>
        <div className="sheet-field-label">Category</div>
        <CategoryChipRow
          categories={CATEGORIES}
          meta={CAT_META}
          icons={CAT_ICONS}
          value={form.category}
          onChange={category => setForm(f => ({ ...f, category }))}
        />
      </div>
    </Sheet>
  )
}

/* ── Add recurring income form (bottom sheet) ─────────── */
function AddRecurringIncomeForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    description: '', amount: '', category: 'salary', day_of_month: '1',
  })
  const canSave = form.description.trim() && form.amount && form.day_of_month

  return (
    <Sheet
      title="New recurring income"
      onClose={onCancel}
      footer={
        <>
          <button className="sheet-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="sheet-save"
            disabled={!canSave}
            style={{ opacity: canSave ? 1 : 0.5 }}
            onClick={() => onSave({
              description: form.description.trim(),
              amount:       parseFloat(form.amount) || 0,
              category:     form.category,
              day_of_month: parseInt(form.day_of_month) || 1,
            })}
          >
            Save
          </button>
        </>
      }
    >
      <AmountInput
        value={form.amount}
        onChange={v => setForm(f => ({ ...f, amount: v }))}
      />
      <div>
        <div className="sheet-field-label">Description</div>
        <input
          className="sheet-input"
          placeholder="e.g. Salary, Trading Profit"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div>
        <div className="sheet-field-label">Day of month</div>
        <input
          className="sheet-input"
          type="number"
          min="1" max="31"
          placeholder="1"
          value={form.day_of_month}
          onChange={e => setForm(f => ({ ...f, day_of_month: e.target.value }))}
          inputMode="numeric"
        />
      </div>
      <div>
        <div className="sheet-field-label">Category</div>
        <CategoryChipRow
          categories={INCOME_CATEGORIES}
          meta={CAT_META}
          icons={CAT_ICONS}
          value={form.category}
          onChange={category => setForm(f => ({ ...f, category }))}
        />
      </div>
    </Sheet>
  )
}

export default function Settings({ showToast, onBack }) {
  const [settings, setSettings]             = useState(db.getSettings())
  const [budgets, setBudgets]               = useState(db.getBudgets())
  const [apiKey, setApiKey]                 = useState(localStorage.getItem('dl_anthropic_key') || '')
  const [recurringList, setRecurringList]   = useState([])
  const [recurringOpen, setRecurringOpen]   = useState(false)
  const [recurringIncomeList, setRecurringIncomeList]   = useState([])
  const [recurringIncomeOpen, setRecurringIncomeOpen]   = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen]         = useState(false)

  useEffect(() => {
    Promise.all([db.getRecurring(), db.getRecurringIncome()]).then(([rec, recInc]) => {
      setRecurringList(rec)
      setRecurringIncomeList(recInc)
    })
  }, [])

  const activeCommitted = useMemo(
    () => recurringList.filter(r => r.active).reduce((s, r) => s + (r.amount || 0), 0),
    [recurringList]
  )

  const activeIncomeTotal = useMemo(
    () => recurringIncomeList.filter(r => r.active).reduce((s, r) => s + (r.amount || 0), 0),
    [recurringIncomeList]
  )

  const saveSettings = () => {
    db.saveSettings(settings)
    db.saveBudgets(budgets)
    if (apiKey) localStorage.setItem('dl_anthropic_key', apiKey)
    showToast('Settings saved')
  }

  const clearData = async () => {
    setClearConfirmOpen(false)
    try {
      await Promise.all([
        supabase.from('expenses').delete().not('id', 'is', null),
        supabase.from('events').delete().not('id', 'is', null),
        supabase.from('recurring_expenses').delete().not('id', 'is', null),
        supabase.from('income').delete().not('id', 'is', null),
        supabase.from('recurring_income').delete().not('id', 'is', null),
      ])
    } catch {}
    localStorage.clear()
    showToast('Data cleared')
    setTimeout(() => window.location.reload(), 500)
  }

  const exportData = async () => {
    const [expenses, events, income] = await Promise.all([db.getExpenses(), db.getEvents(), db.getIncome()])
    const data = { expenses, events, income, exported: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `daylog-export-${todayISO()}.json`; a.click()
    showToast('Data exported')
  }

  const handleAddRecurring = async (item) => {
    const added = await db.addRecurring(item)
    setRecurringList(list => [...list, added].sort((a, b) => a.day_of_month - b.day_of_month))
    setRecurringOpen(false)
    showToast('Recurring expense added')
  }

  const handleToggleRecurring = async (id, currentActive) => {
    await db.updateRecurring(id, { active: !currentActive })
    setRecurringList(list => list.map(item => item.id === id ? { ...item, active: !currentActive } : item))
  }

  const handleAddRecurringIncome = async (item) => {
    const added = await db.addRecurringIncome(item)
    setRecurringIncomeList(list => [...list, added].sort((a, b) => a.day_of_month - b.day_of_month))
    setRecurringIncomeOpen(false)
    showToast('Recurring income added')
  }

  const handleToggleRecurringIncome = async (id, currentActive) => {
    await db.updateRecurringIncome(id, { active: !currentActive })
    setRecurringIncomeList(list => list.map(item => item.id === id ? { ...item, active: !currentActive } : item))
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
            <div className="screen-dl-mark"><DLMark /></div>
            <div className="screen-label">Preferences</div>
            <div className="screen-heading">Settings</div>
          </div>
        </div>
      </div>

      {/* ── Profile ──────────────────────────────────── */}
      <div className="section" >
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
                /* keep the field clearable while typing — db.saveSettings
                   restores the default if it is left empty or zero */
                onChange={e => setSettings(s => ({
                  ...s, totalBudget: e.target.value === '' ? '' : +e.target.value,
                }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Recurring expenses ────────────────────────── */}
      <div className="section" >
        <div className="section-label">Recurring Expenses</div>
        {recurringList.length > 0 && (
          <div className="recurring-committed-total">
            <span>{formatRM(activeCommitted)}</span> committed monthly
          </div>
        )}
        <div className="card settings-card">
          {recurringList.length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              no recurring expenses
            </div>
          ) : (
            recurringList.map((item, i) => {
              const meta = CAT_META[item.category]
              const Icon = CAT_ICONS[item.category]
              return (
                <div
                  key={item.id}
                  className={`recurring-row ${!item.active ? 'inactive' : ''} ${i < recurringList.length - 1 ? 'bordered' : ''}`}
                >
                  <span
                    className="recurring-icon-wrap"
                    style={{ color: meta?.color, background: (meta?.color || '#fff') + '18' }}
                  >
                    {Icon && <Icon size={13} />}
                  </span>
                  <div className="recurring-body">
                    <div className="recurring-title">{item.description}</div>
                    <div className="recurring-sub">day {item.day_of_month} · {meta?.label}</div>
                  </div>
                  <div className="recurring-amount">{formatRM(item.amount)}</div>
                  <button
                    className={`recurring-toggle-btn ${!item.active ? 'inactive' : ''}`}
                    onClick={() => handleToggleRecurring(item.id, item.active)}
                    title={item.active ? 'Disable' : 'Re-enable'}
                    aria-label={item.active ? 'Disable' : 'Re-enable'}
                  >
                    {item.active ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>
        <button className="add-recurring-btn" onClick={() => setRecurringOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add recurring expense
        </button>
      </div>

      {/* ── Recurring income ─────────────────────────── */}
      <div className="section" >
        <div className="section-label">Recurring Income</div>
        {recurringIncomeList.length > 0 && (
          <div className="recurring-committed-total">
            Total incoming: <span>{formatRM(activeIncomeTotal)}</span>/month
          </div>
        )}
        <div className="card settings-card">
          {recurringIncomeList.length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              no recurring income
            </div>
          ) : (
            recurringIncomeList.map((item, i) => {
              const meta = CAT_META[item.category]
              return (
                <div
                  key={item.id}
                  className={`recurring-row ${!item.active ? 'inactive' : ''} ${i < recurringIncomeList.length - 1 ? 'bordered' : ''}`}
                >
                  <span
                    className="recurring-icon-wrap"
                    style={{ color: meta?.color, background: (meta?.color || '#fff') + '18' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                      <polyline points="17 6 23 6 23 12"/>
                    </svg>
                  </span>
                  <div className="recurring-body">
                    <div className="recurring-title">{item.description}</div>
                    <div className="recurring-sub">day {item.day_of_month} · {meta?.label}</div>
                  </div>
                  <div className="recurring-amount">{formatRM(item.amount)}</div>
                  <button
                    className={`recurring-toggle-btn ${!item.active ? 'inactive' : ''}`}
                    onClick={() => handleToggleRecurringIncome(item.id, item.active)}
                    title={item.active ? 'Disable' : 'Re-enable'}
                    aria-label={item.active ? 'Disable' : 'Re-enable'}
                  >
                    {item.active ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>
        <button className="add-recurring-btn" onClick={() => setRecurringIncomeOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add recurring income
        </button>
      </div>

      {/* ── Category budgets ──────────────────────────── */}
      <div className="section" >
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

      {/* ── API key ───────────────────────────────────── */}
      <div className="section" >
        <div className="section-label">Anthropic API key</div>
        <div className="card settings-card">
          <div className="setting-row">
            <input
              className="setting-input api-key"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />
          </div>
        </div>
        <p className="setting-hint">Get a key at console.anthropic.com</p>
      </div>

      <div className="section" >
        <button className="save-btn" onClick={saveSettings}>Save settings</button>
      </div>

      {/* ── Data ─────────────────────────────────────── */}
      <div className="section" >
        <div className="section-label">Data</div>
        <div className="card settings-card">
          <div className="setting-row bordered">
            <button className="data-btn" onClick={exportData}>Export data</button>
            <span className="setting-hint-inline">JSON backup</span>
          </div>
          <div className="setting-row">
            <button className="data-btn danger" onClick={() => setClearConfirmOpen(true)}>Clear all data</button>
            <span className="setting-hint-inline" style={{ color: 'var(--red)' }}>Cannot undo</span>
          </div>
        </div>
      </div>

      {recurringOpen && (
        <AddRecurringForm
          onSave={handleAddRecurring}
          onCancel={() => setRecurringOpen(false)}
        />
      )}

      {recurringIncomeOpen && (
        <AddRecurringIncomeForm
          onSave={handleAddRecurringIncome}
          onCancel={() => setRecurringIncomeOpen(false)}
        />
      )}

      {clearConfirmOpen && (
        <ConfirmDialog
          title="Clear all data?"
          message="This cannot be undone."
          confirmLabel="Clear data"
          danger
          onConfirm={clearData}
          onCancel={() => setClearConfirmOpen(false)}
        />
      )}
    </div>
  )
}
