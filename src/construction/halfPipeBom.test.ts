import { describe, expect, it } from "vitest";
import { calculateHalfPipeBom } from "./halfPipeBom";
import {
  bottomTransitionMemberLengths,
  buildBottomTransitionFrame,
  buildHalfPipeDeck,
  buildHalfPipeJoistsBySection,
  buildHalfPipeRibsBySection,
  buildHalfPipeSkinLayer1,
  buildHalfPipeSkinLayer2,
  deckBoardLength,
  HALF_PIPE_DEFAULTS,
  halfPipeCopingCenters,
  halfPipeSkinLayer1FlatSheetSizes,
  halfPipeSkinLayer2FlatSheetSizes,
  halfPipeSkinLayer2NarrowStarterCount,
} from "../ramps/halfPipe";
import { ribZPositions } from "../ramps/ribs";

describe("calculateHalfPipeBom", () => {
  // At defaults, each skin layer's flat coverage happens to reduce to exactly one distinct
  // leftover size — this list isn't a fixed length in general (see halfPipeSkinLayer1/2FlatSheetSizes),
  // just what defaults produce right now.
  it("returns one row per part type, in a stable order", () => {
    const parts = calculateHalfPipeBom(HALF_PIPE_DEFAULTS).map((line) => line.part);
    expect(parts).toEqual([
      "Rib",
      "Deck board",
      "Joist",
      "Bottom transition plate",
      "Bottom transition stud",
      "Skin layer 1 sheet",
      "Skin layer 1 sheet — bottom transition (flat)",
      "Skin layer 2 sheet",
      "Skin layer 2 sheet — top-of-curve starter (half width)",
      "Skin layer 2 sheet — bottom transition (flat)",
      "Coping tube",
    ]);
  });

  it("quantities match the actual built geometry, not a re-derived formula", () => {
    const bom = calculateHalfPipeBom(HALF_PIPE_DEFAULTS);
    const byPart = Object.fromEntries(bom.map((line) => [line.part, line.quantity]));

    // ×2: each buildHalfPipeRibsBySection array entry bundles two physically disjoint rib
    // pieces (left/right transition — see halfPipeOutline) into one BufferGeometry.
    const { edgeRibs, internalRibs } = buildHalfPipeRibsBySection(HALF_PIPE_DEFAULTS);
    expect(byPart["Rib"]).toBe((edgeRibs.length + internalRibs.length) * 2);

    const { curveJoists, deckJoists } = buildHalfPipeJoistsBySection(HALF_PIPE_DEFAULTS);
    expect(byPart["Joist"]).toBe(curveJoists.length + deckJoists.length);

    // Standard-sheet quantities exclude the flat-infill piece(s) and, for layer 2, the narrow
    // top-of-curve starter, all of which get their own row(s).
    const layer1FlatCount = halfPipeSkinLayer1FlatSheetSizes(HALF_PIPE_DEFAULTS).reduce((sum, s) => sum + s.count, 0);
    const layer2FlatCount = halfPipeSkinLayer2FlatSheetSizes(HALF_PIPE_DEFAULTS).reduce((sum, s) => sum + s.count, 0);
    const layer2NarrowCount = halfPipeSkinLayer2NarrowStarterCount(HALF_PIPE_DEFAULTS);
    expect(byPart["Deck board"]).toBe(buildHalfPipeDeck(HALF_PIPE_DEFAULTS).length);
    expect(byPart["Skin layer 1 sheet"]).toBe(buildHalfPipeSkinLayer1(HALF_PIPE_DEFAULTS).length - layer1FlatCount);
    expect(byPart["Skin layer 2 sheet"]).toBe(buildHalfPipeSkinLayer2(HALF_PIPE_DEFAULTS).length - layer2FlatCount - layer2NarrowCount);
    expect(byPart["Skin layer 1 sheet — bottom transition (flat)"]).toBe(layer1FlatCount);
    expect(byPart["Skin layer 2 sheet — bottom transition (flat)"]).toBe(layer2FlatCount);
    expect(byPart["Skin layer 2 sheet — top-of-curve starter (half width)"]).toBe(layer2NarrowCount);
    expect(byPart["Coping tube"]).toBe(halfPipeCopingCenters(HALF_PIPE_DEFAULTS).length);

    expect(byPart["Bottom transition plate"]).toBe(2);
    expect(byPart["Bottom transition stud"]).toBe(buildBottomTransitionFrame(HALF_PIPE_DEFAULTS).length - 2);
    expect(byPart["Bottom transition stud"]).toBe(HALF_PIPE_DEFAULTS.internalStudCount + 2);
  });

  it("dimensions the flat-infill row by its own real, non-standard size — not skinSheetLength x skinSheetWidth", () => {
    const bom = calculateHalfPipeBom(HALF_PIPE_DEFAULTS);
    const flatRow = bom.find((line) => line.part === "Skin layer 1 sheet — bottom transition (flat)")!;
    const standardRow = bom.find((line) => line.part === "Skin layer 1 sheet")!;
    expect(flatRow.dimensions).not.toBe(standardRow.dimensions);
    const [{ lengthMm, widthMm }] = halfPipeSkinLayer1FlatSheetSizes(HALF_PIPE_DEFAULTS);
    expect(flatRow.dimensions).toBe(`${lengthMm}mm × ${widthMm}mm × ${HALF_PIPE_DEFAULTS.skinLayer1ThicknessMm}mm`);
  });

  it("dimensions the narrow top-of-curve starter at half the standard sheet's own width", () => {
    const bom = calculateHalfPipeBom(HALF_PIPE_DEFAULTS);
    const narrowRow = bom.find((line) => line.part === "Skin layer 2 sheet — top-of-curve starter (half width)")!;
    const lengthMm = Math.round(HALF_PIPE_DEFAULTS.skinLayer2SheetLength * 1000);
    const widthMm = Math.round((HALF_PIPE_DEFAULTS.skinLayer2SheetWidth / 2) * 1000);
    expect(narrowRow.dimensions).toBe(`${lengthMm}mm × ${widthMm}mm × ${HALF_PIPE_DEFAULTS.skinLayer2ThicknessMm}mm`);
  });

  it("dimensions the bottom transition plate/stud by their own distinct lengths", () => {
    const { plateLength, studLength } = bottomTransitionMemberLengths(HALF_PIPE_DEFAULTS);
    const bom = calculateHalfPipeBom(HALF_PIPE_DEFAULTS);
    const plate = bom.find((line) => line.part === "Bottom transition plate")!;
    const stud = bom.find((line) => line.part === "Bottom transition stud")!;
    expect(plate.dimensions).toContain(`${Math.round(plateLength * 1000)}mm`);
    expect(stud.dimensions).toContain(`${Math.round(studLength * 1000)}mm`);
  });

  it("dimensions the joist by its real clear span, not a vague placeholder — every joist shares one length", () => {
    const ribThicknessM = HALF_PIPE_DEFAULTS.ribThicknessMm / 1000;
    const [z0, z1] = ribZPositions(HALF_PIPE_DEFAULTS.width, HALF_PIPE_DEFAULTS.internalRibCount, ribThicknessM);
    const spanMm = Math.round((z1 - z0 - ribThicknessM) * 1000);
    const joist = calculateHalfPipeBom(HALF_PIPE_DEFAULTS).find((line) => line.part === "Joist")!;
    expect(joist.dimensions).toContain(`${spanMm}mm`);
    expect(joist.dimensions).not.toContain("varies");
  });

  it("dimensions the deck board by its real X run and the ramp's width, in mm", () => {
    const bom = calculateHalfPipeBom(HALF_PIPE_DEFAULTS);
    const deckBoard = bom.find((line) => line.part === "Deck board")!;
    const lengthMm = Math.round(deckBoardLength(HALF_PIPE_DEFAULTS) * 1000);
    const widthMm = Math.round(HALF_PIPE_DEFAULTS.width * 1000);
    expect(deckBoard.dimensions).toBe(`${lengthMm}mm × ${widthMm}mm × ${HALF_PIPE_DEFAULTS.ribThicknessMm}mm`);
  });

  it("more internal ribs/studs/curve joists increases the matching row's quantity", () => {
    const base = calculateHalfPipeBom(HALF_PIPE_DEFAULTS);
    const more = calculateHalfPipeBom({
      ...HALF_PIPE_DEFAULTS,
      internalRibCount: HALF_PIPE_DEFAULTS.internalRibCount + 1,
      internalStudCount: HALF_PIPE_DEFAULTS.internalStudCount + 1,
      internalCurveJoistCount: HALF_PIPE_DEFAULTS.internalCurveJoistCount + 1,
    });
    const byPart = (lines: typeof base) => Object.fromEntries(lines.map((line) => [line.part, line.quantity]));
    const baseByPart = byPart(base);
    const moreByPart = byPart(more);

    expect(moreByPart["Rib"]).toBeGreaterThan(baseByPart["Rib"]);
    expect(moreByPart["Bottom transition stud"]).toBe(baseByPart["Bottom transition stud"] + 1);
    expect(moreByPart["Joist"]).toBeGreaterThan(baseByPart["Joist"]);
  });
});
