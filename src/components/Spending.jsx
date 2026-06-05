import { useState } from 'react'
import { db } from '../db.js'
import { CAT_META, CATEGORIES, formatRM, formatDate } from '../utils.js'
import { CAT_ICONS } from '../Icons.jsx'
import './Spending.css'

export default function Spending({ showToast }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const budgets = db.getBudgets()
  const settings = db.getSettings()
  const expenses = db.getMonthExpenses(year, month)

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const remaining = settings.totalBudget - total
  const pct = Math.min(100, Math.round(total / settings.totalBudget * 100))

  const byCat = {}
  expenses.forEach(e => { if (e.category) byCat[e.category] = (byCat[e.category] || 0) + (e.amount || 0) })

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const handleDelete = (id) => {
    if (confirm('Delete this expense?')) { db.deleteExpense(id); showToast('Deleted') }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-header-row">
          <div>
            <div className="screen-label">Overview</div>
            <div className="screen-heading">Spending</div>
          </div>
          <div className="month-nav">
            <button onClick={prevMonth} aria-label="Previous month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <span>{MONTH_NAMES[month]} {year}</span>
            <button onClick={nextMonth} aria-label="Next month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Budget hero ──────────────────────────────────── */}
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
            <div
              className="budget-fill"
              style={{
                width: pct + '%',
                background: pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--amber)' : 'var(--accent)'
              }}
            />
          </div>
          <div className="budget-foot">
            <span>{pct}% of {formatRM(settings.totalBudget)} budget</span>
            <span>{expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}</span>
          </div>
        </div>
      </div>

      {/* ── Category breakdown ───────────────────────────── */}
      <div className="section" style={{ marginTop: 20 }}>
        <div className="section-label">By category</div>
        <div className="card">
          {CATEGORIES.map((cat, i) => {
            const spent = byCat[cat] || 0
            const budget = budgets[cat]
            const p = Math.min(100, Math.round(spent / budget * 100))
            const over = spent > budget
            const meta = CAT_META[cat]
            const Icon = CAT_ICONS[cat]
            return (
              <div key={cat} className={`cat-row ${i < CATEGORIES.length - 1 ? 'bordered' : ''}`}>
                <span
                  className="cat-icon-wrap"
                  style={{ color: meta.color, background: meta.color + '18' }}
                >
                  {Icon && <Icon size={14} />}
                </span>
                <div className="cat-body">
                  <div className="cat-top">
                    <span className="cat-name">{meta.label}</span>
                    <span className="cat-amounts" style={{ color: over ? 'var(--red)' : 'var(--text2)' }}>
                      {formatRM(spent)} <span className="cat-slash">/</span> {formatRM(budget)}
                    </span>
                  </div>
                  <div className="cat-track">
                    <div
                      className="cat-fill"
                      style={{ width: p + '%', background: over ? 'var(--red)' : meta.color }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── All expenses ─────────────────────────────────── */}
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
                  <span
                    className="exp-icon-wrap"
                    style={{ color: meta?.color, background: (meta?.color || '#fff') + '18' }}
                  >
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
    </div>
  )
}
