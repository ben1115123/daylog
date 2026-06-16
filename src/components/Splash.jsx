import { useEffect, useState } from 'react'
import DLMark from './DLMark.jsx'
import './Splash.css'

export default function Splash({ onDone }) {
  const [phase, setPhase] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 500),
      setTimeout(() => setPhase(3), 800),
      setTimeout(() => setPhase(4), 1000),
      setTimeout(() => setExiting(true), 1550),
      setTimeout(onDone, 1900),
    ]
    return () => t.forEach(clearTimeout)
  }, [onDone])

  return (
    <div className={`splash${exiting ? ' splash-exit' : ''}`}>
      <div className="splash-inner">
        <div className="splash-logo"><DLMark /></div>
        <div className={`splash-line${phase >= 1 ? ' vis' : ''}`} />
        <div className={`splash-wordmark${phase >= 2 ? ' vis' : ''}`}>DAYLOG</div>
        <div className={`splash-tagline${phase >= 3 ? ' vis' : ''}`}>your day. your money.</div>
        <div className={`splash-dots${phase >= 4 ? ' vis' : ''}`}>
          <span className="sdot sdot-blue" />
          <span className="sdot" />
          <span className="sdot" />
        </div>
      </div>
    </div>
  )
}
