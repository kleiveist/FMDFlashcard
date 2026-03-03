import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  placement?: "top" | "bottom";
};

type TooltipPosition = {
  top: number;
  left: number;
};

export const Tooltip = ({
  content,
  children,
  placement = "top",
}: TooltipProps) => {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

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
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
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
