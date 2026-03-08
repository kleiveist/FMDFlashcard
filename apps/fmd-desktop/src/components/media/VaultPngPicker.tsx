/**
 * @file apps/fmd-desktop/src/components/media/VaultPngPicker.tsx
 */

import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildVaultImageCandidates,
  filterVaultImageCandidates,
  type VaultImageCandidate,
} from "../../lib/cardMedia";
import type { VaultPngAsset } from "../../lib/tree";
import { resolveVaultImageSrc } from "../../lib/vaultAssets";

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

const PICKER_VIEWPORT_HEIGHT = 240;
const PICKER_ROW_HEIGHT = 74;
const PICKER_OVERSCAN = 4;

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

const VaultPngPickerRow = ({
  candidate,
  index,
  isHighlighted,
  isSelected,
  onSelect,
  onHighlight,
}: {
  candidate: VaultImageCandidate;
  index: number;
  isHighlighted: boolean;
  isSelected: boolean;
  onSelect: (candidate: VaultImageCandidate) => void;
  onHighlight: (index: number) => void;
}) => {
  const sizeLabel = formatBytes(candidate.sizeBytes);
  const thumbnailSrc = useMemo(
    () => resolveVaultImageSrc({ absolutePath: candidate.absolutePath }),
    [candidate.absolutePath],
  );

  return (
    <button
      type="button"
      className={`vault-png-picker-item${isHighlighted ? " highlighted" : ""}${
        isSelected ? " selected" : ""
      }`}
      onClick={() => onSelect(candidate)}
      onMouseEnter={() => onHighlight(index)}
      role="option"
      aria-selected={isSelected}
      style={{
        position: "absolute",
        top: index * PICKER_ROW_HEIGHT,
        left: 0,
        right: 0,
        height: PICKER_ROW_HEIGHT - 6,
      }}
    >
      <span className="vault-png-picker-thumb" aria-hidden="true">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ) : (
          <span className="vault-png-picker-thumb-fallback">PNG</span>
        )}
      </span>
      <span className="vault-png-picker-text">
        <span className="vault-png-picker-primary">{candidate.displayName}</span>
        <span className="vault-png-picker-secondary">
          {candidate.folder || "Vault root"}
        </span>
        {sizeLabel ? (
          <span className="vault-png-picker-meta muted">{sizeLabel}</span>
        ) : null}
      </span>
    </button>
  );
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
  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const candidates = useMemo(() => buildVaultImageCandidates(assets), [assets]);
  const filteredCandidates = useMemo(
    () => filterVaultImageCandidates(candidates, query),
    [candidates, query],
  );
  const classes = ["vault-png-picker", className].filter(Boolean).join(" ");
  const visibleCount = Math.ceil(PICKER_VIEWPORT_HEIGHT / PICKER_ROW_HEIGHT);
  const visibleStart = Math.max(0, Math.floor(scrollTop / PICKER_ROW_HEIGHT) - PICKER_OVERSCAN);
  const visibleEnd = Math.min(
    filteredCandidates.length,
    visibleStart + visibleCount + PICKER_OVERSCAN * 2,
  );
  const visibleCandidates = filteredCandidates.slice(visibleStart, visibleEnd);

  useEffect(() => {
    const container = listRef.current;
    if (!container || highlightedIndex < 0) {
      return;
    }
    const itemTop = highlightedIndex * PICKER_ROW_HEIGHT;
    const itemBottom = itemTop + PICKER_ROW_HEIGHT;
    if (itemTop < container.scrollTop) {
      container.scrollTop = itemTop;
      return;
    }
    if (itemBottom > container.scrollTop + PICKER_VIEWPORT_HEIGHT) {
      container.scrollTop = itemBottom - PICKER_VIEWPORT_HEIGHT;
    }
  }, [highlightedIndex]);

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
      <div
        ref={listRef}
        className="vault-png-picker-list"
        role="listbox"
        aria-label="PNG files"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {filteredCandidates.length === 0 ? (
          <div className="vault-png-picker-empty muted">{emptyLabel}</div>
        ) : (
          <div
            className="vault-png-picker-virtual"
            style={{ height: filteredCandidates.length * PICKER_ROW_HEIGHT }}
          >
            {visibleCandidates.map((candidate, visibleIndex) => {
              const index = visibleStart + visibleIndex;
              return (
                <VaultPngPickerRow
                  key={candidate.id}
                  candidate={candidate}
                  index={index}
                  isHighlighted={index === highlightedIndex}
                  isSelected={candidate.relPath === (selectedRelPath ?? "")}
                  onSelect={onSelect}
                  onHighlight={(nextIndex) => onHighlightedIndexChange?.(nextIndex)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
