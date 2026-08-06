import { useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CAT_META, formatRM, monthLabel } from '../utils.js'
import { CAT_ICONS, BackIcon } from '../Icons.jsx'
import { parseISODate } from '../lib/dates.js'
import MerchantList from './MerchantList.jsx'
import useDragDismiss from '../hooks/useDragDismiss.js'

/* Past a fifth of the pane (capped) the month commits on release. */
const COMMIT_FRACTION = 0.2
const COMMIT_MAX = 64
/* Rubber-band factor when dragging past the first or last month. */
const OVERSCROLL = 0.3

export function monthBreakdown(expenses) {
  const byCat = {}
  expenses.forEach(e => {
    const cat = e.category || 'other'
    byCat[cat] = (byCat[cat] || 0) + (e.amount || 0)
  })
  return Object.entries(byCat).sort((a, b) => b[1] - a[1])
}

export function topMerchants(expenses, limit = 5) {
  const byName = {}
  expenses.forEach(e => {
    if (!e.description) return
    byName[e.description] = (byName[e.description] || 0) + (e.amount || 0)
  })
  return Object.entries(byName).sort((a, b) => b[1] - a[1]).slice(0, limit)
}

function MonthPane({ month, expenses, active }) {
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const cats = useMemo(() => monthBreakdown(expenses), [expenses])
  const merchants = useMemo(() => topMerchants(expenses), [expenses])
  const max = cats.length ? cats[0][1] : 1

  return (
    /* Only the visible pane is reachable by tab / screen reader — the others
       are laid out beside it, not hidden, so they would otherwise be focusable
       off-screen. */
    <div className="md-pane" aria-hidden={!active} {...(active ? {} : { inert: '' })}>
      <div className="md-total">
        <div className="md-total-label">total spent</div>
        <div className="md-total-value">{formatRM(total)}</div>
        <div className="md-total-sub">{expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}</div>
      </div>

      <div className="md-block">
        <div className="section-label">Categories</div>
        {cats.length === 0 ? (
          <div className="empty">nothing logged in {monthLabel(month.year, month.month)}</div>
        ) : (
          <div className="card">
            {cats.map(([cat, amount], i) => {
              const meta = CAT_META[cat]
              const Icon = CAT_ICONS[cat]
              const color = meta?.color || 'var(--text3)'
              return (
                <div key={cat} className={`md-cat-row ${i < cats.length - 1 ? 'bordered' : ''}`}>
                  <span className="entry-icon-wrap" style={{ color, background: color + '18' }}>
                    {Icon && <Icon size={14} />}
                  </span>
                  <div className="md-cat-body">
                    <div className="md-cat-top">
                      <span className="md-cat-name">{meta?.label || cat}</span>
                      <span className="md-cat-amount">{formatRM(amount)}</span>
                    </div>
                    <div className="md-cat-track">
                      <div
                        className="md-cat-fill"
                        style={{ width: `${Math.max((amount / max) * 100, 2)}%`, background: color }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="md-block">
        <div className="section-label">Top merchants</div>
        <MerchantList rows={merchants} total={total} expenses={expenses} idPrefix={month.key} />
      </div>
    </div>
  )
}

export default function InsightsMonthDetail({ months, index, expensesFor, onIndex, onClose }) {
  const viewportRef = useRef(null)

  const month = months[index]

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && index < months.length - 1) onIndex(index + 1)
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, months.length, onIndex, onClose])

  /* Rubber-band past the first and last month instead of letting the track
     drag freely off its own ends. */
  const clamp = useCallback(raw => {
    const atStart = index === 0 && raw > 0
    const atEnd = index === months.length - 1 && raw < 0
    return atStart || atEnd ? raw * OVERSCROLL : raw
  }, [index, months.length])

  const { handlers: dragHandlers, offset: drag, dragging } = useDragDismiss({
    axis: 'x',
    clamp,
    onEnd: ({ offset }) => {
      const width = viewportRef.current?.clientWidth || 1
      const commit = Math.min(COMMIT_MAX, width * COMMIT_FRACTION)
      if (offset <= -commit && index < months.length - 1) onIndex(index + 1)
      else if (offset >= commit && index > 0) onIndex(index - 1)
    },
  })

  return createPortal(
    /* Portalled to <body> for the same reason Sheet is: .screen runs a
       transform-based fadeIn, and a transformed ancestor would turn this
       position:fixed panel into a position:absolute one. */
    <div className="md-panel" role="dialog" aria-label={`${monthLabel(month.year, month.month)} ${month.year} detail`}>
      <div className="md-head">
        <button className="md-back" onClick={onClose}><BackIcon /> insights</button>
        <div className="md-head-month">
          <button
            className="md-step"
            onClick={() => onIndex(index - 1)}
            disabled={index === 0}
            aria-label="Previous month"
          >‹</button>
          <span className="md-head-label">{monthLabel(month.year, month.month)} {month.year}</span>
          <button
            className="md-step"
            onClick={() => onIndex(index + 1)}
            disabled={index === months.length - 1}
            aria-label="Next month"
          >›</button>
        </div>
        <div className="md-dots">
          {months.map((m, i) => (
            <span key={m.key} className={`md-dot${i === index ? ' on' : ''}`} />
          ))}
        </div>
      </div>

      <div
        className="md-viewport"
        ref={viewportRef}
        {...dragHandlers}
      >
        <div
          className={`md-track${dragging ? ' dragging' : ''}`}
          style={{ transform: `translate3d(calc(${-index * 100}% + ${drag}px), 0, 0)` }}
        >
          {months.map((m, i) => (
            <MonthPane key={m.key} month={m} expenses={expensesFor(m.key)} active={i === index} />
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
