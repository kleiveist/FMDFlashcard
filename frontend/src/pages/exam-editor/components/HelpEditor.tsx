/**
 * @file frontend/src/pages/exam-editor/components/HelpEditor.tsx
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { SvgPreviewBlock } from "../../../components/flashcards/SvgPreviewBlock";
import { extractSvgCodeBlockSource } from "../../../components/markdownSvg";
import { MarkdownHighlightedPre } from "../../../components/MarkdownHighlightedPre";
import { AutoGrowTextarea } from "./AutoGrowTextarea";

type HelpEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showPreviewToggle?: boolean;
};

export const HelpEditor = ({
  label,
  value,
  onChange,
  showPreviewToggle = false,
}: HelpEditorProps) => {
  const [showPreview, setShowPreview] = useState(false);
  const hasContent = value.trim().length > 0;

  return (
    <div className="help-editor">
      <div className="help-editor-header">
        <span className="label">{label}</span>
        <div className="help-editor-actions">
          {showPreviewToggle ? (
            <button
              type="button"
              className="ghost small"
              onClick={() => setShowPreview((prev) => !prev)}
              disabled={!hasContent}
            >
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
          ) : null}
          <button
            type="button"
            className="ghost small"
            onClick={() => onChange("")}
            disabled={!hasContent}
          >
            Remove
          </button>
        </div>
      </div>
      <AutoGrowTextarea
        className="text-input exam-textarea"
        rows={4}
        value={value}
        placeholder="Write a markdown hint for this scope..."
        onChange={onChange}
      />
      {showPreviewToggle && showPreview && hasContent ? (
        <div className="help-preview">
          <ReactMarkdown
            components={{
              pre: ({ node: _node, children, ...props }) => {
                const svgSource = extractSvgCodeBlockSource(children);
                if (svgSource !== null) {
                  return <SvgPreviewBlock source={svgSource} className="md-svg-preview-block" />;
                }
                return <MarkdownHighlightedPre {...props}>{children}</MarkdownHighlightedPre>;
              },
            }}
          >
            {value}
          </ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
};
