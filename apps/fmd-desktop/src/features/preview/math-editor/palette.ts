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
  createSubNode,
  createSupNode,
  createSqrtNode,
  createTextNode,
  createVectorNode,
} from "./ast";
import type { FormulaRowNode, MathTemplateCategoryId, MathTemplateDefinition } from "./types";

const cloneSelectedRow = (selectedRow: FormulaRowNode | null) =>
  selectedRow ? createRow(selectedRow.children) : createRow();

const wrapOrEmpty = (selectedRow: FormulaRowNode | null) => cloneSelectedRow(selectedRow);

export const MATH_TEMPLATE_DEFINITIONS: MathTemplateDefinition[] = [
  {
    id: "symbol-plus",
    label: "+",
    category: "basic",
    nodeFactory: () => ({ nodes: [createLeaf("operator", "+")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: ["+"],
    favoriteDefault: true,
  },
  {
    id: "symbol-minus",
    label: "-",
    category: "basic",
    nodeFactory: () => ({ nodes: [createLeaf("operator", "-")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: ["-"],
    favoriteDefault: true,
  },
  {
    id: "symbol-times",
    label: "×",
    category: "basic",
    nodeFactory: () => ({ nodes: [createLeaf("operator", "\\times")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: ["*"],
    favoriteDefault: true,
  },
  {
    id: "symbol-divide",
    label: "÷",
    category: "basic",
    nodeFactory: () => ({ nodes: [createLeaf("operator", "\\div")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  {
    id: "symbol-equals",
    label: "=",
    category: "basic",
    nodeFactory: () => ({ nodes: [createLeaf("relation", "=")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: ["="],
    favoriteDefault: true,
  },
  {
    id: "symbol-not-equals",
    label: "≠",
    category: "basic",
    nodeFactory: () => ({ nodes: [createLeaf("relation", "\\neq")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  {
    id: "symbol-leq",
    label: "≤",
    category: "basic",
    nodeFactory: () => ({ nodes: [createLeaf("relation", "\\le")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  {
    id: "symbol-geq",
    label: "≥",
    category: "basic",
    nodeFactory: () => ({ nodes: [createLeaf("relation", "\\ge")], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  {
    id: "delim-parens",
    label: "( )",
    category: "structures",
    nodeFactory: (selectedRow) => {
      const node = createDelimitedNode("(", ")", wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "body" },
      };
    },
    slotOrder: ["body"],
    keyboardTriggers: [],
    favoriteDefault: true,
  },
  {
    id: "delim-brackets",
    label: "[ ]",
    category: "structures",
    nodeFactory: (selectedRow) => {
      const node = createDelimitedNode("[", "]", wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "body" },
      };
    },
    slotOrder: ["body"],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  {
    id: "delim-braces",
    label: "{ }",
    category: "structures",
    nodeFactory: (selectedRow) => {
      const node = createDelimitedNode("\\{", "\\}", wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "body" },
      };
    },
    slotOrder: ["body"],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  {
    id: "absolute",
    label: "| |",
    category: "structures",
    nodeFactory: (selectedRow) => {
      const node = createAbsoluteNode(wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "body" },
      };
    },
    slotOrder: ["body"],
    keyboardTriggers: [],
    favoriteDefault: true,
  },
  {
    id: "fraction",
    label: "Fraction",
    category: "structures",
    nodeFactory: (selectedRow) => {
      const node = createFractionNode(
        wrapOrEmpty(selectedRow),
        createRow(),
      );
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
    favoriteDefault: true,
  },
  {
    id: "sqrt",
    label: "Root",
    category: "structures",
    nodeFactory: (selectedRow) => {
      const node = createSqrtNode(wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "radicand" },
      };
    },
    slotOrder: ["radicand"],
    keyboardTriggers: ["sqrt"],
    favoriteDefault: true,
  },
  {
    id: "nth-root",
    label: "n-th Root",
    category: "structures",
    nodeFactory: (selectedRow) => {
      const node = createRootNode(createRow(), wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "index" },
      };
    },
    slotOrder: ["index", "radicand"],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  {
    id: "superscript",
    label: "Power",
    category: "structures",
    nodeFactory: (selectedRow) => {
      const supNode = createSupNode(wrapOrEmpty(selectedRow), createRow());
      return {
        nodes: [supNode],
        focusSlot: { nodeId: supNode.id, slotName: "exponent" },
      };
    },
    slotOrder: ["base", "exponent"],
    keyboardTriggers: ["^"],
    favoriteDefault: true,
  },
  {
    id: "subscript",
    label: "Index",
    category: "structures",
    nodeFactory: (selectedRow) => {
      const subNode = createSubNode(wrapOrEmpty(selectedRow), createRow());
      return {
        nodes: [subNode],
        focusSlot: { nodeId: subNode.id, slotName: "subscript" },
      };
    },
    slotOrder: ["base", "subscript"],
    keyboardTriggers: ["_"],
    favoriteDefault: false,
  },
  {
    id: "integral",
    label: "Integral",
    category: "analysis",
    nodeFactory: () => {
      const node = createIntegralNode();
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "lower" },
      };
    },
    slotOrder: ["lower", "upper", "integrand", "differential"],
    keyboardTriggers: ["int"],
    favoriteDefault: true,
  },
  {
    id: "sum",
    label: "Sum",
    category: "analysis",
    nodeFactory: () => {
      const node = createSeriesNode("sum");
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "lower" },
      };
    },
    slotOrder: ["lower", "upper", "body"],
    keyboardTriggers: ["sum"],
    favoriteDefault: true,
  },
  {
    id: "product",
    label: "Product",
    category: "analysis",
    nodeFactory: () => {
      const node = createSeriesNode("product");
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "lower" },
      };
    },
    slotOrder: ["lower", "upper", "body"],
    keyboardTriggers: ["prod"],
    favoriteDefault: false,
  },
  {
    id: "limit",
    label: "Limit",
    category: "analysis",
    nodeFactory: () => {
      const node = createLimitNode();
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "approach" },
      };
    },
    slotOrder: ["approach", "body"],
    keyboardTriggers: ["lim"],
    favoriteDefault: false,
  },
  {
    id: "text",
    label: "Text",
    category: "functions",
    nodeFactory: () => {
      const node = createTextNode("");
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "body" },
      };
    },
    slotOrder: ["body"],
    keyboardTriggers: [],
    favoriteDefault: true,
  },
  {
    id: "function-sin",
    label: "sin",
    category: "functions",
    nodeFactory: (selectedRow) => {
      const node = createFunctionCallNode("sin", wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "argument" },
      };
    },
    slotOrder: ["argument"],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  {
    id: "function-cos",
    label: "cos",
    category: "functions",
    nodeFactory: (selectedRow) => {
      const node = createFunctionCallNode("cos", wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "argument" },
      };
    },
    slotOrder: ["argument"],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  {
    id: "function-log",
    label: "log",
    category: "functions",
    nodeFactory: (selectedRow) => {
      const node = createFunctionCallNode("log", wrapOrEmpty(selectedRow));
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "argument" },
      };
    },
    slotOrder: ["argument"],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  {
    id: "matrix-2x2",
    label: "2x2 Matrix",
    category: "matrices",
    nodeFactory: () => {
      const node = createMatrixNode("matrix", 2, 2);
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "cell", rowIndex: 0, colIndex: 0 },
      };
    },
    slotOrder: ["cell"],
    keyboardTriggers: [],
    favoriteDefault: true,
  },
  {
    id: "pmatrix-2x2",
    label: "2x2 P-Matrix",
    category: "matrices",
    nodeFactory: () => {
      const node = createMatrixNode("pmatrix", 2, 2);
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "cell", rowIndex: 0, colIndex: 0 },
      };
    },
    slotOrder: ["cell"],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  {
    id: "vector-3",
    label: "Vector",
    category: "matrices",
    nodeFactory: () => {
      const node = createVectorNode("pmatrix", 3);
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "cell", rowIndex: 0 },
      };
    },
    slotOrder: ["cell"],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  {
    id: "cases",
    label: "Cases",
    category: "matrices",
    nodeFactory: () => {
      const node = createCasesNode(2);
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "value", rowIndex: 0 },
      };
    },
    slotOrder: ["value", "condition"],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  {
    id: "aligned",
    label: "Aligned",
    category: "matrices",
    nodeFactory: () => {
      const node = createAlignedNode(2);
      return {
        nodes: [node],
        focusSlot: { nodeId: node.id, slotName: "left", rowIndex: 0 },
      };
    },
    slotOrder: ["left", "right"],
    keyboardTriggers: [],
    favoriteDefault: false,
  },
  ...[
    ["pi", "\\pi"],
    ["theta", "\\theta"],
    ["alpha", "\\alpha"],
    ["infty", "\\infty"],
    ["partial", "\\partial"],
    ["nabla", "\\nabla"],
    ["to", "\\to"],
    ["in", "\\in"],
    ["subset", "\\subset"],
    ["forall", "\\forall"],
    ["exists", "\\exists"],
  ].map(([id, value]) => ({
    id: `symbol-${id}`,
    label: value,
    category: "symbols" as MathTemplateCategoryId,
    nodeFactory: () => ({ nodes: [createLeaf("symbol", value)], focusSlot: null }),
    slotOrder: [],
    keyboardTriggers: [],
    favoriteDefault: false,
  })),
];

export const MATH_TEMPLATE_MAP = new Map(
  MATH_TEMPLATE_DEFINITIONS.map((template) => [template.id, template]),
);

export const MATH_TEMPLATE_CATEGORIES: Array<{
  id: MathTemplateCategoryId;
  label: string;
}> = [
  { id: "favorites", label: "Favorites" },
  { id: "basic", label: "Basic" },
  { id: "structures", label: "Structures" },
  { id: "analysis", label: "Analysis" },
  { id: "symbols", label: "Symbols" },
  { id: "matrices", label: "Matrix" },
  { id: "functions", label: "Functions" },
];

export const getMathTemplateById = (id: string) => MATH_TEMPLATE_MAP.get(id) ?? null;

export const getTemplateDefinitionsForCategory = (
  categoryId: MathTemplateCategoryId,
  recentTemplateIds: string[],
) => {
  if (categoryId === "favorites") {
    const recent = recentTemplateIds
      .map((id) => MATH_TEMPLATE_MAP.get(id))
      .filter((template): template is MathTemplateDefinition => Boolean(template));
    const defaults = MATH_TEMPLATE_DEFINITIONS.filter((template) => template.favoriteDefault);
    const deduped = new Map<string, MathTemplateDefinition>();
    for (const template of [...recent, ...defaults]) {
      deduped.set(template.id, template);
    }
    return [...deduped.values()];
  }
  return MATH_TEMPLATE_DEFINITIONS.filter((template) => template.category === categoryId);
};

export const resolveTemplateFromTrigger = (buffer: string) => {
  const normalized = buffer.trim().toLowerCase();
  return MATH_TEMPLATE_DEFINITIONS.find((template) =>
    template.keyboardTriggers.some((trigger) => trigger.toLowerCase() === normalized)) ?? null;
};

export const buildSelectedRowFromNodes = (nodes: FormulaNode[]) => createRow(nodes);
