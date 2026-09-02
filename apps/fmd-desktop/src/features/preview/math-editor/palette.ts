import {
  createAbsoluteNode,
  createAlignedNode,
  createCasesNode,
  createDelimitedNode,
  createFractionNode,
  createFunctionCallNode,
  createIntegralNode,
  createLeaf,
  createLimitNode,
  createMatrixNode,
  createRootNode,
  createRow,
  createSeriesNode,
  createSubNode,
  createSupNode,
  createSqrtNode,
  createTextNode,
  createVectorNode,
} from "./ast";
import type {
  FormulaNode,
  FormulaRowNode,
  MathTemplateDefinition,
  MathTemplateGroupId,
} from "./types";

const cloneSelectedRow = (selectedRow: FormulaRowNode | null) =>
  selectedRow ? createRow(selectedRow.children) : createRow();

const wrapOrEmpty = (selectedRow: FormulaRowNode | null) => cloneSelectedRow(selectedRow);

export const MATH_TEMPLATE_GROUPS: Array<{
  id: MathTemplateGroupId;
  label: string;
}> = [
  { id: "operators", label: "Operators" },
  { id: "structures", label: "Structures" },
  { id: "symbols", label: "Math symbols" },
  { id: "text-format", label: "Text / Format" },
];

export const MATH_TEMPLATE_DEFINITIONS: MathTemplateDefinition[] = [
  {
    id: "symbol-plus",
    group: "operators",
    iconId: "plus",
    tooltipLabel: "Plus",
    order: 10,
    nodeFactory: () => ({ nodes: [createLeaf("operator", "+")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: ["+"],
  },
  {
    id: "symbol-minus",
    group: "operators",
    iconId: "minus",
    tooltipLabel: "Minus",
    order: 20,
    nodeFactory: () => ({ nodes: [createLeaf("operator", "-")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: ["-"],
  },
  {
    id: "symbol-times",
    group: "operators",
    iconId: "times",
    tooltipLabel: "Multiply (×)",
    order: 30,
    nodeFactory: () => ({ nodes: [createLeaf("operator", "\\times")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: ["*"],
  },
  {
    id: "symbol-divide",
    group: "operators",
    iconId: "divide",
    tooltipLabel: "Divide (÷)",
    order: 40,
    nodeFactory: () => ({ nodes: [createLeaf("operator", "\\div")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "symbol-equals",
    group: "operators",
    iconId: "equals",
    tooltipLabel: "Equals",
    order: 50,
    nodeFactory: () => ({ nodes: [createLeaf("relation", "=")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: ["="],
  },
  {
    id: "symbol-not-equals",
    group: "operators",
    iconId: "not-equals",
    tooltipLabel: "Not equal (≠)",
    order: 60,
    nodeFactory: () => ({ nodes: [createLeaf("relation", "\\neq")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "symbol-leq",
    group: "operators",
    iconId: "leq",
    tooltipLabel: "Less than or equal (≤)",
    order: 70,
    nodeFactory: () => ({ nodes: [createLeaf("relation", "\\le")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "symbol-geq",
    group: "operators",
    iconId: "geq",
    tooltipLabel: "Greater than or equal (≥)",
    order: 80,
    nodeFactory: () => ({ nodes: [createLeaf("relation", "\\ge")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "delim-parens",
    group: "operators",
    iconId: "parentheses",
    tooltipLabel: "Parentheses (( ))",
    order: 90,
    nodeFactory: (selectedRow) => {
      const node = createDelimitedNode("(", ")", wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "body" },
      };
    },
    slotOrder: ["body"],
    keyboardTriggers: [],
  },
  {
    id: "delim-brackets",
    group: "operators",
    iconId: "brackets",
    tooltipLabel: "Brackets ([ ])",
    order: 100,
    nodeFactory: (selectedRow) => {
      const node = createDelimitedNode("[", "]", wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "body" },
      };
    },
    slotOrder: ["body"],
    keyboardTriggers: [],
  },
  {
    id: "delim-braces",
    group: "operators",
    iconId: "braces",
    tooltipLabel: "Braces ({ })",
    order: 110,
    nodeFactory: (selectedRow) => {
      const node = createDelimitedNode("\\{", "\\}", wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "body" },
      };
    },
    slotOrder: ["body"],
    keyboardTriggers: [],
  },
  {
    id: "absolute",
    group: "operators",
    iconId: "absolute",
    tooltipLabel: "Absolute value (| |)",
    order: 120,
    nodeFactory: (selectedRow) => {
      const node = createAbsoluteNode(wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "body" },
      };
    },
    slotOrder: ["body"],
    keyboardTriggers: [],
  },
  {
    id: "fraction",
    group: "structures",
    iconId: "fraction",
    tooltipLabel: "Fraction (Bruch)",
    order: 10,
    nodeFactory: (selectedRow) => {
      const node = createFractionNode(wrapOrEmpty(selectedRow), createRow());
      return {
        nodes: [node],
        focusSlot: {
          nodeId: node.id,
          slotName: selectedRow ? "denominator" : "numerator",
        },
      };
    },
    slotOrder: ["numerator", "denominator"],
    keyboardTriggers: ["/"],
  },
  {
    id: "sqrt",
    group: "structures",
    iconId: "sqrt",
    tooltipLabel: "Root (Wurzel)",
    order: 20,
    nodeFactory: (selectedRow) => {
      const node = createSqrtNode(wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "radicand" },
      };
    },
    slotOrder: ["radicand"],
    keyboardTriggers: ["sqrt"],
  },
  {
    id: "nth-root",
    group: "structures",
    iconId: "nth-root",
    tooltipLabel: "n-th Root",
    order: 30,
    nodeFactory: (selectedRow) => {
      const node = createRootNode(createRow(), wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "index" },
      };
    },
    slotOrder: ["index", "radicand"],
    keyboardTriggers: [],
  },
  {
    id: "superscript",
    group: "structures",
    iconId: "power",
    tooltipLabel: "Power",
    order: 40,
    nodeFactory: (selectedRow) => {
      const supNode = createSupNode(wrapOrEmpty(selectedRow), createRow());
      return {
        nodes: [supNode],
        focusSlot: { nodeId: supNode.id, slotName: "exponent" },
      };
    },
    slotOrder: ["base", "exponent"],
    keyboardTriggers: ["^"],
  },
  {
    id: "subscript",
    group: "structures",
    iconId: "index",
    tooltipLabel: "Index",
    order: 50,
    nodeFactory: (selectedRow) => {
      const subNode = createSubNode(wrapOrEmpty(selectedRow), createRow());
      return {
        nodes: [subNode],
        focusSlot: { nodeId: subNode.id, slotName: "subscript" },
      };
    },
    slotOrder: ["base", "subscript"],
    keyboardTriggers: ["_"],
  },
  {
    id: "integral",
    group: "structures",
    iconId: "integral",
    tooltipLabel: "Integral",
    order: 60,
    nodeFactory: () => {
      const node = createIntegralNode();
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "lower" },
      };
    },
    slotOrder: ["lower", "upper", "integrand", "differential"],
    keyboardTriggers: ["int"],
  },
  {
    id: "sum",
    group: "structures",
    iconId: "sum",
    tooltipLabel: "Sum",
    order: 70,
    nodeFactory: () => {
      const node = createSeriesNode("sum");
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "lower" },
      };
    },
    slotOrder: ["lower", "upper", "body"],
    keyboardTriggers: ["sum"],
  },
  {
    id: "product",
    group: "structures",
    iconId: "product",
    tooltipLabel: "Product",
    order: 80,
    nodeFactory: () => {
      const node = createSeriesNode("product");
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "lower" },
      };
    },
    slotOrder: ["lower", "upper", "body"],
    keyboardTriggers: ["prod"],
  },
  {
    id: "limit",
    group: "structures",
    iconId: "limit",
    tooltipLabel: "Limit",
    order: 90,
    nodeFactory: () => {
      const node = createLimitNode();
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "approach" },
      };
    },
    slotOrder: ["approach", "body"],
    keyboardTriggers: ["lim"],
  },
  {
    id: "matrix-2x2",
    group: "structures",
    iconId: "matrix",
    tooltipLabel: "2x2 Matrix",
    order: 100,
    nodeFactory: () => {
      const node = createMatrixNode("matrix", 2, 2);
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "cell", rowIndex: 0, colIndex: 0 },
      };
    },
    slotOrder: ["cell"],
    keyboardTriggers: [],
  },
  {
    id: "pmatrix-2x2",
    group: "structures",
    iconId: "pmatrix",
    tooltipLabel: "2x2 P-Matrix",
    order: 110,
    nodeFactory: () => {
      const node = createMatrixNode("pmatrix", 2, 2);
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "cell", rowIndex: 0, colIndex: 0 },
      };
    },
    slotOrder: ["cell"],
    keyboardTriggers: [],
  },
  {
    id: "vector-3",
    group: "structures",
    iconId: "vector",
    tooltipLabel: "Vector",
    order: 120,
    nodeFactory: () => {
      const node = createVectorNode("pmatrix", 3);
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "cell", rowIndex: 0 },
      };
    },
    slotOrder: ["cell"],
    keyboardTriggers: [],
  },
  {
    id: "cases",
    group: "structures",
    iconId: "cases",
    tooltipLabel: "Cases",
    order: 130,
    nodeFactory: () => {
      const node = createCasesNode(2);
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "value", rowIndex: 0 },
      };
    },
    slotOrder: ["value", "condition"],
    keyboardTriggers: [],
  },
  {
    id: "aligned",
    group: "structures",
    iconId: "aligned",
    tooltipLabel: "Aligned",
    order: 140,
    nodeFactory: () => {
      const node = createAlignedNode(2);
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "left", rowIndex: 0 },
      };
    },
    slotOrder: ["left", "right"],
    keyboardTriggers: [],
  },
  {
    id: "symbol-pi",
    group: "symbols",
    iconId: "pi",
    tooltipLabel: "Pi (π)",
    order: 10,
    nodeFactory: () => ({ nodes: [createLeaf("symbol", "\\pi")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "symbol-theta",
    group: "symbols",
    iconId: "theta",
    tooltipLabel: "Theta (θ)",
    order: 20,
    nodeFactory: () => ({ nodes: [createLeaf("symbol", "\\theta")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "symbol-alpha",
    group: "symbols",
    iconId: "alpha",
    tooltipLabel: "Alpha (α)",
    order: 30,
    nodeFactory: () => ({ nodes: [createLeaf("symbol", "\\alpha")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "symbol-infty",
    group: "symbols",
    iconId: "infty",
    tooltipLabel: "Infinity (∞)",
    order: 40,
    nodeFactory: () => ({ nodes: [createLeaf("symbol", "\\infty")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "symbol-partial",
    group: "symbols",
    iconId: "partial",
    tooltipLabel: "Partial derivative (∂)",
    order: 50,
    nodeFactory: () => ({ nodes: [createLeaf("symbol", "\\partial")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "symbol-nabla",
    group: "symbols",
    iconId: "nabla",
    tooltipLabel: "Nabla (∇)",
    order: 60,
    nodeFactory: () => ({ nodes: [createLeaf("symbol", "\\nabla")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "symbol-to",
    group: "symbols",
    iconId: "arrow",
    tooltipLabel: "Arrow (→)",
    order: 70,
    nodeFactory: () => ({ nodes: [createLeaf("symbol", "\\to")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "symbol-in",
    group: "symbols",
    iconId: "element",
    tooltipLabel: "Element of (∈)",
    order: 80,
    nodeFactory: () => ({ nodes: [createLeaf("symbol", "\\in")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "symbol-subset",
    group: "symbols",
    iconId: "subset",
    tooltipLabel: "Subset of (⊂)",
    order: 90,
    nodeFactory: () => ({ nodes: [createLeaf("symbol", "\\subset")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "symbol-forall",
    group: "symbols",
    iconId: "forall",
    tooltipLabel: "For all (∀)",
    order: 100,
    nodeFactory: () => ({ nodes: [createLeaf("symbol", "\\forall")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "symbol-exists",
    group: "symbols",
    iconId: "exists",
    tooltipLabel: "Exists (∃)",
    order: 110,
    nodeFactory: () => ({ nodes: [createLeaf("symbol", "\\exists")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
  },
  {
    id: "text",
    group: "text-format",
    iconId: "text",
    tooltipLabel: "Text",
    order: 10,
    nodeFactory: () => {
      const node = createTextNode("");
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "body" },
      };
    },
    slotOrder: ["body"],
    keyboardTriggers: [],
  },
  {
    id: "function-sin",
    group: "text-format",
    iconId: "sin",
    tooltipLabel: "sin",
    order: 20,
    nodeFactory: (selectedRow) => {
      const node = createFunctionCallNode("sin", wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "argument" },
      };
    },
    slotOrder: ["argument"],
    keyboardTriggers: [],
  },
  {
    id: "function-cos",
    group: "text-format",
    iconId: "cos",
    tooltipLabel: "cos",
    order: 30,
    nodeFactory: (selectedRow) => {
      const node = createFunctionCallNode("cos", wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "argument" },
      };
    },
    slotOrder: ["argument"],
    keyboardTriggers: [],
  },
  {
    id: "function-log",
    group: "text-format",
    iconId: "log",
    tooltipLabel: "log",
    order: 40,
    nodeFactory: (selectedRow) => {
      const node = createFunctionCallNode("log", wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "argument" },
      };
    },
    slotOrder: ["argument"],
    keyboardTriggers: [],
  },
];

export const MATH_TEMPLATE_MAP = new Map(
  MATH_TEMPLATE_DEFINITIONS.map((template) => [template.id, template]),
);

export const getMathTemplateById = (id: string) => MATH_TEMPLATE_MAP.get(id) ?? null;

export const getTemplateDefinitionsForGroup = (groupId: MathTemplateGroupId) =>
  MATH_TEMPLATE_DEFINITIONS.filter((template) => template.group === groupId).sort(
    (left, right) => left.order - right.order,
  );

export const getMathToolbarGroups = () =>
  MATH_TEMPLATE_GROUPS.map((group) => ({
    ...group,
    items: getTemplateDefinitionsForGroup(group.id),
  }));

export const resolveTemplateFromTrigger = (buffer: string) => {
  const normalized = buffer.trim().toLowerCase();
  return (
    MATH_TEMPLATE_DEFINITIONS.find((template) =>
      template.keyboardTriggers.some((trigger) => trigger.toLowerCase() === normalized),
    ) ?? null
  );
};

export const buildSelectedRowFromNodes = (nodes: FormulaNode[]) => createRow(nodes);
