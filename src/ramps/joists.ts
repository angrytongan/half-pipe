import * as THREE from "three";

// User-adjustable via the joistThicknessMm slider in main.ts — the minor (thin) dimension.
export const JOIST_THICKNESS_MM = 45;

// User-adjustable via the joistDepthMm slider in main.ts — the major dimension, stood
// vertically ("major length vertical"); also what determines the bottom-transition height.
export const JOIST_DEPTH_MM = 90;

/**
 * One joist: thickness (X) x depth (Y) cross-section, spanning Z from zStart to zEnd. "Major
 * length vertical" — depth is the Y (vertical) extent, thickness the X (horizontal, along the
 * ramp's profile direction) extent. `angle` (radians, about Z) tilts the cross-section so its
 * top face follows the local curve tangent instead of staying horizontal.
 *
 * (x, y) anchors the box's *top* face, not its center — that's the point where the joist meets
 * the rib curve, so the top edge has to be coplanar with it (like a ceiling joist notched to a
 * roofline), with the joist's body hanging below/behind. Before rotation the top face is the
 * local Y=+depth/2 plane; under rotateZ(angle) that plane's offset from the box center becomes
 * (-sin(angle), cos(angle)) * depth/2, so the center is translated depth/2 back from (x, y)
 * along that same direction.
 */
export function buildJoistBox(zStart: number, zEnd: number, x: number, y: number, thickness: number, depth: number, angle = 0): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(thickness, depth, zEnd - zStart);
  geometry.rotateZ(angle);
  const centerX = x + Math.sin(angle) * (depth / 2);
  const centerY = y - Math.cos(angle) * (depth / 2);
  geometry.translate(centerX, centerY, (zStart + zEnd) / 2);
  return geometry;
}
