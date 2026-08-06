import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './Sheet.css'
import { XIcon } from '../Icons.jsx'
import useDragDismiss from '../hooks/useDragDismiss.js'

// iOS shows a ‹ › Done accessory toolbar above the keyboard for text/number
// inputs — it isn't reflected in visualViewport, so pad for it manually.
const KEYBOARD_ACCESSORY_HEIGHT = 44

export default function Sheet({ title, onClose, children, footer, className = '' }) {
  const { handlers: dragHandlers, offset: dragY, dragging } = useDragDismiss({
    axis: 'y',
    threshold: 80,
    onDismiss: onClose,
  })
  const [kbOffset, setKbOffset] = useState(0)
  const [vvHeight, setVvHeight] = useState(() => window.visualViewport?.height ?? window.innerHeight)
  const sheetRef = useRef(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKbOffset(offset)
      setVvHeight(vv.height)
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    onResize()
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    }
  }, [])

  // Keep whichever field is focused visible above the keyboard for every
  // input in every sheet (amount, description, notes, title, etc).
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const onFocusIn = (e) => {
      if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      setTimeout(() => {
        e.target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 300)
    }
    el.addEventListener('focusin', onFocusIn)
    return () => el.removeEventListener('focusin', onFocusIn)
  }, [])

  const keyboardOpen = kbOffset > 0
  const accessory = keyboardOpen ? KEYBOARD_ACCESSORY_HEIGHT : 0
  const transform = `translateY(${dragY}px)`
  const sheetStyle = {
    transform,
    transition: dragging ? 'none' : 'transform 0.2s ease, bottom 0.2s ease, max-height 0.2s ease',
    ...(keyboardOpen && {
      bottom: `${kbOffset + accessory}px`,
      maxHeight: `min(90dvh, ${vvHeight - accessory - 16}px)`,
    }),
  }

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={sheetRef}
        className={`sheet${className ? ' ' + className : ''}`}
        style={sheetStyle}
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-drag-region" {...dragHandlers}>
          <div className="sheet-handle" />
          <div className="sheet-header">
            <div className="sheet-title">{title}</div>
            <button className="sheet-close" onClick={onClose} aria-label="Close">
              <XIcon size={16} />
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
