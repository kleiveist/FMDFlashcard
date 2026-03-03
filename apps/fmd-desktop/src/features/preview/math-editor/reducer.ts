import { applyMathEditorCommand, createMathEditorSession } from "./commands";
import type { MathEditorCommand, MathStructureSessionState } from "./types";

export const createInitialMathStructureSession = (
  sessionId: string,
  blockIndex: number,
  rawLatex: string,
): MathStructureSessionState => createMathEditorSession(sessionId, blockIndex, rawLatex);

export const mathStructureReducer = (
  state: MathStructureSessionState,
  command: MathEditorCommand,
) => applyMathEditorCommand(state, command);
