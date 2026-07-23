import {
  bottomTransitionMemberLengths,
  buildBottomTransitionFrame,
  buildHalfPipeDeck,
  buildHalfPipeJoistsBySection,
  buildHalfPipeRibsBySection,
  buildHalfPipeSkinLayer1,
  buildHalfPipeSkinLayer2,
  deckBoardLength,
  halfPipeCopingCenters,
  halfPipeSkinLayer1FlatSheetSizes,
  halfPipeSkinLayer2FlatSheetSizes,
  halfPipeSkinLayer2NarrowStarterCount,
  ribLocalProfilePoints,
  type HalfPipeParams,
} from "../ramps/halfPipe";
import { ribZPositions } from "../ramps/ribs";

export interface BomLine {
  part: string;
  quantity: number;
  dimensions: string;
  material: string;
}

function formatMm(valueMm: number): string {
  return `${Math.round(valueMm)}mm`;
}

/**
 * One row per part *type* the 2D drawings tab already groups by (see
 * drawings/halfPipePartDrawings.ts) — a rib is one row regardless of its edge/internal role, a
 * joist one row regardless of curve/deck role, since every part sharing a row is dimensionally
 * identical. Every quantity comes from the same build functions the 3D view already calls
 * (buildHalfPipe*), not a re-derived count formula, so this can't drift from what's actually
 * built — the joist landmark count especially would be easy to get subtly wrong re-deriving it
 * independently (see buildHalfPipeJoistsBySection's own doc comment).
 *
 * Two cut variants get their own row(s), broken out of the standard "Skin layer N sheet" row:
 * layer 2's narrower top-of-curve starter (halfPipeSkinLayer2NarrowStarterCount) — a fixed
 * half-width fraction of the standard sheet, so counting it is enough, no separate size needed
 * — and each layer's own bottom-transition flat infill (halfPipeSkinLayer1/2FlatSheetSizes),
 * whose size is a continuously variable leftover (whatever's left of bottomTransitionLength once
 * the curve rows' own flatExtension is subtracted), not a fixed fraction of anything, so it needs
 * its own computed dimensions too.
 */
export function calculateHalfPipeBom(params: HalfPipeParams): BomLine[] {
  const { edgeRibs, internalRibs } = buildHalfPipeRibsBySection(params);
  const { curveJoists, deckJoists } = buildHalfPipeJoistsBySection(params);
  const deckBoards = buildHalfPipeDeck(params);
  const skinLayer1 = buildHalfPipeSkinLayer1(params);
  const skinLayer2 = buildHalfPipeSkinLayer2(params);
  const copingTubes = halfPipeCopingCenters(params);

  // Each layer's own flat-infill sheets (and, for layer 2, its narrow top-of-curve starter) get
  // their own row(s) below — subtracted here so the standard row's quantity/dimensions describe
  // only the standard-size sheets, not a mix.
  const layer1FlatSizes = halfPipeSkinLayer1FlatSheetSizes(params);
  const layer2FlatSizes = halfPipeSkinLayer2FlatSheetSizes(params);
  const layer1FlatCount = layer1FlatSizes.reduce((sum, s) => sum + s.count, 0);
  const layer2FlatCount = layer2FlatSizes.reduce((sum, s) => sum + s.count, 0);
  const layer2NarrowStarterCount = halfPipeSkinLayer2NarrowStarterCount(params);

  // buildBottomTransitionFrame always returns [...plates (2), ...studs] — see its own source —
  // so the stud count is whatever's left after the two plates, not a separately-tracked formula.
  const bottomTransitionMembers = buildBottomTransitionFrame(params);
  const studCount = bottomTransitionMembers.length - 2;

  const ribPointsMm = ribLocalProfilePoints(params).map(([x, y]): [number, number] => [x * 1000, y * 1000]);
  const ribXsMm = ribPointsMm.map(([x]) => x);
  const ribYsMm = ribPointsMm.map(([, y]) => y);
  const ribWidthMm = Math.max(...ribXsMm) - Math.min(...ribXsMm);
  const ribHeightMm = Math.max(...ribYsMm) - Math.min(...ribYsMm);

  const { plateLength, studLength } = bottomTransitionMemberLengths(params);
  const jointCrossSection = `${formatMm(params.joistThicknessMm)} × ${formatMm(params.joistDepthMm)}`;

  // Same span every curve/deck joist actually has, not just the first bay's: ribZPositions
  // spaces every section evenly, so every bay's inside-face gap is identical (see
  // joistPartDrawing's own doc comment — this is the same reused-first-bay logic).
  const ribThicknessM = params.ribThicknessMm / 1000;
  const [bayZ0, bayZ1] = ribZPositions(params.width, params.internalRibCount, ribThicknessM);
  const joistSpanMm = (bayZ1 - bayZ0 - ribThicknessM) * 1000;

  return [
    {
      part: "Rib",
      // ×2: halfPipeOutline (see halfPipe.ts) always returns two mirrored, physically
      // disjoint shapes (left/right transition) extruded together into one BufferGeometry
      // per Z position, purely for rendering convenience — each array entry here is actually
      // two separate physical rib pieces, not one, and the 2D drawing (ribPartDrawing) already
      // draws only the one-sided profile these dimensions describe.
      quantity: (edgeRibs.length + internalRibs.length) * 2,
      dimensions: `${formatMm(ribWidthMm)} × ${formatMm(ribHeightMm)} curved profile, ${formatMm(params.ribThicknessMm)} thick`,
      material: "Plywood",
    },
    {
      part: "Deck board",
      quantity: deckBoards.length,
      dimensions: `${formatMm(deckBoardLength(params) * 1000)} × ${formatMm(params.width * 1000)} × ${formatMm(params.ribThicknessMm)}`,
      material: "Plywood",
    },
    {
      part: "Joist",
      quantity: curveJoists.length + deckJoists.length,
      dimensions: `${formatMm(joistSpanMm)} long, ${jointCrossSection} cross-section`,
      material: "Dimensional lumber",
    },
    {
      part: "Bottom transition plate",
      quantity: 2,
      dimensions: `${formatMm(plateLength * 1000)} long, ${jointCrossSection} cross-section`,
      material: "Dimensional lumber",
    },
    {
      part: "Bottom transition stud",
      quantity: studCount,
      dimensions: `${formatMm(studLength * 1000)} long, ${jointCrossSection} cross-section`,
      material: "Dimensional lumber",
    },
    {
      part: "Skin layer 1 sheet",
      quantity: skinLayer1.length - layer1FlatCount,
      dimensions: `${formatMm(params.skinSheetLength * 1000)} × ${formatMm(params.skinSheetWidth * 1000)} × ${formatMm(params.skinLayer1ThicknessMm)}`,
      material: "Plywood/OSB",
    },
    ...layer1FlatSizes.map(
      ({ lengthMm, widthMm, count }): BomLine => ({
        part: "Skin layer 1 sheet — bottom transition (flat)",
        quantity: count,
        dimensions: `${formatMm(lengthMm)} × ${formatMm(widthMm)} × ${formatMm(params.skinLayer1ThicknessMm)}`,
        material: "Plywood/OSB",
      }),
    ),
    {
      part: "Skin layer 2 sheet",
      quantity: skinLayer2.length - layer2FlatCount - layer2NarrowStarterCount,
      dimensions: `${formatMm(params.skinLayer2SheetLength * 1000)} × ${formatMm(params.skinLayer2SheetWidth * 1000)} × ${formatMm(params.skinLayer2ThicknessMm)}`,
      material: "Plywood/OSB",
    },
    {
      part: "Skin layer 2 sheet — top-of-curve starter (half width)",
      quantity: layer2NarrowStarterCount,
      dimensions: `${formatMm(params.skinLayer2SheetLength * 1000)} × ${formatMm((params.skinLayer2SheetWidth / 2) * 1000)} × ${formatMm(params.skinLayer2ThicknessMm)}`,
      material: "Plywood/OSB",
    },
    ...layer2FlatSizes.map(
      ({ lengthMm, widthMm, count }): BomLine => ({
        part: "Skin layer 2 sheet — bottom transition (flat)",
        quantity: count,
        dimensions: `${formatMm(lengthMm)} × ${formatMm(widthMm)} × ${formatMm(params.skinLayer2ThicknessMm)}`,
        material: "Plywood/OSB",
      }),
    ),
    {
      part: "Coping tube",
      quantity: copingTubes.length,
      dimensions: `${formatMm(params.width * 1000)} long, OD ${formatMm(params.copingOdMm)} × ID ${formatMm(params.copingIdMm)}`,
      material: "Steel pipe",
    },
  ];
}
