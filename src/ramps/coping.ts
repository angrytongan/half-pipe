export interface CopingNotch {
  wallTop: [number, number];
  wallBottom: [number, number];
  shelfEnd: [number, number];
  arcCutoffIndex: number;
  pipeCenter: [number, number];
}

/**
 * Notch cut into the rib at the deck/curve corner (points[points.length - 2], see
 * transitionAndDeckPoints) so the coping pipe sits with its center offset such that it
 * protrudes horizontalProtrusion past the corner's own X and verticalProtrusion above the
 * deck's own Y (see research/coping.md). Two straight cuts, as it'd actually be built: a
 * plumb wall and a horizontal shelf, both tangent to the pipe — the wall sits wherever the
 * pipe's own rear (deck-facing) side ends up, not at the corner's own X directly, since the
 * pipe (much bigger than the protrusion specs) mostly sits recessed back under the deck; a
 * wall fixed at the corner would cut straight through it instead of meeting its rear face.
 * The shelf meets the curve wherever the curve's own arc reaches shelf height — solved
 * exactly (asin/acos, not the wall's own straight-line direction) since the notch is small
 * enough relative to the curve's radius that a straight-line approximation would be off by a
 * fraction of a millimeter, comparable to the protrusion spec itself.
 */
export function copingNotch(
  points: [number, number][],
  radius: number,
  pipeRadius: number,
  horizontalProtrusion: number,
  verticalProtrusion: number,
): CopingNotch {
  const [cornerX, cornerY] = points[points.length - 2];
  const pipeCenterX = cornerX - horizontalProtrusion + pipeRadius;
  const pipeCenterY = cornerY + verticalProtrusion - pipeRadius;
  const wallX = pipeCenterX + pipeRadius; // tangent to the pipe's rear (deck-facing) side
  const shelfY = pipeCenterY - pipeRadius; // tangent to the pipe's underside

  const t = Math.acos(1 - shelfY / radius);
  const shelfEndX = radius * Math.sin(t);

  let arcCutoffIndex = 0;
  for (let i = 0; i <= points.length - 3; i++) {
    if (points[i][1] <= shelfY) arcCutoffIndex = i;
    else break;
  }

  return {
    wallTop: [wallX, cornerY],
    wallBottom: [wallX, shelfY],
    shelfEnd: [shelfEndX, shelfY],
    arcCutoffIndex,
    pipeCenter: [pipeCenterX, pipeCenterY],
  };
}
