import { describe, it, expect } from 'vitest'
import {
  PALETTE,
  getSliceColor,
  getSliceTextColor,
  parseItemsFromText,
  buildSliceAngles,
  polarToCartesian,
  describeSlicePath,
  pickRandomIndex,
  computeTargetRotation,
} from './wheelMath.js'

describe('getSliceColor', () => {
  it('cycles through the palette', () => {
    expect(getSliceColor(0)).toBe(PALETTE[0].fill)
    expect(getSliceColor(PALETTE.length)).toBe(PALETTE[0].fill)
    expect(getSliceColor(PALETTE.length + 1)).toBe(PALETTE[1].fill)
  })
})

describe('getSliceTextColor', () => {
  it('cycles through the palette text colors in lockstep with getSliceColor', () => {
    expect(getSliceTextColor(0)).toBe(PALETTE[0].text)
    expect(getSliceTextColor(PALETTE.length)).toBe(PALETTE[0].text)
    expect(getSliceTextColor(PALETTE.length + 1)).toBe(PALETTE[1].text)
  })
})

describe('palette label contrast', () => {
  // WCAG 2.x relative luminance + contrast ratio, implemented independently
  // of any app code so this test can't be fooled by a shared bug.
  function channelToLinear(channel) {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }

  function relativeLuminance(hex) {
    const value = hex.replace('#', '')
    const r = parseInt(value.slice(0, 2), 16)
    const g = parseInt(value.slice(2, 4), 16)
    const b = parseInt(value.slice(4, 6), 16)
    return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
  }

  function contrastRatio(hexA, hexB) {
    const lA = relativeLuminance(hexA)
    const lB = relativeLuminance(hexB)
    const lighter = Math.max(lA, lB)
    const darker = Math.min(lA, lB)
    return (lighter + 0.05) / (darker + 0.05)
  }

  it('gives every fill/text pair at least a 4.5:1 contrast ratio', () => {
    PALETTE.forEach(({ fill, text }) => {
      expect(contrastRatio(fill, text)).toBeGreaterThanOrEqual(4.5)
    })
  })
})

describe('parseItemsFromText', () => {
  it('splits on newlines, trims, and drops blank lines', () => {
    expect(parseItemsFromText('Pizza\n  Tacos  \n\nSushi\n')).toEqual([
      'Pizza',
      'Tacos',
      'Sushi',
    ])
  })

  it('returns an empty array for blank input', () => {
    expect(parseItemsFromText('   \n  \n')).toEqual([])
  })
})

describe('buildSliceAngles', () => {
  it('splits 360 degrees evenly with correct midpoints', () => {
    const angles = buildSliceAngles(4)
    expect(angles).toEqual([
      { start: 0, end: 90, mid: 45 },
      { start: 90, end: 180, mid: 135 },
      { start: 180, end: 270, mid: 225 },
      { start: 270, end: 360, mid: 315 },
    ])
  })
})

describe('polarToCartesian', () => {
  it('places angle 0 at the top of the circle', () => {
    const p = polarToCartesian(100, 100, 50, 0)
    expect(p.x).toBeCloseTo(100)
    expect(p.y).toBeCloseTo(50)
  })

  it('places angle 90 to the right of the circle', () => {
    const p = polarToCartesian(100, 100, 50, 90)
    expect(p.x).toBeCloseTo(150)
    expect(p.y).toBeCloseTo(100)
  })
})

describe('describeSlicePath', () => {
  it('draws a partial slice as a center wedge', () => {
    const d = describeSlicePath(150, 150, 150, 0, 90)
    expect(d).toBe('M 150 150 L 150 0 A 150 150 0 0 1 300 150 Z')
  })

  it('draws a full-turn slice as a full circle, not a degenerate wedge', () => {
    const d = describeSlicePath(150, 150, 150, 0, 360)
    const arcs = [...d.matchAll(/A [\d.]+ [\d.]+ \d+ \d+ \d+ (-?[\d.]+) (-?[\d.]+)/g)]
    expect(arcs).toHaveLength(2)

    const [x1, y1] = arcs[0].slice(1).map(Number)
    const [x2, y2] = arcs[1].slice(1).map(Number)
    expect(x1 !== x2 || y1 !== y2).toBe(true)
  })
})

describe('pickRandomIndex', () => {
  it('picks index 0 when randomFn returns 0', () => {
    expect(pickRandomIndex(4, () => 0)).toBe(0)
  })

  it('picks the last index when randomFn returns just under 1', () => {
    expect(pickRandomIndex(4, () => 0.9999)).toBe(3)
  })
})

describe('computeTargetRotation', () => {
  it('lands the winning slice midpoint under the top pointer, with extra spins added', () => {
    const rotation = computeTargetRotation(0, 0, 4, 5, () => 0.5)
    expect(rotation % 360).toBeCloseTo(315)
    expect(rotation).toBeGreaterThanOrEqual(5 * 360)
  })

  it('always increases rotation relative to the current value', () => {
    const rotation = computeTargetRotation(3600, 2, 4, 5, () => 0.5)
    expect(rotation).toBeGreaterThan(3600)
  })
})
