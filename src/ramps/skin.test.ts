import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildSkinCurveSheet } from "./skin";

/** Every vertex's distance from the transition's own arc center, local (0, radius) — ignoring Z, since the shape is just extruded straight along it. */
function vertexDistancesFromCenter(geometry: THREE.BufferGeometry, radius: number): number[] {
  const position = geometry.attributes.position;
  const distances: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    distances.push(Math.sqrt(x * x + (radius - y) * (radius - y)));
  }
  return distances;
}

describe("buildSkinCurveSheet", () => {
  const radius = 1.8;
  const thickness = 0.012;

  it("centers the extrusion on Z and spans exactly zSpan", () => {
    const zSpan = 1.2;
    const geometry = buildSkinCurveSheet(radius, thickness, 0, 0.5, zSpan);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.z).toBeCloseTo(-zSpan / 2, 5);
    expect(box.max.z).toBeCloseTo(zSpan / 2, 5);
  });

  it("puts the outer (rib-contact) edge exactly on the transition's own curve — radius from its center", () => {
    const geometry = buildSkinCurveSheet(radius, thickness, 0.1, 0.4, 1);
    const distances = vertexDistancesFromCenter(geometry, radius);
    expect(Math.max(...distances)).toBeCloseTo(radius, 5);
  });

  it("puts the inner (exposed) edge exactly thickness inside the transition's own curve, same center", () => {
    const geometry = buildSkinCurveSheet(radius, thickness, 0.1, 0.4, 1);
    const distances = vertexDistancesFromCenter(geometry, radius);
    expect(Math.min(...distances)).toBeCloseTo(radius - thickness, 5);
  });

  it("starts at the ground tangent when t0 is 0", () => {
    const geometry = buildSkinCurveSheet(radius, thickness, 0, 0.3, 1);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(0, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
  });

  it("rises higher up the curve as t1 grows", () => {
    const low = buildSkinCurveSheet(radius, thickness, 0, 0.2, 1);
    const high = buildSkinCurveSheet(radius, thickness, 0, 0.6, 1);
    low.computeBoundingBox();
    high.computeBoundingBox();
    expect(high.boundingBox!.max.y).toBeGreaterThan(low.boundingBox!.max.y);
  });
});
