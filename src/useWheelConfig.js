import { useEffect, useState } from 'react'
import {
  CONFIG_PATH,
  DEFAULT_CONFIG,
  validateWheelConfig,
} from '../shared/wheelConfig.mjs'

// Fetches the runtime wheel config. Any failure (network, HTTP status,
// parse, shape) leaves the built-in defaults in place: the public site
// must never break because of a bad or missing config object.
export function useWheelConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(CONFIG_PATH)
        if (!res.ok) return
        const result = validateWheelConfig(await res.json())
        if (result.ok && !cancelled) setConfig(result.config)
      } catch {
        // keep defaults
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return config
}
