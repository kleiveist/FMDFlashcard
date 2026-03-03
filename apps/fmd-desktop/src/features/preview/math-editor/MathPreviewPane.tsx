import { MathBlockRenderer } from "../mathBlocks";

export const MathPreviewPane = ({ latex }: { latex: string }) => (
  <div className="markdown-hybrid-structural-math-preview-pane">
    <div className="markdown-hybrid-structural-math-pane-title">Preview</div>
    <div className="markdown-hybrid-structural-math-preview-viewport">
      <div className="markdown-hybrid-structural-math-preview-card">
        <MathBlockRenderer source={latex} />
      </div>
    </div>
  </div>
);
