import {
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type {
  InlineFormattingMathMenuAction,
  InlineFormattingToolbarAction,
  InlineFormattingToolbarActiveState,
} from "./inlineFormatting";

const INLINE_FORMATTING_TOOLBAR_VIEWPORT_PADDING_PX = 8;
const INLINE_FORMATTING_TOOLBAR_GAP_PX = 10;

export type InlineFormattingToolbarMenu = "more" | "math" | null;

export type InlineFormattingToolbarAnchor = {
  centerX: number;
  top: number;
  bottom: number;
};

export type InlineFormattingToolbarLinkState = {
  url: string;
  canRemove: boolean;
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
  onMathMenuAction: (action: InlineFormattingMathMenuAction) => void;
  onLinkUrlChange: (value: string) => void;
  onLinkSubmit: () => void;
  onLinkRemove: () => void;
  onLinkCancel: () => void;
};

const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M10.2 13.8L13.8 10.2M8.3 16.2l-2.5 2.5a3 3 0 104.2 4.2l2.5-2.5M15.7 7.8l2.5-2.5a3 3 0 00-4.2-4.2l-2.5 2.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const FloatingInlineFormattingToolbar = ({
  anchor,
  menu,
  linkState,
  activeState,
  toolbarRef,
  onClose,
  onToggleMenu,
  onAction,
  onMathMenuAction,
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
            <LinkIcon />
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
          onClick={() => onToggleMenu("math")}
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
      {menu === "math" ? (
        <div className="markdown-hybrid-inline-toolbar-menu" role="menu" aria-label="Inline math actions">
          <button
            type="button"
            className="markdown-hybrid-inline-toolbar-menu-item"
            role="menuitem"
            onMouseDown={handleButtonMouseDown}
            onClick={() => onMathMenuAction("wrap-inline")}
          >
            Mark as Inline Math
          </button>
          <button
            type="button"
            className="markdown-hybrid-inline-toolbar-menu-item"
            role="menuitem"
            onMouseDown={handleButtonMouseDown}
            onClick={() => onMathMenuAction("convert-inline-display")}
          >
            {"Convert Inline <-> Display"}
          </button>
          <button
            type="button"
            className="markdown-hybrid-inline-toolbar-menu-item"
            role="menuitem"
            onMouseDown={handleButtonMouseDown}
            onClick={() => onMathMenuAction("remove-marking")}
          >
            Remove Math Marking
          </button>
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
