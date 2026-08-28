/**
 * @file frontend/src/components/flashcards/FlashcardMediaGroup.tsx
 */

import type { MediaItem } from "../../lib/cardMedia";
import type { VaultPngAsset } from "../../lib/tree";
import { MediaBlockCard } from "../media/MediaBlockCard";

type FlashcardMediaGroupProps = {
  media?: MediaItem[] | null;
  vaultPngAssets?: VaultPngAsset[] | null;
  vaultPath?: string | null;
  sourceRelativePath?: string | null;
  className?: string;
};

export const FlashcardMediaGroup = ({
  media,
  vaultPngAssets,
  vaultPath,
  sourceRelativePath,
  className,
}: FlashcardMediaGroupProps) => {
  if (!media || media.length === 0) {
    return null;
  }

  const classes = ["flashcard-media-group", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      {media.map((item) => (
        <MediaBlockCard
          key={item.id}
          item={item}
          vaultPngAssets={vaultPngAssets}
          vaultPath={vaultPath}
          sourceRelativePath={sourceRelativePath}
          className="flashcard-media-entry"
        />
      ))}
    </div>
  );
};
