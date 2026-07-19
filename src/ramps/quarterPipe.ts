import * as THREE from "three";
import { centerFootprint } from "./util";
import { transitionAndDeckPoints } from "./transition";

export interface QuarterPipeParams {
  radius: number;
  transitionAngleDeg: number;
  vertHeight: number;
  deckLength: number;
  flatRunLength: number;
  width: number;
}

export const QUARTER_PIPE_DEFAULTS: QuarterPipeParams = {
  radius: 1.8,
  transitionAngleDeg: 90,
  vertHeight: 0,
  deckLength: 0.6,
  flatRunLength: 0,
  width: 2,
};

/**
 * Optional flat run-in, circular transition curve, optional vertical
 * extension, flat deck platform at the top — extruded across width. Solid
 * wedge (closed 2D outline), same convention as obstacle's kicker.ts.
 * Centered on X/Z, base at Y=0.
 */
export function buildQuarterPipeGeometry(params: QuarterPipeParams): THREE.BufferGeometry {
  const { radius, transitionAngleDeg, vertHeight, deckLength, flatRunLength, width } = params;
  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const [deckOuterX] = points[points.length - 1];

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  if (flatRunLength > 0) shape.lineTo(flatRunLength, 0);
  for (const [x, y] of points) shape.lineTo(flatRunLength + x, y);
  shape.lineTo(flatRunLength + deckOuterX, 0);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  return centerFootprint(geometry);
}

/**
 * X position (in the returned geometry's centered coordinate space) of the
 * coping — the lip where the transition meets the deck, i.e. the curve
 * side, not the deck's outer/back edge. The outline always starts at local
 * x=0 (see buildQuarterPipeGeometry), so centering shifts everything left
 * by half the outline's total span.
 */
export function quarterPipeCopingX(params: QuarterPipeParams): number {
  const { radius, transitionAngleDeg, vertHeight, deckLength, flatRunLength } = params;
  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const [deckStartX] = points[points.length - 2];
  const [deckOuterX] = points[points.length - 1];
  const span = flatRunLength + deckOuterX;
  return flatRunLength + deckStartX - span / 2;
}
