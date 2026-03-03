export type FormulaRowNode = {
  id: string;
  kind: "row";
  children: FormulaNode[];
};

export type FormulaLeafKind =
  | "identifier"
  | "number"
  | "operator"
  | "relation"
  | "symbol"
  | "placeholder";

export type FormulaLeafNode = {
  id: string;
  kind: FormulaLeafKind;
  value: string;
};

export type FormulaTextNode = {
  id: string;
  kind: "text";
  body: FormulaRowNode;
};

export type FormulaFractionNode = {
  id: string;
  kind: "fraction";
  numerator: FormulaRowNode;
  denominator: FormulaRowNode;
};

export type FormulaSqrtNode = {
  id: string;
  kind: "sqrt";
  radicand: FormulaRowNode;
};

export type FormulaRootNode = {
  id: string;
  kind: "root";
  index: FormulaRowNode;
  radicand: FormulaRowNode;
};

export type FormulaSupNode = {
  id: string;
  kind: "sup";
  base: FormulaRowNode;
  exponent: FormulaRowNode;
};

export type FormulaSubNode = {
  id: string;
  kind: "sub";
  base: FormulaRowNode;
  subscript: FormulaRowNode;
};

export type FormulaSubSupNode = {
  id: string;
  kind: "subsup";
  base: FormulaRowNode;
  subscript: FormulaRowNode;
  exponent: FormulaRowNode;
};

export type FormulaDelimitedNode = {
  id: string;
  kind: "delimited";
  leftDelimiter: string;
  rightDelimiter: string;
  body: FormulaRowNode;
};

export type FormulaAbsoluteNode = {
  id: string;
  kind: "absolute";
  body: FormulaRowNode;
};

export type FormulaFunctionCallNode = {
  id: string;
  kind: "functionCall";
  name: string;
  argument: FormulaRowNode;
};

export type FormulaIntegralNode = {
  id: string;
  kind: "integral";
  lower: FormulaRowNode;
  upper: FormulaRowNode;
  integrand: FormulaRowNode;
  differential: FormulaRowNode;
};

export type FormulaLimitNode = {
  id: string;
  kind: "limit";
  approach: FormulaRowNode;
  body: FormulaRowNode;
};

export type FormulaSeriesNodeKind = "sum" | "product";

export type FormulaSeriesNode = {
  id: string;
  kind: FormulaSeriesNodeKind;
  lower: FormulaRowNode;
  upper: FormulaRowNode;
  body: FormulaRowNode;
};

export type FormulaMatrixNode = {
  id: string;
  kind: "matrix";
  environment: "matrix" | "pmatrix" | "bmatrix";
  cells: FormulaRowNode[][];
};

export type FormulaVectorNode = {
  id: string;
  kind: "vector";
  environment: "pmatrix" | "bmatrix";
  cells: FormulaRowNode[];
};

export type FormulaCasesNode = {
  id: string;
  kind: "cases";
  rows: Array<{
    id: string;
    value: FormulaRowNode;
    condition: FormulaRowNode;
  }>;
};

export type FormulaAlignedNode = {
  id: string;
  kind: "aligned";
  rows: Array<{
    id: string;
    left: FormulaRowNode;
    right: FormulaRowNode;
  }>;
};

export type FormulaNode =
  | FormulaLeafNode
  | FormulaTextNode
  | FormulaFractionNode
  | FormulaSqrtNode
  | FormulaRootNode
  | FormulaSupNode
  | FormulaSubNode
  | FormulaSubSupNode
  | FormulaDelimitedNode
  | FormulaAbsoluteNode
  | FormulaFunctionCallNode
  | FormulaIntegralNode
  | FormulaLimitNode
  | FormulaSeriesNode
  | FormulaMatrixNode
  | FormulaVectorNode
  | FormulaCasesNode
  | FormulaAlignedNode;

export type MathRange = {
  start: number;
  end: number;
};

export type MathSlotRef = {
  nodeId: string;
  slotName: string;
  rowIndex?: number;
  colIndex?: number;
};

export type SlotPath = MathSlotRef[];

export type MathCursor = {
  rowPath: SlotPath;
  offset: number;
  selection?: MathRange | null;
};

export type MathEditorMode = "structured" | "raw-fallback";

export type MathHistorySnapshot = {
  ast: FormulaRowNode;
  cursor: MathCursor;
  rawLatex: string;
  mode: MathEditorMode;
  importError: string | null;
};

export type MathStructureSessionState = {
  sessionId: string;
  blockIndex: number;
  mode: MathEditorMode;
  ast: FormulaRowNode;
  cursor: MathCursor;
  previewLatex: string;
  lastValidLatex: string;
  importError: string | null;
  history: {
    past: MathHistorySnapshot[];
    future: MathHistorySnapshot[];
  };
  openedFromRaw: boolean;
  initialLatex: string;
  rawLatexDraft: string;
  recentTemplateIds: string[];
  activeCategoryId: string;
};

export type MathEditorDirection = "left" | "right" | "up" | "down";

export type MathEditorCommand =
  | { type: "insertText"; text: string }
  | { type: "insertTemplate"; templateId: string }
  | { type: "wrapSelection"; templateId: string }
  | { type: "replaceNode"; nodeId: string; replacement: FormulaNode[] }
  | { type: "deleteBackward" }
  | { type: "deleteForward" }
  | { type: "moveCursor"; direction: MathEditorDirection; extend?: boolean }
  | { type: "setCursor"; cursor: MathCursor }
  | { type: "setTextNodeValue"; nodeId: string; value: string }
  | { type: "insertMatrixRow"; nodeId: string; index?: number }
  | { type: "insertMatrixColumn"; nodeId: string; index?: number }
  | { type: "removeMatrixRow"; nodeId: string; index: number }
  | { type: "removeMatrixColumn"; nodeId: string; index: number }
  | { type: "insertCasesRow"; nodeId: string; index?: number }
  | { type: "removeCasesRow"; nodeId: string; index: number }
  | { type: "insertAlignedRow"; nodeId: string; index?: number }
  | { type: "removeAlignedRow"; nodeId: string; index: number }
  | { type: "switchToRaw"; reason: string }
  | { type: "setRawLatex"; value: string }
  | { type: "switchToStructured"; ast: FormulaRowNode; latex: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "setActiveCategory"; categoryId: string }
  | { type: "revertSession" };

export type MathImportResult =
  | {
    mode: "structured";
    ast: FormulaRowNode;
    rawLatex: string;
  }
  | {
    mode: "raw-fallback";
    rawLatex: string;
    reason: string;
  };

export type MathTemplateCategoryId =
  | "favorites"
  | "basic"
  | "structures"
  | "analysis"
  | "symbols"
  | "matrices"
  | "functions";

export type MathTemplateDefinition = {
  id: string;
  label: string;
  category: MathTemplateCategoryId;
  nodeFactory: (selectedRow: FormulaRowNode | null) => {
    nodes: FormulaNode[];
    focusSlot: MathSlotRef | null;
  };
  slotOrder: string[];
  keyboardTriggers: string[];
  favoriteDefault: boolean;
};
