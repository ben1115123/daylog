import { useState } from 'react'
import { CAT_META, formatRM, formatDate } from '../utils.js'

/* Top-merchant rows that expand inline to the individual transactions behind
   the total. Used both on the Insights overview and inside a month's detail
   pane, so `idPrefix` keeps the two from sharing an expanded row. */
export default function MerchantList({ rows, total, expenses, idPrefix = '' }) {
  const [open, setOpen] = useState(null)

  if (!rows.length) return <div className="empty">no expenses yet</div>

  return (
    <div className="card">
      {rows.map(([desc, amount], i) => {
        const pct = total > 0 ? Math.round((amount / total) * 100) : 0
        const id = idPrefix + desc
        const isOpen = open === id
        const items = isOpen
          ? expenses
              .filter(e => e.description === desc)
              .sort((a, b) => (a.date < b.date ? 1 : -1))
          : []

        return (
          <div key={id} className={`merchant-group ${i < rows.length - 1 ? 'bordered' : ''}`}>
            <button
              className={`merchant-row${isOpen ? ' open' : ''}`}
              onClick={() => setOpen(isOpen ? null : id)}
              aria-expanded={isOpen}
            >
              <span className="merchant-rank">#{i + 1}</span>
              <span className="merchant-name">{desc}</span>
              <span className="merchant-pct">{pct}%</span>
              <span className="merchant-amount">{formatRM(amount)}</span>
              <span className="merchant-caret" aria-hidden="true">›</span>
            </button>

            {/* grid-template-rows 0fr -> 1fr animates to the row's natural
                height without measuring it or hardcoding a max-height. */}
            <div className={`merchant-expand${isOpen ? ' open' : ''}`}>
              <div className="merchant-expand-inner">
                {items.map(e => {
                  const meta = CAT_META[e.category]
                  return (
                    <div key={e.id} className="merchant-txn">
                      <span className="merchant-txn-dot" style={{ background: meta?.color || 'var(--text3)' }} />
                      <span className="merchant-txn-date">{formatDate(e.date)}</span>
                      {e.notes && <span className="merchant-txn-note">{e.notes}</span>}
                      <span className="merchant-txn-amount">{formatRM(e.amount)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
