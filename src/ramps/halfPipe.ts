import * as THREE from "three";
import { centerFootprint } from "./util";
import { transitionAndDeckPoints } from "./transition";
import { extrudeRibs, ribZPositions, RIB_THICKNESS_MM } from "./ribs";

export interface HalfPipeParams {
  radius: number;
  transitionAngleDeg: number;
  vertHeight: number;
  deckLength: number;
  flatBottomLength: number;
  width: number;
  ribThicknessMm: number;
  internalRibCount: number;
  flatBottomThicknessMm: number;
}

export const HALF_PIPE_DEFAULTS: HalfPipeParams = {
  radius: 1.8,
  transitionAngleDeg: 60,
  vertHeight: 0,
  deckLength: 0.6,
  flatBottomLength: 1.25,
  width: 3,
  ribThicknessMm: RIB_THICKNESS_MM,
  internalRibCount: 1,
  flatBottomThicknessMm: 90, // ~2x4 actual depth (89mm), per research/design.md's cited "38x89mm nominal"
};

/**
 * Closed 2D cross-section shared by the solid wedge and each individual rib. The curve/vert/
 * deck portion sits on top of the flat-bottom framing (shifted up by flatBottomThickness) —
 * the deck-side closing edge below still drops to true y=0 (see decisions.md: it's a
 * rendering convenience, not a structural wall, so it's unaffected by the framing above it).
 */
function halfPipeOutline(params: HalfPipeParams): THREE.Shape {
  const { radius, transitionAngleDeg, vertHeight, deckLength, flatBottomLength, flatBottomThicknessMm } = params;
  const flatBottomThickness = flatBottomThicknessMm / 1000;
  const half = flatBottomLength / 2;
  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const left = points.map(([x, y]): [number, number] => [-half - x, y + flatBottomThickness]);
  const right = points.map(([x, y]): [number, number] => [half + x, y + flatBottomThickness]);

  const shape = new THREE.Shape();
  shape.moveTo(left[left.length - 1][0], 0);
  for (let i = left.length - 1; i >= 0; i--) shape.lineTo(...left[i]);
  for (const [x, y] of right) shape.lineTo(x, y);
  shape.lineTo(right[right.length - 1][0], 0);
  shape.closePath();
  return shape;
}

/**
 * Two mirrored transitions joined by a flat bottom, decks on both outer
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
  return extrudeRibs(shape, ribZPositions(params.width, params.internalRibCount), params.ribThicknessMm / 1000);
}

/**
 * The flat bottom's own framing, sized to fill exactly the gap the rib curves now sit on top
 * of (see halfPipeOutline) — a simple box from y=0 to y=flatBottomThickness, spanning
 * flatBottomLength x width. Not a rib — a separate structural piece (see research/design.md's
 * "Half-pipe as a special case of quarter-pipe": the flat bottom's framing is the one piece a
 * quarter-pipe alone doesn't have).
 */
export function buildHalfPipeFlatBottomSlab(params: HalfPipeParams): THREE.BufferGeometry {
  const { flatBottomLength, flatBottomThicknessMm, width } = params;
  const flatBottomThickness = flatBottomThicknessMm / 1000;
  const geometry = new THREE.BoxGeometry(flatBottomLength, flatBottomThickness, width);
  geometry.translate(0, flatBottomThickness / 2, 0);
  return geometry;
}

/**
 * X positions (in the returned geometry's centered coordinate space) of the
 * coping on both sides — the lip where each transition meets its deck, i.e.
 * the curve side, not the decks' outer/back edges. The outline is symmetric
 * about local x=0 by construction (left/right are mirrored), so centering
 * is a no-op here — unlike quarterPipe's, no span/offset math is needed.
 */
export function halfPipeCopingXs(params: HalfPipeParams): [number, number] {
  const { radius, transitionAngleDeg, vertHeight, deckLength, flatBottomLength } = params;
  const half = flatBottomLength / 2;
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
  const { radius, transitionAngleDeg, vertHeight, deckLength, flatBottomLength, width, flatBottomThicknessMm } = params;
  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const [deckOuterX, deckOuterY] = points[points.length - 1];
  return {
    length: flatBottomLength + 2 * deckOuterX,
    width,
    height: deckOuterY + flatBottomThicknessMm / 1000,
  };
}
