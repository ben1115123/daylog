import { useState, useEffect, useMemo, useCallback } from 'react'
import { db, computeRecentMonths } from '../db.js'
import { CAT_META, formatRM, formatDate, monthLabel } from '../utils.js'
import { todayISO, shiftISO, parseISODate, monthKey, shiftMonth } from '../lib/dates.js'
import DLMark from './DLMark.jsx'
import MerchantList from './MerchantList.jsx'
import InsightsMonthDetail from './InsightsMonthDetail.jsx'
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
/* `selected` is the index whose detail is open, or null for none — in which
   case the current month keeps the accent, as it always has. */
function TrendChart({ months, selected, onSelect }) {
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
        const isAccent = selected === null ? i === n - 1 : i === selected
        const isDimmed = selected !== null && i !== selected
        return (
          <g
            key={i}
            className={`trend-bar${isDimmed ? ' dim' : ''}`}
            onClick={() => onSelect(i)}
            role="button"
            tabIndex={0}
            aria-label={`${monthLabel(m.year, m.month)} ${m.year}, ${Math.round(m.total)} ringgit`}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i) } }}
          >
            {/* Full-column transparent hit area — a short bar is only a few px
                tall, far under the 44px minimum touch target. */}
            <rect x={x - gap / 2} y={0} width={barW + gap} height={H + 28} fill="transparent" />
            <rect
              className="trend-bar-fill"
              x={x} y={y}
              width={barW} height={barH}
              rx="6"
              fill={isAccent ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}
            />
            <text
              x={x + barW / 2} y={H + 16}
              textAnchor="middle"
              style={{ fill: isAccent ? 'var(--text2)' : 'var(--text3)', fontFamily: 'JetBrains Mono', fontSize: 9 }}
            >
              {monthLabel(m.year, m.month)}
            </text>
            {m.total > 0 && isAccent && (
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

  /* ── Interaction state ──────────────────────────── */
  /* Index into recentMonths whose detail is open, or null for the overview. */
  const [detailIndex, setDetailIndex] = useState(null)
  /* Which stat card has its supporting detail expanded: 'day' | 'streak' | null. */
  const [openStat, setOpenStat] = useState(null)

  const expensesFor = useCallback(
    key => allExpenses.filter(e => e.date?.startsWith(key)),
    [allExpenses]
  )

  /* Supporting detail for "most expensive day": every expense this month that
     fell on that weekday, newest first. */
  const dayDetail = useMemo(() => {
    if (maxDayName === null) return []
    return expenses
      .filter(e => parseISODate(e.date).getDay() === maxDayIdx)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [expenses, maxDayIdx, maxDayName])

  /* Supporting detail for the streak: the span it covers. */
  const streakRange = useMemo(() => {
    if (streak === 0) return null
    const end = todayISO()
    return { from: shiftISO(end, -(streak - 1)), to: end }
  }, [streak])

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
          <TrendChart months={recentMonths} selected={detailIndex} onSelect={setDetailIndex} />
          <div className="trend-hint">tap a month for the breakdown</div>
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
          <button
            className={`stat-card card${openStat === 'day' ? ' open' : ''}`}
            onClick={() => setOpenStat(openStat === 'day' ? null : 'day')}
            disabled={!maxDayName}
            aria-expanded={openStat === 'day'}
          >
            <div className="stat-label">most expensive day</div>
            <div className="stat-value">{maxDayName || '—'}</div>
            {maxDayName && (
              <div className="stat-sub">{formatRM(Math.round(dayAvgs[maxDayIdx]))} avg</div>
            )}
          </button>
          <button
            className={`stat-card card${openStat === 'streak' ? ' open' : ''}`}
            onClick={() => setOpenStat(openStat === 'streak' ? null : 'streak')}
            disabled={streak === 0}
            aria-expanded={openStat === 'streak'}
          >
            <div className="stat-label">logging streak</div>
            <div className="stat-value">{streak}</div>
            <div className="stat-sub">{streak === 1 ? 'day' : 'days'}</div>
          </button>
        </div>

        {/* Expands below the pair rather than inside a card, so neither card
            changes size and the grid never reflows. */}
        <div className={`stat-detail${openStat ? ' open' : ''}`}>
          <div className="stat-detail-inner">
            <div className="card stat-detail-card">
              {openStat === 'day' && (
                <>
                  <div className="stat-detail-head">
                    every {DAY_NAMES[maxDayIdx]} this month · {dayCounts[maxDayIdx]} {dayCounts[maxDayIdx] === 1 ? 'entry' : 'entries'} · {formatRM(Math.round(dayTotals[maxDayIdx]))} total
                  </div>
                  {dayDetail.map(e => {
                    const meta = CAT_META[e.category]
                    return (
                      <div key={e.id} className="stat-detail-row">
                        <span className="merchant-txn-dot" style={{ background: meta?.color || 'var(--text3)' }} />
                        <span className="stat-detail-date">{formatDate(e.date)}</span>
                        <span className="stat-detail-desc">{e.description}</span>
                        <span className="stat-detail-amount">{formatRM(e.amount)}</span>
                      </div>
                    )
                  })}
                </>
              )}
              {openStat === 'streak' && streakRange && (
                <>
                  <div className="stat-detail-head">
                    unbroken since {formatDate(streakRange.from)}
                  </div>
                  <div className="stat-detail-row">
                    <span className="stat-detail-date">{formatDate(streakRange.from)}</span>
                    <span className="stat-detail-desc">→ {formatDate(streakRange.to)}</span>
                    <span className="stat-detail-amount">{streak} {streak === 1 ? 'day' : 'days'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top merchants ─────────────────────────────── */}
      <div className="section" >
        <div className="section-label">Top merchants this month</div>
        <MerchantList rows={merchants} total={totalForMerchants} expenses={expenses} idPrefix="overview:" />
      </div>

      {/* ── Month comparison ──────────────────────────── */}
      <div className="section">
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

      {detailIndex !== null && recentMonths[detailIndex] && (
        <InsightsMonthDetail
          months={recentMonths}
          index={detailIndex}
          expensesFor={expensesFor}
          onIndex={setDetailIndex}
          onClose={() => setDetailIndex(null)}
        />
      )}
    </div>
  )
}
