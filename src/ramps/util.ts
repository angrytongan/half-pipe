import * as THREE from "three";

/** Centers geometry on X/Z (footprint) while leaving Y untouched, so the base stays at ground level. */
export function centerFootprint(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  geometry.translate(-cx, 0, -cz);
  return geometry;
}
