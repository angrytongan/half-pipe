import * as THREE from "three";
import { centerFootprint } from "./util";

// User-adjustable via the ribThicknessMm slider in main.ts.
export const RIB_THICKNESS_MM = 19;

/**
 * Z positions for ribs evenly spaced across width: always two single edge ribs (mandatory —
 * nothing else frames the deck edge), plus internalRibCount seams between them. Each seam is
 * doubled into two ribs straddling its boundary point, offset by ±ribThickness/2 so their
 * faces touch — a wide ramp is built as separate narrower sections, each with its own edge
 * rib at the seam, screwed together, not as one rib shared between two sections. The two edge
 * ribs are inset by ribThickness/2 from ±width/2 — their *outer* faces meet ±width/2, not
 * their centerlines — so the whole assembled structure fits exactly within width, with no
 * overhang past the specified width.
 */
export function ribZPositions(width: number, internalRibCount: number, ribThickness: number): number[] {
  const boundaryCount = internalRibCount + 2;
  const positions: number[] = [];
  for (let i = 0; i < boundaryCount; i++) {
    const z = -width / 2 + (width * i) / (boundaryCount - 1);
    if (i === 0) {
      positions.push(z + ribThickness / 2);
    } else if (i === boundaryCount - 1) {
      positions.push(z - ribThickness / 2);
    } else {
      positions.push(z - ribThickness / 2, z + ribThickness / 2);
    }
  }
  return positions;
}

/** One thin extrusion of shape(s) per Z position, X-centered, placed at its Z slot. */
export function extrudeRibs(shape: THREE.Shape | THREE.Shape[], zPositions: number[], thickness: number): THREE.BufferGeometry[] {
  return zPositions.map((z) => {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    centerFootprint(geometry);
    geometry.translate(0, 0, z);
    return geometry;
  });
}
