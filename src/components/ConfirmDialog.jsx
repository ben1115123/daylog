import { createPortal } from 'react-dom'
import './ConfirmDialog.css'

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  return createPortal(
    <div className="confirm-backdrop" onClick={onCancel}>
      <div className="confirm-card" onClick={e => e.stopPropagation()}>
        {title && <div className="confirm-title">{title}</div>}
        {message && <div className="confirm-message">{message}</div>}
        <div className="confirm-actions">
          <button className="sheet-cancel" onClick={onCancel}>Cancel</button>
          <button className={`sheet-save${danger ? ' confirm-danger' : ''}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
