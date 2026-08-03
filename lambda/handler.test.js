import { describe, it, expect, vi } from 'vitest'
import { createHandler } from './handler.mjs'

const VALID_BODY = JSON.stringify({
  version: 1,
  environments: ['Gym', 'Pool'],
  subjects: ['Math', 'Art'],
})

function makeDeps() {
  return {
    putObject: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
  }
}

function event(body) {
  return { body, requestContext: { requestId: 'req-123' } }
}

describe('config writer handler', () => {
  it('writes valid config and invalidates', async () => {
    const deps = makeDeps()
    const res = await createHandler(deps)(event(VALID_BODY))
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
    expect(deps.putObject).toHaveBeenCalledWith(
      'config/jerry.json',
      JSON.stringify({
        version: 1,
        environments: ['Gym', 'Pool'],
        subjects: ['Math', 'Art'],
      }),
    )
    expect(deps.invalidate).toHaveBeenCalledWith('config-req-123')
  })

  it('rejects a non-JSON body with 400', async () => {
    const deps = makeDeps()
    const res = await createHandler(deps)(event('not json'))
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).errors).toEqual(['body must be valid JSON'])
    expect(deps.putObject).not.toHaveBeenCalled()
  })

  it('rejects an invalid shape with 400 and field errors', async () => {
    const deps = makeDeps()
    const res = await createHandler(deps)(
      event(JSON.stringify({ version: 1, environments: ['x'] })),
    )
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).errors).toContain(
      'environments must have 2-12 entries',
    )
    expect(deps.putObject).not.toHaveBeenCalled()
  })

  it('returns 500 when the S3 write fails', async () => {
    const deps = makeDeps()
    deps.putObject.mockRejectedValue(new Error('s3 down'))
    const res = await createHandler(deps)(event(VALID_BODY))
    expect(res.statusCode).toBe(500)
    expect(JSON.parse(res.body).errors).toEqual(['failed to store config'])
    expect(deps.invalidate).not.toHaveBeenCalled()
  })

  it('returns 200 with a warning when invalidation fails after a successful write', async () => {
    const deps = makeDeps()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    deps.invalidate.mockRejectedValue(new Error('cloudfront down'))
    const res = await createHandler(deps)(event(VALID_BODY))
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({
      ok: true,
      warnings: [
        'cache invalidation failed; changes may take up to 5 minutes to appear',
      ],
    })
    expect(deps.putObject).toHaveBeenCalledWith(
      'config/jerry.json',
      JSON.stringify({
        version: 1,
        environments: ['Gym', 'Pool'],
        subjects: ['Math', 'Art'],
      }),
    )
    expect(consoleError).toHaveBeenCalledWith(
      'cache invalidation failed',
      expect.any(Error),
    )
    consoleError.mockRestore()
  })
})
