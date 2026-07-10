import { useState } from 'react'
import Sheet from './Sheet.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { CATEGORIES, CAT_META, INCOME_CATEGORIES } from '../utils.js'

const TITLES = { expense: 'Edit expense', income: 'Edit income', event: 'Edit event' }

export default function EditEntrySheet({ entry, onSave, onDelete, onClose }) {
  const isEvent = entry._type === 'event'
  const [form, setForm] = useState({
    description: entry.description || entry.title || '',
    amount: entry.amount ?? '',
    category: entry.category || (entry._type === 'income' ? INCOME_CATEGORIES[0] : CATEGORIES[0]),
    date: entry.date || '',
    time: entry.time || '',
    notes: entry.notes || '',
  })
  const [confirmOpen, setConfirmOpen] = useState(false)

  const canSave = isEvent
    ? form.description.trim() && form.date
    : form.description.trim() && form.amount && form.date

  const handleSave = () => {
    if (isEvent) {
      onSave({
        title: form.description.trim(),
        date: form.date,
        time: form.time || null,
        category: form.category || null,
        notes: form.notes.trim() || null,
      })
    } else {
      onSave({
        description: form.description.trim(),
        amount: parseFloat(form.amount) || 0,
        category: form.category,
        date: form.date,
        notes: form.notes.trim() || null,
      })
    }
  }

  return (
    <Sheet title={TITLES[entry._type]} onClose={onClose}>
      <div>
        <div className="sheet-field-label">{isEvent ? 'Title' : 'Description'}</div>
        <input
          className="sheet-input"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>

      {!isEvent && (
        <div className="sheet-row">
          <div>
            <div className="sheet-field-label">Amount (RM)</div>
            <input
              className="sheet-input"
              type="number"
              inputMode="decimal"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
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
      )}

      {isEvent && (
        <div className="sheet-row">
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
          <div>
            <div className="sheet-field-label">Time</div>
            <input
              className="sheet-input"
              type="time"
              value={form.time}
              onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>
      )}

      <div>
        <div className="sheet-field-label">Category</div>
        <select
          className="sheet-select"
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        >
          {entry._type === 'income'
            ? INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c === 'salary' ? 'Salary' : 'Trading'}</option>)
            : CATEGORIES.map(c => <option key={c} value={c}>{CAT_META[c]?.label}</option>)}
        </select>
      </div>

      <div>
        <div className="sheet-field-label">Notes (optional)</div>
        <input
          className="sheet-input"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />
      </div>

      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <button className="data-btn danger" onClick={() => setConfirmOpen(true)}>Delete</button>
      </div>

      <div className="sheet-actions">
        <button className="sheet-cancel" onClick={onClose}>Cancel</button>
        <button
          className="sheet-save"
          disabled={!canSave}
          style={{ opacity: canSave ? 1 : 0.5 }}
          onClick={handleSave}
        >
          Save
        </button>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title="Delete this entry?"
          message="This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={onDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </Sheet>
  )
}
