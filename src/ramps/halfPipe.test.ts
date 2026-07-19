import { describe, expect, it } from "vitest";
import { buildHalfPipeGeometry, halfPipeCopingXs, HALF_PIPE_DEFAULTS } from "./halfPipe";

describe("buildHalfPipeGeometry", () => {
  it("centers the footprint on X/Z and sits on Y=0", () => {
    const geometry = buildHalfPipeGeometry(HALF_PIPE_DEFAULTS);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;

    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 5);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
  });

  it("reaches the transition radius as its height at a 90 degree sweep with no vert extension", () => {
    const geometry = buildHalfPipeGeometry(HALF_PIPE_DEFAULTS);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.y).toBeCloseTo(HALF_PIPE_DEFAULTS.radius, 2);
  });

  it("widens along X as the flat bottom grows", () => {
    const narrow = buildHalfPipeGeometry({ ...HALF_PIPE_DEFAULTS, flatBottomLength: 1 });
    const wide = buildHalfPipeGeometry({ ...HALF_PIPE_DEFAULTS, flatBottomLength: 5 });
    narrow.computeBoundingBox();
    wide.computeBoundingBox();
    const narrowSpan = narrow.boundingBox!.max.x - narrow.boundingBox!.min.x;
    const wideSpan = wide.boundingBox!.max.x - wide.boundingBox!.min.x;
    expect(wideSpan - narrowSpan).toBeCloseTo(4, 2);
  });
});

describe("halfPipeCopingXs", () => {
  it("places coping at each transition/deck boundary, inside the decks' outer edges", () => {
    const geometry = buildHalfPipeGeometry(HALF_PIPE_DEFAULTS);
    geometry.computeBoundingBox();
    const [leftX, rightX] = halfPipeCopingXs(HALF_PIPE_DEFAULTS);

    expect(rightX).toBeCloseTo(3.3, 5); // half (1.5) + deckStart (radius=1.8)
    expect(leftX).toBeCloseTo(-3.3, 5);
    expect(rightX).toBeLessThan(geometry.boundingBox!.max.x);
    expect(leftX).toBeGreaterThan(geometry.boundingBox!.min.x);
  });
});
