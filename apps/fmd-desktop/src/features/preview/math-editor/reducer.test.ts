import { describe, expect, it } from "vitest";
import { createInitialMathStructureSession, mathStructureReducer } from "./reducer";

describe("math-editor reducer", () => {
  it("inserts a fraction template and live latex stays valid", () => {
    let state = createInitialMathStructureSession("session-1", 0, "");
    state = mathStructureReducer(state, { type: "insertTemplate", templateId: "fraction" });

    expect(state.mode).toBe("structured");
    expect(state.lastValidLatex).toBe(String.raw`\frac{}{}`);
    expect(state.cursor.rowPath).toHaveLength(1);
  });

  it("switches to raw fallback for unsupported input and back to structured when parsing succeeds", () => {
    let state = createInitialMathStructureSession("session-2", 0, String.raw`\unknownmacro{x}`);
    expect(state.mode).toBe("raw-fallback");

    state = mathStructureReducer(state, {
      type: "switchToStructured",
      ast: createInitialMathStructureSession("session-3", 0, String.raw`\frac{a}{b}`).ast,
      latex: String.raw`\frac{a}{b}`,
    });

    expect(state.mode).toBe("structured");
    expect(state.lastValidLatex).toBe(String.raw`\frac{a}{b}`);
  });
});
