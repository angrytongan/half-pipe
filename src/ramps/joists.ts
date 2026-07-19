import * as THREE from "three";

// User-adjustable via the joistThicknessMm slider in main.ts — the minor (thin) dimension.
export const JOIST_THICKNESS_MM = 45;

// User-adjustable via the joistDepthMm slider in main.ts — the major dimension, stood
// vertically ("major length vertical"); also what determines the bottom-transition height.
export const JOIST_DEPTH_MM = 90;

// ponytail: rounded from research/design.md's cited ~203mm rib/ledger spacing, for
// construction ease (a round 200mm tape measurement instead of 8" converted to metric).
export const CURVE_JOIST_SPACING_M = 0.2;

/**
 * One joist: thickness (X) x depth (Y) cross-section, centered on (x, y), spanning Z from
 * zStart to zEnd. "Major length vertical" — depth is the Y (vertical) extent, thickness the X
 * (horizontal, along the ramp's profile direction) extent.
 */
export function buildJoistBox(zStart: number, zEnd: number, x: number, y: number, thickness: number, depth: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(thickness, depth, zEnd - zStart);
  geometry.translate(x, y, (zStart + zEnd) / 2);
  return geometry;
}
