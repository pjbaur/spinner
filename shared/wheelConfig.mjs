// Single source of truth for the wheel config shape. Imported by the React
// app AND packaged into the Lambda zip (repo-relative layout is preserved),
// so it must stay dependency-free ESM.
export const CONFIG_PATH = '/config/jerry.json'

export const DEFAULT_CONFIG = {
  version: 1,
  environments: [
    'Kindergarten',
    'Grade School',
    'Middle School',
    'After School',
    'School Bus',
    'Summer School',
  ],
  subjects: [
    'P.E.',
    'Nap-Time Patrol',
    'Cafeteria Duty',
    'Potty Rotation',
    'Shop Class',
    'Testing Prep',
  ],
}

const MIN_ITEMS = 2
const MAX_ITEMS = 12
const MAX_ITEM_LENGTH = 40

function listErrors(name, value) {
  if (!Array.isArray(value)) return [`${name} must be an array`]
  const errors = []
  if (value.length < MIN_ITEMS || value.length > MAX_ITEMS) {
    errors.push(`${name} must have ${MIN_ITEMS}-${MAX_ITEMS} entries`)
  }
  value.forEach((item, i) => {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(`${name}[${i}] must be a non-empty string`)
    } else if (item.trim().length > MAX_ITEM_LENGTH) {
      errors.push(`${name}[${i}] exceeds ${MAX_ITEM_LENGTH} characters`)
    }
  })
  return errors
}

export function validateWheelConfig(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, errors: ['config must be an object'] }
  }
  const errors = []
  if (value.version !== 1) errors.push('version must be 1')
  errors.push(...listErrors('environments', value.environments))
  errors.push(...listErrors('subjects', value.subjects))
  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    config: {
      version: 1,
      environments: value.environments.map((s) => s.trim()),
      subjects: value.subjects.map((s) => s.trim()),
    },
  }
}
