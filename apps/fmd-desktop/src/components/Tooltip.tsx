import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  placement?: "top" | "bottom";
  openDelayMs?: number;
};

type TooltipPosition = {
  top: number;
  left: number;
};

export const Tooltip = ({
  content,
  children,
  placement = "top",
  openDelayMs = 0,
}: TooltipProps) => {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current === null || typeof window === "undefined") {
      return;
    }
    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  }, []);

  const openFromHover = useCallback(() => {
    clearOpenTimer();
    if (openDelayMs <= 0 || typeof window === "undefined") {
      setIsOpen(true);
      return;
    }
    openTimerRef.current = window.setTimeout(() => {
      setIsOpen(true);
      openTimerRef.current = null;
    }, openDelayMs);
  }, [clearOpenTimer, openDelayMs]);

  const closeTooltip = useCallback(() => {
    clearOpenTimer();
    setIsOpen(false);
  }, [clearOpenTimer]);
  const openFromFocus = useCallback(() => {
    clearOpenTimer();
    setIsOpen(true);
  }, [clearOpenTimer]);

  useEffect(
    () => () => {
      clearOpenTimer();
    },
    [clearOpenTimer],
  );

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor || typeof window === "undefined") {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setPosition({
      top:
        placement === "top"
          ? rect.top + window.scrollY
          : rect.bottom + window.scrollY,
      left: rect.left + window.scrollX + rect.width / 2,
    });
  }, [placement]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    updatePosition();
    const handleUpdate = () => updatePosition();
    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);
    return () => {
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <span
        ref={anchorRef}
        className="ui-tooltip-anchor"
        onMouseEnter={openFromHover}
        onMouseLeave={closeTooltip}
        onFocus={openFromFocus}
        onBlur={closeTooltip}
        aria-describedby={isOpen ? tooltipId : undefined}
      >
        {children}
      </span>
      {isOpen && position && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              className={`ui-tooltip ui-tooltip-${placement}`}
              style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
              }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
};
