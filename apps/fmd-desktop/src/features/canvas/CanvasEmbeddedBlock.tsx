import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  parseCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocument,
  type CanvasNode,
  type CanvasSide,
} from "./document";
import {
  parseMarkdownCanvasBlock,
  replaceMarkdownCanvasBlockSource,
} from "./markdownBlockSyntax";

type CanvasEmbeddedMode = "view" | "edit" | "code";

type CanvasEmbeddedBlockProps = {
  raw: string;
  blockIndex?: number;
  allowEditing?: boolean;
  onCommitRaw?: (nextRaw: string) => void;
};

type CanvasBounds = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

type CanvasPoint = {
  x: number;
  y: number;
};

const CANVAS_PADDING = 80;
const DEFAULT_EMBEDDED_HEIGHT = 480;
const MIN_CANVAS_SIZE = 420;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

const clampZoom = (value: number) =>
  Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

const createEmptyCanvasDocument = (): CanvasDocument => ({
  nodes: [],
  edges: [],
});

const resolveAnchorPoint = (
  node: CanvasNode,
  side: CanvasSide | undefined,
): CanvasPoint => {
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  switch (side) {
    case "top":
      return { x: centerX, y: node.y };
    case "right":
      return { x: node.x + node.width, y: centerY };
    case "bottom":
      return { x: centerX, y: node.y + node.height };
    case "left":
      return { x: node.x, y: centerY };
    default:
      return { x: centerX, y: centerY };
  }
};

const buildCanvasBounds = (nodes: CanvasNode[]): CanvasBounds => {
  if (nodes.length === 0) {
    return {
      originX: -CANVAS_PADDING,
      originY: -CANVAS_PADDING,
      width: MIN_CANVAS_SIZE,
      height: MIN_CANVAS_SIZE,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  nodes.forEach((node) => {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  });

  return {
    originX: minX - CANVAS_PADDING,
    originY: minY - CANVAS_PADDING,
    width: Math.max(MIN_CANVAS_SIZE, maxX - minX + CANVAS_PADDING * 2),
    height: Math.max(MIN_CANVAS_SIZE, maxY - minY + CANVAS_PADDING * 2),
  };
};

const toDisplayPoint = (point: CanvasPoint, bounds: CanvasBounds): CanvasPoint => ({
  x: point.x - bounds.originX,
  y: point.y - bounds.originY,
});

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
  return node.id;
};

const resolveNodeColorStyle = (
  node: CanvasNode,
  mode: "group" | "node",
): CSSProperties | undefined => {
  if (typeof node.color !== "string" || !node.color.trim()) {
    return undefined;
  }
  const color = node.color.trim();
  if (mode === "group") {
    return {
      borderColor: color,
      boxShadow: `inset 0 0 0 1px ${color}`,
    };
  }
  return { borderColor: color };
};

export const CanvasEmbeddedBlock = ({
  raw,
  blockIndex,
  allowEditing = false,
  onCommitRaw,
}: CanvasEmbeddedBlockProps) => {
  const [mode, setMode] = useState<CanvasEmbeddedMode>("view");
  const [document, setDocument] = useState<CanvasDocument>(createEmptyCanvasDocument);
  const [draftDocument, setDraftDocument] = useState<CanvasDocument>(createEmptyCanvasDocument);
  const [codeDraft, setCodeDraft] = useState("");
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [panningStart, setPanningStart] = useState<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);
  const [draggingNode, setDraggingNode] = useState<{
    nodeId: string;
    pointerX: number;
    pointerY: number;
    nodeX: number;
    nodeY: number;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const draftDocumentRef = useRef(draftDocument);
  const lastCommittedRawRef = useRef<string | null>(null);

  useEffect(() => {
    draftDocumentRef.current = draftDocument;
  }, [draftDocument]);

  useEffect(() => {
    const parsed = parseMarkdownCanvasBlock(raw);
    if (!parsed.ok) {
      setError(parsed.error);
      setDocument(createEmptyCanvasDocument());
      setDraftDocument(createEmptyCanvasDocument());
      setCodeDraft(parsed.block?.source ?? raw);
      return;
    }
    const serialized = serializeCanvasDocument(parsed.document);
    const isOwnCommit = raw === lastCommittedRawRef.current;
    lastCommittedRawRef.current = null;
    setError("");
    setDocument(parsed.document);
    setDraftDocument(parsed.document);
    setCodeDraft(serialized);
    if (!isOwnCommit) {
      setMode("view");
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [raw]);

  const activeDocument = mode === "edit" ? draftDocument : document;
  const bounds = useMemo(
    () => buildCanvasBounds(activeDocument.nodes),
    [activeDocument.nodes],
  );
  const nodesById = useMemo(
    () => new Map(activeDocument.nodes.map((node) => [node.id, node])),
    [activeDocument.nodes],
  );
  const groupNodes = useMemo(
    () => activeDocument.nodes.filter((node) => node.type.toLowerCase() === "group"),
    [activeDocument.nodes],
  );
  const regularNodes = useMemo(
    () => activeDocument.nodes.filter((node) => node.type.toLowerCase() !== "group"),
    [activeDocument.nodes],
  );

  const commitDocument = useCallback(
    (nextDocument: CanvasDocument) => {
      const nextSource = serializeCanvasDocument(nextDocument);
      const nextRaw = replaceMarkdownCanvasBlockSource(raw, nextSource);
      lastCommittedRawRef.current = nextRaw;
      setDocument(nextDocument);
      setDraftDocument(nextDocument);
      setCodeDraft(nextSource);
      setError("");
      onCommitRaw?.(nextRaw);
    },
    [onCommitRaw, raw],
  );

  const handleModeChange = useCallback(
    (nextMode: CanvasEmbeddedMode) => {
      if (nextMode === mode) {
        return;
      }
      let nextDocumentForMode = document;
      if (mode === "code" && nextMode !== "code") {
        const parsed = parseCanvasDocument(codeDraft);
        if (!parsed.ok) {
          setError(parsed.error);
          return;
        }
        nextDocumentForMode = parsed.document;
        commitDocument(parsed.document);
      }
      if (mode === "edit" && nextMode !== "edit") {
        nextDocumentForMode = draftDocumentRef.current;
        commitDocument(nextDocumentForMode);
      }
      if (nextMode === "edit") {
        setDraftDocument(nextDocumentForMode);
      }
      setMode(nextMode);
    },
    [codeDraft, commitDocument, document, mode],
  );

  const updateDraggedNode = useCallback(
    (nodeId: string, nextX: number, nextY: number) => {
      setDraftDocument((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                x: nextX,
                y: nextY,
              }
            : node
        ),
      }));
    },
    [],
  );

  useEffect(() => {
    if (!panningStart && !draggingNode) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (panningStart) {
        setPan({
          x: panningStart.baseX + (event.clientX - panningStart.startX),
          y: panningStart.baseY + (event.clientY - panningStart.startY),
        });
        return;
      }
      if (!draggingNode || mode !== "edit") {
        return;
      }
      updateDraggedNode(
        draggingNode.nodeId,
        draggingNode.nodeX + (event.clientX - draggingNode.pointerX) / zoom,
        draggingNode.nodeY + (event.clientY - draggingNode.pointerY) / zoom,
      );
    };

    const onPointerUp = () => {
      setPanningStart(null);
      if (!draggingNode) {
        return;
      }
      setDraggingNode(null);
      commitDocument(draftDocumentRef.current);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [commitDocument, draggingNode, mode, panningStart, updateDraggedNode, zoom]);

  const onViewportPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (mode === "code" || event.button !== 0) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-canvas-node-id]")) {
        return;
      }
      setPanningStart({
        startX: event.clientX,
        startY: event.clientY,
        baseX: pan.x,
        baseY: pan.y,
      });
    },
    [mode, pan.x, pan.y],
  );

  const onNodePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, node: CanvasNode) => {
      if (mode !== "edit" || event.button !== 0) {
        return;
      }
      event.stopPropagation();
      setDraggingNode({
        nodeId: node.id,
        pointerX: event.clientX,
        pointerY: event.clientY,
        nodeX: node.x,
        nodeY: node.y,
      });
    },
    [mode],
  );

  const onViewportWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) {
      return;
    }
    event.preventDefault();
    const zoomDelta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom((current) => clampZoom(Number((current + zoomDelta).toFixed(2))));
  }, []);

  const edgeRows = useMemo(
    () =>
      activeDocument.edges.map((edge) => {
        const fromNode = nodesById.get(edge.fromNode);
        const toNode = nodesById.get(edge.toNode);
        if (!fromNode || !toNode) {
          return null;
        }
        const fromPoint = toDisplayPoint(resolveAnchorPoint(fromNode, edge.fromSide), bounds);
        const toPoint = toDisplayPoint(resolveAnchorPoint(toNode, edge.toSide), bounds);
        return {
          edge,
          fromPoint,
          toPoint,
          middle: {
            x: (fromPoint.x + toPoint.x) / 2,
            y: (fromPoint.y + toPoint.y) / 2,
          },
        };
      }),
    [activeDocument.edges, bounds, nodesById],
  );

  const fitToContent = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const availableWidth = Math.max(1, viewport.clientWidth - 32);
    const availableHeight = Math.max(1, viewport.clientHeight - 32);
    const nextZoom = clampZoom(
      Math.min(availableWidth / bounds.width, availableHeight / bounds.height, 1),
    );
    setZoom(Number(nextZoom.toFixed(2)));
    setPan({
      x: Math.max(16, (viewport.clientWidth - bounds.width * nextZoom) / 2),
      y: Math.max(16, (viewport.clientHeight - bounds.height * nextZoom) / 2),
    });
  }, [bounds.height, bounds.width]);

  const applyCodeDraft = useCallback(() => {
    const parsed = parseCanvasDocument(codeDraft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    commitDocument(parsed.document);
    setMode("view");
  }, [codeDraft, commitDocument]);

  const hasRenderableCanvas = activeDocument.nodes.length > 0 || activeDocument.edges.length > 0;
  const rootClassName = `canvas-embedded-block${fullscreen ? " is-fullscreen" : ""}`;

  return (
    <div
      className={rootClassName}
      data-md-block-control="true"
      data-md-canvas-block-index={typeof blockIndex === "number" ? blockIndex : undefined}
      contentEditable={false}
    >
      <div className="canvas-embedded-toolbar">
        <div className="canvas-embedded-title">Canvas</div>
        <div className="canvas-embedded-actions">
          <button
            type="button"
            className={`ghost small ${mode === "view" ? "active" : ""}`}
            onClick={() => handleModeChange("view")}
            aria-pressed={mode === "view"}
          >
            View
          </button>
          <button
            type="button"
            className={`ghost small ${mode === "edit" ? "active" : ""}`}
            onClick={() => handleModeChange("edit")}
            disabled={!allowEditing || Boolean(error)}
            aria-pressed={mode === "edit"}
          >
            Edit
          </button>
          <button
            type="button"
            className={`ghost small ${mode === "code" ? "active" : ""}`}
            onClick={() => handleModeChange("code")}
            disabled={!allowEditing}
            aria-pressed={mode === "code"}
          >
            Code
          </button>
          <button type="button" className="ghost small" onClick={fitToContent} disabled={mode === "code"}>
            Fit
          </button>
          <button
            type="button"
            className="ghost small"
            onClick={() => setFullscreen((current) => !current)}
          >
            {fullscreen ? "Exit" : "Fullscreen"}
          </button>
          <button
            type="button"
            className="ghost small"
            onClick={() => onCommitRaw?.(`${raw.trimEnd()}\n\n${raw.trimEnd()}`)}
            disabled={!allowEditing}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="ghost small"
            onClick={() => onCommitRaw?.("")}
            disabled={!allowEditing}
          >
            Delete
          </button>
        </div>
      </div>

      {error ? <div className="error canvas-embedded-error">{error}</div> : null}

      {mode === "code" ? (
        <div className="canvas-embedded-code-shell">
          <textarea
            className="preview-editor canvas-code-editor canvas-embedded-code-editor"
            value={codeDraft}
            onChange={(event) => {
              setCodeDraft(event.target.value);
              setError("");
            }}
            aria-label="Embedded Canvas JSON"
          />
          <div className="canvas-embedded-code-actions">
            <button type="button" className="primary small" onClick={applyCodeDraft}>
              Apply
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={viewportRef}
          className={`canvas-board-viewport canvas-embedded-viewport${
            panningStart ? " is-panning" : ""
          }`}
          style={{ height: fullscreen ? undefined : DEFAULT_EMBEDDED_HEIGHT }}
          onPointerDown={onViewportPointerDown}
          onWheel={onViewportWheel}
        >
          {hasRenderableCanvas ? (
            <div
              className="canvas-board-stage"
              style={{
                width: `${bounds.width}px`,
                height: `${bounds.height}px`,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <svg
                className="canvas-board-edges"
                viewBox={`0 0 ${bounds.width} ${bounds.height}`}
                role="presentation"
              >
                <defs>
                  <marker
                    id={`canvas-embedded-arrow-end-${blockIndex ?? "x"}`}
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
                  </marker>
                </defs>
                {edgeRows.map((row) => {
                  if (!row) {
                    return null;
                  }
                  const { edge, fromPoint, toPoint, middle } = row;
                  const markerUrl = `url(#canvas-embedded-arrow-end-${blockIndex ?? "x"})`;
                  return (
                    <g key={edge.id} className="canvas-edge-row">
                      <line
                        x1={fromPoint.x}
                        y1={fromPoint.y}
                        x2={toPoint.x}
                        y2={toPoint.y}
                        className="canvas-edge-line"
                        markerStart={edge.fromEnd === "arrow" ? markerUrl : undefined}
                        markerEnd={edge.toEnd === "arrow" ? markerUrl : undefined}
                        style={
                          edge.color
                            ? ({ color: edge.color, stroke: edge.color } as CSSProperties)
                            : undefined
                        }
                      />
                      {edge.label ? (
                        <text
                          x={middle.x}
                          y={middle.y}
                          className="canvas-edge-label"
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {edge.label}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </svg>

              {groupNodes.map((node) => {
                const displayPoint = toDisplayPoint({ x: node.x, y: node.y }, bounds);
                return (
                  <div
                    key={node.id}
                    className={`canvas-node canvas-group-node${
                      mode === "edit" ? " is-editable" : ""
                    }`}
                    data-canvas-node-id={node.id}
                    onPointerDown={(event) => onNodePointerDown(event, node)}
                    style={{
                      left: `${displayPoint.x}px`,
                      top: `${displayPoint.y}px`,
                      width: `${node.width}px`,
                      height: `${node.height}px`,
                      ...resolveNodeColorStyle(node, "group"),
                    }}
                  >
                    <span className="canvas-group-label">{resolveNodeTitle(node)}</span>
                  </div>
                );
              })}

              {regularNodes.map((node) => {
                const displayPoint = toDisplayPoint({ x: node.x, y: node.y }, bounds);
                return (
                  <div
                    key={node.id}
                    className={`canvas-node canvas-content-node${
                      mode === "edit" ? " is-editable" : ""
                    }`}
                    data-canvas-node-id={node.id}
                    style={{
                      left: `${displayPoint.x}px`,
                      top: `${displayPoint.y}px`,
                      width: `${node.width}px`,
                      minHeight: `${node.height}px`,
                      ...resolveNodeColorStyle(node, "node"),
                    }}
                    onPointerDown={(event) => onNodePointerDown(event, node)}
                  >
                    <div className="canvas-node-title">{resolveNodeTitle(node)}</div>
                    {typeof node.text === "string" && node.text.trim() ? (
                      <div className="canvas-node-markdown markdown md-preview">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {node.text}
                        </ReactMarkdown>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="canvas-empty-state">Empty Canvas</div>
          )}
        </div>
      )}
    </div>
  );
};
