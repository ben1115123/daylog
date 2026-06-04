import { useState } from 'react'
import { db } from '../db.js'
import { CAT_META, CATEGORIES, formatRM, formatDate } from '../utils.js'
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

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const handleDelete = (id) => {
    if (confirm('Delete this expense?')) { db.deleteExpense(id); showToast('Deleted') }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-title">Overview</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="screen-heading">Spending</div>
          <div className="month-nav">
            <button onClick={prevMonth}>‹</button>
            <span>{monthNames[month]} {year}</span>
            <button onClick={nextMonth}>›</button>
          </div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 20 }}>
        <div className="budget-hero card">
          <div className="budget-top">
            <div>
              <div className="budget-label">spent</div>
              <div className="budget-total">{formatRM(total)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="budget-label">remaining</div>
              <div className="budget-total" style={{ color: remaining < 0 ? 'var(--red)' : 'var(--accent)' }}>{formatRM(Math.abs(remaining))}</div>
            </div>
          </div>
          <div className="budget-track">
            <div className="budget-fill" style={{ width: pct + '%', background: pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--amber)' : 'var(--accent)' }} />
          </div>
          <div className="budget-foot">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>{pct}% of {formatRM(settings.totalBudget)} budget</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>{expenses.length} entries</span>
          </div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 20 }}>
        <div className="section-label">By category</div>
        <div className="card">
          {CATEGORIES.map((cat, i) => {
            const spent = byCat[cat] || 0
            const budget = budgets[cat]
            const p = Math.min(100, Math.round(spent / budget * 100))
            const over = spent > budget
            const meta = CAT_META[cat]
            return (
              <div key={cat} className={`cat-row ${i < CATEGORIES.length - 1 ? 'bordered' : ''}`}>
                <span className="cat-icon">{meta.icon}</span>
                <div className="cat-body">
                  <div className="cat-top">
                    <span className="cat-name">{meta.label}</span>
                    <span className="cat-amounts" style={{ color: over ? 'var(--red)' : 'var(--text2)' }}>
                      {formatRM(spent)} / {formatRM(budget)}
                    </span>
                  </div>
                  <div className="cat-track">
                    <div className="cat-fill" style={{ width: p + '%', background: over ? 'var(--red)' : meta.color }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="section" style={{ marginTop: 20, paddingBottom: 32 }}>
        <div className="section-label">All expenses</div>
        {expenses.length === 0 ? (
          <div className="empty"><span className="empty-icon">⬡</span>no expenses this month</div>
        ) : (
          <div className="card">
            {expenses.map((e, i) => (
              <div key={e.id} className={`entry-row ${i < expenses.length - 1 ? 'bordered' : ''}`} onLongPress={() => handleDelete(e.id)}>
                <span className="entry-icon" style={{ background: CAT_META[e.category]?.color + '22', color: CAT_META[e.category]?.color }}>
                  {CAT_META[e.category]?.icon}
                </span>
                <div className="entry-body">
                  <div className="entry-title">{e.description}</div>
                  <div className="entry-sub">{CAT_META[e.category]?.label} · {formatDate(e.date)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div className="entry-amount">{formatRM(e.amount)}</div>
                  <button className="del-btn" onClick={() => handleDelete(e.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
