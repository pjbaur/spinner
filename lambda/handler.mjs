import { validateWheelConfig } from '../shared/wheelConfig.mjs'

const CONFIG_KEY = 'config/jerry.json'

// Factory with injected effects so tests need no AWS SDK mocking.
export function createHandler({ putObject, invalidate }) {
  return async function handler(event) {
    let body
    try {
      body = JSON.parse(event.body ?? '')
    } catch {
      return response(400, { errors: ['body must be valid JSON'] })
    }
    const result = validateWheelConfig(body)
    if (!result.ok) return response(400, { errors: result.errors })
    try {
      await putObject(CONFIG_KEY, JSON.stringify(result.config))
    } catch (err) {
      console.error('config write failed', err)
      return response(500, { errors: ['failed to store config'] })
    }
    try {
      await invalidate(`config-${event.requestContext?.requestId ?? 'manual'}`)
    } catch (err) {
      console.error('cache invalidation failed', err)
      return response(200, {
        ok: true,
        warnings: [
          'cache invalidation failed; changes may take up to 5 minutes to appear',
        ],
      })
    }
    return response(200, { ok: true })
  }
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}
