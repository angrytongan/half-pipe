import * as THREE from "three";
import { curveInteriorJoistLocalPoints, halfPipeFootprint, type HalfPipeParams } from "../ramps/halfPipe";
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
 * Height/length/bottom-transition-length/rib-spacing/width/rib-width/curve-joist-spacing
 * dimension lines for a half-pipe, computed analytically from HalfPipeParams (same approach as
 * halfPipeFootprint/halfPipeCopingCenters) rather than from built rib geometry. Only one rib
 * and one rib-to-rib gap are dimensioned —
 * every rib is an identical copy of the others and ribs are evenly spaced (see ribZPositions),
 * so dimensioning each one would be redundant; the curve-joist-spacing dimension is the same
 * idea applied to one representative pair of adjacent interior curve joists (see
 * curveInteriorJoistLocalPoints), omitted entirely when there are fewer than two to measure.
 * Each dimension gets its own distinct position
 * (not just a different offset distance) — label sprites use depthTest:false so they don't
 * respect the Z-buffer, and two dimensions sharing a Z line and X center (as an earlier,
 * merely-offset-differently version of this code did for length/bottom-transition-length) can
 * end up with near-identical screen positions from some camera angles, hiding one label behind
 * the other.
 */
export function buildHalfPipeDimensions(params: HalfPipeParams): HalfPipeDimension[] {
  const { width, internalRibCount, ribThicknessMm, bottomTransitionLength, joistDepthMm, joistThicknessMm } = params;
  const { length, height } = halfPipeFootprint(params);
  const halfLength = length / 2;
  const halfBottomTransition = bottomTransitionLength / 2;
  const bottomTransitionY = joistDepthMm / 1000;
  const halfWidth = width / 2;
  const ribThickness = ribThicknessMm / 1000;
  const halfRibThickness = ribThickness / 2;
  const [gapStartZ, gapEndZ] = ribZPositions(width, internalRibCount, ribThickness);
  // The left rib's own base — the bottommost curve joist's inside face (see halfPipeOutline) —
  // not the bottom transition's own half-length; the rib's outline is inset from there.
  const ribBaseX = -halfBottomTransition + joistThicknessMm / 1000 / 2;

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
  // One rib's own X-extent — from its base (the bottommost curve joist's inside face, see
  // ribBaseX above) out to its own deck's outer edge — not the whole ramp's length (lengthDim
  // above already covers that). Drawn at ground level on the same side (+Z) as the
  // bottom-transition dimension, chaining off it (ribBaseX sits right next to
  // -halfBottomTransition) rather than sharing an edge with the height dimension.
  const ribWidthDim = buildLinearDimension(
    new THREE.Vector3(ribBaseX, bottomTransitionY, halfWidth),
    new THREE.Vector3(-halfLength, bottomTransitionY, halfWidth),
    new THREE.Vector3(0, 0, 1),
    OFFSET_DISTANCE,
  );

  const dims = [
    { ...heightDim, text: formatMeters(height) },
    { ...lengthDim, text: formatMeters(length) },
    { ...bottomTransitionDim, text: formatMeters(bottomTransitionLength) },
    { ...spacingDim, text: formatMeters(gapEndZ - gapStartZ - ribThickness) },
    { ...widthDim, text: formatMeters(width) },
    { ...ribWidthDim, text: formatMeters(Math.abs(-halfLength - ribBaseX)) },
  ];

  // Distance between the midpoints of two adjacent curve joists — every curve gap is congruent
  // (equal angular steps on a circular arc, see curveInteriorJoistLocalPoints), so only the
  // first pair is dimensioned, same "one representative gap" convention spacingDim/ribWidthDim
  // use. Needs two interior joists to exist; omitted below internalCurveJoistCount 2.
  const curveJoists = curveInteriorJoistLocalPoints(params);
  if (curveJoists.length >= 2) {
    const [x0, y0] = curveJoists[0].point;
    const [x1, y1] = curveJoists[1].point;
    // Drawn at the opposite edge (-Z) from bottomTransitionDim/ribWidthDim (+Z), offset further
    // outward past the ramp — same "push past the structure" convention widthDim uses.
    const curveJoistSpacingDim = buildLinearDimension(
      new THREE.Vector3(-halfBottomTransition - x0, y0 + bottomTransitionY, -halfWidth),
      new THREE.Vector3(-halfBottomTransition - x1, y1 + bottomTransitionY, -halfWidth),
      new THREE.Vector3(0, 0, -1),
      OFFSET_DISTANCE,
    );
    dims.push({ ...curveJoistSpacingDim, text: formatMeters(Math.hypot(x1 - x0, y1 - y0)) });
  }

  return dims;
}
