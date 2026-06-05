import { useState } from 'react'
import { db } from '../db.js'
import { CAT_META, CATEGORIES, formatRM, formatDate, monthLabel } from '../utils.js'
import { CAT_ICONS } from '../Icons.jsx'
import './Spending.css'

/* ── Pure SVG donut chart ────────────────────────────── */
function DonutChart({ cats, total }) {
  const R = 52, CX = 72, CY = 72
  const CIRC = 2 * Math.PI * R
  const active = cats.filter(c => c.amount > 0)

  if (total === 0) {
    return (
      <svg viewBox="0 0 144 144" width="150" height="150">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--bg4)" strokeWidth="15"/>
        <text x={CX} y={CY - 4} textAnchor="middle" style={{ fill: 'var(--text3)', fontFamily: 'JetBrains Mono', fontSize: 10 }}>spent</text>
        <text x={CX} y={CY + 14} textAnchor="middle" style={{ fill: 'var(--text2)', fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 500 }}>RM 0</text>
      </svg>
    )
  }

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
            fill="none"
            stroke={c.color}
            strokeOpacity="0.85"
            strokeWidth="15"
            strokeDasharray={`${len} ${CIRC}`}
            strokeLinecap="butt"
            transform={`rotate(${start - 90}, ${CX}, ${CY})`}
          />
        )
      })}
      <text x={CX} y={CY - 5} textAnchor="middle" style={{ fill: 'var(--text3)', fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.04em' }}>spent</text>
      <text x={CX} y={CY + 13} textAnchor="middle" style={{ fill: 'var(--text)', fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 600 }}>{formatRM(total)}</text>
    </svg>
  )
}

/* ── Mini SVG bar chart for savings history ──────────── */
function SavingsBarChart({ months }) {
  const W = 300, H = 80
  const n = months.length
  if (!n) return null
  const barW = 32
  const gap = (W - n * barW) / (n + 1)
  const maxAbs = Math.max(...months.map(m => Math.abs(m.saved)), 1)

  return (
    <svg viewBox={`0 0 ${W} ${H + 28}`} width="100%" style={{ overflow: 'visible' }}>
      {/* zero line */}
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="var(--bg4)" strokeWidth="1"/>
      {months.map((m, i) => {
        const x = gap + i * (barW + gap)
        const norm = m.saved / maxAbs
        const barH = Math.abs(norm) * (H / 2 - 4)
        const isPos = m.saved >= 0
        const y = isPos ? H / 2 - barH : H / 2
        return (
          <g key={i}>
            <rect
              x={x} y={y}
              width={barW} height={Math.max(barH, 1)}
              rx="3"
              fill={isPos ? 'var(--accent)' : 'var(--red)'}
              opacity="0.75"
            />
            <text
              x={x + barW / 2} y={H + 16}
              textAnchor="middle"
              style={{ fill: 'var(--text3)', fontFamily: 'JetBrains Mono', fontSize: 9 }}
            >
              {monthLabel(m.year, m.month)}
            </text>
            {Math.abs(m.saved) > 0 && (
              <text
                x={x + barW / 2}
                y={isPos ? y - 4 : y + barH + 12}
                textAnchor="middle"
                style={{ fill: 'var(--text3)', fontFamily: 'JetBrains Mono', fontSize: 8 }}
              >
                {m.saved > 0 ? '+' : ''}{Math.round(m.saved / 1000 * 10) / 10}k
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/* ── Main component ──────────────────────────────────── */
export default function Spending({ showToast }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [view, setView] = useState('spending')
  const [income, setIncome] = useState(() => db.getIncome(now.getFullYear(), now.getMonth()))

  const budgets  = db.getBudgets()
  const settings = db.getSettings()
  const expenses = db.getMonthExpenses(year, month)

  const total     = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const remaining = settings.totalBudget - total
  const pct       = Math.min(100, Math.round(total / settings.totalBudget * 100))

  const byCat = {}
  expenses.forEach(e => {
    if (e.category) byCat[e.category] = (byCat[e.category] || 0) + (e.amount || 0)
  })

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const handleDelete = (id) => {
    if (confirm('Delete this expense?')) { db.deleteExpense(id); showToast('Deleted') }
  }

  /* ── Insight chips ───────────────────────────────── */
  const biggest = expenses.length
    ? expenses.reduce((max, e) => (e.amount || 0) > (max?.amount || 0) ? e : max, null)
    : null

  const topCatEntry = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]
  const topCat = topCatEntry ? CAT_META[topCatEntry[0]]?.label : null

  const allExp = db.getExpenses()
  const todayDate = new Date()
  const thisWeekStart = new Date(todayDate)
  thisWeekStart.setDate(todayDate.getDate() - todayDate.getDay())
  const thisWeekStr = thisWeekStart.toISOString().split('T')[0]
  const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(thisWeekStart.getDate() - 7)
  const lastWeekEnd = new Date(thisWeekStart);   lastWeekEnd.setDate(thisWeekStart.getDate() - 1)
  const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0]
  const lastWeekEndStr   = lastWeekEnd.toISOString().split('T')[0]
  const thisWeekTotal = allExp.filter(e => e.date >= thisWeekStr).reduce((s, e) => s + (e.amount || 0), 0)
  const lastWeekTotal = allExp.filter(e => e.date >= lastWeekStartStr && e.date <= lastWeekEndStr).reduce((s, e) => s + (e.amount || 0), 0)
  const weekDiff = thisWeekTotal - lastWeekTotal

  /* ── Donut chart data ────────────────────────────── */
  const donutCats = CATEGORIES.map(cat => ({
    cat,
    amount: byCat[cat] || 0,
    color: CAT_META[cat].color,
    label: CAT_META[cat].label,
  })).filter(c => c.amount > 0)

  /* ── Savings view data ───────────────────────────── */
  const saved = income - total
  const savingsRate = income > 0 ? Math.round((saved / income) * 100) : 0
  const recentMonths = db.getRecentMonths(6)
  const allIncome = db.getAllIncome()
  const savingsHistory = recentMonths.map(m => ({
    ...m,
    income: allIncome[m.key] || 0,
    saved: (allIncome[m.key] || 0) - m.total,
  }))
  const runningTotal = savingsHistory.reduce((s, m) => s + Math.max(0, m.saved), 0)

  const handleSaveIncome = (val) => {
    const n = parseFloat(val)
    if (!isNaN(n)) {
      db.saveIncome(year, month, n)
      setIncome(n)
    }
  }

  /* ── Chevron SVG ─────────────────────────────────── */
  const ChevL = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
  const ChevR = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-header-row">
          <div>
            <div className="screen-label">Overview</div>
            <div className="screen-heading">Spending</div>
          </div>
          <div className="month-nav">
            <button onClick={prevMonth} aria-label="Previous month"><ChevL /></button>
            <span>{MONTH_NAMES[month]} {year}</span>
            <button onClick={nextMonth} aria-label="Next month"><ChevR /></button>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="spend-tabs">
          <button className={`spend-tab ${view === 'spending' ? 'active' : ''}`} onClick={() => setView('spending')}>Spending</button>
          <button className={`spend-tab ${view === 'savings' ? 'active' : ''}`} onClick={() => setView('savings')}>Savings</button>
        </div>
      </div>

      {/* ── SPENDING VIEW ─────────────────────────────── */}
      {view === 'spending' && (
        <>
          {/* Budget hero */}
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
                <div className="budget-fill" style={{
                  width: pct + '%',
                  background: pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--amber)' : 'var(--accent)'
                }}/>
              </div>
              <div className="budget-foot">
                <span>{pct}% of {formatRM(settings.totalBudget)} budget</span>
                <span>{expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}</span>
              </div>
            </div>
          </div>

          {/* Insight chips */}
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

          {/* Donut chart + legend */}
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
                    return (
                      <div key={c.cat} className="legend-row">
                        <span className="legend-dot" style={{ background: c.color }}/>
                        <span className="legend-name">{c.label}</span>
                        <span className="legend-amount">{formatRM(c.amount)}</span>
                        <span className="legend-pct">{pctCat}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* All expenses */}
          <div className="section" style={{ marginTop: 20, paddingBottom: 32 }}>
            <div className="section-label">All expenses</div>
            {expenses.length === 0 ? (
              <div className="empty">no expenses this month</div>
            ) : (
              <div className="card">
                {expenses.map((e, i) => {
                  const meta = CAT_META[e.category]
                  const Icon = CAT_ICONS[e.category]
                  return (
                    <div key={e.id} className={`exp-row ${i < expenses.length - 1 ? 'bordered' : ''}`}>
                      <span className="exp-icon-wrap" style={{ color: meta?.color, background: (meta?.color || '#fff') + '18' }}>
                        {Icon && <Icon size={14} />}
                      </span>
                      <div className="exp-body">
                        <div className="exp-title">{e.description}</div>
                        <div className="exp-sub">{meta?.label} · {formatDate(e.date)}</div>
                      </div>
                      <div className="exp-right">
                        <div className="exp-amount">{formatRM(e.amount)}</div>
                        <button className="del-btn" onClick={() => handleDelete(e.id)} aria-label="Delete">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
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
      {view === 'savings' && (
        <>
          {/* Income input */}
          <div className="section" style={{ marginTop: 20 }}>
            <div className="card">
              <div className="saving-input-row">
                <div>
                  <div className="budget-label">Monthly income</div>
                  <div className="saving-income-wrap">
                    <span className="saving-income-prefix">RM</span>
                    <input
                      className="saving-income-input"
                      type="number"
                      value={income || ''}
                      placeholder="0"
                      onChange={e => handleSaveIncome(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="budget-label">Spent</div>
                  <div className="saving-spent">{formatRM(total)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Saved hero */}
          <div className="section" style={{ marginTop: 16 }}>
            <div className="card budget-hero">
              <div className="budget-top">
                <div>
                  <div className="budget-label">Saved this month</div>
                  <div className="budget-total" style={{ color: saved >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                    {saved >= 0 ? formatRM(saved) : `−${formatRM(Math.abs(saved))}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="budget-label">Savings rate</div>
                  <div className="budget-total" style={{ color: savingsRate >= 20 ? 'var(--accent)' : savingsRate > 0 ? 'var(--text2)' : 'var(--red)' }}>
                    {income > 0 ? `${savingsRate}%` : '—'}
                  </div>
                </div>
              </div>
              {income > 0 && (
                <div className="budget-track">
                  <div className="budget-fill" style={{
                    width: Math.min(100, Math.max(0, savingsRate)) + '%',
                    background: savingsRate >= 20 ? 'var(--accent)' : savingsRate > 0 ? 'var(--amber)' : 'var(--red)'
                  }}/>
                </div>
              )}
            </div>
          </div>

          {/* Monthly savings history chart */}
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
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
                    6 months
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
