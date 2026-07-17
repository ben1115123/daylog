import './Toast.css'

export default function Toast({ msg, type = 'success', action }) {
  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-msg">{msg}</span>
      {action && (
        <button
          type="button"
          className="toast-action"
          onClick={(e) => { e.stopPropagation(); action.onClick() }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
