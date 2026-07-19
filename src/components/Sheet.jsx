import { useState, useRef, useEffect } from 'react'
import './Sheet.css'
import { XIcon } from '../Icons.jsx'

const DISMISS_THRESHOLD = 80

export default function Sheet({ title, onClose, children, className = '' }) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [kbOffset, setKbOffset] = useState(0)
  const startY = useRef(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKbOffset(offset)
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    onResize()
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    }
  }, [])

  const onTouchStart = (e) => {
    startY.current = e.touches[0].clientY
    setDragging(true)
  }
  const onTouchMove = (e) => {
    if (!dragging) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) setDragY(delta)
  }
  const onTouchEnd = () => {
    setDragging(false)
    if (dragY > DISMISS_THRESHOLD) onClose()
    setDragY(0)
  }

  const transform = `translateY(${dragY - kbOffset}px)`

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet${className ? ' ' + className : ''}`}
        style={{ transform, transition: dragging ? 'none' : 'transform 0.2s ease' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="sheet-drag-region"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="sheet-handle" />
          <div className="sheet-header">
            <div className="sheet-title">{title}</div>
            <button className="sheet-close" onClick={onClose} aria-label="Close">
              <XIcon size={16} />
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
