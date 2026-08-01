# Configurable Wheel Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the reel lists (environments/subjects) runtime-configurable via a JSON object in S3, editable through an authenticated `/admin` page, per the approved spec `docs/superpowers/specs/2026-08-01-configurable-wheel-data-design.md`.

**Architecture:** Public read path: browser fetches `/config/jerry.json` through the existing CloudFront distribution (S3 origin); app falls back to built-in defaults on any failure. Write path: React `/admin` page authenticates against a Cognito user pool (Hosted UI, code + PKCE via `react-oidc-context`), then PUTs to an API Gateway HTTP API route protected by a Cognito JWT authorizer; a Lambda validates and writes the S3 object, then invalidates `/config/*`.

**Tech Stack:** React 18 + Vite 5 + Vitest (existing), OpenTofu with `hashicorp/aws ~> 5.40` (existing) + `hashicorp/archive`, Lambda `nodejs22.x` (AWS SDK v3 provided by runtime), Cognito, API Gateway v2 (HTTP API), AWS Budgets.

## Global Constraints

- Infra tool is **OpenTofu** (`tofu` CLI), config in `infra/`, provider `hashicorp/aws ~> 5.40`. Do not introduce CDK/CloudFormation.
- No em dashes in AWS resource names or descriptions; use hyphens.
- Config validation rules (exact, from spec): `version` must be integer `1`; `environments` and `subjects` are arrays of **2–12** entries; each entry a non-empty string **≤ 40 chars after trimming**.
- API throttling: rate **5 req/s**, burst **10**. Lambda reserved concurrency: **5**. Budget alerts at **$5 and $20** monthly.
- Config object key: `config/jerry.json` in the existing site bucket; served path `/config/jerry.json`; object `Cache-Control: public, max-age=300`.
- The public site must render defaults when the config is missing/invalid — never crash or blank.
- All test commands: `npm test` (vitest, jsdom, no globals — import `describe/it/expect/vi` from `vitest`). Lint: `npm run lint`. Format before committing: `npm run format`.
- CI (`deploy.yml`) runs lint, format:check, test, build — keep all green.

## File Structure

```
shared/wheelConfig.mjs           validation + defaults + config path (used by app AND Lambda)
shared/wheelConfig.test.js
lambda/handler.mjs               pure handler factory (DI, no SDK imports)
lambda/index.mjs                 SDK wiring, exported Lambda handler
lambda/handler.test.js
src/useWheelConfig.js            runtime config fetch hook (public site)
src/useWheelConfig.test.js
src/JerryWheel.jsx               MODIFY: constants -> hook
src/JerryWheel.test.jsx          MODIFY: stub fetch
src/main.jsx                     MODIFY: /admin route switch (lazy)
src/admin/AdminApp.jsx           OIDC provider + auth gate
src/admin/configApi.js           loadConfig/saveConfig HTTP client
src/admin/configApi.test.js
src/admin/ConfigEditor.jsx       list editing form
src/admin/ConfigEditor.test.jsx
eslint.config.js                 MODIFY: lint .mjs, node globals for lambda/
infra/providers.tf               MODIFY: add archive provider
infra/cognito.tf                 user pool, client, hosted domain
infra/lambda.tf                  zip packaging, role, policy, function, log group
infra/api.tf                     HTTP API, JWT authorizer, route, stage, permission
infra/cloudfront.tf              MODIFY: CSP connect-src additions
infra/budgets.tf                 $20 budget, $5/$20 alerts
infra/variables.tf               MODIFY: + cognito_domain_prefix, alert_email
infra/outputs.tf                 MODIFY: + api endpoint, cognito ids/authority
infra/terraform.tfvars.example   MODIFY: + new vars
.github/workflows/deploy.yml     MODIFY: sync exclude, VITE_ build env
```

Zip layout note: the Lambda zip preserves repo-relative layout (`lambda/…`, `shared/…`) so `handler.mjs`'s `../shared/wheelConfig.mjs` import resolves identically on disk and in the zip. Lambda handler string is `lambda/index.handler`. `.mjs` extension forces ESM inside the zip without a `package.json` marker.

---

### Task 1: Shared config module

**Files:**
- Create: `shared/wheelConfig.mjs`
- Test: `shared/wheelConfig.test.js`

**Interfaces:**
- Consumes: nothing (dependency-free ESM).
- Produces (used by Tasks 2, 3, 9, 10):
  - `CONFIG_PATH` — string `'/config/jerry.json'`
  - `DEFAULT_CONFIG` — `{ version: 1, environments: string[6], subjects: string[6] }`
  - `validateWheelConfig(value)` → `{ ok: true, config }` (trimmed copy) or `{ ok: false, errors: string[] }`

- [ ] **Step 1: Write the failing test**

`shared/wheelConfig.test.js`:

```js
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
    expect(result.errors).toContain('environments[1] must be a non-empty string')
    expect(result.errors).toContain('environments[2] exceeds 40 characters')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- shared/wheelConfig.test.js`
Expected: FAIL (cannot resolve `./wheelConfig.mjs`).

- [ ] **Step 3: Write the implementation**

`shared/wheelConfig.mjs`:

```js
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
```

Note: `validateWheelConfig(DEFAULT_CONFIG)` returns a trimmed copy; the test uses `toEqual` so structural equality is what matters.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- shared/wheelConfig.test.js`
Expected: PASS.

- [ ] **Step 5: Lint config coverage for .mjs**

Edit `eslint.config.js`: change the main files glob and add a lambda block (lambda block is used by Task 3 but landing it here keeps eslint edits in one commit):

```js
    files: ['**/*.{js,mjs,jsx}'],
```

and append to the exported array (after the `*.config.js` block):

```js
  {
    files: ['lambda/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
```

- [ ] **Step 6: Verify full suite, format, commit**

Run: `npm run lint && npm run format && npm test`
Expected: all pass.

```bash
git add shared/ eslint.config.js
git commit -m "feat: add shared wheel config module (defaults + validation)"
```

---

### Task 2: Public site reads runtime config

**Files:**
- Create: `src/useWheelConfig.js`
- Test: `src/useWheelConfig.test.js`
- Modify: `src/JerryWheel.jsx` (lines 12-27 constants; lines 89, 97, 114-115 usages)
- Modify: `src/JerryWheel.test.jsx` (stub fetch)

**Interfaces:**
- Consumes: `CONFIG_PATH`, `DEFAULT_CONFIG`, `validateWheelConfig` from `shared/wheelConfig.mjs` (Task 1).
- Produces: `useWheelConfig()` React hook → `{ version, environments, subjects }`; returns `DEFAULT_CONFIG` immediately, swaps to fetched config when valid.

- [ ] **Step 1: Write the failing test**

`src/useWheelConfig.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/useWheelConfig.test.js`
Expected: FAIL (cannot resolve `./useWheelConfig.js`).

- [ ] **Step 3: Write the implementation**

`src/useWheelConfig.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/useWheelConfig.test.js`
Expected: PASS.

- [ ] **Step 5: Wire into JerryWheel**

In `src/JerryWheel.jsx`:

1. Delete the `ENVIRONMENTS` and `SUBJECTS` constant declarations (lines 12-27).
2. Add import: `import { useWheelConfig } from './useWheelConfig.js'`
3. First line of the `JerryWheel` function body: `const { environments, subjects } = useWheelConfig()`
4. Replace usages: `labels={ENVIRONMENTS}` → `labels={environments}`; `labels={SUBJECTS}` → `labels={subjects}`; `SUBJECTS[result.topic]` → `subjects[result.topic]`; `ENVIRONMENTS[result.env]` → `environments[result.env]`.

- [ ] **Step 6: Stub fetch in the existing JerryWheel tests**

`src/JerryWheel.test.jsx` currently renders with hard-coded lists. Add at the top of the file (after existing imports, adjusting only if an equivalent stub already exists):

```js
import { beforeEach, vi } from 'vitest'

beforeEach(() => {
  // JerryWheel now fetches /config/jerry.json on mount; fail the fetch so
  // tests exercise the built-in default lists.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
})
```

If the file already imports `beforeEach`/`vi`, merge into the existing import instead of duplicating.

- [ ] **Step 7: Verify full suite, format, commit**

Run: `npm run lint && npm run format && npm test`
Expected: all pass (JerryWheel tests keep passing on defaults).

```bash
git add src/useWheelConfig.js src/useWheelConfig.test.js src/JerryWheel.jsx src/JerryWheel.test.jsx
git commit -m "feat: load wheel lists from runtime config with default fallback"
```

---

### Task 3: Lambda config writer

**Files:**
- Create: `lambda/handler.mjs`, `lambda/index.mjs`
- Test: `lambda/handler.test.js`

**Interfaces:**
- Consumes: `validateWheelConfig` from `shared/wheelConfig.mjs` (Task 1), via relative import `../shared/wheelConfig.mjs`.
- Produces:
  - `createHandler({ putObject, invalidate })` → async HTTP API v2 handler returning `{ statusCode, headers, body }`. `putObject(key: string, body: string)` and `invalidate(callerReference: string)` are injected async functions.
  - `lambda/index.mjs` exports `handler` (the deployed entrypoint, handler string `lambda/index.handler`), reading env vars `CONFIG_BUCKET` and `DISTRIBUTION_ID`.

- [ ] **Step 1: Write the failing test**

`lambda/handler.test.js`:

```js
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lambda/handler.test.js`
Expected: FAIL (cannot resolve `./handler.mjs`).

- [ ] **Step 3: Write the implementation**

`lambda/handler.mjs`:

```js
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
      await invalidate(`config-${event.requestContext?.requestId ?? 'manual'}`)
    } catch (err) {
      console.error('config write failed', err)
      return response(500, { errors: ['failed to store config'] })
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
```

`lambda/index.mjs`:

```js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront'
import { createHandler } from './handler.mjs'

const s3 = new S3Client({})
const cloudfront = new CloudFrontClient({})

export const handler = createHandler({
  putObject: (key, body) =>
    s3.send(
      new PutObjectCommand({
        Bucket: process.env.CONFIG_BUCKET,
        Key: key,
        Body: body,
        ContentType: 'application/json',
        CacheControl: 'public, max-age=300',
      }),
    ),
  invalidate: (callerReference) =>
    cloudfront.send(
      new CreateInvalidationCommand({
        DistributionId: process.env.DISTRIBUTION_ID,
        InvalidationBatch: {
          CallerReference: callerReference,
          Paths: { Quantity: 1, Items: ['/config/*'] },
        },
      }),
    ),
})
```

The AWS SDK v3 clients are provided by the `nodejs22.x` runtime; they are not npm dependencies of this repo, and `index.mjs` is only imported in Lambda, never by tests or the app.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lambda/handler.test.js`
Expected: PASS.

- [ ] **Step 5: Verify full suite, format, commit**

Run: `npm run lint && npm run format && npm test`
Expected: all pass. (If eslint flags `@aws-sdk/*` imports as unresolved, that rule is not enabled in this config; no import-resolution plugin is installed.)

```bash
git add lambda/
git commit -m "feat: add config writer Lambda handler with injected effects"
```

---

### Task 4: Infra: Cognito user pool

**Files:**
- Create: `infra/cognito.tf`
- Modify: `infra/variables.tf`, `infra/terraform.tfvars.example`

**Interfaces:**
- Consumes: `var.domain_name` (existing).
- Produces (referenced by Tasks 5-6): `aws_cognito_user_pool.admin`, `aws_cognito_user_pool_client.admin`, `aws_cognito_user_pool_domain.admin`, `var.cognito_domain_prefix`.

- [ ] **Step 1: Add variables**

Append to `infra/variables.tf`:

```hcl
variable "cognito_domain_prefix" {
  description = "Globally-unique Cognito hosted UI domain prefix, e.g. spinner-admin-1234"
  type        = string
}

variable "alert_email" {
  description = "Email address that receives budget alerts"
  type        = string
}
```

(`alert_email` is consumed in Task 7; declared here so variables land in one edit.)

Append to `infra/terraform.tfvars.example`:

```hcl
cognito_domain_prefix = "spinner-admin-1234" # must be globally unique
alert_email           = "you@example.com"
```

- [ ] **Step 2: Create the user pool**

`infra/cognito.tf`:

```hcl
# Single-admin user pool for the /admin config editor. Users are created by
# an administrator only; there is no self-signup surface.
resource "aws_cognito_user_pool" "admin" {
  name = "spinner-admin"

  # MFA off initially; pool supports enabling OPTIONAL later without recreation.
  mfa_configuration = "OFF"

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "admin_only"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_client" "admin" {
  name         = "spinner-admin-web"
  user_pool_id = aws_cognito_user_pool.admin.id

  # Public SPA client: authorization code + PKCE, no secret.
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email"]
  supported_identity_providers         = ["COGNITO"]

  callback_urls = [
    "https://${var.domain_name}/admin",
    "http://localhost:5173/admin",
  ]
  logout_urls = [
    "https://${var.domain_name}/admin",
    "http://localhost:5173/admin",
  ]
}

resource "aws_cognito_user_pool_domain" "admin" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.admin.id
}
```

- [ ] **Step 3: Validate and commit**

Run: `tofu -chdir=infra fmt && tofu -chdir=infra init -backend=false && tofu -chdir=infra validate`
Expected: `Success! The configuration is valid.`

```bash
git add infra/cognito.tf infra/variables.tf infra/terraform.tfvars.example
git commit -m "feat: add Cognito user pool for admin config editing"
```

---

### Task 5: Infra: Lambda packaging and IAM

**Files:**
- Create: `infra/lambda.tf`
- Modify: `infra/providers.tf`

**Interfaces:**
- Consumes: `lambda/*.mjs` + `shared/wheelConfig.mjs` from Tasks 1/3; `aws_s3_bucket.site` and `aws_cloudfront_distribution.site` (existing).
- Produces (referenced by Task 6): `aws_lambda_function.config_writer`.

- [ ] **Step 1: Add the archive provider**

In `infra/providers.tf`, inside `required_providers`, add:

```hcl
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
```

- [ ] **Step 2: Create packaging, role, function**

`infra/lambda.tf`:

```hcl
data "aws_caller_identity" "current" {}

# Zip preserves the repo-relative layout (lambda/, shared/) so the ESM
# relative import ../shared/wheelConfig.mjs resolves inside the zip exactly
# as it does on disk. Handler is therefore "lambda/index.handler".
data "archive_file" "config_writer" {
  type        = "zip"
  output_path = "${path.module}/build/config-writer.zip"

  source {
    content  = file("${path.module}/../lambda/index.mjs")
    filename = "lambda/index.mjs"
  }
  source {
    content  = file("${path.module}/../lambda/handler.mjs")
    filename = "lambda/handler.mjs"
  }
  source {
    content  = file("${path.module}/../shared/wheelConfig.mjs")
    filename = "shared/wheelConfig.mjs"
  }
}

resource "aws_iam_role" "config_writer" {
  name = "spinner-config-writer"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "config_writer_logs" {
  role       = aws_iam_role.config_writer.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Exactly one object writable, exactly one distribution invalidatable.
resource "aws_iam_role_policy" "config_writer" {
  name = "spinner-config-writer-scope"
  role = aws_iam_role.config_writer.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.site.arn}/config/jerry.json"
      },
      {
        Effect   = "Allow"
        Action   = "cloudfront:CreateInvalidation"
        Resource = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.site.id}"
      },
    ]
  })
}

resource "aws_lambda_function" "config_writer" {
  function_name    = "spinner-config-writer"
  description      = "Validates and writes the wheel config JSON, then invalidates the CDN path"
  role             = aws_iam_role.config_writer.arn
  runtime          = "nodejs22.x"
  handler          = "lambda/index.handler"
  filename         = data.archive_file.config_writer.output_path
  source_code_hash = data.archive_file.config_writer.output_base64sha256
  timeout          = 10

  reserved_concurrent_executions = 5

  environment {
    variables = {
      CONFIG_BUCKET   = aws_s3_bucket.site.id
      DISTRIBUTION_ID = aws_cloudfront_distribution.site.id
    }
  }
}

resource "aws_cloudwatch_log_group" "config_writer" {
  name              = "/aws/lambda/${aws_lambda_function.config_writer.function_name}"
  retention_in_days = 14
}
```

- [ ] **Step 3: Validate and commit**

Run: `tofu -chdir=infra fmt && tofu -chdir=infra init -backend=false -upgrade && tofu -chdir=infra validate`
Expected: valid. Note `init -upgrade` updates `.terraform.lock.hcl` with the archive provider — commit that too. Add `infra/build/` to `.gitignore`:

```
infra/build/
```

```bash
git add infra/lambda.tf infra/providers.tf infra/.terraform.lock.hcl .gitignore
git commit -m "feat: package and provision config writer Lambda with scoped IAM"
```

---

### Task 6: Infra: HTTP API, JWT authorizer, CSP

**Files:**
- Create: `infra/api.tf`
- Modify: `infra/cloudfront.tf` (CSP `connect-src` line 44), `infra/outputs.tf`

**Interfaces:**
- Consumes: Task 4 Cognito resources, Task 5 `aws_lambda_function.config_writer`.
- Produces: `aws_apigatewayv2_api.config` and outputs `config_api_endpoint`, `cognito_authority`, `cognito_client_id`, `cognito_user_pool_id` (consumed by Tasks 8-9 as `VITE_*` values).

- [ ] **Step 1: Create the API**

`infra/api.tf`:

```hcl
resource "aws_apigatewayv2_api" "config" {
  name          = "spinner-config-api"
  description   = "Write path for the wheel config JSON"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = [
      "https://${var.domain_name}",
      "http://localhost:5173",
    ]
    allow_methods = ["PUT", "OPTIONS"]
    allow_headers = ["authorization", "content-type"]
    max_age       = 3600
  }
}

# Cognito ID tokens carry aud = app client id, which is what a JWT
# authorizer validates. The admin UI must send the ID token, not the
# access token (Cognito access tokens have no aud claim).
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.config.id
  name             = "cognito-jwt"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.admin.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.admin.id}"
  }
}

resource "aws_apigatewayv2_integration" "config_writer" {
  api_id                 = aws_apigatewayv2_api.config.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.config_writer.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "put_config" {
  api_id             = aws_apigatewayv2_api.config.id
  route_key          = "PUT /config"
  target             = "integrations/${aws_apigatewayv2_integration.config_writer.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.config.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = 5
    throttling_burst_limit = 10
  }
}

resource "aws_lambda_permission" "config_api" {
  statement_id  = "AllowConfigApiInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.config_writer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.config.execution_arn}/*/*"
}
```

- [ ] **Step 2: Widen the CSP connect-src**

In `infra/cloudfront.tf`, replace the line

```hcl
        "connect-src 'self'",
```

with

```hcl
        # /admin calls the config API and the Cognito endpoints (OIDC
        # metadata + token exchange) via fetch.
        "connect-src 'self' ${aws_apigatewayv2_api.config.api_endpoint} https://cognito-idp.${var.aws_region}.amazonaws.com https://${var.cognito_domain_prefix}.auth.${var.aws_region}.amazoncognito.com",
```

Read-path caching note (spec allowed a dedicated behavior "if needed"): the existing default behavior uses the managed CachingOptimized policy, which honors the origin's `Cache-Control`. The config object is written with `max-age=300`, so **no new cache behavior is required** — the default behavior + object header give the ~300 s TTL.

- [ ] **Step 3: Add outputs**

Append to `infra/outputs.tf`:

```hcl
output "config_api_endpoint" {
  description = "Base URL of the config write API (VITE_CONFIG_API_URL)"
  value       = aws_apigatewayv2_api.config.api_endpoint
}

output "cognito_authority" {
  description = "OIDC authority URL for the admin user pool (VITE_COGNITO_AUTHORITY)"
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.admin.id}"
}

output "cognito_client_id" {
  description = "Cognito app client id (VITE_COGNITO_CLIENT_ID)"
  value       = aws_cognito_user_pool_client.admin.id
}

output "cognito_user_pool_id" {
  description = "Cognito user pool id (for admin-create-user)"
  value       = aws_cognito_user_pool.admin.id
}
```

- [ ] **Step 4: Validate and commit**

Run: `tofu -chdir=infra fmt && tofu -chdir=infra validate`
Expected: valid.

```bash
git add infra/api.tf infra/cloudfront.tf infra/outputs.tf
git commit -m "feat: add config write API with Cognito JWT auth and throttling"
```

---

### Task 7: Infra: budget alerts

**Files:**
- Create: `infra/budgets.tf`

**Interfaces:**
- Consumes: `var.alert_email` (declared in Task 4).
- Produces: standalone; nothing downstream.

- [ ] **Step 1: Create the budget**

`infra/budgets.tf`:

```hcl
# Denial-of-wallet guard: alerts at $5 (25% of the $20 limit) and $20 of
# actual monthly account spend. AWS has no hard spend cutoff; alerting is
# the control.
resource "aws_budgets_budget" "monthly" {
  name         = "spinner-monthly-cost"
  budget_type  = "COST"
  limit_amount = "20"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "ACTUAL"
    threshold                  = 25
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "ACTUAL"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.alert_email]
  }
}
```

- [ ] **Step 2: Validate and commit**

Run: `tofu -chdir=infra fmt && tofu -chdir=infra validate`
Expected: valid.

```bash
git add infra/budgets.tf
git commit -m "feat: add monthly budget alerts at 5 and 20 dollars"
```

---

### Task 8: CI: protect config object, pass VITE vars

**Files:**
- Modify: `.github/workflows/deploy.yml` (build step line 32, sync step lines 39-46)

**Interfaces:**
- Consumes: GitHub Actions repo variables `VITE_CONFIG_API_URL`, `VITE_COGNITO_AUTHORITY`, `VITE_COGNITO_CLIENT_ID` (set in Task 11 from tofu outputs).
- Produces: deploys that no longer delete `config/jerry.json` and bake the admin env into the bundle.

- [ ] **Step 1: Edit the workflow**

Replace the build step:

```yaml
      - run: npm run build
```

with:

```yaml
      - run: npm run build
        env:
          VITE_CONFIG_API_URL: ${{ vars.VITE_CONFIG_API_URL }}
          VITE_COGNITO_AUTHORITY: ${{ vars.VITE_COGNITO_AUTHORITY }}
          VITE_COGNITO_CLIENT_ID: ${{ vars.VITE_COGNITO_CLIENT_ID }}
```

In the sync step, add the exclude BEFORE `--delete` acts on the config prefix (order of flags does not matter to the CLI; what matters is that the exclude is present):

```yaml
          aws s3 sync dist/ "s3://${{ vars.AWS_S3_BUCKET }}/" \
            --delete --exclude "index.html" --exclude "config/*" \
            --cache-control "public, max-age=31536000, immutable"
```

- [ ] **Step 2: Commit**

`npm run format` (prettier also formats YAML), then:

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: protect runtime config from sync delete; pass admin env to build"
```

Until Task 11 sets the repo variables, the `VITE_*` values are empty strings in deployed bundles; the public site does not read them, and `/admin` will show a sign-in error — acceptable during rollout.

---

### Task 9: Admin auth shell and API client

**Files:**
- Modify: `package.json` (deps), `src/main.jsx`
- Create: `src/admin/AdminApp.jsx`, `src/admin/configApi.js`
- Test: `src/admin/configApi.test.js`

**Interfaces:**
- Consumes: `shared/wheelConfig.mjs` (Task 1); env `import.meta.env.VITE_CONFIG_API_URL`, `VITE_COGNITO_AUTHORITY`, `VITE_COGNITO_CLIENT_ID`; `ConfigEditor` (Task 10 — created there; this task references it, so Task 10's file must exist before this task's suite passes: create the two tasks on one branch, or temporarily stub — see Step 4 note).
- Produces:
  - `loadConfig()` → Promise resolving to a valid config (fetched or `DEFAULT_CONFIG`).
  - `saveConfig(config, idToken)` → Promise; throws `ConfigSaveError` with `.status: number` and `.errors: string[]` on non-2xx.
  - `AdminApp` default export; rendered when `location.pathname === '/admin'`.

- [ ] **Step 1: Install dependencies**

Run: `npm install react-oidc-context@^3 oidc-client-ts@^3`

- [ ] **Step 2: Write the failing test for the API client**

`src/admin/configApi.test.js`:

```js
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
    await saveConfig(VALID, 'id-token-123')
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/config', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer id-token-123',
        'content-type': 'application/json',
      },
      body: JSON.stringify(VALID),
    })
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/admin/configApi.test.js`
Expected: FAIL (cannot resolve `./configApi.js`).

- [ ] **Step 4: Write the API client**

`src/admin/configApi.js`:

```js
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

// no-store: the editor must always start from what is actually stored,
// not a CDN-cached copy.
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/admin/configApi.test.js`
Expected: PASS.

- [ ] **Step 6: Auth shell**

`src/admin/AdminApp.jsx`:

```jsx
import { AuthProvider, useAuth } from 'react-oidc-context'
import ConfigEditor from './ConfigEditor.jsx'

const oidcConfig = {
  authority: import.meta.env.VITE_COGNITO_AUTHORITY,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirect_uri: `${window.location.origin}/admin`,
  scope: 'openid email',
  onSigninCallback: () => {
    // Strip ?code=&state= after the redirect back from the Hosted UI.
    window.history.replaceState({}, '', '/admin')
  },
}

export default function AdminApp() {
  return (
    <AuthProvider {...oidcConfig}>
      <Gate />
    </AuthProvider>
  )
}

function Gate() {
  const auth = useAuth()
  if (auth.isLoading) return <p>Checking session…</p>
  if (auth.error) return <p>Sign-in failed: {auth.error.message}</p>
  if (!auth.isAuthenticated) {
    return (
      <button type="button" onClick={() => auth.signinRedirect()}>
        Sign in to edit wheel config
      </button>
    )
  }
  return (
    <ConfigEditor
      idToken={auth.user?.id_token}
      onAuthExpired={() => auth.signinRedirect()}
    />
  )
}
```

(`ConfigEditor` is Task 10. If executing tasks strictly in order, create a minimal placeholder now so the import resolves — `export default function ConfigEditor() { return null }` in `src/admin/ConfigEditor.jsx` — Task 10 replaces it wholesale.)

- [ ] **Step 7: Route switch in main.jsx**

Replace `src/main.jsx` content with:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// /admin is code-split so public visitors never download the OIDC stack.
// CloudFront's SPA fallback (403/404 -> index.html) makes the path load.
const AdminApp = React.lazy(() => import('./admin/AdminApp.jsx'))
const isAdmin = window.location.pathname === '/admin'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? (
      <React.Suspense fallback={<p>Loading…</p>}>
        <AdminApp />
      </React.Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
```

- [ ] **Step 8: Verify full suite, format, commit**

Run: `npm run lint && npm run format && npm test && npm run build`
Expected: all pass; build emits a separate chunk for AdminApp.

```bash
git add package.json package-lock.json src/main.jsx src/admin/
git commit -m "feat: add /admin auth shell and config API client"
```

---

### Task 10: Admin config editor UI

**Files:**
- Create (replacing any Task 9 placeholder): `src/admin/ConfigEditor.jsx`
- Test: `src/admin/ConfigEditor.test.jsx`

**Interfaces:**
- Consumes: `loadConfig`, `saveConfig`, `ConfigSaveError` from `./configApi.js` (Task 9); `validateWheelConfig` from `shared/wheelConfig.mjs` (Task 1). Props: `idToken: string`, `onAuthExpired: () => void` (called on a 401/403 save so the shell can restart sign-in, per the spec's error-handling table).
- Produces: default export `ConfigEditor` used by `AdminApp` (Task 9).

- [ ] **Step 1: Write the failing test**

`src/admin/ConfigEditor.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfigEditor from './ConfigEditor.jsx'
import { loadConfig, saveConfig, ConfigSaveError } from './configApi.js'

vi.mock('./configApi.js', async () => {
  const actual = await vi.importActual('./configApi.js')
  return {
    ...actual,
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
  }
})

const CONFIG = {
  version: 1,
  environments: ['Gym', 'Pool'],
  subjects: ['Math', 'Art'],
}

beforeEach(() => {
  vi.clearAllMocks()
  loadConfig.mockResolvedValue(CONFIG)
  saveConfig.mockResolvedValue(undefined)
})

async function renderLoaded() {
  render(<ConfigEditor idToken="tok" />)
  await waitFor(() => expect(screen.getByDisplayValue('Gym')).toBeInTheDocument())
}

describe('ConfigEditor', () => {
  it('loads and shows both lists', async () => {
    await renderLoaded()
    for (const value of ['Gym', 'Pool', 'Math', 'Art']) {
      expect(screen.getByDisplayValue(value)).toBeInTheDocument()
    }
  })

  it('adds an entry and saves the edited config', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await user.click(
      screen.getByRole('button', { name: 'Add environment entry' }),
    )
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[2], 'Rooftop')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(saveConfig).toHaveBeenCalledWith(
        {
          version: 1,
          environments: ['Gym', 'Pool', 'Rooftop'],
          subjects: ['Math', 'Art'],
        },
        'tok',
      ),
    )
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('removes an entry', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await user.click(
      screen.getAllByRole('button', { name: 'Remove environments entry 1' })[0],
    )
    expect(screen.queryByDisplayValue('Gym')).not.toBeInTheDocument()
  })

  it('disables Save while the config is invalid', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await user.clear(screen.getByDisplayValue('Gym'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(
      screen.getByText('environments[0] must be a non-empty string'),
    ).toBeInTheDocument()
  })

  it('shows server errors from a failed save', async () => {
    const user = userEvent.setup()
    saveConfig.mockRejectedValue(new ConfigSaveError(400, ['version must be 1']))
    await renderLoaded()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('version must be 1')).toBeInTheDocument()
  })

  it('restarts sign-in when the session has expired', async () => {
    const user = userEvent.setup()
    const onAuthExpired = vi.fn()
    saveConfig.mockRejectedValue(new ConfigSaveError(401, ['unauthorized']))
    render(<ConfigEditor idToken="tok" onAuthExpired={onAuthExpired} />)
    await waitFor(() =>
      expect(screen.getByDisplayValue('Gym')).toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onAuthExpired).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/admin/ConfigEditor.test.jsx`
Expected: FAIL (placeholder renders nothing / component missing).

- [ ] **Step 3: Write the implementation**

`src/admin/ConfigEditor.jsx` (full file, replaces any placeholder):

```jsx
import { useEffect, useState } from 'react'
import { validateWheelConfig } from '../../shared/wheelConfig.mjs'
import { loadConfig, saveConfig, ConfigSaveError } from './configApi.js'

export default function ConfigEditor({ idToken, onAuthExpired }) {
  const [lists, setLists] = useState(null)
  const [status, setStatus] = useState({ kind: 'idle' })

  useEffect(() => {
    let cancelled = false
    loadConfig().then((config) => {
      if (!cancelled) {
        setLists({
          environments: config.environments,
          subjects: config.subjects,
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (lists === null) return <p>Loading config…</p>

  const candidate = { version: 1, ...lists }
  const validation = validateWheelConfig(candidate)

  function updateList(name, items) {
    setStatus({ kind: 'idle' })
    setLists((prev) => ({ ...prev, [name]: items }))
  }

  async function handleSave() {
    setStatus({ kind: 'saving' })
    try {
      await saveConfig(candidate, idToken)
      setStatus({ kind: 'saved' })
    } catch (err) {
      if (err instanceof ConfigSaveError && (err.status === 401 || err.status === 403)) {
        onAuthExpired()
      } else if (err instanceof ConfigSaveError) {
        setStatus({ kind: 'error', errors: err.errors })
      } else {
        setStatus({ kind: 'error', errors: ['save failed; try again'] })
      }
    }
  }

  return (
    <main>
      <h1>Wheel config</h1>
      <ListEditor
        name="environments"
        label="Teaching environments"
        addLabel="Add environment entry"
        items={lists.environments}
        onChange={(items) => updateList('environments', items)}
      />
      <ListEditor
        name="subjects"
        label="Teaching subjects"
        addLabel="Add subject entry"
        items={lists.subjects}
        onChange={(items) => updateList('subjects', items)}
      />
      {!validation.ok && (
        <ul>
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {status.kind === 'error' && (
        <ul>
          {status.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {status.kind === 'saved' && <p>Saved.</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={!validation.ok || status.kind === 'saving'}
      >
        {status.kind === 'saving' ? 'Saving…' : 'Save'}
      </button>
    </main>
  )
}

function ListEditor({ name, label, addLabel, items, onChange }) {
  function setItem(index, value) {
    onChange(items.map((item, i) => (i === index ? value : item)))
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function move(index, delta) {
    const next = [...items]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  return (
    <section>
      <h2>{label}</h2>
      <ol>
        {items.map((item, i) => (
          // Index keys are acceptable here: entries are plain strings with
          // no identity, and edits are input-driven.
          <li key={i}>
            <input
              type="text"
              value={item}
              aria-label={`${name} entry ${i + 1}`}
              onChange={(e) => setItem(i, e.target.value)}
            />
            <button
              type="button"
              aria-label={`Remove ${name} entry ${i + 1}`}
              onClick={() => removeItem(i)}
            >
              ✕
            </button>
            <button
              type="button"
              aria-label={`Move ${name} entry ${i + 1} up`}
              onClick={() => move(i, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${name} entry ${i + 1} down`}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => onChange([...items, ''])}>
        {addLabel}
      </button>
    </section>
  )
}
```

Note the add-entry flow: a new entry starts as `''`, which makes the candidate invalid ("must be a non-empty string") until typed into — Save is disabled meanwhile. The "adds an entry and saves" test types into the new input before saving.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/admin/ConfigEditor.test.jsx`
Expected: PASS.

- [ ] **Step 5: Verify full suite, format, commit**

Run: `npm run lint && npm run format && npm test && npm run build`
Expected: all pass.

```bash
git add src/admin/ConfigEditor.jsx src/admin/ConfigEditor.test.jsx
git commit -m "feat: add wheel config editor for /admin"
```

---

### Task 11: Provision and wire up (partially manual)

**Files:** none (operations). Needs AWS credentials (`aws login` / SSO profile per `infra/README.md`) and `gh` auth. If credentials are unavailable to the agent, hand the exact commands to the user.

- [ ] **Step 1: Verify Cognito pricing (spec open question)**

Check https://aws.amazon.com/cognito/pricing/ for the current free-tier terms of the Essentials tier for new user pools. Record the finding by replacing the "Open item" sentence in the spec's Cost section with the verified terms, and delete the "Open questions" section if nothing else remains. Commit as `docs: resolve Cognito pricing open question`. If pricing is materially worse than ~$0.02/month for one user, STOP and surface to the user before applying.

- [ ] **Step 2: Set new tfvars**

Add to `infra/terraform.tfvars` (gitignored, user's local file):

```hcl
cognito_domain_prefix = "<choose-unique-prefix>"
alert_email           = "<owner email>"
```

- [ ] **Step 3: Apply**

Run: `tofu -chdir=infra init -upgrade && tofu -chdir=infra plan -out tfplan` — review: expect ~15 adds (Cognito x3, API x6, Lambda + role + policies + log group, budget), 1 change (CloudFront response headers policy CSP). No destroys expected; if any destroy appears, STOP and investigate before applying.
Run: `tofu -chdir=infra apply tfplan`

- [ ] **Step 4: Create the admin user**

```bash
POOL_ID=$(tofu -chdir=infra output -raw cognito_user_pool_id)
aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username admin \
  --user-attributes Name=email,Value=<owner email> Name=email_verified,Value=true \
  --message-action SUPPRESS
aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username admin \
  --password '<choose a strong password>' \
  --permanent
```

Do not echo the chosen password into logs; have the user run the second command themselves if the session is shared.

- [ ] **Step 5: Seed the config object**

```bash
node -e "import('./shared/wheelConfig.mjs').then(m => console.log(JSON.stringify(m.DEFAULT_CONFIG)))" > /tmp/jerry-config.json
aws s3 cp /tmp/jerry-config.json "s3://<bucket_name>/config/jerry.json" \
  --content-type "application/json" \
  --cache-control "public, max-age=300"
```

(Optional — the site falls back to defaults without it, but seeding makes the read path verifiable immediately.)

- [ ] **Step 6: Set GitHub Actions variables**

```bash
gh variable set VITE_CONFIG_API_URL --body "$(tofu -chdir=infra output -raw config_api_endpoint)"
gh variable set VITE_COGNITO_AUTHORITY --body "$(tofu -chdir=infra output -raw cognito_authority)"
gh variable set VITE_COGNITO_CLIENT_ID --body "$(tofu -chdir=infra output -raw cognito_client_id)"
```

- [ ] **Step 7: Deploy**

Push main (or `gh workflow run Deploy`); wait for the Deploy workflow to go green.

---

### Task 12: End-to-end verification

- [ ] **Step 1: Read path**

`curl -s https://<domain>/config/jerry.json` → the seeded JSON with `content-type: application/json`. Load the site: reels show the config lists.

- [ ] **Step 2: Write path is locked**

```bash
curl -s -o /dev/null -w "%{http_code}" -X PUT \
  "$(tofu -chdir=infra output -raw config_api_endpoint)/config" \
  -H "content-type: application/json" -d '{}'
```

Expected: `401` (no token). Nothing written.

- [ ] **Step 3: Authenticated edit round-trip**

In a browser: `https://<domain>/admin` → Sign in (Hosted UI) → edit an entry (e.g. add "Rooftop Kindergarten") → Save → "Saved." appears. Within ~10 s (invalidation), reload the public site: the new entry appears on the reel. Check the browser console for CSP violations — there must be none.

- [ ] **Step 4: Guardrails present**

```bash
aws lambda get-function-configuration --function-name spinner-config-writer \
  --query 'ReservedConcurrentExecutions'   # expect 5 (via get-function --query Concurrency)
aws apigatewayv2 get-stages --api-id <id> \
  --query 'Items[0].DefaultRouteSettings'  # expect rate 5, burst 10
aws budgets describe-budgets --account-id <account id>  # expect spinner-monthly-cost
```

(If `get-function-configuration` does not return concurrency, use `aws lambda get-function --function-name spinner-config-writer --query 'Concurrency'`.)

- [ ] **Step 5: Update work log / report**

Report results to the user: what was verified, any deviations from the spec.
