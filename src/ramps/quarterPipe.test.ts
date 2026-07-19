import { describe, expect, it } from "vitest";
import { buildQuarterPipeGeometry, quarterPipeCopingX, QUARTER_PIPE_DEFAULTS } from "./quarterPipe";

describe("buildQuarterPipeGeometry", () => {
  it("centers the footprint on X/Z and sits on Y=0", () => {
    const geometry = buildQuarterPipeGeometry(QUARTER_PIPE_DEFAULTS);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;

    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 5);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
  });

  it("reaches the transition radius as its height at a 90 degree sweep with no vert extension", () => {
    const geometry = buildQuarterPipeGeometry(QUARTER_PIPE_DEFAULTS);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.y).toBeCloseTo(QUARTER_PIPE_DEFAULTS.radius, 2);
  });

  it("adds vert extension height on top of the transition", () => {
    const geometry = buildQuarterPipeGeometry({ ...QUARTER_PIPE_DEFAULTS, vertHeight: 0.5 });
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.y).toBeCloseTo(QUARTER_PIPE_DEFAULTS.radius + 0.5, 2);
  });

  it("has the configured width along Z", () => {
    const geometry = buildQuarterPipeGeometry(QUARTER_PIPE_DEFAULTS);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.max.z - box.min.z).toBeCloseTo(QUARTER_PIPE_DEFAULTS.width, 5);
  });
});

describe("quarterPipeCopingX", () => {
  it("places the coping at the transition/deck boundary, inside the deck's outer edge", () => {
    const geometry = buildQuarterPipeGeometry(QUARTER_PIPE_DEFAULTS);
    geometry.computeBoundingBox();
    const copingX = quarterPipeCopingX(QUARTER_PIPE_DEFAULTS);

    expect(copingX).toBeCloseTo(0.6, 5); // deckStart (radius=1.8) - half the 2.4m total span
    expect(copingX).toBeLessThan(geometry.boundingBox!.max.x);
  });
});
