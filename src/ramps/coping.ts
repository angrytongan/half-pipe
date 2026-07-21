export interface CopingNotch {
  wallTop: [number, number];
  wallBottom: [number, number];
  shelfEnd: [number, number];
  shelfAngle: number;
  arcCutoffIndex: number;
  pipeCenter: [number, number];
}

/**
 * Notch cut into the rib at the deck/curve corner (points[points.length - 2], see
 * transitionAndDeckPoints) so the coping pipe sits with its center offset such that it
 * protrudes horizontalProtrusion past the *skinned* curve surface — `skinThickness` *toward the
 * ramp's interior* from the bare corner's own X (i.e. subtracted, not added), since the curve
 * there will be covered in layer1 + layer2 skin (see
 * `HalfPipeParams.skinLayer1ThicknessMm`/`skinLayer2ThicknessMm`) sitting on the rideable
 * (concave) side of the curve, which faces the arc's own center — toward smaller X at this
 * corner, the same direction the pipe already protrudes past it, not the deck side (+X) — and
 * verticalProtrusion above the deck's own *top surface* — `deckThickness` above the bare corner
 * point, added (not subtracted), since the deck's own rideable side faces the opposite way, up
 * (see `buildHalfPipeDeck`), a real board sitting on top of the joists there (see
 * research/coping.md). Two straight cuts, as it'd actually be built: a plumb wall and a
 * horizontal shelf, both tangent to the pipe — the wall sits wherever the pipe's own rear
 * (deck-facing) side ends up, not at the (skin-adjusted) corner's own X directly, since the pipe
 * (much bigger than the protrusion specs) mostly sits recessed back under the deck; a wall fixed
 * there would cut straight through it instead of meeting its rear face. The shelf meets the
 * curve wherever the curve's own arc reaches shelf height — solved exactly (asin/acos, not the
 * wall's own straight-line direction) since the notch is small enough relative to the curve's
 * radius that a straight-line approximation would be off by a fraction of a millimeter,
 * comparable to the protrusion spec itself. `wallTop` still anchors to the bare corner's own Y,
 * not the deck's top surface — that half of repositioning the wall is a separate, not-yet-done
 * step (see features.md); only its X now accounts for the covering material (skin here, deck
 * there for the shelf).
 */
export function copingNotch(
  points: [number, number][],
  radius: number,
  pipeRadius: number,
  horizontalProtrusion: number,
  verticalProtrusion: number,
  deckThickness: number,
  skinThickness: number,
): CopingNotch {
  const [cornerX, cornerY] = points[points.length - 2];
  // Skin adds to the curve's *rideable* (concave) side, which faces the arc's own center — at
  // this corner, toward smaller X, the ramp's interior, not the deck side — so it's subtracted,
  // the opposite sign from deckTopY below (the deck's rideable side faces up instead).
  const skinTopX = cornerX - skinThickness; // the skinned curve's own surface — see halfPipeOutline
  const deckTopY = cornerY + deckThickness; // the deck board's own top surface — see buildHalfPipeDeck
  const pipeCenterX = skinTopX - horizontalProtrusion + pipeRadius;
  const pipeCenterY = deckTopY + verticalProtrusion - pipeRadius;
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
    shelfAngle: t, // the arc parameter t doubles as its own tangent angle — see transitionArcPoints
    arcCutoffIndex,
    pipeCenter: [pipeCenterX, pipeCenterY],
  };
}
