import { describe, expect, it } from "vitest";
import { HistoryStack } from "./history";

describe("HistoryStack", () => {
  it("undoes to the recorded state and redoes back to the current one", () => {
    const history = new HistoryStack<number>();
    history.record(1);
    expect(history.undo(2)).toBe(1);
    expect(history.redo(1)).toBe(2);
  });

  it("is empty at start, so undo/redo are no-ops returning null", () => {
    const history = new HistoryStack<number>();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.undo(1)).toBeNull();
    expect(history.redo(1)).toBeNull();
  });

  it("clears the redo stack once a new change is recorded", () => {
    const history = new HistoryStack<number>();
    history.record(1);
    history.undo(2);
    expect(history.canRedo()).toBe(true);

    history.record(1);
    expect(history.canRedo()).toBe(false);
    expect(history.redo(1)).toBeNull();
  });

  it("reports canUndo/canRedo as entries are pushed and popped", () => {
    const history = new HistoryStack<number>();
    expect(history.canUndo()).toBe(false);
    history.record(1);
    expect(history.canUndo()).toBe(true);
    history.undo(2);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
  });
});
