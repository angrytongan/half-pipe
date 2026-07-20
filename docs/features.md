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

- [ ] We need a dimension line showing the distance between the midpoint of two
      joists in a straight line.

## Joists

- [ ] A joist needs to be present between two ribs at the bottom rear corner of each rib
      at ground level.
- [ ] A joist needs to be present at the half-way point of the width of the rib
      at ground level.

## Coping

- [ ] Reposition the notch's vertical cut once the ramp's actual riding
      surface (the skin — see "Construction / BOM" above, not yet
      modeled) is defined. `copingNotch` (`src/ramps/coping.ts`) currently
      derives the wall's X from the pipe's own tangent point, which in
      turn measures `copingHorizontalProtrusionMm` against the bare rib's
      own corner point (`points[points.length - 2]` from
      `transitionAndDeckPoints`) — a stand-in for where the finished ramp
      surface will actually sit, since that surface doesn't exist yet.
      The horizontal cut (shelf) is confirmed correct as-is; only the
      vertical cut needs revisiting once the ramp surface is modeled.
