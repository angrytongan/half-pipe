import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildSkinCurveSheet, chooseFlatSheetLayout, copingTouchExtension, curveSheetRows, staggeredZColumns, tileCenteredClipped, tileFromEdgeClipped, tileFromOppositeEdgeClipped } from "./skin";

/** Every vertex's distance from the transition's own arc center, local (0, radius) — ignoring Z, since the shape is just extruded straight along it. */
function vertexDistancesFromCenter(geometry: THREE.BufferGeometry, radius: number): number[] {
  const position = geometry.attributes.position;
  const distances: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    distances.push(Math.sqrt(x * x + (radius - y) * (radius - y)));
  }
  return distances;
}

describe("buildSkinCurveSheet", () => {
  const radius = 1.8;
  const thickness = 0.012;

  it("centers the extrusion on Z and spans exactly zSpan", () => {
    const zSpan = 1.2;
    const geometry = buildSkinCurveSheet(radius, 0, thickness, 0, 0.5, zSpan);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.z).toBeCloseTo(-zSpan / 2, 5);
    expect(box.max.z).toBeCloseTo(zSpan / 2, 5);
  });

  it("puts the outer (rib-contact) edge exactly on the transition's own curve — radius from its center", () => {
    const geometry = buildSkinCurveSheet(radius, 0, thickness, 0.1, 0.4, 1);
    const distances = vertexDistancesFromCenter(geometry, radius);
    expect(Math.max(...distances)).toBeCloseTo(radius, 5);
  });

  it("puts the inner (exposed) edge exactly thickness inside the transition's own curve, same center", () => {
    const geometry = buildSkinCurveSheet(radius, 0, thickness, 0.1, 0.4, 1);
    const distances = vertexDistancesFromCenter(geometry, radius);
    expect(Math.min(...distances)).toBeCloseTo(radius - thickness, 5);
  });

  it("offsets both edges inward by outerOffset — layer 2 sitting on top of layer 1, not the bare curve", () => {
    const outerOffset = 0.012; // layer 1's own thickness
    const geometry = buildSkinCurveSheet(radius, outerOffset, thickness, 0.1, 0.4, 1);
    const distances = vertexDistancesFromCenter(geometry, radius);
    expect(Math.max(...distances)).toBeCloseTo(radius - outerOffset, 5);
    expect(Math.min(...distances)).toBeCloseTo(radius - outerOffset - thickness, 5);
  });

  it("starts at the ground tangent when t0 is 0", () => {
    const geometry = buildSkinCurveSheet(radius, 0, thickness, 0, 0.3, 1);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(0, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
  });

  it("rises higher up the curve as t1 grows", () => {
    const low = buildSkinCurveSheet(radius, 0, thickness, 0, 0.2, 1);
    const high = buildSkinCurveSheet(radius, 0, thickness, 0, 0.6, 1);
    low.computeBoundingBox();
    high.computeBoundingBox();
    expect(high.boundingBox!.max.y).toBeGreaterThan(low.boundingBox!.max.y);
  });

  it("extends flat past the ground tangent by flatExtension, at the same y-range as the curve's own t=0 edge", () => {
    const flatExtension = 0.4;
    const geometry = buildSkinCurveSheet(radius, 0, thickness, 0, 0.3, 1, flatExtension);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(-flatExtension, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeGreaterThan(0); // still reaches up the curve past t=0 too
  });

  it("ignores flatExtension when t0 isn't 0 — nothing for it to attach to", () => {
    const withExtension = buildSkinCurveSheet(radius, 0, thickness, 0.1, 0.4, 1, 0.4);
    const without = buildSkinCurveSheet(radius, 0, thickness, 0.1, 0.4, 1, 0);
    withExtension.computeBoundingBox();
    without.computeBoundingBox();
    expect(withExtension.boundingBox!.min.x).toBeCloseTo(without.boundingBox!.min.x, 5);
  });

  it("extends the outer (rib-contact, 'bottom') edge's own tip until it touches the coping pipe exactly", () => {
    const t1 = 0.4;
    const rOuter = radius; // outerOffset is 0 here
    const outerPoint: [number, number] = [rOuter * Math.sin(t1), radius - rOuter * Math.cos(t1)];
    const tangent = [Math.cos(t1), Math.sin(t1)];
    // place the pipe directly ahead on the outer edge's own tangent line, guaranteed reachable
    const pipeCenter: [number, number] = [outerPoint[0] + tangent[0] * 0.05, outerPoint[1] + tangent[1] * 0.05];
    const pipeRadius = 0.02;
    const outerExtension = copingTouchExtension(radius, rOuter, t1, pipeCenter, pipeRadius);
    const expectedTip = [outerPoint[0] + tangent[0] * outerExtension, outerPoint[1] + tangent[1] * outerExtension];

    const geometry = buildSkinCurveSheet(radius, 0, thickness, 0.1, t1, 1, 0, { pipeCenter, pipeRadius });
    const position = geometry.attributes.position;
    let found = false;
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(position.getX(i) - expectedTip[0]) < 1e-6 && Math.abs(position.getY(i) - expectedTip[1]) < 1e-6) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
    const dist = Math.sqrt((expectedTip[0] - pipeCenter[0]) ** 2 + (expectedTip[1] - pipeCenter[1]) ** 2);
    expect(dist).toBeCloseTo(pipeRadius, 6);
  });

  it("squares the cut off — extends the inner edge by the same distance as the outer edge, not its own", () => {
    const t1 = 0.4;
    const rOuter = radius;
    const rInner = radius - thickness; // outerOffset is 0 here
    const outerPoint: [number, number] = [rOuter * Math.sin(t1), radius - rOuter * Math.cos(t1)];
    const innerPoint: [number, number] = [rInner * Math.sin(t1), radius - rInner * Math.cos(t1)];
    const tangent = [Math.cos(t1), Math.sin(t1)];
    const pipeCenter: [number, number] = [outerPoint[0] + tangent[0] * 0.05, outerPoint[1] + tangent[1] * 0.05];
    const pipeRadius = 0.02;
    const outerExtension = copingTouchExtension(radius, rOuter, t1, pipeCenter, pipeRadius);
    const expectedInnerTip = [innerPoint[0] + tangent[0] * outerExtension, innerPoint[1] + tangent[1] * outerExtension];

    const geometry = buildSkinCurveSheet(radius, 0, thickness, 0.1, t1, 1, 0, { pipeCenter, pipeRadius });
    const position = geometry.attributes.position;
    let found = false;
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(position.getX(i) - expectedInnerTip[0]) < 1e-6 && Math.abs(position.getY(i) - expectedInnerTip[1]) < 1e-6) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true); // squared, not the inner edge's own (different) tangent distance
  });
});

describe("curveSheetRows", () => {
  const radius = 1.8;
  const sheetWidth = 1.2;

  it("uses starterWidth for the first row's own width, sheetWidth for every row after it", () => {
    const starterWidth = 0.6;
    const rows = curveSheetRows(radius, 2, sheetWidth, starterWidth);
    expect(radius * (rows[0].t1 - rows[0].t0)).toBeCloseTo(starterWidth, 5);
    for (let i = 1; i < rows.length - 1; i++) {
      expect(radius * (rows[i].t1 - rows[i].t0)).toBeCloseTo(sheetWidth, 5);
    }
  });

  it("chains rows top to bottom with no gaps — each row's t0 is the next row's t1", () => {
    const rows = curveSheetRows(radius, 1.5, sheetWidth, sheetWidth / 2);
    for (let i = 0; i < rows.length - 1; i++) {
      expect(rows[i].t0).toBeCloseTo(rows[i + 1].t1, 10);
    }
  });

  it("starts the first row exactly at sweep and ends the last row exactly at 0", () => {
    const sweep = 1.3;
    const rows = curveSheetRows(radius, sweep, sheetWidth, sheetWidth / 2);
    expect(rows[0].t1).toBeCloseTo(sweep, 10);
    expect(rows[rows.length - 1].t0).toBeCloseTo(0, 10);
  });

  it("gives only the last row a nonzero flatExtension, when the sweep doesn't divide evenly", () => {
    const rows = curveSheetRows(radius, 1.3, sheetWidth, sheetWidth / 2);
    for (let i = 0; i < rows.length - 1; i++) {
      expect(rows[i].flatExtension).toBeCloseTo(0, 10);
    }
    expect(rows[rows.length - 1].flatExtension).toBeGreaterThan(0);
  });

  it("uses a single half-width-or-shorter row when the whole sweep fits within the starter width", () => {
    const rows = curveSheetRows(radius, 0.1, sheetWidth, sheetWidth / 2);
    expect(rows).toHaveLength(1);
    expect(rows[0].t1).toBeCloseTo(0.1, 10);
    expect(rows[0].t0).toBeCloseTo(0, 10);
  });
});

describe("copingTouchExtension", () => {
  const radius = 1.8;
  const r = radius - 0.012 - 0.012; // an inner-edge-style radius, offset in from the bare curve
  const sweep = 0.9;

  it("returns a distance that puts the edge's extended point exactly pipeRadius from pipeCenter", () => {
    const px = r * Math.sin(sweep);
    const py = radius - r * Math.cos(sweep);
    const tangent = [Math.cos(sweep), Math.sin(sweep)];
    // place the pipe center directly ahead on the tangent line itself, so it's guaranteed reachable
    const pipeCenter: [number, number] = [px + tangent[0] * 0.5, py + tangent[1] * 0.5];
    const pipeRadius = 0.03;

    const d = copingTouchExtension(radius, r, sweep, pipeCenter, pipeRadius);
    expect(d).toBeGreaterThan(0);

    const ex = px + tangent[0] * d;
    const ey = py + tangent[1] * d;
    const dist = Math.sqrt((ex - pipeCenter[0]) ** 2 + (ey - pipeCenter[1]) ** 2);
    expect(dist).toBeCloseTo(pipeRadius, 6);
  });

  it("returns 0 when the tangent line never reaches the pipe", () => {
    const pipeCenter: [number, number] = [-5, -5]; // far off in the opposite direction
    const d = copingTouchExtension(radius, r, sweep, pipeCenter, 0.03);
    expect(d).toBe(0);
  });
});

describe("tileFromOppositeEdgeClipped", () => {
  it("covers the same total span as tileFromEdgeClipped, just mirrored", () => {
    const halfSpan = 1.5;
    const size = 1.2;
    const normal = tileFromEdgeClipped(halfSpan, size);
    const opposite = tileFromOppositeEdgeClipped(halfSpan, size);
    expect(opposite).toHaveLength(normal.length);
    // every segment in one has a mirrored counterpart (negated and swapped) in the other
    for (const [a, b] of normal) {
      expect(opposite.some(([c, d]) => Math.abs(c - -b) < 1e-9 && Math.abs(d - -a) < 1e-9)).toBe(true);
    }
  });

  it("starts flush at +halfSpan and clips the last piece near -halfSpan instead", () => {
    const halfSpan = 1.5;
    const size = 1.2; // doesn't divide 3 evenly, so there's a real clipped piece to find
    const segments = tileFromOppositeEdgeClipped(halfSpan, size);
    expect(segments[segments.length - 1][1]).toBeCloseTo(halfSpan, 10); // last piece ends flush at +halfSpan
    const firstSpan = segments[0][1] - segments[0][0];
    expect(firstSpan).toBeLessThan(size - 1e-9); // the clipped piece is the first one, at -halfSpan
  });

  it("sizes the piece nearest +halfSpan by starterWidth instead of size", () => {
    const halfSpan = 3;
    const size = 1.2;
    const starterWidth = 0.6;
    const segments = tileFromOppositeEdgeClipped(halfSpan, size, starterWidth);
    const lastSpan = segments[segments.length - 1][1] - segments[segments.length - 1][0];
    expect(lastSpan).toBeCloseTo(starterWidth, 10);
  });
});

describe("staggeredZColumns", () => {
  it("uses the opposite-edge tiling when that alone already avoids matching layer 1's seams", () => {
    const halfSpan = 1.5;
    const layer1Size = 2.4; // doesn't divide 3 evenly — starting from either edge gives different seams
    const columns = staggeredZColumns(halfSpan, layer1Size, layer1Size);
    expect(columns).toEqual(tileFromOppositeEdgeClipped(halfSpan, layer1Size));
  });

  it("falls back to a half-sheet-length stagger when the ramp's width divides evenly by the sheet length", () => {
    const halfSpan = 2.4; // width 4.8, an exact multiple of a 2.4m sheet — symmetric either way
    const size = 2.4;
    const plainOpposite = tileFromOppositeEdgeClipped(halfSpan, size);
    const columns = staggeredZColumns(halfSpan, size, size);
    expect(columns).not.toEqual(plainOpposite);
    const lastSpan = columns[columns.length - 1][1] - columns[columns.length - 1][0];
    expect(lastSpan).toBeCloseTo(size / 2, 10);
  });

  it("still avoids matching seams when layer 2 uses a different sheet length than layer 1", () => {
    const halfSpan = 3;
    const layer1Size = 1.5; // divides 6 evenly on its own
    const layer2Size = 1.2; // different size — seams shouldn't coincide anyway
    const columns = staggeredZColumns(halfSpan, layer1Size, layer2Size);
    const layer1Seams = tileFromEdgeClipped(halfSpan, layer1Size)
      .slice(0, -1)
      .map(([, end]) => end);
    const columnSeams = columns.slice(0, -1).map(([, end]) => end);
    for (const seam of layer1Seams) {
      expect(columnSeams.some((s) => Math.abs(s - seam) < 1e-6)).toBe(false);
    }
  });
});

describe("chooseFlatSheetLayout", () => {
  it("picks the orientation with fewer total sheets, not a fixed long-edge direction", () => {
    // reducedHalf=2.4 with a 2.4-long sheet needs only 1 X-segment when the sheet's long edge
    // runs along X; the same reducedHalf needs multiple 1.2-wide X-segments the other way, so
    // long-edge-along-X should win here.
    const layout = chooseFlatSheetLayout(2.4, 3, 2.4, 1.2);
    expect(layout.xSegments).toEqual(tileCenteredClipped(2.4, 2.4));
    expect(layout.zRows).toEqual(tileFromEdgeClipped(3, 1.2));
  });

  it("returns no segments at all once the region has no width left to cover", () => {
    const layout = chooseFlatSheetLayout(0, 3, 2.4, 1.2);
    expect(layout.xSegments).toEqual([]);
  });
});
