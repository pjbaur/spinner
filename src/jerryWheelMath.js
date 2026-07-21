const CENTER = 160
const RADIUS = 148
const LABEL_RADIUS_FRACTION = 0.56
const FILE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

function toRadians(deg) {
  return (deg * Math.PI) / 180
}

export function buildSegments(labels, colors) {
  const n = labels.length
  const step = 360 / n
  return labels.map((label, i) => {
    const a0 = -90 + i * step
    const a1 = a0 + step
    const mid = a0 + step / 2
    const p0x = CENTER + RADIUS * Math.cos(toRadians(a0))
    const p0y = CENTER + RADIUS * Math.sin(toRadians(a0))
    const p1x = CENTER + RADIUS * Math.cos(toRadians(a1))
    const p1y = CENTER + RADIUS * Math.sin(toRadians(a1))
    const large = step > 180 ? 1 : 0
    const d = `M ${CENTER} ${CENTER} L ${p0x.toFixed(2)} ${p0y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${p1x.toFixed(2)} ${p1y.toFixed(2)} Z`
    const norm = ((mid % 360) + 360) % 360
    const flip = norm > 90 && norm < 270
    const textTransform =
      `translate(${CENTER} ${CENTER}) rotate(${mid.toFixed(2)}) translate(${(RADIUS * LABEL_RADIUS_FRACTION).toFixed(1)} 0)` +
      (flip ? ' rotate(180)' : '')
    return { d, fill: colors[i % colors.length], label, textTransform }
  })
}

export function computeLandingRotation(
  currentRotation,
  targetIndex,
  segmentCount,
  spins,
) {
  const step = 360 / segmentCount
  const targetMod = (((360 - (targetIndex + 0.5) * step) % 360) + 360) % 360
  const curMod = ((currentRotation % 360) + 360) % 360
  const delta = spins * 360 + ((((targetMod - curMod) % 360) + 360) % 360)
  return currentRotation + delta
}

export function genFileNumber(randomFn = Math.random) {
  const digits = 1000 + Math.floor(randomFn() * 9000)
  const letters = Array.from(
    { length: 2 },
    () => FILE_LETTERS[Math.floor(randomFn() * FILE_LETTERS.length)],
  ).join('')
  return `SP-${digits}-${letters}`
}

export function nextWeekday(fromDate) {
  const d = new Date(fromDate.getTime())
  do {
    d.setDate(d.getDate() + 1)
  } while (d.getDay() === 0 || d.getDay() === 6)
  return d
}

export function formatEffective(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
