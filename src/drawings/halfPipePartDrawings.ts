import { bottomTransitionMemberLengths, deckBoardLength, ribLocalProfilePoints, type HalfPipeParams } from "../ramps/halfPipe";
import { ribZPositions } from "../ramps/ribs";
import type { Point } from "./svgDimension";

export interface DimensionSpec {
  start: Point;
  end: Point;
  offsetDir: Point;
  offsetDistance: number;
  text: string;
}

/**
 * One anchored, top-down stack of text lines (e.g. the rib's thickness/radius/angle/deck-length
 * callouts) — a single block per part, not one independent position per line, so the renderer
 * (which alone knows the font size these get drawn at) can space the lines by that font size
 * and guarantee they don't overlap, instead of two places independently guessing a spacing that
 * has to happen to agree (see renderPartDrawing.ts).
 */
export interface LabelBlock {
  anchor: Point;
  lines: string[];
}

export interface PartDrawing {
  title: string;
  outline: Point[][];
  dimensions: DimensionSpec[];
  labels: LabelBlock;
}

function formatMm(valueMm: number): string {
  return `${Math.round(valueMm)}mm`;
}

// How far a dimension line sits off the outline — a fixed fraction of the part's own bounding
// size, so differently-scaled parts (a ~2m rib vs. a 45mm-thick joist cross-section) each get
// proportionally sensible spacing.
const OFFSET_FACTOR = 0.12;

// The non-dimension label stack sits below the outline's own bottom edge, past the bottom
// dimension line's own offset (another full OFFSET_FACTOR gap beyond it) — clear of both the
// part being dimensioned and that dimension line itself, along the bottom of the card.
const LABEL_OFFSET_FACTOR = OFFSET_FACTOR * 2;

/**
 * One box-shaped part, drawn as a length × height rectangle (its own face/elevation view) with
 * the third dimension (thickness — out of this view's plane) called out as a text label —
 * shared by every part here except the rib, which needs its own curved outline. Both
 * lengthMm/heightMm/thicknessMm are already in mm.
 */
function rectanglePartDrawing(title: string, lengthMm: number, heightMm: number, thicknessMm: number): PartDrawing {
  const halfLength = lengthMm / 2;
  const halfHeight = heightMm / 2;
  const corners: Point[] = [
    [-halfLength, -halfHeight],
    [halfLength, -halfHeight],
    [halfLength, halfHeight],
    [-halfLength, halfHeight],
  ];
  const maxExtent = Math.max(lengthMm, heightMm);
  const offsetDistance = maxExtent * OFFSET_FACTOR;

  return {
    title,
    outline: [corners],
    dimensions: [
      { start: corners[0], end: corners[1], offsetDir: [0, -1], offsetDistance, text: formatMm(lengthMm) },
      { start: corners[1], end: corners[2], offsetDir: [1, 0], offsetDistance, text: formatMm(heightMm) },
    ],
    labels: { anchor: [0, -halfHeight - maxExtent * LABEL_OFFSET_FACTOR], lines: [`Thickness: ${formatMm(thicknessMm)}`] },
  };
}

/**
 * The rib's real, curved profile (see ribLocalProfilePoints — same points the 3D view actually
 * extrudes, so this drawing can't drift from what's rendered), converted from meters to mm.
 * Overall envelope (height, base run), the small ground-to-curve-start base edge, and the
 * coping notch's own wall/shelf cuts each get a CAD-style dimension line, anchored to the exact
 * vertices `ribLocalProfilePoints` produces — see that function's own doc comment for the point
 * order this indexes into. An angular dimension for the transition arc isn't built anywhere in
 * this codebase yet (see docs/features.md), so radius/angle/vert height/deck length are called
 * out as text labels instead of hand-dimensioning the curve itself.
 *
 * Offset directions for the notch and base-edge dimensions aren't guessed — they're derived
 * from this outline's own (consistent, parameter-independent) winding: walking the boundary in
 * the order `ribLocalProfilePoints` emits it, the filled interior is always on the *left* of the
 * direction of travel, so rotating each segment's direction 90° left points into the material
 * and rotating it 90° right points into open space — pick whichever offset direction points
 * away from the material for each segment (see comments at each dimension below).
 */
export function ribPartDrawing(params: HalfPipeParams): PartDrawing {
  const points: Point[] = ribLocalProfilePoints(params).map(([x, y]) => [x * 1000, y * 1000]);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const maxExtent = Math.max(width, height);
  const offsetDistance = maxExtent * OFFSET_FACTOR;
  const detailOffsetDistance = offsetDistance / 2; // the notch/base-edge features are much smaller than the overall envelope

  // See ribLocalProfilePoints: [outer,0], deckOuter, wallTop, wallBottom, shelfEnd, ...arc down
  // to the curve's own ground-tangent start, [baseX, jointDepth], [baseX, 0].
  const [wallTop, wallBottom, shelfEnd] = [points[2], points[3], points[4]];
  const curveStart = points[points.length - 2]; // [baseX, jointDepth] — where the flat base meets the curve
  const groundAtBase = points[points.length - 1]; // [baseX, 0]

  const lines = [
    `Thickness: ${formatMm(params.ribThicknessMm)}`,
    `Radius: ${formatMm(params.radius * 1000)}, angle: ${params.transitionAngleDeg}°`,
    ...(params.vertHeight > 0 ? [`Vert height: ${formatMm(params.vertHeight * 1000)}`] : []),
    `Deck length: ${formatMm(params.deckLength * 1000)}`,
  ];

  return {
    title: "Rib",
    outline: [points],
    dimensions: [
      // Deck-outer edge (x = maxX) rises straight up (+Y) from the ground — material is toward
      // -X there, so +X points away from it.
      { start: [maxX, minY], end: [maxX, maxY], offsetDir: [1, 0], offsetDistance, text: formatMm(height) },
      // Ground line (y = minY) runs +X — material is toward +Y there, so -Y points away from it.
      { start: [minX, minY], end: [maxX, minY], offsetDir: [0, -1], offsetDistance, text: formatMm(width) },
      // The base's small closing edge (x = minX) runs -Y (down to the ground) — material is
      // toward +X there, so -X points away from it. Same side the overall height dimension used
      // to sit on, now free.
      { start: groundAtBase, end: curveStart, offsetDir: [-1, 0], offsetDistance: detailOffsetDistance, text: formatMm(curveStart[1] - groundAtBase[1]) },
      // The notch's plumb wall (x = wallX) runs -Y (top to bottom) — material is toward +X
      // there, so -X (back toward the curve, into the notch's own cut-away recess) points away.
      { start: wallBottom, end: wallTop, offsetDir: [-1, 0], offsetDistance: detailOffsetDistance, text: formatMm(wallTop[1] - wallBottom[1]) },
      // The notch's horizontal shelf (y = shelfY) runs -X (wall to shelf end) — material is
      // toward -Y there, so +Y (up into the recess) points away.
      { start: wallBottom, end: shelfEnd, offsetDir: [0, 1], offsetDistance: detailOffsetDistance, text: formatMm(wallBottom[0] - shelfEnd[0]) },
    ],
    labels: { anchor: [minX + width / 2, minY - maxExtent * LABEL_OFFSET_FACTOR], lines },
  };
}

export function deckBoardPartDrawing(params: HalfPipeParams): PartDrawing {
  return rectanglePartDrawing("Deck board", deckBoardLength(params) * 1000, params.width * 1000, params.ribThicknessMm);
}

/**
 * Every curve/deck joist shares the same cross-section and, since ribZPositions spaces
 * sections evenly, the same clear span between adjacent ribs' inside faces — so one drawing
 * covers every joist in the model (see buildHalfPipeJoistsBySection). Reuses the first bay's
 * own inside-face gap rather than re-deriving the section-spacing formula.
 */
export function joistPartDrawing(params: HalfPipeParams): PartDrawing {
  const ribThickness = params.ribThicknessMm / 1000;
  const [z0, z1] = ribZPositions(params.width, params.internalRibCount, ribThickness);
  const spanM = z1 - z0 - ribThickness;
  return rectanglePartDrawing("Joist", spanM * 1000, params.joistDepthMm, params.joistThicknessMm);
}

export function bottomTransitionPlatePartDrawing(params: HalfPipeParams): PartDrawing {
  const { plateLength } = bottomTransitionMemberLengths(params);
  return rectanglePartDrawing("Bottom transition plate", plateLength * 1000, params.joistDepthMm, params.joistThicknessMm);
}

export function bottomTransitionStudPartDrawing(params: HalfPipeParams): PartDrawing {
  const { studLength } = bottomTransitionMemberLengths(params);
  return rectanglePartDrawing("Bottom transition stud", studLength * 1000, params.joistDepthMm, params.joistThicknessMm);
}

export function skinLayer1SheetPartDrawing(params: HalfPipeParams): PartDrawing {
  return rectanglePartDrawing("Skin layer 1 sheet (flat, before bending)", params.skinSheetLength * 1000, params.skinSheetWidth * 1000, params.skinLayer1ThicknessMm);
}

export function skinLayer2SheetPartDrawing(params: HalfPipeParams): PartDrawing {
  return rectanglePartDrawing("Skin layer 2 sheet (flat, before bending)", params.skinLayer2SheetLength * 1000, params.skinLayer2SheetWidth * 1000, params.skinLayer2ThicknessMm);
}

/**
 * Not every layer 2 curve sheet is full-size: `curveSheetRows` (skin.ts) always starts layer
 * 2's tiling at the coping notch with a half-width row (`skinLayer2SheetWidth / 2`, not the
 * full width every other row uses) so its seams land staggered against layer 1's, rather than
 * lining up with them — see buildHalfPipeSkinLayer2. That's the one deterministic (not
 * ramp-width-dependent, unlike the Z-direction edge clipping every sheet can also get) narrower
 * size, so it's the one worth its own dimensioned part; its own Z-direction length is unaffected
 * by this, so only the width is halved.
 */
export function skinLayer2NarrowCurveSheetPartDrawing(params: HalfPipeParams): PartDrawing {
  return rectanglePartDrawing(
    "Skin layer 2 sheet — top-of-curve starter (half width, flat, before bending)",
    params.skinLayer2SheetLength * 1000,
    (params.skinLayer2SheetWidth / 2) * 1000,
    params.skinLayer2ThicknessMm,
  );
}

/** Every part drawing shown on the "2D drawings" tab — see main.ts. */
export function allPartDrawings(params: HalfPipeParams): PartDrawing[] {
  return [
    ribPartDrawing(params),
    deckBoardPartDrawing(params),
    joistPartDrawing(params),
    bottomTransitionPlatePartDrawing(params),
    bottomTransitionStudPartDrawing(params),
    skinLayer1SheetPartDrawing(params),
    skinLayer2SheetPartDrawing(params),
    skinLayer2NarrowCurveSheetPartDrawing(params),
  ];
}
