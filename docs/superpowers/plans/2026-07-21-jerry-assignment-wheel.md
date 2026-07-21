# Jerry's Assignment Wheel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the `design_handoff_jerry_wheel/` design — a two-wheel "What will Jerry teach next?" assignment spinner with a bureaucratic memo — as the app's main React view.

**Architecture:** Decomposed per the repo's existing pattern: a pure, unit-tested math module (`jerryWheelMath.js`, parallel to `wheelMath.js`), an isolated Web Audio wrapper (`assignmentSound.js`), a self-contained spinnable wheel (`AssignmentWheel.jsx`) that runs its own `requestAnimationFrame` spin loop and mutates the SVG group transform directly (no per-frame React render), a presentational memo (`AssignmentMemo.jsx`), and a container (`JerryWheel.jsx`) holding results/fileNo/mute state. `App.jsx` renders `<JerryWheel />`.

**Tech Stack:** React 18, Vite 5, Vitest 2 + Testing Library + `@testing-library/user-event`, Web Audio API, Google Fonts (Patrick Hand, Special Elite).

Spec: `docs/superpowers/specs/2026-07-20-jerry-assignment-wheel-design.md`.

## Global Constraints

- Code style: no semicolons, single quotes, 2-space indent (ESLint + Prettier enforce this).
- Before every commit run `npm run format` then confirm `npm run lint` and `npm test` are clean — CI runs all three and must stay green.
- Do not modify `Wheel.jsx`, `wheelMath.js`, `useWheelItems.js`, or their tests; they stay in the repo and keep passing (40 tests). Total suite only grows.
- Pure logic takes injected randomness/dates (`randomFn = Math.random`, an explicit `Date`) so tests are deterministic — mirror the existing `wheelMath.js` convention.
- Web Audio and the rAF animation curve are not asserted (jsdom has neither); components take a stubbable `sound` object and tests mock `requestAnimationFrame`/`performance.now`.
- Segment convention for THIS module: segment 0 at top (12 o'clock), clockwise, `a0 = -90 + i*step`, `x = cx + r·cos`, `y = cy + r·sin`. Do NOT reuse `wheelMath.js` geometry (different convention).
- Exact copy, colors, fonts, and timings come from the spec; reproduce them verbatim.
- Conventional commit subjects; end each commit message with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Pure math module `jerryWheelMath.js`

**Files:**

- Create: `src/jerryWheelMath.js`
- Test: `src/jerryWheelMath.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `buildSegments(labels: string[], colors: string[]) → { d, fill, label, textTransform }[]`
  - `computeLandingRotation(currentRotation: number, targetIndex: number, segmentCount: number, spins: number) → number`
  - `genFileNumber(randomFn = Math.random) → string`
  - `nextWeekday(fromDate: Date) → Date`
  - `formatEffective(date: Date) → string`

- [ ] **Step 1: Write the failing tests**

Create `src/jerryWheelMath.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  buildSegments,
  computeLandingRotation,
  genFileNumber,
  nextWeekday,
  formatEffective,
} from './jerryWheelMath.js'

describe('buildSegments', () => {
  const labels = ['A', 'B', 'C', 'D', 'E', 'F']
  const colors = ['#111', '#222']

  it('returns one entry per label with alternating fills', () => {
    const segs = buildSegments(labels, colors)
    expect(segs).toHaveLength(6)
    expect(segs[0].fill).toBe('#111')
    expect(segs[1].fill).toBe('#222')
    expect(segs[2].fill).toBe('#111')
    expect(segs.map((s) => s.label)).toEqual(labels)
  })

  it('draws each slice as an arc path from the center', () => {
    const segs = buildSegments(labels, colors)
    for (const s of segs) {
      expect(s.d.startsWith('M 160 160 L ')).toBe(true)
      expect(s.d).toMatch(/ A 148 148 0 [01] 1 /)
      expect(s.d.endsWith(' Z')).toBe(true)
    }
  })

  it('flips only lower-half labels 180 degrees to keep them upright', () => {
    const segs = buildSegments(labels, colors)
    // 6 segments, step 60, mids at -60,0,60,120,180,240 -> normalized 300,0,60,120,180,240
    // flip when normalized mid in (90,270): indices 3 (120), 4 (180), 5 (240)
    expect(segs[0].textTransform).not.toContain('rotate(180)')
    expect(segs[1].textTransform).not.toContain('rotate(180)')
    expect(segs[2].textTransform).not.toContain('rotate(180)')
    expect(segs[3].textTransform).toContain('rotate(180)')
    expect(segs[4].textTransform).toContain('rotate(180)')
    expect(segs[5].textTransform).toContain('rotate(180)')
  })
})

describe('computeLandingRotation', () => {
  const n = 6
  const step = 360 / n

  it('lands with the target segment centered under the top pointer', () => {
    for (let idx = 0; idx < n; idx++) {
      const end = computeLandingRotation(0, idx, n, 5)
      const centered = (((end + (idx + 0.5) * step) % 360) + 360) % 360
      expect(Math.min(centered, 360 - centered)).toBeLessThan(1e-6)
    }
  })

  it('includes the requested number of whole spins beyond the current angle', () => {
    const end = computeLandingRotation(37, 2, n, 5)
    const delta = end - 37
    expect(delta).toBeGreaterThanOrEqual(5 * 360)
    expect(delta).toBeLessThan(6 * 360)
  })
})

describe('genFileNumber', () => {
  it('formats as SP-####-XX excluding letters I and O', () => {
    const seq = [0.5, 0, 0.999999]
    let i = 0
    const rng = () => seq[i++ % seq.length]
    const fileNo = genFileNumber(rng)
    expect(fileNo).toMatch(/^SP-\d{4}-[A-HJ-NP-Z]{2}$/)
  })

  it('never emits I or O across many draws', () => {
    let x = 0
    const rng = () => (x += 0.017) % 1
    for (let k = 0; k < 200; k++) {
      const letters = genFileNumber(rng).slice(-2)
      expect(letters).not.toMatch(/[IO]/)
    }
  })
})

describe('nextWeekday', () => {
  it('returns the next calendar day on a weekday', () => {
    const wed = new Date(2026, 6, 22) // Wed Jul 22 2026
    expect(nextWeekday(wed).getDate()).toBe(23)
  })

  it('skips the weekend from Friday to Monday', () => {
    const fri = new Date(2026, 6, 24) // Fri Jul 24 2026
    const d = nextWeekday(fri)
    expect(d.getDay()).toBe(1)
    expect(d.getDate()).toBe(27)
  })

  it('does not mutate the input', () => {
    const fri = new Date(2026, 6, 24)
    nextWeekday(fri)
    expect(fri.getDate()).toBe(24)
  })
})

describe('formatEffective', () => {
  it('formats as Weekday, Month D, YYYY', () => {
    expect(formatEffective(new Date(2026, 6, 27))).toBe('Monday, July 27, 2026')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/jerryWheelMath.test.js`
Expected: FAIL (module `./jerryWheelMath.js` does not exist).

- [ ] **Step 3: Write the implementation**

Create `src/jerryWheelMath.js`:

```js
const CENTER = 160
const RADIUS = 148
const LABEL_RADIUS_FRACTION = 0.56
const FILE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

function toRadians(deg) {
  return (deg * Math.PI) / 180
}

export function buildSegments(labels, colors) {
  const n = labels.length
  const step = 360 / n
  return labels.map((label, i) => {
    const a0 = -90 + i * step
    const a1 = a0 + step
    const mid = a0 + step / 2
    const p0x = CENTER + RADIUS * Math.cos(toRadians(a0))
    const p0y = CENTER + RADIUS * Math.sin(toRadians(a0))
    const p1x = CENTER + RADIUS * Math.cos(toRadians(a1))
    const p1y = CENTER + RADIUS * Math.sin(toRadians(a1))
    const large = step > 180 ? 1 : 0
    const d = `M ${CENTER} ${CENTER} L ${p0x.toFixed(2)} ${p0y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${p1x.toFixed(2)} ${p1y.toFixed(2)} Z`
    const norm = ((mid % 360) + 360) % 360
    const flip = norm > 90 && norm < 270
    const textTransform =
      `translate(${CENTER} ${CENTER}) rotate(${mid.toFixed(2)}) translate(${(RADIUS * LABEL_RADIUS_FRACTION).toFixed(1)} 0)` +
      (flip ? ' rotate(180)' : '')
    return { d, fill: colors[i % colors.length], label, textTransform }
  })
}

export function computeLandingRotation(
  currentRotation,
  targetIndex,
  segmentCount,
  spins,
) {
  const step = 360 / segmentCount
  const targetMod = (((360 - (targetIndex + 0.5) * step) % 360) + 360) % 360
  const curMod = ((currentRotation % 360) + 360) % 360
  const delta = spins * 360 + ((((targetMod - curMod) % 360) + 360) % 360)
  return currentRotation + delta
}

export function genFileNumber(randomFn = Math.random) {
  const digits = 1000 + Math.floor(randomFn() * 9000)
  const letters = Array.from(
    { length: 2 },
    () => FILE_LETTERS[Math.floor(randomFn() * FILE_LETTERS.length)],
  ).join('')
  return `SP-${digits}-${letters}`
}

export function nextWeekday(fromDate) {
  const d = new Date(fromDate.getTime())
  do {
    d.setDate(d.getDate() + 1)
  } while (d.getDay() === 0 || d.getDay() === 6)
  return d
}

export function formatEffective(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/jerryWheelMath.test.js`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Format, lint, commit**

```bash
npm run format
npm run lint
git add src/jerryWheelMath.js src/jerryWheelMath.test.js
git commit -m "feat: add pure jerryWheelMath module (geometry, landing, file no, dates)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Web Audio wrapper `assignmentSound.js`

**Files:**

- Create: `src/assignmentSound.js`
- Test: `src/assignmentSound.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces: `createAssignmentSound(isSoundOn: () => boolean) → { ensureAudio(), tick(), ding(), stamp() }`. All methods are no-ops when `isSoundOn()` returns false or no `AudioContext` could be created. Safe to call in jsdom (no `AudioContext` → silently does nothing).

Only the guard behavior is testable in jsdom; oscillator output is not. Keep the test to the guard contract.

- [ ] **Step 1: Write the failing test**

Create `src/assignmentSound.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { createAssignmentSound } from './assignmentSound.js'

describe('createAssignmentSound', () => {
  it('exposes the four sound methods', () => {
    const sound = createAssignmentSound(() => true)
    expect(typeof sound.ensureAudio).toBe('function')
    expect(typeof sound.tick).toBe('function')
    expect(typeof sound.ding).toBe('function')
    expect(typeof sound.stamp).toBe('function')
  })

  it('is a no-op and never throws when sound is off', () => {
    const sound = createAssignmentSound(() => false)
    expect(() => {
      sound.ensureAudio()
      sound.tick()
      sound.ding()
      sound.stamp()
    }).not.toThrow()
  })

  it('does not throw in an environment without AudioContext', () => {
    // jsdom has no window.AudioContext; ensureAudio must swallow the failure
    const sound = createAssignmentSound(() => true)
    expect(() => {
      sound.ensureAudio()
      sound.tick()
      sound.stamp()
    }).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/assignmentSound.test.js`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Write the implementation**

Create `src/assignmentSound.js`:

```js
export function createAssignmentSound(isSoundOn) {
  let ctx = null

  function on() {
    return isSoundOn() !== false
  }

  function ensureAudio() {
    if (!on()) return
    if (!ctx) {
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext
        ctx = new Ctor()
      } catch {
        ctx = null
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume()
  }

  function blip(freq, dur, type, vol) {
    if (!on() || !ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.linearRampToValueAtTime(vol, t + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  function tick() {
    blip(1250, 0.028, 'square', 0.035)
  }

  function ding() {
    blip(680, 0.16, 'triangle', 0.09)
    setTimeout(() => blip(1020, 0.34, 'triangle', 0.075), 115)
  }

  function stamp() {
    if (!on() || !ctx) return
    blip(150, 0.15, 'sine', 0.16)
    const len = Math.floor(ctx.sampleRate * 0.12)
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2)
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = 0.13
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start(ctx.currentTime)
  }

  return { ensureAudio, tick, ding, stamp }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/assignmentSound.test.js`
Expected: PASS.

- [ ] **Step 5: Format, lint, commit**

```bash
npm run format
npm run lint
git add src/assignmentSound.js src/assignmentSound.test.js
git commit -m "feat: add Web Audio assignment sound wrapper (tick, ding, stamp)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Spinnable `AssignmentWheel` component

**Files:**

- Create: `src/AssignmentWheel.jsx`, `src/AssignmentWheel.css`
- Test: `src/AssignmentWheel.test.jsx`

**Interfaces:**

- Consumes: `buildSegments`, `computeLandingRotation` from `./jerryWheelMath.js`; a `sound` object shaped like Task 2's return value.
- Produces: default export `AssignmentWheel`. **Props:** `title: string`, `labels: string[]`, `colors: [string, string]`, `hasResult: boolean`, `sound: {ensureAudio,tick,ding,stamp}`, `onSpinEnd: (index: number) => void`, `randomFn?: () => number`. Renders a `<button>` disc with `aria-label={`Spin the ${title} wheel`}`, disabled while spinning.

- [ ] **Step 1: Write the failing tests**

Create `src/AssignmentWheel.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssignmentWheel from './AssignmentWheel.jsx'

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F']
const COLORS = ['#111', '#222']

function stubSound() {
  return { ensureAudio: vi.fn(), tick: vi.fn(), ding: vi.fn(), stamp: vi.fn() }
}

function renderWheel(overrides = {}) {
  const props = {
    title: 'TEST WHEEL',
    labels: LABELS,
    colors: COLORS,
    hasResult: false,
    sound: stubSound(),
    onSpinEnd: vi.fn(),
    randomFn: () => 0,
    ...overrides,
  }
  render(<AssignmentWheel {...props} />)
  return props
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AssignmentWheel hint text', () => {
  it('shows "click to spin" before a result', () => {
    renderWheel({ hasResult: false })
    expect(screen.getByText('click to spin')).toBeInTheDocument()
  })

  it('shows "click to re-spin" once a result exists', () => {
    renderWheel({ hasResult: true })
    expect(screen.getByText('click to re-spin')).toBeInTheDocument()
  })
})

describe('AssignmentWheel spinning', () => {
  it('disables the button and shows "assigning…" while a spin is in flight', async () => {
    // requestAnimationFrame stores the callback but never invokes it -> spin never completes
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    const user = userEvent.setup()
    const props = renderWheel()
    await user.click(
      screen.getByRole('button', { name: 'Spin the TEST WHEEL wheel' }),
    )
    expect(screen.getByText('assigning…')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Spin the TEST WHEEL wheel' }),
    ).toBeDisabled()
    expect(props.sound.ensureAudio).toHaveBeenCalledTimes(1)
    expect(props.onSpinEnd).not.toHaveBeenCalled()
  })

  it('reports the forced target index when the spin completes', async () => {
    // invoke the rAF callback once with a timestamp far past the duration -> p=1 -> completes
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(1e9)
      return 1
    })
    const user = userEvent.setup()
    const props = renderWheel({ randomFn: () => 0 }) // targetIndex = floor(0*6) = 0
    await user.click(
      screen.getByRole('button', { name: 'Spin the TEST WHEEL wheel' }),
    )
    expect(props.onSpinEnd).toHaveBeenCalledWith(0)
    expect(props.sound.ding).toHaveBeenCalledTimes(1)
  })

  it('starts a spin from keyboard activation', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    const user = userEvent.setup()
    renderWheel()
    const button = screen.getByRole('button', {
      name: 'Spin the TEST WHEEL wheel',
    })
    button.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByText('assigning…')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/AssignmentWheel.test.jsx`
Expected: FAIL (component does not exist).

- [ ] **Step 3: Write the component**

Create `src/AssignmentWheel.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react'
import { buildSegments, computeLandingRotation } from './jerryWheelMath.js'
import './AssignmentWheel.css'

const SPIN_DURATION_MS = 4200

function hintText(spinning, hasResult) {
  if (spinning) return 'assigning…'
  return hasResult ? 'click to re-spin' : 'click to spin'
}

export default function AssignmentWheel({
  title,
  labels,
  colors,
  hasResult,
  sound,
  onSpinEnd,
  randomFn = Math.random,
}) {
  const [spinning, setSpinning] = useState(false)
  const rotationRef = useRef(0)
  const groupRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const segments = buildSegments(labels, colors)
  const n = labels.length
  const step = 360 / n

  function handleSpin() {
    if (spinning) return
    sound.ensureAudio()
    const targetIndex = Math.floor(randomFn() * n)
    const spins = 5 + Math.floor(randomFn() * 3)
    const start = rotationRef.current
    const end = computeLandingRotation(start, targetIndex, n, spins)
    const delta = end - start
    const ease = (x) => 1 - Math.pow(1 - x, 3)
    const t0 = performance.now()
    let lastSeg = Math.floor((((start % 360) + 360) % 360) / step)
    setSpinning(true)
    const frame = (now) => {
      let p = (now - t0) / SPIN_DURATION_MS
      if (p > 1) p = 1
      const cur = start + delta * ease(p)
      if (groupRef.current)
        groupRef.current.style.transform = `rotate(${cur}deg)`
      const segNow = Math.floor((((cur % 360) + 360) % 360) / step)
      if (segNow !== lastSeg) {
        lastSeg = segNow
        sound.tick()
      }
      if (p < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        rotationRef.current = end
        rafRef.current = null
        sound.ding()
        setSpinning(false)
        onSpinEnd(targetIndex)
      }
    }
    rafRef.current = requestAnimationFrame(frame)
  }

  return (
    <div className="assignment-wheel">
      <div className="assignment-wheel__plaque">{title}</div>
      <div className="assignment-wheel__stage">
        <div className="assignment-wheel__pointer" />
        <button
          type="button"
          className="assignment-wheel__disc"
          aria-label={`Spin the ${title} wheel`}
          disabled={spinning}
          onClick={handleSpin}
        >
          <svg viewBox="0 0 320 320" className="assignment-wheel__svg">
            <g
              ref={groupRef}
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'center',
                willChange: 'transform',
              }}
            >
              {segments.map((s, i) => (
                <path
                  key={i}
                  d={s.d}
                  fill={s.fill}
                  stroke="rgba(238,240,230,0.20)"
                  strokeWidth="1.5"
                />
              ))}
              {segments.map((s, i) => (
                <text
                  key={i}
                  transform={s.textTransform}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="assignment-wheel__label"
                >
                  {s.label}
                </text>
              ))}
            </g>
            <circle
              cx="160"
              cy="160"
              r="21"
              fill="#6f4b2a"
              stroke="#2f1e0c"
              strokeWidth="3"
            />
            <circle
              cx="160"
              cy="160"
              r="8"
              fill="#caa24b"
              stroke="#8a6a24"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>
      <div className="assignment-wheel__hint">
        {hintText(spinning, hasResult)}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write the stylesheet**

Create `src/AssignmentWheel.css`:

```css
.assignment-wheel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.assignment-wheel__plaque {
  font-family: 'Special Elite', monospace;
  font-size: 11px;
  letter-spacing: 2.5px;
  color: #3a2712;
  background: linear-gradient(#d0a951, #a9812f);
  padding: 8px 18px;
  border-radius: 4px;
  border: 2px solid #7a5d22;
  box-shadow:
    0 2px 7px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.assignment-wheel__stage {
  position: relative;
  width: 320px;
  height: 346px;
}

.assignment-wheel__pointer {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  width: 0;
  height: 0;
  border-left: 15px solid transparent;
  border-right: 15px solid transparent;
  border-top: 32px solid #caa24b;
  filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.45));
}

.assignment-wheel__disc {
  position: absolute;
  top: 24px;
  left: 0;
  width: 320px;
  height: 320px;
  padding: 13px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  background: radial-gradient(circle at 50% 38%, #8a6036, #593a1d 68%, #3e260e);
  box-shadow:
    0 16px 32px rgba(0, 0, 0, 0.42),
    inset 0 0 0 3px #3a2712,
    inset 0 3px 12px rgba(255, 255, 255, 0.16);
}

.assignment-wheel__disc:focus-visible {
  outline: 3px solid #caa24b;
  outline-offset: 3px;
}

.assignment-wheel__disc:disabled {
  cursor: default;
}

.assignment-wheel__svg {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.55);
}

.assignment-wheel__label {
  font-family: 'Patrick Hand', cursive;
  font-size: 13.5px;
  fill: #eef0e6;
  letter-spacing: 0.3px;
  pointer-events: none;
}

.assignment-wheel__hint {
  font-family: 'Special Elite', monospace;
  font-size: 12px;
  letter-spacing: 1.5px;
  color: #5a3b1e;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/AssignmentWheel.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Format, lint, commit**

```bash
npm run format
npm run lint
git add src/AssignmentWheel.jsx src/AssignmentWheel.css src/AssignmentWheel.test.jsx
git commit -m "feat: add AssignmentWheel with rAF spin, tick sound, keyboard access

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Presentational `AssignmentMemo` component

**Files:**

- Create: `src/AssignmentMemo.jsx`, `src/AssignmentMemo.css`
- Test: `src/AssignmentMemo.test.jsx`

**Interfaces:**

- Consumes: nothing (pure presentational).
- Produces: default export `AssignmentMemo`. **Props:** `teacherName: string`, `subject: string`, `environment: string`, `effectiveDate: string` (already formatted), `fileNo: string`, `onFileNewRequest: () => void`.

- [ ] **Step 1: Write the failing tests**

Create `src/AssignmentMemo.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssignmentMemo from './AssignmentMemo.jsx'

function renderMemo(overrides = {}) {
  const props = {
    teacherName: 'Jerry',
    subject: 'P.E.',
    environment: 'Kindergarten',
    effectiveDate: 'Monday, July 27, 2026',
    fileNo: 'SP-4821-KT',
    onFileNewRequest: vi.fn(),
    ...overrides,
  }
  render(<AssignmentMemo {...props} />)
  return props
}

describe('AssignmentMemo', () => {
  it('renders the interim assignment notice with chosen values', () => {
    renderMemo()
    expect(screen.getByText('INTERIM ASSIGNMENT NOTICE')).toBeInTheDocument()
    expect(screen.getByText('P.E.')).toBeInTheDocument()
    expect(screen.getByText('Kindergarten')).toBeInTheDocument()
    expect(screen.getByText('Jerry', { exact: false })).toBeInTheDocument()
    expect(
      screen.getByText(/Monday, July 27, 2026, until further notice\./),
    ).toBeInTheDocument()
    expect(screen.getByText('FILE SP-4821-KT')).toBeInTheDocument()
  })

  it('fires onFileNewRequest when the button is clicked', async () => {
    const user = userEvent.setup()
    const props = renderMemo()
    await user.click(screen.getByRole('button', { name: 'FILE NEW REQUEST' }))
    expect(props.onFileNewRequest).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/AssignmentMemo.test.jsx`
Expected: FAIL (component does not exist).

- [ ] **Step 3: Write the component**

Create `src/AssignmentMemo.jsx`:

```jsx
import './AssignmentMemo.css'

export default function AssignmentMemo({
  teacherName,
  subject,
  environment,
  effectiveDate,
  fileNo,
  onFileNewRequest,
}) {
  return (
    <div className="memo">
      <div className="memo__stamp">
        ASSIGNMENT
        <br />
        CONFIRMED
      </div>

      <div className="memo__header">
        <div className="memo__eyebrow">
          UNIFIED SUBSTITUTE DISTRICT · FORM 12-J
        </div>
        <div className="memo__title">INTERIM ASSIGNMENT NOTICE</div>
      </div>

      <div className="memo__grid">
        <div className="memo__label">SUBSTITUTE</div>
        <div className="memo__value">
          {teacherName}{' '}
          <span className="memo__redacted">[surname redacted]</span>
        </div>
        <div className="memo__label">SUBJECT</div>
        <div className="memo__value memo__value--big">{subject}</div>
        <div className="memo__label">ENVIRONMENT</div>
        <div className="memo__value memo__value--big">{environment}</div>
        <div className="memo__label">EFFECTIVE</div>
        <div>{effectiveDate}, until further notice.</div>
      </div>

      <div className="memo__note">
        Prior experience (avant-garde composition, touring musicianship,
        three-chord conviction) noted and disregarded per Policy 4.2. Report to
        the front office at 7:15 a.m. A whistle will be provided.
      </div>

      <div className="memo__footer">
        <div className="memo__file">FILE {fileNo}</div>
        <button
          type="button"
          className="memo__button"
          onClick={onFileNewRequest}
        >
          FILE NEW REQUEST
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write the stylesheet**

Create `src/AssignmentMemo.css`:

```css
@keyframes memoin {
  0% {
    transform: translateY(14px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes stampin {
  0% {
    transform: rotate(-11deg) scale(2.6);
    opacity: 0;
  }
  55% {
    opacity: 0.95;
  }
  100% {
    transform: rotate(-11deg) scale(1);
    opacity: 0.86;
  }
}

.memo {
  position: relative;
  width: min(560px, 92vw);
  background: linear-gradient(#f4edd8, #e7dcbf);
  color: #2b2b2b;
  border: 1px solid #cbbd97;
  border-radius: 3px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.36);
  padding: 34px 40px 28px;
  font-family: 'Special Elite', monospace;
  animation: memoin 0.35s ease both;
}

.memo__stamp {
  position: absolute;
  top: 20px;
  right: 20px;
  transform: rotate(-11deg);
  border: 3px double #b3372b;
  color: #b3372b;
  padding: 6px 11px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.1;
  letter-spacing: 2px;
  text-align: center;
  opacity: 0.86;
  animation: stampin 0.42s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}

.memo__header {
  text-align: center;
  border-bottom: 2px solid #2b2b2b;
  padding-bottom: 12px;
  margin-bottom: 20px;
}

.memo__eyebrow {
  font-size: 10.5px;
  letter-spacing: 3px;
  color: #6b6455;
}

.memo__title {
  font-size: 21px;
  letter-spacing: 1px;
  margin-top: 5px;
}

.memo__grid {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 11px 14px;
  font-size: 15px;
  line-height: 1.45;
}

.memo__label {
  letter-spacing: 1px;
  color: #6b6455;
  padding-top: 2px;
}

.memo__value {
  font-weight: bold;
}

.memo__value--big {
  font-size: 18px;
}

.memo__redacted {
  color: #8a8270;
  font-weight: normal;
}

.memo__note {
  margin-top: 18px;
  font-size: 11.5px;
  line-height: 1.55;
  color: #6b6455;
  border-top: 1px dashed #b9ac86;
  padding-top: 13px;
}

.memo__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 18px;
}

.memo__file {
  font-size: 11px;
  color: #6b6455;
  letter-spacing: 1px;
}

.memo__button {
  font-family: 'Special Elite', monospace;
  font-size: 12px;
  letter-spacing: 1px;
  cursor: pointer;
  background: #2b2b2b;
  color: #f4edd8;
  border: none;
  padding: 10px 17px;
  border-radius: 3px;
}

.memo__button:focus-visible {
  outline: 2px solid #caa24b;
  outline-offset: 2px;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/AssignmentMemo.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Format, lint, commit**

```bash
npm run format
npm run lint
git add src/AssignmentMemo.jsx src/AssignmentMemo.css src/AssignmentMemo.test.jsx
git commit -m "feat: add AssignmentMemo card

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `JerryWheel` container

**Files:**

- Create: `src/JerryWheel.jsx`, `src/JerryWheel.css`
- Test: `src/JerryWheel.test.jsx`

**Interfaces:**

- Consumes: `AssignmentWheel` (default), `AssignmentMemo` (default), `createAssignmentSound` from `./assignmentSound.js`, `genFileNumber`, `nextWeekday`, `formatEffective` from `./jerryWheelMath.js`.
- Produces: default export `JerryWheel`. **Props:** `teacherName = 'Jerry'`, `soundOn = true`.

The test mocks `AssignmentWheel` so the container can be tested without the rAF loop.

- [ ] **Step 1: Write the failing tests**

Create `src/JerryWheel.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Replace the real wheel with a stub that reports a fixed index on click.
vi.mock('./AssignmentWheel.jsx', () => ({
  default: ({ title, onSpinEnd }) => (
    <button type="button" onClick={() => onSpinEnd(0)}>
      spin {title}
    </button>
  ),
}))

import JerryWheel from './JerryWheel.jsx'

describe('JerryWheel', () => {
  it('shows the banner and the awaiting line before both wheels resolve', () => {
    render(<JerryWheel />)
    expect(screen.getByText('What will Jerry teach next?')).toBeInTheDocument()
    expect(screen.getByText('TEACHING ENVIRONMENT')).toBeInTheDocument()
    expect(screen.getByText('TEACHING SUBJECT')).toBeInTheDocument()
    expect(
      screen.getByText('— awaiting results of both wheels —'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('INTERIM ASSIGNMENT NOTICE'),
    ).not.toBeInTheDocument()
  })

  it('renders the memo with a file number once both wheels resolve', async () => {
    const user = userEvent.setup()
    render(<JerryWheel />)
    await user.click(screen.getByText('spin TEACHING ENVIRONMENT'))
    await user.click(screen.getByText('spin TEACHING SUBJECT'))
    expect(screen.getByText('INTERIM ASSIGNMENT NOTICE')).toBeInTheDocument()
    // index 0 for both -> environments[0] and subjects[0]
    expect(screen.getByText('Kindergarten')).toBeInTheDocument()
    expect(screen.getByText('P.E.')).toBeInTheDocument()
    expect(
      screen.getByText(/^FILE SP-\d{4}-[A-HJ-NP-Z]{2}$/),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('— awaiting results of both wheels —'),
    ).not.toBeInTheDocument()
  })

  it('clears the memo when FILE NEW REQUEST is clicked', async () => {
    const user = userEvent.setup()
    render(<JerryWheel />)
    await user.click(screen.getByText('spin TEACHING ENVIRONMENT'))
    await user.click(screen.getByText('spin TEACHING SUBJECT'))
    await user.click(screen.getByRole('button', { name: 'FILE NEW REQUEST' }))
    expect(
      screen.queryByText('INTERIM ASSIGNMENT NOTICE'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('— awaiting results of both wheels —'),
    ).toBeInTheDocument()
  })

  it('toggles the mute control', async () => {
    const user = userEvent.setup()
    render(<JerryWheel />)
    const toggle = screen.getByRole('button', { name: /sound/i })
    expect(toggle).toHaveTextContent(/on/i)
    await user.click(toggle)
    expect(toggle).toHaveTextContent(/off/i)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/JerryWheel.test.jsx`
Expected: FAIL (component does not exist).

- [ ] **Step 3: Write the component**

Create `src/JerryWheel.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react'
import AssignmentWheel from './AssignmentWheel.jsx'
import AssignmentMemo from './AssignmentMemo.jsx'
import { createAssignmentSound } from './assignmentSound.js'
import {
  genFileNumber,
  nextWeekday,
  formatEffective,
} from './jerryWheelMath.js'
import './JerryWheel.css'

const ENVIRONMENTS = [
  'Kindergarten',
  'Grade School',
  'Middle School',
  'After School',
  'School Bus',
  'Summer School',
]
const SUBJECTS = [
  'P.E.',
  'Nap-Time Patrol',
  'Cafeteria Duty',
  'Potty Rotation',
  'Shop Class',
  'Testing Prep',
]
const ENV_COLORS = ['#25392d', '#31503c']
const TOPIC_COLORS = ['#23232b', '#33333f']

export default function JerryWheel({ teacherName = 'Jerry', soundOn = true }) {
  const [result, setResult] = useState({ env: null, topic: null })
  const [fileNo, setFileNo] = useState(null)
  const [muted, setMuted] = useState(!soundOn)

  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const soundRef = useRef(null)
  if (soundRef.current === null) {
    soundRef.current = createAssignmentSound(() => !mutedRef.current)
  }
  const sound = soundRef.current

  const bothDone = result.env != null && result.topic != null

  useEffect(() => {
    if (!bothDone) return
    setFileNo((prev) => prev ?? genFileNumber())
    sound.stamp()
  }, [bothDone, sound])

  function handleReset() {
    setResult({ env: null, topic: null })
    setFileNo(null)
  }

  const effectiveDate = formatEffective(nextWeekday(new Date()))

  return (
    <div className="jerry">
      <div className="jerry__grain" aria-hidden="true" />
      <div className="jerry__content">
        <button
          type="button"
          className="jerry__mute"
          aria-label="Toggle sound"
          onClick={() => setMuted((m) => !m)}
        >
          SOUND: {muted ? 'OFF' : 'ON'}
        </button>

        <div className="jerry__banner">
          <div className="jerry__title">
            What will {teacherName} teach next?
          </div>
          <div className="jerry__subtitle">
            OFFICE OF SUBSTITUTE PLACEMENT &nbsp;·&nbsp; SPIN BOTH WHEELS TO
            RECEIVE TODAY'S ASSIGNMENT
          </div>
        </div>

        <div className="jerry__wheels">
          <AssignmentWheel
            title="TEACHING ENVIRONMENT"
            labels={ENVIRONMENTS}
            colors={ENV_COLORS}
            hasResult={result.env != null}
            sound={sound}
            onSpinEnd={(idx) => setResult((r) => ({ ...r, env: idx }))}
          />
          <AssignmentWheel
            title="TEACHING SUBJECT"
            labels={SUBJECTS}
            colors={TOPIC_COLORS}
            hasResult={result.topic != null}
            sound={sound}
            onSpinEnd={(idx) => setResult((r) => ({ ...r, topic: idx }))}
          />
        </div>

        <div className="jerry__result">
          {!bothDone && (
            <div className="jerry__awaiting">
              — awaiting results of both wheels —
            </div>
          )}
          {bothDone && (
            <AssignmentMemo
              teacherName={teacherName}
              subject={SUBJECTS[result.topic]}
              environment={ENVIRONMENTS[result.env]}
              effectiveDate={effectiveDate}
              fileNo={fileNo ?? 'PENDING'}
              onFileNewRequest={handleReset}
            />
          )}
        </div>

        <div className="jerry__footer">
          Assignments are final. Appeals may be filed with the vice principal,
          who is also unavailable.
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write the stylesheet**

Create `src/JerryWheel.css`:

```css
.jerry {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: radial-gradient(
    ellipse at 50% -8%,
    #e4d3ac,
    #cdb488 52%,
    #b6996c 100%
  );
  font-family: 'Special Elite', monospace;
}

.jerry__grain {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  mix-blend-mode: multiply;
  opacity: 0.1;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.jerry__content {
  position: relative;
  z-index: 1;
  padding: 40px 20px 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 36px;
}

.jerry__mute {
  position: absolute;
  top: 12px;
  right: 16px;
  font-family: 'Special Elite', monospace;
  font-size: 11px;
  letter-spacing: 1.5px;
  color: #3a2712;
  background: rgba(208, 169, 81, 0.55);
  border: 1px solid #7a5d22;
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
}

.jerry__mute:focus-visible {
  outline: 2px solid #caa24b;
  outline-offset: 2px;
}

.jerry__banner {
  width: 100%;
  max-width: 900px;
  background: linear-gradient(#2b4133, #20342a);
  border: 13px solid #6f4b2a;
  border-radius: 12px;
  box-shadow:
    0 12px 34px rgba(0, 0, 0, 0.4),
    inset 0 0 70px rgba(0, 0, 0, 0.45),
    inset 0 0 0 2px #3a2712;
  padding: 28px 30px;
  text-align: center;
}

.jerry__title {
  font-family: 'Patrick Hand', cursive;
  color: #f2f4ea;
  font-size: 44px;
  line-height: 1.02;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
}

.jerry__subtitle {
  font-family: 'Special Elite', monospace;
  color: rgba(242, 244, 234, 0.72);
  font-size: 12px;
  margin-top: 12px;
  letter-spacing: 2px;
}

.jerry__wheels {
  display: flex;
  flex-wrap: wrap;
  gap: 58px;
  justify-content: center;
  align-items: flex-start;
}

.jerry__result {
  min-height: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.jerry__awaiting {
  font-family: 'Special Elite', monospace;
  color: #5a3b1e;
  font-size: 13px;
  letter-spacing: 1.5px;
  opacity: 0.75;
}

.jerry__footer {
  font-family: 'Special Elite', monospace;
  font-size: 10.5px;
  letter-spacing: 1.5px;
  color: rgba(58, 39, 18, 0.55);
  text-align: center;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/JerryWheel.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Format, lint, commit**

```bash
npm run format
npm run lint
git add src/JerryWheel.jsx src/JerryWheel.css src/JerryWheel.test.jsx
git commit -m "feat: add JerryWheel container (wheels, memo, file number, mute)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Wire into the app + Google Fonts

**Files:**

- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`
- Delete: `src/App.css`
- Modify: `index.html`

**Interfaces:**

- Consumes: `JerryWheel` (default) from `./JerryWheel.jsx`.
- Produces: `App` renders `<JerryWheel />` as the whole page.

- [ ] **Step 1: Rewrite the App test**

Replace the entire contents of `src/App.test.jsx` with:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

describe('App', () => {
  it('renders the Jerry assignment wheel view', () => {
    render(<App />)
    expect(screen.getByText('What will Jerry teach next?')).toBeInTheDocument()
    expect(screen.getByText('TEACHING ENVIRONMENT')).toBeInTheDocument()
    expect(screen.getByText('TEACHING SUBJECT')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/App.test.jsx`
Expected: FAIL (App still renders the old generic wheels; the plaque text is absent).

- [ ] **Step 3: Rewrite App.jsx**

Replace the entire contents of `src/App.jsx` with:

```jsx
import JerryWheel from './JerryWheel.jsx'

export default function App() {
  return <JerryWheel />
}
```

- [ ] **Step 4: Delete the now-unused App.css**

```bash
git rm src/App.css
```

(`App.jsx` no longer imports it; confirm no other file imports `App.css` with `grep -rn "App.css" src` — expect no matches.)

- [ ] **Step 5: Add Google Fonts to index.html**

In `index.html`, inside `<head>` (after the existing `<meta name="viewport" ...>` line), add:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Special+Elite&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — all prior tests (40) plus the new module/component tests, with the App test now asserting the Jerry view. No failures, output pristine.

- [ ] **Step 7: Verify lint and format across the whole tree**

Run: `npm run lint && npm run format:check`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/App.test.jsx index.html
git commit -m "feat: render JerryWheel as the app view; load Patrick Hand + Special Elite

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Manual smoke check (optional but recommended)**

Run `npm run dev`, open the app, and confirm: banner in chalk font; two wheels spin on click with a decelerating tick; each stops with the pointer centered on a slice; when both have stopped the memo stamps in with subject/environment/date/file number; FILE NEW REQUEST clears the memo; the mute toggle silences sound. (Fonts require network; without it, generic fallbacks apply.)

---

## Self-Review

**Spec coverage:**

- Header banner → Task 5 (`jerry__banner`). ✓
- Two wheels, data + colors → Task 5 data constants + Task 3 rendering. ✓
- Brass plaque, pointer, wood ring, SVG, hub, labels → Task 3 markup + CSS. ✓
- Deterministic rAF spin, 4200ms, easeOutCubic, tick on boundary, ding on stop → Task 3. ✓
- Segment geometry + landing math + file number + effective date → Task 1. ✓
- Sound (tick/ding/stamp, lazy ctx, soundOn gate) → Task 2, wired in Tasks 3 & 5. ✓
- Memo (aged paper, stamp, header, field grid, note, footer, animations) → Task 4. ✓
- Awaiting line / memo swap, file number once on both-done, stamp on transition → Task 5. ✓
- FILE NEW REQUEST reset (wheels keep rotation, hint → "click to spin") → Task 5 (`handleReset`) + Task 3 (rotation lives in a ref, untouched). ✓
- Page background + grain overlay + footer → Task 5. ✓
- Replace main view, delete App.css, Google Fonts → Task 6. ✓
- Keyboard access + mute toggle (decisions) → Task 3 button + Task 5 mute. ✓
- teacherName / soundOn props → Task 5. ✓

**Placeholder scan:** No TBD/TODO; every code step contains full code. The only literal `'PENDING'` is intended fallback UI copy for `fileNo`, matching the prototype.

**Type consistency:** `sound` shape `{ensureAudio,tick,ding,stamp}` is identical in Tasks 2, 3, 5. `onSpinEnd(index)` produced by Task 3, consumed by Task 5. `buildSegments`/`computeLandingRotation` signatures match between Task 1 and Task 3. `genFileNumber`/`nextWeekday`/`formatEffective` match between Task 1 and Task 5. Memo props match between Task 4 and Task 5's usage.

**Note on hint after reset:** deliberately "click to spin" (follows the prototype's `reset()`), per the spec's discrepancy resolution.
