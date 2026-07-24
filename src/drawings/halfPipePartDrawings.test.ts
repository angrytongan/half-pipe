import { describe, expect, it } from "vitest";
import {
  allPartDrawings,
  bottomTransitionPlatePartDrawing,
  bottomTransitionStudPartDrawing,
  deckBoardPartDrawing,
  joistPartDrawing,
  ribPartDrawing,
  skinLayer1FlatInfillPartDrawings,
  skinLayer1SheetPartDrawing,
  skinLayer2FlatInfillPartDrawings,
  skinLayer2NarrowCurveSheetPartDrawing,
  skinLayer2SheetPartDrawing,
} from "./halfPipePartDrawings";
import { bottomTransitionMemberLengths, deckBoardLength, HALF_PIPE_DEFAULTS, halfPipeSkinLayer1FlatSheetSizes, halfPipeSkinLayer2FlatSheetSizes, ribLocalProfilePoints } from "../ramps/halfPipe";
import { ribZPositions } from "../ramps/ribs";

function outlineBounds(outline: [number, number][]) {
  const xs = outline.map(([x]) => x);
  const ys = outline.map(([, y]) => y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

describe("allPartDrawings", () => {
  // At defaults, both skin layers' flat coverage happens to reduce to exactly one distinct
  // leftover size each — this list isn't a fixed length in general (halfPipeSkinLayer1/2FlatSheetSizes
  // can return more than one entry, or none), just what defaults produce right now.
  it("returns one drawing each for the rib, deck board, joist, plate, stud, both full skin sheets, layer 2's narrower top-of-curve starter, and each layer's own bottom-transition flat infill", () => {
    const titles = allPartDrawings(HALF_PIPE_DEFAULTS).map((d) => d.title);
    expect(titles).toEqual([
      "Rib",
      "Deck board",
      "Joist",
      "Bottom transition plate",
      "Bottom transition stud",
      "Skin layer 1 sheet (flat, before bending)",
      "Skin layer 1 sheet — bottom transition (flat)",
      "Skin layer 2 sheet (flat, before bending)",
      "Skin layer 2 sheet — top-of-curve starter (half width, flat, before bending)",
      "Skin layer 2 sheet — bottom transition (flat)",
    ]);
  });
});

describe("skin layer flat-infill part drawings", () => {
  it("dimensions layer 1's flat infill by its own real, non-standard leftover size — not skinSheetLength x skinSheetWidth", () => {
    const sizes = halfPipeSkinLayer1FlatSheetSizes(HALF_PIPE_DEFAULTS);
    const drawings = skinLayer1FlatInfillPartDrawings(HALF_PIPE_DEFAULTS);
    expect(drawings).toHaveLength(sizes.length);
    drawings.forEach((drawing, i) => {
      expect(drawing.title).toBe("Skin layer 1 sheet — bottom transition (flat)");
      expect(drawing.dimensions.map((d) => d.text)).toEqual([`${sizes[i].lengthMm}mm`, `${sizes[i].widthMm}mm`]);
      expect(drawing.labels.lines).toEqual([`Thickness: ${HALF_PIPE_DEFAULTS.skinLayer1ThicknessMm}mm`]);
    });
  });

  it("dimensions layer 2's flat infill by its own real, non-standard leftover size", () => {
    const sizes = halfPipeSkinLayer2FlatSheetSizes(HALF_PIPE_DEFAULTS);
    const drawings = skinLayer2FlatInfillPartDrawings(HALF_PIPE_DEFAULTS);
    expect(drawings).toHaveLength(sizes.length);
    drawings.forEach((drawing, i) => {
      expect(drawing.title).toBe("Skin layer 2 sheet — bottom transition (flat)");
      expect(drawing.dimensions.map((d) => d.text)).toEqual([`${sizes[i].lengthMm}mm`, `${sizes[i].widthMm}mm`]);
      expect(drawing.labels.lines).toEqual([`Thickness: ${HALF_PIPE_DEFAULTS.skinLayer2ThicknessMm}mm`]);
    });
  });
});

describe("rectangle-shaped part drawings", () => {
  it("dimensions a deck board by its real X run and the ramp's width, in mm", () => {
    const drawing = deckBoardPartDrawing(HALF_PIPE_DEFAULTS);
    const lengthMm = deckBoardLength(HALF_PIPE_DEFAULTS) * 1000;
    expect(drawing.dimensions.map((d) => d.text)).toEqual([`${Math.round(lengthMm)}mm`, `${Math.round(HALF_PIPE_DEFAULTS.width * 1000)}mm`]);
    expect(drawing.labels.lines).toEqual([`Thickness: ${HALF_PIPE_DEFAULTS.ribThicknessMm}mm`]);
  });

  it("dimensions a joist by one bay's clear span and the joist's own depth", () => {
    const drawing = joistPartDrawing(HALF_PIPE_DEFAULTS);
    const ribThickness = HALF_PIPE_DEFAULTS.ribThicknessMm / 1000;
    const [z0, z1] = ribZPositions(HALF_PIPE_DEFAULTS.width, HALF_PIPE_DEFAULTS.internalRibCount, ribThickness);
    const spanMm = (z1 - z0 - ribThickness) * 1000;
    expect(drawing.dimensions.map((d) => d.text)).toEqual([`${Math.round(spanMm)}mm`, `${HALF_PIPE_DEFAULTS.joistDepthMm}mm`]);
    expect(drawing.labels.lines).toEqual([`Thickness: ${HALF_PIPE_DEFAULTS.joistThicknessMm}mm`]);
  });

  it("dimensions the bottom transition plate and stud by their own distinct lengths, sharing the joist cross-section", () => {
    const { plateLength, studLength } = bottomTransitionMemberLengths(HALF_PIPE_DEFAULTS);
    const plate = bottomTransitionPlatePartDrawing(HALF_PIPE_DEFAULTS);
    const stud = bottomTransitionStudPartDrawing(HALF_PIPE_DEFAULTS);
    expect(plate.dimensions[0].text).toBe(`${Math.round(plateLength * 1000)}mm`);
    expect(stud.dimensions[0].text).toBe(`${Math.round(studLength * 1000)}mm`);
    expect(plate.dimensions[1].text).toBe(stud.dimensions[1].text); // same joistDepthMm
    expect(plate.labels.lines).toEqual(stud.labels.lines); // same joistThicknessMm
    expect(plateLength).not.toBeCloseTo(studLength, 3);
  });

  it("dimensions each skin sheet by its own flat sheet-size params, not the curved installed shape", () => {
    const drawing = skinLayer1SheetPartDrawing(HALF_PIPE_DEFAULTS);
    expect(drawing.dimensions.map((d) => d.text)).toEqual([`${Math.round(HALF_PIPE_DEFAULTS.skinSheetLength * 1000)}mm`, `${Math.round(HALF_PIPE_DEFAULTS.skinSheetWidth * 1000)}mm`]);
    expect(drawing.labels.lines).toEqual([`Thickness: ${HALF_PIPE_DEFAULTS.skinLayer1ThicknessMm}mm`]);
  });

  it("dimensions layer 2's top-of-curve starter sheet at half the full sheet's width, same length", () => {
    const full = skinLayer2SheetPartDrawing(HALF_PIPE_DEFAULTS);
    const narrow = skinLayer2NarrowCurveSheetPartDrawing(HALF_PIPE_DEFAULTS);
    expect(narrow.dimensions[0].text).toBe(full.dimensions[0].text); // same length
    expect(narrow.dimensions[1].text).toBe(`${Math.round((HALF_PIPE_DEFAULTS.skinLayer2SheetWidth / 2) * 1000)}mm`);
  });

  it("keeps every rectangle's dimension lines anchored exactly to its own outline corners", () => {
    for (const drawing of [deckBoardPartDrawing(HALF_PIPE_DEFAULTS), joistPartDrawing(HALF_PIPE_DEFAULTS), skinLayer2SheetPartDrawing(HALF_PIPE_DEFAULTS)]) {
      const { minX, maxX, minY, maxY } = outlineBounds(drawing.outline[0]);
      const [lengthDim, heightDim] = drawing.dimensions;
      expect(lengthDim.start).toEqual([minX, minY]);
      expect(lengthDim.end).toEqual([maxX, minY]);
      expect(heightDim.start[0]).toBeCloseTo(maxX, 6);
      expect(heightDim.end[0]).toBeCloseTo(maxX, 6);
      expect(Math.min(heightDim.start[1], heightDim.end[1])).toBeCloseTo(minY, 6);
      expect(Math.max(heightDim.start[1], heightDim.end[1])).toBeCloseTo(maxY, 6);
    }
  });

  it("places the label stack below the outline and its own bottom dimension line, not overlapping either", () => {
    for (const drawing of [deckBoardPartDrawing(HALF_PIPE_DEFAULTS), joistPartDrawing(HALF_PIPE_DEFAULTS), skinLayer2SheetPartDrawing(HALF_PIPE_DEFAULTS)]) {
      const { minY } = outlineBounds(drawing.outline[0]);
      const bottomDim = drawing.dimensions.find((d) => d.offsetDir[1] === -1)!;
      const dimLineY = minY - bottomDim.offsetDistance;
      expect(drawing.labels.anchor[1]).toBeLessThan(dimLineY);
    }
  });
});

describe("ribPartDrawing", () => {
  it("traces the same points the 3D view actually extrudes, converted from meters to mm", () => {
    const drawing = ribPartDrawing(HALF_PIPE_DEFAULTS);
    const expected = ribLocalProfilePoints(HALF_PIPE_DEFAULTS).map(([x, y]) => [x * 1000, y * 1000]);
    expect(drawing.outline).toEqual([expected]);
  });

  it("dimensions the overall height at the deck-outer end, and the base run along the ground", () => {
    const drawing = ribPartDrawing(HALF_PIPE_DEFAULTS);
    const { minX, maxX, minY, maxY } = outlineBounds(drawing.outline[0]);
    const [heightDim, widthDim] = drawing.dimensions;
    expect(heightDim.start).toEqual([maxX, minY]);
    expect(heightDim.end).toEqual([maxX, maxY]);
    expect(widthDim.start).toEqual([minX, minY]);
    expect(widthDim.end).toEqual([maxX, minY]);
    expect(heightDim.text).toBe(`${Math.round(maxY - minY)}mm`);
    expect(widthDim.text).toBe(`${Math.round(maxX - minX)}mm`);
  });

  it("dimensions the flat deck's own top run, from the outer edge to the notch's wall", () => {
    const drawing = ribPartDrawing(HALF_PIPE_DEFAULTS);
    const { maxY } = outlineBounds(drawing.outline[0]);
    const deckTopDim = drawing.dimensions[2];
    expect(deckTopDim.start[1]).toBe(maxY); // the very top of the profile
    expect(deckTopDim.end[1]).toBe(maxY); // horizontal segment
    expect(deckTopDim.text).toBe(`${Math.round(deckBoardLength(HALF_PIPE_DEFAULTS) * 1000)}mm`);
  });

  it("dimensions the small base edge between the ground and the curve's own start, at joistDepthMm", () => {
    const drawing = ribPartDrawing(HALF_PIPE_DEFAULTS);
    const baseEdgeDim = drawing.dimensions[3];
    expect(baseEdgeDim.text).toBe(`${HALF_PIPE_DEFAULTS.joistDepthMm}mm`);
    expect(baseEdgeDim.start[0]).toBe(baseEdgeDim.end[0]); // a vertical segment
    expect(baseEdgeDim.start[1]).toBe(0); // ground level
  });

  it("dimensions the coping notch's own wall and shelf cuts", () => {
    const drawing = ribPartDrawing(HALF_PIPE_DEFAULTS);
    const [, , , , wallDim, shelfDim] = drawing.dimensions;
    expect(wallDim.start[0]).toBe(wallDim.end[0]); // wall is vertical
    expect(Number(wallDim.text.replace("mm", ""))).toBeGreaterThan(0);
    expect(shelfDim.start[1]).toBe(shelfDim.end[1]); // shelf is horizontal
    expect(Number(shelfDim.text.replace("mm", ""))).toBeGreaterThan(0);
  });

  it("places the label stack below the outline and its own bottom (width) dimension line, not overlapping either", () => {
    const drawing = ribPartDrawing(HALF_PIPE_DEFAULTS);
    const { minY } = outlineBounds(drawing.outline[0]);
    const widthDim = drawing.dimensions[1];
    const dimLineY = minY - widthDim.offsetDistance;
    expect(drawing.labels.anchor[1]).toBeLessThan(dimLineY);
  });

  it("labels thickness, radius/angle, and deck length as text rather than as dimension lines", () => {
    const drawing = ribPartDrawing(HALF_PIPE_DEFAULTS);
    const labelText = drawing.labels.lines.join(" | ");
    expect(labelText).toContain(`Thickness: ${HALF_PIPE_DEFAULTS.ribThicknessMm}mm`);
    expect(labelText).toContain(`Radius: ${Math.round(HALF_PIPE_DEFAULTS.radius * 1000)}mm`);
    expect(labelText).toContain(`${HALF_PIPE_DEFAULTS.transitionAngleDeg}°`);
    expect(labelText).toContain(`Deck length: ${Math.round(HALF_PIPE_DEFAULTS.deckLength * 1000)}mm`);
  });
});
