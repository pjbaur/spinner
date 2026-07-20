export const PALETTE = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f1c40f',
  '#9b59b6',
  '#1abc9c',
  '#e67e22',
  '#34495e',
]

export function getSliceColor(index) {
  return PALETTE[index % PALETTE.length]
}

export function parseItemsFromText(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function buildSliceAngles(itemCount) {
  const sliceAngle = 360 / itemCount
  return Array.from({ length: itemCount }, (_, i) => ({
    start: i * sliceAngle,
    end: (i + 1) * sliceAngle,
    mid: (i + 0.5) * sliceAngle,
  }))
}

export function polarToCartesian(cx, cy, r, angleDeg) {
  const theta = (angleDeg * Math.PI) / 180
  return {
    x: cx + r * Math.sin(theta),
    y: cy - r * Math.cos(theta),
  }
}

export function describeSlicePath(cx, cy, r, startAngle, endAngle) {
  if (endAngle - startAngle >= 360 - 1e-9) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`
  }
  const start = polarToCartesian(cx, cy, r, startAngle)
  const end = polarToCartesian(cx, cy, r, endAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`
}

export function pickRandomIndex(itemCount, randomFn = Math.random) {
  return Math.floor(randomFn() * itemCount)
}

export function computeTargetRotation(
  currentRotation,
  winningIndex,
  itemCount,
  extraSpins = 5,
  jitterFn = Math.random,
) {
  const sliceAngle = 360 / itemCount
  const midAngle = (winningIndex + 0.5) * sliceAngle
  const jitter = (jitterFn() - 0.5) * sliceAngle * 0.8
  const targetMod = (((360 - midAngle - jitter) % 360) + 360) % 360
  const currentMod = ((currentRotation % 360) + 360) % 360
  let delta = targetMod - currentMod
  if (delta <= 0) delta += 360
  return currentRotation + delta + extraSpins * 360
}
