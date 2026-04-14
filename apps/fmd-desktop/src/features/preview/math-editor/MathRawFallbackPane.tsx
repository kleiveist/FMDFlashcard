import { useMemo } from "react";
import { importMathLatex } from "./importer";
import { MathPreviewPane } from "./MathPreviewPane";

export const MathRawFallbackPane = ({
  value,
  reason,
  onChange,
}: {
  value: string;
  reason: string | null;
  onChange: (value: string) => void;
}) => {
  const parseState = useMemo(() => importMathLatex(value), [value]);

  return (
    <div className="markdown-hybrid-structural-math-raw-pane">
      <div className="markdown-hybrid-structural-math-pane-title">Raw LaTeX</div>
      <div className="markdown-hybrid-structural-math-raw-layout">
        <div className="markdown-hybrid-structural-math-raw-editor-pane">
          {reason ? (
            <div className="markdown-hybrid-structural-math-raw-reason">
              {reason}
            </div>
          ) : null}
          <textarea
            className="markdown-hybrid-structural-math-raw-textarea"
            data-input-scope="editor"
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            aria-label="Raw LaTeX editor"
          />
          <div className="markdown-hybrid-structural-math-raw-status">
            {parseState.mode === "structured" ? "Structure available" : parseState.reason}
          </div>
        </div>
        <MathPreviewPane latex={value} />
      </div>
    </div>
  );
};
