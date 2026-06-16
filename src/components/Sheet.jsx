import './Sheet.css'
import { XIcon } from '../Icons.jsx'

export default function Sheet({ title, onClose, children }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className="sheet-title">{title}</div>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            <XIcon size={16} />
          </button>
        </div>
        <div className="sheet-scroll">
          <div className="sheet-body">{children}</div>
        </div>
      </div>
    </div>
  )
}
