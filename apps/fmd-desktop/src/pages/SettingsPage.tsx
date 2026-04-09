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
  AutoCardsSettingsPanel,
  ExamTaskTypeDefaultsPanel,
  ExamTogglesPanel,
} from "../components/settings/ExamSettingsSection";
import { FlashcardsSettingsSection } from "../components/settings/FlashcardsSettingsSection";
import { InputDebugSection } from "../components/settings/InputDebugSection";
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
  ExamEditorIcon,
  FileIcon,
  FolderIcon,
  GaugeIcon,
  GlobeIcon,
  KeyboardIcon,
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
  resolveSettingsNavModel,
  tSettings,
} from "../features/settings/settingsI18n";
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
};

const SETTINGS_NAV_ITEMS = SETTINGS_NAV_MODEL.filter(
  (entry): entry is SettingsNavItem => entry.type === "item",
);
const SETTINGS_COMPACT_BP = 1200;

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

type SettingsPanelProps = {
  activeItem: SettingsNavItem;
  activeSubPageId: SettingsSubPageId | null;
  onSubPageChange: (id: SettingsSubPageId) => void;
  actions?: ReactNode;
  children: ReactNode;
  compactMode?: boolean;
  onBack?: () => void;
};

const SettingsPanel = ({
  activeItem,
  activeSubPageId,
  onSubPageChange,
  actions,
  children,
  compactMode = false,
  onBack,
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
            {compactMode && onBack ? (
              <button
                type="button"
                className="settings-section-header-btn settings-section-back-btn"
                onClick={onBack}
                aria-label={`Back to settings list from ${title}`}
              >
                <span className="settings-section-header-text">{title}</span>
              </button>
            ) : null}
          </div>
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </div>
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
                aria-current={isActive ? "page" : undefined}
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
  const localizedNavModel = useMemo(
    () => resolveSettingsNavModel(language),
    [language],
  );
  const localizedNavItems = useMemo(
    () =>
      localizedNavModel.filter(
        (entry): entry is SettingsNavItem => entry.type === "item",
      ),
    [localizedNavModel],
  );
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
  const isCompactSettings = useMediaQuery(
    `(max-width: ${SETTINGS_COMPACT_BP - 0.02}px)`,
    false,
  );
  const [compactActiveSectionId, setCompactActiveSectionId] = useState<
    SettingsPageId | null
  >(null);
  const [pendingFocusRequest, setPendingFocusRequest] =
    useState<SettingsFocusRequest | null>(null);

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
    if (isCompactSettings) {
      setCompactActiveSectionId(request.pageId);
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
  }, [
    activeSettingsPage,
    isCompactSettings,
    pendingFocusRequest,
    setActiveSettingsPage,
  ]);

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

  const handleExamTimeLimitToggle = useCallback(
    (nextEnabled: boolean) => {
      settings.setExamTimeLimitEnabled(nextEnabled);
    },
    [settings.setExamTimeLimitEnabled],
  );

  const handleExamTaskTypeDefaultPointChange = useCallback(
    (type: keyof typeof settings.examTaskTypeDefaultPoints, value: string) => {
      const parsed = Number.parseInt(value, 10);
      const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      settings.setExamTaskTypeDefaultPoint(type, normalized);
    },
    [settings.setExamTaskTypeDefaultPoint],
  );

  const handleExamTaskTypeDefaultTimeSecondsChange = useCallback(
    (type: keyof typeof settings.examTaskTypeDefaultTimeSeconds, value: string) => {
      const parsed = Number.parseInt(value, 10);
      const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      settings.setExamTaskTypeDefaultTimeSeconds(type, normalized);
    },
    [settings.setExamTaskTypeDefaultTimeSeconds],
  );

  const activeItem =
    localizedNavItems.find((item) => item.id === activeSettingsPage) ??
    localizedNavItems[0];
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

  const handleSettingsSelect = useCallback(
    (nextId: SettingsPageId) => {
      setActiveSettingsPage(nextId);
      if (isCompactSettings) {
        setCompactActiveSectionId(nextId);
      }
    },
    [isCompactSettings, setActiveSettingsPage],
  );

  const handleCompactBack = useCallback(() => {
    setCompactActiveSectionId(null);
  }, []);

  const previousCompactModeRef = useRef(isCompactSettings);
  const previousActiveSettingsPageRef = useRef(activeSettingsPage);

  useEffect(() => {
    const compactModeChanged = previousCompactModeRef.current !== isCompactSettings;
    const activePageChanged =
      previousActiveSettingsPageRef.current !== activeSettingsPage;

    if (compactModeChanged && isCompactSettings) {
      setCompactActiveSectionId(activeSettingsPage);
    } else if (isCompactSettings && activePageChanged) {
      setCompactActiveSectionId(activeSettingsPage);
    }

    previousCompactModeRef.current = isCompactSettings;
    previousActiveSettingsPageRef.current = activeSettingsPage;
  }, [activeSettingsPage, isCompactSettings]);

  const headerActions = (
    <button
      type="button"
      className="primary"
      onClick={actions.handleOpenVaultManager}
    >
      {tSettings(language, "settings.page.manageVaults")}
    </button>
  );
  const profileSetupVaultSelection = useMemo(
    () => ({
      activeVaultPath: vault.vaultPath,
      recentVaultPaths: settings.recentVaults.map((entry) => entry.path),
      onSelectVault: actions.handleSwitchVault,
      onPickVault: actions.handlePickVault,
      isVaultBusy: vault.listState === "loading",
    }),
    [
      actions.handlePickVault,
      actions.handleSwitchVault,
      settings.recentVaults,
      vault.listState,
      vault.vaultPath,
    ],
  );

  const renderSettingsContent = () => {
    switch (activeItem.id) {
      case "appearance":
        return (
          <div className="settings-page settings-single-column">
            <AppearanceSection
              language={language}
              accentColor={settings.accentColor}
              accentDraft={settings.accentDraft}
              accentError={settings.accentError}
              onAccentInputChange={actions.handleAccentInputChange}
              onAccentPick={actions.handleAccentPick}
              onCopyAccent={actions.handleCopyAccent}
              markdownEditorAccentEnabled={settings.markdownEditorAccentEnabled}
              markdownEditorAccentLightHex={settings.markdownEditorAccentLightHex}
              markdownEditorAccentDarkHex={settings.markdownEditorAccentDarkHex}
              editorBlueprintGrid={settings.editorBlueprintGrid}
              editorBlueprintGridIntensity={settings.editorBlueprintGridIntensity}
              onMarkdownEditorAccentEnabledToggle={
                settings.setMarkdownEditorAccentEnabled
              }
              onMarkdownEditorAccentHexChange={settings.setMarkdownEditorAccentHex}
              onEditorBlueprintGridToggle={settings.setEditorBlueprintGrid}
              onEditorBlueprintGridIntensityChange={
                settings.setEditorBlueprintGridIntensity
              }
              onDesignModeChange={actions.handleDesignModeChange}
              onThemeToggle={actions.handleThemeChange}
              designMode={settings.designMode}
              theme={settings.theme}
            />
          </div>
        );
      case "markdown-editor":
        return (
          <div className="settings-page settings-single-column">
            <MarkdownEditorSection
              language={language}
              cursorAccessoryEnabled={settings.cursorAccessoryEnabled}
              markdownPreviewDefaultMode={settings.markdownPreviewDefaultMode}
              markdownEditorOpenInNewTabByDefault={
                settings.markdownEditorOpenInNewTabByDefault
              }
              onCursorAccessoryEnabledToggle={settings.setCursorAccessoryEnabled}
              onMarkdownPreviewDefaultModeChange={
                settings.setMarkdownPreviewDefaultMode
              }
              onMarkdownEditorOpenInNewTabByDefaultToggle={
                settings.setMarkdownEditorOpenInNewTabByDefault
              }
            />
          </div>
        );
      case "exam-editor":
        return (
          <div className="settings-page settings-single-column">
            <ExamEditorSection
              language={language}
              examEditorShowMoveButtons={settings.examEditorShowMoveButtons}
              onExamEditorShowMoveButtonsToggle={settings.setExamEditorShowMoveButtons}
            />
          </div>
        );
      case "exam-settings":
        return (
          <div className="settings-page settings-single-column">
            {activeSubPageId === "auto-cards" ? (
              <AutoCardsSettingsPanel
                language={language}
                enabledTypes={settings.examAutoCardsTypes}
                onTypeToggle={settings.setExamAutoCardsTypeEnabled}
                returnCardsEnabled={settings.examAutoCardsReturnOnCorrect}
                setReturnCardsEnabled={settings.setExamAutoCardsReturnOnCorrect}
              />
            ) : activeSubPageId === "task-type-defaults" ? (
              <ExamTaskTypeDefaultsPanel
                language={language}
                pointsByType={settings.examTaskTypeDefaultPoints}
                timeSecondsByType={settings.examTaskTypeDefaultTimeSeconds}
                onPointChange={handleExamTaskTypeDefaultPointChange}
                onTimeSecondsChange={handleExamTaskTypeDefaultTimeSecondsChange}
                onResetPreset={() => {
                  settings.resetExamTaskTypeDefaultPoints();
                  settings.resetExamTaskTypeDefaultTimeSeconds();
                }}
              />
            ) : (
              <ExamTogglesPanel
                language={language}
                resetStatisticsPending={isResetExamStatsPending}
                onResetStatistics={handleResetExamStatistics}
                timeLimitEnabled={settings.examTimeLimitEnabled}
                showTimeline={settings.examShowTimeline}
                helpEnabled={settings.examHelpEnabled}
                showTaskSources={settings.examShowTaskSources}
                aiEvaluation={settings.examAiEvaluation}
                onTimeLimitToggle={handleExamTimeLimitToggle}
                setShowTimeline={settings.setExamShowTimeline}
                setHelpEnabled={settings.setExamHelpEnabled}
                setShowTaskSources={settings.setExamShowTaskSources}
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
                    <h2>{tSettings(language, "settings.fastFlashcard.title")}</h2>
                    <p className="muted">
                      {tSettings(language, "settings.fastFlashcard.description")}
                    </p>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="setting-row">
                    <span className="label">
                      {tSettings(language, "settings.fastFlashcard.defaultOrder")}
                    </span>
                    <div className="pill-grid">
                      <button
                        type="button"
                        className={`pill pill-button ${
                          settings.fastFlashcardOrder === "in-order" ? "active" : ""
                        }`}
                        aria-pressed={settings.fastFlashcardOrder === "in-order"}
                        onClick={() => settings.setFastFlashcardOrder("in-order")}
                      >
                        {tSettings(language, "settings.flashcardTools.inOrder")}
                      </button>
                      <button
                        type="button"
                        className={`pill pill-button ${
                          settings.fastFlashcardOrder === "random" ? "active" : ""
                        }`}
                        aria-pressed={settings.fastFlashcardOrder === "random"}
                        onClick={() => settings.setFastFlashcardOrder("random")}
                      >
                        {tSettings(language, "settings.flashcardTools.random")}
                      </button>
                    </div>
                  </div>
                  <div className="setting-row">
                    <span className="label">
                      {tSettings(language, "settings.fastFlashcard.mode")}
                    </span>
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
                      <option value="all">
                        {tSettings(language, "settings.flashcardTools.mode.all")}
                      </option>
                      <option value="qa">
                        {tSettings(language, "settings.flashcardTools.mode.qa")}
                      </option>
                      <option value="multiple-choice">
                        {tSettings(
                          language,
                          "settings.flashcardTools.mode.multipleChoice",
                        )}
                      </option>
                      <option value="fill-blank">
                        {tSettings(language, "settings.flashcardTools.mode.fillBlank")}
                      </option>
                      <option value="assignment">
                        {tSettings(language, "settings.flashcardTools.mode.assignment")}
                      </option>
                      <option value="true-false">
                        {tSettings(language, "settings.flashcardTools.mode.trueFalse")}
                      </option>
                      <option value="mix">
                        {tSettings(language, "settings.flashcardTools.mode.mix")}
                      </option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <span className="label">
                      {tSettings(language, "settings.fastFlashcard.autoTime")}
                    </span>
                    <div className="setting-inline">
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={settings.fastFlashcardAutoTimeEnabled}
                          onChange={(event) =>
                            settings.setFastFlashcardAutoTimeEnabled(
                              event.target.checked,
                            )
                          }
                        />
                        <span className="slider" />
                      </label>
                      <span className="muted">
                        {settings.fastFlashcardAutoTimeEnabled
                          ? tSettings(language, "settings.common.enabled")
                          : tSettings(language, "settings.common.disabled")}
                      </span>
                    </div>
                  </div>
                  {!settings.fastFlashcardAutoTimeEnabled ? (
                    <div className="setting-row">
                      <span className="label">
                        {tSettings(language, "settings.fastFlashcard.duration")}
                      </span>
                      <div className="pill-grid">
                        {FAST_FLASHCARD_DURATIONS.map((duration) => (
                          <button
                            key={duration}
                            type="button"
                            className={`pill pill-button ${
                              settings.fastFlashcardDuration === duration
                                ? "active"
                                : ""
                            }`}
                            aria-pressed={settings.fastFlashcardDuration === duration}
                            onClick={() => settings.setFastFlashcardDuration(duration)}
                          >
                            {duration}s
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="setting-row">
                    <span className="label">
                      {tSettings(language, "settings.fastFlashcard.defaultScope")}
                    </span>
                    <div className="pill-grid">
                      <button
                        type="button"
                        className={`pill pill-button ${
                          settings.fastFlashcardScope === "current" ? "active" : ""
                        }`}
                        aria-pressed={settings.fastFlashcardScope === "current"}
                        onClick={() => settings.setFastFlashcardScope("current")}
                      >
                        {tSettings(language, "settings.flashcardTools.currentNote")}
                      </button>
                      <button
                        type="button"
                        className={`pill pill-button ${
                          settings.fastFlashcardScope === "vault" ? "active" : ""
                        }`}
                        aria-pressed={settings.fastFlashcardScope === "vault"}
                        onClick={() => settings.setFastFlashcardScope("vault")}
                      >
                        {tSettings(language, "settings.flashcardTools.wholeVault")}
                      </button>
                    </div>
                  </div>
                  <div className="setting-row">
                    <span className="label">
                      {tSettings(language, "settings.fastFlashcard.helpHints")}
                    </span>
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
                        {settings.fastFlashcardHelpEnabled
                          ? tSettings(language, "settings.common.enabled")
                          : tSettings(language, "settings.common.disabled")}
                      </span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <span className="label">
                      {tSettings(language, "settings.fastFlashcard.sessionHistory")}
                    </span>
                    <div className="setting-actions">
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => setIsResetHistoryOpen(true)}
                      >
                        {tSettings(language, "settings.fastFlashcard.resetHistory")}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ) : activeSubPageId === "spaced-repetition-tools" ? (
              <SpacedRepetitionSettingsSection
                language={language}
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
                autoTimeEnabled={settings.spacedRepetitionAutoTimeEnabled}
                setAutoTimeEnabled={settings.setSpacedRepetitionAutoTimeEnabled}
              />
            ) : (
              <FlashcardsSettingsSection
                language={language}
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
              language={language}
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
                  <h2>{tSettings(language, "settings.language.panelTitle")}</h2>
                  <p className="muted">
                    {tSettings(language, "settings.language.panelDescription")}
                  </p>
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
            {activeSubPageId === "performance-debug" ? (
              <InputDebugSection
                language={language}
                enabled={settings.inputDebugEnabled}
                redactContent={settings.inputDebugRedactContent}
                setEnabled={settings.setInputDebugEnabled}
                setRedactContent={settings.setInputDebugRedactContent}
              />
            ) : (
              <section className="panel settings-performance-panel">
                <div className="panel-header">
                  <div>
                    <h2>{tSettings(language, "settings.performance.title")}</h2>
                    <p className="muted">
                      {tSettings(language, "settings.performance.description")}
                    </p>
                  </div>
                </div>
                <div className="panel-body">
                  <PerformanceTabContent
                    language={language}
                    maxFilesPerScan={settings.maxFilesPerScan}
                    onMaxFilesPerScanChange={actions.handleMaxFilesPerScanChange}
                    scanParallelism={settings.scanParallelism}
                    setScanParallelism={settings.setScanParallelism}
                  />
                </div>
              </section>
            )}
          </div>
        );
      case "vault-index": {
        const dataHubSubPageId =
          activeSubPageId === "data-sync" || activeSubPageId === "export-import"
            ? activeSubPageId
            : "vault-index";
        return (
          <div className="settings-page settings-single-column">
            {dataHubSubPageId === "data-sync" ? (
              <section className="panel">
                <div className="panel-body">
                  <DataSyncSettingsView
                    language={language}
                    userVault={userVault}
                    spacedRepetition={spacedRepetition}
                    vaultSelection={profileSetupVaultSelection}
                  />
                </div>
              </section>
            ) : dataHubSubPageId === "export-import" ? (
              <section className="panel">
                <div className="panel-body">
                  <ExportImportSettingsView language={language} userVault={userVault} />
                </div>
              </section>
            ) : (
              <VaultIndexSection
                language={language}
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
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  if (!activeItem) {
    return null;
  }

  const showCompactListOnly = isCompactSettings && compactActiveSectionId === null;

  return (
    <>
      <div className="settings-layout">
        {showCompactListOnly ? (
          <SettingsNav
            items={localizedNavModel}
            activeId={activeSettingsPage}
            onSelect={handleSettingsSelect}
          />
        ) : (
          <>
            {!isCompactSettings ? (
              <SettingsNav
                items={localizedNavModel}
                activeId={activeSettingsPage}
                onSelect={handleSettingsSelect}
              />
            ) : null}
            <SettingsPanel
              activeItem={activeItem}
              activeSubPageId={activeSubPageId}
              onSubPageChange={handleSubPageChange}
              actions={headerActions}
              compactMode={isCompactSettings}
              onBack={isCompactSettings ? handleCompactBack : undefined}
            >
              {renderSettingsContent()}
            </SettingsPanel>
          </>
        )}
      </div>
      <ResetSessionHistoryModal
        language={language}
        isOpen={isResetHistoryOpen}
        isPending={isResetHistoryPending}
        onCancel={() => setIsResetHistoryOpen(false)}
        onConfirm={handleResetHistoryConfirm}
      />
    </>
  );
};
