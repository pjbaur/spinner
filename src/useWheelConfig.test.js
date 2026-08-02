import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useWheelConfig } from './useWheelConfig.js'
import { DEFAULT_CONFIG } from '../shared/wheelConfig.mjs'

const VALID_REMOTE = {
  version: 1,
  environments: ['Gym', 'Pool'],
  subjects: ['Math', 'Art'],
}

function fetchResponding(body, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body })
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('useWheelConfig', () => {
  it('returns defaults immediately', () => {
    vi.stubGlobal('fetch', fetchResponding(VALID_REMOTE))
    const { result } = renderHook(() => useWheelConfig())
    expect(result.current).toEqual(DEFAULT_CONFIG)
  })

  it('swaps to fetched config when valid', async () => {
    vi.stubGlobal('fetch', fetchResponding(VALID_REMOTE))
    const { result } = renderHook(() => useWheelConfig())
    await waitFor(() =>
      expect(result.current.environments).toEqual(['Gym', 'Pool']),
    )
    expect(fetch).toHaveBeenCalledWith('/config/jerry.json')
  })

  it('keeps defaults on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { result } = renderHook(() => useWheelConfig())
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(result.current).toEqual(DEFAULT_CONFIG)
  })

  it('keeps defaults on non-OK response', async () => {
    vi.stubGlobal('fetch', fetchResponding({}, false))
    const { result } = renderHook(() => useWheelConfig())
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(result.current).toEqual(DEFAULT_CONFIG)
  })

  it('keeps defaults on invalid shape', async () => {
    vi.stubGlobal('fetch', fetchResponding({ version: 1, environments: [] }))
    const { result } = renderHook(() => useWheelConfig())
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(result.current).toEqual(DEFAULT_CONFIG)
  })
})
