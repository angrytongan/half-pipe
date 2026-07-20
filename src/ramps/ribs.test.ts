import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { extrudeRibs, ribZPositions } from "./ribs";

describe("ribZPositions", () => {
  it("insets the first and last rib's centerline by ribThickness/2, so their outer faces (not centerlines) sit at the edges", () => {
    const positions = ribZPositions(3, 1, 0.02);
    expect(positions[0]).toBeCloseTo(-1.5 + 0.01, 10);
    expect(positions[positions.length - 1]).toBeCloseTo(1.5 - 0.01, 10);
  });

  it("returns 2 edge ribs plus 2 per seam (internalRibCount)", () => {
    for (const width of [0.5, 1, 2, 3, 3.7, 4]) {
      for (const internalRibCount of [0, 1, 2, 5, 10]) {
        expect(ribZPositions(width, internalRibCount, 0.02)).toHaveLength(internalRibCount * 2 + 2);
      }
    }
  });

  it("doubles each seam into two ribs exactly ribThickness apart, straddling the boundary point", () => {
    const ribThickness = 0.02;
    const positions = ribZPositions(3, 1, ribThickness);
    expect(positions).toHaveLength(4); // 2 edges + 1 doubled seam
    const [seamA, seamB] = [positions[1], positions[2]];
    expect(seamB - seamA).toBeCloseTo(ribThickness, 10);
    expect((seamA + seamB) / 2).toBeCloseTo(0, 10); // straddles the width's midpoint
  });

  it("doubles every seam for multiple internal ribs", () => {
    const positions = ribZPositions(4, 2, 0.02);
    expect(positions).toHaveLength(6); // 2 edges + 2 doubled seams
  });

  it("returns just the two edge ribs when internalRibCount is 0, each inset by half its own thickness", () => {
    const positions = ribZPositions(0.05, 0, 0.02);
    expect(positions).toHaveLength(2);
    expect(positions[0]).toBeCloseTo(-0.015, 10);
    expect(positions[1]).toBeCloseTo(0.015, 10);
  });

  it("produces more ribs as internalRibCount grows, for the same width", () => {
    const loose = ribZPositions(3, 0, 0.02);
    const tight = ribZPositions(3, 5, 0.02);
    expect(tight.length).toBeGreaterThan(loose.length);
  });
});

describe("extrudeRibs", () => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(1, 0);
  shape.lineTo(1, 1);
  shape.lineTo(0, 1);
  shape.closePath();

  it("produces one geometry per Z position", () => {
    const positions = [-1, 0, 1];
    const geometries = extrudeRibs(shape, positions, 0.02);
    expect(geometries).toHaveLength(3);
  });

  it("centers each rib's X bounding box on 0 and places it at its Z slot", () => {
    const thickness = 0.02;
    const positions = [-1, 0.5, 2];
    const geometries = extrudeRibs(shape, positions, thickness);

    geometries.forEach((geometry, i) => {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 10);
      expect((box.min.z + box.max.z) / 2).toBeCloseTo(positions[i], 10);
      expect(box.max.z - box.min.z).toBeCloseTo(thickness, 6);
    });
  });
});
