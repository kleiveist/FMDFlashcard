export type CanvasSide = "top" | "right" | "bottom" | "left";

export type CanvasEdgeEnd = "none" | "arrow";
export type CanvasNodeShape =
  | "rounded-rectangle"
  | "rectangle"
  | "ellipse"
  | "diamond";

export type FmdCanvasNode = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  label?: string;
  color?: string;
  group?: string;
  file?: string;
  url?: string;
  shape?: CanvasNodeShape;
  [key: string]: unknown;
};

export type FmdCanvasEdge = {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: CanvasSide;
  toSide?: CanvasSide;
  fromEnd?: CanvasEdgeEnd;
  toEnd?: CanvasEdgeEnd;
  label?: string;
  color?: string;
  [key: string]: unknown;
};

export type FmdCanvasDocument = {
  nodes: FmdCanvasNode[];
  edges: FmdCanvasEdge[];
  [key: string]: unknown;
};

export type CanvasNode = FmdCanvasNode;
export type CanvasEdge = FmdCanvasEdge;
export type CanvasDocument = FmdCanvasDocument;

export type CanvasParseResult =
  | { ok: true; document: CanvasDocument }
  | { ok: false; error: string };

const VALID_SIDES = new Set<CanvasSide>(["top", "right", "bottom", "left"]);
const VALID_EDGE_ENDS = new Set<CanvasEdgeEnd>(["none", "arrow"]);
const VALID_NODE_TYPES = new Set(["text", "group", "file", "link"]);
const VALID_NODE_SHAPES = new Set<CanvasNodeShape>([
  "rounded-rectangle",
  "rectangle",
  "ellipse",
  "diamond",
]);

const asObject = (
  value: unknown,
): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asOptionalString = (value: unknown): string | undefined => {
  if (typeof value === "undefined") {
    return undefined;
  }
  return typeof value === "string" ? value : undefined;
};

const normalizeNode = (
  value: unknown,
  index: number,
): { ok: true; node: CanvasNode } | { ok: false; error: string } => {
  const candidate = asObject(value);
  if (!candidate) {
    return { ok: false, error: `nodes[${index}] must be an object.` };
  }

  const id =
    typeof candidate.id === "string" && candidate.id.trim().length > 0
      ? candidate.id.trim()
      : `node-${index + 1}`;

  const type = typeof candidate.type === "string" ? candidate.type.trim() : "";
  if (!type) {
    return { ok: false, error: `nodes[${index}].type must be a non-empty string.` };
  }
  const normalizedType = type.toLowerCase();
  if (!VALID_NODE_TYPES.has(normalizedType)) {
    return {
      ok: false,
      error: `nodes[${index}].type must be one of text/group/file/link.`,
    };
  }

  const x = asFiniteNumber(candidate.x);
  if (x === null) {
    return { ok: false, error: `nodes[${index}].x must be a finite number.` };
  }
  const y = asFiniteNumber(candidate.y);
  if (y === null) {
    return { ok: false, error: `nodes[${index}].y must be a finite number.` };
  }
  const width = asFiniteNumber(candidate.width);
  if (width === null) {
    return { ok: false, error: `nodes[${index}].width must be a finite number.` };
  }
  const height = asFiniteNumber(candidate.height);
  if (height === null) {
    return { ok: false, error: `nodes[${index}].height must be a finite number.` };
  }

  if ("group" in candidate && typeof candidate.group !== "string") {
    return { ok: false, error: `nodes[${index}].group must be a string when provided.` };
  }
  if ("text" in candidate && typeof candidate.text !== "string") {
    return { ok: false, error: `nodes[${index}].text must be a string when provided.` };
  }
  if ("label" in candidate && typeof candidate.label !== "string") {
    return { ok: false, error: `nodes[${index}].label must be a string when provided.` };
  }
  if ("color" in candidate && typeof candidate.color !== "string") {
    return { ok: false, error: `nodes[${index}].color must be a string when provided.` };
  }
  if ("file" in candidate && typeof candidate.file !== "string") {
    return { ok: false, error: `nodes[${index}].file must be a string when provided.` };
  }
  if ("url" in candidate && typeof candidate.url !== "string") {
    return { ok: false, error: `nodes[${index}].url must be a string when provided.` };
  }
  const shapeRaw = asOptionalString(candidate.shape)?.trim();
  if (shapeRaw && !VALID_NODE_SHAPES.has(shapeRaw as CanvasNodeShape)) {
    return {
      ok: false,
      error:
        `nodes[${index}].shape must be one of rounded-rectangle/rectangle/ellipse/diamond.`,
    };
  }

  return {
    ok: true,
    node: {
      ...candidate,
      id,
      type: normalizedType,
      x,
      y,
      width,
      height,
      group: asOptionalString(candidate.group),
      text: asOptionalString(candidate.text),
      label: asOptionalString(candidate.label),
      color: asOptionalString(candidate.color),
      file: asOptionalString(candidate.file),
      url: asOptionalString(candidate.url),
      shape: shapeRaw as CanvasNodeShape | undefined,
    },
  };
};

const validateNodeReferences = (document: CanvasDocument): string | null => {
  const nodesById = new Map(document.nodes.map((node) => [node.id, node]));
  for (let index = 0; index < document.nodes.length; index += 1) {
    const node = document.nodes[index];
    if (!node?.group) {
      continue;
    }
    const groupNode = nodesById.get(node.group);
    if (!groupNode) {
      return `nodes[${index}].group references an unknown node id: ${node.group}`;
    }
    if (groupNode.type !== "group") {
      return `nodes[${index}].group must reference a group node: ${node.group}`;
    }
  }
  return null;
};

const normalizeEdge = (
  value: unknown,
  index: number,
): { ok: true; edge: CanvasEdge } | { ok: false; error: string } => {
  const candidate = asObject(value);
  if (!candidate) {
    return { ok: false, error: `edges[${index}] must be an object.` };
  }

  const fromNode = typeof candidate.fromNode === "string" ? candidate.fromNode.trim() : "";
  if (!fromNode) {
    return { ok: false, error: `edges[${index}].fromNode must be a non-empty string.` };
  }
  const toNode = typeof candidate.toNode === "string" ? candidate.toNode.trim() : "";
  if (!toNode) {
    return { ok: false, error: `edges[${index}].toNode must be a non-empty string.` };
  }

  const fromSideRaw = asOptionalString(candidate.fromSide)?.trim().toLowerCase();
  if (fromSideRaw && !VALID_SIDES.has(fromSideRaw as CanvasSide)) {
    return { ok: false, error: `edges[${index}].fromSide must be one of top/right/bottom/left.` };
  }
  const toSideRaw = asOptionalString(candidate.toSide)?.trim().toLowerCase();
  if (toSideRaw && !VALID_SIDES.has(toSideRaw as CanvasSide)) {
    return { ok: false, error: `edges[${index}].toSide must be one of top/right/bottom/left.` };
  }

  const fromEndRaw = asOptionalString(candidate.fromEnd)?.trim().toLowerCase();
  if (fromEndRaw && !VALID_EDGE_ENDS.has(fromEndRaw as CanvasEdgeEnd)) {
    return { ok: false, error: `edges[${index}].fromEnd must be one of none/arrow.` };
  }
  const toEndRaw = asOptionalString(candidate.toEnd)?.trim().toLowerCase();
  if (toEndRaw && !VALID_EDGE_ENDS.has(toEndRaw as CanvasEdgeEnd)) {
    return { ok: false, error: `edges[${index}].toEnd must be one of none/arrow.` };
  }

  if ("label" in candidate && typeof candidate.label !== "string") {
    return { ok: false, error: `edges[${index}].label must be a string when provided.` };
  }
  if ("color" in candidate && typeof candidate.color !== "string") {
    return { ok: false, error: `edges[${index}].color must be a string when provided.` };
  }

  const id =
    typeof candidate.id === "string" && candidate.id.trim().length > 0
      ? candidate.id.trim()
      : `edge-${index + 1}`;

  return {
    ok: true,
    edge: {
      ...candidate,
      id,
      fromNode,
      toNode,
      fromSide: fromSideRaw as CanvasSide | undefined,
      toSide: toSideRaw as CanvasSide | undefined,
      fromEnd: fromEndRaw as CanvasEdgeEnd | undefined,
      toEnd: toEndRaw as CanvasEdgeEnd | undefined,
      label: asOptionalString(candidate.label),
      color: asOptionalString(candidate.color),
    },
  };
};

const validateEdgeNodeReferences = (
  document: CanvasDocument,
): string | null => {
  const nodeIds = new Set(document.nodes.map((node) => node.id));
  for (let index = 0; index < document.edges.length; index += 1) {
    const edge = document.edges[index];
    if (!edge) {
      continue;
    }
    if (!nodeIds.has(edge.fromNode)) {
      return `edges[${index}].fromNode references an unknown node id: ${edge.fromNode}`;
    }
    if (!nodeIds.has(edge.toNode)) {
      return `edges[${index}].toNode references an unknown node id: ${edge.toNode}`;
    }
  }
  return null;
};

export const createEmptyCanvasDocument = (): CanvasDocument => ({
  nodes: [],
  edges: [],
});

export const parseCanvasDocument = (source: string): CanvasParseResult => {
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    return {
      ok: false,
      error: `Canvas JSON could not be parsed: ${message}`,
    };
  }

  const root = asObject(parsedValue);
  if (!root) {
    return { ok: false, error: "Canvas document root must be an object." };
  }
  if (!Array.isArray(root.nodes)) {
    return { ok: false, error: "Canvas document must contain a nodes array." };
  }
  if (!Array.isArray(root.edges)) {
    return { ok: false, error: "Canvas document must contain an edges array." };
  }

  const nodes: CanvasNode[] = [];
  const nodeIds = new Set<string>();
  for (let index = 0; index < root.nodes.length; index += 1) {
    const normalized = normalizeNode(root.nodes[index], index);
    if (!normalized.ok) {
      return normalized;
    }
    if (nodeIds.has(normalized.node.id)) {
      return {
        ok: false,
        error: `nodes[${index}].id duplicates an existing node id: ${normalized.node.id}`,
      };
    }
    nodeIds.add(normalized.node.id);
    nodes.push(normalized.node);
  }

  const edges: CanvasEdge[] = [];
  const edgeIds = new Set<string>();
  for (let index = 0; index < root.edges.length; index += 1) {
    const normalized = normalizeEdge(root.edges[index], index);
    if (!normalized.ok) {
      return normalized;
    }
    if (edgeIds.has(normalized.edge.id)) {
      return {
        ok: false,
        error: `edges[${index}].id duplicates an existing edge id: ${normalized.edge.id}`,
      };
    }
    edgeIds.add(normalized.edge.id);
    edges.push(normalized.edge);
  }

  const document: CanvasDocument = {
    ...root,
    nodes,
    edges,
  };
  const nodeRefError = validateNodeReferences(document);
  if (nodeRefError) {
    return { ok: false, error: nodeRefError };
  }
  const refError = validateEdgeNodeReferences(document);
  if (refError) {
    return { ok: false, error: refError };
  }
  return { ok: true, document };
};

export const serializeCanvasDocument = (document: CanvasDocument): string =>
  `${JSON.stringify(document, null, 2)}\n`;
