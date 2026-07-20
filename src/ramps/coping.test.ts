import { describe, expect, it } from "vitest";
import { copingNotch } from "./coping";
import { transitionAndDeckPoints } from "./transition";

describe("copingNotch", () => {
  const radius = 1.8;
  const points = transitionAndDeckPoints(radius, 57, 0, 0.3);
  const [cornerX, cornerY] = points[points.length - 2];
  const pipeRadius = 0.0301; // ~60.3mm OD / 2 in meters
  const h = 0.0032;
  const v = 0.0064;

  it("centers the pipe so it protrudes horizontalProtrusion past the corner's X and verticalProtrusion above the corner's Y", () => {
    const notch = copingNotch(points, radius, pipeRadius, h, v);
    const [cx, cy] = notch.pipeCenter;

    // leftmost point of the pipe (over the ramp, toward the curve) protrudes h past cornerX
    expect(cornerX - (cx - pipeRadius)).toBeCloseTo(h, 10);
    // topmost point of the pipe protrudes v above the deck (cornerY)
    expect(cy + pipeRadius - cornerY).toBeCloseTo(v, 10);
  });

  it("puts the shelf exactly pipe-diameter-minus-verticalProtrusion below the deck", () => {
    const notch = copingNotch(points, radius, pipeRadius, h, v);
    const [, cy] = notch.pipeCenter;
    const shelfY = notch.wallBottom[1];
    expect(shelfY).toBeCloseTo(cy - pipeRadius, 10);
    expect(cornerY - shelfY).toBeCloseTo(2 * pipeRadius - v, 10);
  });

  it("puts the wall tangent to the pipe's rear (deck-facing) side, not the corner's own X", () => {
    const notch = copingNotch(points, radius, pipeRadius, h, v);
    const [cx] = notch.pipeCenter;
    expect(notch.wallBottom[0]).toBeCloseTo(cx + pipeRadius, 10);
    expect(notch.wallTop[0]).toBeCloseTo(cx + pipeRadius, 10);
    expect(notch.wallTop[1]).toBeCloseTo(cornerY, 10);
    // pipe is much bigger than the protrusion specs, so it sits mostly recessed under the
    // deck — the wall lands well past the original corner, not at it
    expect(notch.wallBottom[0]).toBeGreaterThan(cornerX);
  });

  it("finds shelfEnd exactly on the curve (radius from the arc's center, local (0, radius))", () => {
    const notch = copingNotch(points, radius, pipeRadius, h, v);
    const [x, y] = notch.shelfEnd;
    expect(x * x + (y - radius) * (y - radius)).toBeCloseTo(radius * radius, 10);
    expect(y).toBeCloseTo(notch.wallBottom[1], 10); // shelf is horizontal
  });

  it("drops arc points above shelf height from arcCutoffIndex onward", () => {
    const notch = copingNotch(points, radius, pipeRadius, h, v);
    for (let i = 0; i <= notch.arcCutoffIndex; i++) {
      expect(points[i][1]).toBeLessThanOrEqual(notch.wallBottom[1]);
    }
    expect(points[notch.arcCutoffIndex + 1][1]).toBeGreaterThan(notch.wallBottom[1]);
  });

  it("cuts deeper into the arc (smaller arcCutoffIndex) as the pipe gets bigger", () => {
    const small = copingNotch(points, radius, 0.02, h, v);
    const big = copingNotch(points, radius, 0.05, h, v);
    expect(big.arcCutoffIndex).toBeLessThanOrEqual(small.arcCutoffIndex);
  });
});
