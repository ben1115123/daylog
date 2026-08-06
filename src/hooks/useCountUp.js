import { useState, useEffect, useRef } from 'react'

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/* Animates to `target` from whatever is currently on screen — not from 0.
 *
 * The first real value still gets the long count-up; every later change eases
 * over `change` ms. "First real value" deliberately means the first *non-zero*
 * target: screens render with 0 while data loads, and without this a load
 * finishing would burn the mount animation on 0 -> 0 and leave the actual
 * number to snap in over 400ms. */
export function useCountUp(target, { mount = 1200, change = 400 } = {}) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)
  const shownRef = useRef(0)
  const hasCountedUpRef = useRef(false)

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    const from = shownRef.current
    const to = Number.isFinite(target) ? target : 0
    const duration = hasCountedUpRef.current ? change : mount
    if (to !== 0) hasCountedUpRef.current = true

    if (from === to || prefersReducedMotion()) {
      shownRef.current = to
      setValue(to)
      return
    }

    const start = performance.now()
    const tick = now => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const v = Math.round(from + (to - from) * eased)
      shownRef.current = v
      setValue(v)
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, mount, change])

  return value
}
