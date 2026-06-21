import { useEffect, useRef, useState } from 'react'
import DLMark from './DLMark.jsx'
import './Splash.css'

const REDUCED_MOTION = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const ELLIPSES = [
  { color: '#0066ff', width: 22,  blur: 12, opacity: 0.7,  speed: 360 / 8000,  offset: 0   },
  { color: '#ff5500', width: 12,  blur: 10, opacity: 0.6,  speed: -360 / 6000, offset: 60  },
  { color: '#00e5ff', width: 8,   blur: 6,  opacity: 0.45, speed: 360 / 10000, offset: 120 },
  { color: '#ffffff', width: 2.5, blur: 4,  opacity: 0.5,  speed: 360 / 5000,  offset: 150 },
]

export default function Splash({ onDone }) {
  const canvasRef = useRef(null)
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

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf
    let running = true

    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas.width  = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    function draw(t) {
      if (!running) return
      const w  = window.innerWidth
      const h  = window.innerHeight
      const cx = w / 2
      const cy = h / 2
      const rx = Math.min(w, h) * 0.32
      const ry = Math.min(w, h) * 0.09

      ctx.clearRect(0, 0, w, h)

      for (const e of ELLIPSES) {
        const angle = ((e.offset + (REDUCED_MOTION ? 0 : t * e.speed)) * Math.PI) / 180
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(angle)
        ctx.filter = `blur(${e.blur}px)`
        ctx.globalAlpha = e.opacity
        ctx.strokeStyle = e.color
        ctx.lineWidth = e.width
        ctx.beginPath()
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className={`splash${exiting ? ' splash-exit' : ''}`}>
      <canvas ref={canvasRef} className="splash-orbit" aria-hidden="true" />

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
