import { useState, useEffect, useMemo } from 'react'
import { db, computeRecentMonths } from '../db.js'
import { CAT_META, formatRM, monthLabel } from '../utils.js'
import { todayISO, shiftISO, parseISODate, monthKey, shiftMonth } from '../lib/dates.js'
import DLMark from './DLMark.jsx'
import './Insights.css'

/* ── Income vs Expenses dual bar chart ───────────────── */
function IncomeExpensesChart({ months }) {
  const W = 300, H = 80
  const n = months.length
  if (!n) return null
  const maxVal = Math.max(...months.flatMap(m => [m.income, m.total]), 1)
  const pairW = 36, gap = (W - n * pairW) / (n + 1)
  const barW = 14, barGap = 4

  return (
    <svg viewBox={`0 0 ${W} ${H + 40}`} width="100%" style={{ overflow: 'visible' }}>
      {months.map((m, i) => {
        const incH = Math.max((m.income / maxVal) * H, m.income > 0 ? 2 : 0)
        const expH = Math.max((m.total / maxVal) * H, m.total > 0 ? 2 : 0)
        const x = gap + i * (pairW + gap)
        const isLast = i === n - 1
        const net = m.income - m.total
        return (
          <g key={i}>
            <rect x={x} y={H - incH} width={barW} height={Math.max(incH, 0)} rx="2"
              fill="#58a6ff" opacity={isLast ? 0.9 : 0.45}/>
            <rect x={x + barW + barGap} y={H - expH} width={barW} height={Math.max(expH, 0)} rx="2"
              fill="var(--red)" opacity={isLast ? 0.6 : 0.3}/>
            <text x={x + pairW / 2} y={H + 14} textAnchor="middle"
              style={{ fill: 'var(--text3)', fontFamily: 'JetBrains Mono', fontSize: 9 }}>
              {monthLabel(m.year, m.month)}
            </text>
            {(m.income > 0 || m.total > 0) && (
              <text x={x + pairW / 2} y={H + 26} textAnchor="middle"
                style={{ fill: net >= 0 ? 'var(--accent)' : 'var(--red)', fontFamily: 'JetBrains Mono', fontSize: 8 }}>
                {net >= 0 ? '+' : '−'}{Math.abs(net) >= 1000 ? (Math.round(Math.abs(net) / 100) / 10) + 'k' : Math.round(Math.abs(net))}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

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
              rx="6"
              fill={isCurrentMonth ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}
            />
            <text
              x={x + barW / 2} y={H + 16}
              textAnchor="middle"
              style={{ fill: 'var(--text3)', fontFamily: 'JetBrains Mono', fontSize: 9 }}
            >
              {monthLabel(m.year, m.month)}
            </text>
            {m.total > 0 && isCurrentMonth && (
              <text
                x={x + barW / 2} y={y - 5}
                textAnchor="middle"
                style={{ fill: 'var(--accent)', fontFamily: 'JetBrains Mono', fontSize: 9 }}
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

export default function Insights({ showToast }) {
  const [allExpenses, setAllExpenses] = useState([])
  const [allIncome, setAllIncome]     = useState([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    Promise.all([db.getExpenses(), db.getIncome()]).then(([expenses, income]) => {
      setAllExpenses(expenses)
      setAllIncome(income)
      setLoadingData(false)
    })
  }, [])

  const now = new Date()
  const thisYear  = now.getFullYear()
  const thisMonth = now.getMonth()
  const { year: prevYear, month: prevMonth } = shiftMonth(thisYear, thisMonth, -1)

  const thisPrefix = monthKey(thisYear, thisMonth)
  const prevPrefix = monthKey(prevYear, prevMonth)

  const expenses     = useMemo(() => allExpenses.filter(e => e.date?.startsWith(thisPrefix)), [allExpenses])
  const prevExpenses = useMemo(() => allExpenses.filter(e => e.date?.startsWith(prevPrefix)), [allExpenses])
  const recentMonths = useMemo(() => computeRecentMonths(allExpenses, 6), [allExpenses])

  const thisTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const prevTotal = prevExpenses.reduce((s, e) => s + (e.amount || 0), 0)
  const monthDelta = thisTotal - prevTotal
  const monthDeltaPct = prevTotal > 0 ? Math.round(Math.abs(monthDelta) / prevTotal * 100) : null

  /* ── Most expensive day of week ─────────────────── */
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayTotals = Array(7).fill(0)
  const dayCounts = Array(7).fill(0)
  expenses.forEach(e => {
    const d = parseISODate(e.date).getDay()
    dayTotals[d] += e.amount || 0
    dayCounts[d]++
  })
  const dayAvgs = dayTotals.map((t, i) => dayCounts[i] ? t / dayCounts[i] : 0)
  const maxDayIdx = dayAvgs.indexOf(Math.max(...dayAvgs))
  const maxDayName = dayAvgs[maxDayIdx] > 0 ? DAY_NAMES[maxDayIdx] : null

  /* ── Income vs expenses ─────────────────────────── */
  const incomeByMonth = useMemo(() => {
    const result = {}
    allIncome.forEach(inc => {
      const prefix = inc.date?.slice(0, 7)
      if (prefix) result[prefix] = (result[prefix] || 0) + (inc.amount || 0)
    })
    return result
  }, [allIncome])

  const incomeExpensesMonths = useMemo(() =>
    recentMonths.map(m => ({
      ...m, income: incomeByMonth[m.key] || 0,
    })),
    [recentMonths, incomeByMonth]
  )

  /* ── Logging streak ──────────────────────────────── */
  const streak = useMemo(() => {
    const allDates = new Set(allExpenses.map(e => e.date))
    let count = 0
    let cursor = todayISO()
    while (allDates.has(cursor)) {
      count++
      cursor = shiftISO(cursor, -1)
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
        <div className="screen-dl-mark"><DLMark /></div>
        <div className="screen-label">Analytics</div>
        <div className="screen-heading">Insights</div>
      </div>

      {/* ── 6-month trend ─────────────────────────────── */}
      <div className="section" >
        <div className="section-label">Spending trend</div>
        <div className="card" style={{ padding: '20px 20px 16px' }}>
          <TrendChart months={recentMonths} />
        </div>
      </div>

      {/* ── Income vs expenses ────────────────────────── */}
      <div className="section" >
        <div className="section-label">Income vs expenses</div>
        <div className="card" style={{ padding: '20px 20px 16px' }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text3)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#58a6ff', display: 'inline-block' }}/>income
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text3)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--red)', opacity: 0.6, display: 'inline-block' }}/>expenses
            </span>
          </div>
          <IncomeExpensesChart months={incomeExpensesMonths} />
        </div>
      </div>

      {/* ── Stat pair row ─────────────────────────────── */}
      <div className="section" >
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
      <div className="section" >
        <div className="section-label">Top merchants this month</div>
        {merchants.length === 0 ? (
          <div className="empty">no expenses yet</div>
        ) : (
          <div className="card">
            {merchants.map(([desc, amount], i) => {
              const pct = totalForMerchants > 0 ? Math.round((amount / totalForMerchants) * 100) : 0
              return (
                <div key={desc} className={`merchant-row ${i < merchants.length - 1 ? 'bordered' : ''}`}>
                  <span className="merchant-rank">#{i + 1}</span>
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
      <div className="section" style={{ paddingBottom: 32 }}>
        <div className="section-label">Month comparison</div>
        <div className="card month-compare-card">
          <div className="month-col">
            <div className="month-col-label">This month</div>
            <div className="month-col-val">{formatRM(thisTotal)}</div>
            <div className="month-col-sub">{monthLabel(thisYear, thisMonth)}</div>
          </div>
          <div className="month-divider">
            {monthDelta !== 0 && (
              <div className={`month-delta ${monthDelta > 0 ? 'up' : 'down'}`}>
                {monthDelta > 0 ? '↑' : '↓'}
                {monthDeltaPct !== null ? ` ${monthDeltaPct}%` : ''}
              </div>
            )}
            {monthDelta === 0 && <div className="month-delta flat">same</div>}
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
