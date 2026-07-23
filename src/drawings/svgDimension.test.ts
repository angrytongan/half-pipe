import { describe, expect, it } from "vitest";
import { buildLinearDimension2D, type Point } from "./svgDimension";

describe("buildLinearDimension2D", () => {
  const start: Point = [0, 0];
  const end: Point = [3, 0];
  const offsetDir: Point = [0, -1];

  it("starts extension lines startGap away from the measured points, not at them", () => {
    const dim = buildLinearDimension2D(start, end, offsetDir, 0.5, 0.1, 0.05, 0.05, 0.2);
    expect(dim.extensionLineA).toEqual([[0, -0.05], [0, -0.5]]);
    expect(dim.extensionLineB).toEqual([[3, -0.05], [3, -0.5]]);
    expect(dim.dimensionLine).toEqual([
      [0, -0.5],
      [3, -0.5],
    ]);
  });

  it("points both arrowheads outward, tips at the offset start/end", () => {
    const dim = buildLinearDimension2D(start, end, offsetDir, 0.5, 0.1, 0.05, 0.05, 0.2);
    expect(dim.arrowA[0]).toEqual([0, -0.5]);
    expect(dim.arrowB[0]).toEqual([3, -0.5]);
    // Arrow bases sit inward (toward the opposite end) from their own tip.
    expect(dim.arrowA[1][0]).toBeGreaterThan(0);
    expect(dim.arrowB[1][0]).toBeLessThan(3);
  });

  it("places the label at the midpoint of the offset dimension line, nudged further out by labelGap", () => {
    const dim = buildLinearDimension2D(start, end, offsetDir, 0.5, 0.1, 0.05, 0.05, 0.2);
    expect(dim.labelPosition[0]).toBeCloseTo(1.5, 5);
    expect(dim.labelPosition[1]).toBeCloseTo(-0.7, 5); // -offsetDistance - labelGap, since offsetDir is [0,-1]
  });

  it("keeps labelGap constant regardless of offsetDistance, unlike a proportional nudge", () => {
    const near = buildLinearDimension2D(start, end, offsetDir, 0.05, 0.1, 0.05, 0.02, 0.2);
    const far = buildLinearDimension2D(start, end, offsetDir, 5, 0.1, 0.05, 0.02, 0.2);
    const gapNear = near.dimensionLine[0][1] - near.labelPosition[1];
    const gapFar = far.dimensionLine[0][1] - far.labelPosition[1];
    expect(gapNear).toBeCloseTo(gapFar, 5);
  });

  it("normalizes a non-unit offset direction", () => {
    const dim = buildLinearDimension2D(start, end, [0, -5], 0.5, 0.1, 0.05, 0.05, 0.2);
    expect(dim.dimensionLine[0][1]).toBeCloseTo(-0.5, 5);
  });
});
