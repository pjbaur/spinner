# Deferred Minors Cleanup

Follow-up work list from the configurable-wheel-data feature (PR #3). Every
item below was found during task reviews or the final whole-branch review
and consciously deferred as non-blocking. None are bugs affecting current
behavior; they are hardening, robustness, and polish.

## Context a fresh session needs

- Repo conventions: OpenTofu (`tofu` CLI, config in `infra/`), Vitest with
  explicit imports (no globals), `npm run lint && npm run format && npm test`
  must be green before every commit, conventional commit messages, no em
  dashes in AWS resource names or descriptions.
- Infra changes additionally need `tofu -chdir=infra fmt && tofu -chdir=infra validate`,
  and go live only via `tofu -chdir=infra plan -out=tfplan` (review: expect
  updates in place only, no destroys unless stated) then `apply` — requires
  `aws sso login` first. tfvars/state are local-only in `infra/`.
- Prod: https://teachingassignment.kc9o.com, bucket `spinner-app-prod-kc9o`,
  region us-east-2. Deploy runs from GitHub Actions on push to main.
- Work on a feature branch, PR to main (repo practice).

## A. Security tightening (do first)

1. **Narrow the unscoped `iam:PassRole`** in `infra/provisioner-policy.json`
   (statement `IamForOidcAndDeployRole` grants `iam:PassRole` on `*`,
   pre-dating PR #3). Scope it to the roles actually passed, or remove it if
   nothing in the OIDC/deploy path passes a role. The conditioned
   `PassConfigWriterRoleToLambda` statement already covers the Lambda role.
   After changing: the user must re-paste the policy into their IAM Identity
   Center permission set (note it in `docs/deployment/aws-s3-cloudfront.md`
   provisioning section — a sentence about re-pasting already exists).
2. **`prevent_user_existence_errors = "ENABLED"`** on
   `aws_cognito_user_pool_client.admin` in `infra/cognito.tf` (blocks user
   enumeration via distinct error messages).

## B. Robustness

3. **Mid-spin config-swap race** — if a reel is spinning when the runtime
   config swap arrives with a shorter list, the stored result index can
   exceed the new list length (memo renders `undefined`). Fix by passing the
   landed _label_ (not index) up from `AssignmentReel` via `onSpinEnd`, or by
   freezing the list snapshot once the first spin starts. Files:
   `src/JerryWheel.jsx`, `src/AssignmentReel.jsx`. Add a test.
4. **`/admin` trailing slash** — `src/main.jsx` matches
   `pathname === '/admin'` exactly; `/admin/` falls through to the public
   app. Normalize (strip trailing slash) before comparing. Keep the OIDC
   `redirect_uri` exactly `/admin`.
5. **Split the Lambda error message** — `lambda/handler.mjs` wraps
   `putObject` and `invalidate` in one try/catch, so an invalidation-only
   failure reports "failed to store config" although the store succeeded.
   Catch separately; distinct message for invalidation failure (write DID
   succeed). Update `lambda/handler.test.js` accordingly.

## C. UI polish

6. **Disable move up/down at list boundaries** in
   `src/admin/ConfigEditor.jsx` (currently clickable no-ops).
7. **Key error-list items by index+message** (both the validation `<ul>` and
   server-error `<ul>` use `key={error}`; duplicate strings would collide).
8. **`onSigninCallback` hardcodes `'/admin'`** in `src/admin/AdminApp.jsx` —
   derive callback path and route match from one shared constant.

## D. Tests

9. **AdminApp/Gate component tests** — loading / error / unauthenticated /
   authenticated branches (mock `react-oidc-context`'s `useAuth`).
10. **`src/useWheelConfig.test.js`** — the "swaps to fetched config" test
    asserts `environments` only; also assert `subjects` and `version`.
11. **`src/JerryWheel.test.jsx`** — move the fetch stub above the imports
    block (works today only via ESM hoisting; readability).

## E. Docs & comments

12. **`infra/README.md`** — Files table lacks `cognito.tf`, `lambda.tf`,
    `api.tf`, `budgets.tf`.
13. **`src/admin/configApi.js`** — the `cache: 'no-store'` comment overstates
    the guarantee: it bypasses the browser cache only; CloudFront may still
    serve up to 300s stale absent a recent invalidation. Reword.
14. **`infra/outputs.tf`** — new outputs have `description`s, pre-existing
    ones don't; add descriptions to the old outputs.

## F. Separate PR (toolchain)

15. **`npm audit`** — 7 pre-existing dev-dependency findings
    (brace-expansion / esbuild / vite / postcss chain). Resolve by updating
    the Vite/Vitest toolchain in its own PR with full test/build
    verification; do not mix with the cleanup PR.

## Suggested flow

One branch for A–E (infra items 1–2 need a plan/apply at the end; the user
runs `aws sso login` and reviews the plan — expect in-place updates, zero
destroys). F is its own branch/PR. Verify after each group:
lint + format + 90-test suite green; `tofu validate` for infra edits; smoke
the live site + `/admin` after apply/deploy.
