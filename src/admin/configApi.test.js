import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadConfig, saveConfig, ConfigSaveError } from './configApi.js'
import { DEFAULT_CONFIG } from '../../shared/wheelConfig.mjs'

const VALID = { version: 1, environments: ['A', 'B'], subjects: ['C', 'D'] }

beforeEach(() => {
  vi.unstubAllGlobals()
  import.meta.env.VITE_CONFIG_API_URL = 'https://api.example.com'
})

describe('loadConfig', () => {
  it('returns fetched config when valid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => VALID }),
    )
    await expect(loadConfig()).resolves.toEqual(VALID)
    expect(fetch).toHaveBeenCalledWith('/config/jerry.json', {
      cache: 'no-store',
    })
  })

  it('falls back to defaults on failure or invalid shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(loadConfig()).resolves.toEqual(DEFAULT_CONFIG)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bad: 1 }) }),
    )
    await expect(loadConfig()).resolves.toEqual(DEFAULT_CONFIG)
  })
})

describe('saveConfig', () => {
  it('PUTs the config with a bearer ID token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
    )
    await expect(saveConfig(VALID, 'id-token-123')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/config', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer id-token-123',
        'content-type': 'application/json',
      },
      body: JSON.stringify(VALID),
    })
  })

  it('resolves to the warnings array when the server reports a partial success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          warnings: [
            'cache invalidation failed; changes may take up to 5 minutes to appear',
          ],
        }),
      }),
    )
    await expect(saveConfig(VALID, 'id-token-123')).resolves.toEqual([
      'cache invalidation failed; changes may take up to 5 minutes to appear',
    ])
  })

  it('throws ConfigSaveError with server errors on 400', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ errors: ['version must be 1'] }),
      }),
    )
    const err = await saveConfig(VALID, 't').catch((e) => e)
    expect(err).toBeInstanceOf(ConfigSaveError)
    expect(err.status).toBe(400)
    expect(err.errors).toEqual(['version must be 1'])
  })

  it('throws a generic ConfigSaveError when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('not json')
        },
      }),
    )
    const err = await saveConfig(VALID, 't').catch((e) => e)
    expect(err).toBeInstanceOf(ConfigSaveError)
    expect(err.status).toBe(502)
    expect(err.errors).toEqual(['save failed'])
  })
})
