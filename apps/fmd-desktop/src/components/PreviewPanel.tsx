import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";

type PreviewPanelProps = {
  emptyPreview: string;
  preview: string;
  previewError: string;
  previewState: LoadState;
  rawPreview: boolean;
  selectedFile: VaultFile | null;
  setRawPreview: (value: boolean | ((prev: boolean) => boolean)) => void;
};

export const PreviewPanel = ({
  emptyPreview,
  preview,
  previewError,
  previewState,
  rawPreview,
  selectedFile,
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
          disabled={!selectedFile}
        >
          {rawPreview ? "Markdown" : "Rohtext"}
        </button>
        {previewState === "loading" ? <span className="chip">Lade...</span> : null}
      </div>
    </div>
    <div className="panel-body">
      {previewState === "error" ? <div className="error">{previewError}</div> : null}
      {preview ? (
        <div className={`preview ${rawPreview ? "raw" : "markdown"}`}>
          {rawPreview ? (
            <pre>{preview}</pre>
          ) : (
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{preview}</ReactMarkdown>
          )}
        </div>
      ) : (
        <div className="preview placeholder">{emptyPreview}</div>
      )}
    </div>
  </section>
);
