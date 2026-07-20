import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildHalfPipeDimensions } from "./halfPipeDimensions";
import { HALF_PIPE_DEFAULTS } from "../ramps/halfPipe";
import { ribZPositions } from "../ramps/ribs";

describe("buildHalfPipeDimensions", () => {
  it("returns one dimension each for height, length, bottom transition length, rib spacing, width, and rib width, labeled to two decimals", () => {
    const dims = buildHalfPipeDimensions(HALF_PIPE_DEFAULTS);
    expect(dims).toHaveLength(6);
    // height: radius * (1 - cos(57deg)) + joistDepthMm/1000 = 0.8196... + 0.09
    // length: bottomTransitionLength + 2 * (radius * sin(57deg) + deckLength)
    // bottom transition: bottomTransitionLength itself
    // spacing: inside surface to inside surface, not centerline — the centerline gap (edge rib
    // to the near rib of the doubled seam, 1.481m — the edge rib is itself inset half its own
    // thickness in from width/2) minus one full rib thickness (ribThicknessMm/1000 = 0.019m),
    // since each rib eats half its own thickness into the gap
    // width: outside surface to outside surface, which is exactly the width param — the edge
    // ribs are inset (see ribZPositions) so the structure has no overhang past it
    // rib width: one rib's own X-extent, from its base (bottommost curve joist's inside face,
    // half/2 - joistThicknessMm/1000/2 = 1.1025) out to its own deck outer edge (halfLength =
    // 2.9346...) = 1.8321...
    expect(dims.map((d) => d.text)).toEqual(["0.91m", "5.87m", "2.25m", "1.46m", "3.00m", "1.83m"]);
  });

  it("computes width as exactly the width param (edge ribs are inset, no overhang), and rib spacing as the centerline gap minus one rib thickness", () => {
    const params = { ...HALF_PIPE_DEFAULTS, width: 3.5, ribThicknessMm: 25 };
    const ribThickness = params.ribThicknessMm / 1000;
    const dims = buildHalfPipeDimensions(params);

    const widthValue = Number(dims[4].text.replace("m", ""));
    expect(widthValue).toBe(Number(params.width.toFixed(2)));

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

  it("measures rib spacing as the width minus two rib thicknesses when there are no internal ribs (both edge ribs are now fully inset)", () => {
    const dims = buildHalfPipeDimensions({ ...HALF_PIPE_DEFAULTS, internalRibCount: 0, width: 2.4 });
    expect(dims[3].text).toBe("2.36m"); // 2.4 - 2 * 0.019 (default ribThicknessMm 19)
  });

  it("relabels the bottom transition length dimension as bottomTransitionLength changes", () => {
    const dims = buildHalfPipeDimensions({ ...HALF_PIPE_DEFAULTS, bottomTransitionLength: 2 });
    expect(dims[2].text).toBe("2.00m");
  });

  it("places the height dimension on the opposite side from the length dimension", () => {
    const [heightDim, lengthDim] = buildHalfPipeDimensions(HALF_PIPE_DEFAULTS);
    const ribZ = -HALF_PIPE_DEFAULTS.width / 2; // the edge rib these two are offset from
    expect(heightDim.labelPosition.z).toBeGreaterThan(ribZ);
    expect(lengthDim.labelPosition.z).toBeLessThan(ribZ);
  });

  it("places the bottom-transition-length dimension at the opposite edge rib from the overall-length one, so their labels never share a screen position", () => {
    const [, lengthDim, bottomTransitionDim] = buildHalfPipeDimensions(HALF_PIPE_DEFAULTS);
    const halfWidth = HALF_PIPE_DEFAULTS.width / 2;
    expect(lengthDim.labelPosition.z).toBeCloseTo(-halfWidth - 0.4 - 0.08, 2);
    expect(bottomTransitionDim.labelPosition.z).toBeCloseTo(halfWidth + 0.4 + 0.08, 2);
  });

  it("relabels the width dimension as width changes", () => {
    const dims = buildHalfPipeDimensions({ ...HALF_PIPE_DEFAULTS, width: 4 });
    expect(dims[4].text).toBe("4.00m");
  });

  it("places the width dimension on the opposite X side from the rib-spacing dimension, at a distinct anchor from every other dimension", () => {
    const [heightDim, lengthDim, bottomTransitionDim, spacingDim, widthDim] = buildHalfPipeDimensions(HALF_PIPE_DEFAULTS);

    expect(widthDim.labelPosition.x).toBeLessThan(spacingDim.labelPosition.x);
    for (const other of [heightDim, lengthDim, bottomTransitionDim, spacingDim]) {
      expect(widthDim.labelPosition.distanceTo(other.labelPosition)).toBeGreaterThan(0.5);
    }
  });

  it("measures the rib width as one rib's own X-extent (base to its own deck outer edge) — excludes the bottom transition entirely, unlike the overall length", () => {
    const params = { ...HALF_PIPE_DEFAULTS, joistThicknessMm: 60 };
    const dims = buildHalfPipeDimensions(params);
    const ribWidthValue = Number(dims[5].text.replace("m", ""));

    // deckOuterX (radius*sin(57deg) + deckLength) + half the joist thickness — the rib doesn't
    // span any of bottomTransitionLength at all, that's buildBottomTransitionFrame's own piece.
    const sweep = (params.transitionAngleDeg * Math.PI) / 180;
    const deckOuterX = params.radius * Math.sin(sweep) + params.deckLength;
    const expected = deckOuterX + params.joistThicknessMm / 1000 / 2;
    expect(ribWidthValue).toBeCloseTo(Number(expected.toFixed(2)), 2);

    const lengthValue = Number(dims[1].text.replace("m", ""));
    expect(ribWidthValue).toBeLessThan(lengthValue / 2); // nowhere near half the overall length
  });

  it("grows the rib width dimension as joistThicknessMm grows — the base insets further away from the fixed deck edge, not toward it", () => {
    const thin = buildHalfPipeDimensions({ ...HALF_PIPE_DEFAULTS, joistThicknessMm: 30 });
    const thick = buildHalfPipeDimensions({ ...HALF_PIPE_DEFAULTS, joistThicknessMm: 90 });
    const ribWidthOf = (dims: ReturnType<typeof buildHalfPipeDimensions>) => Number(dims[5].text.replace("m", ""));
    expect(ribWidthOf(thick)).toBeGreaterThan(ribWidthOf(thin));
  });

  it("draws the rib width dimension's own offset line at the same corner the height dimension's offset line ends at, forming a corner bracket", () => {
    const [heightDim, , , , , ribWidthDim] = buildHalfPipeDimensions(HALF_PIPE_DEFAULTS);

    // The offset dimension line itself is the 3rd Line child (see buildLinearDimension: the
    // two extension lines, then the offset line connecting them).
    const offsetLineEndpoints = (dim: ReturnType<typeof buildHalfPipeDimensions>[number]) => {
      const offsetLine = dim.group.children[2] as THREE.Line;
      const positions = offsetLine.geometry.getAttribute("position");
      return [new THREE.Vector3().fromBufferAttribute(positions, 0), new THREE.Vector3().fromBufferAttribute(positions, 1)];
    };

    const [, heightLineTop] = offsetLineEndpoints(heightDim); // (-halfLength, height, -halfWidth+0.4)
    const [, ribWidthLineEnd] = offsetLineEndpoints(ribWidthDim); // (-halfLength, height, -halfWidth+0.4)

    expect(ribWidthLineEnd.distanceTo(heightLineTop)).toBeCloseTo(0, 6);
  });
});
