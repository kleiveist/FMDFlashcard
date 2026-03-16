/**
 * @file apps/fmd-desktop/src/features/preview/MarkdownHybridEditor.tsx
 *
 * Zweck:
 * - Zeigt Markdown als Blockliste an.
 * - Nur der aktive Block ist als Raw-Textarea editierbar.
 */

import {
  Children,
  type ClipboardEvent,
  type CSSProperties,
  cloneElement,
  createElement,
  type DragEvent,
  type FocusEvent,
  type FormEvent,
  forwardRef,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FlashcardMediaGroup } from "../../components/flashcards/FlashcardMediaGroup";
import { VaultPngPicker } from "../../components/media/VaultPngPicker";
import {
  buildVaultImageCandidates,
  filterVaultImageCandidates,
  serializePngEmbed,
  splitMarkdownMediaSegments,
  type MediaItem,
  type VaultImageCandidate,
} from "../../lib/cardMedia";
import {
  findMathTokenCoveringRange,
  normalizeMultilineInlineMathOnCommit,
  rangeIntersectsMarkdownCodeContext,
  type MathToken,
} from "../../lib/markdownMath";
import { normalizeRelativePath } from "../../lib/path";
import { type VaultFile, type VaultPngAsset } from "../../lib/tree";
import {
  normalizeCardBlockSource,
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
  buildAdvancedInsertTemplateVariant,
  getAdvancedInsertTemplateSections,
  getAdvancedInsertTemplateById,
  type AdvancedInsertTemplateContext,
  type AdvancedInsertTemplateIconId,
  type AdvancedInsertTemplateVariant,
} from "./insertTemplates";
import {
  extractMathBlockBody,
  MathBlockRenderer,
  normalizeMathBlockSource,
} from "./mathBlocks";
import {
  MarkdownHybridTableBlock,
  type MarkdownHybridTableActivationRequest,
  type MarkdownHybridTableSessionController,
} from "./MarkdownHybridTableBlock";
import {
  FloatingInlineFormattingToolbar,
  type InlineFormattingToolbarAnchor,
  type InlineFormattingToolbarLinkState,
  type InlineFormattingToolbarMenu,
} from "./FloatingInlineFormattingToolbar";
import {
  INLINE_FORMATTING_WRAPPERS,
  applyInlineMarkdownLink,
  findInlineMarkdownLinkAtRange,
  normalizeInlineFormattingRange,
  resolveInlineFormattingShortcutAction,
  resolveInlineFormattingToolbarActiveState,
  stripInlineFormattingAroundRange,
  stripSupportedInlineMarkdownFormatting,
  toggleInlineFormattingWrapper,
  type InlineFormattingMathMenuAction,
  type InlineFormattingToggleResult,
  type InlineFormattingToolbarAction,
  type InlineFormattingToolbarActiveState,
  type InlineFormattingToolbarRange,
} from "./inlineFormatting";
import { MathStructureDialog } from "./math-editor/MathStructureDialog";

export type MarkdownHybridEditorMode = "edit" | "write";
export type MarkdownHybridEditorHandle = {
  commitActiveEdit: () => Promise<boolean>;
  discardActiveEdit: () => Promise<boolean>;
  insertStructureTemplate: (template: "table" | "code-block" | "math-block") => Promise<boolean>;
  openImageInsertPicker: () => Promise<boolean>;
};

type PendingActivation = {
  index: number;
  caret: "start" | "end";
  selection?: {
    start: number;
    end: number;
  };
};

type PendingTableActivation = {
  blockIndex: number;
  request: MarkdownHybridTableActivationRequest;
};

type CardTableSegmentTarget = {
  blockIndex: number;
  blockId: string;
  partIndex: number;
  segmentIndex: number;
};

type ActiveCardTableState = CardTableSegmentTarget & {
  pendingActivation: MarkdownHybridTableActivationRequest | null;
};

type ActiveEditSnapshot = {
  blockIndex: number;
  blockId: string;
  kind: MarkdownBlock["kind"];
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  raw: string;
  draft: string;
  isDetachedEmptyBlock?: boolean;
};

type DeferredEditAction = {
  kind: "commit" | "discard";
  options?: {
    deactivate?: boolean;
    nextActivation?: PendingActivation | null;
  };
};

type DeferredEditRequest = {
  kind: DeferredEditAction["kind"];
  resolve: (value: boolean) => void;
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
  startContentX: number;
  startContentY: number;
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
  phase: "categories" | "items" | "advanced-variant" | "image-link-picker";
  categoryId?: InsertMenuCategoryId;
  advancedTemplateId?: string;
  advancedSequenceNumber?: number;
  query?: string;
  highlightedIndex?: number;
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
  initialSelection?: {
    start: number;
    end: number;
  };
  icon?: InsertMenuIconId;
};

type InsertMenuAdvancedVariantOption = {
  id: AdvancedInsertTemplateVariant;
  label: string;
  description: string;
  icon: InsertMenuIconId;
};

type InsertMenuIconId =
  | "blocks"
  | "table"
  | "link"
  | "page-file"
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
  | "math-block"
  | "divider"
  | "quote"
  | "nested-quote"
  | AdvancedInsertTemplateIconId
  | "close";

type MathToolboxState = {
  blockIndex: number;
  sessionId: string;
  initialLatexSnapshot: string;
};

type InlineFormattingToolbarSelection = {
  blockIndex: number;
  start: number;
  end: number;
  anchor: InlineFormattingToolbarAnchor;
  activeState: InlineFormattingToolbarActiveState;
};

type MarkdownHybridEditorProps = {
  historyKey: string;
  markdown: string;
  mode: MarkdownHybridEditorMode;
  disabled?: boolean;
  vaultFiles?: VaultFile[];
  vaultPngAssets?: VaultPngAsset[];
  vaultPath?: string | null;
  sourceRelativePath?: string | null;
  onNavigateWikilink?: (wikilink: string) => void;
  onChange: (value: string) => void;
  onCommit?: (value: string, context: { block: MarkdownBlock }) => void;
  onDirtyChange?: (dirty: boolean) => void;
  renderPreview: (markdown: string) => ReactNode;
};

const INTERNAL_BLOCK_CLIPBOARD_MIME = "application/x-fmd-markdown-hybrid-blocks+json";
const INTERNAL_BLOCK_CLIPBOARD_SOURCE = "fmd-markdown-hybrid-editor";
const INTERNAL_BLOCK_CLIPBOARD_VERSION = 1;
const MARKDOWN_BLOCK_KIND_SET = new Set<MarkdownBlock["kind"]>([
  "blank",
  "heading",
  "paragraph",
  "math-block",
  "card-block",
  "help-block",
  "image-embed",
  "ordered-list",
  "unordered-list",
  "table",
  "code-fence",
  "blockquote",
  "hr",
]);

type ClipboardBlockEntry = {
  kind: MarkdownBlock["kind"];
  raw: string;
};

type InternalBlockClipboardPayload = {
  version: number;
  source: string;
  createdAt: string;
  blocks: ClipboardBlockEntry[];
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
      id: "math-block-structure",
      label: "Math Block",
      template: "$$\n\n$$",
      initialSelection: { start: 3, end: 3 },
      icon: "math-block",
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
      template: "",
      icon: "page-file",
    },
    {
      id: "image-link",
      label: "Image embed",
      template: "",
      description: "Insert a standalone PNG embed block",
      icon: "page-file",
    },
  ],
  advanced: [],
};

const INSERT_MENU_ADVANCED_VARIANTS: ReadonlyArray<InsertMenuAdvancedVariantOption> = [
  {
    id: "task",
    label: "Task",
    description: "Insert as numbered exam task",
    icon: "list-ordered",
  },
  {
    id: "card",
    label: "Card",
    description: "Insert as #card block",
    icon: "blocks",
  },
];

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
    case "page-file":
      return (
        <svg {...svgProps}>
          <path d="M8 4.8h6.8l3.2 3.2V19a1.5 1.5 0 0 1-1.5 1.5h-8.5A1.5 1.5 0 0 1 6.5 19V6.3A1.5 1.5 0 0 1 8 4.8z" />
          <path d="M14.8 4.8V8h3.2" />
          <line x1="9.3" y1="12.2" x2="15.8" y2="12.2" />
          <line x1="9.3" y1="15.4" x2="14" y2="15.4" />
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
    case "math-block":
      return (
        <svg {...svgProps}>
          <path d="M5 8h5l2 8 2.2-6 2.1 6L19 8h2" />
          <path d="M8 5.5h8" />
          <path d="M8 18.5h8" />
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

type PageLinkPickerSource = "insert-menu" | "typed-trigger";

type PageLinkPickerReplaceRange = {
  start: number;
  end: number;
};

type PendingTypedImageLinkPickerRequest = {
  replaceRange?: PageLinkPickerReplaceRange;
};

type TypedImageLinkPickerState = {
  blockIndex: number;
  replaceRange: PageLinkPickerReplaceRange;
  anchorLeft: number;
  anchorTop: number;
  query: string;
  highlightedIndex: number;
};

type PendingPageLinkPickerRequest = {
  source: PageLinkPickerSource;
  replaceRange?: PageLinkPickerReplaceRange;
};

type PageLinkPickerState = {
  source: PageLinkPickerSource;
  blockIndex: number;
  replaceRange: PageLinkPickerReplaceRange;
  anchorLeft: number;
  anchorTop: number;
  query: string;
  highlightedIndex: number;
};

type ImageEmbedReplacePickerState = {
  blockIndex: number;
  blockId: string;
  query: string;
  highlightedIndex: number;
};

type PageLinkCandidate = {
  id: string;
  target: string;
  wikilink: string;
  label: string;
  sublabel?: string;
  searchText: string;
};

type ResolvedInlinePageLink = {
  wikilink: string;
  label: string;
  exists: boolean;
};

type AdjacentWikilinkRange = {
  start: number;
  end: number;
};

const inlineWikilinkTokenPattern = /\[\[[^\]\n]+?\]\]/g;
const inlineWikilinkOpenTrigger = /\[\[$/;
const inlineImageEmbedOpenTrigger = /!\[\[$/;
const inlineWikilinkSkipTags = new Set(["a", "code", "pre", "kbd", "samp"]);
const reactMarkdownWikilinkWrappedTagNames = [
  "p",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "td",
  "th",
] as const;

const stripMarkdownExtension = (value: string) => value.replace(/\.md$/i, "");

const getPathBasename = (value: string) => {
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
};

const resolveWikilinkLabelFromTarget = (target: string) => stripMarkdownExtension(getPathBasename(target.trim()));

const parseInlineWikilink = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[[") || !trimmed.endsWith("]]")) {
    return null;
  }
  const inner = trimmed.slice(2, -2).trim();
  if (!inner) {
    return null;
  }
  const [targetRaw, aliasRaw] = inner.split("|");
  const target = (targetRaw ?? "").trim();
  if (!target) {
    return null;
  }
  const alias = aliasRaw?.trim() || null;
  return {
    target,
    alias,
    label: alias || resolveWikilinkLabelFromTarget(target),
  };
};

const canOpenPageLinkPickerInBlockKind = (kind: MarkdownBlock["kind"]) =>
  kind !== "code-fence" && kind !== "hr" && kind !== "table" && kind !== "math-block";

const detectTypedPageLinkTrigger = (
  value: string,
  selectionStart: number | null | undefined,
): PageLinkPickerReplaceRange | null => {
  if (typeof selectionStart !== "number") {
    return null;
  }
  const safeSelectionStart = Math.max(0, Math.min(selectionStart, value.length));
  const before = value.slice(0, safeSelectionStart);
  if (safeSelectionStart >= 3 && value[safeSelectionStart - 3] === "!") {
    return null;
  }
  if (!inlineWikilinkOpenTrigger.test(before)) {
    return null;
  }
  return {
    start: safeSelectionStart - 2,
    end: safeSelectionStart,
  };
};

const detectTypedImageEmbedTrigger = (
  value: string,
  selectionStart: number | null | undefined,
): PageLinkPickerReplaceRange | null => {
  if (typeof selectionStart !== "number") {
    return null;
  }
  const safeSelectionStart = Math.max(0, Math.min(selectionStart, value.length));
  const before = value.slice(0, safeSelectionStart);
  if (!inlineImageEmbedOpenTrigger.test(before)) {
    return null;
  }
  return {
    start: safeSelectionStart - 3,
    end: safeSelectionStart,
  };
};

const findAdjacentWikilinkRange = (
  value: string,
  caret: number,
  direction: "Backspace" | "Delete",
): AdjacentWikilinkRange | null => {
  if (caret < 0 || caret > value.length) {
    return null;
  }
  inlineWikilinkTokenPattern.lastIndex = 0;
  let match = inlineWikilinkTokenPattern.exec(value);
  while (match) {
    const raw = match[0] ?? "";
    const start = match.index;
    const end = start + raw.length;
    if (start > 0 && value[start - 1] === "!") {
      match = inlineWikilinkTokenPattern.exec(value);
      continue;
    }
    if (direction === "Backspace" && end === caret) {
      return { start, end };
    }
    if (direction === "Delete" && start === caret) {
      return { start, end };
    }
    if (start > caret && direction === "Delete") {
      break;
    }
    match = inlineWikilinkTokenPattern.exec(value);
  }
  return null;
};

const buildPageLinkCandidates = (vaultFiles?: VaultFile[]): PageLinkCandidate[] => {
  if (!vaultFiles || vaultFiles.length === 0) {
    return [];
  }
  const seenTargets = new Set<string>();
  const candidates: PageLinkCandidate[] = [];

  for (const file of vaultFiles) {
    const relative = normalizeRelativePath(file.relative_path ?? "");
    if (!/\.md$/i.test(relative)) {
      continue;
    }
    const normalizedRelative = relative.replace(/^\/+/, "");
    const target = stripMarkdownExtension(normalizedRelative);
    if (!target) {
      continue;
    }
    const targetKey = target.toLowerCase();
    if (seenTargets.has(targetKey)) {
      continue;
    }
    seenTargets.add(targetKey);
    const label = resolveWikilinkLabelFromTarget(target);
    candidates.push({
      id: `${targetKey}:${normalizedRelative.toLowerCase()}`,
      target,
      wikilink: `[[${target}]]`,
      label,
      sublabel: normalizedRelative === `${label}.md` ? undefined : normalizedRelative,
      searchText: `${label} ${target} ${normalizedRelative}`.toLowerCase(),
    });
  }

  candidates.sort((left, right) => {
    const labelCompare = left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
    if (labelCompare !== 0) {
      return labelCompare;
    }
    return left.target.localeCompare(right.target, undefined, { sensitivity: "base" });
  });
  return candidates;
};

type PageLinkLookup = {
  byTarget: Map<string, PageLinkCandidate>;
  byRelativeWithExtension: Map<string, PageLinkCandidate>;
  byBasename: Map<string, PageLinkCandidate>;
};

const buildPageLinkLookup = (candidates: PageLinkCandidate[]): PageLinkLookup => {
  const byTarget = new Map<string, PageLinkCandidate>();
  const byRelativeWithExtension = new Map<string, PageLinkCandidate>();
  const byBasename = new Map<string, PageLinkCandidate>();

  for (const candidate of candidates) {
    byTarget.set(candidate.target.toLowerCase(), candidate);
    byRelativeWithExtension.set(`${candidate.target.toLowerCase()}.md`, candidate);
    const basename = resolveWikilinkLabelFromTarget(candidate.target).toLowerCase();
    if (!byBasename.has(basename)) {
      byBasename.set(basename, candidate);
    }
  }

  return {
    byTarget,
    byRelativeWithExtension,
    byBasename,
  };
};

const resolvePageLinkCandidate = (
  lookup: PageLinkLookup,
  target: string,
): PageLinkCandidate | null => {
  const normalizedTarget = normalizeRelativePath(target).replace(/^\/+/, "");
  if (!normalizedTarget) {
    return null;
  }
  const withoutExtension = stripMarkdownExtension(normalizedTarget);
  const lowerWithoutExtension = withoutExtension.toLowerCase();
  const lowerWithExtension = normalizedTarget.toLowerCase();
  const basenameWithoutExtension = resolveWikilinkLabelFromTarget(normalizedTarget).toLowerCase();
  return lookup.byTarget.get(lowerWithoutExtension) ??
    lookup.byRelativeWithExtension.get(lowerWithExtension) ??
    lookup.byBasename.get(basenameWithoutExtension) ??
    null;
};

const filterPageLinkCandidates = (candidates: PageLinkCandidate[], query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return candidates;
  }
  return candidates.filter((candidate) => candidate.searchText.includes(normalizedQuery));
};

const extractImageEmbedTokenFromRaw = (blockRaw: string) => {
  const firstMediaItem = splitMarkdownMediaSegments(blockRaw, "markdown-hybrid-image-embed-replace-token")
    .flatMap((segment) => (segment.kind === "media" ? segment.items : []))
    .find((item) => item.type === "png");
  if (!firstMediaItem || firstMediaItem.type !== "png") {
    return null;
  }
  return {
    src: firstMediaItem.src,
    label: firstMediaItem.label,
  };
};

const escapeHtmlForMirror = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const resolveTextareaCaretAnchor = (
  textarea: HTMLTextAreaElement,
  container: HTMLElement,
  caret: number,
) => {
  const safeCaret = Math.max(0, Math.min(caret, textarea.value.length));
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const mirrorStyle = mirror.style;
  mirrorStyle.position = "absolute";
  mirrorStyle.visibility = "hidden";
  mirrorStyle.pointerEvents = "none";
  mirrorStyle.zIndex = "-1";
  mirrorStyle.top = "0";
  mirrorStyle.left = "-99999px";
  mirrorStyle.whiteSpace = "pre-wrap";
  mirrorStyle.wordBreak = "break-word";
  mirrorStyle.overflowWrap = "break-word";
  mirrorStyle.boxSizing = "border-box";
  mirrorStyle.width = `${textarea.clientWidth}px`;
  mirrorStyle.padding = computed.padding;
  mirrorStyle.border = computed.border;
  mirrorStyle.font = computed.font;
  mirrorStyle.fontFamily = computed.fontFamily;
  mirrorStyle.fontSize = computed.fontSize;
  mirrorStyle.fontWeight = computed.fontWeight;
  mirrorStyle.fontStyle = computed.fontStyle;
  mirrorStyle.fontVariant = computed.fontVariant;
  (mirrorStyle as CSSStyleDeclaration & { fontStretch?: string }).fontStretch =
    (computed as CSSStyleDeclaration & { fontStretch?: string }).fontStretch ?? "normal";
  mirrorStyle.lineHeight = computed.lineHeight;
  mirrorStyle.letterSpacing = computed.letterSpacing;
  mirrorStyle.textTransform = computed.textTransform;
  mirrorStyle.textIndent = computed.textIndent;
  (mirrorStyle as CSSStyleDeclaration & { tabSize?: string }).tabSize =
    (computed as CSSStyleDeclaration & { tabSize?: string }).tabSize ?? "8";

  const beforeText = escapeHtmlForMirror(textarea.value.slice(0, safeCaret))
    .replace(/\n$/g, "\n ");
  mirror.innerHTML = `${beforeText}<span data-md-caret-anchor=\"true\">&#8203;</span>`;
  document.body.appendChild(mirror);

  const marker = mirror.querySelector<HTMLElement>("[data-md-caret-anchor='true']");
  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker?.getBoundingClientRect() ?? mirrorRect;
  const textareaRect = textarea.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const resolvedLineHeight = Number.parseFloat(computed.lineHeight);
  const lineHeight = Number.isFinite(resolvedLineHeight) && resolvedLineHeight > 0
    ? resolvedLineHeight
    : (Number.parseFloat(computed.fontSize) || 16) * 1.4;

  const anchorLeft = textareaRect.left - containerRect.left + container.scrollLeft +
    (markerRect.left - mirrorRect.left) - textarea.scrollLeft;
  const anchorTop = textareaRect.top - containerRect.top + container.scrollTop +
    (markerRect.top - mirrorRect.top) - textarea.scrollTop + lineHeight;

  mirror.remove();
  return {
    left: Math.max(0, Math.round(anchorLeft)),
    top: Math.max(0, Math.round(anchorTop)),
  };
};

const resolveTextareaSelectionToolbarAnchor = (
  textarea: HTMLTextAreaElement,
  container: HTMLElement,
  range: InlineFormattingToolbarRange,
): InlineFormattingToolbarAnchor | null => {
  const normalized = normalizeInlineFormattingRange(textarea.value, range);
  if (normalized.start === normalized.end) {
    return null;
  }
  const startAnchor = resolveTextareaCaretAnchor(textarea, container, normalized.start);
  const endAnchor = resolveTextareaCaretAnchor(textarea, container, normalized.end);
  const computed = window.getComputedStyle(textarea);
  const rawLineHeight = Number.parseFloat(computed.lineHeight);
  const lineHeight = Number.isFinite(rawLineHeight) && rawLineHeight > 0
    ? rawLineHeight
    : (Number.parseFloat(computed.fontSize) || 16) * 1.4;
  const sameLine = Math.abs(startAnchor.top - endAnchor.top) <= lineHeight * 0.5;
  const topLocal = Math.min(startAnchor.top, endAnchor.top) - lineHeight;
  const bottomLocal = Math.max(startAnchor.top, endAnchor.top);
  const leftOnSelectionStartLine = normalized.start <= normalized.end
    ? startAnchor.left
    : endAnchor.left;
  const centerLocalX = sameLine
    ? (startAnchor.left + endAnchor.left) / 2
    : leftOnSelectionStartLine;
  const containerRect = container.getBoundingClientRect();
  const viewportLeft = containerRect.left - container.scrollLeft + centerLocalX;
  const viewportTop = containerRect.top - container.scrollTop + topLocal;
  const viewportBottom = containerRect.top - container.scrollTop + bottomLocal;
  return {
    centerX: Math.round(viewportLeft),
    top: Math.round(viewportTop),
    bottom: Math.round(viewportBottom),
  };
};

const renderPreviewTextWithAtomicWikilinks = (
  text: string,
  keyPrefix: string,
  options: {
    resolveLink: (rawWikilink: string) => ResolvedInlinePageLink;
    onClick?: (wikilink: string, exists: boolean, event: MouseEvent<HTMLButtonElement>) => void;
  },
): ReactNode => {
  if (!text) {
    inlineWikilinkTokenPattern.lastIndex = 0;
    return text;
  }
  if (!inlineWikilinkTokenPattern.test(text)) {
    inlineWikilinkTokenPattern.lastIndex = 0;
    return text;
  }
  inlineWikilinkTokenPattern.lastIndex = 0;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match = inlineWikilinkTokenPattern.exec(text);
  let tokenIndex = 0;
  while (match) {
    const rawWikilink = match[0] ?? "";
    const start = match.index;
    const end = start + rawWikilink.length;
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    if (start > 0 && text[start - 1] === "!") {
      parts.push(rawWikilink);
      lastIndex = end;
      tokenIndex += 1;
      match = inlineWikilinkTokenPattern.exec(text);
      continue;
    }
    const resolved = options.resolveLink(rawWikilink);
    parts.push(
      <button
        key={`${keyPrefix}:wikilink:${tokenIndex}`}
        type="button"
        className={`markdown-hybrid-inline-page-link${resolved.exists ? "" : " is-missing"}`}
        data-md-inline-page-link="true"
        data-md-inline-page-link-wikilink={resolved.wikilink}
        data-md-inline-page-link-missing={resolved.exists ? undefined : "true"}
        title={resolved.exists ? resolved.wikilink : `${resolved.label} (Missing page)`}
        aria-label={resolved.exists ? `Open page ${resolved.label}` : `Missing page ${resolved.label}`}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          options.onClick?.(resolved.wikilink, resolved.exists, event);
        }}
      >
        <span className="markdown-hybrid-inline-page-link-icon" aria-hidden="true">
          <InsertMenuIconGraphic icon="page-file" />
        </span>
        <span className="markdown-hybrid-inline-page-link-label">{resolved.label}</span>
      </button>,
    );
    lastIndex = end;
    tokenIndex += 1;
    match = inlineWikilinkTokenPattern.exec(text);
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

const transformPreviewNodeWikilinks = (
  node: ReactNode,
  keyPrefix: string,
  options: {
    resolveLink: (rawWikilink: string) => ResolvedInlinePageLink;
    onClick?: (wikilink: string, exists: boolean, event: MouseEvent<HTMLButtonElement>) => void;
    skipTransform?: boolean;
  },
): ReactNode => {
  if (typeof node === "string") {
    return options.skipTransform
      ? node
      : renderPreviewTextWithAtomicWikilinks(node, keyPrefix, options);
  }
  if (Array.isArray(node)) {
    return node.map((child, index) =>
      transformPreviewNodeWikilinks(child, `${keyPrefix}:${index}`, options));
  }
  if (!isValidElement(node)) {
    return node;
  }

  const typedElement = node as ReactElement<Record<string, unknown>>;
  const elementProps = (typedElement.props ?? {}) as Record<string, unknown>;
  const tagName = typeof typedElement.type === "string" ? typedElement.type.toLowerCase() : null;
  if (!tagName) {
    const originalChildren = elementProps.children;
    const originalComponents = elementProps.components;
    const looksLikeReactMarkdown = typeof originalChildren === "string" &&
      originalComponents &&
      typeof originalComponents === "object" &&
      ("remarkPlugins" in elementProps || "rehypePlugins" in elementProps);
    if (!looksLikeReactMarkdown) {
      return typedElement;
    }

    const componentsRecord = originalComponents as Record<string, unknown>;
    const wrappedComponents: Record<string, unknown> = { ...componentsRecord };
    for (const markdownTag of reactMarkdownWikilinkWrappedTagNames) {
      const existingRenderer = componentsRecord[markdownTag];
      if (typeof existingRenderer === "function") {
        wrappedComponents[markdownTag] = (rendererProps: unknown) => {
          const rendered = (existingRenderer as (props: unknown) => ReactNode)(rendererProps);
          return transformPreviewNodeWikilinks(rendered, `${keyPrefix}:${markdownTag}`, options);
        };
        continue;
      }
      if (typeof existingRenderer === "string") {
        wrappedComponents[markdownTag] = existingRenderer;
        continue;
      }
      wrappedComponents[markdownTag] = (rendererProps: unknown) => {
        const typedRendererProps = (rendererProps ?? {}) as {
          node?: unknown;
          children?: ReactNode;
          [key: string]: unknown;
        };
        const { node: _node, children, ...rest } = typedRendererProps;
        const rendered = createElement(markdownTag, rest, children);
        return transformPreviewNodeWikilinks(rendered, `${keyPrefix}:${markdownTag}`, options);
      };
    }

    return cloneElement(typedElement, {
      ...elementProps,
      components: wrappedComponents,
    });
  }

  const nextSkip = options.skipTransform || (tagName ? inlineWikilinkSkipTags.has(tagName) : false);
  const hasChildren = Object.prototype.hasOwnProperty.call(elementProps, "children");
  if (!hasChildren) {
    return typedElement;
  }
  const nextChildren = Children.map(elementProps.children as ReactNode, (child, index) =>
    transformPreviewNodeWikilinks(child, `${keyPrefix}:${index}`, {
      ...options,
      skipTransform: nextSkip,
    }));
  return cloneElement(typedElement, undefined, nextChildren);
};

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

const INLINE_FORMATTING_TOOLBAR_DELAY_MS = 320;

const clampIndex = (value: number, maxExclusive: number) => {
  if (maxExclusive <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(value, maxExclusive - 1));
};

const OVERLAY_LEFT_GUTTER_WIDTH = 56;
const OVERLAY_RIGHT_GUTTER_WIDTH = 34;
const SELECTION_DRAG_THRESHOLD_PX = 5;
const SELECTION_AUTO_SCROLL_EDGE_PX = 48;
const SELECTION_AUTO_SCROLL_MAX_STEP_PX = 22;

const isVerticallyScrollable = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY || style.overflow;
  return /(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight > element.clientHeight;
};

const findScrollableAncestor = (element: HTMLElement | null) => {
  let current = element;
  while (current) {
    if (isVerticallyScrollable(current)) {
      return current;
    }
    current = current.parentElement;
  }
  const scrollingElement = document.scrollingElement;
  if (scrollingElement instanceof HTMLElement && isVerticallyScrollable(scrollingElement)) {
    return scrollingElement;
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

const isMarkdownBlockKind = (value: unknown): value is MarkdownBlock["kind"] =>
  typeof value === "string" && MARKDOWN_BLOCK_KIND_SET.has(value as MarkdownBlock["kind"]);

const serializeInternalBlockClipboardPayload = (
  blocks: ClipboardBlockEntry[],
) =>
  JSON.stringify({
    version: INTERNAL_BLOCK_CLIPBOARD_VERSION,
    source: INTERNAL_BLOCK_CLIPBOARD_SOURCE,
    createdAt: new Date().toISOString(),
    blocks,
  } as InternalBlockClipboardPayload);

const parseInternalBlockClipboardPayload = (rawPayload: string): InternalBlockClipboardPayload | null => {
  if (!rawPayload) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const candidate = parsed as {
    version?: unknown;
    source?: unknown;
    createdAt?: unknown;
    blocks?: unknown;
  };
  if (
    candidate.version !== INTERNAL_BLOCK_CLIPBOARD_VERSION ||
    candidate.source !== INTERNAL_BLOCK_CLIPBOARD_SOURCE ||
    typeof candidate.createdAt !== "string" ||
    candidate.createdAt.length === 0 ||
    !Array.isArray(candidate.blocks)
  ) {
    return null;
  }
  const blocks: ClipboardBlockEntry[] = [];
  for (const rawBlock of candidate.blocks) {
    if (!rawBlock || typeof rawBlock !== "object" || Array.isArray(rawBlock)) {
      return null;
    }
    const blockEntry = rawBlock as {
      kind?: unknown;
      raw?: unknown;
    };
    if (!isMarkdownBlockKind(blockEntry.kind) || typeof blockEntry.raw !== "string") {
      return null;
    }
    blocks.push({
      kind: blockEntry.kind,
      raw: blockEntry.raw,
    });
  }
  if (blocks.length === 0) {
    return null;
  }
  return {
    version: INTERNAL_BLOCK_CLIPBOARD_VERSION,
    source: INTERNAL_BLOCK_CLIPBOARD_SOURCE,
    createdAt: candidate.createdAt,
    blocks,
  };
};

const getClipboardTextData = (clipboardData: DataTransfer | null, mimeType: string) => {
  if (!clipboardData) {
    return "";
  }
  try {
    return clipboardData.getData(mimeType);
  } catch {
    return "";
  }
};

const setClipboardTextData = (
  clipboardData: DataTransfer | null,
  mimeType: string,
  value: string,
) => {
  if (!clipboardData) {
    return false;
  }
  try {
    clipboardData.setData(mimeType, value);
    return true;
  } catch {
    return false;
  }
};

const resolveSelectedBlocksInDocumentOrder = (
  blocks: MarkdownBlock[],
  selection: BlockSelectionState | null,
) => {
  if (!selection) {
    return [] as MarkdownBlock[];
  }
  return sortUniqueSelectionIndices(selection.selectedIndices)
    .map((index) => blocks[index])
    .filter((block): block is MarkdownBlock => Boolean(block));
};

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

const resolveInsertedBlockActivationIndex = (
  nextBlocks: MarkdownBlock[],
  insertedRaw: string,
  targetIndex: number,
) => {
  if (nextBlocks.length === 0) {
    return -1;
  }

  if (insertedRaw.trim().length === 0) {
    const startSearchIndex = Math.max(0, Math.min(targetIndex, nextBlocks.length - 1));
    for (let offset = 0; offset < nextBlocks.length; offset += 1) {
      const forwardIndex = startSearchIndex + offset;
      if (forwardIndex < nextBlocks.length && nextBlocks[forwardIndex]?.kind === "blank") {
        return forwardIndex;
      }
      const backwardIndex = startSearchIndex - offset;
      if (offset > 0 && backwardIndex >= 0 && nextBlocks[backwardIndex]?.kind === "blank") {
        return backwardIndex;
      }
    }
    return startSearchIndex;
  }

  const insertedBlocks = parseMarkdownBlocks(applyEditorMarkdownNormalization(insertedRaw));
  const primaryInsertedBlock = insertedBlocks.find((block) => block.kind !== "blank") ?? insertedBlocks[0];
  if (!primaryInsertedBlock) {
    return Math.max(0, Math.min(targetIndex, nextBlocks.length - 1));
  }
  const startSearchIndex = Math.max(0, Math.min(targetIndex, nextBlocks.length - 1));
  for (let offset = 0; offset < nextBlocks.length; offset += 1) {
    const forwardIndex = startSearchIndex + offset;
    if (
      forwardIndex < nextBlocks.length &&
      nextBlocks[forwardIndex]?.kind === primaryInsertedBlock.kind &&
      nextBlocks[forwardIndex]?.raw === primaryInsertedBlock.raw
    ) {
      return forwardIndex;
    }
    const backwardIndex = startSearchIndex - offset;
    if (
      offset > 0 &&
      backwardIndex >= 0 &&
      nextBlocks[backwardIndex]?.kind === primaryInsertedBlock.kind &&
      nextBlocks[backwardIndex]?.raw === primaryInsertedBlock.raw
    ) {
      return backwardIndex;
    }
  }
  return startSearchIndex;
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

const sequenceNumberLinePattern = /^\s*(\d+)\)\s*(.*)$/;
const codeFenceBoundaryPattern = /^\s*(```|~~~)/;

const collectBalancedExamRanges = (lines: string[]) => {
  const ranges: Array<{ start: number; end: number }> = [];
  let openExamDepth = 0;
  let currentExamStartLine: number | null = null;
  let inFence = false;
  let fenceToken = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(codeFenceBoundaryPattern);
    if (fenceMatch) {
      const token = fenceMatch[1] ?? "";
      if (inFence && token === fenceToken) {
        inFence = false;
        fenceToken = "";
      } else if (!inFence) {
        inFence = true;
        fenceToken = token;
      }
      continue;
    }
    if (inFence) {
      continue;
    }
    if (isStandaloneDirectiveLine(line, "#exam")) {
      if (openExamDepth === 0) {
        currentExamStartLine = index;
      }
      openExamDepth += 1;
      continue;
    }
    if (!isStandaloneDirectiveLine(line, "#endexam")) {
      continue;
    }
    if (openExamDepth === 0) {
      continue;
    }
    openExamDepth = Math.max(0, openExamDepth - 1);
    if (openExamDepth === 0 && currentExamStartLine !== null) {
      ranges.push({
        start: currentExamStartLine,
        end: index,
      });
      currentExamStartLine = null;
    }
  }

  return ranges;
};

const hasBalancedExamWrapper = (markdown: string) => {
  if (!markdown) {
    return false;
  }
  const lines = markdown.split("\n");
  return collectBalancedExamRanges(lines).length > 0;
};

const withExamWrapper = (markdown: string) => {
  const withoutLeadingBlankLines = markdown.replace(/^\n+/, "");
  const trimmedBody = withoutLeadingBlankLines.replace(/\n+$/, "");
  if (!trimmedBody) {
    return "#exam\n#endexam";
  }
  return `#exam\n${trimmedBody}\n#endexam`;
};

const orderedListCommitLinePattern = /^(\s*)(\d+)(\.|\)|\.\))(\s+)(.*)$/;

const isExamTaskOrderedListLine = (markdown: string, lineIndex: number) => {
  if (!markdown) {
    return false;
  }
  const lines = markdown.split("\n");
  if (lines.length === 0) {
    return false;
  }
  const targetLineIndex = Math.max(0, Math.min(lineIndex, lines.length - 1));
  let inFence = false;
  let fenceToken = "";
  let openExamDepth = 0;
  let openCardDepth = 0;

  for (let index = 0; index <= targetLineIndex; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(codeFenceBoundaryPattern);
    if (fenceMatch) {
      const token = fenceMatch[1] ?? "";
      if (inFence && token === fenceToken) {
        inFence = false;
        fenceToken = "";
      } else if (!inFence) {
        inFence = true;
        fenceToken = token;
      }
      continue;
    }
    if (inFence) {
      continue;
    }
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
      continue;
    }
  }

  return openExamDepth > 0 && openCardDepth === 0;
};

const shouldNormalizeOrderedListOnCommit = (markdown: string, lineIndex: number, blockRaw: string) => {
  if (isExamTaskOrderedListLine(markdown, lineIndex)) {
    return false;
  }
  const firstOrderedLineMatch = blockRaw
    .split("\n")
    .map((line) => line.match(orderedListCommitLinePattern))
    .find((match) => Boolean(match));
  const delimiter = firstOrderedLineMatch?.[3] ?? ".";
  // Task-style headings use `n) ...` and must keep their explicit number.
  return delimiter === ".";
};

const resolveNextGlobalSequenceNumber = (markdown: string) => {
  if (markdown.length === 0) {
    return 1;
  }

  const lines = markdown.split("\n");
  let maxSequenceNumber = 0;
  let inFence = false;
  let fenceToken = "";
  let openExamDepth = 0;
  let openCardDepth = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(codeFenceBoundaryPattern);
    if (fenceMatch) {
      const token = fenceMatch[1] ?? "";
      if (inFence && token === fenceToken) {
        inFence = false;
        fenceToken = "";
      } else if (!inFence) {
        inFence = true;
        fenceToken = token;
      }
      continue;
    }
    if (inFence) {
      continue;
    }
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
      continue;
    }
    const match = line.match(sequenceNumberLinePattern);
    if (!match) {
      continue;
    }
    const insideCard = openCardDepth > 0;
    const insideTaskScope = openExamDepth > 0 && openCardDepth === 0;
    if (!insideCard && !insideTaskScope) {
      continue;
    }
    const parsedNumber = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(parsedNumber)) {
      maxSequenceNumber = Math.max(maxSequenceNumber, parsedNumber);
    }
  }

  return maxSequenceNumber + 1;
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
const markdownTaskListLinePattern = /^(\s*[-+*]\s+\[)([ xX])(\])(.*)$/;

type LineRange = {
  start: number;
  end: number;
  lineIndex: number;
  line: string;
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

const isSupportedHeadingHashOnlyContentLine = (line: string) =>
  /^\s{0,3}#{2,4}\s+#+\s*$/.test(line);

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
      if (isSupportedHeadingHashOnlyContentLine(line)) {
        return line.replace(
          /^(\s{0,3}#{2,4}\s+)(#+)(\s*)$/,
          (_match, prefix: string, hashes: string, trailingWhitespace: string) =>
            `${prefix}${encodeHashesAsEntities(hashes)}${trailingWhitespace}`,
        );
      }
      return line;
    })
    .join("\n");

type EditorInlineSyntaxKind =
  | "hash-tag"
  | "cloze"
  | "quoted-token"
  | "markdown-highlight"
  | "markdown-bold"
  | "markdown-italic"
  | "markdown-underline"
  | "markdown-strikethrough"
  | "markdown-inline-code"
  | "markdown-math"
  | "markdown-bold-italic";

const editorInlineSyntaxPattern =
  /\*\*\*[^*\n]+?\*\*\*|(?<!\*)\*\*[^*\n]+?\*\*(?!\*)|(?<!\*)\*[^*\n]+?\*(?!\*)|__[^_\n]+?__|~~[^~\n]+?~~|`[^`\n]+?`|\$[^$\n]+?\$|==[^=\n]+?==|#[A-Za-z0-9_-]+\b|%[^%\n]+%|"[^"\n]+"/g;

const resolveEditorInlineSyntaxKind = (token: string): EditorInlineSyntaxKind | null => {
  if (/^\*\*\*[^*\n]+?\*\*\*$/.test(token)) {
    return "markdown-bold-italic";
  }
  if (/^\*\*[^*\n]+?\*\*$/.test(token)) {
    return "markdown-bold";
  }
  if (/^\*[^*\n]+?\*$/.test(token)) {
    return "markdown-italic";
  }
  if (/^__[^_\n]+?__$/.test(token)) {
    return "markdown-underline";
  }
  if (/^~~[^~\n]+?~~$/.test(token)) {
    return "markdown-strikethrough";
  }
  if (/^`[^`\n]+?`$/.test(token)) {
    return "markdown-inline-code";
  }
  if (/^\$[^$\n]+?\$$/.test(token)) {
    return "markdown-math";
  }
  if (/^==[^=\n]+?==$/.test(token)) {
    return "markdown-highlight";
  }
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

const renderEditorInlineSyntaxSegments = (
  text: string,
  keyPrefix: string,
  options?: {
    shouldRenderKind?: (kind: EditorInlineSyntaxKind) => boolean;
    getClassName?: (kind: EditorInlineSyntaxKind) => string | null | undefined;
  },
) => {
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
    if (!kind || (options?.shouldRenderKind && !options.shouldRenderKind(kind))) {
      parts.push(token);
    } else {
      const extraClassName = options?.getClassName?.(kind);
      parts.push(
        <span
          key={`${keyPrefix}-${tokenIndex}`}
          className={`md-inline-syntax md-inline-syntax-${kind}${
            extraClassName ? ` ${extraClassName}` : ""
          }`}
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
      ? renderEditorInlineSyntaxSegments(
        line,
        `mdh-editor-inline-line-${lineIndex}`,
        {
          shouldRenderKind: (kind) => kind === "markdown-inline-code",
          getClassName: (kind) => kind === "markdown-inline-code" ? "is-active-line" : null,
        },
      )
      : renderEditorInlineSyntaxSegments(line, `mdh-editor-inline-line-${lineIndex}`);
    nodes.push(lineNode);
    if (lineIndex < lines.length - 1) {
      nodes.push("\n");
    }
  }
  return nodes;
};

type CardBodyPreviewSegment =
  | {
      kind: "markdown";
      source: string;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: "media";
      items: MediaItem[];
      raw: string;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: "table";
      raw: string;
      startOffset: number;
      endOffset: number;
    };

type CardBlockPreviewParts = {
  parts: Array<
    | {
        kind: "body";
        segments: CardBodyPreviewSegment[];
      }
    | {
        kind: "help";
        source: string;
      }
  >;
};

const isCardDirectivePreviewLine = (line: string, directive: "#card" | "#endcard") =>
  line.trim().toLowerCase() === directive;

const isHelpDirectivePreviewLine = (line: string, directive: "#help" | "#helpend") =>
  line.trim().toLowerCase() === directive;

const buildPreviewLineStarts = (source: string, lines: string[]) => {
  const starts: number[] = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    starts.push(offset);
    offset += (lines[i] ?? "").length;
    if (offset < source.length || i < lines.length - 1) {
      offset += 1;
    }
  }
  return starts;
};

const resolveLineRangeOffsets = (
  lineStarts: number[],
  sourceLength: number,
  startLine: number,
  endLineExclusive: number,
) => {
  const startOffset = lineStarts[startLine] ?? sourceLength;
  if (endLineExclusive <= startLine) {
    return { startOffset, endOffset: startOffset };
  }
  if (endLineExclusive >= lineStarts.length) {
    return { startOffset, endOffset: sourceLength };
  }
  return {
    startOffset,
    endOffset: Math.max(startOffset, (lineStarts[endLineExclusive] ?? sourceLength) - 1),
  };
};

type CardDirectiveBoundarySegment = {
  kind: "body" | "directive";
  raw: string;
  startOffset: number;
  endOffset: number;
};

const splitCardDirectiveMarkdownSegments = (
  blockRaw: string,
  startOffset: number,
): CardDirectiveBoundarySegment[] => {
  if (!blockRaw) {
    return [];
  }

  const lines = blockRaw.split("\n");
  const segments: CardDirectiveBoundarySegment[] = [];
  let cursor = 0;
  let chunkStart = 0;

  const pushChunk = (kind: CardDirectiveBoundarySegment["kind"], from: number, to: number) => {
    if (to <= from) {
      return;
    }
    segments.push({
      kind,
      raw: blockRaw.slice(from, to),
      startOffset: startOffset + from,
      endOffset: startOffset + to,
    });
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const lineStart = cursor;
    const hasTrailingNewline = lineIndex < lines.length - 1;
    const lineEnd = lineStart + line.length + (hasTrailingNewline ? 1 : 0);
    if (isCardDirectivePreviewLine(line, "#card") || isCardDirectivePreviewLine(line, "#endcard")) {
      pushChunk("body", chunkStart, lineStart);
      pushChunk("directive", lineStart, lineEnd);
      chunkStart = lineEnd;
    }
    cursor = lineEnd;
  }

  pushChunk("body", chunkStart, blockRaw.length);

  return segments.length > 0
    ? segments
    : [{
      kind: "body",
      raw: blockRaw,
      startOffset,
      endOffset: startOffset + blockRaw.length,
    }];
};

const buildCardBodyPreviewSegments = (
  source: string,
  scope: string,
  baseOffset = 0,
): CardBodyPreviewSegment[] => {
  const previewSegments: CardBodyPreviewSegment[] = [];
  const boundarySegments = splitCardDirectiveMarkdownSegments(source, baseOffset);

  const pushMarkdownSegment = (segmentSource: string, startOffset: number, endOffset: number) => {
    if (!segmentSource) {
      return;
    }
    previewSegments.push({
      kind: "markdown",
      source: escapeHybridPreviewSpecialLines(segmentSource),
      startOffset,
      endOffset,
    });
  };

  for (let boundaryIndex = 0; boundaryIndex < boundarySegments.length; boundaryIndex += 1) {
    const boundarySegment = boundarySegments[boundaryIndex];
    if (!boundarySegment) {
      continue;
    }
    if (boundarySegment.kind === "directive") {
      pushMarkdownSegment(
        boundarySegment.raw,
        boundarySegment.startOffset,
        boundarySegment.endOffset,
      );
      continue;
    }

    const mediaSegments = splitMarkdownMediaSegments(boundarySegment.raw, `${scope}-${boundaryIndex}`);
    let boundaryOffset = 0;

    for (const segment of mediaSegments) {
      if (segment.kind === "media") {
        const startOffset = boundarySegment.startOffset + boundaryOffset;
        const endOffset = startOffset + segment.raw.length;
        previewSegments.push({
          kind: "media",
          items: segment.items,
          raw: segment.raw,
          startOffset,
          endOffset,
        });
        boundaryOffset += segment.raw.length;
        continue;
      }

      const markdownSource = segment.source;
      const markdownOffset = boundarySegment.startOffset + boundaryOffset;
      const markdownBlocks = parseMarkdownBlocks(markdownSource);

      if (markdownBlocks.length === 0) {
        pushMarkdownSegment(
          markdownSource,
          markdownOffset,
          markdownOffset + markdownSource.length,
        );
        boundaryOffset += markdownSource.length;
        continue;
      }

      for (const markdownBlock of markdownBlocks) {
        const blockStartOffset = markdownOffset + markdownBlock.startOffset;
        const blockEndOffset = markdownOffset + markdownBlock.endOffset;
        if (markdownBlock.kind === "table") {
          previewSegments.push({
            kind: "table",
            raw: markdownBlock.raw,
            startOffset: blockStartOffset,
            endOffset: blockEndOffset,
          });
          continue;
        }
        pushMarkdownSegment(markdownBlock.raw, blockStartOffset, blockEndOffset);
      }

      boundaryOffset += markdownSource.length;
    }
  }

  return previewSegments;
};

const extractCardBlockPreviewParts = (blockRaw: string): CardBlockPreviewParts => {
  const lines = blockRaw.split("\n");
  const lineStarts = buildPreviewLineStarts(blockRaw, lines);
  if (lines.length === 0 || !isCardDirectivePreviewLine(lines[0] ?? "", "#card")) {
    return {
      parts: [
        {
          kind: "body",
          segments: buildCardBodyPreviewSegments(blockRaw, "card-block-preview-root", 0),
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
    const { startOffset, endOffset } = resolveLineRangeOffsets(
      lineStarts,
      blockRaw.length,
      start,
      endExclusive,
    );
    const raw = blockRaw.slice(startOffset, endOffset);
    if (raw.length === 0) {
      return;
    }
    parts.push({
      kind: "body",
      segments: buildCardBodyPreviewSegments(
        raw,
        `card-block-preview-${start}-${endExclusive}`,
        startOffset,
      ),
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
          segments: buildCardBodyPreviewSegments(blockRaw, "card-block-preview-fallback", 0),
        },
      ],
    };
  }

  return { parts };
};

const isSameCardTableSegmentTarget = (
  left: CardTableSegmentTarget | ActiveCardTableState | null,
  right: CardTableSegmentTarget | ActiveCardTableState | null,
) =>
  Boolean(
    left &&
      right &&
      left.blockIndex === right.blockIndex &&
      left.blockId === right.blockId &&
      left.partIndex === right.partIndex &&
      left.segmentIndex === right.segmentIndex,
  );

const resolveCardTableSegmentFromParts = (
  parts: CardBlockPreviewParts,
  target: CardTableSegmentTarget,
) => {
  const part = parts.parts[target.partIndex];
  if (!part || part.kind !== "body") {
    return null;
  }
  const segment = part.segments[target.segmentIndex];
  if (!segment || segment.kind !== "table") {
    return null;
  }
  return segment;
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
  // Pure hash marker runs (e.g. ###, ####) are valid and must not be split
  // by backtracking the final # into heading content during normalization.
  const match = line.match(/^(\s{0,3})(#+)([^\s#].*)$/);
  if (!match) {
    return null;
  }
  const indent = match[1] ?? "";
  const hashes = match[2] ?? "";
  const remainder = match[3] ?? "";
  if (hashes.length < 2 || hashes.length > 6) {
    return null;
  }
  if (remainder.length === 0) {
    return null;
  }
  // Single-hash prefixes (e.g. #card, #tag) are not headings here and must
  // never be auto-normalized.
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
) =>
  block.kind === "hr"
    ? extractHorizontalRuleEditorDraft(block.raw)
    : block.kind === "math-block"
    ? normalizeMathBlockSource(block.raw)
    : block.raw;

const toPersistedBlockRawForDraft = (
  block: Pick<MarkdownBlock, "kind">,
  draft: string,
) =>
  block.kind === "hr"
    ? serializeHorizontalRuleEditorDraft(draft)
    : block.kind === "math-block"
    ? normalizeMathBlockSource(draft)
    : block.kind === "card-block"
    ? normalizeCardBlockSource(draft)
    : draft;

const applyEditorMarkdownNormalization = (value: string) =>
  normalizeHorizontalRuleSpacingInMarkdown(value);

const createActiveEditSnapshotFromBlock = (
  blockIndex: number,
  block: MarkdownBlock,
): ActiveEditSnapshot => ({
  blockIndex,
  blockId: block.id,
  kind: block.kind,
  startLine: block.startLine,
  endLine: block.endLine,
  startOffset: block.startOffset,
  endOffset: block.endOffset,
  raw: block.raw,
  draft: toEditorDraftForBlock(block),
});

const createDetachedEmptyEditSnapshot = (draft: string): ActiveEditSnapshot => ({
  blockIndex: 0,
  blockId: "empty:0",
  kind: "blank",
  startLine: 0,
  endLine: 0,
  startOffset: 0,
  endOffset: 0,
  raw: draft,
  draft,
  isDetachedEmptyBlock: true,
});

const mergeDeferredEditAction = (
  current: DeferredEditAction | null,
  nextAction: DeferredEditAction,
): DeferredEditAction => {
  if (!current) {
    return nextAction;
  }
  if (current.kind === "discard" || nextAction.kind === "discard") {
    return { kind: "discard" };
  }
  const nextActivation = nextAction.options?.nextActivation ?? current.options?.nextActivation ?? null;
  return {
    kind: "commit",
    options: {
      deactivate: nextAction.options?.deactivate ?? current.options?.deactivate,
      nextActivation,
    },
  };
};

export const MarkdownHybridEditor = forwardRef<MarkdownHybridEditorHandle, MarkdownHybridEditorProps>(
({
  historyKey,
  markdown,
  mode,
  disabled = false,
  vaultFiles,
  vaultPngAssets,
  vaultPath,
  sourceRelativePath,
  onNavigateWikilink,
  onChange,
  onCommit,
  onDirtyChange,
  renderPreview,
}: MarkdownHybridEditorProps, ref) => {
  const blocks = useMemo(() => parseMarkdownBlocks(markdown), [markdown]);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [activeDraft, setActiveDraft] = useState("");
  const [activeDirty, setActiveDirty] = useState(false);
  const [activeEditSnapshot, setActiveEditSnapshot] = useState<ActiveEditSnapshot | null>(null);
  const [activeComposing, setActiveComposing] = useState(false);
  const [activeTableDirty, setActiveTableDirty] = useState(false);
  const [activeCardTableState, setActiveCardTableState] = useState<ActiveCardTableState | null>(null);
  const [activeCardTableDirty, setActiveCardTableDirty] = useState(false);
  const [history, setHistory] = useState<MarkdownHistoryState>(() =>
    createMarkdownHistory(markdown),
  );
  const [pendingActivation, setPendingActivation] = useState<PendingActivation | null>(
    null,
  );
  const [pendingTableActivation, setPendingTableActivation] = useState<PendingTableActivation | null>(null);
  const [selectedBlockSelection, setSelectedBlockSelection] = useState<BlockSelectionState | null>(
    null,
  );
  const [isSelectionDragging, setIsSelectionDragging] = useState(false);
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);
  const [insertMenuState, setInsertMenuState] = useState<InsertMenuState | null>(null);
  const [mathToolboxState, setMathToolboxState] = useState<MathToolboxState | null>(null);
  const [selectionContextMenuState, setSelectionContextMenuState] =
    useState<SelectionContextMenuState | null>(null);
  const [selectionMarqueeRect, setSelectionMarqueeRect] = useState<SelectionMarqueeRect | null>(
    null,
  );
  const [pendingTypedImageLinkPickerRequest, setPendingTypedImageLinkPickerRequest] =
    useState<PendingTypedImageLinkPickerRequest | null>(null);
  const [typedImageLinkPickerState, setTypedImageLinkPickerState] = useState<TypedImageLinkPickerState | null>(null);
  const [pendingPageLinkPickerRequest, setPendingPageLinkPickerRequest] =
    useState<PendingPageLinkPickerRequest | null>(null);
  const [pageLinkPickerState, setPageLinkPickerState] = useState<PageLinkPickerState | null>(null);
  const [imageEmbedReplacePickerState, setImageEmbedReplacePickerState] =
    useState<ImageEmbedReplacePickerState | null>(null);
  const [inlineFormattingToolbarSelection, setInlineFormattingToolbarSelection] =
    useState<InlineFormattingToolbarSelection | null>(null);
  const [inlineFormattingToolbarMenu, setInlineFormattingToolbarMenu] =
    useState<InlineFormattingToolbarMenu>(null);
  const [inlineFormattingToolbarLinkState, setInlineFormattingToolbarLinkState] =
    useState<InlineFormattingToolbarLinkState | null>(null);
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
  const mathToolboxRef = useRef<HTMLDivElement | null>(null);
  const selectionContextMenuRef = useRef<HTMLDivElement | null>(null);
  const pageLinkPickerRef = useRef<HTMLDivElement | null>(null);
  const pageLinkPickerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const typedImageLinkPickerRef = useRef<HTMLDivElement | null>(null);
  const imageEmbedReplacePickerRef = useRef<HTMLDivElement | null>(null);
  const inlineFormattingToolbarRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorSyntaxOverlayContentRef = useRef<HTMLDivElement | null>(null);
  const pendingCaretRef = useRef<"start" | "end" | null>(null);
  const pendingTextareaSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const autoActivatedWriteKeyRef = useRef<string | null>(null);
  const selectionGestureRef = useRef<SelectionGestureState | null>(null);
  const suppressNextBlockContextMenuRef = useRef(false);
  const overlayMeasureFrameRef = useRef<number | null>(null);
  const selectionAutoScrollFrameRef = useRef<number | null>(null);
  const selectionDragUpdateFrameRef = useRef<number | null>(null);
  const selectionDragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const inlineFormattingToolbarTimerRef = useRef<number | null>(null);
  const inlineFormattingToolbarPendingSignatureRef = useRef<string | null>(null);
  const inlineFormattingToolbarRangeRef = useRef<{
    blockIndex: number;
    start: number;
    end: number;
  } | null>(null);
  const activeDraftRef = useRef("");
  const activeComposingRef = useRef(false);
  const activeEditSnapshotRef = useRef<ActiveEditSnapshot | null>(null);
  const deferredEditActionRef = useRef<DeferredEditAction | null>(null);
  const deferredEditRequestsRef = useRef<DeferredEditRequest[]>([]);
  const deferredEditFlushFrameRef = useRef<number | null>(null);
  const stableBlockRenderTokensRef = useRef<StableRenderKeyToken[]>([]);
  const stableBlockRenderKeyCounterRef = useRef(0);
  const pendingActivationMarkdownRef = useRef<string | null>(null);
  const activeTableSessionRef = useRef<MarkdownHybridTableSessionController | null>(null);
  const activeCardTableSessionRef = useRef<MarkdownHybridTableSessionController | null>(null);
  const codeFencePreviewHeightsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    activeDraftRef.current = activeDraft;
  }, [activeDraft]);

  useEffect(() => {
    activeComposingRef.current = activeComposing;
  }, [activeComposing]);

  useEffect(() => {
    activeEditSnapshotRef.current = activeEditSnapshot;
  }, [activeEditSnapshot]);

  const updateActiveDraftState = useCallback((nextDraft: string) => {
    activeDraftRef.current = nextDraft;
    setActiveDraft(nextDraft);
  }, []);

  const resolveCodeFencePreviewItems = useCallback(
    (raw: string): MediaItem[] =>
      splitMarkdownMediaSegments(raw, "markdown-hybrid-code-fence-preview")
        .flatMap((segment) => (segment.kind === "media" ? segment.items : [])),
    [],
  );

  const isSvgCodeFencePreviewBlock = useCallback(
    (block: MarkdownBlock | null | undefined) => {
      if (!block || block.kind !== "code-fence") {
        return false;
      }
      return resolveCodeFencePreviewItems(block.raw).some((item) => item.type === "svg");
    },
    [resolveCodeFencePreviewItems],
  );

  const resolveStoredSvgCodeFencePreviewHeight = useCallback(
    (block: MarkdownBlock | null | undefined) => {
      if (!block || !isSvgCodeFencePreviewBlock(block)) {
        return null;
      }
      const height = codeFencePreviewHeightsRef.current.get(block.id);
      if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) {
        return null;
      }
      return height;
    },
    [isSvgCodeFencePreviewBlock],
  );

  const cacheSvgCodeFencePreviewHeightForBlock = useCallback(
    (blockIndex: number, block?: MarkdownBlock | null) => {
      const targetBlock = block ?? blocks[blockIndex];
      if (!targetBlock || !isSvgCodeFencePreviewBlock(targetBlock)) {
        return null;
      }
      const contentLayer = contentLayerRef.current;
      if (!contentLayer) {
        return null;
      }
      const blockElement = contentLayer.querySelector<HTMLElement>(
        `.markdown-hybrid-block[data-md-block-index="${blockIndex}"]`,
      );
      const previewElement = blockElement?.querySelector<HTMLElement>(
        ".markdown-hybrid-block-preview.markdown-hybrid-media-block-preview",
      );
      if (!previewElement) {
        return null;
      }
      const nextHeight = Math.max(
        1,
        Math.round(previewElement.getBoundingClientRect().height),
      );
      codeFencePreviewHeightsRef.current.set(targetBlock.id, nextHeight);
      return nextHeight;
    },
    [blocks, isSvgCodeFencePreviewBlock],
  );

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
    () => Array.from(overlayLayout.byIndex.values()),
    [overlayLayout.byIndex],
  );

  useEffect(() => {
    const knownBlockIds = new Set(blocks.map((block) => block.id));
    const cachedHeights = codeFencePreviewHeightsRef.current;
    for (const blockId of Array.from(cachedHeights.keys())) {
      if (!knownBlockIds.has(blockId)) {
        cachedHeights.delete(blockId);
      }
    }
  }, [blocks]);

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
  const pageLinkCandidates = useMemo(() => buildPageLinkCandidates(vaultFiles), [vaultFiles]);
  const imageLinkCandidates = useMemo(
    () => buildVaultImageCandidates(vaultPngAssets),
    [vaultPngAssets],
  );
  const pageLinkLookup = useMemo(() => buildPageLinkLookup(pageLinkCandidates), [pageLinkCandidates]);
  const filteredPageLinkCandidates = useMemo(
    () => filterPageLinkCandidates(pageLinkCandidates, pageLinkPickerState?.query ?? ""),
    [pageLinkCandidates, pageLinkPickerState?.query],
  );
  const filteredImageLinkCandidates = useMemo(() => {
    const query = insertMenuState?.phase === "image-link-picker"
      ? (insertMenuState.query ?? "")
      : "";
    return filterVaultImageCandidates(imageLinkCandidates, query);
  }, [imageLinkCandidates, insertMenuState]);
  const filteredTypedImageLinkCandidates = useMemo(
    () => filterVaultImageCandidates(imageLinkCandidates, typedImageLinkPickerState?.query ?? ""),
    [imageLinkCandidates, typedImageLinkPickerState?.query],
  );
  const filteredImageEmbedReplaceCandidates = useMemo(
    () => filterVaultImageCandidates(imageLinkCandidates, imageEmbedReplacePickerState?.query ?? ""),
    [imageEmbedReplacePickerState?.query, imageLinkCandidates],
  );
  const resolveInlinePageLink = useCallback(
    (rawWikilink: string): ResolvedInlinePageLink => {
      const parsed = parseInlineWikilink(rawWikilink);
      if (!parsed) {
        return {
          wikilink: rawWikilink,
          label: rawWikilink,
          exists: false,
        };
      }
      const candidate = resolvePageLinkCandidate(pageLinkLookup, parsed.target);
      if (!candidate) {
        return {
          wikilink: `[[${parsed.alias ? `${parsed.target}|${parsed.alias}` : parsed.target}]]`,
          label: parsed.alias || parsed.label,
          exists: false,
        };
      }
      const wikilink = parsed.alias ? `[[${candidate.target}|${parsed.alias}]]` : candidate.wikilink;
      return {
        wikilink,
        label: parsed.alias || candidate.label,
        exists: true,
      };
    },
    [pageLinkLookup],
  );
  const handleInlinePageLinkClick = useCallback(
    (wikilink: string, exists: boolean, event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!exists) {
        return;
      }
      onNavigateWikilink?.(wikilink);
    },
    [onNavigateWikilink],
  );
  const renderPreviewWithPageLinks = useCallback(
    (source: string) =>
      transformPreviewNodeWikilinks(renderPreview(source), "mdh-preview", {
        resolveLink: resolveInlinePageLink,
        onClick: handleInlinePageLinkClick,
      }),
    [handleInlinePageLinkClick, renderPreview, resolveInlinePageLink],
  );

  const measureOverlayLayout = useCallback(() => {
    const contentLayer = contentLayerRef.current;
    if (!contentLayer) {
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

    const rowElements = Array.from(
      contentLayer.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
    );
    const nextByIndex = new Map<number, OverlayBlockRect>();
    let fallbackTopCursor = 0;
    let lastMeasuredTop = Number.NEGATIVE_INFINITY;
    const fallbackRowGap = 6;

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
      // Use layout-tree offsets (scroll-independent) to avoid expensive viewport rect reads
      // on frequent overlay updates.
      const measuredTop = Math.max(0, rowElement.offsetTop);
      const height = Math.max(1, rowElement.offsetHeight);
      const top = measuredTop > lastMeasuredTop ? measuredTop : fallbackTopCursor;
      fallbackTopCursor = top + height + fallbackRowGap;
      lastMeasuredTop = top;
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

  const setSelectionMarqueeFromContentPoints = useCallback(
    (startX: number, startY: number, endX: number, endY: number) => {
      const nextRect = {
        left: Math.min(startX, endX),
        top: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
      };
      setSelectionMarqueeRect((current) => {
        if (
          current &&
          current.left === nextRect.left &&
          current.top === nextRect.top &&
          current.width === nextRect.width &&
          current.height === nextRect.height
        ) {
          return current;
        }
        return nextRect;
      });
    },
    [],
  );

  const updateSelectionFromMarqueeContentPoints = useCallback(
    (startX: number, startY: number, endX: number, endY: number) => {
      if (blocks.length === 0 || overlayRows.length === 0) {
        return;
      }
      const contentLayer = contentLayerRef.current;
      const contentWidth = Math.max(contentLayer?.scrollWidth ?? 0, contentLayer?.clientWidth ?? 0, 1);
      const left = Math.max(0, Math.min(contentWidth, Math.min(startX, endX)));
      const right = Math.max(0, Math.min(contentWidth, Math.max(startX, endX)));
      const top = Math.min(startY, endY);
      const bottom = Math.max(startY, endY);
      const rowLeft = 0;
      const rowRight = contentWidth;
      const intersectedIndices: number[] = [];

      for (const row of overlayRows) {
        const nextIndex = clampIndex(row.index, blocks.length);
        if (
          blocks[nextIndex]?.kind === "blank" &&
          isStructuralSeparatorBlankBlock(blocks, nextIndex)
        ) {
          continue;
        }
        const rowTop = row.top;
        const rowBottom = row.top + row.height;
        const intersects =
          rowRight >= left &&
          rowLeft <= right &&
          rowBottom >= top &&
          rowTop <= bottom;
        if (!intersects) {
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
    [blocks, overlayRows],
  );

  const editorDirty = activeDirty || activeTableDirty || activeCardTableDirty;

  useEffect(() => {
    onDirtyChange?.(editorDirty);
  }, [editorDirty, onDirtyChange]);

  useEffect(() => {
    setHistory((current) => {
      if (current.present.markdown === markdown) {
        return current;
      }
      if (editorDirty) {
        return current;
      }
      return resetMarkdownHistory(markdown, "external-load");
    });
  }, [editorDirty, markdown]);

  useEffect(() => {
    setActiveBlockIndex(null);
    updateActiveDraftState("");
    setActiveDirty(false);
    setActiveEditSnapshot(null);
    setActiveComposing(false);
    setActiveTableDirty(false);
    setActiveCardTableState(null);
    setActiveCardTableDirty(false);
    setPendingActivation(null);
    setPendingTableActivation(null);
    pendingActivationMarkdownRef.current = null;
    activeTableSessionRef.current = null;
    deferredEditActionRef.current = null;
    deferredEditRequestsRef.current.splice(0).forEach((request) => {
      request.resolve(false);
    });
    if (deferredEditFlushFrameRef.current !== null) {
      window.cancelAnimationFrame(deferredEditFlushFrameRef.current);
      deferredEditFlushFrameRef.current = null;
    }
    setSelectedBlockSelection(null);
    setIsSelectionDragging(false);
    setDraggedBlockIndex(null);
    setDropIndicatorIndex(null);
    setInsertMenuState(null);
    setSelectionContextMenuState(null);
    setSelectionMarqueeRect(null);
    setInlineFormattingToolbarSelection(null);
    setInlineFormattingToolbarMenu(null);
    setInlineFormattingToolbarLinkState(null);
    setImageEmbedReplacePickerState(null);
    setHistory(createMarkdownHistory(markdown));
    setOverlayLayout((current) => ({
      ...current,
      byIndex: new Map(),
    }));
    autoActivatedWriteKeyRef.current = null;
    if (selectionAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(selectionAutoScrollFrameRef.current);
      selectionAutoScrollFrameRef.current = null;
    }
    if (selectionDragUpdateFrameRef.current !== null) {
      window.cancelAnimationFrame(selectionDragUpdateFrameRef.current);
      selectionDragUpdateFrameRef.current = null;
    }
    selectionDragPointerRef.current = null;
    selectionGestureRef.current = null;
    suppressNextBlockContextMenuRef.current = false;
    stableBlockRenderTokensRef.current = [];
    pendingActivationMarkdownRef.current = null;
    activeCardTableSessionRef.current = null;
    inlineFormattingToolbarRangeRef.current = null;
    inlineFormattingToolbarPendingSignatureRef.current = null;
    if (inlineFormattingToolbarTimerRef.current !== null) {
      window.clearTimeout(inlineFormattingToolbarTimerRef.current);
      inlineFormattingToolbarTimerRef.current = null;
    }
  }, [historyKey]);

  useEffect(
    () => () => {
      if (overlayMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(overlayMeasureFrameRef.current);
        overlayMeasureFrameRef.current = null;
      }
      if (selectionAutoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionAutoScrollFrameRef.current);
        selectionAutoScrollFrameRef.current = null;
      }
      if (selectionDragUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionDragUpdateFrameRef.current);
        selectionDragUpdateFrameRef.current = null;
      }
      selectionDragPointerRef.current = null;
      if (inlineFormattingToolbarTimerRef.current !== null) {
        window.clearTimeout(inlineFormattingToolbarTimerRef.current);
        inlineFormattingToolbarTimerRef.current = null;
      }
      if (deferredEditFlushFrameRef.current !== null) {
        window.cancelAnimationFrame(deferredEditFlushFrameRef.current);
        deferredEditFlushFrameRef.current = null;
      }
      activeCardTableSessionRef.current = null;
      deferredEditActionRef.current = null;
      deferredEditRequestsRef.current.splice(0).forEach((request) => {
        request.resolve(false);
      });
      inlineFormattingToolbarPendingSignatureRef.current = null;
      inlineFormattingToolbarRangeRef.current = null;
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
    return () => observer.disconnect();
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

    const stopSelectionAutoScroll = () => {
      if (selectionAutoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionAutoScrollFrameRef.current);
        selectionAutoScrollFrameRef.current = null;
      }
    };

    const stopSelectionDragUpdate = () => {
      if (selectionDragUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionDragUpdateFrameRef.current);
        selectionDragUpdateFrameRef.current = null;
      }
    };

    const isDragThresholdExceeded = (gesture: SelectionGestureState, clientX: number, clientY: number) =>
      Math.abs(clientX - gesture.startClientX) > SELECTION_DRAG_THRESHOLD_PX ||
      Math.abs(clientY - gesture.startClientY) > SELECTION_DRAG_THRESHOLD_PX;

    const applySelectionFromPointer = (
      gesture: SelectionGestureState,
      pointer: { x: number; y: number },
      forceSelectionUpdate = false,
    ) => {
      const endPoint = getContainerLocalPoint(pointer.x, pointer.y);
      if (!endPoint) {
        return;
      }

      if (gesture.source === "shift-left") {
        setSelectionMarqueeFromContentPoints(
          gesture.startContentX,
          gesture.startContentY,
          endPoint.x,
          endPoint.y,
        );
      }

      if (!gesture.didDrag && !forceSelectionUpdate) {
        return;
      }

      updateSelectionFromMarqueeContentPoints(
        gesture.startContentX,
        gesture.startContentY,
        endPoint.x,
        endPoint.y,
      );
    };

    const flushSelectionDragUpdate = () => {
      selectionDragUpdateFrameRef.current = null;
      const gesture = selectionGestureRef.current;
      const pointer = selectionDragPointerRef.current;
      if (!gesture?.active || !pointer || disabled || blocks.length === 0) {
        return;
      }
      applySelectionFromPointer(gesture, pointer);
    };

    const scheduleSelectionDragUpdate = () => {
      if (selectionDragUpdateFrameRef.current !== null) {
        return;
      }
      selectionDragUpdateFrameRef.current = window.requestAnimationFrame(flushSelectionDragUpdate);
    };

    const resolveAutoScrollDeltaY = () => {
      const pointer = selectionDragPointerRef.current;
      if (!pointer) {
        return 0;
      }
      const container = containerRef.current;
      const scrollHost = findScrollableAncestor(container);
      if (!container || !scrollHost) {
        return 0;
      }
      const hostRect = scrollHost.getBoundingClientRect();
      if (hostRect.height <= 0) {
        return 0;
      }
      const edgeSize = Math.min(
        SELECTION_AUTO_SCROLL_EDGE_PX,
        Math.max(16, Math.floor(hostRect.height * 0.18)),
      );
      if (pointer.y < hostRect.top + edgeSize) {
        const distance = hostRect.top + edgeSize - pointer.y;
        const intensity = Math.max(0, Math.min(1, distance / edgeSize));
        return -Math.max(1, Math.round(SELECTION_AUTO_SCROLL_MAX_STEP_PX * intensity));
      }
      if (pointer.y > hostRect.bottom - edgeSize) {
        const distance = pointer.y - (hostRect.bottom - edgeSize);
        const intensity = Math.max(0, Math.min(1, distance / edgeSize));
        return Math.max(1, Math.round(SELECTION_AUTO_SCROLL_MAX_STEP_PX * intensity));
      }
      return 0;
    };

    const stepSelectionAutoScroll = () => {
      selectionAutoScrollFrameRef.current = null;
      const gesture = selectionGestureRef.current;
      if (!gesture?.active) {
        return;
      }
      if (disabled || blocks.length === 0) {
        return;
      }
      if (!gesture.didDrag) {
        return;
      }
      const pointer = selectionDragPointerRef.current;
      if (!pointer) {
        return;
      }
      const container = containerRef.current;
      const scrollHost = findScrollableAncestor(container);
      if (!container || !scrollHost) {
        return;
      }

      const deltaY = resolveAutoScrollDeltaY();
      let didScroll = false;
      if (deltaY !== 0) {
        const prevScrollTop = scrollHost.scrollTop;
        const maxScrollTop = Math.max(0, scrollHost.scrollHeight - scrollHost.clientHeight);
        const nextScrollTop = Math.max(0, Math.min(maxScrollTop, prevScrollTop + deltaY));
        if (nextScrollTop !== prevScrollTop) {
          scrollHost.scrollTop = nextScrollTop;
          didScroll = true;
        }
      }

      applySelectionFromPointer(gesture, pointer, didScroll);

      if (resolveAutoScrollDeltaY() !== 0) {
        selectionAutoScrollFrameRef.current = window.requestAnimationFrame(stepSelectionAutoScroll);
      }
    };

    const syncSelectionAutoScrollLoop = () => {
      const gesture = selectionGestureRef.current;
      if (!gesture?.active) {
        stopSelectionAutoScroll();
        return;
      }
      if (!gesture.didDrag) {
        stopSelectionAutoScroll();
        return;
      }
      if (resolveAutoScrollDeltaY() === 0) {
        stopSelectionAutoScroll();
        return;
      }
      if (selectionAutoScrollFrameRef.current !== null) {
        return;
      }
      selectionAutoScrollFrameRef.current = window.requestAnimationFrame(stepSelectionAutoScroll);
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
      selectionDragPointerRef.current = null;
      stopSelectionAutoScroll();
      stopSelectionDragUpdate();
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
      selectionDragPointerRef.current = { x: event.clientX, y: event.clientY };
      const expectedButtonMask = gesture.source === "right" ? 2 : 1;
      if ((event.buttons & expectedButtonMask) !== expectedButtonMask) {
        endSelectionGesture("button-release");
        return;
      }
      if (isDragThresholdExceeded(gesture, event.clientX, event.clientY)) {
        gesture.didDrag = true;
      }
      if (gesture.source === "right" && gesture.didDrag) {
        event.preventDefault();
      }
      scheduleSelectionDragUpdate();
      syncSelectionAutoScrollLoop();
    };

    const handleMouseUp = () => {
      endSelectionGesture("mouseup");
    };

    const handleWindowContextMenu = (event: globalThis.MouseEvent) => {
      const gesture = selectionGestureRef.current;
      if (!gesture?.active || gesture.source !== "right" || !gesture.didDrag) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("contextmenu", handleWindowContextMenu, true);
    return () => {
      selectionDragPointerRef.current = null;
      stopSelectionAutoScroll();
      stopSelectionDragUpdate();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("contextmenu", handleWindowContextMenu, true);
    };
  }, [
    blocks.length,
    disabled,
    getContainerLocalPoint,
    isSelectionDragging,
    setSelectionMarqueeFromContentPoints,
    updateSelectionFromMarqueeContentPoints,
  ]);

  useEffect(() => {
    if (activeBlockIndex === null) {
      return;
    }
    if (activeEditSnapshot?.isDetachedEmptyBlock && blocks.length === 0) {
      return;
    }
    const nextBlock = blocks[activeBlockIndex];
    if (!nextBlock) {
      setActiveBlockIndex(null);
      updateActiveDraftState("");
      setActiveDirty(false);
      setActiveEditSnapshot(null);
      setActiveComposing(false);
      return;
    }
    const nextDraft = toEditorDraftForBlock(nextBlock);
    if (!activeDirty && nextDraft !== activeDraft) {
      updateActiveDraftState(nextDraft);
    }
    if (
      !activeDirty &&
      (
        !activeEditSnapshot ||
        activeEditSnapshot.blockId !== nextBlock.id ||
        activeEditSnapshot.raw !== nextBlock.raw
      )
    ) {
      setActiveEditSnapshot(createActiveEditSnapshotFromBlock(activeBlockIndex, nextBlock));
    }
  }, [activeBlockIndex, activeDirty, activeDraft, activeEditSnapshot, blocks]);

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
      updateActiveDraftState(markdown);
      setActiveDirty(false);
      setActiveEditSnapshot(createDetachedEmptyEditSnapshot(markdown));
      setActiveComposing(false);
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
      updateActiveDraftState("");
      setActiveDirty(false);
      setActiveEditSnapshot(null);
      setActiveComposing(false);
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
    cacheSvgCodeFencePreviewHeightForBlock(nextIndex, targetBlock);
    setActiveBlockIndex(nextIndex);
    setActiveEditSnapshot(createActiveEditSnapshotFromBlock(nextIndex, targetBlock));
    updateActiveDraftState(toEditorDraftForBlock(targetBlock));
    setActiveDirty(false);
    setActiveComposing(false);
    pendingActivationMarkdownRef.current = null;
    setPendingActivation(null);
  }, [blocks, cacheSvgCodeFencePreviewHeightForBlock, markdown, pendingActivation, updateActiveDraftState]);

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

  const closePageLinkPicker = useCallback(() => {
    setPendingPageLinkPickerRequest(null);
    setPageLinkPickerState(null);
  }, []);

  const closeTypedImageLinkPicker = useCallback(() => {
    setPendingTypedImageLinkPickerRequest(null);
    setTypedImageLinkPickerState(null);
  }, []);

  const closeImageEmbedReplacePicker = useCallback(() => {
    setImageEmbedReplacePickerState(null);
  }, []);

  const requestPageLinkPickerOpen = useCallback((request: PendingPageLinkPickerRequest) => {
    setPendingTypedImageLinkPickerRequest(null);
    setTypedImageLinkPickerState(null);
    setPendingPageLinkPickerRequest(request);
    setPageLinkPickerState(null);
  }, []);

  const requestTypedImageLinkPickerOpen = useCallback((request: PendingTypedImageLinkPickerRequest) => {
    setPendingPageLinkPickerRequest(null);
    setPageLinkPickerState(null);
    setPendingTypedImageLinkPickerRequest(request);
    setTypedImageLinkPickerState(null);
  }, []);

  useLayoutEffect(() => {
    if (!pendingPageLinkPickerRequest) {
      return;
    }
    if (activeBlockIndex === null) {
      return;
    }
    const textarea = textareaRef.current;
    const container = containerRef.current;
    if (!textarea || !container) {
      return;
    }
    const replaceRange = pendingPageLinkPickerRequest.replaceRange ?? {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
    const anchor = resolveTextareaCaretAnchor(textarea, container, replaceRange.end);
    setPageLinkPickerState({
      source: pendingPageLinkPickerRequest.source,
      blockIndex: activeBlockIndex,
      replaceRange: {
        start: Math.max(0, Math.min(replaceRange.start, textarea.value.length)),
        end: Math.max(0, Math.min(replaceRange.end, textarea.value.length)),
      },
      anchorLeft: anchor.left,
      anchorTop: anchor.top,
      query: "",
      highlightedIndex: 0,
    });
    setPendingPageLinkPickerRequest(null);
  }, [activeBlockIndex, pendingPageLinkPickerRequest, activeDraft]);

  useLayoutEffect(() => {
    if (!pendingTypedImageLinkPickerRequest) {
      return;
    }
    if (activeBlockIndex === null) {
      return;
    }
    const textarea = textareaRef.current;
    const container = containerRef.current;
    if (!textarea || !container) {
      return;
    }
    const replaceRange = pendingTypedImageLinkPickerRequest.replaceRange ?? {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
    const anchor = resolveTextareaCaretAnchor(textarea, container, replaceRange.end);
    setTypedImageLinkPickerState({
      blockIndex: activeBlockIndex,
      replaceRange: {
        start: Math.max(0, Math.min(replaceRange.start, textarea.value.length)),
        end: Math.max(0, Math.min(replaceRange.end, textarea.value.length)),
      },
      anchorLeft: anchor.left,
      anchorTop: anchor.top,
      query: "",
      highlightedIndex: 0,
    });
    setPendingTypedImageLinkPickerRequest(null);
  }, [activeBlockIndex, pendingTypedImageLinkPickerRequest, activeDraft]);

  useEffect(() => {
    if (!pageLinkPickerState) {
      return;
    }
    const handle = window.requestAnimationFrame(() => {
      const input = pageLinkPickerSearchInputRef.current;
      if (!input) {
        return;
      }
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
      input.select();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [pageLinkPickerState]);

  useEffect(() => {
    if (!typedImageLinkPickerState) {
      return;
    }
    const handle = window.requestAnimationFrame(() => {
      const input = typedImageLinkPickerRef.current?.querySelector<HTMLInputElement>(
        "input[type='search']",
      );
      if (!input) {
        return;
      }
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
      input.select();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [typedImageLinkPickerState]);

  useEffect(() => {
    if (!pageLinkPickerState) {
      return;
    }
    setPageLinkPickerState((current) => {
      if (!current) {
        return current;
      }
      if (activeBlockIndex === null || current.blockIndex !== activeBlockIndex) {
        return null;
      }
      return current;
    });
  }, [activeBlockIndex, pageLinkPickerState]);

  useEffect(() => {
    if (!typedImageLinkPickerState) {
      return;
    }
    setTypedImageLinkPickerState((current) => {
      if (!current) {
        return current;
      }
      if (activeBlockIndex === null || current.blockIndex !== activeBlockIndex) {
        return null;
      }
      return current;
    });
  }, [activeBlockIndex, typedImageLinkPickerState]);

  useEffect(() => {
    if (!typedImageLinkPickerState) {
      return;
    }
    if (
      insertMenuState !== null ||
      pageLinkPickerState !== null ||
      mathToolboxState !== null ||
      selectionContextMenuState !== null ||
      disabled
    ) {
      setTypedImageLinkPickerState(null);
    }
  }, [
    disabled,
    insertMenuState,
    mathToolboxState,
    pageLinkPickerState,
    selectionContextMenuState,
    typedImageLinkPickerState,
  ]);

  useEffect(() => {
    if (!pageLinkPickerState) {
      return;
    }
    setPageLinkPickerState((current) => {
      if (!current) {
        return current;
      }
      const nextMaxIndex = Math.max(0, filteredPageLinkCandidates.length - 1);
      const nextIndex = Math.max(0, Math.min(current.highlightedIndex, nextMaxIndex));
      if (nextIndex === current.highlightedIndex) {
        return current;
      }
      return {
        ...current,
        highlightedIndex: nextIndex,
      };
    });
  }, [filteredPageLinkCandidates.length, pageLinkPickerState]);

  useEffect(() => {
    if (!typedImageLinkPickerState) {
      return;
    }
    setTypedImageLinkPickerState((current) => {
      if (!current) {
        return current;
      }
      const nextMaxIndex = Math.max(0, filteredTypedImageLinkCandidates.length - 1);
      const nextIndex = Math.max(0, Math.min(current.highlightedIndex, nextMaxIndex));
      if (nextIndex === current.highlightedIndex) {
        return current;
      }
      return {
        ...current,
        highlightedIndex: nextIndex,
      };
    });
  }, [filteredTypedImageLinkCandidates.length, typedImageLinkPickerState]);

  useEffect(() => {
    if (!pageLinkPickerState) {
      return;
    }
    const handleDocumentMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (pageLinkPickerRef.current?.contains(target)) {
        return;
      }
      closePageLinkPicker();
    };
    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      closePageLinkPicker();
    };
    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [closePageLinkPicker, pageLinkPickerState]);

  useEffect(() => {
    if (!typedImageLinkPickerState) {
      return;
    }
    const handleDocumentMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (typedImageLinkPickerRef.current?.contains(target)) {
        return;
      }
      closeTypedImageLinkPicker();
    };
    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      closeTypedImageLinkPicker();
    };
    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [closeTypedImageLinkPicker, typedImageLinkPickerState]);

  useEffect(() => {
    if (!imageEmbedReplacePickerState) {
      return;
    }
    const handle = window.requestAnimationFrame(() => {
      const input = imageEmbedReplacePickerRef.current?.querySelector<HTMLInputElement>(
        "input[type='search']",
      );
      if (!input) {
        return;
      }
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
      input.select();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [imageEmbedReplacePickerState]);

  useEffect(() => {
    if (!imageEmbedReplacePickerState) {
      return;
    }
    setImageEmbedReplacePickerState((current) => {
      if (!current) {
        return current;
      }
      const block = blocks[current.blockIndex];
      if (!block || block.id !== current.blockId || block.kind !== "image-embed") {
        return null;
      }
      return current;
    });
  }, [blocks, imageEmbedReplacePickerState]);

  useEffect(() => {
    if (!imageEmbedReplacePickerState) {
      return;
    }
    if (
      activeBlockIndex !== null ||
      activeCardTableState !== null ||
      insertMenuState !== null ||
      pageLinkPickerState !== null ||
      typedImageLinkPickerState !== null ||
      mathToolboxState !== null ||
      selectionContextMenuState !== null ||
      disabled
    ) {
      setImageEmbedReplacePickerState(null);
    }
  }, [
    activeBlockIndex,
    activeCardTableState,
    disabled,
    imageEmbedReplacePickerState,
    insertMenuState,
    mathToolboxState,
    pageLinkPickerState,
    typedImageLinkPickerState,
    selectionContextMenuState,
  ]);

  useEffect(() => {
    if (!imageEmbedReplacePickerState) {
      return;
    }
    setImageEmbedReplacePickerState((current) => {
      if (!current) {
        return current;
      }
      const nextMaxIndex = Math.max(0, filteredImageEmbedReplaceCandidates.length - 1);
      const nextIndex = Math.max(0, Math.min(current.highlightedIndex, nextMaxIndex));
      if (nextIndex === current.highlightedIndex) {
        return current;
      }
      return {
        ...current,
        highlightedIndex: nextIndex,
      };
    });
  }, [filteredImageEmbedReplaceCandidates.length, imageEmbedReplacePickerState]);

  useEffect(() => {
    if (!imageEmbedReplacePickerState) {
      return;
    }
    const handleDocumentMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (imageEmbedReplacePickerRef.current?.contains(target)) {
        return;
      }
      if (target instanceof Element && target.closest(".markdown-hybrid-image-embed-replace-shell")) {
        return;
      }
      closeImageEmbedReplacePicker();
    };
    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      closeImageEmbedReplacePicker();
    };
    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [closeImageEmbedReplacePicker, imageEmbedReplacePickerState]);

  useEffect(() => {
    if (!activeCardTableState) {
      return;
    }
    setActiveCardTableState((current) => {
      if (!current) {
        return current;
      }
      const block = blocks[current.blockIndex];
      if (!block || block.kind !== "card-block" || block.id !== current.blockId) {
        activeCardTableSessionRef.current = null;
        setActiveCardTableDirty(false);
        return null;
      }
      const segment = resolveCardTableSegmentFromParts(
        extractCardBlockPreviewParts(block.raw),
        current,
      );
      if (!segment) {
        activeCardTableSessionRef.current = null;
        setActiveCardTableDirty(false);
        return null;
      }
      return current;
    });
  }, [activeCardTableState, blocks]);

  useEffect(() => {
    if (!activeCardTableState) {
      return;
    }
    if (
      activeBlockIndex !== null ||
      insertMenuState !== null ||
      pageLinkPickerState !== null ||
      mathToolboxState !== null ||
      selectionContextMenuState !== null ||
      imageEmbedReplacePickerState !== null ||
      disabled
    ) {
      const session = activeCardTableSessionRef.current;
      if (session && !session.flush()) {
        return;
      }
      activeCardTableSessionRef.current = null;
      setActiveCardTableState(null);
      setActiveCardTableDirty(false);
    }
  }, [
    activeBlockIndex,
    activeCardTableState,
    disabled,
    imageEmbedReplacePickerState,
    insertMenuState,
    mathToolboxState,
    pageLinkPickerState,
    selectionContextMenuState,
  ]);

  const applyGlobalHistory = useCallback(
    (nextHistory: MarkdownHistoryState) => {
      setHistory(nextHistory);
      setActiveBlockIndex(null);
      updateActiveDraftState("");
      setActiveDirty(false);
      setActiveEditSnapshot(null);
      setActiveComposing(false);
      setActiveTableDirty(false);
      setActiveCardTableState(null);
      setActiveCardTableDirty(false);
      setPendingActivation(null);
      setPendingTableActivation(null);
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      setInsertMenuState(null);
      setMathToolboxState(null);
      setSelectionContextMenuState(null);
      setSelectionMarqueeRect(null);
      setPendingTypedImageLinkPickerRequest(null);
      setTypedImageLinkPickerState(null);
      setPendingPageLinkPickerRequest(null);
      setPageLinkPickerState(null);
      setImageEmbedReplacePickerState(null);
      setInlineFormattingToolbarSelection(null);
      setInlineFormattingToolbarMenu(null);
      setInlineFormattingToolbarLinkState(null);
      selectionGestureRef.current = null;
      suppressNextBlockContextMenuRef.current = false;
      pendingActivationMarkdownRef.current = null;
      activeTableSessionRef.current = null;
      activeCardTableSessionRef.current = null;
      deferredEditActionRef.current = null;
      deferredEditRequestsRef.current.splice(0).forEach((request) => {
        request.resolve(false);
      });
      if (deferredEditFlushFrameRef.current !== null) {
        window.cancelAnimationFrame(deferredEditFlushFrameRef.current);
        deferredEditFlushFrameRef.current = null;
      }
      inlineFormattingToolbarRangeRef.current = null;
      inlineFormattingToolbarPendingSignatureRef.current = null;
      if (inlineFormattingToolbarTimerRef.current !== null) {
        window.clearTimeout(inlineFormattingToolbarTimerRef.current);
        inlineFormattingToolbarTimerRef.current = null;
      }
      onChange(nextHistory.present.markdown);
    },
    [onChange],
  );

  const clearPendingTableActivation = useCallback((blockIndex: number) => {
    setPendingTableActivation((current) =>
      current?.blockIndex === blockIndex ? null : current
    );
  }, []);

  const registerActiveTableSession = useCallback(
    (controller: MarkdownHybridTableSessionController | null) => {
      activeTableSessionRef.current = controller;
      if (!controller) {
        setActiveTableDirty(false);
      }
    },
    [],
  );

  const clearActiveCardTableState = useCallback(
    (options?: { flush?: boolean }) => {
      const session = activeCardTableSessionRef.current;
      if (options?.flush && session && !session.flush()) {
        return false;
      }
      activeCardTableSessionRef.current = null;
      setActiveCardTableState(null);
      setActiveCardTableDirty(false);
      return true;
    },
    [],
  );

  const registerActiveCardTableSession = useCallback(
    (controller: MarkdownHybridTableSessionController | null) => {
      activeCardTableSessionRef.current = controller;
      if (!controller) {
        setActiveCardTableDirty(false);
      }
    },
    [],
  );

  const consumeCardTablePendingActivation = useCallback((target: CardTableSegmentTarget) => {
    setActiveCardTableState((current) => {
      if (!current || !isSameCardTableSegmentTarget(current, target) || !current.pendingActivation) {
        return current;
      }
      return {
        ...current,
        pendingActivation: null,
      };
    });
  }, []);

  const handleCardTableSegmentCommitRaw = useCallback(
    (target: CardTableSegmentTarget, nextRaw: string) => {
      const block = blocks[target.blockIndex];
      if (!block || block.kind !== "card-block" || block.id !== target.blockId) {
        return false;
      }
      const previewParts = extractCardBlockPreviewParts(block.raw);
      const segment = resolveCardTableSegmentFromParts(previewParts, target);
      if (!segment) {
        return false;
      }
      if (segment.raw === nextRaw) {
        return true;
      }
      const nextBlockRaw = `${block.raw.slice(0, segment.startOffset)}${nextRaw}${block.raw.slice(segment.endOffset)}`;
      if (nextBlockRaw === block.raw) {
        return true;
      }
      const nextMarkdown = applyEditorMarkdownNormalization(
        replaceMarkdownBlock(markdown, block, nextBlockRaw),
      );
      if (nextMarkdown === markdown) {
        return true;
      }
      onChange(nextMarkdown);
      setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-commit"));
      onCommit?.(nextMarkdown, { block: { ...block, raw: nextBlockRaw } });
      return true;
    },
    [blocks, markdown, onChange, onCommit],
  );

  const handleTableBlockCommitRaw = useCallback(
    (blockIndex: number, nextRaw: string) => {
      const block = blocks[blockIndex];
      if (!block) {
        return false;
      }
      const nextMarkdown = applyEditorMarkdownNormalization(
        replaceMarkdownBlock(markdown, block, nextRaw),
      );
      if (nextMarkdown === markdown) {
        return true;
      }
      onChange(nextMarkdown);
      setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-commit"));
      onCommit?.(nextMarkdown, { block: { ...block, raw: nextRaw } });
      if (activeBlockIndex === blockIndex) {
        updateActiveDraftState(nextRaw);
        setActiveDirty(false);
        setActiveEditSnapshot((current) =>
          current && current.blockIndex === blockIndex
            ? {
              ...current,
              raw: nextRaw,
              draft: nextRaw,
            }
            : current,
        );
      }
      return true;
    },
    [activeBlockIndex, blocks, markdown, onChange, onCommit],
  );

  const handleMathBlockLiveSync = useCallback(
    (blockIndex: number, nextLatex: string, _options?: { mergeKey?: string }) => {
      const snapshot = activeEditSnapshotRef.current;
      if (
        activeBlockIndex !== blockIndex ||
        !snapshot ||
        snapshot.blockIndex !== blockIndex ||
        snapshot.kind !== "math-block"
      ) {
        return false;
      }
      const nextRaw = normalizeMathBlockSource(["$$", nextLatex.trim(), "$$"].join("\n"));
      updateActiveDraftState(nextRaw);
      setActiveDirty(true);
      setActiveEditSnapshot((current) =>
        current && current.blockIndex === blockIndex
          ? {
            ...current,
            draft: nextRaw,
          }
          : current,
      );
      return true;
    },
    [activeBlockIndex],
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

  const resetActiveEditorUi = useCallback(() => {
    closePageLinkPicker();
    closeTypedImageLinkPicker();
    setPendingPageLinkPickerRequest(null);
    setInlineFormattingToolbarSelection(null);
    setInlineFormattingToolbarMenu(null);
    setInlineFormattingToolbarLinkState(null);
    setMathToolboxState(null);
    inlineFormattingToolbarRangeRef.current = null;
    inlineFormattingToolbarPendingSignatureRef.current = null;
    if (inlineFormattingToolbarTimerRef.current !== null) {
      window.clearTimeout(inlineFormattingToolbarTimerRef.current);
      inlineFormattingToolbarTimerRef.current = null;
    }
  }, [closePageLinkPicker, closeTypedImageLinkPicker]);

  const resolveDeferredEditRequests = useCallback(
    (performedKind: DeferredEditAction["kind"], result: boolean) => {
      const requests = deferredEditRequestsRef.current;
      deferredEditRequestsRef.current = [];
      requests.forEach((request) => {
        request.resolve(result && request.kind === performedKind);
      });
    },
    [],
  );

  const commitActiveBlockNow = useCallback(
    (options?: { deactivate?: boolean; nextActivation?: PendingActivation | null }) => {
      if (activeBlockIndex === null) {
        if (options?.deactivate ?? true) {
          if (!clearActiveCardTableState({ flush: true })) {
            return false;
          }
        }
        return true;
      }

      const liveBlock = blocks[activeBlockIndex] ?? null;
      if (liveBlock?.kind === "table") {
        const session = activeTableSessionRef.current;
        if (session?.blockIndex === activeBlockIndex && !session.flush()) {
          return false;
        }
        if (options?.deactivate ?? true) {
          resetActiveEditorUi();
          setActiveBlockIndex(null);
          updateActiveDraftState("");
          setActiveDirty(false);
          setActiveEditSnapshot(null);
          setActiveComposing(false);
          clearActiveCardTableState();
          if (!options?.nextActivation || pendingTableActivation?.blockIndex !== options.nextActivation.index) {
            setPendingTableActivation(null);
          }
        }
        setActiveTableDirty(false);
        if (options?.nextActivation) {
          setPendingActivation(options.nextActivation);
        }
        return true;
      }

      const snapshot = activeEditSnapshotRef.current;
      if (!snapshot) {
        if (options?.deactivate ?? true) {
          resetActiveEditorUi();
          setActiveBlockIndex(null);
          updateActiveDraftState("");
          setActiveDirty(false);
          setActiveEditSnapshot(null);
          setActiveComposing(false);
          clearActiveCardTableState();
          if (!options?.nextActivation || pendingTableActivation?.blockIndex !== options.nextActivation.index) {
            setPendingTableActivation(null);
          }
        }
        return true;
      }

      const currentDraft = textareaRef.current?.value ?? activeDraftRef.current;
      const activeSelectionStart = textareaRef.current?.selectionStart ?? null;
      const normalizedHeadingSpacing = normalizeLeadingHeadingSpacing(
        currentDraft,
        snapshot.kind,
        activeSelectionStart,
      );
      const draftForPersist = normalizedHeadingSpacing?.value ?? currentDraft;
      const normalizedDraftForPersist = snapshot.kind === "math-block"
        ? draftForPersist
        : normalizeMultilineInlineMathOnCommit(draftForPersist);

      let nextResolvedMarkdown = markdown;
      let committedBlock: MarkdownBlock;

      if (snapshot.isDetachedEmptyBlock) {
        nextResolvedMarkdown = applyEditorMarkdownNormalization(normalizedDraftForPersist);
        committedBlock = parseMarkdownBlocks(nextResolvedMarkdown)[0] ?? {
          id: snapshot.blockId,
          kind: "blank",
          startLine: snapshot.startLine,
          endLine: snapshot.endLine,
          startOffset: 0,
          endOffset: nextResolvedMarkdown.length,
          raw: nextResolvedMarkdown,
        };
      } else {
        let nextBlockRaw = toPersistedBlockRawForDraft({ kind: snapshot.kind }, normalizedDraftForPersist);
        if (snapshot.kind === "ordered-list") {
          if (shouldNormalizeOrderedListOnCommit(markdown, snapshot.startLine, nextBlockRaw)) {
            nextBlockRaw = normalizeOrderedListBlockSource(nextBlockRaw);
          }
        } else if (snapshot.kind === "help-block") {
          nextBlockRaw = normalizeHelpBlockSource(nextBlockRaw);
        } else if (snapshot.kind === "hr") {
          nextBlockRaw = normalizeHorizontalRuleBlockSource(nextBlockRaw);
        }
        nextResolvedMarkdown = applyEditorMarkdownNormalization(
          replaceMarkdownBlock(markdown, snapshot, nextBlockRaw),
        );
        committedBlock = liveBlock && liveBlock.id === snapshot.blockId
          ? { ...liveBlock, raw: nextBlockRaw }
          : {
            id: snapshot.blockId,
            kind: snapshot.kind,
            startLine: snapshot.startLine,
            endLine: snapshot.endLine,
            startOffset: snapshot.startOffset,
            endOffset: snapshot.endOffset,
            raw: nextBlockRaw,
          };
      }

      if (nextResolvedMarkdown !== markdown) {
        pendingActivationMarkdownRef.current = options?.nextActivation ? nextResolvedMarkdown : null;
        onChange(nextResolvedMarkdown);
      } else if (options?.nextActivation) {
        pendingActivationMarkdownRef.current = null;
      }

      setHistory((current) => pushMarkdownHistory(current, nextResolvedMarkdown, "block-commit"));
      onCommit?.(nextResolvedMarkdown, { block: committedBlock });

      if (options?.deactivate ?? true) {
        resetActiveEditorUi();
        setActiveBlockIndex(null);
        updateActiveDraftState("");
        setActiveDirty(false);
        setActiveEditSnapshot(null);
        setActiveComposing(false);
        clearActiveCardTableState();
        if (!options?.nextActivation || pendingTableActivation?.blockIndex !== options.nextActivation.index) {
          setPendingTableActivation(null);
        }
      } else {
        setActiveDirty(false);
        setActiveEditSnapshot((current) =>
          current
            ? {
              ...current,
              raw: committedBlock.raw,
              draft: toEditorDraftForBlock(committedBlock),
            }
            : current,
        );
        updateActiveDraftState(toEditorDraftForBlock(committedBlock));
      }

      if (options?.nextActivation) {
        setPendingActivation(options.nextActivation);
      }

      return true;
    },
    [
      activeBlockIndex,
      blocks,
      markdown,
      onChange,
      onCommit,
      clearActiveCardTableState,
      pendingTableActivation,
      resetActiveEditorUi,
      updateActiveDraftState,
    ],
  );

  const discardActiveBlockNow = useCallback(() => {
    clearActiveCardTableState();
    resetActiveEditorUi();
    setActiveBlockIndex(null);
    updateActiveDraftState("");
    setActiveDirty(false);
    setActiveEditSnapshot(null);
    setActiveComposing(false);
    setActiveTableDirty(false);
    setPendingActivation(null);
    setPendingTableActivation(null);
    return true;
  }, [clearActiveCardTableState, resetActiveEditorUi, updateActiveDraftState]);

  const flushDeferredEditAction = useCallback(() => {
    const action = deferredEditActionRef.current;
    deferredEditActionRef.current = null;
    if (!action) {
      return true;
    }
    const result = action.kind === "discard"
      ? discardActiveBlockNow()
      : commitActiveBlockNow(action.options);
    resolveDeferredEditRequests(action.kind, result);
    return result;
  }, [commitActiveBlockNow, discardActiveBlockNow, resolveDeferredEditRequests]);

  const scheduleDeferredEditFlush = useCallback(() => {
    if (deferredEditFlushFrameRef.current !== null) {
      return;
    }
    deferredEditFlushFrameRef.current = window.requestAnimationFrame(() => {
      deferredEditFlushFrameRef.current = null;
      flushDeferredEditAction();
    });
  }, [flushDeferredEditAction]);

  const queueDeferredEditAction = useCallback(
    (action: DeferredEditAction, requestKind: DeferredEditAction["kind"]) =>
      new Promise<boolean>((resolve) => {
        deferredEditActionRef.current = mergeDeferredEditAction(
          deferredEditActionRef.current,
          action,
        );
        deferredEditRequestsRef.current.push({ kind: requestKind, resolve });
      }),
    [],
  );

  const commitActiveBlock = useCallback(
    (options?: { deactivate?: boolean; nextActivation?: PendingActivation | null }) => {
      if (activeComposingRef.current) {
        void queueDeferredEditAction({ kind: "commit", options }, "commit");
        return false;
      }
      return commitActiveBlockNow(options);
    },
    [commitActiveBlockNow, queueDeferredEditAction],
  );

  const commitActiveBlockAsync = useCallback(
    (options?: { deactivate?: boolean; nextActivation?: PendingActivation | null }) => {
      if (activeComposingRef.current) {
        return queueDeferredEditAction({ kind: "commit", options }, "commit");
      }
      return Promise.resolve(commitActiveBlockNow(options));
    },
    [commitActiveBlockNow, queueDeferredEditAction],
  );

  const discardActiveBlock = useCallback(() => {
    if (activeComposingRef.current) {
      void queueDeferredEditAction({ kind: "discard" }, "discard");
      return false;
    }
    return discardActiveBlockNow();
  }, [discardActiveBlockNow, queueDeferredEditAction]);

  const discardActiveBlockAsync = useCallback(() => {
    if (activeComposingRef.current) {
      return queueDeferredEditAction({ kind: "discard" }, "discard");
    }
    return Promise.resolve(discardActiveBlockNow());
  }, [discardActiveBlockNow, queueDeferredEditAction]);

  const handleCardTableSegmentRequestActivate = useCallback(
    (target: CardTableSegmentTarget, request?: MarkdownHybridTableActivationRequest) => {
      if (disabled) {
        return;
      }
      const block = blocks[target.blockIndex];
      if (!block || block.kind !== "card-block" || block.id !== target.blockId) {
        return;
      }
      if (!resolveCardTableSegmentFromParts(extractCardBlockPreviewParts(block.raw), target)) {
        return;
      }
      if (activeBlockIndex !== null && !commitActiveBlock({ deactivate: true })) {
        return;
      }
      setPendingActivation(null);
      setPendingTableActivation(null);
      setInsertMenuState(null);
      setMathToolboxState(null);
      setSelectionContextMenuState(null);
      closeImageEmbedReplacePicker();
      closePageLinkPicker();
      setActiveCardTableDirty(false);
      setActiveCardTableState((current) =>
        current && isSameCardTableSegmentTarget(current, target)
          ? {
            ...current,
            pendingActivation: request ?? null,
          }
          : {
            ...target,
            pendingActivation: request ?? null,
          }
      );
    },
    [
      activeBlockIndex,
      blocks,
      closeImageEmbedReplacePicker,
      closePageLinkPicker,
      commitActiveBlock,
      disabled,
    ],
  );

  const activateBlock = useCallback(
    (index: number, caret: "start" | "end" = "end") => {
      if (disabled) {
        return;
      }
      if (!clearActiveCardTableState({ flush: true })) {
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
      cacheSvgCodeFencePreviewHeightForBlock(nextIndex, nextBlock);
      if (activeBlockIndex !== null && activeBlockIndex !== nextIndex) {
        commitActiveBlock({
          deactivate: true,
          nextActivation: { index: nextIndex, caret },
        });
        return;
      }
      if (activeBlockIndex === nextIndex) {
        pendingCaretRef.current = caret;
        return;
      }
      pendingCaretRef.current = caret;
      setPendingTableActivation(null);
      setActiveBlockIndex(nextIndex);
      setActiveEditSnapshot(createActiveEditSnapshotFromBlock(nextIndex, nextBlock));
      updateActiveDraftState(toEditorDraftForBlock(nextBlock));
      setActiveDirty(false);
      setActiveComposing(false);
      setActiveTableDirty(false);
    },
    [
      activeBlockIndex,
      blocks,
      cacheSvgCodeFencePreviewHeightForBlock,
      clearActiveCardTableState,
      commitActiveBlock,
      disabled,
    ],
  );

  const handleTableBlockRequestActivate = useCallback(
    (index: number, request?: MarkdownHybridTableActivationRequest) => {
      if (disabled) {
        return;
      }
      if (!clearActiveCardTableState({ flush: true })) {
        return;
      }
      const nextIndex = clampIndex(index, blocks.length);
      const nextBlock = blocks[nextIndex];
      if (!nextBlock || nextBlock.kind !== "table") {
        return;
      }
      if (activeBlockIndex !== null && activeBlockIndex !== nextIndex) {
        if (request) {
          setPendingTableActivation({ blockIndex: nextIndex, request });
        }
        commitActiveBlock({
          deactivate: true,
          nextActivation: { index: nextIndex, caret: "start" },
        });
        return;
      }
      setPendingActivation(null);
      if (request) {
        setPendingTableActivation({ blockIndex: nextIndex, request });
      }
      if (activeBlockIndex === nextIndex) {
        setActiveTableDirty(false);
        return;
      }
      setActiveBlockIndex(nextIndex);
      setActiveEditSnapshot(createActiveEditSnapshotFromBlock(nextIndex, nextBlock));
      updateActiveDraftState(nextBlock.raw);
      setActiveDirty(false);
      setActiveComposing(false);
      setActiveTableDirty(false);
    },
    [activeBlockIndex, blocks, clearActiveCardTableState, commitActiveBlock, disabled],
  );

  const handleMathToolboxButtonMouseDown = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const handleMathToolboxButtonClick = useCallback(
    (blockIndex: number) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (disabled) {
        return;
      }
      const block = blocks[blockIndex];
      if (!block || block.kind !== "math-block") {
        return;
      }
      setMathToolboxState((current) =>
        current && current.blockIndex === blockIndex
          ? null
          : {
            blockIndex,
            sessionId: `math-toolbox-${Date.now()}-${blockIndex}`,
            initialLatexSnapshot: extractMathBlockBody(
              activeBlockIndex === blockIndex ? activeDraft : block.raw,
            ),
          });
      if (activeBlockIndex !== blockIndex) {
        activateBlock(blockIndex, "start");
      }
    },
    [activateBlock, activeBlockIndex, activeDraft, blocks, disabled],
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
    if (selectionAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(selectionAutoScrollFrameRef.current);
      selectionAutoScrollFrameRef.current = null;
    }
    if (selectionDragUpdateFrameRef.current !== null) {
      window.cancelAnimationFrame(selectionDragUpdateFrameRef.current);
      selectionDragUpdateFrameRef.current = null;
    }
    setSelectedBlockSelection(null);
    setIsSelectionDragging(false);
    setSelectionContextMenuState(null);
    setSelectionMarqueeRect(null);
    selectionDragPointerRef.current = null;
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
      const startPoint = getContainerLocalPoint(options.clientX, options.clientY);
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

      if (activeBlockIndex !== null && !commitActiveBlock({ deactivate: true })) {
        return false;
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
        startContentX: startPoint?.x ?? options.clientX,
        startContentY: startPoint?.y ?? options.clientY,
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
      getContainerLocalPoint,
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
      const startPoint = getContainerLocalPoint(options.clientX, options.clientY);
      if (activeBlockIndex !== null && !commitActiveBlock({ deactivate: true })) {
        return false;
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
        startContentX: startPoint?.x ?? options.clientX,
        startContentY: startPoint?.y ?? options.clientY,
      };
      suppressNextBlockContextMenuRef.current = false;
      setIsSelectionDragging(true);
      setSelectionMarqueeFromContentPoints(
        startPoint?.x ?? options.clientX,
        startPoint?.y ?? options.clientY,
        startPoint?.x ?? options.clientX,
        startPoint?.y ?? options.clientY,
      );
      focusContainer();
      return true;
    },
    [
      activeBlockIndex,
      commitActiveBlock,
      disabled,
      focusContainer,
      getContainerLocalPoint,
      selectedBlockSelection,
      setSelectionMarqueeFromContentPoints,
    ],
  );

  const deleteSelectedBlocks = useCallback(
    (options?: { source?: "delete" | "cut" }) => {
      if (disabled || activeBlockIndex !== null || !selectedBlockSelection) {
        return false;
      }
      const normalizedSelectedIndices = sortUniqueSelectionIndices(
        selectedBlockSelection.selectedIndices.filter((index) =>
          Number.isInteger(index) && index >= 0 && index < blocks.length
        ),
      );
      if (normalizedSelectedIndices.length === 0) {
        clearSelectedBlockRange();
        return false;
      }
      const nextMarkdownRaw = deleteMarkdownBlockSelection(markdown, blocks, selectedBlockSelection);
      if (nextMarkdownRaw === markdown) {
        clearSelectedBlockRange();
        return false;
      }
      const nextMarkdown = applyEditorMarkdownNormalization(nextMarkdownRaw);
      const nextBlocks = parseMarkdownBlocks(nextMarkdown);
      const firstSelectedIndex = normalizedSelectedIndices[0]!;
      const shouldFocusNeighborBlock = options?.source === "cut";

      setActiveBlockIndex(null);
      updateActiveDraftState("");
      setActiveDirty(false);
      setActiveEditSnapshot(null);
      setActiveComposing(false);
      setActiveTableDirty(false);
      if (shouldFocusNeighborBlock && nextBlocks.length > 0) {
        pendingActivationMarkdownRef.current = nextMarkdown;
        setPendingActivation({
          index: firstSelectedIndex < nextBlocks.length ? firstSelectedIndex : nextBlocks.length - 1,
          caret: "end",
        });
      } else {
        pendingActivationMarkdownRef.current = null;
        setPendingActivation(null);
      }
      setPendingTableActivation(null);
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      setInsertMenuState(null);
      setMathToolboxState(null);
      setSelectionContextMenuState(null);
      setSelectionMarqueeRect(null);
      selectionGestureRef.current = null;
      suppressNextBlockContextMenuRef.current = false;

      if (shouldFocusNeighborBlock && nextBlocks.length === 0) {
        setActiveBlockIndex(0);
        updateActiveDraftState("");
        setActiveDirty(false);
        setActiveEditSnapshot(createDetachedEmptyEditSnapshot(nextMarkdown));
        setActiveComposing(false);
      } else if (!shouldFocusNeighborBlock) {
        focusContainer();
      }

      onChange(nextMarkdown);
      setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-delete"));
      return true;
    },
    [
      activeBlockIndex,
      blocks,
      clearSelectedBlockRange,
      disabled,
      focusContainer,
      markdown,
      onChange,
      selectedBlockSelection,
      updateActiveDraftState,
    ],
  );

  const replaceSelectedBlocksWithRaw = useCallback(
    (insertedRaw: string) => {
      if (disabled || activeBlockIndex !== null || !selectedBlockSelection) {
        return false;
      }
      if (insertedRaw.length === 0) {
        return false;
      }
      const normalizedSelectedIndices = sortUniqueSelectionIndices(
        selectedBlockSelection.selectedIndices.filter((index) =>
          Number.isInteger(index) && index >= 0 && index < blocks.length
        ),
      );
      if (normalizedSelectedIndices.length === 0) {
        return false;
      }
      const firstSelectedIndex = normalizedSelectedIndices[0]!;
      const withoutSelectionMarkdown = applyEditorMarkdownNormalization(
        deleteMarkdownBlockSelection(markdown, blocks, selectedBlockSelection),
      );
      const blocksWithoutSelection = parseMarkdownBlocks(withoutSelectionMarkdown);
      const insertionIndex = Math.max(0, Math.min(firstSelectedIndex, blocksWithoutSelection.length));
      const nextMarkdown = applyEditorMarkdownNormalization(
        withInsertedRawBlock(blocksWithoutSelection, insertionIndex, insertedRaw),
      );
      if (nextMarkdown === markdown) {
        return false;
      }
      const nextBlocks = parseMarkdownBlocks(nextMarkdown);
      const activationIndex = resolveInsertedBlockActivationIndex(nextBlocks, insertedRaw, insertionIndex);

      setActiveBlockIndex(null);
      updateActiveDraftState("");
      setActiveDirty(false);
      setActiveEditSnapshot(null);
      setActiveComposing(false);
      setActiveTableDirty(false);
      pendingActivationMarkdownRef.current = activationIndex >= 0 ? nextMarkdown : null;
      setPendingActivation(
        activationIndex >= 0
          ? { index: activationIndex, caret: "end" }
          : null,
      );
      setPendingTableActivation(null);
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      setInsertMenuState(null);
      setMathToolboxState(null);
      setSelectionContextMenuState(null);
      setSelectionMarqueeRect(null);
      selectionGestureRef.current = null;
      suppressNextBlockContextMenuRef.current = false;
      onChange(nextMarkdown);
      setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-commit"));
      return true;
    },
    [
      activeBlockIndex,
      blocks,
      disabled,
      markdown,
      onChange,
      selectedBlockSelection,
      updateActiveDraftState,
    ],
  );

  const insertBlockRelativeTo = useCallback(
    (
      blockIndex: number,
      insertedRaw: string,
      insertAbove: boolean,
      options?: {
        firstPlaceholder?: string;
        selection?: {
          start: number;
          end: number;
        };
        transformNextMarkdown?: (value: string) => string;
      },
    ) => {
      if (disabled) {
        return false;
      }
      const targetIndex = insertAbove ? blockIndex : blockIndex + 1;
      const insertedMarkdown = applyEditorMarkdownNormalization(
        withInsertedRawBlock(blocks, targetIndex, insertedRaw),
      );
      const nextMarkdown = options?.transformNextMarkdown
        ? applyEditorMarkdownNormalization(options.transformNextMarkdown(insertedMarkdown))
        : insertedMarkdown;
      if (nextMarkdown === markdown) {
        return false;
      }

      const nextBlocks = parseMarkdownBlocks(nextMarkdown);
      const insertedBlocks = parseMarkdownBlocks(applyEditorMarkdownNormalization(insertedRaw));
      const primaryInsertedBlock = insertedBlocks.find((block) => block.kind !== "blank") ?? insertedBlocks[0];
      let activationSelection: PendingActivation["selection"] | undefined;
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
        } else if (options?.selection && primaryInsertedBlock.kind !== "hr") {
          activationSelection = options.selection;
        }
      }
      const activationIndex = resolveInsertedBlockActivationIndex(nextBlocks, insertedRaw, targetIndex);

      setActiveBlockIndex(null);
      updateActiveDraftState("");
      setActiveDirty(false);
      setActiveEditSnapshot(null);
      setActiveComposing(false);
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
      setMathToolboxState(null);
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

  const resolveImperativeInsertAnchorIndex = useCallback(() => {
    if (typeof activeBlockIndex === "number") {
      return activeBlockIndex;
    }
    if (blocks.length === 0) {
      return 0;
    }
    return blocks.length - 1;
  }, [activeBlockIndex, blocks.length]);

  const insertStructureTemplateInternal = useCallback(
    (template: "table" | "code-block" | "math-block") => {
      const templateConfig =
        template === "table"
          ? {
              raw: "| Column A | Column B |\n| --- | --- |\n| Value 1 | Value 2 |",
              firstPlaceholder: "Column A",
              selection: undefined,
            }
          : template === "code-block"
            ? {
                raw: "```txt\nCODE HERE\n```",
                firstPlaceholder: "CODE HERE",
                selection: undefined,
              }
            : {
                raw: "$$\n\n$$",
                firstPlaceholder: undefined,
                selection: { start: 3, end: 3 },
              };
      const anchorIndex = resolveImperativeInsertAnchorIndex();
      return insertBlockRelativeTo(anchorIndex, templateConfig.raw, false, {
        firstPlaceholder: templateConfig.firstPlaceholder,
        selection: templateConfig.selection,
      });
    },
    [insertBlockRelativeTo, resolveImperativeInsertAnchorIndex],
  );

  const openImageInsertPickerInternal = useCallback(() => {
    if (disabled) {
      return false;
    }
    const anchorIndex = resolveImperativeInsertAnchorIndex();
    setSelectionContextMenuState(null);
    setMathToolboxState(null);
    setInsertMenuState({
      blockIndex: anchorIndex,
      insertAbove: false,
      phase: "image-link-picker",
      categoryId: "links",
      query: "",
      highlightedIndex: 0,
    });
    return true;
  }, [disabled, resolveImperativeInsertAnchorIndex]);

  useImperativeHandle(ref, () => ({
    commitActiveEdit: () => commitActiveBlockAsync({ deactivate: true }),
    discardActiveEdit: () => discardActiveBlockAsync(),
    insertStructureTemplate: (template) =>
      Promise.resolve(insertStructureTemplateInternal(template)),
    openImageInsertPicker: () => Promise.resolve(openImageInsertPickerInternal()),
  }), [
    commitActiveBlockAsync,
    discardActiveBlockAsync,
    insertStructureTemplateInternal,
    openImageInsertPickerInternal,
  ]);

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
      updateActiveDraftState("");
      setActiveDirty(false);
      setActiveEditSnapshot(null);
      setActiveComposing(false);
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
    if (!mathToolboxState) {
      return;
    }
    const block = blocks[mathToolboxState.blockIndex];
    if (!block || block.kind !== "math-block") {
      setMathToolboxState(null);
    }
  }, [blocks, mathToolboxState]);

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
          advancedTemplateId: undefined,
          advancedSequenceNumber: undefined,
        };
      });
    },
    [],
  );

  const handleSelectAdvancedInsertTemplate = useCallback(
    (templateId: string) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const nextSequenceNumber = resolveNextGlobalSequenceNumber(markdown);
      setInsertMenuState((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          phase: "advanced-variant",
          categoryId: "advanced",
          advancedTemplateId: templateId,
          advancedSequenceNumber: nextSequenceNumber,
        };
      });
    },
    [markdown],
  );

  const handleInsertMenuBack = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setInsertMenuState((current) => {
      if (!current) {
        return current;
      }
      if (current.phase === "image-link-picker") {
        return {
          ...current,
          phase: "items",
          query: "",
          highlightedIndex: 0,
        };
      }
      if (current.phase === "advanced-variant") {
        return {
          ...current,
          phase: "items",
          advancedTemplateId: undefined,
          advancedSequenceNumber: undefined,
        };
      }
      return {
        ...current,
        phase: "categories",
        categoryId: undefined,
        advancedTemplateId: undefined,
        advancedSequenceNumber: undefined,
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

  const handleOpenImageEmbedReplacePicker = useCallback(
    (blockIndex: number) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (disabled) {
        return;
      }
      if (activeBlockIndex !== null && !commitActiveBlock({ deactivate: true })) {
        return;
      }
      const block = blocks[blockIndex];
      if (!block || block.kind !== "image-embed") {
        return;
      }
      setInsertMenuState(null);
      setMathToolboxState(null);
      setSelectionContextMenuState(null);
      setPendingTypedImageLinkPickerRequest(null);
      setTypedImageLinkPickerState(null);
      setPendingPageLinkPickerRequest(null);
      setPageLinkPickerState(null);
      setImageEmbedReplacePickerState((current) =>
        current && current.blockId === block.id
          ? null
          : {
              blockIndex,
              blockId: block.id,
              query: "",
              highlightedIndex: 0,
            }
      );
    },
    [activeBlockIndex, blocks, commitActiveBlock, disabled],
  );

  const handleImageEmbedReplaceQueryChange = useCallback((value: string) => {
    setImageEmbedReplacePickerState((current) =>
      current
        ? {
            ...current,
            query: value,
            highlightedIndex: 0,
          }
        : current
    );
  }, []);

  const handleImageEmbedReplaceSelectCandidate = useCallback(
    (candidate: VaultImageCandidate) => {
      if (!imageEmbedReplacePickerState) {
        return;
      }
      const block = blocks[imageEmbedReplacePickerState.blockIndex];
      if (
        !block ||
        block.id !== imageEmbedReplacePickerState.blockId ||
        block.kind !== "image-embed"
      ) {
        closeImageEmbedReplacePicker();
        return;
      }
      const currentImageEmbed = extractImageEmbedTokenFromRaw(block.raw);
      if (!currentImageEmbed) {
        closeImageEmbedReplacePicker();
        return;
      }
      const currentPath = normalizeRelativePath(currentImageEmbed.src).toLowerCase();
      const nextPath = normalizeRelativePath(candidate.relPath).toLowerCase();
      if (!nextPath || currentPath === nextPath) {
        closeImageEmbedReplacePicker();
        return;
      }
      const nextBlockRaw = serializePngEmbed(candidate.relPath, currentImageEmbed.label);
      const nextMarkdown = applyEditorMarkdownNormalization(
        replaceMarkdownBlock(markdown, block, nextBlockRaw),
      );
      closeImageEmbedReplacePicker();
      if (nextMarkdown === markdown) {
        return;
      }
      onChange(nextMarkdown);
      setHistory((current) => pushMarkdownHistory(current, nextMarkdown, "block-commit"));
      onCommit?.(nextMarkdown, { block: { ...block, raw: nextBlockRaw } });
    },
    [
      blocks,
      closeImageEmbedReplacePicker,
      imageEmbedReplacePickerState,
      markdown,
      onChange,
      onCommit,
    ],
  );

  const handleImageEmbedReplaceSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!imageEmbedReplacePickerState) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeImageEmbedReplacePicker();
        return;
      }
      if (filteredImageEmbedReplaceCandidates.length === 0) {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setImageEmbedReplacePickerState((current) => {
          if (!current) {
            return current;
          }
          const currentIndex = current.highlightedIndex ?? 0;
          return {
            ...current,
            highlightedIndex:
              (currentIndex + delta + filteredImageEmbedReplaceCandidates.length) %
              filteredImageEmbedReplaceCandidates.length,
          };
        });
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const candidate =
          filteredImageEmbedReplaceCandidates[imageEmbedReplacePickerState.highlightedIndex] ??
          filteredImageEmbedReplaceCandidates[0];
        if (!candidate) {
          return;
        }
        handleImageEmbedReplaceSelectCandidate(candidate);
      }
    },
    [
      closeImageEmbedReplacePicker,
      filteredImageEmbedReplaceCandidates,
      handleImageEmbedReplaceSelectCandidate,
      imageEmbedReplacePickerState,
    ],
  );

  const handleInsertImageLinkQueryChange = useCallback((value: string) => {
    setInsertMenuState((current) => {
      if (!current || current.phase !== "image-link-picker") {
        return current;
      }
      return {
        ...current,
        query: value,
        highlightedIndex: 0,
      };
    });
  }, []);

  const handleInsertImageLinkSelectCandidate = useCallback(
    (relativePath: string) => {
      if (!insertMenuState) {
        return;
      }
      const blockSource = serializePngEmbed(relativePath);
      insertBlockRelativeTo(insertMenuState.blockIndex, blockSource, insertMenuState.insertAbove);
    },
    [insertBlockRelativeTo, insertMenuState],
  );

  const handleInsertImageLinkSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!insertMenuState || insertMenuState.phase !== "image-link-picker") {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setInsertMenuState((current) =>
          current
            ? {
                ...current,
                phase: "items",
                query: "",
                highlightedIndex: 0,
              }
            : current,
        );
        return;
      }
      if (filteredImageLinkCandidates.length === 0) {
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setInsertMenuState((current) => {
          if (!current || current.phase !== "image-link-picker") {
            return current;
          }
          const currentIndex = current.highlightedIndex ?? 0;
          return {
            ...current,
            highlightedIndex:
              (currentIndex + delta + filteredImageLinkCandidates.length) %
              filteredImageLinkCandidates.length,
          };
        });
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const candidate =
          filteredImageLinkCandidates[insertMenuState.highlightedIndex ?? 0] ??
          filteredImageLinkCandidates[0];
        if (!candidate) {
          return;
        }
        handleInsertImageLinkSelectCandidate(candidate.relPath);
      }
    },
    [filteredImageLinkCandidates, handleInsertImageLinkSelectCandidate, insertMenuState],
  );

  const handleInsertMenuItemSelect = useCallback(
    (item: InsertMenuItem) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!insertMenuState) {
        return;
      }
      if (item.id === "page-link") {
        if (blocks.length === 0) {
          pendingCaretRef.current = "start";
          setActiveBlockIndex(0);
          updateActiveDraftState("");
          setActiveDirty(false);
          setActiveEditSnapshot(createDetachedEmptyEditSnapshot(""));
          setActiveComposing(false);
          setInsertMenuState(null);
          requestPageLinkPickerOpen({ source: "insert-menu" });
          return;
        }
        const inserted = insertEmptyParagraphRelativeTo(
          insertMenuState.blockIndex,
          insertMenuState.insertAbove,
        );
        if (inserted) {
          requestPageLinkPickerOpen({ source: "insert-menu" });
        }
        return;
      }
      if (item.id === "image-link") {
        setInsertMenuState((current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            phase: "image-link-picker",
            query: "",
            highlightedIndex: 0,
          };
        });
        return;
      }
      insertBlockRelativeTo(insertMenuState.blockIndex, item.template, insertMenuState.insertAbove, {
        firstPlaceholder: item.firstPlaceholder,
        selection: item.initialSelection,
      });
    },
    [blocks.length, insertBlockRelativeTo, insertEmptyParagraphRelativeTo, insertMenuState, requestPageLinkPickerOpen],
  );

  const handleAdvancedInsertTemplateVariantSelect = useCallback(
    (variant: AdvancedInsertTemplateVariant) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!insertMenuState?.advancedTemplateId) {
        return;
      }
      const template = getAdvancedInsertTemplateById(insertMenuState.advancedTemplateId);
      if (!template) {
        return;
      }
      const sequenceNumber = typeof insertMenuState.advancedSequenceNumber === "number" &&
          Number.isFinite(insertMenuState.advancedSequenceNumber)
        ? Math.max(1, Math.floor(insertMenuState.advancedSequenceNumber))
        : resolveNextGlobalSequenceNumber(markdown);
      const shouldWrapWithExam = variant === "task" && !hasBalancedExamWrapper(markdown);
      const resolved = buildAdvancedInsertTemplateVariant(template, variant, {
        sequenceNumber,
      });
      insertBlockRelativeTo(insertMenuState.blockIndex, resolved.payload, insertMenuState.insertAbove, {
        firstPlaceholder: resolved.firstPlaceholder,
        transformNextMarkdown: shouldWrapWithExam ? withExamWrapper : undefined,
      });
    },
    [insertBlockRelativeTo, insertMenuState, markdown],
  );

  const decrementAdvancedSequenceNumber = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setInsertMenuState((current) => {
      if (!current || current.phase !== "advanced-variant") {
        return current;
      }
      const currentValue = typeof current.advancedSequenceNumber === "number" &&
          Number.isFinite(current.advancedSequenceNumber)
        ? Math.max(1, Math.floor(current.advancedSequenceNumber))
        : 1;
      return {
        ...current,
        advancedSequenceNumber: Math.max(1, currentValue - 1),
      };
    });
  }, []);

  const incrementAdvancedSequenceNumber = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setInsertMenuState((current) => {
      if (!current || current.phase !== "advanced-variant") {
        return current;
      }
      const currentValue = typeof current.advancedSequenceNumber === "number" &&
          Number.isFinite(current.advancedSequenceNumber)
        ? Math.max(1, Math.floor(current.advancedSequenceNumber))
        : 1;
      return {
        ...current,
        advancedSequenceNumber: currentValue + 1,
      };
    });
  }, []);

  const handleAdvancedSequenceNumberInputChange = useCallback((event: FormEvent<HTMLInputElement>) => {
    const rawValue = event.currentTarget.value.trim();
    const parsedValue = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsedValue)) {
      return;
    }
    setInsertMenuState((current) => {
      if (!current || current.phase !== "advanced-variant") {
        return current;
      }
      return {
        ...current,
        advancedSequenceNumber: Math.max(1, parsedValue),
      };
    });
  }, []);

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
      const eventTarget = event.target;
      if (
        activeCardTableState &&
        eventTarget instanceof Element &&
        eventTarget.closest(".markdown-hybrid-card-table-segment .markdown-hybrid-table-block")
      ) {
        return;
      }
      if (event.key === "Escape" && imageEmbedReplacePickerState) {
        event.preventDefault();
        event.stopPropagation();
        closeImageEmbedReplacePicker();
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
      activeCardTableState,
      clearSelectedBlockRange,
      closeImageEmbedReplacePicker,
      deleteSelectedBlocks,
      disabled,
      handleGlobalRedo,
      handleGlobalUndo,
      imageEmbedReplacePickerState,
      insertMenuState,
      selectionContextMenuState,
      selectedBlockSelection,
    ],
  );

  const writeSelectedBlocksToClipboard = useCallback(
    (clipboardData: DataTransfer | null) => {
      const selectedBlocks = resolveSelectedBlocksInDocumentOrder(blocks, selectedBlockSelection);
      if (selectedBlocks.length === 0) {
        return false;
      }
      const clipboardBlocks: ClipboardBlockEntry[] = selectedBlocks.map((block) => ({
        kind: block.kind,
        raw: block.raw,
      }));
      const plainText = serializeMarkdownFromBlocks(clipboardBlocks);
      if (!setClipboardTextData(clipboardData, "text/plain", plainText)) {
        return false;
      }
      const payload = serializeInternalBlockClipboardPayload(clipboardBlocks);
      setClipboardTextData(clipboardData, INTERNAL_BLOCK_CLIPBOARD_MIME, payload);
      return true;
    },
    [blocks, selectedBlockSelection],
  );

  const handleEditorCopy = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (disabled || activeBlockIndex !== null || !selectedBlockSelection) {
        return;
      }
      if (!writeSelectedBlocksToClipboard(event.clipboardData)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [
      activeBlockIndex,
      disabled,
      selectedBlockSelection,
      writeSelectedBlocksToClipboard,
    ],
  );

  const handleEditorCut = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (disabled || activeBlockIndex !== null || !selectedBlockSelection) {
        return;
      }
      if (!writeSelectedBlocksToClipboard(event.clipboardData)) {
        return;
      }
      if (!deleteSelectedBlocks({ source: "cut" })) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [
      activeBlockIndex,
      deleteSelectedBlocks,
      disabled,
      selectedBlockSelection,
      writeSelectedBlocksToClipboard,
    ],
  );

  const handleEditorPaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && target.closest(".markdown-hybrid-table-block")) {
        return;
      }
      const clipboardData = event.clipboardData;
      const internalPayload = parseInternalBlockClipboardPayload(
        getClipboardTextData(clipboardData, INTERNAL_BLOCK_CLIPBOARD_MIME),
      );

      if (selectedBlockSelection && activeBlockIndex === null) {
        const plainText = getClipboardTextData(clipboardData, "text/plain");
        const insertedRaw = internalPayload
          ? serializeMarkdownFromBlocks(internalPayload.blocks)
          : plainText;
        if (insertedRaw.length === 0) {
          return;
        }
        if (replaceSelectedBlocksWithRaw(insertedRaw)) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (
        activeBlockIndex === null ||
        activeDirty ||
        activeTableDirty ||
        activeCardTableState !== null ||
        activeCardTableDirty
      ) {
        return;
      }
      if (!internalPayload) {
        return;
      }
      const insertedRaw = serializeMarkdownFromBlocks(internalPayload.blocks);
      if (insertedRaw.length === 0) {
        return;
      }
      if (insertBlockRelativeTo(activeBlockIndex, insertedRaw, false)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [
      activeBlockIndex,
      activeCardTableDirty,
      activeCardTableState,
      activeDirty,
      activeTableDirty,
      disabled,
      insertBlockRelativeTo,
      replaceSelectedBlocksWithRaw,
      selectedBlockSelection,
    ],
  );

  const handleTextareaChange = useCallback(
    (value: string, selectionStart?: number | null) => {
      if (typeof selectionStart === "number") {
        setEditorOverlaySelectionStart(selectionStart);
      }
      const typedPageLinkTrigger = pageLinkPickerState || typedImageLinkPickerState
        ? null
        : detectTypedPageLinkTrigger(value, selectionStart);
      const typedImageLinkTrigger = pageLinkPickerState || typedImageLinkPickerState
        ? null
        : detectTypedImageEmbedTrigger(value, selectionStart);
      if (activeBlockIndex === null) {
        return;
      }
      // Draft-only transaction: never write into committed markdown while the user edits.
      updateActiveDraftState(value);
      setActiveDirty(true);
      setActiveEditSnapshot((current) =>
        current
          ? {
            ...current,
            draft: value,
          }
          : current,
      );
      const block = activeEditSnapshotRef.current;
      if (typedPageLinkTrigger && block && canOpenPageLinkPickerInBlockKind(block.kind)) {
        requestPageLinkPickerOpen({
          source: "typed-trigger",
          replaceRange: typedPageLinkTrigger,
        });
        return;
      }
      if (typedImageLinkTrigger && block && canOpenPageLinkPickerInBlockKind(block.kind)) {
        requestTypedImageLinkPickerOpen({
          replaceRange: typedImageLinkTrigger,
        });
      }
    },
    [
      activeBlockIndex,
      pageLinkPickerState,
      requestPageLinkPickerOpen,
      requestTypedImageLinkPickerOpen,
      typedImageLinkPickerState,
    ],
  );

  const handleTextareaBlur = useCallback((event: FocusEvent<HTMLTextAreaElement>) => {
    const nextFocus = event.relatedTarget;
    if (nextFocus instanceof Node && pageLinkPickerRef.current?.contains(nextFocus)) {
      return;
    }
    if (nextFocus instanceof Node && typedImageLinkPickerRef.current?.contains(nextFocus)) {
      return;
    }
    if (nextFocus instanceof Node && mathToolboxRef.current?.contains(nextFocus)) {
      return;
    }
    if (nextFocus instanceof Node && inlineFormattingToolbarRef.current?.contains(nextFocus)) {
      return;
    }
    commitActiveBlock({ deactivate: true });
  }, [commitActiveBlock]);

  const handleTextareaCompositionStart = useCallback(() => {
    setActiveComposing(true);
  }, []);

  const handleTextareaCompositionEnd = useCallback(() => {
    setActiveComposing(false);
    if (deferredEditActionRef.current) {
      scheduleDeferredEditFlush();
    }
  }, [scheduleDeferredEditFlush]);

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

  const syncActiveTextareaAutoHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const activeBlock = activeBlockIndex === null ? null : (blocks[activeBlockIndex] ?? null);
    const syncedCodeFenceHeight = resolveStoredSvgCodeFencePreviewHeight(activeBlock);
    if (syncedCodeFenceHeight !== null) {
      textarea.style.height = `${syncedCodeFenceHeight}px`;
      return;
    }
    // Auto-grow to visible wrapped content so activating long paragraph lines
    // does not collapse the editor to the number of hard line breaks only.
    textarea.style.height = "auto";
    const nextHeight = Math.max(textarea.scrollHeight, 28);
    textarea.style.height = `${nextHeight}px`;
  }, [activeBlockIndex, blocks, resolveStoredSvgCodeFencePreviewHeight]);

  const handleTextareaScroll = useCallback(() => {
    syncEditorSyntaxOverlayScroll();
  }, [syncEditorSyntaxOverlayScroll]);

  const handleTextareaSelect = useCallback((event: SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    setEditorOverlaySelectionStart(textarea.selectionStart);
    if (activeBlockIndex === null) {
      return;
    }
    const block = blocks[activeBlockIndex];
    if (block?.kind === "math-block") {
      inlineFormattingToolbarPendingSignatureRef.current = null;
      inlineFormattingToolbarRangeRef.current = null;
      setInlineFormattingToolbarSelection(null);
      setInlineFormattingToolbarMenu(null);
      setInlineFormattingToolbarLinkState(null);
      return;
    }
    const normalized = normalizeInlineFormattingRange(textarea.value, {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
    if (normalized.start === normalized.end) {
      return;
    }
    inlineFormattingToolbarRangeRef.current = {
      blockIndex: activeBlockIndex,
      start: normalized.start,
      end: normalized.end,
    };
  }, [activeBlockIndex, blocks]);

  useLayoutEffect(() => {
    syncActiveTextareaAutoHeight();
    syncEditorSyntaxOverlayScroll();
    const handle = window.requestAnimationFrame(() => {
      syncActiveTextareaAutoHeight();
      syncEditorSyntaxOverlayScroll();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [activeBlockIndex, activeDraft, syncActiveTextareaAutoHeight, syncEditorSyntaxOverlayScroll]);

  const applyActiveBlockDraft = useCallback(
    (nextDraft: string, nextCaretPosition?: number) => {
      if (activeBlockIndex === null) {
        return false;
      }
      updateActiveDraftState(nextDraft);
      setActiveDirty(true);
      setActiveEditSnapshot((current) =>
        current
          ? {
            ...current,
            draft: nextDraft,
          }
          : current,
      );
      if (typeof nextCaretPosition === "number") {
        scheduleTextareaCaret(nextCaretPosition);
      }
      return true;
    },
    [activeBlockIndex, scheduleTextareaCaret],
  );

  const clearInlineFormattingToolbarTimer = useCallback(() => {
    if (inlineFormattingToolbarTimerRef.current === null) {
      return;
    }
    window.clearTimeout(inlineFormattingToolbarTimerRef.current);
    inlineFormattingToolbarTimerRef.current = null;
  }, []);

  const hideInlineFormattingToolbar = useCallback(() => {
    clearInlineFormattingToolbarTimer();
    inlineFormattingToolbarPendingSignatureRef.current = null;
    inlineFormattingToolbarRangeRef.current = null;
    setInlineFormattingToolbarSelection(null);
    setInlineFormattingToolbarMenu(null);
    setInlineFormattingToolbarLinkState(null);
  }, [clearInlineFormattingToolbarTimer]);

  useEffect(() => {
    if (activeBlockIndex === null) {
      return;
    }
    if (blocks[activeBlockIndex]?.kind === "math-block") {
      hideInlineFormattingToolbar();
    }
  }, [activeBlockIndex, blocks, hideInlineFormattingToolbar]);

  const resolveActiveInlineFormattingSelection = useCallback(() => {
    if (disabled || activeBlockIndex === null) {
      return null;
    }
    if (blocks[activeBlockIndex]?.kind === "math-block") {
      return null;
    }
    if (pageLinkPickerState) {
      return null;
    }
    if (typedImageLinkPickerState) {
      return null;
    }
    const textarea = textareaRef.current;
    const container = containerRef.current;
    if (!textarea || !container) {
      return null;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) {
      return null;
    }
    const normalizedRange = normalizeInlineFormattingRange(textarea.value, { start, end });
    const anchor = resolveTextareaSelectionToolbarAnchor(textarea, container, normalizedRange);
    if (!anchor) {
      return null;
    }
    const activeState = resolveInlineFormattingToolbarActiveState(textarea.value, normalizedRange);
    return {
      blockIndex: activeBlockIndex,
      start: normalizedRange.start,
      end: normalizedRange.end,
      anchor,
      activeState,
    } as InlineFormattingToolbarSelection;
  }, [activeBlockIndex, blocks, disabled, pageLinkPickerState, typedImageLinkPickerState]);

  const showInlineFormattingToolbarImmediate = useCallback(() => {
    const nextSelection = resolveActiveInlineFormattingSelection();
    if (!nextSelection) {
      hideInlineFormattingToolbar();
      return;
    }
    setInlineFormattingToolbarSelection(nextSelection);
    inlineFormattingToolbarRangeRef.current = {
      blockIndex: nextSelection.blockIndex,
      start: nextSelection.start,
      end: nextSelection.end,
    };
  }, [hideInlineFormattingToolbar, resolveActiveInlineFormattingSelection]);

  const scheduleInlineFormattingToolbarVisibility = useCallback(
    (options?: { immediate?: boolean }) => {
      if (options?.immediate) {
        clearInlineFormattingToolbarTimer();
        showInlineFormattingToolbarImmediate();
        return;
      }
      const selection = resolveActiveInlineFormattingSelection();
      if (!selection) {
        hideInlineFormattingToolbar();
        return;
      }
      const signature = `${selection.blockIndex}:${selection.start}:${selection.end}`;
      inlineFormattingToolbarPendingSignatureRef.current = signature;
      clearInlineFormattingToolbarTimer();
      inlineFormattingToolbarTimerRef.current = window.setTimeout(() => {
        const latestSelection = resolveActiveInlineFormattingSelection();
        if (!latestSelection) {
          hideInlineFormattingToolbar();
          return;
        }
        const latestSignature =
          `${latestSelection.blockIndex}:${latestSelection.start}:${latestSelection.end}`;
        if (inlineFormattingToolbarPendingSignatureRef.current !== latestSignature) {
          return;
        }
        setInlineFormattingToolbarSelection(latestSelection);
        inlineFormattingToolbarRangeRef.current = {
          blockIndex: latestSelection.blockIndex,
          start: latestSelection.start,
          end: latestSelection.end,
        };
      }, INLINE_FORMATTING_TOOLBAR_DELAY_MS);
    },
    [
      clearInlineFormattingToolbarTimer,
      hideInlineFormattingToolbar,
      resolveActiveInlineFormattingSelection,
      showInlineFormattingToolbarImmediate,
    ],
  );

  const scheduleTextareaSelectionRange = useCallback(
    (selection: InlineFormattingToolbarRange) => {
      const handle = window.requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }
        const normalized = normalizeInlineFormattingRange(textarea.value, selection);
        try {
          textarea.focus({ preventScroll: true });
        } catch {
          textarea.focus();
        }
        textarea.setSelectionRange(normalized.start, normalized.end);
        setEditorOverlaySelectionStart(normalized.start);
        scheduleInlineFormattingToolbarVisibility({ immediate: true });
      });
      return () => window.cancelAnimationFrame(handle);
    },
    [scheduleInlineFormattingToolbarVisibility],
  );

  const restoreInlineFormattingToolbarSelection = useCallback(() => {
    if (activeBlockIndex === null) {
      return null;
    }
    const textarea = textareaRef.current;
    const savedRange = inlineFormattingToolbarRangeRef.current;
    if (!textarea || !savedRange || savedRange.blockIndex !== activeBlockIndex) {
      return null;
    }
    const normalized = normalizeInlineFormattingRange(textarea.value, {
      start: savedRange.start,
      end: savedRange.end,
    });
    if (normalized.start === normalized.end) {
      return null;
    }
    try {
      textarea.focus({ preventScroll: true });
    } catch {
      textarea.focus();
    }
    textarea.setSelectionRange(normalized.start, normalized.end);
    setEditorOverlaySelectionStart(normalized.start);
    return normalized;
  }, [activeBlockIndex]);

  const applyInlineFormattingToActiveSelection = useCallback(
    (result: InlineFormattingToggleResult) => {
      if (!result.changed) {
        return false;
      }
      const applied = applyActiveBlockDraft(result.value);
      if (!applied || activeBlockIndex === null) {
        return false;
      }
      inlineFormattingToolbarRangeRef.current = {
        blockIndex: activeBlockIndex,
        start: result.selection.start,
        end: result.selection.end,
      };
      scheduleTextareaSelectionRange(result.selection);
      return true;
    },
    [activeBlockIndex, applyActiveBlockDraft, scheduleTextareaSelectionRange],
  );

  const applyInlineFormattingAction = useCallback(
    (action: InlineFormattingToolbarAction) => {
      const normalizedSelection = restoreInlineFormattingToolbarSelection();
      const textarea = textareaRef.current;
      if (!normalizedSelection || !textarea) {
        return false;
      }
      const value = textarea.value;
      const isClozeExclusiveAction = action === "cd" || action === "cl";

      if (isClozeExclusiveAction) {
        const activeState = resolveInlineFormattingToolbarActiveState(value, normalizedSelection);
        const linkActive = Boolean(findInlineMarkdownLinkAtRange(value, normalizedSelection));
        const targetActive = action === "cd" ? activeState.cd : activeState.cl;
        const hasOtherFormatting = activeState.highlight ||
          activeState.bold ||
          activeState.italic ||
          activeState.underline ||
          activeState.strikethrough ||
          activeState["inline-code"] ||
          activeState.math ||
          (action === "cd" ? activeState.cl : activeState.cd) ||
          linkActive;
        const wrapper = INLINE_FORMATTING_WRAPPERS[action];
        if (targetActive && !hasOtherFormatting) {
          const toggled = toggleInlineFormattingWrapper(value, normalizedSelection, wrapper);
          return applyInlineFormattingToActiveSelection(toggled);
        }
        const replaced = stripInlineFormattingAroundRange(value, normalizedSelection, {
          actions: ["highlight", "strikethrough", "underline", "bold", "italic", "inline-code", "math", "cd", "cl"],
          removeLink: true,
        });
        const wrapped = toggleInlineFormattingWrapper(replaced.value, replaced.selection, wrapper);
        return applyInlineFormattingToActiveSelection(wrapped);
      }

      const withoutCdCl = stripInlineFormattingAroundRange(value, normalizedSelection, {
        actions: ["cd", "cl"],
      });
      if (action === "math" && rangeIntersectsMarkdownCodeContext(withoutCdCl.value, withoutCdCl.selection)) {
        return false;
      }
      const wrapper = INLINE_FORMATTING_WRAPPERS[action];
      const nextResult = toggleInlineFormattingWrapper(withoutCdCl.value, withoutCdCl.selection, wrapper);
      return applyInlineFormattingToActiveSelection(nextResult);
    },
    [applyInlineFormattingToActiveSelection, restoreInlineFormattingToolbarSelection],
  );

  const applyInlineMathMenuAction = useCallback(
    (action: InlineFormattingMathMenuAction) => {
      const normalizedSelection = restoreInlineFormattingToolbarSelection();
      const textarea = textareaRef.current;
      if (!normalizedSelection || !textarea) {
        return false;
      }
      if (rangeIntersectsMarkdownCodeContext(textarea.value, normalizedSelection)) {
        return false;
      }

      const value = textarea.value;
      const activeMathToken = findMathTokenCoveringRange(value, normalizedSelection);

      const applyDelimiterConversion = (
        token: Extract<MathToken, { type: "inline-math" | "display-math" }>,
        targetType: "inline-math" | "display-math",
      ) => {
        if (token.type === targetType) {
          return false;
        }
        const targetDelimiter = targetType === "inline-math" ? "$" : "$$";
        const nextValue = `${value.slice(0, token.start)}${targetDelimiter}${token.value}${targetDelimiter}${
          value.slice(token.end)
        }`;
        const delimiterLength = targetDelimiter.length;
        return applyInlineFormattingToActiveSelection({
          value: nextValue,
          selection: {
            start: token.start + delimiterLength,
            end: token.start + delimiterLength + token.value.length,
          },
          changed: nextValue !== value,
        });
      };

      if (action === "wrap-inline") {
        if (activeMathToken) {
          if (activeMathToken.type === "display-math") {
            return applyDelimiterConversion(activeMathToken, "inline-math");
          }
          return false;
        }
        const selectedText = value.slice(normalizedSelection.start, normalizedSelection.end);
        const nextValue = `${value.slice(0, normalizedSelection.start)}$${selectedText}$${
          value.slice(normalizedSelection.end)
        }`;
        return applyInlineFormattingToActiveSelection({
          value: nextValue,
          selection: {
            start: normalizedSelection.start + 1,
            end: normalizedSelection.end + 1,
          },
          changed: nextValue !== value,
        });
      }

      if (action === "convert-inline-display") {
        if (!activeMathToken) {
          return false;
        }
        return applyDelimiterConversion(
          activeMathToken,
          activeMathToken.type === "inline-math" ? "display-math" : "inline-math",
        );
      }

      if (!activeMathToken) {
        return false;
      }
      const nextValue = `${value.slice(0, activeMathToken.start)}${activeMathToken.value}${
        value.slice(activeMathToken.end)
      }`;
      return applyInlineFormattingToActiveSelection({
        value: nextValue,
        selection: {
          start: activeMathToken.start,
          end: activeMathToken.start + activeMathToken.value.length,
        },
        changed: nextValue !== value,
      });
    },
    [applyInlineFormattingToActiveSelection, restoreInlineFormattingToolbarSelection],
  );

  const clearInlineFormattingAtSelection = useCallback(() => {
    const normalizedSelection = restoreInlineFormattingToolbarSelection();
    const textarea = textareaRef.current;
    if (!normalizedSelection || !textarea) {
      return false;
    }

    let nextValue = textarea.value;
    let nextRange = normalizedSelection;
    let hasChanged = false;

    const strippedAroundSelection = stripInlineFormattingAroundRange(nextValue, nextRange, {
      actions: ["highlight", "strikethrough", "underline", "bold", "italic", "inline-code", "math", "cd", "cl"],
      removeLink: true,
    });
    if (strippedAroundSelection.changed) {
      nextValue = strippedAroundSelection.value;
      nextRange = strippedAroundSelection.selection;
      hasChanged = true;
    }

    // Then, strip supported markdown markers inside the selected text.
    const selectedValue = nextValue.slice(nextRange.start, nextRange.end);
    const plainSelectedValue = stripSupportedInlineMarkdownFormatting(selectedValue);
    if (plainSelectedValue !== selectedValue) {
      nextValue = `${nextValue.slice(0, nextRange.start)}${plainSelectedValue}${nextValue.slice(nextRange.end)}`;
      nextRange = {
        start: nextRange.start,
        end: nextRange.start + plainSelectedValue.length,
      };
      hasChanged = true;
    }

    if (!hasChanged) {
      return false;
    }

    return applyInlineFormattingToActiveSelection({
      value: nextValue,
      selection: nextRange,
      changed: true,
    });
  }, [applyInlineFormattingToActiveSelection, restoreInlineFormattingToolbarSelection]);

  const openInlineFormattingLinkEditor = useCallback(() => {
    const normalizedSelection = restoreInlineFormattingToolbarSelection();
    const textarea = textareaRef.current;
    if (!normalizedSelection || !textarea) {
      return false;
    }
    const linkMatch = findInlineMarkdownLinkAtRange(textarea.value, normalizedSelection);
    setInsertMenuState(null);
    setInlineFormattingToolbarMenu(null);
    setInlineFormattingToolbarLinkState({
      url: linkMatch?.url ?? "",
      canRemove: Boolean(linkMatch),
    });
    return true;
  }, [restoreInlineFormattingToolbarSelection]);

  const applyInlineFormattingLinkValue = useCallback(
    (urlValue?: string) => {
      const normalizedSelection = restoreInlineFormattingToolbarSelection();
      const textarea = textareaRef.current;
      if (!normalizedSelection || !textarea) {
        return false;
      }
      const nextUrl = typeof urlValue === "string"
        ? urlValue
        : (inlineFormattingToolbarLinkState?.url ?? "");
      const strippedCloze = stripInlineFormattingAroundRange(textarea.value, normalizedSelection, {
        actions: ["cd", "cl"],
      });
      const nextResult = applyInlineMarkdownLink(
        strippedCloze.value,
        strippedCloze.selection,
        nextUrl,
      );
      if (!nextResult.changed) {
        return false;
      }
      const applied = applyInlineFormattingToActiveSelection(nextResult);
      if (applied) {
        setInlineFormattingToolbarLinkState(null);
      }
      return applied;
    },
    [
      applyInlineFormattingToActiveSelection,
      inlineFormattingToolbarLinkState?.url,
      restoreInlineFormattingToolbarSelection,
    ],
  );

  const handleInlineFormattingToolbarAction = useCallback(
    (action: InlineFormattingToolbarAction | "link" | "clear-formatting") => {
      setInsertMenuState(null);
      if (action === "link") {
        openInlineFormattingLinkEditor();
        return;
      }
      if (action === "clear-formatting") {
        setInlineFormattingToolbarLinkState(null);
        setInlineFormattingToolbarMenu(null);
        clearInlineFormattingAtSelection();
        return;
      }
      setInlineFormattingToolbarMenu(null);
      applyInlineFormattingAction(action);
    },
    [applyInlineFormattingAction, clearInlineFormattingAtSelection, openInlineFormattingLinkEditor],
  );

  const handleInlineFormattingMathMenuAction = useCallback(
    (action: InlineFormattingMathMenuAction) => {
      setInsertMenuState(null);
      setInlineFormattingToolbarLinkState(null);
      setInlineFormattingToolbarMenu(null);
      applyInlineMathMenuAction(action);
    },
    [applyInlineMathMenuAction],
  );

  const toggleInlineFormattingToolbarMenu = useCallback(
    (menu: Exclude<InlineFormattingToolbarMenu, null>) => {
      setInsertMenuState(null);
      setInlineFormattingToolbarLinkState(null);
      setInlineFormattingToolbarMenu((current) => (current === menu ? null : menu));
    },
    [],
  );

  useEffect(() => {
    if (disabled || activeBlockIndex === null) {
      inlineFormattingToolbarRangeRef.current = null;
      hideInlineFormattingToolbar();
    }
  }, [activeBlockIndex, disabled, hideInlineFormattingToolbar]);

  useEffect(() => {
    if (!pageLinkPickerState) {
      return;
    }
    hideInlineFormattingToolbar();
  }, [hideInlineFormattingToolbar, pageLinkPickerState]);

  useEffect(() => {
    if (!typedImageLinkPickerState) {
      return;
    }
    hideInlineFormattingToolbar();
  }, [hideInlineFormattingToolbar, typedImageLinkPickerState]);

  useEffect(() => {
    const handleSelectionSignal = () => {
      const textarea = textareaRef.current;
      if (!textarea) {
        hideInlineFormattingToolbar();
        return;
      }
      const activeElement = document.activeElement;
      const isToolbarFocused = activeElement instanceof Node &&
        inlineFormattingToolbarRef.current?.contains(activeElement);
      if (activeElement === textarea) {
        scheduleInlineFormattingToolbarVisibility();
        return;
      }
      if (isToolbarFocused) {
        // Keep the last stable textarea range while interacting with the toolbar.
        return;
      }
      hideInlineFormattingToolbar();
    };

    document.addEventListener("selectionchange", handleSelectionSignal);
    window.addEventListener("pointerup", handleSelectionSignal, true);
    window.addEventListener("keyup", handleSelectionSignal, true);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionSignal);
      window.removeEventListener("pointerup", handleSelectionSignal, true);
      window.removeEventListener("keyup", handleSelectionSignal, true);
    };
  }, [hideInlineFormattingToolbar, scheduleInlineFormattingToolbarVisibility]);

  useEffect(() => {
    if (!inlineFormattingToolbarSelection) {
      return;
    }
    const handleDocumentMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (inlineFormattingToolbarRef.current?.contains(target)) {
        return;
      }
      if (textareaRef.current?.contains(target)) {
        return;
      }
      hideInlineFormattingToolbar();
    };
    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [hideInlineFormattingToolbar, inlineFormattingToolbarSelection]);

  useEffect(() => {
    if (!inlineFormattingToolbarSelection) {
      return;
    }
    const handleDocumentFocusIn = (event: globalThis.FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (textareaRef.current?.contains(target)) {
        return;
      }
      if (inlineFormattingToolbarRef.current?.contains(target)) {
        return;
      }
      hideInlineFormattingToolbar();
    };
    document.addEventListener("focusin", handleDocumentFocusIn);
    return () => {
      document.removeEventListener("focusin", handleDocumentFocusIn);
    };
  }, [hideInlineFormattingToolbar, inlineFormattingToolbarSelection]);

  useEffect(() => {
    if (!inlineFormattingToolbarSelection) {
      return;
    }
    const handleHide = () => {
      hideInlineFormattingToolbar();
    };
    window.addEventListener("resize", handleHide);
    window.addEventListener("scroll", handleHide, true);
    return () => {
      window.removeEventListener("resize", handleHide);
      window.removeEventListener("scroll", handleHide, true);
    };
  }, [hideInlineFormattingToolbar, inlineFormattingToolbarSelection]);

  const handleTextareaPointerUp = useCallback((event: MouseEvent<HTMLTextAreaElement>) => {
    setEditorOverlaySelectionStart(event.currentTarget.selectionStart);
    scheduleInlineFormattingToolbarVisibility();
  }, [scheduleInlineFormattingToolbarVisibility]);

  const handleTextareaKeyUp = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    setEditorOverlaySelectionStart(event.currentTarget.selectionStart);
    scheduleInlineFormattingToolbarVisibility();
  }, [scheduleInlineFormattingToolbarVisibility]);

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
      const isPlainDeleteKey = (event.key === "Backspace" || event.key === "Delete") &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey;
      const isExplicitCommitShortcut = event.key === "Enter" &&
        !event.shiftKey &&
        !event.altKey &&
        (event.ctrlKey || event.metaKey);

      if (event.key === "Escape" && pageLinkPickerState) {
        event.preventDefault();
        event.stopPropagation();
        closePageLinkPicker();
        try {
          textarea.focus({ preventScroll: true });
        } catch {
          textarea.focus();
        }
        return;
      }

      if (event.key === "Escape" && typedImageLinkPickerState) {
        event.preventDefault();
        event.stopPropagation();
        closeTypedImageLinkPicker();
        try {
          textarea.focus({ preventScroll: true });
        } catch {
          textarea.focus();
        }
        return;
      }

      if (event.key === "Escape" && inlineFormattingToolbarSelection) {
        event.preventDefault();
        event.stopPropagation();
        hideInlineFormattingToolbar();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        discardActiveBlock();
        return;
      }

      if (isExplicitCommitShortcut) {
        event.preventDefault();
        event.stopPropagation();
        commitActiveBlock({ deactivate: true });
        return;
      }

      const inlineShortcutAction = resolveInlineFormattingShortcutAction(event);
      if (inlineShortcutAction && block.kind !== "math-block") {
        event.preventDefault();
        event.stopPropagation();
        const normalizedRange = normalizeInlineFormattingRange(textarea.value, {
          start: textarea.selectionStart,
          end: textarea.selectionEnd,
        });
        if (normalizedRange.start !== normalizedRange.end) {
          inlineFormattingToolbarRangeRef.current = {
            blockIndex: activeBlockIndex,
            start: normalizedRange.start,
            end: normalizedRange.end,
          };
          if (inlineShortcutAction === "link") {
            openInlineFormattingLinkEditor();
          } else {
            applyInlineFormattingAction(inlineShortcutAction);
          }
        }
        return;
      }

      if (
        isPlainDeleteKey &&
        !hasSelection &&
        canOpenPageLinkPickerInBlockKind(block.kind)
      ) {
        const adjacentLinkRange = findAdjacentWikilinkRange(
          activeDraft,
          textarea.selectionStart,
          event.key as "Backspace" | "Delete",
        );
        if (adjacentLinkRange) {
          event.preventDefault();
          event.stopPropagation();
          const nextDraft = `${activeDraft.slice(0, adjacentLinkRange.start)}${
            activeDraft.slice(adjacentLinkRange.end)
          }`;
          closePageLinkPicker();
          applyActiveBlockDraft(nextDraft, adjacentLinkRange.start);
          return;
        }
      }

      if (
        (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
        !hasSelection &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        canOpenPageLinkPickerInBlockKind(block.kind)
      ) {
        const adjacentLinkRange = findAdjacentWikilinkRange(
          activeDraft,
          textarea.selectionStart,
          event.key === "ArrowLeft" ? "Backspace" : "Delete",
        );
        if (adjacentLinkRange) {
          event.preventDefault();
          event.stopPropagation();
          const nextCaret = event.key === "ArrowLeft"
            ? adjacentLinkRange.start
            : adjacentLinkRange.end;
          scheduleTextareaCaret(nextCaret);
          return;
        }
      }

      if (event.key === "Enter" && !event.altKey && !event.ctrlKey && !event.metaKey) {
        const nextDraft = `${activeDraft.slice(0, textarea.selectionStart)}\n${
          activeDraft.slice(textarea.selectionEnd)
        }`;
        event.preventDefault();
        event.stopPropagation();
        applyActiveBlockDraft(nextDraft, textarea.selectionStart + 1);
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
      applyInlineFormattingAction,
      activeDirty,
      blocks,
      closePageLinkPicker,
      commitActiveBlock,
      discardActiveBlock,
      handleGlobalRedo,
      handleGlobalUndo,
      hideInlineFormattingToolbar,
      inlineFormattingToolbarSelection,
      openInlineFormattingLinkEditor,
      pageLinkPickerState,
      closeTypedImageLinkPicker,
      scheduleTextareaCaret,
      typedImageLinkPickerState,
    ],
  );

  const handlePageLinkPickerQueryChange = useCallback((value: string) => {
    setPageLinkPickerState((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        query: value,
        highlightedIndex: 0,
      };
    });
  }, []);

  const handlePageLinkPickerSelectCandidate = useCallback(
    (candidate: PageLinkCandidate) => {
      if (!pageLinkPickerState || activeBlockIndex === null || pageLinkPickerState.blockIndex !== activeBlockIndex) {
        closePageLinkPicker();
        return;
      }
      const replaceStart = Math.max(0, Math.min(pageLinkPickerState.replaceRange.start, activeDraft.length));
      const replaceEnd = Math.max(replaceStart, Math.min(pageLinkPickerState.replaceRange.end, activeDraft.length));
      const nextToken = candidate.wikilink;
      const nextDraft = `${activeDraft.slice(0, replaceStart)}${nextToken}${activeDraft.slice(replaceEnd)}`;
      const nextCaret = replaceStart + nextToken.length;
      closePageLinkPicker();
      applyActiveBlockDraft(nextDraft, nextCaret);
    },
    [activeBlockIndex, activeDraft, applyActiveBlockDraft, closePageLinkPicker, pageLinkPickerState],
  );

  const handlePageLinkPickerSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!pageLinkPickerState) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePageLinkPicker();
        const textarea = textareaRef.current;
        if (textarea) {
          try {
            textarea.focus({ preventScroll: true });
          } catch {
            textarea.focus();
          }
        }
        return;
      }
      if (filteredPageLinkCandidates.length === 0) {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setPageLinkPickerState((current) => {
          if (!current) {
            return current;
          }
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const nextIndex = (current.highlightedIndex + delta + filteredPageLinkCandidates.length) %
            filteredPageLinkCandidates.length;
          return {
            ...current,
            highlightedIndex: nextIndex,
          };
        });
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const candidate = filteredPageLinkCandidates[pageLinkPickerState.highlightedIndex] ??
          filteredPageLinkCandidates[0];
        if (!candidate) {
          return;
        }
        handlePageLinkPickerSelectCandidate(candidate);
      }
    },
    [
      closePageLinkPicker,
      filteredPageLinkCandidates,
      handlePageLinkPickerSelectCandidate,
      pageLinkPickerState,
    ],
  );

  const handleTypedImageLinkPickerQueryChange = useCallback((value: string) => {
    setTypedImageLinkPickerState((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        query: value,
        highlightedIndex: 0,
      };
    });
  }, []);

  const handleTypedImageLinkPickerSelectCandidate = useCallback(
    (candidate: VaultImageCandidate) => {
      if (
        !typedImageLinkPickerState ||
        activeBlockIndex === null ||
        typedImageLinkPickerState.blockIndex !== activeBlockIndex
      ) {
        closeTypedImageLinkPicker();
        return;
      }
      const replaceStart = Math.max(0, Math.min(typedImageLinkPickerState.replaceRange.start, activeDraft.length));
      const replaceEnd = Math.max(
        replaceStart,
        Math.min(typedImageLinkPickerState.replaceRange.end, activeDraft.length),
      );
      const nextToken = serializePngEmbed(candidate.relPath);
      const nextDraft = `${activeDraft.slice(0, replaceStart)}${nextToken}${activeDraft.slice(replaceEnd)}`;
      const nextCaret = replaceStart + nextToken.length;
      closeTypedImageLinkPicker();
      applyActiveBlockDraft(nextDraft, nextCaret);
    },
    [
      activeBlockIndex,
      activeDraft,
      applyActiveBlockDraft,
      closeTypedImageLinkPicker,
      typedImageLinkPickerState,
    ],
  );

  const handleTypedImageLinkPickerSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!typedImageLinkPickerState) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeTypedImageLinkPicker();
        const textarea = textareaRef.current;
        if (textarea) {
          try {
            textarea.focus({ preventScroll: true });
          } catch {
            textarea.focus();
          }
        }
        return;
      }
      if (filteredTypedImageLinkCandidates.length === 0) {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setTypedImageLinkPickerState((current) => {
          if (!current) {
            return current;
          }
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const nextIndex = (current.highlightedIndex + delta + filteredTypedImageLinkCandidates.length) %
            filteredTypedImageLinkCandidates.length;
          return {
            ...current,
            highlightedIndex: nextIndex,
          };
        });
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const candidate = filteredTypedImageLinkCandidates[typedImageLinkPickerState.highlightedIndex] ??
          filteredTypedImageLinkCandidates[0];
        if (!candidate) {
          return;
        }
        handleTypedImageLinkPickerSelectCandidate(candidate);
      }
    },
    [
      closeTypedImageLinkPicker,
      filteredTypedImageLinkCandidates,
      handleTypedImageLinkPickerSelectCandidate,
      typedImageLinkPickerState,
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
        if (activeBlockIndex !== null && !commitActiveBlock({ deactivate: true })) {
          return;
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
    (_index: number) => (event: MouseEvent<HTMLDivElement>) => {
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
      selectionDragPointerRef.current = { x: event.clientX, y: event.clientY };
      const movedFarEnough = Math.abs(event.clientX - gesture.startClientX) > SELECTION_DRAG_THRESHOLD_PX ||
        Math.abs(event.clientY - gesture.startClientY) > SELECTION_DRAG_THRESHOLD_PX;
      if (!movedFarEnough) {
        return;
      }
      gesture.didDrag = true;
      const endPoint = getContainerLocalPoint(event.clientX, event.clientY);
      if (!endPoint) {
        return;
      }
      updateSelectionFromMarqueeContentPoints(
        gesture.startContentX,
        gesture.startContentY,
        endPoint.x,
        endPoint.y,
      );
    },
    [blocks.length, disabled, getContainerLocalPoint, isSelectionDragging, updateSelectionFromMarqueeContentPoints],
  );

  const handleDragHandleDragStart = useCallback(
    (index: number) => (event: DragEvent<HTMLButtonElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      if (activeBlockIndex !== null && !commitActiveBlock({ deactivate: true })) {
        event.preventDefault();
        return;
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

  const handleDragHandleClick = useCallback(
    (index: number) => (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled || event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (activeBlockIndex !== null && !commitActiveBlock({ deactivate: true })) {
        return;
      }
      setPendingActivation(null);
      setInsertMenuState(null);
      setSelectionContextMenuState(null);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      setIsSelectionDragging(false);
      setSelectionMarqueeRect(null);
      selectionGestureRef.current = null;
      suppressNextBlockContextMenuRef.current = false;
      setSingleBlockSelection(index);
      focusContainer();
    },
    [
      activeBlockIndex,
      commitActiveBlock,
      disabled,
      focusContainer,
      setSingleBlockSelection,
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
        if (activeBlockIndex !== null && !commitActiveBlock({ deactivate: true })) {
          return;
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
    ? getAdvancedInsertTemplateSections(activeInsertMenuContext)
    : [];
  const activeAdvancedInsertTemplate = insertMenuState?.advancedTemplateId
    ? (getAdvancedInsertTemplateById(insertMenuState.advancedTemplateId) ?? null)
    : null;
  const activeAdvancedSequenceNumberPreview = insertMenuState?.phase === "advanced-variant" && insertMenuState
    ? typeof insertMenuState.advancedSequenceNumber === "number" &&
        Number.isFinite(insertMenuState.advancedSequenceNumber)
      ? Math.max(1, Math.floor(insertMenuState.advancedSequenceNumber))
      : resolveNextGlobalSequenceNumber(markdown)
    : null;

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
      if (insertMenuState.phase === "image-link-picker") {
        const searchInput = insertMenuRef.current?.querySelector<HTMLInputElement>(
          "input[type='search']",
        );
        if (searchInput) {
          try {
            searchInput.focus({ preventScroll: true });
          } catch {
            searchInput.focus();
          }
        }
        return;
      }
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
            {insertMenuState?.phase === "advanced-variant" && activeAdvancedInsertTemplate
              ? activeAdvancedInsertTemplate.label
              : insertMenuState?.phase === "image-link-picker"
              ? "Select PNG"
              : insertMenuState?.insertAbove
              ? "Insert Above"
              : "Insert Below"}
          </span>
          {insertMenuState?.phase !== "categories" ? (
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
          {insertMenuState?.phase === "image-link-picker" ? (
            <VaultPngPicker
              assets={vaultPngAssets}
              query={insertMenuState.query ?? ""}
              onQueryChange={handleInsertImageLinkQueryChange}
              onSearchKeyDown={handleInsertImageLinkSearchKeyDown}
              onSelect={(candidate) => handleInsertImageLinkSelectCandidate(candidate.relPath)}
              highlightedIndex={insertMenuState.highlightedIndex ?? 0}
              onHighlightedIndexChange={(nextIndex) =>
                setInsertMenuState((current) =>
                  current && current.phase === "image-link-picker"
                    ? { ...current, highlightedIndex: nextIndex }
                    : current
                )
              }
              emptyLabel="No PNG files found in the current vault."
              className="markdown-hybrid-insert-image-picker"
            />
          ) : insertMenuState?.phase === "categories"
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
            : insertMenuState?.phase === "advanced-variant" && activeAdvancedInsertTemplate
            ? (
              <>
                <div
                  className="markdown-hybrid-insert-menu-advanced-sequence-control"
                  role="group"
                  aria-label="Advanced sequence number controls"
                >
                  <button
                    type="button"
                    className="markdown-hybrid-insert-menu-advanced-sequence-button"
                    aria-label="Decrease task number"
                    onClick={decrementAdvancedSequenceNumber}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="markdown-hybrid-insert-menu-advanced-sequence-input"
                    aria-label="Task number"
                    min={1}
                    step={1}
                    value={activeAdvancedSequenceNumberPreview ?? 1}
                    onChange={handleAdvancedSequenceNumberInputChange}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                    }}
                  />
                  <button
                    type="button"
                    className="markdown-hybrid-insert-menu-advanced-sequence-button"
                    aria-label="Increase task number"
                    onClick={incrementAdvancedSequenceNumber}
                  >
                    +
                  </button>
                </div>
                {INSERT_MENU_ADVANCED_VARIANTS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="markdown-hybrid-insert-menu-item markdown-hybrid-insert-menu-item-row"
                    onClick={handleAdvancedInsertTemplateVariantSelect(option.id)}
                    role="menuitem"
                  >
                    {renderInsertMenuRowContent({
                      label: option.label,
                      description: activeAdvancedSequenceNumberPreview !== null
                        ? option.id === "task"
                          ? `Insert as numbered task ${activeAdvancedSequenceNumberPreview})`
                          : `Insert as #card block ${activeAdvancedSequenceNumberPreview})`
                        : option.description,
                      icon: option.id === "card"
                        ? activeAdvancedInsertTemplate.icon
                        : option.icon,
                    })}
                  </button>
                ))}
              </>
            )
            : insertMenuState?.categoryId === "advanced"
            ? activeAdvancedInsertTemplateSections.flatMap((section) =>
              section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="markdown-hybrid-insert-menu-item markdown-hybrid-insert-menu-item-tile"
                  onClick={handleSelectAdvancedInsertTemplate(item.id)}
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
            onClick={handleDragHandleClick(blockIndex)}
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

  const pageLinkPickerPopup = pageLinkPickerState && !disabled ? (
    <div
      ref={pageLinkPickerRef}
      className="markdown-hybrid-page-link-picker"
      data-md-block-control="true"
      role="dialog"
      aria-label="Select page link"
      style={{
        left: pageLinkPickerState.anchorLeft,
        top: pageLinkPickerState.anchorTop,
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
    >
      <div className="markdown-hybrid-page-link-picker-search-shell">
        <span className="markdown-hybrid-page-link-picker-search-icon" aria-hidden="true">
          <InsertMenuIconGraphic icon="page-file" />
        </span>
        <input
          ref={pageLinkPickerSearchInputRef}
          type="text"
          className="markdown-hybrid-page-link-picker-search"
          value={pageLinkPickerState.query}
          onChange={(event) => handlePageLinkPickerQueryChange(event.currentTarget.value)}
          onKeyDown={handlePageLinkPickerSearchKeyDown}
          placeholder="Search pages..."
          aria-label="Search pages"
          aria-autocomplete="list"
          aria-controls="markdown-hybrid-page-link-picker-listbox"
          aria-expanded="true"
          aria-activedescendant={
            filteredPageLinkCandidates[pageLinkPickerState.highlightedIndex]
              ? `markdown-hybrid-page-link-picker-option-${pageLinkPickerState.highlightedIndex}`
              : undefined
          }
        />
      </div>
      <div
        id="markdown-hybrid-page-link-picker-listbox"
        className="markdown-hybrid-page-link-picker-list"
        role="listbox"
        aria-label="Vault pages"
      >
        {filteredPageLinkCandidates.length === 0 ? (
          <div className="markdown-hybrid-page-link-picker-empty" aria-live="polite">
            No pages found
          </div>
        ) : filteredPageLinkCandidates.map((candidate, index) => {
          const isActive = index === pageLinkPickerState.highlightedIndex;
          return (
            <button
              key={candidate.id}
              id={`markdown-hybrid-page-link-picker-option-${index}`}
              type="button"
              role="option"
              aria-selected={isActive}
              className={`markdown-hybrid-page-link-picker-option${isActive ? " is-active" : ""}`}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onMouseEnter={() => {
                setPageLinkPickerState((current) => {
                  if (!current) {
                    return current;
                  }
                  if (current.highlightedIndex === index) {
                    return current;
                  }
                  return {
                    ...current,
                    highlightedIndex: index,
                  };
                });
              }}
              onClick={() => handlePageLinkPickerSelectCandidate(candidate)}
              title={candidate.target}
            >
              <span className="markdown-hybrid-page-link-picker-option-icon" aria-hidden="true">
                <InsertMenuIconGraphic icon="page-file" />
              </span>
              <span className="markdown-hybrid-page-link-picker-option-text">
                <span className="markdown-hybrid-page-link-picker-option-label">{candidate.label}</span>
                {candidate.sublabel ? (
                  <span className="markdown-hybrid-page-link-picker-option-meta">{candidate.sublabel}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  const typedImageLinkPickerPopup = typedImageLinkPickerState && !disabled ? (
    <div
      ref={typedImageLinkPickerRef}
      className="markdown-hybrid-insert-menu markdown-hybrid-insert-menu-overlay"
      data-md-block-control="true"
      role="menu"
      aria-label="Insert block"
      style={{
        left: typedImageLinkPickerState.anchorLeft,
        top: typedImageLinkPickerState.anchorTop,
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
    >
      <div className="markdown-hybrid-insert-menu-header">
        <span className="markdown-hybrid-insert-menu-title">Select PNG</span>
      </div>
      <div className="markdown-hybrid-insert-menu-list">
        <VaultPngPicker
          assets={vaultPngAssets}
          query={typedImageLinkPickerState.query}
          onQueryChange={handleTypedImageLinkPickerQueryChange}
          onSearchKeyDown={handleTypedImageLinkPickerSearchKeyDown}
          onSelect={handleTypedImageLinkPickerSelectCandidate}
          highlightedIndex={typedImageLinkPickerState.highlightedIndex}
          onHighlightedIndexChange={(nextIndex) =>
            setTypedImageLinkPickerState((current) =>
              current
                ? {
                    ...current,
                    highlightedIndex: nextIndex,
                  }
                : current
            )}
          selectedRelPath={null}
          emptyLabel="No PNG files found in the current vault."
          className="markdown-hybrid-insert-image-picker"
        />
      </div>
    </div>
  ) : null;

  const inlineFormattingToolbarPopup = inlineFormattingToolbarSelection && !disabled ? (
    <FloatingInlineFormattingToolbar
      anchor={inlineFormattingToolbarSelection.anchor}
      menu={inlineFormattingToolbarMenu}
      linkState={inlineFormattingToolbarLinkState}
      activeState={inlineFormattingToolbarSelection.activeState}
      toolbarRef={inlineFormattingToolbarRef}
      onClose={hideInlineFormattingToolbar}
      onToggleMenu={toggleInlineFormattingToolbarMenu}
      onAction={handleInlineFormattingToolbarAction}
      onMathMenuAction={handleInlineFormattingMathMenuAction}
      onLinkUrlChange={(value) => {
        setInlineFormattingToolbarLinkState((current) => {
          if (!current) {
            return {
              url: value,
              canRemove: false,
            };
          }
          return {
            ...current,
            url: value,
          };
        });
      }}
      onLinkSubmit={() => {
        applyInlineFormattingLinkValue();
      }}
      onLinkRemove={() => {
        applyInlineFormattingLinkValue("");
      }}
      onLinkCancel={() => {
        setInlineFormattingToolbarLinkState(null);
      }}
    />
  ) : null;

  const mathToolboxPopup = mathToolboxState && !disabled ? (
    <MathStructureDialog
      key={mathToolboxState.sessionId}
      sessionId={mathToolboxState.sessionId}
      blockIndex={mathToolboxState.blockIndex}
      initialLatex={mathToolboxState.initialLatexSnapshot}
      dialogRef={mathToolboxRef}
      onClose={(result) => {
        if (result === "cancel") {
          handleMathBlockLiveSync(
            mathToolboxState.blockIndex,
            mathToolboxState.initialLatexSnapshot,
            { mergeKey: `math-session:${mathToolboxState.sessionId}` },
          );
        }
        setMathToolboxState(null);
      }}
      onLiveSync={(latex, options) => {
        handleMathBlockLiveSync(mathToolboxState.blockIndex, latex, options);
      }}
    />
  ) : null;

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
        onCopy={handleEditorCopy}
        onCut={handleEditorCut}
        onPaste={handleEditorPaste}
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
              updateActiveDraftState("");
              setActiveDirty(false);
              setActiveEditSnapshot(createDetachedEmptyEditSnapshot(""));
              setActiveComposing(false);
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
                      onCompositionStart={handleTextareaCompositionStart}
                      onCompositionEnd={handleTextareaCompositionEnd}
                      onKeyDown={handleTextareaKeyDown}
                      onKeyUp={handleTextareaKeyUp}
                      onSelect={handleTextareaSelect}
                      onMouseUp={handleTextareaPointerUp}
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
        {pageLinkPickerPopup}
        {typedImageLinkPickerPopup}
        {mathToolboxPopup}
        {inlineFormattingToolbarPopup}
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
      onCopy={handleEditorCopy}
      onCut={handleEditorCut}
      onPaste={handleEditorPaste}
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
          const mathBlockBodySource = block.kind === "math-block"
            ? extractMathBlockBody(isActive ? activeDraft : block.raw)
            : "";
          let previewBlockSource = block.kind === "help-block"
            ? normalizeHelpBlockPreviewSource(block.raw)
            : block.kind === "hr"
            ? normalizeHorizontalRuleBlockSource(block.raw)
            : block.raw;
          const cardBlockPreviewParts = block.kind === "card-block"
            ? extractCardBlockPreviewParts(block.raw)
            : null;
          const isCardTableSegmentActive = (partIndex: number, segmentIndex: number) =>
            Boolean(
              activeCardTableState &&
              activeCardTableState.blockIndex === index &&
              activeCardTableState.blockId === block.id &&
              activeCardTableState.partIndex === partIndex &&
              activeCardTableState.segmentIndex === segmentIndex,
            );
          const imageEmbedPreviewItems = block.kind === "image-embed"
            ? splitMarkdownMediaSegments(block.raw, "markdown-hybrid-image-embed-preview")
              .flatMap((segment) => (segment.kind === "media" ? segment.items : []))
            : [];
          const imageEmbedToken = block.kind === "image-embed"
            ? extractImageEmbedTokenFromRaw(block.raw)
            : null;
          const isImageEmbedReplacePickerOpen = Boolean(
            imageEmbedReplacePickerState &&
            imageEmbedReplacePickerState.blockIndex === index &&
            imageEmbedReplacePickerState.blockId === block.id,
          );
          const codeFencePreviewItems = block.kind === "code-fence"
            ? resolveCodeFencePreviewItems(block.raw)
            : [];
          const hasSvgCodeFenceMediaPreview = block.kind === "code-fence" &&
            codeFencePreviewItems.some((item) => item.type === "svg");
          const syncedSvgCodeFenceHeight = resolveStoredSvgCodeFencePreviewHeight(block);
          const useSyncedSvgCodeFenceEditorHeight = isActive &&
            hasSvgCodeFenceMediaPreview &&
            syncedSvgCodeFenceHeight !== null;
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
              data-md-code-fence-media-preview={hasSvgCodeFenceMediaPreview ? "true" : undefined}
              data-md-block-index={index}
              data-md-block-id={String(index)}
              onMouseDownCapture={handleBlockMouseDownCapture(index)}
              onMouseDown={handleBlockMouseDown(index)}
              onMouseEnter={handleBlockMouseEnter(index)}
              onDragOver={handleBlockDragOver(index)}
              onDrop={handleBlockDrop(index)}
            >
              <div className="markdown-hybrid-block-body">
                {block.kind === "table" ? (
                  <MarkdownHybridTableBlock
                    blockIndex={index}
                    raw={block.raw}
                    active={isActive}
                    disabled={disabled}
                    vaultFiles={vaultFiles}
                    vaultPngAssets={vaultPngAssets}
                    renderPreview={renderPreviewWithPageLinks}
                    pendingActivation={
                      pendingTableActivation?.blockIndex === index
                        ? pendingTableActivation.request
                        : null
                    }
                    onConsumePendingActivation={() => clearPendingTableActivation(index)}
                    onRequestActivate={(request) => handleTableBlockRequestActivate(index, request)}
                    onCommitRaw={(nextRaw) => {
                      handleTableBlockCommitRaw(index, nextRaw);
                    }}
                    onDirtyChange={(dirty) => {
                      if (activeBlockIndex === index) {
                        setActiveTableDirty(dirty);
                      }
                    }}
                    registerSession={(controller) => {
                      if (activeBlockIndex === index || controller === null) {
                        registerActiveTableSession(controller);
                      }
                    }}
                    onGlobalUndo={handleGlobalUndo}
                    onGlobalRedo={handleGlobalRedo}
                  />
                ) : isActive ? (
                  block.kind === "math-block" ? (
                    <div className="markdown-hybrid-math-block-shell is-editing">
                      <div className="markdown-hybrid-math-block-toolbar">
                        <button
                          type="button"
                          className="markdown-hybrid-math-toolbox-trigger"
                          data-md-block-control="true"
                          data-md-math-toolbox-trigger="true"
                          aria-label="Open math toolbox"
                          title="Open math toolbox"
                          onMouseDown={handleMathToolboxButtonMouseDown}
                          onClick={handleMathToolboxButtonClick(index)}
                        >
                          <InsertMenuIconGraphic icon="math-block" />
                        </button>
                      </div>
                      {mathToolboxState?.blockIndex === index ? (
                        <div className="markdown-hybrid-math-preview-shell is-structural-editor-active">
                          <MathBlockRenderer source={mathBlockBodySource} />
                        </div>
                      ) : (
                        <div className="markdown-hybrid-math-editor-shell">
                          <textarea
                            ref={textareaRef}
                            className="markdown-hybrid-block-editor markdown-hybrid-math-editor"
                            value={activeDraft}
                            rows={Math.max(3, activeDraft.split("\n").length)}
                            onChange={(event) =>
                              handleTextareaChange(event.target.value, event.target.selectionStart)}
                            onBlur={handleTextareaBlur}
                            onCompositionStart={handleTextareaCompositionStart}
                            onCompositionEnd={handleTextareaCompositionEnd}
                            onKeyDown={handleTextareaKeyDown}
                            onKeyUp={handleTextareaKeyUp}
                            onSelect={handleTextareaSelect}
                            onMouseUp={handleTextareaPointerUp}
                            onScroll={handleTextareaScroll}
                            aria-label="Math block editor"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`markdown-hybrid-block-editor-shell${
                        useSyncedSvgCodeFenceEditorHeight
                          ? " markdown-hybrid-code-fence-editor-shell"
                          : ""
                      }`}
                    >
                      <div
                        className={`markdown-hybrid-block-editor-overlay${
                          useSyncedSvgCodeFenceEditorHeight
                            ? " markdown-hybrid-code-fence-editor-overlay"
                            : ""
                        }`}
                        aria-hidden="true"
                      >
                        <div
                          ref={editorSyntaxOverlayContentRef}
                          className={`markdown-hybrid-block-editor-overlay-content${
                            useSyncedSvgCodeFenceEditorHeight
                              ? " markdown-hybrid-code-fence-editor-overlay-content"
                              : ""
                          }`}
                        >
                          {activeEditorSyntaxOverlayContent}
                        </div>
                      </div>
                      <textarea
                        ref={textareaRef}
                        className={`markdown-hybrid-block-editor markdown-hybrid-block-editor-syntax-overlay${
                          useSyncedSvgCodeFenceEditorHeight
                            ? " markdown-hybrid-code-fence-editor"
                            : ""
                        }`}
                        style={
                          useSyncedSvgCodeFenceEditorHeight
                            ? { height: `${syncedSvgCodeFenceHeight}px` }
                            : undefined
                        }
                        value={activeDraft}
                        rows={Math.max(1, activeDraft.split("\n").length)}
                        onChange={(event) =>
                          handleTextareaChange(event.target.value, event.target.selectionStart)}
                        onBlur={handleTextareaBlur}
                        onCompositionStart={handleTextareaCompositionStart}
                        onCompositionEnd={handleTextareaCompositionEnd}
                        onKeyDown={handleTextareaKeyDown}
                        onKeyUp={handleTextareaKeyUp}
                        onSelect={handleTextareaSelect}
                        onMouseUp={handleTextareaPointerUp}
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
                  )
                ) : block.kind === "math-block" ? (
                  <div className="markdown-hybrid-math-block-shell">
                    <div className="markdown-hybrid-math-block-toolbar">
                      <button
                        type="button"
                        className="markdown-hybrid-math-toolbox-trigger"
                        data-md-block-control="true"
                        data-md-math-toolbox-trigger="true"
                        aria-label="Open math toolbox"
                        title="Open math toolbox"
                        onMouseDown={handleMathToolboxButtonMouseDown}
                        onClick={handleMathToolboxButtonClick(index)}
                      >
                        <InsertMenuIconGraphic icon="math-block" />
                      </button>
                    </div>
                    <div className="markdown-hybrid-math-preview-shell">
                      <MathBlockRenderer source={mathBlockBodySource} />
                    </div>
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
                      {renderPreviewWithPageLinks(previewBlockSource)}
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
                              {part.source.trim().length > 0 ? renderPreviewWithPageLinks(part.source) : null}
                            </div>
                          </div>
                        ) : (
                          <div
                            key={`card-part:${index}:${partIndex}`}
                            className="markdown-hybrid-card-body-part"
                          >
                            {part.segments.length > 0 ? (
                              part.segments.map((segment, segmentIndex) =>
                                segment.kind === "media" ? (
                                  <div
                                    key={`card-segment:${index}:${partIndex}:${segmentIndex}`}
                                    className="markdown-hybrid-block-preview markdown-hybrid-media-block-preview"
                                  >
                                    {segment.items.length > 0 ? (
                                      <FlashcardMediaGroup
                                        media={segment.items}
                                        vaultPngAssets={vaultPngAssets}
                                        vaultPath={vaultPath}
                                        sourceRelativePath={sourceRelativePath}
                                      />
                                    ) : (
                                      <pre className="flashcard-code-block media-block-card-source">
                                        <code>{segment.raw}</code>
                                      </pre>
                                    )}
                                  </div>
                                ) : segment.kind === "table" ? (
                                  <div
                                    key={`card-segment:${index}:${partIndex}:${segmentIndex}`}
                                    className="markdown-hybrid-card-table-segment"
                                    data-md-block-control="true"
                                  >
                                    <MarkdownHybridTableBlock
                                      blockIndex={index}
                                      raw={segment.raw}
                                      active={isCardTableSegmentActive(partIndex, segmentIndex)}
                                      allowCodeView={false}
                                      disabled={disabled}
                                      vaultFiles={vaultFiles}
                                      vaultPngAssets={vaultPngAssets}
                                      renderPreview={renderPreviewWithPageLinks}
                                      pendingActivation={
                                        isCardTableSegmentActive(partIndex, segmentIndex)
                                          ? activeCardTableState?.pendingActivation ?? null
                                          : null
                                      }
                                      onConsumePendingActivation={() =>
                                        consumeCardTablePendingActivation({
                                          blockIndex: index,
                                          blockId: block.id,
                                          partIndex,
                                          segmentIndex,
                                        })}
                                      onRequestActivate={(request) =>
                                        handleCardTableSegmentRequestActivate(
                                          {
                                            blockIndex: index,
                                            blockId: block.id,
                                            partIndex,
                                            segmentIndex,
                                          },
                                          request,
                                        )}
                                      onCommitRaw={(nextRaw) => {
                                        handleCardTableSegmentCommitRaw(
                                          {
                                            blockIndex: index,
                                            blockId: block.id,
                                            partIndex,
                                            segmentIndex,
                                          },
                                          nextRaw,
                                        );
                                      }}
                                      onDirtyChange={(dirty) => {
                                        if (isCardTableSegmentActive(partIndex, segmentIndex)) {
                                          setActiveCardTableDirty(dirty);
                                        }
                                      }}
                                      registerSession={(controller) => {
                                        if (isCardTableSegmentActive(partIndex, segmentIndex) || controller === null) {
                                          registerActiveCardTableSession(controller);
                                        }
                                      }}
                                      onGlobalUndo={handleGlobalUndo}
                                      onGlobalRedo={handleGlobalRedo}
                                    />
                                  </div>
                                ) : segment.source.trim().length > 0 ? (
                                  <div
                                    key={`card-segment:${index}:${partIndex}:${segmentIndex}`}
                                    className="markdown-hybrid-block-preview"
                                  >
                                    {renderPreviewWithPageLinks(segment.source)}
                                  </div>
                                ) : null
                              )
                            ) : (
                              <div className="markdown-hybrid-card-block-empty" aria-hidden="true" />
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ) : block.kind === "image-embed" ? (
                  <div className="markdown-hybrid-block-preview markdown-hybrid-media-block-preview markdown-hybrid-image-embed-preview-shell">
                    {imageEmbedPreviewItems.length > 0 ? (
                      <FlashcardMediaGroup
                        media={imageEmbedPreviewItems}
                        vaultPngAssets={vaultPngAssets}
                        vaultPath={vaultPath}
                        sourceRelativePath={sourceRelativePath}
                      />
                    ) : (
                      <pre className="flashcard-code-block media-block-card-source">
                        <code>{block.raw}</code>
                      </pre>
                    )}
                    <div
                      className={`markdown-hybrid-image-embed-replace-shell${isImageEmbedReplacePickerOpen ? " is-open" : ""}`}
                      data-md-block-control="true"
                      onMouseDown={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <button
                        type="button"
                        className="markdown-hybrid-image-embed-replace-trigger"
                        data-md-block-control="true"
                        data-md-image-embed-replace-trigger="true"
                        aria-label="Bild austauschen"
                        title="Bild austauschen"
                        onMouseDown={(event) => {
                          event.stopPropagation();
                        }}
                        onClick={handleOpenImageEmbedReplacePicker(index)}
                        disabled={disabled}
                      >
                        Bild austauschen
                      </button>
                      {isImageEmbedReplacePickerOpen ? (
                        <div
                          ref={imageEmbedReplacePickerRef}
                          className="markdown-hybrid-image-embed-picker"
                          data-md-block-control="true"
                          role="dialog"
                          aria-label="Select replacement PNG"
                          onMouseDown={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          <VaultPngPicker
                            assets={vaultPngAssets}
                            query={imageEmbedReplacePickerState?.query ?? ""}
                            onQueryChange={handleImageEmbedReplaceQueryChange}
                            onSearchKeyDown={handleImageEmbedReplaceSearchKeyDown}
                            onSelect={handleImageEmbedReplaceSelectCandidate}
                            highlightedIndex={imageEmbedReplacePickerState?.highlightedIndex ?? 0}
                            onHighlightedIndexChange={(nextIndex) =>
                              setImageEmbedReplacePickerState((current) =>
                                current
                                  ? { ...current, highlightedIndex: nextIndex }
                                  : current
                              )
                            }
                            selectedRelPath={imageEmbedToken?.src ?? null}
                            emptyLabel="No PNG files found in the current vault."
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : block.kind === "code-fence" && codeFencePreviewItems.length > 0 ? (
                  <div className="markdown-hybrid-block-preview markdown-hybrid-media-block-preview">
                    <FlashcardMediaGroup
                      media={codeFencePreviewItems}
                      vaultPngAssets={vaultPngAssets}
                      vaultPath={vaultPath}
                      sourceRelativePath={sourceRelativePath}
                    />
                  </div>
                ) : (
                  <div
                    className="markdown-hybrid-block-preview"
                    onChange={handleRenderedTaskCheckboxChange(index)}
                  >
                    {renderPreviewWithPageLinks(previewBlockSource)}
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
      {pageLinkPickerPopup}
      {typedImageLinkPickerPopup}
      {mathToolboxPopup}
      {inlineFormattingToolbarPopup}
      {selectionContextMenu}
    </div>
  );
});

MarkdownHybridEditor.displayName = "MarkdownHybridEditor";
