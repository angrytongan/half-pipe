import { describe, expect, it } from "vitest";
import { buildHalfPipeDimensions } from "./halfPipeDimensions";
import { HALF_PIPE_DEFAULTS } from "../ramps/halfPipe";
import { ribZPositions } from "../ramps/ribs";

describe("buildHalfPipeDimensions", () => {
  it("returns one dimension each for height, length, flat bottom length, rib spacing, and width, labeled to two decimals", () => {
    const dims = buildHalfPipeDimensions(HALF_PIPE_DEFAULTS);
    expect(dims).toHaveLength(5);
    // height: radius * (1 - cos(60deg)) + flatBottomThicknessMm/1000 = 0.9 + 0.09
    // length: flatBottomLength + 2 * (radius * sin(60deg) + deckLength)
    // flat bottom: flatBottomLength itself
    // spacing: inside surface to inside surface, not centerline — the centerline gap
    // (edge rib to the near rib of the doubled seam, 1.4905m) minus one full rib thickness
    // (ribThicknessMm/1000 = 0.019m), since each rib eats half its own thickness into the gap
    // width: outside surface to outside surface, not centerline — the width param plus one
    // full rib thickness, since each edge rib sticks out half its own thickness beyond width/2
    expect(dims.map((d) => d.text)).toEqual(["0.99m", "5.57m", "1.25m", "1.47m", "3.02m"]);
  });

  it("computes width as the centerline width plus one rib thickness, and rib spacing as the centerline gap minus one rib thickness", () => {
    const params = { ...HALF_PIPE_DEFAULTS, width: 3.5, ribThicknessMm: 25 };
    const ribThickness = params.ribThicknessMm / 1000;
    const dims = buildHalfPipeDimensions(params);

    const widthValue = Number(dims[4].text.replace("m", ""));
    expect(widthValue).toBe(Number((params.width + ribThickness).toFixed(2)));

    const positions = ribZPositions(params.width, params.internalRibCount, ribThickness);
    const centerToCenterGap = positions[1] - positions[0];
    const spacingValue = Number(dims[3].text.replace("m", ""));
    expect(spacingValue).toBe(Number((centerToCenterGap - ribThickness).toFixed(2)));
  });

  it("measures a section width slightly under the naive width/(internalRibCount+1), since the seam's two ribs eat into it", () => {
    const dims = buildHalfPipeDimensions(HALF_PIPE_DEFAULTS);
    const spacing = Number(dims[3].text.replace("m", ""));
    const naive = HALF_PIPE_DEFAULTS.width / (HALF_PIPE_DEFAULTS.internalRibCount + 1);
    expect(spacing).toBeLessThan(naive);
  });

  it("shrinks the rib-spacing dimension as internalRibCount grows, for the same width", () => {
    const fewer = buildHalfPipeDimensions({ ...HALF_PIPE_DEFAULTS, internalRibCount: 1 });
    const more = buildHalfPipeDimensions({ ...HALF_PIPE_DEFAULTS, internalRibCount: 5 });
    const spacingOf = (dims: ReturnType<typeof buildHalfPipeDimensions>) => Number(dims[3].text.replace("m", ""));
    expect(spacingOf(more)).toBeLessThan(spacingOf(fewer));
  });

  it("measures rib spacing as the width minus one rib thickness when there are no internal ribs", () => {
    const dims = buildHalfPipeDimensions({ ...HALF_PIPE_DEFAULTS, internalRibCount: 0, width: 2.4 });
    expect(dims[3].text).toBe("2.38m"); // 2.4 - 0.019 (default ribThicknessMm 19)
  });

  it("relabels the flat bottom length dimension as flatBottomLength changes", () => {
    const dims = buildHalfPipeDimensions({ ...HALF_PIPE_DEFAULTS, flatBottomLength: 2 });
    expect(dims[2].text).toBe("2.00m");
  });

  it("places the height dimension on the opposite side from the length dimension", () => {
    const [heightDim, lengthDim] = buildHalfPipeDimensions(HALF_PIPE_DEFAULTS);
    const ribZ = -HALF_PIPE_DEFAULTS.width / 2; // the edge rib these two are offset from
    expect(heightDim.labelPosition.z).toBeGreaterThan(ribZ);
    expect(lengthDim.labelPosition.z).toBeLessThan(ribZ);
  });

  it("places the flat-bottom-length dimension at the opposite edge rib from the overall-length one, so their labels never share a screen position", () => {
    const [, lengthDim, flatBottomDim] = buildHalfPipeDimensions(HALF_PIPE_DEFAULTS);
    const halfWidth = HALF_PIPE_DEFAULTS.width / 2;
    expect(lengthDim.labelPosition.z).toBeCloseTo(-halfWidth - 0.4 - 0.08, 2);
    expect(flatBottomDim.labelPosition.z).toBeCloseTo(halfWidth + 0.4 + 0.08, 2);
  });

  it("relabels the width dimension as width changes", () => {
    const dims = buildHalfPipeDimensions({ ...HALF_PIPE_DEFAULTS, width: 4 });
    expect(dims[4].text).toBe("4.02m"); // 4 + 0.019 (default ribThicknessMm 19)
  });

  it("places the width dimension on the opposite X side from the rib-spacing dimension, at a distinct anchor from every other dimension", () => {
    const [heightDim, lengthDim, flatBottomDim, spacingDim, widthDim] = buildHalfPipeDimensions(HALF_PIPE_DEFAULTS);

    expect(widthDim.labelPosition.x).toBeLessThan(spacingDim.labelPosition.x);
    for (const other of [heightDim, lengthDim, flatBottomDim, spacingDim]) {
      expect(widthDim.labelPosition.distanceTo(other.labelPosition)).toBeGreaterThan(0.5);
    }
  });
});
