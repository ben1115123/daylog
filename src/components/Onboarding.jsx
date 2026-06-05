import { useState, useRef, useEffect } from 'react'
import './Onboarding.css'

export default function Onboarding({ onComplete }) {
  const [step, setStep]     = useState(0)
  const [name, setName]     = useState('')
  const [income, setIncome] = useState('')
  const [budget, setBudget] = useState('3500')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [step])

  const steps = [
    {
      label: '01 / 03',
      heading: 'What should I\ncall you?',
      sub: 'Personalises your daily greeting.',
      canNext: name.trim().length > 0,
      field: (
        <input
          ref={inputRef}
          className="ob-input"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && goNext()}
          autoComplete="given-name"
        />
      ),
    },
    {
      label: '02 / 03',
      heading: "Monthly\nincome?",
      sub: 'Used to calculate your savings rate. Optional — tap Next to skip.',
      canNext: true,
      field: (
        <div className="ob-amount-row">
          <span className="ob-currency">RM</span>
          <input
            ref={inputRef}
            className="ob-input ob-amount"
            type="number"
            placeholder="0"
            value={income}
            onChange={e => setIncome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && goNext()}
            inputMode="numeric"
          />
        </div>
      ),
    },
    {
      label: '03 / 03',
      heading: 'Monthly\nbudget?',
      sub: 'Your spending limit per month.',
      canNext: true,
      field: (
        <div className="ob-amount-row">
          <span className="ob-currency">RM</span>
          <input
            ref={inputRef}
            className="ob-input ob-amount"
            type="number"
            placeholder="3500"
            value={budget}
            onChange={e => setBudget(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && goNext()}
            inputMode="numeric"
          />
        </div>
      ),
    },
  ]

  const current = steps[step]
  const isLast  = step === steps.length - 1

  const goNext = () => {
    if (!current.canNext) return
    if (!isLast) { setStep(s => s + 1); return }
    onComplete(
      name.trim() || 'You',
      parseFloat(income) || 0,
      parseFloat(budget) || 3500
    )
  }

  return (
    <div className="onboarding">
      <div className="ob-inner">
        <div className="ob-step-label">{current.label}</div>

        <h1 className="ob-heading">
          {current.heading.split('\n').map((line, i) => (
            <span key={i}>{line}<br/></span>
          ))}
        </h1>

        <p className="ob-sub">{current.sub}</p>

        <div className="ob-field">{current.field}</div>
      </div>

      <div className="ob-footer">
        <div className="ob-dots">
          {steps.map((_, i) => (
            <div key={i} className={`ob-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
          ))}
        </div>
        <div className="ob-btn-row">
          {step > 0 && (
            <button className="ob-back" onClick={() => setStep(s => s - 1)}>Back</button>
          )}
          <button
            className={`ob-next ${!current.canNext ? 'disabled' : ''}`}
            onClick={goNext}
            disabled={!current.canNext}
          >
            {isLast ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
