import * as THREE from "three";

const DEFAULT_SEGMENTS = 24;

/**
 * Points along a circular transition curve rising tangent to horizontal at
 * (0,0), center at (0, radius), sweeping up to sweepAngleDeg measured from
 * horizontal (90 = vertical). Shared by every ramp type so the curve math
 * isn't re-derived three times.
 */
export function transitionArcPoints(
  radius: number,
  sweepAngleDeg: number,
  segments = DEFAULT_SEGMENTS,
): [number, number][] {
  const sweep = THREE.MathUtils.degToRad(sweepAngleDeg);
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * sweep;
    points.push([radius * Math.sin(t), radius * (1 - Math.cos(t))]);
  }
  return points;
}

/** Tangent direction at the top of a transitionArcPoints curve — where the deck continues from. */
export function transitionExitDirection(sweepAngleDeg: number): [number, number] {
  const sweep = THREE.MathUtils.degToRad(sweepAngleDeg);
  return [Math.cos(sweep), Math.sin(sweep)];
}

/**
 * Transition arc + flat deck, from the ground-tangent start (0,0) out to the
 * deck's outer edge — the shared shape of a deck attachment, used by both of
 * a half-pipe's mirrored transitions.
 */
export function transitionAndDeckPoints(
  radius: number,
  transitionAngleDeg: number,
  deckLength: number,
): [number, number][] {
  const arc = transitionArcPoints(radius, transitionAngleDeg);
  const deckStart = arc[arc.length - 1];
  const deckEnd: [number, number] = [deckStart[0] + deckLength, deckStart[1]];
  return [...arc, deckStart, deckEnd];
}
