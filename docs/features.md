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

Layer 1's own tiling is built (`src/ramps/skin.ts` + `halfPipe.ts`'s
`buildHalfPipeSkinLayer1`, see status.md): curved sheets up the transition
(cut off at the coping notch, clipped at the ramp's edges, grain forced
perpendicular to the ribs so they can bend) plus flat sheets on the bottom
transition (long edge along the ribs' own direction, no bending needed).
Rendered solid, one shade of green per sheet, to check placement, not as final geometry/material.

Remaining:

- [ ] Layer 2 — sits on top of layer 1, not yet built or described in detail
      (its own placement rules, e.g. whether it staggers seams against layer
      1, haven't been specified).
- [ ] A sheet that would cross from the bottom transition onto a rib is
      currently just clipped at that seam (two separate sheets meeting at
      ±half) instead of modeled as one real board spanning both zones with
      the curve's own grain orientation for its curved portion.
- [ ] `skinGrainDirection` isn't consumed by any geometry yet — on the curve,
      grain orientation is a hard physical constraint (perpendicular to the
      ribs, so the sheet can bend), not a free choice, so it's unclear where
      this control would actually apply.
- [ ] Waste-minimization/packing beyond simple deterministic tiling (e.g.
      reusing an off-cut from one row as the start of the next) — sheets are
      currently laid out edge-to-edge and clipped, not optimized to minimize
      scrap.
- [ ] Real final material/rendering (right now every sheet is an arbitrary
      shade of green, purely to tell sheets apart), once the layout itself
      is confirmed correct.
