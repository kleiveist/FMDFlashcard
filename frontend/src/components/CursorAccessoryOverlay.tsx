/**
 * @file apps/fmd-desktop/src/components/CursorAccessoryOverlay.tsx
 *
 * Zweck:
 * - Rendert eine globale Backspace-Hilfstaste als Overlay-Portal.
 *
 * Verantwortlichkeiten:
 * - Trackt das aktive editierbare Zielfeld ueber focusin/focusout.
 * - Positioniert die Taste rechts neben dem aktiven Feld.
 * - Haelt die Taste oberhalb aller Layer ohne Clipping.
 */

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  deleteBackwardAtTarget,
  focusTabletAccessoryTarget,
  resolveTabletAccessoryTarget,
  type TabletAccessoryTarget,
} from "../lib/tabletInputAccessory";

const CURSOR_ACCESSORY_LAYER_ID = "cursor-accessory-overlay-root";
const CURSOR_ACCESSORY_MAX_VISIBLE_VIEWPORT_WIDTH = 1600;
const CURSOR_ACCESSORY_MEDIUM_VIEWPORT_BREAKPOINT = 1200;
const CURSOR_ACCESSORY_SMALL_VIEWPORT_BREAKPOINT = 980;
const CURSOR_ACCESSORY_RESIZE_DEBOUNCE_MS = 100;
const CURSOR_ACCESSORY_BLUR_DELAY_MS = 120;
const CURSOR_ACCESSORY_OFFSET_X = 14;
const CURSOR_ACCESSORY_EDGE_PADDING = 8;

type CursorAccessoryViewportConfig = {
  isVisibleViewport: boolean;
  buttonSize: number;
  iconSize: number;
  borderRadius: number;
};

type CursorAccessoryButtonStyle = CSSProperties & {
  "--cursor-accessory-size"?: string;
  "--cursor-accessory-radius"?: string;
  "--cursor-accessory-icon-size"?: string;
};

const resolveCursorAccessoryViewportConfig = (
  width: number,
): CursorAccessoryViewportConfig => {
  if (width > CURSOR_ACCESSORY_MAX_VISIBLE_VIEWPORT_WIDTH) {
    return {
      isVisibleViewport: false,
      buttonSize: 32,
      iconSize: 16,
      borderRadius: 10,
    };
  }
  if (width > CURSOR_ACCESSORY_MEDIUM_VIEWPORT_BREAKPOINT) {
    return {
      isVisibleViewport: true,
      buttonSize: 32,
      iconSize: 16,
      borderRadius: 10,
    };
  }
  if (width > CURSOR_ACCESSORY_SMALL_VIEWPORT_BREAKPOINT) {
    return {
      isVisibleViewport: true,
      buttonSize: 48,
      iconSize: 22,
      borderRadius: 14,
    };
  }
  return {
    isVisibleViewport: true,
    buttonSize: 64,
    iconSize: 28,
    borderRadius: 18,
  };
};

type OverlayPosition = {
  left: number;
  top: number;
};

type CursorAccessoryOverlayProps = {
  enabled: boolean;
};

const resolveViewportBounds = () => {
  const viewport = window.visualViewport;
  return {
    left: viewport?.offsetLeft ?? 0,
    top: viewport?.offsetTop ?? 0,
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
};

const resolveSelectionCaretRect = (target: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!target.contains(range.startContainer) || !target.contains(range.endContainer)) {
    return null;
  }
  const caretRange = range.cloneRange();
  caretRange.collapse(false);
  const clientRects = caretRange.getClientRects();
  if (clientRects.length > 0) {
    return clientRects.item(clientRects.length - 1);
  }
  const rect = caretRange.getBoundingClientRect();
  if (!rect || (rect.width <= 0 && rect.height <= 0)) {
    return null;
  }
  return rect;
};

export const CursorAccessoryOverlay = ({
  enabled,
}: CursorAccessoryOverlayProps) => {
  const [overlayRoot, setOverlayRoot] = useState<HTMLElement | null>(null);
  const [activeTarget, setActiveTarget] = useState<TabletAccessoryTarget | null>(
    null,
  );
  const [position, setPosition] = useState<OverlayPosition | null>(null);
  const [viewportConfig, setViewportConfig] = useState(() => {
    if (typeof window === "undefined") {
      return resolveCursorAccessoryViewportConfig(CURSOR_ACCESSORY_SMALL_VIEWPORT_BREAKPOINT);
    }
    return resolveCursorAccessoryViewportConfig(window.innerWidth);
  });

  const blurTimerRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const createdRootRef = useRef<HTMLElement | null>(null);
  const overlayRootRef = useRef<HTMLElement | null>(null);
  const activeTargetRef = useRef<TabletAccessoryTarget | null>(null);
  const viewportConfigRef = useRef<CursorAccessoryViewportConfig>(viewportConfig);

  useEffect(() => {
    overlayRootRef.current = overlayRoot;
  }, [overlayRoot]);

  useEffect(() => {
    activeTargetRef.current = activeTarget;
  }, [activeTarget]);

  useEffect(() => {
    viewportConfigRef.current = viewportConfig;
  }, [viewportConfig]);

  const clearBlurTimer = useCallback(() => {
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  }, []);

  const syncTargetFromActiveElement = useCallback(() => {
    setActiveTarget(resolveTabletAccessoryTarget(document.activeElement));
  }, []);

  const syncOverlayPosition = useCallback(() => {
    const target = activeTargetRef.current;
    if (!target || !target.isConnected) {
      setPosition(null);
      return;
    }
    const resolvedTarget = resolveTabletAccessoryTarget(target);
    if (!resolvedTarget) {
      setPosition(null);
      return;
    }
    if (resolvedTarget !== target) {
      activeTargetRef.current = resolvedTarget;
      setActiveTarget(resolvedTarget);
    }

    const rect = resolvedTarget.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) {
      setPosition(null);
      return;
    }
    const caretRect =
      resolvedTarget instanceof HTMLInputElement ||
      resolvedTarget instanceof HTMLTextAreaElement
        ? null
        : resolveSelectionCaretRect(resolvedTarget);

    const viewport = resolveViewportBounds();
    const buttonSize = viewportConfigRef.current.buttonSize;
    const minLeft = viewport.left + CURSOR_ACCESSORY_EDGE_PADDING;
    const maxLeft =
      viewport.left +
      viewport.width -
      buttonSize -
      CURSOR_ACCESSORY_EDGE_PADDING;
    const minTop = viewport.top + CURSOR_ACCESSORY_EDGE_PADDING;
    const maxTop =
      viewport.top +
      viewport.height -
      buttonSize -
      CURSOR_ACCESSORY_EDGE_PADDING;
    const safeMaxLeft = Math.max(minLeft, maxLeft);
    const safeMaxTop = Math.max(minTop, maxTop);

    const nextLeft = Math.min(
      Math.max(rect.right + CURSOR_ACCESSORY_OFFSET_X, minLeft),
      safeMaxLeft,
    );
    const nextTop = Math.min(
      Math.max(
        (caretRect
          ? caretRect.top + caretRect.height / 2
          : rect.top + rect.height / 2) -
          buttonSize / 2,
        minTop,
      ),
      safeMaxTop,
    );

    const roundedLeft = Math.round(nextLeft);
    const roundedTop = Math.round(nextTop);
    setPosition((previous) => {
      if (
        previous &&
        previous.left === roundedLeft &&
        previous.top === roundedTop
      ) {
        return previous;
      }
      return {
        left: roundedLeft,
        top: roundedTop,
      };
    });
  }, []);

  const schedulePositionSync = useCallback(() => {
    if (scrollFrameRef.current !== null) {
      return;
    }
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      syncOverlayPosition();
    });
  }, [syncOverlayPosition]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const existingRoot = document.getElementById(CURSOR_ACCESSORY_LAYER_ID);
    if (existingRoot) {
      setOverlayRoot(existingRoot);
      return;
    }

    const createdRoot = document.createElement("div");
    createdRoot.id = CURSOR_ACCESSORY_LAYER_ID;
    document.body.appendChild(createdRoot);
    createdRootRef.current = createdRoot;
    setOverlayRoot(createdRoot);

    return () => {
      if (createdRootRef.current?.parentNode) {
        createdRootRef.current.parentNode.removeChild(createdRootRef.current);
      }
      createdRootRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      const targetNode = event.target instanceof Node ? event.target : null;
      if (targetNode && overlayRootRef.current?.contains(targetNode)) {
        return;
      }
      clearBlurTimer();
      setActiveTarget(resolveTabletAccessoryTarget(event.target));
    };

    const handleFocusOut = () => {
      clearBlurTimer();
      blurTimerRef.current = window.setTimeout(() => {
        blurTimerRef.current = null;
        syncTargetFromActiveElement();
      }, CURSOR_ACCESSORY_BLUR_DELAY_MS);
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    syncTargetFromActiveElement();

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      clearBlurTimer();
    };
  }, [clearBlurTimer, syncTargetFromActiveElement]);

  useEffect(() => {
    let resizeTimer: number | null = null;

    const applyViewportState = () => {
      const nextViewportConfig = resolveCursorAccessoryViewportConfig(window.innerWidth);
      viewportConfigRef.current = nextViewportConfig;
      setViewportConfig(nextViewportConfig);
      schedulePositionSync();
    };

    const handleResize = () => {
      if (resizeTimer !== null) {
        window.clearTimeout(resizeTimer);
      }
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        applyViewportState();
      }, CURSOR_ACCESSORY_RESIZE_DEBOUNCE_MS);
    };

    applyViewportState();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", schedulePositionSync, true);
    document.addEventListener("selectionchange", schedulePositionSync);
    document.addEventListener("input", schedulePositionSync, true);
    document.addEventListener("keyup", schedulePositionSync, true);

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", handleResize);
    viewport?.addEventListener("scroll", schedulePositionSync);

    return () => {
      if (resizeTimer !== null) {
        window.clearTimeout(resizeTimer);
      }
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", schedulePositionSync, true);
      document.removeEventListener("selectionchange", schedulePositionSync);
      document.removeEventListener("input", schedulePositionSync, true);
      document.removeEventListener("keyup", schedulePositionSync, true);
      viewport?.removeEventListener("resize", handleResize);
      viewport?.removeEventListener("scroll", schedulePositionSync);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [schedulePositionSync]);

  useEffect(() => {
    if (!activeTarget) {
      setPosition(null);
      return;
    }
    schedulePositionSync();
  }, [activeTarget, schedulePositionSync]);

  const isVisible = useMemo(
    () =>
      enabled &&
      viewportConfig.isVisibleViewport &&
      Boolean(activeTarget) &&
      position !== null,
    [activeTarget, enabled, position, viewportConfig.isVisibleViewport],
  );

  const buttonStyle = useMemo<CursorAccessoryButtonStyle | undefined>(() => {
    if (!position) {
      return undefined;
    }
    return {
      left: `${position.left}px`,
      top: `${position.top}px`,
      width: `${viewportConfig.buttonSize}px`,
      height: `${viewportConfig.buttonSize}px`,
      borderRadius: `${viewportConfig.borderRadius}px`,
      "--cursor-accessory-size": `${viewportConfig.buttonSize}px`,
      "--cursor-accessory-radius": `${viewportConfig.borderRadius}px`,
      "--cursor-accessory-icon-size": `${viewportConfig.iconSize}px`,
    };
  }, [position, viewportConfig.buttonSize, viewportConfig.borderRadius, viewportConfig.iconSize]);

  const handleButtonPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const target = activeTargetRef.current;
      if (!target || !target.isConnected) {
        return;
      }
      const selection = window.getSelection();
      const fallbackRange =
        selection && selection.rangeCount > 0
          ? selection.getRangeAt(0).cloneRange()
          : null;
      deleteBackwardAtTarget(target, { fallbackRange });

      focusTabletAccessoryTarget(target);

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const selectionStart = target.selectionStart;
        const selectionEnd = target.selectionEnd;
        if (selectionStart !== null && selectionEnd !== null) {
          target.setSelectionRange(selectionStart, selectionEnd);
        }
      }

      schedulePositionSync();
    },
    [schedulePositionSync],
  );

  if (!overlayRoot) {
    return null;
  }

  return createPortal(
    <div className="cursor-accessory-overlay" aria-hidden={!isVisible}>
      {isVisible ? (
        <button
          type="button"
          className="cursor-accessory-button"
          style={buttonStyle}
          onPointerDown={handleButtonPointerDown}
          aria-label="Backspace"
        >
          <svg className="cursor-accessory-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 7H10l-6 5 6 5h11V7z" />
            <path d="M12.5 10l4 4" />
            <path d="M16.5 10l-4 4" />
          </svg>
        </button>
      ) : null}
    </div>,
    overlayRoot,
  );
};
