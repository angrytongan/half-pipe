export type Point = [number, number];

export interface LinearDimension2D {
  extensionLineA: [Point, Point];
  extensionLineB: [Point, Point];
  dimensionLine: [Point, Point];
  arrowA: [Point, Point, Point];
  arrowB: [Point, Point, Point];
  labelPosition: Point;
}

function add([ax, ay]: Point, [bx, by]: Point): Point {
  return [ax + bx, ay + by];
}
function sub([ax, ay]: Point, [bx, by]: Point): Point {
  return [ax - bx, ay - by];
}
function scale([x, y]: Point, s: number): Point {
  return [x * s, y * s];
}
function normalize(p: Point): Point {
  const len = Math.hypot(p[0], p[1]) || 1;
  return scale(p, 1 / len);
}
function perpendicular([x, y]: Point): Point {
  return [-y, x];
}

/**
 * 2D analog of dimensionLine.ts's buildLinearDimension: two extension lines from the measured
 * start/end points out to an offset dimension line, with outward-pointing arrowhead triangles
 * (as polygon points, since SVG has no built-in cone primitive) sized by arrowLength/arrowWidth —
 * explicit parameters rather than fixed constants, since each part drawing picks its own scale
 * (see drawings/renderPartDrawing.ts).
 *
 * startGap and labelGap are also caller-supplied rather than fractions of offsetDistance: a
 * fraction of offsetDistance shrinks along with it, so a small detail dimension (e.g. a notch)
 * would get a gap/label-clearance too thin to read even though the same font size is used
 * everywhere in the drawing — see renderPartDrawing.ts for how these are actually sized.
 */
export function buildLinearDimension2D(
  start: Point,
  end: Point,
  offsetDir: Point,
  offsetDistance: number,
  arrowLength: number,
  arrowWidth: number,
  startGap: number,
  labelGap: number,
): LinearDimension2D {
  const offsetUnit = normalize(offsetDir);
  const offset = scale(offsetUnit, offsetDistance);
  const offsetStart = add(start, offset);
  const offsetEnd = add(end, offset);
  const dirVec = normalize(sub(offsetEnd, offsetStart));
  const perp = perpendicular(dirVec);

  const arrowAt = (tip: Point, dir: Point): [Point, Point, Point] => {
    const base = add(tip, scale(dir, arrowLength));
    return [tip, add(base, scale(perp, arrowWidth / 2)), add(base, scale(perp, -arrowWidth / 2))];
  };

  const labelPosition = add(scale(add(offsetStart, offsetEnd), 0.5), scale(offsetUnit, labelGap));

  return {
    // Starts startGap away from the part's own measured point, not at it — an extension line
    // touching the part it measures reads as part of the part's own geometry.
    extensionLineA: [add(start, scale(offsetUnit, startGap)), offsetStart],
    extensionLineB: [add(end, scale(offsetUnit, startGap)), offsetEnd],
    dimensionLine: [offsetStart, offsetEnd],
    arrowA: arrowAt(offsetStart, dirVec),
    arrowB: arrowAt(offsetEnd, scale(dirVec, -1)),
    labelPosition,
  };
}
