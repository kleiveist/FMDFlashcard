/**
 * @file apps/fmd-desktop/src/components/media/VaultPngPicker.tsx
 */

import type { KeyboardEvent } from "react";
import { useMemo } from "react";
import {
  buildVaultImageCandidates,
  type VaultImageCandidate,
} from "../../lib/cardMedia";
import type { VaultPngAsset } from "../../lib/tree";

type VaultPngPickerProps = {
  assets?: VaultPngAsset[] | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (candidate: VaultImageCandidate) => void;
  highlightedIndex?: number;
  onHighlightedIndexChange?: (index: number) => void;
  selectedRelPath?: string | null;
  className?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  onSearchKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
};

const formatBytes = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export const VaultPngPicker = ({
  assets,
  query,
  onQueryChange,
  onSelect,
  highlightedIndex = -1,
  onHighlightedIndexChange,
  selectedRelPath,
  className,
  searchPlaceholder = "Filter by filename/path",
  emptyLabel = "No PNG files found in this vault.",
  onSearchKeyDown,
}: VaultPngPickerProps) => {
  const candidates = useMemo(() => buildVaultImageCandidates(assets), [assets]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCandidates = useMemo(
    () =>
      normalizedQuery
        ? candidates.filter((candidate) => candidate.searchText.includes(normalizedQuery))
        : candidates,
    [candidates, normalizedQuery],
  );
  const classes = ["vault-png-picker", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <label className="field vault-png-picker-search">
        <span className="label">Select PNG</span>
        <input
          type="search"
          className="text-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder={searchPlaceholder}
        />
      </label>
      <div className="vault-png-picker-list" role="listbox" aria-label="PNG files">
        {filteredCandidates.length === 0 ? (
          <div className="vault-png-picker-empty muted">{emptyLabel}</div>
        ) : (
          filteredCandidates.map((candidate, index) => {
            const isHighlighted = index === highlightedIndex;
            const isSelected = candidate.relPath === (selectedRelPath ?? "");
            const sizeLabel = formatBytes(candidate.sizeBytes);
            return (
              <button
                key={candidate.id}
                type="button"
                className={`vault-png-picker-item${isHighlighted ? " highlighted" : ""}${
                  isSelected ? " selected" : ""
                }`}
                onClick={() => onSelect(candidate)}
                onMouseEnter={() => onHighlightedIndexChange?.(index)}
                role="option"
                aria-selected={isSelected}
              >
                <span className="vault-png-picker-primary">{candidate.displayName}</span>
                <span className="vault-png-picker-secondary">
                  {candidate.folder || "Vault root"}
                </span>
                {sizeLabel ? (
                  <span className="vault-png-picker-meta muted">{sizeLabel}</span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
