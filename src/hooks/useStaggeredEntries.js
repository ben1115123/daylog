import { useState, useEffect } from 'react'

export function useStaggeredEntries(items) {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    setVisibleCount(0)
    const n = items?.length || 0
    if (!n) return
    const timers = Array.from({ length: n }, (_, i) =>
      setTimeout(() => setVisibleCount(v => Math.max(v, i + 1)), i * 150)
    )
    return () => timers.forEach(clearTimeout)
  }, [items])

  return (i) => i < visibleCount
}
