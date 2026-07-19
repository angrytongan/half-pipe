import * as THREE from "three";
import { centerFootprint } from "./util";

// ponytail: 3/4" plywood default (19mm), the typical rib stock per research/design.md's
// "Ribs/transoms". User-adjustable via the ribThicknessMm slider in main.ts.
export const RIB_THICKNESS_MM = 19;

/**
 * Z positions for ribs evenly spaced across width: always two edge ribs (mandatory — nothing
 * else frames the deck edge) plus internalRibCount more between them.
 */
export function ribZPositions(width: number, internalRibCount: number): number[] {
  const count = internalRibCount + 2;
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    positions.push(-width / 2 + (width * i) / (count - 1));
  }
  return positions;
}

/** One thin extrusion of shape per Z position, X-centered, placed at its Z slot. */
export function extrudeRibs(shape: THREE.Shape, zPositions: number[], thickness: number): THREE.BufferGeometry[] {
  return zPositions.map((z) => {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    centerFootprint(geometry);
    geometry.translate(0, 0, z);
    return geometry;
  });
}
