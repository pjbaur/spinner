# Two-Wheel Spinner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page React app with two independent, click-to-spin "wheel of fortune" style wheels, each with a user-editable, localStorage-persisted item list.

**Architecture:** Vite + React, no backend. Pure math/logic (angle computation, random pick, text parsing) lives in a standalone module for isolated unit testing. A `useWheelItems` hook owns localStorage sync. A single `Wheel` component (SVG render + spin interaction + textarea editor) is instantiated twice by `App`, each with its own storage key and default items.

**Tech Stack:** React 18, Vite, Vitest, @testing-library/react, jsdom. No animation library, no CSS framework.

## Global Constraints

- Client-only, no backend or server persistence.
- Plain CSS only — no CSS framework, no animation library.
- SVG + CSS `transform: rotate()` transition for the wheel (not Canvas, not conic-gradient).
- Two wheels are fully independent; each has its own localStorage key (`spinner.wheelA`, `spinner.wheelB`).
- Equal odds per item; duplicate list entries naturally get more slices (no separate weighting UI).
- Winning item is NOT removed after landing.
- Default placeholder items when storage is empty: `["Option A", "Option B", "Option C", "Option D"]`.
- Empty item list disables spin and shows a hint.
- Rapid re-clicks during an active spin are ignored.
- Rotation accumulates across spins (never resets to 0).

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `src/setupTests.js`
- Test: `src/App.test.jsx`

**Interfaces:**
- Produces: `App` default-exported React component from `src/App.jsx`, rendering an `<h1>Spinner</h1>` (extended by Task 7).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "spinner",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.1",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs without error, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
})
```

- [ ] **Step 4: Create `src/setupTests.js`**

```js
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Spinner</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 7: Create `src/App.jsx` (minimal placeholder, extended in Task 7)**

```jsx
export default function App() {
  return (
    <div className="app">
      <h1>Spinner</h1>
    </div>
  )
}
```

- [ ] **Step 8: Write the failing test `src/App.test.jsx`**

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

describe('App', () => {
  it('renders the Spinner heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Spinner' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 9: Run test to verify it fails (before App.jsx existed in your working copy, or to confirm setup wiring)**

Run: `npm test`
Expected: PASS (App.jsx and test were created together in this task — running now confirms the scaffold and test runner both work end-to-end). If it fails, fix the scaffold before proceeding.

- [ ] **Step 10: Commit**

```bash
git add package.json vite.config.js index.html src/main.jsx src/App.jsx src/setupTests.js src/App.test.jsx
git commit -m "chore: scaffold Vite + React + Vitest project"
```

---

### Task 2: Wheel math — pure functions

**Files:**
- Create: `src/wheelMath.js`
- Test: `src/wheelMath.test.js`

**Interfaces:**
- Produces (consumed by Task 4 and Task 5):
  - `PALETTE: string[]` — array of hex color strings.
  - `getSliceColor(index: number): string`
  - `parseItemsFromText(text: string): string[]`
  - `buildSliceAngles(itemCount: number): Array<{ start: number, end: number, mid: number }>` — degrees, 0 = top, increasing clockwise.
  - `polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): { x: number, y: number }`
  - `describeSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string` — SVG path `d` attribute.
  - `pickRandomIndex(itemCount: number, randomFn?: () => number): number`
  - `computeTargetRotation(currentRotation: number, winningIndex: number, itemCount: number, extraSpins?: number, jitterFn?: () => number): number`

- [ ] **Step 1: Write the failing tests**

```js
// src/wheelMath.test.js
import { describe, it, expect } from 'vitest'
import {
  PALETTE,
  getSliceColor,
  parseItemsFromText,
  buildSliceAngles,
  polarToCartesian,
  pickRandomIndex,
  computeTargetRotation,
} from './wheelMath.js'

describe('getSliceColor', () => {
  it('cycles through the palette', () => {
    expect(getSliceColor(0)).toBe(PALETTE[0])
    expect(getSliceColor(PALETTE.length)).toBe(PALETTE[0])
    expect(getSliceColor(PALETTE.length + 1)).toBe(PALETTE[1])
  })
})

describe('parseItemsFromText', () => {
  it('splits on newlines, trims, and drops blank lines', () => {
    expect(parseItemsFromText('Pizza\n  Tacos  \n\nSushi\n')).toEqual([
      'Pizza',
      'Tacos',
      'Sushi',
    ])
  })

  it('returns an empty array for blank input', () => {
    expect(parseItemsFromText('   \n  \n')).toEqual([])
  })
})

describe('buildSliceAngles', () => {
  it('splits 360 degrees evenly with correct midpoints', () => {
    const angles = buildSliceAngles(4)
    expect(angles).toEqual([
      { start: 0, end: 90, mid: 45 },
      { start: 90, end: 180, mid: 135 },
      { start: 180, end: 270, mid: 225 },
      { start: 270, end: 360, mid: 315 },
    ])
  })
})

describe('polarToCartesian', () => {
  it('places angle 0 at the top of the circle', () => {
    const p = polarToCartesian(100, 100, 50, 0)
    expect(p.x).toBeCloseTo(100)
    expect(p.y).toBeCloseTo(50)
  })

  it('places angle 90 to the right of the circle', () => {
    const p = polarToCartesian(100, 100, 50, 90)
    expect(p.x).toBeCloseTo(150)
    expect(p.y).toBeCloseTo(100)
  })
})

describe('pickRandomIndex', () => {
  it('picks index 0 when randomFn returns 0', () => {
    expect(pickRandomIndex(4, () => 0)).toBe(0)
  })

  it('picks the last index when randomFn returns just under 1', () => {
    expect(pickRandomIndex(4, () => 0.9999)).toBe(3)
  })
})

describe('computeTargetRotation', () => {
  it('lands the winning slice midpoint under the top pointer, with extra spins added', () => {
    const rotation = computeTargetRotation(0, 0, 4, 5, () => 0.5)
    expect(rotation % 360).toBeCloseTo(315)
    expect(rotation).toBeGreaterThanOrEqual(5 * 360)
  })

  it('always increases rotation relative to the current value', () => {
    const rotation = computeTargetRotation(3600, 2, 4, 5, () => 0.5)
    expect(rotation).toBeGreaterThan(3600)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with "Failed to resolve import './wheelMath.js'" or similar (module doesn't exist yet).

- [ ] **Step 3: Write the implementation `src/wheelMath.js`**

```js
export const PALETTE = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f1c40f',
  '#9b59b6',
  '#1abc9c',
  '#e67e22',
  '#34495e',
]

export function getSliceColor(index) {
  return PALETTE[index % PALETTE.length]
}

export function parseItemsFromText(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function buildSliceAngles(itemCount) {
  const sliceAngle = 360 / itemCount
  return Array.from({ length: itemCount }, (_, i) => ({
    start: i * sliceAngle,
    end: (i + 1) * sliceAngle,
    mid: (i + 0.5) * sliceAngle,
  }))
}

export function polarToCartesian(cx, cy, r, angleDeg) {
  const theta = (angleDeg * Math.PI) / 180
  return {
    x: cx + r * Math.sin(theta),
    y: cy - r * Math.cos(theta),
  }
}

export function describeSlicePath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle)
  const end = polarToCartesian(cx, cy, r, endAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`
}

export function pickRandomIndex(itemCount, randomFn = Math.random) {
  return Math.floor(randomFn() * itemCount)
}

export function computeTargetRotation(
  currentRotation,
  winningIndex,
  itemCount,
  extraSpins = 5,
  jitterFn = Math.random,
) {
  const sliceAngle = 360 / itemCount
  const midAngle = (winningIndex + 0.5) * sliceAngle
  const jitter = (jitterFn() - 0.5) * sliceAngle * 0.8
  const targetMod = (((360 - midAngle - jitter) % 360) + 360) % 360
  const currentMod = ((currentRotation % 360) + 360) % 360
  let delta = targetMod - currentMod
  if (delta <= 0) delta += 360
  return currentRotation + delta + extraSpins * 360
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all `wheelMath` tests green).

- [ ] **Step 5: Commit**

```bash
git add src/wheelMath.js src/wheelMath.test.js
git commit -m "feat: add pure wheel math functions"
```

---

### Task 3: `useWheelItems` localStorage hook

**Files:**
- Create: `src/useWheelItems.js`
- Test: `src/useWheelItems.test.js`

**Interfaces:**
- Consumes: none (browser `localStorage` global, available in jsdom test env).
- Produces (consumed by Task 6):
  - `loadItems(key: string, defaultItems: string[]): string[]`
  - `useWheelItems(key: string, defaultItems: string[]): [string[], (next: string[]) => void]`

- [ ] **Step 1: Write the failing tests**

```js
// src/useWheelItems.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { loadItems, useWheelItems } from './useWheelItems.js'

beforeEach(() => {
  localStorage.clear()
})

describe('loadItems', () => {
  it('returns defaults when storage is empty', () => {
    expect(loadItems('missing-key', ['A', 'B'])).toEqual(['A', 'B'])
  })

  it('returns parsed items when present', () => {
    localStorage.setItem('k', JSON.stringify(['X', 'Y']))
    expect(loadItems('k', ['A', 'B'])).toEqual(['X', 'Y'])
  })

  it('returns defaults when stored value is an empty array', () => {
    localStorage.setItem('k', JSON.stringify([]))
    expect(loadItems('k', ['A', 'B'])).toEqual(['A', 'B'])
  })

  it('returns defaults when stored value is malformed JSON', () => {
    localStorage.setItem('k', 'not json')
    expect(loadItems('k', ['A', 'B'])).toEqual(['A', 'B'])
  })
})

describe('useWheelItems', () => {
  it('initializes from localStorage and persists updates', () => {
    localStorage.setItem('wheel.test', JSON.stringify(['One', 'Two']))
    const { result } = renderHook(() => useWheelItems('wheel.test', ['A']))

    expect(result.current[0]).toEqual(['One', 'Two'])

    act(() => {
      result.current[1](['Three'])
    })

    expect(result.current[0]).toEqual(['Three'])
    expect(JSON.parse(localStorage.getItem('wheel.test'))).toEqual(['Three'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with "Failed to resolve import './useWheelItems.js'".

- [ ] **Step 3: Write the implementation `src/useWheelItems.js`**

```js
import { useState } from 'react'

export function loadItems(key, defaultItems) {
  const raw = localStorage.getItem(key)
  if (!raw) return defaultItems
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
    return defaultItems
  } catch {
    return defaultItems
  }
}

export function useWheelItems(key, defaultItems) {
  const [items, setItemsState] = useState(() => loadItems(key, defaultItems))

  function setItems(nextItems) {
    setItemsState(nextItems)
    localStorage.setItem(key, JSON.stringify(nextItems))
  }

  return [items, setItems]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all `useWheelItems` tests green).

- [ ] **Step 5: Commit**

```bash
git add src/useWheelItems.js src/useWheelItems.test.js
git commit -m "feat: add localStorage-backed wheel items hook"
```

---

### Task 4: Wheel SVG rendering

**Files:**
- Create: `src/Wheel.jsx`
- Create: `src/Wheel.css`
- Test: `src/Wheel.test.jsx`

**Interfaces:**
- Consumes: `getSliceColor`, `buildSliceAngles`, `describeSlicePath` from `src/wheelMath.js`; `useWheelItems` from `src/useWheelItems.js`.
- Produces (consumed by Task 5, 6, 7): `Wheel` default-exported component with props `{ storageKey: string, defaultItems: string[] }`. Renders one `<path>` per item inside an `svg[data-testid="wheel-svg"]`, and one `<text>` per item with the item's label.

- [ ] **Step 1: Write the failing test**

```jsx
// src/Wheel.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Wheel from './Wheel.jsx'

beforeEach(() => {
  localStorage.clear()
})

describe('Wheel rendering', () => {
  it('renders one slice path and label per item', () => {
    render(<Wheel storageKey="wheel.render-test" defaultItems={['Pizza', 'Tacos', 'Sushi']} />)

    const svg = screen.getByTestId('wheel-svg')
    expect(svg.querySelectorAll('path')).toHaveLength(3)
    expect(screen.getByText('Pizza')).toBeInTheDocument()
    expect(screen.getByText('Tacos')).toBeInTheDocument()
    expect(screen.getByText('Sushi')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Failed to resolve import './Wheel.jsx'".

- [ ] **Step 3: Write the implementation `src/Wheel.jsx`**

```jsx
import { useWheelItems } from './useWheelItems.js'
import { getSliceColor, buildSliceAngles, describeSlicePath } from './wheelMath.js'
import './Wheel.css'

const CENTER = 150
const RADIUS = 150
const LABEL_RADIUS = 95

export default function Wheel({ storageKey, defaultItems }) {
  const [items] = useWheelItems(storageKey, defaultItems)
  const angles = buildSliceAngles(items.length || 1)

  return (
    <div className="wheel-panel">
      <div className="wheel-wrapper">
        <svg data-testid="wheel-svg" viewBox="0 0 300 300" className="wheel-svg">
          {items.map((item, i) => (
            <path
              key={i}
              d={describeSlicePath(CENTER, CENTER, RADIUS, angles[i].start, angles[i].end)}
              fill={getSliceColor(i)}
            />
          ))}
          {items.map((item, i) => {
            const theta = (angles[i].mid * Math.PI) / 180
            const x = CENTER + LABEL_RADIUS * Math.sin(theta)
            const y = CENTER - LABEL_RADIUS * Math.cos(theta)
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${angles[i].mid}, ${x}, ${y})`}
                className="wheel-label"
              >
                {item}
              </text>
            )
          })}
        </svg>
        <div className="wheel-pointer" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/Wheel.css`**

```css
.wheel-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.wheel-wrapper {
  position: relative;
  width: 300px;
  height: 300px;
  cursor: pointer;
}

.wheel-svg {
  width: 100%;
  height: 100%;
  transition: transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99);
}

.wheel-label {
  font-size: 14px;
  fill: #fff;
  font-family: sans-serif;
}

.wheel-pointer {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 15px solid transparent;
  border-right: 15px solid transparent;
  border-top: 25px solid #333;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (`Wheel rendering` test green).

- [ ] **Step 6: Commit**

```bash
git add src/Wheel.jsx src/Wheel.css src/Wheel.test.jsx
git commit -m "feat: render wheel as SVG pie slices"
```

---

### Task 5: Spin interaction

**Files:**
- Modify: `src/Wheel.jsx`
- Modify: `src/Wheel.test.jsx`

**Interfaces:**
- Consumes: `pickRandomIndex`, `computeTargetRotation` from `src/wheelMath.js`.
- Produces (consumed by Task 6, 7): clicking `svg[data-testid="wheel-svg"]` triggers a spin; wheel shows winner text `Winner: <item>` inside `[data-testid="winner"]` after a simulated `transitionend`; a second click while spinning does not start a second spin.

- [ ] **Step 1: Write the failing tests (append to `src/Wheel.test.jsx`)**

```jsx
// add to src/Wheel.test.jsx, alongside existing imports/tests
import { fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'

describe('Wheel spin', () => {
  it('shows the winner after the spin transition ends', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    render(<Wheel storageKey="wheel.spin-test-1" defaultItems={['Pizza', 'Tacos', 'Sushi', 'Burgers']} />)
    const svg = screen.getByTestId('wheel-svg')

    expect(screen.getByTestId('winner')).toHaveTextContent('')

    fireEvent.click(svg)
    fireEvent.transitionEnd(svg, { propertyName: 'transform' })

    expect(screen.getByTestId('winner')).toHaveTextContent('Winner: Pizza')

    Math.random.mockRestore()
  })

  it('ignores clicks while already spinning', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)

    render(<Wheel storageKey="wheel.spin-test-2" defaultItems={['Pizza', 'Tacos', 'Sushi', 'Burgers']} />)
    const svg = screen.getByTestId('wheel-svg')

    fireEvent.click(svg)
    const rotationAfterFirstClick = svg.style.transform
    fireEvent.click(svg)
    expect(svg.style.transform).toBe(rotationAfterFirstClick)

    randomSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `winner` testid not found (spin behavior not implemented yet).

- [ ] **Step 3: Update `src/Wheel.jsx` to add spin state and handlers**

```jsx
import { useRef, useState } from 'react'
import { useWheelItems } from './useWheelItems.js'
import {
  getSliceColor,
  buildSliceAngles,
  describeSlicePath,
  pickRandomIndex,
  computeTargetRotation,
} from './wheelMath.js'
import './Wheel.css'

const CENTER = 150
const RADIUS = 150
const LABEL_RADIUS = 95

export default function Wheel({ storageKey, defaultItems }) {
  const [items] = useWheelItems(storageKey, defaultItems)
  const angles = buildSliceAngles(items.length || 1)

  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState(null)
  const pendingWinnerIndex = useRef(null)

  function handleSpin() {
    if (spinning || items.length === 0) return
    const winningIndex = pickRandomIndex(items.length)
    pendingWinnerIndex.current = winningIndex
    setWinner(null)
    setSpinning(true)
    setRotation((current) => computeTargetRotation(current, winningIndex, items.length))
  }

  function handleTransitionEnd(e) {
    if (e.propertyName !== 'transform') return
    setSpinning(false)
    setWinner(items[pendingWinnerIndex.current])
  }

  return (
    <div className="wheel-panel">
      <div className="wheel-wrapper">
        <svg
          data-testid="wheel-svg"
          viewBox="0 0 300 300"
          className="wheel-svg"
          style={{ transform: `rotate(${rotation}deg)` }}
          onClick={handleSpin}
          onTransitionEnd={handleTransitionEnd}
        >
          {items.map((item, i) => (
            <path
              key={i}
              d={describeSlicePath(CENTER, CENTER, RADIUS, angles[i].start, angles[i].end)}
              fill={getSliceColor(i)}
            />
          ))}
          {items.map((item, i) => {
            const theta = (angles[i].mid * Math.PI) / 180
            const x = CENTER + LABEL_RADIUS * Math.sin(theta)
            const y = CENTER - LABEL_RADIUS * Math.cos(theta)
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${angles[i].mid}, ${x}, ${y})`}
                className="wheel-label"
              >
                {item}
              </text>
            )
          })}
        </svg>
        <div className="wheel-pointer" />
      </div>
      <p data-testid="winner" className="wheel-winner">
        {winner ? `Winner: ${winner}` : ''}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all `Wheel spin` and `Wheel rendering` tests green).

- [ ] **Step 5: Commit**

```bash
git add src/Wheel.jsx src/Wheel.test.jsx
git commit -m "feat: wire up wheel spin interaction and winner display"
```

---

### Task 6: Item editor textarea + empty-list handling

**Files:**
- Modify: `src/Wheel.jsx`
- Modify: `src/Wheel.css`
- Modify: `src/Wheel.test.jsx`

**Interfaces:**
- Consumes: `parseItemsFromText` from `src/wheelMath.js`; `setItems` returned by `useWheelItems`.
- Produces (consumed by Task 7): `Wheel` renders a `textarea` with `aria-label="wheel items"` reflecting the current items (one per line); editing and blurring it re-parses and persists the list. Spin is disabled and a hint (`data-testid="empty-hint"`) is shown when the item list is empty.

- [ ] **Step 1: Write the failing tests (append to `src/Wheel.test.jsx`)**

```jsx
// add to src/Wheel.test.jsx

describe('Wheel item editor', () => {
  it('shows current items in the textarea, one per line', () => {
    render(<Wheel storageKey="wheel.editor-test-1" defaultItems={['Pizza', 'Tacos']} />)
    const textarea = screen.getByLabelText('wheel items')
    expect(textarea).toHaveValue('Pizza\nTacos')
  })

  it('re-parses and persists items on blur', () => {
    render(<Wheel storageKey="wheel.editor-test-2" defaultItems={['Pizza']} />)
    const textarea = screen.getByLabelText('wheel items')

    fireEvent.change(textarea, { target: { value: 'Burgers\nFries\n' } })
    fireEvent.blur(textarea)

    expect(JSON.parse(localStorage.getItem('wheel.editor-test-2'))).toEqual(['Burgers', 'Fries'])
    const svg = screen.getByTestId('wheel-svg')
    expect(svg.querySelectorAll('path')).toHaveLength(2)
  })

  it('disables spinning and shows a hint when the list is empty', () => {
    render(<Wheel storageKey="wheel.editor-test-3" defaultItems={['Pizza']} />)
    const textarea = screen.getByLabelText('wheel items')

    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.blur(textarea)

    expect(screen.getByTestId('empty-hint')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('wheel-svg'))
    expect(screen.getByTestId('winner')).toHaveTextContent('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `getByLabelText('wheel items')` not found.

- [ ] **Step 3: Update `src/Wheel.jsx` to add the editor and empty-state hint**

```jsx
import { useRef, useState } from 'react'
import { useWheelItems } from './useWheelItems.js'
import {
  getSliceColor,
  buildSliceAngles,
  describeSlicePath,
  pickRandomIndex,
  computeTargetRotation,
  parseItemsFromText,
} from './wheelMath.js'
import './Wheel.css'

const CENTER = 150
const RADIUS = 150
const LABEL_RADIUS = 95

export default function Wheel({ storageKey, defaultItems }) {
  const [items, setItems] = useWheelItems(storageKey, defaultItems)
  const [draftText, setDraftText] = useState(items.join('\n'))
  const angles = buildSliceAngles(items.length || 1)

  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState(null)
  const pendingWinnerIndex = useRef(null)

  function handleSpin() {
    if (spinning || items.length === 0) return
    const winningIndex = pickRandomIndex(items.length)
    pendingWinnerIndex.current = winningIndex
    setWinner(null)
    setSpinning(true)
    setRotation((current) => computeTargetRotation(current, winningIndex, items.length))
  }

  function handleTransitionEnd(e) {
    if (e.propertyName !== 'transform') return
    setSpinning(false)
    setWinner(items[pendingWinnerIndex.current])
  }

  function handleEditorBlur() {
    setItems(parseItemsFromText(draftText))
  }

  return (
    <div className="wheel-panel">
      <div className="wheel-wrapper">
        <svg
          data-testid="wheel-svg"
          viewBox="0 0 300 300"
          className="wheel-svg"
          style={{ transform: `rotate(${rotation}deg)` }}
          onClick={handleSpin}
          onTransitionEnd={handleTransitionEnd}
        >
          {items.map((item, i) => (
            <path
              key={i}
              d={describeSlicePath(CENTER, CENTER, RADIUS, angles[i].start, angles[i].end)}
              fill={getSliceColor(i)}
            />
          ))}
          {items.map((item, i) => {
            const theta = (angles[i].mid * Math.PI) / 180
            const x = CENTER + LABEL_RADIUS * Math.sin(theta)
            const y = CENTER - LABEL_RADIUS * Math.cos(theta)
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${angles[i].mid}, ${x}, ${y})`}
                className="wheel-label"
              >
                {item}
              </text>
            )
          })}
        </svg>
        <div className="wheel-pointer" />
      </div>
      {items.length === 0 && (
        <p data-testid="empty-hint" className="wheel-hint">
          Add at least 1 item to spin.
        </p>
      )}
      <p data-testid="winner" className="wheel-winner">
        {winner ? `Winner: ${winner}` : ''}
      </p>
      <textarea
        aria-label="wheel items"
        className="wheel-editor"
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        onBlur={handleEditorBlur}
      />
    </div>
  )
}
```

- [ ] **Step 4: Add editor/hint styles to `src/Wheel.css`**

```css
.wheel-hint {
  color: #b00;
  font-size: 0.9rem;
  margin: 0;
}

.wheel-winner {
  min-height: 1.2rem;
  font-weight: bold;
  margin: 0;
}

.wheel-editor {
  width: 260px;
  height: 100px;
  font-family: sans-serif;
  font-size: 0.9rem;
  padding: 0.5rem;
  resize: vertical;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all `Wheel item editor` tests green, plus all prior `Wheel` tests still green).

- [ ] **Step 6: Commit**

```bash
git add src/Wheel.jsx src/Wheel.css src/Wheel.test.jsx
git commit -m "feat: add wheel item textarea editor and empty-list hint"
```

---

### Task 7: Compose two independent wheels in `App`

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`
- Create: `src/App.css`
- Modify: `src/main.jsx`

**Interfaces:**
- Consumes: `Wheel` component from `src/Wheel.jsx` with props `{ storageKey, defaultItems }`.
- Produces: rendered page with two independently-editable wheels, storage keys `spinner.wheelA` and `spinner.wheelB`.

- [ ] **Step 1: Write the failing test (extend `src/App.test.jsx`)**

```jsx
// src/App.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from './App.jsx'

beforeEach(() => {
  localStorage.clear()
})

describe('App', () => {
  it('renders the Spinner heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Spinner' })).toBeInTheDocument()
  })

  it('renders two independent wheels with separate storage keys', () => {
    render(<App />)
    const editors = screen.getAllByLabelText('wheel items')
    expect(editors).toHaveLength(2)

    fireEvent.change(editors[0], { target: { value: 'Only Wheel A Item' } })
    fireEvent.blur(editors[0])

    expect(JSON.parse(localStorage.getItem('spinner.wheelA'))).toEqual(['Only Wheel A Item'])
    expect(localStorage.getItem('spinner.wheelB')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — only one `wheel items` element found (App doesn't render any `Wheel` yet).

- [ ] **Step 3: Update `src/App.jsx`**

```jsx
import Wheel from './Wheel.jsx'
import './App.css'

const DEFAULT_ITEMS = ['Option A', 'Option B', 'Option C', 'Option D']

export default function App() {
  return (
    <div className="app">
      <h1>Spinner</h1>
      <div className="wheels-row">
        <Wheel storageKey="spinner.wheelA" defaultItems={DEFAULT_ITEMS} />
        <Wheel storageKey="spinner.wheelB" defaultItems={DEFAULT_ITEMS} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/App.css`**

```css
.app {
  font-family: sans-serif;
  text-align: center;
  padding: 1.5rem;
}

.wheels-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 3rem;
}
```

- [ ] **Step 5: Update `src/main.jsx` to import `App.css`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all tests across the project green).

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/App.css src/App.test.jsx src/main.jsx
git commit -m "feat: compose two independent wheels in App"
```

---

### Task 8: Manual verification and README

**Files:**
- Create: `README.md`

**Interfaces:**
- None (documentation + manual QA only; no new production code).

- [ ] **Step 1: Create `README.md`**

```markdown
# Spinner

Two independent, click-to-spin wheels. Edit each wheel's item list in its textarea (one item per line) — changes save automatically to your browser's localStorage.

## Run locally

npm install
npm run dev

Then open the printed local URL in your browser.

## Test

npm test

## Build

npm run build
```

- [ ] **Step 2: Run the full test suite one more time**

Run: `npm test`
Expected: PASS (every test file green).

- [ ] **Step 3: Manually verify in a browser**

Run: `npm run dev`, open the printed URL, then check:
- Two wheels render side by side (or stacked if the window is narrow).
- Editing a wheel's textarea and clicking outside it updates that wheel's slices, and NOT the other wheel's.
- Clicking a wheel spins it (visible deceleration over a few seconds) and shows `Winner: <item>` after it stops.
- Clicking the same wheel again while it's still spinning does nothing until it stops.
- Reloading the page preserves both wheels' edited item lists.
- Clearing a wheel's textarea shows the "Add at least 1 item to spin" hint and clicking that wheel does nothing.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with run/test instructions"
```
