import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildBottomTransitionFrame,
  buildHalfPipeGeometry,
  buildHalfPipeJoists,
  buildHalfPipeRibs,
  halfPipeCopingCenters,
  halfPipeFootprint,
  HALF_PIPE_DEFAULTS,
} from "./halfPipe";
import { ribZPositions } from "./ribs";
import { CURVE_JOIST_SPACING_M } from "./joists";
import { transitionAndDeckPoints, transitionArcPoints } from "./transition";
import { copingNotch } from "./coping";

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

  it("ends each side at the bottommost curve joist's inside face, not its centerline — still doesn't bridge to the other side", () => {
    const half = HALF_PIPE_DEFAULTS.bottomTransitionLength / 2;
    const expectedBaseX = half - HALF_PIPE_DEFAULTS.joistThicknessMm / 1000 / 2;
    const geometry = buildHalfPipeGeometry(HALF_PIPE_DEFAULTS);
    const positions = geometry.getAttribute("position");
    let minGroundAbsX = Infinity;
    for (let i = 0; i < positions.count; i++) {
      expect(Math.abs(positions.getX(i))).toBeGreaterThanOrEqual(expectedBaseX - 1e-6); // never bridges to the other side
      if (Math.abs(positions.getY(i)) < 1e-6) minGroundAbsX = Math.min(minGroundAbsX, Math.abs(positions.getX(i)));
    }
    // the ground-level (y=0) closing edge is what actually moved — in to the joist's inside face
    expect(minGroundAbsX).toBeCloseTo(expectedBaseX, 5);
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

  it("ends each rib at the bottommost curve joist's inside face, not its centerline — still doesn't bridge to the other side", () => {
    const half = HALF_PIPE_DEFAULTS.bottomTransitionLength / 2;
    const expectedBaseX = half - HALF_PIPE_DEFAULTS.joistThicknessMm / 1000 / 2;
    for (const rib of buildHalfPipeRibs(HALF_PIPE_DEFAULTS)) {
      const positions = rib.getAttribute("position");
      let minGroundAbsX = Infinity;
      for (let i = 0; i < positions.count; i++) {
        expect(Math.abs(positions.getX(i))).toBeGreaterThanOrEqual(expectedBaseX - 1e-6); // never bridges to the other side
        if (Math.abs(positions.getY(i)) < 1e-6) minGroundAbsX = Math.min(minGroundAbsX, Math.abs(positions.getX(i)));
      }
      // the ground-level (y=0) closing edge is what actually moved — in to the joist's inside face
      expect(minGroundAbsX).toBeCloseTo(expectedBaseX, 5);
    }
  });

  it("doubles each seam into two adjacent ribs, one per build section", () => {
    const ribs = buildHalfPipeRibs({ ...HALF_PIPE_DEFAULTS, internalRibCount: 1 });
    expect(ribs).toHaveLength(4); // 2 edges + 1 doubled seam
  });
});

describe("buildHalfPipeRibs coping notch", () => {
  it("cuts the notch into the rib outline instead of meeting at a sharp deck/curve corner", () => {
    const params = HALF_PIPE_DEFAULTS;
    const jointDepth = params.joistDepthMm / 1000;
    const half = params.bottomTransitionLength / 2;
    const points = transitionAndDeckPoints(params.radius, params.transitionAngleDeg, params.vertHeight, params.deckLength);
    const notch = copingNotch(
      points,
      params.radius,
      params.copingOdMm / 1000 / 2,
      params.copingHorizontalProtrusionMm / 1000,
      params.copingVerticalProtrusionMm / 1000,
    );
    const wallBottomWorld = { x: half + notch.wallBottom[0], y: notch.wallBottom[1] + jointDepth };
    const shelfEndWorld = { x: half + notch.shelfEnd[0], y: notch.shelfEnd[1] + jointDepth };

    const ribs = buildHalfPipeRibs(params);
    const positions = ribs[ribs.length - 1].getAttribute("position");
    const hasVertexNear = (x: number, y: number) => {
      for (let i = 0; i < positions.count; i++) {
        if (Math.abs(positions.getX(i) - x) < 1e-6 && Math.abs(positions.getY(i) - y) < 1e-6) return true;
      }
      return false;
    };

    expect(hasVertexNear(wallBottomWorld.x, wallBottomWorld.y)).toBe(true);
    expect(hasVertexNear(shelfEndWorld.x, shelfEndWorld.y)).toBe(true);
  });
});

describe("buildBottomTransitionFrame", () => {
  it("returns 2 plates + (internalStudCount + 2) studs", () => {
    const params = { ...HALF_PIPE_DEFAULTS, internalStudCount: 4 };
    expect(buildBottomTransitionFrame(params)).toHaveLength(2 + 4 + 2);
  });

  it("produces more studs as internalStudCount grows", () => {
    const few = buildBottomTransitionFrame({ ...HALF_PIPE_DEFAULTS, internalStudCount: 0 });
    const many = buildBottomTransitionFrame({ ...HALF_PIPE_DEFAULTS, internalStudCount: 5 });
    expect(many.length - few.length).toBe(5);
  });

  it("spans joistDepth x width exactly (no overhang), and bottomTransitionLength minus the last curve joist's thickness — butting up against it, not into its midpoint", () => {
    const params = { ...HALF_PIPE_DEFAULTS, bottomTransitionLength: 2, width: 3, joistDepthMm: 100, ribThicknessMm: 20, joistThicknessMm: 40 };
    const pieces = buildBottomTransitionFrame(params);
    const overall = new THREE.Box3();
    for (const piece of pieces) {
      piece.computeBoundingBox();
      overall.union(piece.boundingBox!);
    }

    expect(overall.max.x - overall.min.x).toBeCloseTo(2 - 0.04, 5); // bottomTransitionLength - joistThicknessMm/1000
    expect(overall.max.y - overall.min.y).toBeCloseTo(0.1, 5);
    expect(overall.min.y).toBeCloseTo(0, 5);
    expect(overall.max.z - overall.min.z).toBeCloseTo(3, 5); // width — edge ribs are inset, no overhang
    expect((overall.min.x + overall.max.x) / 2).toBeCloseTo(0, 5);
    expect((overall.min.z + overall.max.z) / 2).toBeCloseTo(0, 5);
  });

  it("ends each plate at the last curve joist's inner face — the joist's own centerline is at bottomTransitionLength/2", () => {
    const params = { ...HALF_PIPE_DEFAULTS, bottomTransitionLength: 2.25, joistThicknessMm: 45 };
    const lastJoistCenterX = params.bottomTransitionLength / 2;
    const expectedPlateEndX = lastJoistCenterX - params.joistThicknessMm / 1000 / 2;

    const plates = buildBottomTransitionFrame(params).filter((piece) => {
      piece.computeBoundingBox();
      return piece.boundingBox!.max.x - piece.boundingBox!.min.x > piece.boundingBox!.max.z - piece.boundingBox!.min.z;
    });
    expect(plates).toHaveLength(2);
    for (const plate of plates) {
      const box = plate.boundingBox!;
      expect(box.max.x).toBeCloseTo(expectedPlateEndX, 5);
      expect(box.min.x).toBeCloseTo(-expectedPlateEndX, 5);
    }
  });

  it("insets each stud's Z-span to the plates' inside faces, not their centerlines or outside faces", () => {
    const params = { ...HALF_PIPE_DEFAULTS, width: 3, ribThicknessMm: 20, joistThicknessMm: 45 };
    const outsideZ = params.width / 2; // edge ribs are inset (see ribZPositions), no overhang
    const expectedStudSpan = 2 * (outsideZ - params.joistThicknessMm / 1000);

    const pieces = buildBottomTransitionFrame(params);
    const studs = pieces.filter((piece) => {
      piece.computeBoundingBox();
      return piece.boundingBox!.max.z - piece.boundingBox!.min.z > piece.boundingBox!.max.x - piece.boundingBox!.min.x;
    });
    expect(studs.length).toBeGreaterThan(0);
    for (const stud of studs) {
      const box = stud.boundingBox!;
      expect(box.max.z - box.min.z).toBeCloseTo(expectedStudSpan, 5);
    }
  });
});

describe("buildHalfPipeJoists", () => {
  it("produces the expected number of joists at defaults", () => {
    const { radius, transitionAngleDeg, internalRibCount } = HALF_PIPE_DEFAULTS;
    const curveArcLength = (radius * transitionAngleDeg * Math.PI) / 180;
    const curveSegments = Math.ceil(curveArcLength / CURVE_JOIST_SPACING_M);
    const curveInteriorCount = curveSegments - 1;
    const pointsPerSide = curveInteriorCount + 2; // bottom corner, curve interior, floor-section end — no deck/curve-corner joist (see features.md)
    const perSection = 2 * pointsPerSide; // both sides — no joist under the middle of the bottom transition
    const sections = internalRibCount + 1;

    expect(buildHalfPipeJoists(HALF_PIPE_DEFAULTS)).toHaveLength(perSection * sections);
  });

  it("adds exactly one section's worth of joists per extra internal rib, never doubling for the seam's own internal gap", () => {
    const base = buildHalfPipeJoists({ ...HALF_PIPE_DEFAULTS, internalRibCount: 1 });
    const more = buildHalfPipeJoists({ ...HALF_PIPE_DEFAULTS, internalRibCount: 2 });
    const perSection = base.length / 2; // internalRibCount 1 => 2 sections
    expect(more.length - base.length).toBe(perSection);
  });

  it("spans between the ribs' inside faces, not their centerlines, for every joist — never the seam's own internal gap", () => {
    const params = { ...HALF_PIPE_DEFAULTS, internalRibCount: 2 };
    const ribThickness = params.ribThicknessMm / 1000;
    const ribZs = ribZPositions(params.width, params.internalRibCount, ribThickness);
    const validSpans = new Set<number>();
    for (let i = 0; i < ribZs.length; i += 2) validSpans.add(Number((ribZs[i + 1] - ribZs[i] - ribThickness).toFixed(6)));

    for (const joist of buildHalfPipeJoists(params)) {
      joist.computeBoundingBox();
      const box = joist.boundingBox!;
      const span = Number((box.max.z - box.min.z).toFixed(6));
      expect(validSpans.has(span)).toBe(true);
    }
  });

  it("no longer includes a joist midway between the ramp ends (x=0) — the bottom-transition frame's stud wall covers that span instead", () => {
    const joists = buildHalfPipeJoists(HALF_PIPE_DEFAULTS);
    const atCenter = joists.some((joist) => {
      joist.computeBoundingBox();
      const box = joist.boundingBox!;
      return Math.abs((box.min.x + box.max.x) / 2) < 1e-9;
    });
    expect(atCenter).toBe(false);
  });

  it("sizes the flat landmarks (bottom corners) exactly joistThicknessMm (X) x joistDepthMm (Y)", () => {
    const params = { ...HALF_PIPE_DEFAULTS, joistThicknessMm: 60, joistDepthMm: 140 };
    const jointDepth = params.joistDepthMm / 1000;
    const flat = buildHalfPipeJoists(params).filter((joist) => {
      joist.computeBoundingBox();
      const topEdge = joist.boundingBox!.max.y; // unrotated joists anchor their top edge at jointDepth
      return Math.abs(topEdge - jointDepth) < 1e-6;
    });
    expect(flat.length).toBeGreaterThan(0);
    for (const joist of flat) {
      const box = joist.boundingBox!;
      expect(box.max.x - box.min.x).toBeCloseTo(0.06, 5);
      expect(box.max.y - box.min.y).toBeCloseTo(0.14, 5);
    }
  });

  it("tilts curve-interior joists to their local tangent angle instead of staying flat", () => {
    const params = HALF_PIPE_DEFAULTS;
    const thickness = params.joistThicknessMm / 1000;
    const depth = params.joistDepthMm / 1000;
    const jointDepth = params.joistDepthMm / 1000;
    const sweep = (params.transitionAngleDeg * Math.PI) / 180;

    const curveArcLength = params.radius * sweep;
    const curveSegments = Math.ceil(curveArcLength / CURVE_JOIST_SPACING_M);
    const curveInteriorPoints = transitionArcPoints(params.radius, params.transitionAngleDeg, curveSegments).slice(1, -1);
    const lastInteriorIndex = curveInteriorPoints.length - 1;
    const [localX, localY] = curveInteriorPoints[lastInteriorIndex];
    const angle = ((lastInteriorIndex + 1) / curveSegments) * sweep;

    const expectedX = thickness * Math.abs(Math.cos(angle)) + depth * Math.abs(Math.sin(angle));
    const expectedY = thickness * Math.abs(Math.sin(angle)) + depth * Math.abs(Math.cos(angle));

    const half = params.bottomTransitionLength / 2;
    const worldX = half + localX;
    const worldY = localY + jointDepth;
    // The box's center sits depth/2 back from the anchored top edge, along the rotated normal
    // (-sin(angle), cos(angle)) — see buildJoistBox's own doc comment.
    const expectedCenterX = worldX + Math.sin(angle) * (depth / 2);
    const expectedCenterY = worldY - Math.cos(angle) * (depth / 2);

    const curveJoist = buildHalfPipeJoists(params).find((joist) => {
      joist.computeBoundingBox();
      const box = joist.boundingBox!;
      const x = (box.min.x + box.max.x) / 2;
      const y = (box.min.y + box.max.y) / 2;
      return Math.abs(x - expectedCenterX) < 1e-6 && Math.abs(y - expectedCenterY) < 1e-6;
    });

    expect(curveJoist).toBeDefined();
    const box = curveJoist!.boundingBox!;
    expect(box.max.x - box.min.x).toBeCloseTo(expectedX, 5);
    expect(box.max.y - box.min.y).toBeCloseTo(expectedY, 5);
  });

  it("no longer includes a joist at the deck/curve corner (deck start) — it intersected the deck; see features.md", () => {
    const params = HALF_PIPE_DEFAULTS;
    const depth = params.joistDepthMm / 1000;
    const jointDepth = params.joistDepthMm / 1000;
    const sweep = (params.transitionAngleDeg * Math.PI) / 180;
    const half = params.bottomTransitionLength / 2;
    const points = transitionAndDeckPoints(params.radius, params.transitionAngleDeg, params.vertHeight, params.deckLength);
    const [deckStartX, deckStartY] = points[points.length - 2];
    const deckStartWorldX = half + deckStartX;
    const deckStartWorldY = deckStartY + jointDepth;
    // Same anchor-to-center formula the removed joist would have used (see the tilt test above).
    const expectedCenterX = deckStartWorldX + Math.sin(sweep) * (depth / 2);
    const expectedCenterY = deckStartWorldY - Math.cos(sweep) * (depth / 2);

    const atDeckStart = buildHalfPipeJoists(params).some((joist) => {
      joist.computeBoundingBox();
      const box = joist.boundingBox!;
      const x = (box.min.x + box.max.x) / 2;
      const y = (box.min.y + box.max.y) / 2;
      return Math.abs(x - expectedCenterX) < 1e-6 && Math.abs(y - expectedCenterY) < 1e-6;
    });
    expect(atDeckStart).toBe(false);
  });

  it("insets the deck-outer joist so its external face aligns with the rib's own edge, not centered on it", () => {
    const params = HALF_PIPE_DEFAULTS;
    const half = params.bottomTransitionLength / 2;
    const points = transitionAndDeckPoints(params.radius, params.transitionAngleDeg, params.vertHeight, params.deckLength);
    const [deckOuterX, deckOuterY] = points[points.length - 1];
    const jointDepth = params.joistDepthMm / 1000;
    const deckOuterWorldY = deckOuterY + jointDepth;
    const deckOuterWorldXRight = half + deckOuterX; // where the rib's outline actually ends

    const joists = buildHalfPipeJoists(params).filter((joist) => {
      joist.computeBoundingBox();
      // unrotated (angle=0), so the top-anchored face is the box's max.y directly.
      return Math.abs(joist.boundingBox!.max.y - deckOuterWorldY) < 1e-6;
    });
    const rightJoist = joists.find((joist) => (joist.boundingBox!.min.x + joist.boundingBox!.max.x) / 2 > 0);
    const leftJoist = joists.find((joist) => (joist.boundingBox!.min.x + joist.boundingBox!.max.x) / 2 < 0);
    expect(rightJoist).toBeDefined();
    expect(leftJoist).toBeDefined();

    // external (outward-facing) face flush with the rib's edge — not straddling it
    expect(rightJoist!.boundingBox!.max.x).toBeCloseTo(deckOuterWorldXRight, 6);
    expect(leftJoist!.boundingBox!.min.x).toBeCloseTo(-deckOuterWorldXRight, 6);
  });
});

describe("halfPipeCopingCenters", () => {
  it("centers coping at the notch's pipe center on each side, inside the decks' outer edges", () => {
    // transitionAngleDeg/bottomTransitionLength pinned explicitly so this test's arithmetic
    // doesn't drift if HALF_PIPE_DEFAULTS' own values ever change.
    const params = { ...HALF_PIPE_DEFAULTS, transitionAngleDeg: 90, bottomTransitionLength: 3 };
    const geometry = buildHalfPipeGeometry(params);
    geometry.computeBoundingBox();

    const half = params.bottomTransitionLength / 2;
    const jointDepth = params.joistDepthMm / 1000;
    const points = transitionAndDeckPoints(params.radius, params.transitionAngleDeg, params.vertHeight, params.deckLength);
    const notch = copingNotch(
      points,
      params.radius,
      params.copingOdMm / 1000 / 2,
      params.copingHorizontalProtrusionMm / 1000,
      params.copingVerticalProtrusionMm / 1000,
    );
    const [cx, cy] = notch.pipeCenter;
    const expectedY = cy + jointDepth;

    const [left, right] = halfPipeCopingCenters(params);
    expect(right.x).toBeCloseTo(half + cx, 6);
    expect(left.x).toBeCloseTo(-(half + cx), 6);
    expect(right.y).toBeCloseTo(expectedY, 6);
    expect(left.y).toBeCloseTo(expectedY, 6);
    expect(right.x).toBeLessThan(geometry.boundingBox!.max.x);
    expect(left.x).toBeGreaterThan(geometry.boundingBox!.min.x);
  });
});

describe("halfPipeFootprint", () => {
  it("matches the built solid geometry's actual length/height", () => {
    const geometry = buildHalfPipeGeometry(HALF_PIPE_DEFAULTS);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const footprint = halfPipeFootprint(HALF_PIPE_DEFAULTS);

    expect(footprint.length).toBeCloseTo(box.max.x - box.min.x, 5);
    expect(footprint.height).toBeCloseTo(box.max.y - box.min.y, 5);
  });

  it("matches what's actually rendered (the ribs') combined width, not the solid wedge's — edge ribs stick out beyond it", () => {
    const ribs = buildHalfPipeRibs(HALF_PIPE_DEFAULTS);
    const overall = new THREE.Box3();
    for (const rib of ribs) {
      rib.computeBoundingBox();
      overall.union(rib.boundingBox!);
    }
    const footprint = halfPipeFootprint(HALF_PIPE_DEFAULTS);

    expect(footprint.width).toBeCloseTo(overall.max.z - overall.min.z, 5);
  });

  it("computes length/width/height at defaults", () => {
    const footprint = halfPipeFootprint(HALF_PIPE_DEFAULTS);
    // bottomTransitionLength (2.25) + 2 * (radius * sin(57deg) + deckLength) = 2.25 + 2 * (1.8*sin(57deg) + 0.3)
    expect(footprint.length).toBeCloseTo(5.8692, 4);
    // width param directly — edge ribs are inset (see ribZPositions), so no overhang past it
    expect(footprint.width).toBeCloseTo(3, 5);
    // radius * (1 - cos(57deg)) + joistDepthMm / 1000 (90mm)
    expect(footprint.height).toBeCloseTo(0.90965, 5);
  });

  it("grows length 1:1 with bottomTransitionLength, and width 1:1 with width", () => {
    const base = halfPipeFootprint(HALF_PIPE_DEFAULTS);
    const longer = halfPipeFootprint({ ...HALF_PIPE_DEFAULTS, bottomTransitionLength: HALF_PIPE_DEFAULTS.bottomTransitionLength + 2 });
    const wider = halfPipeFootprint({ ...HALF_PIPE_DEFAULTS, width: HALF_PIPE_DEFAULTS.width + 1 });

    expect(longer.length - base.length).toBeCloseTo(2, 5);
    expect(wider.width - base.width).toBeCloseTo(1, 5);
  });
});
