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

## Coping

- [ ] Reposition the notch's vertical cut (the wall) to start from the
      deck's actual top surface too. `copingNotch` (`src/ramps/coping.ts`)
      now measures `copingVerticalProtrusionMm` — and so the horizontal
      cut (the shelf) it produces — from the deck board's real top surface
      (`cornerY + deckThickness`, see `buildHalfPipeDeck`), but `wallTop`
      still anchors to the bare rib corner's own Y (`points[points.length -
      2]` from `transitionAndDeckPoints`) instead, so the wall's top
      currently sits `deckThickness` below where the deck board actually
      is. `wallX` itself (the wall's X position, from
      `copingHorizontalProtrusionMm`) is unaffected either way — it's a
      pure X measurement the deck's thickness doesn't enter into.
