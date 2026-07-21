# Feature backlog

Not-yet-built features and known gaps. Check [decisions.md](decisions.md) for the scope/design reasoning behind an item before starting it. When an item is built, remove it from here and describe it in [status.md](status.md) instead.

## Construction / BOM

- [ ] Construction methods (plywood/OSB skin over a framed rib structure —
      the standard mini-ramp build) and a bill of materials, mirroring
      `../obstacle`'s `src/construction/` pattern (reference data +
      per-method calculations, tested, wired into a live BOM panel).
- [ ] Soundness checks (e.g. rib spacing vs. plywood span rating).

## Dimension lines

- [ ] An angular-dimension variant for `transitionAngleDeg` — none of
      `obstacle`'s dimension code has this either, and `buildLinearDimension`
      only handles straight measurements.

## Skinning

Skinning is the process of laying down plywood sheets on top of the frame
created by the joists and ribs, which provides the surface to skate on. We use
multiple layers instead of a single thick one so we're able to bend the
plywood without breaking it.

Both layers' full coverage are built (`src/ramps/skin.ts` + `halfPipe.ts`'s
`buildHalfPipeSkinLayer1`/`buildHalfPipeSkinLayer2`, see status.md): curved
sheets up the transition, cut off at the coping notch, clipped at the
ramp's edges, grain forced perpendicular to the ribs so they can bend,
tiled from the notch downward so a full sheet sits there (not a cut one);
plus flat sheets on the bottom transition, centered at X=0, oriented
whichever way (long edge along X or along Z) needs fewer sheets — no grain
constraint there, so a fixed direction would just risk more cuts/wasted
offcuts than necessary. Each curve row's own leftover (once the curve runs
out but the sheet hasn't) continues flat onto the bottom transition
instead of stopping cut at the seam (`curveSheetShape`'s `flatExtension`)
— the flat sheets are clipped to whatever that doesn't already reach, so
the two butt flush against each other with no gap or overlap. Layer 1
rendered solid, one shade of green per sheet; layer 2 rendered wireframe
in red, so both stay distinguishable from each other and from the ribs
underneath (see status.md) — not the intended final materials.

Layer 2 has its own, independent sheet-size sliders
(`skinLayer2SheetLength`/`skinLayer2SheetWidth`) and three differences
from layer 1: its seams are staggered to the midpoint of layer 1's sheets
both along the curve (`curveSheetRows`' half-width starter row) and
across the ramp's width (`staggeredZColumns`, tiling from the opposite
edge to layer 1's own columns, or an explicit half-sheet stagger if that
alone wouldn't decouple them); and its topmost sheet is extended in a
straight line along the curve's own tangent direction until it touches
the coping pipe (`copingTouchExtension`) — see status.md for all three.

Remaining:

- [ ] Layer 2's flat (bottom-transition) sheets aren't staggered against
      layer 1's flat sheets — only the curved coverage's seams are staggered.
      Since layer 1's own flat-sheet orientation is itself chosen per-ramp
      (whichever needs fewer sheets), "the midpoint" isn't a fixed axis to
      stagger against without first picking a rule for how the two
      orientation choices interact.
- [ ] `skinGrainDirection` isn't consumed by any geometry yet — on the curve,
      grain orientation is a hard physical constraint (perpendicular to the
      ribs, so the sheet can bend), not a free choice, so it's unclear where
      this control would actually apply.
- [ ] Waste-minimization/packing beyond simple deterministic tiling (e.g.
      reusing an off-cut from one row as the start of the next) — sheets are
      currently laid out edge-to-edge and clipped, not optimized to minimize
      scrap.
- [ ] Real final material/rendering (right now layer 1 is an arbitrary shade
      of green and layer 2 is red wireframe, purely to tell sheets and
      layers apart), once the layout itself is confirmed correct.
