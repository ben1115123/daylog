import { useRef } from 'react'

function formatThousands(raw) {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${withSep}.${decPart}` : withSep
}

export default function AmountInput({ value, onChange }) {
  const inputRef = useRef(null)

  const handleChange = (e) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
      onChange(raw)
    }
  }

  return (
    <div className="amount-input-wrap" onClick={() => inputRef.current?.focus()}>
      <span className="amount-input-prefix">RM</span>
      <input
        ref={inputRef}
        className="amount-input"
        type="text"
        inputMode="decimal"
        value={formatThousands(value)}
        onChange={handleChange}
        onFocus={(e) => e.target.select()}
        placeholder="0"
      />
    </div>
  )
}
