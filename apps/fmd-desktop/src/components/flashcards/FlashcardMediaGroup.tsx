/**
 * @file apps/fmd-desktop/src/components/flashcards/FlashcardMediaGroup.tsx
 */

import type { CardMediaItem } from "../../lib/cardMedia";
import { resolveVaultImageSrc } from "../../lib/vaultAssets";
import { SvgPreviewBlock } from "./SvgPreviewBlock";

type FlashcardMediaGroupProps = {
  media?: CardMediaItem[] | null;
  vaultPath?: string | null;
  className?: string;
};

export const FlashcardMediaGroup = ({
  media,
  vaultPath,
  className,
}: FlashcardMediaGroupProps) => {
  if (!media || media.length === 0) {
    return null;
  }

  const classes = ["flashcard-media-group", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      {media.map((item, index) => {
        if (item.kind === "image") {
          const src = resolveVaultImageSrc({
            vaultPath,
            relativePath: item.relativePath,
          });
          if (src) {
            return (
              <div key={`media-${index}`} className="flashcard-media-item image">
                <img
                  src={src}
                  alt={item.relativePath}
                  className="flashcard-media-image"
                  draggable={false}
                />
              </div>
            );
          }
          return (
            <div key={`media-${index}`} className="flashcard-media-placeholder">
              Missing media: {item.relativePath}
            </div>
          );
        }

        if (item.kind === "svg") {
          return (
            <div key={`media-${index}`} className="flashcard-media-item svg">
              <SvgPreviewBlock
                source={item.raw}
                validation={{
                  sanitized: item.sanitized,
                  invalidReason: item.invalidReason,
                }}
                allowToggle={false}
              />
            </div>
          );
        }

        return (
          <div
            key={`media-${index}`}
            className="flashcard-media-placeholder"
            title={item.raw}
          >
            {item.label}
          </div>
        );
      })}
    </div>
  );
};
