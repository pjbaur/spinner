import { describe, it, expect } from 'vitest'
import {
  buildSegments,
  computeLandingRotation,
  genFileNumber,
  nextWeekday,
  formatEffective,
} from './jerryWheelMath.js'

describe('buildSegments', () => {
  const labels = ['A', 'B', 'C', 'D', 'E', 'F']
  const colors = ['#111', '#222']

  it('returns one entry per label with alternating fills', () => {
    const segs = buildSegments(labels, colors)
    expect(segs).toHaveLength(6)
    expect(segs[0].fill).toBe('#111')
    expect(segs[1].fill).toBe('#222')
    expect(segs[2].fill).toBe('#111')
    expect(segs.map((s) => s.label)).toEqual(labels)
  })

  it('draws each slice as an arc path from the center', () => {
    const segs = buildSegments(labels, colors)
    for (const s of segs) {
      expect(s.d.startsWith('M 160 160 L ')).toBe(true)
      expect(s.d).toMatch(/ A 148 148 0 [01] 1 /)
      expect(s.d.endsWith(' Z')).toBe(true)
    }
  })

  it('flips only lower-half labels 180 degrees to keep them upright', () => {
    const segs = buildSegments(labels, colors)
    // 6 segments, step 60, mids at -60,0,60,120,180,240 -> normalized 300,0,60,120,180,240
    // flip when normalized mid in (90,270): indices 3 (120), 4 (180), 5 (240)
    expect(segs[0].textTransform).not.toContain('rotate(180)')
    expect(segs[1].textTransform).not.toContain('rotate(180)')
    expect(segs[2].textTransform).not.toContain('rotate(180)')
    expect(segs[3].textTransform).toContain('rotate(180)')
    expect(segs[4].textTransform).toContain('rotate(180)')
    expect(segs[5].textTransform).toContain('rotate(180)')
  })
})

describe('computeLandingRotation', () => {
  const n = 6
  const step = 360 / n

  it('lands with the target segment centered under the top pointer', () => {
    for (let idx = 0; idx < n; idx++) {
      const end = computeLandingRotation(0, idx, n, 5)
      const centered = (((end + (idx + 0.5) * step) % 360) + 360) % 360
      expect(Math.min(centered, 360 - centered)).toBeLessThan(1e-6)
    }
  })

  it('includes the requested number of whole spins beyond the current angle', () => {
    const end = computeLandingRotation(37, 2, n, 5)
    const delta = end - 37
    expect(delta).toBeGreaterThanOrEqual(5 * 360)
    expect(delta).toBeLessThan(6 * 360)
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
