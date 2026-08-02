# Design: Configurable Wheel Data (Runtime Config + Admin UI)

**Date:** 2026-08-01
**Status:** Approved

## Overview

The environment and subject lists rendered by the assignment reels are
hard-coded constants in `src/JerryWheel.jsx`. This design makes them
runtime-configurable: the lists live in a JSON object in S3, served through
the existing CloudFront distribution, and are editable through an
authenticated `/admin` page in the app. Saves go live in seconds without a
redeploy.

Chosen over two alternatives: config-in-repo edited via GitHub (rejected:
not agile enough for the owner's workflow) and DynamoDB-backed storage
(rejected: adds a read API and a table for two string arrays with no
security or cost benefit — YAGNI).

## Goals

- Environments and subjects editable from a browser, no git or AWS console.
- Changes visible on the live site within seconds of saving.
- Zero or near-zero monthly cost at hobby traffic.
- The public site keeps working even if the config is missing or corrupt.

## Non-goals

- Multiple wheels, per-user lists, or any relational data.
- Multi-user admin, roles, or audit UI.
- Instantly consistent caches worldwide (a few seconds of CDN lag is fine).

## Security model

The list data is public by design — every visitor sees it rendered. Public
read access via CloudFront is therefore not a vulnerability. The only asset
needing protection is **write** access, which is gated by Cognito
authentication on the API route and IAM on the Lambda. The S3 bucket stays
private behind CloudFront Origin Access Control; nothing about the current
posture loosens.

### DDoS / abuse posture

AWS Shield Standard (included free with CloudFront) covers L3/L4
volumetric attacks, and the CDN absorbs L7 request floods; the practical
risk for this site is a billing spike ("denial of wallet"), not downtime.
Three free controls bound that risk:

- **Billing alerts:** AWS Budgets alerts at $5 and $20 monthly spend.
- **API throttling:** stage-level rate limit on the HTTP API
  (5 req/s, burst 10) caps abuse of the write path.
- **Lambda reserved concurrency:** cap the config-writer function at 5
  concurrent executions. The JWT authorizer already rejects
  unauthenticated requests before Lambda is invoked.

AWS WAF and Shield Advanced are deliberately out of scope: their monthly
cost is disproportionate to this app's threat model. WAF can be layered
onto the CloudFront distribution later without redesign if real abuse
appears.

## Architecture

```
Read path (public):
  browser → CloudFront /config/jerry.json (TTL ~300s) → S3 config/jerry.json

Write path (authenticated):
  /admin (React) → Cognito Hosted UI (code + PKCE)
                → PUT /config on API Gateway HTTP API (Cognito JWT authorizer)
                → Lambda: validate → S3 PutObject → CloudFront invalidation /config/*
```

All infrastructure is defined in the existing OpenTofu configuration under
`infra/` (project convention; not CDK).

## Data model

`config/jerry.json` in the existing site bucket:

```json
{
  "version": 1,
  "environments": ["Kindergarten", "..."],
  "subjects": ["P.E.", "..."]
}
```

Validation rules (enforced by the Lambda on write, and by the client on
read):

- `version` is the integer `1`.
- `environments` and `subjects` are arrays of 2–12 entries.
- Each entry is a non-empty string, ≤ 40 characters after trimming.

The same validation logic is implemented once in a shared module
(`src/wheelConfig.js`) used by the app reader and mirrored in the Lambda.

## Read path

- On mount, `JerryWheel` fetches `/config/jerry.json` (same-origin, so no
  CORS involvement).
- If the fetch fails, the JSON does not parse, or validation fails, the app
  silently falls back to the current hard-coded lists, which remain in the
  code as defaults. The public site can never be broken by a bad config.
- CloudFront serves `/config/*` with a ~300-second TTL. Combined with
  invalidation on save, edits appear within seconds; anonymous traffic
  mostly hits the CDN cache.

## Write path

- **API:** API Gateway HTTP API with a single route `PUT /config`.
  - CORS restricted to the site origin.
  - Cognito user pool JWT authorizer on the route. (HTTP API is used
    because Lambda Function URLs support only IAM or no auth — no JWT.)
- **Lambda** (Node.js 22, runtime config via environment variables):
  1. Parse and validate the body against the rules above.
  2. On failure: `400` with per-field error messages.
  3. On success: `PutObject` to `config/jerry.json` with
     `content-type: application/json` and `cache-control: public, max-age=300`,
     then `CreateInvalidation` for `/config/*`.
- **IAM:** the Lambda role may write exactly that one object key and
  invalidate exactly that one distribution. Nothing broader.

## Auth

- Cognito user pool with a single admin user; self-signup disabled
  (admin-created accounts only). MFA off initially; the pool is configured
  so it can be enabled later without recreation.
- The admin page authenticates via the Cognito Hosted UI using the
  authorization code flow with PKCE, integrated with `react-oidc-context`.
  No credential handling in application code.

## Admin UI

- Client-side route `/admin` in the existing React app. The route is
  unlinked from the public UI; authentication — not obscurity — is the
  protection.
- Loads the current `/config/jerry.json` into two editable lists
  (add, remove, edit, reorder), with a Save button.
- Client-side validation mirrors the server rules and blocks obviously
  invalid saves; server remains the authority.
- API errors surface plainly: `400` shows the returned field messages;
  `401`/`403` redirects to login.
- Minimal styling; reusing the gag aesthetic is optional and not required.

## Infrastructure changes (OpenTofu, `infra/`)

New resources:

- `cognito.tf` — user pool, app client (code + PKCE, no client secret),
  hosted UI domain.
- `api.tf` — HTTP API, JWT authorizer, route, stage (with throttling:
  rate 5 req/s, burst 10), Lambda integration.
- `lambda.tf` — function (reserved concurrency 5), role, log group,
  scoped IAM policy.
- `budgets.tf` — AWS Budgets alerts at $5 and $20 monthly account spend,
  notifying the owner's email.
- CloudFront: no new origin; `/config/*` inherits the default S3 origin.
  Add a cache behavior for `/config/*` with ~300s TTL if the default
  behavior's policy doesn't already fit.
- Outputs: API endpoint, user pool ID, app client ID, hosted UI domain
  (consumed by the frontend as build-time Vite env vars).

## CI changes (`.github/workflows/deploy.yml`)

- Add `--exclude "config/*"` to the `aws s3 sync --delete` step so deploys
  do not delete the runtime config object.
- Pass the Cognito/API values to `npm run build` as `VITE_*` variables
  (from GitHub Actions `vars`).

## Error handling

| Failure                                                | Behavior                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| Config fetch/parse/validation fails on the public site | Silent fallback to built-in default lists                      |
| Invalid payload on save                                | `400` with per-field messages, shown in the admin form         |
| Unauthenticated/expired session on save                | `401`/`403` → redirect to Cognito login                        |
| S3 or CloudFront call fails in Lambda                  | `500`; admin UI shows a retry message; config object unchanged |

## Testing

- **Unit (Vitest, existing setup):** shared validator (`wheelConfig`),
  reader fallback behavior (fetch mock), admin form state (add/remove/edit/
  reorder/validation).
- **Lambda:** handler tests with mocked S3/CloudFront SDK clients — valid
  write, invalid payload, SDK failure.
- **Not in scope:** end-to-end browser tests against deployed infra.

## Cost

Approximately $0/month at expected traffic:

- S3: one ~1 KB object; negligible.
- CloudFront: within always-free tier; invalidations ≤ 1,000 paths/month free.
- Lambda + HTTP API: free tier / ~$1 per million requests; writes are rare.
- Cognito: one monthly active user. Verified 2026-08-01 against the AWS
  pricing page: the Essentials tier (default for new user pools) includes
  10,000 MAUs free indefinitely for direct sign-ins, $0.015/MAU beyond.
  One admin user is $0/month.
