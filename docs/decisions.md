# Design decisions

Scope/architecture decisions, so they don't need re-asking each session. Update this file when a decision changes rather than leaving it stale.

## Scope

- **Standalone geometry code**, same as `../obstacle`'s own stance: `src/ramps/util.ts`'s `centerFootprint` is copied from `obstacle/src/obstacles/util.ts`, not imported — no shared code between sibling projects (see `obstacle/docs/decisions.md`).
- **Geometry only for v1** — no construction/BOM, no dimension lines yet. `obstacle` built dimension lines alongside its first geometry pass and BOM one phase later; here both are deferred (see [features.md](features.md)) since the immediate goal was getting the ramp shapes right.
- **Two ramp types (quarter-pipe, half-pipe), not three** — a spine variant was built and then dropped; no longer wanted.
- **3D view only**, no 2D top-down view — same reasoning as `obstacle`: no terrain to place a ramp on.
- **Params reset to type defaults on switching ramp type** — no per-type state persisted while the page is open, matching `obstacle`.

## Ramp geometry

- **Both ramp types are a closed 2D cross-section extruded across `width`** with `THREE.ExtrudeGeometry` (constant depth) — `obstacle/src/obstacles/kicker.ts`'s technique, not `roller.ts`'s hand-built quad strips, because ramp width doesn't taper for either type.
- **`radius` is the primary transition knob, not `height`** — real ramps are specified by transition radius (how tight the curve is), so `radius` + `transitionAngleDeg` (how far it sweeps, 90° = reaches vertical) + `vertHeight` (straight wall continuing past the curve) are independent params; overall height is a derived readout, not a slider.
- **`src/ramps/transition.ts` centralizes the curve trig** (`transitionArcPoints`, `transitionExitDirection`, `transitionAndDeckPoints`) so quarterPipe and halfPipe can't derive slightly different curves by accident. `transitionAndDeckPoints` (arc + vert extension + flat deck) is shared by both, since both attach a deck the same way.
- **Coping is a `THREE.CylinderGeometry` added in `main.ts`, not part of a ramp's own `BufferGeometry`** — same separation as `obstacle`'s ground plane being its own mesh. Its X position comes from each ramp module's own `<name>CopingX(s)` function (`quarterPipeCopingX`, `halfPipeCopingXs`), not from the built geometry's bounding box — the bounding box's extreme X is the deck's *outer/back* edge, but coping actually sits at the *curve* side, i.e. the lip where the transition meets the deck (`deckStart` in `transitionAndDeckPoints`, not `deckEnd`). Quarter-pipe's outline starts at local `x=0` (asymmetric — flat run-in only exists on one side), so its coping function subtracts half the outline's total span to land in the geometry's centered coordinate space; half-pipe's outline is symmetric about `x=0` by construction, so no such offset is needed there.
- **Mesh material uses `THREE.DoubleSide`** (see `src/main.ts`), same ponytail call as `obstacle` — sidesteps verifying triangle winding on these hand-composed `THREE.Shape` outlines.

## Not implemented

See [features.md](features.md) — construction/BOM, dimension lines, GitHub Pages deploy (no git remote yet), width taper, asymmetric/mirrored variants.
