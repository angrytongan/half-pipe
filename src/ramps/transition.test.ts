import { describe, expect, it } from "vitest";
import { transitionAndDeckPoints, transitionArcPoints, transitionExitDirection } from "./transition";

describe("transitionArcPoints", () => {
  it("starts at the origin", () => {
    expect(transitionArcPoints(2, 90)[0]).toEqual([0, 0]);
  });

  it("reaches (radius, radius) at a 90 degree sweep", () => {
    const points = transitionArcPoints(2, 90);
    const [x, y] = points[points.length - 1];
    expect(x).toBeCloseTo(2);
    expect(y).toBeCloseTo(2);
  });
});

describe("transitionExitDirection", () => {
  it("is vertical at 90 degrees", () => {
    const [x, y] = transitionExitDirection(90);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });

  it("is horizontal at 0 degrees", () => {
    const [x, y] = transitionExitDirection(0);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(0);
  });
});

describe("transitionAndDeckPoints", () => {
  it("extends the deck from the arc's top", () => {
    const points = transitionAndDeckPoints(2, 90, 0.6);
    const [deckStartX, deckStartY] = points[points.length - 2];
    const [deckEndX, deckEndY] = points[points.length - 1];

    expect(deckStartX).toBeCloseTo(2); // archX
    expect(deckStartY).toBeCloseTo(2); // archY
    expect(deckEndX).toBeCloseTo(deckStartX + 0.6);
    expect(deckEndY).toBeCloseTo(deckStartY);
  });
});
