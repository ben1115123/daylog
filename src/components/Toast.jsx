import './Toast.css'

export default function Toast({ msg, type = 'success' }) {
  return <div className={`toast toast-${type}`}>{msg}</div>
}
