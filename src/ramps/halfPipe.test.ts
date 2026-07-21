import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildBottomTransitionFrame,
  buildHalfPipeDeck,
  buildHalfPipeGeometry,
  buildHalfPipeJoists,
  buildHalfPipeJoistsBySection,
  buildHalfPipeRibs,
  buildHalfPipeRibsBySection,
  curveInteriorJoistLocalPoints,
  halfPipeCopingCenters,
  halfPipeFootprint,
  HALF_PIPE_DEFAULTS,
} from "./halfPipe";
import { ribZPositions } from "./ribs";
import { transitionAndDeckPoints } from "./transition";
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

describe("buildHalfPipeRibsBySection", () => {
  it("splits the same ribs buildHalfPipeRibs returns into edgeRibs + internalRibs, with no overlap", () => {
    const params = { ...HALF_PIPE_DEFAULTS, internalRibCount: 2 };
    const { edgeRibs, internalRibs } = buildHalfPipeRibsBySection(params);
    expect(edgeRibs.length + internalRibs.length).toBe(buildHalfPipeRibs(params).length);
  });

  it("always puts exactly 2 ribs in edgeRibs, regardless of internalRibCount", () => {
    expect(buildHalfPipeRibsBySection({ ...HALF_PIPE_DEFAULTS, internalRibCount: 0 }).edgeRibs).toHaveLength(2);
    expect(buildHalfPipeRibsBySection({ ...HALF_PIPE_DEFAULTS, internalRibCount: 5 }).edgeRibs).toHaveLength(2);
  });

  it("puts 2 ribs per seam in internalRibs", () => {
    const { internalRibs } = buildHalfPipeRibsBySection({ ...HALF_PIPE_DEFAULTS, internalRibCount: 3 });
    expect(internalRibs).toHaveLength(6);
  });

  it("edgeRibs sit at the outermost Z positions, internalRibs at the rest", () => {
    const params = { ...HALF_PIPE_DEFAULTS, internalRibCount: 2, width: 3.7 };
    const positions = ribZPositions(params.width, params.internalRibCount, params.ribThicknessMm / 1000);
    const { edgeRibs, internalRibs } = buildHalfPipeRibsBySection(params);

    const zOf = (rib: THREE.BufferGeometry): number => {
      rib.computeBoundingBox();
      const box = rib.boundingBox!;
      return (box.min.z + box.max.z) / 2;
    };
    const expectedEdgeZs = [positions[0], positions[positions.length - 1]].sort((a, b) => a - b);
    const actualEdgeZs = edgeRibs.map(zOf).sort((a, b) => a - b);
    actualEdgeZs.forEach((z, i) => expect(z).toBeCloseTo(expectedEdgeZs[i], 5));

    const expectedInternalZs = positions.slice(1, -1).sort((a, b) => a - b);
    const actualInternalZs = internalRibs.map(zOf).sort((a, b) => a - b);
    actualInternalZs.forEach((z, i) => expect(z).toBeCloseTo(expectedInternalZs[i], 5));
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
      params.ribThicknessMm / 1000,
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
    const { internalRibCount, internalCurveJoistCount } = HALF_PIPE_DEFAULTS;
    const pointsPerSide = internalCurveJoistCount + 6; // bottom corner, curve interior, notch-shelf, floor-section end, notch-wall (deck-inner), ground below floor-section end, ground midpoint
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

  it("adds exactly two joists per side (both sections) per extra internal curve joist", () => {
    const base = buildHalfPipeJoists({ ...HALF_PIPE_DEFAULTS, internalCurveJoistCount: 3 });
    const more = buildHalfPipeJoists({ ...HALF_PIPE_DEFAULTS, internalCurveJoistCount: 4 });
    const sections = HALF_PIPE_DEFAULTS.internalRibCount + 1;
    expect(more.length - base.length).toBe(2 * sections); // both sides
  });

  it("still builds only the bottom-corner, notch-shelf, deck-outer, deck-inner, ground-below-deck-outer, and ground-midpoint landmarks when internalCurveJoistCount is 0", () => {
    const params = { ...HALF_PIPE_DEFAULTS, internalCurveJoistCount: 0 };
    const sections = params.internalRibCount + 1;
    const pointsPerSide = 6; // bottom corner, notch-shelf, floor-section end, notch-wall (deck-inner), ground below it, ground midpoint — no curve interior
    expect(buildHalfPipeJoists(params)).toHaveLength(2 * pointsPerSide * sections);
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

    const points = transitionAndDeckPoints(params.radius, params.transitionAngleDeg, params.vertHeight, params.deckLength);
    const notch = copingNotch(
      points,
      params.radius,
      params.copingOdMm / 1000 / 2,
      params.copingHorizontalProtrusionMm / 1000,
      params.copingVerticalProtrusionMm / 1000,
      params.ribThicknessMm / 1000,
    );
    const edgeAngle = thickness / 2 / params.radius;
    const curveStartAngle = edgeAngle;
    const curveEndAngle = notch.shelfAngle - edgeAngle;
    const curveSegments = params.internalCurveJoistCount + 1;
    const lastInteriorIndex = params.internalCurveJoistCount - 1;
    const angle = curveStartAngle + ((curveEndAngle - curveStartAngle) * (lastInteriorIndex + 1)) / curveSegments;
    const localX = params.radius * Math.sin(angle);
    const localY = params.radius * (1 - Math.cos(angle));

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

  it("spaces curve joists evenly by arc length between the bottom-most joist's inside edge and the topmost joist's bottom edge", () => {
    const params = { ...HALF_PIPE_DEFAULTS, internalCurveJoistCount: 5 };
    const thickness = params.joistThicknessMm / 1000;
    const depth = params.joistDepthMm / 1000;
    const jointDepth = params.joistDepthMm / 1000;
    const half = params.bottomTransitionLength / 2;

    const points = transitionAndDeckPoints(params.radius, params.transitionAngleDeg, params.vertHeight, params.deckLength);
    const notch = copingNotch(
      points,
      params.radius,
      params.copingOdMm / 1000 / 2,
      params.copingHorizontalProtrusionMm / 1000,
      params.copingVerticalProtrusionMm / 1000,
      params.ribThicknessMm / 1000,
    );
    const edgeAngle = thickness / 2 / params.radius;
    const curveStartAngle = edgeAngle; // bottom-most joist's inside edge
    const curveEndAngle = notch.shelfAngle - edgeAngle; // topmost joist's bottom edge
    const curveSegments = params.internalCurveJoistCount + 1;

    // Every gap — start edge to first joist, joist to joist, last joist to end edge — must be
    // identical: (curveEndAngle - curveStartAngle) split into curveSegments equal pieces.
    const expectedGap = (curveEndAngle - curveStartAngle) / curveSegments;
    const angles = Array.from({ length: params.internalCurveJoistCount }, (_, i) => curveStartAngle + expectedGap * (i + 1));
    const gaps = [angles[0] - curveStartAngle, ...angles.slice(1).map((a, i) => a - angles[i]), curveEndAngle - angles[angles.length - 1]];
    for (const gap of gaps) expect(gap).toBeCloseTo(expectedGap, 10);

    const joists = buildHalfPipeJoists(params);
    for (const angle of angles) {
      const localX = params.radius * Math.sin(angle);
      const localY = params.radius * (1 - Math.cos(angle));
      for (const mirror of [1, -1]) {
        const worldX = mirror * (half + localX);
        const worldY = localY + jointDepth;
        const jointAngle = mirror * angle;
        const expectedCenterX = worldX + Math.sin(jointAngle) * (depth / 2);
        const expectedCenterY = worldY - Math.cos(jointAngle) * (depth / 2);

        const found = joists.some((joist) => {
          joist.computeBoundingBox();
          const box = joist.boundingBox!;
          const x = (box.min.x + box.max.x) / 2;
          const y = (box.min.y + box.max.y) / 2;
          return Math.abs(x - expectedCenterX) < 1e-6 && Math.abs(y - expectedCenterY) < 1e-6;
        });
        expect(found).toBe(true);
      }
    }
  });

  it("anchors the topmost curve joist at the coping notch's own shelf point, tilted to match", () => {
    const params = HALF_PIPE_DEFAULTS;
    const thickness = params.joistThicknessMm / 1000;
    const depth = params.joistDepthMm / 1000;
    const jointDepth = params.joistDepthMm / 1000;
    const half = params.bottomTransitionLength / 2;

    const points = transitionAndDeckPoints(params.radius, params.transitionAngleDeg, params.vertHeight, params.deckLength);
    const notch = copingNotch(
      points,
      params.radius,
      params.copingOdMm / 1000 / 2,
      params.copingHorizontalProtrusionMm / 1000,
      params.copingVerticalProtrusionMm / 1000,
      params.ribThicknessMm / 1000,
    );
    const angle = notch.shelfAngle;
    // Inset backward along the tangent by half the thickness — see buildHalfPipeJoists — so the
    // *notch-side* corner, not the center, lands on shelfEnd.
    const localX = notch.shelfEnd[0] - (thickness / 2) * Math.cos(angle);
    const localY = notch.shelfEnd[1] - (thickness / 2) * Math.sin(angle);

    const expectedX = thickness * Math.abs(Math.cos(angle)) + depth * Math.abs(Math.sin(angle));
    const expectedY = thickness * Math.abs(Math.sin(angle)) + depth * Math.abs(Math.cos(angle));

    for (const mirror of [1, -1]) {
      const worldX = mirror * (half + localX);
      const worldY = localY + jointDepth;
      const jointAngle = mirror * angle;
      const expectedCenterX = worldX + Math.sin(jointAngle) * (depth / 2);
      const expectedCenterY = worldY - Math.cos(jointAngle) * (depth / 2);

      const shelfJoist = buildHalfPipeJoists(params).find((joist) => {
        joist.computeBoundingBox();
        const box = joist.boundingBox!;
        const x = (box.min.x + box.max.x) / 2;
        const y = (box.min.y + box.max.y) / 2;
        return Math.abs(x - expectedCenterX) < 1e-6 && Math.abs(y - expectedCenterY) < 1e-6;
      });

      expect(shelfJoist).toBeDefined();
      const box = shelfJoist!.boundingBox!;
      expect(box.max.x - box.min.x).toBeCloseTo(expectedX, 5);
      expect(box.max.y - box.min.y).toBeCloseTo(expectedY, 5);
    }
  });

  it("lands the topmost curve joist's notch-side top corner exactly on the coping notch's shelfEnd", () => {
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
      params.ribThicknessMm / 1000,
    );
    const [shelfX, shelfY] = notch.shelfEnd;
    const worldY = shelfY + jointDepth;

    const joists = buildHalfPipeJoists(params);
    for (const worldX of [half + shelfX, -(half + shelfX)]) {
      const hasVertexAtCorner = joists.some((joist) => {
        const position = joist.getAttribute("position");
        for (let i = 0; i < position.count; i++) {
          if (Math.abs(position.getX(i) - worldX) < 1e-6 && Math.abs(position.getY(i) - worldY) < 1e-6) return true;
        }
        return false;
      });
      expect(hasVertexAtCorner).toBe(true);
    }
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

  it("adds a flat, ground-touching joist directly beneath the deck-outer one, at the same X", () => {
    const params = HALF_PIPE_DEFAULTS;
    const half = params.bottomTransitionLength / 2;
    const jointDepth = params.joistDepthMm / 1000;
    const points = transitionAndDeckPoints(params.radius, params.transitionAngleDeg, params.vertHeight, params.deckLength);
    const [deckOuterX] = points[points.length - 1];
    const deckOuterWorldXRight = half + deckOuterX; // where the rib's outline actually ends

    // Ground-touching (angle 0, y=0..jointDepth) rules out everything but the bottom-corner
    // joist and this new one; matching the deck-outer joist's own external face (below) then
    // singles out this one specifically, since the bottom-corner joist sits at a much smaller X.
    const groundJoists = buildHalfPipeJoists(params).filter((joist) => {
      joist.computeBoundingBox();
      const box = joist.boundingBox!;
      return Math.abs(box.max.y - jointDepth) < 1e-6 && Math.abs(box.min.y) < 1e-6;
    });
    const rightJoist = groundJoists.find((joist) => Math.abs(joist.boundingBox!.max.x - deckOuterWorldXRight) < 1e-6);
    const leftJoist = groundJoists.find((joist) => Math.abs(joist.boundingBox!.min.x + deckOuterWorldXRight) < 1e-6);
    expect(rightJoist).toBeDefined();
    expect(leftJoist).toBeDefined();

    // Same inset external face as the deck-outer joist above it — the two stack flush.
    expect(rightJoist!.boundingBox!.max.x).toBeCloseTo(deckOuterWorldXRight, 6);
    expect(leftJoist!.boundingBox!.min.x).toBeCloseTo(-deckOuterWorldXRight, 6);
  });

  it("adds a third ground joist centered exactly halfway (by X) between the bottom-corner and deck-outer-ground joists", () => {
    const params = HALF_PIPE_DEFAULTS;
    const half = params.bottomTransitionLength / 2;
    const jointDepth = params.joistDepthMm / 1000;
    const points = transitionAndDeckPoints(params.radius, params.transitionAngleDeg, params.vertHeight, params.deckLength);
    const [deckOuterX] = points[points.length - 1];
    // Bottom-corner joist's centerline (local x=0, uninset) and deck-outer-ground joist's
    // centerline (local x=deckOuterX, uninset — the inset shifts its box, not its own anchor).
    const bottomCornerCenterX = half;
    const deckGroundCenterX = half + deckOuterX;
    const expectedCenterXRight = (bottomCornerCenterX + deckGroundCenterX) / 2;

    const groundJoists = buildHalfPipeJoists(params).filter((joist) => {
      joist.computeBoundingBox();
      const box = joist.boundingBox!;
      return Math.abs(box.max.y - jointDepth) < 1e-6 && Math.abs(box.min.y) < 1e-6;
    });
    const rightJoist = groundJoists.find((joist) => {
      const box = joist.boundingBox!;
      return Math.abs((box.min.x + box.max.x) / 2 - expectedCenterXRight) < 1e-6;
    });
    const leftJoist = groundJoists.find((joist) => {
      const box = joist.boundingBox!;
      return Math.abs((box.min.x + box.max.x) / 2 + expectedCenterXRight) < 1e-6;
    });
    expect(rightJoist).toBeDefined();
    expect(leftJoist).toBeDefined();

    // Uninset, so it's the same thickness x depth cross-section as the bottom-corner joist.
    expect(rightJoist!.boundingBox!.max.x - rightJoist!.boundingBox!.min.x).toBeCloseTo(params.joistThicknessMm / 1000, 6);
  });
});

describe("buildHalfPipeJoistsBySection", () => {
  it("splits the same joists buildHalfPipeJoists returns into curveJoists + deckJoists, with no overlap", () => {
    const params = HALF_PIPE_DEFAULTS;
    const { curveJoists, deckJoists } = buildHalfPipeJoistsBySection(params);
    expect(curveJoists.length + deckJoists.length).toBe(buildHalfPipeJoists(params).length);
  });

  it("puts exactly the bottom-corner, curve-interior, and notch-shelf landmarks (both sides, per section) in curveJoists", () => {
    const params = { ...HALF_PIPE_DEFAULTS, internalCurveJoistCount: 3 };
    const sections = params.internalRibCount + 1;
    const pointsPerSide = params.internalCurveJoistCount + 2; // bottom corner, curve interior, notch-shelf
    const { curveJoists } = buildHalfPipeJoistsBySection(params);
    expect(curveJoists).toHaveLength(2 * pointsPerSide * sections);
  });

  it("puts exactly the deck-outer, deck-inner, ground-below-deck-outer, and ground-midpoint landmarks (both sides, per section) in deckJoists, unaffected by internalCurveJoistCount", () => {
    const fewer = buildHalfPipeJoistsBySection({ ...HALF_PIPE_DEFAULTS, internalCurveJoistCount: 0 }).deckJoists;
    const more = buildHalfPipeJoistsBySection({ ...HALF_PIPE_DEFAULTS, internalCurveJoistCount: 5 }).deckJoists;
    const sections = HALF_PIPE_DEFAULTS.internalRibCount + 1;
    const pointsPerSide = 4; // deck-outer, deck-inner, ground-below-deck-outer, ground-midpoint
    expect(fewer).toHaveLength(2 * pointsPerSide * sections);
    expect(more).toHaveLength(2 * pointsPerSide * sections);
  });

  it("anchors the deck-inner joist's notch-side face flush against the notch's plumb wall", () => {
    const params = HALF_PIPE_DEFAULTS;
    const thickness = params.joistThicknessMm / 1000;
    const jointDepth = params.joistDepthMm / 1000;
    const half = params.bottomTransitionLength / 2;

    const points = transitionAndDeckPoints(params.radius, params.transitionAngleDeg, params.vertHeight, params.deckLength);
    const notch = copingNotch(
      points,
      params.radius,
      params.copingOdMm / 1000 / 2,
      params.copingHorizontalProtrusionMm / 1000,
      params.copingVerticalProtrusionMm / 1000,
      params.ribThicknessMm / 1000,
    );
    const [wallX, wallY] = notch.wallTop;
    const wallWorldY = wallY + jointDepth;

    // Flat (angle 0), so its notch-side face is a vertical plane at box.min.x (right) / box.max.x
    // (left) — outward-inset (the opposite of deck-outer), so the joist's body sits past the
    // wall, toward the deck's outer edge, with only that one face flush against it.
    const { deckJoists } = buildHalfPipeJoistsBySection(params);
    const candidates = deckJoists.filter((joist) => {
      joist.computeBoundingBox();
      return Math.abs(joist.boundingBox!.max.y - wallWorldY) < 1e-6; // flat, deck-height joists — deck-outer and deck-inner both qualify
    });

    const rightJoist = candidates.find((joist) => Math.abs(joist.boundingBox!.min.x - (half + wallX)) < 1e-6);
    const leftJoist = candidates.find((joist) => Math.abs(joist.boundingBox!.max.x - (-half - wallX)) < 1e-6);
    expect(rightJoist).toBeDefined();
    expect(leftJoist).toBeDefined();
    expect(rightJoist!.boundingBox!.max.x - rightJoist!.boundingBox!.min.x).toBeCloseTo(thickness, 6);
    expect(leftJoist!.boundingBox!.max.x - leftJoist!.boundingBox!.min.x).toBeCloseTo(thickness, 6);
  });
});

describe("buildHalfPipeDeck", () => {
  it("returns one board per side", () => {
    expect(buildHalfPipeDeck(HALF_PIPE_DEFAULTS)).toHaveLength(2);
  });

  it("spans the full width in Z, flush with the edge ribs' outer faces — not inset between them like a joist", () => {
    const params = { ...HALF_PIPE_DEFAULTS, width: 3.7 };
    for (const board of buildHalfPipeDeck(params)) {
      board.computeBoundingBox();
      const box = board.boundingBox!;
      expect(box.max.z - box.min.z).toBeCloseTo(params.width, 5);
      expect(box.min.z).toBeCloseTo(-params.width / 2, 5);
      expect(box.max.z).toBeCloseTo(params.width / 2, 5);
    }
  });

  it("runs in X from the notch's vertical wall to the rib's own outer edge, on both sides", () => {
    const params = HALF_PIPE_DEFAULTS;
    const half = params.bottomTransitionLength / 2;
    const points = transitionAndDeckPoints(params.radius, params.transitionAngleDeg, params.vertHeight, params.deckLength);
    const deckOuter = points[points.length - 1];
    const notch = copingNotch(
      points,
      params.radius,
      params.copingOdMm / 1000 / 2,
      params.copingHorizontalProtrusionMm / 1000,
      params.copingVerticalProtrusionMm / 1000,
      params.ribThicknessMm / 1000,
    );
    const [wallX] = notch.wallTop;

    const boards = buildHalfPipeDeck(params);
    const rightBoard = boards.find((board) => {
      board.computeBoundingBox();
      return (board.boundingBox!.min.x + board.boundingBox!.max.x) / 2 > 0;
    })!;
    const leftBoard = boards.find((board) => {
      board.computeBoundingBox();
      return (board.boundingBox!.min.x + board.boundingBox!.max.x) / 2 < 0;
    })!;

    expect(rightBoard.boundingBox!.min.x).toBeCloseTo(half + wallX, 5);
    expect(rightBoard.boundingBox!.max.x).toBeCloseTo(half + deckOuter[0], 5);
    expect(leftBoard.boundingBox!.max.x).toBeCloseTo(-(half + wallX), 5);
    expect(leftBoard.boundingBox!.min.x).toBeCloseTo(-(half + deckOuter[0]), 5);
  });

  it("sits on top of the deck joists: bottom flush with their top face, extending upward by ribThicknessMm", () => {
    const params = { ...HALF_PIPE_DEFAULTS, ribThicknessMm: 25 };
    const jointDepth = params.joistDepthMm / 1000;
    const points = transitionAndDeckPoints(params.radius, params.transitionAngleDeg, params.vertHeight, params.deckLength);
    const deckOuter = points[points.length - 1];
    const deckJoistTopY = deckOuter[1] + jointDepth;

    for (const board of buildHalfPipeDeck(params)) {
      board.computeBoundingBox();
      const box = board.boundingBox!;
      expect(box.min.y).toBeCloseTo(deckJoistTopY, 6);
      expect(box.max.y - box.min.y).toBeCloseTo(0.025, 6);
    }
  });
});

describe("curveInteriorJoistLocalPoints", () => {
  it("matches the curve-interior joist positions buildHalfPipeJoists actually builds", () => {
    const params = { ...HALF_PIPE_DEFAULTS, internalCurveJoistCount: 5 };
    const half = params.bottomTransitionLength / 2;
    const jointDepth = params.joistDepthMm / 1000;
    const thickness = params.joistThicknessMm / 1000;
    const depth = params.joistDepthMm / 1000;

    const curveJoists = curveInteriorJoistLocalPoints(params);
    expect(curveJoists).toHaveLength(5);

    const joists = buildHalfPipeJoists(params);
    // Right-side world mapping (angle used as-is, not negated) — see buildHalfPipeJoists'
    // worldJoists, which negates angle only for the mirrored left side.
    for (const { point: [x, y], angle } of curveJoists) {
      const worldX = half + x;
      const worldY = y + jointDepth;
      const expectedCenterX = worldX + Math.sin(angle) * (depth / 2);
      const expectedCenterY = worldY - Math.cos(angle) * (depth / 2);

      const joist = joists.find((j) => {
        j.computeBoundingBox();
        const box = j.boundingBox!;
        const cx = (box.min.x + box.max.x) / 2;
        const cy = (box.min.y + box.max.y) / 2;
        return Math.abs(cx - expectedCenterX) < 1e-6 && Math.abs(cy - expectedCenterY) < 1e-6;
      });
      expect(joist).toBeDefined();
      const box = joist!.boundingBox!;
      expect(box.max.y - box.min.y).toBeCloseTo(thickness * Math.abs(Math.sin(angle)) + depth * Math.abs(Math.cos(angle)), 5);
    }
  });

  it("returns an empty array when internalCurveJoistCount is 0", () => {
    expect(curveInteriorJoistLocalPoints({ ...HALF_PIPE_DEFAULTS, internalCurveJoistCount: 0 })).toEqual([]);
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
      params.ribThicknessMm / 1000,
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

describe("HALF_PIPE_DEFAULTS skin", () => {
  it("defaults both skin layers to 12mm", () => {
    expect(HALF_PIPE_DEFAULTS.skinLayer1ThicknessMm).toBe(12);
    expect(HALF_PIPE_DEFAULTS.skinLayer2ThicknessMm).toBe(12);
  });

  it("defaults the sheet size to 2.4m x 1.2m, length-ways", () => {
    expect(HALF_PIPE_DEFAULTS.skinSheetLength).toBe(2.4);
    expect(HALF_PIPE_DEFAULTS.skinSheetWidth).toBe(1.2);
    expect(HALF_PIPE_DEFAULTS.skinGrainDirection).toBe("length-ways");
  });
});
