import { describe, expect, it } from "vitest";
import { buildLinearDimension2D, type Point } from "./svgDimension";

describe("buildLinearDimension2D", () => {
  const start: Point = [0, 0];
  const end: Point = [3, 0];
  const offsetDir: Point = [0, -1];

  it("offsets extension lines from the measured points to the dimension line", () => {
    const dim = buildLinearDimension2D(start, end, offsetDir, 0.5, 0.1, 0.05);
    expect(dim.extensionLineA).toEqual([start, [0, -0.5]]);
    expect(dim.extensionLineB).toEqual([end, [3, -0.5]]);
    expect(dim.dimensionLine).toEqual([
      [0, -0.5],
      [3, -0.5],
    ]);
  });

  it("points both arrowheads outward, tips at the offset start/end", () => {
    const dim = buildLinearDimension2D(start, end, offsetDir, 0.5, 0.1, 0.05);
    expect(dim.arrowA[0]).toEqual([0, -0.5]);
    expect(dim.arrowB[0]).toEqual([3, -0.5]);
    // Arrow bases sit inward (toward the opposite end) from their own tip.
    expect(dim.arrowA[1][0]).toBeGreaterThan(0);
    expect(dim.arrowB[1][0]).toBeLessThan(3);
  });

  it("places the label at the midpoint of the offset dimension line, nudged further out", () => {
    const dim = buildLinearDimension2D(start, end, offsetDir, 0.5, 0.1, 0.05);
    expect(dim.labelPosition[0]).toBeCloseTo(1.5, 5);
    expect(dim.labelPosition[1]).toBeLessThan(-0.5);
  });

  it("normalizes a non-unit offset direction", () => {
    const dim = buildLinearDimension2D(start, end, [0, -5], 0.5, 0.1, 0.05);
    expect(dim.dimensionLine[0][1]).toBeCloseTo(-0.5, 5);
  });
});
