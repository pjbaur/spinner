## Controller fix (after implementer BLOCKED)

Implementer (sonnet) got 18/19 passing and correctly diagnosed a real plan
bug: jsdom 24.1.3 has no `TransitionEvent` constructor, so
`@testing-library/dom`'s `fireEvent.transitionEnd(el, { propertyName: 'transform' })`
falls back to a plain `Event`, which silently drops the `propertyName` init
property (verified: `window[EventType] || window.Event` in
node_modules/@testing-library/dom/dist/events.js:56, and jsdom's own
`window.TransitionEvent` is `undefined`). The brief's handler guard
`if (e.propertyName !== 'transform') return` therefore always short-circuited
in tests, so `winner` was never set.

Fix: removed the `propertyName` check entirely from `handleTransitionEnd` in
src/Wheel.jsx. Safe because this SVG element has exactly one CSS transition
(`transform`, defined in Wheel.css) — there is no other transition to
disambiguate against, in tests or in the real browser. Test files unchanged
(still pass `{ propertyName: 'transform' }` to `fireEvent.transitionEnd`,
which is now simply ignored — harmless, kept for documentation clarity).

The implementer's other fix — adding `afterEach(() => cleanup())` to
src/setupTests.js — was also verified necessary and kept: without it,
multiple tests rendering `<Wheel>` in the same file leak DOM nodes across
tests (no global afterEach hook exists for RTL's auto-cleanup to attach to,
since this project doesn't use vitest's `globals: true`). This will matter
for every later task's test file too (Task 6, 7 add more tests to the same
files).

Verified: `npm test` → 19/19 passing, pristine, after removing the guard.
