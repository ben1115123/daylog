import { useMemo } from 'react'
import { db } from '../db.js'
import { CAT_META, formatRM, monthLabel } from '../utils.js'
import { GearIcon } from '../Icons.jsx'
import './Insights.css'

/* ── 6-month spending bar chart ──────────────────────── */
function TrendChart({ months }) {
  const W = 300, H = 90
  const n = months.length
  if (!n) return null
  const max = Math.max(...months.map(m => m.total), 1)
  const barW = 32
  const gap = (W - n * barW) / (n + 1)

  return (
    <svg viewBox={`0 0 ${W} ${H + 28}`} width="100%" style={{ overflow: 'visible' }}>
      {months.map((m, i) => {
        const barH = Math.max((m.total / max) * H, m.total > 0 ? 3 : 0)
        const x = gap + i * (barW + gap)
        const y = H - barH
        const isCurrentMonth = i === n - 1
        return (
          <g key={i}>
            <rect
              x={x} y={y}
              width={barW} height={barH}
              rx="3"
              fill={isCurrentMonth ? 'var(--accent)' : 'var(--bg4)'}
            />
            <text
              x={x + barW / 2} y={H + 16}
              textAnchor="middle"
              style={{ fill: 'var(--text3)', fontFamily: 'JetBrains Mono', fontSize: 9 }}
            >
              {monthLabel(m.year, m.month)}
            </text>
            {m.total > 0 && (
              <text
                x={x + barW / 2} y={y - 5}
                textAnchor="middle"
                style={{ fill: isCurrentMonth ? 'var(--accent)' : 'var(--text3)', fontFamily: 'JetBrains Mono', fontSize: 9 }}
              >
                {m.total >= 1000 ? Math.round(m.total / 100) / 10 + 'k' : Math.round(m.total)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export default function Insights({ showToast, onSettings }) {
  const now = new Date()
  const thisYear  = now.getFullYear()
  const thisMonth = now.getMonth()
  const prevYear  = thisMonth === 0 ? thisYear - 1 : thisYear
  const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1

  const expenses     = db.getMonthExpenses(thisYear, thisMonth)
  const prevExpenses = db.getMonthExpenses(prevYear, prevMonth)
  const allExpenses  = db.getExpenses()
  const recentMonths = db.getRecentMonths(6)

  const thisTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const prevTotal = prevExpenses.reduce((s, e) => s + (e.amount || 0), 0)
  const monthDelta = thisTotal - prevTotal
  const monthDeltaPct = prevTotal > 0 ? Math.round(Math.abs(monthDelta) / prevTotal * 100) : null

  /* ── Most expensive day of week ─────────────────── */
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayTotals = Array(7).fill(0)
  const dayCounts = Array(7).fill(0)
  expenses.forEach(e => {
    const d = new Date(e.date + 'T00:00:00').getDay()
    dayTotals[d] += e.amount || 0
    dayCounts[d]++
  })
  const dayAvgs = dayTotals.map((t, i) => dayCounts[i] ? t / dayCounts[i] : 0)
  const maxDayIdx = dayAvgs.indexOf(Math.max(...dayAvgs))
  const maxDayName = dayAvgs[maxDayIdx] > 0 ? DAY_NAMES[maxDayIdx] : null

  /* ── Logging streak ──────────────────────────────── */
  const streak = useMemo(() => {
    const allDates = new Set(allExpenses.map(e => e.date))
    let count = 0
    const d = new Date()
    while (allDates.has(d.toISOString().split('T')[0])) {
      count++
      d.setDate(d.getDate() - 1)
    }
    return count
  }, [allExpenses])

  /* ── Top 3 merchants ─────────────────────────────── */
  const merchants = useMemo(() => {
    const totals = {}
    expenses.forEach(e => {
      if (e.description) totals[e.description] = (totals[e.description] || 0) + (e.amount || 0)
    })
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  }, [expenses])

  const totalForMerchants = expenses.reduce((s, e) => s + (e.amount || 0), 0)

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="insights-header-row">
          <div>
            <div className="screen-label">Analytics</div>
            <div className="screen-heading">Insights</div>
          </div>
          <button className="gear-btn" onClick={onSettings} aria-label="Settings">
            <GearIcon size={18} />
          </button>
        </div>
      </div>

      {/* ── 6-month trend ─────────────────────────────── */}
      <div className="section" style={{ marginTop: 20 }}>
        <div className="section-label">Spending trend</div>
        <div className="card" style={{ padding: '18px 16px 14px' }}>
          <TrendChart months={recentMonths} />
        </div>
      </div>

      {/* ── Stat pair row ─────────────────────────────── */}
      <div className="section" style={{ marginTop: 16 }}>
        <div className="stat-pair">
          <div className="stat-card card">
            <div className="stat-label">most expensive day</div>
            <div className="stat-value">{maxDayName || '—'}</div>
            {maxDayName && (
              <div className="stat-sub">{formatRM(Math.round(dayAvgs[maxDayIdx]))} avg</div>
            )}
          </div>
          <div className="stat-card card">
            <div className="stat-label">logging streak</div>
            <div className="stat-value">{streak}</div>
            <div className="stat-sub">{streak === 1 ? 'day' : 'days'}</div>
          </div>
        </div>
      </div>

      {/* ── Top merchants ─────────────────────────────── */}
      <div className="section" style={{ marginTop: 16 }}>
        <div className="section-label">Top merchants this month</div>
        {merchants.length === 0 ? (
          <div className="empty">no expenses yet</div>
        ) : (
          <div className="card">
            {merchants.map(([desc, amount], i) => {
              const pct = totalForMerchants > 0 ? Math.round((amount / totalForMerchants) * 100) : 0
              return (
                <div key={desc} className={`merchant-row ${i < merchants.length - 1 ? 'bordered' : ''}`}>
                  <span className="merchant-rank">{i + 1}</span>
                  <span className="merchant-name">{desc}</span>
                  <span className="merchant-pct">{pct}%</span>
                  <span className="merchant-amount">{formatRM(amount)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Month comparison ──────────────────────────── */}
      <div className="section" style={{ marginTop: 16, paddingBottom: 32 }}>
        <div className="section-label">Month comparison</div>
        <div className="card month-compare-card">
          <div className="month-col">
            <div className="month-col-label">This month</div>
            <div className="month-col-val">{formatRM(thisTotal)}</div>
            <div className="month-col-sub">{monthLabel(thisYear, thisMonth)}</div>
          </div>
          <div className="month-divider">
            {monthDelta !== 0 && (
              <div className="month-delta" style={{ color: monthDelta > 0 ? 'var(--red)' : 'var(--accent)' }}>
                {monthDelta > 0 ? '↑' : '↓'}
                {monthDeltaPct !== null ? ` ${monthDeltaPct}%` : ''}
              </div>
            )}
            {monthDelta === 0 && <div className="month-delta" style={{ color: 'var(--text3)' }}>same</div>}
          </div>
          <div className="month-col" style={{ textAlign: 'right' }}>
            <div className="month-col-label">Last month</div>
            <div className="month-col-val" style={{ color: 'var(--text2)' }}>{formatRM(prevTotal)}</div>
            <div className="month-col-sub">{monthLabel(prevYear, prevMonth)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
