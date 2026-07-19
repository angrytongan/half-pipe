import { describe, expect, it } from "vitest";
import { buildJoistBox } from "./joists";

describe("buildJoistBox", () => {
  it("sizes the cross-section as thickness (X) x depth (Y), spanning zStart to zEnd", () => {
    const joist = buildJoistBox(1, 2.5, 0.4, 0.6, 0.045, 0.09);
    joist.computeBoundingBox();
    const box = joist.boundingBox!;

    expect(box.max.x - box.min.x).toBeCloseTo(0.045, 6);
    expect(box.max.y - box.min.y).toBeCloseTo(0.09, 6);
    expect(box.max.z - box.min.z).toBeCloseTo(1.5, 6);
  });

  it("centers the box on (x, y) and on the midpoint of zStart/zEnd", () => {
    const joist = buildJoistBox(-2, 1, 0.4, 0.6, 0.045, 0.09);
    joist.computeBoundingBox();
    const box = joist.boundingBox!;

    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0.4, 6);
    expect((box.min.y + box.max.y) / 2).toBeCloseTo(0.6, 6);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(-0.5, 6);
  });
});
