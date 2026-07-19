# Feature backlog

Not-yet-built features and known gaps. Check [decisions.md](decisions.md) for the scope/design reasoning behind an item before starting it. When an item is built, remove it from here and describe it in [status.md](status.md) instead.

## Structure (stage 2)

- [ ] Render the half-pipe's rib/transom skeleton (evenly spaced across
      `width`, cut to the transition profile — see `research/design.md`'s
      "Quarter-pipe framing" and the cited DIYskate build) instead of the
      current fully-skinned solid wedge. Ribs only for this pass — ledgers,
      bracing, flat-bottom framing, and skin all come after.
- [ ] Rib spacing for an arbitrary size — the cited reference build's ~8"
      on-center spacing is sized for its specific 0.91m/1.83m-radius ramp
      only (see `research/design.md`); this app needs its own spacing rule
      that scales with whatever `radius`/`width`/`flatBottomLength` the
      user picks. Unsolved.

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
