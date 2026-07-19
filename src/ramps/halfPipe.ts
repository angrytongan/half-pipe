import * as THREE from "three";
import { centerFootprint } from "./util";
import { transitionAndDeckPoints, transitionArcPoints } from "./transition";
import { extrudeRibs, ribZPositions, RIB_THICKNESS_MM } from "./ribs";
import { buildJoistBox, CURVE_JOIST_SPACING_M, JOIST_DEPTH_MM, JOIST_THICKNESS_MM } from "./joists";

export interface HalfPipeParams {
  radius: number;
  transitionAngleDeg: number;
  vertHeight: number;
  deckLength: number;
  bottomTransitionLength: number;
  width: number;
  ribThicknessMm: number;
  internalRibCount: number;
  joistThicknessMm: number;
  joistDepthMm: number;
}

export const HALF_PIPE_DEFAULTS: HalfPipeParams = {
  radius: 1.8,
  transitionAngleDeg: 57,
  vertHeight: 0,
  deckLength: 0.3,
  bottomTransitionLength: 2.25,
  width: 3,
  ribThicknessMm: RIB_THICKNESS_MM,
  internalRibCount: 1,
  joistThicknessMm: JOIST_THICKNESS_MM,
  joistDepthMm: JOIST_DEPTH_MM,
};

/**
 * Closed 2D cross-section shared by the solid wedge and each individual rib. The curve/vert/
 * deck portion sits on top of the bottom transition's own framing (shifted up by the joist's
 * major dimension, joistDepthMm — that's the height the bottom transition is built to) — the
 * deck-side closing edge below still drops to true y=0 (see decisions.md: it's a rendering
 * convenience, not a structural wall, so it's unaffected by the framing above it).
 */
function halfPipeOutline(params: HalfPipeParams): THREE.Shape {
  const { radius, transitionAngleDeg, vertHeight, deckLength, bottomTransitionLength, joistDepthMm } = params;
  const jointDepth = joistDepthMm / 1000;
  const half = bottomTransitionLength / 2;
  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const left = points.map(([x, y]): [number, number] => [-half - x, y + jointDepth]);
  const right = points.map(([x, y]): [number, number] => [half + x, y + jointDepth]);

  const shape = new THREE.Shape();
  shape.moveTo(left[left.length - 1][0], 0);
  for (let i = left.length - 1; i >= 0; i--) shape.lineTo(...left[i]);
  for (const [x, y] of right) shape.lineTo(x, y);
  shape.lineTo(right[right.length - 1][0], 0);
  shape.closePath();
  return shape;
}

/**
 * Two mirrored transitions joined by a bottom transition, decks on both outer
 * edges — extruded across width. Closed outline, same solid-wedge convention
 * as quarterPipe.ts. Centered on X/Z, base at Y=0. Geometry-only utility —
 * `buildHalfPipeRibs` below is what's actually rendered (see decisions.md).
 */
export function buildHalfPipeGeometry(params: HalfPipeParams): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(halfPipeOutline(params), { depth: params.width, bevelEnabled: false });
  return centerFootprint(geometry);
}

/**
 * The rib/transom skeleton: one thin extrusion of the same cross-section per rib, evenly
 * spaced across width (see ribs.ts) instead of one full-width solid wedge.
 */
export function buildHalfPipeRibs(params: HalfPipeParams): THREE.BufferGeometry[] {
  const shape = halfPipeOutline(params);
  const ribThickness = params.ribThicknessMm / 1000;
  return extrudeRibs(shape, ribZPositions(params.width, params.internalRibCount, ribThickness), ribThickness);
}

/**
 * The bottom transition's own framing, sized to fill exactly the gap the rib curves now sit
 * on top of (see halfPipeOutline) — a simple box from y=0 to y=joistDepth, spanning
 * bottomTransitionLength x width. Not a rib — a separate structural piece, screwed to the
 * curved transition sections (see research/design.md's "Half-pipe as a special case of
 * quarter-pipe": the bottom transition's framing is the one piece a quarter-pipe alone
 * doesn't have).
 */
export function buildBottomTransitionSlab(params: HalfPipeParams): THREE.BufferGeometry {
  const { bottomTransitionLength, joistDepthMm, width } = params;
  const jointDepth = joistDepthMm / 1000;
  const geometry = new THREE.BoxGeometry(bottomTransitionLength, jointDepth, width);
  geometry.translate(0, jointDepth / 2, 0);
  return geometry;
}

/**
 * Joist/ledger skeleton: one joist per (profile landmark point) x (build-section bay).
 * Landmarks per side — bottom corner (curve tangent, where it meets the bottom transition),
 * evenly-spaced interior points up the curve (≤ CURVE_JOIST_SPACING_M apart, exact at both
 * ends — the same trick ribZPositions uses for rib counts), top corner (deck start), and the
 * end of the floor section (deck's outer edge) — plus one extra joist centered under the
 * bottom transition, equidistant between the two bottom-corner joists. Section bays reuse
 * ribZPositions's own output: its doubled-seam ribs already pair up as
 * (ribZs[0],ribZs[1]), (ribZs[2],ribZs[3]), ... one bay per pair, so no separate bay-finding
 * logic is needed — a joist only bridges a real section bay, never the near-zero gap inside
 * a doubled seam (those two ribs are already face-to-face and screwed together directly).
 */
export function buildHalfPipeJoists(params: HalfPipeParams): THREE.BufferGeometry[] {
  const { radius, transitionAngleDeg, vertHeight, deckLength, bottomTransitionLength, width, internalRibCount, ribThicknessMm, joistThicknessMm, joistDepthMm } = params;
  const half = bottomTransitionLength / 2;
  const jointDepth = joistDepthMm / 1000;
  const ribThickness = ribThicknessMm / 1000;
  const thickness = joistThicknessMm / 1000;
  const depth = joistDepthMm / 1000;

  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const deckStart = points[points.length - 2];
  const deckOuter = points[points.length - 1];

  const sweep = THREE.MathUtils.degToRad(transitionAngleDeg);
  const curveArcLength = radius * sweep;
  const curveSegments = Math.max(1, Math.ceil(curveArcLength / CURVE_JOIST_SPACING_M));
  const curveInteriorPoints = transitionArcPoints(radius, transitionAngleDeg, curveSegments).slice(1, -1);
  const curveInteriorAngles = curveInteriorPoints.map((_, i) => ((i + 1) / curveSegments) * sweep);

  // Tangent angle at each landmark, matching localPoints below: flat at the bottom corner,
  // rising through the curve, flat again at the vert/deck-start (its own tangent is `sweep`),
  // flat on the deck floor (0) — see transitionAndDeckPoints for why deckStart/deckOuter differ.
  const localPoints: [number, number][] = [[0, 0], ...curveInteriorPoints, deckStart, deckOuter];
  const localAngles: number[] = [0, ...curveInteriorAngles, sweep, 0];
  const worldJoists: { x: number; y: number; angle: number }[] = [
    { x: 0, y: jointDepth, angle: 0 }, // extra joist, equidistant between the two bottom corners
    ...localPoints.map(([x, y], i) => ({ x: -half - x, y: y + jointDepth, angle: -localAngles[i] })),
    ...localPoints.map(([x, y], i) => ({ x: half + x, y: y + jointDepth, angle: localAngles[i] })),
  ];

  const ribZs = ribZPositions(width, internalRibCount, ribThickness);
  const joists: THREE.BufferGeometry[] = [];
  for (let i = 0; i < ribZs.length; i += 2) {
    // ribZs are rib centerlines — the joist is built to butt against each rib's inside face,
    // not its centerline, so it spans the actual bay, not the centerline-to-centerline gap.
    const zStart = ribZs[i] + ribThickness / 2;
    const zEnd = ribZs[i + 1] - ribThickness / 2;
    for (const { x, y, angle } of worldJoists) {
      joists.push(buildJoistBox(zStart, zEnd, x, y, thickness, depth, angle));
    }
  }
  return joists;
}

/**
 * X positions (in the returned geometry's centered coordinate space) of the
 * coping on both sides — the lip where each transition meets its deck, i.e.
 * the curve side, not the decks' outer/back edges. The outline is symmetric
 * about local x=0 by construction (left/right are mirrored), so centering
 * is a no-op here — unlike quarterPipe's, no span/offset math is needed.
 */
export function halfPipeCopingXs(params: HalfPipeParams): [number, number] {
  const { radius, transitionAngleDeg, vertHeight, deckLength, bottomTransitionLength } = params;
  const half = bottomTransitionLength / 2;
  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const [deckStartX] = points[points.length - 2];
  return [-(half + deckStartX), half + deckStartX];
}

/**
 * Footprint this ramp actually needs — length (X), width (Z), height (Y) —
 * computed analytically from the same transitionAndDeckPoints used to build
 * the geometry, so it can't drift from what's actually rendered. Cheap
 * enough to call on every param change for space-constraint validation
 * without building a BufferGeometry just to measure it.
 */
export function halfPipeFootprint(params: HalfPipeParams): { length: number; width: number; height: number } {
  const { radius, transitionAngleDeg, vertHeight, deckLength, bottomTransitionLength, width, joistDepthMm } = params;
  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const [deckOuterX, deckOuterY] = points[points.length - 1];
  return {
    length: bottomTransitionLength + 2 * deckOuterX,
    width,
    height: deckOuterY + joistDepthMm / 1000,
  };
}
