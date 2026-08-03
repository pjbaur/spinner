import {
  CONFIG_PATH,
  DEFAULT_CONFIG,
  validateWheelConfig,
} from '../../shared/wheelConfig.mjs'

export class ConfigSaveError extends Error {
  constructor(status, errors) {
    super(errors.join('; '))
    this.name = 'ConfigSaveError'
    this.status = status
    this.errors = errors
  }
}

// no-store: bypass browser cache to fetch fresh data on reload.
// Note: CloudFront may still serve stale content (up to 300s) absent invalidation.
export async function loadConfig() {
  try {
    const res = await fetch(CONFIG_PATH, { cache: 'no-store' })
    if (!res.ok) return DEFAULT_CONFIG
    const result = validateWheelConfig(await res.json())
    return result.ok ? result.config : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function saveConfig(config, idToken) {
  const res = await fetch(`${import.meta.env.VITE_CONFIG_API_URL}/config`, {
    method: 'PUT',
    headers: {
      // The JWT authorizer validates aud = client id, which only the ID
      // token carries; never send the access token here.
      authorization: `Bearer ${idToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(config),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ConfigSaveError(res.status, body.errors ?? ['save failed'])
  }
}
