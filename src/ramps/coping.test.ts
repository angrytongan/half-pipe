import { describe, expect, it } from "vitest";
import { copingNotch } from "./coping";
import { transitionAndDeckPoints } from "./transition";

describe("copingNotch", () => {
  const radius = 1.8;
  const points = transitionAndDeckPoints(radius, 57, 0.3);
  const [cornerX, cornerY] = points[points.length - 2];
  const pipeRadius = 0.0301; // ~60.3mm OD / 2 in meters
  const h = 0.0032;
  const v = 0.0064;
  const deckThickness = 0.019; // the deck board's own thickness (ribThicknessMm default, in meters)
  const deckTopY = cornerY + deckThickness; // the deck's actual top surface, not the bare corner
  const skinThickness = 0.024; // layer1 + layer2 (12mm + 12mm defaults, in meters)
  const skinTopX = cornerX - skinThickness; // the skinned curve's own surface — toward the ramp's interior, not the bare corner

  it("centers the pipe so it protrudes horizontalProtrusion past the skinned curve surface and verticalProtrusion above the deck's top surface", () => {
    const notch = copingNotch(points, radius, pipeRadius, h, v, deckThickness, skinThickness);
    const [cx, cy] = notch.pipeCenter;

    // leftmost point of the pipe (over the ramp, toward the curve) protrudes h past the skinned surface
    expect(skinTopX - (cx - pipeRadius)).toBeCloseTo(h, 10);
    // topmost point of the pipe protrudes v above the deck's own top surface, not the bare corner
    expect(cy + pipeRadius - deckTopY).toBeCloseTo(v, 10);
  });

  it("puts the shelf exactly pipe-diameter-minus-verticalProtrusion below the deck's top surface", () => {
    const notch = copingNotch(points, radius, pipeRadius, h, v, deckThickness, skinThickness);
    const [, cy] = notch.pipeCenter;
    const shelfY = notch.wallBottom[1];
    expect(shelfY).toBeCloseTo(cy - pipeRadius, 10);
    expect(deckTopY - shelfY).toBeCloseTo(2 * pipeRadius - v, 10);
  });

  it("puts the wall tangent to the pipe's rear (deck-facing) side, not the corner's own X", () => {
    const notch = copingNotch(points, radius, pipeRadius, h, v, deckThickness, skinThickness);
    const [cx] = notch.pipeCenter;
    expect(notch.wallBottom[0]).toBeCloseTo(cx + pipeRadius, 10);
    expect(notch.wallTop[0]).toBeCloseTo(cx + pipeRadius, 10);
    expect(notch.wallTop[1]).toBeCloseTo(cornerY, 10);
    // pipe is much bigger than the protrusion specs, so it sits mostly recessed under the
    // deck — the wall lands well past the original corner, not at it
    expect(notch.wallBottom[0]).toBeGreaterThan(cornerX);
  });

  it("finds shelfEnd exactly on the curve (radius from the arc's center, local (0, radius))", () => {
    const notch = copingNotch(points, radius, pipeRadius, h, v, deckThickness, skinThickness);
    const [x, y] = notch.shelfEnd;
    expect(x * x + (y - radius) * (y - radius)).toBeCloseTo(radius * radius, 10);
    expect(y).toBeCloseTo(notch.wallBottom[1], 10); // shelf is horizontal
  });

  it("returns shelfAngle as shelfEnd's own arc parameter (its tangent angle too)", () => {
    const notch = copingNotch(points, radius, pipeRadius, h, v, deckThickness, skinThickness);
    const [x, y] = notch.shelfEnd;
    expect(radius * Math.sin(notch.shelfAngle)).toBeCloseTo(x, 10);
    expect(radius * (1 - Math.cos(notch.shelfAngle))).toBeCloseTo(y, 10);
  });

  it("drops arc points above shelf height from arcCutoffIndex onward", () => {
    const notch = copingNotch(points, radius, pipeRadius, h, v, deckThickness, skinThickness);
    for (let i = 0; i <= notch.arcCutoffIndex; i++) {
      expect(points[i][1]).toBeLessThanOrEqual(notch.wallBottom[1]);
    }
    expect(points[notch.arcCutoffIndex + 1][1]).toBeGreaterThan(notch.wallBottom[1]);
  });

  it("cuts deeper into the arc (smaller arcCutoffIndex) as the pipe gets bigger", () => {
    const small = copingNotch(points, radius, 0.02, h, v, deckThickness, skinThickness);
    const big = copingNotch(points, radius, 0.05, h, v, deckThickness, skinThickness);
    expect(big.arcCutoffIndex).toBeLessThanOrEqual(small.arcCutoffIndex);
  });

  it("moves the wall (and the whole notch) toward the ramp's interior as skinThickness grows, tracking the skinned surface", () => {
    const bare = copingNotch(points, radius, pipeRadius, h, v, deckThickness, 0);
    const skinned = copingNotch(points, radius, pipeRadius, h, v, deckThickness, skinThickness);
    // toward the ramp (smaller X), not toward the deck — skin sits on the curve's rideable
    // (concave) side, which faces the ramp's interior at this corner, not the deck side.
    expect(skinned.wallTop[0] - bare.wallTop[0]).toBeCloseTo(-skinThickness, 10);
    expect(skinned.wallBottom[0] - bare.wallBottom[0]).toBeCloseTo(-skinThickness, 10);
    expect(skinned.pipeCenter[0] - bare.pipeCenter[0]).toBeCloseTo(-skinThickness, 10);
    // the vertical positioning (deck-side) is untouched by skin thickness
    expect(skinned.wallTop[1]).toBeCloseTo(bare.wallTop[1], 10);
    expect(skinned.pipeCenter[1]).toBeCloseTo(bare.pipeCenter[1], 10);
  });
});
