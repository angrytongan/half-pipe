# Status

What's built and how. Update this after each completed feature — check [features.md](features.md) for what isn't built yet.

## Ramps

Two ramp types built, each a pure geometry builder in `src/ramps/`, sharing curve math from `src/ramps/transition.ts`, wired into `src/main.ts`'s generic slider UI:

- `quarterPipe.ts` — single transition: optional flat run-in
  (`flatRunLength`), circular transition curve (`radius`/
  `transitionAngleDeg`), optional vertical extension (`vertHeight`), flat
  deck platform (`deckLength`). Solid wedge, closed `THREE.Shape` extruded
  across `width`. Also exports `quarterPipeCopingX` (see Scene below).
- `halfPipe.ts` — two mirrored quarter-pipe transitions joined by a flat
  bottom (`flatBottomLength`), independent decks on both outer edges. Shares
  `transition.ts`'s `transitionAndDeckPoints` with `quarterPipe.ts` so the
  two transitions can't drift apart. Also exports `halfPipeCopingXs` and
  `halfPipeFootprint` (see Available space below).

`quarterPipe.ts` is currently unwired from the UI (see decisions.md) but
still builds, still tested — `src/main.ts`'s `RampType` is `"halfPipe"`
only for now.

Both share `src/ramps/util.ts`'s `centerFootprint` — centers geometry
on X/Z via bounding box, leaves Y untouched so the base sits at 0.

A "Reset to defaults" button (`#reset-btn`) below the sliders re-applies the
current type's defaults.

## Scene

`src/main.ts`: `PerspectiveCamera` + `OrbitControls` (no damping), ambient +
raking directional light with shadows, a flat ground plane, flat-shaded
solid-color ramp material (schematic style, no textures).

**Coping tubes**: a small `THREE.CylinderGeometry` per transition/deck lip
(steel-pipe gray, metalness/roughness material). X position comes from each
ramp module's own `<name>CopingX(s)` function, not the geometry's bounding
box — see decisions.md for why. Quarter-pipe gets one, half-pipe gets two.

`index.html` layout: an `.app-header` (skateboard icon, title, "in
development" pill, GitHub link) matching `obstacle`'s header, above an
`.app` flex row holding the `#panel` (available-space block, type select,
sliders) and `#viewport` (3D view) cards. No method-select/BOM/tooltip UI
this round — see features.md.

## Available space

`#space` in `index.html`, above the type-select — three sliders (available
length/width/height, `AVAILABLE_SPACE_SLIDERS` in `src/main.ts`) plus a row
of status pills (`#space-status`) comparing them against
`halfPipeFootprint(currentParams)` on every render: green "7.80m / 8.00m"
when it fits, red "17.20m / 8.00m — over by 9.20m" when it doesn't. Doesn't
block rendering either way — see decisions.md. `renderSliderList` in
`src/main.ts` is the slider-row builder shared between this and the
per-ramp-type sliders (factored out of what was previously
`renderSliders`).

## Deployment

Not set up — `half-pipe` isn't a git repository yet, so there's no remote to
publish a GitHub Pages build to. See features.md.
