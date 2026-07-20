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

## Joists

- [ ] A correctly-placed joist at the deck/curve corner (deck start).
      `buildHalfPipeJoists` (`src/ramps/halfPipe.ts`) dropped this landmark
      entirely — tilted to the curve's own tangent there while anchored
      exactly where the flat deck begins, its top face rose above the deck
      surface on the deck side of its own centerline, physically
      intersecting the deck it's supposed to sit under. The corner still
      needs *some* joist (the deck and the topmost curve-interior joist
      currently have a gap between them there); it just needs the right
      shape/orientation, not the curve's tilted cross-section carried
      straight through the corner.

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

## Scene / UI

- [ ] Reset view — recenter the camera/`controls.target` back to the
      initial framing (`camera.position.set(6, 4, 7)`,
      `controls.target.set(0, 0.6, 0)`), independent of "Reset to
      defaults" (`#reset-btn` in `index.html`/`main.ts`), which only
      resets the ramp *parameters*, not the camera. Orbiting (see
      status.md's Scene section) can leave the camera anywhere.
- [ ] Undo/redo for slider changes — no history stack exists yet;
      `currentParams` (`src/main.ts`) is mutated in place by
      `renderSliderList`'s `input` handler with no record of prior values.

## Ramps

- [ ] Width taper — no request for this; real ramps are typically constant
      width.
- [ ] Asymmetric half-pipe (independent radius/angle per side) — no request
      for this either.

## Deployment

- [ ] Git init + GitHub Pages workflow (`.github/workflows/deploy.yml`,
      `vite.config.ts`'s `base:` path) once there's a remote to publish to —
      see `../obstacle`'s workflow for the template.
