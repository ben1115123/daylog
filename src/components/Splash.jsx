import { useEffect, useState } from 'react'
import DLMark from './DLMark.jsx'
import './Splash.css'

export default function Splash({ onDone }) {
  const [taglineVis, setTaglineVis] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t = [
      setTimeout(() => setTaglineVis(true), 500),
      setTimeout(() => setExiting(true), 1850),
      setTimeout(onDone, 2200),
    ]
    return () => t.forEach(clearTimeout)
  }, [onDone])

  return (
    <div className={`splash${exiting ? ' splash-exit' : ''}`}>
      <svg className="splash-orbits" viewBox="0 0 200 200" width="220" height="220" aria-hidden="true">
        <defs>
          <filter id="splashBlur1" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id="splashBlur2" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <filter id="splashBlur3" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="splashBlurWhite" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <radialGradient id="splashGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a6fff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#1a6fff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="100" cy="100" r="90" fill="url(#splashGlow)" />

        <g className="orbit orbit-1">
          <ellipse cx="100" cy="100" rx="72" ry="20" fill="none" stroke="#0066ff" strokeWidth="22" filter="url(#splashBlur1)" />
        </g>
        <g className="orbit orbit-2" transform="rotate(60 100 100)">
          <ellipse cx="100" cy="100" rx="72" ry="20" fill="none" stroke="#ff5500" strokeWidth="12" filter="url(#splashBlur2)" />
        </g>
        <g className="orbit orbit-3" transform="rotate(120 100 100)">
          <ellipse cx="100" cy="100" rx="72" ry="20" fill="none" stroke="#00e5ff" strokeWidth="8" filter="url(#splashBlur3)" />
        </g>
        <g className="orbit orbit-white">
          <ellipse cx="100" cy="100" rx="72" ry="20" fill="none" stroke="#ffffff" strokeWidth="3" filter="url(#splashBlurWhite)" />
        </g>
      </svg>

      <div className="splash-vignette" />
      <div className="splash-fade-top" />
      <div className="splash-fade-bottom" />

      <div className="splash-core">
        <div className="splash-logo"><DLMark /></div>
        <div className={`splash-tagline${taglineVis ? ' vis' : ''}`}>your day · your money</div>
        <div className={`splash-dots${taglineVis ? ' vis' : ''}`}>
          <span className="sdot sdot-blue" />
          <span className="sdot" />
          <span className="sdot" />
        </div>
      </div>
    </div>
  )
}
