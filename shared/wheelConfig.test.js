import { describe, it, expect } from 'vitest'
import {
  CONFIG_PATH,
  DEFAULT_CONFIG,
  validateWheelConfig,
} from './wheelConfig.mjs'

describe('DEFAULT_CONFIG', () => {
  it('is itself valid and points at the config path', () => {
    expect(CONFIG_PATH).toBe('/config/jerry.json')
    expect(validateWheelConfig(DEFAULT_CONFIG)).toEqual({
      ok: true,
      config: DEFAULT_CONFIG,
    })
    expect(DEFAULT_CONFIG.environments).toContain('Kindergarten')
    expect(DEFAULT_CONFIG.subjects).toContain('P.E.')
  })
})

describe('validateWheelConfig', () => {
  const valid = () => ({
    version: 1,
    environments: ['A', 'B'],
    subjects: ['C', 'D'],
  })

  it('accepts a minimal valid config and trims entries', () => {
    const result = validateWheelConfig({
      version: 1,
      environments: ['  Gym  ', 'Pool'],
      subjects: ['Math', 'Art'],
    })
    expect(result.ok).toBe(true)
    expect(result.config.environments).toEqual(['Gym', 'Pool'])
  })

  it.each([
    ['null', null],
    ['array', []],
    ['string', 'nope'],
  ])('rejects non-object root: %s', (_label, value) => {
    expect(validateWheelConfig(value)).toEqual({
      ok: false,
      errors: ['config must be an object'],
    })
  })

  it('rejects wrong version', () => {
    const result = validateWheelConfig({ ...valid(), version: 2 })
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('version must be 1')
  })

  it('rejects missing or non-array lists', () => {
    const result = validateWheelConfig({ version: 1, environments: 'x' })
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('environments must be an array')
    expect(result.errors).toContain('subjects must be an array')
  })

  it('rejects too few and too many entries', () => {
    expect(
      validateWheelConfig({ ...valid(), environments: ['only'] }).errors,
    ).toContain('environments must have 2-12 entries')
    expect(
      validateWheelConfig({
        ...valid(),
        subjects: Array.from({ length: 13 }, (_, i) => `s${i}`),
      }).errors,
    ).toContain('subjects must have 2-12 entries')
  })

  it('rejects blank and overlong entries with indexed messages', () => {
    const result = validateWheelConfig({
      ...valid(),
      environments: ['ok', '   ', 'x'.repeat(41)],
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContain(
      'environments[1] must be a non-empty string',
    )
    expect(result.errors).toContain('environments[2] exceeds 40 characters')
  })
})
