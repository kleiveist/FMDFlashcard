/**
 * @file apps/fmd-desktop/src/pages/SettingsPage.tsx
 *
 * Zweck:
 * - Rendert die Seite Settings.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/AppStateProvider.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/components/settings/AppearanceSection.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/components/settings/ExamSettingsSection.tsx: UI-Komponente.
 *
 * Exportiert:
 * - SettingsPage: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAppState } from "../components/AppStateProvider";
import { AppearanceSection } from "../components/settings/AppearanceSection";
import {
  ExamSettingsPanel,
  ExamTogglesPanel,
} from "../components/settings/ExamSettingsSection";
import { FlashcardsSettingsSection } from "../components/settings/FlashcardsSettingsSection";
import { KeyboardShortcutsSection } from "../components/settings/KeyboardShortcutsSection";
import {
  ExamEditorSection,
  MarkdownEditorSection,
} from "../components/settings/MarkdownEditorSection";
import { ResetSessionHistoryModal } from "../components/settings/ResetSessionHistoryModal";
import {
  DataSyncSettingsView,
  ExportImportSettingsView,
  LanguageTabContent,
} from "../components/settings/DataSyncTabContent";
import { PerformanceTabContent } from "../components/settings/PerformanceTabContent";
import { SpacedRepetitionSettingsSection } from "../components/settings/SpacedRepetitionSettingsSection";
import { VaultIndexSection } from "../components/settings/VaultIndexSection";
import {
  AppearanceIcon,
  CardsIcon,
  ChevronDownIcon,
  ExamEditorIcon,
  FileIcon,
  FolderIcon,
  GaugeIcon,
  GlobeIcon,
  KeyboardIcon,
  RefreshIcon,
  SettingsIcon,
} from "../components/icons";
import { FAST_FLASHCARD_DURATIONS } from "../features/fast-flashcard/constants";
import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards";
import {
  SETTINGS_NAV_MODEL,
  type SettingsNavEntry,
  type SettingsNavIcon,
  type SettingsNavItem,
  type SettingsPageId,
  type SettingsSubPageId,
} from "../features/settings/settingsNavigation";
import {
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
} from "../features/spaced-repetition/useSpacedRepetition";
import { resetFastFlashcardHistory } from "./fast-flashcard/hooks/useFastSession";
import { resetExamRunHistory } from "../lib/examRuns";
import { useMediaQuery } from "../lib/useMediaQuery";
import {
  consumeSettingsFocusRequest,
  subscribeSettingsFocus,
  type SettingsFocusRequest,
} from "../features/settings/settingsDeepLink";

const SETTINGS_NAV_ICONS: Record<SettingsNavIcon, () => ReactElement> = {
  appearance: AppearanceIcon,
  markdown: FileIcon,
  "exam-editor": ExamEditorIcon,
  "exam-settings": SettingsIcon,
  "review-tools": CardsIcon,
  "keyboard-shortcuts": KeyboardIcon,
  language: GlobeIcon,
  performance: GaugeIcon,
  "vault-index": FolderIcon,
  "data-sync": RefreshIcon,
};

const SETTINGS_NAV_ITEMS = SETTINGS_NAV_MODEL.filter(
  (entry): entry is SettingsNavItem => entry.type === "item",
);

const buildDefaultSubPages = () => {
  const defaults: Partial<Record<SettingsPageId, SettingsSubPageId>> = {};
  SETTINGS_NAV_ITEMS.forEach((item) => {
    if (item.subPages && item.subPages.length > 0) {
      defaults[item.id] = item.subPages[0].id;
    }
  });
  return defaults;
};

type SettingsNavProps = {
  items: readonly SettingsNavEntry[];
  activeId: SettingsPageId;
  onSelect: (id: SettingsPageId) => void;
};

const SettingsNav = ({ items, activeId, onSelect }: SettingsNavProps) => (
  <nav className="settings-nav" aria-label="Settings sections">
    {items.map((entry, index) => {
      if (entry.type === "divider") {
        return (
          <div key={`settings-divider-${entry.label}-${index}`} className="settings-nav-divider">
            {entry.label}
          </div>
        );
      }
      const Icon = SETTINGS_NAV_ICONS[entry.icon];
      const isActive = activeId === entry.id;
      return (
        <button
          key={entry.id}
          type="button"
          className={`settings-nav-item ${isActive ? "active" : ""}`}
          onClick={() => onSelect(entry.id)}
          aria-current={isActive ? "page" : undefined}
        >
          <span className="settings-nav-icon">
            <Icon />
          </span>
          <span className="settings-nav-label">{entry.label}</span>
        </button>
      );
    })}
  </nav>
);

type SettingsMobileToolbarProps = {
  items: readonly SettingsNavEntry[];
  activeId: SettingsPageId;
  isOpen: boolean;
  toolbarId: string;
  onNavigate: (id: SettingsPageId) => void;
};

const SettingsMobileToolbar = ({
  items,
  activeId,
  isOpen,
  toolbarId,
  onNavigate,
}: SettingsMobileToolbarProps) => {
  const firstItemRef = useRef<HTMLButtonElement | null>(null);
  const firstItemId =
    items.find((entry): entry is SettingsNavItem => entry.type === "item")?.id ??
    null;

  useEffect(() => {
    if (!isOpen || !firstItemRef.current) {
      return;
    }
    firstItemRef.current.focus({ preventScroll: true });
  }, [isOpen]);

  return (
    <div id={toolbarId} className="settings-mobile-toolbar" hidden={!isOpen}>
      <nav className="settings-mobile-toolbar-nav" aria-label="Settings sections">
        {items.map((entry, index) => {
          if (entry.type === "divider") {
            return (
              <div
                key={`settings-mobile-divider-${entry.label}-${index}`}
                className="settings-nav-divider"
              >
                {entry.label}
              </div>
            );
          }
          const Icon = SETTINGS_NAV_ICONS[entry.icon];
          const isActive = activeId === entry.id;
          const isFirstItem = entry.id === firstItemId;
          return (
            <button
              key={entry.id}
              ref={isFirstItem ? firstItemRef : undefined}
              type="button"
              className={`settings-nav-item ${isActive ? "active" : ""}`}
              onClick={() => onNavigate(entry.id)}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="settings-nav-icon">
                <Icon />
              </span>
              <span className="settings-nav-label">{entry.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

type SettingsPanelProps = {
  activeItem: SettingsNavItem;
  activeSubPageId: SettingsSubPageId | null;
  onSubPageChange: (id: SettingsSubPageId) => void;
  actions?: ReactNode;
  children: ReactNode;
  mobileToolbar?: {
    items: readonly SettingsNavEntry[];
    activeId: SettingsPageId;
    isOpen: boolean;
    onToggle: () => void;
    onNavigate: (id: SettingsPageId) => void;
  };
};

const SettingsPanel = ({
  activeItem,
  activeSubPageId,
  onSubPageChange,
  actions,
  children,
  mobileToolbar,
}: SettingsPanelProps) => {
  const Icon = SETTINGS_NAV_ICONS[activeItem.icon];
  const title = activeItem.title ?? activeItem.label;
  const hasSubPages = Boolean(activeItem.subPages && activeItem.subPages.length > 1);
  const resolvedSubPageId =
    activeSubPageId ?? activeItem.subPages?.[0]?.id ?? null;
  const headingId = `settings-panel-title-${activeItem.id}`;
  const panelId = resolvedSubPageId
    ? `settings-subpage-${activeItem.id}-${resolvedSubPageId}`
    : `settings-page-${activeItem.id}`;
  const labelledBy = resolvedSubPageId
    ? `settings-subpage-tab-${activeItem.id}-${resolvedSubPageId}`
    : headingId;
  const mobileToolbarId = mobileToolbar
    ? `settings-mobile-toolbar-${activeItem.id}`
    : null;

  return (
    <section className="settings-panel" aria-labelledby={headingId}>
      <div className="settings-panel-header">
        <div className="settings-panel-title">
          <span className="settings-panel-icon">
            <Icon />
          </span>
          <div className="settings-panel-title-text">
            <h2 id={headingId} className="settings-panel-title-heading">
              {title}
            </h2>
            {mobileToolbar && mobileToolbarId ? (
              <button
                type="button"
                className="settings-section-header-btn"
                onClick={mobileToolbar.onToggle}
                aria-expanded={mobileToolbar.isOpen}
                aria-controls={mobileToolbarId}
              >
                <span className="settings-section-header-text">{title}</span>
                <span
                  className={`settings-section-header-chevron ${
                    mobileToolbar.isOpen ? "is-open" : ""
                  }`}
                  aria-hidden="true"
                >
                  <ChevronDownIcon />
                </span>
              </button>
            ) : null}
          </div>
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </div>
      {mobileToolbar && mobileToolbarId ? (
        <SettingsMobileToolbar
          toolbarId={mobileToolbarId}
          items={mobileToolbar.items}
          activeId={mobileToolbar.activeId}
          isOpen={mobileToolbar.isOpen}
          onNavigate={mobileToolbar.onNavigate}
        />
      ) : null}
      {hasSubPages ? (
        <div className="settings-tabs" role="tablist" aria-label={`${title} pages`}>
          {activeItem.subPages?.map((subPage) => {
            const isActive = resolvedSubPageId === subPage.id;
            return (
              <button
                key={subPage.id}
                type="button"
                className={`pill pill-button ${isActive ? "active" : ""}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`settings-subpage-${activeItem.id}-${subPage.id}`}
                id={`settings-subpage-tab-${activeItem.id}-${subPage.id}`}
                onClick={() => onSubPageChange(subPage.id)}
              >
                {subPage.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div
        className="settings-panel-body"
        id={panelId}
        role={hasSubPages ? "tabpanel" : "region"}
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </section>
  );
};

const clampInput = (value: string) => {
  if (value.trim() === "") {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const SettingsPage = () => {
  const {
    actions,
    flashcards,
    preview,
    settings,
    settingsNav,
    spacedRepetition,
    userVault,
    vault,
  } = useAppState();
  const { language, setLanguage } = settings;
  const lastOpenedFile = preview.selectedFile?.relative_path ?? null;
  const vaultIndexedComplete = useMemo(
    () => Boolean(vault.vaultPath) && vault.listState === "idle",
    [vault.listState, vault.vaultPath],
  );
  const handleLanguageChange = useCallback(
    (nextLanguage: "de" | "en") => {
      setLanguage(nextLanguage);
    },
    [setLanguage],
  );
  const [isResetHistoryOpen, setIsResetHistoryOpen] = useState(false);
  const [isResetHistoryPending, setIsResetHistoryPending] = useState(false);
  const [isResetExamStatsPending, setIsResetExamStatsPending] = useState(false);
  const { activeSettingsPage, setActiveSettingsPage } = settingsNav;
  const [activeSubPages, setActiveSubPages] = useState<
    Partial<Record<SettingsPageId, SettingsSubPageId>>
  >(() => buildDefaultSubPages());
  const isSmartMode = useMediaQuery("(max-width: 980px)", false);
  const [openToolbarSectionId, setOpenToolbarSectionId] = useState<
    SettingsPageId | null
  >(null);
  const [pendingFocusRequest, setPendingFocusRequest] =
    useState<SettingsFocusRequest | null>(null);
  const lastDurationRef = useRef<number>(
    settings.examDurationMinutes > 0 ? settings.examDurationMinutes : 30,
  );

  useEffect(() => {
    return subscribeSettingsFocus((request) => {
      setPendingFocusRequest(request);
    });
  }, []);

  useEffect(() => {
    if (!pendingFocusRequest) {
      return;
    }
    const request = pendingFocusRequest;
    if (activeSettingsPage !== request.pageId) {
      setActiveSettingsPage(request.pageId);
    }
    if (request.subPageId) {
      setActiveSubPages((prev) => ({
        ...prev,
        [request.pageId]: request.subPageId,
      }));
    }
    setPendingFocusRequest(null);
    consumeSettingsFocusRequest();

    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 6;
    const attemptFocus = () => {
      if (cancelled) {
        return;
      }
      attempt += 1;
      const focusTarget = request.focusSelector
        ? document.querySelector<HTMLElement>(request.focusSelector)
        : null;
      const scrollTarget = request.scrollSelector
        ? document.querySelector<HTMLElement>(request.scrollSelector)
        : null;
      const target = focusTarget ?? scrollTarget;
      if (!target) {
        if (attempt < maxAttempts) {
          window.setTimeout(attemptFocus, 90);
        }
        return;
      }
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      if (focusTarget) {
        focusTarget.focus({ preventScroll: true });
      }
      if (request.highlight !== false) {
        target.classList.add("settings-focus-highlight");
        window.setTimeout(() => {
          target.classList.remove("settings-focus-highlight");
        }, 2500);
      }
    };

    window.setTimeout(attemptFocus, 90);

    return () => {
      cancelled = true;
    };
  }, [activeSettingsPage, pendingFocusRequest, setActiveSettingsPage]);

  useEffect(() => {
    if (settings.examDurationMinutes > 0) {
      lastDurationRef.current = settings.examDurationMinutes;
    }
  }, [settings.examDurationMinutes]);

  const handleResetHistoryConfirm = useCallback(async () => {
    setIsResetHistoryPending(true);
    const success = await resetFastFlashcardHistory(userVault.activeProfilePath);
    setIsResetHistoryPending(false);
    if (success) {
      setIsResetHistoryOpen(false);
    }
  }, [setIsResetHistoryOpen, userVault.activeProfilePath, resetFastFlashcardHistory]);

  const handleResetExamStatistics = useCallback(async () => {
    setIsResetExamStatsPending(true);
    await resetExamRunHistory(userVault.activeProfilePath);
    setIsResetExamStatsPending(false);
  }, [resetExamRunHistory, userVault.activeProfilePath]);

  const handleExamDurationChange = useCallback(
    (value: string) => {
      const parsed = clampInput(value);
      const clamped = Math.min(240, Math.max(0, parsed));
      if (clamped > 0) {
        lastDurationRef.current = clamped;
      }
      settings.setExamDurationMinutes(clamped);
    },
    [settings.setExamDurationMinutes],
  );

  const handleExamTimeLimitToggle = useCallback(
    (nextEnabled: boolean) => {
      settings.setExamTimeLimitEnabled(nextEnabled);
      if (nextEnabled && settings.examDurationMinutes === 0) {
        const nextDuration =
          lastDurationRef.current > 0 ? lastDurationRef.current : 30;
        settings.setExamDurationMinutes(nextDuration);
      }
    },
    [
      settings.examDurationMinutes,
      settings.setExamDurationMinutes,
      settings.setExamTimeLimitEnabled,
    ],
  );

  const activeItem =
    SETTINGS_NAV_ITEMS.find((item) => item.id === activeSettingsPage) ??
    SETTINGS_NAV_ITEMS[0];
  const activeSubPageId =
    activeItem?.subPages && activeItem.subPages.length > 0
      ? activeSubPages[activeItem.id] ?? activeItem.subPages[0].id
      : null;

  const handleSubPageChange = useCallback(
    (subPageId: SettingsSubPageId) => {
      if (!activeItem) {
        return;
      }
      setActiveSubPages((prev) => ({ ...prev, [activeItem.id]: subPageId }));
    },
    [activeItem],
  );

  const handleMobileToolbarToggle = useCallback((sectionId: SettingsPageId) => {
    setOpenToolbarSectionId((prev) => (prev === sectionId ? null : sectionId));
  }, []);

  const handleMobileNavigate = useCallback(
    (nextId: SettingsPageId) => {
      setActiveSettingsPage(nextId);
      setOpenToolbarSectionId(null);
    },
    [setActiveSettingsPage],
  );

  useEffect(() => {
    setOpenToolbarSectionId(null);
  }, [activeSettingsPage]);

  const headerActions = (
    <button
      type="button"
      className="primary"
      onClick={actions.handleOpenVaultManager}
    >
      Manage Vaults
    </button>
  );

  const renderSettingsContent = () => {
    switch (activeItem.id) {
      case "appearance":
        return (
          <div className="settings-page settings-single-column">
            <AppearanceSection
              accentColor={settings.accentColor}
              accentDraft={settings.accentDraft}
              accentError={settings.accentError}
              onAccentInputChange={actions.handleAccentInputChange}
              onAccentPick={actions.handleAccentPick}
              onCopyAccent={actions.handleCopyAccent}
              onThemeToggle={actions.handleThemeChange}
              theme={settings.theme}
            />
          </div>
        );
      case "markdown-editor":
        return (
          <div className="settings-page settings-single-column">
            <MarkdownEditorSection
              markdownEditorAccentEnabled={settings.markdownEditorAccentEnabled}
              markdownEditorAccentLightHex={settings.markdownEditorAccentLightHex}
              markdownEditorAccentDarkHex={settings.markdownEditorAccentDarkHex}
              markdownEditorAccentCustomSwatches={
                settings.markdownEditorAccentCustomSwatches
              }
              editorBlueprintGrid={settings.editorBlueprintGrid}
              editorBlueprintGridIntensity={settings.editorBlueprintGridIntensity}
              markdownViewEditEnabled={settings.markdownViewEditEnabled}
              markdownPreviewDefaultMode={settings.markdownPreviewDefaultMode}
              onMarkdownEditorAccentEnabledToggle={
                settings.setMarkdownEditorAccentEnabled
              }
              onMarkdownEditorAccentHexChange={settings.setMarkdownEditorAccentHex}
              onMarkdownEditorAccentCustomSwatchAdd={
                settings.addMarkdownEditorAccentCustomSwatch
              }
              onEditorBlueprintGridToggle={settings.setEditorBlueprintGrid}
              onEditorBlueprintGridIntensityChange={
                settings.setEditorBlueprintGridIntensity
              }
              onMarkdownViewEditToggle={settings.setMarkdownViewEditEnabled}
              onMarkdownPreviewDefaultModeChange={
                settings.setMarkdownPreviewDefaultMode
              }
            />
          </div>
        );
      case "exam-editor":
        return (
          <div className="settings-page settings-single-column">
            <ExamEditorSection
              examEditorShowMoveButtons={settings.examEditorShowMoveButtons}
              onExamEditorShowMoveButtonsToggle={settings.setExamEditorShowMoveButtons}
            />
          </div>
        );
      case "exam-settings":
        return (
          <div className="settings-page settings-single-column">
            {activeSubPageId === "exam-toggles" ? (
              <ExamTogglesPanel
                timeLimitEnabled={settings.examTimeLimitEnabled}
                showTimeline={settings.examShowTimeline}
                helpEnabled={settings.examHelpEnabled}
                autoCardsEnabled={settings.examAutoCardsEnabled}
                autoCardsReturnOnCorrect={settings.examAutoCardsReturnOnCorrect}
                aiEvaluation={settings.examAiEvaluation}
                onTimeLimitToggle={handleExamTimeLimitToggle}
                setShowTimeline={settings.setExamShowTimeline}
                setHelpEnabled={settings.setExamHelpEnabled}
                setAutoCardsEnabled={settings.setExamAutoCardsEnabled}
                setAutoCardsReturnOnCorrect={settings.setExamAutoCardsReturnOnCorrect}
              />
            ) : (
              <ExamSettingsPanel
                maxTotalPoints={settings.examMaxTotalPoints}
                taskCount={settings.examTaskCount}
                taskPoints={settings.examTaskPoints.slice(0, settings.examTaskCount)}
                durationMinutes={settings.examDurationMinutes}
                resetStatisticsPending={isResetExamStatsPending}
                setMaxTotalPoints={settings.setExamMaxTotalPoints}
                setTaskCount={settings.setExamTaskCount}
                setTaskPoints={settings.setExamTaskPoints}
                onDurationChange={handleExamDurationChange}
                onResetStatistics={handleResetExamStatistics}
              />
            )}
          </div>
        );
      case "review-tools":
        return (
          <div className="settings-page settings-single-column">
            {activeSubPageId === "fast-flashcard-tools" ? (
              <section className="panel fast-flashcard-tools-panel">
                <div className="panel-header">
                  <div>
                    <h2>Fast Flashcard Tools</h2>
                    <p className="muted">Control fast flashcard ordering rules.</p>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="setting-row">
                    <span className="label">DEFAULT ORDER</span>
                    <div className="pill-grid">
                      <button
                        type="button"
                        className={`pill pill-button ${
                          settings.fastFlashcardOrder === "in-order" ? "active" : ""
                        }`}
                        aria-pressed={settings.fastFlashcardOrder === "in-order"}
                        onClick={() => settings.setFastFlashcardOrder("in-order")}
                      >
                        In order
                      </button>
                      <button
                        type="button"
                        className={`pill pill-button ${
                          settings.fastFlashcardOrder === "random" ? "active" : ""
                        }`}
                        aria-pressed={settings.fastFlashcardOrder === "random"}
                        onClick={() => settings.setFastFlashcardOrder("random")}
                      >
                        Random
                      </button>
                    </div>
                  </div>
                  <div className="setting-row">
                    <span className="label">MODE</span>
                    <select
                      className="text-input"
                      value={settings.fastFlashcardMode}
                      onChange={(event) =>
                        settings.setFastFlashcardMode(
                          event.target.value as typeof settings.fastFlashcardMode,
                        )
                      }
                      aria-label="Select mode filter"
                    >
                      <option value="all">All</option>
                      <option value="qa">Q&amp;A</option>
                      <option value="multiple-choice">Multiple Choice</option>
                      <option value="fill-blank">Fill-in-the-blank</option>
                      <option value="assignment">Assignment</option>
                      <option value="true-false">True/False</option>
                      <option value="mix">Mix</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <span className="label">DURATION</span>
                    <div className="pill-grid">
                      {FAST_FLASHCARD_DURATIONS.map((duration) => (
                        <button
                          key={duration}
                          type="button"
                          className={`pill pill-button ${
                            settings.fastFlashcardDuration === duration ? "active" : ""
                          }`}
                          aria-pressed={settings.fastFlashcardDuration === duration}
                          onClick={() => settings.setFastFlashcardDuration(duration)}
                        >
                          {duration}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="setting-row">
                    <span className="label">DEFAULT SCOPE</span>
                    <div className="pill-grid">
                      <button
                        type="button"
                        className={`pill pill-button ${
                          settings.fastFlashcardScope === "current" ? "active" : ""
                        }`}
                        aria-pressed={settings.fastFlashcardScope === "current"}
                        onClick={() => settings.setFastFlashcardScope("current")}
                      >
                        Current note
                      </button>
                      <button
                        type="button"
                        className={`pill pill-button ${
                          settings.fastFlashcardScope === "vault" ? "active" : ""
                        }`}
                        aria-pressed={settings.fastFlashcardScope === "vault"}
                        onClick={() => settings.setFastFlashcardScope("vault")}
                      >
                        Whole vault
                      </button>
                    </div>
                  </div>
                  <div className="setting-row">
                    <span className="label">HELP / HINTS</span>
                    <div className="setting-inline">
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={settings.fastFlashcardHelpEnabled}
                          onChange={(event) =>
                            settings.setFastFlashcardHelpEnabled(event.target.checked)
                          }
                        />
                        <span className="slider" />
                      </label>
                      <span className="muted">
                        {settings.fastFlashcardHelpEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <span className="label">SESSION HISTORY</span>
                    <div className="setting-actions">
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => setIsResetHistoryOpen(true)}
                      >
                        Reset history
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ) : activeSubPageId === "spaced-repetition-tools" ? (
              <SpacedRepetitionSettingsSection
                spacedRepetitionBoxes={spacedRepetition.spacedRepetitionBoxes}
                spacedRepetitionBoxOptions={SPACED_REPETITION_BOXES}
                spacedRepetitionOrder={spacedRepetition.spacedRepetitionOrder}
                spacedRepetitionPageSize={spacedRepetition.spacedRepetitionPageSize}
                spacedRepetitionPageSizes={SPACED_REPETITION_PAGE_SIZES}
                spacedRepetitionRepetitionStrength={
                  spacedRepetition.spacedRepetitionRepetitionStrength
                }
                setSpacedRepetitionBoxes={spacedRepetition.setSpacedRepetitionBoxes}
                setSpacedRepetitionOrder={spacedRepetition.setSpacedRepetitionOrder}
                setSpacedRepetitionPageSize={spacedRepetition.setSpacedRepetitionPageSize}
                setSpacedRepetitionRepetitionStrength={
                  spacedRepetition.setSpacedRepetitionRepetitionStrength
                }
                helpEnabled={settings.spacedRepetitionHelpEnabled}
                setHelpEnabled={settings.setSpacedRepetitionHelpEnabled}
                flashcardMode={settings.flashcardMode}
                setFlashcardMode={settings.setFlashcardMode}
              />
            ) : (
              <FlashcardsSettingsSection
                flashcardMode={flashcards.flashcardMode}
                flashcardOrder={flashcards.flashcardOrder}
                flashcardPageSize={flashcards.flashcardPageSize}
                flashcardPageSizes={FLASHCARD_PAGE_SIZES}
                flashcardScope={flashcards.flashcardScope}
                setFlashcardMode={flashcards.setFlashcardMode}
                setFlashcardOrder={flashcards.setFlashcardOrder}
                setFlashcardPageSize={flashcards.setFlashcardPageSize}
                setFlashcardScope={flashcards.setFlashcardScope}
                setStatsResetMode={flashcards.setStatsResetMode}
                statsResetMode={flashcards.statsResetMode}
                helpEnabled={settings.flashcardHelpEnabled}
                setHelpEnabled={settings.setFlashcardHelpEnabled}
              />
            )}
          </div>
        );
      case "keyboard-shortcuts":
        return (
          <div className="settings-page settings-single-column">
            <KeyboardShortcutsSection
              keyboardShortcuts={settings.keyboardShortcuts}
              setKeyboardShortcuts={settings.setKeyboardShortcuts}
            />
          </div>
        );
      case "language":
        return (
          <div className="settings-page settings-single-column">
            <section className="panel settings-language-panel">
              <div className="panel-header">
                <div>
                  <h2>Language Pages</h2>
                  <p className="muted">Set the app language.</p>
                </div>
              </div>
              <div className="panel-body">
                <LanguageTabContent
                  language={language}
                  onLanguageChange={handleLanguageChange}
                />
              </div>
            </section>
          </div>
        );
      case "performance":
        return (
          <div className="settings-page settings-single-column">
            <section className="panel settings-performance-panel">
              <div className="panel-header">
                <div>
                  <h2>Performance</h2>
                  <p className="muted">Tune vault scans for larger libraries.</p>
                </div>
              </div>
              <div className="panel-body">
                <PerformanceTabContent
                  maxFilesPerScan={settings.maxFilesPerScan}
                  onMaxFilesPerScanChange={actions.handleMaxFilesPerScanChange}
                  scanParallelism={settings.scanParallelism}
                  setScanParallelism={settings.setScanParallelism}
                />
              </div>
            </section>
          </div>
        );
      case "vault-index":
        return (
          <div className="settings-page settings-single-column">
            <VaultIndexSection
              lastOpenedFile={lastOpenedFile}
              listState={vault.listState}
              listError={vault.listError}
              lastRefreshAt={vault.lastRefreshAt}
              onCopyVaultPath={actions.handleCopyVaultPath}
              onShowHiddenFoldersToggle={settings.setShowHiddenFolders}
              onShowEmptyFoldersToggle={settings.setShowEmptyFolders}
              onRescanVault={actions.handleRescanVault}
              onResetIndex={actions.handleResetIndex}
              vaultIndexedComplete={vaultIndexedComplete}
              showHiddenFolders={settings.showHiddenFolders}
              showEmptyFolders={settings.showEmptyFolders}
              vaultPath={vault.vaultPath}
            />
          </div>
        );
      case "data-sync":
        return (
          <div className="settings-page settings-single-column">
            <div className="settings-tab-content">
              {activeSubPageId === "export-import" ? (
                <ExportImportSettingsView userVault={userVault} />
              ) : (
                <DataSyncSettingsView
                  userVault={userVault}
                  spacedRepetition={spacedRepetition}
                />
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (!activeItem) {
    return null;
  }

  return (
    <>
      <div className="settings-layout">
        {!isSmartMode ? (
          <SettingsNav
            items={SETTINGS_NAV_MODEL}
            activeId={activeSettingsPage}
            onSelect={setActiveSettingsPage}
          />
        ) : null}
        <SettingsPanel
          activeItem={activeItem}
          activeSubPageId={activeSubPageId}
          onSubPageChange={handleSubPageChange}
          actions={headerActions}
          mobileToolbar={
            isSmartMode
              ? {
                  items: SETTINGS_NAV_MODEL,
                  activeId: activeSettingsPage,
                  isOpen: openToolbarSectionId === activeItem.id,
                  onToggle: () => handleMobileToolbarToggle(activeItem.id),
                  onNavigate: handleMobileNavigate,
                }
              : undefined
          }
        >
          {renderSettingsContent()}
        </SettingsPanel>
      </div>
      <ResetSessionHistoryModal
        isOpen={isResetHistoryOpen}
        isPending={isResetHistoryPending}
        onCancel={() => setIsResetHistoryOpen(false)}
        onConfirm={handleResetHistoryConfirm}
      />
    </>
  );
};
