import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildLinearDimension } from "./dimensionLine";

function linePoints(line: THREE.Line): THREE.Vector3[] {
  const position = line.geometry.getAttribute("position");
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < position.count; i++) {
    points.push(new THREE.Vector3().fromBufferAttribute(position, i));
  }
  return points;
}

describe("buildLinearDimension", () => {
  const start = new THREE.Vector3(0, 0, 0);
  const end = new THREE.Vector3(3, 0, 0);
  const offsetDir = new THREE.Vector3(0, 0, -1);

  it("builds two extension lines, one dimension line, and two arrowheads", () => {
    const { group } = buildLinearDimension(start, end, offsetDir, 0.5);
    const lines = group.children.filter((c): c is THREE.Line => c instanceof THREE.Line);
    const arrows = group.children.filter((c) => c instanceof THREE.ArrowHelper);
    expect(lines).toHaveLength(3);
    expect(arrows).toHaveLength(2);
  });

  it("offsets extension lines from the measured points to the dimension line", () => {
    const { group } = buildLinearDimension(start, end, offsetDir, 0.5);
    const lines = group.children.filter((c): c is THREE.Line => c instanceof THREE.Line);

    const startExtension = lines.find((l) => linePoints(l)[0].distanceTo(start) < 1e-6)!;
    expect(startExtension).toBeDefined();
    expect(linePoints(startExtension)[1].z).toBeCloseTo(-0.5, 5);
  });

  it("places the label at the midpoint of the offset dimension line, nudged further out", () => {
    const { labelPosition } = buildLinearDimension(start, end, offsetDir, 0.5);
    expect(labelPosition.x).toBeCloseTo(1.5, 5);
    expect(labelPosition.z).toBeLessThan(-0.5);
  });

  it("normalizes a non-unit offset direction", () => {
    const { labelPosition } = buildLinearDimension(start, end, new THREE.Vector3(0, 0, -5), 0.5);
    expect(labelPosition.z).toBeCloseTo(-0.58, 2);
  });
});
