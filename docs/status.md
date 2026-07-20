# Status

What's built and how. Update this after each completed feature — check [features.md](features.md) for what isn't built yet.

## Ramps

Half-pipe is the only ramp type — `src/ramps/halfPipe.ts` is a pure
geometry builder, sharing curve math from `src/ramps/transition.ts`,
wired into `src/main.ts`'s slider UI:

- `halfPipe.ts` — two mirrored transitions joined by a bottom transition
  (`bottomTransitionLength`), independent decks on both outer edges.
  Uses `transition.ts`'s `transitionAndDeckPoints` for the shared curve
  trig. Also exports `halfPipeCopingCenters` and `halfPipeFootprint`
  (see Available space below).

Uses `src/ramps/util.ts`'s `centerFootprint` — centers geometry
on X/Z via bounding box, leaves Y untouched so the base sits at 0.

A "Reset to defaults" button (`#reset-btn`) below the sliders re-applies
`HALF_PIPE_DEFAULTS`.

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
the seam, then screwed together, not as one continuous rib run. The two
edge ribs are inset by `ribThickness/2` from `±width/2` — their *outer*
faces meet `±width/2`, not their centerlines — so the whole assembled
structure fits exactly within `width`, with no overhang past it.
`ribZPositions(width, internalRibCount, ribThickness)` returns
`internalRibCount * 2 + 2` positions; the rib-spacing dimension (see
below) ends up measuring the actual usable section width — a little under
the naive `width / (internalRibCount + 1)`, since the seam pair's own
thickness eats into it. Rib thickness is the `ribThicknessMm` slider
(default 10mm), stored/displayed in millimetres since that's the natural
unit for a plywood thickness — converted to meters only where it feeds
`THREE.ExtrudeGeometry`/`ribZPositions`. `ribs.ts`'s `RIB_THICKNESS_MM` is
the constant this slider default comes from — `ribZPositions`/`extrudeRibs`
themselves take count/thickness as parameters, not module constants, so
they're fully driven by the sliders. `src/main.ts` renders one
`THREE.Mesh` per rib geometry inside a `THREE.Group` (`rampGroup`),
sharing the existing ramp material.

The transition curve's bottom tangent point sits on top of the bottom
transition's own framing, not on the raw ground: `halfPipeOutline` shifts
the curve/vert/deck portion of each rib up by the `joistDepthMm` slider
(default 90mm) — the joist's *major* dimension is what now determines this
height, since that's what physically holds the transition ribs up (see
"Joists" below); there's no separate thickness control for the bottom
transition anymore. `halfPipeOutline` returns two mirrored open shapes
(left, right), not one shape bridging the whole footprint — each rib ends
at its own base, at the *inside face* of the bottommost curve joist (that
joist's centerline is the curve's own tangent point; the rib's shelf
extends `joistThicknessMm/1000 / 2` inward from there, toward the ramp's
center, before dropping to the ground, so the rib actually covers that
joist's full footprint instead of stopping at its centerline and leaving
the inner half exposed), rather than spanning the whole
`bottomTransitionLength` gap; that gap is `buildBottomTransitionFrame`'s
job, not the ribs'. The deck-side closing edge (the non-structural
convenience noted below that closes each 2D shape for extrusion) still
drops to true `y=0`, unaffected.

`buildBottomTransitionFrame` builds that framing as a stud wall lying on
the ground, not a solid slab — screwed to the curved transition sections
as its own separate construction, not fused with the ribs (see
research/design.md's "Half-pipe as a special case of quarter-pipe": the
bottom transition's framing is the one piece a quarter-pipe alone doesn't
have). Two **plates** run almost the full `bottomTransitionLength` —
inset by half the last curve joist's own thickness on each end (see
Joists below) so they butt up against that joist's inner face instead of
reaching into its midpoint, since that joist is centered exactly at
`bottomTransitionLength / 2` — and are positioned so their *outer* faces
exactly meet the outside faces of the edge ribs, at `±width/2` (edge ribs
are inset — see Ribs above — so the structure fits within `width` with no
overhang) — that's the wall's "height", lying flat instead of standing
up. `internalStudCount + 2` **studs** (two
mandatory end studs plus the slider count, same `internalRibCount`
convention) then span between the plates' *inside* faces, evenly spaced
along the (now shorter) plate length and inset so the end studs' outer
faces sit flush with the plate ends — the same "inset to the inside face"
convention the joists use against the ribs. Plates and studs both reuse
`joistThicknessMm`/`joistDepthMm` for their cross-section — the same
lumber dimensions as everywhere else in this model, so `joistDepthMm`
alone still determines the wall's height off the ground, unchanged from
when this was a single box. `internalStudCount` (default 3) is a slider
in the "Bottom transition" section. `src/main.ts` renders the pieces in
their own `THREE.Group` (`bottomTransitionGroup`), reusing the joists'
wood-toned material — it's the same kind of lumber.

`buildHalfPipeGeometry` (the full-`width` solid wedge) still exists and is
still tested — a correct, reusable geometry-only function, sharing the same
`halfPipeOutline` so it never drifts from the ribs — but is no longer what's
rendered in the scene. Bracing and skin are separate, not-yet-built
backlog items (see features.md).

### Joists

`src/ramps/joists.ts`'s `buildJoistBox` is a single ledger: thickness (X)
by depth (Y) cross-section, spanning Z between two adjacent ribs — "major
length vertical" means the deeper dimension
(`joistDepthMm`, default 90mm) is the Y (vertical) extent, the thinner one
(`joistThicknessMm`, default 45mm) the X extent. `halfPipe.ts`'s
`buildHalfPipeJoists` places one joist per (profile landmark) × (build-
section bay) pair:

- **Landmarks per side**: the bottom corner (curve tangent, where it meets
  the bottom transition), evenly-spaced interior points up the curve
  (`transitionArcPoints` with a `segments` count computed so spacing never
  exceeds `CURVE_JOIST_SPACING_M` — 200mm, rounded from `research/design.md`'s
  cited ~203mm for construction ease — and lands exactly on the bottom
  end, the same trick `ribZPositions` uses for rib counts), and the end of
  the floor section (the deck's outer edge, the ramp's own outer edge —
  the rib's outline terminates exactly there, with no inset, unlike the
  bottom-corner end, so that one joist alone is inset inward by half its
  own thickness, aligning its external face with the rib's edge instead of
  centering the joist there and sticking half its thickness out past where
  the rib actually ends). No joist at the deck/curve corner itself (deck
  start) — tilted to the curve's own tangent there while anchored exactly
  where the flat deck begins, its top face would rise above the deck
  surface, physically intersecting it; needs a correctly-placed joist
  there instead (see features.md). No joist under the middle of the
  bottom transition — `buildBottomTransitionFrame`'s own stud wall (top
  plate, bottom plate, two wall studs, optional internal studs) covers
  that span instead.
- **Build-section bays** reuse `ribZPositions`'s own output directly: its
  doubled-seam ribs already pair up as `(ribZs[0],ribZs[1])`,
  `(ribZs[2],ribZs[3])`, ... one bay per pair, so a joist never spans the
  near-zero gap inside a doubled seam (those two ribs are already
  face-to-face and screwed together directly) — no separate bay-finding
  logic needed. `ribZPositions` returns rib centerlines, so each joist's Z
  span is inset by `ribThickness / 2` on both ends — it's built to the ribs'
  inside faces, not their centerlines, matching how it'd actually be cut and
  fitted between them.
- **Tilt**: `buildJoistBox` takes an optional `angle` (radians, about Z).
  Joists on the curve are rotated to the local tangent angle —
  `transitionArcPoints`'s parameter `t` *is* that angle — so their top face
  sits flush against the curved skin instead of staying horizontal. The
  bottom-corner and deck-outer landmarks are flat (angle 0) already, so
  they're unrotated. The angle is mirrored (negated) on the left side to
  match the existing X mirroring.
- **Anchor**: `(x, y)` anchors the joist's *top* face, not its center — like
  a ceiling joist notched to a roofline, the top edge has to be coplanar
  with the rib curve at that point, with the joist's body hanging
  below/behind it. `buildJoistBox` translates the box depth/2 back from
  `(x, y)` along the tilted face's own normal `(-sin(angle), cos(angle))` to
  compute the actual box center.

`src/main.ts` renders these in their own `THREE.Group` (`joistGroup`) with
a distinct wood-toned material, so dozens of small joist boxes read as a
different material from the blue ribs rather than visual noise.

### Coping

`src/ramps/coping.ts`'s `copingNotch` computes the notch cut into the rib at the deck/curve
corner (see `research/coping.md` for the pipe stock and required protrusions it's modeled
from) — two straight cuts, as it'd actually be built: a plumb wall and a horizontal shelf,
both tangent to the pipe (not the wall fixed at the corner's own X — the pipe is much bigger
than the protrusion specs, so it sits mostly recessed back under the deck, and a wall fixed at
the corner would cut straight through it instead of meeting its rear face). The shelf's far
end is found where the transition arc itself reaches shelf height, via an exact `acos`/`sin`
circle intersection rather than the wall's tangent-line direction — at this radius/notch-size
ratio a straight-line approximation would be off by a fraction of a millimeter, comparable to
the protrusion spec itself. `halfPipe.ts`'s
`halfPipeOutline` cuts this notch directly into the shared cross-section, so every rib and the
solid wedge (`buildHalfPipeGeometry`) get it automatically. `halfPipeCopingCenters` returns
each side's pipe center (`{x, y}`, mapped through the same mirroring as the outline), used to
position the rendered coping tube — no longer just `deckStart` itself, since the pipe sits
recessed into the notch rather than resting exactly on the corner. Four sliders in a "Coping"
section (`copingOdMm`/`copingIdMm`, default 60.3mm/50.8mm; `copingHorizontalProtrusionMm`/
`copingVerticalProtrusionMm`, default 3.2mm/6.4mm) drive it — see Scene below for the rendered
tube itself.

## Dimension lines

CAD-style dimension lines, first pass, half-pipe only. `src/dimensions/dimensionLine.ts`'s
`buildLinearDimension` (copied from `../obstacle/src/dimensions/dimensionLine.ts`, same
standalone-code convention as `centerFootprint` — see decisions.md) draws two extension
lines, an offset dimension line with arrowheads, and returns a label position; `src/main.ts`
copies `../obstacle`'s canvas-texture label-sprite approach (`createLabelSprite`) to render
the text, camera-facing, with no separate DOM overlay to get out of sync.

`src/dimensions/halfPipeDimensions.ts`'s `buildHalfPipeDimensions` computes six dimensions
analytically from `HalfPipeParams` (same approach as `halfPipeFootprint`/`halfPipeCopingCenters`
— no need to build the actual rib geometry just to measure it), all anchored to one edge rib
since every rib is an identical copy of the others:

- **Height** and **overall length** of one rib (ground to deck; deck to deck) — offset to
  opposite sides (+Z/−Z) of the left edge rib.
- **Bottom transition length** (`bottomTransitionLength`, at the flat span's actual height,
  `joistDepthMm/1000`) — offset from the *right* edge rib, not nested with the
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
  axis either. Measured **outside surface to outside surface**, which is exactly `±width/2` —
  the edge ribs are inset (see Ribs above), so the true overall footprint is exactly the
  `width` param itself, with no overhang.
- **Rib width** — one rib's own X-extent, from its base (the bottommost curve joist's inside
  face) out to its own deck's outer edge (not the whole ramp's length — overall length above
  already covers that). Drawn on the ground, on the same +Z side as the bottom transition
  length dimension and chained off it (its start sits right next to the bottom transition's
  own edge), rather than at deck height on the opposite side.

`src/main.ts`'s `rebuildDimensions` rebuilds/disposes these the same way `rebuildRamp`
already does for the rib group and coping, called after every param change.

## Scene

`src/main.ts`: `PerspectiveCamera` + stock `OrbitControls` (no damping,
default mouse mapping — left-drag rotates around the fixed
`controls.target`, right-drag pans, scroll/middle-drag dollies).
`zoomToCursor: true` is the one non-default flag, a built-in
OrbitControls option so scroll-zoom centers on the pointer rather than
the target. An earlier version replaced rotation with a hand-rolled,
raycast-picked-pivot orbit (SketchUp-style: pivot around whatever's
under the cursor) — reverted; simplicity won out over that feel, and it
made pan/zoom's existing distance-proportional speed (both scale with
distance to `controls.target`/the pivot, by OrbitControls' own design —
not something either version of the camera code introduced) harder to
retune uniformly. Ambient + raking directional light with shadows, a
flat ground plane, flat-shaded solid-color ramp material (schematic
style, no textures).

**Coping tubes**: a hollow tube (`THREE.ExtrudeGeometry` of an annulus shape — outer radius
`copingOdMm/2`, inner radius `copingIdMm/2`, built once per rebuild and shared by both meshes)
per transition/deck lip (steel-pipe gray, metalness/roughness material), one per side — a
half-pipe has two. Center comes from `halfPipeCopingCenters`, not the geometry's bounding box —
see decisions.md for why.

`index.html` layout: an `.app-header` (skateboard icon, title, "in
development" pill, GitHub link) matching `obstacle`'s header, above an
`.app` flex row holding the `#panel` (the always-visible space-status
pills at the top, then a divider, then an accordion of six
independently-collapsible sections — Available space, Ramp parameters,
Ribs, Joists, Bottom transition, Coping, each a plain native
`<details>`/`<summary>` so no JS is needed — then the reset button) and
`#viewport` (3D view) cards. No type-select (half-pipe is the only ramp
type — see decisions.md) or method-select/BOM/tooltip UI this round —
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

`halfPipeFootprint`'s `width` is the raw `width` param directly — the
edge ribs are inset (see Ribs above) so the whole assembled structure
fits exactly within `width`, with no overhang, so the raw param alone
already matches what's actually rendered.

## Deployment

Not set up — `half-pipe` isn't a git repository yet, so there's no remote to
publish a GitHub Pages build to. See features.md.
