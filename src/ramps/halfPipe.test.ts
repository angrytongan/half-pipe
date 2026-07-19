import { describe, expect, it } from "vitest";
import { buildHalfPipeGeometry, halfPipeCopingXs, halfPipeFootprint, HALF_PIPE_DEFAULTS } from "./halfPipe";

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
    const params = { ...HALF_PIPE_DEFAULTS, transitionAngleDeg: 90 };
    const geometry = buildHalfPipeGeometry(params);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.y).toBeCloseTo(params.radius, 2);
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
    // transitionAngleDeg/flatBottomLength pinned explicitly so this test's arithmetic
    // doesn't drift if HALF_PIPE_DEFAULTS' own values ever change.
    const params = { ...HALF_PIPE_DEFAULTS, transitionAngleDeg: 90, flatBottomLength: 3 };
    const geometry = buildHalfPipeGeometry(params);
    geometry.computeBoundingBox();
    const [leftX, rightX] = halfPipeCopingXs(params);

    expect(rightX).toBeCloseTo(3.3, 5); // half (1.5) + deckStart (radius=1.8)
    expect(leftX).toBeCloseTo(-3.3, 5);
    expect(rightX).toBeLessThan(geometry.boundingBox!.max.x);
    expect(leftX).toBeGreaterThan(geometry.boundingBox!.min.x);
  });
});

describe("halfPipeFootprint", () => {
  it("matches the built geometry's actual bounding box", () => {
    const geometry = buildHalfPipeGeometry(HALF_PIPE_DEFAULTS);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const footprint = halfPipeFootprint(HALF_PIPE_DEFAULTS);

    expect(footprint.length).toBeCloseTo(box.max.x - box.min.x, 5);
    expect(footprint.width).toBeCloseTo(box.max.z - box.min.z, 5);
    expect(footprint.height).toBeCloseTo(box.max.y - box.min.y, 5);
  });

  it("computes length/width/height at defaults", () => {
    const footprint = halfPipeFootprint(HALF_PIPE_DEFAULTS);
    // flatBottomLength (1.25) + 2 * (radius * sin(60deg) + deckLength) = 1.25 + 2 * (1.8*sin(60deg) + 0.6)
    expect(footprint.length).toBeCloseTo(5.5677, 4);
    expect(footprint.width).toBe(3);
    expect(footprint.height).toBeCloseTo(0.9, 5); // radius * (1 - cos(60deg))
  });

  it("grows length 1:1 with flatBottomLength, and width 1:1 with width", () => {
    const base = halfPipeFootprint(HALF_PIPE_DEFAULTS);
    const longer = halfPipeFootprint({ ...HALF_PIPE_DEFAULTS, flatBottomLength: HALF_PIPE_DEFAULTS.flatBottomLength + 2 });
    const wider = halfPipeFootprint({ ...HALF_PIPE_DEFAULTS, width: HALF_PIPE_DEFAULTS.width + 1 });

    expect(longer.length - base.length).toBeCloseTo(2, 5);
    expect(wider.width - base.width).toBeCloseTo(1, 5);
  });
});
