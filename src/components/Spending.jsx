import { useState, useRef, useEffect, useMemo } from 'react'
import { db, computeRecentMonths } from '../db.js'
import { CAT_META, CATEGORIES, formatRM, formatDate, monthLabel } from '../utils.js'
import { CAT_ICONS, SearchIcon, XIcon, PlusIcon } from '../Icons.jsx'
import Sheet from './Sheet.jsx'
import './Spending.css'

/* ── SVG donut chart ─────────────────────────────────── */
function DonutChart({ cats, total }) {
  const R = 52, CX = 72, CY = 72
  const CIRC = 2 * Math.PI * R
  const active = cats.filter(c => c.amount > 0)

  if (total === 0) return (
    <svg viewBox="0 0 144 144" width="150" height="150">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--bg4)" strokeWidth="15"/>
      <text x={CX} y={CY - 4} textAnchor="middle" style={{ fill: 'var(--text3)', fontFamily: 'JetBrains Mono', fontSize: 10 }}>spent</text>
      <text x={CX} y={CY + 14} textAnchor="middle" style={{ fill: 'var(--text2)', fontFamily: 'JetBrains Mono', fontSize: 14 }}>RM 0</text>
    </svg>
  )

  let cumAngle = 0
  return (
    <svg viewBox="0 0 144 144" width="150" height="150">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--bg4)" strokeWidth="15"/>
      {active.map((c, i) => {
        const pct = c.amount / total
        const len = pct * CIRC
        const start = cumAngle
        cumAngle += pct * 360
        return (
          <circle
            key={i}
            cx={CX} cy={CY} r={R}
            fill="none" stroke={c.color}
            strokeOpacity="0.9" strokeWidth="15" strokeLinecap="butt"
            strokeDasharray={`${len} ${CIRC}`}
            transform={`rotate(${start - 90}, ${CX}, ${CY})`}
          />
        )
      })}
      <text x={CX} y={CY - 5} textAnchor="middle" style={{ fill: 'var(--text3)', fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.04em' }}>spent</text>
      <text x={CX} y={CY + 13} textAnchor="middle" style={{ fill: 'var(--text)', fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 600 }}>{formatRM(total)}</text>
    </svg>
  )
}

/* ── Savings bar chart ───────────────────────────────── */
function SavingsBarChart({ months }) {
  const W = 300, H = 80
  const n = months.length
  if (!n) return null
  const maxAbs = Math.max(...months.map(m => Math.abs(m.saved)), 1)
  const barW = 32, gap = (W - n * barW) / (n + 1)

  return (
    <svg viewBox={`0 0 ${W} ${H + 28}`} width="100%" style={{ overflow: 'visible' }}>
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="var(--bg4)" strokeWidth="1"/>
      {months.map((m, i) => {
        const norm = m.saved / maxAbs
        const barH = Math.abs(norm) * (H / 2 - 4)
        const isPos = m.saved >= 0
        const x = gap + i * (barW + gap)
        const y = isPos ? H / 2 - barH : H / 2
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, 1)} rx="3"
              fill={isPos ? 'var(--accent)' : 'var(--red)'} opacity="0.75"/>
            <text x={x + barW / 2} y={H + 16} textAnchor="middle"
              style={{ fill: 'var(--text3)', fontFamily: 'JetBrains Mono', fontSize: 9 }}>
              {monthLabel(m.year, m.month)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── Inline edit form ────────────────────────────────── */
function EditExpenseForm({ expense, onSave, onCancel }) {
  const [form, setForm] = useState({
    description: expense.description || '',
    amount: expense.amount ?? '',
    category: expense.category || 'food',
    date: expense.date || '',
    notes: expense.notes || '',
  })

  return (
    <div className="edit-form">
      <input
        className="edit-input"
        placeholder="Description"
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
      />
      <div className="edit-row">
        <input
          className="edit-input edit-amount"
          type="number"
          placeholder="Amount"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          inputMode="decimal"
        />
        <select
          className="edit-select"
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{CAT_META[c]?.label}</option>
          ))}
        </select>
      </div>
      <div className="edit-row">
        <input
          className="edit-input edit-date"
          type="date"
          value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
        />
      </div>
      <input
        className="edit-input"
        placeholder="Notes (optional)"
        value={form.notes}
        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
      />
      <div className="edit-actions">
        <button className="edit-cancel" onClick={onCancel}>Cancel</button>
        <button
          className="edit-save"
          onClick={() => onSave({ ...form, amount: parseFloat(form.amount) || 0, notes: form.notes.trim() || null })}
        >
          Save
        </button>
      </div>
    </div>
  )
}

/* ── Add expense form (bottom sheet) ─────────────────── */
function AddExpenseForm({ defaultDate, onSave, onCancel }) {
  const [form, setForm] = useState({
    description: '', amount: '', category: 'food', date: defaultDate || '', notes: '',
  })
  const canSave = form.description.trim() && form.amount && form.date

  return (
    <>
      <div>
        <div className="sheet-field-label">Description</div>
        <input
          className="sheet-input"
          placeholder="What did you spend on?"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="sheet-row">
        <div>
          <div className="sheet-field-label">Amount (RM)</div>
          <input
            className="sheet-input"
            type="number"
            placeholder="0"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            inputMode="decimal"
          />
        </div>
        <div>
          <div className="sheet-field-label">Date</div>
          <input
            className="sheet-input"
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            style={{ colorScheme: 'dark' }}
          />
        </div>
      </div>
      <div>
        <div className="sheet-field-label">Category</div>
        <select
          className="sheet-select"
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{CAT_META[c]?.label}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="sheet-field-label">Notes (optional)</div>
        <input
          className="sheet-input"
          placeholder="Any extra context?"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />
      </div>
      <div className="sheet-actions">
        <button className="sheet-cancel" onClick={onCancel}>Cancel</button>
        <button
          className="sheet-save"
          disabled={!canSave}
          style={{ opacity: canSave ? 1 : 0.5 }}
          onClick={() => onSave({
            description: form.description.trim(),
            amount: parseFloat(form.amount) || 0,
            category: form.category,
            date: form.date,
            notes: form.notes.trim() || null,
          })}
        >
          Save
        </button>
      </div>
    </>
  )
}

/* ── Add income form (bottom sheet) ──────────────────── */
function AddIncomeForm({ defaultDate, onSave, onCancel }) {
  const [form, setForm] = useState({
    description: '', amount: '', category: 'salary', date: defaultDate || '', notes: '',
  })
  const canSave = form.description.trim() && form.amount && form.date

  return (
    <>
      <div>
        <div className="sheet-field-label">Description</div>
        <input
          className="sheet-input"
          placeholder="e.g. Salary, Trading profit"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="sheet-row">
        <div>
          <div className="sheet-field-label">Amount (RM)</div>
          <input
            className="sheet-input"
            type="number"
            placeholder="0"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            inputMode="decimal"
          />
        </div>
        <div>
          <div className="sheet-field-label">Date</div>
          <input
            className="sheet-input"
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            style={{ colorScheme: 'dark' }}
          />
        </div>
      </div>
      <div>
        <div className="sheet-field-label">Category</div>
        <select
          className="sheet-select"
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        >
          <option value="salary">Salary</option>
          <option value="trading">Trading</option>
        </select>
      </div>
      <div>
        <div className="sheet-field-label">Notes (optional)</div>
        <input
          className="sheet-input"
          placeholder="Any extra context?"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />
      </div>
      <div className="sheet-actions">
        <button className="sheet-cancel" onClick={onCancel}>Cancel</button>
        <button
          className="sheet-save"
          disabled={!canSave}
          style={{ opacity: canSave ? 1 : 0.5 }}
          onClick={() => onSave({
            description: form.description.trim(),
            amount: parseFloat(form.amount) || 0,
            category: form.category,
            date: form.date,
            notes: form.notes.trim() || null,
          })}
        >
          Save
        </button>
      </div>
    </>
  )
}

/* ── Main component ──────────────────────────────────── */
export default function Spending({ showToast }) {
  const now = new Date()
  const [year, setYear]           = useState(now.getFullYear())
  const [month, setMonth]         = useState(now.getMonth())
  const [view, setView]           = useState('spending')
  const [editId, setEditId]       = useState(null)
  const [searchOpen, setSearchOpen]   = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [addOpen, setAddOpen]         = useState(false)
  const [addIncomeOpen, setAddIncomeOpen] = useState(false)
  const [expenses, setExpenses]         = useState([])
  const [allExpenses, setAllExpenses]   = useState([])
  const [recurring, setRecurring]       = useState([])
  const [monthIncome, setMonthIncome]   = useState([])
  const [allIncome, setAllIncome]       = useState([])
  const [loadingData, setLoadingData]   = useState(true)
  const searchRef = useRef(null)

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  const budgets  = db.getBudgets()
  const settings = db.getSettings()

  const doRefresh = async (y, m) => {
    const [monthExp, allExp, rec, mInc, aInc] = await Promise.all([
      db.getMonthExpenses(y, m),
      db.getExpenses(),
      db.getRecurring(),
      db.getMonthIncome(y, m),
      db.getIncome(),
    ])
    setExpenses(monthExp)
    setAllExpenses(allExp)
    setRecurring(rec)
    setMonthIncome(mInc)
    setAllIncome(aInc)
    setLoadingData(false)
  }

  useEffect(() => {
    setLoadingData(true)
    doRefresh(year, month)
  }, [year, month])

  const total     = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const remaining = settings.totalBudget - total
  const pct       = Math.min(100, Math.round(total / settings.totalBudget * 100))

  const byCat = {}
  expenses.forEach(e => { if (e.category) byCat[e.category] = (byCat[e.category] || 0) + (e.amount || 0) })

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const handleDelete = async (id) => {
    if (confirm('Delete this expense?')) {
      await db.deleteExpense(id)
      await doRefresh(year, month)
      showToast('Deleted')
    }
  }

  const handleSaveEdit = async (id, updates) => {
    await db.updateExpense(id, updates)
    setEditId(null)
    await doRefresh(year, month)
    showToast('Updated')
  }

  const handleAddExpense = async (expense) => {
    await db.addExpense(expense)
    setAddOpen(false)
    await doRefresh(year, month)
    showToast('Expense added')
  }

  const handleAddIncome = async (income) => {
    await db.addIncome(income)
    setAddIncomeOpen(false)
    await doRefresh(year, month)
    showToast('Income logged')
  }

  /* ── Insight chips ───────────────────────────────── */
  const biggest = expenses.length
    ? expenses.reduce((max, e) => (e.amount || 0) > (max?.amount || 0) ? e : max, null)
    : null
  const topCatEntry = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]
  const topCat = topCatEntry ? CAT_META[topCatEntry[0]]?.label : null

  const todayDate = new Date()
  const thisWeekStart = new Date(todayDate); thisWeekStart.setDate(todayDate.getDate() - todayDate.getDay())
  const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(thisWeekStart.getDate() - 7)
  const lastWeekEnd   = new Date(thisWeekStart); lastWeekEnd.setDate(thisWeekStart.getDate() - 1)
  const thisWeekStr   = thisWeekStart.toISOString().split('T')[0]
  const lwStartStr    = lastWeekStart.toISOString().split('T')[0]
  const lwEndStr      = lastWeekEnd.toISOString().split('T')[0]
  const thisWeekTotal = allExpenses.filter(e => e.date >= thisWeekStr).reduce((s, e) => s + (e.amount || 0), 0)
  const lastWeekTotal = allExpenses.filter(e => e.date >= lwStartStr && e.date <= lwEndStr).reduce((s, e) => s + (e.amount || 0), 0)
  const weekDiff = thisWeekTotal - lastWeekTotal

  /* ── Committed (recurring) ──────────────────────── */
  const activeRecurring = recurring.filter(r => r.active)
  const committedTotal = activeRecurring.reduce((s, r) => s + (r.amount || 0), 0)
  const committedByCat = useMemo(() => {
    const result = {}
    activeRecurring.forEach(r => { result[r.category] = (result[r.category] || 0) + (r.amount || 0) })
    return result
  }, [recurring])

  /* ── Donut data ──────────────────────────────────── */
  const donutCats = CATEGORIES.map(cat => ({
    cat, amount: byCat[cat] || 0, color: CAT_META[cat]?.color, label: CAT_META[cat]?.label,
  })).filter(c => c.amount > 0)

  /* ── Search filter ───────────────────────────────── */
  const q = searchQuery.toLowerCase()
  const filteredExpenses = q
    ? expenses.filter(e =>
        e.description?.toLowerCase().includes(q) ||
        CAT_META[e.category]?.label.toLowerCase().includes(q)
      )
    : expenses

  /* ── Savings data ────────────────────────────────── */
  const incomeTotal  = monthIncome.reduce((s, i) => s + (i.amount || 0), 0)
  const saved        = incomeTotal - total
  const savingsRate  = incomeTotal > 0 ? Math.round((saved / incomeTotal) * 100) : 0

  const incomeByMonth = useMemo(() => {
    const result = {}
    allIncome.forEach(inc => {
      const prefix = inc.date?.slice(0, 7)
      if (prefix) result[prefix] = (result[prefix] || 0) + (inc.amount || 0)
    })
    return result
  }, [allIncome])

  const recentMonths = useMemo(() => computeRecentMonths(allExpenses, 6), [allExpenses])

  const savingsHistory = useMemo(() =>
    recentMonths.map(m => ({
      ...m, income: incomeByMonth[m.key] || 0, saved: (incomeByMonth[m.key] || 0) - m.total,
    })),
    [recentMonths, incomeByMonth]
  )
  const runningTotal = savingsHistory.reduce((s, m) => s + Math.max(0, m.saved), 0)

  const ChevL = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
  const ChevR = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>

  if (loadingData) return (
    <div className="screen">
      <div className="loading-wrap" style={{ height: '100dvh' }}>
        <div className="spinner"/>
      </div>
    </div>
  )

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-header-row">
          <div>
            <div className="screen-label">Overview</div>
            <div className="screen-heading">Spending</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="add-btn" onClick={() => setAddOpen(true)} aria-label="Add expense">
              <PlusIcon size={18} />
            </button>
            <button
              className="search-toggle"
              onClick={() => { setSearchOpen(o => !o); setSearchQuery('') }}
              aria-label="Search expenses"
            >
              {searchOpen ? <XIcon size={17} /> : <SearchIcon size={17} />}
            </button>
            <div className="month-nav">
              <button onClick={prevMonth} aria-label="Previous month"><ChevL /></button>
              <span>{MONTH_NAMES[month]} {year}</span>
              <button onClick={nextMonth} aria-label="Next month"><ChevR /></button>
            </div>
          </div>
        </div>

        {searchOpen && (
          <div className="search-bar">
            <SearchIcon size={15} />
            <input
              ref={searchRef}
              className="search-input"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}><XIcon size={13} /></button>
            )}
          </div>
        )}

        {!searchOpen && (
          <div className="spend-tabs">
            <button className={`spend-tab ${view === 'spending' ? 'active' : ''}`} onClick={() => setView('spending')}>Spending</button>
            <button className={`spend-tab ${view === 'savings' ? 'active' : ''}`} onClick={() => setView('savings')}>Savings</button>
          </div>
        )}
      </div>

      {/* ── SEARCH RESULTS ───────────────────────────── */}
      {searchOpen && (
        <div className="section" style={{ marginTop: 16, paddingBottom: 32 }}>
          <div className="section-label">{filteredExpenses.length} result{filteredExpenses.length !== 1 ? 's' : ''}</div>
          {filteredExpenses.length === 0 ? (
            <div className="empty">no matching expenses</div>
          ) : (
            <div className="card">
              {filteredExpenses.map((e, i) => {
                const meta = CAT_META[e.category]
                const Icon = CAT_ICONS[e.category]
                return (
                  <div key={e.id} className={`exp-row ${i < filteredExpenses.length - 1 ? 'bordered' : ''}`}>
                    <span className="exp-icon-wrap" style={{ color: meta?.color, background: (meta?.color || '#fff') + '18' }}>
                      {Icon && <Icon size={14} />}
                    </span>
                    <div className="exp-body">
                      <div className="exp-title">{e.description}</div>
                      {e.notes && <div className="exp-notes">{e.notes}</div>}
                      <div className="exp-sub">{meta?.label} · {formatDate(e.date)}</div>
                    </div>
                    <div className="exp-amount">{formatRM(e.amount)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SPENDING VIEW ─────────────────────────────── */}
      {!searchOpen && view === 'spending' && (
        <>
          <div className="section" style={{ marginTop: 20 }}>
            <div className="budget-hero card">
              <div className="budget-top">
                <div>
                  <div className="budget-label">Spent</div>
                  <div className="budget-total">{formatRM(total)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="budget-label">Remaining</div>
                  <div className="budget-total" style={{ color: remaining < 0 ? 'var(--red)' : 'var(--accent)' }}>
                    {formatRM(Math.abs(remaining))}
                  </div>
                </div>
              </div>
              <div className="budget-track">
                <div className="budget-fill" style={{ width: pct + '%', background: pct >= 90 ? 'var(--red)' : 'var(--accent)' }}/>
              </div>
              <div className="budget-foot">
                <span>{pct}% of {formatRM(settings.totalBudget)} budget</span>
                <span>{expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}</span>
              </div>
              {committedTotal > 0 && (
                <div className="committed-row">
                  <span className="committed-label">Committed</span>
                  <span className="committed-val">{formatRM(committedTotal)}/mo</span>
                </div>
              )}
            </div>
          </div>

          {expenses.length > 0 && (
            <div className="section" style={{ marginTop: 16 }}>
              <div className="insight-chips">
                <div className="insight-chip">
                  <div className="insight-chip-label">biggest</div>
                  <div className="insight-chip-val">{formatRM(biggest?.amount)}</div>
                  {biggest && <div className="insight-chip-sub">{biggest.description}</div>}
                </div>
                <div className="insight-chip">
                  <div className="insight-chip-label">top category</div>
                  <div className="insight-chip-val">{topCat || '—'}</div>
                  {topCatEntry && <div className="insight-chip-sub">{formatRM(topCatEntry[1])}</div>}
                </div>
                <div className="insight-chip">
                  <div className="insight-chip-label">vs last wk</div>
                  <div className="insight-chip-val" style={{ color: weekDiff > 0 ? 'var(--red)' : weekDiff < 0 ? 'var(--accent)' : 'var(--text2)' }}>
                    {weekDiff === 0 ? '—' : (weekDiff > 0 ? '↑ ' : '↓ ') + formatRM(Math.abs(weekDiff))}
                  </div>
                  <div className="insight-chip-sub">this week</div>
                </div>
              </div>
            </div>
          )}

          {total > 0 && (
            <div className="section" style={{ marginTop: 20 }}>
              <div className="section-label">By category</div>
              <div className="card donut-card">
                <div className="donut-wrap">
                  <DonutChart cats={donutCats} total={total} />
                </div>
                <div className="donut-legend">
                  {donutCats.map(c => {
                    const pctCat = Math.round((c.amount / total) * 100)
                    const committed = committedByCat[c.cat]
                    return (
                      <div key={c.cat} className="legend-row">
                        <span className="legend-dot" style={{ background: c.color }}/>
                        <span className="legend-name">{c.label}</span>
                        {committed > 0 && (
                          <span className="legend-committed">{formatRM(committed)}</span>
                        )}
                        <span className="legend-amount">{formatRM(c.amount)}</span>
                        <span className="legend-pct">{pctCat}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="section" style={{ marginTop: 20, paddingBottom: 32 }}>
            <div className="section-label">All expenses</div>
            {expenses.length === 0 ? (
              <div className="empty">no expenses this month</div>
            ) : (
              <div className="card">
                {expenses.map((e, i) => {
                  const meta = CAT_META[e.category]
                  const Icon = CAT_ICONS[e.category]
                  const isLast = i === expenses.length - 1

                  if (editId === e.id) {
                    return (
                      <div key={e.id} className={`edit-wrap ${isLast ? '' : 'bordered'}`}>
                        <EditExpenseForm
                          expense={e}
                          onSave={(updates) => handleSaveEdit(e.id, updates)}
                          onCancel={() => setEditId(null)}
                        />
                      </div>
                    )
                  }

                  return (
                    <div key={e.id} className={`exp-row ${isLast ? '' : 'bordered'}`}>
                      <span className="exp-icon-wrap" style={{ color: meta?.color, background: (meta?.color || '#fff') + '18' }}>
                        {Icon && <Icon size={14} />}
                      </span>
                      <div className="exp-body">
                        <div className="exp-title">{e.description}</div>
                        {e.notes && <div className="exp-notes">{e.notes}</div>}
                        <div className="exp-sub">{meta?.label} · {formatDate(e.date)}</div>
                      </div>
                      <div className="exp-right">
                        <div className="exp-amount">{formatRM(e.amount)}</div>
                        <div className="exp-btn-row">
                          <button className="icon-btn" onClick={() => setEditId(e.id)} aria-label="Edit">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button className="icon-btn del" onClick={() => handleDelete(e.id)} aria-label="Delete">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── SAVINGS VIEW ──────────────────────────────── */}
      {!searchOpen && view === 'savings' && (
        <>
          {/* Income + Spent header */}
          <div className="section" style={{ marginTop: 20 }}>
            <div className="card">
              <div className="saving-input-row">
                <div>
                  <div className="budget-label">Income</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 600, color: '#58a6ff', letterSpacing: '-0.03em', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                    {formatRM(incomeTotal)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="budget-label">Spent</div>
                  <div className="saving-spent">{formatRM(total)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Net saved + savings rate */}
          <div className="section" style={{ marginTop: 16 }}>
            <div className="card budget-hero">
              <div className="budget-top">
                <div>
                  <div className="budget-label">Net saved</div>
                  <div className="budget-total" style={{ color: saved >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                    {saved >= 0 ? formatRM(saved) : `−${formatRM(Math.abs(saved))}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="budget-label">Savings rate</div>
                  <div className="budget-total" style={{ color: savingsRate >= 20 ? 'var(--accent)' : savingsRate > 0 ? 'var(--text2)' : 'var(--red)' }}>
                    {incomeTotal > 0 ? `${savingsRate}%` : '—'}
                  </div>
                </div>
              </div>
              {incomeTotal > 0 && (
                <div className="budget-track">
                  <div className="budget-fill" style={{
                    width: Math.min(100, Math.max(0, savingsRate)) + '%',
                    background: savingsRate >= 20 ? 'var(--accent)' : savingsRate > 0 ? 'var(--accent)' : 'var(--red)'
                  }}/>
                </div>
              )}
            </div>
          </div>

          {/* Income breakdown */}
          <div className="section" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingRight: 0 }}>
              <div className="section-label">Income this month</div>
              <button
                className="add-btn"
                onClick={() => setAddIncomeOpen(true)}
                aria-label="Log income"
                style={{ marginRight: 20 }}
              >
                <PlusIcon size={16} />
              </button>
            </div>
            {monthIncome.length === 0 ? (
              <div className="empty">no income logged</div>
            ) : (
              <div className="card">
                {monthIncome.map((inc, i) => {
                  const meta = CAT_META[inc.category]
                  return (
                    <div key={inc.id} className={`exp-row ${i < monthIncome.length - 1 ? 'bordered' : ''}`}>
                      <span className="exp-icon-wrap" style={{ color: meta?.color, background: (meta?.color || '#fff') + '18' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </span>
                      <div className="exp-body">
                        <div className="exp-title">{inc.description}</div>
                        {inc.notes && <div className="exp-notes">{inc.notes}</div>}
                        <div className="exp-sub">{meta?.label} · {formatDate(inc.date)}</div>
                      </div>
                      <div className="exp-amount" style={{ color: meta?.color }}>+{formatRM(inc.amount)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 6-month savings history */}
          <div className="section" style={{ marginTop: 20 }}>
            <div className="section-label">6-month savings history</div>
            <div className="card" style={{ padding: '20px 16px 16px' }}>
              <SavingsBarChart months={savingsHistory} />
            </div>
          </div>

          {/* Running total */}
          <div className="section" style={{ marginTop: 16, paddingBottom: 32 }}>
            <div className="card">
              <div className="saving-total-row">
                <div>
                  <div className="budget-label">Running total saved</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em', marginTop: 4 }}>
                    {formatRM(runningTotal)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="budget-label">Across</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>6 months</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {addOpen && (
        <Sheet title="New expense" onClose={() => setAddOpen(false)}>
          <AddExpenseForm
            defaultDate={new Date().toISOString().split('T')[0]}
            onSave={handleAddExpense}
            onCancel={() => setAddOpen(false)}
          />
        </Sheet>
      )}

      {addIncomeOpen && (
        <Sheet title="Log income" onClose={() => setAddIncomeOpen(false)}>
          <AddIncomeForm
            defaultDate={new Date().toISOString().split('T')[0]}
            onSave={handleAddIncome}
            onCancel={() => setAddIncomeOpen(false)}
          />
        </Sheet>
      )}
    </div>
  )
}
