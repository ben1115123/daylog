import { useEffect, useRef } from 'react'

export default function CategoryChipRow({ categories, meta, icons, value, onChange }) {
  const selectedRef = useRef(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [])

  return (
    <div className="cat-chip-row">
      {categories.map(cat => {
        const Icon = icons[cat]
        const isSelected = value === cat
        return (
          <button
            key={cat || 'none'}
            ref={isSelected ? selectedRef : null}
            type="button"
            className={`cat-chip${isSelected ? ' selected' : ''}`}
            onClick={() => onChange(cat)}
          >
            <span className="cat-chip-dot" style={{ background: meta[cat]?.color }} />
            {Icon && <Icon size={14} />}
            <span className="cat-chip-label">{meta[cat]?.label || 'None'}</span>
          </button>
        )
      })}
    </div>
  )
}
