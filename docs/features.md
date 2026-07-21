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

- [ ] Reposition `wallTop`'s Y to start from the deck's actual top surface
      too. `copingNotch` (`src/ramps/coping.ts`) now measures both
      protrusion specs from the covered surface rather than the bare rib:
      `copingVerticalProtrusionMm` (and so the shelf) from the deck
      board's real top surface (`cornerY + deckThickness`, see
      `buildHalfPipeDeck`), and `copingHorizontalProtrusionMm` (and so
      the wall's X, `wallX`/`pipeCenterX`) from the skinned curve's own
      surface (`cornerX - skinThickness`, `skinLayer1ThicknessMm +
      skinLayer2ThicknessMm` — subtracted, since the curve's rideable side
      faces the ramp's interior/smaller X at this corner, the opposite
      sign from the deck's own `+deckThickness`). `wallTop`'s Y is the one piece still
      unrepositioned — it anchors directly to the bare rib corner's own Y
      (`points[points.length - 2]` from `transitionAndDeckPoints`) rather
      than `cornerY + deckThickness`, so the wall's top currently sits
      `deckThickness` below where the deck board actually is.
