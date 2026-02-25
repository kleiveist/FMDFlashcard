/**
 * @file apps/fmd-desktop/src/features/preview/MarkdownHybridEditor.tsx
 *
 * Zweck:
 * - Zeigt Markdown als Blockliste an.
 * - Nur der aktive Block ist als Raw-Textarea editierbar.
 */

import {
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  isSingleLineCommitBlock,
  normalizeHelpBlockSource,
  normalizeOrderedListBlockSource,
  parseMarkdownBlocks,
  replaceMarkdownBlock,
  type MarkdownBlock,
} from "./markdownBlocks";
import {
  canRedoMarkdownHistory,
  canUndoMarkdownHistory,
  createMarkdownHistory,
  redoMarkdownHistory,
  resetMarkdownHistory,
  undoMarkdownHistory,
  pushMarkdownHistory,
  type MarkdownHistoryState,
} from "./markdownHistory";

export type MarkdownHybridEditorMode = "edit" | "write";

type PendingActivation = {
  index: number;
  caret: "start" | "end";
};

type BlockSelectionRange = {
  anchorIndex: number;
  focusIndex: number;
};

type BlockSelectionState = {
  anchorIndex: number;
  selectedIndices: number[];
};

type SelectionGestureSource = "right" | "shift-left";

type SelectionGestureState = {
  active: boolean;
  source: SelectionGestureSource;
  anchorIndex: number;
  didDrag: boolean;
  startClientX: number;
  startClientY: number;
};

type SelectionContextMenuState = {
  blockIndex: number;
  x: number;
  y: number;
};

type OverlayBlockRect = {
  index: number;
  top: number;
  height: number;
  kind: MarkdownBlock["kind"];
};

type OverlayLayoutState = {
  byIndex: Map<number, OverlayBlockRect>;
  contentPaddingLeft: number;
  contentPaddingRight: number;
};

type InsertMenuCategoryId =
  | "text-headings"
  | "lists"
  | "structure"
  | "links"
  | "advanced";

type InsertMenuItemId =
  | "text"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "bullet-list"
  | "ordered-list"
  | "todo-list"
  | "collapsible-list"
  | "page"
  | "blockquote"
  | "table"
  | "divider"
  | "page-link"
  | "code-block"
  | "formula-block";

type InsertMenuState = {
  blockIndex: number;
  insertAbove: boolean;
  phase: "categories" | "items";
  categoryId?: InsertMenuCategoryId;
};

type InsertMenuCategory = {
  id: InsertMenuCategoryId;
  label: string;
};

type InsertMenuItem = {
  id: InsertMenuItemId;
  label: string;
  template: string;
};

type MarkdownHybridEditorProps = {
  historyKey: string;
  markdown: string;
  mode: MarkdownHybridEditorMode;
  disabled?: boolean;
  onChange: (value: string) => void;
  onCommit?: (value: string, context: { block: MarkdownBlock }) => void;
  onDirtyChange?: (dirty: boolean) => void;
  renderPreview: (markdown: string) => ReactNode;
};

const INSERT_MENU_CATEGORIES: InsertMenuCategory[] = [
  { id: "text-headings", label: "Text & Ueberschriften" },
  { id: "lists", label: "Listen" },
  { id: "structure", label: "Struktur" },
  { id: "links", label: "Links" },
  { id: "advanced", label: "Erweitert" },
];

const INSERT_MENU_ITEMS_BY_CATEGORY: Record<InsertMenuCategoryId, InsertMenuItem[]> = {
  "text-headings": [
    { id: "text", label: "Text", template: "Neuer Text" },
    { id: "heading-1", label: "Ueberschrift 1", template: "# Ueberschrift" },
    { id: "heading-2", label: "Ueberschrift 2", template: "## Ueberschrift" },
    { id: "heading-3", label: "Ueberschrift 3", template: "### Ueberschrift" },
  ],
  lists: [
    { id: "bullet-list", label: "Aufzaehlung", template: "- Listeneintrag" },
    { id: "ordered-list", label: "Nummerierung", template: "1. Listeneintrag" },
    { id: "todo-list", label: "To-do-Liste", template: "- [ ] Aufgabe" },
    {
      id: "collapsible-list",
      label: "Aufklappbare Liste",
      template:
        "<details>\n<summary>Liste</summary>\n<ul>\n<li>Eintrag</li>\n</ul>\n</details>",
    },
  ],
  structure: [
    {
      id: "page",
      label: "Seite",
      template: "#card\nFrage oder Titel\nAnswer: Antwort oder Inhalt\n#endcard",
    },
    { id: "blockquote", label: "Zitat", template: "> Zitat" },
    {
      id: "table",
      label: "Tabelle",
      template: "| Spalte A | Spalte B |\n| --- | --- |\n| Wert 1 | Wert 2 |",
    },
    { id: "divider", label: "Trennlinie", template: "---" },
  ],
  links: [
    { id: "page-link", label: "Seite verlinken", template: "[[Seite]]" },
  ],
  advanced: [
    { id: "code-block", label: "Code-Block", template: "```txt\nCode\n```" },
    { id: "formula-block", label: "Formel-Block", template: "```math\nx = y\n```" },
  ],
};

const isUndoShortcut = (event: KeyboardEvent<HTMLElement>) =>
  !event.shiftKey &&
  (event.metaKey || event.ctrlKey) &&
  !event.altKey &&
  event.key.toLowerCase() === "z";

const isRedoShortcut = (event: KeyboardEvent<HTMLElement>) =>
  (event.metaKey || event.ctrlKey) &&
  !event.altKey &&
  ((event.shiftKey && event.key.toLowerCase() === "z") ||
    (!event.metaKey && event.key.toLowerCase() === "y"));

const isDeleteRangeShortcut = (event: KeyboardEvent<HTMLElement>) =>
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  (event.key === "Delete" || event.key === "Backspace");

const clampIndex = (value: number, maxExclusive: number) => {
  if (maxExclusive <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(value, maxExclusive - 1));
};

const OVERLAY_LEFT_GUTTER_WIDTH = 56;
const OVERLAY_RIGHT_GUTTER_WIDTH = 34;

const findScrollableAncestor = (element: HTMLElement | null) => {
  let current = element?.parentElement ?? null;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY || style.overflow;
    if (/(auto|scroll|overlay)/.test(overflowY) && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

const areOverlayLayoutsEqual = (left: OverlayLayoutState, right: OverlayLayoutState) => {
  if (
    left.contentPaddingLeft !== right.contentPaddingLeft ||
    left.contentPaddingRight !== right.contentPaddingRight ||
    left.byIndex.size !== right.byIndex.size
  ) {
    return false;
  }
  for (const [index, leftRect] of left.byIndex) {
    const rightRect = right.byIndex.get(index);
    if (!rightRect) {
      return false;
    }
    if (
      leftRect.kind !== rightRect.kind ||
      leftRect.top !== rightRect.top ||
      leftRect.height !== rightRect.height
    ) {
      return false;
    }
  }
  return true;
};

const normalizeBlockSelectionRange = (range: BlockSelectionRange) => ({
  start: Math.min(range.anchorIndex, range.focusIndex),
  end: Math.max(range.anchorIndex, range.focusIndex),
});

const createSelectionIndexRange = (anchorIndex: number, focusIndex: number) => {
  const normalized = normalizeBlockSelectionRange({ anchorIndex, focusIndex });
  const indices: number[] = [];
  for (let index = normalized.start; index <= normalized.end; index += 1) {
    indices.push(index);
  }
  return indices;
};

const sortUniqueSelectionIndices = (indices: number[]) =>
  Array.from(new Set(indices)).sort((a, b) => a - b);

const isBlockIndexSelected = (selection: BlockSelectionState | null, index: number) => {
  if (!selection) {
    return false;
  }
  return selection.selectedIndices.includes(index);
};

const selectionToContiguousRanges = (selection: BlockSelectionState) => {
  const indices = sortUniqueSelectionIndices(selection.selectedIndices);
  if (indices.length === 0) {
    return [] as BlockSelectionRange[];
  }

  const ranges: BlockSelectionRange[] = [];
  let start = indices[0]!;
  let previous = indices[0]!;

  for (let i = 1; i < indices.length; i += 1) {
    const current = indices[i]!;
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    ranges.push({ anchorIndex: start, focusIndex: previous });
    start = current;
    previous = current;
  }

  ranges.push({ anchorIndex: start, focusIndex: previous });
  return ranges;
};

const deleteMarkdownBlockRange = (
  sourceMarkdown: string,
  blocks: MarkdownBlock[],
  range: BlockSelectionRange,
) => {
  if (blocks.length === 0) {
    return sourceMarkdown;
  }
  const normalized = normalizeBlockSelectionRange(range);
  const firstBlock = blocks[normalized.start];
  const lastBlock = blocks[normalized.end];
  if (!firstBlock || !lastBlock) {
    return sourceMarkdown;
  }

  let removeStart = firstBlock.startOffset;
  let removeEnd = lastBlock.endOffset;

  if (sourceMarkdown[removeEnd] === "\n") {
    removeEnd += 1;
  } else if (removeStart > 0 && sourceMarkdown[removeStart - 1] === "\n") {
    removeStart -= 1;
  }

  return `${sourceMarkdown.slice(0, removeStart)}${sourceMarkdown.slice(removeEnd)}`;
};

const deleteMarkdownBlockSelection = (
  sourceMarkdown: string,
  blocks: MarkdownBlock[],
  selection: BlockSelectionState,
) => {
  const ranges = selectionToContiguousRanges(selection);
  if (ranges.length === 0) {
    return sourceMarkdown;
  }

  let nextMarkdown = sourceMarkdown;
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const nextRange = ranges[i];
    if (!nextRange) {
      continue;
    }
    nextMarkdown = deleteMarkdownBlockRange(nextMarkdown, blocks, nextRange);
  }
  return nextMarkdown;
};

const serializeMarkdownFromBlocks = (blocks: Pick<MarkdownBlock, "raw">[]) =>
  blocks.map((block) => block.raw).join("\n");

const moveBlockInList = <T,>(items: T[], fromIndex: number, toSlotIndex: number) => {
  if (fromIndex < 0 || fromIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (typeof moved === "undefined") {
    return items;
  }
  let insertIndex = Math.max(0, Math.min(toSlotIndex, items.length));
  if (insertIndex > fromIndex) {
    insertIndex -= 1;
  }
  next.splice(insertIndex, 0, moved);
  return next;
};

const withInsertedRawBlock = (
  blocks: MarkdownBlock[],
  atIndex: number,
  insertedRaw: string,
) => {
  const nextRawBlocks = blocks.map((block) => block.raw);
  const targetIndex = Math.max(0, Math.min(atIndex, nextRawBlocks.length));
  const insertionParts: string[] = [];
  const previousRaw = nextRawBlocks[targetIndex - 1] ?? null;
  const nextRaw = nextRawBlocks[targetIndex] ?? null;
  const previousIsBlank = previousRaw !== null && previousRaw.trim() === "";
  const nextIsBlank = nextRaw !== null && nextRaw.trim() === "";

  if (previousRaw !== null && !previousIsBlank) {
    insertionParts.push("");
  }
  insertionParts.push(insertedRaw);
  if (nextRaw !== null && !nextIsBlank) {
    insertionParts.push("");
  }

  nextRawBlocks.splice(targetIndex, 0, ...insertionParts);
  return nextRawBlocks.join("\n");
};

type StableRenderKeyToken = {
  key: string;
  signature: string;
};

const getBlockSignature = (block: MarkdownBlock) => `${block.kind}\u0000${block.raw}`;

const assignStableRenderKeys = (
  blocks: MarkdownBlock[],
  previousTokens: StableRenderKeyToken[],
  nextCounter: { current: number },
) => {
  const nextTokens: StableRenderKeyToken[] = [];
  const usedPrevIndices = new Set<number>();
  const keys: string[] = [];

  for (const block of blocks) {
    const signature = getBlockSignature(block);
    let matchedPrevIndex = -1;
    for (let i = 0; i < previousTokens.length; i += 1) {
      if (usedPrevIndices.has(i)) {
        continue;
      }
      if ((previousTokens[i]?.signature ?? "") === signature) {
        matchedPrevIndex = i;
        break;
      }
    }

    if (matchedPrevIndex >= 0) {
      usedPrevIndices.add(matchedPrevIndex);
      const token = previousTokens[matchedPrevIndex]!;
      nextTokens.push({ key: token.key, signature });
      keys.push(token.key);
      continue;
    }

    nextCounter.current += 1;
    const key = `mdh-block-${nextCounter.current}`;
    nextTokens.push({ key, signature });
    keys.push(key);
  }

  return { keys, tokens: nextTokens };
};

const orderedListLikeLinePattern = /^\s*\d+(?:\.|\)|\.\))\s+\S/;
const unorderedListLikeLinePattern = /^\s*[-+*]\s+\S/;
const indentedContinuationLinePattern = /^(?:\s{2,}\S|\t+\S)/;

const needsHelpEndPreviewSeparator = (line: string) =>
  orderedListLikeLinePattern.test(line) ||
  unorderedListLikeLinePattern.test(line) ||
  indentedContinuationLinePattern.test(line);

const normalizeHelpBlockPreviewSource = (blockRaw: string) => {
  const normalized = normalizeHelpBlockSource(blockRaw);
  if (!normalized) {
    return normalized;
  }

  const lines = normalized.split("\n");
  const previewLines: string[] = [];

  for (const line of lines) {
    if (line !== "#helpend") {
      previewLines.push(line);
      continue;
    }

    const previousLine = previewLines[previewLines.length - 1] ?? "";
    // Preview-only: break out of markdown list parsing before "#helpend"
    // without changing the persisted source formatting.
    if (previousLine && needsHelpEndPreviewSeparator(previousLine)) {
      previewLines.push("");
    }
    previewLines.push(line);
  }

  return previewLines.join("\n");
};

const resolveSessionMarkdown = (
  markdown: string,
  blocks: MarkdownBlock[],
  activeBlockIndex: number | null,
  activeDraft: string,
) => {
  if (activeBlockIndex === null) {
    return markdown;
  }
  const block = blocks[activeBlockIndex];
  if (!block) {
    return markdown;
  }
  return replaceMarkdownBlock(markdown, block, activeDraft);
};

export const MarkdownHybridEditor = ({
  historyKey,
  markdown,
  mode,
  disabled = false,
  onChange,
  onCommit,
  onDirtyChange,
  renderPreview,
}: MarkdownHybridEditorProps) => {
  const blocks = useMemo(() => parseMarkdownBlocks(markdown), [markdown]);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [activeDraft, setActiveDraft] = useState("");
  const [activeDirty, setActiveDirty] = useState(false);
  const [history, setHistory] = useState<MarkdownHistoryState>(() =>
    createMarkdownHistory(markdown),
  );
  const [pendingActivation, setPendingActivation] = useState<PendingActivation | null>(
    null,
  );
  const [selectedBlockSelection, setSelectedBlockSelection] = useState<BlockSelectionState | null>(
    null,
  );
  const [isSelectionDragging, setIsSelectionDragging] = useState(false);
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);
  const [insertMenuState, setInsertMenuState] = useState<InsertMenuState | null>(null);
  const [selectionContextMenuState, setSelectionContextMenuState] =
    useState<SelectionContextMenuState | null>(null);
  const [overlayLayout, setOverlayLayout] = useState<OverlayLayoutState>(() => ({
    byIndex: new Map(),
    contentPaddingLeft: OVERLAY_LEFT_GUTTER_WIDTH,
    contentPaddingRight: OVERLAY_RIGHT_GUTTER_WIDTH,
  }));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentLayerRef = useRef<HTMLDivElement | null>(null);
  const insertMenuRef = useRef<HTMLDivElement | null>(null);
  const selectionContextMenuRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretRef = useRef<"start" | "end" | null>(null);
  const autoActivatedWriteKeyRef = useRef<string | null>(null);
  const selectionGestureRef = useRef<SelectionGestureState | null>(null);
  const suppressNextBlockContextMenuRef = useRef(false);
  const overlayMeasureFrameRef = useRef<number | null>(null);
  const overlayScrollContainerRef = useRef<HTMLElement | null>(null);
  const stableBlockRenderTokensRef = useRef<StableRenderKeyToken[]>([]);
  const stableBlockRenderKeyCounterRef = useRef(0);
  const blockRenderKeys = useMemo(() => {
    const assigned = assignStableRenderKeys(
      blocks,
      stableBlockRenderTokensRef.current,
      stableBlockRenderKeyCounterRef,
    );
    stableBlockRenderTokensRef.current = assigned.tokens;
    return assigned.keys;
  }, [blocks]);
  const overlayRows = useMemo(
    () =>
      Array.from(overlayLayout.byIndex.values()).sort((left, right) => left.index - right.index),
    [overlayLayout],
  );
  const editorSurfaceStyle = useMemo<CSSProperties>(
    () =>
      ({
        "--mdh-left-gutter-width": `${overlayLayout.contentPaddingLeft}px`,
        "--mdh-right-gutter-width": `${overlayLayout.contentPaddingRight}px`,
      }) as CSSProperties,
    [overlayLayout.contentPaddingLeft, overlayLayout.contentPaddingRight],
  );

  const measureOverlayLayout = useCallback(() => {
    const surface = containerRef.current;
    const contentLayer = contentLayerRef.current;
    if (!surface || !contentLayer) {
      setOverlayLayout((current) => {
        if (current.byIndex.size === 0) {
          return current;
        }
        return {
          ...current,
          byIndex: new Map(),
        };
      });
      return;
    }

    const surfaceRect = surface.getBoundingClientRect();
    const rowElements = Array.from(
      contentLayer.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
    );
    const nextByIndex = new Map<number, OverlayBlockRect>();

    for (const rowElement of rowElements) {
      const indexRaw = rowElement.dataset.mdBlockIndex;
      const kindRaw = rowElement.dataset.mdBlockKind;
      if (typeof indexRaw !== "string" || typeof kindRaw !== "string") {
        continue;
      }
      const parsedIndex = Number.parseInt(indexRaw, 10);
      if (!Number.isFinite(parsedIndex)) {
        continue;
      }
      const rowRect = rowElement.getBoundingClientRect();
      const top = Math.round((rowRect.top - surfaceRect.top + surface.scrollTop) * 100) / 100;
      const height = Math.max(1, Math.round(rowRect.height * 100) / 100);
      nextByIndex.set(parsedIndex, {
        index: parsedIndex,
        top,
        height,
        kind: kindRaw as MarkdownBlock["kind"],
      });
    }

    const nextLayout: OverlayLayoutState = {
      byIndex: nextByIndex,
      contentPaddingLeft: OVERLAY_LEFT_GUTTER_WIDTH,
      contentPaddingRight: OVERLAY_RIGHT_GUTTER_WIDTH,
    };

    setOverlayLayout((current) => (areOverlayLayoutsEqual(current, nextLayout) ? current : nextLayout));
  }, []);

  const scheduleOverlayLayoutMeasure = useCallback(() => {
    if (overlayMeasureFrameRef.current !== null) {
      return;
    }
    overlayMeasureFrameRef.current = window.requestAnimationFrame(() => {
      overlayMeasureFrameRef.current = null;
      measureOverlayLayout();
    });
  }, [measureOverlayLayout]);

  useEffect(() => {
    onDirtyChange?.(activeDirty);
  }, [activeDirty, onDirtyChange]);

  useEffect(() => {
    setHistory((current) => {
      if (current.present.markdown === markdown) {
        return current;
      }
      if (activeDirty) {
        return current;
      }
      return resetMarkdownHistory(markdown, "external-load");
    });
  }, [activeDirty, markdown]);

  useEffect(() => {
    setActiveBlockIndex(null);
    setActiveDraft("");
    setActiveDirty(false);
    setPendingActivation(null);
    setSelectedBlockSelection(null);
    setIsSelectionDragging(false);
    setDraggedBlockIndex(null);
    setDropIndicatorIndex(null);
    setInsertMenuState(null);
    setSelectionContextMenuState(null);
    setHistory(createMarkdownHistory(markdown));
    setOverlayLayout((current) => ({
      ...current,
      byIndex: new Map(),
    }));
    autoActivatedWriteKeyRef.current = null;
    selectionGestureRef.current = null;
    suppressNextBlockContextMenuRef.current = false;
    stableBlockRenderTokensRef.current = [];
  }, [historyKey]);

  useEffect(
    () => () => {
      if (overlayMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(overlayMeasureFrameRef.current);
        overlayMeasureFrameRef.current = null;
      }
    },
    [],
  );

  useLayoutEffect(() => {
    measureOverlayLayout();
  }, [
    blocks,
    activeBlockIndex,
    selectedBlockSelection,
    draggedBlockIndex,
    dropIndicatorIndex,
    insertMenuState,
    isSelectionDragging,
    measureOverlayLayout,
  ]);

  useEffect(() => {
    const contentLayer = contentLayerRef.current;
    if (!contentLayer || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      scheduleOverlayLayoutMeasure();
    });
    observer.observe(contentLayer);
    const rows = contentLayer.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]");
    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [blocks, activeBlockIndex, scheduleOverlayLayoutMeasure]);

  useEffect(() => {
    const surface = containerRef.current;
    if (!surface) {
      return;
    }
    const scrollContainer = findScrollableAncestor(surface);
    overlayScrollContainerRef.current = scrollContainer;
    const handlePositionAffectingEvent = () => {
      scheduleOverlayLayoutMeasure();
    };
    scrollContainer?.addEventListener("scroll", handlePositionAffectingEvent, { passive: true });
    window.addEventListener("resize", handlePositionAffectingEvent);
    return () => {
      scrollContainer?.removeEventListener("scroll", handlePositionAffectingEvent);
      window.removeEventListener("resize", handlePositionAffectingEvent);
      if (overlayScrollContainerRef.current === scrollContainer) {
        overlayScrollContainerRef.current = null;
      }
    };
  }, [scheduleOverlayLayoutMeasure]);

  useEffect(() => {
    if (!selectedBlockSelection) {
      return;
    }
    if (blocks.length === 0) {
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setSelectionContextMenuState(null);
      selectionGestureRef.current = null;
      return;
    }
    const validSelectedIndices = sortUniqueSelectionIndices(
      selectedBlockSelection.selectedIndices.filter((index) =>
        Number.isInteger(index) && index >= 0 && index < blocks.length
      ),
    );
    if (validSelectedIndices.length === 0) {
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setSelectionContextMenuState(null);
      selectionGestureRef.current = null;
      return;
    }
    const nextAnchor = validSelectedIndices.includes(selectedBlockSelection.anchorIndex)
      ? selectedBlockSelection.anchorIndex
      : validSelectedIndices[0]!;
    const didChange = nextAnchor !== selectedBlockSelection.anchorIndex ||
      validSelectedIndices.length !== selectedBlockSelection.selectedIndices.length ||
      validSelectedIndices.some((value, index) => value !== selectedBlockSelection.selectedIndices[index]);
    if (didChange) {
      setSelectedBlockSelection({
        anchorIndex: nextAnchor,
        selectedIndices: validSelectedIndices,
      });
    }
  }, [blocks.length, selectedBlockSelection]);

  useEffect(() => {
    if (!isSelectionDragging) {
      return;
    }
    const updateRangeFromPoint = (clientX: number, clientY: number) => {
      if (disabled || blocks.length === 0) {
        return;
      }
      const pointedElement = document.elementFromPoint(clientX, clientY);
      if (!(pointedElement instanceof HTMLElement)) {
        return;
      }
      if (!containerRef.current?.contains(pointedElement)) {
        return;
      }
      const blockElement = pointedElement.closest<HTMLElement>(
        ".markdown-hybrid-block[data-md-block-index]",
      );
      if (!blockElement || !containerRef.current?.contains(blockElement)) {
        return;
      }
      const blockIndexRaw = blockElement.dataset.mdBlockIndex;
      if (typeof blockIndexRaw !== "string") {
        return;
      }
      const parsedIndex = Number.parseInt(blockIndexRaw, 10);
      if (!Number.isFinite(parsedIndex)) {
        return;
      }
      const nextIndex = clampIndex(parsedIndex, blocks.length);
      let didChangeFocus = false;
      setSelectedBlockSelection((current) => {
        const gesture = selectionGestureRef.current;
        const anchorIndex = gesture?.anchorIndex ?? nextIndex;
        const nextSelectedIndices = createSelectionIndexRange(anchorIndex, nextIndex);
        if (!current) {
          didChangeFocus = true;
          return { anchorIndex, selectedIndices: nextSelectedIndices };
        }
        const hasSameSelection = current.anchorIndex === anchorIndex &&
          current.selectedIndices.length === nextSelectedIndices.length &&
          current.selectedIndices.every((value, index) => value === nextSelectedIndices[index]);
        if (hasSameSelection) {
          return current;
        }
        didChangeFocus = true;
        return { anchorIndex, selectedIndices: nextSelectedIndices };
      });
      const gesture = selectionGestureRef.current;
      if (!gesture) {
        return;
      }
      const movedFarEnough = Math.abs(clientX - gesture.startClientX) > 3 ||
        Math.abs(clientY - gesture.startClientY) > 3;
      if (movedFarEnough || didChangeFocus) {
        gesture.didDrag = true;
      }
    };

    const endSelectionGesture = (reason: "mouseup" | "button-release") => {
      const gesture = selectionGestureRef.current;
      if (gesture && gesture.source === "right" && gesture.didDrag) {
        suppressNextBlockContextMenuRef.current = true;
      } else if (reason === "mouseup") {
        suppressNextBlockContextMenuRef.current = false;
      }
      if (gesture) {
        gesture.active = false;
      }
      selectionGestureRef.current = null;
      setIsSelectionDragging(false);
    };

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (disabled || blocks.length === 0) {
        return;
      }
      const gesture = selectionGestureRef.current;
      if (!gesture?.active) {
        return;
      }
      const expectedButtonMask = gesture.source === "right" ? 2 : 1;
      if ((event.buttons & expectedButtonMask) !== expectedButtonMask) {
        endSelectionGesture("button-release");
        return;
      }
      updateRangeFromPoint(event.clientX, event.clientY);
    };
    const handleMouseUp = () => {
      endSelectionGesture("mouseup");
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [blocks.length, disabled, isSelectionDragging]);

  useEffect(() => {
    if (activeBlockIndex === null) {
      return;
    }
    const nextBlock = blocks[activeBlockIndex];
    if (!nextBlock) {
      setActiveBlockIndex(null);
      setActiveDraft("");
      setActiveDirty(false);
      return;
    }
    if (!activeDirty && nextBlock.raw !== activeDraft) {
      setActiveDraft(nextBlock.raw);
    }
  }, [activeBlockIndex, activeDirty, activeDraft, blocks]);

  useEffect(() => {
    if (mode !== "write" || disabled) {
      return;
    }
    if (activeBlockIndex !== null) {
      return;
    }
    if (autoActivatedWriteKeyRef.current === historyKey) {
      return;
    }
    autoActivatedWriteKeyRef.current = historyKey;
    if (blocks.length === 0) {
      pendingCaretRef.current = "start";
      setActiveBlockIndex(0);
      setActiveDraft(markdown);
      setActiveDirty(false);
      return;
    }
    setPendingActivation({ index: 0, caret: "end" });
  }, [activeBlockIndex, blocks.length, disabled, historyKey, markdown, mode]);

  useEffect(() => {
    if (!pendingActivation) {
      return;
    }
    if (blocks.length === 0) {
      setPendingActivation(null);
      return;
    }
    const nextIndex = clampIndex(pendingActivation.index, blocks.length);
    pendingCaretRef.current = pendingActivation.caret;
    setActiveBlockIndex(nextIndex);
    setActiveDraft(blocks[nextIndex]?.raw ?? "");
    setActiveDirty(false);
    setPendingActivation(null);
  }, [blocks, pendingActivation]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const caret = pendingCaretRef.current;
    pendingCaretRef.current = null;
    const handle = window.requestAnimationFrame(() => {
      try {
        textarea.focus({ preventScroll: true });
      } catch {
        textarea.focus();
      }
      const nextPos = caret === "start" ? 0 : textarea.value.length;
      textarea.setSelectionRange(nextPos, nextPos);
    });
    return () => window.cancelAnimationFrame(handle);
  }, [activeBlockIndex]);

  const applyGlobalHistory = useCallback(
    (nextHistory: MarkdownHistoryState) => {
      setHistory(nextHistory);
      setActiveBlockIndex(null);
      setActiveDraft("");
      setActiveDirty(false);
      setPendingActivation(null);
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      setInsertMenuState(null);
      setSelectionContextMenuState(null);
      selectionGestureRef.current = null;
      suppressNextBlockContextMenuRef.current = false;
      onChange(nextHistory.present.markdown);
    },
    [onChange],
  );

  const handleGlobalUndo = useCallback(() => {
    if (!canUndoMarkdownHistory(history)) {
      return false;
    }
    applyGlobalHistory(undoMarkdownHistory(history));
    return true;
  }, [applyGlobalHistory, history]);

  const handleGlobalRedo = useCallback(() => {
    if (!canRedoMarkdownHistory(history)) {
      return false;
    }
    applyGlobalHistory(redoMarkdownHistory(history));
    return true;
  }, [applyGlobalHistory, history]);

  const commitActiveBlock = useCallback(
    (options?: { deactivate?: boolean; nextActivation?: PendingActivation | null }) => {
      if (activeBlockIndex === null) {
        return markdown;
      }
      const block = blocks[activeBlockIndex];
      if (!block) {
        if (blocks.length === 0 && activeBlockIndex === 0) {
          const nextResolvedMarkdown = activeDraft;
          if (nextResolvedMarkdown !== markdown) {
            onChange(nextResolvedMarkdown);
          }
          setHistory((current) =>
            pushMarkdownHistory(current, nextResolvedMarkdown, "block-commit")
          );
          onCommit?.(nextResolvedMarkdown, {
            block: {
              id: "empty:0",
              kind: "blank",
              startLine: 0,
              endLine: 0,
              startOffset: 0,
              endOffset: 0,
              raw: nextResolvedMarkdown,
            },
          });
        }
        if (options?.deactivate) {
          setActiveBlockIndex(null);
          setActiveDraft("");
          setActiveDirty(false);
        }
        if (options?.nextActivation) {
          setPendingActivation(options.nextActivation);
        }
        return markdown;
      }

      let nextBlockRaw = activeDraft;
      if (block.kind === "ordered-list") {
        nextBlockRaw = normalizeOrderedListBlockSource(nextBlockRaw);
      } else if (block.kind === "help-block") {
        nextBlockRaw = normalizeHelpBlockSource(nextBlockRaw);
      }
      const currentResolvedMarkdown = resolveSessionMarkdown(
        markdown,
        blocks,
        activeBlockIndex,
        activeDraft,
      );
      const nextResolvedMarkdown = replaceMarkdownBlock(markdown, block, nextBlockRaw);

      if (nextResolvedMarkdown !== currentResolvedMarkdown) {
        onChange(nextResolvedMarkdown);
      }
      setHistory((current) => pushMarkdownHistory(current, nextResolvedMarkdown, "block-commit"));
      onCommit?.(nextResolvedMarkdown, { block: { ...block, raw: nextBlockRaw } });

      if (options?.deactivate ?? true) {
        setActiveBlockIndex(null);
        setActiveDraft("");
      } else {
        setActiveDraft(nextBlockRaw);
      }
      setActiveDirty(false);

      if (options?.nextActivation) {
        setPendingActivation(options.nextActivation);
      }

      return nextResolvedMarkdown;
    },
    [activeBlockIndex, activeDraft, blocks, markdown, onChange, onCommit],
  );

  const activateBlock = useCallback(
    (index: number, caret: "start" | "end" = "end") => {
      if (disabled) {
        return;
      }
      if (blocks.length === 0) {
        return;
      }
      const nextIndex = clampIndex(index, blocks.length);
      const nextBlock = blocks[nextIndex];
      if (!nextBlock) {
        return;
      }
      if (activeBlockIndex === nextIndex) {
        pendingCaretRef.current = caret;
        setActiveDraft(nextBlock.raw);
        return;
      }
      pendingCaretRef.current = caret;
      setActiveBlockIndex(nextIndex);
      setActiveDraft(nextBlock.raw);
      setActiveDirty(false);
    },
    [activeBlockIndex, blocks, disabled],
  );

  const focusContainer = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    try {
      container.focus({ preventScroll: true });
    } catch {
      container.focus();
    }
  }, []);

  const clearSelectedBlockRange = useCallback(() => {
    setSelectedBlockSelection(null);
    setIsSelectionDragging(false);
    setSelectionContextMenuState(null);
    selectionGestureRef.current = null;
    suppressNextBlockContextMenuRef.current = false;
  }, []);

  const setSingleBlockSelection = useCallback(
    (index: number) => {
      if (disabled || blocks.length === 0) {
        return;
      }
      const nextIndex = clampIndex(index, blocks.length);
      setSelectedBlockSelection({ anchorIndex: nextIndex, selectedIndices: [nextIndex] });
    },
    [blocks.length, disabled],
  );

  const toggleDiscreteBlockSelection = useCallback(
    (index: number) => {
      if (disabled || blocks.length === 0) {
        return;
      }
      const nextIndex = clampIndex(index, blocks.length);
      setSelectedBlockSelection((current) => {
        if (!current) {
          return { anchorIndex: nextIndex, selectedIndices: [nextIndex] };
        }
        const alreadySelected = current.selectedIndices.includes(nextIndex);
        if (alreadySelected) {
          const remaining = current.selectedIndices.filter((value) => value !== nextIndex);
          if (remaining.length === 0) {
            return null;
          }
          const nextAnchor = remaining.includes(current.anchorIndex)
            ? current.anchorIndex
            : nextIndex;
          return {
            anchorIndex: remaining.includes(nextAnchor) ? nextAnchor : remaining[0]!,
            selectedIndices: remaining,
          };
        }
        const nextSelectedIndices = sortUniqueSelectionIndices([
          ...current.selectedIndices,
          nextIndex,
        ]);
        return { anchorIndex: nextIndex, selectedIndices: nextSelectedIndices };
      });
    },
    [blocks.length, disabled],
  );

  const updateSelectionRangeFocus = useCallback(
    (index: number) => {
      if (disabled || blocks.length === 0) {
        return;
      }
      const nextIndex = clampIndex(index, blocks.length);
      setSelectedBlockSelection((current) => {
        const gesture = selectionGestureRef.current;
        const anchorIndex = gesture?.anchorIndex ?? current?.anchorIndex ?? nextIndex;
        const nextSelectedIndices = createSelectionIndexRange(anchorIndex, nextIndex);
        if (!current) {
          return { anchorIndex, selectedIndices: nextSelectedIndices };
        }
        const hasSameSelection = current.anchorIndex === anchorIndex &&
          current.selectedIndices.length === nextSelectedIndices.length &&
          current.selectedIndices.every((value, selectedIndex) =>
            value === nextSelectedIndices[selectedIndex]
          );
        if (hasSameSelection) {
          return current;
        }
        return { anchorIndex, selectedIndices: nextSelectedIndices };
      });
    },
    [blocks.length, disabled],
  );

  const beginSelectionGesture = useCallback(
    (options: {
      index: number;
      source: SelectionGestureSource;
      clientX: number;
      clientY: number;
      preserveAnchor?: boolean;
      preserveCurrentRangeIfSelected?: boolean;
    }) => {
      if (disabled || blocks.length === 0) {
        return false;
      }
      const nextIndex = clampIndex(options.index, blocks.length);
      const shouldPreserveCurrentRange = Boolean(
        options.preserveCurrentRangeIfSelected &&
          selectedBlockSelection &&
          isBlockIndexSelected(selectedBlockSelection, nextIndex),
      );
      const nextAnchor = shouldPreserveCurrentRange
        ? selectedBlockSelection!.anchorIndex
        : (options.preserveAnchor && selectedBlockSelection
          ? selectedBlockSelection.anchorIndex
          : nextIndex);
      const nextSelectedIndices = shouldPreserveCurrentRange
        ? selectedBlockSelection!.selectedIndices
        : createSelectionIndexRange(nextAnchor, nextIndex);

      if (activeBlockIndex !== null) {
        commitActiveBlock({ deactivate: true });
      }
      setPendingActivation(null);
      setInsertMenuState(null);
      setSelectionContextMenuState(null);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      setSelectedBlockSelection({ anchorIndex: nextAnchor, selectedIndices: nextSelectedIndices });
      selectionGestureRef.current = {
        active: true,
        source: options.source,
        anchorIndex: nextAnchor,
        didDrag: false,
        startClientX: options.clientX,
        startClientY: options.clientY,
      };
      suppressNextBlockContextMenuRef.current = false;
      setIsSelectionDragging(true);
      focusContainer();
      return true;
    },
    [
      activeBlockIndex,
      blocks.length,
      commitActiveBlock,
      disabled,
      focusContainer,
      selectedBlockSelection,
    ],
  );

  const deleteSelectedBlocks = useCallback(() => {
    if (disabled || activeBlockIndex !== null || !selectedBlockSelection) {
      return false;
    }
    const nextMarkdown = deleteMarkdownBlockSelection(markdown, blocks, selectedBlockSelection);
    if (nextMarkdown === markdown) {
      clearSelectedBlockRange();
      return false;
    }

    setActiveBlockIndex(null);
    setActiveDraft("");
    setActiveDirty(false);
    setPendingActivation(null);
    setSelectedBlockSelection(null);
    setIsSelectionDragging(false);
    setSelectionContextMenuState(null);
    selectionGestureRef.current = null;
    suppressNextBlockContextMenuRef.current = false;
    focusContainer();
    onChange(nextMarkdown);
    setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-delete"));
    return true;
  }, [
    activeBlockIndex,
    blocks,
    clearSelectedBlockRange,
    disabled,
    focusContainer,
    markdown,
    onChange,
    selectedBlockSelection,
  ]);

  const insertBlockRelativeTo = useCallback(
    (blockIndex: number, insertedRaw: string, insertAbove: boolean) => {
      if (disabled) {
        return false;
      }
      const targetIndex = insertAbove ? blockIndex : blockIndex + 1;
      const nextMarkdown = withInsertedRawBlock(blocks, targetIndex, insertedRaw);
      if (nextMarkdown === markdown) {
        return false;
      }

      const nextBlocks = parseMarkdownBlocks(nextMarkdown);
      const insertedBlocks = parseMarkdownBlocks(insertedRaw);
      const primaryInsertedBlock = insertedBlocks.find((block) => block.kind !== "blank") ?? insertedBlocks[0];
      let activationIndex = -1;
      if (primaryInsertedBlock) {
        const startSearchIndex = Math.max(0, Math.min(targetIndex, nextBlocks.length - 1));
        for (let offset = 0; offset < nextBlocks.length; offset += 1) {
          const forwardIndex = startSearchIndex + offset;
          if (
            forwardIndex < nextBlocks.length &&
            nextBlocks[forwardIndex]?.kind === primaryInsertedBlock.kind &&
            nextBlocks[forwardIndex]?.raw === primaryInsertedBlock.raw
          ) {
            activationIndex = forwardIndex;
            break;
          }
          const backwardIndex = startSearchIndex - offset;
          if (
            offset > 0 &&
            backwardIndex >= 0 &&
            nextBlocks[backwardIndex]?.kind === primaryInsertedBlock.kind &&
            nextBlocks[backwardIndex]?.raw === primaryInsertedBlock.raw
          ) {
            activationIndex = backwardIndex;
            break;
          }
        }
      }

      setActiveBlockIndex(null);
      setActiveDraft("");
      setActiveDirty(false);
      setPendingActivation(
        activationIndex >= 0 ? { index: activationIndex, caret: "end" } : null,
      );
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      setInsertMenuState(null);
      setSelectionContextMenuState(null);
      selectionGestureRef.current = null;
      suppressNextBlockContextMenuRef.current = false;
      onChange(nextMarkdown);
      setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-commit"));
      return true;
    },
    [blocks, disabled, markdown, onChange],
  );

  const reorderBlockByDrop = useCallback(
    (fromIndex: number, toSlotIndex: number) => {
      if (disabled) {
        return false;
      }
      const reorderedBlocks = moveBlockInList(blocks, fromIndex, toSlotIndex);
      if (reorderedBlocks === blocks) {
        return false;
      }
      const nextMarkdown = serializeMarkdownFromBlocks(reorderedBlocks);
      if (nextMarkdown === markdown) {
        return false;
      }
      const normalizedToSlot = Math.max(0, Math.min(toSlotIndex, blocks.length));
      const insertIndex = normalizedToSlot > fromIndex ? normalizedToSlot - 1 : normalizedToSlot;

      setActiveBlockIndex(null);
      setActiveDraft("");
      setActiveDirty(false);
      setPendingActivation({ index: clampIndex(insertIndex, reorderedBlocks.length), caret: "end" });
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      setInsertMenuState(null);
      setSelectionContextMenuState(null);
      selectionGestureRef.current = null;
      suppressNextBlockContextMenuRef.current = false;
      onChange(nextMarkdown);
      setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-commit"));
      return true;
    },
    [blocks, disabled, markdown, onChange],
  );

  useEffect(() => {
    if (!insertMenuState) {
      return;
    }

    const handleDocumentMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (insertMenuRef.current?.contains(target)) {
        return;
      }
      if (target.closest("[data-md-block-control='true']")) {
        return;
      }
      setInsertMenuState(null);
    };

    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setInsertMenuState(null);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [insertMenuState]);

  useEffect(() => {
    if (!selectionContextMenuState) {
      return;
    }

    const handleDocumentMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (selectionContextMenuRef.current?.contains(target)) {
        return;
      }
      setSelectionContextMenuState(null);
    };

    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectionContextMenuState(null);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [selectionContextMenuState]);

  const handleOpenInsertMenu = useCallback(
    (blockIndex: number) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const insertAbove = event.shiftKey;
      setSelectionContextMenuState(null);
      setInsertMenuState({
        blockIndex,
        insertAbove,
        phase: "categories",
      });
    },
    [],
  );

  const handleSelectInsertMenuCategory = useCallback(
    (categoryId: InsertMenuCategoryId) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setInsertMenuState((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          phase: "items",
          categoryId,
        };
      });
    },
    [],
  );

  const handleInsertMenuBack = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setInsertMenuState((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        phase: "categories",
        categoryId: undefined,
      };
    });
  }, []);

  const handleInsertMenuClose = useCallback((event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    setInsertMenuState(null);
  }, []);

  const handleSelectionContextMenuClose = useCallback(() => {
    setSelectionContextMenuState(null);
  }, []);

  const handleInsertMenuItemSelect = useCallback(
    (item: InsertMenuItem) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!insertMenuState) {
        return;
      }
      insertBlockRelativeTo(insertMenuState.blockIndex, item.template, insertMenuState.insertAbove);
    },
    [insertBlockRelativeTo, insertMenuState],
  );

  const handleSelectionContextMenuDelete = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectionContextMenuState(null);
      deleteSelectedBlocks();
    },
    [deleteSelectedBlocks],
  );

  const handleSelectionContextMenuClear = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      handleSelectionContextMenuClose();
      clearSelectedBlockRange();
      focusContainer();
    },
    [clearSelectedBlockRange, focusContainer, handleSelectionContextMenuClose],
  );

  const handleContainerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled || activeBlockIndex !== null) {
        return;
      }
      if (event.key === "Escape" && insertMenuState) {
        event.preventDefault();
        event.stopPropagation();
        setInsertMenuState(null);
        return;
      }
      if (event.key === "Escape" && selectionContextMenuState) {
        event.preventDefault();
        event.stopPropagation();
        setSelectionContextMenuState(null);
        return;
      }
      if (event.key === "Escape" && selectedBlockSelection) {
        event.preventDefault();
        event.stopPropagation();
        clearSelectedBlockRange();
        return;
      }
      if (selectedBlockSelection && isDeleteRangeShortcut(event)) {
        if (deleteSelectedBlocks()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (isUndoShortcut(event)) {
        if (handleGlobalUndo()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (isRedoShortcut(event)) {
        if (handleGlobalRedo()) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    },
    [
      activeBlockIndex,
      clearSelectedBlockRange,
      deleteSelectedBlocks,
      disabled,
      handleGlobalRedo,
      handleGlobalUndo,
      insertMenuState,
      selectionContextMenuState,
      selectedBlockSelection,
    ],
  );

  const handleTextareaChange = useCallback(
    (value: string) => {
      let nextValue = value;
      const activeBlock = activeBlockIndex === null ? null : (blocks[activeBlockIndex] ?? null);
      if (activeBlock?.kind === "help-block") {
        nextValue = normalizeHelpBlockSource(nextValue);
      }
      if (blocks.length === 0 && activeBlockIndex === 0) {
        setActiveDraft(nextValue);
        setActiveDirty(true);
        if (nextValue !== markdown) {
          onChange(nextValue);
        }
        return;
      }
      if (activeBlockIndex === null) {
        return;
      }
      setActiveDraft(nextValue);
      setActiveDirty(true);
      const block = activeBlock;
      if (!block) {
        return;
      }
      const nextMarkdown = replaceMarkdownBlock(markdown, block, nextValue);
      if (nextMarkdown !== markdown) {
        onChange(nextMarkdown);
      }
    },
    [activeBlockIndex, blocks, markdown, onChange],
  );

  const handleTextareaBlur = useCallback(() => {
    commitActiveBlock({ deactivate: true });
  }, [commitActiveBlock]);

  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.isComposing) {
        return;
      }

      if (isUndoShortcut(event)) {
        if (!activeDirty && handleGlobalUndo()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (isRedoShortcut(event)) {
        if (!activeDirty && handleGlobalRedo()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (activeBlockIndex === null) {
        return;
      }
      const block = blocks[activeBlockIndex];
      if (!block) {
        return;
      }

      const textarea = event.currentTarget;
      const hasSelection = textarea.selectionStart !== textarea.selectionEnd;
      const atStart = !hasSelection && textarea.selectionStart === 0;
      const atEnd = !hasSelection && textarea.selectionEnd === textarea.value.length;

      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        isSingleLineCommitBlock(block)
      ) {
        event.preventDefault();
        commitActiveBlock({
          deactivate: true,
          nextActivation: { index: activeBlockIndex + 1, caret: "start" },
        });
        return;
      }

      if (
        event.key === "ArrowDown" &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        atEnd
      ) {
        event.preventDefault();
        commitActiveBlock({
          deactivate: true,
          nextActivation: { index: activeBlockIndex + 1, caret: "start" },
        });
        return;
      }

      if (
        event.key === "ArrowUp" &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        atStart
      ) {
        event.preventDefault();
        commitActiveBlock({
          deactivate: true,
          nextActivation: { index: activeBlockIndex - 1, caret: "end" },
        });
      }
    },
    [
      activeBlockIndex,
      activeDirty,
      blocks,
      commitActiveBlock,
      handleGlobalRedo,
      handleGlobalUndo,
    ],
  );

  const handleBlockMouseDownCapture = useCallback(
    (index: number) => (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      const target = event.target;
      const isInteractiveElement = target instanceof HTMLElement &&
        Boolean(target.closest("a[href],button,input,textarea,[data-md-block-control='true']"));
      if (isInteractiveElement) {
        return;
      }

      if (event.button === 0 && event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        beginSelectionGesture({
          index,
          source: "shift-left",
          clientX: event.clientX,
          clientY: event.clientY,
          preserveAnchor: Boolean(selectedBlockSelection),
        });
        return;
      }

      if (event.button === 0 && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation();
        if (activeBlockIndex !== null) {
          commitActiveBlock({ deactivate: true });
        }
        setPendingActivation(null);
        setInsertMenuState(null);
        setSelectionContextMenuState(null);
        setDraggedBlockIndex(null);
        setDropIndicatorIndex(null);
        toggleDiscreteBlockSelection(index);
        focusContainer();
        return;
      }

      if (event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
        beginSelectionGesture({
          index,
          source: "right",
          clientX: event.clientX,
          clientY: event.clientY,
          preserveCurrentRangeIfSelected: true,
        });
      }
    },
    [
      activeBlockIndex,
      beginSelectionGesture,
      commitActiveBlock,
      disabled,
      focusContainer,
      selectedBlockSelection,
      toggleDiscreteBlockSelection,
    ],
  );

  const handleBlockMouseDown = useCallback(
    (index: number) => (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      const target = event.target;
      const isInteractiveElement = target instanceof HTMLElement &&
        Boolean(target.closest("a[href],button,input,[data-md-block-control='true']"));
      const isTextareaElement = target instanceof HTMLElement &&
        Boolean(target.closest("textarea"));
      if (isInteractiveElement) {
        return;
      }

      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.button !== 0) {
        return;
      }
      if (isTextareaElement) {
        return;
      }
      if (selectedBlockSelection) {
        clearSelectedBlockRange();
      }
      if (activeBlockIndex === index) {
        return;
      }
      event.preventDefault();
      activateBlock(index, "end");
    },
    [
      activateBlock,
      activeBlockIndex,
      clearSelectedBlockRange,
      disabled,
      selectedBlockSelection,
    ],
  );

  const handleBlockMouseEnter = useCallback(
    (index: number) => (event: MouseEvent<HTMLDivElement>) => {
      if (disabled || !isSelectionDragging || blocks.length === 0) {
        return;
      }
      const gesture = selectionGestureRef.current;
      if (!gesture?.active) {
        return;
      }
      const expectedButtonMask = gesture.source === "right" ? 2 : 1;
      if ((event.buttons & expectedButtonMask) !== expectedButtonMask) {
        return;
      }
      gesture.didDrag = true;
      updateSelectionRangeFocus(index);
    },
    [blocks.length, disabled, isSelectionDragging, updateSelectionRangeFocus],
  );

  const handleDragHandleDragStart = useCallback(
    (index: number) => (event: DragEvent<HTMLButtonElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      if (activeBlockIndex !== null) {
        commitActiveBlock({ deactivate: true });
      }
      clearSelectedBlockRange();
      setInsertMenuState(null);
      setDraggedBlockIndex(index);
      setDropIndicatorIndex(index);
      try {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      } catch {
        // ignore restricted dataTransfer implementations
      }
    },
    [activeBlockIndex, clearSelectedBlockRange, commitActiveBlock, disabled],
  );

  const handleDragHandleDragEnd = useCallback(() => {
    setDraggedBlockIndex(null);
    setDropIndicatorIndex(null);
  }, []);

  const handleBlockDragOver = useCallback(
    (index: number) => (event: DragEvent<HTMLDivElement>) => {
      if (disabled || draggedBlockIndex === null) {
        return;
      }
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const nextDropIndex = event.clientY < rect.top + rect.height / 2
        ? index
        : index + 1;
      if (dropIndicatorIndex !== nextDropIndex) {
        setDropIndicatorIndex(nextDropIndex);
      }
      try {
        event.dataTransfer.dropEffect = "move";
      } catch {
        // ignore
      }
    },
    [disabled, draggedBlockIndex, dropIndicatorIndex],
  );

  const handleBlockDrop = useCallback(
    (_index: number) => (event: DragEvent<HTMLDivElement>) => {
      if (disabled || draggedBlockIndex === null || dropIndicatorIndex === null) {
        return;
      }
      event.preventDefault();
      reorderBlockByDrop(draggedBlockIndex, dropIndicatorIndex);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
    },
    [disabled, draggedBlockIndex, dropIndicatorIndex, reorderBlockByDrop],
  );

  const handleHybridEditorContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      if (!(event.target instanceof HTMLElement)) {
        return;
      }
      if (event.target.closest("a[href],button,input,textarea,[data-md-block-control='true']")) {
        return;
      }
      const blockElement = event.target.closest<HTMLElement>(
        ".markdown-hybrid-block[data-md-block-index]",
      );
      if (!blockElement) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      if (suppressNextBlockContextMenuRef.current) {
        suppressNextBlockContextMenuRef.current = false;
        setSelectionContextMenuState(null);
        return;
      }

      const blockIndexRaw = blockElement.dataset.mdBlockIndex;
      if (typeof blockIndexRaw !== "string") {
        return;
      }
      const parsedIndex = Number.parseInt(blockIndexRaw, 10);
      if (!Number.isFinite(parsedIndex)) {
        return;
      }
      const blockIndex = clampIndex(parsedIndex, blocks.length);

      if (!isBlockIndexSelected(selectedBlockSelection, blockIndex)) {
        if (activeBlockIndex !== null) {
          commitActiveBlock({ deactivate: true });
        }
        setPendingActivation(null);
        setSingleBlockSelection(blockIndex);
      }

      setInsertMenuState(null);
      setSelectionContextMenuState({
        blockIndex,
        x: event.clientX,
        y: event.clientY,
      });
      selectionGestureRef.current = null;
      setIsSelectionDragging(false);
      focusContainer();
    },
    [
      activeBlockIndex,
      blocks.length,
      commitActiveBlock,
      disabled,
      focusContainer,
      selectedBlockSelection,
      setSingleBlockSelection,
    ],
  );

  const handleSelectionContextMenuMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const handleSelectionContextMenuItemMouseDown = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const handleSelectionContextMenuClearButton = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      handleSelectionContextMenuItemMouseDown(event);
      handleSelectionContextMenuClear(event);
    },
    [handleSelectionContextMenuClear, handleSelectionContextMenuItemMouseDown],
  );

  const handleSelectionContextMenuDeleteButton = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      handleSelectionContextMenuItemMouseDown(event);
      handleSelectionContextMenuDelete(event);
    },
    [handleSelectionContextMenuDelete, handleSelectionContextMenuItemMouseDown],
  );

  const activeInsertMenuItems = insertMenuState?.categoryId
    ? (INSERT_MENU_ITEMS_BY_CATEGORY[insertMenuState.categoryId] ?? [])
    : [];

  const renderInsertMenuPanel = (blockIndex: number) => {
    const isInsertMenuOpen = Boolean(insertMenuState && insertMenuState.blockIndex === blockIndex);
    if (!isInsertMenuOpen) {
      return null;
    }
    return (
      <div
        ref={insertMenuRef}
        className="markdown-hybrid-insert-menu markdown-hybrid-insert-menu-overlay"
        data-md-block-control="true"
        role="menu"
        aria-label="Block einfuegen"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="markdown-hybrid-insert-menu-header">
          <span className="markdown-hybrid-insert-menu-title">
            {insertMenuState?.insertAbove ? "Einfuegen oberhalb" : "Einfuegen unterhalb"}
          </span>
          {insertMenuState?.phase === "items" ? (
            <button
              type="button"
              className="markdown-hybrid-insert-menu-nav"
              onClick={handleInsertMenuBack}
            >
              Zurueck
            </button>
          ) : null}
        </div>
        <div className="markdown-hybrid-insert-menu-list">
          {insertMenuState?.phase === "categories"
            ? INSERT_MENU_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                className="markdown-hybrid-insert-menu-item"
                onClick={handleSelectInsertMenuCategory(category.id)}
                role="menuitem"
              >
                {category.label}
              </button>
            ))
            : activeInsertMenuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="markdown-hybrid-insert-menu-item"
                onClick={handleInsertMenuItemSelect(item)}
                role="menuitem"
              >
                {item.label}
              </button>
            ))}
        </div>
        <button
          type="button"
          className="markdown-hybrid-insert-menu-close"
          onClick={handleInsertMenuClose}
        >
          Menue schliessen (Esc)
        </button>
      </div>
    );
  };

  const renderOverlayRow = (options: {
    blockIndex: number;
    kind: MarkdownBlock["kind"];
    top: number;
    height: number;
    isDragHandleDisabled?: boolean;
    insertButtonTitle?: string;
  }) => {
    const blockIndex = options.blockIndex;
    const isSelected = !disabled && isBlockIndexSelected(selectedBlockSelection, blockIndex);
    const isActive = !disabled && activeBlockIndex === blockIndex;
    const isDragging = draggedBlockIndex === blockIndex;
    return (
      <div
        key={`overlay-row:${blockIndex}`}
        className="markdown-hybrid-overlay-row"
        data-md-block-index={blockIndex}
        data-md-block-id={String(blockIndex)}
        data-md-block-kind={options.kind}
        style={{ top: options.top, height: options.height }}
      >
        <div className="markdown-hybrid-overlay-rail markdown-hybrid-overlay-rail-left">
          <button
            type="button"
            className="markdown-hybrid-overlay-control markdown-hybrid-block-control markdown-hybrid-block-drag-handle"
            data-md-block-control="true"
            draggable={!disabled && !options.isDragHandleDisabled}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onDragStart={handleDragHandleDragStart(blockIndex)}
            onDragEnd={handleDragHandleDragEnd}
            aria-label="Block verschieben"
            title={options.isDragHandleDisabled ? "Kein Block vorhanden" : "Block verschieben"}
            disabled={disabled || options.isDragHandleDisabled}
          >
            <span aria-hidden="true">⋮⋮</span>
          </button>
          <button
            type="button"
            className="markdown-hybrid-overlay-control markdown-hybrid-block-control markdown-hybrid-block-insert-button"
            data-md-block-control="true"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={handleOpenInsertMenu(blockIndex)}
            aria-label="Block einfuegen"
            title={options.insertButtonTitle ?? "Block darunter einfuegen (Shift = darueber)"}
            disabled={disabled}
          >
            <span aria-hidden="true">+</span>
          </button>
          {renderInsertMenuPanel(blockIndex)}
        </div>
        <div className="markdown-hybrid-overlay-rail markdown-hybrid-overlay-rail-right">
          <span
            className={`markdown-hybrid-overlay-right-status${
              isSelected ? " is-selected" : ""
            }${isActive ? " is-active" : ""}${isDragging ? " is-dragging" : ""}`}
            aria-hidden="true"
            title={
              isDragging
                ? "Block wird verschoben"
                : isActive
                ? "Block im Edit-Modus"
                : isSelected
                ? "Block markiert"
                : "Block"
            }
          >
            |
          </span>
        </div>
      </div>
    );
  };

  const selectionContextMenu = selectionContextMenuState && !disabled && selectedBlockSelection ? (
    <div
      ref={selectionContextMenuRef}
      className="markdown-hybrid-selection-menu"
      role="menu"
      aria-label="Blockauswahl"
      data-md-block-control="true"
      style={{ left: selectionContextMenuState.x, top: selectionContextMenuState.y }}
      onMouseDown={handleSelectionContextMenuMouseDown}
    >
      <button
        type="button"
        className="markdown-hybrid-selection-menu-item is-danger"
        role="menuitem"
        onMouseDown={handleSelectionContextMenuItemMouseDown}
        onClick={handleSelectionContextMenuDeleteButton}
      >
        Delete
      </button>
      <button
        type="button"
        className="markdown-hybrid-selection-menu-item"
        role="menuitem"
        onMouseDown={handleSelectionContextMenuItemMouseDown}
        onClick={handleSelectionContextMenuClearButton}
      >
        Auswahl aufheben
      </button>
    </div>
  ) : null;

  if (blocks.length === 0) {
    const emptyOverlayRect = overlayLayout.byIndex.get(0) ?? {
      index: 0,
      top: 0,
      height: 28,
      kind: "blank" as MarkdownBlock["kind"],
    };
    return (
      <div
        ref={containerRef}
        className={`markdown-hybrid-editor${disabled ? " is-disabled" : ""}${
          isSelectionDragging ? " is-selection-dragging" : ""
        }`}
        style={editorSurfaceStyle}
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
        onContextMenu={handleHybridEditorContextMenu}
      >
        <div ref={contentLayerRef} className="markdown-hybrid-content-layer">
          <div
            className={`markdown-hybrid-block markdown-hybrid-block-empty${
              disabled ? " is-disabled" : ""
            }`}
            aria-selected={false}
            data-md-block-kind="blank"
            data-md-block-index={0}
            data-md-block-id="0"
            onMouseDown={(event) => {
              if (disabled) {
                return;
              }
              if (event.button !== 0) {
                return;
              }
              event.preventDefault();
              clearSelectedBlockRange();
              setActiveBlockIndex(0);
              setActiveDraft("");
              setActiveDirty(false);
              pendingCaretRef.current = "start";
            }}
          >
            <div className="markdown-hybrid-block-body">
              {activeBlockIndex === 0 && !disabled ? (
                <textarea
                  ref={textareaRef}
                  className="markdown-hybrid-block-editor"
                  value={activeDraft}
                  rows={1}
                  onChange={(event) => handleTextareaChange(event.target.value)}
                  onBlur={handleTextareaBlur}
                  onKeyDown={handleTextareaKeyDown}
                  aria-label="Markdown block editor"
                />
              ) : (
                <div className="markdown-hybrid-empty-placeholder" aria-hidden="true" />
              )}
            </div>
          </div>
        </div>
        <div className="markdown-hybrid-controls-overlay">
          {renderOverlayRow({
            blockIndex: 0,
            kind: emptyOverlayRect.kind,
            top: emptyOverlayRect.top,
            height: emptyOverlayRect.height,
            isDragHandleDisabled: true,
            insertButtonTitle: "Block einfuegen",
          })}
        </div>
        {selectionContextMenu}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`markdown-hybrid-editor${disabled ? " is-disabled" : ""}${
        isSelectionDragging ? " is-selection-dragging" : ""
      }`}
      style={editorSurfaceStyle}
      tabIndex={0}
      onKeyDown={handleContainerKeyDown}
      onContextMenu={handleHybridEditorContextMenu}
    >
      <div ref={contentLayerRef} className="markdown-hybrid-content-layer">
        {blocks.map((block, index) => {
          const isActive = activeBlockIndex === index && !disabled;
          const isRangeSelected = !disabled && isBlockIndexSelected(selectedBlockSelection, index);
          const isDragging = draggedBlockIndex === index;
          const hasDropIndicatorTop = dropIndicatorIndex === index;
          const hasDropIndicatorBottom = dropIndicatorIndex === index + 1;
          const previewBlockSource = block.kind === "help-block"
            ? normalizeHelpBlockPreviewSource(block.raw)
            : block.raw;
          return (
            <div
              key={blockRenderKeys[index] ?? block.id}
              className={`markdown-hybrid-block markdown-hybrid-block-${block.kind}${
                isActive ? " is-active" : ""
              }${isRangeSelected ? " is-range-selected" : ""}${
                isDragging ? " is-dragging" : ""
              }${hasDropIndicatorTop ? " has-drop-indicator-top" : ""}${
                hasDropIndicatorBottom ? " has-drop-indicator-bottom" : ""
              }`}
              aria-selected={isRangeSelected || undefined}
              data-md-block-selected={isRangeSelected ? "true" : undefined}
              data-md-block-kind={block.kind}
              data-md-block-index={index}
              data-md-block-id={String(index)}
              onMouseDownCapture={handleBlockMouseDownCapture(index)}
              onMouseDown={handleBlockMouseDown(index)}
              onMouseEnter={handleBlockMouseEnter(index)}
              onDragOver={handleBlockDragOver(index)}
              onDrop={handleBlockDrop(index)}
            >
              <div className="markdown-hybrid-block-body">
                {isActive ? (
                  <textarea
                    ref={textareaRef}
                    className="markdown-hybrid-block-editor"
                    value={activeDraft}
                    rows={Math.max(1, activeDraft.split("\n").length)}
                    onChange={(event) => handleTextareaChange(event.target.value)}
                    onBlur={handleTextareaBlur}
                    onKeyDown={handleTextareaKeyDown}
                    aria-label="Markdown block editor"
                  />
                ) : block.kind === "blank" ? (
                  <div className="markdown-hybrid-blank-preview" aria-hidden="true" />
                ) : (
                  <div className="markdown-hybrid-block-preview">
                    {renderPreview(previewBlockSource)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="markdown-hybrid-controls-overlay">
        {overlayRows.map((overlayRow) =>
          renderOverlayRow({
            blockIndex: overlayRow.index,
            kind: overlayRow.kind,
            top: overlayRow.top,
            height: overlayRow.height,
          }))}
      </div>
      {selectionContextMenu}
    </div>
  );
};
