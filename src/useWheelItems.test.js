import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { loadItems, useWheelItems } from './useWheelItems.js'

beforeEach(() => {
  localStorage.clear()
})

describe('loadItems', () => {
  it('returns defaults when storage is empty', () => {
    expect(loadItems('missing-key', ['A', 'B'])).toEqual(['A', 'B'])
  })

  it('returns parsed items when present', () => {
    localStorage.setItem('k', JSON.stringify(['X', 'Y']))
    expect(loadItems('k', ['A', 'B'])).toEqual(['X', 'Y'])
  })

  it('returns defaults when stored value is an empty array', () => {
    localStorage.setItem('k', JSON.stringify([]))
    expect(loadItems('k', ['A', 'B'])).toEqual(['A', 'B'])
  })

  it('returns defaults when stored value is malformed JSON', () => {
    localStorage.setItem('k', 'not json')
    expect(loadItems('k', ['A', 'B'])).toEqual(['A', 'B'])
  })
})

describe('useWheelItems', () => {
  it('initializes from localStorage and persists updates', () => {
    localStorage.setItem('wheel.test', JSON.stringify(['One', 'Two']))
    const { result } = renderHook(() => useWheelItems('wheel.test', ['A']))

    expect(result.current[0]).toEqual(['One', 'Two'])

    act(() => {
      result.current[1](['Three'])
    })

    expect(result.current[0]).toEqual(['Three'])
    expect(JSON.parse(localStorage.getItem('wheel.test'))).toEqual(['Three'])
  })
})
