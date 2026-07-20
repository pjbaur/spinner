import { useEffect, useRef, useState } from 'react'
import { useWheelItems } from './useWheelItems.js'
import {
  getSliceColor,
  getSliceTextColor,
  buildSliceAngles,
  describeSlicePath,
  pickRandomIndex,
  computeTargetRotation,
  parseItemsFromText,
} from './wheelMath.js'
import './Wheel.css'

const CENTER = 150
const RADIUS = 150
const LABEL_RADIUS = 95
const SPIN_DURATION_MS = 4000

function prefersReducedMotion() {
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

export default function Wheel({ storageKey, defaultItems, name }) {
  const [items, setItems] = useWheelItems(storageKey, defaultItems)
  const [draftText, setDraftText] = useState(items.join('\n'))
  const angles = buildSliceAngles(items.length || 1)

  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState(null)
  const [transitionMs, setTransitionMs] = useState(SPIN_DURATION_MS)
  const pendingWinnerItem = useRef(null)
  const fallbackTimerId = useRef(null)

  function resolveSpin() {
    if (pendingWinnerItem.current === null) return
    clearTimeout(fallbackTimerId.current)
    fallbackTimerId.current = null
    setSpinning(false)
    setWinner(pendingWinnerItem.current)
    pendingWinnerItem.current = null
  }

  function handleSpin() {
    if (spinning || items.length === 0) return
    const winningIndex = pickRandomIndex(items.length)
    const effectiveDuration = prefersReducedMotion() ? 0 : SPIN_DURATION_MS
    pendingWinnerItem.current = items[winningIndex]
    setWinner(null)
    setSpinning(true)
    setTransitionMs(effectiveDuration)
    setRotation((current) =>
      computeTargetRotation(current, winningIndex, items.length),
    )
    fallbackTimerId.current = setTimeout(resolveSpin, effectiveDuration + 500)
  }

  function handleTransitionEnd(e) {
    if (e.propertyName && e.propertyName !== 'transform') return
    resolveSpin()
  }

  useEffect(() => {
    return () => clearTimeout(fallbackTimerId.current)
  }, [])

  function handleEditorBlur() {
    setItems(parseItemsFromText(draftText))
  }

  return (
    <div className="wheel-panel">
      <div className="wheel-wrapper">
        <button
          type="button"
          className="wheel-button"
          aria-label={`Spin ${name}`}
          onClick={handleSpin}
          disabled={spinning || items.length === 0}
        >
          <svg
            data-testid="wheel-svg"
            viewBox="0 0 300 300"
            className="wheel-svg"
            style={{
              transform: `rotate(${rotation}deg)`,
              ...(transitionMs > 0 && {
                transition: `transform ${transitionMs}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`,
              }),
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {items.map((item, i) => (
              <path
                key={i}
                d={describeSlicePath(
                  CENTER,
                  CENTER,
                  RADIUS,
                  angles[i].start,
                  angles[i].end,
                )}
                fill={getSliceColor(i)}
              />
            ))}
            {items.map((item, i) => {
              const theta = (angles[i].mid * Math.PI) / 180
              const x = CENTER + LABEL_RADIUS * Math.sin(theta)
              const y = CENTER - LABEL_RADIUS * Math.cos(theta)
              return (
                <text
                  key={i}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${angles[i].mid}, ${x}, ${y})`}
                  className="wheel-label"
                  fill={getSliceTextColor(i)}
                >
                  {item}
                </text>
              )
            })}
          </svg>
        </button>
        <div className="wheel-pointer" />
      </div>
      {items.length === 0 && (
        <p data-testid="empty-hint" className="wheel-hint">
          Add at least 1 item to spin.
        </p>
      )}
      <p
        data-testid="winner"
        className="wheel-winner"
        role="status"
        aria-live="polite"
      >
        {winner ? `Winner: ${winner}` : ''}
      </p>
      <textarea
        aria-label={`${name} items`}
        className="wheel-editor"
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        onBlur={handleEditorBlur}
        disabled={spinning}
      />
    </div>
  )
}
