# Two-Wheel Spinner — Design

## Purpose

Single-page web app with two independent "wheel of fortune" style spinners. Each wheel has a user-configurable list of items. Clicking a wheel spins it; after a short animated deceleration it lands on a random item and displays the winner.

## Stack

- React + Vite, client-only, no backend.
- Plain CSS (no CSS framework/animation library).

## Layout

- Two wheel panels side by side on wide screens, stacked on narrow screens.
- Each panel contains:
  - SVG pie wheel (click to spin)
  - Fixed pointer/marker at top of wheel indicating the winning slice
  - Winner display area (text) below/near the wheel
  - Textarea for editing that wheel's items, one item per line

## State & Persistence

- Each wheel's item list is React state, synced to `localStorage` under its own key (e.g. `spinner.wheelA`, `spinner.wheelB`).
- On load: read from `localStorage`; if missing/empty, fall back to generic placeholders (`Option A`, `Option B`, `Option C`, `Option D`).
- Editing the textarea updates state and `localStorage` (on change/blur).
- The two wheels are fully independent — no shared state or interaction between them.

## Wheel Rendering

- SVG circle divided into N equal slices, one per item (equal odds per item regardless of duplicate text — duplicates simply occupy multiple equal slices, which naturally increases their effective odds).
- Each slice filled with a distinct color from a fixed rotating palette (cycles if more items than palette colors).
- Item label text positioned within/along each slice, rotated to stay legible.
- Fixed pointer/marker rendered outside the circle at the top, indicating the winning slice after spin stops.

## Spin Mechanic

- Clicking the wheel triggers a spin, unless it is already spinning (guarded by a flag/state — clicks during spin are ignored).
- On click:
  1. Pick a random winning index into the current item list (uniform random).
  2. Compute a target rotation: several full extra spins (e.g. 5 × 360°) plus the angle needed to bring the winning slice under the top pointer, plus a small random jitter within the slice so it doesn't always land dead-center.
  3. Rotation accumulates from the wheel's current angle (does not reset to 0 each spin), so repeated spins keep turning forward.
  4. Apply rotation via CSS `transform: rotate(...)` with a `transition` (several seconds, ease-out cubic-bezier) for a decelerating "wheel of fortune" feel.
- On `transitionend`, display the winner (e.g. "Winner: Tacos") in that wheel's winner display area, and re-enable spinning.
- Winning item is NOT removed from the list after landing — same list, same odds, ready to spin again immediately.

## Edge Cases

- Empty item list: spin disabled, show hint text (e.g. "Add at least 1 item").
- Single item: spinning still works, trivially lands on the only slice — no special-case handling needed.
- Rapid re-click during an active spin: ignored via guard flag.

## Explicitly Out of Scope

- Weighting UI (beyond the natural effect of duplicate list entries).
- Removing the winning item after it's picked.
- Shareable/URL-encoded state.
- Backend/server persistence.
- Sound effects, confetti, or other embellishments.
- Any animation library — plain CSS transitions only.

## Files

- `index.html` — Vite entry HTML
- `src/main.jsx` — React root
- `src/App.jsx` — renders two `<Wheel>` instances side by side, each with its own `localStorage` key
- `src/Wheel.jsx` — reusable wheel component (SVG render, spin logic, textarea editor, winner display)
- `src/Wheel.css` — styles for wheel, layout, panels
