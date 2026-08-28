/**
 * @file frontend/src/components/AnchoredPopup.tsx
 *
 * Zweck:
 * - Rendert ein verankertes Popup-Fenster mit Close-Handling.
 */

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";
import { CloseIcon } from "./icons";

type AnchoredPopupPlacement =
  | "bottom-start"
  | "bottom-end"
  | "right-start";
type AnchoredPopupMode = "anchored" | "centered";

type PopupPosition = {
  left: number;
  top: number;
};

type AnchoredPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  closeLayerId: string;
  ariaLabel?: string;
  placement?: AnchoredPopupPlacement;
  mode?: AnchoredPopupMode;
  showBackdrop?: boolean;
  className?: string;
  closeLayerPriority?: number;
  children: ReactNode;
};

const VIEWPORT_PADDING = 8;
const ANCHOR_OFFSET = 8;

const resolveTargetPosition = (
  placement: AnchoredPopupPlacement,
  anchorRect: DOMRect,
  popupRect: DOMRect,
) => {
  if (placement === "right-start") {
    return {
      left: anchorRect.right + ANCHOR_OFFSET,
      top: anchorRect.top,
    };
  }
  if (placement === "bottom-start") {
    return {
      left: anchorRect.left,
      top: anchorRect.bottom + ANCHOR_OFFSET,
    };
  }
  return {
    left: anchorRect.right - popupRect.width,
    top: anchorRect.bottom + ANCHOR_OFFSET,
  };
};

export const AnchoredPopup = ({
  isOpen,
  onClose,
  anchorRef,
  closeLayerId,
  ariaLabel = "Popup",
  placement = "bottom-end",
  mode = "anchored",
  showBackdrop = mode === "centered",
  className,
  closeLayerPriority = 230,
  children,
}: AnchoredPopupProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const isCenteredMode = mode === "centered";
  const [position, setPosition] = useState<PopupPosition | null>(null);
  const wasOpenRef = useRef(false);

  const updatePosition = useCallback(() => {
    const anchorElement = anchorRef.current;
    const panelElement = panelRef.current;
    if (!anchorElement || !panelElement || typeof window === "undefined") {
      setPosition(null);
      return;
    }
    const anchorRect = anchorElement.getBoundingClientRect();
    const popupRect = panelElement.getBoundingClientRect();
    const resolved = resolveTargetPosition(placement, anchorRect, popupRect);
    const maxLeft = window.innerWidth - popupRect.width - VIEWPORT_PADDING;
    const maxTop = window.innerHeight - popupRect.height - VIEWPORT_PADDING;
    const left = Math.max(VIEWPORT_PADDING, Math.min(maxLeft, resolved.left));
    const top = Math.max(VIEWPORT_PADDING, Math.min(maxTop, resolved.top));
    setPosition({
      left,
      top,
    });
  }, [anchorRef, placement]);

  useEffect(() => {
    if (!isOpen || isCenteredMode) {
      return;
    }
    if (!anchorRef.current) {
      onClose();
    }
  }, [anchorRef, isOpen, isCenteredMode, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    return registerCloseLayer({
      id: `anchored-popup-${closeLayerId}`,
      priority: closeLayerPriority,
      isActive: () => true,
      onClose,
    });
  }, [closeLayerId, closeLayerPriority, isOpen, onClose]);

  useLayoutEffect(() => {
    if (!isOpen || isCenteredMode) {
      return;
    }
    updatePosition();
  }, [children, isOpen, isCenteredMode, updatePosition]);

  useEffect(() => {
    if (!isOpen || isCenteredMode) {
      return;
    }
    const handleViewportUpdate = () => updatePosition();
    window.addEventListener("resize", handleViewportUpdate);
    window.addEventListener("scroll", handleViewportUpdate, true);
    return () => {
      window.removeEventListener("resize", handleViewportUpdate);
      window.removeEventListener("scroll", handleViewportUpdate, true);
    };
  }, [isOpen, isCenteredMode, updatePosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (panelRef.current?.contains(target)) {
        return;
      }
      if (anchorRef.current?.contains(target)) {
        return;
      }
      onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [anchorRef, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    closeButtonRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      anchorRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [anchorRef, isOpen]);

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || event.defaultPrevented) {
      return;
    }
    const panelElement = panelRef.current;
    if (!panelElement) {
      return;
    }
    const focusable = Array.from(
      panelElement.querySelectorAll<HTMLElement>(
        [
          "a[href]",
          "button:not([disabled])",
          "textarea:not([disabled])",
          "input:not([disabled])",
          "select:not([disabled])",
          "[tabindex]:not([tabindex='-1'])",
        ].join(","),
      ),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (!active || !panelElement.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const style = position
    ? {
      top: `${position.top}px`,
      left: `${position.left}px`,
    }
    : undefined;

  const popupPanel = (
    <div
      ref={panelRef}
      className={[
        "anchored-popup",
        isCenteredMode ? "anchored-popup-centered" : "",
        className,
      ].filter(Boolean).join(" ")}
      role="dialog"
      aria-modal={isCenteredMode ? "true" : "false"}
      aria-label={ariaLabel}
      style={isCenteredMode ? undefined : style}
      onKeyDown={handlePanelKeyDown}
      onMouseDown={isCenteredMode ? (event) => event.stopPropagation() : undefined}
    >
      <button
        ref={closeButtonRef}
        type="button"
        className="anchored-popup-close"
        onClick={onClose}
        aria-label="Close popup"
      >
        <CloseIcon />
      </button>
      <div className="anchored-popup-body">{children}</div>
    </div>
  );

  if (isCenteredMode && showBackdrop) {
    return createPortal(
      <div
        className="anchored-popup-backdrop"
        role="presentation"
        onMouseDown={onClose}
      >
        {popupPanel}
      </div>,
      document.body,
    );
  }

  return createPortal(popupPanel, document.body);
};
