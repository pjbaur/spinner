import { useEffect, useRef, useState } from 'react'
import { computeReelLanding, reelTranslateY } from './jerryWheelMath.js'
import './AssignmentReel.css'

const ITEM_H = 58 // reel row height (px)
const COPIES = 12 // strip = label list repeated this many times
const SPIN_DURATION_MS = 3400

function hintText(spinning, hasResult) {
  if (spinning) return 'assigning…'
  return hasResult ? 'tap to re-pull' : 'tap to pull'
}

export default function AssignmentReel({
  title,
  labels,
  windowBg,
  hasResult,
  sound,
  onSpinEnd,
  randomFn = Math.random,
}) {
  const [spinning, setSpinning] = useState(false)
  const posRef = useRef(0) // current normalized index 0..n-1
  const stripRef = useRef(null)
  const rafRef = useRef(null)

  const n = labels.length

  // seat the reel at its current index (and re-seat if the strip re-mounts)
  useEffect(() => {
    if (stripRef.current) {
      stripRef.current.style.transform = `translateY(${reelTranslateY(posRef.current, n, ITEM_H)}px)`
    }
  }, [n])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  function handleSpin() {
    if (spinning) return
    sound.ensureAudio()
    const targetIndex = Math.floor(randomFn() * n)
    const loops = 3 + Math.floor(randomFn() * 3)
    const start = posRef.current
    const end = computeReelLanding(start, targetIndex, n, loops)
    const ease = (x) => 1 - Math.pow(1 - x, 3)
    const t0 = performance.now()
    let lastFloor = Math.floor(start)
    setSpinning(true)
    const frame = (now) => {
      let p = (now - t0) / SPIN_DURATION_MS
      if (p > 1) p = 1
      const j = start + (end - start) * ease(p)
      if (stripRef.current)
        stripRef.current.style.transform = `translateY(${reelTranslateY(j, n, ITEM_H)}px)`
      const fl = Math.floor(j)
      if (fl !== lastFloor) {
        lastFloor = fl
        sound.tick() // each item crossing -> the slot-reel ratchet
      }
      if (p < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        posRef.current = targetIndex // periodic strip -> same visual, normalized
        if (stripRef.current)
          stripRef.current.style.transform = `translateY(${reelTranslateY(targetIndex, n, ITEM_H)}px)`
        rafRef.current = null
        sound.ding()
        setSpinning(false)
        onSpinEnd(targetIndex)
      }
    }
    rafRef.current = requestAnimationFrame(frame)
  }

  const rows = Array.from({ length: COPIES * n }, (_, i) => labels[i % n])

  return (
    <div className="reel">
      <div className="reel__plaque">{title}</div>
      <button
        type="button"
        className="reel__cabinet"
        aria-label={`Pull the ${title} reel`}
        disabled={spinning}
        onClick={handleSpin}
      >
        <div className="reel__window" style={{ background: windowBg }}>
          <div ref={stripRef} className="reel__strip" aria-hidden="true">
            {rows.map((label, i) => (
              <div key={i} className="reel__row">
                {label}
              </div>
            ))}
          </div>
          <div className="reel__fade reel__fade--top" aria-hidden="true" />
          <div className="reel__fade reel__fade--bottom" aria-hidden="true" />
          <div className="reel__slot" aria-hidden="true" />
          <div
            className="reel__pointer reel__pointer--left"
            aria-hidden="true"
          />
          <div
            className="reel__pointer reel__pointer--right"
            aria-hidden="true"
          />
        </div>
      </button>
      <div className="reel__hint">{hintText(spinning, hasResult)}</div>
    </div>
  )
}
