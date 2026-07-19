# Feature backlog

Not-yet-built features and known gaps. Check [decisions.md](decisions.md) for the scope/design reasoning behind an item before starting it. When an item is built, remove it from here and describe it in [status.md](status.md) instead.

## Quarter-pipe (stage 3)

- [ ] Bring `quarterPipe.ts` back into `src/main.ts`'s UI once it shares
      the half-pipe's available-space + structural-rendering model — see
      decisions.md's "Quarter-pipe is temporarily out of the UI" note.
      Expected to be comparatively small, since a half-pipe is built here
      as two quarter-pipe transitions plus a flat bottom.

## Construction / BOM

- [ ] Construction methods (plywood/OSB skin over a framed rib structure —
      the standard mini-ramp build) and a bill of materials, mirroring
      `../obstacle`'s `src/construction/` pattern (reference data +
      per-method calculations, tested, wired into a live BOM panel).
- [ ] Soundness checks (e.g. rib spacing vs. plywood span rating).

## Dimension lines

- [ ] Dimension lines for quarter-pipe once it rejoins the UI (stage 3) —
      `buildHalfPipeDimensions` (see status.md) should extend/adapt
      naturally once quarter-pipe shares the half-pipe's model.
- [ ] An angular-dimension variant for `transitionAngleDeg` — none of
      `obstacle`'s dimension code has this either, and `buildLinearDimension`
      only handles straight measurements.

## Ramps

- [ ] Width taper — no request for this; real ramps are typically constant
      width.
- [ ] Asymmetric half-pipe (independent radius/angle per side) — no request
      for this either.

## Deployment

- [ ] Git init + GitHub Pages workflow (`.github/workflows/deploy.yml`,
      `vite.config.ts`'s `base:` path) once there's a remote to publish to —
      see `../obstacle`'s workflow for the template.
