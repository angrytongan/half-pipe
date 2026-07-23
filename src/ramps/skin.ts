import * as THREE from "three";

const SHEET_ARC_SEGMENTS = 8;

/** Point on the circle centered at local (0, centerRadius) — the transition's own center — at radius r, arc parameter t (radians). See transitionArcPoints. */
function arcPointAtRadius(centerRadius: number, r: number, t: number): [number, number] {
  return [r * Math.sin(t), centerRadius - r * Math.cos(t)];
}

/**
 * One curved skin sheet's 2D cross-section: a "washer" slice between two concentric arcs
 * sharing the transition's own center (local (0, radius)) — the outer (rib-contact, or for
 * layer 2, layer-1-contact) edge at radius - outerOffset, and the exposed (inner, toward the
 * ramp's concave/rideable side) edge at radius - outerOffset - thickness. Offsetting a circle by
 * a constant distance along its own normal produces a smaller concentric circle, not a general
 * curve — the same fact coping.ts leans on near the notch, exact here rather than approximate
 * since the whole cross-section is built from it, not just one corner point. outerOffset is 0
 * for layer 1 (its outer edge sits on the bare curve itself) and layer 1's own thickness for
 * layer 2 (its outer edge sits on layer 1's own outer surface instead — see
 * buildHalfPipeSkinLayer2). t0/t1 are the segment's start/end arc parameters (radians, 0 at the
 * ground tangent, matching transitionArcPoints).
 *
 * flatExtension, when t0 is 0 (this sheet reaches the ground tangent), adds a flat lead-in
 * running further in -x from there — the sheet's own leftover length once the curve runs out,
 * continuing flat onto the bottom transition instead of stopping short at the seam (see
 * buildHalfPipeSkinLayer1). Ignored (no lead-in added) unless t0 is actually 0 — there'd be
 * nothing at x=0 for it to attach to otherwise.
 *
 * coping, at the opposite (t1) end, adds a straight lead-out continuing along the curve's own
 * tangent direction there — layer 2's topmost sheet reaching to physically touch the coping
 * pipe, which the notch's own shelf cut otherwise leaves recessed behind where the bare curve
 * stops (see buildHalfPipeSkinLayer2/copingTouchExtension). A straight-line extension, not a
 * curved wrap — consistent with the notch's own wall/shelf, which are themselves straight-line
 * simplifications of the true tangent (coping.ts). Both edges extend by the *outer* edge's own
 * distance (the rib/layer-1-contact side, the "bottom" edge — lower world Y than the inner
 * edge at any given t, since it sits at a larger radius from the arc's own center) — that's the
 * edge that actually needs to land tangent to the pipe, not the inner (exposed, "top") edge — so
 * the lead-out stays a square-cut rectangle (its far edge parallel to the sheet's own t1 end)
 * rather than the wedge a per-edge distance would give. That leaves the inner edge's own tip
 * landing slightly short of, or slightly past, the pipe's actual surface, but that gap/overlap
 * is small enough to be irrelevant.
 */
function curveSheetShape(radius: number, outerOffset: number, thickness: number, t0: number, t1: number, flatExtension = 0, coping?: { pipeCenter: [number, number]; pipeRadius: number }): THREE.Shape {
  const rOuter = radius - outerOffset;
  const rInner = radius - outerOffset - thickness;
  const extendGround = flatExtension > 0 && t0 === 0;
  const tangentAtT1: [number, number] = [Math.cos(t1), Math.sin(t1)];
  const outerExtension = coping ? copingTouchExtension(radius, rOuter, t1, coping.pipeCenter, coping.pipeRadius) : 0;
  const innerExtension = outerExtension; // square cut — see the doc comment above

  const shape = new THREE.Shape();
  if (extendGround) shape.moveTo(-flatExtension, outerOffset);
  for (let i = 0; i <= SHEET_ARC_SEGMENTS; i++) {
    const t = t0 + ((t1 - t0) * i) / SHEET_ARC_SEGMENTS;
    const [x, y] = arcPointAtRadius(radius, rOuter, t);
    if (i === 0 && !extendGround) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  if (coping) {
    const [ox, oy] = arcPointAtRadius(radius, rOuter, t1);
    shape.lineTo(ox + tangentAtT1[0] * outerExtension, oy + tangentAtT1[1] * outerExtension);
    const [ix, iy] = arcPointAtRadius(radius, rInner, t1);
    shape.lineTo(ix + tangentAtT1[0] * innerExtension, iy + tangentAtT1[1] * innerExtension);
  }
  for (let i = coping ? 1 : 0; i <= SHEET_ARC_SEGMENTS; i++) {
    const t = t1 - ((t1 - t0) * i) / SHEET_ARC_SEGMENTS;
    const [x, y] = arcPointAtRadius(radius, rInner, t);
    shape.lineTo(x, y);
  }
  if (extendGround) shape.lineTo(-flatExtension, outerOffset + thickness);
  shape.closePath();
  return shape;
}

/**
 * One curved skin sheet, local/unmirrored (x >= 0, rising from the ground tangent at t=0 like
 * transitionArcPoints) — extruded across zSpan and centered on Z so callers just translate to
 * the column's center Z (and mirror/shift X for the left/right side, see
 * buildHalfPipeSkinLayer1/2). outerOffset/flatExtension/coping: see curveSheetShape.
 */
export function buildSkinCurveSheet(
  radius: number,
  outerOffset: number,
  thickness: number,
  t0: number,
  t1: number,
  zSpan: number,
  flatExtension = 0,
  coping?: { pipeCenter: [number, number]; pipeRadius: number },
): THREE.BufferGeometry {
  const shape = curveSheetShape(radius, outerOffset, thickness, t0, t1, flatExtension, coping);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: zSpan, bevelEnabled: false });
  geometry.translate(0, 0, -zSpan / 2);
  return geometry;
}

/**
 * Row boundaries (arc parameters t0/t1, plus that row's own flatExtension — see
 * curveSheetShape) tiling a curve of `sweep` radians downward from the top in `sheetWidth`
 * arc-length steps, except the very first (topmost) row, which uses `starterWidth` instead.
 * Layer 1 passes starterWidth === sheetWidth (no special first row). Layer 2 passes half of it,
 * so its own seams land at the midpoint of layer 1's sheets instead of lining up with them (see
 * buildHalfPipeSkinLayer2) — the standard staggered-seam practice, same reason drywall or
 * brick coursing offsets each row from the one below it. The last (ground-most) row's own
 * flatExtension is however much of its row width it didn't use up on the curve, once it reaches
 * the ground tangent (0 for every other row).
 */
export function curveSheetRows(radius: number, sweep: number, sheetWidth: number, starterWidth: number): { t0: number; t1: number; flatExtension: number }[] {
  const rowWidthAt = (row: number) => (row === 0 ? starterWidth : sheetWidth);

  let rowCount = 0;
  let consumed = 0;
  while (consumed < radius * sweep - TILE_EPSILON) {
    consumed += rowWidthAt(rowCount);
    rowCount++;
  }
  rowCount = Math.max(1, rowCount);

  const rows: { t0: number; t1: number; flatExtension: number }[] = [];
  let cumulative = 0;
  for (let row = 0; row < rowCount; row++) {
    const rowWidth = rowWidthAt(row);
    const t1 = Math.max(sweep - cumulative / radius, 0);
    cumulative += rowWidth;
    const t0 = Math.max(sweep - cumulative / radius, 0);
    const flatExtension = Math.max(rowWidth - radius * (t1 - t0), 0);
    rows.push({ t0, t1, flatExtension });
  }
  return rows;
}

/**
 * How far a sheet edge at radius r, reaching the notch (t1 === sweep), must extend past its own
 * curve endpoint, along the curve's own tangent direction there, to become tangent to the coping
 * pipe's own surface — a straight line-circle intersection, solved exactly. 0 if that line never
 * reaches the pipe at all (shouldn't happen for a real notch, but avoids a NaN result rather
 * than assuming it always will). Call once per edge (r = the outer or inner radius) — see
 * curveSheetShape's coping parameter and buildHalfPipeSkinLayer2, since the two edges generally
 * need different distances.
 */
export function copingTouchExtension(radius: number, r: number, sweep: number, pipeCenter: [number, number], pipeRadius: number): number {
  const [px, py] = arcPointAtRadius(radius, r, sweep);
  const [tx, ty] = [Math.cos(sweep), Math.sin(sweep)];
  const [cx, cy] = pipeCenter;
  const vx = px - cx;
  const vy = py - cy;
  const vDotT = vx * tx + vy * ty;
  const vDotV = vx * vx + vy * vy;
  const discriminant = vDotT * vDotT - (vDotV - pipeRadius * pipeRadius);
  if (discriminant < 0) return 0;
  return Math.max(-vDotT - Math.sqrt(discriminant), 0);
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
 * Segments covering [-halfSpan, halfSpan] with up to `size`-wide pieces, starting flush at
 * +halfSpan and tiling toward -halfSpan — tileFromEdgeClipped's own mirror image, built by
 * running its same algorithm from -halfSpan (so starterWidth still means "the first piece
 * placed", now the one nearest +halfSpan) and reflecting every segment through 0. Anchoring to
 * the opposite edge from layer 1's own tileFromEdgeClipped columns keeps the two layers'
 * (potentially clipped) end pieces on opposite sides of the ramp — see staggeredZColumns.
 */
export function tileFromOppositeEdgeClipped(halfSpan: number, size: number, starterWidth = size): [number, number][] {
  const segments: [number, number][] = [];
  let pos = -halfSpan;
  let first = true;
  while (pos < halfSpan - TILE_EPSILON) {
    const step = first ? starterWidth : size;
    const next = Math.min(pos + step, halfSpan);
    segments.push([pos, next]);
    pos = next;
    first = false;
  }
  return segments.map(([a, b]): [number, number] => [-b, -a]).reverse();
}

/**
 * Layer 2's own curve-sheet Z-columns across the ramp's width. Normally tiled from the opposite
 * edge to layer 1's own columns (tileFromEdgeClipped), so their seams land in different places
 * even when both layers use the same sheet size — the width-direction counterpart to
 * curveSheetRows' arc-direction staggering. Falls back to an explicit half-sheet-length stagger
 * instead when starting from the opposite edge alone doesn't actually decouple them: if the
 * ramp's width divides evenly by layer 2's own sheet length, the tiling is symmetric and so
 * produces the identical seams regardless of which edge it starts from. See
 * buildHalfPipeSkinLayer2.
 */
export function staggeredZColumns(halfSpan: number, layer1SheetLength: number, layer2SheetLength: number): [number, number][] {
  const seamsOf = (segments: [number, number][]) => segments.slice(0, -1).map(([, end]) => end);
  const layer1Seams = seamsOf(tileFromEdgeClipped(halfSpan, layer1SheetLength));
  const opposite = tileFromOppositeEdgeClipped(halfSpan, layer2SheetLength);
  const coincide = layer1Seams.some((a) => seamsOf(opposite).some((b) => Math.abs(a - b) < 1e-6));
  return coincide ? tileFromOppositeEdgeClipped(halfSpan, layer2SheetLength, layer2SheetLength / 2) : opposite;
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

export interface FlatSheetLayout {
  xSegments: [number, number][];
  zRows: [number, number][];
}

/**
 * Picks whichever orientation (sheet's long edge along X, or along Z) tiles the bottom
 * transition's own flat coverage region with fewer total sheets — factored out of
 * buildHalfPipeSkinLayer1/2 in halfPipe.ts, which otherwise each inlined this identical
 * comparison. Shared so callers needing just the resulting sheet *sizes* (e.g. the 2D drawings
 * tab and bill of materials, which need to know about the region's own non-full-size leftover
 * piece) can't drift from what the 3D view actually builds.
 */
export function chooseFlatSheetLayout(reducedHalf: number, halfWidth: number, sheetLength: number, sheetWidth: number): FlatSheetLayout {
  const longEdgeAlongX: FlatSheetLayout = { xSegments: tileCenteredClipped(reducedHalf, sheetLength), zRows: tileFromEdgeClipped(halfWidth, sheetWidth) };
  const longEdgeAlongZ: FlatSheetLayout = { xSegments: tileCenteredClipped(reducedHalf, sheetWidth), zRows: tileFromEdgeClipped(halfWidth, sheetLength) };
  const countOf = (layout: FlatSheetLayout) => layout.xSegments.length * layout.zRows.length;
  return countOf(longEdgeAlongZ) < countOf(longEdgeAlongX) ? longEdgeAlongZ : longEdgeAlongX;
}

/** One flat skin sheet: a box spanning [xStart,xEnd] x [zStart,zEnd], sitting on top of y (its bottom face), extending up by thickness. */
export function buildSkinFlatSheet(xStart: number, xEnd: number, zStart: number, zEnd: number, thickness: number, y: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(xEnd - xStart, thickness, zEnd - zStart);
  geometry.translate((xStart + xEnd) / 2, y + thickness / 2, (zStart + zEnd) / 2);
  return geometry;
}
