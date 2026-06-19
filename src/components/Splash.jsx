import { useEffect, useState } from 'react'
import DLMark from './DLMark.jsx'
import './Splash.css'

const REDUCED_MOTION = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function Splash({ onDone }) {
  const [logoVis, setLogoVis]       = useState(false)
  const [taglineVis, setTaglineVis] = useState(false)
  const [exiting, setExiting]       = useState(false)

  useEffect(() => {
    const t = [
      setTimeout(() => setLogoVis(true), 600),
      setTimeout(() => setTaglineVis(true), 900),
      setTimeout(() => setExiting(true), 2150),
      setTimeout(onDone, 2500),
    ]
    return () => t.forEach(clearTimeout)
  }, [onDone])

  return (
    <div className={`splash${exiting ? ' splash-exit' : ''}`}>
      <svg className="splash-orb" viewBox="0 0 300 300" width="240" height="240" aria-hidden="true">
        <defs>
          <radialGradient id="outerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6b21a8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6b21a8" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="innerShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="72%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
          </radialGradient>

          <linearGradient id="blob1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <linearGradient id="blob2Grad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e879f9" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <linearGradient id="blob3Grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>

          <filter id="sphereGlowBlur" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="18" />
          </filter>

          <filter id="morph1" x="-60%" y="-60%" width="220%" height="220%">
            <feTurbulence type="turbulence" baseFrequency="0.015" numOctaves="3" seed="2" result="turb1">
              {!REDUCED_MOTION && (
                <animate attributeName="baseFrequency" values="0.015;0.025;0.015" dur="8s" repeatCount="indefinite" />
              )}
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="turb1" scale="30" />
          </filter>
          <filter id="morph2" x="-60%" y="-60%" width="220%" height="220%">
            <feTurbulence type="turbulence" baseFrequency="0.018" numOctaves="3" seed="5" result="turb2">
              {!REDUCED_MOTION && (
                <animate attributeName="baseFrequency" values="0.018;0.03;0.018" dur="11s" repeatCount="indefinite" />
              )}
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="turb2" scale="24" />
          </filter>
          <filter id="morph3" x="-60%" y="-60%" width="220%" height="220%">
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="3" seed="9" result="turb3">
              {!REDUCED_MOTION && (
                <animate attributeName="baseFrequency" values="0.02;0.034;0.02" dur="6s" repeatCount="indefinite" />
              )}
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="turb3" scale="20" />
          </filter>

          <filter id="bloom1" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur1" />
            <feComposite in="SourceGraphic" in2="blur1" operator="over" />
          </filter>
          <filter id="bloom2" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur2" />
            <feComposite in="SourceGraphic" in2="blur2" operator="over" />
          </filter>
          <filter id="bloom3" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur3" />
            <feComposite in="SourceGraphic" in2="blur3" operator="over" />
          </filter>

          <filter id="specularBlur" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>

          <clipPath id="sphereClip">
            <circle cx="150" cy="150" r="95" />
          </clipPath>
        </defs>

        {/* outer purple glow behind the sphere */}
        <circle cx="150" cy="150" r="130" fill="url(#outerGlow)" filter="url(#sphereGlowBlur)" />

        {/* fluid blobs, clipped inside the sphere */}
        <g clipPath="url(#sphereClip)">
          <g filter="url(#bloom1)">
            <g>
              {!REDUCED_MOTION && (
                <animateTransform attributeName="transform" type="rotate" from="0 150 150" to="360 150 150" dur="12s" repeatCount="indefinite" />
              )}
              <ellipse cx="135" cy="130" rx="58" ry="78" fill="url(#blob1Grad)" filter="url(#morph1)" style={{ mixBlendMode: 'screen' }} />
            </g>
          </g>

          <g filter="url(#bloom2)">
            <g>
              {!REDUCED_MOTION && (
                <animateTransform attributeName="transform" type="rotate" from="360 150 150" to="0 150 150" dur="18s" repeatCount="indefinite" />
              )}
              <ellipse cx="172" cy="168" rx="42" ry="50" fill="url(#blob2Grad)" filter="url(#morph2)" style={{ mixBlendMode: 'screen' }} />
            </g>
          </g>

          <g filter="url(#bloom3)">
            <g>
              {!REDUCED_MOTION && (
                <animateTransform attributeName="transform" type="rotate" from="0 150 150" to="360 150 150" dur="8s" repeatCount="indefinite" />
              )}
              <ellipse cx="158" cy="178" rx="66" ry="34" fill="url(#blob3Grad)" filter="url(#morph3)" style={{ mixBlendMode: 'lighten' }} />
            </g>
          </g>

          {/* specular highlight, top-left, for the glass-sphere feel */}
          <ellipse cx="116" cy="114" rx="26" ry="18" fill="#ffffff" opacity="0.55" filter="url(#specularBlur)" />

          {/* inner shadow toward the rim for depth */}
          <circle cx="150" cy="150" r="95" fill="url(#innerShadow)" />
        </g>

        {/* crisp sphere border on top */}
        <circle cx="150" cy="150" r="95" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1" />
      </svg>

      <div className="splash-core">
        <div className={`splash-logo${logoVis ? ' vis' : ''}`}><DLMark /></div>
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
