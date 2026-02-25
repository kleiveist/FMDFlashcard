import { describe, expect, it } from "vitest";
import {
  canRedoMarkdownHistory,
  canUndoMarkdownHistory,
  createMarkdownHistory,
  pushMarkdownHistory,
  redoMarkdownHistory,
  undoMarkdownHistory,
} from "./markdownHistory";

describe("markdownHistory", () => {
  it("undos and redos multiple committed snapshots", () => {
    let history = createMarkdownHistory("A");
    history = pushMarkdownHistory(history, "B", "block-commit");
    history = pushMarkdownHistory(history, "C", "block-commit");

    expect(history.present.markdown).toBe("C");
    expect(canUndoMarkdownHistory(history)).toBe(true);

    history = undoMarkdownHistory(history);
    expect(history.present.markdown).toBe("B");
    expect(canRedoMarkdownHistory(history)).toBe(true);

    history = undoMarkdownHistory(history);
    expect(history.present.markdown).toBe("A");

    history = redoMarkdownHistory(history);
    expect(history.present.markdown).toBe("B");

    history = redoMarkdownHistory(history);
    expect(history.present.markdown).toBe("C");
  });

  it("clears redo stack when a new commit is pushed after undo", () => {
    let history = createMarkdownHistory("A");
    history = pushMarkdownHistory(history, "B", "block-commit");
    history = pushMarkdownHistory(history, "C", "block-commit");
    history = undoMarkdownHistory(history);
    expect(history.present.markdown).toBe("B");

    history = pushMarkdownHistory(history, "B2", "block-commit");
    expect(history.present.markdown).toBe("B2");
    expect(canRedoMarkdownHistory(history)).toBe(false);
  });
});

