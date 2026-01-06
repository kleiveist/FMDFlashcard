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
  onEditSave: () => void;
  onEditStart: () => void;
  setRawPreview: (value: boolean | ((prev: boolean) => boolean)) => void;
};

export const PreviewPanel = ({
  editDraft,
  editError,
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
  onEditSave,
  onEditStart,
  setRawPreview,
}: PreviewPanelProps) => (
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
      {previewState === "error" ? <div className="error">{previewError}</div> : null}
      <div className="preview-content">
        {isEditing ? (
          <textarea
            className="preview-editor"
            value={editDraft}
            onChange={(event) => onEditChange(event.target.value)}
            aria-label="Edit markdown preview"
          />
        ) : preview ? (
          <div className={`preview ${rawPreview ? "raw" : "markdown"}`}>
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
              onClick={onEditStart}
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
