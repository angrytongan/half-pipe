/** Generic undo/redo stack of full-state snapshots — the caller owns what a snapshot contains and how to apply one back. */
export class HistoryStack<T> {
  private undoStack: T[] = [];
  private redoStack: T[] = [];

  /** Records `before` as the state to return to, and drops any redo history made stale by this new change. */
  record(before: T): void {
    this.undoStack.push(before);
    this.redoStack = [];
  }

  /** Pops the most recent undo entry, pushing `current` onto the redo stack so it can be replayed. Returns null if there's nothing to undo. */
  undo(current: T): T | null {
    const previous = this.undoStack.pop();
    if (previous === undefined) return null;
    this.redoStack.push(current);
    return previous;
  }

  /** Pops the most recent redo entry, pushing `current` back onto the undo stack. Returns null if there's nothing to redo. */
  redo(current: T): T | null {
    const next = this.redoStack.pop();
    if (next === undefined) return null;
    this.undoStack.push(current);
    return next;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
