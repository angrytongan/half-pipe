# Feature backlog

Not-yet-built features and known gaps. Check [decisions.md](decisions.md) for the scope/design reasoning behind an item before starting it. When an item is built, remove it from here and describe it in [status.md](status.md) instead.

## Construction / BOM

- [ ] Construction methods (plywood/OSB skin over a framed rib structure —
      the standard mini-ramp build) and a bill of materials, mirroring
      `../obstacle`'s `src/construction/` pattern (reference data +
      per-method calculations, tested, wired into a live BOM panel).
- [ ] Soundness checks (e.g. rib spacing vs. plywood span rating).

## Dimension lines

- [ ] CAD-style dimension lines for all three ramp types, mirroring
      `../obstacle`'s `src/dimensions/` pattern (`buildLinearDimension` is
      generic enough to reuse the same technique here).
- [ ] An angular-dimension variant for `transitionAngleDeg` — none of
      `obstacle`'s dimension code has this either.

## Ramps

- [ ] Width taper — no request for this; real ramps are typically constant
      width.
- [ ] Asymmetric half-pipe (independent radius/angle per side) — no request
      for this either.

## Deployment

- [ ] Git init + GitHub Pages workflow (`.github/workflows/deploy.yml`,
      `vite.config.ts`'s `base:` path) once there's a remote to publish to —
      see `../obstacle`'s workflow for the template.
