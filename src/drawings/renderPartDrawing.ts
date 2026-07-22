import { buildLinearDimension2D, type Point } from "./svgDimension";
import type { PartDrawing } from "./halfPipePartDrawings";

const SVG_NS = "http://www.w3.org/2000/svg";
const PADDING_FACTOR = 0.3; // extra room around the outline+dimensions for arrows/labels to sit in
const ARROW_LENGTH_FACTOR = 0.02; // fraction of the drawing's own bounding diagonal
const ARROW_WIDTH_FACTOR = 0.5; // fraction of arrow length
const FONT_SIZE_FACTOR = 0.045; // fraction of the drawing's own bounding diagonal
const LINE_HEIGHT_FACTOR = 1.4; // fraction of fontSize — keeps stacked label lines from overlapping regardless of a part's own scale
const CHAR_WIDTH_FACTOR = 0.55; // rough average glyph width, as a fraction of fontSize — just enough to keep long label lines from clipping the viewBox

function num(n: number): string {
  return n.toFixed(2);
}

// SVG's Y axis points down; every point here is in the geometry's Y-up math convention, so every
// coordinate gets its Y negated right before it's written out, rather than mirroring the whole
// drawing with an SVG transform (which would also mirror — and so un-flip — any text).
function svgPoint([x, y]: Point): string {
  return `${num(x)},${num(-y)}`;
}

function polygon(points: Point[], className: string): string {
  return `<polygon class="${className}" points="${points.map(svgPoint).join(" ")}" />`;
}

function line(a: Point, b: Point, className: string): string {
  return `<line class="${className}" x1="${num(a[0])}" y1="${num(-a[1])}" x2="${num(b[0])}" y2="${num(-b[1])}" />`;
}

function text(position: Point, content: string, fontSize: number, className: string): string {
  return `<text class="${className}" x="${num(position[0])}" y="${num(-position[1])}" font-size="${num(fontSize)}">${content}</text>`;
}

/** Renders one PartDrawing to a standalone, auto-fit <svg> element (mm coordinates as SVG user units). */
export function renderPartDrawing(part: PartDrawing): SVGSVGElement {
  const boundsPoints: Point[] = [...part.outline.flat(), part.labels.anchor];
  for (const dim of part.dimensions) {
    const dir = dim.offsetDir;
    const len = Math.hypot(dir[0], dir[1]) || 1;
    const offset: Point = [(dir[0] / len) * dim.offsetDistance, (dir[1] / len) * dim.offsetDistance];
    boundsPoints.push(dim.start, dim.end, [dim.start[0] + offset[0], dim.start[1] + offset[1]], [dim.end[0] + offset[0], dim.end[1] + offset[1]]);
  }
  const initialXs = boundsPoints.map((p) => p[0]);
  const initialYs = boundsPoints.map((p) => p[1]);
  const diagonal = Math.hypot(Math.max(...initialXs) - Math.min(...initialXs) || 1, Math.max(...initialYs) - Math.min(...initialYs) || 1);
  const arrowLength = diagonal * ARROW_LENGTH_FACTOR;
  const arrowWidth = arrowLength * ARROW_WIDTH_FACTOR;
  const fontSize = diagonal * FONT_SIZE_FACTOR;
  const lineHeight = fontSize * LINE_HEIGHT_FACTOR;

  // The label stack's own extent is only known once fontSize/lineHeight are fixed — add it (and
  // a rough text-width estimate) to the bounds afterward, rather than looping back into the
  // diagonal/fontSize calculation above.
  const [anchorX, anchorY] = part.labels.anchor;
  const longestLine = Math.max(0, ...part.labels.lines.map((l) => l.length));
  const halfTextWidth = (longestLine * fontSize * CHAR_WIDTH_FACTOR) / 2;
  const stackBottom = anchorY - Math.max(part.labels.lines.length - 1, 0) * lineHeight;
  boundsPoints.push([anchorX - halfTextWidth, anchorY], [anchorX + halfTextWidth, stackBottom]);

  const xs = boundsPoints.map((p) => p[0]);
  const ys = boundsPoints.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const pad = diagonal * PADDING_FACTOR;

  const outlineMarkup = part.outline.map((polyline) => polygon(polyline, "part-outline")).join("");

  const dimensionMarkup = part.dimensions
    .map((dim) => {
      const d = buildLinearDimension2D(dim.start, dim.end, dim.offsetDir, dim.offsetDistance, arrowLength, arrowWidth);
      return [
        line(...d.extensionLineA, "dim-extension"),
        line(...d.extensionLineB, "dim-extension"),
        line(...d.dimensionLine, "dim-line"),
        polygon(d.arrowA, "dim-arrow"),
        polygon(d.arrowB, "dim-arrow"),
        text(d.labelPosition, dim.text, fontSize, "dim-label"),
      ].join("");
    })
    .join("");

  const labelMarkup = part.labels.lines.map((content, i) => text([anchorX, anchorY - i * lineHeight], content, fontSize, "part-note")).join("");

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `${num(minX - pad)} ${num(-(maxY + pad))} ${num(width + 2 * pad)} ${num(height + 2 * pad)}`);
  svg.innerHTML = outlineMarkup + dimensionMarkup + labelMarkup;
  return svg;
}
