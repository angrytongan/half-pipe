import * as THREE from "three";
import { halfPipeFootprint, type HalfPipeParams } from "../ramps/halfPipe";
import { ribZPositions } from "../ramps/ribs";
import { buildLinearDimension, type LinearDimension } from "./dimensionLine";

const OFFSET_DISTANCE = 0.4;

export interface HalfPipeDimension extends LinearDimension {
  text: string;
}

function formatMeters(value: number): string {
  return `${value.toFixed(2)}m`;
}

/**
 * Height/length/bottom-transition-length/rib-spacing dimension lines for a half-pipe, computed
 * analytically from HalfPipeParams (same approach as halfPipeFootprint/halfPipeCopingXs)
 * rather than from built rib geometry. Only one rib and one rib-to-rib gap are dimensioned —
 * every rib is an identical copy of the others and ribs are evenly spaced (see ribZPositions),
 * so dimensioning each one would be redundant. Each dimension gets its own distinct position
 * (not just a different offset distance) — label sprites use depthTest:false so they don't
 * respect the Z-buffer, and two dimensions sharing a Z line and X center (as an earlier,
 * merely-offset-differently version of this code did for length/bottom-transition-length) can
 * end up with near-identical screen positions from some camera angles, hiding one label behind
 * the other.
 */
export function buildHalfPipeDimensions(params: HalfPipeParams): HalfPipeDimension[] {
  const { width, internalRibCount, ribThicknessMm, bottomTransitionLength, joistDepthMm } = params;
  const { length, height } = halfPipeFootprint(params);
  const halfLength = length / 2;
  const halfBottomTransition = bottomTransitionLength / 2;
  const bottomTransitionY = joistDepthMm / 1000;
  const halfWidth = width / 2;
  const ribThickness = ribThicknessMm / 1000;
  const halfRibThickness = ribThickness / 2;
  const [gapStartZ, gapEndZ] = ribZPositions(width, internalRibCount, ribThickness);

  const heightDim = buildLinearDimension(
    new THREE.Vector3(-halfLength, 0, -halfWidth),
    new THREE.Vector3(-halfLength, height, -halfWidth),
    new THREE.Vector3(0, 0, 1),
    OFFSET_DISTANCE,
  );
  const lengthDim = buildLinearDimension(
    new THREE.Vector3(-halfLength, 0, -halfWidth),
    new THREE.Vector3(halfLength, 0, -halfWidth),
    new THREE.Vector3(0, 0, -1),
    OFFSET_DISTANCE,
  );
  // Drawn at the opposite edge rib from length/height so its label never shares a screen
  // position with the overall-length one, regardless of camera angle.
  const bottomTransitionDim = buildLinearDimension(
    new THREE.Vector3(-halfBottomTransition, bottomTransitionY, halfWidth),
    new THREE.Vector3(halfBottomTransition, bottomTransitionY, halfWidth),
    new THREE.Vector3(0, 0, 1),
    OFFSET_DISTANCE,
  );
  // Inside surface to inside surface, not centerline to centerline — the clear span a
  // builder actually has to work with, so pulled in by half a rib thickness on each side.
  const spacingDim = buildLinearDimension(
    new THREE.Vector3(halfLength, height, gapStartZ + halfRibThickness),
    new THREE.Vector3(halfLength, height, gapEndZ - halfRibThickness),
    new THREE.Vector3(1, 0, 0),
    OFFSET_DISTANCE,
  );
  // Offset in -X (opposite side from the rib-spacing dimension's +X) at the left deck edge —
  // a distinct anchor and offset axis from every other dimension here, not just a different
  // offset distance or Y-level, for the same depthTest:false reason noted above.
  // Outside surface to outside surface, which is just ±width/2 — the edge ribs are inset (see
  // ribZPositions) so the true overall footprint is exactly the width param, no overhang.
  const widthDim = buildLinearDimension(
    new THREE.Vector3(-halfLength, 0, -halfWidth),
    new THREE.Vector3(-halfLength, 0, halfWidth),
    new THREE.Vector3(-1, 0, 0),
    OFFSET_DISTANCE,
  );

  return [
    { ...heightDim, text: formatMeters(height) },
    { ...lengthDim, text: formatMeters(length) },
    { ...bottomTransitionDim, text: formatMeters(bottomTransitionLength) },
    { ...spacingDim, text: formatMeters(gapEndZ - gapStartZ - ribThickness) },
    { ...widthDim, text: formatMeters(width) },
  ];
}
