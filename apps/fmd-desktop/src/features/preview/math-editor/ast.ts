import type {
  FormulaAbsoluteNode,
  FormulaAlignedNode,
  FormulaCasesNode,
  FormulaDelimitedNode,
  FormulaFractionNode,
  FormulaFunctionCallNode,
  FormulaIntegralNode,
  FormulaLeafKind,
  FormulaLeafNode,
  FormulaLimitNode,
  FormulaMatrixNode,
  FormulaNode,
  FormulaRootNode,
  FormulaRowNode,
  FormulaSeriesNode,
  FormulaSubNode,
  FormulaSubSupNode,
  FormulaSupNode,
  FormulaSqrtNode,
  FormulaTextNode,
  FormulaVectorNode,
  MathCursor,
  MathSlotRef,
  SlotPath,
} from "./types";

let mathNodeIdCounter = 0;

export const createMathNodeId = (prefix = "math") => {
  mathNodeIdCounter += 1;
  return `${prefix}-${mathNodeIdCounter}`;
};

export const createRow = (children: FormulaNode[] = []): FormulaRowNode => ({
  id: createMathNodeId("row"),
  kind: "row",
  children,
});

export const createLeaf = (kind: FormulaLeafKind, value: string): FormulaLeafNode => ({
  id: createMathNodeId(kind),
  kind,
  value,
});

export const createTextNode = (text = ""): FormulaTextNode => ({
  id: createMathNodeId("text"),
  kind: "text",
  body: createRow(createCharacterNodes(text)),
});

export const createFractionNode = (
  numerator: FormulaRowNode = createRow(),
  denominator: FormulaRowNode = createRow(),
): FormulaFractionNode => ({
  id: createMathNodeId("fraction"),
  kind: "fraction",
  numerator,
  denominator,
});

export const createSqrtNode = (radicand: FormulaRowNode = createRow()): FormulaSqrtNode => ({
  id: createMathNodeId("sqrt"),
  kind: "sqrt",
  radicand,
});

export const createRootNode = (
  index: FormulaRowNode = createRow(),
  radicand: FormulaRowNode = createRow(),
): FormulaRootNode => ({
  id: createMathNodeId("root"),
  kind: "root",
  index,
  radicand,
});

export const createSupNode = (
  base: FormulaRowNode = createRow(),
  exponent: FormulaRowNode = createRow(),
): FormulaSupNode => ({
  id: createMathNodeId("sup"),
  kind: "sup",
  base,
  exponent,
});

export const createSubNode = (
  base: FormulaRowNode = createRow(),
  subscript: FormulaRowNode = createRow(),
): FormulaSubNode => ({
  id: createMathNodeId("sub"),
  kind: "sub",
  base,
  subscript,
});

export const createSubSupNode = (
  base: FormulaRowNode = createRow(),
  subscript: FormulaRowNode = createRow(),
  exponent: FormulaRowNode = createRow(),
): FormulaSubSupNode => ({
  id: createMathNodeId("subsup"),
  kind: "subsup",
  base,
  subscript,
  exponent,
});

export const createDelimitedNode = (
  leftDelimiter = "(",
  rightDelimiter = ")",
  body: FormulaRowNode = createRow(),
): FormulaDelimitedNode => ({
  id: createMathNodeId("delimited"),
  kind: "delimited",
  leftDelimiter,
  rightDelimiter,
  body,
});

export const createAbsoluteNode = (body: FormulaRowNode = createRow()): FormulaAbsoluteNode => ({
  id: createMathNodeId("absolute"),
  kind: "absolute",
  body,
});

export const createFunctionCallNode = (
  name: string,
  argument: FormulaRowNode = createRow(),
): FormulaFunctionCallNode => ({
  id: createMathNodeId("function"),
  kind: "functionCall",
  name,
  argument,
});

export const createIntegralNode = (
  lower: FormulaRowNode = createRow(),
  upper: FormulaRowNode = createRow(),
  integrand: FormulaRowNode = createRow(),
  differential: FormulaRowNode = createRow(createCharacterNodes("dx")),
): FormulaIntegralNode => ({
  id: createMathNodeId("integral"),
  kind: "integral",
  lower,
  upper,
  integrand,
  differential,
});

export const createSeriesNode = (
  kind: FormulaSeriesNode["kind"],
  lower: FormulaRowNode = createRow(),
  upper: FormulaRowNode = createRow(),
  body: FormulaRowNode = createRow(),
): FormulaSeriesNode => ({
  id: createMathNodeId(kind),
  kind,
  lower,
  upper,
  body,
});

export const createLimitNode = (
  approach: FormulaRowNode = createRow([
    createLeaf("identifier", "x"),
    createLeaf("symbol", "\\to"),
    createLeaf("number", "0"),
  ]),
  body: FormulaRowNode = createRow(),
): FormulaLimitNode => ({
  id: createMathNodeId("limit"),
  kind: "limit",
  approach,
  body,
});

export const createMatrixNode = (
  environment: FormulaMatrixNode["environment"] = "matrix",
  rows = 2,
  cols = 2,
): FormulaMatrixNode => ({
  id: createMathNodeId("matrix"),
  kind: "matrix",
  environment,
  cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => createRow())),
});

export const createVectorNode = (
  environment: FormulaVectorNode["environment"] = "pmatrix",
  rows = 3,
): FormulaVectorNode => ({
  id: createMathNodeId("vector"),
  kind: "vector",
  environment,
  cells: Array.from({ length: rows }, () => createRow()),
});

export const createCasesNode = (rows = 2): FormulaCasesNode => ({
  id: createMathNodeId("cases"),
  kind: "cases",
  rows: Array.from({ length: rows }, () => ({
    id: createMathNodeId("cases-row"),
    value: createRow(),
    condition: createRow(),
  })),
});

export const createAlignedNode = (rows = 2): FormulaAlignedNode => ({
  id: createMathNodeId("aligned"),
  kind: "aligned",
  rows: Array.from({ length: rows }, () => ({
    id: createMathNodeId("aligned-row"),
    left: createRow(),
    right: createRow(),
  })),
});

export const cloneRow = (row: FormulaRowNode): FormulaRowNode => ({
  ...row,
  children: row.children.map(cloneNode),
});

export const cloneNode = (node: FormulaNode): FormulaNode => {
  switch (node.kind) {
    case "identifier":
    case "number":
    case "operator":
    case "relation":
    case "symbol":
    case "placeholder":
      return { ...node };
    case "text":
      return { ...node, body: cloneRow(node.body) };
    case "fraction":
      return {
        ...node,
        numerator: cloneRow(node.numerator),
        denominator: cloneRow(node.denominator),
      };
    case "sqrt":
      return { ...node, radicand: cloneRow(node.radicand) };
    case "root":
      return { ...node, index: cloneRow(node.index), radicand: cloneRow(node.radicand) };
    case "sup":
      return { ...node, base: cloneRow(node.base), exponent: cloneRow(node.exponent) };
    case "sub":
      return { ...node, base: cloneRow(node.base), subscript: cloneRow(node.subscript) };
    case "subsup":
      return {
        ...node,
        base: cloneRow(node.base),
        subscript: cloneRow(node.subscript),
        exponent: cloneRow(node.exponent),
      };
    case "delimited":
      return { ...node, body: cloneRow(node.body) };
    case "absolute":
      return { ...node, body: cloneRow(node.body) };
    case "functionCall":
      return { ...node, argument: cloneRow(node.argument) };
    case "integral":
      return {
        ...node,
        lower: cloneRow(node.lower),
        upper: cloneRow(node.upper),
        integrand: cloneRow(node.integrand),
        differential: cloneRow(node.differential),
      };
    case "limit":
      return { ...node, approach: cloneRow(node.approach), body: cloneRow(node.body) };
    case "sum":
    case "product":
      return {
        ...node,
        lower: cloneRow(node.lower),
        upper: cloneRow(node.upper),
        body: cloneRow(node.body),
      };
    case "matrix":
      return {
        ...node,
        cells: node.cells.map((row) => row.map(cloneRow)),
      };
    case "vector":
      return {
        ...node,
        cells: node.cells.map(cloneRow),
      };
    case "cases":
      return {
        ...node,
        rows: node.rows.map((row) => ({
          ...row,
          value: cloneRow(row.value),
          condition: cloneRow(row.condition),
        })),
      };
    case "aligned":
      return {
        ...node,
        rows: node.rows.map((row) => ({
          ...row,
          left: cloneRow(row.left),
          right: cloneRow(row.right),
        })),
      };
  }
};

export const createCharacterNodes = (text: string): FormulaNode[] =>
  Array.from(text).map((character) => createLeaf(classifyCharacter(character), character));

export const rowFromText = (text: string) => createRow(createCharacterNodes(text));

export const isLeafNode = (node: FormulaNode): node is FormulaLeafNode =>
  node.kind === "identifier" ||
  node.kind === "number" ||
  node.kind === "operator" ||
  node.kind === "relation" ||
  node.kind === "symbol" ||
  node.kind === "placeholder";

export const classifyCharacter = (character: string): FormulaLeafKind => {
  if (/\d/.test(character)) {
    return "number";
  }
  if (/[=<>]/.test(character)) {
    return "relation";
  }
  if (/[+\-*/]/.test(character)) {
    return "operator";
  }
  if (/\s/.test(character)) {
    return "symbol";
  }
  return /[a-zA-Z]/.test(character) ? "identifier" : "symbol";
};

export const serializePlainTextFromRow = (row: FormulaRowNode): string =>
  row.children
    .map((child) => {
      if (isLeafNode(child)) {
        return child.value;
      }
      if (child.kind === "text") {
        return serializePlainTextFromRow(child.body);
      }
      return "";
    })
    .join("");

type LocatedRow = {
  row: FormulaRowNode;
  parentNode: FormulaNode | null;
  slotRef: MathSlotRef | null;
};

const getNamedRowFromNode = (node: FormulaNode, slotRef: MathSlotRef): FormulaRowNode | null => {
  switch (node.kind) {
    case "fraction":
      return slotRef.slotName === "numerator"
        ? node.numerator
        : slotRef.slotName === "denominator"
          ? node.denominator
          : null;
    case "sqrt":
      return slotRef.slotName === "radicand" ? node.radicand : null;
    case "root":
      return slotRef.slotName === "index"
        ? node.index
        : slotRef.slotName === "radicand"
          ? node.radicand
          : null;
    case "sup":
      return slotRef.slotName === "base"
        ? node.base
        : slotRef.slotName === "exponent"
          ? node.exponent
          : null;
    case "sub":
      return slotRef.slotName === "base"
        ? node.base
        : slotRef.slotName === "subscript"
          ? node.subscript
          : null;
    case "subsup":
      return slotRef.slotName === "base"
        ? node.base
        : slotRef.slotName === "subscript"
          ? node.subscript
          : slotRef.slotName === "exponent"
            ? node.exponent
            : null;
    case "delimited":
      return slotRef.slotName === "body" ? node.body : null;
    case "absolute":
      return slotRef.slotName === "body" ? node.body : null;
    case "functionCall":
      return slotRef.slotName === "argument" ? node.argument : null;
    case "integral":
      return slotRef.slotName === "lower"
        ? node.lower
        : slotRef.slotName === "upper"
          ? node.upper
          : slotRef.slotName === "integrand"
            ? node.integrand
            : slotRef.slotName === "differential"
              ? node.differential
              : null;
    case "limit":
      return slotRef.slotName === "approach"
        ? node.approach
        : slotRef.slotName === "body"
          ? node.body
          : null;
    case "sum":
    case "product":
      return slotRef.slotName === "lower"
        ? node.lower
        : slotRef.slotName === "upper"
          ? node.upper
          : slotRef.slotName === "body"
            ? node.body
            : null;
    case "text":
      return slotRef.slotName === "body" ? node.body : null;
    case "matrix":
      if (slotRef.slotName !== "cell") {
        return null;
      }
      return node.cells[slotRef.rowIndex ?? -1]?.[slotRef.colIndex ?? -1] ?? null;
    case "vector":
      if (slotRef.slotName !== "cell") {
        return null;
      }
      return node.cells[slotRef.rowIndex ?? -1] ?? null;
    case "cases":
      if (slotRef.slotName === "value") {
        return node.rows[slotRef.rowIndex ?? -1]?.value ?? null;
      }
      if (slotRef.slotName === "condition") {
        return node.rows[slotRef.rowIndex ?? -1]?.condition ?? null;
      }
      return null;
    case "aligned":
      if (slotRef.slotName === "left") {
        return node.rows[slotRef.rowIndex ?? -1]?.left ?? null;
      }
      if (slotRef.slotName === "right") {
        return node.rows[slotRef.rowIndex ?? -1]?.right ?? null;
      }
      return null;
    default:
      return null;
  }
};

const locateNodeById = (row: FormulaRowNode, id: string): FormulaNode | null => {
  for (const child of row.children) {
    if (child.id === id) {
      return child;
    }
    const nested = visitChildRows(child, (nestedRow) => locateNodeById(nestedRow, id));
    if (nested) {
      return nested;
    }
  }
  return null;
};

const visitChildRows = <T>(
  node: FormulaNode,
  visitor: (row: FormulaRowNode) => T | null,
): T | null => {
  const rows = listChildRows(node);
  for (const row of rows) {
    const result = visitor(row);
    if (result !== null) {
      return result;
    }
  }
  return null;
};

export const listChildRows = (node: FormulaNode): FormulaRowNode[] => {
  switch (node.kind) {
    case "text":
      return [node.body];
    case "fraction":
      return [node.numerator, node.denominator];
    case "sqrt":
      return [node.radicand];
    case "root":
      return [node.index, node.radicand];
    case "sup":
      return [node.base, node.exponent];
    case "sub":
      return [node.base, node.subscript];
    case "subsup":
      return [node.base, node.subscript, node.exponent];
    case "delimited":
    case "absolute":
      return [node.body];
    case "functionCall":
      return [node.argument];
    case "integral":
      return [node.lower, node.upper, node.integrand, node.differential];
    case "limit":
      return [node.approach, node.body];
    case "sum":
    case "product":
      return [node.lower, node.upper, node.body];
    case "matrix":
      return node.cells.flat();
    case "vector":
      return [...node.cells];
    case "cases":
      return node.rows.flatMap((row) => [row.value, row.condition]);
    case "aligned":
      return node.rows.flatMap((row) => [row.left, row.right]);
    default:
      return [];
  }
};

export const locateRowByPath = (root: FormulaRowNode, path: SlotPath): LocatedRow | null => {
  let currentRow = root;
  let parentNode: FormulaNode | null = null;
  let slotRef: MathSlotRef | null = null;
  for (const segment of path) {
    const node = locateNodeById(root, segment.nodeId);
    if (!node) {
      return null;
    }
    const nextRow = getNamedRowFromNode(node, segment);
    if (!nextRow) {
      return null;
    }
    currentRow = nextRow;
    parentNode = node;
    slotRef = segment;
  }
  return { row: currentRow, parentNode, slotRef };
};

export const buildCursorForSlot = (rowPath: SlotPath, offset = 0): MathCursor => ({
  rowPath,
  offset,
  selection: null,
});

const slotDescriptor = (
  nodeId: string,
  slotName: string,
  rowIndex?: number,
  colIndex?: number,
): MathSlotRef => ({
  nodeId,
  slotName,
  rowIndex,
  colIndex,
});

export const listNodeSlots = (node: FormulaNode): MathSlotRef[] => {
  switch (node.kind) {
    case "text":
      return [slotDescriptor(node.id, "body")];
    case "fraction":
      return [slotDescriptor(node.id, "numerator"), slotDescriptor(node.id, "denominator")];
    case "sqrt":
      return [slotDescriptor(node.id, "radicand")];
    case "root":
      return [slotDescriptor(node.id, "index"), slotDescriptor(node.id, "radicand")];
    case "sup":
      return [slotDescriptor(node.id, "base"), slotDescriptor(node.id, "exponent")];
    case "sub":
      return [slotDescriptor(node.id, "base"), slotDescriptor(node.id, "subscript")];
    case "subsup":
      return [
        slotDescriptor(node.id, "base"),
        slotDescriptor(node.id, "subscript"),
        slotDescriptor(node.id, "exponent"),
      ];
    case "delimited":
    case "absolute":
      return [slotDescriptor(node.id, "body")];
    case "functionCall":
      return [slotDescriptor(node.id, "argument")];
    case "integral":
      return [
        slotDescriptor(node.id, "lower"),
        slotDescriptor(node.id, "upper"),
        slotDescriptor(node.id, "integrand"),
        slotDescriptor(node.id, "differential"),
      ];
    case "limit":
      return [slotDescriptor(node.id, "approach"), slotDescriptor(node.id, "body")];
    case "sum":
    case "product":
      return [
        slotDescriptor(node.id, "lower"),
        slotDescriptor(node.id, "upper"),
        slotDescriptor(node.id, "body"),
      ];
    case "matrix":
      return node.cells.flatMap((row, rowIndex) =>
        row.map((_cell, colIndex) => slotDescriptor(node.id, "cell", rowIndex, colIndex)),
      );
    case "vector":
      return node.cells.map((_cell, rowIndex) => slotDescriptor(node.id, "cell", rowIndex));
    case "cases":
      return node.rows.flatMap((_row, rowIndex) => [
        slotDescriptor(node.id, "value", rowIndex),
        slotDescriptor(node.id, "condition", rowIndex),
      ]);
    case "aligned":
      return node.rows.flatMap((_row, rowIndex) => [
        slotDescriptor(node.id, "left", rowIndex),
        slotDescriptor(node.id, "right", rowIndex),
      ]);
    default:
      return [];
  }
};

export const areSlotRefsEqual = (left: MathSlotRef, right: MathSlotRef) =>
  left.nodeId === right.nodeId &&
  left.slotName === right.slotName &&
  left.rowIndex === right.rowIndex &&
  left.colIndex === right.colIndex;

export const areSlotPathsEqual = (left: SlotPath, right: SlotPath) =>
  left.length === right.length &&
  left.every((segment, index) => {
    const other = right[index];
    return Boolean(other) && areSlotRefsEqual(segment, other);
  });

export const listAllSlotPaths = (root: FormulaRowNode): SlotPath[] => {
  const result: SlotPath[] = [[]];

  const visitRow = (row: FormulaRowNode, path: SlotPath) => {
    for (const child of row.children) {
      const childSlots = listNodeSlots(child);
      for (const slot of childSlots) {
        const nextPath = [...path, slot];
        result.push(nextPath);
        const located = locateRowByPath(root, nextPath);
        if (located) {
          visitRow(located.row, nextPath);
        }
      }
    }
  };

  visitRow(root, []);
  return result;
};

export const isRowEmpty = (row: FormulaRowNode) => row.children.length === 0;

export const removeNodeById = (row: FormulaRowNode, nodeId: string): FormulaRowNode => {
  const nextChildren: FormulaNode[] = [];
  for (const child of row.children) {
    if (child.id === nodeId) {
      continue;
    }
    nextChildren.push(updateChildRows(child, (nestedRow) => removeNodeById(nestedRow, nodeId)));
  }
  return { ...row, children: nextChildren };
};

export const findNodeById = (row: FormulaRowNode, nodeId: string): FormulaNode | null => {
  for (const child of row.children) {
    if (child.id === nodeId) {
      return child;
    }
    const nested = visitChildRows(child, (nestedRow) => findNodeById(nestedRow, nodeId));
    if (nested) {
      return nested;
    }
  }
  return null;
};

export const replaceNodeById = (
  row: FormulaRowNode,
  nodeId: string,
  replacer: (node: FormulaNode) => FormulaNode,
): FormulaRowNode => ({
  ...row,
  children: row.children.map((child) => {
    if (child.id === nodeId) {
      return replacer(child);
    }
    return updateChildRows(child, (nestedRow) => replaceNodeById(nestedRow, nodeId, replacer));
  }),
});

export const updateChildRows = (
  node: FormulaNode,
  updater: (row: FormulaRowNode) => FormulaRowNode,
): FormulaNode => {
  switch (node.kind) {
    case "text":
      return { ...node, body: updater(node.body) };
    case "fraction":
      return {
        ...node,
        numerator: updater(node.numerator),
        denominator: updater(node.denominator),
      };
    case "sqrt":
      return { ...node, radicand: updater(node.radicand) };
    case "root":
      return { ...node, index: updater(node.index), radicand: updater(node.radicand) };
    case "sup":
      return { ...node, base: updater(node.base), exponent: updater(node.exponent) };
    case "sub":
      return { ...node, base: updater(node.base), subscript: updater(node.subscript) };
    case "subsup":
      return {
        ...node,
        base: updater(node.base),
        subscript: updater(node.subscript),
        exponent: updater(node.exponent),
      };
    case "delimited":
      return { ...node, body: updater(node.body) };
    case "absolute":
      return { ...node, body: updater(node.body) };
    case "functionCall":
      return { ...node, argument: updater(node.argument) };
    case "integral":
      return {
        ...node,
        lower: updater(node.lower),
        upper: updater(node.upper),
        integrand: updater(node.integrand),
        differential: updater(node.differential),
      };
    case "limit":
      return { ...node, approach: updater(node.approach), body: updater(node.body) };
    case "sum":
    case "product":
      return {
        ...node,
        lower: updater(node.lower),
        upper: updater(node.upper),
        body: updater(node.body),
      };
    case "matrix":
      return {
        ...node,
        cells: node.cells.map((row) => row.map(updater)),
      };
    case "vector":
      return {
        ...node,
        cells: node.cells.map(updater),
      };
    case "cases":
      return {
        ...node,
        rows: node.rows.map((row) => ({
          ...row,
          value: updater(row.value),
          condition: updater(row.condition),
        })),
      };
    case "aligned":
      return {
        ...node,
        rows: node.rows.map((row) => ({
          ...row,
          left: updater(row.left),
          right: updater(row.right),
        })),
      };
    default:
      return node;
  }
};

export const replaceRowAtPath = (
  root: FormulaRowNode,
  path: SlotPath,
  updater: (row: FormulaRowNode) => FormulaRowNode,
): FormulaRowNode => {
  if (path.length === 0) {
    return updater(root);
  }
  const [head, ...rest] = path;
  const nextChildren = root.children.map((child) =>
    replaceNodeSlotPath(child, head, rest, updater),
  );
  return { ...root, children: nextChildren };
};

const replaceNodeSlotPath = (
  node: FormulaNode,
  head: MathSlotRef,
  rest: SlotPath,
  updater: (row: FormulaRowNode) => FormulaRowNode,
): FormulaNode => {
  if (node.id !== head.nodeId) {
    return updateChildRows(node, (row) => {
      const nextChildren = row.children.map((child) =>
        replaceNodeSlotPath(child, head, rest, updater),
      );
      return { ...row, children: nextChildren };
    });
  }

  const patchRow = (currentRow: FormulaRowNode) =>
    rest.length === 0 ? updater(currentRow) : replaceRowAtPath(currentRow, rest, updater);

  switch (node.kind) {
    case "text":
      return head.slotName === "body" ? { ...node, body: patchRow(node.body) } : node;
    case "fraction":
      return {
        ...node,
        numerator: head.slotName === "numerator" ? patchRow(node.numerator) : node.numerator,
        denominator:
          head.slotName === "denominator" ? patchRow(node.denominator) : node.denominator,
      };
    case "sqrt":
      return head.slotName === "radicand" ? { ...node, radicand: patchRow(node.radicand) } : node;
    case "root":
      return {
        ...node,
        index: head.slotName === "index" ? patchRow(node.index) : node.index,
        radicand: head.slotName === "radicand" ? patchRow(node.radicand) : node.radicand,
      };
    case "sup":
      return {
        ...node,
        base: head.slotName === "base" ? patchRow(node.base) : node.base,
        exponent: head.slotName === "exponent" ? patchRow(node.exponent) : node.exponent,
      };
    case "sub":
      return {
        ...node,
        base: head.slotName === "base" ? patchRow(node.base) : node.base,
        subscript: head.slotName === "subscript" ? patchRow(node.subscript) : node.subscript,
      };
    case "subsup":
      return {
        ...node,
        base: head.slotName === "base" ? patchRow(node.base) : node.base,
        subscript: head.slotName === "subscript" ? patchRow(node.subscript) : node.subscript,
        exponent: head.slotName === "exponent" ? patchRow(node.exponent) : node.exponent,
      };
    case "delimited":
      return head.slotName === "body" ? { ...node, body: patchRow(node.body) } : node;
    case "absolute":
      return head.slotName === "body" ? { ...node, body: patchRow(node.body) } : node;
    case "functionCall":
      return head.slotName === "argument" ? { ...node, argument: patchRow(node.argument) } : node;
    case "integral":
      return {
        ...node,
        lower: head.slotName === "lower" ? patchRow(node.lower) : node.lower,
        upper: head.slotName === "upper" ? patchRow(node.upper) : node.upper,
        integrand: head.slotName === "integrand" ? patchRow(node.integrand) : node.integrand,
        differential:
          head.slotName === "differential" ? patchRow(node.differential) : node.differential,
      };
    case "limit":
      return {
        ...node,
        approach: head.slotName === "approach" ? patchRow(node.approach) : node.approach,
        body: head.slotName === "body" ? patchRow(node.body) : node.body,
      };
    case "sum":
    case "product":
      return {
        ...node,
        lower: head.slotName === "lower" ? patchRow(node.lower) : node.lower,
        upper: head.slotName === "upper" ? patchRow(node.upper) : node.upper,
        body: head.slotName === "body" ? patchRow(node.body) : node.body,
      };
    case "matrix":
      return {
        ...node,
        cells: node.cells.map((row, rowIndex) =>
          row.map((cell, colIndex) =>
            head.slotName === "cell" && head.rowIndex === rowIndex && head.colIndex === colIndex
              ? patchRow(cell)
              : cell,
          ),
        ),
      };
    case "vector":
      return {
        ...node,
        cells: node.cells.map((cell, rowIndex) =>
          head.slotName === "cell" && head.rowIndex === rowIndex ? patchRow(cell) : cell,
        ),
      };
    case "cases":
      return {
        ...node,
        rows: node.rows.map((row, rowIndex) => ({
          ...row,
          value:
            head.slotName === "value" && head.rowIndex === rowIndex
              ? patchRow(row.value)
              : row.value,
          condition:
            head.slotName === "condition" && head.rowIndex === rowIndex
              ? patchRow(row.condition)
              : row.condition,
        })),
      };
    case "aligned":
      return {
        ...node,
        rows: node.rows.map((row, rowIndex) => ({
          ...row,
          left:
            head.slotName === "left" && head.rowIndex === rowIndex ? patchRow(row.left) : row.left,
          right:
            head.slotName === "right" && head.rowIndex === rowIndex
              ? patchRow(row.right)
              : row.right,
        })),
      };
    default:
      return node;
  }
};

export const insertNodesIntoRow = (
  row: FormulaRowNode,
  offset: number,
  nodes: FormulaNode[],
  selection?: { start: number; end: number } | null,
): FormulaRowNode => {
  const normalizedSelection = selection
    ? {
        start: Math.max(0, Math.min(selection.start, row.children.length)),
        end: Math.max(0, Math.min(selection.end, row.children.length)),
      }
    : null;
  const start = normalizedSelection
    ? Math.min(normalizedSelection.start, normalizedSelection.end)
    : offset;
  const end = normalizedSelection
    ? Math.max(normalizedSelection.start, normalizedSelection.end)
    : offset;
  return {
    ...row,
    children: [...row.children.slice(0, start), ...nodes, ...row.children.slice(end)],
  };
};

export const removeRowSlice = (
  row: FormulaRowNode,
  start: number,
  end: number,
): FormulaRowNode => ({
  ...row,
  children: [...row.children.slice(0, start), ...row.children.slice(end)],
});

export const getSlotLabel = (slotRef: MathSlotRef): string => {
  switch (slotRef.slotName) {
    case "numerator":
      return "Numerator";
    case "denominator":
      return "Denominator";
    case "radicand":
      return "Radicand";
    case "index":
      return "Root index";
    case "base":
      return "Base";
    case "subscript":
      return "Subscript";
    case "exponent":
      return "Exponent";
    case "body":
      return "Body";
    case "argument":
      return "Argument";
    case "lower":
      return "Lower bound";
    case "upper":
      return "Upper bound";
    case "integrand":
      return "Integrand";
    case "differential":
      return "Differential";
    case "approach":
      return "Limit approach";
    case "cell":
      return `Matrix row ${(slotRef.rowIndex ?? 0) + 1} column ${(slotRef.colIndex ?? 0) + 1}`;
    case "value":
      return `Cases value ${(slotRef.rowIndex ?? 0) + 1}`;
    case "condition":
      return `Cases condition ${(slotRef.rowIndex ?? 0) + 1}`;
    case "left":
      return `Aligned left ${(slotRef.rowIndex ?? 0) + 1}`;
    case "right":
      return `Aligned right ${(slotRef.rowIndex ?? 0) + 1}`;
    default:
      return slotRef.slotName;
  }
};
