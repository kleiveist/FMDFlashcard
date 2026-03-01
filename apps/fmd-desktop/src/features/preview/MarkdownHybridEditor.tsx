/**
 * @file apps/fmd-desktop/src/features/preview/MarkdownHybridEditor.tsx
 *
 * Zweck:
 * - Zeigt Markdown als Blockliste an.
 * - Nur der aktive Block ist als Raw-Textarea editierbar.
 */

import {
  Children,
  type CSSProperties,
  cloneElement,
  createElement,
  type DragEvent,
  type FocusEvent,
  type FormEvent,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { normalizeRelativePath } from "../../lib/path";
import { type VaultFile } from "../../lib/tree";
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
import {
  extractMathBlockBody,
  getMathBlockDefaultSelection,
  insertMathTemplateIntoRaw,
  isMathBlockDelimiterLine,
  MathBlockRenderer,
  MATH_TOOLBOX_SECTIONS,
  normalizeMathBlockSource,
  resolveMathBlockBoundaries,
  type MathToolboxTemplate,
} from "./mathBlocks";
import {
  MarkdownHybridTableBlock,
  type MarkdownHybridTableActivationRequest,
  type MarkdownHybridTableSessionController,
} from "./MarkdownHybridTableBlock";

export type MarkdownHybridEditorMode = "edit" | "write";

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
  initialSelection?: {
    start: number;
    end: number;
  };
  icon?: InsertMenuIconId;
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
  anchorRect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
};

type InlineFormattingToolbarAction =
  | "highlight"
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "inline-code"
  | "math";

type InlineFormattingToolbarMenu = "more" | null;

type InlineFormattingToolbarAnchor = {
  centerX: number;
  top: number;
  bottom: number;
};

type InlineFormattingToolbarSelection = {
  blockIndex: number;
  start: number;
  end: number;
  anchor: InlineFormattingToolbarAnchor;
  activeState: InlineFormattingToolbarActiveState;
};

type InlineFormattingToolbarLinkState = {
  url: string;
  canRemove: boolean;
};

type InlineFormattingToolbarRange = {
  start: number;
  end: number;
};

type InlineFormattingToggleResult = {
  value: string;
  selection: InlineFormattingToolbarRange;
  changed: boolean;
};

type InlineFormattingWrapper = {
  open: string;
  close: string;
};

type InlineFormattingToolbarActiveState = {
  highlight: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  link: boolean;
  strikethrough: boolean;
  "inline-code": boolean;
  math: boolean;
};

type MarkdownHybridEditorProps = {
  historyKey: string;
  markdown: string;
  mode: MarkdownHybridEditorMode;
  disabled?: boolean;
  vaultFiles?: VaultFile[];
  onNavigateWikilink?: (wikilink: string) => void;
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

type FloatingInlineFormattingToolbarProps = {
  anchor: InlineFormattingToolbarAnchor;
  menu: InlineFormattingToolbarMenu;
  linkState: InlineFormattingToolbarLinkState | null;
  activeState: InlineFormattingToolbarActiveState;
  toolbarRef: { current: HTMLDivElement | null };
  onClose: () => void;
  onToggleMenu: (menu: Exclude<InlineFormattingToolbarMenu, null>) => void;
  onAction: (action: InlineFormattingToolbarAction | "link" | "clear-formatting") => void;
  onLinkUrlChange: (value: string) => void;
  onLinkSubmit: () => void;
  onLinkRemove: () => void;
  onLinkCancel: () => void;
};

const FloatingInlineFormattingToolbar = ({
  anchor,
  menu,
  linkState,
  activeState,
  toolbarRef,
  onClose,
  onToggleMenu,
  onAction,
  onLinkUrlChange,
  onLinkSubmit,
  onLinkRemove,
  onLinkCancel,
}: FloatingInlineFormattingToolbarProps) => {
  const localToolbarRef = useRef<HTMLDivElement | null>(null);
  const linkInputRef = useRef<HTMLInputElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const setToolbarNode = useCallback(
    (node: HTMLDivElement | null) => {
      localToolbarRef.current = node;
      toolbarRef.current = node;
    },
    [toolbarRef],
  );

  useLayoutEffect(() => {
    const handle = window.requestAnimationFrame(() => {
      const toolbarNode = localToolbarRef.current;
      if (!toolbarNode) {
        return;
      }
      const rect = toolbarNode.getBoundingClientRect();
      const width = Math.max(1, rect.width || 1);
      const height = Math.max(1, rect.height || 1);
      const padding = INLINE_FORMATTING_TOOLBAR_VIEWPORT_PADDING_PX;
      let top = anchor.top - height - INLINE_FORMATTING_TOOLBAR_GAP_PX;
      if (top < padding) {
        top = anchor.bottom + INLINE_FORMATTING_TOOLBAR_GAP_PX;
      }
      if (top + height > window.innerHeight - padding) {
        top = Math.max(padding, window.innerHeight - height - padding);
      }
      const maxLeft = Math.max(padding, window.innerWidth - width - padding);
      const left = Math.max(
        padding,
        Math.min(anchor.centerX - width / 2, maxLeft),
      );
      setPosition({ left: Math.round(left), top: Math.round(top) });
    });
    return () => window.cancelAnimationFrame(handle);
  }, [anchor, linkState?.canRemove, linkState?.url, menu]);

  useEffect(() => {
    if (!linkState) {
      return;
    }
    const handle = window.requestAnimationFrame(() => {
      const input = linkInputRef.current;
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
  }, [linkState]);

  if (typeof document === "undefined") {
    return null;
  }

  const hasAnyInlineFormattingActive = activeState.highlight ||
    activeState.bold ||
    activeState.italic ||
    activeState.underline ||
    activeState.link ||
    activeState.strikethrough ||
    activeState["inline-code"] ||
    activeState.math;

  const handleButtonMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return createPortal(
    <div
      ref={setToolbarNode}
      className="markdown-hybrid-inline-toolbar"
      role="dialog"
      aria-label="Inline formatting toolbar"
      style={{
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        visibility: position ? "visible" : "hidden",
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (linkState) {
          onLinkCancel();
          return;
        }
        onClose();
      }}
    >
      <div className="markdown-hybrid-inline-toolbar-row" role="toolbar" aria-label="Inline formatting">
        <button
          type="button"
          className={`markdown-hybrid-inline-toolbar-button${hasAnyInlineFormattingActive ? " is-active" : ""}`}
          aria-label="Text format menu"
          title="Clear inline formatting"
          onMouseDown={handleButtonMouseDown}
          onClick={() => onAction("clear-formatting")}
        >
          T
        </button>
        <button
          type="button"
          className={`markdown-hybrid-inline-toolbar-button${
            activeState.highlight ? " is-active" : ""
          }`}
          aria-label="Highlight text"
          title="Highlight (Ctrl/Cmd+H)"
          onMouseDown={handleButtonMouseDown}
          onClick={() => onAction("highlight")}
        >
          A
        </button>
        <button
          type="button"
          className={`markdown-hybrid-inline-toolbar-button${activeState.bold ? " is-active" : ""}`}
          aria-label="Bold text"
          title="Bold (Ctrl/Cmd+B)"
          onMouseDown={handleButtonMouseDown}
          onClick={() => onAction("bold")}
        >
          B
        </button>
        <button
          type="button"
          className={`markdown-hybrid-inline-toolbar-button markdown-hybrid-inline-toolbar-button-italic${
            activeState.italic ? " is-active" : ""
          }`}
          aria-label="Italic text"
          title="Italic (Ctrl/Cmd+I)"
          onMouseDown={handleButtonMouseDown}
          onClick={() => onAction("italic")}
        >
          I
        </button>
        <button
          type="button"
          className={`markdown-hybrid-inline-toolbar-button markdown-hybrid-inline-toolbar-button-underline${
            activeState.underline ? " is-active" : ""
          }`}
          aria-label="Underline text"
          title="Underline (Ctrl/Cmd+U)"
          onMouseDown={handleButtonMouseDown}
          onClick={() => onAction("underline")}
        >
          U
        </button>
        <button
          type="button"
          className={`markdown-hybrid-inline-toolbar-button${
            activeState.link || Boolean(linkState) ? " is-active" : ""
          }`}
          aria-label="Create or edit link"
          title="Link (Ctrl/Cmd+K)"
          onMouseDown={handleButtonMouseDown}
          onClick={() => onAction("link")}
        >
          <span className="markdown-hybrid-inline-toolbar-link-icon" aria-hidden="true">
            <InsertMenuIconGraphic icon="link" />
          </span>
        </button>
        <button
          type="button"
          className={`markdown-hybrid-inline-toolbar-button markdown-hybrid-inline-toolbar-button-strike${
            activeState.strikethrough ? " is-active" : ""
          }`}
          aria-label="Strikethrough text"
          title="Strikethrough (Ctrl/Cmd+Shift+X)"
          onMouseDown={handleButtonMouseDown}
          onClick={() => onAction("strikethrough")}
        >
          S
        </button>
        <button
          type="button"
          className={`markdown-hybrid-inline-toolbar-button markdown-hybrid-inline-toolbar-button-code${
            activeState["inline-code"] ? " is-active" : ""
          }`}
          aria-label="Inline code"
          title="Inline code (Ctrl/Cmd+E)"
          onMouseDown={handleButtonMouseDown}
          onClick={() => onAction("inline-code")}
        >
          {"</>"}
        </button>
        <button
          type="button"
          className={`markdown-hybrid-inline-toolbar-button${activeState.math ? " is-active" : ""}`}
          aria-label="Inline formula"
          title="Formula (Ctrl/Cmd+Shift+M)"
          onMouseDown={handleButtonMouseDown}
          onClick={() => onAction("math")}
        >
          {"√x"}
        </button>
        <button
          type="button"
          className={`markdown-hybrid-inline-toolbar-button${menu === "more" ? " is-active" : ""}`}
          aria-label="More actions"
          title="More"
          onMouseDown={handleButtonMouseDown}
          onClick={() => onToggleMenu("more")}
        >
          …
        </button>
      </div>
      {menu === "more" ? (
        <div className="markdown-hybrid-inline-toolbar-menu" role="menu" aria-label="More inline actions">
          <div className="markdown-hybrid-inline-toolbar-menu-note">More actions coming soon</div>
        </div>
      ) : null}
      {linkState ? (
        <div
          className="markdown-hybrid-inline-toolbar-link"
          role="group"
          aria-label="Link editor"
        >
          <input
            ref={linkInputRef}
            type="url"
            className="markdown-hybrid-inline-toolbar-link-input"
            placeholder="https://example.com"
            value={linkState.url}
            onChange={(event) => onLinkUrlChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                onLinkSubmit();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onLinkCancel();
              }
            }}
            aria-label="Link URL"
          />
          <button
            type="button"
            className="markdown-hybrid-inline-toolbar-link-button"
            onMouseDown={handleButtonMouseDown}
            onClick={onLinkSubmit}
          >
            Apply
          </button>
          {linkState.canRemove ? (
            <button
              type="button"
              className="markdown-hybrid-inline-toolbar-link-button is-danger"
              onMouseDown={handleButtonMouseDown}
              onClick={onLinkRemove}
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  );
};

const FloatingMathToolbox = ({
  anchorRect,
  toolboxRef,
  onSelect,
  onClose,
}: {
  anchorRect: MathToolboxState["anchorRect"];
  toolboxRef: { current: HTMLDivElement | null };
  onSelect: (template: MathToolboxTemplate) => void;
  onClose: () => void;
}) => {
  const localToolboxRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const setToolboxNode = useCallback(
    (node: HTMLDivElement | null) => {
      localToolboxRef.current = node;
      toolboxRef.current = node;
    },
    [toolboxRef],
  );

  useLayoutEffect(() => {
    const handle = window.requestAnimationFrame(() => {
      const toolboxNode = localToolboxRef.current;
      if (!toolboxNode) {
        return;
      }
      const rect = toolboxNode.getBoundingClientRect();
      const width = Math.max(1, rect.width || 1);
      const height = Math.max(1, rect.height || 1);
      const padding = 10;
      let left = anchorRect.right - width;
      if (left < padding) {
        left = padding;
      }
      if (left + width > window.innerWidth - padding) {
        left = Math.max(padding, window.innerWidth - width - padding);
      }
      let top = anchorRect.bottom + 8;
      if (top + height > window.innerHeight - padding) {
        top = anchorRect.top - height - 8;
      }
      if (top < padding) {
        top = Math.max(padding, window.innerHeight - height - padding);
      }
      setPosition({
        left: Math.round(left),
        top: Math.round(top),
      });
    });
    return () => window.cancelAnimationFrame(handle);
  }, [anchorRect.bottom, anchorRect.right, anchorRect.top]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={setToolboxNode}
      className="markdown-hybrid-math-toolbox"
      role="dialog"
      aria-label="Math toolbox"
      style={{
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        visibility: position ? "visible" : "hidden",
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="markdown-hybrid-math-toolbox-header">
        <span className="markdown-hybrid-math-toolbox-title">Math Toolbox</span>
        <button
          type="button"
          className="markdown-hybrid-math-toolbox-close"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={onClose}
          aria-label="Close math toolbox"
        >
          <InsertMenuIconGraphic icon="close" />
        </button>
      </div>
      <div className="markdown-hybrid-math-toolbox-sections">
        {MATH_TOOLBOX_SECTIONS.map((section) => (
          <section key={section.id} className="markdown-hybrid-math-toolbox-section">
            <h4 className="markdown-hybrid-math-toolbox-section-title">{section.label}</h4>
            <div className="markdown-hybrid-math-toolbox-grid">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="markdown-hybrid-math-toolbox-item"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={() => onSelect(item)}
                >
                  <span className="markdown-hybrid-math-toolbox-item-label">{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>,
    document.body,
  );
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

const getAnchorRectFromElement = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
};

const detectTypedPageLinkTrigger = (
  value: string,
  selectionStart: number | null | undefined,
): PageLinkPickerReplaceRange | null => {
  if (typeof selectionStart !== "number") {
    return null;
  }
  const safeSelectionStart = Math.max(0, Math.min(selectionStart, value.length));
  const before = value.slice(0, safeSelectionStart);
  if (!inlineWikilinkOpenTrigger.test(before)) {
    return null;
  }
  return {
    start: safeSelectionStart - 2,
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
const INLINE_FORMATTING_TOOLBAR_VIEWPORT_PADDING_PX = 8;
const INLINE_FORMATTING_TOOLBAR_GAP_PX = 10;

const INLINE_FORMATTING_WRAPPERS: Record<InlineFormattingToolbarAction, InlineFormattingWrapper> = {
  highlight: { open: "==", close: "==" },
  bold: { open: "**", close: "**" },
  italic: { open: "*", close: "*" },
  underline: { open: "__", close: "__" },
  strikethrough: { open: "~~", close: "~~" },
  "inline-code": { open: "`", close: "`" },
  math: { open: "$", close: "$" },
};

const inlineMarkdownLinkPattern = /\[([^\]\n]*)\]\(([^)\n]*)\)/g;

const normalizeInlineFormattingRange = (
  value: string,
  range: InlineFormattingToolbarRange,
): InlineFormattingToolbarRange => {
  const max = value.length;
  const start = Math.max(0, Math.min(range.start, max));
  const end = Math.max(0, Math.min(range.end, max));
  if (start <= end) {
    return { start, end };
  }
  return { start: end, end: start };
};

const countRepeatedCharBeforeIndex = (
  value: string,
  startIndex: number,
  char: string,
) => {
  let count = 0;
  let index = startIndex - 1;
  while (index >= 0 && value[index] === char) {
    count += 1;
    index -= 1;
  }
  return count;
};

const countRepeatedCharAfterIndex = (
  value: string,
  startIndex: number,
  char: string,
) => {
  let count = 0;
  let index = startIndex;
  while (index < value.length && value[index] === char) {
    count += 1;
    index += 1;
  }
  return count;
};

const resolveRepeatedMarkerRunsAroundSelection = (
  value: string,
  range: InlineFormattingToolbarRange,
  marker: string,
) => {
  const normalized = normalizeInlineFormattingRange(value, range);
  return {
    left: countRepeatedCharBeforeIndex(value, normalized.start, marker),
    right: countRepeatedCharAfterIndex(value, normalized.end, marker),
  };
};

const toggleInlineFormattingWrapper = (
  value: string,
  range: InlineFormattingToolbarRange,
  wrapper: InlineFormattingWrapper,
): InlineFormattingToggleResult => {
  const normalized = normalizeInlineFormattingRange(value, range);
  if (normalized.start === normalized.end) {
    return { value, selection: normalized, changed: false };
  }

  // Star markers need dedicated handling so bold/italic combinations
  // are stable: ** + italic => *** and toggles remove only their own layer.
  if (wrapper.open === "*" && wrapper.close === "*" && wrapper.open.length <= 2) {
    const starRuns = resolveRepeatedMarkerRunsAroundSelection(value, normalized, "*");
    if (wrapper.open.length === 1) {
      const isItalicActive = starRuns.left >= 1 &&
        starRuns.right >= 1 &&
        starRuns.left % 2 === 1 &&
        starRuns.right % 2 === 1;
      if (isItalicActive) {
        const nextValue = `${value.slice(0, normalized.start - 1)}${value.slice(normalized.start, normalized.end)}${
          value.slice(normalized.end + 1)
        }`;
        return {
          value: nextValue,
          selection: {
            start: normalized.start - 1,
            end: normalized.end - 1,
          },
          changed: nextValue !== value,
        };
      }
      const nextValue = `${value.slice(0, normalized.start)}*${value.slice(normalized.start, normalized.end)}*${
        value.slice(normalized.end)
      }`;
      return {
        value: nextValue,
        selection: {
          start: normalized.start + 1,
          end: normalized.end + 1,
        },
        changed: nextValue !== value,
      };
    }
    const isBoldActive = starRuns.left >= 2 && starRuns.right >= 2;
    if (isBoldActive) {
      const nextValue = `${value.slice(0, normalized.start - 2)}${value.slice(normalized.start, normalized.end)}${
        value.slice(normalized.end + 2)
      }`;
      return {
        value: nextValue,
        selection: {
          start: normalized.start - 2,
          end: normalized.end - 2,
        },
        changed: nextValue !== value,
      };
    }
    const nextValue = `${value.slice(0, normalized.start)}**${value.slice(normalized.start, normalized.end)}**${
      value.slice(normalized.end)
    }`;
    return {
      value: nextValue,
      selection: {
        start: normalized.start + 2,
        end: normalized.end + 2,
      },
      changed: nextValue !== value,
    };
  }

  const selected = value.slice(normalized.start, normalized.end);
  const selectedHasWrapper = selected.length >= wrapper.open.length + wrapper.close.length &&
    selected.startsWith(wrapper.open) &&
    selected.endsWith(wrapper.close);
  if (selectedHasWrapper) {
    const nextSelection = {
      start: normalized.start,
      end: normalized.end - wrapper.open.length - wrapper.close.length,
    };
    const nextValue = `${value.slice(0, normalized.start)}${
      selected.slice(wrapper.open.length, selected.length - wrapper.close.length)
    }${value.slice(normalized.end)}`;
    return {
      value: nextValue,
      selection: nextSelection,
      changed: nextValue !== value,
    };
  }

  const hasWrapperAroundSelection = normalized.start >= wrapper.open.length &&
    normalized.end + wrapper.close.length <= value.length &&
    value.slice(normalized.start - wrapper.open.length, normalized.start) === wrapper.open &&
    value.slice(normalized.end, normalized.end + wrapper.close.length) === wrapper.close;
  if (hasWrapperAroundSelection) {
    const nextValue = `${value.slice(0, normalized.start - wrapper.open.length)}${selected}${
      value.slice(normalized.end + wrapper.close.length)
    }`;
    const nextSelection = {
      start: normalized.start - wrapper.open.length,
      end: normalized.end - wrapper.open.length,
    };
    return {
      value: nextValue,
      selection: nextSelection,
      changed: nextValue !== value,
    };
  }

  const nextValue = `${value.slice(0, normalized.start)}${wrapper.open}${selected}${wrapper.close}${
    value.slice(normalized.end)
  }`;
  return {
    value: nextValue,
    selection: {
      start: normalized.start + wrapper.open.length,
      end: normalized.end + wrapper.open.length,
    },
    changed: nextValue !== value,
  };
};

type InlineMarkdownLinkMatch = {
  start: number;
  end: number;
  label: string;
  url: string;
};

const findInlineMarkdownLinkAtRange = (
  value: string,
  range: InlineFormattingToolbarRange,
): InlineMarkdownLinkMatch | null => {
  const normalized = normalizeInlineFormattingRange(value, range);
  inlineMarkdownLinkPattern.lastIndex = 0;
  let match = inlineMarkdownLinkPattern.exec(value);
  while (match) {
    const start = match.index;
    const end = start + (match[0]?.length ?? 0);
    if (start <= normalized.start && end >= normalized.end) {
      return {
        start,
        end,
        label: match[1] ?? "",
        url: match[2] ?? "",
      };
    }
    if (start > normalized.end) {
      break;
    }
    match = inlineMarkdownLinkPattern.exec(value);
  }
  return null;
};

const applyInlineMarkdownLink = (
  value: string,
  range: InlineFormattingToolbarRange,
  rawUrl: string,
): InlineFormattingToggleResult => {
  const normalized = normalizeInlineFormattingRange(value, range);
  const url = rawUrl.trim();
  const existingLink = findInlineMarkdownLinkAtRange(value, normalized);

  if (existingLink) {
    const replacement = url
      ? `[${existingLink.label}](${url})`
      : existingLink.label;
    const nextValue = `${value.slice(0, existingLink.start)}${replacement}${value.slice(existingLink.end)}`;
    const labelStart = existingLink.start + (url ? 1 : 0);
    return {
      value: nextValue,
      selection: {
        start: labelStart,
        end: labelStart + existingLink.label.length,
      },
      changed: nextValue !== value,
    };
  }

  if (normalized.start === normalized.end || !url) {
    return { value, selection: normalized, changed: false };
  }

  const label = value.slice(normalized.start, normalized.end);
  const token = `[${label}](${url})`;
  const nextValue = `${value.slice(0, normalized.start)}${token}${value.slice(normalized.end)}`;
  return {
    value: nextValue,
    selection: {
      start: normalized.start + 1,
      end: normalized.start + 1 + label.length,
    },
    changed: nextValue !== value,
  };
};

const inlineFormattingClearPatterns: ReadonlyArray<readonly [RegExp, string]> = [
  [/\[([^\]\n]*)\]\(([^)\n]*)\)/g, "$1"],
  [/(^|[^*])\*\*\*([^*\n]+)\*\*\*(?=[^*]|$)/g, "$1$2"],
  [/(^|[^*])\*\*([^*\n]+)\*\*(?=[^*]|$)/g, "$1$2"],
  [/(^|[^*])\*([^*\n]+)\*(?=[^*]|$)/g, "$1$2"],
  [/(^|[^_])__([^_\n]+)__(?=[^_]|$)/g, "$1$2"],
  [/(^|[^~])~~([^~\n]+)~~(?=[^~]|$)/g, "$1$2"],
  [/(^|[^=])==([^=\n]+)==(?=[^=]|$)/g, "$1$2"],
  [/`([^`\n]+)`/g, "$1"],
  [/\$([^$\n]+)\$/g, "$1"],
];

const stripSupportedInlineMarkdownFormatting = (value: string) => {
  let nextValue = value;
  let previousValue = "";
  while (nextValue !== previousValue) {
    previousValue = nextValue;
    for (const [pattern, replacement] of inlineFormattingClearPatterns) {
      nextValue = nextValue.replace(pattern, replacement);
    }
  }
  return nextValue;
};

const createEmptyInlineFormattingActiveState = (): InlineFormattingToolbarActiveState => ({
  highlight: false,
  bold: false,
  italic: false,
  underline: false,
  link: false,
  strikethrough: false,
  "inline-code": false,
  math: false,
});

const isInlineFormattingWrapperActive = (
  value: string,
  range: InlineFormattingToolbarRange,
  wrapper: InlineFormattingWrapper,
) => {
  const normalized = normalizeInlineFormattingRange(value, range);
  if (normalized.start === normalized.end) {
    return false;
  }

  if (wrapper.open === "*" && wrapper.close === "*" && wrapper.open.length <= 2) {
    const starRuns = resolveRepeatedMarkerRunsAroundSelection(value, normalized, "*");
    if (wrapper.open.length === 1) {
      return starRuns.left >= 1 &&
        starRuns.right >= 1 &&
        starRuns.left % 2 === 1 &&
        starRuns.right % 2 === 1;
    }
    return starRuns.left >= 2 && starRuns.right >= 2;
  }

  const selected = value.slice(normalized.start, normalized.end);
  const selectionContainsWrapper = selected.length >= wrapper.open.length + wrapper.close.length &&
    selected.startsWith(wrapper.open) &&
    selected.endsWith(wrapper.close);
  if (selectionContainsWrapper) {
    return true;
  }
  const hasWrapperAroundSelection = normalized.start >= wrapper.open.length &&
    normalized.end + wrapper.close.length <= value.length &&
    value.slice(normalized.start - wrapper.open.length, normalized.start) === wrapper.open &&
    value.slice(normalized.end, normalized.end + wrapper.close.length) === wrapper.close;
  return hasWrapperAroundSelection;
};

const resolveInlineFormattingToolbarActiveState = (
  value: string,
  range: InlineFormattingToolbarRange,
): InlineFormattingToolbarActiveState => {
  const normalized = normalizeInlineFormattingRange(value, range);
  if (normalized.start === normalized.end) {
    return createEmptyInlineFormattingActiveState();
  }
  const linkMatch = findInlineMarkdownLinkAtRange(value, normalized);
  return {
    highlight: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.highlight),
    bold: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.bold),
    italic: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.italic),
    underline: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.underline),
    link: Boolean(linkMatch),
    strikethrough: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.strikethrough),
    "inline-code": isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS["inline-code"]),
    math: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.math),
  };
};

const resolveInlineFormattingShortcutAction = (
  event: KeyboardEvent<HTMLElement>,
): InlineFormattingToolbarAction | "link" | null => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) {
    return null;
  }
  const lowerKey = event.key.toLowerCase();

  if (!event.shiftKey && lowerKey === "b") {
    return "bold";
  }
  if (!event.shiftKey && lowerKey === "i") {
    return "italic";
  }
  if (!event.shiftKey && lowerKey === "u") {
    return "underline";
  }
  if (!event.shiftKey && lowerKey === "k") {
    return "link";
  }
  if (!event.shiftKey && lowerKey === "h") {
    return "highlight";
  }
  if (event.shiftKey && (lowerKey === "x" || lowerKey === "s")) {
    return "strikethrough";
  }
  if (!event.shiftKey && (lowerKey === "e" || event.code === "Backquote" || event.key === "`")) {
    return "inline-code";
  }
  if (event.shiftKey && lowerKey === "m") {
    return "math";
  }
  return null;
};

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
const editorQuoteLinePattern = /^(\s*)(>+)(\s*)(.*)$/;
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

type EditorQuoteLineInfo = {
  indent: string;
  markers: string;
  spacing: string;
  content: string;
  prefixLength: number;
  continuationPrefix: string;
  isEmpty: boolean;
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

const parseEditorQuoteLine = (line: string): EditorQuoteLineInfo | null => {
  const quoteMatch = line.match(editorQuoteLinePattern);
  if (!quoteMatch) {
    return null;
  }
  const indent = quoteMatch[1] ?? "";
  const markers = quoteMatch[2] ?? ">";
  const spacing = quoteMatch[3] ?? "";
  const content = quoteMatch[4] ?? "";
  return {
    indent,
    markers,
    spacing,
    content,
    prefixLength: indent.length + markers.length + spacing.length,
    continuationPrefix: `${indent}${markers} `,
    isEmpty: content.trim().length === 0,
  };
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
    : draft;

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
  vaultFiles,
  onNavigateWikilink,
  onChange,
  onCommit,
  onDirtyChange,
  renderPreview,
}: MarkdownHybridEditorProps) => {
  const blocks = useMemo(() => parseMarkdownBlocks(markdown), [markdown]);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [activeDraft, setActiveDraft] = useState("");
  const [activeDirty, setActiveDirty] = useState(false);
  const [activeTableDirty, setActiveTableDirty] = useState(false);
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
  const [pendingPageLinkPickerRequest, setPendingPageLinkPickerRequest] =
    useState<PendingPageLinkPickerRequest | null>(null);
  const [pageLinkPickerState, setPageLinkPickerState] = useState<PageLinkPickerState | null>(null);
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
  const stableBlockRenderTokensRef = useRef<StableRenderKeyToken[]>([]);
  const stableBlockRenderKeyCounterRef = useRef(0);
  const pendingActivationMarkdownRef = useRef<string | null>(null);
  const activeTableSessionRef = useRef<MarkdownHybridTableSessionController | null>(null);
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
  const pageLinkLookup = useMemo(() => buildPageLinkLookup(pageLinkCandidates), [pageLinkCandidates]);
  const filteredPageLinkCandidates = useMemo(
    () => filterPageLinkCandidates(pageLinkCandidates, pageLinkPickerState?.query ?? ""),
    [pageLinkCandidates, pageLinkPickerState?.query],
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

  const editorDirty = activeDirty || activeTableDirty;

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
    setActiveDraft("");
    setActiveDirty(false);
    setActiveTableDirty(false);
    setPendingActivation(null);
    setPendingTableActivation(null);
    pendingActivationMarkdownRef.current = null;
    activeTableSessionRef.current = null;
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

  const closePageLinkPicker = useCallback(() => {
    setPendingPageLinkPickerRequest(null);
    setPageLinkPickerState(null);
  }, []);

  const requestPageLinkPickerOpen = useCallback((request: PendingPageLinkPickerRequest) => {
    setPendingPageLinkPickerRequest(request);
    setPageLinkPickerState(null);
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

  const applyGlobalHistory = useCallback(
    (nextHistory: MarkdownHistoryState) => {
      setHistory(nextHistory);
      setActiveBlockIndex(null);
      setActiveDraft("");
      setActiveDirty(false);
      setActiveTableDirty(false);
      setPendingActivation(null);
      setPendingTableActivation(null);
      setSelectedBlockSelection(null);
      setIsSelectionDragging(false);
      setDraggedBlockIndex(null);
      setDropIndicatorIndex(null);
      setInsertMenuState(null);
      setSelectionContextMenuState(null);
      setSelectionMarqueeRect(null);
      setPendingPageLinkPickerRequest(null);
      setPageLinkPickerState(null);
      setInlineFormattingToolbarSelection(null);
      setInlineFormattingToolbarMenu(null);
      setInlineFormattingToolbarLinkState(null);
      selectionGestureRef.current = null;
      suppressNextBlockContextMenuRef.current = false;
      pendingActivationMarkdownRef.current = null;
      activeTableSessionRef.current = null;
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
        setActiveDraft(nextRaw);
        setActiveDirty(false);
      }
      return true;
    },
    [activeBlockIndex, blocks, markdown, onChange, onCommit],
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
        return true;
      }
      const block = blocks[activeBlockIndex];
      if (block?.kind === "table") {
        const session = activeTableSessionRef.current;
        if (session?.blockIndex === activeBlockIndex && !session.flush()) {
          return false;
        }
        if (options?.deactivate ?? true) {
          setActiveBlockIndex(null);
          setActiveDraft("");
        }
        setActiveDirty(false);
        setActiveTableDirty(false);
        if (options?.nextActivation) {
          setPendingActivation(options.nextActivation);
        }
        return true;
      }
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
        return true;
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

      return true;
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
      if (activeBlockIndex !== null && activeBlockIndex !== nextIndex) {
        const currentBlock = blocks[activeBlockIndex];
        if (currentBlock?.kind === "table" && !commitActiveBlock({ deactivate: true })) {
          return;
        }
      }
      if (activeBlockIndex === nextIndex) {
        pendingCaretRef.current = caret;
        setActiveDraft(toEditorDraftForBlock(nextBlock));
        return;
      }
      pendingCaretRef.current = caret;
      setPendingTableActivation(null);
      setActiveBlockIndex(nextIndex);
      setActiveDraft(toEditorDraftForBlock(nextBlock));
      setActiveDirty(false);
      setActiveTableDirty(false);
    },
    [activeBlockIndex, blocks, commitActiveBlock, disabled],
  );

  const handleTableBlockRequestActivate = useCallback(
    (index: number, request?: MarkdownHybridTableActivationRequest) => {
      if (disabled) {
        return;
      }
      const nextIndex = clampIndex(index, blocks.length);
      const nextBlock = blocks[nextIndex];
      if (!nextBlock || nextBlock.kind !== "table") {
        return;
      }
      if (activeBlockIndex !== null && activeBlockIndex !== nextIndex) {
        const currentBlock = blocks[activeBlockIndex];
        if (currentBlock?.kind === "table" && !commitActiveBlock({ deactivate: true })) {
          return;
        }
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
      setActiveDraft(nextBlock.raw);
      setActiveDirty(false);
      setActiveTableDirty(false);
    },
    [activeBlockIndex, blocks, commitActiveBlock, disabled],
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
      const nextAnchorRect = getAnchorRectFromElement(event.currentTarget);
      setMathToolboxState((current) =>
        current && current.blockIndex === blockIndex
          ? null
          : {
            blockIndex,
            anchorRect: nextAnchorRect,
          });
      if (activeBlockIndex !== blockIndex) {
        activateBlock(blockIndex, "start");
      }
    },
    [activateBlock, activeBlockIndex, blocks, disabled],
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
      options?: {
        firstPlaceholder?: string;
        selection?: {
          start: number;
          end: number;
        };
      },
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
        } else if (options?.selection && primaryInsertedBlock.kind !== "hr") {
          activationSelection = options.selection;
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
    if (!mathToolboxState) {
      return;
    }

    const handleDocumentMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (mathToolboxRef.current?.contains(target)) {
        return;
      }
      if (target.closest("[data-md-math-toolbox-trigger='true']")) {
        return;
      }
      setMathToolboxState(null);
    };

    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMathToolboxState(null);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [mathToolboxState]);

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
      if (item.id === "page-link") {
        if (blocks.length === 0) {
          pendingCaretRef.current = "start";
          setActiveBlockIndex(0);
          setActiveDraft("");
          setActiveDirty(false);
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
      insertBlockRelativeTo(insertMenuState.blockIndex, item.template, insertMenuState.insertAbove, {
        firstPlaceholder: item.firstPlaceholder,
        selection: item.initialSelection,
      });
    },
    [blocks.length, insertBlockRelativeTo, insertEmptyParagraphRelativeTo, insertMenuState, requestPageLinkPickerOpen],
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
      const typedPageLinkTrigger = pageLinkPickerState
        ? null
        : detectTypedPageLinkTrigger(nextValue, selectionStart);
      if (activeBlock?.kind === "help-block") {
        nextValue = normalizeHelpBlockSource(nextValue);
      }
      if (blocks.length === 0 && activeBlockIndex === 0) {
        setActiveDraft(nextValue);
        setActiveDirty(true);
        if (nextValue !== markdown) {
          onChange(nextValue);
        }
        if (typedPageLinkTrigger) {
          requestPageLinkPickerOpen({
            source: "typed-trigger",
            replaceRange: typedPageLinkTrigger,
          });
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
        if (typedPageLinkTrigger) {
          requestPageLinkPickerOpen({
            source: "typed-trigger",
            replaceRange: typedPageLinkTrigger,
          });
        }
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
      if (typedPageLinkTrigger && canOpenPageLinkPickerInBlockKind(block.kind)) {
        requestPageLinkPickerOpen({
          source: "typed-trigger",
          replaceRange: typedPageLinkTrigger,
        });
      }
    },
    [
      activeBlockIndex,
      blocks,
      markdown,
      onChange,
      pageLinkPickerState,
      requestPageLinkPickerOpen,
    ],
  );

  const handleTextareaBlur = useCallback((event: FocusEvent<HTMLTextAreaElement>) => {
    const nextFocus = event.relatedTarget;
    if (nextFocus instanceof Node && pageLinkPickerRef.current?.contains(nextFocus)) {
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
    // Auto-grow to visible wrapped content so activating long paragraph lines
    // does not collapse the editor to the number of hard line breaks only.
    textarea.style.height = "auto";
    const nextHeight = Math.max(textarea.scrollHeight, 28);
    textarea.style.height = `${nextHeight}px`;
  }, []);

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
  }, [activeBlockIndex, blocks, disabled, pageLinkPickerState]);

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

  const handleMathToolboxTemplateSelect = useCallback(
    (template: MathToolboxTemplate) => {
      if (activeBlockIndex === null) {
        return;
      }
      const block = blocks[activeBlockIndex];
      if (!block || block.kind !== "math-block") {
        return;
      }
      const textarea = textareaRef.current;
      const defaultSelection = getMathBlockDefaultSelection(activeDraft);
      const selectionStart = textarea?.selectionStart ?? defaultSelection.start;
      const selectionEnd = textarea?.selectionEnd ?? defaultSelection.end;
      const result = insertMathTemplateIntoRaw(activeDraft, selectionStart, selectionEnd, template);
      const applied = applyActiveBlockDraft(result.value);
      if (!applied) {
        return;
      }
      scheduleTextareaSelectionRange(result.selection);
    },
    [activeBlockIndex, activeDraft, applyActiveBlockDraft, blocks, scheduleTextareaSelectionRange],
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
      const wrapper = INLINE_FORMATTING_WRAPPERS[action];
      const nextResult = toggleInlineFormattingWrapper(textarea.value, normalizedSelection, wrapper);
      return applyInlineFormattingToActiveSelection(nextResult);
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

    // First, unwrap styles that are directly around the current selection.
    const aroundSelectionActions: InlineFormattingToolbarAction[] = [
      "highlight",
      "strikethrough",
      "underline",
      "bold",
      "italic",
      "inline-code",
      "math",
    ];
    for (let iteration = 0; iteration < 4; iteration += 1) {
      let iterationChanged = false;

      const linkAtRange = findInlineMarkdownLinkAtRange(nextValue, nextRange);
      if (linkAtRange) {
        const linkResult = applyInlineMarkdownLink(nextValue, nextRange, "");
        if (linkResult.changed) {
          nextValue = linkResult.value;
          nextRange = normalizeInlineFormattingRange(linkResult.value, linkResult.selection);
          hasChanged = true;
          iterationChanged = true;
        }
      }

      for (const action of aroundSelectionActions) {
        const wrapper = INLINE_FORMATTING_WRAPPERS[action];
        if (!isInlineFormattingWrapperActive(nextValue, nextRange, wrapper)) {
          continue;
        }
        const toggleResult = toggleInlineFormattingWrapper(nextValue, nextRange, wrapper);
        if (!toggleResult.changed) {
          continue;
        }
        nextValue = toggleResult.value;
        nextRange = normalizeInlineFormattingRange(toggleResult.value, toggleResult.selection);
        hasChanged = true;
        iterationChanged = true;
      }

      if (!iterationChanged) {
        break;
      }
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
      const nextResult = applyInlineMarkdownLink(
        textarea.value,
        normalizedSelection,
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
      const isPlainEnter = event.key === "Enter" &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey;
      const isPlainDeleteKey = (event.key === "Backspace" || event.key === "Delete") &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey;

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

      if (event.key === "Escape" && inlineFormattingToolbarSelection) {
        event.preventDefault();
        event.stopPropagation();
        hideInlineFormattingToolbar();
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

      if (
        block.kind === "card-block" &&
        !hasSelection &&
        event.key.length === 1 &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        /[\p{L}\p{N}]/u.test(event.key)
      ) {
        const lines = activeDraft.split("\n");
        const endCardLineIndex = lines.findIndex((line) => line.trim().toLowerCase() === "#endcard");
        if (endCardLineIndex >= 0) {
          const endCardLine = lines[endCardLineIndex] ?? "";
          const directiveStartInLine = endCardLine.toLowerCase().indexOf("#endcard");
          if (directiveStartInLine >= 0) {
            const lineStart = getLineStartOffsetByIndex(lines, endCardLineIndex);
            const directiveEndOffset = lineStart + directiveStartInLine + "#endcard".length;
            const lineEndOffset = lineStart + endCardLine.length;
            const selectionOffset = textarea.selectionStart;
            if (selectionOffset >= directiveEndOffset && selectionOffset <= lineEndOffset) {
              event.preventDefault();
              event.stopPropagation();
              const cardRaw = lines.slice(0, endCardLineIndex + 1).join("\n");
              replaceActiveBlockWithSegments([cardRaw, event.key], {
                activateSegmentIndex: 1,
                caret: "end",
              });
              return;
            }
          }
        }
      }

      if (isPlainEnter && !event.shiftKey && block.kind === "math-block") {
        const selectionStart = textarea.selectionStart;
        const lineRange = getLineRangeAtOffset(activeDraft, selectionStart);
        const mathBoundaries = resolveMathBlockBoundaries(activeDraft);
        const isClosingDelimiterLine = mathBoundaries.hasClosingDelimiter &&
          lineRange.lineIndex === mathBoundaries.closingLineIndex &&
          isMathBlockDelimiterLine(lineRange.line);

        if (!hasSelection && isClosingDelimiterLine) {
          event.preventDefault();
          event.stopPropagation();
          replaceActiveBlockWithSegments(
            blocks[activeBlockIndex + 1]?.kind === "hr" ? [activeDraft, "", ""] : [activeDraft, ""],
            {
              activateSegmentIndex: 1,
              caret: "start",
            },
          );
        }
        return;
      }

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

      if (isPlainEnter && block.kind === "card-block") {
        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;
        const lines = activeDraft.split("\n");
        const endCardLineIndex = lines.findIndex((line) => line.trim().toLowerCase() === "#endcard");
        let shouldExitCard = false;

        if (endCardLineIndex >= 0 && !hasSelection) {
          const endCardLineStart = getLineStartOffsetByIndex(lines, endCardLineIndex);
          if (selectionStart >= endCardLineStart) {
            shouldExitCard = true;
          }
        }

        event.preventDefault();
        event.stopPropagation();

        if (shouldExitCard) {
          const cardRaw = lines.slice(0, endCardLineIndex + 1).join("\n");
          const trailingRaw = lines.slice(endCardLineIndex + 1).join("\n");
          const segments: string[] = [cardRaw];
          const activateSegmentIndex = 1;

          if (trailingRaw.length > 0) {
            segments.push(trailingRaw);
          } else {
            segments.push("");
            if (blocks[activeBlockIndex + 1]?.kind === "hr") {
              segments.push("");
            }
          }

          replaceActiveBlockWithSegments(segments, {
            activateSegmentIndex,
            caret: "start",
          });
          return;
        }

        const nextDraft = `${activeDraft.slice(0, selectionStart)}\n${activeDraft.slice(selectionEnd)}`;
        const nextCaret = selectionStart + 1;
        applyActiveBlockDraft(nextDraft, nextCaret);
        return;
      }

      if (isPlainEnter && block.kind === "blockquote") {
        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;
        const lineRange = getLineRangeAtOffset(activeDraft, selectionStart);
        const quoteLineInfo = parseEditorQuoteLine(lineRange.line);

        if (quoteLineInfo) {
          event.preventDefault();
          event.stopPropagation();

          if (!event.shiftKey && !hasSelection && quoteLineInfo.isEmpty) {
            const lines = activeDraft.split("\n");
            const lineIndex = lineRange.lineIndex;
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

          const nextDraft = `${activeDraft.slice(0, selectionStart)}\n${quoteLineInfo.continuationPrefix}${
            activeDraft.slice(selectionEnd)
          }`;
          const nextCaret = selectionStart + 1 + quoteLineInfo.continuationPrefix.length;
          applyActiveBlockDraft(nextDraft, nextCaret);
          return;
        }
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
      applyInlineFormattingAction,
      activeDirty,
      blocks,
      closePageLinkPicker,
      commitActiveBlock,
      handleGlobalRedo,
      handleGlobalUndo,
      hideInlineFormattingToolbar,
      inlineFormattingToolbarSelection,
      openInlineFormattingLinkEditor,
      pageLinkPickerState,
      replaceActiveBlockWithSegments,
      scheduleTextareaCaret,
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
    <FloatingMathToolbox
      anchorRect={mathToolboxState.anchorRect}
      toolboxRef={mathToolboxRef}
      onSelect={handleMathToolboxTemplateSelect}
      onClose={() => {
        setMathToolboxState(null);
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
                {block.kind === "table" ? (
                  <MarkdownHybridTableBlock
                    blockIndex={index}
                    raw={block.raw}
                    active={isActive}
                    disabled={disabled}
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
                      <div className="markdown-hybrid-math-editor-shell">
                        <textarea
                          ref={textareaRef}
                          className="markdown-hybrid-block-editor markdown-hybrid-math-editor"
                          value={activeDraft}
                          rows={Math.max(3, activeDraft.split("\n").length)}
                          onChange={(event) =>
                            handleTextareaChange(event.target.value, event.target.selectionStart)}
                          onBlur={handleTextareaBlur}
                          onKeyDown={handleTextareaKeyDown}
                          onKeyUp={handleTextareaKeyUp}
                          onSelect={handleTextareaSelect}
                          onMouseUp={handleTextareaPointerUp}
                          onScroll={handleTextareaScroll}
                          aria-label="Math block editor"
                        />
                      </div>
                    </div>
                  ) : (
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
                        ) : part.source.trim().length > 0 ? (
                          <div
                            key={`card-part:${index}:${partIndex}`}
                            className="markdown-hybrid-block-preview"
                          >
                            {renderPreviewWithPageLinks(part.source)}
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
      {mathToolboxPopup}
      {inlineFormattingToolbarPopup}
      {selectionContextMenu}
    </div>
  );
};
