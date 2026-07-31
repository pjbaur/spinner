import { describe, it, expect } from 'vitest'
import {
  computeReelLanding,
  reelTranslateY,
  genFileNumber,
  nextWeekday,
  formatEffective,
} from './jerryWheelMath.js'

describe('computeReelLanding', () => {
  const n = 6

  it('ends on the target index modulo the item count', () => {
    for (let start = 0; start < n; start++) {
      for (let idx = 0; idx < n; idx++) {
        const end = computeReelLanding(start, idx, n, 4)
        expect(((end % n) + n) % n).toBe(idx)
      }
    }
  })

  it('travels at least the requested whole loops and less than one more', () => {
    const end = computeReelLanding(2, 5, n, 3)
    const delta = end - 2
    expect(delta).toBeGreaterThanOrEqual(3 * n)
    expect(delta).toBeLessThan(4 * n)
  })

  it('still advances a full loop when target equals the start index', () => {
    const end = computeReelLanding(3, 3, n, 3)
    expect(end - 3).toBe(3 * n)
  })
})

describe('reelTranslateY', () => {
  it('seats an index in the center slot with a one-loop buffer above', () => {
    // index 0 with a 6-item strip, 58px rows -> 58 * (1 - (0 + 6)) = -290
    expect(reelTranslateY(0, 6, 58)).toBe(-290)
    // each item lower shifts the strip up by one row height
    expect(reelTranslateY(1, 6, 58) - reelTranslateY(0, 6, 58)).toBe(-58)
  })
})

describe('genFileNumber', () => {
  it('formats as SP-####-XX excluding letters I and O', () => {
    const seq = [0.5, 0, 0.999999]
    let i = 0
    const rng = () => seq[i++ % seq.length]
    const fileNo = genFileNumber(rng)
    expect(fileNo).toMatch(/^SP-\d{4}-[A-HJ-NP-Z]{2}$/)
  })

  it('never emits I or O across many draws', () => {
    let x = 0
    const rng = () => (x += 0.017) % 1
    for (let k = 0; k < 200; k++) {
      const letters = genFileNumber(rng).slice(-2)
      expect(letters).not.toMatch(/[IO]/)
    }
  })
})

describe('nextWeekday', () => {
  it('returns the next calendar day on a weekday', () => {
    const wed = new Date(2026, 6, 22) // Wed Jul 22 2026
    expect(nextWeekday(wed).getDate()).toBe(23)
  })

  it('skips the weekend from Friday to Monday', () => {
    const fri = new Date(2026, 6, 24) // Fri Jul 24 2026
    const d = nextWeekday(fri)
    expect(d.getDay()).toBe(1)
    expect(d.getDate()).toBe(27)
  })

  it('does not mutate the input', () => {
    const fri = new Date(2026, 6, 24)
    nextWeekday(fri)
    expect(fri.getDate()).toBe(24)
  })
})

describe('formatEffective', () => {
  it('formats as Weekday, Month D, YYYY', () => {
    expect(formatEffective(new Date(2026, 6, 27))).toBe('Monday, July 27, 2026')
  })
})
