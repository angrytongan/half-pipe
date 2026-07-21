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

Layer 1's curved coverage is built (`src/ramps/skin.ts` + `halfPipe.ts`'s
`buildHalfPipeSkinLayer1`, see status.md): sheets up the transition, cut off
at the coping notch, clipped at the ramp's edges, grain forced perpendicular
to the ribs so they can bend. Tiled from the notch downward so a full sheet
sits there (not a cut one). The ground-most row's own leftover (once the
curve runs out but the sheet hasn't) continues flat onto the bottom
transition instead of stopping cut at the seam — `curveSheetShape`'s
`flatExtension`. Rendered wireframe (each sheet's real outline only, not
its internal curve-approximation facets — see status.md), to check
placement, not as final geometry/material.

The rest of the bottom transition — whatever a curve row's own flat
extension doesn't reach — still has no coverage of its own.

Remaining:

- [ ] The bottom transition's own flat sheets (centered at X=0, tiled
      outward, `tileCenteredClipped`/`buildSkinFlatSheet` in skin.ts —
      both still there, just unused) for whatever a curve row's flat
      extension doesn't reach. Needs a rule for how the two meet — does a
      flat sheet butt against the curve row's extension, overlap it, or
      does the extension's own reach change how the flat sheets are laid
      out at all?
- [ ] Layer 2 — sits on top of layer 1, not yet built or described in detail
      (its own placement rules, e.g. whether it staggers seams against layer
      1, haven't been specified).
- [ ] `skinGrainDirection` isn't consumed by any geometry yet — on the curve,
      grain orientation is a hard physical constraint (perpendicular to the
      ribs, so the sheet can bend), not a free choice, so it's unclear where
      this control would actually apply.
- [ ] Waste-minimization/packing beyond simple deterministic tiling (e.g.
      reusing an off-cut from one row as the start of the next) — sheets are
      currently laid out edge-to-edge and clipped, not optimized to minimize
      scrap.
- [ ] Real final material/rendering (right now it's wireframe, purely to
      check placement), once the layout itself is confirmed correct.
