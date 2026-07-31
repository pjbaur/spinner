const FILE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

// Reel model: a vertical strip of item rows (each ITEM_H tall) scrolls so the
// target index settles in the center slot. The strip is the label list repeated
// N times, so index j and j+n look identical and j can be normalized into [0, n).

// End index for a spin: land on `targetIndex` after `loops` whole revolutions,
// starting from the current normalized index `start`. `end % n === targetIndex`.
export function computeReelLanding(start, targetIndex, n, loops) {
  return start + loops * n + ((((targetIndex - start) % n) + n) % n)
}

// translateY that seats index j in the center slot, with a one-loop buffer above
// so the row above the first item wraps to show the last item (never blank).
export function reelTranslateY(j, n, itemH) {
  return itemH * (1 - (j + n))
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
