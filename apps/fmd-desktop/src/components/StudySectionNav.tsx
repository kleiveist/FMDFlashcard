/**
 * @file apps/fmd-desktop/src/components/StudySectionNav.tsx
 *
 * Zweck:
 * - Rendert die kompakte Studien-Sektion-Navigation.
 */

import {
  type ComponentType,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CardsIcon,
  CheckIcon,
  ExamEditorIcon,
  GaugeIcon,
  GridEventIcon,
  MarkdownIcon,
  MenuIcon,
  RefreshIcon,
  SettingsIcon,
} from "./icons";
import type { DashboardView } from "../pages/dashboardPreviewMode";
import type { StudySectionKey } from "../lib/studySections";

type StudySectionNavProps = {
  activeTab: StudySectionKey;
  activeDashboardView: DashboardView;
  onSectionSelect: (tab: StudySectionKey) => void;
  onDashboardViewSelect: (view: DashboardView) => void;
  isMobileNavOpen: boolean;
  onMobileNavOpen: () => void;
  showNoteAction?: boolean;
  onNoteAction?: () => void;
  noteActionRef?: RefObject<HTMLButtonElement | null>;
  isNoteActionActive?: boolean;
  showSettingsAction?: boolean;
  onSettingsAction?: () => void;
  settingsActionLabel?: string;
};

type PrimaryGroupKey = "editor" | "study" | "monitoring";

type SecondaryNavTarget =
  | { type: "dashboard-view"; view: DashboardView }
  | { type: "section"; key: StudySectionKey };

type SecondaryNavItem = {
  id: string;
  label: string;
  icon: ComponentType;
  target: SecondaryNavTarget;
};

const PRIMARY_GROUPS: Array<{
  key: PrimaryGroupKey;
  label: string;
  icon: ComponentType;
}> = [
  { key: "editor", label: "Editor", icon: GridEventIcon },
  { key: "study", label: "Study", icon: CardsIcon },
  { key: "monitoring", label: "Monitoring", icon: CheckIcon },
];

const SECONDARY_NAV_ITEMS: Record<PrimaryGroupKey, SecondaryNavItem[]> = {
  editor: [
    {
      id: "markdown-editor",
      label: "Markdown Editor",
      icon: MarkdownIcon,
      target: { type: "dashboard-view", view: "markdown" },
    },
    {
      id: "exam-editor",
      label: "Exam Editor",
      icon: ExamEditorIcon,
      target: { type: "dashboard-view", view: "exam" },
    },
  ],
  study: [
    {
      id: "exam",
      label: "Exam",
      icon: ExamEditorIcon,
      target: { type: "section", key: "exam" },
    },
    {
      id: "flashcard",
      label: "Flashcard",
      icon: CardsIcon,
      target: { type: "section", key: "flashcard" },
    },
    {
      id: "fast-flashcard",
      label: "Fast Flashcard",
      icon: GaugeIcon,
      target: { type: "section", key: "fast-flashcard" },
    },
    {
      id: "spaced-repetition",
      label: "Repetition",
      icon: RefreshIcon,
      target: { type: "section", key: "spaced-repetition" },
    },
  ],
  monitoring: [
    {
      id: "card-monitoring",
      label: "Card Monitoring",
      icon: GridEventIcon,
      target: { type: "section", key: "card-monitoring" },
    },
    {
      id: "points-profiles",
      label: "Points Profiles",
      icon: CheckIcon,
      target: { type: "section", key: "points-profiles" },
    },
    {
      id: "monitoring-rules",
      label: "Attribute Rules",
      icon: GaugeIcon,
      target: { type: "section", key: "monitoring-rules" },
    },
  ],
};

const getPrimaryGroupForTab = (tab: StudySectionKey): PrimaryGroupKey => {
  if (tab === "dashboard") {
    return "editor";
  }
  if (
    tab === "exam" ||
    tab === "flashcard" ||
    tab === "fast-flashcard" ||
    tab === "spaced-repetition"
  ) {
    return "study";
  }
  return "monitoring";
};

const useIconOnlyOverflow = (enabled: boolean, measurementSeed: string) => {
  const [isIconOnly, setIsIconOnly] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  const evaluateOverflow = useCallback(() => {
    const navElement = navRef.current;
    const measureElement = measureRef.current;
    if (!enabled || !navElement || !measureElement) {
      setIsIconOnly((prev) => (prev ? false : prev));
      return;
    }
    const availableWidth = navElement.clientWidth;
    const requiredWidth = measureElement.scrollWidth;
    const shouldUseIcons = requiredWidth > availableWidth + 1;
    setIsIconOnly((prev) => (prev === shouldUseIcons ? prev : shouldUseIcons));
  }, [enabled]);

  useLayoutEffect(() => {
    const navElement = navRef.current;
    const measureElement = measureRef.current;
    if (!enabled || !navElement || !measureElement) {
      setIsIconOnly((prev) => (prev ? false : prev));
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
  }, [enabled, evaluateOverflow, measurementSeed]);

  return { isIconOnly, navRef, measureRef };
};

export const StudySectionNav = ({
  activeTab,
  activeDashboardView,
  onSectionSelect,
  onDashboardViewSelect,
  isMobileNavOpen,
  onMobileNavOpen,
  showNoteAction = false,
  onNoteAction,
  noteActionRef,
  isNoteActionActive = false,
  showSettingsAction = false,
  onSettingsAction,
  settingsActionLabel = "Settings",
}: StudySectionNavProps) => {
  const derivedPrimaryGroup = useMemo(
    () => getPrimaryGroupForTab(activeTab),
    [activeTab],
  );
  const [activePrimaryGroup, setActivePrimaryGroup] =
    useState<PrimaryGroupKey>(derivedPrimaryGroup);
  const [isSecondaryVisible, setIsSecondaryVisible] = useState(false);
  const primaryGroupMeta = useMemo(
    () => PRIMARY_GROUPS.find((group) => group.key === activePrimaryGroup),
    [activePrimaryGroup],
  );
  const secondaryItems = useMemo(
    () => SECONDARY_NAV_ITEMS[activePrimaryGroup],
    [activePrimaryGroup],
  );
  const primaryOverflow = useIconOnlyOverflow(
    true,
    `${showNoteAction ? "primary-with-note" : "primary-without-note"}-${
      showSettingsAction ? "with-settings" : "without-settings"
    }`,
  );
  const secondaryOverflow = useIconOnlyOverflow(
    isSecondaryVisible,
    `${activePrimaryGroup}-${isSecondaryVisible ? "visible" : "hidden"}`,
  );
  const noteLabel = "Note";

  useEffect(() => {
    setActivePrimaryGroup(derivedPrimaryGroup);
  }, [derivedPrimaryGroup]);

  const isSecondaryItemActive = (item: SecondaryNavItem) => {
    if (item.target.type === "dashboard-view") {
      return activeTab === "dashboard" && activeDashboardView === item.target.view;
    }
    return activeTab === item.target.key;
  };

  const handlePrimarySelect = (group: PrimaryGroupKey) => {
    setActivePrimaryGroup(group);
    setIsSecondaryVisible(true);
  };

  const handleSecondarySelect = (item: SecondaryNavItem) => {
    if (item.target.type === "dashboard-view") {
      onDashboardViewSelect(item.target.view);
      return;
    }
    onSectionSelect(item.target.key);
  };

  return (
    <div className="study-section-nav-stack">
      <nav
        ref={primaryOverflow.navRef}
        className={`study-section-nav study-section-nav-primary ${
          primaryOverflow.isIconOnly ? "icon-only" : ""
        }`}
        aria-label="Study sections"
      >
        <button
          type="button"
          className="nav-item study-section-menu-toggle"
          onClick={onMobileNavOpen}
          aria-label="Open navigation"
          aria-controls="app-sidebar"
          aria-expanded={isMobileNavOpen}
        >
          <MenuIcon />
        </button>
        <div className="study-section-primary-group">
          {PRIMARY_GROUPS.map((group) => {
            const Icon = group.icon;
            const isActive = activePrimaryGroup === group.key;
            return (
              <button
                type="button"
                key={group.key}
                className={`nav-item study-section-tab study-section-main-tab ${
                  isActive ? "active" : ""
                }`}
                onClick={() => handlePrimarySelect(group.key)}
                aria-pressed={isActive}
                aria-expanded={isSecondaryVisible && activePrimaryGroup === group.key}
                aria-controls="study-sections-subnav"
                aria-label={primaryOverflow.isIconOnly ? group.label : undefined}
                title={primaryOverflow.isIconOnly ? group.label : undefined}
              >
                {primaryOverflow.isIconOnly ? <Icon /> : group.label}
              </button>
            );
          })}
        </div>
        {showNoteAction ? (
          <button
            ref={noteActionRef}
            type="button"
            className={`nav-item study-section-note-toggle ${
              isNoteActionActive ? "active" : ""
            }`}
            onClick={onNoteAction}
            aria-label="Open note"
            aria-haspopup="dialog"
            aria-expanded={isNoteActionActive}
            title={noteLabel}
          >
            <MarkdownIcon />
          </button>
        ) : null}
        {showSettingsAction ? (
          <button
            type="button"
            className="nav-item study-section-settings-toggle"
            onClick={onSettingsAction}
            aria-label={settingsActionLabel}
            title={settingsActionLabel}
          >
            <SettingsIcon />
          </button>
        ) : null}
      </nav>
      <div
        ref={primaryOverflow.measureRef}
        className="study-section-nav study-section-nav-measure study-section-nav-primary-measure"
        aria-hidden="true"
      >
        <span className="nav-item study-section-menu-toggle" aria-hidden="true">
          <MenuIcon />
        </span>
        <span className="study-section-primary-group" aria-hidden="true">
          {PRIMARY_GROUPS.map((group) => (
            <span
              key={group.key}
              className="nav-item study-section-tab study-section-main-tab"
            >
              {group.label}
            </span>
          ))}
        </span>
        {showNoteAction ? (
          <span className="nav-item study-section-note-toggle" aria-hidden="true">
            <MarkdownIcon />
          </span>
        ) : null}
        {showSettingsAction ? (
          <span className="nav-item study-section-settings-toggle" aria-hidden="true">
            <SettingsIcon />
          </span>
        ) : null}
      </div>
      {isSecondaryVisible ? (
        <nav
          id="study-sections-subnav"
          ref={secondaryOverflow.navRef}
          className={`study-section-nav study-section-nav-secondary ${
            secondaryOverflow.isIconOnly ? "icon-only" : ""
          }`}
          aria-label={`${primaryGroupMeta?.label ?? "Study"} subsection`}
        >
          {secondaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = isSecondaryItemActive(item);
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item study-section-tab study-section-secondary-tab ${
                  isActive ? "active" : ""
                }`}
                onClick={() => handleSecondarySelect(item)}
                aria-pressed={isActive}
                aria-label={secondaryOverflow.isIconOnly ? item.label : undefined}
                title={secondaryOverflow.isIconOnly ? item.label : undefined}
              >
                {secondaryOverflow.isIconOnly ? <Icon /> : item.label}
              </button>
            );
          })}
        </nav>
      ) : null}
      <div
        ref={secondaryOverflow.measureRef}
        className="study-section-nav study-section-nav-measure study-section-nav-secondary-measure"
        aria-hidden="true"
      >
        {secondaryItems.map((item) => (
          <span
            key={item.id}
            className="nav-item study-section-tab study-section-secondary-tab"
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
};
