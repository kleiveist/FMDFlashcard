/**
 * @file apps/fmd-desktop/src/components/flashcards/SvgPreviewBlock.tsx
 */

import { useEffect, useMemo, useState } from "react";
import { validateSvgMarkup, type SvgValidationResult } from "../../lib/cardMedia";

type SvgPreviewBlockProps = {
  source: string;
  validation?: SvgValidationResult;
  allowToggle?: boolean;
  className?: string;
};

type SvgViewMode = "preview" | "code";

export const SvgPreviewBlock = ({
  source,
  validation,
  allowToggle = true,
  className,
}: SvgPreviewBlockProps) => {
  const resolvedValidation = useMemo(
    () => validation ?? validateSvgMarkup(source),
    [source, validation],
  );
  const isValid = Boolean(resolvedValidation.sanitized);
  const [mode, setMode] = useState<SvgViewMode>(isValid ? "preview" : "code");

  useEffect(() => {
    setMode(isValid ? "preview" : "code");
  }, [isValid, source]);

  const classes = ["svg-preview-block", className].filter(Boolean).join(" ");
  const showPreview = isValid && mode === "preview";
  const canToggle = allowToggle && isValid;

  return (
    <div className={classes}>
      <div className="svg-preview-toolbar">
        {canToggle ? (
          <button
            type="button"
            className="ghost small"
            onClick={() => setMode((current) => (current === "preview" ? "code" : "preview"))}
          >
            {showPreview ? "Code" : "Preview"}
          </button>
        ) : null}
        {!isValid ? (
          <span className="svg-preview-badge" title={resolvedValidation.invalidReason}>
            SVG invalid
          </span>
        ) : null}
      </div>
      {showPreview && resolvedValidation.sanitized ? (
        <div
          className="svg-preview-surface"
          dangerouslySetInnerHTML={{ __html: resolvedValidation.sanitized }}
        />
      ) : (
        <pre className="flashcard-code-block language-svg">
          <code>{source}</code>
        </pre>
      )}
    </div>
  );
};
