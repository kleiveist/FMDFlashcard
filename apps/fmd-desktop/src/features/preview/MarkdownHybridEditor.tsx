/**
 * @file apps/fmd-desktop/src/features/preview/MarkdownHybridEditor.tsx
 *
 * Zweck:
 * - Zeigt Markdown als Blockliste an.
 * - Nur der aktive Block ist als Raw-Textarea editierbar.
 */

import {
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  isSingleLineCommitBlock,
  normalizeHelpBlockSource,
  normalizeHorizontalRuleBlockSource,
  normalizeHorizontalRuleSpacingInMarkdown,
  normalizeOrderedListBlockSource,
  parseMarkdownBlocks,
  replaceMarkdownBlock,
  type MarkdownBlock,
} from "./markdownBlocks";
import {
  canRedoMarkdownHistory,
  canUndoMarkdownHistory,
  createMarkdownHistory,
  redoMarkdownHistory,
  resetMarkdownHistory,
  undoMarkdownHistory,
  pushMarkdownHistory,
  type MarkdownHistoryState,
} from "./markdownHistory";
import {
  getAdvancedInsertTemplateSections,
  type AdvancedInsertTemplateContext,
  type AdvancedInsertTemplateIconId,
} from "./insertTemplates";

export type MarkdownHybridEditorMode = "edit" | "write";

type PendingActivation = {
  index: number;
  caret: "start" | "end";
  selection?: {
    start: number;
    end: number;
  };
};

type BlockSelectionRange = {
  anchorIndex: number;
  focusIndex: number;
};

type BlockSelectionState = {
  anchorIndex: number;
  selectedIndices: number[];
};

type SelectionGestureSource = "right" | "shift-left";

type SelectionGestureState = {
  active: boolean;
  source: SelectionGestureSource;
  anchorIndex: number;
  didDrag: boolean;
  startClientX: number;
  startClientY: number;
};

type SelectionContextMenuState = {
  blockIndex: number;
  x: number;
  y: number;
};

type SelectionMarqueeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type OverlayBlockRect = {
  index: number;
  top: number;
  height: number;
  kind: MarkdownBlock["kind"];
};

type OverlayLayoutState = {
  byIndex: Map<number, OverlayBlockRect>;
  contentPaddingLeft: number;
  contentPaddingRight: number;
};

type InsertMenuCategoryId =
  | "standard-blocks"
  | "structure"
  | "links"
  | "advanced";

type InsertMenuItemId = string;

type InsertMenuState = {
  blockIndex: number;
  insertAbove: boolean;
  phase: "categories" | "items";
  categoryId?: InsertMenuCategoryId;
};

type InsertMenuCategory = {
  id: InsertMenuCategoryId;
  label: string;
  icon?: InsertMenuIconId;
};

type InsertMenuItem = {
  id: InsertMenuItemId;
  label: string;
  template: string;
  description?: string;
  firstPlaceholder?: string;
  icon?: InsertMenuIconId;
};

type InsertMenuIconId =
  | "blocks"
  | "table"
  | "link"
  | "sparkles"
  | "text"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "list-bulleted"
  | "list-ordered"
  | "list-checks"
  | "toggle-list"
  | "code-block"
  | "divider"
  | "quote"
  | "nested-quote"
  | AdvancedInsertTemplateIconId
  | "close";

type MarkdownHybridEditorProps = {
  historyKey: string;
  markdown: string;
  mode: MarkdownHybridEditorMode;
  disabled?: boolean;
  onChange: (value: string) => void;
  onCommit?: (value: string, context: { block: MarkdownBlock }) => void;
  onDirtyChange?: (dirty: boolean) => void;
  renderPreview: (markdown: string) => ReactNode;
};

const INSERT_MENU_CATEGORIES: InsertMenuCategory[] = [
  { id: "standard-blocks", label: "Standard Blocks", icon: "blocks" },
  { id: "structure", label: "Structure", icon: "table" },
  { id: "links", label: "Links", icon: "link" },
  { id: "advanced", label: "Advanced", icon: "sparkles" },
];

const INSERT_MENU_ITEMS_BY_CATEGORY: Record<InsertMenuCategoryId, InsertMenuItem[]> = {
  "standard-blocks": [
    { id: "text", label: "Text", template: "Text", firstPlaceholder: "Text", icon: "text" },
    {
      id: "heading-1",
      label: "Heading 1",
      template: "# Heading text",
      firstPlaceholder: "Heading text",
      icon: "heading-1",
    },
    {
      id: "heading-2",
      label: "Heading 2",
      template: "## Heading text",
      firstPlaceholder: "Heading text",
      icon: "heading-2",
    },
    {
      id: "heading-3",
      label: "Heading 3",
      template: "### Heading text",
      firstPlaceholder: "Heading text",
      icon: "heading-3",
    },
    {
      id: "heading-4",
      label: "Heading 4",
      template: "#### Heading text",
      firstPlaceholder: "Heading text",
      icon: "heading-4",
    },
    {
      id: "bullet-list",
      label: "Bulleted List",
      template: "- List item",
      firstPlaceholder: "List item",
      icon: "list-bulleted",
    },
    {
      id: "ordered-list",
      label: "Numbered List",
      template: "1. List item",
      firstPlaceholder: "List item",
      icon: "list-ordered",
    },
    {
      id: "ordered-list-exam",
      label: "Numbered List (Exam)",
      template: "1) Task text",
      firstPlaceholder: "Task text",
      icon: "list-ordered",
    },
    {
      id: "todo-list",
      label: "To-do List",
      template: "- [ ] Task text",
      firstPlaceholder: "Task text",
      icon: "list-checks",
    },
    {
      id: "toggle-list",
      label: "Toggle List",
      template:
        "<details>\n<summary>Toggle title</summary>\n\nToggle content\n</details>",
      firstPlaceholder: "Toggle title",
      icon: "toggle-list",
    },
    { id: "divider", label: "Divider", template: "---", icon: "divider" },
    {
      id: "quote",
      label: "Quote",
      template: "> Quote text",
      firstPlaceholder: "Quote text",
      icon: "quote",
    },
    {
      id: "nested-quote",
      label: "Nested Quote",
      template: ">> Nested quote text",
      firstPlaceholder: "Nested quote text",
      icon: "nested-quote",
    },
  ],
  structure: [
    {
      id: "code-block-structure",
      label: "Code Block",
      template: "```txt\nCODE HERE\n```",
      firstPlaceholder: "CODE HERE",
      icon: "code-block",
    },
    {
      id: "table",
      label: "Table",
      template: "| Column A | Column B |\n| --- | --- |\n| Value 1 | Value 2 |",
      icon: "table",
      firstPlaceholder: "Column A",
    },
  ],
  links: [
    {
      id: "page-link",
      label: "Link Page",
      template: "[[Page]]",
      firstPlaceholder: "Page",
      icon: "link",
    },
  ],
  advanced: [],
};

const InsertMenuIconGraphic = ({ icon }: { icon: InsertMenuIconId }) => {
  const svgProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (icon) {
    case "blocks":
      return (
        <svg {...svgProps}>
          <rect x="4" y="5" width="7" height="5" rx="1.3" />
          <rect x="13" y="5" width="7" height="5" rx="1.3" />
          <rect x="4" y="14" width="7" height="5" rx="1.3" />
          <rect x="13" y="14" width="7" height="5" rx="1.3" />
        </svg>
      );
    case "table":
      return (
        <svg {...svgProps}>
          <rect x="4" y="5" width="16" height="14" rx="1.5" />
          <line x1="4" y1="10" x2="20" y2="10" />
          <line x1="9.5" y1="5" x2="9.5" y2="19" />
          <line x1="15" y1="5" x2="15" y2="19" />
        </svg>
      );
    case "link":
      return (
        <svg {...svgProps}>
          <path d="M10 14l4-4" />
          <path d="M8 16l-1.5 1.5a3 3 0 0 1-4.2-4.2L6 9.6a3 3 0 0 1 4.2 0" />
          <path d="M16 8l1.5-1.5a3 3 0 1 1 4.2 4.2L18 14.4a3 3 0 0 1-4.2 0" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...svgProps}>
          <path d="M12 4l1.1 3.2L16 8.3l-2.9 1.1L12 12.6l-1.1-3.2L8 8.3l2.9-1.1L12 4z" />
          <path d="M18.5 14.5l0.7 1.9 1.8 0.7-1.8 0.7-0.7 1.9-0.7-1.9-1.8-0.7 1.8-0.7 0.7-1.9z" />
          <path d="M6 13l0.8 2.3L9 16.1l-2.2 0.8L6 19.2l-0.8-2.3L3 16.1l2.2-0.8L6 13z" />
        </svg>
      );
    case "text":
      return (
        <svg {...svgProps}>
          <path d="M5 7h14" />
          <path d="M12 7v10" />
          <path d="M8 17h8" />
        </svg>
      );
    case "heading-1":
    case "heading-2":
    case "heading-3":
    case "heading-4": {
      const headingLevel = icon.slice(icon.length - 1);
      return (
        <svg {...svgProps}>
          <line x1="6" y1="6" x2="6" y2="18" />
          <line x1="11" y1="6" x2="11" y2="18" />
          <line x1="6" y1="12" x2="11" y2="12" />
          <text
            x="15.6"
            y="15.2"
            fill="currentColor"
            stroke="none"
            fontSize="8.5"
            fontWeight="700"
            textAnchor="middle"
          >
            {headingLevel}
          </text>
        </svg>
      );
    }
    case "list-bulleted":
      return (
        <svg {...svgProps}>
          <circle cx="6" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="6" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
          <line x1="10" y1="7.5" x2="19" y2="7.5" />
          <line x1="10" y1="12" x2="19" y2="12" />
          <line x1="10" y1="16.5" x2="19" y2="16.5" />
        </svg>
      );
    case "list-ordered":
      return (
        <svg {...svgProps}>
          <text x="5.5" y="10.1" fill="currentColor" stroke="none" fontSize="6.4" fontWeight="700">
            1.
          </text>
          <text x="5.4" y="17.6" fill="currentColor" stroke="none" fontSize="6.4" fontWeight="700">
            2.
          </text>
          <line x1="10" y1="8.3" x2="19" y2="8.3" />
          <line x1="10" y1="15.8" x2="19" y2="15.8" />
        </svg>
      );
    case "list-checks":
      return (
        <svg {...svgProps}>
          <rect x="4.5" y="5.5" width="4" height="4" rx="0.8" />
          <rect x="4.5" y="14.5" width="4" height="4" rx="0.8" />
          <polyline points="5.3,16.6 6.3,17.6 7.8,15.9" />
          <line x1="11" y1="7.5" x2="19.5" y2="7.5" />
          <line x1="11" y1="16.5" x2="19.5" y2="16.5" />
        </svg>
      );
    case "toggle-list":
      return (
        <svg {...svgProps}>
          <rect x="4" y="4.5" width="16" height="15" rx="2" />
          <polyline points="8,9.5 12,13.5 16,9.5" />
          <line x1="7.5" y1="16.5" x2="16.5" y2="16.5" />
        </svg>
      );
    case "code-block":
      return (
        <svg {...svgProps}>
          <polyline points="8 8 4 12 8 16" />
          <polyline points="16 8 20 12 16 16" />
          <line x1="11" y1="6" x2="13" y2="18" />
        </svg>
      );
    case "divider":
      return (
        <svg {...svgProps}>
          <line x1="4" y1="12" x2="20" y2="12" />
          <circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "quote":
      return (
        <svg {...svgProps}>
          <path d="M8.5 8.5c-1.8 0.7-3 2.2-3 4.4v2.6h4.4v-2.6H8.2c0-1 0.5-1.7 1.5-2.2" />
          <path d="M16.5 8.5c-1.8 0.7-3 2.2-3 4.4v2.6h4.4v-2.6h-1.7c0-1 0.5-1.7 1.5-2.2" />
        </svg>
      );
    case "nested-quote":
      return (
        <svg {...svgProps}>
          <path d="M6 7v10" />
          <path d="M10 9.5c-1.2 0.5-2 1.5-2 3v1.9h3.2v-1.9H10c0-0.7 0.4-1.2 1.1-1.6" />
          <path d="M16 9.5c-1.2 0.5-2 1.5-2 3v1.9h3.2v-1.9H16c0-0.7 0.4-1.2 1.1-1.6" />
        </svg>
      );
    case "advanced-qa":
      return (
        <svg {...svgProps}>
          <text x="6.4" y="10.1" fill="currentColor" stroke="none" fontSize="6.2" fontWeight="700">
            Q
          </text>
          <text x="6.2" y="17.4" fill="currentColor" stroke="none" fontSize="6.2" fontWeight="700">
            A
          </text>
          <line x1="10.5" y1="8.2" x2="19" y2="8.2" />
          <line x1="10.5" y1="15.6" x2="19" y2="15.6" />
        </svg>
      );
    case "advanced-tf":
      return (
        <svg {...svgProps}>
          <circle cx="7" cy="8" r="2.2" />
          <polyline points="5.9,8.1 6.8,9 8.3,6.9" />
          <circle cx="7" cy="16" r="2.2" />
          <line x1="5.6" y1="14.6" x2="8.4" y2="17.4" />
          <line x1="8.4" y1="14.6" x2="5.6" y2="17.4" />
          <line x1="11.5" y1="8" x2="19" y2="8" />
          <line x1="11.5" y1="16" x2="19" y2="16" />
        </svg>
      );
    case "advanced-m1":
      return (
        <svg {...svgProps}>
          <circle cx="6.5" cy="7.5" r="1.8" />
          <circle cx="6.5" cy="12" r="1.8" />
          <circle cx="6.5" cy="16.5" r="1.8" />
          <circle cx="6.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
          <line x1="10.2" y1="7.5" x2="19" y2="7.5" />
          <line x1="10.2" y1="12" x2="19" y2="12" />
          <line x1="10.2" y1="16.5" x2="19" y2="16.5" />
        </svg>
      );
    case "advanced-m2":
      return (
        <svg {...svgProps}>
          <rect x="4.8" y="5.8" width="3.4" height="3.4" rx="0.6" />
          <rect x="4.8" y="10.3" width="3.4" height="3.4" rx="0.6" />
          <rect x="4.8" y="14.8" width="3.4" height="3.4" rx="0.6" />
          <polyline points="5.6,12 6.3,12.8 7.4,11.3" />
          <polyline points="5.6,16.5 6.3,17.3 7.4,15.8" />
          <line x1="10.2" y1="7.5" x2="19" y2="7.5" />
          <line x1="10.2" y1="12" x2="19" y2="12" />
          <line x1="10.2" y1="16.5" x2="19" y2="16.5" />
        </svg>
      );
    case "advanced-cl":
      return (
        <svg {...svgProps}>
          <line x1="4.5" y1="8" x2="8" y2="8" />
          <line x1="16" y1="8" x2="19.5" y2="8" />
          <rect x="8.8" y="6.2" width="6.4" height="3.6" rx="1" strokeDasharray="2 1.5" />
          <text x="11.9" y="17.2" fill="currentColor" stroke="none" fontSize="6.8" fontWeight="700">
            %
          </text>
        </svg>
      );
    case "advanced-cd":
      return (
        <svg {...svgProps}>
          <rect x="4.3" y="6.1" width="6.1" height="3.4" rx="1" />
          <rect x="13.6" y="6.1" width="6.1" height="3.4" rx="1" />
          <rect x="9" y="14.4" width="6.1" height="3.4" rx="1" />
          <path d="M10.4 8.1h2.8" />
          <polyline points="12.2,7 13.4,8.1 12.2,9.2" />
        </svg>
      );
    case "advanced-cld":
      return (
        <svg {...svgProps}>
          <rect x="5" y="5.6" width="5.6" height="3.4" rx="0.9" strokeDasharray="2 1.3" />
          <rect x="13.4" y="5.6" width="5.6" height="3.4" rx="0.9" />
          <text x="7.8" y="17.2" fill="currentColor" stroke="none" fontSize="6.4" fontWeight="700">
            %
          </text>
          <path d="M11 14.6h5.2" />
          <polyline points="15,13.5 16.2,14.6 15,15.7" />
        </svg>
      );
    case "close":
      return (
        <svg {...svgProps}>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      );
    default:
      return null;
  }
};

const renderInsertMenuRowContent = ({
  label,
  description,
  icon,
}: {
  label: string;
  description?: string;
  icon?: InsertMenuIconId;
}) => (
  <>
    {icon ? (
      <span
        className="markdown-hybrid-insert-menu-item-icon"
        aria-hidden="true"
        data-md-insert-menu-icon={icon}
      >
        <InsertMenuIconGraphic icon={icon} />
      </span>
    ) : null}
    <span className="markdown-hybrid-insert-menu-item-content">
      <span className="markdown-hybrid-insert-menu-item-label">{label}</span>
      {description ? (
        <span className="markdown-hybrid-insert-menu-item-description">{description}</span>
      ) : null}
    </span>
  </>
);

const isUndoShortcut = (event: KeyboardEvent<HTMLElement>) =>
  !event.shiftKey &&
  (event.metaKey || event.ctrlKey) &&
  !event.altKey &&
  event.key.toLowerCase() === "z";

const isRedoShortcut = (event: KeyboardEvent<HTMLElement>) =>
  (event.metaKey || event.ctrlKey) &&
  !event.altKey &&
  ((event.shiftKey && event.key.toLowerCase() === "z") ||
    (!event.metaKey && event.key.toLowerCase() === "y"));

const isDeleteRangeShortcut = (event: KeyboardEvent<HTMLElement>) =>
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  (event.key === "Delete" || event.key === "Backspace");

const clampIndex = (value: number, maxExclusive: number) => {
  if (maxExclusive <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(value, maxExclusive - 1));
};

const OVERLAY_LEFT_GUTTER_WIDTH = 56;
const OVERLAY_RIGHT_GUTTER_WIDTH = 34;

const findScrollableAncestor = (element: HTMLElement | null) => {
  let current = element?.parentElement ?? null;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY || style.overflow;
    if (/(auto|scroll|overlay)/.test(overflowY) && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

const areOverlayLayoutsEqual = (left: OverlayLayoutState, right: OverlayLayoutState) => {
  if (
    left.contentPaddingLeft !== right.contentPaddingLeft ||
    left.contentPaddingRight !== right.contentPaddingRight ||
    left.byIndex.size !== right.byIndex.size
  ) {
    return false;
  }
  for (const [index, leftRect] of left.byIndex) {
    const rightRect = right.byIndex.get(index);
    if (!rightRect) {
      return false;
    }
    if (
      leftRect.kind !== rightRect.kind ||
      leftRect.top !== rightRect.top ||
      leftRect.height !== rightRect.height
    ) {
      return false;
    }
  }
  return true;
};

const normalizeBlockSelectionRange = (range: BlockSelectionRange) => ({
  start: Math.min(range.anchorIndex, range.focusIndex),
  end: Math.max(range.anchorIndex, range.focusIndex),
});

const createSelectionIndexRange = (anchorIndex: number, focusIndex: number) => {
  const normalized = normalizeBlockSelectionRange({ anchorIndex, focusIndex });
  const indices: number[] = [];
  for (let index = normalized.start; index <= normalized.end; index += 1) {
    indices.push(index);
  }
  return indices;
};

const sortUniqueSelectionIndices = (indices: number[]) =>
  Array.from(new Set(indices)).sort((a, b) => a - b);

const isBlockIndexSelected = (selection: BlockSelectionState | null, index: number) => {
  if (!selection) {
    return false;
  }
  return selection.selectedIndices.includes(index);
};

const selectionToContiguousRanges = (selection: BlockSelectionState) => {
  const indices = sortUniqueSelectionIndices(selection.selectedIndices);
  if (indices.length === 0) {
    return [] as BlockSelectionRange[];
  }

  const ranges: BlockSelectionRange[] = [];
  let start = indices[0]!;
  let previous = indices[0]!;

  for (let i = 1; i < indices.length; i += 1) {
    const current = indices[i]!;
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    ranges.push({ anchorIndex: start, focusIndex: previous });
    start = current;
    previous = current;
  }

  ranges.push({ anchorIndex: start, focusIndex: previous });
  return ranges;
};

const deleteMarkdownBlockRange = (
  sourceMarkdown: string,
  blocks: MarkdownBlock[],
  range: BlockSelectionRange,
) => {
  if (blocks.length === 0) {
    return sourceMarkdown;
  }
  const normalized = normalizeBlockSelectionRange(range);
  const firstBlock = blocks[normalized.start];
  const lastBlock = blocks[normalized.end];
  if (!firstBlock || !lastBlock) {
    return sourceMarkdown;
  }

  let removeStart = firstBlock.startOffset;
  let removeEnd = lastBlock.endOffset;

  if (sourceMarkdown[removeEnd] === "\n") {
    removeEnd += 1;
  } else if (removeStart > 0 && sourceMarkdown[removeStart - 1] === "\n") {
    removeStart -= 1;
  }

  return `${sourceMarkdown.slice(0, removeStart)}${sourceMarkdown.slice(removeEnd)}`;
};

const deleteMarkdownBlockSelection = (
  sourceMarkdown: string,
  blocks: MarkdownBlock[],
  selection: BlockSelectionState,
) => {
  const ranges = selectionToContiguousRanges(selection);
  if (ranges.length === 0) {
    return sourceMarkdown;
  }

  let nextMarkdown = sourceMarkdown;
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const nextRange = ranges[i];
    if (!nextRange) {
      continue;
    }
    nextMarkdown = deleteMarkdownBlockRange(nextMarkdown, blocks, nextRange);
  }
  return nextMarkdown;
};

const serializeMarkdownFromBlocks = (blocks: Pick<MarkdownBlock, "raw">[]) =>
  blocks.map((block) => block.raw).join("\n");

const moveBlockInList = <T,>(items: T[], fromIndex: number, toSlotIndex: number) => {
  if (fromIndex < 0 || fromIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (typeof moved === "undefined") {
    return items;
  }
  let insertIndex = Math.max(0, Math.min(toSlotIndex, items.length));
  if (insertIndex > fromIndex) {
    insertIndex -= 1;
  }
  next.splice(insertIndex, 0, moved);
  return next;
};

const moveBlockSelectionInList = <T,>(
  items: T[],
  selectedIndices: number[],
  toSlotIndex: number,
) => {
  if (items.length === 0) {
    return { items, insertIndex: 0, movedIndices: [] as number[] };
  }
  const normalizedSelected = sortUniqueSelectionIndices(
    selectedIndices.filter((index) => index >= 0 && index < items.length),
  );
  if (normalizedSelected.length === 0) {
    return { items, insertIndex: 0, movedIndices: [] as number[] };
  }
  if (normalizedSelected.length === 1) {
    const [singleIndex] = normalizedSelected;
    const nextItems = moveBlockInList(items, singleIndex!, toSlotIndex);
    const normalizedToSlot = Math.max(0, Math.min(toSlotIndex, items.length));
    const insertIndex = normalizedToSlot > singleIndex! ? normalizedToSlot - 1 : normalizedToSlot;
    return {
      items: nextItems,
      insertIndex: Math.max(0, Math.min(insertIndex, nextItems.length - 1)),
      movedIndices: [Math.max(0, Math.min(insertIndex, nextItems.length - 1))],
    };
  }

  const selectedSet = new Set(normalizedSelected);
  const movingItems = normalizedSelected.map((index) => items[index]!).filter((item) => item !== undefined);
  if (movingItems.length === 0) {
    return { items, insertIndex: 0, movedIndices: [] as number[] };
  }
  const remainingItems = items.filter((_item, index) => !selectedSet.has(index));
  const normalizedToSlot = Math.max(0, Math.min(toSlotIndex, items.length));
  const removedBeforeSlot = normalizedSelected.filter((index) => index < normalizedToSlot).length;
  const rawInsertIndex = normalizedToSlot - removedBeforeSlot;
  const insertIndex = Math.max(0, Math.min(rawInsertIndex, remainingItems.length));
  const nextItems = [...remainingItems];
  nextItems.splice(insertIndex, 0, ...movingItems);
  const movedIndices = movingItems.map((_item, offset) => insertIndex + offset);
  return { items: nextItems, insertIndex, movedIndices };
};

const withInsertedRawBlock = (
  blocks: MarkdownBlock[],
  atIndex: number,
  insertedRaw: string,
) => {
  const nextRawBlocks = blocks.map((block) => block.raw);
  const targetIndex = Math.max(0, Math.min(atIndex, nextRawBlocks.length));
  if (insertedRaw.trim().length === 0) {
    nextRawBlocks.splice(targetIndex, 0, "");
    return nextRawBlocks.join("\n");
  }
  const insertionParts: string[] = [];
  const previousRaw = nextRawBlocks[targetIndex - 1] ?? null;
  const nextRaw = nextRawBlocks[targetIndex] ?? null;
  const previousIsBlank = previousRaw !== null && previousRaw.trim() === "";
  const nextIsBlank = nextRaw !== null && nextRaw.trim() === "";

  if (previousRaw !== null && !previousIsBlank) {
    insertionParts.push("");
  }
  insertionParts.push(insertedRaw);
  if (nextRaw !== null && !nextIsBlank) {
    insertionParts.push("");
  }

  nextRawBlocks.splice(targetIndex, 0, ...insertionParts);
  return nextRawBlocks.join("\n");
};

const isStandaloneDirectiveLine = (line: string, directive: string) =>
  line.trim().toLowerCase() === directive;

const resolveInsertMenuContextForSlot = (
  markdown: string,
  blocks: MarkdownBlock[],
  atIndex: number,
): AdvancedInsertTemplateContext => {
  const normalizedAtIndex = Math.max(0, Math.min(atIndex, blocks.length));
  const insertionOffset = normalizedAtIndex >= blocks.length
    ? markdown.length
    : (blocks[normalizedAtIndex]?.startOffset ?? markdown.length);
  const textBeforeSlot = markdown.slice(0, insertionOffset);
  const lines = textBeforeSlot.length === 0 ? [] : textBeforeSlot.split("\n");

  let openCardDepth = 0;
  let openExamDepth = 0;
  for (const line of lines) {
    if (isStandaloneDirectiveLine(line, "#card")) {
      openCardDepth += 1;
      continue;
    }
    if (isStandaloneDirectiveLine(line, "#endcard")) {
      openCardDepth = Math.max(0, openCardDepth - 1);
      continue;
    }
    if (isStandaloneDirectiveLine(line, "#exam")) {
      openExamDepth += 1;
      continue;
    }
    if (isStandaloneDirectiveLine(line, "#endexam")) {
      openExamDepth = Math.max(0, openExamDepth - 1);
    }
  }

  return {
    insideCard: openCardDepth > 0,
    insideExam: openExamDepth > 0,
  };
};

type StableRenderKeyToken = {
  key: string;
  signature: string;
};

// Content-derived signatures remount active block editors on each keystroke and
// can trigger blur/exit loops. Use a structural block identity instead.
const getBlockSignature = (block: MarkdownBlock) => block.id;

const assignStableRenderKeys = (
  blocks: MarkdownBlock[],
  previousTokens: StableRenderKeyToken[],
  nextCounter: { current: number },
  activeBlockIndex?: number | null,
) => {
  const nextTokens: StableRenderKeyToken[] = [];
  const usedPrevIndices = new Set<number>();
  const keys: string[] = [];

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex]!;
    const signature = getBlockSignature(block);
    let matchedPrevIndex = -1;

    // Pin the active editor row to its previous render key so content/kind changes
    // (e.g. blank -> paragraph -> heading while typing "# ") do not remount the textarea.
    if (
      typeof activeBlockIndex === "number" &&
      blockIndex === activeBlockIndex &&
      blockIndex >= 0 &&
      blockIndex < previousTokens.length &&
      !usedPrevIndices.has(blockIndex)
    ) {
      matchedPrevIndex = blockIndex;
    }

    for (let i = 0; i < previousTokens.length; i += 1) {
      if (matchedPrevIndex >= 0) {
        break;
      }
      if (usedPrevIndices.has(i)) {
        continue;
      }
      if ((previousTokens[i]?.signature ?? "") === signature) {
        matchedPrevIndex = i;
        break;
      }
    }

    if (matchedPrevIndex >= 0) {
      usedPrevIndices.add(matchedPrevIndex);
      const token = previousTokens[matchedPrevIndex]!;
      nextTokens.push({ key: token.key, signature });
      keys.push(token.key);
      continue;
    }

    nextCounter.current += 1;
    const key = `mdh-block-${nextCounter.current}`;
    nextTokens.push({ key, signature });
    keys.push(key);
  }

  return { keys, tokens: nextTokens };
};

const orderedListLikeLinePattern = /^\s*\d+(?:\.|\)|\.\))\s+\S/;
const unorderedListLikeLinePattern = /^\s*[-+*]\s+\S/;
const indentedContinuationLinePattern = /^(?:\s{2,}\S|\t+\S)/;
const editorOrderedListLinePattern = /^(\s*)(\d+)(\.|\)|\.\))(\s+)(.*)$/;
const editorTaskListLinePattern = /^(\s*)([-+*])(\s+\[[ xX]\])(\s+)(.*)$/;
const editorUnorderedListLinePattern = /^(\s*)([-+*])(\s+)(.*)$/;
const editorListContinuationLinePattern = /^(\s{2,}|\t+)(.*)$/;
const markdownTaskListLinePattern = /^(\s*[-+*]\s+\[)([ xX])(\])(.*)$/;

type EditorListLineInfo =
  | {
    kind: "ordered";
    indent: string;
    spacing: string;
    content: string;
    prefixLength: number;
    orderedNumber: number;
    orderedDelimiter: "." | ")";
  }
  | {
    kind: "task";
    indent: string;
    spacing: string;
    content: string;
    prefixLength: number;
    bullet: "-" | "+" | "*";
  }
  | {
    kind: "unordered";
    indent: string;
    spacing: string;
    content: string;
    prefixLength: number;
    bullet: "-" | "+" | "*";
  };

type LineRange = {
  start: number;
  end: number;
  lineIndex: number;
  line: string;
};

const parseEditorListLine = (line: string): EditorListLineInfo | null => {
  const taskMatch = line.match(editorTaskListLinePattern);
  if (taskMatch) {
    const indent = taskMatch[1] ?? "";
    const bullet = ((taskMatch[2] ?? "-") as "-" | "+" | "*");
    const taskMarker = taskMatch[3] ?? " [ ]";
    const spacing = taskMatch[4] ?? " ";
    const content = taskMatch[5] ?? "";
    return {
      kind: "task",
      indent,
      bullet,
      spacing,
      content,
      prefixLength: indent.length + bullet.length + taskMarker.length + spacing.length,
    };
  }

  const orderedMatch = line.match(editorOrderedListLinePattern);
  if (orderedMatch) {
    const indent = orderedMatch[1] ?? "";
    const numberRaw = orderedMatch[2] ?? "1";
    const delimiterRaw = orderedMatch[3] ?? ".";
    const spacing = orderedMatch[4] ?? " ";
    const content = orderedMatch[5] ?? "";
    return {
      kind: "ordered",
      indent,
      spacing,
      content,
      prefixLength: indent.length + numberRaw.length + delimiterRaw.length + spacing.length,
      orderedNumber: Number.parseInt(numberRaw, 10) || 1,
      orderedDelimiter: delimiterRaw === "." ? "." : ")",
    };
  }

  const unorderedMatch = line.match(editorUnorderedListLinePattern);
  if (unorderedMatch) {
    const indent = unorderedMatch[1] ?? "";
    const bullet = ((unorderedMatch[2] ?? "-") as "-" | "+" | "*");
    const spacing = unorderedMatch[3] ?? " ";
    const content = unorderedMatch[4] ?? "";
    return {
      kind: "unordered",
      indent,
      bullet,
      spacing,
      content,
      prefixLength: indent.length + bullet.length + spacing.length,
    };
  }

  return null;
};

const getLineRangeAtOffset = (value: string, offset: number): LineRange => {
  const safeOffset = Math.max(0, Math.min(offset, value.length));
  let lineStart = safeOffset;
  while (lineStart > 0 && value[lineStart - 1] !== "\n") {
    lineStart -= 1;
  }
  let lineEnd = safeOffset;
  while (lineEnd < value.length && value[lineEnd] !== "\n") {
    lineEnd += 1;
  }
  let lineIndex = 0;
  for (let i = 0; i < lineStart; i += 1) {
    if (value[i] === "\n") {
      lineIndex += 1;
    }
  }
  return {
    start: lineStart,
    end: lineEnd,
    lineIndex,
    line: value.slice(lineStart, lineEnd),
  };
};

const getLineStartOffsetByIndex = (lines: string[], targetIndex: number) => {
  let offset = 0;
  for (let i = 0; i < targetIndex; i += 1) {
    offset += (lines[i] ?? "").length + 1;
  }
  return offset;
};

const toggleTaskCheckboxInBlockRaw = (
  blockRaw: string,
  checkboxIndex: number,
  nextChecked: boolean,
) => {
  if (!blockRaw || checkboxIndex < 0) {
    return blockRaw;
  }
  const lines = blockRaw.split("\n");
  let taskLineIndex = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const taskMatch = line.match(markdownTaskListLinePattern);
    if (!taskMatch) {
      continue;
    }
    if (taskLineIndex !== checkboxIndex) {
      taskLineIndex += 1;
      continue;
    }
    lines[i] = `${taskMatch[1] ?? ""}${nextChecked ? "x" : " "}${taskMatch[3] ?? "]"}${
      taskMatch[4] ?? ""
    }`;
    return lines.join("\n");
  }

  return blockRaw;
};

const buildNextListLinePrefixFromInfo = (listLineInfo: EditorListLineInfo) => {
  if (listLineInfo.kind === "ordered") {
    return `${listLineInfo.indent}${listLineInfo.orderedNumber + 1}${listLineInfo.orderedDelimiter}${listLineInfo.spacing}`;
  }
  if (listLineInfo.kind === "task") {
    return `${listLineInfo.indent}${listLineInfo.bullet} [ ]${listLineInfo.spacing}`;
  }
  return `${listLineInfo.indent}${listLineInfo.bullet}${listLineInfo.spacing}`;
};

const isTextLikeBlockKind = (kind: MarkdownBlock["kind"]) =>
  kind === "paragraph" || kind === "heading" || kind === "blockquote";

const isStructuralSeparatorBlankBlock = (blocks: MarkdownBlock[], index: number) => {
  const block = blocks[index];
  if (!block || block.kind !== "blank") {
    return false;
  }
  const previous = blocks[index - 1];
  const next = blocks[index + 1];
  if (!previous || !next) {
    return false;
  }
  return isTextLikeBlockKind(previous.kind) && isTextLikeBlockKind(next.kind);
};

const needsHelpEndPreviewSeparator = (line: string) =>
  orderedListLikeLinePattern.test(line) ||
  unorderedListLikeLinePattern.test(line) ||
  indentedContinuationLinePattern.test(line);

const normalizeHelpBlockPreviewSource = (blockRaw: string) => {
  const normalized = normalizeHelpBlockSource(blockRaw);
  if (!normalized) {
    return normalized;
  }

  const lines = normalized.split("\n");
  const previewLines: string[] = [];

  for (const line of lines) {
    if (line !== "#helpend") {
      previewLines.push(line);
      continue;
    }

    const previousLine = previewLines[previewLines.length - 1] ?? "";
    // Preview-only: break out of markdown list parsing before "#helpend"
    // without changing the persisted source formatting.
    if (previousLine && needsHelpEndPreviewSeparator(previousLine)) {
      previewLines.push("");
    }
    previewLines.push(line);
  }

  return previewLines.join("\n");
};

const isUnderscoreRuleLikeLine = (line: string) =>
  /^\s{0,3}(?:_\s*){3,}$/.test(line);

const isUnsupportedHeadingLine = (line: string) =>
  /^\s{0,3}#{5,6}(?:\s+|$)/.test(line);

const encodeHashesAsEntities = (hashes: string) => hashes.split("#").join("&#35;");

const escapeHybridPreviewSpecialLines = (source: string) =>
  source
    .split("\n")
    .map((line) => {
      if (isUnderscoreRuleLikeLine(line)) {
        return line.replace(/_/g, "\\_");
      }
      if (isUnsupportedHeadingLine(line)) {
        return line.replace(
          /^(\s{0,3})(#{5,6})/,
          (_match, indent: string, hashes: string) => `${indent}${encodeHashesAsEntities(hashes)}`,
        );
      }
      return line;
    })
    .join("\n");

type EditorInlineSyntaxKind = "hash-tag" | "cloze" | "quoted-token";

const editorInlineSyntaxPattern = /#[A-Za-z0-9_-]+\b|%[^%\n]+%|"[^"\n]+"/g;

const resolveEditorInlineSyntaxKind = (token: string): EditorInlineSyntaxKind | null => {
  if (/^#[A-Za-z0-9_-]+\b/.test(token)) {
    return "hash-tag";
  }
  if (/^%[^%\n]+%$/.test(token)) {
    return "cloze";
  }
  if (/^"[^"\n]+"$/.test(token)) {
    return "quoted-token";
  }
  return null;
};

const renderEditorInlineSyntaxSegments = (text: string, keyPrefix: string) => {
  if (!text) {
    editorInlineSyntaxPattern.lastIndex = 0;
    return null;
  }
  if (!editorInlineSyntaxPattern.test(text)) {
    editorInlineSyntaxPattern.lastIndex = 0;
    return text;
  }
  editorInlineSyntaxPattern.lastIndex = 0;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  let match = editorInlineSyntaxPattern.exec(text);

  while (match) {
    const token = match[0] ?? "";
    const startIndex = match.index;
    const endIndex = startIndex + token.length;
    if (startIndex > lastIndex) {
      parts.push(text.slice(lastIndex, startIndex));
    }
    const kind = resolveEditorInlineSyntaxKind(token);
    if (!kind) {
      parts.push(token);
    } else {
      parts.push(
        <span
          key={`${keyPrefix}-${tokenIndex}`}
          className={`md-inline-syntax md-inline-syntax-${kind}`}
          data-md-inline-syntax={kind}
        >
          {token}
        </span>,
      );
    }
    lastIndex = endIndex;
    tokenIndex += 1;
    match = editorInlineSyntaxPattern.exec(text);
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

const renderEditorInlineSyntaxOverlay = (
  text: string,
  activeSelectionStart: number | null,
) => {
  if (!text) {
    return null;
  }

  let activeLineIndex: number | null = null;
  if (typeof activeSelectionStart === "number") {
    activeLineIndex = getLineRangeAtOffset(text, activeSelectionStart).lineIndex;
  }

  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const lineNode = activeLineIndex === lineIndex
      ? line
      : renderEditorInlineSyntaxSegments(line, `mdh-editor-inline-line-${lineIndex}`);
    nodes.push(lineNode);
    if (lineIndex < lines.length - 1) {
      nodes.push("\n");
    }
  }
  return nodes;
};

type CardBlockPreviewParts = {
  parts: Array<{
    kind: "body" | "help";
    source: string;
  }>;
};

const isCardDirectivePreviewLine = (line: string, directive: "#card" | "#endcard") =>
  line.trim().toLowerCase() === directive;

const isHelpDirectivePreviewLine = (line: string, directive: "#help" | "#helpend") =>
  line.trim().toLowerCase() === directive;

const extractCardBlockPreviewParts = (blockRaw: string): CardBlockPreviewParts => {
  const lines = blockRaw.split("\n");
  if (lines.length === 0 || !isCardDirectivePreviewLine(lines[0] ?? "", "#card")) {
    return {
      parts: [
        {
          kind: "body",
          source: escapeHybridPreviewSpecialLines(blockRaw),
        },
      ],
    };
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (isCardDirectivePreviewLine(lines[i] ?? "", "#endcard")) {
      closingIndex = i;
      break;
    }
  }
  const scanEndExclusive = closingIndex >= 0 ? closingIndex : lines.length;
  const parts: CardBlockPreviewParts["parts"] = [];

  const pushBodyPart = (start: number, endExclusive: number) => {
    if (endExclusive <= start) {
      return;
    }
    const raw = lines.slice(start, endExclusive).join("\n");
    if (raw.length === 0) {
      return;
    }
    parts.push({
      kind: "body",
      source: escapeHybridPreviewSpecialLines(raw),
    });
  };

  let segmentStart = 0;
  for (let i = 1; i < scanEndExclusive; i += 1) {
    if (!isHelpDirectivePreviewLine(lines[i] ?? "", "#help")) {
      continue;
    }

    pushBodyPart(segmentStart, i);

    let helpEndInclusive = i;
    for (let j = i + 1; j < scanEndExclusive; j += 1) {
      helpEndInclusive = j;
      if (isHelpDirectivePreviewLine(lines[j] ?? "", "#helpend")) {
        break;
      }
    }

    const helpRaw = lines.slice(i, helpEndInclusive + 1).join("\n");
    parts.push({
      kind: "help",
      source: escapeHybridPreviewSpecialLines(normalizeHelpBlockPreviewSource(helpRaw)),
    });

    segmentStart = helpEndInclusive + 1;
    i = helpEndInclusive;
  }

  pushBodyPart(segmentStart, lines.length);

  if (parts.length === 0) {
    return {
      parts: [
        {
          kind: "body",
          source: escapeHybridPreviewSpecialLines(blockRaw),
        },
      ],
    };
  }

  return { parts };
};

const extractHorizontalRuleEditorDraft = (blockRaw: string) => {
  const normalized = normalizeHorizontalRuleBlockSource(blockRaw);
  for (const line of normalized.split("\n")) {
    if (line.trim().length > 0) {
      return line;
    }
  }
  return "---";
};

const serializeHorizontalRuleEditorDraft = (draft: string) =>
  normalizeHorizontalRuleBlockSource(draft);

type HeadingEditorPlaceholder = {
  level: number;
  prefix: string;
  label: string;
};

const resolveHeadingEditorPlaceholder = (
  block: Pick<MarkdownBlock, "kind"> | null | undefined,
  draft: string,
): HeadingEditorPlaceholder | null => {
  if (!block || block.kind !== "heading") {
    return null;
  }
  const match = draft.match(/^(\s{0,3})(#{1,6})(\s*)(.*)$/);
  if (!match) {
    return null;
  }
  const indent = match[1] ?? "";
  const hashes = match[2] ?? "";
  const rawSpaces = match[3] ?? "";
  const content = match[4] ?? "";
  if (!hashes || hashes.length > 4) {
    return null;
  }
  if (content.trim().length > 0) {
    return null;
  }
  const spacing = rawSpaces.length > 0 ? rawSpaces : " ";
  return {
    level: hashes.length,
    prefix: `${indent}${hashes}${spacing}`,
    label: `Heading ${hashes.length}`,
  };
};

const normalizeLeadingHeadingSpacing = (
  value: string,
  blockKind: MarkdownBlock["kind"] | null | undefined,
  selectionOffset?: number | null,
) => {
  if (!blockKind || (blockKind !== "blank" && blockKind !== "paragraph" && blockKind !== "heading")) {
    return null;
  }
  const lineRange = typeof selectionOffset === "number"
    ? getLineRangeAtOffset(value, selectionOffset)
    : {
      start: 0,
      end: value.indexOf("\n") >= 0 ? value.indexOf("\n") : value.length,
      line: value.split("\n")[0] ?? "",
    };
  const line = lineRange.line;
  const match = line.match(/^(\s{0,3})(#{1,4})(\S.*)$/);
  if (!match) {
    return null;
  }
  const indent = match[1] ?? "";
  const hashes = match[2] ?? "";
  const remainder = match[3] ?? "";
  if (remainder.length === 0) {
    return null;
  }
  // Single-hash prefixes are used for product directives/tags and must never
  // be auto-normalized (user explicitly requested no auto-space for "#...").
  if (hashes.length === 1) {
    return null;
  }
  if (/^\d/.test(remainder)) {
    return null;
  }
  const normalizedLine = `${indent}${hashes} ${remainder}`;
  if (normalizedLine === line) {
    return null;
  }
  return {
    value: `${value.slice(0, lineRange.start)}${normalizedLine}${value.slice(lineRange.end)}`,
    insertionIndex: lineRange.start + indent.length + hashes.length,
  };
};

const toEditorDraftForBlock = (
  block: Pick<MarkdownBlock, "kind" | "raw">,
) => (block.kind === "hr" ? extractHorizontalRuleEditorDraft(block.raw) : block.raw);

const toPersistedBlockRawForDraft = (
  block: Pick<MarkdownBlock, "kind">,
  draft: string,
) => (block.kind === "hr" ? serializeHorizontalRuleEditorDraft(draft) : draft);

const applyEditorMarkdownNormalization = (value: string) =>
  normalizeHorizontalRuleSpacingInMarkdown(value);

const resolveSessionMarkdown = (
  markdown: string,
  blocks: MarkdownBlock[],
  activeBlockIndex: number | null,
  activeDraft: string,
) => {
  if (activeBlockIndex === null) {
    return markdown;
  }
  const block = blocks[activeBlockIndex];
  if (!block) {
    return markdown;
  }
  const nextBlockRaw = toPersistedBlockRawForDraft(block, activeDraft);
  return replaceMarkdownBlock(markdown, block, nextBlockRaw);
};

export const MarkdownHybridEditor = ({
  historyKey,
  markdown,
  mode,
  disabled = false,
  onChange,
  onCommit,
  onDirtyChange,
  renderPreview,
}: MarkdownHybridEditorProps) => {
  const blocks = useMemo(() => parseMarkdownBlocks(markdown), [markdown]);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [activeDraft, setActiveDraft] = useState("");
  const [activeDirty, setActiveDirty] = useState(false);
  const [history, setHistory] = useState<MarkdownHistoryState>(() =>
    createMarkdownHistory(markdown),
  );
  const [pendingActivation, setPendingActivation] = useState<PendingActivation | null>(
    null,
  );
  const [selectedBlockSelection, setSelectedBlockSelection] = useState<BlockSelectionState | null>(
    null,
  );
  const [isSelectionDragging, setIsSelectionDragging] = useState(false);
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);
  const [insertMenuState, setInsertMenuState] = useState<InsertMenuState | null>(null);
  const [selectionContextMenuState, setSelectionContextMenuState] =
    useState<SelectionContextMenuState | null>(null);
  const [selectionMarqueeRect, setSelectionMarqueeRect] = useState<SelectionMarqueeRect | null>(
    null,
  );
  const [editorOverlaySelectionStart, setEditorOverlaySelectionStart] = useState<number | null>(
    null,
  );
  const [overlayLayout, setOverlayLayout] = useState<OverlayLayoutState>(() => ({
    byIndex: new Map(),
    contentPaddingLeft: OVERLAY_LEFT_GUTTER_WIDTH,
    contentPaddingRight: OVERLAY_RIGHT_GUTTER_WIDTH,
  }));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentLayerRef = useRef<HTMLDivElement | null>(null);
  const insertMenuRef = useRef<HTMLDivElement | null>(null);
  const selectionContextMenuRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorSyntaxOverlayContentRef = useRef<HTMLDivElement | null>(null);
  const pendingCaretRef = useRef<"start" | "end" | null>(null);
  const pendingTextareaSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const autoActivatedWriteKeyRef = useRef<string | null>(null);
  const selectionGestureRef = useRef<SelectionGestureState | null>(null);
  const suppressNextBlockContextMenuRef = useRef(false);
  const overlayMeasureFrameRef = useRef<number | null>(null);
  const overlayScrollContainerRef = useRef<HTMLElement | null>(null);
  const stableBlockRenderTokensRef = useRef<StableRenderKeyToken[]>([]);
  const stableBlockRenderKeyCounterRef = useRef(0);
  const pendingActivationMarkdownRef = useRef<string | null>(null);
  const blockRenderKeys = useMemo(() => {
    const assigned = assignStableRenderKeys(
      blocks,
      stableBlockRenderTokensRef.current,
      stableBlockRenderKeyCounterRef,
      activeBlockIndex,
    );
    stableBlockRenderTokensRef.current = assigned.tokens;
    return assigned.keys;
  }, [activeBlockIndex, blocks]);
  const overlayRows = useMemo(
    () =>
      Array.from(overlayLayout.byIndex.values()).sort((left, right) => left.index - right.index),
    [overlayLayout],
  );
  const editorSurfaceStyle = useMemo<CSSProperties>(
    () =>
      ({
        "--mdh-left-gutter-width": `${overlayLayout.contentPaddingLeft}px`,
        "--mdh-right-gutter-width": `${overlayLayout.contentPaddingRight}px`,
      }) as CSSProperties,
    [overlayLayout.contentPaddingLeft, overlayLayout.contentPaddingRight],
  );
  const activeInsertMenuContext = useMemo<AdvancedInsertTemplateContext>(() => {
    if (!insertMenuState) {
      return { insideCard: false, insideExam: false };
    }
    const targetIndex = insertMenuState.insertAbove
      ? insertMenuState.blockIndex
      : insertMenuState.blockIndex + 1;
    return resolveInsertMenuContextForSlot(markdown, blocks, targetIndex);
  }, [blocks, insertMenuState, markdown]);
  const activeEditorSyntaxOverlayContent = useMemo(
    () => renderEditorInlineSyntaxOverlay(activeDraft, editorOverlaySelectionStart),
    [activeDraft, editorOverlaySelectionStart],
  );

  const measureOverlayLayout = useCallback(() => {
    const surface = containerRef.current;
    const contentLayer = contentLayerRef.current;
    if (!surface || !contentLayer) {
      setOverlayLayout((current) => {
        if (current.byIndex.size === 0) {
          return current;
        }
        return {
          ...current,
          byIndex: new Map(),
        };
      });
      return;
    }

    const surfaceRect = surface.getBoundingClientRect();
    const rowElements = Array.from(
      contentLayer.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
    );
    const nextByIndex = new Map<number, OverlayBlockRect>();

    for (const rowElement of rowElements) {
      const indexRaw = rowElement.dataset.mdBlockIndex;
      const kindRaw = rowElement.dataset.mdBlockKind;
      if (typeof indexRaw !== "string" || typeof kindRaw !== "string") {
        continue;
      }
      const parsedIndex = Number.parseInt(indexRaw, 10);
      if (!Number.isFinite(parsedIndex)) {
        continue;
      }
      const rowRect = rowElement.getBoundingClientRect();
      const top = Math.round((rowRect.top - surfaceRect.top + surface.scrollTop) * 100) / 100;
      const height = Math.max(1, Math.round(rowRect.height * 100) / 100);
      nextByIndex.set(parsedIndex, {
        index: parsedIndex,
        top,
        height,
        kind: kindRaw as MarkdownBlock["kind"],
      });
    }

    const nextLayout: OverlayLayoutState = {
      byIndex: nextByIndex,
      contentPaddingLeft: OVERLAY_LEFT_GUTTER_WIDTH,
      contentPaddingRight: OVERLAY_RIGHT_GUTTER_WIDTH,
    };

    setOverlayLayout((current) => (areOverlayLayoutsEqual(current, nextLayout) ? current : nextLayout));
  }, []);

  const scheduleOverlayLayoutMeasure = useCallback(() => {
    if (overlayMeasureFrameRef.current !== null) {
      return;
    }
    overlayMeasureFrameRef.current = window.requestAnimationFrame(() => {
      overlayMeasureFrameRef.current = null;
      measureOverlayLayout();
    });
  }, [measureOverlayLayout]);

  const getContainerLocalPoint = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) {
      return null;
    }
    const rect = container.getBoundingClientRect();
    return {
      x: clientX - rect.left + container.scrollLeft,
      y: clientY - rect.top + container.scrollTop,
    };
  }, []);

  const setSelectionMarqueeFromClientPoints = useCallback(
    (startClientX: number, startClientY: number, endClientX: number, endClientY: number) => {
      const startPoint = getContainerLocalPoint(startClientX, startClientY);
      const endPoint = getContainerLocalPoint(endClientX, endClientY);
      if (!startPoint || !endPoint) {
        setSelectionMarqueeRect(null);
        return;
      }
      setSelectionMarqueeRect({
        left: Math.min(startPoint.x, endPoint.x),
        top: Math.min(startPoint.y, endPoint.y),
        width: Math.abs(endPoint.x - startPoint.x),
        height: Math.abs(endPoint.y - startPoint.y),
      });
    },
    [getContainerLocalPoint],
  );

  const updateSelectionFromMarqueeClientPoints = useCallback(
    (startClientX: number, startClientY: number, endClientX: number, endClientY: number) => {
      const contentLayer = contentLayerRef.current;
      if (!contentLayer || blocks.length === 0) {
        return;
      }
      const left = Math.min(startClientX, endClientX);
      const right = Math.max(startClientX, endClientX);
      const top = Math.min(startClientY, endClientY);
      const bottom = Math.max(startClientY, endClientY);
      const rowElements = contentLayer.querySelectorAll<HTMLElement>(
        ".markdown-hybrid-block[data-md-block-index]",
      );
      const intersectedIndices: number[] = [];

      for (const rowElement of rowElements) {
        const rowRect = rowElement.getBoundingClientRect();
        if (rowRect.width <= 0 || rowRect.height <= 0) {
          continue;
        }
        const intersects =
          rowRect.right >= left &&
          rowRect.left <= right &&
          rowRect.bottom >= top &&
          rowRect.top <= bottom;
        if (!intersects) {
          continue;
        }
        const indexRaw = rowElement.dataset.mdBlockIndex;
        if (typeof indexRaw !== "string") {
          continue;
        }
        const parsedIndex = Number.parseInt(indexRaw, 10);
        if (!Number.isFinite(parsedIndex)) {
          continue;
        }
        const nextIndex = clampIndex(parsedIndex, blocks.length);
        if (
          blocks[nextIndex]?.kind === "blank" &&
          isStructuralSeparatorBlankBlock(blocks, nextIndex)
        ) {
          continue;
        }
        intersectedIndices.push(nextIndex);
      }

      const selectedIndices = sortUniqueSelectionIndices(intersectedIndices);
      const gestureAnchor = selectionGestureRef.current?.anchorIndex;
      setSelectedBlockSelection((current) => {
        if (selectedIndices.length === 0) {
          return null;
        }
        const nextAnchor = typeof gestureAnchor === "number" && selectedIndices.includes(gestureAnchor)
          ? gestureAnchor
          : (current && selectedIndices.includes(current.anchorIndex)
            ? current.anchorIndex
            : selectedIndices[0]!);
        if (
          current &&
          current.anchorIndex === nextAnchor &&
          current.selectedIndices.length === selectedIndices.length &&
          current.selectedIndices.every((value, index) => value === selectedIndices[index])
        ) {
          return current;
        }
        return {
          anchorIndex: nextAnchor,
          selectedIndices,
        };
      });
    },
    [blocks],
  );

  useEffect(() => {
    onDirtyChange?.(activeDirty);
  }, [activeDirty, onDirtyChange]);

  useEffect(() => {
    setHistory((current) => {
      if (current.present.markdown === markdown) {
        return current;
      }
      if (activeDirty) {
        return current;
      }
      return resetMarkdownHistory(markdown, "external-load");
    });
  }, [activeDirty, markdown]);

  useEffect(() => {
    setActiveBlockIndex(null);
    setActiveDraft("");
    setActiveDirty(false);
    setPendingActivation(null);
    pendingActivationMarkdownRef.current = null;
    setSelectedBlockSelection(null);
    setIsSelectionDragging(false);
    setDraggedBlockIndex(null);
    setDropIndicatorIndex(null);
    setInsertMenuState(null);
    setSelectionContextMenuState(null);
    setSelectionMarqueeRect(null);
    setHistory(createMarkdownHistory(markdown));
    setOverlayLayout((current) => ({
      ...current,
      byIndex: new Map(),
    }));
    autoActivatedWriteKeyRef.current = null;
    selectionGestureRef.current = null;
    suppressNextBlockContextMenuRef.current = false;
    stableBlockRenderTokensRef.current = [];
    pendingActivationMarkdownRef.current = null;
  }, [historyKey]);

  useEffect(
    () => () => {
      if (overlayMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(overlayMeasureFrameRef.current);
        overlayMeasureFrameRef.current = null;
      }
    },
    [],
  );

  useLayoutEffect(() => {
    measureOverlayLayout();
  }, [
    blocks,
    activeBlockIndex,
    selectedBlockSelection,
    draggedBlockIndex,
    dropIndicatorIndex,
    insertMenuState,
    isSelectionDragging,
    measureOverlayLayout,
  ]);

  useEffect(() => {
    const contentLayer = contentLayerRef.current;
    if (!contentLayer || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      scheduleOverlayLayoutMeasure();
    });
    observer.observe(contentLayer);
    const rows = contentLayer.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]");
    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [blocks, activeBlockIndex, scheduleOverlayLayoutMeasure]);

  useEffect(() => {
    const surface = containerRef.current;
    if (!surface) {
      return;
    }
    const scrollContainer = findScrollableAncestor(surface);
    overlayScrollContainerRef.current = scrollContainer;
    const handlePositionAffectingEvent = () => {
      scheduleOverlayLayoutMeasure();
    };
    scrollContainer?.addEventListener("scroll", handlePositionAffectingEvent, { passive: true });
    window.addEventListener("resize", handlePositionAffectingEvent);
    return () => {
      scrollContainer?.removeEventListener("scroll", handlePositionAffectingEvent);
      window.removeEventListener("resize", handlePositionAffectingEvent);
      if (overlayScrollContainerRef.current === scrollContainer) {
        overlayScrollContainerRef.current = null;
      }
    };
  }, [scheduleOverlayLayoutMeasure]);

  useEffect(() => {
    if (!selectedBlockSelection) {
      return;
    }
    if (blocks.length === 0) {
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setSelectionContextMenuState(null);
      setSelectionMarqueeRect(null);
      selectionGestureRef.current = null;
      return;
    }
    const validSelectedIndices = sortUniqueSelectionIndices(
      selectedBlockSelection.selectedIndices.filter((index) =>
        Number.isInteger(index) && index >= 0 && index < blocks.length
      ),
    );
    if (validSelectedIndices.length === 0) {
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setSelectionContextMenuState(null);
      setSelectionMarqueeRect(null);
      selectionGestureRef.current = null;
      return;
    }
    const nextAnchor = validSelectedIndices.includes(selectedBlockSelection.anchorIndex)
      ? selectedBlockSelection.anchorIndex
      : validSelectedIndices[0]!;
    const didChange = nextAnchor !== selectedBlockSelection.anchorIndex ||
      validSelectedIndices.length !== selectedBlockSelection.selectedIndices.length ||
      validSelectedIndices.some((value, index) => value !== selectedBlockSelection.selectedIndices[index]);
    if (didChange) {
      setSelectedBlockSelection({
        anchorIndex: nextAnchor,
        selectedIndices: validSelectedIndices,
      });
    }
  }, [blocks.length, selectedBlockSelection]);

  useEffect(() => {
    if (!isSelectionDragging) {
      return;
    }
    const updateRangeFromPoint = (clientX: number, clientY: number) => {
      if (disabled || blocks.length === 0) {
        return;
      }
      const pointedElement = document.elementFromPoint(clientX, clientY);
      if (!(pointedElement instanceof HTMLElement)) {
        return;
      }
      if (!containerRef.current?.contains(pointedElement)) {
        return;
      }
      const blockElement = pointedElement.closest<HTMLElement>(
        ".markdown-hybrid-block[data-md-block-index]",
      );
      if (!blockElement || !containerRef.current?.contains(blockElement)) {
        return;
      }
      const blockIndexRaw = blockElement.dataset.mdBlockIndex;
      if (typeof blockIndexRaw !== "string") {
        return;
      }
      const parsedIndex = Number.parseInt(blockIndexRaw, 10);
      if (!Number.isFinite(parsedIndex)) {
        return;
      }
      const nextIndex = clampIndex(parsedIndex, blocks.length);
      let didChangeFocus = false;
      setSelectedBlockSelection((current) => {
        const gesture = selectionGestureRef.current;
        const anchorIndex = gesture?.anchorIndex ?? nextIndex;
        const nextSelectedIndices = createSelectionIndexRange(anchorIndex, nextIndex);
        if (!current) {
          didChangeFocus = true;
          return { anchorIndex, selectedIndices: nextSelectedIndices };
        }
        const hasSameSelection = current.anchorIndex === anchorIndex &&
          current.selectedIndices.length === nextSelectedIndices.length &&
          current.selectedIndices.every((value, index) => value === nextSelectedIndices[index]);
        if (hasSameSelection) {
          return current;
        }
        didChangeFocus = true;
        return { anchorIndex, selectedIndices: nextSelectedIndices };
      });
      const gesture = selectionGestureRef.current;
      if (!gesture) {
        return;
      }
      const movedFarEnough = Math.abs(clientX - gesture.startClientX) > 3 ||
        Math.abs(clientY - gesture.startClientY) > 3;
      if (movedFarEnough || didChangeFocus) {
        gesture.didDrag = true;
      }
    };

    const endSelectionGesture = (reason: "mouseup" | "button-release") => {
      const gesture = selectionGestureRef.current;
      if (gesture && gesture.source === "right" && gesture.didDrag) {
        suppressNextBlockContextMenuRef.current = true;
      } else if (reason === "mouseup") {
        suppressNextBlockContextMenuRef.current = false;
      }
      if (gesture) {
        gesture.active = false;
      }
      selectionGestureRef.current = null;
      setIsSelectionDragging(false);
      setSelectionMarqueeRect(null);
    };

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (disabled || blocks.length === 0) {
        return;
      }
      const gesture = selectionGestureRef.current;
      if (!gesture?.active) {
        return;
      }
      const expectedButtonMask = gesture.source === "right" ? 2 : 1;
      if ((event.buttons & expectedButtonMask) !== expectedButtonMask) {
        endSelectionGesture("button-release");
        return;
      }
      const movedFarEnough = Math.abs(event.clientX - gesture.startClientX) > 3 ||
        Math.abs(event.clientY - gesture.startClientY) > 3;
      if (gesture.source === "shift-left") {
        setSelectionMarqueeFromClientPoints(
          gesture.startClientX,
          gesture.startClientY,
          event.clientX,
          event.clientY,
        );
        if (movedFarEnough) {
          gesture.didDrag = true;
          updateSelectionFromMarqueeClientPoints(
            gesture.startClientX,
            gesture.startClientY,
            event.clientX,
            event.clientY,
          );
          return;
        }
      }
      updateRangeFromPoint(event.clientX, event.clientY);
    };
    const handleMouseUp = () => {
      endSelectionGesture("mouseup");
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    blocks.length,
    disabled,
    isSelectionDragging,
    setSelectionMarqueeFromClientPoints,
    updateSelectionFromMarqueeClientPoints,
  ]);

  useEffect(() => {
    if (activeBlockIndex === null) {
      return;
    }
    const nextBlock = blocks[activeBlockIndex];
    if (!nextBlock) {
      setActiveBlockIndex(null);
      setActiveDraft("");
      setActiveDirty(false);
      return;
    }
    const nextDraft = toEditorDraftForBlock(nextBlock);
    if (!activeDirty && nextDraft !== activeDraft) {
      setActiveDraft(nextDraft);
    }
  }, [activeBlockIndex, activeDirty, activeDraft, blocks]);

  useEffect(() => {
    if (mode !== "write" || disabled) {
      return;
    }
    if (activeBlockIndex !== null) {
      return;
    }
    if (autoActivatedWriteKeyRef.current === historyKey) {
      return;
    }
    autoActivatedWriteKeyRef.current = historyKey;
    if (blocks.length === 0) {
      pendingCaretRef.current = "start";
      setActiveBlockIndex(0);
      setActiveDraft(markdown);
      setActiveDirty(false);
      return;
    }
    setPendingActivation({ index: 0, caret: "end" });
  }, [activeBlockIndex, blocks.length, disabled, historyKey, markdown, mode]);

  useEffect(() => {
    if (!pendingActivation) {
      return;
    }
    if (
      pendingActivationMarkdownRef.current !== null &&
      markdown !== pendingActivationMarkdownRef.current
    ) {
      return;
    }
    if (blocks.length === 0) {
      pendingActivationMarkdownRef.current = null;
      setPendingActivation(null);
      return;
    }
    const nextIndex = clampIndex(pendingActivation.index, blocks.length);
    const targetBlock = blocks[nextIndex];
    if (targetBlock?.kind === "hr") {
      setActiveBlockIndex(null);
      setActiveDraft("");
      setActiveDirty(false);
      pendingActivationMarkdownRef.current = null;
      setPendingActivation(null);
      const zoneSelector = pendingActivation.caret === "end"
        ? ".markdown-hybrid-hr-enter-zone-bottom"
        : ".markdown-hybrid-hr-enter-zone-top";
      const handle = window.requestAnimationFrame(() => {
        const row = containerRef.current?.querySelector<HTMLElement>(
          `.markdown-hybrid-block[data-md-block-index="${nextIndex}"]`,
        );
        const zone = row?.querySelector<HTMLButtonElement>(zoneSelector);
        if (!zone) {
          const container = containerRef.current;
          if (container) {
            try {
              container.focus({ preventScroll: true });
            } catch {
              container.focus();
            }
          }
          return;
        }
        try {
          zone.focus({ preventScroll: true });
        } catch {
          zone.focus();
        }
      });
      return () => window.cancelAnimationFrame(handle);
    }
    pendingCaretRef.current = pendingActivation.caret;
    pendingTextareaSelectionRef.current = pendingActivation.selection ?? null;
    setActiveBlockIndex(nextIndex);
    setActiveDraft(
      blocks[nextIndex] ? toEditorDraftForBlock(blocks[nextIndex]!) : "",
    );
    setActiveDirty(false);
    pendingActivationMarkdownRef.current = null;
    setPendingActivation(null);
  }, [blocks, markdown, pendingActivation]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const caret = pendingCaretRef.current;
    const selection = pendingTextareaSelectionRef.current;
    pendingCaretRef.current = null;
    pendingTextareaSelectionRef.current = null;
    const handle = window.requestAnimationFrame(() => {
      try {
        textarea.focus({ preventScroll: true });
      } catch {
        textarea.focus();
      }
      if (selection) {
        const max = textarea.value.length;
        const start = Math.max(0, Math.min(selection.start, max));
        const end = Math.max(start, Math.min(selection.end, max));
        textarea.setSelectionRange(start, end);
        setEditorOverlaySelectionStart(start);
        return;
      }
      const nextPos = caret === "start" ? 0 : textarea.value.length;
      textarea.setSelectionRange(nextPos, nextPos);
      setEditorOverlaySelectionStart(nextPos);
    });
    return () => window.cancelAnimationFrame(handle);
  }, [activeBlockIndex]);

  const applyGlobalHistory = useCallback(
    (nextHistory: MarkdownHistoryState) => {
      setHistory(nextHistory);
      setActiveBlockIndex(null);
      setActiveDraft("");
      setActiveDirty(false);
      setPendingActivation(null);
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      setInsertMenuState(null);
      setSelectionContextMenuState(null);
      setSelectionMarqueeRect(null);
      selectionGestureRef.current = null;
      suppressNextBlockContextMenuRef.current = false;
      pendingActivationMarkdownRef.current = null;
      onChange(nextHistory.present.markdown);
    },
    [onChange],
  );

  const handleGlobalUndo = useCallback(() => {
    if (!canUndoMarkdownHistory(history)) {
      return false;
    }
    applyGlobalHistory(undoMarkdownHistory(history));
    return true;
  }, [applyGlobalHistory, history]);

  const handleGlobalRedo = useCallback(() => {
    if (!canRedoMarkdownHistory(history)) {
      return false;
    }
    applyGlobalHistory(redoMarkdownHistory(history));
    return true;
  }, [applyGlobalHistory, history]);

  const commitActiveBlock = useCallback(
    (options?: { deactivate?: boolean; nextActivation?: PendingActivation | null }) => {
      if (activeBlockIndex === null) {
        return markdown;
      }
      const block = blocks[activeBlockIndex];
      const activeSelectionStart = textareaRef.current?.selectionStart ?? null;
      if (!block) {
        if (blocks.length === 0 && activeBlockIndex === 0) {
          const normalizedHeadingSpacing = normalizeLeadingHeadingSpacing(
            activeDraft,
            "blank",
            activeSelectionStart,
          );
          const nextResolvedMarkdown = applyEditorMarkdownNormalization(
            normalizedHeadingSpacing?.value ?? activeDraft,
          );
          if (nextResolvedMarkdown !== markdown) {
            onChange(nextResolvedMarkdown);
          }
          setHistory((current) =>
            pushMarkdownHistory(current, nextResolvedMarkdown, "block-commit")
          );
          onCommit?.(nextResolvedMarkdown, {
            block: {
              id: "empty:0",
              kind: "blank",
              startLine: 0,
              endLine: 0,
              startOffset: 0,
              endOffset: 0,
              raw: nextResolvedMarkdown,
            },
          });
        }
        if (options?.deactivate) {
          setActiveBlockIndex(null);
          setActiveDraft("");
          setActiveDirty(false);
        }
        if (options?.nextActivation) {
          pendingActivationMarkdownRef.current = null;
          setPendingActivation(options.nextActivation);
        }
        return markdown;
      }

      const normalizedHeadingSpacing = normalizeLeadingHeadingSpacing(
        activeDraft,
        block.kind,
        activeSelectionStart,
      );
      const draftForPersist = normalizedHeadingSpacing?.value ?? activeDraft;
      let nextBlockRaw = toPersistedBlockRawForDraft(block, draftForPersist);
      if (block.kind === "ordered-list") {
        nextBlockRaw = normalizeOrderedListBlockSource(nextBlockRaw);
      } else if (block.kind === "help-block") {
        nextBlockRaw = normalizeHelpBlockSource(nextBlockRaw);
      } else if (block.kind === "hr") {
        nextBlockRaw = normalizeHorizontalRuleBlockSource(nextBlockRaw);
      }
      const currentResolvedMarkdown = applyEditorMarkdownNormalization(
        resolveSessionMarkdown(markdown, blocks, activeBlockIndex, activeDraft),
      );
      const nextResolvedMarkdown = applyEditorMarkdownNormalization(
        replaceMarkdownBlock(markdown, block, nextBlockRaw),
      );

      if (nextResolvedMarkdown !== currentResolvedMarkdown) {
        pendingActivationMarkdownRef.current = options?.nextActivation ? nextResolvedMarkdown : null;
        onChange(nextResolvedMarkdown);
      } else if (options?.nextActivation) {
        pendingActivationMarkdownRef.current = null;
      }
      setHistory((current) => pushMarkdownHistory(current, nextResolvedMarkdown, "block-commit"));
      onCommit?.(nextResolvedMarkdown, { block: { ...block, raw: nextBlockRaw } });

      if (options?.deactivate ?? true) {
        setActiveBlockIndex(null);
        setActiveDraft("");
      } else {
        setActiveDraft(toEditorDraftForBlock({ kind: block.kind, raw: nextBlockRaw }));
      }
      setActiveDirty(false);

      if (options?.nextActivation) {
        setPendingActivation(options.nextActivation);
      }

      return nextResolvedMarkdown;
    },
    [activeBlockIndex, activeDraft, blocks, markdown, onChange, onCommit],
  );

  const activateBlock = useCallback(
    (index: number, caret: "start" | "end" = "end") => {
      if (disabled) {
        return;
      }
      if (blocks.length === 0) {
        return;
      }
      const nextIndex = clampIndex(index, blocks.length);
      const nextBlock = blocks[nextIndex];
      if (!nextBlock) {
        return;
      }
      if (activeBlockIndex === nextIndex) {
        pendingCaretRef.current = caret;
        setActiveDraft(toEditorDraftForBlock(nextBlock));
        return;
      }
      pendingCaretRef.current = caret;
      setActiveBlockIndex(nextIndex);
      setActiveDraft(toEditorDraftForBlock(nextBlock));
      setActiveDirty(false);
    },
    [activeBlockIndex, blocks, disabled],
  );

  const focusContainer = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    try {
      container.focus({ preventScroll: true });
    } catch {
      container.focus();
    }
  }, []);

  const clearSelectedBlockRange = useCallback(() => {
    setSelectedBlockSelection(null);
    setIsSelectionDragging(false);
    setSelectionContextMenuState(null);
    setSelectionMarqueeRect(null);
    selectionGestureRef.current = null;
    suppressNextBlockContextMenuRef.current = false;
  }, []);

  const setSingleBlockSelection = useCallback(
    (index: number) => {
      if (disabled || blocks.length === 0) {
        return;
      }
      const nextIndex = clampIndex(index, blocks.length);
      setSelectedBlockSelection({ anchorIndex: nextIndex, selectedIndices: [nextIndex] });
    },
    [blocks.length, disabled],
  );

  const toggleDiscreteBlockSelection = useCallback(
    (index: number) => {
      if (disabled || blocks.length === 0) {
        return;
      }
      const nextIndex = clampIndex(index, blocks.length);
      setSelectedBlockSelection((current) => {
        if (!current) {
          return { anchorIndex: nextIndex, selectedIndices: [nextIndex] };
        }
        const alreadySelected = current.selectedIndices.includes(nextIndex);
        if (alreadySelected) {
          const remaining = current.selectedIndices.filter((value) => value !== nextIndex);
          if (remaining.length === 0) {
            return null;
          }
          const nextAnchor = remaining.includes(current.anchorIndex)
            ? current.anchorIndex
            : nextIndex;
          return {
            anchorIndex: remaining.includes(nextAnchor) ? nextAnchor : remaining[0]!,
            selectedIndices: remaining,
          };
        }
        const nextSelectedIndices = sortUniqueSelectionIndices([
          ...current.selectedIndices,
          nextIndex,
        ]);
        return { anchorIndex: nextIndex, selectedIndices: nextSelectedIndices };
      });
    },
    [blocks.length, disabled],
  );

  const updateSelectionRangeFocus = useCallback(
    (index: number) => {
      if (disabled || blocks.length === 0) {
        return;
      }
      const nextIndex = clampIndex(index, blocks.length);
      setSelectedBlockSelection((current) => {
        const gesture = selectionGestureRef.current;
        const anchorIndex = gesture?.anchorIndex ?? current?.anchorIndex ?? nextIndex;
        const nextSelectedIndices = createSelectionIndexRange(anchorIndex, nextIndex);
        if (!current) {
          return { anchorIndex, selectedIndices: nextSelectedIndices };
        }
        const hasSameSelection = current.anchorIndex === anchorIndex &&
          current.selectedIndices.length === nextSelectedIndices.length &&
          current.selectedIndices.every((value, selectedIndex) =>
            value === nextSelectedIndices[selectedIndex]
          );
        if (hasSameSelection) {
          return current;
        }
        return { anchorIndex, selectedIndices: nextSelectedIndices };
      });
    },
    [blocks.length, disabled],
  );

  const beginSelectionGesture = useCallback(
    (options: {
      index: number;
      source: SelectionGestureSource;
      clientX: number;
      clientY: number;
      preserveAnchor?: boolean;
      preserveCurrentRangeIfSelected?: boolean;
    }) => {
      if (disabled || blocks.length === 0) {
        return false;
      }
      const nextIndex = clampIndex(options.index, blocks.length);
      const shouldPreserveCurrentRange = Boolean(
        options.preserveCurrentRangeIfSelected &&
          selectedBlockSelection &&
          isBlockIndexSelected(selectedBlockSelection, nextIndex),
      );
      const nextAnchor = shouldPreserveCurrentRange
        ? selectedBlockSelection!.anchorIndex
        : (options.preserveAnchor && selectedBlockSelection
          ? selectedBlockSelection.anchorIndex
          : nextIndex);
      const nextSelectedIndices = shouldPreserveCurrentRange
        ? selectedBlockSelection!.selectedIndices
        : createSelectionIndexRange(nextAnchor, nextIndex);

      if (activeBlockIndex !== null) {
        commitActiveBlock({ deactivate: true });
      }
      setPendingActivation(null);
      setInsertMenuState(null);
      setSelectionContextMenuState(null);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      setSelectedBlockSelection({ anchorIndex: nextAnchor, selectedIndices: nextSelectedIndices });
      setSelectionMarqueeRect(null);
      selectionGestureRef.current = {
        active: true,
        source: options.source,
        anchorIndex: nextAnchor,
        didDrag: false,
        startClientX: options.clientX,
        startClientY: options.clientY,
      };
      suppressNextBlockContextMenuRef.current = false;
      setIsSelectionDragging(true);
      focusContainer();
      return true;
    },
    [
      activeBlockIndex,
      blocks.length,
      commitActiveBlock,
      disabled,
      focusContainer,
      selectedBlockSelection,
    ],
  );

  const beginMarqueeSelectionGesture = useCallback(
    (options: {
      clientX: number;
      clientY: number;
      preserveAnchor?: boolean;
    }) => {
      if (disabled) {
        return false;
      }
      if (activeBlockIndex !== null) {
        commitActiveBlock({ deactivate: true });
      }
      const nextAnchor = options.preserveAnchor && selectedBlockSelection
        ? selectedBlockSelection.anchorIndex
        : (selectedBlockSelection?.anchorIndex ?? 0);
      setPendingActivation(null);
      setInsertMenuState(null);
      setSelectionContextMenuState(null);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      selectionGestureRef.current = {
        active: true,
        source: "shift-left",
        anchorIndex: nextAnchor,
        didDrag: false,
        startClientX: options.clientX,
        startClientY: options.clientY,
      };
      suppressNextBlockContextMenuRef.current = false;
      setIsSelectionDragging(true);
      setSelectionMarqueeFromClientPoints(
        options.clientX,
        options.clientY,
        options.clientX,
        options.clientY,
      );
      focusContainer();
      return true;
    },
    [
      activeBlockIndex,
      commitActiveBlock,
      disabled,
      focusContainer,
      selectedBlockSelection,
      setSelectionMarqueeFromClientPoints,
    ],
  );

  const deleteSelectedBlocks = useCallback(() => {
    if (disabled || activeBlockIndex !== null || !selectedBlockSelection) {
      return false;
    }
    const nextMarkdownRaw = deleteMarkdownBlockSelection(markdown, blocks, selectedBlockSelection);
    if (nextMarkdownRaw === markdown) {
      clearSelectedBlockRange();
      return false;
    }
    const nextMarkdown = applyEditorMarkdownNormalization(nextMarkdownRaw);

    setActiveBlockIndex(null);
    setActiveDraft("");
    setActiveDirty(false);
    setPendingActivation(null);
    setSelectedBlockSelection(null);
    setIsSelectionDragging(false);
    setSelectionContextMenuState(null);
    setSelectionMarqueeRect(null);
    selectionGestureRef.current = null;
    suppressNextBlockContextMenuRef.current = false;
    focusContainer();
    onChange(nextMarkdown);
    setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-delete"));
    return true;
  }, [
    activeBlockIndex,
    blocks,
    clearSelectedBlockRange,
    disabled,
    focusContainer,
    markdown,
    onChange,
    selectedBlockSelection,
  ]);

  const insertBlockRelativeTo = useCallback(
    (
      blockIndex: number,
      insertedRaw: string,
      insertAbove: boolean,
      options?: { firstPlaceholder?: string },
    ) => {
      if (disabled) {
        return false;
      }
      const targetIndex = insertAbove ? blockIndex : blockIndex + 1;
      const nextMarkdown = applyEditorMarkdownNormalization(
        withInsertedRawBlock(blocks, targetIndex, insertedRaw),
      );
      if (nextMarkdown === markdown) {
        return false;
      }

      const nextBlocks = parseMarkdownBlocks(nextMarkdown);
      const insertedBlocks = parseMarkdownBlocks(applyEditorMarkdownNormalization(insertedRaw));
      const primaryInsertedBlock = insertedBlocks.find((block) => block.kind !== "blank") ?? insertedBlocks[0];
      let activationSelection: PendingActivation["selection"] | undefined;
      let activationIndex = -1;
      if (primaryInsertedBlock) {
        if (options?.firstPlaceholder && primaryInsertedBlock.kind !== "hr") {
          const editorDraft = toEditorDraftForBlock(primaryInsertedBlock);
          const placeholderStart = editorDraft.indexOf(options.firstPlaceholder);
          if (placeholderStart >= 0) {
            activationSelection = {
              start: placeholderStart,
              end: placeholderStart + options.firstPlaceholder.length,
            };
          }
        }
        const startSearchIndex = Math.max(0, Math.min(targetIndex, nextBlocks.length - 1));
        for (let offset = 0; offset < nextBlocks.length; offset += 1) {
          const forwardIndex = startSearchIndex + offset;
          if (
            forwardIndex < nextBlocks.length &&
            nextBlocks[forwardIndex]?.kind === primaryInsertedBlock.kind &&
            nextBlocks[forwardIndex]?.raw === primaryInsertedBlock.raw
          ) {
            activationIndex = forwardIndex;
            break;
          }
          const backwardIndex = startSearchIndex - offset;
          if (
            offset > 0 &&
            backwardIndex >= 0 &&
            nextBlocks[backwardIndex]?.kind === primaryInsertedBlock.kind &&
            nextBlocks[backwardIndex]?.raw === primaryInsertedBlock.raw
          ) {
            activationIndex = backwardIndex;
            break;
          }
        }
      } else if (insertedRaw.trim().length === 0 && nextBlocks.length > 0) {
        const startSearchIndex = Math.max(0, Math.min(targetIndex, nextBlocks.length - 1));
        for (let offset = 0; offset < nextBlocks.length; offset += 1) {
          const forwardIndex = startSearchIndex + offset;
          if (forwardIndex < nextBlocks.length && nextBlocks[forwardIndex]?.kind === "blank") {
            activationIndex = forwardIndex;
            break;
          }
          const backwardIndex = startSearchIndex - offset;
          if (offset > 0 && backwardIndex >= 0 && nextBlocks[backwardIndex]?.kind === "blank") {
            activationIndex = backwardIndex;
            break;
          }
        }
      }

      setActiveBlockIndex(null);
      setActiveDraft("");
      setActiveDirty(false);
      pendingActivationMarkdownRef.current = activationIndex >= 0 ? nextMarkdown : null;
      setPendingActivation(
        activationIndex >= 0
          ? { index: activationIndex, caret: "end", selection: activationSelection }
          : null,
      );
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      setInsertMenuState(null);
      setSelectionContextMenuState(null);
      setSelectionMarqueeRect(null);
      selectionGestureRef.current = null;
      suppressNextBlockContextMenuRef.current = false;
      onChange(nextMarkdown);
      setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-commit"));
      return true;
    },
    [blocks, disabled, markdown, onChange],
  );

  const getEmptyParagraphInsertRawForSlot = useCallback(
    (targetIndex: number) => {
      const previousKind = blocks[targetIndex - 1]?.kind ?? null;
      const nextKind = blocks[targetIndex]?.kind ?? null;
      const adjacentHrCount = Number(previousKind === "hr") + Number(nextKind === "hr");
      if (adjacentHrCount >= 2) {
        return "\n\n";
      }
      if (adjacentHrCount === 1) {
        return "\n";
      }
      return "";
    },
    [blocks],
  );

  const insertEmptyParagraphRelativeTo = useCallback(
    (blockIndex: number, insertAbove: boolean) => {
      const targetIndex = insertAbove ? blockIndex : blockIndex + 1;
      return insertBlockRelativeTo(
        blockIndex,
        getEmptyParagraphInsertRawForSlot(targetIndex),
        insertAbove,
      );
    },
    [getEmptyParagraphInsertRawForSlot, insertBlockRelativeTo],
  );

  const reorderBlockByDrop = useCallback(
    (fromIndex: number, toSlotIndex: number) => {
      if (disabled) {
        return false;
      }
      const shouldMoveSelectionGroup = Boolean(
        selectedBlockSelection &&
          selectedBlockSelection.selectedIndices.length > 1 &&
          isBlockIndexSelected(selectedBlockSelection, fromIndex),
      );
      const moveResult = shouldMoveSelectionGroup
        ? moveBlockSelectionInList(blocks, selectedBlockSelection!.selectedIndices, toSlotIndex)
        : (() => {
          const nextItems = moveBlockInList(blocks, fromIndex, toSlotIndex);
          const normalizedToSlot = Math.max(0, Math.min(toSlotIndex, blocks.length));
          const nextInsertIndex = normalizedToSlot > fromIndex ? normalizedToSlot - 1 : normalizedToSlot;
          const clampedInsertIndex = Math.max(0, Math.min(nextInsertIndex, Math.max(0, nextItems.length - 1)));
          return {
            items: nextItems,
            insertIndex: clampedInsertIndex,
            movedIndices: [clampedInsertIndex],
          };
        })();
      const reorderedBlocks = moveResult.items;
      if (reorderedBlocks === blocks) {
        return false;
      }
      const nextMarkdown = applyEditorMarkdownNormalization(
        serializeMarkdownFromBlocks(reorderedBlocks),
      );
      if (nextMarkdown === markdown) {
        return false;
      }
      const draggedRelativeIndex = shouldMoveSelectionGroup && selectedBlockSelection
        ? Math.max(0, selectedBlockSelection.selectedIndices.indexOf(fromIndex))
        : 0;
      const activationIndex = shouldMoveSelectionGroup
        ? moveResult.movedIndices[draggedRelativeIndex] ?? moveResult.insertIndex
        : moveResult.insertIndex;

      setActiveBlockIndex(null);
      setActiveDraft("");
      setActiveDirty(false);
      pendingActivationMarkdownRef.current = nextMarkdown;
      setPendingActivation({
        index: clampIndex(activationIndex, reorderedBlocks.length),
        caret: "end",
      });
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      setInsertMenuState(null);
      setSelectionContextMenuState(null);
      setSelectionMarqueeRect(null);
      selectionGestureRef.current = null;
      suppressNextBlockContextMenuRef.current = false;
      onChange(nextMarkdown);
      setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-commit"));
      return true;
    },
    [blocks, disabled, markdown, onChange, selectedBlockSelection],
  );

  useEffect(() => {
    if (!insertMenuState) {
      return;
    }

    const handleDocumentMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (insertMenuRef.current?.contains(target)) {
        return;
      }
      if (target.closest("[data-md-block-control='true']")) {
        return;
      }
      setInsertMenuState(null);
    };

    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setInsertMenuState(null);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [insertMenuState]);

  useEffect(() => {
    if (!selectionContextMenuState) {
      return;
    }

    const handleDocumentMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (selectionContextMenuRef.current?.contains(target)) {
        return;
      }
      setSelectionContextMenuState(null);
    };

    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectionContextMenuState(null);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [selectionContextMenuState]);

  useEffect(() => {
    if (!selectedBlockSelection) {
      return;
    }

    const handleDocumentMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (containerRef.current?.contains(target)) {
        return;
      }
      clearSelectedBlockRange();
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [clearSelectedBlockRange, selectedBlockSelection]);

  const handleOpenInsertMenu = useCallback(
    (blockIndex: number) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const insertAbove = event.shiftKey;
      setSelectionContextMenuState(null);
      setInsertMenuState({
        blockIndex,
        insertAbove,
        phase: "categories",
      });
    },
    [],
  );

  const handleSelectInsertMenuCategory = useCallback(
    (categoryId: InsertMenuCategoryId) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setInsertMenuState((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          phase: "items",
          categoryId,
        };
      });
    },
    [],
  );

  const handleInsertMenuBack = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setInsertMenuState((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        phase: "categories",
        categoryId: undefined,
      };
    });
  }, []);

  const handleInsertMenuClose = useCallback((event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    setInsertMenuState(null);
  }, []);

  const handleSelectionContextMenuClose = useCallback(() => {
    setSelectionContextMenuState(null);
  }, []);

  const handleInsertMenuItemSelect = useCallback(
    (item: InsertMenuItem) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!insertMenuState) {
        return;
      }
      insertBlockRelativeTo(insertMenuState.blockIndex, item.template, insertMenuState.insertAbove, {
        firstPlaceholder: item.firstPlaceholder,
      });
    },
    [insertBlockRelativeTo, insertMenuState],
  );

  const handleHrEnterZoneMouseDown = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    },
    [],
  );

  const handleHrEnterZoneClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    },
    [],
  );

  const handleHrEnterZoneKeyDown = useCallback(
    (blockIndex: number, insertAbove: boolean) => (event: KeyboardEvent<HTMLButtonElement>) => {
      if (
        event.key !== "Enter" ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      insertEmptyParagraphRelativeTo(blockIndex, insertAbove);
    },
    [insertEmptyParagraphRelativeTo],
  );

  const handleSelectionContextMenuDelete = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectionContextMenuState(null);
      deleteSelectedBlocks();
    },
    [deleteSelectedBlocks],
  );

  const handleSelectionContextMenuClear = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      handleSelectionContextMenuClose();
      clearSelectedBlockRange();
      focusContainer();
    },
    [clearSelectedBlockRange, focusContainer, handleSelectionContextMenuClose],
  );

  const handleContainerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled || activeBlockIndex !== null) {
        return;
      }
      if (event.key === "Escape" && insertMenuState) {
        event.preventDefault();
        event.stopPropagation();
        setInsertMenuState(null);
        return;
      }
      if (event.key === "Escape" && selectionContextMenuState) {
        event.preventDefault();
        event.stopPropagation();
        setSelectionContextMenuState(null);
        return;
      }
      if (event.key === "Escape" && selectedBlockSelection) {
        event.preventDefault();
        event.stopPropagation();
        clearSelectedBlockRange();
        return;
      }
      if (selectedBlockSelection && isDeleteRangeShortcut(event)) {
        if (deleteSelectedBlocks()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (isUndoShortcut(event)) {
        if (handleGlobalUndo()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (isRedoShortcut(event)) {
        if (handleGlobalRedo()) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    },
    [
      activeBlockIndex,
      clearSelectedBlockRange,
      deleteSelectedBlocks,
      disabled,
      handleGlobalRedo,
      handleGlobalUndo,
      insertMenuState,
      selectionContextMenuState,
      selectedBlockSelection,
    ],
  );

  const handleTextareaChange = useCallback(
    (value: string, selectionStart?: number | null) => {
      let nextValue = value;
      if (typeof selectionStart === "number") {
        setEditorOverlaySelectionStart(selectionStart);
      }
      const activeBlock = activeBlockIndex === null ? null : (blocks[activeBlockIndex] ?? null);
      if (activeBlock?.kind === "help-block") {
        nextValue = normalizeHelpBlockSource(nextValue);
      }
      if (blocks.length === 0 && activeBlockIndex === 0) {
        setActiveDraft(nextValue);
        setActiveDirty(true);
        if (nextValue !== markdown) {
          onChange(nextValue);
        }
        return;
      }
      if (activeBlockIndex === null) {
        return;
      }
      if (activeBlock?.kind === "blank" && nextValue.length > 0) {
        const previousBlock = blocks[activeBlockIndex - 1] ?? null;
        const nextBlock = blocks[activeBlockIndex + 1] ?? null;
        const needsSeparatorBefore = previousBlock?.kind === "paragraph";
        const needsSeparatorAfter = nextBlock?.kind === "paragraph";
        const replacementRaw = `${needsSeparatorBefore ? "\n" : ""}${nextValue}${
          needsSeparatorAfter ? "\n" : ""
        }`;
        const nextMarkdown = applyEditorMarkdownNormalization(
          replaceMarkdownBlock(markdown, activeBlock, replacementRaw),
        );
        const nextBlocks = parseMarkdownBlocks(nextMarkdown);
        const preferredKind = parseMarkdownBlocks(nextValue)[0]?.kind ?? "paragraph";
        let activationIndex = -1;
        const startSearchIndex = Math.max(
          0,
          Math.min(activeBlockIndex + (needsSeparatorBefore ? 1 : 0), nextBlocks.length - 1),
        );

        for (let offset = 0; offset < nextBlocks.length; offset += 1) {
          const forwardIndex = startSearchIndex + offset;
          if (
            forwardIndex < nextBlocks.length &&
            nextBlocks[forwardIndex]?.raw === nextValue &&
            nextBlocks[forwardIndex]?.kind === preferredKind
          ) {
            activationIndex = forwardIndex;
            break;
          }
          const backwardIndex = startSearchIndex - offset;
          if (
            offset > 0 &&
            backwardIndex >= 0 &&
            nextBlocks[backwardIndex]?.raw === nextValue &&
            nextBlocks[backwardIndex]?.kind === preferredKind
          ) {
            activationIndex = backwardIndex;
            break;
          }
        }

        if (activationIndex < 0) {
          activationIndex = clampIndex(
            activeBlockIndex + (needsSeparatorBefore ? 1 : 0),
            nextBlocks.length,
          );
        }

        setActiveBlockIndex(null);
        setActiveDraft("");
        setActiveDirty(false);
        pendingActivationMarkdownRef.current = nextMarkdown;
        setPendingActivation({ index: activationIndex, caret: "end" });
        onChange(nextMarkdown);
        return;
      }
      setActiveDraft(nextValue);
      setActiveDirty(true);
      const block = activeBlock;
      if (!block) {
        return;
      }
      const nextBlockRaw = toPersistedBlockRawForDraft(block, nextValue);
      const nextMarkdown = replaceMarkdownBlock(markdown, block, nextBlockRaw);
      if (nextMarkdown !== markdown) {
        onChange(nextMarkdown);
      }
    },
    [activeBlockIndex, blocks, markdown, onChange],
  );

  const handleTextareaBlur = useCallback(() => {
    commitActiveBlock({ deactivate: true });
  }, [commitActiveBlock]);

  const scheduleTextareaCaret = useCallback((nextPosition: number) => {
    const handle = window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      const safe = Math.max(0, Math.min(nextPosition, textarea.value.length));
      try {
        textarea.focus({ preventScroll: true });
      } catch {
        textarea.focus();
      }
      textarea.setSelectionRange(safe, safe);
      setEditorOverlaySelectionStart(safe);
    });
    return () => window.cancelAnimationFrame(handle);
  }, []);

  const syncEditorSyntaxOverlayScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const overlayContent = editorSyntaxOverlayContentRef.current;
    if (!textarea || !overlayContent) {
      return;
    }
    overlayContent.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
  }, []);

  const handleTextareaScroll = useCallback(() => {
    syncEditorSyntaxOverlayScroll();
  }, [syncEditorSyntaxOverlayScroll]);

  const handleTextareaSelect = useCallback((event: SyntheticEvent<HTMLTextAreaElement>) => {
    setEditorOverlaySelectionStart(event.currentTarget.selectionStart);
  }, []);

  useLayoutEffect(() => {
    const handle = window.requestAnimationFrame(() => {
      syncEditorSyntaxOverlayScroll();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [activeBlockIndex, activeDraft, syncEditorSyntaxOverlayScroll]);

  const applyActiveBlockDraft = useCallback(
    (nextDraft: string, nextCaretPosition?: number) => {
      if (activeBlockIndex === null) {
        return false;
      }
      const block = blocks[activeBlockIndex];
      if (!block) {
        return false;
      }
      setActiveDraft(nextDraft);
      setActiveDirty(true);
      const nextBlockRaw = toPersistedBlockRawForDraft(block, nextDraft);
      const nextMarkdown = replaceMarkdownBlock(markdown, block, nextBlockRaw);
      if (nextMarkdown !== markdown) {
        onChange(nextMarkdown);
      }
      if (typeof nextCaretPosition === "number") {
        scheduleTextareaCaret(nextCaretPosition);
      }
      return true;
    },
    [activeBlockIndex, blocks, markdown, onChange, scheduleTextareaCaret],
  );

  const replaceActiveBlockWithSegments = useCallback(
    (segments: string[], options?: { activateSegmentIndex?: number; caret?: "start" | "end" }) => {
      if (activeBlockIndex === null) {
        return false;
      }
      const block = blocks[activeBlockIndex];
      if (!block) {
        return false;
      }

      const nextBlockRaw = segments.join("\n");
      const nextMarkdown = applyEditorMarkdownNormalization(
        replaceMarkdownBlock(markdown, block, nextBlockRaw),
      );
      const nextBlocks = parseMarkdownBlocks(nextMarkdown);
      const rawTargetIndex = activeBlockIndex + (options?.activateSegmentIndex ?? 0);
      const targetIndex = nextBlocks.length > 0
        ? clampIndex(rawTargetIndex, nextBlocks.length)
        : 0;

      setActiveBlockIndex(null);
      setActiveDraft("");
      setActiveDirty(false);
      pendingActivationMarkdownRef.current = nextBlocks.length > 0 ? nextMarkdown : null;
      setPendingActivation(
        nextBlocks.length > 0
          ? { index: targetIndex, caret: options?.caret ?? "start" }
          : null,
      );
      onChange(nextMarkdown);
      setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-commit"));
      return true;
    },
    [activeBlockIndex, blocks, markdown, onChange],
  );

  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      const nativeKeyboardEvent = event.nativeEvent as Event & { isComposing?: boolean };
      if (nativeKeyboardEvent.isComposing) {
        return;
      }

      if (isUndoShortcut(event)) {
        if (!activeDirty && handleGlobalUndo()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (isRedoShortcut(event)) {
        if (!activeDirty && handleGlobalRedo()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (activeBlockIndex === null) {
        return;
      }
      const block = blocks[activeBlockIndex];
      if (!block) {
        return;
      }

      const textarea = event.currentTarget;
      const hasSelection = textarea.selectionStart !== textarea.selectionEnd;
      const atStart = !hasSelection && textarea.selectionStart === 0;
      const atEnd = !hasSelection && textarea.selectionEnd === textarea.value.length;
      const isPlainEnter = event.key === "Enter" &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey;
      const isPlainDeleteKey = (event.key === "Backspace" || event.key === "Delete") &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey;

      if (event.key === "Enter" && event.shiftKey && (block.kind === "ordered-list" || block.kind === "unordered-list")) {
        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;
        const lineRange = getLineRangeAtOffset(activeDraft, selectionStart);
        const listLineInfo = parseEditorListLine(lineRange.line);
        let continuationPrefix = "  ";
        if (listLineInfo) {
          const continuationPadding = Math.max(
            2,
            listLineInfo.prefixLength - listLineInfo.indent.length,
          );
          continuationPrefix = `${listLineInfo.indent}${" ".repeat(continuationPadding)}`;
        } else {
          const continuationMatch = lineRange.line.match(editorListContinuationLinePattern);
          if (continuationMatch) {
            continuationPrefix = continuationMatch[1] ?? "  ";
          }
        }
        const nextDraft = `${activeDraft.slice(0, selectionStart)}\n${continuationPrefix}${
          activeDraft.slice(selectionEnd)
        }`;
        const nextCaret = selectionStart + 1 + continuationPrefix.length;
        event.preventDefault();
        event.stopPropagation();
        applyActiveBlockDraft(nextDraft, nextCaret);
        return;
      }

      if (isPlainDeleteKey && (block.kind === "ordered-list" || block.kind === "unordered-list")) {
        if (!hasSelection) {
          const selectionStart = textarea.selectionStart;
          const lineRange = getLineRangeAtOffset(activeDraft, selectionStart);
          const listLineInfo = parseEditorListLine(lineRange.line);
          const continuationMatch = lineRange.line.match(editorListContinuationLinePattern);
          const continuationContent = continuationMatch?.[2] ?? "";
          const isEmptyListItemLine = Boolean(listLineInfo && listLineInfo.content.trim().length === 0);
          const isEmptyContinuationLine = Boolean(
            !listLineInfo &&
              continuationMatch &&
              continuationContent.trim().length === 0,
          );

          if (isEmptyListItemLine || isEmptyContinuationLine) {
            const lines = activeDraft.split("\n");
            if (lines.length > 1) {
              event.preventDefault();
              event.stopPropagation();
              const lineIndex = lineRange.lineIndex;
              const nextLines = [...lines];
              nextLines.splice(lineIndex, 1);
              let nextDraft = nextLines.join("\n");
              if (block.kind === "ordered-list") {
                nextDraft = normalizeOrderedListBlockSource(nextDraft);
              }
              const resolvedLines = nextDraft.length > 0 ? nextDraft.split("\n") : [""];
              const targetLineIndex = event.key === "Delete"
                ? Math.min(lineIndex, Math.max(0, resolvedLines.length - 1))
                : Math.max(0, lineIndex - 1);
              let nextCaret = getLineStartOffsetByIndex(resolvedLines, targetLineIndex);
              if (event.key === "Backspace") {
                nextCaret += (resolvedLines[targetLineIndex] ?? "").length;
              }
              applyActiveBlockDraft(nextDraft, nextCaret);
              return;
            }
          }
        }
      }

      if (isPlainEnter && !event.shiftKey && (block.kind === "ordered-list" || block.kind === "unordered-list")) {
        const selectionStart = textarea.selectionStart;
        const lineRange = getLineRangeAtOffset(activeDraft, selectionStart);
        const listLineInfo = parseEditorListLine(lineRange.line);
        const lineLocalSelectionStart = selectionStart - lineRange.start;

        if (
          !hasSelection &&
          listLineInfo &&
          lineLocalSelectionStart >= listLineInfo.prefixLength
        ) {
          const lines = activeDraft.split("\n");
          const lineIndex = lineRange.lineIndex;
          const beforeContent = lineRange.line.slice(listLineInfo.prefixLength, lineLocalSelectionStart);
          const afterContent = lineRange.line.slice(lineLocalSelectionStart);
          const isEmptyItem = listLineInfo.content.trim().length === 0;

          event.preventDefault();
          event.stopPropagation();

          if (isEmptyItem) {
            const beforeLines = lines.slice(0, lineIndex);
            const afterLines = lines.slice(lineIndex + 1);
            const segments: string[] = [];
            if (beforeLines.length > 0) {
              segments.push(beforeLines.join("\n"));
            }
            const insertBlankSegmentIndex = segments.length;
            segments.push("");
            if (afterLines.length === 0 && blocks[activeBlockIndex + 1]?.kind === "hr") {
              segments.push("");
            }
            if (afterLines.length > 0) {
              segments.push(afterLines.join("\n"));
            }
            replaceActiveBlockWithSegments(segments, {
              activateSegmentIndex: insertBlankSegmentIndex,
              caret: "start",
            });
            return;
          }

          const currentLinePrefix = lineRange.line.slice(0, listLineInfo.prefixLength);
          const currentLine = `${currentLinePrefix}${beforeContent}`;
          let nextLinePrefix = "";
          if (listLineInfo.kind === "ordered") {
            nextLinePrefix = `${listLineInfo.indent}${listLineInfo.orderedNumber + 1}${listLineInfo.orderedDelimiter}${listLineInfo.spacing}`;
          } else if (listLineInfo.kind === "task") {
            nextLinePrefix = `${listLineInfo.indent}${listLineInfo.bullet} [ ]${listLineInfo.spacing}`;
          } else {
            nextLinePrefix = `${listLineInfo.indent}${listLineInfo.bullet}${listLineInfo.spacing}`;
          }
          const nextLine = `${nextLinePrefix}${afterContent}`;

          const nextLines = [...lines];
          nextLines.splice(lineIndex, 1, currentLine, nextLine);
          let nextDraft = nextLines.join("\n");
          if (block.kind === "ordered-list") {
            nextDraft = normalizeOrderedListBlockSource(nextDraft);
          }
          const resolvedLines = nextDraft.split("\n");
          const insertedLine = resolvedLines[lineIndex + 1] ?? nextLine;
          const insertedLineInfo = parseEditorListLine(insertedLine);
          const nextCaret = getLineStartOffsetByIndex(resolvedLines, lineIndex + 1) +
            (insertedLineInfo?.prefixLength ?? nextLinePrefix.length);
          applyActiveBlockDraft(nextDraft, nextCaret);
          return;
        }

        if (!hasSelection) {
          const continuationMatch = lineRange.line.match(editorListContinuationLinePattern);
          if (continuationMatch) {
            const lines = activeDraft.split("\n");
            const lineIndex = lineRange.lineIndex;
            let anchorListLineInfo: EditorListLineInfo | null = null;
            for (let scanIndex = lineIndex - 1; scanIndex >= 0; scanIndex -= 1) {
              const candidateInfo = parseEditorListLine(lines[scanIndex] ?? "");
              if (candidateInfo) {
                anchorListLineInfo = candidateInfo;
                break;
              }
            }

            if (anchorListLineInfo) {
              const continuationIndent = continuationMatch[1] ?? "";
              const splitOffset = Math.max(continuationIndent.length, lineLocalSelectionStart);
              const beforeContent = lineRange.line.slice(continuationIndent.length, splitOffset);
              const afterContent = lineRange.line.slice(splitOffset);
              const currentContinuationLine = `${continuationIndent}${beforeContent}`;
              const nextLinePrefix = buildNextListLinePrefixFromInfo(anchorListLineInfo);
              const nextListLine = `${nextLinePrefix}${afterContent}`;

              event.preventDefault();
              event.stopPropagation();

              const nextLines = [...lines];
              nextLines.splice(lineIndex, 1, currentContinuationLine, nextListLine);
              let nextDraft = nextLines.join("\n");
              if (block.kind === "ordered-list") {
                nextDraft = normalizeOrderedListBlockSource(nextDraft);
              }
              const resolvedLines = nextDraft.split("\n");
              const insertedLine = resolvedLines[lineIndex + 1] ?? nextListLine;
              const insertedLineInfo = parseEditorListLine(insertedLine);
              const nextCaret = getLineStartOffsetByIndex(resolvedLines, lineIndex + 1) +
                (insertedLineInfo?.prefixLength ?? nextLinePrefix.length);
              applyActiveBlockDraft(nextDraft, nextCaret);
              return;
            }
          }
        }

        if (!hasSelection) {
          // If we cannot resolve a list marker safely, stay in a single input target and let the
          // browser insert a plain newline in the active textarea (no block handoff).
          return;
        }
      }

      if (event.key === "Enter" && event.shiftKey && block.kind === "heading") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (isPlainEnter && !event.shiftKey && block.kind === "blank") {
        event.preventDefault();
        event.stopPropagation();
        replaceActiveBlockWithSegments(["", ""], {
          activateSegmentIndex: 1,
          caret: "start",
        });
        return;
      }

      if (isPlainEnter && !event.shiftKey && block.kind === "heading") {
        event.preventDefault();
        event.stopPropagation();
        replaceActiveBlockWithSegments(
          blocks[activeBlockIndex + 1]?.kind === "hr" ? [activeDraft, "", ""] : [activeDraft, ""],
          {
          activateSegmentIndex: 1,
          caret: "start",
          },
        );
        return;
      }

      if (isPlainEnter && !event.shiftKey && block.kind === "hr") {
        event.preventDefault();
        event.stopPropagation();
        replaceActiveBlockWithSegments([toPersistedBlockRawForDraft(block, activeDraft), ""], {
          activateSegmentIndex: 1,
          caret: "start",
        });
        return;
      }

      if (isPlainEnter && !event.shiftKey && block.kind === "paragraph") {
        event.preventDefault();
        event.stopPropagation();
        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;
        const before = activeDraft.slice(0, selectionStart);
        const after = activeDraft.slice(selectionEnd);
        const segments: string[] = [];
        let blankSegmentIndex = 0;
        let activationIndex = 0;

        if (before.length > 0) {
          segments.push(before);
        }
        blankSegmentIndex = segments.length;
        segments.push("");

        if (after.length > 0) {
          segments.push(after);
          activationIndex = segments.length - 1;
        } else {
          activationIndex = blankSegmentIndex;
          if (blocks[activeBlockIndex + 1]?.kind === "hr") {
            segments.push("");
          }
        }
        replaceActiveBlockWithSegments(segments, {
          activateSegmentIndex: activationIndex,
          caret: "start",
        });
        return;
      }

      if (isPlainEnter && !event.shiftKey && block.kind === "blockquote" && atEnd) {
        event.preventDefault();
        event.stopPropagation();
        replaceActiveBlockWithSegments(
          blocks[activeBlockIndex + 1]?.kind === "hr" ? [activeDraft, "", ""] : [activeDraft, ""],
          {
          activateSegmentIndex: 1,
          caret: "start",
          },
        );
        return;
      }

      if (
        isPlainEnter &&
        !event.shiftKey &&
        isSingleLineCommitBlock(block)
      ) {
        event.preventDefault();
        event.stopPropagation();
        commitActiveBlock({
          deactivate: true,
          nextActivation: { index: activeBlockIndex + 1, caret: "start" },
        });
        return;
      }

      if (
        event.key === "ArrowDown" &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        atEnd
      ) {
        event.preventDefault();
        commitActiveBlock({
          deactivate: true,
          nextActivation: { index: activeBlockIndex + 1, caret: "start" },
        });
        return;
      }

      if (
        event.key === "ArrowUp" &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        atStart
      ) {
        event.preventDefault();
        commitActiveBlock({
          deactivate: true,
          nextActivation: { index: activeBlockIndex - 1, caret: "end" },
        });
      }
    },
    [
      activeBlockIndex,
      activeDraft,
      applyActiveBlockDraft,
      activeDirty,
      blocks,
      commitActiveBlock,
      handleGlobalRedo,
      handleGlobalUndo,
      replaceActiveBlockWithSegments,
    ],
  );

  const handleBlockMouseDownCapture = useCallback(
    (index: number) => (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      const target = event.target;
      const isInteractiveElement = target instanceof HTMLElement &&
        Boolean(target.closest("a[href],button,input,textarea,[data-md-block-control='true']"));
      if (isInteractiveElement) {
        return;
      }

      if (event.button === 0 && event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        beginSelectionGesture({
          index,
          source: "shift-left",
          clientX: event.clientX,
          clientY: event.clientY,
          preserveAnchor: Boolean(selectedBlockSelection),
        });
        return;
      }

      if (event.button === 0 && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation();
        if (activeBlockIndex !== null) {
          commitActiveBlock({ deactivate: true });
        }
        setPendingActivation(null);
        setInsertMenuState(null);
        setSelectionContextMenuState(null);
        setDraggedBlockIndex(null);
        setDropIndicatorIndex(null);
        toggleDiscreteBlockSelection(index);
        focusContainer();
        return;
      }

      if (event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
        beginSelectionGesture({
          index,
          source: "right",
          clientX: event.clientX,
          clientY: event.clientY,
          preserveCurrentRangeIfSelected: true,
        });
      }
    },
    [
      activeBlockIndex,
      beginSelectionGesture,
      commitActiveBlock,
      disabled,
      focusContainer,
      selectedBlockSelection,
      toggleDiscreteBlockSelection,
    ],
  );

  const handleContentLayerMouseDownCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.closest("a[href],button,input,textarea,[data-md-block-control='true']")) {
        return;
      }
      if (target.closest(".markdown-hybrid-block[data-md-block-index]")) {
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        return;
      }
      if (selectedBlockSelection && !event.shiftKey) {
        clearSelectedBlockRange();
      }
      event.preventDefault();
      event.stopPropagation();
      beginMarqueeSelectionGesture({
        clientX: event.clientX,
        clientY: event.clientY,
        preserveAnchor: event.shiftKey && Boolean(selectedBlockSelection),
      });
    },
    [beginMarqueeSelectionGesture, clearSelectedBlockRange, disabled, selectedBlockSelection],
  );

  const handleEditorRootMouseDownCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (disabled || !selectedBlockSelection) {
        return;
      }
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.closest("textarea,a[href],button,input,[data-md-block-control='true']")) {
        return;
      }
      if (target.closest(".markdown-hybrid-block[data-md-block-index]")) {
        return;
      }
      clearSelectedBlockRange();
    },
    [clearSelectedBlockRange, disabled, selectedBlockSelection],
  );

  const handleBlockMouseDown = useCallback(
    (index: number) => (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      const target = event.target;
      const isInteractiveElement = target instanceof HTMLElement &&
        Boolean(target.closest("a[href],button,input,[data-md-block-control='true']"));
      const isTextareaElement = target instanceof HTMLElement &&
        Boolean(target.closest("textarea"));
      if (isInteractiveElement) {
        return;
      }

      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.button !== 0) {
        return;
      }
      if (isTextareaElement) {
        return;
      }
      if (
        blocks[index]?.kind === "blank" &&
        isStructuralSeparatorBlankBlock(blocks, index)
      ) {
        return;
      }
      if (selectedBlockSelection) {
        clearSelectedBlockRange();
      }
      if (activeBlockIndex === index) {
        return;
      }
      event.preventDefault();
      activateBlock(index, "end");
    },
    [
      activateBlock,
      activeBlockIndex,
      blocks,
      clearSelectedBlockRange,
      disabled,
      selectedBlockSelection,
    ],
  );

  const handleRenderedTaskCheckboxChange = useCallback(
    (blockIndex: number) => (event: FormEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      const target = event.target;
      if (
        !(target instanceof HTMLInputElement) ||
        target.type.toLowerCase() !== "checkbox" ||
        target.dataset.mdTaskCheckbox !== "true"
      ) {
        return;
      }

      event.stopPropagation();

      const block = blocks[blockIndex];
      if (!block || block.kind === "hr") {
        return;
      }

      const previewContainer = event.currentTarget;
      const taskCheckboxes = Array.from(
        previewContainer.querySelectorAll<HTMLInputElement>("input[data-md-task-checkbox='true']"),
      );
      const checkboxOrdinal = taskCheckboxes.indexOf(target);
      if (checkboxOrdinal < 0) {
        return;
      }

      const nextBlockRaw = toggleTaskCheckboxInBlockRaw(block.raw, checkboxOrdinal, target.checked);
      if (nextBlockRaw === block.raw) {
        return;
      }

      const nextMarkdown = applyEditorMarkdownNormalization(
        replaceMarkdownBlock(markdown, block, nextBlockRaw),
      );
      if (nextMarkdown === markdown) {
        return;
      }
      onChange(nextMarkdown);
      setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-commit"));
    },
    [blocks, disabled, markdown, onChange],
  );

  const handleBlockMouseEnter = useCallback(
    (index: number) => (event: MouseEvent<HTMLDivElement>) => {
      if (disabled || !isSelectionDragging || blocks.length === 0) {
        return;
      }
      const gesture = selectionGestureRef.current;
      if (!gesture?.active) {
        return;
      }
      if (gesture.source !== "right") {
        return;
      }
      const expectedButtonMask = gesture.source === "right" ? 2 : 1;
      if ((event.buttons & expectedButtonMask) !== expectedButtonMask) {
        return;
      }
      gesture.didDrag = true;
      updateSelectionRangeFocus(index);
    },
    [blocks.length, disabled, isSelectionDragging, updateSelectionRangeFocus],
  );

  const handleDragHandleDragStart = useCallback(
    (index: number) => (event: DragEvent<HTMLButtonElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      if (activeBlockIndex !== null) {
        commitActiveBlock({ deactivate: true });
      }
      const draggingSelectionGroup = Boolean(
        selectedBlockSelection &&
          selectedBlockSelection.selectedIndices.length > 1 &&
          isBlockIndexSelected(selectedBlockSelection, index),
      );
      if (!draggingSelectionGroup) {
        clearSelectedBlockRange();
      } else {
        setIsSelectionDragging(false);
        setSelectionContextMenuState(null);
        setSelectionMarqueeRect(null);
        selectionGestureRef.current = null;
      }
      setInsertMenuState(null);
      setDraggedBlockIndex(index);
      setDropIndicatorIndex(index);
      try {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      } catch {
        // ignore restricted dataTransfer implementations
      }
    },
    [
      activeBlockIndex,
      clearSelectedBlockRange,
      commitActiveBlock,
      disabled,
      selectedBlockSelection,
    ],
  );

  const handleDragHandleDragEnd = useCallback(() => {
    setDraggedBlockIndex(null);
    setDropIndicatorIndex(null);
  }, []);

  const handleBlockDragOver = useCallback(
    (index: number) => (event: DragEvent<HTMLDivElement>) => {
      if (disabled || draggedBlockIndex === null) {
        return;
      }
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const nextDropIndex = event.clientY < rect.top + rect.height / 2
        ? index
        : index + 1;
      if (dropIndicatorIndex !== nextDropIndex) {
        setDropIndicatorIndex(nextDropIndex);
      }
      try {
        event.dataTransfer.dropEffect = "move";
      } catch {
        // ignore
      }
    },
    [disabled, draggedBlockIndex, dropIndicatorIndex],
  );

  const handleBlockDrop = useCallback(
    (_index: number) => (event: DragEvent<HTMLDivElement>) => {
      if (disabled || draggedBlockIndex === null || dropIndicatorIndex === null) {
        return;
      }
      event.preventDefault();
      reorderBlockByDrop(draggedBlockIndex, dropIndicatorIndex);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
    },
    [disabled, draggedBlockIndex, dropIndicatorIndex, reorderBlockByDrop],
  );

  const handleHybridEditorContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      if (!(event.target instanceof HTMLElement)) {
        return;
      }
      if (event.target.closest("a[href],button,input,textarea,[data-md-block-control='true']")) {
        return;
      }
      const blockElement = event.target.closest<HTMLElement>(
        ".markdown-hybrid-block[data-md-block-index]",
      );
      if (!blockElement) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      if (suppressNextBlockContextMenuRef.current) {
        suppressNextBlockContextMenuRef.current = false;
        setSelectionContextMenuState(null);
        return;
      }

      const blockIndexRaw = blockElement.dataset.mdBlockIndex;
      if (typeof blockIndexRaw !== "string") {
        return;
      }
      const parsedIndex = Number.parseInt(blockIndexRaw, 10);
      if (!Number.isFinite(parsedIndex)) {
        return;
      }
      const blockIndex = clampIndex(parsedIndex, blocks.length);

      if (!isBlockIndexSelected(selectedBlockSelection, blockIndex)) {
        if (activeBlockIndex !== null) {
          commitActiveBlock({ deactivate: true });
        }
        setPendingActivation(null);
        setSingleBlockSelection(blockIndex);
      }

      setInsertMenuState(null);
      setSelectionContextMenuState({
        blockIndex,
        x: event.clientX,
        y: event.clientY,
      });
      selectionGestureRef.current = null;
      setIsSelectionDragging(false);
      focusContainer();
    },
    [
      activeBlockIndex,
      blocks.length,
      commitActiveBlock,
      disabled,
      focusContainer,
      selectedBlockSelection,
      setSingleBlockSelection,
    ],
  );

  const handleSelectionContextMenuMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const handleSelectionContextMenuItemMouseDown = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const handleSelectionContextMenuClearButton = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      handleSelectionContextMenuItemMouseDown(event);
      handleSelectionContextMenuClear(event);
    },
    [handleSelectionContextMenuClear, handleSelectionContextMenuItemMouseDown],
  );

  const handleSelectionContextMenuDeleteButton = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      handleSelectionContextMenuItemMouseDown(event);
      handleSelectionContextMenuDelete(event);
    },
    [handleSelectionContextMenuDelete, handleSelectionContextMenuItemMouseDown],
  );

  const activeInsertMenuCategoryId = insertMenuState?.categoryId;
  const activeInsertMenuItems = activeInsertMenuCategoryId &&
    activeInsertMenuCategoryId !== "advanced"
    ? (INSERT_MENU_ITEMS_BY_CATEGORY[activeInsertMenuCategoryId] ?? [])
    : [];
  const activeAdvancedInsertTemplateSections = activeInsertMenuCategoryId === "advanced"
    ? getAdvancedInsertTemplateSections(activeInsertMenuContext).map((section) => ({
      ...section,
      items: section.items.map<InsertMenuItem>((item) => ({
        id: item.id,
        label: item.label,
        description: item.description,
        template: item.payload,
        firstPlaceholder: item.firstPlaceholder,
        icon: item.icon,
      })),
    }))
    : [];

  const handleInsertMenuKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const menuElement = insertMenuRef.current;
    if (!menuElement) {
      return;
    }
    const menuItems = Array.from(
      menuElement.querySelectorAll<HTMLButtonElement>("button[role='menuitem']"),
    );
    if (menuItems.length === 0) {
      return;
    }
    const activeElement = document.activeElement;
    const currentIndex = menuItems.findIndex((item) => item === activeElement);
    const focusMenuItem = (nextIndex: number) => {
      const clampedIndex = clampIndex(nextIndex, menuItems.length);
      const nextItem = menuItems[clampedIndex];
      if (!nextItem) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      try {
        nextItem.focus({ preventScroll: true });
      } catch {
        nextItem.focus();
      }
    };

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      focusMenuItem(currentIndex < 0 ? 0 : (currentIndex + 1) % menuItems.length);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      focusMenuItem(
        currentIndex < 0
          ? menuItems.length - 1
          : (currentIndex - 1 + menuItems.length) % menuItems.length,
      );
      return;
    }
    if (event.key === "Home") {
      focusMenuItem(0);
      return;
    }
    if (event.key === "End") {
      focusMenuItem(menuItems.length - 1);
    }
  }, []);

  useEffect(() => {
    if (!insertMenuState) {
      return;
    }
    const handle = window.requestAnimationFrame(() => {
      const firstMenuItem = insertMenuRef.current?.querySelector<HTMLButtonElement>(
        "button[role='menuitem']",
      );
      if (!firstMenuItem) {
        return;
      }
      try {
        firstMenuItem.focus({ preventScroll: true });
      } catch {
        firstMenuItem.focus();
      }
    });
    return () => window.cancelAnimationFrame(handle);
  }, [insertMenuState]);

  const renderInsertMenuPanel = (blockIndex: number) => {
    const isInsertMenuOpen = Boolean(insertMenuState && insertMenuState.blockIndex === blockIndex);
    if (!isInsertMenuOpen) {
      return null;
    }
    return (
      <div
        ref={insertMenuRef}
        className="markdown-hybrid-insert-menu markdown-hybrid-insert-menu-overlay"
        data-md-block-control="true"
        role="menu"
        aria-label="Insert block"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onKeyDown={handleInsertMenuKeyDown}
      >
        <div className="markdown-hybrid-insert-menu-header">
          <span className="markdown-hybrid-insert-menu-title">
            {insertMenuState?.insertAbove ? "Insert Above" : "Insert Below"}
          </span>
          {insertMenuState?.phase === "items" ? (
            <button
              type="button"
              className="markdown-hybrid-insert-menu-nav"
              onClick={handleInsertMenuBack}
            >
              Back
            </button>
          ) : null}
        </div>
        <div className="markdown-hybrid-insert-menu-list">
          {insertMenuState?.phase === "categories"
            ? INSERT_MENU_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                className="markdown-hybrid-insert-menu-item markdown-hybrid-insert-menu-item-row"
                onClick={handleSelectInsertMenuCategory(category.id)}
                role="menuitem"
              >
                {renderInsertMenuRowContent({
                  label: category.label,
                  icon: category.icon,
                })}
              </button>
            ))
            : insertMenuState?.categoryId === "advanced"
            ? activeAdvancedInsertTemplateSections.flatMap((section) =>
              section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="markdown-hybrid-insert-menu-item markdown-hybrid-insert-menu-item-tile"
                  onClick={handleInsertMenuItemSelect(item)}
                  role="menuitem"
                  title={item.description}
                >
                  <span className="markdown-hybrid-insert-menu-item-tile-header">
                    {item.icon ? (
                      <span
                        className="markdown-hybrid-insert-menu-item-icon"
                        aria-hidden="true"
                        data-md-insert-menu-icon={item.icon}
                      >
                        <InsertMenuIconGraphic icon={item.icon} />
                      </span>
                    ) : null}
                    <span className="markdown-hybrid-insert-menu-item-label">{item.label}</span>
                  </span>
                  {item.description ? (
                    <span className="markdown-hybrid-insert-menu-item-description">
                      {item.description}
                    </span>
                  ) : null}
                </button>
              ))
            )
            : activeInsertMenuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="markdown-hybrid-insert-menu-item markdown-hybrid-insert-menu-item-row"
                onClick={handleInsertMenuItemSelect(item)}
                role="menuitem"
              >
                {renderInsertMenuRowContent({
                  label: item.label,
                  description: item.description,
                  icon: item.icon,
                })}
              </button>
            ))}
        </div>
        <button
          type="button"
          className="markdown-hybrid-insert-menu-close markdown-hybrid-insert-menu-item-row"
          onClick={handleInsertMenuClose}
        >
          {renderInsertMenuRowContent({
            label: "Close Menu (Esc)",
            icon: "close",
          })}
        </button>
      </div>
    );
  };

  const renderOverlayRow = (options: {
    blockIndex: number;
    kind: MarkdownBlock["kind"];
    top: number;
    height: number;
    isDragHandleDisabled?: boolean;
    insertButtonTitle?: string;
  }) => {
    const blockIndex = options.blockIndex;
    const isSelected = !disabled && isBlockIndexSelected(selectedBlockSelection, blockIndex);
    const isActive = !disabled && activeBlockIndex === blockIndex;
    const isGroupDrag = Boolean(
      draggedBlockIndex !== null &&
        selectedBlockSelection &&
        selectedBlockSelection.selectedIndices.length > 1 &&
        isBlockIndexSelected(selectedBlockSelection, draggedBlockIndex),
    );
    const isDragging = isGroupDrag
      ? isBlockIndexSelected(selectedBlockSelection, blockIndex)
      : draggedBlockIndex === blockIndex;
    return (
      <div
        key={`overlay-row:${blockIndex}`}
        className="markdown-hybrid-overlay-row"
        data-md-block-index={blockIndex}
        data-md-block-id={String(blockIndex)}
        data-md-block-kind={options.kind}
        style={{ top: options.top, height: options.height }}
      >
        <div className="markdown-hybrid-overlay-rail markdown-hybrid-overlay-rail-left">
          <button
            type="button"
            className="markdown-hybrid-overlay-control markdown-hybrid-block-control markdown-hybrid-block-drag-handle"
            data-md-block-control="true"
            draggable={!disabled && !options.isDragHandleDisabled}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onDragStart={handleDragHandleDragStart(blockIndex)}
            onDragEnd={handleDragHandleDragEnd}
            aria-label="Block verschieben"
            title={options.isDragHandleDisabled ? "No block available" : "Move block"}
            disabled={disabled || options.isDragHandleDisabled}
          >
            <span aria-hidden="true">⋮⋮</span>
          </button>
          <button
            type="button"
            className="markdown-hybrid-overlay-control markdown-hybrid-block-control markdown-hybrid-block-insert-button"
            data-md-block-control="true"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={handleOpenInsertMenu(blockIndex)}
            aria-label="Insert block"
            title={options.insertButtonTitle ?? "Insert block below (Shift = above)"}
            disabled={disabled}
          >
            <span aria-hidden="true">+</span>
          </button>
          {renderInsertMenuPanel(blockIndex)}
        </div>
        <div className="markdown-hybrid-overlay-rail markdown-hybrid-overlay-rail-right">
          <span
            className={`markdown-hybrid-overlay-right-status${
              isSelected ? " is-selected" : ""
            }${isActive ? " is-active" : ""}${isDragging ? " is-dragging" : ""}`}
            aria-hidden="true"
            title={
              isDragging
                ? "Block wird verschoben"
                : isActive
                ? "Block im Edit-Modus"
                : isSelected
                ? "Block markiert"
                : "Block"
            }
          >
            |
          </span>
        </div>
      </div>
    );
  };

  const selectionContextMenu = selectionContextMenuState && !disabled && selectedBlockSelection ? (
    <div
      ref={selectionContextMenuRef}
      className="markdown-hybrid-selection-menu"
      role="menu"
      aria-label="Blockauswahl"
      data-md-block-control="true"
      style={{ left: selectionContextMenuState.x, top: selectionContextMenuState.y }}
      onMouseDown={handleSelectionContextMenuMouseDown}
    >
      <button
        type="button"
        className="markdown-hybrid-selection-menu-item is-danger"
        role="menuitem"
        onMouseDown={handleSelectionContextMenuItemMouseDown}
        onClick={handleSelectionContextMenuDeleteButton}
      >
        Delete
      </button>
      <button
        type="button"
        className="markdown-hybrid-selection-menu-item"
        role="menuitem"
        onMouseDown={handleSelectionContextMenuItemMouseDown}
        onClick={handleSelectionContextMenuClearButton}
      >
        Auswahl aufheben
      </button>
    </div>
  ) : null;

  if (blocks.length === 0) {
    const emptyOverlayRect = overlayLayout.byIndex.get(0) ?? {
      index: 0,
      top: 0,
      height: 28,
      kind: "blank" as MarkdownBlock["kind"],
    };
    return (
      <div
        ref={containerRef}
        className={`markdown-hybrid-editor${disabled ? " is-disabled" : ""}${
          isSelectionDragging ? " is-selection-dragging" : ""
        }`}
        style={editorSurfaceStyle}
        tabIndex={0}
        onMouseDownCapture={handleEditorRootMouseDownCapture}
        onKeyDown={handleContainerKeyDown}
        onContextMenu={handleHybridEditorContextMenu}
      >
        <div
          ref={contentLayerRef}
          className="markdown-hybrid-content-layer"
          onMouseDownCapture={handleContentLayerMouseDownCapture}
        >
          <div
            className={`markdown-hybrid-block markdown-hybrid-block-empty${
              disabled ? " is-disabled" : ""
            }`}
            aria-selected={false}
            data-md-block-kind="blank"
            data-md-block-index={0}
            data-md-block-id="0"
            onMouseDown={(event) => {
              if (disabled) {
                return;
              }
              if (event.button !== 0) {
                return;
              }
              event.preventDefault();
              clearSelectedBlockRange();
              setActiveBlockIndex(0);
              setActiveDraft("");
              setActiveDirty(false);
              pendingCaretRef.current = "start";
            }}
          >
            <div className="markdown-hybrid-block-body">
              {activeBlockIndex === 0 && !disabled ? (
                <div className="markdown-hybrid-block-editor-shell">
                  <div
                    className="markdown-hybrid-block-editor-overlay"
                    aria-hidden="true"
                  >
                    <div
                      ref={editorSyntaxOverlayContentRef}
                      className="markdown-hybrid-block-editor-overlay-content"
                    >
                      {activeEditorSyntaxOverlayContent}
                    </div>
                  </div>
                    <textarea
                      ref={textareaRef}
                      className="markdown-hybrid-block-editor markdown-hybrid-block-editor-syntax-overlay"
                      value={activeDraft}
                      rows={1}
                      onChange={(event) =>
                        handleTextareaChange(event.target.value, event.target.selectionStart)}
                      onBlur={handleTextareaBlur}
                      onKeyDown={handleTextareaKeyDown}
                      onSelect={handleTextareaSelect}
                      onScroll={handleTextareaScroll}
                      aria-label="Markdown block editor"
                    />
                </div>
              ) : (
                <div className="markdown-hybrid-empty-placeholder" aria-hidden="true" />
              )}
            </div>
          </div>
        </div>
        {selectionMarqueeRect ? (
          <div
            className="markdown-hybrid-selection-marquee"
            aria-hidden="true"
            style={{
              left: selectionMarqueeRect.left,
              top: selectionMarqueeRect.top,
              width: selectionMarqueeRect.width,
              height: selectionMarqueeRect.height,
            }}
          />
        ) : null}
        <div className="markdown-hybrid-controls-overlay">
          {renderOverlayRow({
            blockIndex: 0,
            kind: emptyOverlayRect.kind,
            top: emptyOverlayRect.top,
            height: emptyOverlayRect.height,
            isDragHandleDisabled: true,
            insertButtonTitle: "Insert block",
          })}
        </div>
        {selectionContextMenu}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`markdown-hybrid-editor${disabled ? " is-disabled" : ""}${
        isSelectionDragging ? " is-selection-dragging" : ""
      }`}
      style={editorSurfaceStyle}
      tabIndex={0}
      onMouseDownCapture={handleEditorRootMouseDownCapture}
      onKeyDown={handleContainerKeyDown}
      onContextMenu={handleHybridEditorContextMenu}
    >
      <div
        ref={contentLayerRef}
        className="markdown-hybrid-content-layer"
        onMouseDownCapture={handleContentLayerMouseDownCapture}
      >
        {blocks.map((block, index) => {
          const isActive = activeBlockIndex === index && !disabled;
          const headingEditorPlaceholder = isActive
            ? resolveHeadingEditorPlaceholder(block, activeDraft)
            : null;
          const headingPreviewPlaceholder = !isActive
            ? resolveHeadingEditorPlaceholder(block, block.raw)
            : null;
          const isStructuralBlankSeparator =
            !isActive && isStructuralSeparatorBlankBlock(blocks, index);
          const isRangeSelected = !disabled && isBlockIndexSelected(selectedBlockSelection, index);
          const isGroupDrag = Boolean(
            draggedBlockIndex !== null &&
              selectedBlockSelection &&
              selectedBlockSelection.selectedIndices.length > 1 &&
              isBlockIndexSelected(selectedBlockSelection, draggedBlockIndex),
          );
          const isDragging = isGroupDrag
            ? isBlockIndexSelected(selectedBlockSelection, index)
            : draggedBlockIndex === index;
          const hasDropIndicatorTop = dropIndicatorIndex === index;
          const hasDropIndicatorBottom = dropIndicatorIndex === index + 1;
          let previewBlockSource = block.kind === "help-block"
            ? normalizeHelpBlockPreviewSource(block.raw)
            : block.kind === "hr"
            ? normalizeHorizontalRuleBlockSource(block.raw)
            : block.raw;
          const cardBlockPreviewParts = block.kind === "card-block"
            ? extractCardBlockPreviewParts(block.raw)
            : null;
          if (block.kind !== "hr" && block.kind !== "code-fence") {
            previewBlockSource = escapeHybridPreviewSpecialLines(previewBlockSource);
          }
          return (
            <div
              key={blockRenderKeys[index] ?? block.id}
              className={`markdown-hybrid-block markdown-hybrid-block-${block.kind}${
                isActive ? " is-active" : ""
              }${isStructuralBlankSeparator ? " is-structural-separator" : ""}${
                isRangeSelected ? " is-range-selected" : ""
              }${
                isDragging ? " is-dragging" : ""
              }${hasDropIndicatorTop ? " has-drop-indicator-top" : ""}${
                hasDropIndicatorBottom ? " has-drop-indicator-bottom" : ""
              }`}
              aria-selected={isRangeSelected || undefined}
              data-md-block-selected={isRangeSelected ? "true" : undefined}
              data-md-block-kind={block.kind}
              data-md-block-index={index}
              data-md-block-id={String(index)}
              onMouseDownCapture={handleBlockMouseDownCapture(index)}
              onMouseDown={handleBlockMouseDown(index)}
              onMouseEnter={handleBlockMouseEnter(index)}
              onDragOver={handleBlockDragOver(index)}
              onDrop={handleBlockDrop(index)}
            >
              <div className="markdown-hybrid-block-body">
                {isActive ? (
                  <div className="markdown-hybrid-block-editor-shell">
                    <div
                      className="markdown-hybrid-block-editor-overlay"
                      aria-hidden="true"
                    >
                      <div
                        ref={editorSyntaxOverlayContentRef}
                        className="markdown-hybrid-block-editor-overlay-content"
                      >
                        {activeEditorSyntaxOverlayContent}
                      </div>
                    </div>
                    <textarea
                      ref={textareaRef}
                      className="markdown-hybrid-block-editor markdown-hybrid-block-editor-syntax-overlay"
                      value={activeDraft}
                      rows={Math.max(1, activeDraft.split("\n").length)}
                      onChange={(event) =>
                        handleTextareaChange(event.target.value, event.target.selectionStart)}
                      onBlur={handleTextareaBlur}
                      onKeyDown={handleTextareaKeyDown}
                      onSelect={handleTextareaSelect}
                      onScroll={handleTextareaScroll}
                      aria-label="Markdown block editor"
                    />
                    {headingEditorPlaceholder ? (
                      <div
                        className={`markdown-hybrid-heading-editor-placeholder markdown-hybrid-heading-editor-placeholder-level-${headingEditorPlaceholder.level}`}
                        aria-hidden="true"
                      >
                        <span className="markdown-hybrid-heading-editor-placeholder-prefix">
                          {headingEditorPlaceholder.prefix}
                        </span>
                        <span className="markdown-hybrid-heading-editor-placeholder-text">
                          {headingEditorPlaceholder.label}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : block.kind === "blank" ? (
                  <div className="markdown-hybrid-blank-preview" aria-hidden="true" />
                ) : block.kind === "heading" && headingPreviewPlaceholder ? (
                  <div className="markdown-hybrid-block-preview">
                    <div
                      className={`markdown-hybrid-heading-preview-placeholder markdown-hybrid-heading-preview-placeholder-level-${headingPreviewPlaceholder.level}`}
                      aria-hidden="true"
                    >
                      {headingPreviewPlaceholder.label}
                    </div>
                  </div>
                ) : block.kind === "hr" ? (
                  <div className="markdown-hybrid-hr-shell">
                    <button
                      type="button"
                      className="markdown-hybrid-hr-enter-zone markdown-hybrid-hr-enter-zone-top"
                      data-md-block-control="true"
                      onMouseDown={handleHrEnterZoneMouseDown}
                      onClick={handleHrEnterZoneClick}
                      onKeyDown={handleHrEnterZoneKeyDown(index, true)}
                      aria-label="Textblock oberhalb der Trennlinie einfuegen"
                      title="Enterbereich oberhalb der Trennlinie"
                    />
                    <div
                      className="markdown-hybrid-block-preview"
                      onChange={handleRenderedTaskCheckboxChange(index)}
                    >
                      {renderPreview(previewBlockSource)}
                    </div>
                    <button
                      type="button"
                      className="markdown-hybrid-hr-enter-zone markdown-hybrid-hr-enter-zone-bottom"
                      data-md-block-control="true"
                      onMouseDown={handleHrEnterZoneMouseDown}
                      onClick={handleHrEnterZoneClick}
                      onKeyDown={handleHrEnterZoneKeyDown(index, false)}
                      aria-label="Textblock unterhalb der Trennlinie einfuegen"
                      title="Enterbereich unterhalb der Trennlinie"
                    />
                  </div>
                ) : block.kind === "card-block" && cardBlockPreviewParts ? (
                  <div
                    className="markdown-hybrid-card-block-preview"
                    onChange={handleRenderedTaskCheckboxChange(index)}
                  >
                    <div className="markdown-hybrid-card-block-frame">
                      {cardBlockPreviewParts.parts.map((part, partIndex) =>
                        part.kind === "help" ? (
                          <div
                            key={`card-part:${index}:${partIndex}`}
                            className="markdown-hybrid-card-help-subbox"
                          >
                            <div className="markdown-hybrid-block-preview">
                              {part.source.trim().length > 0 ? renderPreview(part.source) : null}
                            </div>
                          </div>
                        ) : part.source.trim().length > 0 ? (
                          <div
                            key={`card-part:${index}:${partIndex}`}
                            className="markdown-hybrid-block-preview"
                          >
                            {renderPreview(part.source)}
                          </div>
                        ) : (
                          <div
                            key={`card-part:${index}:${partIndex}`}
                            className="markdown-hybrid-card-block-empty"
                            aria-hidden="true"
                          />
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className="markdown-hybrid-block-preview"
                    onChange={handleRenderedTaskCheckboxChange(index)}
                  >
                    {renderPreview(previewBlockSource)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {selectionMarqueeRect ? (
        <div
          className="markdown-hybrid-selection-marquee"
          aria-hidden="true"
          style={{
            left: selectionMarqueeRect.left,
            top: selectionMarqueeRect.top,
            width: selectionMarqueeRect.width,
            height: selectionMarqueeRect.height,
          }}
        />
      ) : null}
      <div className="markdown-hybrid-controls-overlay">
        {overlayRows.map((overlayRow) => {
          if (
            activeBlockIndex !== overlayRow.index &&
            isStructuralSeparatorBlankBlock(blocks, overlayRow.index)
          ) {
            return null;
          }
          return renderOverlayRow({
            blockIndex: overlayRow.index,
            kind: overlayRow.kind,
            top: overlayRow.top,
            height: overlayRow.height,
          });
        })}
      </div>
      {selectionContextMenu}
    </div>
  );
};
