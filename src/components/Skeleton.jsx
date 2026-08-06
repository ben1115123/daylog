import './Skeleton.css'

/* A placeholder surface. Sized by the caller to match the real content it
   stands in for — see the zero-layout-shift requirement in the plan. */
export default function Skeleton({ w = '100%', h = 12, r = 6, style }) {
  const px = v => (typeof v === 'number' ? `${v}px` : v)
  return (
    <div
      className="skeleton"
      aria-hidden="true"
      style={{ width: px(w), height: px(h), borderRadius: px(r), ...style }}
    />
  )
}
