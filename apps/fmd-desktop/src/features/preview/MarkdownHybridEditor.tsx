/**
 * @file apps/fmd-desktop/src/features/preview/MarkdownHybridEditor.tsx
 *
 * Zweck:
 * - Zeigt Markdown als Blockliste an.
 * - Nur der aktive Block ist als Raw-Textarea editierbar.
 */

import {
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

const normalizeBlockSelectionRange = (range: BlockSelectionRange) => ({
  start: Math.min(range.anchorIndex, range.focusIndex),
  end: Math.max(range.anchorIndex, range.focusIndex),
});

const isBlockIndexInSelectedRange = (range: BlockSelectionRange | null, index: number) => {
  if (!range) {
    return false;
  }
  const normalized = normalizeBlockSelectionRange(range);
  return index >= normalized.start && index <= normalized.end;
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
  const [selectedBlockRange, setSelectedBlockRange] = useState<BlockSelectionRange | null>(
    null,
  );
  const [isRightDragSelecting, setIsRightDragSelecting] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretRef = useRef<"start" | "end" | null>(null);
  const autoActivatedWriteKeyRef = useRef<string | null>(null);

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
    setSelectedBlockRange(null);
    setIsRightDragSelecting(false);
    setHistory(createMarkdownHistory(markdown));
    autoActivatedWriteKeyRef.current = null;
  }, [historyKey]);

  useEffect(() => {
    if (!selectedBlockRange) {
      return;
    }
    if (blocks.length === 0) {
      setSelectedBlockRange(null);
      setIsRightDragSelecting(false);
      return;
    }
    if (
      selectedBlockRange.anchorIndex >= blocks.length ||
      selectedBlockRange.focusIndex >= blocks.length
    ) {
      setSelectedBlockRange(null);
      setIsRightDragSelecting(false);
    }
  }, [blocks.length, selectedBlockRange]);

  useEffect(() => {
    if (!isRightDragSelecting) {
      return;
    }
    const handleMouseUp = () => {
      setIsRightDragSelecting(false);
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isRightDragSelecting]);

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
      setSelectedBlockRange(null);
      setIsRightDragSelecting(false);
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
    setSelectedBlockRange(null);
    setIsRightDragSelecting(false);
  }, []);

  const startRightDragSelection = useCallback(
    (index: number) => {
      if (disabled || blocks.length === 0) {
        return;
      }
      const nextIndex = clampIndex(index, blocks.length);
      setSelectedBlockRange({ anchorIndex: nextIndex, focusIndex: nextIndex });
      setIsRightDragSelecting(true);
      focusContainer();
    },
    [blocks.length, disabled, focusContainer],
  );

  const deleteSelectedBlocks = useCallback(() => {
    if (disabled || activeBlockIndex !== null || !selectedBlockRange) {
      return false;
    }
    const nextMarkdown = deleteMarkdownBlockRange(markdown, blocks, selectedBlockRange);
    if (nextMarkdown === markdown) {
      clearSelectedBlockRange();
      return false;
    }

    setActiveBlockIndex(null);
    setActiveDraft("");
    setActiveDirty(false);
    setPendingActivation(null);
    setSelectedBlockRange(null);
    setIsRightDragSelecting(false);
    onChange(nextMarkdown);
    setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-delete"));
    return true;
  }, [
    activeBlockIndex,
    blocks,
    clearSelectedBlockRange,
    disabled,
    markdown,
    onChange,
    selectedBlockRange,
  ]);

  const handleContainerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled || activeBlockIndex !== null) {
        return;
      }
      if (selectedBlockRange && isDeleteRangeShortcut(event)) {
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
      deleteSelectedBlocks,
      disabled,
      handleGlobalRedo,
      handleGlobalUndo,
      selectedBlockRange,
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

  const handleBlockMouseDown = useCallback(
    (index: number) => (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      const target = event.target;
      const isInteractiveElement = target instanceof HTMLElement &&
        Boolean(target.closest("a[href],button,input"));
      const isTextareaElement = target instanceof HTMLElement &&
        Boolean(target.closest("textarea"));
      if (isInteractiveElement) {
        return;
      }

      if (event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
        if (activeBlockIndex !== null) {
          commitActiveBlock({ deactivate: true });
        }
        startRightDragSelection(index);
        return;
      }

      if (event.button !== 0) {
        return;
      }
      if (isTextareaElement || activeBlockIndex === index) {
        return;
      }
      event.preventDefault();
      clearSelectedBlockRange();
      activateBlock(index, "end");
    },
    [
      activateBlock,
      activeBlockIndex,
      clearSelectedBlockRange,
      commitActiveBlock,
      disabled,
      startRightDragSelection,
    ],
  );

  const handleBlockMouseEnter = useCallback(
    (index: number) => (event: MouseEvent<HTMLDivElement>) => {
      if (disabled || !isRightDragSelecting || blocks.length === 0) {
        return;
      }
      if ((event.buttons & 2) !== 2) {
        return;
      }
      const nextIndex = clampIndex(index, blocks.length);
      setSelectedBlockRange((current) => {
        if (!current) {
          return { anchorIndex: nextIndex, focusIndex: nextIndex };
        }
        if (current.focusIndex === nextIndex) {
          return current;
        }
        return { ...current, focusIndex: nextIndex };
      });
    },
    [blocks.length, disabled, isRightDragSelecting],
  );

  const handleHybridEditorContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("a[href],button,input")
      ) {
        return;
      }
      if (event.target instanceof HTMLElement && event.target.closest(".markdown-hybrid-block")) {
        event.preventDefault();
      }
    },
    [disabled],
  );

  if (blocks.length === 0) {
    return (
      <div
        ref={containerRef}
        className={`markdown-hybrid-editor${disabled ? " is-disabled" : ""}`}
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
        onContextMenu={handleHybridEditorContextMenu}
      >
        <div
          className={`markdown-hybrid-block markdown-hybrid-block-empty${
            disabled ? " is-disabled" : ""
          }`}
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
    );
  }

  return (
    <div
      ref={containerRef}
      className={`markdown-hybrid-editor${disabled ? " is-disabled" : ""}`}
      tabIndex={0}
      onKeyDown={handleContainerKeyDown}
      onContextMenu={handleHybridEditorContextMenu}
    >
      {blocks.map((block, index) => {
        const isActive = activeBlockIndex === index && !disabled;
        const isRangeSelected = !disabled && isBlockIndexInSelectedRange(selectedBlockRange, index);
        return (
          <div
            key={block.id}
            className={`markdown-hybrid-block markdown-hybrid-block-${block.kind}${
              isActive ? " is-active" : ""
            }${isRangeSelected ? " is-range-selected" : ""}`}
            aria-selected={isRangeSelected || undefined}
            data-md-block-selected={isRangeSelected ? "true" : undefined}
            data-md-block-kind={block.kind}
            data-md-block-index={index}
            onMouseDown={handleBlockMouseDown(index)}
            onMouseEnter={handleBlockMouseEnter(index)}
          >
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
                {renderPreview(block.raw)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
