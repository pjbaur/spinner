# Handoff: "What Will Jerry Teach Next?" — Assignment Reels

## Overview
A single-page, self-contained novelty app. Two independent "slot-machine reel" windows let
the user pull for a random **teaching environment** and a random **teaching subject**. Each
reel is a horizontal window in which the text choices scroll **vertically** and settle in a
highlighted center slot (chosen for a compact, phone-friendly footprint over big circular
wheels). When both reels have stopped, a mock bureaucratic "Interim Assignment Notice" memo
stamps in confirming the assignment. It is a gag gift for a substitute teacher (Jerry), an
artistic/punk type placed in deliberately anachronistic gym-teacher-style situations.

## Screenshots
See `screenshots/`:
- `01-initial.png` — landing state (header banner, both slot-reel windows, brass plaques).
- `02-result-memo.png` — the "Interim Assignment Notice" memo after both reels stop,
  with the rubber "ASSIGNMENT CONFIRMED" stamp.

## About the Design Files
The file in this bundle (`Jerry's Assignment Wheel.dc.html`) is a **design reference
created in HTML** — a working prototype showing the intended look and behavior, not
production code to ship directly. The task is to **recreate this design in your target
codebase** using its established patterns and libraries. If there is no existing app yet,
implement it as a small React single-page app (the prototype's logic maps cleanly to a
single React component with `useState` + `requestAnimationFrame` + Web Audio).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, animation timing, and sound design
are all specified below and should be reproduced faithfully.

## Screens / Views
Single screen, vertical stack, centered, max content width ~820px. Top to bottom:

### 1. Header banner
- Framed "chalkboard" plaque. Green board with thick wood frame.
- Background: `linear-gradient(#2b4133, #20342a)`; border `12px solid #6f4b2a`;
  border-radius `12px`; box-shadow `0 12px 34px rgba(0,0,0,.4), inset 0 0 70px rgba(0,0,0,.45), inset 0 0 0 2px #3a2712`; padding `24px 26px`; centered text.
- Title: "What will Jerry teach next?" — Patrick Hand, 40px, color `#f2f4ea`,
  text-shadow `0 1px 0 rgba(0,0,0,.45)`, line-height 1.02.
- Subtitle: "OFFICE OF SUBSTITUTE PLACEMENT · PULL BOTH REELS TO RECEIVE TODAY'S ASSIGNMENT"
  — Special Elite, 11.5px, letter-spacing 2px, color `rgba(242,244,234,.72)`, margin-top 10px.

### 2. Reels row
Flex row, `gap: 26px`, wrap, centered, align-items flex-start, full width. Two reel columns,
each `flex: 1 1 300px; max-width: 360px` (so they sit side-by-side on desktop and stack on
phones). Identical structure, different data + window tint:

- **Left — TEACHING ENVIRONMENT** (green window `linear-gradient(#25392d, #1c2c22)`)
  - Items (6): Kindergarten, Grade School, Middle School, After School, School Bus, Summer School
- **Right — TEACHING SUBJECT** (slate window `linear-gradient(#26262f, #1a1a21)`)
  - Items (6): P.E., Nap-Time Patrol, Cafeteria Duty, Potty Rotation, Shop Class, Testing Prep

Each reel column (flex column, align center, `gap: 14px`):
- **Brass plaque title**: Special Elite, 11px, letter-spacing 2.5px, color `#3a2712`,
  background `linear-gradient(#d0a951, #a9812f)`, padding `8px 18px`, border-radius 4px,
  border `2px solid #7a5d22`, box-shadow `0 2px 7px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.4)`.
- **Reel cabinet** (the clickable element, full column width):
  - Wood housing: `padding: 14px`, border-radius 14px,
    `radial-gradient(circle at 50% 20%, #8a6036, #593a1d 72%, #3e260e)`,
    box-shadow `0 14px 30px rgba(0,0,0,.42), inset 0 0 0 3px #3a2712, inset 0 3px 12px rgba(255,255,255,.16)`, cursor pointer.
  - **Window** (viewport): `height: 174px` (= 3 rows of 58px), `overflow: hidden`,
    border-radius 6px, background = the tint above, box-shadow `inset 0 0 34px rgba(0,0,0,.6), inset 0 0 0 2px #2f1e0c`, `position: relative`.
    - **Strip** (absolutely positioned inner div, translated vertically via ref): a vertical
      stack of item rows. Each row: `height: 58px`, flex center, `padding: 0 14px`,
      Patrick Hand 25px, color `#eef0e6`, text-shadow `0 1px 0 rgba(0,0,0,.4)`, `text-align: center`.
    - **Top/bottom fade masks** (pointer-events none): two 58px-tall overlays,
      `linear-gradient(#000c, transparent)` at top and `linear-gradient(transparent, #000c)` at bottom.
    - **Center slot highlight** (pointer-events none): overlay at `top:58px`, `height:58px`,
      box-shadow `inset 0 1px 0 rgba(202,162,75,.85), inset 0 -1px 0 rgba(202,162,75,.85)`,
      background `rgba(202,162,75,.07)`.
    - **Brass pointers** (pointer-events none): two CSS triangles at the vertical center
      (`top: 87px`, translateY -50%) pointing inward from the left (`border-left: 12px solid #caa24b`)
      and right (`border-right: 12px solid #caa24b`) edges, each with 9px transparent
      top/bottom borders and drop-shadow `0 1px 1px rgba(0,0,0,.5)`.
- **Hint line** below: Special Elite, 12px, letter-spacing 1.5px, color `#5a3b1e`.
  Text: "tap to pull" → "assigning…" (while spinning) → "tap to re-pull" (after a result).

### 3. Result area (below reels, min-height 30px)
- **Before both pulled**: "— awaiting results of both reels —", Special Elite 13px,
  letter-spacing 1.5px, color `#5a3b1e`, opacity .75, centered.
- **After both pulled**: the memo (below).

### 4. Assignment memo (appears when BOTH reels have a result)
- Aged-paper card, `width: min(560px, 92vw)`, `linear-gradient(#f4edd8, #e7dcbf)`,
  color `#2b2b2b`, border `1px solid #cbbd97`, border-radius 3px,
  box-shadow `0 18px 42px rgba(0,0,0,.36)`, padding `34px 40px 28px`, Special Elite font.
  Entrance: `memoin` animation (translateY 14px→0, opacity 0→1, .35s ease).
- **Rubber stamp** (absolute top-right, rotate -11deg): "ASSIGNMENT / CONFIRMED",
  border `3px double #b3372b`, color `#b3372b`, padding `6px 11px`, border-radius 6px,
  font 14px, letter-spacing 2px, opacity .86. Entrance: `stampin` animation
  (scale 2.6→1 with slight overshoot, `.42s cubic-bezier(.2,1.4,.4,1)`).
- **Header** (centered, 2px bottom border): eyebrow "UNIFIED SUBSTITUTE DISTRICT · FORM 12-J"
  (10.5px, letter-spacing 3px, color `#6b6455`) + title "INTERIM ASSIGNMENT NOTICE" (21px, letter-spacing 1px).
- **Field grid** (`grid-template-columns: 140px 1fr`, gap `11px 14px`, 15px):
  labels in `#6b6455` letter-spacing 1px; values bold.
  - SUBSTITUTE → `{teacherName}` + " [surname redacted]" (redacted part `#8a8270`, normal weight)
  - SUBJECT → chosen subject (bold, 18px)
  - ENVIRONMENT → chosen environment (bold, 18px)
  - EFFECTIVE → next weekday, formatted "Weekday, Month D, YYYY" + ", until further notice."
- **Note** (dashed top border, 11.5px, `#6b6455`): "Prior experience (avant-garde composition,
  touring musicianship, three-chord conviction) noted and disregarded per Policy 4.2. Report to
  the front office at 7:15 a.m. A whistle will be provided."
- **Footer** (space-between): left "FILE {fileNo}" (11px, `#6b6455`); right button
  "FILE NEW REQUEST" (Special Elite 12px, background `#2b2b2b`, color `#f4edd8`, padding `10px 17px`, border-radius 3px).

### 5. Page footer
"Assignments are final. Appeals may be filed with the vice principal, who is also unavailable."
— Special Elite, 10.5px, letter-spacing 1.5px, color `rgba(58,39,18,.55)`, centered.

### Page background
- `radial-gradient(ellipse at 50% -8%, #e4d3ac, #cdb488 52%, #b6996c 100%)` (kraft paper).
- Overlay grain: an SVG `feTurbulence` fractal-noise data-URI, `mix-blend-mode: multiply`,
  opacity .10, `pointer-events: none`. Purely decorative — omit if it complicates your stack.

## Interactions & Behavior
- **Tap a reel cabinet to pull it.** Ignored if that reel is already spinning. The two reels
  are fully independent (pull either, in any order, re-pull freely).
- **Reel model**: each reel shows a vertical strip of item rows (`ITEM_H = 58px`). The window
  shows 3 rows; the **center slot** (2nd row) is the winning position, marked by the highlight
  band and the two brass pointers. The strip is rendered as the label list **repeated 12×**
  (`COPIES = 12`) so there is always enough strip to scroll through during a spin.
- **Placement math**: to seat index `j` in the center slot, set the strip's
  `translateY = ITEM_H * (1 - (j + n))`. The extra `+ n` offset seats the reel one full loop
  into the strip, so the row **above** the first item wraps to show the last item (never
  blank). Because the strip is periodic (period = item count `n`), index `j` and `j + n` look
  identical — so after a spin ends you can normalize `j` back into `[0, n)` invisibly.
- **Spin animation**: JS-driven with `requestAnimationFrame` (NOT a CSS transition — needed for
  the per-item tick sound). Duration **3400ms**, easing `easeOutCubic` = `1 - (1-t)^3`.
  - **Deterministic landing**: pick the target index first, then compute the exact end position.
    Starting from the current normalized index `start` (0..n-1):
    `loops = 3 + random(0..2)`; `end = start + loops*n + (((idx - start) % n) + n) % n`
    (so `end % n === idx`). Animate `j` from `start` to `end`; each frame set
    `translateY = ITEM_H * (1 - j)` directly on the strip's DOM node (via ref — do not
    re-render React per frame).
  - **On stop**: normalize `reelPos[key] = idx`, snap the transform to that index, store the
    result index in React state, play the "ding".
- **Tick sound**: fired whenever `Math.floor(j)` changes during the spin (each item crossing) —
  naturally slows as the reel decelerates → the classic slot-reel ratchet.
- **Memo**: renders only when both `result.env` and `result.topic` are set. On the false→true
  transition, generate the file number once and play the stamp sound.
- **FILE NEW REQUEST** button: clears both results and the file number (reels keep their
  current position; the memo disappears and hints reset to "tap to re-pull").

## Sound design (Web Audio API)
Create/resume `AudioContext` lazily on the first pull (user gesture). All sounds gated by
the `soundOn` prop. Building blocks are short oscillator "blip"s: set gain to ~0.0001, ramp up
to peak over 5ms, then `exponentialRampToValueAtTime(0.0001, t+dur)`.
- **tick** (each item crossing during the spin): square wave, 1250Hz, 0.028s, peak gain 0.035.
- **ding** (on stop): triangle 680Hz 0.16s (gain .09), then after 115ms triangle 1020Hz 0.34s (gain .075).
- **stamp** (when memo appears): sine 150Hz 0.15s (gain .16) "thunk" + a ~0.12s white-noise burst
  (buffer with `(random*2-1) * (1 - i/len)^2` decay envelope, gain .13).

## State Management
- `spinning: { env: bool, topic: bool }`
- `result: { env: number|null, topic: number|null }` — index into the label array
- `fileNo: string|null` — set once when both results first exist
- **Non-render state**: `reelPos = { env, topic }` current normalized index per reel (a plain
  ref/object, not React state — the rAF loop reads/writes it without triggering re-renders).
- Derived: `bothDone = result.env != null && result.topic != null`.

## Data
```js
environments = ['Kindergarten','Grade School','Middle School','After School','School Bus','Summer School'];
subjects     = ['P.E.','Nap-Time Patrol','Cafeteria Duty','Potty Rotation','Shop Class','Testing Prep'];
```
File number format: `SP-` + 4 random digits + `-` + 2 random letters (letters exclude I/O), e.g. `SP-4821-KT`.
Effective date: today + 1, skipping Sat/Sun, formatted with `toLocaleDateString('en-US', {weekday,month:'long',day,year})`.

## Configurable props (tweaks)
- `teacherName` (string, default "Jerry") — used in the memo's SUBSTITUTE field. (The banner
  headline is hardcoded "Jerry" in the prototype; parameterize if desired.)
- `soundOn` (boolean, default true) — master switch for all sound.

## Design Tokens
Colors:
- Kraft paper: `#e4d3ac`, `#cdb488`, `#b6996c`
- Wood housing: `#8a6036`, `#6f4b2a`, `#593a1d`, `#3e260e`, `#3a2712`, `#2f1e0c`
- Brass: `#d0a951`, `#caa24b`, `#a9812f`, `#8a6a24`, `#7a5d22`
- Green window: `#25392d`, `#1c2c22`; header board `#2b4133`, `#20342a`
- Slate window: `#26262f`, `#1a1a21`
- Reel text / chalk: `#eef0e6`, `#f2f4ea`
- Memo paper: `#f4edd8`, `#e7dcbf`; ink `#2b2b2b`; muted `#6b6455`, `#8a8270`; border `#cbbd97`, dashed `#b9ac86`
- Stamp red: `#b3372b`
- Warm ink accents: `#5a3b1e`, `#3a2712`

Typography (Google Fonts):
- `Patrick Hand` — chalk lettering (banner title, reel item labels)
- `Special Elite` — typewriter (everything else: UI, plaques, memo)

Metrics:
- `ITEM_H = 58px` (reel row height); window height `174px` (3 rows); `COPIES = 12` (strip repeats).

Animation:
- Spin: 3400ms, easeOutCubic. Memo: memoin .35s ease. Stamp: stampin .42s cubic-bezier(.2,1.4,.4,1), scale 2.6→1.

## Assets
None external. Fonts from Google Fonts. The paper-grain texture is an inline SVG data-URI
(feTurbulence) — no image files. No icon library used.

## Files
- `Jerry's Assignment Wheel.dc.html` — the full working prototype (design reference). It is a
  "Design Component": the meaningful parts are the HTML template markup and the `class Component`
  logic block (reel/placement math, sound, state). Ignore the `support.js` runtime wrapper —
  that is specific to the prototyping environment and is not part of what you implement.
