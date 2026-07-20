# Jerry's Assignment Wheel — Design Spec (2026-07-20)

Recreates the high-fidelity design in `design_handoff_jerry_wheel/` as a React
component in this Vite app, following the repo's existing patterns (small focused
files, a pure injected-randomness math core à la `src/wheelMath.js`, per-component
CSS files, Vitest + Testing Library).

Source of truth: the handoff's `README.md` (visual/behavior spec) and the
`class Component` logic block in `Jerry's Assignment Wheel.dc.html` (authoritative
for spin math, sound, and state per the handoff's own note). The `support.js`
runtime wrapper and `<x-dc>`/`sc-for` prototyping markup are NOT implemented.

## Product

Single-page novelty gag: two independent "wheel of fortune" wheels spin for a
random teaching **environment** and teaching **subject**. When both have stopped,
a mock bureaucratic "Interim Assignment Notice" memo stamps in. Gag gift for a
substitute teacher (Jerry).

## Decisions (locked with the user)

1. **Placement — replace main view.** `App.jsx` renders `<JerryWheel />` as the
   app's main view. The existing `Wheel.jsx`, `wheelMath.js`, `useWheelItems.js`
   and their 40 tests remain in the repo untouched and still passing — they are
   simply no longer mounted.
2. **Full sound now.** Implement tick / ding / stamp via Web Audio, gated by a
   `soundOn` prop (default `true`), plus a visible on-page mute toggle. Web Audio
   is not unit-testable in jsdom, so it is stubbed in component tests.
3. **Google Fonts.** Add `<link>`s in `index.html` for `Patrick Hand` and
   `Special Elite`. Runtime network dependency accepted; generic fallbacks
   (`cursive` / `monospace`) apply if the fonts fail to load.

## Architecture (Approach B — decomposed)

Rejected alternatives: a single monolithic component (fights the repo's
small-file + pure-core pattern), and extending the existing `Wheel`/`wheelMath`
to be themeable (its CSS-transition spin is fundamentally incompatible with the
rAF-driven spin this design requires for the tick sound — folding it in would
bloat and risk the existing 40 tests).

### New files

- `src/jerryWheelMath.js` — **pure, no React import, fully unit-tested.**
- `src/assignmentSound.js` — Web Audio wrapper. **Not unit-tested** (stubbed).
- `src/AssignmentWheel.jsx` + `src/AssignmentWheel.css` — one spinnable disc.
- `src/AssignmentMemo.jsx` + `src/AssignmentMemo.css` — the memo card.
- `src/JerryWheel.jsx` + `src/JerryWheel.css` — page container.
- Tests: `src/jerryWheelMath.test.js`, `src/AssignmentWheel.test.jsx`,
  `src/JerryWheel.test.jsx`.

### Modified files

- `src/App.jsx` — return `<JerryWheel />` directly (drop the `<div className="app">`
  wrapper, the two generic `Wheel`s, `DEFAULT_ITEMS`, and the `App.css` import).
  `JerryWheel` owns the full page. `src/App.test.jsx` updated to assert the Jerry
  view mounts (banner headline + both wheel plaques present).
- `src/App.css` — deleted (its wrapper/layout is superseded by `JerryWheel.css`).
- `index.html` — Google Fonts preconnect + stylesheet links.

## `src/jerryWheelMath.js` (pure API)

All angles in degrees. Segment 0 starts at the top (12 o'clock) and segments run
clockwise, matching the prototype (`a0 = -90 + i*step`, standard SVG
`x=cx+r·cos`, `y=cy+r·sin`). Note this is a DIFFERENT convention from
`wheelMath.js` (which uses `x=cx+r·sin`, `y=cy-r·cos`); do not share geometry
helpers between the two modules — keep them independent.

- `buildSegments(labels, colors)` → array of
  `{ d, fill, label, textTransform }`, one per label. Constants from the
  prototype: `cx=cy=160`, `r=148`, `step=360/n`. `d` is the pie-slice path
  (`M 160 160 L p0 A 148 148 0 large 1 p1 Z`, `large = step>180?1:0`, endpoints
  `.toFixed(2)`). `fill = colors[i % colors.length]`. `textTransform =
translate(160 160) rotate(mid) translate(r*0.56 0)` plus ` rotate(180)` when
  the segment midpoint's normalized angle is in `(90, 270)` (keeps lower-half
  labels upright).
- `computeLandingRotation(currentRotation, targetIndex, segmentCount, spins)` →
  absolute end rotation (degrees). `step = 360/segmentCount`;
  `targetMod = (((360 - (targetIndex+0.5)*step) % 360) + 360) % 360`;
  `curMod = ((currentRotation % 360) + 360) % 360`;
  `delta = spins*360 + (((targetMod - curMod) % 360) + 360) % 360`;
  returns `currentRotation + delta`. Property: the returned rotation places
  `targetIndex`'s midpoint exactly under the top pointer.
- `genFileNumber(randomFn = Math.random)` → `"SP-" + (1000..9999) + "-" + XX`,
  where `XX` are two letters from `ABCDEFGHJKLMNPQRSTUVWXYZ` (I and O excluded).
  All randomness comes from `randomFn` so tests are deterministic.
- `nextWeekday(fromDate)` → a new `Date` = `fromDate + 1 day`, advanced past any
  Saturday/Sunday (does not mutate the input).
- `formatEffective(date)` →
  `date.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric'})`.

## `src/assignmentSound.js`

`createAssignmentSound(isSoundOn)` where `isSoundOn` is a zero-arg function
returning the current boolean (so the live mute state is always read, not
captured once). Returns `{ ensureAudio, tick, ding, stamp }`:

- `ensureAudio()` — no-op if sound off; lazily constructs
  `new (window.AudioContext || window.webkitAudioContext)()` inside try/catch;
  `resume()` if suspended. Called on the first spin click (a user gesture).
- Internal `blip(freq, dur, type, vol)` — oscillator + gain; `gain` starts
  `0.0001`, `linearRampToValueAtTime(vol, t+0.005)`,
  `exponentialRampToValueAtTime(0.0001, t+dur)`; guarded by sound-on and a live
  context.
- `tick()` — square 1250 Hz, 0.028 s, vol 0.035.
- `ding()` — triangle 680 Hz 0.16 s (vol 0.09), then after 115 ms triangle
  1020 Hz 0.34 s (vol 0.075).
- `stamp()` — sine 150 Hz 0.15 s (vol 0.16) plus a ~0.12 s white-noise burst
  (`buffer[i] = (random*2-1) * (1 - i/len)^2`, gain 0.13).

No React. Consumed by the components via a stable instance.

## `src/AssignmentWheel.jsx`

One spinnable wheel. **Props:** `title`, `labels` (string[]), `colors`
(2-tuple of fills), `hasResult` (bool), `sound` (the shared sound instance),
`onSpinEnd(index)`, `randomFn` (default `Math.random`, injectable for tests).
The disabled state is derived from local `spinning`, not passed in.

**Local state / refs:**

- `spinning` (React state) — drives the hint text and blocks re-entrant spins.
- `rotationRef` (plain ref, number, starts 0) — accumulated rotation; the rAF
  loop reads/writes it WITHOUT triggering re-renders.
- `groupRef` — ref to the SVG `<g>` whose `transform` the loop mutates directly.

**Spin (`handleSpin`)** — mirrors the prototype:

1. return if `spinning`.
2. `sound.ensureAudio()`.
3. `targetIndex = floor(randomFn() * n)`; `spins = 5 + floor(randomFn()*3)`.
4. `end = computeLandingRotation(rotationRef.current, targetIndex, n, spins)`;
   `delta = end - start`.
5. `setSpinning(true)`; start rAF loop, `dur = 4200`, ease `1-(1-t)^3`,
   `t0 = performance.now()`.
6. Each frame: `cur = start + delta*ease(p)`;
   `groupRef.transform = rotate(cur)`; compute `segNow = floor(curMod/step)`;
   on change call `sound.tick()` (the decelerating ratchet).
7. On `p>=1`: `rotationRef.current = end`; `sound.ding()`; `setSpinning(false)`;
   `onSpinEnd(targetIndex)`.
8. `useEffect` cleanup cancels any in-flight `requestAnimationFrame` on unmount.

**Hint:** `spinning ? 'assigning…' : hasResult ? 'click to re-spin' : 'click to spin'`.

**Markup:** brass plaque (`title`) → pointer triangle → wood-ring disc button
(`onClick={handleSpin}`; see accessibility note) → SVG (`viewBox 0 0 320 320`): a `<g ref={groupRef}>`
containing the segment `<path>`s (stroke `rgba(238,240,230,0.20)` width 1.5) and
label `<text>`s (Patrick Hand 13.5px, fill `#eef0e6`, `pointer-events:none`,
`transform` from `buildSegments`), then the static hub circles
(`r=21 #6f4b2a/#2f1e0c`, inner `r=8 #caa24b/#8a6a24`) OUTSIDE the group so they
don't rotate → hint line below.

Accessibility note: the spinnable disc is a clickable `<div>` in the prototype.
For consistency with the repo's accessibility work, wrap the disc in a real
`<button type="button">` (chrome stripped, `:focus-visible` outline,
`aria-label={`Spin the ${title} wheel`}`), so the wheel is keyboard-operable —
matching the pattern established for the existing `Wheel`. `disabled` while
`spinning`. (`disabled` prop above is reserved for this.)

## `src/AssignmentMemo.jsx`

Presentational. **Props:** `teacherName`, `subject`, `environment`,
`effectiveDate` (formatted string), `fileNo`, `onFileNewRequest`.
Renders the aged-paper card with `memoin` entrance, the rotated double-border
`ASSIGNMENT / CONFIRMED` stamp with `stampin` entrance, the FORM 12-J header, the
`140px 1fr` field grid (SUBSTITUTE = `teacherName` + muted `[surname redacted]`,
SUBJECT, ENVIRONMENT, EFFECTIVE = `${effectiveDate}, until further notice.`), the
dashed Policy 4.2 note, and the footer (`FILE {fileNo}` + `FILE NEW REQUEST`
button wired to `onFileNewRequest`). Keyframes `memoin` / `stampin` live in
`AssignmentMemo.css`.

## `src/JerryWheel.jsx` (container)

**Props:** `teacherName = 'Jerry'`, `soundOn = true`.

**State:**

- `result` = `{ env: number|null, topic: number|null }` (segment indices).
- `fileNo` = `string|null`.
- `muted` = `!soundOn` (React state, toggled by the mute button).

**Derived:** `bothDone = result.env != null && result.topic != null`.

**Sound instance:** created once (`useRef`/lazy init) via
`createAssignmentSound(() => !muted)` so the live mute state is honored.

**File number + stamp:** a `useEffect` keyed on `bothDone` fires on the
false→true transition: if `fileNo` is null, set it to
`genFileNumber()`; call `sound.stamp()`.

**Effective date:** computed at render from `formatEffective(nextWeekday(new Date()))`.
(Non-deterministic "today" is acceptable in the running app; the pure helpers are
tested with an injected date.)

**Data:**

```
environments = ['Kindergarten','Grade School','Middle School','After School','School Bus','Summer School']
subjects     = ['P.E.','Nap-Time Patrol','Cafeteria Duty','Potty Rotation','Shop Class','Testing Prep']
envColors    = ['#25392d','#31503c']
topicColors  = ['#23232b','#33333f']
```

**Layout (top→bottom, centered, max content 900px):** kraft-paper page
background + optional `feTurbulence` grain overlay; chalkboard banner (headline
uses `teacherName`; subtitle line); wheels row (`gap 58px`, wrap) with two
`AssignmentWheel`s wired to `onSpinEnd={idx => setResult(r => ({...r, env/topic: idx}))}`
and `hasResult={result.env/topic != null}`; result area (min-height 30px) showing
either the awaiting line or `<AssignmentMemo>`; page footer line. A small
Special-Elite mute toggle (`🔔`/`🔕` or `SOUND: ON/OFF`) sits unobtrusively at the
page top-right.

**Reset (`FILE NEW REQUEST`):** `setResult({env:null, topic:null})` and
`setFileNo(null)`. Wheel rotation refs are untouched, so the wheels stay where
they landed; `hasResult` flips false → hints return to **"click to spin"** (see
discrepancy note).

## Discrepancy resolved

The handoff README (line 116) says the hints reset to "click to re-spin" after
`FILE NEW REQUEST`, but the prototype's `reset()` nulls the results, so its own
hint logic yields **"click to spin."** The logic block is authoritative; this
spec follows it — hint returns to "click to spin" after reset.

## Testing

Follows the repo's existing style (Vitest, Testing Library, injected randomness).

**`src/jerryWheelMath.test.js` (pure, thorough):**

- `buildSegments`: returns `n` entries; each `d` is a valid wedge (contains one
  `A` arc); fills alternate per `colors`; lower-half labels get the `rotate(180)`
  flip and upper-half do not.
- `computeLandingRotation`: for several `targetIndex`, assert the landed rotation
  places that segment's midpoint under the top pointer, i.e.
  `((end + (targetIndex+0.5)*step) mod 360)` ≡ 0 (mod 360, within ε); assert
  `spins` full turns are included (`end - current >= spins*360`).
- `genFileNumber`: format `^SP-\d{4}-[A-HJ-NP-Z]{2}$`; never emits I or O; is
  deterministic under a stubbed `randomFn`.
- `nextWeekday`: from a Friday → Monday; from a Saturday → Monday; from a
  midweek day → next day; does not mutate input.

**`src/AssignmentWheel.test.jsx` (rAF + AudioContext mocked):**

- click → hint becomes `assigning…` and the button is disabled;
- with `requestAnimationFrame`/`performance.now` mocked to complete immediately
  and `randomFn` injected, `onSpinEnd` fires with the forced index and hint
  becomes `click to re-spin`;
- keyboard: focus + Enter on the button starts a spin (via `@testing-library/user-event`).

**`src/JerryWheel.test.jsx`:**

- before both results: shows the awaiting line, no memo;
- after both wheels report (drive `onSpinEnd` through mocked wheels or forced
  spins): memo renders with the chosen subject/environment and a
  `SP-####-XX` file number; mute toggle flips label.

**`src/App.test.jsx` (updated):** the Jerry banner headline and both wheel
plaques render.

**Honest gaps:** the real rAF animation curve and actual audio output are not
asserted (jsdom has neither a compositor nor Web Audio). `assignmentSound.js` is
covered only via stubs at its call sites.

## Non-goals

- No changes to `Wheel.jsx` / `wheelMath.js` / `useWheelItems.js` behavior.
- No persistence (the Jerry wheel does not use localStorage).
- No TypeScript/PropTypes (repo convention).
- The `feTurbulence` grain overlay is decorative; may be omitted if it
  complicates the CSS, per the handoff.
