import * as THREE from "three";

// User-adjustable via the joistThicknessMm slider in main.ts — the minor (thin) dimension.
export const JOIST_THICKNESS_MM = 45;

// User-adjustable via the joistDepthMm slider in main.ts — the major dimension, stood
// vertically ("major length vertical"); also what determines the bottom-transition height.
export const JOIST_DEPTH_MM = 90;

/**
 * A joist's true center, given the point where its *top* face meets the rib curve (see
 * `buildJoistBox`) and the tangent `angle` (radians, about Z) that face is tilted to. Before
 * rotation the top face is the local Y=+depth/2 plane; under rotateZ(angle) that plane's offset
 * from the box center becomes (-sin(angle), cos(angle)) * depth/2, so the center is translated
 * depth/2 back from (x, y) along that same direction. Shared with `halfPipe.ts`'s
 * `curveJoistSpacingMeters` and `halfPipeDimensions.ts`'s curve-joist-spacing dimension so both
 * measure the same true centerline distance instead of the top-face anchor points.
 */
export function joistCenter(x: number, y: number, depth: number, angle = 0): [number, number] {
  return [x + Math.sin(angle) * (depth / 2), y - Math.cos(angle) * (depth / 2)];
}

/**
 * One joist: thickness (X) x depth (Y) cross-section, spanning Z from zStart to zEnd. "Major
 * length vertical" — depth is the Y (vertical) extent, thickness the X (horizontal, along the
 * ramp's profile direction) extent. `angle` (radians, about Z) tilts the cross-section so its
 * top face follows the local curve tangent instead of staying horizontal.
 *
 * (x, y) anchors the box's *top* face, not its center — that's the point where the joist meets
 * the rib curve, so the top edge has to be coplanar with it (like a ceiling joist notched to a
 * roofline), with the joist's body hanging below/behind. See `joistCenter` for the anchor→center
 * math.
 */
export function buildJoistBox(zStart: number, zEnd: number, x: number, y: number, thickness: number, depth: number, angle = 0): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(thickness, depth, zEnd - zStart);
  geometry.rotateZ(angle);
  const [centerX, centerY] = joistCenter(x, y, depth, angle);
  geometry.translate(centerX, centerY, (zStart + zEnd) / 2);
  return geometry;
}
