import {
  forwardRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { type LoadState } from "../../lib/types";
import {
  createEmptyCanvasDocument,
  parseCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocument,
  type CanvasEdge,
  type CanvasEdgeEnd,
  type CanvasNode,
  type CanvasNodeShape,
  type CanvasSide,
} from "./document";
import {
  CanvasAlignLeftIcon,
  CanvasAlignTopIcon,
  CanvasCodeIcon,
  CanvasColorPalette,
  CanvasConnectIcon,
  CanvasCopyIcon,
  CanvasDeleteConfirmDialog,
  CanvasDuplicateIcon,
  CanvasEdgeDirectionPicker,
  CanvasEditIcon,
  CanvasFitIcon,
  CanvasFloatingToolbar,
  CanvasGroupIcon,
  CanvasIconButton,
  CanvasPasteIcon,
  CanvasPlusIcon,
  CanvasShapePicker,
  CanvasSnapIcon,
  CanvasTrashIcon,
  CanvasViewIcon,
  CanvasZoomInIcon,
  CanvasZoomOutIcon,
} from "./CanvasToolbar";
import {
  buildEmptyCanvasCustomColorSlots,
  normalizeCanvasCustomColorSlots,
  type CanvasCustomColorSlot,
} from "./canvasSettings";

export type CanvasEditorMode = "view" | "edit" | "code";
type CanvasMode = CanvasEditorMode;
type DirectionPreset = "none" | "forward" | "backward" | "both";

export type PersistCanvasResult = {
  ok: boolean;
  error?: string;
};

export type CanvasEditorHandle = {
  fitToContent: () => void;
};

type CanvasEditorProps = {
  source: string;
  sourceKey: string | null;
  sourceState?: LoadState;
  sourceError?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  canEditSource?: boolean;
  showModeToggle?: boolean;
  forcedMode?: CanvasEditorMode;
  toolbarActions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  canvasCustomColors?: CanvasCustomColorSlot[];
  onCanvasCustomColorsChange?: (nextSlots: CanvasCustomColorSlot[]) => void;
  onPersistSource: (nextSource: string) => Promise<PersistCanvasResult>;
};

type CanvasPoint = {
  x: number;
  y: number;
};

type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

type DragOperation =
  | {
      kind: "pan";
      startClientX: number;
      startClientY: number;
      baseX: number;
      baseY: number;
    }
  | {
      kind: "move";
      startClientX: number;
      startClientY: number;
      nodeIds: string[];
      baseNodes: Record<string, CanvasPoint>;
    }
  | {
      kind: "resize";
      startClientX: number;
      startClientY: number;
      nodeId: string;
      baseWidth: number;
      baseHeight: number;
    }
  | {
      kind: "select";
      startPoint: CanvasPoint;
      currentPoint: CanvasPoint;
    };

type ContextMenuState = {
  x: number;
  y: number;
  canvasPoint: CanvasPoint;
  nodeId?: string;
};

type EdgeRenderRow = {
  edge: CanvasEdge;
  path: string;
  labelPoint: CanvasPoint;
  fromPoint: CanvasPoint;
  toPoint: CanvasPoint;
};

type ConnectionDragState = {
  fromNodeId: string;
  fromSide: CanvasSide;
  currentPoint: CanvasPoint;
};

type ConnectionDropPromptState = {
  fromNodeId: string;
  fromSide: CanvasSide;
  point: CanvasPoint;
};

type DeleteConfirmState = {
  nodeIds: string[];
} | null;

const INTERNAL_WIDTH = 2600;
const INTERNAL_HEIGHT = 1900;
const INTERNAL_ORIGIN = 1200;
const DEFAULT_VIEWPORT: CanvasViewport = { x: -900, y: -1020, zoom: 1 };
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const WHEEL_ZOOM_STEP = 0.06;
const DEFAULT_GRID_SIZE = 20;
const MIN_GRID_SIZE = 5;
const MAX_GRID_SIZE = 80;
const DEFAULT_CARD_WIDTH = 240;
const DEFAULT_CARD_HEIGHT = 110;
const DEFAULT_GROUP_WIDTH = 320;
const DEFAULT_GROUP_HEIGHT = 220;
const MIN_NODE_WIDTH = 100;
const MIN_NODE_HEIGHT = 60;
const GROUP_PADDING = 32;
const PASTE_OFFSET = 24;
const ALIGN_GAP = 24;
const CANVAS_SIDES: CanvasSide[] = ["top", "right", "bottom", "left"];
const STANDARD_COLORS = ["1", "2", "3", "4", "5", "6"] as const;
const SHAPES: CanvasNodeShape[] = [
  "rounded-rectangle",
  "rectangle",
  "ellipse",
  "diamond",
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const clampZoom = (value: number) => clamp(value, MIN_ZOOM, MAX_ZOOM);

const normalizeGridSize = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? clamp(Math.round(value), MIN_GRID_SIZE, MAX_GRID_SIZE)
    : DEFAULT_GRID_SIZE;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isGroupNode = (node: CanvasNode) => node.type.toLowerCase() === "group";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  );
};

const snapValue = (value: number, gridSize: number, snapEnabled: boolean) =>
  snapEnabled && gridSize > 0
    ? Math.round(value / gridSize) * gridSize
    : Math.round(value);

const clampNodeX = (x: number, width: number) =>
  clamp(x, -INTERNAL_ORIGIN, INTERNAL_WIDTH - INTERNAL_ORIGIN - width);

const clampNodeY = (y: number, height: number) =>
  clamp(y, -INTERNAL_ORIGIN, INTERNAL_HEIGHT - INTERNAL_ORIGIN - height);

const getNodeContentX = (node: CanvasNode) => INTERNAL_ORIGIN + node.x;
const getNodeContentY = (node: CanvasNode) => INTERNAL_ORIGIN + node.y;

const resolveNodeTitle = (node: CanvasNode) => {
  if (typeof node.label === "string" && node.label.trim()) {
    return node.label.trim();
  }
  if (typeof node.text === "string" && node.text.trim()) {
    return node.text.trim();
  }
  if (typeof node.file === "string" && node.file.trim()) {
    return node.file.trim();
  }
  if (typeof node.url === "string" && node.url.trim()) {
    return node.url.trim();
  }
  return node.id;
};

const resolveNodeText = (node: CanvasNode) => {
  if (typeof node.text === "string") {
    return node.text;
  }
  if (typeof node.file === "string") {
    return node.file;
  }
  if (typeof node.url === "string") {
    return node.url;
  }
  if (typeof node.label === "string") {
    return node.label;
  }
  return "";
};

const resolveNodeShape = (node: CanvasNode): CanvasNodeShape =>
  SHAPES.includes(node.shape as CanvasNodeShape)
    ? (node.shape as CanvasNodeShape)
    : "rounded-rectangle";

const resolveColorClassName = (node: CanvasNode) => {
  const color = typeof node.color === "string" ? node.color.trim() : "";
  if (!color) {
    return "business-canvas-color-1";
  }
  return STANDARD_COLORS.includes(color as (typeof STANDARD_COLORS)[number])
    ? `business-canvas-color-${color}`
    : "business-canvas-color-custom";
};

const resolveNodeColorStyle = (node: CanvasNode): CSSProperties | undefined => {
  const color = typeof node.color === "string" ? node.color.trim() : "";
  if (!color || STANDARD_COLORS.includes(color as (typeof STANDARD_COLORS)[number])) {
    return undefined;
  }
  return {
    "--business-canvas-custom-color": color,
  } as CSSProperties;
};

const resolveAnchorPoint = (
  node: CanvasNode,
  side: CanvasSide | undefined,
): CanvasPoint => {
  const left = getNodeContentX(node);
  const top = getNodeContentY(node);
  const centerX = left + node.width / 2;
  const centerY = top + node.height / 2;
  switch (side) {
    case "top":
      return { x: centerX, y: top };
    case "right":
      return { x: left + node.width, y: centerY };
    case "bottom":
      return { x: centerX, y: top + node.height };
    case "left":
      return { x: left, y: centerY };
    default:
      return { x: centerX, y: centerY };
  }
};

const sideVector = (side: CanvasSide | undefined) => {
  switch (side) {
    case "top":
      return { x: 0, y: -1 };
    case "right":
      return { x: 1, y: 0 };
    case "bottom":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
};

const sampleCubic = (
  fromPoint: CanvasPoint,
  controlOne: CanvasPoint,
  controlTwo: CanvasPoint,
  toPoint: CanvasPoint,
  t: number,
): CanvasPoint => {
  const inverse = 1 - t;
  return {
    x:
      inverse ** 3 * fromPoint.x +
      3 * inverse ** 2 * t * controlOne.x +
      3 * inverse * t ** 2 * controlTwo.x +
      t ** 3 * toPoint.x,
    y:
      inverse ** 3 * fromPoint.y +
      3 * inverse ** 2 * t * controlOne.y +
      3 * inverse * t ** 2 * controlTwo.y +
      t ** 3 * toPoint.y,
  };
};

const buildEdgeRenderRow = (
  edge: CanvasEdge,
  fromNode: CanvasNode,
  toNode: CanvasNode,
): EdgeRenderRow => {
  const fromPoint = resolveAnchorPoint(fromNode, edge.fromSide);
  const toPoint = resolveAnchorPoint(toNode, edge.toSide);
  const distance = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y);
  const controlDistance = clamp(distance * 0.45, 80, 220);
  const fromVector = sideVector(edge.fromSide);
  const toVector = sideVector(edge.toSide);
  const controlOne = {
    x: fromPoint.x + fromVector.x * controlDistance,
    y: fromPoint.y + fromVector.y * controlDistance,
  };
  const controlTwo = {
    x: toPoint.x + toVector.x * controlDistance,
    y: toPoint.y + toVector.y * controlDistance,
  };
  return {
    edge,
    path: [
      `M ${fromPoint.x} ${fromPoint.y}`,
      `C ${controlOne.x} ${controlOne.y}`,
      `${controlTwo.x} ${controlTwo.y}`,
      `${toPoint.x} ${toPoint.y}`,
    ].join(" "),
    labelPoint: sampleCubic(fromPoint, controlOne, controlTwo, toPoint, 0.5),
    fromPoint,
    toPoint,
  };
};

const resolveShortestSides = (
  fromNode: CanvasNode,
  toNode: CanvasNode,
): { fromSide: CanvasSide; toSide: CanvasSide } => {
  const sides: CanvasSide[] = ["top", "right", "bottom", "left"];
  let best = { fromSide: "right" as CanvasSide, toSide: "left" as CanvasSide };
  let bestDistance = Number.POSITIVE_INFINITY;
  sides.forEach((fromSide) => {
    sides.forEach((toSide) => {
      const fromPoint = resolveAnchorPoint(fromNode, fromSide);
      const toPoint = resolveAnchorPoint(toNode, toSide);
      const distance = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { fromSide, toSide };
      }
    });
  });
  return best;
};

const normalizeEdgeSides = (document: CanvasDocument): CanvasDocument => {
  const nodesById = new Map(document.nodes.map((node) => [node.id, node]));
  return {
    ...document,
    edges: document.edges.map((edge) => {
      const fromNode = nodesById.get(edge.fromNode);
      const toNode = nodesById.get(edge.toNode);
      if (!fromNode || !toNode) {
        return edge;
      }
      const shortest = resolveShortestSides(fromNode, toNode);
      return {
        ...edge,
        fromSide: edge.fromSide ?? shortest.fromSide,
        toSide: edge.toSide ?? shortest.toSide,
      };
    }),
  };
};

const resolveViewport = (document: CanvasDocument): CanvasViewport => {
  const viewport = isRecord(document.viewport) ? document.viewport : {};
  const x = typeof viewport.x === "number" && Number.isFinite(viewport.x)
    ? viewport.x
    : DEFAULT_VIEWPORT.x;
  const y = typeof viewport.y === "number" && Number.isFinite(viewport.y)
    ? viewport.y
    : DEFAULT_VIEWPORT.y;
  const zoom = typeof viewport.zoom === "number" && Number.isFinite(viewport.zoom)
    ? clampZoom(viewport.zoom)
    : DEFAULT_VIEWPORT.zoom;
  return { x, y, zoom };
};

const resolveGrid = (document: CanvasDocument) => {
  const grid = isRecord(document.grid) ? document.grid : {};
  return {
    size: normalizeGridSize(grid.size),
    snap: typeof grid.snap === "boolean" ? grid.snap : true,
  };
};

const directionFromEdge = (edge: CanvasEdge): DirectionPreset => {
  if (edge.fromEnd === "arrow" && edge.toEnd === "arrow") {
    return "both";
  }
  if (edge.fromEnd === "arrow") {
    return "backward";
  }
  if (edge.toEnd === "arrow") {
    return "forward";
  }
  return "none";
};

const edgeEndsFromDirection = (
  direction: DirectionPreset,
): { fromEnd: CanvasEdgeEnd; toEnd: CanvasEdgeEnd } => {
  if (direction === "both") {
    return { fromEnd: "arrow", toEnd: "arrow" };
  }
  if (direction === "backward") {
    return { fromEnd: "arrow", toEnd: "none" };
  }
  if (direction === "forward") {
    return { fromEnd: "none", toEnd: "arrow" };
  }
  return { fromEnd: "none", toEnd: "none" };
};

const createId = (prefix: string, existingIds: Set<string>) => {
  let index = 1;
  let candidate = `${prefix}-${index}`;
  while (existingIds.has(candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
  }
  return candidate;
};

const nodeIsFullyInside = (node: CanvasNode, group: CanvasNode) =>
  node.x >= group.x &&
  node.y >= group.y &&
  node.x + node.width <= group.x + group.width &&
  node.y + node.height <= group.y + group.height;

const resolveNodeBounds = (nodes: CanvasNode[]) => {
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

export const CanvasEditor = forwardRef<CanvasEditorHandle, CanvasEditorProps>(({
  source,
  sourceKey,
  sourceState = "idle",
  sourceError = "",
  title = "Canvas",
  subtitle,
  canEditSource = true,
  showModeToggle = true,
  forcedMode,
  toolbarActions,
  className,
  bodyClassName,
  canvasCustomColors = buildEmptyCanvasCustomColorSlots(),
  onCanvasCustomColorsChange,
  onPersistSource,
}, ref) => {
  const [mode, setMode] = useState<CanvasMode>("view");
  const [draftDocument, setDraftDocument] = useState<CanvasDocument>(
    createEmptyCanvasDocument(),
  );
  const [renderDocument, setRenderDocument] = useState<CanvasDocument>(
    createEmptyCanvasDocument(),
  );
  const [lastSavedSource, setLastSavedSource] = useState("");
  const [codeDraft, setCodeDraft] = useState("");
  const [modeError, setModeError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [loadValidationError, setLoadValidationError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [viewport, setViewport] = useState<CanvasViewport>(DEFAULT_VIEWPORT);
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [operation, setOperation] = useState<DragOperation | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [edgeLabelDraft, setEdgeLabelDraft] = useState("");
  const [clipboardNodes, setClipboardNodes] = useState<CanvasNode[]>([]);
  const [armedConnectionNodeId, setArmedConnectionNodeId] = useState<string | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDragState | null>(null);
  const [connectionDropPrompt, setConnectionDropPrompt] =
    useState<ConnectionDropPromptState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const draftDocumentRef = useRef(draftDocument);
  const renderDocumentRef = useRef(renderDocument);
  const sourceKeyRef = useRef<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const viewportStateRef = useRef(viewport);
  const gridStateRef = useRef({ size: gridSize, snap: snapEnabled });

  useEffect(() => {
    draftDocumentRef.current = draftDocument;
  }, [draftDocument]);

  useEffect(() => {
    renderDocumentRef.current = renderDocument;
  }, [renderDocument]);

  useEffect(() => {
    viewportStateRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    gridStateRef.current = { size: gridSize, snap: snapEnabled };
  }, [gridSize, snapEnabled]);

  const normalizedCustomColors = useMemo(
    () => normalizeCanvasCustomColorSlots(canvasCustomColors),
    [canvasCustomColors],
  );

  const saveCustomColorSlot = useCallback(
    (slot: CanvasCustomColorSlot) => {
      const nextSlots = normalizeCanvasCustomColorSlots(
        normalizedCustomColors.map((current) =>
          current.slot === slot.slot ? slot : current,
        ),
      );
      onCanvasCustomColorsChange?.(nextSlots);
    },
    [normalizedCustomColors, onCanvasCustomColorsChange],
  );

  useEffect(() => {
    const nextSourceKey = sourceKey ?? null;
    const hasSourceChanged = nextSourceKey !== sourceKeyRef.current;
    if (!hasSourceChanged && source === lastSavedSource) {
      return;
    }

    if (hasSourceChanged) {
      sourceKeyRef.current = nextSourceKey;
      setMode(forcedMode ?? "view");
      setViewport(DEFAULT_VIEWPORT);
      setGridSize(DEFAULT_GRID_SIZE);
      setSnapEnabled(true);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setEditingNodeId(null);
      setEditingEdgeId(null);
      setConnectionDrag(null);
      setConnectionDropPrompt(null);
      setDeleteConfirm(null);
      setModeError("");
      setSaveError("");
    }

    if (!nextSourceKey || sourceState !== "idle") {
      return;
    }

    const parsed = parseCanvasDocument(source);
    if (!parsed.ok) {
      setLoadValidationError(parsed.error);
      setCodeDraft(source);
      setDraftDocument(createEmptyCanvasDocument());
      setRenderDocument(createEmptyCanvasDocument());
      renderDocumentRef.current = createEmptyCanvasDocument();
      setLastSavedSource(source);
      return;
    }

    const serialized = serializeCanvasDocument(parsed.document);
    const nextViewport = resolveViewport(parsed.document);
    const nextGrid = resolveGrid(parsed.document);
    setLoadValidationError("");
    setDraftDocument(parsed.document);
    draftDocumentRef.current = parsed.document;
    setRenderDocument(parsed.document);
    renderDocumentRef.current = parsed.document;
    setCodeDraft(serialized);
    setViewport(nextViewport);
    setGridSize(nextGrid.size);
    setSnapEnabled(nextGrid.snap);
    setLastSavedSource(serialized);
  }, [source, sourceKey, sourceState]);

  const decorateForPersistence = useCallback((document: CanvasDocument) => {
    const normalized = normalizeEdgeSides(document);
    return {
      ...normalized,
      viewport: viewportStateRef.current,
      grid: gridStateRef.current,
    };
  }, []);

  const persistDocument = useCallback(
    async (document: CanvasDocument) => {
      const persistedDocument = decorateForPersistence(document);
      const serialized = serializeCanvasDocument(persistedDocument);
      if (serialized === lastSavedSource) {
        return true;
      }
      setIsSaving(true);
      setSaveError("");
      const persisted = await onPersistSource(serialized);
      setIsSaving(false);
      if (!persisted.ok) {
        setSaveError(persisted.error ?? "Canvas document could not be saved.");
        return false;
      }
      setLastSavedSource(serialized);
      setCodeDraft(serialized);
      setLoadValidationError("");
      draftDocumentRef.current = persistedDocument;
      setDraftDocument(persistedDocument);
      setRenderDocument(persistedDocument);
      renderDocumentRef.current = persistedDocument;
      return true;
    },
    [decorateForPersistence, lastSavedSource, onPersistSource],
  );

  const applyDraftChange = useCallback(
    (updater: (current: CanvasDocument) => CanvasDocument, persist = true) => {
      const nextDocument = updater(draftDocumentRef.current);
      draftDocumentRef.current = nextDocument;
      setDraftDocument(nextDocument);
      if (persist) {
        void persistDocument(nextDocument);
      }
      return nextDocument;
    },
    [persistDocument],
  );

  const switchMode = useCallback(
    async (nextMode: CanvasMode) => {
      if (nextMode === mode) {
        return;
      }

      setModeError("");
      setContextMenu(null);
      setEditingNodeId(null);
      setEditingEdgeId(null);

      if (mode === "code" && nextMode !== "code") {
        const parsed = parseCanvasDocument(codeDraft);
        if (!parsed.ok) {
          setModeError(parsed.error);
          return;
        }
        setDraftDocument(parsed.document);
        draftDocumentRef.current = parsed.document;
        setRenderDocument(parsed.document);
        const saved = await persistDocument(parsed.document);
        if (!saved) {
          return;
        }
      }

      if (mode === "edit" && nextMode === "view") {
        const saved = await persistDocument(draftDocumentRef.current);
        if (!saved) {
          return;
        }
        setRenderDocument(draftDocumentRef.current);
        renderDocumentRef.current = draftDocumentRef.current;
      }

      if (mode === "edit" && nextMode === "code") {
        setCodeDraft(serializeCanvasDocument(decorateForPersistence(draftDocumentRef.current)));
      }

      if (mode === "view" && nextMode === "edit") {
        if (loadValidationError) {
          return;
        }
        setDraftDocument(renderDocumentRef.current);
        draftDocumentRef.current = renderDocumentRef.current;
      }

      setMode(nextMode);
    },
    [
      codeDraft,
      decorateForPersistence,
      loadValidationError,
      mode,
      persistDocument,
    ],
  );

  useEffect(() => {
    if (!forcedMode || forcedMode === mode) {
      return;
    }
    void switchMode(forcedMode);
  }, [forcedMode, mode, switchMode]);

  const activeDocument = mode === "edit" ? draftDocument : renderDocument;
  const nodesById = useMemo(
    () => new Map(activeDocument.nodes.map((node) => [node.id, node])),
    [activeDocument.nodes],
  );
  const groupNodes = useMemo(
    () => activeDocument.nodes.filter((node) => isGroupNode(node)),
    [activeDocument.nodes],
  );
  const regularNodes = useMemo(
    () => activeDocument.nodes.filter((node) => !isGroupNode(node)),
    [activeDocument.nodes],
  );
  const selectedNodes = useMemo(
    () =>
      selectedNodeIds
        .map((nodeId) => nodesById.get(nodeId))
        .filter((node): node is CanvasNode => Boolean(node)),
    [nodesById, selectedNodeIds],
  );
  const selectedRegularNodes = useMemo(
    () => selectedNodes.filter((node) => !isGroupNode(node)),
    [selectedNodes],
  );
  const selectedEdge = useMemo(
    () => activeDocument.edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [activeDocument.edges, selectedEdgeId],
  );

  const viewportToCanvasPoint = useCallback(
    (clientX: number, clientY: number): CanvasPoint => {
      const rect = viewportRef.current?.getBoundingClientRect();
      const viewportLeft = rect?.left ?? 0;
      const viewportTop = rect?.top ?? 0;
      return {
        x: (clientX - viewportLeft - viewport.x) / viewport.zoom - INTERNAL_ORIGIN,
        y: (clientY - viewportTop - viewport.y) / viewport.zoom - INTERNAL_ORIGIN,
      };
    },
    [viewport],
  );

  const toSnappedCanvasPoint = useCallback(
    (point: CanvasPoint) => ({
      x: snapValue(point.x, gridSize, snapEnabled),
      y: snapValue(point.y, gridSize, snapEnabled),
    }),
    [gridSize, snapEnabled],
  );

  const oppositeSide = useCallback((side: CanvasSide): CanvasSide => {
    switch (side) {
      case "top":
        return "bottom";
      case "right":
        return "left";
      case "bottom":
        return "top";
      case "left":
        return "right";
    }
  }, []);

  const resolveNearestSide = useCallback(
    (node: CanvasNode, point: CanvasPoint): CanvasSide => {
      const contentPoint = {
        x: INTERNAL_ORIGIN + point.x,
        y: INTERNAL_ORIGIN + point.y,
      };
      let bestSide: CanvasSide = "left";
      let bestDistance = Number.POSITIVE_INFINITY;
      CANVAS_SIDES.forEach((side) => {
        const anchorPoint = resolveAnchorPoint(node, side);
        const distance = Math.hypot(
          contentPoint.x - anchorPoint.x,
          contentPoint.y - anchorPoint.y,
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          bestSide = side;
        }
      });
      return bestSide;
    },
    [],
  );

  const createNodeAtPoint = useCallback(
    (kind: "text" | "group", point: CanvasPoint) => {
      if (mode !== "edit") {
        return;
      }
      const snappedPoint = toSnappedCanvasPoint(point);
      const nextDocument = applyDraftChange((current) => {
        const ids = new Set(current.nodes.map((node) => node.id));
        const id = createId(kind === "group" ? "group" : "card", ids);
        const node: CanvasNode =
          kind === "group"
            ? {
                id,
                type: "group",
                label: "Gruppe",
                x: clampNodeX(snappedPoint.x, DEFAULT_GROUP_WIDTH),
                y: clampNodeY(snappedPoint.y, DEFAULT_GROUP_HEIGHT),
                width: DEFAULT_GROUP_WIDTH,
                height: DEFAULT_GROUP_HEIGHT,
                color: "4",
              }
            : {
                id,
                type: "text",
                text: "Neue Karte",
                x: clampNodeX(snappedPoint.x, DEFAULT_CARD_WIDTH),
                y: clampNodeY(snappedPoint.y, DEFAULT_CARD_HEIGHT),
                width: DEFAULT_CARD_WIDTH,
                height: DEFAULT_CARD_HEIGHT,
                color: "1",
                shape: "rounded-rectangle",
              };
        return { ...current, nodes: [...current.nodes, node] };
      });
      const added = nextDocument.nodes[nextDocument.nodes.length - 1];
      setSelectedNodeIds(added ? [added.id] : []);
      setSelectedEdgeId(null);
    },
    [applyDraftChange, mode, toSnappedCanvasPoint],
  );

  const createNodeAtVisibleTopLeft = useCallback(
    (kind: "text" | "group") => {
      const rect = viewportRef.current?.getBoundingClientRect();
      const inset = 28;
      const point = rect
        ? viewportToCanvasPoint(rect.left + inset, rect.top + inset)
        : {
            x: (-viewport.x + inset) / viewport.zoom - INTERNAL_ORIGIN,
            y: (-viewport.y + inset) / viewport.zoom - INTERNAL_ORIGIN,
          };
      createNodeAtPoint(kind, point);
    },
    [createNodeAtPoint, viewport, viewportToCanvasPoint],
  );

  const copyNodesToClipboard = useCallback((nodes: CanvasNode[]) => {
    const copyableNodes = nodes.filter((node) => !isGroupNode(node));
    if (copyableNodes.length === 0) {
      return false;
    }
    setClipboardNodes(copyableNodes.map((node) => ({ ...node })));
    return true;
  }, []);

  const copySelectedNodes = useCallback(() => {
    copyNodesToClipboard(selectedRegularNodes);
  }, [copyNodesToClipboard, selectedRegularNodes]);

  const pasteNodeCopies = useCallback(
    (nodeCopies: CanvasNode[], targetPoint?: CanvasPoint) => {
      if (mode !== "edit" || nodeCopies.length === 0) {
        return;
      }
      const sourceBounds = resolveNodeBounds(nodeCopies);
      const ids = new Set(draftDocumentRef.current.nodes.map((node) => node.id));
      const baseTarget = targetPoint
        ? toSnappedCanvasPoint(targetPoint)
        : {
            x: sourceBounds.minX + PASTE_OFFSET,
            y: sourceBounds.minY + PASTE_OFFSET,
          };
      const pastedIds: string[] = [];
      applyDraftChange((current) => {
        const nextNodes = nodeCopies.map((node) => {
          const id = createId("card", ids);
          ids.add(id);
          pastedIds.push(id);
          const x = targetPoint
            ? baseTarget.x + (node.x - sourceBounds.minX)
            : node.x + PASTE_OFFSET;
          const y = targetPoint
            ? baseTarget.y + (node.y - sourceBounds.minY)
            : node.y + PASTE_OFFSET;
          return {
            ...node,
            id,
            group: undefined,
            x: clampNodeX(snapValue(x, gridSize, snapEnabled), node.width),
            y: clampNodeY(snapValue(y, gridSize, snapEnabled), node.height),
          };
        });
        return { ...current, nodes: [...current.nodes, ...nextNodes] };
      });
      setSelectedNodeIds(pastedIds);
      setSelectedEdgeId(null);
    },
    [applyDraftChange, gridSize, mode, snapEnabled, toSnappedCanvasPoint],
  );

  const pasteNodes = useCallback(
    (targetPoint?: CanvasPoint) => {
      pasteNodeCopies(clipboardNodes, targetPoint);
    },
    [clipboardNodes, pasteNodeCopies],
  );

  const duplicateSelectedNodes = useCallback(() => {
    pasteNodeCopies(selectedRegularNodes);
  }, [pasteNodeCopies, selectedRegularNodes]);

  const deleteNodeIds = useCallback(
    (nodeIds: string[]) => {
      if (mode !== "edit" || nodeIds.length === 0) {
        return;
      }
      const deleteIds = new Set(nodeIds);
      applyDraftChange((current) => ({
        ...current,
        nodes: current.nodes
          .filter((node) => !deleteIds.has(node.id))
          .map((node) =>
            node.group && deleteIds.has(node.group) ? { ...node, group: undefined } : node,
          ),
        edges: current.edges.filter(
          (edge) => !deleteIds.has(edge.fromNode) && !deleteIds.has(edge.toNode),
        ),
      }));
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setEditingNodeId(null);
      setEditingEdgeId(null);
    },
    [applyDraftChange, mode],
  );

  const requestDeleteNodeIds = useCallback(
    (nodeIds: string[]) => {
      if (nodeIds.length === 0) {
        return;
      }
      const nodes = nodeIds
        .map((nodeId) => nodesById.get(nodeId))
        .filter((node): node is CanvasNode => Boolean(node));
      const requiresConfirmation =
        nodeIds.length > 1 || nodes.some((node) => isGroupNode(node));
      if (!requiresConfirmation) {
        deleteNodeIds(nodeIds);
        return;
      }
      setDeleteConfirm({ nodeIds });
    },
    [deleteNodeIds, nodesById],
  );

  const deleteSelection = useCallback(() => {
    if (mode !== "edit") {
      return;
    }
    if (selectedEdgeId && selectedNodeIds.length === 0) {
      applyDraftChange((current) => ({
        ...current,
        edges: current.edges.filter((edge) => edge.id !== selectedEdgeId),
      }));
      setSelectedEdgeId(null);
      setEditingEdgeId(null);
      return;
    }
    if (selectedNodeIds.length === 0) {
      return;
    }
    requestDeleteNodeIds(selectedNodeIds);
  }, [
    applyDraftChange,
    mode,
    requestDeleteNodeIds,
    selectedEdgeId,
    selectedNodeIds,
  ]);

  const confirmNodeDelete = useCallback(() => {
    if (!deleteConfirm) {
      return;
    }
    const nodeIds = deleteConfirm.nodeIds;
    setDeleteConfirm(null);
    deleteNodeIds(nodeIds);
  }, [deleteConfirm, deleteNodeIds]);

  const createGroupFromSelection = useCallback(() => {
    if (mode !== "edit" || selectedRegularNodes.length < 2) {
      return;
    }
    const bounds = resolveNodeBounds(selectedRegularNodes);
    let createdGroupId = "";
    applyDraftChange((current) => {
      const ids = new Set(current.nodes.map((node) => node.id));
      createdGroupId = createId("group", ids);
      const groupNode: CanvasNode = {
        id: createdGroupId,
        type: "group",
        label: "Gruppe",
        x: bounds.minX - GROUP_PADDING,
        y: bounds.minY - GROUP_PADDING,
        width: bounds.width + GROUP_PADDING * 2,
        height: bounds.height + GROUP_PADDING * 2,
        color: "4",
        members: selectedRegularNodes.map((node) => node.id),
      };
      return {
        ...current,
        nodes: [
          groupNode,
          ...current.nodes.map((node) =>
            selectedNodeIds.includes(node.id) && !isGroupNode(node)
              ? { ...node, group: createdGroupId }
              : node,
          ),
        ],
      };
    });
    setSelectedNodeIds(createdGroupId ? [createdGroupId] : []);
  }, [applyDraftChange, mode, selectedNodeIds, selectedRegularNodes]);

  const applyColor = useCallback(
    (color: string) => {
      if (mode !== "edit" || selectedNodeIds.length === 0) {
        return;
      }
      const selectedIds = new Set(selectedNodeIds);
      applyDraftChange((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          selectedIds.has(node.id) ? { ...node, color } : node,
        ),
      }));
    },
    [applyDraftChange, mode, selectedNodeIds],
  );

  const applyShape = useCallback(
    (shape: CanvasNodeShape) => {
      if (mode !== "edit" || selectedRegularNodes.length === 0) {
        return;
      }
      const selectedIds = new Set(selectedRegularNodes.map((node) => node.id));
      applyDraftChange((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          selectedIds.has(node.id) ? { ...node, shape } : node,
        ),
      }));
    },
    [applyDraftChange, mode, selectedRegularNodes],
  );

  const alignSelection = useCallback(
    (axis: "x" | "y") => {
      if (mode !== "edit" || selectedNodeIds.length < 2) {
        return;
      }
      const target = Math.min(...selectedNodes.map((node) => node[axis]));
      const orderedNodes =
        axis === "x"
          ? [...selectedNodes].sort((left, right) => left.y - right.y || left.x - right.x)
          : [...selectedNodes].sort((left, right) => left.x - right.x || left.y - right.y);
      const updates = new Map<string, CanvasPoint>();
      if (axis === "x") {
        let nextY = orderedNodes[0]?.y ?? 0;
        orderedNodes.forEach((node) => {
          updates.set(node.id, {
            x: clampNodeX(target, node.width),
            y: clampNodeY(nextY, node.height),
          });
          nextY += node.height + ALIGN_GAP;
        });
      } else {
        let nextX = orderedNodes[0]?.x ?? 0;
        orderedNodes.forEach((node) => {
          updates.set(node.id, {
            x: clampNodeX(nextX, node.width),
            y: clampNodeY(target, node.height),
          });
          nextX += node.width + ALIGN_GAP;
        });
      }
      const selectedIds = new Set(selectedNodeIds);
      applyDraftChange((current) => ({
        ...current,
        nodes: current.nodes.map((node) => {
          if (!selectedIds.has(node.id)) {
            return node;
          }
          const update = updates.get(node.id);
          return update ? { ...node, ...update } : node;
        }),
      }));
    },
    [applyDraftChange, mode, selectedNodeIds, selectedNodes],
  );

  const addConnection = useCallback(
    (
      fromNodeId: string,
      toNodeId: string,
      sides?: { fromSide?: CanvasSide; toSide?: CanvasSide },
    ) => {
      if (fromNodeId === toNodeId) {
        return;
      }
      applyDraftChange((current) => {
        const ids = new Set(current.edges.map((edge) => edge.id));
        const fromNode = current.nodes.find((node) => node.id === fromNodeId);
        const toNode = current.nodes.find((node) => node.id === toNodeId);
        if (!fromNode || !toNode || isGroupNode(fromNode) || isGroupNode(toNode)) {
          return current;
        }
        const shortestPair = resolveShortestSides(fromNode, toNode);
        const sidePair = {
          fromSide: sides?.fromSide ?? shortestPair.fromSide,
          toSide: sides?.toSide ?? shortestPair.toSide,
        };
        const edge: CanvasEdge = {
          id: createId("edge", ids),
          fromNode: fromNodeId,
          toNode: toNodeId,
          ...sidePair,
          fromEnd: "none",
          toEnd: "arrow",
        };
        return { ...current, edges: [...current.edges, edge] };
      });
      setArmedConnectionNodeId(null);
      setSelectedEdgeId(null);
    },
    [applyDraftChange],
  );

  const createConnectedNodeAtPoint = useCallback(
    (prompt: ConnectionDropPromptState) => {
      if (mode !== "edit") {
        return;
      }
      const snappedPoint = toSnappedCanvasPoint(prompt.point);
      let createdNodeId = "";
      applyDraftChange((current) => {
        const nodeIds = new Set(current.nodes.map((node) => node.id));
        const edgeIds = new Set(current.edges.map((edge) => edge.id));
        const fromNode = current.nodes.find((node) => node.id === prompt.fromNodeId);
        if (!fromNode || isGroupNode(fromNode)) {
          return current;
        }
        createdNodeId = createId("card", nodeIds);
        nodeIds.add(createdNodeId);
        const createdEdgeId = createId("edge", edgeIds);
        const newNode: CanvasNode = {
          id: createdNodeId,
          type: "text",
          text: "Neue Karte",
          x: clampNodeX(snappedPoint.x - DEFAULT_CARD_WIDTH / 2, DEFAULT_CARD_WIDTH),
          y: clampNodeY(snappedPoint.y - DEFAULT_CARD_HEIGHT / 2, DEFAULT_CARD_HEIGHT),
          width: DEFAULT_CARD_WIDTH,
          height: DEFAULT_CARD_HEIGHT,
          color: "1",
          shape: "rounded-rectangle",
        };
        const edge: CanvasEdge = {
          id: createdEdgeId,
          fromNode: prompt.fromNodeId,
          toNode: createdNodeId,
          fromSide: prompt.fromSide,
          toSide: oppositeSide(prompt.fromSide),
          fromEnd: "none",
          toEnd: "arrow",
        };
        return {
          ...current,
          nodes: [...current.nodes, newNode],
          edges: [...current.edges, edge],
        };
      });
      setConnectionDropPrompt(null);
      setArmedConnectionNodeId(null);
      setSelectedNodeIds(createdNodeId ? [createdNodeId] : []);
      setSelectedEdgeId(null);
    },
    [applyDraftChange, mode, oppositeSide, toSnappedCanvasPoint],
  );

  const updateEdgeDirection = useCallback(
    (edgeId: string, direction: DirectionPreset) => {
      applyDraftChange((current) => ({
        ...current,
        edges: current.edges.map((edge) =>
          edge.id === edgeId ? { ...edge, ...edgeEndsFromDirection(direction) } : edge,
        ),
      }));
    },
    [applyDraftChange],
  );

  const commitEdgeLabel = useCallback(() => {
    if (!editingEdgeId) {
      return;
    }
    const nextLabel = edgeLabelDraft.trim();
    applyDraftChange((current) => ({
      ...current,
      edges: current.edges.map((edge) =>
        edge.id === editingEdgeId
          ? {
              ...edge,
              label: nextLabel || undefined,
            }
          : edge,
      ),
    }));
    setEditingEdgeId(null);
  }, [applyDraftChange, edgeLabelDraft, editingEdgeId]);

  const startNodeEditing = useCallback((node: CanvasNode) => {
    setSelectedNodeIds([node.id]);
    setSelectedEdgeId(null);
    setContextMenu(null);
    setEditingNodeId(node.id);
  }, []);

  const startConnectionDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      node: CanvasNode,
      side: CanvasSide,
    ) => {
      if (mode !== "edit" || isGroupNode(node)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setContextMenu(null);
      setEditingNodeId(null);
      setEditingEdgeId(null);
      setSelectedNodeIds([node.id]);
      setSelectedEdgeId(null);
      setArmedConnectionNodeId(null);
      setConnectionDropPrompt(null);
      setConnectionDrag({
        fromNodeId: node.id,
        fromSide: side,
        currentPoint: viewportToCanvasPoint(event.clientX, event.clientY),
      });
    },
    [mode, viewportToCanvasPoint],
  );

  useEffect(() => {
    if (!connectionDrag) {
      return;
    }
    const activeDrag = connectionDrag;

    const handlePointerMove = (event: PointerEvent) => {
      setConnectionDrag((current) =>
        current
          ? {
              ...current,
              currentPoint: viewportToCanvasPoint(event.clientX, event.clientY),
            }
          : current,
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dropPoint = viewportToCanvasPoint(event.clientX, event.clientY);
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const targetElement = target instanceof HTMLElement ? target : null;
      const handleElement = targetElement?.closest<HTMLElement>(
        "[data-canvas-connection-side][data-canvas-node-id]",
      );
      const handleNodeId = handleElement?.dataset.canvasNodeId;
      const handleSide = handleElement?.dataset.canvasConnectionSide;
      if (
        handleNodeId &&
        handleNodeId !== activeDrag.fromNodeId &&
        CANVAS_SIDES.includes(handleSide as CanvasSide)
      ) {
        addConnection(activeDrag.fromNodeId, handleNodeId, {
          fromSide: activeDrag.fromSide,
          toSide: handleSide as CanvasSide,
        });
        setConnectionDrag(null);
        return;
      }

      const nodeElement = targetElement?.closest<HTMLElement>("[data-canvas-node-id]");
      const targetNodeId = nodeElement?.dataset.canvasNodeId;
      const targetNode = targetNodeId ? draftDocumentRef.current.nodes.find(
        (node) => node.id === targetNodeId,
      ) : null;
      if (
        targetNode &&
        targetNode.id !== activeDrag.fromNodeId &&
        !isGroupNode(targetNode)
      ) {
        addConnection(activeDrag.fromNodeId, targetNode.id, {
          fromSide: activeDrag.fromSide,
          toSide: resolveNearestSide(targetNode, dropPoint),
        });
        setConnectionDrag(null);
        return;
      }

      setConnectionDropPrompt({
        fromNodeId: activeDrag.fromNodeId,
        fromSide: activeDrag.fromSide,
        point: dropPoint,
      });
      setConnectionDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    addConnection,
    connectionDrag?.fromNodeId,
    connectionDrag?.fromSide,
    resolveNearestSide,
    viewportToCanvasPoint,
  ]);

  useEffect(() => {
    if (!editingNodeId) {
      return;
    }
    const element = document.querySelector<HTMLElement>(
      `[data-canvas-editing-node-id="${editingNodeId}"]`,
    );
    if (!element) {
      return;
    }
    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editingNodeId]);

  useEffect(() => {
    if (!operation) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (operation.kind === "pan") {
        setViewport((current) => ({
          ...current,
          x: operation.baseX + (event.clientX - operation.startClientX),
          y: operation.baseY + (event.clientY - operation.startClientY),
        }));
        return;
      }

      if (operation.kind === "select") {
        setOperation({
          ...operation,
          currentPoint: viewportToCanvasPoint(event.clientX, event.clientY),
        });
        return;
      }

      if (mode !== "edit") {
        return;
      }

      if (operation.kind === "move") {
        const deltaX = (event.clientX - operation.startClientX) / viewport.zoom;
        const deltaY = (event.clientY - operation.startClientY) / viewport.zoom;
        applyDraftChange(
          (current) => ({
            ...current,
            nodes: current.nodes.map((node) => {
              const base = operation.baseNodes[node.id];
              if (!base) {
                return node;
              }
              const nextX = snapValue(base.x + deltaX, gridSize, snapEnabled);
              const nextY = snapValue(base.y + deltaY, gridSize, snapEnabled);
              return {
                ...node,
                x: clampNodeX(nextX, node.width),
                y: clampNodeY(nextY, node.height),
              };
            }),
          }),
          false,
        );
        return;
      }

      if (operation.kind === "resize") {
        const deltaX = (event.clientX - operation.startClientX) / viewport.zoom;
        const deltaY = (event.clientY - operation.startClientY) / viewport.zoom;
        applyDraftChange(
          (current) => ({
            ...current,
            nodes: current.nodes.map((node) => {
              if (node.id !== operation.nodeId) {
                return node;
              }
              const nextWidth = Math.max(
                MIN_NODE_WIDTH,
                snapValue(operation.baseWidth + deltaX, gridSize, snapEnabled),
              );
              const nextHeight = Math.max(
                MIN_NODE_HEIGHT,
                snapValue(operation.baseHeight + deltaY, gridSize, snapEnabled),
              );
              return {
                ...node,
                width: Math.min(nextWidth, INTERNAL_WIDTH - getNodeContentX(node)),
                height: Math.min(nextHeight, INTERNAL_HEIGHT - getNodeContentY(node)),
              };
            }),
          }),
          false,
        );
      }
    };

    const handlePointerUp = () => {
      if (operation.kind === "select") {
        const minX = Math.min(operation.startPoint.x, operation.currentPoint.x);
        const minY = Math.min(operation.startPoint.y, operation.currentPoint.y);
        const maxX = Math.max(operation.startPoint.x, operation.currentPoint.x);
        const maxY = Math.max(operation.startPoint.y, operation.currentPoint.y);
        const hasArea = Math.abs(maxX - minX) > 4 && Math.abs(maxY - minY) > 4;
        setSelectedNodeIds(
          hasArea
            ? draftDocumentRef.current.nodes
                .filter(
                  (node) =>
                    !isGroupNode(node) &&
                    node.x >= minX &&
                    node.y >= minY &&
                    node.x + node.width <= maxX &&
                    node.y + node.height <= maxY,
                )
                .map((node) => node.id)
            : [],
        );
        setOperation(null);
        return;
      }
      const shouldPersist = operation.kind === "move" || operation.kind === "resize";
      setOperation(null);
      if (shouldPersist) {
        void persistDocument(draftDocumentRef.current);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    applyDraftChange,
    gridSize,
    mode,
    operation,
    persistDocument,
    snapEnabled,
    viewport.zoom,
    viewportToCanvasPoint,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        if (event.key === "Escape") {
          setEditingNodeId(null);
          setEditingEdgeId(null);
          setContextMenu(null);
        }
        return;
      }

      if (event.key === " ") {
        setSpacePressed(true);
      }
      if (mode !== "edit") {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelectedNodes();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteNodes();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
        return;
      }
      if (event.key === "Escape") {
        setContextMenu(null);
        setEditingNodeId(null);
        setEditingEdgeId(null);
        setArmedConnectionNodeId(null);
        setConnectionDrag(null);
        setConnectionDropPrompt(null);
        setSelectedEdgeId(null);
        setSelectedNodeIds([]);
        return;
      }
      const arrowDeltas: Record<string, CanvasPoint> = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
      };
      const delta = arrowDeltas[event.key];
      if (!delta || selectedNodeIds.length === 0) {
        return;
      }
      event.preventDefault();
      const step = event.shiftKey ? 1 : 10;
      const selectedIds = new Set(selectedNodeIds);
      applyDraftChange((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          selectedIds.has(node.id)
            ? {
                ...node,
                x: clampNodeX(node.x + delta.x * step, node.width),
                y: clampNodeY(node.y + delta.y * step, node.height),
              }
            : node,
        ),
      }));
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") {
        setSpacePressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    applyDraftChange,
    copySelectedNodes,
    deleteSelection,
    mode,
    pasteNodes,
    selectedNodeIds,
  ]);

  const onViewportPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (mode === "code") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-canvas-node-id], .canvas-edge-hit, .canvas-floating-toolbar, .business-canvas-context-menu, .canvas-connection-drop-popup")) {
        return;
      }
      setContextMenu(null);
      setEditingNodeId(null);
      setEditingEdgeId(null);
      setSelectedEdgeId(null);
      setArmedConnectionNodeId(null);
      if (event.button === 1 || (event.button === 0 && (spacePressed || mode === "view"))) {
        event.preventDefault();
        setOperation({
          kind: "pan",
          startClientX: event.clientX,
          startClientY: event.clientY,
          baseX: viewport.x,
          baseY: viewport.y,
        });
        return;
      }
      if (event.button !== 0 || mode !== "edit") {
        return;
      }
      const point = viewportToCanvasPoint(event.clientX, event.clientY);
      setSelectedNodeIds([]);
      setOperation({ kind: "select", startPoint: point, currentPoint: point });
    },
    [mode, spacePressed, viewport, viewportToCanvasPoint],
  );

  const onViewportContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (mode !== "edit") {
        return;
      }
      event.preventDefault();
      const target = event.target as HTMLElement | null;
      const nodeElement = target?.closest<HTMLElement>("[data-canvas-node-id]");
      const nodeId = nodeElement?.dataset.canvasNodeId;
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        canvasPoint: viewportToCanvasPoint(event.clientX, event.clientY),
        nodeId,
      });
    },
    [mode, viewportToCanvasPoint],
  );

  const onNodePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, node: CanvasNode) => {
      if (mode !== "edit" || event.button !== 0 || isEditableTarget(event.target)) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-canvas-connection-side]")) {
        return;
      }
      event.stopPropagation();
      setContextMenu(null);
      setEditingEdgeId(null);
      if (
        armedConnectionNodeId &&
        armedConnectionNodeId !== node.id &&
        !isGroupNode(node)
      ) {
        addConnection(armedConnectionNodeId, node.id);
        return;
      }
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        setSelectedEdgeId(null);
        setSelectedNodeIds((current) =>
          current.includes(node.id)
            ? current.filter((id) => id !== node.id)
            : [...current, node.id],
        );
        return;
      }
      const currentSelection = selectedNodeIds.includes(node.id)
        ? selectedNodeIds
        : [node.id];
      setSelectedNodeIds(currentSelection);
      setSelectedEdgeId(null);
      const dragIds = new Set(currentSelection);
      if (isGroupNode(node) && currentSelection.length === 1) {
        draftDocumentRef.current.nodes.forEach((candidate) => {
          if (!isGroupNode(candidate) && nodeIsFullyInside(candidate, node)) {
            dragIds.add(candidate.id);
          }
        });
      }
      const baseNodes: Record<string, CanvasPoint> = {};
      draftDocumentRef.current.nodes.forEach((candidate) => {
        if (dragIds.has(candidate.id)) {
          baseNodes[candidate.id] = { x: candidate.x, y: candidate.y };
        }
      });
      setOperation({
        kind: "move",
        startClientX: event.clientX,
        startClientY: event.clientY,
        nodeIds: Array.from(dragIds),
        baseNodes,
      });
    },
    [addConnection, armedConnectionNodeId, mode, selectedNodeIds],
  );

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, node: CanvasNode) => {
      if (mode !== "edit") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setSelectedNodeIds([node.id]);
      setSelectedEdgeId(null);
      setOperation({
        kind: "resize",
        startClientX: event.clientX,
        startClientY: event.clientY,
        nodeId: node.id,
        baseWidth: node.width,
        baseHeight: node.height,
      });
    },
    [mode],
  );

  const onViewportWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey) {
        return;
      }
      event.preventDefault();
      const nextZoom = clampZoom(
        Number((viewport.zoom + (event.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP)).toFixed(2)),
      );
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) {
        setViewport((current) => ({ ...current, zoom: nextZoom }));
        return;
      }
      const contentX = (event.clientX - rect.left - viewport.x) / viewport.zoom;
      const contentY = (event.clientY - rect.top - viewport.y) / viewport.zoom;
      setViewport({
        x: event.clientX - rect.left - contentX * nextZoom,
        y: event.clientY - rect.top - contentY * nextZoom,
        zoom: nextZoom,
      });
    },
    [viewport],
  );

  const zoomAtCenter = useCallback((delta: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const nextZoom = clampZoom(Number((viewport.zoom + delta).toFixed(2)));
    if (!rect) {
      setViewport((current) => ({ ...current, zoom: nextZoom }));
      return;
    }
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const contentX = (centerX - viewport.x) / viewport.zoom;
    const contentY = (centerY - viewport.y) / viewport.zoom;
    setViewport({
      x: centerX - contentX * nextZoom,
      y: centerY - contentY * nextZoom,
      zoom: nextZoom,
    });
  }, [viewport]);

  const fitToContent = useCallback(() => {
    if (mode === "code") {
      return;
    }
    const viewportElement = viewportRef.current;
    if (!viewportElement || activeDocument.nodes.length === 0) {
      setViewport(DEFAULT_VIEWPORT);
      return;
    }
    const bounds = resolveNodeBounds(activeDocument.nodes);
    const contentLeft = INTERNAL_ORIGIN + bounds.minX;
    const contentTop = INTERNAL_ORIGIN + bounds.minY;
    const padding = 64;
    const availableWidth = Math.max(1, viewportElement.clientWidth - padding * 2);
    const availableHeight = Math.max(1, viewportElement.clientHeight - padding * 2);
    const nextZoom = clampZoom(
      Number(
        Math.min(
          availableWidth / Math.max(bounds.width, 1),
          availableHeight / Math.max(bounds.height, 1),
          1,
        ).toFixed(2),
      ),
    );
    const nextViewport = {
      x: (viewportElement.clientWidth - bounds.width * nextZoom) / 2 - contentLeft * nextZoom,
      y: (viewportElement.clientHeight - bounds.height * nextZoom) / 2 - contentTop * nextZoom,
      zoom: nextZoom,
    };
    setViewport(nextViewport);
  }, [activeDocument.nodes, mode]);

  useImperativeHandle(ref, () => ({ fitToContent }), [fitToContent]);

  const edgeRows = useMemo(
    () =>
      activeDocument.edges
        .map((edge) => {
          const fromNode = nodesById.get(edge.fromNode);
          const toNode = nodesById.get(edge.toNode);
          if (!fromNode || !toNode) {
            return null;
          }
          return buildEdgeRenderRow(edge, fromNode, toNode);
        })
        .filter((row): row is EdgeRenderRow => row !== null),
    [activeDocument.edges, nodesById],
  );

  const connectionPreviewPath = useMemo(() => {
    if (!connectionDrag) {
      return null;
    }
    const fromNode = nodesById.get(connectionDrag.fromNodeId);
    if (!fromNode) {
      return null;
    }
    const fromPoint = resolveAnchorPoint(fromNode, connectionDrag.fromSide);
    const toPoint = {
      x: INTERNAL_ORIGIN + connectionDrag.currentPoint.x,
      y: INTERNAL_ORIGIN + connectionDrag.currentPoint.y,
    };
    const distance = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y);
    const controlDistance = clamp(distance * 0.45, 80, 220);
    const fromVector = sideVector(connectionDrag.fromSide);
    const controlOne = {
      x: fromPoint.x + fromVector.x * controlDistance,
      y: fromPoint.y + fromVector.y * controlDistance,
    };
    const controlTwo = {
      x: toPoint.x,
      y: toPoint.y,
    };
    return [
      `M ${fromPoint.x} ${fromPoint.y}`,
      `C ${controlOne.x} ${controlOne.y}`,
      `${controlTwo.x} ${controlTwo.y}`,
      `${toPoint.x} ${toPoint.y}`,
    ].join(" ");
  }, [connectionDrag, nodesById]);

  const selectedBounds = useMemo(() => {
    if (selectedNodes.length === 0) {
      return null;
    }
    const bounds = resolveNodeBounds(selectedNodes);
    return {
      x: INTERNAL_ORIGIN + bounds.minX,
      y: INTERNAL_ORIGIN + bounds.minY,
      width: bounds.width,
      height: bounds.height,
    };
  }, [selectedNodes]);

  const selectedSingleNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const selectedColorValue =
    selectedNodes.length > 0 &&
    selectedNodes.every((node) => (node.color ?? null) === (selectedNodes[0].color ?? null))
      ? selectedNodes[0].color ?? null
      : null;
  const selectedToolbarIsGroup = selectedSingleNode ? isGroupNode(selectedSingleNode) : false;
  const selectedToolbarStyle = selectedBounds
    ? ({
        transform: selectedToolbarIsGroup
          ? `translate(calc(${
              viewport.x + (selectedBounds.x + selectedBounds.width) * viewport.zoom
            }px - 100%), ${
              viewport.y + Math.max(0, selectedBounds.y - 46) * viewport.zoom
            }px)`
          : `translate(${viewport.x + selectedBounds.x * viewport.zoom}px, ${
              viewport.y + Math.max(0, selectedBounds.y - 46) * viewport.zoom
            }px)`,
      } as CSSProperties)
    : undefined;

  const selectedEdgeRow = selectedEdge
    ? edgeRows.find((row) => row.edge.id === selectedEdge.id) ?? null
    : null;
  const edgeToolbarStyle = selectedEdgeRow
    ? ({
        transform: `translate(${
          viewport.x + selectedEdgeRow.labelPoint.x * viewport.zoom
        }px, ${viewport.y + (selectedEdgeRow.labelPoint.y - 44) * viewport.zoom}px)`,
      } as CSSProperties)
    : undefined;

  const connectionDropPromptStyle = connectionDropPrompt
    ? ({
        transform: `translate(${
          viewport.x + (INTERNAL_ORIGIN + connectionDropPrompt.point.x) * viewport.zoom
        }px, ${
          viewport.y + (INTERNAL_ORIGIN + connectionDropPrompt.point.y) * viewport.zoom
        }px)`,
      } as CSSProperties)
    : undefined;

  const selectionRectStyle = (() => {
    if (operation?.kind !== "select") {
      return undefined;
    }
    const minX = Math.min(operation.startPoint.x, operation.currentPoint.x);
    const minY = Math.min(operation.startPoint.y, operation.currentPoint.y);
    const maxX = Math.max(operation.startPoint.x, operation.currentPoint.x);
    const maxY = Math.max(operation.startPoint.y, operation.currentPoint.y);
    return {
      left: `${INTERNAL_ORIGIN + minX}px`,
      top: `${INTERNAL_ORIGIN + minY}px`,
      width: `${Math.max(1, maxX - minX)}px`,
      height: `${Math.max(1, maxY - minY)}px`,
    } as CSSProperties;
  })();

  const handleCodeDraftChange = useCallback(
    (value: string) => {
      setCodeDraft(value);
      if (modeError) {
        setModeError("");
      }
    },
    [modeError],
  );

  const updateNodeText = useCallback(
    (nodeId: string, value: string) => {
      applyDraftChange(
        (current) => ({
          ...current,
          nodes: current.nodes.map((node) =>
            node.id === nodeId
              ? isGroupNode(node)
                ? { ...node, label: value }
                : { ...node, text: value }
              : node,
          ),
        }),
        false,
      );
    },
    [applyDraftChange],
  );

  const commitNodeEditing = useCallback(() => {
    setEditingNodeId(null);
    void persistDocument(draftDocumentRef.current);
  }, [persistDocument]);

  const hasFatalLoadError = sourceState === "error" || Boolean(sourceError);
  const contextMenuNode = contextMenu?.nodeId
    ? nodesById.get(contextMenu.nodeId) ?? null
    : null;
  const hasSource = Boolean(sourceKey);
  const canEdit = mode === "edit" && canEditSource && hasSource && !isSaving && !loadValidationError;
  const rootClassName = [
    "panel preview-panel canvas-panel business-canvas-editor",
    className,
  ].filter(Boolean).join(" ");
  const bodyClassNames = ["panel-body preview-body", bodyClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className={rootClassName}
      data-canvas-mode={mode}
    >
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        <div className="preview-actions">
          {showModeToggle ? (
            <div className="preview-mode-toggle" role="group" aria-label="Canvas mode">
              <CanvasIconButton
                label="Canvas view mode"
                className="preview-mode-button"
                active={mode === "view"}
                onClick={() => {
                  void switchMode("view");
                }}
                disabled={!hasSource || isSaving}
              >
                <CanvasViewIcon />
              </CanvasIconButton>
              <CanvasIconButton
                label="Canvas edit mode"
                className="preview-mode-button"
                active={mode === "edit"}
                onClick={() => {
                  void switchMode("edit");
                }}
                disabled={!hasSource || isSaving || Boolean(loadValidationError) || !canEditSource}
              >
                <CanvasEditIcon />
              </CanvasIconButton>
              <CanvasIconButton
                label="Canvas JSON mode"
                className="preview-mode-button"
                active={mode === "code"}
                onClick={() => {
                  void switchMode("code");
                }}
                disabled={!hasSource || isSaving || !canEditSource}
              >
                <CanvasCodeIcon />
              </CanvasIconButton>
            </div>
          ) : null}
          {toolbarActions ? (
            <div className="canvas-toolbar-row canvas-embedded-actions">
              {toolbarActions}
            </div>
          ) : null}
          <div className="canvas-toolbar-row business-canvas-top-toolbar">
            <CanvasIconButton
              label="Add card"
              onClick={() => createNodeAtVisibleTopLeft("text")}
              disabled={!canEdit}
            >
              <CanvasPlusIcon />
            </CanvasIconButton>
            <CanvasIconButton
              label="Paste"
              onClick={() => pasteNodes()}
              disabled={!canEdit || clipboardNodes.length === 0}
            >
              <CanvasPasteIcon />
            </CanvasIconButton>
            <CanvasIconButton
              label="Zoom out"
              onClick={() => zoomAtCenter(-ZOOM_STEP)}
              disabled={mode === "code"}
            >
              <CanvasZoomOutIcon />
            </CanvasIconButton>
            <CanvasIconButton
              label={`Reset view (${Math.round(viewport.zoom * 100)}%)`}
              onClick={() => setViewport(DEFAULT_VIEWPORT)}
              disabled={mode === "code"}
            >
              <CanvasFitIcon />
            </CanvasIconButton>
            <CanvasIconButton
              label="Zoom in"
              onClick={() => zoomAtCenter(ZOOM_STEP)}
              disabled={mode === "code"}
            >
              <CanvasZoomInIcon />
            </CanvasIconButton>
            <CanvasIconButton
              label="Snap to grid"
              active={snapEnabled}
              onClick={() => setSnapEnabled((current) => !current)}
              disabled={mode === "code"}
            >
              <CanvasSnapIcon />
            </CanvasIconButton>
          </div>
          {isSaving ? <span className="chip">Saving...</span> : null}
        </div>
      </div>

      <div className={bodyClassNames}>
        {hasFatalLoadError ? <div className="error">{sourceError}</div> : null}
        {loadValidationError ? <div className="error">{loadValidationError}</div> : null}
        {modeError ? <div className="error">{modeError}</div> : null}
        {saveError ? <div className="error">{saveError}</div> : null}

        <div className="preview-content business-canvas-workbench">
          {mode === "code" ? (
            <textarea
              className="preview-editor canvas-code-editor"
              value={codeDraft}
              onChange={(event) => handleCodeDraftChange(event.target.value)}
              aria-label="Canvas JSON code editor"
            />
          ) : (
            <>
              <div
                ref={viewportRef}
                className={`canvas-board-viewport business-canvas-viewport${
                  operation?.kind === "pan" ? " is-panning" : ""
                }`}
                style={
                  {
                    "--business-canvas-grid-size": `${gridSize * viewport.zoom}px`,
                    "--business-canvas-grid-x": `${viewport.x}px`,
                    "--business-canvas-grid-y": `${viewport.y}px`,
                  } as CSSProperties
                }
                onPointerDown={onViewportPointerDown}
                onContextMenu={onViewportContextMenu}
                onWheel={onViewportWheel}
                role="region"
                aria-label="Canvas editor viewport"
                tabIndex={0}
              >
                <div
                  className="canvas-board-stage business-canvas-content"
                  style={{
                    width: `${INTERNAL_WIDTH}px`,
                    height: `${INTERNAL_HEIGHT}px`,
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                  }}
                >
                  {groupNodes.map((node) => {
                    const isSelected = selectedNodeIds.includes(node.id);
                    const isEditing = editingNodeId === node.id;
                    const style: CSSProperties = {
                      left: `${getNodeContentX(node)}px`,
                      top: `${getNodeContentY(node)}px`,
                      width: `${node.width}px`,
                      height: `${node.height}px`,
                      ...resolveNodeColorStyle(node),
                    };
                    return (
                      <article
                        key={node.id}
                        className={`canvas-node canvas-node-group business-canvas-node business-canvas-group-node ${resolveColorClassName(node)}${
                          isSelected ? " is-selected" : ""
                        }${operation?.kind === "move" && operation.nodeIds.includes(node.id) ? " is-dragging" : ""}${
                          isEditing ? " is-editing" : ""
                        }`}
                        style={style}
                        data-canvas-node-id={node.id}
                        onPointerDown={(event) => onNodePointerDown(event, node)}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          startNodeEditing(node);
                        }}
                        title={resolveNodeTitle(node)}
                        tabIndex={0}
                        role="option"
                        aria-selected={isSelected}
                      >
                        {isEditing ? (
                          <input
                            className="text-input canvas-group-name-input"
                            value={node.label ?? ""}
                            onChange={(event) => updateNodeText(node.id, event.target.value)}
                            onBlur={commitNodeEditing}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitNodeEditing();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                setEditingNodeId(null);
                              }
                            }}
                            aria-label="Group name"
                          />
                        ) : (
                          <div className="canvas-node-title">{resolveNodeTitle(node)}</div>
                        )}
                        {isSelected ? (
                          <button
                            type="button"
                            className="canvas-node-resize-handle"
                            aria-label="Resize group"
                            onPointerDown={(event) => onResizePointerDown(event, node)}
                          />
                        ) : null}
                      </article>
                    );
                  })}

                  <svg
                    className="canvas-board-edges business-canvas-edges"
                    viewBox={`0 0 ${INTERNAL_WIDTH} ${INTERNAL_HEIGHT}`}
                    role="img"
                    aria-label="Canvas connections"
                  >
                    <defs>
                      <marker
                        id="canvas-arrow-end"
                        markerWidth="10"
                        markerHeight="10"
                        refX="8"
                        refY="5"
                        orient="auto"
                      >
                        <path d="M0,0 L10,5 L0,10 Z" fill="currentColor" />
                      </marker>
                      <marker
                        id="canvas-arrow-start"
                        markerWidth="10"
                        markerHeight="10"
                        refX="2"
                        refY="5"
                        orient="auto-start-reverse"
                      >
                        <path d="M10,0 L0,5 L10,10 Z" fill="currentColor" />
                      </marker>
                    </defs>
                    {edgeRows.map((row) => {
                      const { edge } = row;
                      const isSelected = edge.id === selectedEdgeId;
                      return (
                        <g
                          key={edge.id}
                          className={`canvas-edge-row${isSelected ? " is-selected" : ""}`}
                        >
                          <path
                            d={row.path}
                            className="canvas-edge-hit"
                            onPointerDown={(event) => {
                              if (mode !== "edit") {
                                return;
                              }
                              event.stopPropagation();
                              setSelectedEdgeId(edge.id);
                              setSelectedNodeIds([]);
                              setEditingNodeId(null);
                            }}
                          />
                          <path
                            d={row.path}
                            className={`canvas-edge-line${
                              directionFromEdge(edge) === "none" ? " is-undirected" : ""
                            }`}
                            markerStart={
                              edge.fromEnd === "arrow"
                                ? "url(#canvas-arrow-start)"
                                : undefined
                            }
                            markerEnd={
                              edge.toEnd === "arrow" ? "url(#canvas-arrow-end)" : undefined
                            }
                            style={
                              edge.color
                                ? ({ color: edge.color, stroke: edge.color } as CSSProperties)
                                : undefined
                            }
                          />
                          {edge.label || isSelected ? (
                            <text
                              x={row.labelPoint.x}
                              y={row.labelPoint.y}
                              className="canvas-edge-label"
                              textAnchor="middle"
                              onPointerDown={(event) => {
                                if (mode !== "edit") {
                                  return;
                                }
                                event.stopPropagation();
                                setSelectedEdgeId(edge.id);
                                setSelectedNodeIds([]);
                                setEditingEdgeId(edge.id);
                                setEdgeLabelDraft(edge.label ?? "");
                              }}
                            >
                              {edge.label || "Label"}
                            </text>
                          ) : null}
                        </g>
                      );
                    })}
                    {connectionPreviewPath ? (
                      <path
                        d={connectionPreviewPath}
                        className="canvas-edge-line canvas-edge-preview"
                      />
                    ) : null}
                  </svg>

                  {selectionRectStyle ? (
                    <div
                      className="business-canvas-selection-rect"
                      style={selectionRectStyle}
                    />
                  ) : null}

                  {regularNodes.map((node) => {
                    const isSelected = selectedNodeIds.includes(node.id);
                    const isEditing = editingNodeId === node.id;
                    const isDragging =
                      operation?.kind === "move" && operation.nodeIds.includes(node.id);
                    const isConnectionTarget =
                      Boolean(armedConnectionNodeId) &&
                      armedConnectionNodeId !== node.id &&
                      !isGroupNode(node);
                    const style: CSSProperties = {
                      left: `${getNodeContentX(node)}px`,
                      top: `${getNodeContentY(node)}px`,
                      width: `${node.width}px`,
                      height: `${node.height}px`,
                      ...resolveNodeColorStyle(node),
                    };
                    return (
                      <article
                        key={node.id}
                        className={`canvas-node canvas-content-node canvas-node-${node.type} business-canvas-node business-canvas-card-node ${resolveColorClassName(node)} business-canvas-shape-${resolveNodeShape(node)}${
                          isSelected ? " is-selected" : ""
                        }${isDragging ? " is-dragging" : ""}${isEditing ? " is-editing" : ""}${
                          armedConnectionNodeId === node.id ? " is-connection-source" : ""
                        }${isConnectionTarget ? " is-connection-target" : ""}`}
                        style={style}
                        data-canvas-node-id={node.id}
                        onPointerDown={(event) => onNodePointerDown(event, node)}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          startNodeEditing(node);
                        }}
                        title={resolveNodeTitle(node)}
                        tabIndex={0}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="canvas-node-body">
                          {isEditing ? (
                            <div
                              className="canvas-node-editable"
                              contentEditable
                              suppressContentEditableWarning
                              data-canvas-editing-node-id={node.id}
                              onInput={(event) =>
                                updateNodeText(
                                  node.id,
                                  event.currentTarget.textContent ?? "",
                                )
                              }
                              onBlur={commitNodeEditing}
                              onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  setEditingNodeId(null);
                                }
                              }}
                            >
                              {resolveNodeText(node)}
                            </div>
                          ) : (
                            <div className="canvas-node-text-content">
                              {resolveNodeText(node)}
                            </div>
                          )}
                        </div>
                        {CANVAS_SIDES.map((side) => (
                          <button
                            key={side}
                            type="button"
                            className={`business-canvas-anchor business-canvas-anchor-${side}`}
                            data-canvas-node-id={node.id}
                            data-canvas-connection-side={side}
                            aria-label={`Connect ${side}`}
                            title={`Connect ${side}`}
                            onPointerDown={(event) =>
                              startConnectionDrag(event, node, side)
                            }
                          />
                        ))}
                        {isSelected ? (
                          <button
                            type="button"
                            className="canvas-node-resize-handle"
                            aria-label="Resize card"
                            onPointerDown={(event) => onResizePointerDown(event, node)}
                          />
                        ) : null}
                      </article>
                    );
                  })}
                </div>
                {activeDocument.nodes.length === 0 ? (
                  <div className="canvas-empty-state">Canvas is empty.</div>
                ) : null}
              </div>

              <div className="business-canvas-toolbar-layer">
                {mode === "edit" && selectedNodes.length > 0 && selectedToolbarStyle ? (
                  <CanvasFloatingToolbar style={selectedToolbarStyle}>
                    {selectedNodes.length > 1 ? (
                      <>
                        <CanvasIconButton label="Copy selected cards" onClick={copySelectedNodes}>
                          <CanvasCopyIcon />
                        </CanvasIconButton>
                        <CanvasIconButton
                          label="Paste"
                          onClick={() => pasteNodes()}
                          disabled={clipboardNodes.length === 0}
                        >
                          <CanvasPasteIcon />
                        </CanvasIconButton>
                        <CanvasIconButton
                          label="Create group"
                          onClick={createGroupFromSelection}
                          disabled={selectedRegularNodes.length < 2}
                        >
                          <CanvasGroupIcon />
                        </CanvasIconButton>
                        <CanvasIconButton label="Align left" onClick={() => alignSelection("x")}>
                          <CanvasAlignLeftIcon />
                        </CanvasIconButton>
                        <CanvasIconButton label="Align top" onClick={() => alignSelection("y")}>
                          <CanvasAlignTopIcon />
                        </CanvasIconButton>
                      </>
                    ) : selectedSingleNode && isGroupNode(selectedSingleNode) ? (
                      <>
                        <CanvasIconButton
                          label="Edit group"
                          onClick={() => startNodeEditing(selectedSingleNode)}
                        >
                          <CanvasEditIcon />
                        </CanvasIconButton>
                      </>
                    ) : selectedSingleNode ? (
                      <>
                        <CanvasIconButton
                          label="Edit card"
                          onClick={() => startNodeEditing(selectedSingleNode)}
                        >
                          <CanvasEditIcon />
                        </CanvasIconButton>
                        <CanvasShapePicker
                          value={resolveNodeShape(selectedSingleNode)}
                          shapes={SHAPES}
                          onChange={applyShape}
                        />
                        <CanvasIconButton
                          label="Connect card"
                          active={armedConnectionNodeId === selectedSingleNode.id}
                          onClick={() =>
                            setArmedConnectionNodeId((current) =>
                              current === selectedSingleNode.id
                                ? null
                                : selectedSingleNode.id,
                            )
                          }
                        >
                          <CanvasConnectIcon />
                        </CanvasIconButton>
                        <CanvasIconButton label="Copy card" onClick={copySelectedNodes}>
                          <CanvasCopyIcon />
                        </CanvasIconButton>
                        <CanvasIconButton label="Duplicate card" onClick={duplicateSelectedNodes}>
                          <CanvasDuplicateIcon />
                        </CanvasIconButton>
                      </>
                    ) : null}
                    <CanvasColorPalette
                      label="Canvas color"
                      standardColors={STANDARD_COLORS}
                      customColors={normalizedCustomColors}
                      selectedColor={selectedColorValue}
                      onSelectColor={applyColor}
                      onSaveCustomColor={saveCustomColorSlot}
                    />
                    <CanvasIconButton label="Delete selection" onClick={deleteSelection}>
                      <CanvasTrashIcon />
                    </CanvasIconButton>
                  </CanvasFloatingToolbar>
                ) : null}

                {mode === "edit" && selectedEdge && edgeToolbarStyle ? (
                  <CanvasFloatingToolbar style={edgeToolbarStyle}>
                    <CanvasEdgeDirectionPicker
                      value={directionFromEdge(selectedEdge)}
                      onChange={(direction) =>
                        updateEdgeDirection(
                          selectedEdge.id,
                          direction,
                        )
                      }
                    />
                    {editingEdgeId === selectedEdge.id ? (
                      <input
                        className="text-input canvas-edge-label-input"
                        value={edgeLabelDraft}
                        onChange={(event) => setEdgeLabelDraft(event.target.value)}
                        onBlur={commitEdgeLabel}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitEdgeLabel();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setEditingEdgeId(null);
                          }
                        }}
                        aria-label="Edge label"
                        autoFocus
                      />
                    ) : (
                      <CanvasIconButton
                        label="Edit edge label"
                        onClick={() => {
                          setEditingEdgeId(selectedEdge.id);
                          setEdgeLabelDraft(selectedEdge.label ?? "");
                        }}
                      >
                        <CanvasEditIcon />
                      </CanvasIconButton>
                    )}
                    <CanvasIconButton label="Delete edge" onClick={deleteSelection}>
                      <CanvasTrashIcon />
                    </CanvasIconButton>
                  </CanvasFloatingToolbar>
                ) : null}

                {mode === "edit" && connectionDropPrompt && connectionDropPromptStyle ? (
                  <div
                    className="canvas-connection-drop-popup"
                    style={connectionDropPromptStyle}
                  >
                    <CanvasIconButton
                      label="Neue Karte"
                      onClick={() => createConnectedNodeAtPoint(connectionDropPrompt)}
                    >
                      <CanvasPlusIcon />
                    </CanvasIconButton>
                  </div>
                ) : null}
              </div>

              {contextMenu ? (
                <div
                  className="business-canvas-context-menu"
                  style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
                  role="menu"
                >
                  {contextMenuNode ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          startNodeEditing(contextMenuNode);
                        }}
                      >
                        Edit
                      </button>
                      {!isGroupNode(contextMenuNode) ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            copyNodesToClipboard([contextMenuNode]);
                            setSelectedNodeIds([contextMenuNode.id]);
                            setContextMenu(null);
                          }}
                        >
                          Copy
                        </button>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          requestDeleteNodeIds([contextMenuNode.id]);
                          setContextMenu(null);
                        }}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          createNodeAtPoint("text", contextMenu.canvasPoint);
                          setContextMenu(null);
                        }}
                      >
                        New card
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          createNodeAtPoint("group", contextMenu.canvasPoint);
                          setContextMenu(null);
                        }}
                      >
                        New group
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={clipboardNodes.length === 0}
                        onClick={() => {
                          pasteNodes(contextMenu.canvasPoint);
                          setContextMenu(null);
                        }}
                      >
                        Paste here
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
      <CanvasDeleteConfirmDialog
        isOpen={Boolean(deleteConfirm)}
        title="Auswahl loeschen?"
        description="Die ausgewaehlten Canvas-Elemente und verbundene Kanten werden geloescht."
        confirmLabel="Loeschen"
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={confirmNodeDelete}
      />
    </section>
  );
});

CanvasEditor.displayName = "CanvasEditor";
