# half-pipe

Browser app for planning skateboard half-pipe builds: tweak its
parameters and see the 3D shape.

Standalone: no terrain, no persistence — just one ramp at a time.
Geometry-only for now — no bill of materials yet, see
[docs/status.md](docs/status.md) for what's built and
[docs/features.md](docs/features.md) for what's next.

## Running

```
npm install
npm run dev        # start the dev server
npm test           # run tests
npm run lint        # lint
npm run typecheck   # type-check
```

## Stack

Vite + TypeScript + Three.js, no framework, no backend. `src/ramps/` holds
pure geometry builders (`halfPipe.ts`, a parametric `THREE.BufferGeometry`
centered on its own footprint, using transition-curve math from
`src/ramps/transition.ts`); `src/main.ts` wires up the scene, camera,
lighting, coping tubes, and the parameter slider UI.
