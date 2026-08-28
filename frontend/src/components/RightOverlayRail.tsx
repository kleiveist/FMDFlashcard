/**
 * @file frontend/src/components/RightOverlayRail.tsx
 *
 * Zweck:
 * - Rendert eine rechte Overlay-Toolbar fuer kontextbezogene Zusatzaktionen.
 */

import {
  type AriaAttributes,
  type ReactNode,
  type Ref,
  useEffect,
  useMemo,
  useState,
} from "react";

const RAIL_EDGE_THRESHOLD_PX = 64;
const RAIL_HIDE_DELAY_MS = 180;

export type RightOverlayRailAction = {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  ariaHaspopup?: AriaAttributes["aria-haspopup"];
  ariaExpanded?: boolean;
};

type RightOverlayRailProps = {
  enabled: boolean;
  actions: RightOverlayRailAction[];
  pinned?: boolean;
  ariaLabel?: string;
  className?: string;
};

export const RightOverlayRail = ({
  enabled,
  actions,
  pinned = false,
  ariaLabel = "Quick actions",
  className,
}: RightOverlayRailProps) => {
  const [isNearEdge, setIsNearEdge] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const shouldShowRail =
    enabled &&
    (pinned || isNearEdge || isHovered || hasFocusWithin);

  useEffect(() => {
    if (enabled) {
      return;
    }
    setIsNearEdge(false);
    setIsHovered(false);
    setHasFocusWithin(false);
    setIsVisible(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }
    const handleMouseMove = (event: MouseEvent) => {
      const nextNearEdge =
        event.clientX >= window.innerWidth - RAIL_EDGE_THRESHOLD_PX;
      setIsNearEdge((current) =>
        current === nextNearEdge ? current : nextNearEdge,
      );
    };
    const handleMouseLeave = () => {
      setIsNearEdge(false);
    };
    const handleWindowBlur = () => {
      setIsNearEdge(false);
    };
    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [enabled]);

  useEffect(() => {
    if (shouldShowRail) {
      setIsVisible(true);
      return;
    }
    if (!isVisible) {
      return;
    }
    const timerId = window.setTimeout(() => {
      setIsVisible(false);
    }, RAIL_HIDE_DELAY_MS);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [isVisible, shouldShowRail]);

  const railClassName = useMemo(
    () =>
      [
        "right-overlay-rail",
        className,
        isVisible ? "is-visible" : "is-hidden",
      ]
        .filter(Boolean)
        .join(" "),
    [className, isVisible],
  );

  if (!enabled || actions.length === 0) {
    return null;
  }

  return (
    <aside
      className={railClassName}
      aria-label={ariaLabel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setHasFocusWithin(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
          setHasFocusWithin(false);
        }
      }}
    >
      <div className="right-overlay-rail-actions">
        {actions.map((action) => (
          <button
            key={action.id}
            ref={action.buttonRef}
            type="button"
            className={`ghost small right-overlay-rail-button${
              action.isActive ? " active" : ""
            }`}
            onClick={action.onClick}
            aria-label={action.label}
            aria-haspopup={action.ariaHaspopup}
            aria-expanded={
              typeof action.ariaExpanded === "boolean"
                ? action.ariaExpanded
                : undefined
            }
            title={action.label}
          >
            <span className="right-overlay-rail-icon" aria-hidden="true">
              {action.icon}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
};
