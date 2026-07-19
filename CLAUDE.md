# half-pipe

Browser app for planning skateboard ramp builds: pick a type (quarter-pipe,
half-pipe), adjust its parameters via sliders, and see the 3D shape.
Standalone — no terrain, no persistence (same posture as the sibling
`../obstacle` project, deliberate: see [docs/decisions.md](docs/decisions.md)).

## Decisions

[docs/decisions.md](docs/decisions.md) — scope/architecture decisions (shared
transition-curve math, coping placement, geometry-only v1). Check this before
assuming how something should work.

## Feature backlog

[docs/features.md](docs/features.md) — not-yet-built features and known
gaps. Check here for what's next; once an item is built, remove it from
there and describe it in [docs/status.md](docs/status.md) instead.

## Stack

Vite + TypeScript + Three.js, no framework, no backend, Vitest, ESLint (flat
config, `typescript-eslint` recommended). `npm run dev` / `build` / `test` /
`lint` / `typecheck`.

## Status

[docs/status.md](docs/status.md) — what's built and how (ramp geometry,
coping, scene). Update this after each completed feature.
