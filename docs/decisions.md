# Design decisions

Scope/architecture decisions, so they don't need re-asking each session. Update this file when a decision changes rather than leaving it stale.

## Scope

- **Standalone geometry code**, same as `../obstacle`'s own stance: `src/ramps/util.ts`'s `centerFootprint` is copied from `obstacle/src/obstacles/util.ts`, not imported — no shared code between sibling projects (see `obstacle/docs/decisions.md`).
- **Geometry only for v1** — no construction/BOM, no dimension lines yet. `obstacle` built dimension lines alongside its first geometry pass and BOM one phase later; here both are deferred (see [features.md](features.md)) since the immediate goal was getting the ramp shapes right.
- **Half-pipe is the only ramp type.** A quarter-pipe variant (`src/ramps/quarterPipe.ts`) and a spine variant were both built at different points and then permanently dropped — no longer wanted, unlike the earlier "temporarily out of the UI, staged to rejoin" framing this file used to have for quarter-pipe. `research/design.md`'s "Half-pipe as a special case of quarter-pipe" section still explains the shared curve math/reasoning behind how the half-pipe itself is built (two mirrored transitions), even though quarter-pipe isn't a shippable type anymore.
- **3D view only**, no 2D top-down view — same reasoning as `obstacle`: no terrain to place a ramp on. This doesn't cover the "2D drawings" tab (see status.md): those are per-part shop drawings (one rib, one joist, etc., not the whole assembled ramp), not a site/plan view — a different thing this decision was never about.
- **Params reset to defaults via the reset button** — no persisted state while the page is open, matching `obstacle`.

## Ramp geometry

- **Both ramp types are a closed 2D cross-section extruded across `width`** with `THREE.ExtrudeGeometry` (constant depth) — `obstacle/src/obstacles/kicker.ts`'s technique, not `roller.ts`'s hand-built quad strips, because ramp width doesn't taper for either type.
- **`radius` is the primary transition knob, not `height`** — real ramps are specified by transition radius (how tight the curve is), so `radius` + `transitionAngleDeg` (how far it sweeps, 90° = reaches vertical) + `vertHeight` (straight wall continuing past the curve) are independent params; overall height is a derived readout, not a slider.
- **`src/ramps/transition.ts` centralizes the curve trig** (`transitionArcPoints`, `transitionExitDirection`, `transitionAndDeckPoints`) — kept separate from `halfPipe.ts` even though half-pipe is the only consumer now, since it's genuinely reusable curve math, not half-pipe-specific. `transitionAndDeckPoints` (arc + vert extension + flat deck) is what a deck attachment looks like regardless of ramp shape.
- **Coping is a hollow tube (`THREE.ExtrudeGeometry` of an annulus) built in `main.ts`, not part of a ramp's own `BufferGeometry`** — same separation as `obstacle`'s ground plane being its own mesh. Its center comes from `halfPipe.ts`'s `halfPipeCopingCenters`, not from the built geometry's bounding box — the bounding box's extreme X is the deck's *outer/back* edge, but coping actually sits recessed into the notch cut at the *curve* side, i.e. the lip where the transition meets the deck (`deckStart` in `transitionAndDeckPoints`, not `deckEnd`; see `src/ramps/coping.ts`).
- **The coping notch is cut directly into `halfPipeOutline`, so it's part of every rib and the solid wedge alike** — see `research/coping.md` for the pipe stock dimensions and required protrusions, and `src/ramps/coping.ts` (`copingNotch`) for the two-cut (plumb wall + horizontal shelf) geometry. The shelf's far end is found via an exact circle/line intersection with the transition arc, not the wall's tangent-line direction — at this radius/notch-size ratio a straight-line approximation would be off by a fraction of a millimeter, comparable to the protrusion spec itself.
- **Mesh material uses `THREE.DoubleSide`** (see `src/main.ts`), same ponytail call as `obstacle` — sidesteps verifying triangle winding on these hand-composed `THREE.Shape` outlines.

## Available space

- **Available length/width/height are a constraint you validate against, not
  inputs the app solves from** — the alternative (derive `radius`/
  `transitionAngleDeg`/`bottomTransitionLength`/etc. from available space) was
  considered and explicitly rejected: it would turn most of today's sliders
  into read-only outputs, which is a much bigger change than "tell me if
  this fits." Available length/width/height live as their own UI state in
  `src/main.ts` (not part of `HalfPipeParams`, since they don't affect the
  built geometry at all), compared every render against
  `halfPipeFootprint(currentParams)`.
- **`halfPipeFootprint` (in `src/ramps/halfPipe.ts`) computes the required
  length/width/height analytically**, from the same `transitionAndDeckPoints`
  call `buildHalfPipeGeometry` and `halfPipeCopingCenters` already use — not from
  the built geometry's bounding box — so it's cheap enough to call on every
  slider drag without building a `BufferGeometry` just to measure one.
- **Exceeding available space doesn't block rendering** — the ramp still
  renders at whatever size the sliders say, oversized or not, same as
  `obstacle` still renders a too-steep roller rather than refusing to. The
  three status pills (`#space-status` in `index.html`) just flag which
  axis (axes) don't fit and by how much, reusing `obstacle`'s
  `.bom-status.safe`/`.unsafe` badge pattern (adapted, not copy-pasted,
  since `obstacle`'s BOM markup doesn't apply here).

## Not implemented

See [features.md](features.md) — construction/BOM, dimension lines, GitHub Pages deploy (no git remote yet), width taper, asymmetric/mirrored variants.
