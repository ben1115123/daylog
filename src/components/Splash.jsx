import { useEffect, useState } from 'react'
import DLMark from './DLMark.jsx'
import './Splash.css'

const REDUCED_MOTION = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function Splash({ onDone }) {
  const [logoVis, setLogoVis]       = useState(false)
  const [taglineVis, setTaglineVis] = useState(false)
  const [dotsVis, setDotsVis]       = useState(false)
  const [exiting, setExiting]       = useState(false)

  useEffect(() => {
    const t = [
      setTimeout(() => setLogoVis(true), 400),
      setTimeout(() => setTaglineVis(true), 700),
      setTimeout(() => setDotsVis(true), 900),
      setTimeout(() => setExiting(true), 2200),
      setTimeout(onDone, 2600),
    ]
    return () => t.forEach(clearTimeout)
  }, [onDone])

  return (
    <div className={`splash${exiting ? ' splash-exit' : ''}`}>
      <svg
        className="splash-orbit"
        viewBox="0 0 400 400"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter id="orbitBlur1" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id="orbitBlur2" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id="orbitBlur3" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="orbitBlur4" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        <g transform="rotate(0 200 200)">
          <g>
            {!REDUCED_MOTION && (
              <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="8s" repeatCount="indefinite" />
            )}
            <ellipse cx="200" cy="200" rx="72" ry="20" fill="none" stroke="#0066ff" strokeWidth="22" opacity="0.7" filter="url(#orbitBlur1)" />
          </g>
        </g>

        <g transform="rotate(60 200 200)">
          <g>
            {!REDUCED_MOTION && (
              <animateTransform attributeName="transform" type="rotate" from="360 200 200" to="0 200 200" dur="6s" repeatCount="indefinite" />
            )}
            <ellipse cx="200" cy="200" rx="72" ry="20" fill="none" stroke="#ff5500" strokeWidth="12" opacity="0.6" filter="url(#orbitBlur2)" />
          </g>
        </g>

        <g transform="rotate(120 200 200)">
          <g>
            {!REDUCED_MOTION && (
              <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="10s" repeatCount="indefinite" />
            )}
            <ellipse cx="200" cy="200" rx="72" ry="20" fill="none" stroke="#00e5ff" strokeWidth="8" opacity="0.45" filter="url(#orbitBlur3)" />
          </g>
        </g>

        <g transform="rotate(150 200 200)">
          <g>
            {!REDUCED_MOTION && (
              <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="5s" repeatCount="indefinite" />
            )}
            <ellipse cx="200" cy="200" rx="72" ry="20" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.5" filter="url(#orbitBlur4)" />
          </g>
        </g>
      </svg>

      <div className="splash-glow" />
      <div className="splash-vignette" />
      <div className="splash-fade-top" />
      <div className="splash-fade-bottom" />

      <div className="splash-core">
        <div className={`splash-logo${logoVis ? ' vis' : ''}`}><DLMark /></div>
        <div className={`splash-tagline${taglineVis ? ' vis' : ''}`}>your day · your money</div>
        <div className={`splash-dots${dotsVis ? ' vis' : ''}`}>
          <span className="sdot sdot-blue" />
          <span className="sdot" />
          <span className="sdot" />
        </div>
      </div>
    </div>
  )
}
