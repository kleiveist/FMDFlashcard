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
import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";
import {
  createEmptyCanvasDocument,
  parseCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocument,
  type CanvasNode,
  type CanvasSide,
} from "../features/canvas/document";

type CanvasMode = "view" | "edit" | "code";

type PersistCanvasResult = {
  ok: boolean;
  error?: string;
};

type CanvasPanelProps = {
  selectedFile: VaultFile | null;
  preview: string;
  previewState: LoadState;
  previewError: string;
  onPersistSource: (nextSource: string) => Promise<PersistCanvasResult>;
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

const CANVAS_PADDING = 120;
const MIN_CANVAS_SIZE = 720;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

const clampZoom = (value: number) =>
  Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

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
      backgroundColor: "color-mix(in srgb, var(--panel) 82%, transparent)",
      boxShadow: `inset 0 0 0 1px ${color}`,
    };
  }
  return {
    borderColor: color,
  };
};

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

  const width = Math.max(MIN_CANVAS_SIZE, maxX - minX + CANVAS_PADDING * 2);
  const height = Math.max(MIN_CANVAS_SIZE, maxY - minY + CANVAS_PADDING * 2);
  return {
    originX: minX - CANVAS_PADDING,
    originY: minY - CANVAS_PADDING,
    width,
    height,
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

export const CanvasPanel = ({
  selectedFile,
  preview,
  previewState,
  previewError,
  onPersistSource,
}: CanvasPanelProps) => {
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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
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
  const draftDocumentRef = useRef(draftDocument);
  const selectedFilePathRef = useRef<string | null>(null);

  useEffect(() => {
    draftDocumentRef.current = draftDocument;
  }, [draftDocument]);

  useEffect(() => {
    const selectedPath = selectedFile?.path ?? null;
    const hasPathChanged = selectedPath !== selectedFilePathRef.current;
    if (!hasPathChanged && preview === lastSavedSource) {
      return;
    }

    if (hasPathChanged) {
      selectedFilePathRef.current = selectedPath;
      setMode("view");
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setModeError("");
      setSaveError("");
    }

    if (!selectedFile || previewState !== "idle") {
      return;
    }

    const parsed = parseCanvasDocument(preview);
    if (!parsed.ok) {
      setLoadValidationError(parsed.error);
      setCodeDraft(preview);
      setDraftDocument(createEmptyCanvasDocument());
      setRenderDocument(createEmptyCanvasDocument());
      setLastSavedSource(preview);
      return;
    }

    const serialized = serializeCanvasDocument(parsed.document);
    setLoadValidationError("");
    setDraftDocument(parsed.document);
    setRenderDocument(parsed.document);
    setCodeDraft(serialized);
    setLastSavedSource(serialized);
  }, [lastSavedSource, preview, previewState, selectedFile]);

  const persistDocument = useCallback(
    async (document: CanvasDocument) => {
      const serialized = serializeCanvasDocument(document);
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
      return true;
    },
    [lastSavedSource, onPersistSource],
  );

  const switchMode = useCallback(
    async (nextMode: CanvasMode) => {
      if (nextMode === mode) {
        return;
      }

      setModeError("");

      if (mode === "code" && nextMode !== "code") {
        const parsed = parseCanvasDocument(codeDraft);
        if (!parsed.ok) {
          setModeError(parsed.error);
          return;
        }
        setDraftDocument(parsed.document);
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
      }

      if (mode === "edit" && nextMode === "code") {
        setCodeDraft(serializeCanvasDocument(draftDocumentRef.current));
      }

      if (mode === "view" && nextMode === "edit") {
        if (loadValidationError) {
          return;
        }
        setDraftDocument(renderDocument);
      }

      setMode(nextMode);
    },
    [codeDraft, loadValidationError, mode, persistDocument, renderDocument],
  );

  const activeDocument = mode === "edit" ? draftDocument : renderDocument;
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
            : node),
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
      const nextX = draggingNode.nodeX + (event.clientX - draggingNode.pointerX) / zoom;
      const nextY = draggingNode.nodeY + (event.clientY - draggingNode.pointerY) / zoom;
      updateDraggedNode(draggingNode.nodeId, nextX, nextY);
    };

    const onPointerUp = () => {
      setPanningStart(null);
      if (!draggingNode) {
        return;
      }
      setDraggingNode(null);
      void persistDocument(draftDocumentRef.current);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggingNode, mode, persistDocument, panningStart, updateDraggedNode, zoom]);

  const onViewportPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (mode === "code") {
        return;
      }
      if (event.button !== 0) {
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
      if (mode !== "edit") {
        return;
      }
      if (event.button !== 0) {
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

  const onViewportWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey) {
        return;
      }
      event.preventDefault();
      const zoomDelta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setZoom((current) => clampZoom(Number((current + zoomDelta).toFixed(2))));
    },
    [],
  );

  const edgeRows = useMemo(
    () =>
      activeDocument.edges.map((edge) => {
        const fromNode = nodesById.get(edge.fromNode);
        const toNode = nodesById.get(edge.toNode);
        if (!fromNode || !toNode) {
          return null;
        }
        const fromPoint = toDisplayPoint(
          resolveAnchorPoint(fromNode, edge.fromSide),
          bounds,
        );
        const toPoint = toDisplayPoint(
          resolveAnchorPoint(toNode, edge.toSide),
          bounds,
        );
        const middle = {
          x: (fromPoint.x + toPoint.x) / 2,
          y: (fromPoint.y + toPoint.y) / 2,
        };
        return {
          edge,
          fromPoint,
          toPoint,
          middle,
        };
      }),
    [activeDocument.edges, bounds, nodesById],
  );

  const handleCodeDraftChange = useCallback(
    (value: string) => {
      setCodeDraft(value);
      if (modeError) {
        setModeError("");
      }
    },
    [modeError],
  );

  const hasRenderableCanvas = activeDocument.nodes.length > 0 || activeDocument.edges.length > 0;
  const hasFatalLoadError = previewState === "error" || Boolean(previewError);

  return (
    <section className="panel preview-panel canvas-panel" data-canvas-mode={mode}>
      <div className="panel-header">
        <div>
          <h2>Canvas</h2>
          <p className="muted">{selectedFile?.relative_path ?? "No file selected"}</p>
        </div>
        <div className="preview-actions">
          <div className="preview-mode-toggle" role="group" aria-label="Canvas mode">
            <button
              type="button"
              className={`ghost small preview-mode-button ${mode === "view" ? "active" : ""}`}
              onClick={() => {
                void switchMode("view");
              }}
              disabled={!selectedFile || isSaving}
              aria-pressed={mode === "view"}
              title="Canvas view mode"
            >
              View
            </button>
            <button
              type="button"
              className={`ghost small preview-mode-button ${mode === "edit" ? "active" : ""}`}
              onClick={() => {
                void switchMode("edit");
              }}
              disabled={!selectedFile || isSaving || Boolean(loadValidationError)}
              aria-pressed={mode === "edit"}
              title="Canvas edit mode"
            >
              Edit
            </button>
            <button
              type="button"
              className={`ghost small preview-mode-button ${mode === "code" ? "active" : ""}`}
              onClick={() => {
                void switchMode("code");
              }}
              disabled={!selectedFile || isSaving}
              aria-pressed={mode === "code"}
              title="Canvas JSON mode"
            >
              Code
            </button>
          </div>
          <div className="canvas-toolbar-row">
            <button
              type="button"
              className="ghost small"
              onClick={() => setZoom((current) => clampZoom(Number((current - ZOOM_STEP).toFixed(2))))}
              disabled={mode === "code"}
              aria-label="Zoom out"
            >
              -
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={() => setZoom(1)}
              disabled={mode === "code"}
              aria-label="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={() => setZoom((current) => clampZoom(Number((current + ZOOM_STEP).toFixed(2))))}
              disabled={mode === "code"}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
          {isSaving ? <span className="chip">Saving...</span> : null}
        </div>
      </div>

      <div className="panel-body preview-body">
        {hasFatalLoadError ? <div className="error">{previewError}</div> : null}
        {loadValidationError ? <div className="error">{loadValidationError}</div> : null}
        {modeError ? <div className="error">{modeError}</div> : null}
        {saveError ? <div className="error">{saveError}</div> : null}

        <div className="preview-content">
          {mode === "code" ? (
            <textarea
              className="preview-editor canvas-code-editor"
              value={codeDraft}
              onChange={(event) => handleCodeDraftChange(event.target.value)}
              aria-label="Canvas JSON code editor"
            />
          ) : (
            <div
              className={`canvas-board-viewport${panningStart ? " is-panning" : ""}`}
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
                        id="canvas-arrow-end"
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
                      return (
                        <g key={edge.id} className="canvas-edge-row">
                          <line
                            x1={fromPoint.x}
                            y1={fromPoint.y}
                            x2={toPoint.x}
                            y2={toPoint.y}
                            className="canvas-edge-line"
                            markerStart={edge.fromEnd === "arrow" ? "url(#canvas-arrow-end)" : undefined}
                            markerEnd={edge.toEnd === "arrow" ? "url(#canvas-arrow-end)" : undefined}
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
                            >
                              {edge.label}
                            </text>
                          ) : null}
                        </g>
                      );
                    })}
                  </svg>

                  {groupNodes.map((node) => {
                    const style: CSSProperties = {
                      left: `${node.x - bounds.originX}px`,
                      top: `${node.y - bounds.originY}px`,
                      width: `${node.width}px`,
                      height: `${node.height}px`,
                      ...resolveNodeColorStyle(node, "group"),
                    };
                    return (
                      <div
                        key={node.id}
                        className="canvas-node canvas-node-group"
                        style={style}
                        data-canvas-node-id={node.id}
                        onPointerDown={(event) => onNodePointerDown(event, node)}
                        title={resolveNodeTitle(node)}
                      >
                        <div className="canvas-node-title">
                          {node.label || node.text || node.id}
                        </div>
                      </div>
                    );
                  })}

                  {regularNodes.map((node) => {
                    const style: CSSProperties = {
                      left: `${node.x - bounds.originX}px`,
                      top: `${node.y - bounds.originY}px`,
                      width: `${node.width}px`,
                      height: `${node.height}px`,
                      ...resolveNodeColorStyle(node, "node"),
                    };
                    const nodeType = node.type.toLowerCase();
                    return (
                      <div
                        key={node.id}
                        className={`canvas-node canvas-node-${nodeType}`}
                        style={style}
                        data-canvas-node-id={node.id}
                        onPointerDown={(event) => onNodePointerDown(event, node)}
                        title={resolveNodeTitle(node)}
                      >
                        <div className="canvas-node-body">
                          {nodeType === "text" ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {node.text || node.label || ""}
                            </ReactMarkdown>
                          ) : (
                            <>
                              <div className="canvas-node-title">{node.label || node.id}</div>
                              {typeof node.file === "string" && node.file ? (
                                <div className="canvas-node-subtle">{node.file}</div>
                              ) : null}
                              {typeof node.text === "string" && node.text ? (
                                <div className="canvas-node-subtle">{node.text}</div>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="preview placeholder">Canvas is empty.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
