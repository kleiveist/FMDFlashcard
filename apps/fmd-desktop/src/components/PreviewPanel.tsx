import { type MouseEvent, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";

const markdownSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
  ],
  attributes: {
    ...defaultSchema.attributes,
    table: [...(defaultSchema.attributes?.table ?? []), "className"],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
  },
};

type PreviewPanelProps = {
  editDraft: string;
  editError: string;
  editCaretIndex: number | null;
  isEditing: boolean;
  emptyPreview: string;
  preview: string;
  previewError: string;
  previewState: LoadState;
  rawPreview: boolean;
  selectedFile: VaultFile | null;
  canEdit: boolean;
  onEditChange: (value: string) => void;
  onEditCaretApplied: () => void;
  onEditExit: () => void;
  onEditStart: (options?: {
    caretIndex?: number | null;
    origin?: "raw" | "markdown";
  }) => void;
  onToggleRawPreview: () => void;
};

const getRangeOffset = (container: HTMLElement, range: Range) => {
  const offsetRange = document.createRange();
  offsetRange.setStart(container, 0);
  offsetRange.setEnd(range.startContainer, range.startOffset);
  return offsetRange.toString().length;
};

const getSelectionRange = (container: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer)) {
    return null;
  }
  return range;
};

const getRangeFromPoint = (x: number, y: number) => {
  if ("caretRangeFromPoint" in document) {
    return (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null })
      .caretRangeFromPoint?.(x, y) ?? null;
  }
  if ("caretPositionFromPoint" in document) {
    const position = (
      document as Document & {
        caretPositionFromPoint?: (
          x: number,
          y: number,
        ) => { offsetNode: Node; offset: number } | null;
      }
    ).caretPositionFromPoint?.(x, y);
    if (position) {
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
  }
  return null;
};

const getRangeFromEvent = (
  event: MouseEvent<HTMLDivElement>,
  container: HTMLElement,
) => {
  const rangeFromPoint = getRangeFromPoint(event.clientX, event.clientY);
  if (rangeFromPoint && container.contains(rangeFromPoint.startContainer)) {
    return rangeFromPoint;
  }
  return getSelectionRange(container);
};

const mapPlainOffsetToRawIndex = (rawMarkdown: string, plainOffset: number) => {
  if (plainOffset <= 0) {
    return 0;
  }
  let rawIndex = 0;
  let plainIndex = 0;
  let inFence = false;
  let inInlineCode = false;
  let inLinkText = false;
  let inLinkUrl = false;
  let lineStart = true;

  const skipToLineEnd = () => {
    while (rawIndex < rawMarkdown.length && rawMarkdown[rawIndex] !== "\n") {
      rawIndex += 1;
    }
  };

  while (rawIndex < rawMarkdown.length) {
    const char = rawMarkdown[rawIndex];

    if (lineStart && rawMarkdown.startsWith("```", rawIndex)) {
      inFence = !inFence;
      skipToLineEnd();
      continue;
    }

    if (char === "\n") {
      lineStart = true;
      if (plainIndex >= plainOffset) {
        return rawIndex;
      }
      plainIndex += 1;
      rawIndex += 1;
      continue;
    }

    if (lineStart && !inFence) {
      if (char === "#") {
        while (rawMarkdown[rawIndex] === "#") {
          rawIndex += 1;
        }
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
      if (char === ">") {
        rawIndex += 1;
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
      if (
        (char === "-" || char === "*" || char === "+") &&
        rawMarkdown[rawIndex + 1] === " "
      ) {
        rawIndex += 2;
        continue;
      }
      if (char >= "0" && char <= "9") {
        const markerStart = rawIndex;
        while (rawMarkdown[rawIndex] >= "0" && rawMarkdown[rawIndex] <= "9") {
          rawIndex += 1;
        }
        if (
          rawMarkdown[rawIndex] === "." &&
          rawMarkdown[rawIndex + 1] === " "
        ) {
          rawIndex += 2;
          continue;
        }
        rawIndex = markerStart;
      }
    }

    lineStart = false;

    if (!inFence) {
      if (inLinkUrl) {
        if (char === ")") {
          inLinkUrl = false;
        }
        rawIndex += 1;
        continue;
      }
      if (char === "`") {
        inInlineCode = !inInlineCode;
        rawIndex += 1;
        continue;
      }
      if (!inInlineCode && (char === "*" || char === "_")) {
        rawIndex += 1;
        continue;
      }
      if (char === "!" && rawMarkdown[rawIndex + 1] === "[") {
        rawIndex += 1;
        continue;
      }
      if (char === "[") {
        inLinkText = true;
        rawIndex += 1;
        continue;
      }
      if (inLinkText && char === "]") {
        inLinkText = false;
        if (rawMarkdown[rawIndex + 1] === "(") {
          inLinkUrl = true;
          rawIndex += 2;
          continue;
        }
        rawIndex += 1;
        continue;
      }
    }

    if (plainIndex >= plainOffset) {
      return rawIndex;
    }
    plainIndex += 1;
    rawIndex += 1;
  }

  return rawMarkdown.length;
};

const resolveRawCaretIndex = (container: HTMLElement, range: Range | null) => {
  const resolvedRange = range ?? getSelectionRange(container);
  if (!resolvedRange) {
    return null;
  }
  return getRangeOffset(container, resolvedRange);
};

const resolveMarkdownCaretIndex = (
  container: HTMLElement,
  rawMarkdown: string,
  range: Range | null,
) => {
  const resolvedRange = range ?? getSelectionRange(container);
  if (!resolvedRange) {
    return null;
  }
  const plainOffset = getRangeOffset(container, resolvedRange);
  if (rawMarkdown.length === 0) {
    return 0;
  }
  return mapPlainOffsetToRawIndex(rawMarkdown, plainOffset);
};

export const PreviewPanel = ({
  editDraft,
  editError,
  editCaretIndex,
  isEditing,
  emptyPreview,
  preview,
  previewError,
  previewState,
  rawPreview,
  selectedFile,
  canEdit,
  onEditChange,
  onEditCaretApplied,
  onEditExit,
  onEditStart,
  onToggleRawPreview,
}: PreviewPanelProps) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isEditing || !editorRef.current) {
      return;
    }
    const editor = editorRef.current;
    const desiredIndex =
      typeof editCaretIndex === "number" ? editCaretIndex : editor.value.length;
    const nextIndex = Math.max(0, Math.min(desiredIndex, editor.value.length));
    const handle = window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(nextIndex, nextIndex);
      if (typeof editCaretIndex === "number") {
        onEditCaretApplied();
      }
    });
    return () => window.cancelAnimationFrame(handle);
  }, [editCaretIndex, isEditing, onEditCaretApplied]);

  const handlePreviewDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!canEdit || isEditing) {
        return;
      }
      const origin = rawPreview ? "raw" : "markdown";
      let caretIndex = preview.length === 0 ? 0 : null;
      if (previewRef.current) {
        const range = getRangeFromEvent(event, previewRef.current);
        const resolvedIndex = rawPreview
          ? resolveRawCaretIndex(previewRef.current, range)
          : resolveMarkdownCaretIndex(previewRef.current, preview, range);
        if (typeof resolvedIndex === "number") {
          caretIndex = resolvedIndex;
        }
      }
      if (caretIndex === null && preview.length > 0) {
        caretIndex = preview.length;
      }
      onEditStart({ caretIndex, origin });
    },
    [canEdit, isEditing, onEditStart, preview, rawPreview],
  );

  return (
    <section className="panel preview-panel">
      <div className="panel-header">
        <div>
          <h2>Vorschau</h2>
          <p className="muted">
            {selectedFile?.relative_path ?? "Keine Datei ausgewaehlt"}
          </p>
        </div>
        <div className="preview-actions">
          <button
            type="button"
            className={`ghost small ${rawPreview ? "active" : ""}`}
            onClick={onToggleRawPreview}
            aria-pressed={rawPreview}
            disabled={!selectedFile}
          >
            {rawPreview ? "Markdown" : "Rohtext"}
          </button>
          {previewState === "loading" ? <span className="chip">Lade...</span> : null}
        </div>
      </div>
      <div className="panel-body preview-body">
        {previewState === "error" ? (
          <div className="error">{previewError}</div>
        ) : null}
        <div className="preview-content" onDoubleClick={handlePreviewDoubleClick}>
          {isEditing ? (
            <textarea
              ref={editorRef}
              className="preview-editor"
              value={editDraft}
              onChange={(event) => onEditChange(event.target.value)}
              onBlur={onEditExit}
              aria-label="Edit markdown preview"
            />
          ) : preview ? (
            <div
              ref={previewRef}
              className={`preview ${rawPreview ? "raw" : "markdown"}`}
            >
              {rawPreview ? (
                <pre>{preview}</pre>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[[rehypeSanitize, markdownSchema]]}
                  components={{
                    table: ({ node: _node, ...props }) => (
                      <div className="markdown-table">
                        <table {...props} />
                      </div>
                    ),
                  }}
                >
                  {preview}
                </ReactMarkdown>
              )}
            </div>
          ) : (
            <div className="preview placeholder">{emptyPreview}</div>
          )}
        </div>
        {editError ? <div className="error">{editError}</div> : null}
      </div>
    </section>
  );
};
