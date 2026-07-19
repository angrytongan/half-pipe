import { describe, expect, it } from "vitest";
import { buildHalfPipeDimensions } from "./halfPipeDimensions";
import { HALF_PIPE_DEFAULTS } from "../ramps/halfPipe";

describe("buildHalfPipeDimensions", () => {
  it("returns one dimension each for height, length, flat bottom length, and rib spacing, labeled to two decimals", () => {
    const dims = buildHalfPipeDimensions(HALF_PIPE_DEFAULTS);
    expect(dims).toHaveLength(4);
    // height: radius * (1 - cos(60deg)) + flatBottomThicknessMm/1000 = 0.9 + 0.09
    // length: flatBottomLength + 2 * (radius * sin(60deg) + deckLength)
    // flat bottom: flatBottomLength itself
    // spacing: edge rib to the near rib of the doubled seam — width/2 (1.5m) minus half the
    // seam pair's own thickness (ribThicknessMm/2 = 0.0095m), since the seam is built as two
    // ribs, not one shared rib
    expect(dims.map((d) => d.text)).toEqual(["0.99m", "5.57m", "1.25m", "1.49m"]);
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

  it("measures rib spacing as the full width when there are no internal ribs", () => {
    const dims = buildHalfPipeDimensions({ ...HALF_PIPE_DEFAULTS, internalRibCount: 0, width: 2.4 });
    expect(dims[3].text).toBe("2.40m");
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
});
