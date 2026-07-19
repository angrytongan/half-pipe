import { describe, expect, it } from "vitest";
import {
  buildBottomTransitionSlab,
  buildHalfPipeGeometry,
  buildHalfPipeJoists,
  buildHalfPipeRibs,
  halfPipeCopingXs,
  halfPipeFootprint,
  HALF_PIPE_DEFAULTS,
} from "./halfPipe";
import { ribZPositions } from "./ribs";
import { CURVE_JOIST_SPACING_M } from "./joists";

describe("buildHalfPipeGeometry", () => {
  it("still touches the ground at the deck-side closing edges regardless of joistDepth", () => {
    const geometry = buildHalfPipeGeometry(HALF_PIPE_DEFAULTS);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;

    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 5);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
  });

  it("reaches the transition radius plus joistDepth as its height at a 90 degree sweep with no vert extension", () => {
    const params = { ...HALF_PIPE_DEFAULTS, transitionAngleDeg: 90 };
    const geometry = buildHalfPipeGeometry(params);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.y).toBeCloseTo(params.radius + params.joistDepthMm / 1000, 2);
  });

  it("grows max.y by exactly joistDepth, with min.y unaffected", () => {
    const thin = buildHalfPipeGeometry({ ...HALF_PIPE_DEFAULTS, joistDepthMm: 50 });
    const thick = buildHalfPipeGeometry({ ...HALF_PIPE_DEFAULTS, joistDepthMm: 150 });
    thin.computeBoundingBox();
    thick.computeBoundingBox();

    expect(thin.boundingBox!.min.y).toBeCloseTo(0, 5);
    expect(thick.boundingBox!.min.y).toBeCloseTo(0, 5);
    expect(thick.boundingBox!.max.y - thin.boundingBox!.max.y).toBeCloseTo(0.1, 5);
  });

  it("widens along X as the bottom transition grows", () => {
    const narrow = buildHalfPipeGeometry({ ...HALF_PIPE_DEFAULTS, bottomTransitionLength: 1 });
    const wide = buildHalfPipeGeometry({ ...HALF_PIPE_DEFAULTS, bottomTransitionLength: 5 });
    narrow.computeBoundingBox();
    wide.computeBoundingBox();
    const narrowSpan = narrow.boundingBox!.max.x - narrow.boundingBox!.min.x;
    const wideSpan = wide.boundingBox!.max.x - wide.boundingBox!.min.x;
    expect(wideSpan - narrowSpan).toBeCloseTo(4, 2);
  });
});

describe("buildHalfPipeRibs", () => {
  it("returns one rib per ribZPositions(width, internalRibCount, ribThickness) entry, at those Z positions", () => {
    const params = { ...HALF_PIPE_DEFAULTS, width: 3.7 };
    const ribs = buildHalfPipeRibs(params);
    const positions = ribZPositions(params.width, params.internalRibCount, params.ribThicknessMm / 1000);
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

  it("doubles each seam into two adjacent ribs, one per build section", () => {
    const ribs = buildHalfPipeRibs({ ...HALF_PIPE_DEFAULTS, internalRibCount: 1 });
    expect(ribs).toHaveLength(4); // 2 edges + 1 doubled seam
  });
});

describe("buildBottomTransitionSlab", () => {
  it("spans bottomTransitionLength x width x joistDepth, sitting on the ground", () => {
    const params = { ...HALF_PIPE_DEFAULTS, bottomTransitionLength: 2, width: 3, joistDepthMm: 100 };
    const slab = buildBottomTransitionSlab(params);
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

describe("buildHalfPipeJoists", () => {
  it("produces the expected number of joists at defaults", () => {
    const { radius, transitionAngleDeg, internalRibCount } = HALF_PIPE_DEFAULTS;
    const curveArcLength = (radius * transitionAngleDeg * Math.PI) / 180;
    const curveSegments = Math.ceil(curveArcLength / CURVE_JOIST_SPACING_M);
    const curveInteriorCount = curveSegments - 1;
    const pointsPerSide = curveInteriorCount + 3; // bottom corner, curve interior, top corner, floor-section end
    const perSection = 2 * pointsPerSide + 1; // both sides, plus the equidistant joist
    const sections = internalRibCount + 1;

    expect(buildHalfPipeJoists(HALF_PIPE_DEFAULTS)).toHaveLength(perSection * sections);
  });

  it("adds exactly one section's worth of joists per extra internal rib, never doubling for the seam's own internal gap", () => {
    const base = buildHalfPipeJoists({ ...HALF_PIPE_DEFAULTS, internalRibCount: 1 });
    const more = buildHalfPipeJoists({ ...HALF_PIPE_DEFAULTS, internalRibCount: 2 });
    const perSection = base.length / 2; // internalRibCount 1 => 2 sections
    expect(more.length - base.length).toBe(perSection);
  });

  it("spans exactly one section's rib-to-rib gap in Z for every joist — never the seam's own internal gap", () => {
    const params = { ...HALF_PIPE_DEFAULTS, internalRibCount: 2 };
    const ribThickness = params.ribThicknessMm / 1000;
    const ribZs = ribZPositions(params.width, params.internalRibCount, ribThickness);
    const validSpans = new Set<number>();
    for (let i = 0; i < ribZs.length; i += 2) validSpans.add(Number((ribZs[i + 1] - ribZs[i]).toFixed(6)));

    for (const joist of buildHalfPipeJoists(params)) {
      joist.computeBoundingBox();
      const box = joist.boundingBox!;
      const span = Number((box.max.z - box.min.z).toFixed(6));
      expect(validSpans.has(span)).toBe(true);
    }
  });

  it("includes one joist centered at x=0, equidistant between the two bottom corners", () => {
    const joists = buildHalfPipeJoists(HALF_PIPE_DEFAULTS);
    const atCenter = joists.some((joist) => {
      joist.computeBoundingBox();
      const box = joist.boundingBox!;
      return Math.abs((box.min.x + box.max.x) / 2) < 1e-9;
    });
    expect(atCenter).toBe(true);
  });

  it("sizes every joist's cross-section from joistThicknessMm (X) and joistDepthMm (Y)", () => {
    const params = { ...HALF_PIPE_DEFAULTS, joistThicknessMm: 60, joistDepthMm: 140 };
    for (const joist of buildHalfPipeJoists(params)) {
      joist.computeBoundingBox();
      const box = joist.boundingBox!;
      expect(box.max.x - box.min.x).toBeCloseTo(0.06, 5);
      expect(box.max.y - box.min.y).toBeCloseTo(0.14, 5);
    }
  });
});

describe("halfPipeCopingXs", () => {
  it("places coping at each transition/deck boundary, inside the decks' outer edges", () => {
    // transitionAngleDeg/bottomTransitionLength pinned explicitly so this test's arithmetic
    // doesn't drift if HALF_PIPE_DEFAULTS' own values ever change.
    const params = { ...HALF_PIPE_DEFAULTS, transitionAngleDeg: 90, bottomTransitionLength: 3 };
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
    // bottomTransitionLength (1.25) + 2 * (radius * sin(60deg) + deckLength) = 1.25 + 2 * (1.8*sin(60deg) + 0.6)
    expect(footprint.length).toBeCloseTo(5.5677, 4);
    expect(footprint.width).toBe(3);
    // radius * (1 - cos(60deg)) + joistDepthMm / 1000 (90mm)
    expect(footprint.height).toBeCloseTo(0.99, 5);
  });

  it("grows length 1:1 with bottomTransitionLength, and width 1:1 with width", () => {
    const base = halfPipeFootprint(HALF_PIPE_DEFAULTS);
    const longer = halfPipeFootprint({ ...HALF_PIPE_DEFAULTS, bottomTransitionLength: HALF_PIPE_DEFAULTS.bottomTransitionLength + 2 });
    const wider = halfPipeFootprint({ ...HALF_PIPE_DEFAULTS, width: HALF_PIPE_DEFAULTS.width + 1 });

    expect(longer.length - base.length).toBeCloseTo(2, 5);
    expect(wider.width - base.width).toBeCloseTo(1, 5);
  });
});
