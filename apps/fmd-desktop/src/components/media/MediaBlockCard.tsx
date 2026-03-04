/**
 * @file apps/fmd-desktop/src/components/media/MediaBlockCard.tsx
 */

import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
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
  defaultMode?: MediaBlockCardMode;
  allowToggle?: boolean;
  className?: string;
};

const buildMediaSizeStyle = (item: MediaItem) => {
  const style: Record<string, string> = {};
  if (typeof item.width === "number" && Number.isFinite(item.width) && item.width > 0) {
    style.maxWidth = `${item.width}px`;
  }
  if (typeof item.height === "number" && Number.isFinite(item.height) && item.height > 0) {
    style.maxHeight = `${item.height}px`;
  }
  return style;
};

export const MediaBlockCard = ({
  item,
  vaultPngAssets,
  vaultPath: _vaultPath,
  defaultMode = "preview",
  allowToggle = true,
  className,
}: MediaBlockCardProps) => {
  const resolvedAsset = useMemo(
    () => resolveMediaPngAsset(item, vaultPngAssets),
    [item, vaultPngAssets],
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
      const imageStyle = buildMediaSizeStyle(item);
      return (
        <figure className="flashcard-media-item image">
          <img
            src={imageSrc}
            alt={item.alt || item.src}
            title={item.title}
            className={`flashcard-media-image fit-${item.fit}`}
            style={imageStyle}
            draggable={false}
          />
          {item.caption?.trim() ? (
            <figcaption className="flashcard-media-caption">{item.caption}</figcaption>
          ) : null}
        </figure>
      );
    }

    if (svgValidation?.sanitized) {
      return (
        <figure className="flashcard-media-item svg">
          <div
            className="flashcard-media-svg-surface"
            style={buildMediaSizeStyle(item)}
            dangerouslySetInnerHTML={{ __html: svgValidation.sanitized }}
          />
          {item.caption?.trim() ? (
            <figcaption className="flashcard-media-caption">{item.caption}</figcaption>
          ) : null}
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
        <pre className="flashcard-code-block language-svg">
          <code>{item.inlineSvg ?? ""}</code>
        </pre>
      </div>
    );
  };

  const classes = ["media-block-card", className].filter(Boolean).join(" ");
  const showSource = mode === "source";

  return (
    <div className={classes}>
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
