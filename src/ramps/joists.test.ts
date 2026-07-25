import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildJoistBox, joistCenter } from "./joists";

describe("joistCenter", () => {
  it("translates depth/2 straight down from (x, y) when unrotated", () => {
    expect(joistCenter(0.4, 0.6, 0.09)).toEqual([0.4, 0.6 - 0.045]);
  });

  it("translates along the tilted face's own normal at an arbitrary angle", () => {
    const angle = Math.PI / 6;
    const [cx, cy] = joistCenter(0.4, 0.6, 0.09, angle);
    expect(cx).toBeCloseTo(0.4 + Math.sin(angle) * 0.045, 6);
    expect(cy).toBeCloseTo(0.6 - Math.cos(angle) * 0.045, 6);
  });

  it("matches buildJoistBox's own center", () => {
    const [x, y, depth, angle] = [0.4, 0.6, 0.09, Math.PI / 6];
    const joist = buildJoistBox(1, 2.5, x, y, 0.045, depth, angle);
    const center = new THREE.Vector3();
    joist.computeBoundingBox();
    joist.boundingBox!.getCenter(center);
    const [cx, cy] = joistCenter(x, y, depth, angle);
    // Z isn't checked — box.getCenter mixes in the rotated box's own Z extent asymmetry, X/Y are
    // the axes joistCenter actually computes.
    expect(center.x).toBeCloseTo(cx, 6);
    expect(center.y).toBeCloseTo(cy, 6);
  });
});

describe("buildJoistBox", () => {
  it("sizes the cross-section as thickness (X) x depth (Y), spanning zStart to zEnd", () => {
    const joist = buildJoistBox(1, 2.5, 0.4, 0.6, 0.045, 0.09);
    joist.computeBoundingBox();
    const box = joist.boundingBox!;

    expect(box.max.x - box.min.x).toBeCloseTo(0.045, 6);
    expect(box.max.y - box.min.y).toBeCloseTo(0.09, 6);
    expect(box.max.z - box.min.z).toBeCloseTo(1.5, 6);
  });

  it("anchors the top edge (not the center) at (x, y), and centers X and Z", () => {
    const joist = buildJoistBox(-2, 1, 0.4, 0.6, 0.045, 0.09);
    joist.computeBoundingBox();
    const box = joist.boundingBox!;

    expect(box.max.y).toBeCloseTo(0.6, 6); // top edge, not the box center, meets y
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0.4, 6);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(-0.5, 6);
  });

  it("tilts the cross-section by angle (radians, about Z), still anchoring its top edge at (x, y)", () => {
    const joist = buildJoistBox(1, 2.5, 0.4, 0.6, 0.045, 0.09, Math.PI / 2);
    joist.computeBoundingBox();
    const box = joist.boundingBox!;

    // 90 degrees swaps which axis reads thickness vs depth, and rotates the top edge to the
    // box's min-x boundary (rather than max-y, as it is unrotated).
    expect(box.max.x - box.min.x).toBeCloseTo(0.09, 6);
    expect(box.max.y - box.min.y).toBeCloseTo(0.045, 6);
    expect(box.min.x).toBeCloseTo(0.4, 6);
    expect((box.min.y + box.max.y) / 2).toBeCloseTo(0.6, 6);
  });

  it("keeps the top face exactly coplanar with (x, y) at an arbitrary tilt angle", () => {
    const x = 0.4;
    const y = 0.6;
    const depth = 0.09;
    const angle = Math.PI / 6; // 30 degrees — not axis-aligned, so bounding-box edges don't help
    const joist = buildJoistBox(1, 2.5, x, y, 0.045, depth, angle);

    // The top face is the local Y=+depth/2 plane; after rotateZ(angle) its outward normal is
    // (-sin(angle), cos(angle)). Every point on that plane — and no point of the rest of the
    // box — projects onto that normal at the same, maximal, value: dot((x, y), normal).
    const normalX = -Math.sin(angle);
    const normalY = Math.cos(angle);
    const positions = joist.getAttribute("position");
    let maxProjection = -Infinity;
    for (let i = 0; i < positions.count; i++) {
      const projection = positions.getX(i) * normalX + positions.getY(i) * normalY;
      maxProjection = Math.max(maxProjection, projection);
    }

    expect(maxProjection).toBeCloseTo(x * normalX + y * normalY, 6);
  });
});
