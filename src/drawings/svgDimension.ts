export type Point = [number, number];

export interface LinearDimension2D {
  extensionLineA: [Point, Point];
  extensionLineB: [Point, Point];
  dimensionLine: [Point, Point];
  arrowA: [Point, Point, Point];
  arrowB: [Point, Point, Point];
  labelPosition: Point;
}

const LABEL_NUDGE_FACTOR = 0.15; // fraction of offsetDistance, same "push past the dimension line" idea as dimensionLine.ts's fixed LABEL_NUDGE

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
 */
export function buildLinearDimension2D(
  start: Point,
  end: Point,
  offsetDir: Point,
  offsetDistance: number,
  arrowLength: number,
  arrowWidth: number,
): LinearDimension2D {
  const offset = scale(normalize(offsetDir), offsetDistance);
  const offsetStart = add(start, offset);
  const offsetEnd = add(end, offset);
  const dirVec = normalize(sub(offsetEnd, offsetStart));
  const perp = perpendicular(dirVec);

  const arrowAt = (tip: Point, dir: Point): [Point, Point, Point] => {
    const base = add(tip, scale(dir, arrowLength));
    return [tip, add(base, scale(perp, arrowWidth / 2)), add(base, scale(perp, -arrowWidth / 2))];
  };

  const labelPosition = add(scale(add(offsetStart, offsetEnd), 0.5), scale(normalize(offset), offsetDistance * LABEL_NUDGE_FACTOR));

  return {
    extensionLineA: [start, offsetStart],
    extensionLineB: [end, offsetEnd],
    dimensionLine: [offsetStart, offsetEnd],
    arrowA: arrowAt(offsetStart, dirVec),
    arrowB: arrowAt(offsetEnd, scale(dirVec, -1)),
    labelPosition,
  };
}
