# Status

What's built and how. Update this after each completed feature — check [features.md](features.md) for what isn't built yet.

## Ramps

Two ramp types built, each a pure geometry builder in `src/ramps/`, sharing curve math from `src/ramps/transition.ts`, wired into `src/main.ts`'s generic slider UI:

- `quarterPipe.ts` — single transition: optional flat run-in
  (`flatRunLength`), circular transition curve (`radius`/
  `transitionAngleDeg`), optional vertical extension (`vertHeight`), flat
  deck platform (`deckLength`). Solid wedge, closed `THREE.Shape` extruded
  across `width`. Also exports `quarterPipeCopingX` (see Scene below).
- `halfPipe.ts` — two mirrored quarter-pipe transitions joined by a flat
  bottom (`flatBottomLength`), independent decks on both outer edges. Shares
  `transition.ts`'s `transitionAndDeckPoints` with `quarterPipe.ts` so the
  two transitions can't drift apart. Also exports `halfPipeCopingXs` and
  `halfPipeFootprint` (see Available space below).

`quarterPipe.ts` is currently unwired from the UI (see decisions.md) but
still builds, still tested — `src/main.ts`'s `RampType` is `"halfPipe"`
only for now.

Both share `src/ramps/util.ts`'s `centerFootprint` — centers geometry
on X/Z via bounding box, leaves Y untouched so the base sits at 0.

A "Reset to defaults" button (`#reset-btn`) below the sliders re-applies the
current type's defaults.

## Structure

The half-pipe renders as its rib/transom skeleton, not a solid wedge: one
thin extrusion of the transition profile per rib, evenly spaced across
`width`, instead of one full-`width` extrusion. `src/ramps/halfPipe.ts`'s
`buildHalfPipeRibs` extracts the shared cross-section (`halfPipeOutline`,
module-private) and passes it through `src/ramps/ribs.ts`'s `extrudeRibs`
at the Z positions from `ribZPositions`. Rib count: there are always
exactly two single edge ribs (mandatory — nothing else frames the deck
edge), plus however many *seams* the `internalRibCount` slider says
(default 1, range 0–10). Each seam is doubled into two adjacent ribs
straddling its boundary point, touching face to face (offset by
±half the rib thickness, zero gap) rather than one shared rib — a wide
ramp is built as separate narrower sections, each with its own edge rib at
the seam, then screwed together, not as one continuous rib run.
`ribZPositions(width, internalRibCount, ribThickness)` returns
`internalRibCount * 2 + 2` positions; the rib-spacing dimension (see
below) ends up measuring the actual usable section width — a little under
the naive `width / (internalRibCount + 1)`, since the seam pair's own
thickness eats into it. Rib thickness is the `ribThicknessMm` slider
(default 19mm / 3/4" ply, per `research/design.md`'s "Ribs/transoms"),
stored/displayed in millimetres since that's the natural unit for a
plywood thickness — converted to meters only where it feeds
`THREE.ExtrudeGeometry`/`ribZPositions`. `ribs.ts`'s `RIB_THICKNESS_MM` is
the constant this slider default comes from — `ribZPositions`/`extrudeRibs`
themselves take count/thickness as parameters, not module constants, so
they're fully driven by the sliders. `src/main.ts` renders one
`THREE.Mesh` per rib geometry inside a `THREE.Group` (`rampGroup`),
sharing the existing ramp material.

The transition curve's bottom tangent point sits on top of the flat
bottom's own framing, not on the raw ground: `halfPipeOutline` shifts the
curve/vert/deck portion of each rib up by the `flatBottomThicknessMm`
slider (default 90mm, a round number close to a 2x4's actual depth per
`research/design.md`'s cited "38×89mm nominal" — also millimetres, same
reasoning as rib thickness). The deck-side closing edge (the non-structural convenience
noted below that closes the 2D outline for extrusion) still drops to true
`y=0`, unaffected. `buildHalfPipeFlatBottomSlab` renders that framing as a
simple box from `y=0` to `y=flatBottomThicknessMm/1000`, spanning
`flatBottomLength × width`, so the thickness the ribs meet is actually
visible (`slabMesh` in `main.ts`) rather than an invisible gap.

`buildHalfPipeGeometry` (the full-`width` solid wedge) still exists and is
still tested — a correct, reusable geometry-only function, sharing the same
`halfPipeOutline` so it never drifts from the ribs — but is no longer what's
rendered in the scene. Ledgers, bracing, and skin are separate, not-yet-built
backlog items (see features.md).

## Dimension lines

CAD-style dimension lines, first pass, half-pipe only. `src/dimensions/dimensionLine.ts`'s
`buildLinearDimension` (copied from `../obstacle/src/dimensions/dimensionLine.ts`, same
standalone-code convention as `centerFootprint` — see decisions.md) draws two extension
lines, an offset dimension line with arrowheads, and returns a label position; `src/main.ts`
copies `../obstacle`'s canvas-texture label-sprite approach (`createLabelSprite`) to render
the text, camera-facing, with no separate DOM overlay to get out of sync.

`src/dimensions/halfPipeDimensions.ts`'s `buildHalfPipeDimensions` computes five dimensions
analytically from `HalfPipeParams` (same approach as `halfPipeFootprint`/`halfPipeCopingXs` —
no need to build the actual rib geometry just to measure it), all anchored to one edge rib
since every rib is an identical copy of the others:

- **Height** and **overall length** of one rib (ground to deck; deck to deck) — offset to
  opposite sides (+Z/−Z) of the left edge rib.
- **Flat bottom length** (`flatBottomLength`, at the flat span's actual height,
  `flatBottomThicknessMm/1000`) — offset from the *right* edge rib, not nested with the
  overall-length dimension: an earlier version stacked it at a smaller offset on the same
  side, but the label sprites use `depthTest:false` (so they ignore the Z-buffer and can end
  up rendering in either order) and shared a Z line and X-center closely enough that one
  label routinely hid the other depending on camera angle. Anchoring it at a distinct edge
  rib instead gives it a genuinely separate screen position, not just a different offset
  distance.
- **Rib spacing** — the gap between the first two
  `ribZPositions(width, internalRibCount, ribThickness)` entries: the left edge rib and the
  near rib of the first doubled seam (or, at `internalRibCount: 0`, the two edge ribs
  themselves), offset to the side (+X) at deck height. Measured **inside surface to inside
  surface** (`centerToCenterGap - ribThickness`), not centerline to centerline — every rib's
  own Z position is its *center* (see `ribZPositions`), so each one eats half its own
  thickness into this gap; the raw centerline gap overstates the section's actual clear span.
- **Width** — offset to the *opposite* side (−X) from the rib-spacing dimension, at the left
  deck edge (ground level), so it doesn't share the rib-spacing dimension's anchor or offset
  axis either. Measured **outside surface to outside surface** (`width + ribThickness`), not
  centerline to centerline, for the same reason in reverse — each edge rib sticks out half
  its own thickness beyond `±width/2`, so the true overall footprint is one full rib
  thickness more than the `width` param itself.

`src/main.ts`'s `rebuildDimensions` rebuilds/disposes these the same way `rebuildRamp`
already does for the rib group and coping, called after every param change.

## Scene

`src/main.ts`: `PerspectiveCamera` + `OrbitControls` (no damping), ambient +
raking directional light with shadows, a flat ground plane, flat-shaded
solid-color ramp material (schematic style, no textures).

**Coping tubes**: a small `THREE.CylinderGeometry` per transition/deck lip
(steel-pipe gray, metalness/roughness material). X position comes from each
ramp module's own `<name>CopingX(s)` function, not the geometry's bounding
box — see decisions.md for why. Quarter-pipe gets one, half-pipe gets two.

`index.html` layout: an `.app-header` (skateboard icon, title, "in
development" pill, GitHub link) matching `obstacle`'s header, above an
`.app` flex row holding the `#panel` (type select at the top, the
always-visible space-status pills below it, then a divider, then an
accordion of four independently-collapsible sections — Available space,
Ribs, Flat bottom, Ramp parameters, each a plain native
`<details>`/`<summary>` so no JS is needed — then the reset button) and
`#viewport` (3D view) cards. No method-select/BOM/tooltip UI this round —
see features.md.

## Available space

Split across two places in `index.html` so the warning can't be hidden by
collapsing a section: a row of status pills (`#space-status`), comparing
the three sliders below against `halfPipeFootprint(currentParams)` on
every render, sits directly under the type select — always visible,
outside any `<details>` — green "7.80m / 8.00m" when it fits, red
"17.20m / 8.00m — over by 9.20m" when it doesn't. Doesn't block rendering
either way — see decisions.md. The three sliders themselves (available
length/width/height, `AVAILABLE_SPACE_SLIDERS` in `src/main.ts`) live in
the collapsible "Available space" accordion section below it.
`renderSliderList` in `src/main.ts` is the slider-row builder shared
between this and the per-ramp-type sliders (factored out of what was
previously `renderSliders`).

## Deployment

Not set up — `half-pipe` isn't a git repository yet, so there's no remote to
publish a GitHub Pages build to. See features.md.
