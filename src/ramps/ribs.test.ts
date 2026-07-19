import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { extrudeRibs, ribZPositions } from "./ribs";

describe("ribZPositions", () => {
  it("places the first and last rib exactly at the edges", () => {
    const positions = ribZPositions(3, 1);
    expect(positions[0]).toBeCloseTo(-1.5, 10);
    expect(positions[positions.length - 1]).toBeCloseTo(1.5, 10);
  });

  it("returns exactly internalRibCount + 2 positions", () => {
    for (const width of [0.5, 1, 2, 3, 3.7, 4]) {
      for (const internalRibCount of [0, 1, 2, 5, 10]) {
        expect(ribZPositions(width, internalRibCount)).toHaveLength(internalRibCount + 2);
      }
    }
  });

  it("spaces ribs evenly", () => {
    const positions = ribZPositions(3.7, 4);
    const gap = positions[1] - positions[0];
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i] - positions[i - 1]).toBeCloseTo(gap, 10);
    }
  });

  it("returns just the two edge ribs when internalRibCount is 0", () => {
    const positions = ribZPositions(0.05, 0);
    expect(positions).toEqual([-0.025, 0.025]);
  });

  it("produces more ribs as internalRibCount grows, for the same width", () => {
    const loose = ribZPositions(3, 0);
    const tight = ribZPositions(3, 5);
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
