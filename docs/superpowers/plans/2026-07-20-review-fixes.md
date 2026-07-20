# Review Fixes Plan — 2026-07-20

Executes the priority recommendations of `docs/reviews/2026-07-09-project-review.md`,
in the review's order. One task per recommendation.

## Context

Two-wheel spinner app: React 18 + Vite 5 + Vitest 2 (jsdom + Testing Library).
Architecture (keep it): pure geometry/randomness in `src/wheelMath.js` (no React
imports, randomness injected via `randomFn`/`jitterFn` params), localStorage
persistence in `src/useWheelItems.js`, rendering + spin state in `src/Wheel.jsx`,
composition in `src/App.jsx`. Two `<Wheel>` instances with distinct `storageKey`s.

## Global Constraints

- Tasks execute strictly in order 1 → 6.
- `npm test` fully green after every task. Existing tests may be modified only
  when a task's behavior change requires it; note every such modification in
  the report.
- TDD wherever a failing test can express the requirement: write the failing
  test first, capture RED output, then implement, capture GREEN.
- Code style: no semicolons, single quotes, 2-space indent (match existing files).
- Conventional commit subjects (`fix:`, `feat:`, `test:`, `docs:`, `ci:`, `chore:`),
  matching existing `git log` style.
- Do not bump dependency majors (React 18 / Vite 5 / Vitest 2 stay).
- jsdom facts that bind implementation and tests:
  - `fireEvent.transitionEnd` dispatches an event whose `propertyName` is
    undefined (see comment in `src/Wheel.test.jsx`). The transitionend handler's
    hybrid guard `if (e.propertyName && e.propertyName !== 'transform') return`
    exists for exactly this reason — keep it working.
  - `window.matchMedia` is undefined in jsdom. Production code touching it must
    guard; tests needing it must stub it.
  - CSS transitions never run in jsdom: winner-resolution tests must fire
    `transitionend` manually or use `vi.useFakeTimers()`.

## Task 1: Single-item wheel renders a full disc

**Problem** (review finding #1, high): `describeSlicePath` (`src/wheelMath.js:40`)
draws an SVG arc from slice start point to end point. With one item the slice is
0°–360°, start and end coincide (up to ~1e-14 float error), and the arc is
degenerate — renderers draw nothing. A one-item wheel shows an empty disc with a
floating label.

**Note:** the design spec (`docs/superpowers/specs/2026-07-08-two-wheel-spinner-design.md`,
Edge Cases) claims single-item needs "no special-case handling". The review
established that is false for rendering; this task deliberately supersedes the
spec on that one point. Do not flag this as a spec conflict.

**Requirements:**
- A wheel with exactly one item renders a visible filled full circle plus its label.
- Fix inside `describeSlicePath`, keeping its signature. When the slice spans a
  full turn (`endAngle - startAngle >= 360 - 1e-9`), return a full-circle path
  built from two 180° arcs:
  `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`
- Partial slices (< 360°) keep the existing center-wedge path unchanged.

**Tests (TDD):**
- `src/wheelMath.test.js`: `describeSlicePath(150, 150, 150, 0, 360)` returns the
  two-arc full-circle form (assert two `A` commands and non-coincident arc
  endpoints — parse or string-assert). Existing partial-slice tests stay green.
- `src/Wheel.test.jsx`: render a wheel whose stored items are a single item
  (seed localStorage or pass one-item `defaultItems`); assert exactly one
  `<path>` and that its `d` contains two `A` arc commands.

**Files:** `src/wheelMath.js`, `src/wheelMath.test.js`, `src/Wheel.test.jsx`

**Commit:** `fix: render single-item wheel as full circle`

## Task 2: Spin resolution cannot lock up

**Problem** (review finding #2, high): `spinning` is set true in `handleSpin` and
reset only by `transitionend` (`src/Wheel.jsx`). Transitions are not guaranteed
to fire it (reduced-motion overrides, user stylesheets, extensions): `spinning`
then stays true forever, wheel permanently unclickable, no winner.

**Requirements:**
- Single source of truth for duration: `const SPIN_DURATION_MS = 4000` in
  `src/Wheel.jsx`. Apply the transition inline on the svg
  (`transition: \`transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)\``
  in the existing `style` object) and delete the `transition:` declaration from
  `.wheel-svg` in `src/Wheel.css`.
- Extract an idempotent `resolveSpin()`: if no pending winner, return; else clear
  the fallback timer, set `spinning` false, set the winner from the pending ref,
  null the pending ref.
- `handleSpin` arms a fallback `setTimeout(resolveSpin, SPIN_DURATION_MS + 500)`,
  id stored in a ref.
- The `transitionend` handler keeps its existing hybrid `propertyName` guard
  verbatim, then calls `resolveSpin()`.
- Clear the pending fallback timer on unmount (effect cleanup).
- Double-fire safe: `transitionend` then timer (or reverse) resolves exactly once.

**Tests (TDD), using `vi.useFakeTimers()` where needed:**
- Spin, never fire `transitionend`, advance `SPIN_DURATION_MS + 500` → winner
  shown and wheel spinnable again.
- Spin, fire `transitionend` → winner shown; then advance all timers → no error,
  winner unchanged (single resolution).
- Existing transitionend-driven tests stay green.

**Files:** `src/Wheel.jsx`, `src/Wheel.css`, `src/Wheel.test.jsx`

**Commit:** `fix: add timeout fallback so a missed transitionend cannot lock the wheel`

## Task 3: Item edits cannot corrupt an in-flight spin

**Problem** (review finding #3, medium): blurring the textarea mid-spin replaces
`items` immediately: slices re-render mid-animation, and winner resolution indexes
the new array — wrong item or `undefined`.

**Requirements (both parts — they fix two distinct harms the review names):**
- Snapshot the winner at spin time: replace the `pendingWinnerIndex` ref with
  `pendingWinnerItem` holding the item STRING (`items[winningIndex]`);
  `resolveSpin` uses the string directly. (Fixes wrong-winner harm.)
- Block edits mid-spin: the textarea gets `disabled={spinning}`. (Fixes
  mid-animation slice mutation harm.)

**Tests (TDD):**
- Textarea disabled while spinning, enabled again after resolution.
- Winner shown is the item snapshotted at spin time (follow the existing
  deterministic-spin pattern in `src/Wheel.test.jsx` for forcing the winner).

**Files:** `src/Wheel.jsx`, `src/Wheel.test.jsx`

**Commit:** `fix: snapshot winner at spin time and block edits mid-spin`

## Task 4: Accessibility pass

**Problem** (review Accessibility section): core feature is mouse-only `<svg
onClick>`; winner not announced; forced 4s animation ignores
`prefers-reduced-motion`; white 14px labels fail WCAG contrast on several palette
colors; both textareas share the ambiguous `aria-label="wheel items"`.

**Requirements:**
1. **Button semantics + keyboard.** Wrap the svg in a real
   `<button type="button" className="wheel-button">` inside `.wheel-wrapper`;
   move `onClick` to the button; keep `onTransitionEnd` on the svg. Button is
   `disabled` while spinning or when items are empty. CSS: strip button chrome
   (no border/background/padding), keep `cursor: pointer`, add a visible
   `:focus-visible` outline.
2. **Distinct wheel names.** New required string prop `name` on `Wheel`. App
   passes `"Wheel A"` / `"Wheel B"`. Button `aria-label` = `` `Spin ${name}` ``;
   textarea `aria-label` = `` `${name} items` ``.
3. **Winner announced.** Winner `<p>` gets `role="status"` and
   `aria-live="polite"`.
4. **Reduced motion.** Helper in `Wheel.jsx`: `prefersReducedMotion()` returning
   `window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true`
   (safe when matchMedia is undefined). Compute the effective duration per spin:
   0 when reduced, else `SPIN_DURATION_MS`. Duration 0 → no transition property →
   `transitionend` never fires → Task 2's fallback timer (armed with
   `effectiveDuration + 500`) resolves the winner in ~500ms.
5. **Label contrast.** In `src/wheelMath.js`, pair every palette fill with an
   explicit text color meeting WCAG AA 4.5:1 for the 14px labels. Restructure
   `PALETTE` to `{ fill, text }` entries; keep `getSliceColor(i)` returning the
   fill; add `getSliceTextColor(i)`. If neither white nor near-black reaches
   4.5:1 on a fill, adjust that fill's shade minimally (keep the hue
   recognizable). Labels use `fill={getSliceTextColor(i)}`; delete the hardcoded
   `fill: #fff` from `.wheel-label` in `src/Wheel.css`.

**Tests (TDD):**
- Buttons with accessible names `Spin Wheel A` / `Spin Wheel B` exist and are
  distinct (`src/App.test.jsx`); textarea labels distinct likewise.
- Activating the button via keyboard (focus + Enter) starts a spin.
- Winner element has `role="status"`.
- Reduced motion: stub `window.matchMedia` to `matches: true`; with fake timers,
  spin resolves (winner shown) after ~500ms without any `transitionend`.
- Contrast: test in `src/wheelMath.test.js` implementing WCAG relative
  luminance + contrast ratio, asserting every palette `{fill, text}` pair ≥ 4.5.

**Files:** `src/Wheel.jsx`, `src/App.jsx`, `src/Wheel.css`, `src/wheelMath.js`,
`src/Wheel.test.jsx`, `src/App.test.jsx`, `src/wheelMath.test.js`

**Commit:** `feat: accessibility pass — keyboard spin, live winner, reduced motion, label contrast`

## Task 5: Tooling — ESLint, Prettier, CI, cross-platform test script

**Problem** (review Tooling section): no lint/format config, no CI, and the
`NODE_OPTIONS=...` env-prefix in the `test` script breaks on Windows.

**Requirements:**
- **ESLint 9 flat config** `eslint.config.js`: `@eslint/js` recommended,
  `eslint-plugin-react-hooks` (recommended rules), `eslint-plugin-react-refresh`,
  browser globals via `globals`. Ignore `dist/`, `node_modules/`,
  `.superpowers/`. Script: `"lint": "eslint ."`. Fix any violations it finds in
  existing code (mechanical fixes only; report anything non-trivial).
- **Prettier**: `.prettierrc.json` matching existing style: `"semi": false`,
  `"singleQuote": true`. `.prettierignore`: `dist/`, `node_modules/`,
  `package-lock.json`, `.superpowers/`. Scripts: `"format": "prettier --write ."`,
  `"format:check": "prettier --check ."`. Run `npm run format` once and include
  any reflow in this task's commit.
- **CI** `.github/workflows/ci.yml`: on push and pull_request to `main`;
  `actions/checkout@v4`, `actions/setup-node@v4` with node 22 + npm cache,
  `npm ci`, `npm run lint`, `npm run format:check`, `npm test`.
- **Cross-platform test script**: add `cross-env` devDependency;
  `"test": "cross-env NODE_OPTIONS=--disable-warning=ExperimentalWarning vitest run"`.
- Verify locally: `npm run lint`, `npm run format:check`, `npm test` all green.
- Out of scope: TypeScript/JSDoc, dependency major bumps.

**Files:** `eslint.config.js`, `.prettierrc.json`, `.prettierignore`,
`.github/workflows/ci.yml`, `package.json`, `package-lock.json`, plus any
mechanical lint/format fixes in `src/`.

**Commit:** `ci: add ESLint, Prettier, GitHub Actions CI; make test script cross-platform`
(split into two commits if format reflow is noisy: `ci:` then `style:`)

## Task 6: Fix CLAUDE.md domain-docs wording

**Problem** (review Tooling section): CLAUDE.md's "Domain docs" section reads as
if `CONTEXT.md` and `docs/adr/` exist at the repo root; neither does. The review
suggested "create them or remove the section" — but `docs/agents/domain.md` (the
doc that section points to) explicitly states these files are created lazily by
`/domain-modeling` and their absence must be handled silently. So: do NOT create
the files, do NOT remove the section — reword it so it stops implying existence.

**Requirement — exact edit in `CLAUDE.md`:** replace

```
### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
```

with

```
### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root, created
lazily by `/domain-modeling`; neither exists yet. See `docs/agents/domain.md`.
```

No code, no tests.

**Files:** `CLAUDE.md`

**Commit:** `docs: clarify that domain docs are created lazily and do not exist yet`
