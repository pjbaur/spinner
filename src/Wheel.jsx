import { useWheelItems } from './useWheelItems.js'
import { getSliceColor, buildSliceAngles, describeSlicePath } from './wheelMath.js'
import './Wheel.css'

const CENTER = 150
const RADIUS = 150
const LABEL_RADIUS = 95

export default function Wheel({ storageKey, defaultItems }) {
  const [items] = useWheelItems(storageKey, defaultItems)
  const angles = buildSliceAngles(items.length || 1)

  return (
    <div className="wheel-panel">
      <div className="wheel-wrapper">
        <svg data-testid="wheel-svg" viewBox="0 0 300 300" className="wheel-svg">
          {items.map((item, i) => (
            <path
              key={i}
              d={describeSlicePath(CENTER, CENTER, RADIUS, angles[i].start, angles[i].end)}
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
              >
                {item}
              </text>
            )
          })}
        </svg>
        <div className="wheel-pointer" />
      </div>
    </div>
  )
}
