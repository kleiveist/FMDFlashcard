/**
 * @file apps/fmd-desktop/src/components/StudySectionNav.tsx
 *
 * Zweck:
 * - Rendert die kompakte Studien-Sektion-Navigation.
 */

import {
  type ComponentType,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  CardsIcon,
  ExamEditorIcon,
  FolderIcon,
  GaugeIcon,
  RefreshIcon,
} from "./icons";
import { STUDY_SECTIONS, type StudySectionKey } from "../lib/studySections";

type StudySectionNavProps = {
  activeTab: StudySectionKey;
  onSectionSelect: (tab: StudySectionKey) => void;
};

const SECTION_ICONS: Record<StudySectionKey, ComponentType> = {
  dashboard: FolderIcon,
  exam: ExamEditorIcon,
  flashcard: CardsIcon,
  "fast-flashcard": GaugeIcon,
  "spaced-repetition": RefreshIcon,
};

export const StudySectionNav = ({
  activeTab,
  onSectionSelect,
}: StudySectionNavProps) => {
  const [isIconOnly, setIsIconOnly] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  const evaluateOverflow = useCallback(() => {
    const navElement = navRef.current;
    const measureElement = measureRef.current;
    if (!navElement || !measureElement) {
      return;
    }
    const availableWidth = navElement.clientWidth;
    const requiredWidth = measureElement.scrollWidth;
    const shouldUseIcons = requiredWidth > availableWidth + 1;
    setIsIconOnly((prev) => (prev === shouldUseIcons ? prev : shouldUseIcons));
  }, []);

  useLayoutEffect(() => {
    const navElement = navRef.current;
    const measureElement = measureRef.current;
    if (!navElement || !measureElement) {
      return;
    }

    let frame = 0;
    const scheduleMeasure = () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(evaluateOverflow);
    };

    scheduleMeasure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", scheduleMeasure);
      return () => {
        if (frame) {
          cancelAnimationFrame(frame);
        }
        window.removeEventListener("resize", scheduleMeasure);
      };
    }

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(navElement);
    observer.observe(measureElement);

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      observer.disconnect();
    };
  }, [evaluateOverflow]);

  return (
    <>
      <nav
        ref={navRef}
        className={`study-section-nav ${isIconOnly ? "icon-only" : ""}`}
        aria-label="Study sections"
      >
        {STUDY_SECTIONS.map((section) => {
          const isActive = activeTab === section.key;
          const Icon = SECTION_ICONS[section.key];
          return (
            <button
              key={section.key}
              type="button"
              className={`nav-item study-section-tab ${isActive ? "active" : ""}`}
              onClick={() => onSectionSelect(section.key)}
              aria-pressed={isActive}
              aria-label={isIconOnly ? section.label : undefined}
              title={isIconOnly ? section.label : undefined}
            >
              {isIconOnly ? <Icon /> : section.label}
            </button>
          );
        })}
      </nav>
      <div
        ref={measureRef}
        className="study-section-nav study-section-nav-measure"
        aria-hidden="true"
      >
        {STUDY_SECTIONS.map((section) => (
          <span key={section.key} className="nav-item study-section-tab">
            {section.label}
          </span>
        ))}
      </div>
    </>
  );
};
