# Project Review — Spinner (2026-07-09)

Critical assessment of the two-wheel spinner app at commit `005bc98`. All 23 tests pass
(`npm test`, Vitest 2.1.9). The review covers correctness, robustness, accessibility,
tests, tooling, and repo hygiene.

## Summary

This is a small, well-structured React app that closely follows its committed design spec
(`docs/superpowers/specs/2026-07-08-two-wheel-spinner-design.md`). The separation into a pure
math module (`wheelMath.js`), a persistence hook (`useWheelItems.js`), and a rendering
component (`Wheel.jsx`) is clean and makes the logic genuinely testable. Test coverage of the
happy paths is good.

The main weaknesses are: a rendering bug for the single-item wheel (an edge case the spec
explicitly claims needs no special handling), a spin-state machine that can lock up
permanently if the CSS transition never fires, unguarded interaction between editing and
spinning, and a near-total absence of keyboard/screen-reader accessibility. None of these are
covered by tests. Tooling (lint/format/CI) is absent, and the project docs reference files
that do not exist.

## Correctness bugs

### 1. Single-item wheel renders no slice (high)

`describeSlicePath` (src/wheelMath.js:40) draws each slice as an SVG arc from the slice's
start point to its end point. With one item the slice spans 0°–360°, so start and end are the
same point (up to floating-point error of ~1e-14). An SVG arc between coincident points is
degenerate: renderers draw nothing (or garbage), so a one-item wheel shows an empty/invisible
disc with a floating label. The design spec (Edge Cases) asserts "Single item: spinning still
works, trivially lands on the only slice — no special-case handling needed" — that is true for
the spin math but false for rendering. A full circle needs either two 180° arcs or a `<circle>`
special case. No test covers single-item rendering.

### 2. Wheel can lock up permanently if `transitionend` never fires (high)

`handleSpin` sets `spinning = true` and the only thing that ever resets it is the
`transitionend` event (src/Wheel.jsx:36-40). CSS transitions are not guaranteed to fire a
`transitionend`: user agents with `prefers-reduced-motion` overrides, user stylesheets, or
extensions that disable transitions will apply the transform instantly with no event. In that
case `spinning` stays `true` forever and the wheel becomes permanently unclickable, with no
winner shown. There is no timeout fallback and no `transitioncancel` handling.

### 3. Editing items mid-spin corrupts the outcome (medium)

Nothing prevents blurring the textarea while a spin is in flight. `handleEditorBlur` replaces
`items` immediately, which (a) re-renders the slices mid-animation so the wheel visually
changes while rotating toward an angle computed for the old layout, and (b) makes
`items[pendingWinnerIndex.current]` in `handleTransitionEnd` (src/Wheel.jsx:39) index into the
*new* array — yielding either the wrong item or `undefined` (silently displayed as no winner).
Either block edits while `spinning`, or resolve the winner from a snapshot of the items taken
at spin time.

### 4. Stored non-string items can crash the app (low)

`loadItems` (src/useWheelItems.js:3) validates only "is a non-empty array". A localStorage
value like `[{"a":1}]` — hand-edited or written by another tool — passes validation and is
rendered directly as a JSX child in the SVG `<text>` element, which throws React's "Objects
are not valid as a React child" and white-screens the app. Validate that every element is a
string (e.g. `parsed.every(x => typeof x === 'string')`).

### 5. `localStorage.setItem` is unguarded (low)

`useWheelItems.setItems` (src/useWheelItems.js:18-21) will throw on quota exceeded or when
storage is disabled, aborting the state update from inside an event handler. `loadItems`
guards JSON parsing but not the storage access itself (some browsers throw on `localStorage`
access when cookies/storage are blocked). Wrap both in try/catch; degrade to in-memory state.

## UX / behavioral inconsistencies

### 6. Cleared wheel silently resurrects defaults on reload

Emptying the textarea persists `[]` and shows the empty-hint, but `loadItems` treats a stored
empty array as "missing" and restores Option A–D on the next page load. This matches the spec
("if missing/empty, fall back to placeholders") but contradicts the user's persisted intent:
the same stored state renders differently before and after a reload. Decide which behavior is
wanted; currently the app disagrees with itself.

### 7. Textarea and canonical items desync after blur

On blur the items are parsed (trimmed, blanks dropped) but `draftText` keeps the raw text, so
the textarea shows `"  Pizza  \n\nTacos"` while the wheel shows the normalized list; a reload
snaps the textarea to the normalized form. Harmless but sloppy — write the normalized
`join('\n')` back into `draftText` on blur. Relatedly, `draftText` is initialized from `items`
only once (src/Wheel.jsx:19); if items ever gain another mutation path (reset button, storage
sync across tabs), the editor will show stale text.

### 8. Long labels overflow their slices

`<text>` is centered at a fixed `LABEL_RADIUS` with no truncation or scaling. Anything longer
than ~12 characters spills across neighboring slices or outside the wheel. Needs `textLength`,
truncation, or font scaling.

## Accessibility (largest systemic gap)

- **No keyboard access.** The only spin affordance is a click handler on an `<svg>`
  (src/Wheel.jsx:54). No `role="button"`, no `tabindex`, no key handler — the core feature is
  unusable without a mouse. A real `<button>` wrapping or overlaying the wheel is the cheap fix.
- **Winner is not announced.** The winner `<p>` has no `aria-live` region, so screen-reader
  users get no notification when the spin resolves.
- **`prefers-reduced-motion` ignored.** A forced 4-second spin animation with no reduced
  variant (and per finding #2, disabling transitions breaks the app outright).
- **Label contrast fails WCAG.** White 14px text (`.wheel-label`, src/Wheel.css:21-25) sits on
  palette colors including `#f1c40f` (yellow, ~1.7:1), `#2ecc71`, and `#1abc9c` — all far below
  the 4.5:1 requirement. Pair each palette color with an explicit text color.
- The textarea has an `aria-label`, which is good, but "wheel items" is duplicated across both
  wheels with no way to distinguish Wheel A from Wheel B.

## Tests

Coverage of the pure math and the happy-path component flows is solid, and injecting
`randomFn`/`jitterFn` into the math functions was the right call. Gaps, in priority order:

1. No test renders a single-item wheel (would have caught finding #1 if it asserted on path
   geometry, though jsdom won't catch visual arc degeneracy — a path `d`-attribute assertion
   for coincident endpoints would).
2. No test edits items during a spin (finding #3).
3. No test for `loadItems` with an array of non-strings (finding #4).
4. `computeTargetRotation`'s jitter is only exercised at the neutral `0.5`; no test pins the
   ±0.4-slice bound that keeps the pointer inside the winning slice.
5. The `propertyName` guard in `handleTransitionEnd` is untestable in jsdom (acknowledged in a
   comment, src/Wheel.test.jsx:32-33) — dead weight in the test; the guard itself is
   browser-only behavior taken on faith.

The custom localStorage polyfill in `setupTests.js` has a subtle bug (`this.store[key] || null`
returns `null` for a stored empty string), but it is dormant code — modern Node provides
`localStorage`, which is why the test script suppresses the ExperimentalWarning.

## Tooling & repo hygiene

- **No linting or formatting config** (no ESLint, no Prettier) and **no CI**. For a project
  explicitly built for agent-driven workflows (CLAUDE.md, triage labels, ready-for-agent),
  automated checks are the enforcement mechanism — their absence is the biggest process gap.
- **No type checking**: plain JS with no JSDoc or TS. `Wheel`'s props contract
  (`storageKey`, `defaultItems`) is enforced by nothing.
- **`npm test` is not cross-platform**: the `NODE_OPTIONS=...` env-prefix syntax
  (package.json:10) fails on Windows cmd/PowerShell. Use `cross-env` or move the flag into a
  config.
- **CLAUDE.md references documentation that does not exist**: "Domain docs" points to
  `CONTEXT.md` and `docs/adr/` at the repo root — neither was ever created. Agents following
  those instructions will chase dead links. Either create them or remove the section.
- Dependencies are a major version behind current (React 18 vs 19, Vite 5, Vitest 2). Not
  urgent, but worth a scheduled bump while the codebase is tiny.
- Git history is exemplary: small, well-scoped conventional commits with honest messages
  (including fix-ups like removing unrequested config). `.superpowers/` scratch is correctly
  ignored after the `2d98f92` cleanup.

## What is good (keep doing this)

- Pure-function core (`wheelMath.js`) with injected randomness — the spin logic is fully
  deterministic under test.
- The rotation-accumulation math (`computeTargetRotation`) is correct, including the
  double-mod normalization for negative values and the jitter bound that cannot escape the
  winning slice.
- Spec and plan are committed alongside the code and the implementation actually matches them.
- README is accurate and minimal.

## Priority recommendations

1. Fix single-item wheel rendering (two-arc or `<circle>` path) + add a test.
2. Add a `spinning` timeout fallback (or resolve the winner from state + `setTimeout` matched
   to the transition duration) so a missing `transitionend` cannot lock the wheel.
3. Block or snapshot-isolate item edits during a spin.
4. Accessibility pass: button semantics + keyboard, `aria-live` winner, reduced-motion
   variant, per-color label contrast.
5. Add ESLint + Prettier + a CI workflow running lint and tests.
6. Fix or delete the dead CLAUDE.md domain-docs references.
