import * as THREE from "three";

export interface LinearDimension {
  group: THREE.Group;
  labelPosition: THREE.Vector3;
}

const LINE_COLOR = 0x333333;
const ARROW_LENGTH = 0.12;
const ARROW_WIDTH = 0.06;
const LABEL_NUDGE = 0.08;

function line(a: THREE.Vector3, b: THREE.Vector3): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: LINE_COLOR }));
}

/**
 * A CAD-style dimension: two extension lines from the measured start/end
 * points out to an offset dimension line with outward-pointing arrowheads.
 * offsetDir need not be normalized. Generic over any two points/axis, so
 * it's reusable for other ramp types' linear measurements later —
 * angular dimensions (transitionAngleDeg) would need a different builder.
 */
export function buildLinearDimension(
  start: THREE.Vector3,
  end: THREE.Vector3,
  offsetDir: THREE.Vector3,
  offsetDistance: number,
): LinearDimension {
  const offset = offsetDir.clone().normalize().multiplyScalar(offsetDistance);
  const offsetStart = start.clone().add(offset);
  const offsetEnd = end.clone().add(offset);
  const dirVec = offsetEnd.clone().sub(offsetStart).normalize();

  const group = new THREE.Group();
  group.add(
    line(start, offsetStart),
    line(end, offsetEnd),
    line(offsetStart, offsetEnd),
    new THREE.ArrowHelper(
      dirVec.clone().negate(),
      offsetStart.clone().add(dirVec.clone().multiplyScalar(ARROW_LENGTH)),
      ARROW_LENGTH,
      LINE_COLOR,
      ARROW_LENGTH,
      ARROW_WIDTH,
    ),
    new THREE.ArrowHelper(
      dirVec,
      offsetEnd.clone().sub(dirVec.clone().multiplyScalar(ARROW_LENGTH)),
      ARROW_LENGTH,
      LINE_COLOR,
      ARROW_LENGTH,
      ARROW_WIDTH,
    ),
  );

  const labelPosition = offsetStart
    .clone()
    .add(offsetEnd)
    .multiplyScalar(0.5)
    .add(offset.clone().normalize().multiplyScalar(LABEL_NUDGE));

  return { group, labelPosition };
}
