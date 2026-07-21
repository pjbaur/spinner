import { useEffect, useRef, useState } from 'react'
import { buildSegments, computeLandingRotation } from './jerryWheelMath.js'
import './AssignmentWheel.css'

const SPIN_DURATION_MS = 4200

function hintText(spinning, hasResult) {
  if (spinning) return 'assigning…'
  return hasResult ? 'click to re-spin' : 'click to spin'
}

export default function AssignmentWheel({
  title,
  labels,
  colors,
  hasResult,
  sound,
  onSpinEnd,
  randomFn = Math.random,
}) {
  const [spinning, setSpinning] = useState(false)
  const rotationRef = useRef(0)
  const groupRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const segments = buildSegments(labels, colors)
  const n = labels.length
  const step = 360 / n

  function handleSpin() {
    if (spinning) return
    sound.ensureAudio()
    const targetIndex = Math.floor(randomFn() * n)
    const spins = 5 + Math.floor(randomFn() * 3)
    const start = rotationRef.current
    const end = computeLandingRotation(start, targetIndex, n, spins)
    const delta = end - start
    const ease = (x) => 1 - Math.pow(1 - x, 3)
    const t0 = performance.now()
    let lastSeg = Math.floor((((start % 360) + 360) % 360) / step)
    setSpinning(true)
    const frame = (now) => {
      let p = (now - t0) / SPIN_DURATION_MS
      if (p > 1) p = 1
      const cur = start + delta * ease(p)
      if (groupRef.current)
        groupRef.current.style.transform = `rotate(${cur}deg)`
      const segNow = Math.floor((((cur % 360) + 360) % 360) / step)
      if (segNow !== lastSeg) {
        lastSeg = segNow
        sound.tick()
      }
      if (p < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        rotationRef.current = end
        rafRef.current = null
        sound.ding()
        setSpinning(false)
        onSpinEnd(targetIndex)
      }
    }
    rafRef.current = requestAnimationFrame(frame)
  }

  return (
    <div className="assignment-wheel">
      <div className="assignment-wheel__plaque">{title}</div>
      <div className="assignment-wheel__stage">
        <div className="assignment-wheel__pointer" />
        <button
          type="button"
          className="assignment-wheel__disc"
          aria-label={`Spin the ${title} wheel`}
          disabled={spinning}
          onClick={handleSpin}
        >
          <svg viewBox="0 0 320 320" className="assignment-wheel__svg">
            <g
              ref={groupRef}
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'center',
                willChange: 'transform',
              }}
            >
              {segments.map((s, i) => (
                <path
                  key={i}
                  d={s.d}
                  fill={s.fill}
                  stroke="rgba(238,240,230,0.20)"
                  strokeWidth="1.5"
                />
              ))}
              {segments.map((s, i) => (
                <text
                  key={i}
                  transform={s.textTransform}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="assignment-wheel__label"
                >
                  {s.label}
                </text>
              ))}
            </g>
            <circle
              cx="160"
              cy="160"
              r="21"
              fill="#6f4b2a"
              stroke="#2f1e0c"
              strokeWidth="3"
            />
            <circle
              cx="160"
              cy="160"
              r="8"
              fill="#caa24b"
              stroke="#8a6a24"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>
      <div className="assignment-wheel__hint">
        {hintText(spinning, hasResult)}
      </div>
    </div>
  )
}
