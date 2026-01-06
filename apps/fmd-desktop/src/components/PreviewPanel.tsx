import { useCallback, useEffect, useRef } from "react";
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
  isSaving: boolean;
  emptyPreview: string;
  preview: string;
  previewError: string;
  previewState: LoadState;
  rawPreview: boolean;
  selectedFile: VaultFile | null;
  canEdit: boolean;
  onEditCancel: () => void;
  onEditChange: (value: string) => void;
  onEditCaretApplied: () => void;
  onEditSave: () => void;
  onEditStart: (options?: {
    caretIndex?: number | null;
    origin?: "raw" | "markdown";
  }) => void;
  setRawPreview: (value: boolean | ((prev: boolean) => boolean)) => void;
};

const BLOCK_SELECTOR =
  "p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, code, td, th";

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

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

const findTextMatch = (raw: string, text: string) => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return null;
  }
  const directIndex = raw.indexOf(normalized);
  if (directIndex !== -1) {
    return directIndex;
  }
  const words = normalized.split(" ");
  for (const word of words) {
    if (!word) {
      continue;
    }
    const wordIndex = raw.indexOf(word);
    if (wordIndex !== -1) {
      return wordIndex;
    }
  }
  return null;
};

const resolveRawCaretIndex = (container: HTMLElement) => {
  const range = getSelectionRange(container);
  if (!range) {
    return null;
  }
  return getRangeOffset(container, range);
};

const resolveMarkdownCaretIndex = (
  container: HTMLElement,
  rawMarkdown: string,
) => {
  const range = getSelectionRange(container);
  if (!range) {
    return null;
  }
  const selection = window.getSelection();
  const selectionText = selection ? normalizeWhitespace(selection.toString()) : "";
  const anchorElement =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;
  const blockElement = anchorElement?.closest(BLOCK_SELECTOR) ?? container;
  const blockText = normalizeWhitespace(blockElement.textContent ?? "");
  if (blockText) {
    const blockIndex = rawMarkdown.indexOf(blockText);
    if (blockIndex !== -1) {
      const blockOffset = getRangeOffset(blockElement, range);
      return blockIndex + Math.min(blockOffset, blockText.length);
    }
  }
  if (selectionText) {
    const selectionIndex = rawMarkdown.indexOf(selectionText);
    if (selectionIndex !== -1) {
      return selectionIndex;
    }
  }
  const fallbackIndex = findTextMatch(rawMarkdown, blockText || selectionText);
  if (fallbackIndex !== null) {
    return fallbackIndex;
  }
  return null;
};

export const PreviewPanel = ({
  editDraft,
  editError,
  editCaretIndex,
  isEditing,
  isSaving,
  emptyPreview,
  preview,
  previewError,
  previewState,
  rawPreview,
  selectedFile,
  canEdit,
  onEditCancel,
  onEditChange,
  onEditCaretApplied,
  onEditSave,
  onEditStart,
  setRawPreview,
}: PreviewPanelProps) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isEditing || editCaretIndex === null || !editorRef.current) {
      return;
    }
    const editor = editorRef.current;
    const nextIndex = Math.max(
      0,
      Math.min(editCaretIndex, editor.value.length),
    );
    const handle = window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(nextIndex, nextIndex);
      onEditCaretApplied();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [editCaretIndex, isEditing, onEditCaretApplied]);

  const handlePreviewDoubleClick = useCallback(() => {
    if (!canEdit || isEditing) {
      return;
    }
    const origin = rawPreview ? "raw" : "markdown";
    let caretIndex = preview.length === 0 ? 0 : null;
    if (previewRef.current) {
      const resolvedIndex = rawPreview
        ? resolveRawCaretIndex(previewRef.current)
        : resolveMarkdownCaretIndex(previewRef.current, preview);
      if (typeof resolvedIndex === "number") {
        caretIndex = resolvedIndex;
      }
    }
    onEditStart({ caretIndex, origin });
  }, [canEdit, isEditing, onEditStart, preview, rawPreview]);

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
            onClick={() => setRawPreview((prev) => !prev)}
            aria-pressed={rawPreview}
            disabled={!selectedFile || isEditing}
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
        {selectedFile ? (
          <div className="preview-edit-actions">
            {isEditing ? (
              <>
                <button
                  type="button"
                  className="primary small preview-edit-button"
                  onClick={onEditSave}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="ghost small preview-edit-button"
                  onClick={onEditCancel}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="primary small preview-edit-button"
                onClick={() =>
                  onEditStart({
                    origin: rawPreview ? "raw" : "markdown",
                  })
                }
                disabled={!canEdit}
              >
                Edit
              </button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
};
