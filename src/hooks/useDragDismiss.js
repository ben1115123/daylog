import { useRef, useState, useCallback } from 'react'

/* Below this the gesture is a tap, not a drag — and until it is exceeded we
   don't know whether the finger is going sideways or scrolling. */
export const LOCK_SLOP = 8

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/* Pure. Given the gesture's start point, the current point, the axis already
   locked (null until the slop is exceeded), and the axis this consumer cares
   about, return the locked axis and the offset along it.
   Offset is 0 whenever the gesture locked to the *other* axis. */
export function resolveDrag(start, current, lockedAxis, axis) {
  const dx = current.x - start.x
  const dy = current.y - start.y
  let locked = lockedAxis
  if (locked === null) {
    if (Math.abs(dx) < LOCK_SLOP && Math.abs(dy) < LOCK_SLOP) return { axis: null, offset: 0 }
    locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
  }
  if (locked !== axis) return { axis: locked, offset: 0 }
  return { axis: locked, offset: axis === 'y' ? dy : dx }
}

/* One drag implementation for sheets, overlays and the month pager.
 *
 * Pointer events rather than touch events: one code path for finger, mouse and
 * pen, and pointercancel gives us a reliable end when the browser takes the
 * gesture over.
 *
 * The axis is locked once, after LOCK_SLOP, and never revisited — so a
 * diagonal drift part-way through a vertical scroll cannot start dragging the
 * sheet sideways, and vice versa. This is the disambiguation Sheet.jsx never
 * had; it got away with it only because its drag region is the handle and
 * header, with no scroller underneath. */
export default function useDragDismiss({
  axis = 'y',
  threshold = 80,
  onDismiss,
  onEnd,
  clamp,
  enabled = true,
} = {}) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const gesture = useRef(null)
  const offsetRef = useRef(0)

  /* Default gate: a 'y' dismiss only tracks downward drags, so pulling up on a
     sheet does nothing rather than lifting it off its own bottom edge. */
  const apply = useCallback(raw => {
    const next = clamp ? clamp(raw) : (axis === 'y' ? Math.max(0, raw) : raw)
    offsetRef.current = next
    setOffset(next)
  }, [axis, clamp])

  const onPointerDown = useCallback(e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (gesture.current) return
    gesture.current = { x: e.clientX, y: e.clientY, axis: null, pointerId: e.pointerId }
    try { e.target.setPointerCapture(e.pointerId) } catch {}
  }, [])

  const onPointerMove = useCallback(e => {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    const { axis: locked, offset: raw } = resolveDrag(g, { x: e.clientX, y: e.clientY }, g.axis, axis)
    if (locked === null) return
    if (g.axis === null) {
      g.axis = locked
      if (locked === axis) setDragging(true)
    }
    if (g.axis !== axis) return
    apply(raw)
  }, [axis, apply])

  const onPointerUp = useCallback(() => {
    const g = gesture.current
    gesture.current = null
    setDragging(false)
    const final = offsetRef.current
    apply(0)
    if (!g || g.axis !== axis) return
    if (onEnd) { onEnd({ offset: final }); return }
    if (axis === 'y' ? final > threshold : Math.abs(final) > threshold) onDismiss?.()
  }, [axis, apply, onEnd, onDismiss, threshold])

  /* Browser-initiated gesture interruption (e.g. iOS edge-swipe-back, system gesture)
     aborts without calling callbacks. Only the pointerup path may dismiss. */
  const onPointerCancel = useCallback(() => {
    gesture.current = null
    setDragging(false)
    apply(0)
  }, [apply])

  return {
    handlers: enabled
      ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
      : {},
    /* Under reduced motion nothing follows the finger — but `end` still reads
       the real offset from the ref, so a drag past the threshold still
       dismisses. The gesture works; only the animation is gone. */
    offset: prefersReducedMotion() ? 0 : offset,
    dragging,
  }
}
