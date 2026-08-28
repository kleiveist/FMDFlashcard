/**
 * @file frontend/src/components/media/MediaBlockCard.tsx
 */

import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  resolveMediaLabel,
  resolveMediaPngAsset,
  validateSvgMarkup,
  type MediaItem,
} from "../../lib/cardMedia";
import type { VaultPngAsset } from "../../lib/tree";
import { resolveVaultImageSrc } from "../../lib/vaultAssets";

type MediaBlockCardMode = "preview" | "source";

type MediaBlockCardProps = {
  item: MediaItem;
  vaultPngAssets?: VaultPngAsset[] | null;
  vaultPath?: string | null;
  sourceRelativePath?: string | null;
  defaultMode?: MediaBlockCardMode;
  allowToggle?: boolean;
  className?: string;
};

export const MediaBlockCard = ({
  item,
  vaultPngAssets,
  vaultPath: _vaultPath,
  sourceRelativePath,
  defaultMode = "preview",
  allowToggle = false,
  className,
}: MediaBlockCardProps) => {
  const resolvedAsset = useMemo(
    () =>
      resolveMediaPngAsset(item, vaultPngAssets, {
        sourceRelativePath,
      }),
    [item, sourceRelativePath, vaultPngAssets],
  );
  void _vaultPath;
  const imageSrc = useMemo(
    () => (resolvedAsset ? resolveVaultImageSrc({ absolutePath: resolvedAsset.path }) : null),
    [resolvedAsset],
  );
  const svgValidation = useMemo(
    () => (item.type === "svg" ? validateSvgMarkup(item.inlineSvg ?? "") : null),
    [item],
  );
  const preferredMode =
    item.type === "svg" && !(svgValidation?.sanitized ?? null) ? "source" : defaultMode;
  const [mode, setMode] = useState<MediaBlockCardMode>(preferredMode);

  useEffect(() => {
    setMode(preferredMode);
  }, [item.rawBlock, preferredMode]);

  const toggleMode = (
    event?:
      | MouseEvent<HTMLElement>
      | KeyboardEvent<HTMLElement>
      | KeyboardEvent<HTMLInputElement>,
  ) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!allowToggle) {
      return;
    }
    setMode((current) => (current === "preview" ? "source" : "preview"));
  };

  const renderPreview = () => {
    if (item.type === "png") {
      if (!imageSrc) {
        return <div className="flashcard-media-placeholder">Missing image</div>;
      }
      return (
        <figure className="flashcard-media-item image">
          <img
            src={imageSrc}
            alt={resolveMediaLabel(item) ?? item.src}
            className="flashcard-media-image"
            draggable={false}
            loading="lazy"
            decoding="async"
          />
        </figure>
      );
    }

    if (svgValidation?.sanitized) {
      return (
        <figure className="flashcard-media-item svg">
          <div
            className="flashcard-media-svg-surface"
            dangerouslySetInnerHTML={{ __html: svgValidation.sanitized }}
          />
        </figure>
      );
    }

    return (
      <div className="flashcard-media-source-fallback">
        <span
          className="svg-preview-badge"
          title={svgValidation?.invalidReason ?? "SVG invalid"}
        >
          SVG invalid
        </span>
        <pre className="flashcard-code-block media-block-card-source">
          <code>{item.rawBlock}</code>
        </pre>
      </div>
    );
  };

  const classes = ["media-block-card", className].filter(Boolean).join(" ");
  const showSource = mode === "source";
  const showToolbar = allowToggle || (item.type === "svg" && !svgValidation?.sanitized);

  return (
    <div className={classes}>
      {showToolbar ? (
        <div className="media-block-card-toolbar">
          {allowToggle ? (
            <button type="button" className="ghost small" onClick={toggleMode}>
              {showSource ? "Preview" : "Source"}
            </button>
          ) : null}
          {item.type === "svg" && !svgValidation?.sanitized ? (
            <span
              className="svg-preview-badge"
              title={svgValidation?.invalidReason ?? "SVG invalid"}
            >
              SVG invalid
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className={`media-block-card-surface ${showSource ? "is-source" : "is-preview"}`}
        onClick={allowToggle ? toggleMode : undefined}
        role={allowToggle ? "button" : undefined}
        tabIndex={allowToggle ? 0 : -1}
        onKeyDown={
          allowToggle
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  toggleMode(event);
                }
              }
            : undefined
        }
      >
        {showSource ? (
          <pre className="flashcard-code-block media-block-card-source">
            <code>{item.rawBlock}</code>
          </pre>
        ) : (
          renderPreview()
        )}
      </div>
    </div>
  );
};
