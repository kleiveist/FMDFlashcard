import {
  buildCursorForSlot,
  cloneRow,
  createCharacterNodes,
  createRow,
  insertNodesIntoRow,
  isRowEmpty,
  locateRowByPath,
  removeNodeById,
  removeRowSlice,
  replaceNodeById,
  replaceRowAtPath,
} from "./ast";
import { moveCursorHorizontally, moveCursorVertically } from "./cursor";
import { buildSelectedRowFromNodes, getMathTemplateById, resolveTemplateFromTrigger } from "./palette";
import { importMathLatex } from "./importer";
import { isSerializableMathTree, serializeRow } from "./serializer";
import { normalizeCursor } from "./slotTraversal";
import type {
  FormulaAlignedNode,
  FormulaCasesNode,
  FormulaMatrixNode,
  FormulaRowNode,
  MathCursor,
  MathEditorCommand,
  MathHistorySnapshot,
  MathStructureSessionState,
} from "./types";

const createSnapshot = (state: MathStructureSessionState): MathHistorySnapshot => ({
  ast: cloneRow(state.ast),
  cursor: {
    rowPath: [...state.cursor.rowPath],
    offset: state.cursor.offset,
    selection: state.cursor.selection ? { ...state.cursor.selection } : null,
  },
  rawLatex: state.rawLatexDraft,
  mode: state.mode,
  importError: state.importError,
});

const pushSnapshot = (state: MathStructureSessionState): MathStructureSessionState => ({
  ...state,
  history: {
    past: [...state.history.past, createSnapshot(state)].slice(-100),
    future: [],
  },
});

const applyStructuredPayload = (
  state: MathStructureSessionState,
  ast: FormulaRowNode,
  cursor: MathCursor,
): MathStructureSessionState => {
  const normalizedAst = cloneRow(ast);
  const normalizedCursor = normalizeCursor(normalizedAst, cursor);
  const previewLatex = isSerializableMathTree(normalizedAst) ? serializeRow(normalizedAst).trim() : state.previewLatex;
  const validation = importMathLatex(previewLatex);
  const validLatex = validation.mode === "structured" ? previewLatex : state.lastValidLatex;
  return {
    ...state,
    mode: "structured",
    ast: normalizedAst,
    cursor: normalizedCursor,
    previewLatex,
    lastValidLatex: validLatex,
    rawLatexDraft: previewLatex,
    importError: validation.mode === "structured" ? null : validation.reason,
    openedFromRaw: false,
  };
};

const deleteNodeBeforeEmptySlot = (
  state: MathStructureSessionState,
): { ast: FormulaRowNode; cursor: MathCursor } | null => {
  const path = state.cursor.rowPath;
  if (path.length === 0) {
    return null;
  }
  const currentSlot = path[path.length - 1];
  if (!currentSlot) {
    return null;
  }
  const nextAst = removeNodeById(state.ast, currentSlot.nodeId);
  const parentPath = path.slice(0, -1);
  const parentRow = locateRowByPath(nextAst, parentPath)?.row ?? nextAst;
  return {
    ast: nextAst,
    cursor: {
      rowPath: parentPath,
      offset: Math.min(state.cursor.offset, parentRow.children.length),
      selection: null,
    },
  };
};

const applyInsertText = (state: MathStructureSessionState, text: string) => {
  const located = locateRowByPath(state.ast, state.cursor.rowPath);
  if (!located) {
    return state;
  }
  const template = resolveTemplateFromTrigger(text);
  if (template && text.length > 1) {
    return applyTemplateCommand(state, template.id);
  }
  const nextRow = insertNodesIntoRow(
    located.row,
    state.cursor.offset,
    createCharacterNodes(text),
    state.cursor.selection ?? null,
  );
  const nextAst = replaceRowAtPath(state.ast, state.cursor.rowPath, () => nextRow);
  const selectionStart = state.cursor.selection
    ? Math.min(state.cursor.selection.start, state.cursor.selection.end)
    : state.cursor.offset;
  return applyStructuredPayload(
    pushSnapshot(state),
    nextAst,
    {
      rowPath: state.cursor.rowPath,
      offset: selectionStart + text.length,
      selection: null,
    },
  );
};

const applyTemplateCommand = (state: MathStructureSessionState, templateId: string) => {
  const template = getMathTemplateById(templateId);
  if (!template) {
    return state;
  }
  const located = locateRowByPath(state.ast, state.cursor.rowPath);
  if (!located) {
    return state;
  }
  const selection = state.cursor.selection
    ? {
      start: Math.min(state.cursor.selection.start, state.cursor.selection.end),
      end: Math.max(state.cursor.selection.start, state.cursor.selection.end),
    }
    : null;
  const selectedNodes = selection
    ? located.row.children.slice(selection.start, selection.end)
    : [];
  const selectedRow = selection && selectedNodes.length > 0 ? buildSelectedRowFromNodes(selectedNodes) : null;
  const insertion = template.nodeFactory(selectedRow);
  const insertionStart = selection ? selection.start : state.cursor.offset;
  const nextRow = insertNodesIntoRow(located.row, state.cursor.offset, insertion.nodes, selection);
  const nextAst = replaceRowAtPath(state.ast, state.cursor.rowPath, () => nextRow);
  if (insertion.focusSlot) {
    const nextPath = [...state.cursor.rowPath, insertion.focusSlot];
    return applyStructuredPayload(
      pushSnapshot(state),
      nextAst,
      buildCursorForSlot(nextPath, 0),
    );
  }
  return applyStructuredPayload(
    pushSnapshot(state),
    nextAst,
    {
      rowPath: state.cursor.rowPath,
      offset: insertionStart + insertion.nodes.length,
      selection: null,
    },
  );
};

const applyDeleteCommand = (state: MathStructureSessionState, direction: "backward" | "forward") => {
  const located = locateRowByPath(state.ast, state.cursor.rowPath);
  if (!located) {
    return state;
  }
  const selection = state.cursor.selection
    ? {
      start: Math.min(state.cursor.selection.start, state.cursor.selection.end),
      end: Math.max(state.cursor.selection.start, state.cursor.selection.end),
    }
    : null;
  if (selection && selection.start !== selection.end) {
    const nextRow = removeRowSlice(located.row, selection.start, selection.end);
    const nextAst = replaceRowAtPath(state.ast, state.cursor.rowPath, () => nextRow);
    return applyStructuredPayload(
      pushSnapshot(state),
      nextAst,
      { rowPath: state.cursor.rowPath, offset: selection.start, selection: null },
    );
  }
  if (direction === "backward" && state.cursor.offset > 0) {
    const nextRow = removeRowSlice(located.row, state.cursor.offset - 1, state.cursor.offset);
    const nextAst = replaceRowAtPath(state.ast, state.cursor.rowPath, () => nextRow);
    return applyStructuredPayload(
      pushSnapshot(state),
      nextAst,
      { rowPath: state.cursor.rowPath, offset: state.cursor.offset - 1, selection: null },
    );
  }
  if (direction === "forward" && state.cursor.offset < located.row.children.length) {
    const nextRow = removeRowSlice(located.row, state.cursor.offset, state.cursor.offset + 1);
    const nextAst = replaceRowAtPath(state.ast, state.cursor.rowPath, () => nextRow);
    return applyStructuredPayload(
      pushSnapshot(state),
      nextAst,
      { rowPath: state.cursor.rowPath, offset: state.cursor.offset, selection: null },
    );
  }
  if (isRowEmpty(located.row)) {
    const deleted = deleteNodeBeforeEmptySlot(state);
    if (deleted) {
      return applyStructuredPayload(pushSnapshot(state), deleted.ast, deleted.cursor);
    }
  }
  return state;
};

const updateMatrixNode = (
  node: FormulaMatrixNode,
  updater: (node: FormulaMatrixNode) => FormulaMatrixNode,
) => updater(node);

const updateCasesNode = (
  node: FormulaCasesNode,
  updater: (node: FormulaCasesNode) => FormulaCasesNode,
) => updater(node);

const updateAlignedNode = (
  node: FormulaAlignedNode,
  updater: (node: FormulaAlignedNode) => FormulaAlignedNode,
) => updater(node);

const applyNodeMutation = (
  state: MathStructureSessionState,
  _nodeId: string,
  mutate: (ast: FormulaRowNode) => FormulaRowNode,
) => applyStructuredPayload(pushSnapshot(state), mutate(state.ast), state.cursor);

export const createMathEditorSession = (
  sessionId: string,
  blockIndex: number,
  rawLatex: string,
): MathStructureSessionState => {
  const imported = importMathLatex(rawLatex);
  if (imported.mode === "structured") {
    return {
      sessionId,
      blockIndex,
      mode: "structured",
      ast: imported.ast,
      cursor: buildCursorForSlot([], imported.ast.children.length),
      previewLatex: imported.rawLatex,
      lastValidLatex: imported.rawLatex,
      importError: null,
      history: { past: [], future: [] },
      openedFromRaw: false,
      initialLatex: rawLatex,
      rawLatexDraft: imported.rawLatex,
      canvasZoom: 125,
    };
  }
  return {
    sessionId,
    blockIndex,
    mode: "raw-fallback",
    ast: createRow(),
    cursor: buildCursorForSlot([], 0),
    previewLatex: rawLatex,
    lastValidLatex: rawLatex,
    importError: imported.reason,
    history: { past: [], future: [] },
    openedFromRaw: true,
    initialLatex: rawLatex,
    rawLatexDraft: rawLatex,
    canvasZoom: 125,
  };
};

export const applyMathEditorCommand = (
  state: MathStructureSessionState,
  command: MathEditorCommand,
): MathStructureSessionState => {
  switch (command.type) {
    case "insertText":
      return state.mode === "structured" ? applyInsertText(state, command.text) : state;
    case "insertTemplate":
    case "wrapSelection":
      return state.mode === "structured" ? applyTemplateCommand(state, command.templateId) : state;
    case "deleteBackward":
      return state.mode === "structured" ? applyDeleteCommand(state, "backward") : state;
    case "deleteForward":
      return state.mode === "structured" ? applyDeleteCommand(state, "forward") : state;
    case "moveCursor":
      if (state.mode !== "structured") {
        return state;
      }
      if (command.direction === "left" || command.direction === "right") {
        return {
          ...state,
          cursor: moveCursorHorizontally(state.ast, state.cursor, command.direction, command.extend),
        };
      }
      return {
        ...state,
        cursor: moveCursorVertically(state.ast, state.cursor, command.direction),
      };
    case "setCursor":
      return state.mode !== "structured"
        ? state
        : {
          ...state,
          cursor: normalizeCursor(state.ast, command.cursor),
        };
    case "insertMatrixRow":
      return applyNodeMutation(state, command.nodeId, (ast) =>
        replaceNodeById(ast, command.nodeId, (node) => {
          if (node.kind !== "matrix") {
            return node;
          }
          const index = Math.max(0, Math.min(command.index ?? node.cells.length, node.cells.length));
          return updateMatrixNode(node, (current) => ({
            ...current,
            cells: [
              ...current.cells.slice(0, index),
              Array.from({ length: current.cells[0]?.length ?? 1 }, () => createRow()),
              ...current.cells.slice(index),
            ],
          }));
        }),
      );
    case "insertMatrixColumn":
      return applyNodeMutation(state, command.nodeId, (ast) =>
        replaceNodeById(ast, command.nodeId, (node) => {
          if (node.kind !== "matrix") {
            return node;
          }
          const columnIndex = Math.max(0, Math.min(command.index ?? (node.cells[0]?.length ?? 0), node.cells[0]?.length ?? 0));
          return updateMatrixNode(node, (current) => ({
            ...current,
            cells: current.cells.map((row) => [
              ...row.slice(0, columnIndex),
              createRow(),
              ...row.slice(columnIndex),
            ]),
          }));
        }),
      );
    case "removeMatrixRow":
      return applyNodeMutation(state, command.nodeId, (ast) =>
        replaceNodeById(ast, command.nodeId, (node) => {
          if (node.kind !== "matrix" || node.cells.length <= 1) {
            return node;
          }
          return updateMatrixNode(node, (current) => ({
            ...current,
            cells: current.cells.filter((_row, index) => index !== command.index),
          }));
        }),
      );
    case "removeMatrixColumn":
      return applyNodeMutation(state, command.nodeId, (ast) =>
        replaceNodeById(ast, command.nodeId, (node) => {
          if (node.kind !== "matrix" || (node.cells[0]?.length ?? 0) <= 1) {
            return node;
          }
          return updateMatrixNode(node, (current) => ({
            ...current,
            cells: current.cells.map((row) => row.filter((_cell, index) => index !== command.index)),
          }));
        }),
      );
    case "insertCasesRow":
      return applyNodeMutation(state, command.nodeId, (ast) =>
        replaceNodeById(ast, command.nodeId, (node) => {
          if (node.kind !== "cases") {
            return node;
          }
          const index = Math.max(0, Math.min(command.index ?? node.rows.length, node.rows.length));
          return updateCasesNode(node, (current) => ({
            ...current,
            rows: [
              ...current.rows.slice(0, index),
              { id: `${node.id}-case-${Date.now()}`, value: createRow(), condition: createRow() },
              ...current.rows.slice(index),
            ],
          }));
        }),
      );
    case "removeCasesRow":
      return applyNodeMutation(state, command.nodeId, (ast) =>
        replaceNodeById(ast, command.nodeId, (node) => {
          if (node.kind !== "cases" || node.rows.length <= 1) {
            return node;
          }
          return updateCasesNode(node, (current) => ({
            ...current,
            rows: current.rows.filter((_row, index) => index !== command.index),
          }));
        }),
      );
    case "insertAlignedRow":
      return applyNodeMutation(state, command.nodeId, (ast) =>
        replaceNodeById(ast, command.nodeId, (node) => {
          if (node.kind !== "aligned") {
            return node;
          }
          const index = Math.max(0, Math.min(command.index ?? node.rows.length, node.rows.length));
          return updateAlignedNode(node, (current) => ({
            ...current,
            rows: [
              ...current.rows.slice(0, index),
              { id: `${node.id}-aligned-${Date.now()}`, left: createRow(), right: createRow() },
              ...current.rows.slice(index),
            ],
          }));
        }),
      );
    case "removeAlignedRow":
      return applyNodeMutation(state, command.nodeId, (ast) =>
        replaceNodeById(ast, command.nodeId, (node) => {
          if (node.kind !== "aligned" || node.rows.length <= 1) {
            return node;
          }
          return updateAlignedNode(node, (current) => ({
            ...current,
            rows: current.rows.filter((_row, index) => index !== command.index),
          }));
        }),
      );
    case "switchToRaw":
      return {
        ...pushSnapshot(state),
        mode: "raw-fallback",
        rawLatexDraft: state.previewLatex,
        importError: command.reason,
      };
    case "setRawLatex":
      return {
        ...state,
        rawLatexDraft: command.value,
        previewLatex: command.value,
      };
    case "switchToStructured":
      return applyStructuredPayload(
        pushSnapshot(state),
        command.ast,
        buildCursorForSlot([], command.ast.children.length),
      );
    case "undo": {
      const previous = state.history.past[state.history.past.length - 1];
      if (!previous) {
        return state;
      }
      return {
        ...state,
        ast: cloneRow(previous.ast),
        cursor: previous.cursor,
        mode: previous.mode,
        rawLatexDraft: previous.rawLatex,
        previewLatex: previous.rawLatex,
        lastValidLatex: previous.rawLatex,
        importError: previous.importError,
        history: {
          past: state.history.past.slice(0, -1),
          future: [createSnapshot(state), ...state.history.future].slice(0, 100),
        },
      };
    }
    case "redo": {
      const [next, ...rest] = state.history.future;
      if (!next) {
        return state;
      }
      return {
        ...state,
        ast: cloneRow(next.ast),
        cursor: next.cursor,
        mode: next.mode,
        rawLatexDraft: next.rawLatex,
        previewLatex: next.rawLatex,
        lastValidLatex: next.rawLatex,
        importError: next.importError,
        history: {
          past: [...state.history.past, createSnapshot(state)].slice(-100),
          future: rest,
        },
      };
    }
    case "setCanvasZoom":
      return {
        ...state,
        canvasZoom: command.zoom,
      };
    case "revertSession":
      return createMathEditorSession(state.sessionId, state.blockIndex, state.initialLatex);
    case "replaceNode":
    case "setTextNodeValue":
      return state;
  }
};
