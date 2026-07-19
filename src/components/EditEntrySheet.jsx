import { useRef, useState } from 'react'
import Sheet from './Sheet.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import AmountInput from './AmountInput.jsx'
import CategoryChipRow from './CategoryChipRow.jsx'
import DateChipRow from './DateChipRow.jsx'
import { CATEGORIES, CAT_META, INCOME_CATEGORIES, EVENT_CATS } from '../utils.js'
import { CAT_ICONS, CheckIcon } from '../Icons.jsx'

const TITLES = { expense: 'Edit expense', income: 'Edit income', event: 'Edit event' }
const EVENT_CAT_LIST = ['', ...Object.keys(EVENT_CATS)]
const EVENT_CAT_META = { '': { label: 'No category', color: 'var(--text3)' }, ...EVENT_CATS }

export default function EditEntrySheet({ entry, onSave, onDelete, onClose }) {
  const isEvent = entry._type === 'event'
  const initial = {
    description: entry.description || entry.title || '',
    amount: entry.amount != null ? String(entry.amount) : '',
    category: entry.category || (entry._type === 'income' ? INCOME_CATEGORIES[0] : entry._type === 'event' ? '' : CATEGORIES[0]),
    date: entry.date || '',
    time: entry.time || '',
    notes: entry.notes || '',
  }
  const initialRef = useRef(initial)
  const [form, setForm]           = useState(initial)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [saved, setSaved]         = useState(false)

  const dirty = Object.keys(initialRef.current).some(k => form[k] !== initialRef.current[k])

  const canSave = dirty && (isEvent
    ? form.description.trim() && form.date
    : form.description.trim() && form.amount !== '' && form.date)

  const handleSave = async () => {
    if (isEvent) {
      await onSave({
        title: form.description.trim(),
        date: form.date,
        time: form.time || null,
        category: form.category || null,
        notes: form.notes.trim() || null,
      })
    } else {
      await onSave({
        description: form.description.trim(),
        amount: parseFloat(form.amount) || 0,
        category: form.category,
        date: form.date,
        notes: form.notes.trim() || null,
      })
    }
    setSaved(true)
    setTimeout(onClose, 250)
  }

  const requestClose = () => {
    if (dirty) setDiscardOpen(true)
    else onClose()
  }

  const categoryProps = entry._type === 'income'
    ? { categories: INCOME_CATEGORIES, meta: CAT_META, icons: CAT_ICONS }
    : entry._type === 'event'
    ? { categories: EVENT_CAT_LIST, meta: EVENT_CAT_META, icons: CAT_ICONS }
    : { categories: CATEGORIES, meta: CAT_META, icons: CAT_ICONS }

  return (
    <Sheet title={TITLES[entry._type]} onClose={requestClose}>
      {!isEvent && (
        <AmountInput
          value={form.amount}
          onChange={v => setForm(f => ({ ...f, amount: v }))}
        />
      )}

      <div>
        <div className="sheet-field-label">{isEvent ? 'Title' : 'Description'}</div>
        <input
          className="sheet-input"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>

      <div>
        <div className="sheet-field-label">Date</div>
        <DateChipRow
          value={form.date}
          onChange={date => setForm(f => ({ ...f, date }))}
        />
      </div>

      {isEvent && (
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
      )}

      <div>
        <div className="sheet-field-label">Category</div>
        <CategoryChipRow
          {...categoryProps}
          value={form.category}
          onChange={category => setForm(f => ({ ...f, category }))}
        />
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
        <button className="sheet-cancel" onClick={requestClose}>Cancel</button>
        <button
          className="sheet-save"
          disabled={!canSave || saved}
          style={{ opacity: canSave || saved ? 1 : 0.5 }}
          onClick={handleSave}
        >
          {saved ? <CheckIcon size={16} /> : 'Save'}
        </button>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title="Delete this entry?"
          message="You can undo this from the toast after deleting."
          confirmLabel="Delete"
          danger
          onConfirm={onDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      {discardOpen && (
        <ConfirmDialog
          title="Discard changes?"
          message="Your edits will be lost."
          confirmLabel="Discard"
          danger
          onConfirm={onClose}
          onCancel={() => setDiscardOpen(false)}
        />
      )}
    </Sheet>
  )
}
