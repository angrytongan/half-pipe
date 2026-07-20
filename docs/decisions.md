# Design decisions

Scope/architecture decisions, so they don't need re-asking each session. Update this file when a decision changes rather than leaving it stale.

## Scope

- **Standalone geometry code**, same as `../obstacle`'s own stance: `src/ramps/util.ts`'s `centerFootprint` is copied from `obstacle/src/obstacles/util.ts`, not imported — no shared code between sibling projects (see `obstacle/docs/decisions.md`).
- **Geometry only for v1** — no construction/BOM, no dimension lines yet. `obstacle` built dimension lines alongside its first geometry pass and BOM one phase later; here both are deferred (see [features.md](features.md)) since the immediate goal was getting the ramp shapes right.
- **Two ramp types (quarter-pipe, half-pipe), not three** — a spine variant was built and then dropped; no longer wanted.
- **Quarter-pipe is temporarily out of the UI** (`RampType` in `src/main.ts` is `"halfPipe"` only) while the half-pipe gets a three-stage rework: (1) available-space inputs, (2) structural/framing rendering before skin, (3) then quarter-pipe rejoins once it shares the same model — a half-pipe is a special case of a quarter-pipe (see the "Half-pipe as a special case of quarter-pipe" section of `research/design.md`), so getting the half-pipe right first is expected to make the quarter-pipe version comparatively small. `src/ramps/quarterPipe.ts` and its tests are untouched, not deleted — this is unlike the spine removal, which was permanent.
- **3D view only**, no 2D top-down view — same reasoning as `obstacle`: no terrain to place a ramp on.
- **Params reset to type defaults on switching ramp type** — no per-type state persisted while the page is open, matching `obstacle`.

## Ramp geometry

- **Both ramp types are a closed 2D cross-section extruded across `width`** with `THREE.ExtrudeGeometry` (constant depth) — `obstacle/src/obstacles/kicker.ts`'s technique, not `roller.ts`'s hand-built quad strips, because ramp width doesn't taper for either type.
- **`radius` is the primary transition knob, not `height`** — real ramps are specified by transition radius (how tight the curve is), so `radius` + `transitionAngleDeg` (how far it sweeps, 90° = reaches vertical) + `vertHeight` (straight wall continuing past the curve) are independent params; overall height is a derived readout, not a slider.
- **`src/ramps/transition.ts` centralizes the curve trig** (`transitionArcPoints`, `transitionExitDirection`, `transitionAndDeckPoints`) so quarterPipe and halfPipe can't derive slightly different curves by accident. `transitionAndDeckPoints` (arc + vert extension + flat deck) is shared by both, since both attach a deck the same way.
- **Coping is a hollow tube (`THREE.ExtrudeGeometry` of an annulus) built in `main.ts`, not part of a ramp's own `BufferGeometry`** — same separation as `obstacle`'s ground plane being its own mesh. Its center comes from each ramp module's own `<name>CopingCenters` function (`quarterPipeCopingX`, `halfPipeCopingCenters`), not from the built geometry's bounding box — the bounding box's extreme X is the deck's *outer/back* edge, but coping actually sits recessed into the notch cut at the *curve* side, i.e. the lip where the transition meets the deck (`deckStart` in `transitionAndDeckPoints`, not `deckEnd`; see `src/ramps/coping.ts`). Quarter-pipe's outline starts at local `x=0` (asymmetric — flat run-in only exists on one side), so its coping function subtracts half the outline's total span to land in the geometry's centered coordinate space; half-pipe's outline is symmetric about `x=0` by construction, so no such offset is needed there.
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
  call `buildHalfPipeGeometry` and `halfPipeCopingXs` already use — not from
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
