import * as THREE from "three";
import { centerFootprint } from "./util";
import { transitionAndDeckPoints } from "./transition";

export interface HalfPipeParams {
  radius: number;
  transitionAngleDeg: number;
  vertHeight: number;
  deckLength: number;
  flatBottomLength: number;
  width: number;
}

export const HALF_PIPE_DEFAULTS: HalfPipeParams = {
  radius: 1.8,
  transitionAngleDeg: 60,
  vertHeight: 0,
  deckLength: 0.6,
  flatBottomLength: 1.25,
  width: 3,
};

/**
 * Two mirrored transitions joined by a flat bottom, decks on both outer
 * edges — extruded across width. Closed outline, same solid-wedge convention
 * as quarterPipe.ts. Centered on X/Z, base at Y=0.
 */
export function buildHalfPipeGeometry(params: HalfPipeParams): THREE.BufferGeometry {
  const { radius, transitionAngleDeg, vertHeight, deckLength, flatBottomLength, width } = params;
  const half = flatBottomLength / 2;
  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const left = points.map(([x, y]): [number, number] => [-half - x, y]);
  const right = points.map(([x, y]): [number, number] => [half + x, y]);

  const shape = new THREE.Shape();
  shape.moveTo(left[left.length - 1][0], 0);
  for (let i = left.length - 1; i >= 0; i--) shape.lineTo(...left[i]);
  for (const [x, y] of right) shape.lineTo(x, y);
  shape.lineTo(right[right.length - 1][0], 0);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  return centerFootprint(geometry);
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
  const { radius, transitionAngleDeg, vertHeight, deckLength, flatBottomLength, width } = params;
  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const [deckOuterX, deckOuterY] = points[points.length - 1];
  return {
    length: flatBottomLength + 2 * deckOuterX,
    width,
    height: deckOuterY,
  };
}
