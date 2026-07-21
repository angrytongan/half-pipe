import * as THREE from "three";

const SHEET_ARC_SEGMENTS = 8;

/** Point on the circle centered at local (0, centerRadius) — the transition's own center — at radius r, arc parameter t (radians). See transitionArcPoints. */
function arcPointAtRadius(centerRadius: number, r: number, t: number): [number, number] {
  return [r * Math.sin(t), centerRadius - r * Math.cos(t)];
}

/**
 * One curved skin sheet's 2D cross-section: a "washer" slice between two concentric arcs
 * sharing the transition's own center (local (0, radius)) — the rib-contact (outer) edge at
 * the curve's own radius, and the exposed (inner, toward the ramp's concave/rideable side) edge
 * at radius - thickness. Offsetting a circle by a constant distance along its own normal
 * produces a smaller concentric circle, not a general curve — the same fact coping.ts leans on
 * near the notch, exact here rather than approximate since the whole cross-section is built
 * from it, not just one corner point. t0/t1 are the segment's start/end arc parameters
 * (radians, 0 at the ground tangent, matching transitionArcPoints).
 *
 * flatExtension, when t0 is 0 (this sheet reaches the ground tangent), adds a flat lead-in
 * running further in -x from there — the sheet's own leftover length once the curve runs out,
 * continuing flat onto the bottom transition instead of stopping short at the seam (see
 * buildHalfPipeSkinLayer1). Ignored (no lead-in added) unless t0 is actually 0 — there'd be
 * nothing at x=0 for it to attach to otherwise.
 */
function curveSheetShape(radius: number, thickness: number, t0: number, t1: number, flatExtension = 0): THREE.Shape {
  const extend = flatExtension > 0 && t0 === 0;
  const shape = new THREE.Shape();
  if (extend) shape.moveTo(-flatExtension, 0);
  for (let i = 0; i <= SHEET_ARC_SEGMENTS; i++) {
    const t = t0 + ((t1 - t0) * i) / SHEET_ARC_SEGMENTS;
    const [x, y] = arcPointAtRadius(radius, radius, t);
    if (i === 0 && !extend) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = 0; i <= SHEET_ARC_SEGMENTS; i++) {
    const t = t1 - ((t1 - t0) * i) / SHEET_ARC_SEGMENTS;
    const [x, y] = arcPointAtRadius(radius, radius - thickness, t);
    shape.lineTo(x, y);
  }
  if (extend) shape.lineTo(-flatExtension, thickness);
  shape.closePath();
  return shape;
}

/**
 * One curved skin sheet, local/unmirrored (x >= 0, rising from the ground tangent at t=0 like
 * transitionArcPoints) — extruded across zSpan and centered on Z so callers just translate to
 * the column's center Z (and mirror/shift X for the left/right side, see buildHalfPipeSkinLayer1).
 * flatExtension: see curveSheetShape.
 */
export function buildSkinCurveSheet(radius: number, thickness: number, t0: number, t1: number, zSpan: number, flatExtension = 0): THREE.BufferGeometry {
  const shape = curveSheetShape(radius, thickness, t0, t1, flatExtension);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: zSpan, bevelEnabled: false });
  geometry.translate(0, 0, -zSpan / 2);
  return geometry;
}

const TILE_EPSILON = 1e-9;

/**
 * Segments covering [-halfSpan, halfSpan] with up to `size`-wide pieces, starting flush at
 * -halfSpan and tiling toward +halfSpan — the last piece is clipped short instead of
 * overhanging past the far edge. Used both for a curve row's columns across the ramp's width and
 * for a flat sheet's own rows across it (see buildHalfPipeSkinLayer1).
 */
export function tileFromEdgeClipped(halfSpan: number, size: number): [number, number][] {
  const segments: [number, number][] = [];
  let pos = -halfSpan;
  while (pos < halfSpan - TILE_EPSILON) {
    const next = Math.min(pos + size, halfSpan);
    segments.push([pos, next]);
    pos = next;
  }
  return segments;
}

/**
 * Segments covering [-halfSpan, halfSpan] with up to `size`-wide pieces, the first centered on
 * 0 (clipped to halfSpan if it would overhang — e.g. a sheet longer than the bottom transition
 * is flush, not clipped, is short), the rest tiling outward from there to each edge, clipped
 * short at the boundary rather than overhanging past it. Empty if halfSpan isn't positive — e.g.
 * a curve row's own flatExtension already reaching (or passing) the ramp's own centerline, so
 * there's nothing left in the middle to cover (see buildHalfPipeSkinLayer1).
 */
export function tileCenteredClipped(halfSpan: number, size: number): [number, number][] {
  if (halfSpan <= 0) return [];
  const centerHalf = Math.min(size / 2, halfSpan);
  const segments: [number, number][] = [[-centerHalf, centerHalf]];
  let pos = centerHalf;
  while (pos < halfSpan - TILE_EPSILON) {
    const next = Math.min(pos + size, halfSpan);
    segments.push([pos, next]);
    segments.push([-next, -pos]);
    pos = next;
  }
  return segments;
}

/** One flat skin sheet: a box spanning [xStart,xEnd] x [zStart,zEnd], sitting on top of y (its bottom face), extending up by thickness. */
export function buildSkinFlatSheet(xStart: number, xEnd: number, zStart: number, zEnd: number, thickness: number, y: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(xEnd - xStart, thickness, zEnd - zStart);
  geometry.translate((xStart + xEnd) / 2, y + thickness / 2, (zStart + zEnd) / 2);
  return geometry;
}
