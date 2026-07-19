import { describe, expect, it } from "vitest";
import {
  buildHalfPipeFlatBottomSlab,
  buildHalfPipeGeometry,
  buildHalfPipeRibs,
  halfPipeCopingXs,
  halfPipeFootprint,
  HALF_PIPE_DEFAULTS,
} from "./halfPipe";
import { ribZPositions } from "./ribs";

describe("buildHalfPipeGeometry", () => {
  it("still touches the ground at the deck-side closing edges regardless of flatBottomThickness", () => {
    const geometry = buildHalfPipeGeometry(HALF_PIPE_DEFAULTS);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;

    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 5);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
  });

  it("reaches the transition radius plus flatBottomThickness as its height at a 90 degree sweep with no vert extension", () => {
    const params = { ...HALF_PIPE_DEFAULTS, transitionAngleDeg: 90 };
    const geometry = buildHalfPipeGeometry(params);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.y).toBeCloseTo(params.radius + params.flatBottomThicknessMm / 1000, 2);
  });

  it("grows max.y by exactly flatBottomThickness, with min.y unaffected", () => {
    const thin = buildHalfPipeGeometry({ ...HALF_PIPE_DEFAULTS, flatBottomThicknessMm: 50 });
    const thick = buildHalfPipeGeometry({ ...HALF_PIPE_DEFAULTS, flatBottomThicknessMm: 150 });
    thin.computeBoundingBox();
    thick.computeBoundingBox();

    expect(thin.boundingBox!.min.y).toBeCloseTo(0, 5);
    expect(thick.boundingBox!.min.y).toBeCloseTo(0, 5);
    expect(thick.boundingBox!.max.y - thin.boundingBox!.max.y).toBeCloseTo(0.1, 5);
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

describe("buildHalfPipeRibs", () => {
  it("returns one rib per ribZPositions(width, internalRibCount) entry, at those Z positions", () => {
    const params = { ...HALF_PIPE_DEFAULTS, width: 3.7 };
    const ribs = buildHalfPipeRibs(params);
    const positions = ribZPositions(params.width, params.internalRibCount);
    expect(ribs).toHaveLength(positions.length);

    ribs.forEach((rib, i) => {
      rib.computeBoundingBox();
      const box = rib.boundingBox!;
      expect((box.min.z + box.max.z) / 2).toBeCloseTo(positions[i], 5);
    });
  });

  it("matches the solid geometry's X and Y profile — same cross-section, just thin", () => {
    const solid = buildHalfPipeGeometry(HALF_PIPE_DEFAULTS);
    solid.computeBoundingBox();
    const solidBox = solid.boundingBox!;

    const ribs = buildHalfPipeRibs(HALF_PIPE_DEFAULTS);
    for (const rib of ribs) {
      rib.computeBoundingBox();
      const box = rib.boundingBox!;
      expect(box.min.x).toBeCloseTo(solidBox.min.x, 5);
      expect(box.max.x).toBeCloseTo(solidBox.max.x, 5);
      expect(box.min.y).toBeCloseTo(solidBox.min.y, 5);
      expect(box.max.y).toBeCloseTo(solidBox.max.y, 5);
    }
  });

  it("uses ribThicknessMm as each rib's Z-span", () => {
    const params = { ...HALF_PIPE_DEFAULTS, ribThicknessMm: 30 };
    const ribs = buildHalfPipeRibs(params);
    for (const rib of ribs) {
      rib.computeBoundingBox();
      const box = rib.boundingBox!;
      expect(box.max.z - box.min.z).toBeCloseTo(0.03, 5);
    }
  });

  it("produces more ribs as internalRibCount grows", () => {
    const few = buildHalfPipeRibs({ ...HALF_PIPE_DEFAULTS, internalRibCount: 0 });
    const many = buildHalfPipeRibs({ ...HALF_PIPE_DEFAULTS, internalRibCount: 5 });
    expect(many.length).toBeGreaterThan(few.length);
  });
});

describe("buildHalfPipeFlatBottomSlab", () => {
  it("spans flatBottomLength x width x flatBottomThickness, sitting on the ground", () => {
    const params = { ...HALF_PIPE_DEFAULTS, flatBottomLength: 2, width: 3, flatBottomThicknessMm: 100 };
    const slab = buildHalfPipeFlatBottomSlab(params);
    slab.computeBoundingBox();
    const box = slab.boundingBox!;

    expect(box.max.x - box.min.x).toBeCloseTo(2, 5);
    expect(box.max.z - box.min.z).toBeCloseTo(3, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(0.1, 5);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 5);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 5);
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
    // radius * (1 - cos(60deg)) + flatBottomThicknessMm / 1000 (90mm)
    expect(footprint.height).toBeCloseTo(0.99, 5);
  });

  it("grows length 1:1 with flatBottomLength, and width 1:1 with width", () => {
    const base = halfPipeFootprint(HALF_PIPE_DEFAULTS);
    const longer = halfPipeFootprint({ ...HALF_PIPE_DEFAULTS, flatBottomLength: HALF_PIPE_DEFAULTS.flatBottomLength + 2 });
    const wider = halfPipeFootprint({ ...HALF_PIPE_DEFAULTS, width: HALF_PIPE_DEFAULTS.width + 1 });

    expect(longer.length - base.length).toBeCloseTo(2, 5);
    expect(wider.width - base.width).toBeCloseTo(1, 5);
  });
});
