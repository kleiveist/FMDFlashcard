# Gesamtinhalte – Root: /mnt/daten/workspace/Blobbite/Develop/FMDFlashcard/apps/fmd-desktop/src

## 📝 App.css — ./App.css

@import "./styles/tokens.css";
@import "./styles/base.css";
@import "./styles/layout.css";
@import "./styles/components/buttons.css";
@import "./styles/components/content.css";
@import "./styles/components/panels.css";
@import "./styles/components/flashcards.css";
@import "./styles/components/stats.css";
@import "./styles/components/help.css";
@import "./styles/components/spaced-repetition.css";
@import "./styles/components/panel-layout.css";
@import "./styles/components/modals.css";
@import "./styles/components/preview.css";
@import "./styles/components/utility.css";
@import "./styles/components/settings.css";
@import "./styles/components/responsive.css";

---

## 📝 App.tsx — ./App.tsx

import { useState } from "react";
import "./App.css";
import { AppStateProvider, useAppState } from "./components/AppStateProvider";
import { SidebarNav } from "./components/SidebarNav";
import { DashboardPage } from "./pages/DashboardPage";
import { FlashcardPage } from "./pages/FlashcardPage";
import { FastFlashcardPage } from "./pages/FastFlashcardPage";
import { HelpPage } from "./pages/HelpPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SpacedRepetitionPage } from "./pages/SpacedRepetitionPage";

type TabKey =
  | "dashboard"
  | "flashcard"
  | "spaced-repetition"
  | "fast-flashcard"
  | "help"
  | "settings";

const AppContent = () => {
  const { settings } = useAppState();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isDashboard = activeTab === "dashboard";
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setIsMobileNavOpen(false);
  };

  return (
    <div
      className={`app-shell ${
        settings.rightToolbarCollapsed ? "sidebar-collapsed" : ""
      } ${isDashboard ? "dashboard-active" : ""} ${
        isMobileNavOpen ? "nav-open" : ""
      }`}
    >
      <SidebarNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isMobileNavOpen={isMobileNavOpen}
        onMobileNavClose={() => setIsMobileNavOpen(false)}
      />
      <main className="content">
        <div className="mobile-nav-header">
          <button
            type="button"
            className="ghost small mobile-nav-toggle"
            onClick={() => setIsMobileNavOpen(true)}
            aria-label="Open navigation"
            aria-controls="app-sidebar"
            aria-expanded={isMobileNavOpen}
          >
            Menu
          </button>
        </div>
        {activeTab === "dashboard" ? (
          <DashboardPage />
        ) : activeTab === "flashcard" ? (
          <FlashcardPage />
        ) : activeTab === "spaced-repetition" ? (
          <SpacedRepetitionPage />
        ) : activeTab === "fast-flashcard" ? (
          <FastFlashcardPage />
        ) : activeTab === "help" ? (
          <HelpPage />
        ) : (
          <SettingsPage />
        )}
      </main>
      <button
        type="button"
        className="mobile-nav-backdrop"
        onClick={() => setIsMobileNavOpen(false)}
        aria-hidden={!isMobileNavOpen}
        tabIndex={-1}
      />
    </div>
  );
};

function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}

export default App;

---

## 📝 AppStateProvider.tsx — ./components/AppStateProvider.tsx

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isValidHex, normalizeHex } from "../lib/color";
import { type ThemeMode } from "../lib/theme";
import { type VaultFile } from "../lib/tree";
import { useFlashcards } from "../features/flashcards/useFlashcards";
import { usePreview } from "../features/preview/usePreview";
import { useAppSettings } from "../features/settings/useAppSettings";
import { type SettingsPageId } from "../features/settings/settingsNavigation";
import { useSpacedRepetition } from "../features/spaced-repetition/useSpacedRepetition";
import { useVault } from "../features/vault/useVault";
import { LargeVaultWarningModal } from "./LargeVaultWarningModal";

type AppActions = {
  handlePickVault: () => Promise<boolean>;
  handleSelectFile: (file: VaultFile) => void;
  handleThemeChange: (nextTheme: ThemeMode) => void;
  handleAccentPick: (value: string) => void;
  handleAccentInputChange: (value: string) => void;
  handleCopyAccent: () => Promise<void>;
  handleCopyVaultPath: () => Promise<void>;
  handleRescanVault: () => void;
  handleMaxFilesPerScanChange: (value: string) => void;
};

type AppState = {
  actions: AppActions;
  flashcards: ReturnType<typeof useFlashcards>;
  fastFlashcards: ReturnType<typeof useFlashcards>;
  help: {
    activeTopicId: string | null;
    setActiveTopicId: (value: string | null) => void;
  };
  settingsNav: {
    activeSettingsPage: SettingsPageId;
    setActiveSettingsPage: (value: SettingsPageId) => void;
  };
  preview: ReturnType<typeof usePreview>;
  settings: ReturnType<typeof useAppSettings>;
  spacedRepetition: ReturnType<typeof useSpacedRepetition>;
  vault: ReturnType<typeof useVault>;
};

const AppStateContext = createContext<AppState | null>(null);

const countMarkdownFiles = (files: VaultFile[]) =>
  files.reduce((count, file) => {
    const relativePath = file.relative_path.replace(/\\/g, "/");
    if (
      relativePath
        .split("/")
        .some((segment) => segment.startsWith("."))
    ) {
      return count;
    }
    if (relativePath.toLowerCase().endsWith(".md")) {
      return count + 1;
    }
    return count;
  }, 0);

const parseVaultWarningThreshold = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const settings = useAppSettings();
  const [activeHelpTopicId, setActiveHelpTopicId] = useState<string | null>(
    null,
  );
  const [largeVaultWarningCount, setLargeVaultWarningCount] = useState<
    number | null
  >(null);
  const [activeSettingsPage, setActiveSettingsPage] =
    useState<SettingsPageId>("appearance");
  const {
    activeNotePath,
    accentColor,
    persistSettings,
    setAccentColor,
    setAccentDraft,
    setAccentError,
    setActiveNotePath,
    maxFilesPerScan,
    setMaxFilesPerScan,
    setTheme,
    settingsLoaded,
    vaultPath: storedVaultPath,
    flashcardMode,
    flashcardOrder,
    flashcardPageSize,
    flashcardScope,
    setFlashcardMode,
    setFlashcardOrder,
    setFlashcardPageSize,
    setFlashcardScope,
    fastFlashcardMode,
    fastFlashcardOrder,
    fastFlashcardScope,
    setFastFlashcardMode,
    setFastFlashcardOrder,
    setFastFlashcardScope,
    setSolutionRevealEnabled,
    setStatsResetMode,
    solutionRevealEnabled,
    statsResetMode,
  } = settings;
  const vault = useVault({ persistSettings });
  const preview = usePreview();
  const flashcards = useFlashcards({
    files: vault.files,
    preview: preview.preview,
    selectedFile: preview.selectedFile,
    vaultPath: vault.vaultPath,
    settings: {
      flashcardMode,
      flashcardOrder,
      flashcardPageSize,
      flashcardScope,
      setFlashcardMode,
      setFlashcardOrder,
      setFlashcardPageSize,
      setFlashcardScope,
      setSolutionRevealEnabled,
      setStatsResetMode,
      solutionRevealEnabled,
      statsResetMode,
    },
  });
  const fastFlashcards = useFlashcards({
    files: vault.files,
    preview: preview.preview,
    selectedFile: preview.selectedFile,
    vaultPath: vault.vaultPath,
    settings: {
      flashcardMode: fastFlashcardMode,
      flashcardOrder: fastFlashcardOrder,
      flashcardPageSize,
      flashcardScope: fastFlashcardScope,
      setFlashcardMode: setFastFlashcardMode,
      setFlashcardOrder: setFastFlashcardOrder,
      setFlashcardPageSize,
      setFlashcardScope: setFastFlashcardScope,
      setSolutionRevealEnabled,
      setStatsResetMode,
      solutionRevealEnabled,
      statsResetMode,
    },
  });
  const spacedRepetition = useSpacedRepetition({
    isFlashcardScanning: flashcards.isFlashcardScanning,
    scanFlashcards: flashcards.scanFlashcards,
    setIsFlashcardScanning: flashcards.setIsFlashcardScanning,
    settings: {
      setSpacedRepetitionBoxes: settings.setSpacedRepetitionBoxes,
      setSpacedRepetitionOrder: settings.setSpacedRepetitionOrder,
      setSpacedRepetitionPageSize: settings.setSpacedRepetitionPageSize,
      setSpacedRepetitionRepetitionStrength:
        settings.setSpacedRepetitionRepetitionStrength,
      setSpacedRepetitionStatsView: settings.setSpacedRepetitionStatsView,
      spacedRepetitionBoxes: settings.spacedRepetitionBoxes,
      spacedRepetitionOrder: settings.spacedRepetitionOrder,
      spacedRepetitionPageSize: settings.spacedRepetitionPageSize,
      spacedRepetitionRepetitionStrength:
        settings.spacedRepetitionRepetitionStrength,
      spacedRepetitionStatsView: settings.spacedRepetitionStatsView,
    },
  });
  const hasRestoredVault = useRef(false);
  const isRestoringActiveNote = useRef(false);
  const hasResolvedActiveNote = useRef(false);
  const { loadVault, pickVault, rescanVault, setVaultPath, vaultPath } = vault;
  const {
    resetPreview,
    restoreSnapshot: restorePreviewSnapshot,
    selectFile,
    setPreviewError,
    takeSnapshot: takePreviewSnapshot,
  } = preview;
  const {
    resetFlashcards,
    restoreSnapshot: restoreFlashcardsSnapshot,
    takeSnapshot: takeFlashcardsSnapshot,
  } = flashcards;

  useEffect(() => {
    if (!settingsLoaded || hasRestoredVault.current) {
      return;
    }
    hasRestoredVault.current = true;
    if (!storedVaultPath) {
      return;
    }
    let cancelled = false;

    const restoreVault = async () => {
      const results = await loadVault(storedVaultPath, {
        persist: false,
        clearOnFailure: false,
        errorMessage:
          "Saved vault is unavailable. Please reselect.",
      });
      if (!results && !cancelled) {
        setVaultPath(null);
        await persistSettings({ vaultPath: null });
      }
    };

    void restoreVault();

    return () => {
      cancelled = true;
    };
  }, [loadVault, persistSettings, setVaultPath, settingsLoaded, storedVaultPath]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    if (preview.selectedFile && !hasResolvedActiveNote.current) {
      hasResolvedActiveNote.current = true;
    }
    if (!hasResolvedActiveNote.current) {
      return;
    }
    const nextPath = preview.selectedFile?.relative_path ?? null;
    if (nextPath === activeNotePath) {
      return;
    }
    setActiveNotePath(nextPath);
  }, [activeNotePath, preview.selectedFile, setActiveNotePath, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    if (!vault.vaultPath || vault.listState !== "idle") {
      return;
    }
    if (preview.selectedFile || isRestoringActiveNote.current) {
      if (preview.selectedFile) {
        hasResolvedActiveNote.current = true;
      }
      return;
    }
    if (!activeNotePath) {
      hasResolvedActiveNote.current = true;
      return;
    }
    const storedFile = vault.files.find(
      (file) =>
        file.relative_path === activeNotePath || file.path === activeNotePath,
    );
    if (!storedFile) {
      setActiveNotePath(null);
      if (vault.files.length === 0) {
        hasResolvedActiveNote.current = true;
        return;
      }
    }
    const nextFile = storedFile ?? vault.files[0];
    if (!nextFile) {
      return;
    }
    isRestoringActiveNote.current = true;
    resetFlashcards();
    void Promise.resolve(selectFile(nextFile)).finally(() => {
      isRestoringActiveNote.current = false;
      hasResolvedActiveNote.current = true;
    });
  }, [
    activeNotePath,
    preview.selectedFile,
    resetFlashcards,
    selectFile,
    setActiveNotePath,
    settingsLoaded,
    vault.files,
    vault.listState,
    vault.vaultPath,
  ]);

  const handlePickVault = useCallback(async () => {
    setPreviewError("");
    const previewSnapshot = takePreviewSnapshot();
    const flashcardsSnapshot = takeFlashcardsSnapshot();

    const results = await pickVault({
      errorMessage: "Ausgewaehlter Vault ist nicht verfuegbar.",
      onBeforeLoad: () => {
        resetPreview();
        resetFlashcards();
      },
      onLoadFailed: () => {
        restorePreviewSnapshot(previewSnapshot);
        restoreFlashcardsSnapshot(flashcardsSnapshot);
      },
    });

    if (results) {
      const count = countMarkdownFiles(results);
      const threshold = parseVaultWarningThreshold(maxFilesPerScan);
      if (threshold && count > threshold) {
        setLargeVaultWarningCount(count);
      } else {
        setLargeVaultWarningCount(null);
      }
    }

    return Boolean(results);
  }, [
    pickVault,
    resetFlashcards,
    resetPreview,
    restoreFlashcardsSnapshot,
    restorePreviewSnapshot,
    setPreviewError,
    takeFlashcardsSnapshot,
    takePreviewSnapshot,
    setLargeVaultWarningCount,
    maxFilesPerScan,
  ]);

  const handleSelectFile = useCallback(
    (file: VaultFile) => {
      resetFlashcards();
      void selectFile(file);
    },
    [resetFlashcards, selectFile],
  );

  const handleThemeChange = useCallback(
    (nextTheme: ThemeMode) => {
      setTheme(nextTheme);
    },
    [setTheme],
  );

  const handleAccentPick = useCallback(
    (value: string) => {
      const normalized = normalizeHex(value);
      if (!isValidHex(normalized)) {
        return;
      }
      setAccentError("");
      setAccentColor(normalized);
      setAccentDraft(normalized);
    },
    [setAccentColor, setAccentDraft, setAccentError],
  );

  const handleAccentInputChange = useCallback(
    (value: string) => {
      const nextValue = normalizeHex(value);
      setAccentDraft(nextValue);
      if (!nextValue) {
        setAccentError("");
        return;
      }
      if (isValidHex(nextValue)) {
        setAccentError("");
        setAccentColor(nextValue);
      } else {
        setAccentError("HEX muss #RRGGBB sein.");
      }
    },
    [setAccentColor, setAccentDraft, setAccentError],
  );

  const handleCopyAccent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(accentColor);
    } catch (error) {
      console.error("Failed to copy accent color", error);
    }
  }, [accentColor]);

  const handleCopyVaultPath = useCallback(async () => {
    if (!vaultPath) {
      return;
    }
    try {
      await navigator.clipboard.writeText(vaultPath);
    } catch (error) {
      console.error("Failed to copy vault path", error);
    }
  }, [vaultPath]);

  const handleRescanVault = useCallback(() => {
    void rescanVault();
  }, [rescanVault]);

  const handleMaxFilesPerScanChange = useCallback(
    (value: string) => {
      const nextValue = value.trim();
      if (nextValue === "" || /^[0-9]+$/.test(nextValue)) {
        setMaxFilesPerScan(nextValue);
      }
    },
    [setMaxFilesPerScan],
  );

  const handleLargeVaultWarningDismiss = useCallback(() => {
    setLargeVaultWarningCount(null);
  }, [setLargeVaultWarningCount]);

  const value: AppState = {
    actions: {
      handlePickVault,
      handleSelectFile,
      handleThemeChange,
      handleAccentPick,
      handleAccentInputChange,
      handleCopyAccent,
      handleCopyVaultPath,
      handleRescanVault,
      handleMaxFilesPerScanChange,
    },
    flashcards,
    fastFlashcards,
    help: {
      activeTopicId: activeHelpTopicId,
      setActiveTopicId: setActiveHelpTopicId,
    },
    settingsNav: {
      activeSettingsPage,
      setActiveSettingsPage,
    },
    preview,
    settings,
    spacedRepetition,
    vault,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
      <LargeVaultWarningModal
        count={largeVaultWarningCount}
        onClose={handleLargeVaultWarningDismiss}
      />
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
};

---

## 📝 FileList.tsx — ./components/FileList.tsx

import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";

type FileListProps = {
  fileCountLabel: string;
  files: VaultFile[];
  listError: string;
  listState: LoadState;
  onSelectFile: (file: VaultFile) => void;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
};

export const FileList = ({
  fileCountLabel,
  files,
  listError,
  listState,
  onSelectFile,
  selectedFile,
  vaultPath,
}: FileListProps) => {
  return (
    <section className="panel list-panel">
      <div className="panel-header">
        <div>
          <h2>Notizen</h2>
          <p className="muted">{fileCountLabel}</p>
        </div>
        {listState === "loading" ? <span className="chip">Scanne...</span> : null}
      </div>
      <div className="panel-body">
        {!vaultPath ? (
          <div className="empty-state">Waehle einen Vault, um die Liste zu fuellen.</div>
        ) : null}
        {listError ? <div className="error">{listError}</div> : null}
        {vaultPath && listState === "idle" && files.length === 0 ? (
          <div className="empty-state">Keine Markdown-Dateien in diesem Vault.</div>
        ) : null}
        {vaultPath && listState !== "error" ? (
          <ul className="file-list">
            {files.map((file) => (
              <li key={file.path}>
                <button
                  type="button"
                  className={`file-item ${
                    selectedFile?.path === file.path ? "active" : ""
                  }`}
                  onClick={() => onSelectFile(file)}
                >
                  <span className="file-name">{file.relative_path}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
};

---

## 📝 ClozeCard.tsx — ./components/flashcards/ClozeCard.tsx

import { type DragEvent } from "react";
import {
  isDragAnswerMatch,
  isInputAnswerMatch,
  type ClozeCard as ClozeCardType,
} from "../../lib/flashcards";
import {
  areClozeBlanksComplete,
  getClozeBlanks,
  isClozeCardCorrect,
} from "../../features/flashcards/logic";

type ClozeCardProps = {
  card: ClozeCardType;
  cardIndex: number;
  submitted: boolean;
  responses: Record<string, string>;
  submissionLocked?: boolean;
  partIndex?: number;
  showSubmit?: boolean;
  onInputChange: (cardIndex: number, blankId: string, value: string) => void;
  onTokenDrop: (
    event: DragEvent<HTMLElement>,
    cardIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  onTokenRemove: (cardIndex: number, blankId: string) => void;
  onTokenDragStart: (
    event: DragEvent<HTMLElement>,
    payload: { cardIndex: number; tokenId: string; partIndex?: number },
  ) => void;
  onBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const ClozeCard = ({
  card,
  cardIndex,
  submitted,
  responses,
  submissionLocked = false,
  partIndex,
  showSubmit = true,
  onBlankDragOver,
  onInputChange,
  onSubmit,
  onTokenDragStart,
  onTokenDrop,
  onTokenRemove,
}: ClozeCardProps) => {
  const blanks = getClozeBlanks(card.segments);
  const dragBlanks = blanks.filter((blank) => blank.kind === "drag");
  const dragBlankIds = new Set(dragBlanks.map((blank) => blank.id));
  const tokenById = new Map(
    card.dragTokens.map((token) => [token.id, token.value]),
  );
  const assignedTokenIds = new Set(
    dragBlanks
      .map((blank) => responses[blank.id])
      .filter((tokenId) => tokenById.has(tokenId)),
  );
  const hasDragTokens = card.dragTokens.length > 0;
  const validTokenIds = new Set(card.dragTokens.map((token) => token.id));
  const canSubmit = areClozeBlanksComplete(card, responses);
  const isCorrect = isClozeCardCorrect(card, responses);
  const resultLabel = submitted ? (isCorrect ? "Correct" : "Incorrect") : "";
  const showActions = showSubmit || submitted;
  let blankPosition = 0;

  return (
    <article className="flashcard-item cloze-card">
      <h3 className="flashcard-question">{card.question}</h3>
      <div className="cloze-text">
        {card.segments.map((segment, segmentIndex) => {
          if (segment.type === "text") {
            return (
              <span key={`cloze-text-${cardIndex}-${segmentIndex}`}>
                {segment.value}
              </span>
            );
          }

          blankPosition += 1;
          const blankNumber = blankPosition;

          if (segment.kind === "input") {
            const value = responses[segment.id] ?? "";
            const isBlankCorrect = submitted
              ? isInputAnswerMatch(value, segment.solution)
              : false;
            const blankClasses = [
              "cloze-blank",
              "input",
              value.trim() ? "filled" : "",
              submitted ? (isBlankCorrect ? "correct" : "incorrect") : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <span
                key={`cloze-blank-${cardIndex}-${segmentIndex}`}
                className={blankClasses}
              >
                <input
                  type="text"
                  className="cloze-input"
                  value={value}
                  onChange={(event) =>
                    onInputChange(cardIndex, segment.id, event.target.value)
                  }
                  disabled={submitted}
                  placeholder="____"
                  aria-label={`Blank ${blankNumber}`}
                />
              </span>
            );
          }

          const assignedTokenId = responses[segment.id] ?? "";
          const assignedValue = assignedTokenId
            ? tokenById.get(assignedTokenId) ?? ""
            : "";
          const hasToken = Boolean(assignedValue);
          const isBlankCorrect = submitted
            ? isDragAnswerMatch(assignedValue, segment.solution)
            : false;
          const blankClasses = [
            "cloze-blank",
            "drag",
            hasToken ? "filled" : "",
            submitted ? (isBlankCorrect ? "correct" : "incorrect") : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <span
              key={`cloze-blank-${cardIndex}-${segmentIndex}`}
              className={blankClasses}
              aria-label={`Drop zone ${blankNumber}`}
              onDragOver={onBlankDragOver}
              onDrop={(event) =>
                onTokenDrop(event, cardIndex, segment.id, validTokenIds, dragBlankIds)
              }
            >
              {hasToken ? (
                <span className="cloze-token">
                  <button
                    type="button"
                    className="token-chip"
                    draggable={!submitted}
                    onDragStart={(event) =>
                    onTokenDragStart(event, {
                      cardIndex,
                      tokenId: assignedTokenId,
                      partIndex,
                    })
                  }
                  disabled={submitted}
                >
                    {assignedValue}
                  </button>
                  {!submitted ? (
                    <button
                      type="button"
                      className="token-remove"
                      onClick={() => onTokenRemove(cardIndex, segment.id)}
                      aria-label="Remove token"
                    >
                      x
                    </button>
                  ) : null}
                </span>
              ) : (
                <span className="cloze-placeholder">Drop token</span>
              )}
            </span>
          );
        })}
      </div>
      {hasDragTokens ? (
        <div className="token-section">
          <span className="label">Tokens</span>
          <div className="token-pool">
            {card.dragTokens.map((token) => {
              const isUsed = assignedTokenIds.has(token.id);
              return (
                <button
                  key={`token-${cardIndex}-${token.id}`}
                  type="button"
                  className={`token-chip ${isUsed ? "used" : ""}`}
                  draggable={!submitted && !isUsed}
                  onDragStart={(event) =>
                    onTokenDragStart(event, {
                      cardIndex,
                      tokenId: token.id,
                      partIndex,
                    })
                  }
                  disabled={submitted || isUsed}
                >
                  {token.value}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {showActions ? (
        <div className="flashcard-actions">
          {showSubmit ? (
            <button
              type="button"
              className="ghost small flashcard-submit"
              onClick={() => onSubmit(cardIndex, canSubmit)}
              disabled={submitted || !canSubmit || submissionLocked}
            >
              Submit
            </button>
          ) : null}
          {submitted ? (
            <span className={`flashcard-result ${isCorrect ? "correct" : "incorrect"}`}>
              {resultLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      {submitted ? (
        <div className="token-solution">
          <span className="label">Solution</span>
          <div className="cloze-solution">
            {card.segments.map((segment, segmentIndex) => {
              if (segment.type === "text") {
                return (
                  <span key={`solution-text-${cardIndex}-${segmentIndex}`}>
                    {segment.value}
                  </span>
                );
              }
              return (
                <span
                  key={`solution-blank-${cardIndex}-${segmentIndex}`}
                  className="cloze-solution-token"
                >
                  {segment.solution}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
};

---

## 📝 CompositeCard.tsx — ./components/flashcards/CompositeCard.tsx

import type { DragEvent } from "react";
import { ClozeCard } from "./ClozeCard";
import { FreeTextCard } from "./FreeTextCard";
import { MultipleChoiceCard } from "./MultipleChoiceCard";
import { TrueFalseCard } from "./TrueFalseCard";
import type { CompositeFlashcard } from "../../lib/flashcards";
import {
  evaluateFlashcardPartResult,
  isFlashcardPartComplete,
  type CompositePartState,
  type FlashcardSelfGrade,
  type TrueFalseSelection,
} from "../../features/flashcards/logic";

type CompositeCardProps = {
  card: CompositeFlashcard;
  cardIndex: number;
  submitted: boolean;
  submissionLocked?: boolean;
  partStates: CompositePartState[];
  onOptionSelect: (cardIndex: number, partIndex: number, keys: string[]) => void;
  onTrueFalseSelect: (
    cardIndex: number,
    partIndex: number,
    itemId: string,
    value: TrueFalseSelection,
  ) => void;
  onClozeInputChange: (
    cardIndex: number,
    partIndex: number,
    blankId: string,
    value: string,
  ) => void;
  onClozeTokenDrop: (
    event: DragEvent<HTMLElement>,
    cardIndex: number,
    partIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  onClozeTokenRemove: (cardIndex: number, partIndex: number, blankId: string) => void;
  onClozeTokenDragStart: (
    event: DragEvent<HTMLElement>,
    payload: { cardIndex: number; tokenId: string; partIndex?: number },
  ) => void;
  onBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  onTextInputChange: (cardIndex: number, partIndex: number, value: string) => void;
  onTextCheck: (cardIndex: number, partIndex: number) => void;
  onSelfGrade: (
    cardIndex: number,
    partIndex: number,
    grade: FlashcardSelfGrade,
  ) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const CompositeCard = ({
  card,
  cardIndex,
  submitted,
  submissionLocked = false,
  partStates,
  onBlankDragOver,
  onClozeInputChange,
  onClozeTokenDragStart,
  onClozeTokenDrop,
  onClozeTokenRemove,
  onOptionSelect,
  onSelfGrade,
  onSubmit,
  onTextCheck,
  onTextInputChange,
  onTrueFalseSelect,
}: CompositeCardProps) => {
  const canSubmit =
    card.parts.length > 0 &&
    card.parts.every((part, index) =>
      isFlashcardPartComplete(part, partStates[index] ?? {}),
    );
  const allCorrect = card.parts.every(
    (part, index) =>
      evaluateFlashcardPartResult(part, partStates[index] ?? {}) === "correct",
  );
  const resultLabel = submitted ? (allCorrect ? "Correct" : "Incorrect") : "";

  return (
    <article className="flashcard-item composite-card">
      <div className="composite-parts">
        {card.parts.map((part, partIndex) => {
          const state = partStates[partIndex] ?? {};
          if (part.kind === "cloze") {
            return (
              <ClozeCard
                key={`composite-${cardIndex}-${partIndex}`}
                card={part}
                cardIndex={cardIndex}
                partIndex={partIndex}
                submitted={submitted}
                submissionLocked={submissionLocked}
                responses={state.clozeResponses ?? {}}
                onInputChange={(index, blankId, value) =>
                  onClozeInputChange(index, partIndex, blankId, value)
                }
                onTokenDrop={(event, index, blankId, validTokenIds, dragBlankIds) =>
                  onClozeTokenDrop(
                    event,
                    index,
                    partIndex,
                    blankId,
                    validTokenIds,
                    dragBlankIds,
                  )
                }
                onTokenRemove={(index, blankId) =>
                  onClozeTokenRemove(index, partIndex, blankId)
                }
                onTokenDragStart={onClozeTokenDragStart}
                onBlankDragOver={onBlankDragOver}
                onSubmit={onSubmit}
                showSubmit={false}
              />
            );
          }

          if (part.kind === "true-false") {
            return (
              <TrueFalseCard
                key={`composite-${cardIndex}-${partIndex}`}
                card={part}
                cardIndex={cardIndex}
                submitted={submitted}
                submissionLocked={submissionLocked}
                selections={state.trueFalseSelections ?? {}}
                onSelect={(index, itemId, value) =>
                  onTrueFalseSelect(index, partIndex, itemId, value)
                }
                onSubmit={onSubmit}
                showSubmit={false}
              />
            );
          }

          if (part.kind === "free-text") {
            return (
              <FreeTextCard
                key={`composite-${cardIndex}-${partIndex}`}
                card={part}
                cardIndex={cardIndex}
                submitted={submitted}
                submissionLocked={submissionLocked}
                response={state.textResponse ?? ""}
                revealed={state.textRevealed ?? false}
                selfGrade={state.selfGrade}
                onInputChange={(index, value) =>
                  onTextInputChange(index, partIndex, value)
                }
                onCheck={(index) => onTextCheck(index, partIndex)}
                onSelfGrade={(index, grade) => onSelfGrade(index, partIndex, grade)}
              />
            );
          }

          return (
            <MultipleChoiceCard
              key={`composite-${cardIndex}-${partIndex}`}
              card={part}
              cardIndex={cardIndex}
              submitted={submitted}
              submissionLocked={submissionLocked}
              selectedKeys={state.selections ?? []}
              onSelect={(index, keys) => onOptionSelect(index, partIndex, keys)}
              onSubmit={onSubmit}
              showSubmit={false}
            />
          );
        })}
      </div>
      <div className="flashcard-actions">
        <button
          type="button"
          className="ghost small flashcard-submit"
          onClick={() => onSubmit(cardIndex, canSubmit)}
          disabled={!canSubmit || submitted || submissionLocked}
        >
          Submit
        </button>
        {submitted ? (
          <span
            className={`flashcard-result ${allCorrect ? "correct" : "incorrect"}`}
          >
            {resultLabel}
          </span>
        ) : null}
      </div>
    </article>
  );
};

---

## 📝 FreeTextCard.tsx — ./components/flashcards/FreeTextCard.tsx

import type { FreeTextCard as FreeTextCardType } from "../../lib/flashcards";
import type { FlashcardSelfGrade } from "../../features/flashcards/logic";

type FreeTextCardProps = {
  card: FreeTextCardType;
  cardIndex: number;
  submitted: boolean;
  response: string;
  revealed: boolean;
  selfGrade?: FlashcardSelfGrade;
  submissionLocked?: boolean;
  onInputChange: (cardIndex: number, value: string) => void;
  onCheck: (cardIndex: number) => void;
  onSelfGrade: (cardIndex: number, grade: FlashcardSelfGrade) => void;
};

export const FreeTextCard = ({
  card,
  cardIndex,
  submitted,
  response,
  revealed,
  selfGrade,
  submissionLocked = false,
  onInputChange,
  onCheck,
  onSelfGrade,
}: FreeTextCardProps) => {
  const hasInput = response.trim().length > 0;
  const resultLabel = submitted
    ? selfGrade === "correct"
      ? "Correct"
      : "Incorrect"
    : "";

  return (
    <article className="flashcard-item free-text-card">
      <div className="flashcard-text-block">{card.front}</div>
      <textarea
        className="flashcard-input"
        value={response}
        onChange={(event) => onInputChange(cardIndex, event.target.value)}
        placeholder="Your answer"
        aria-label="Your answer"
        disabled={submitted || revealed}
      />
      <div className="flashcard-actions">
        {!revealed ? (
          <button
            type="button"
            className="ghost small flashcard-submit"
            onClick={() => onCheck(cardIndex)}
            disabled={!hasInput || submitted || submissionLocked}
          >
            Check
          </button>
        ) : (
          <>
            <button
              type="button"
              className="primary small flashcard-submit"
              onClick={() => onSelfGrade(cardIndex, "correct")}
              disabled={submitted || submissionLocked}
            >
              Correct
            </button>
            <button
              type="button"
              className="ghost small flashcard-submit"
              onClick={() => onSelfGrade(cardIndex, "incorrect")}
              disabled={submitted || submissionLocked}
            >
              Incorrect
            </button>
          </>
        )}
        {submitted ? (
          <span
            className={`flashcard-result ${
              selfGrade === "correct" ? "correct" : "incorrect"
            }`}
          >
            {resultLabel}
          </span>
        ) : null}
      </div>
      {revealed ? (
        <div className="flashcard-answer">
          <span className="label">Answer</span>
          <div className="flashcard-answer-text">{card.back}</div>
        </div>
      ) : null}
    </article>
  );
};

---

## 📝 MultipleChoiceCard.tsx — ./components/flashcards/MultipleChoiceCard.tsx

import { useMemo } from "react";
import { type MultipleChoiceCard as MultipleChoiceCardType } from "../../lib/flashcards";

const OPTION_LABELS = "abcdefghijklmnopqrstuvwxyz";

const indexToLabel = (index: number) => {
  let label = "";
  let cursor = index;
  do {
    label = OPTION_LABELS[cursor % 26] + label;
    cursor = Math.floor(cursor / 26) - 1;
  } while (cursor >= 0);
  return label;
};

const shuffleOptions = <T,>(options: T[]) => {
  const copy = [...options];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const isExactKeyMatch = (selected: string[], correct: string[]) => {
  if (selected.length !== correct.length) {
    return false;
  }
  const selectedSet = new Set(selected);
  if (selectedSet.size !== correct.length) {
    return false;
  }
  return correct.every((key) => selectedSet.has(key));
};

type MultipleChoiceCardProps = {
  card: MultipleChoiceCardType;
  cardIndex: number;
  submitted: boolean;
  selectedKeys: string[];
  submissionLocked?: boolean;
  showSubmit?: boolean;
  onSelect: (cardIndex: number, keys: string[]) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const MultipleChoiceCard = ({
  card,
  cardIndex,
  submitted,
  selectedKeys,
  submissionLocked = false,
  showSubmit = true,
  onSelect,
  onSubmit,
}: MultipleChoiceCardProps) => {
  const hasSolutions = card.correctKeys.length > 0;
  const isMultiSelect = card.correctKeys.length > 1;
  const selectionIsCorrect =
    hasSolutions && selectedKeys.length > 0
      ? isExactKeyMatch(selectedKeys, card.correctKeys)
      : false;
  const resultLabel = submitted
    ? hasSolutions
      ? selectionIsCorrect
        ? "Correct"
        : "Incorrect"
      : "No solution defined"
    : "";

  const cardSignature = useMemo(() => {
    const optionsSignature = card.options
      .map((option) => `${option.key}:${option.text}`)
      .join("|");
    return [card.question, card.correctKeys.join(","), optionsSignature].join("::");
  }, [card.question, card.correctKeys, card.options]);

  const displayOptions = useMemo(
    () =>
      shuffleOptions(card.options).map((option, index) => ({
        option,
        label: indexToLabel(index),
      })),
    [cardSignature],
  );

  const showActions = showSubmit || submitted;

  return (
    <article className="flashcard-item">
      <h3 className="flashcard-question">{card.question}</h3>
      <ul className="flashcard-options">
        {displayOptions.map(({ option, label }) => {
          const isSelected = selectedKeys.includes(option.key);
          const isCorrect = hasSolutions && card.correctKeys.includes(option.key);
          const isIncorrect = hasSolutions && submitted && isSelected && !isCorrect;
          const optionClasses = [
            "flashcard-option",
            isSelected ? "selected" : "",
            submitted && isCorrect ? "correct" : "",
            isIncorrect ? "incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={`flashcard-${cardIndex}-${option.key}`}>
              <button
                type="button"
                className={optionClasses}
                onClick={() => {
                  if (isMultiSelect) {
                    const nextKeys = isSelected
                      ? selectedKeys.filter((key) => key !== option.key)
                      : [...selectedKeys, option.key];
                    onSelect(cardIndex, nextKeys);
                    return;
                  }
                  onSelect(cardIndex, [option.key]);
                }}
                disabled={submitted}
                aria-pressed={isSelected}
              >
                <span className="flashcard-key">{label}</span>
                <span className="flashcard-text">{option.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {showActions ? (
        <div className="flashcard-actions">
          {showSubmit ? (
            <button
              type="button"
              className="ghost small flashcard-submit"
              onClick={() => onSubmit(cardIndex, selectedKeys.length > 0)}
              disabled={selectedKeys.length === 0 || submitted || submissionLocked}
            >
              Submit
            </button>
          ) : null}
          {submitted ? (
            <span
              className={`flashcard-result ${
                hasSolutions ? (selectionIsCorrect ? "correct" : "incorrect") : "neutral"
              }`}
            >
              {resultLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};

---

## 📝 TrueFalseCard.tsx — ./components/flashcards/TrueFalseCard.tsx

import { type TrueFalseCard as TrueFalseCardType } from "../../lib/flashcards";
import {
  areTrueFalseItemsComplete,
  isTrueFalseCardCorrect,
  type TrueFalseSelection,
} from "../../features/flashcards/logic";

type TrueFalseCardProps = {
  card: TrueFalseCardType;
  cardIndex: number;
  submitted: boolean;
  selections: Record<string, TrueFalseSelection>;
  submissionLocked?: boolean;
  showSubmit?: boolean;
  onSelect: (cardIndex: number, itemId: string, value: TrueFalseSelection) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const TrueFalseCard = ({
  card,
  cardIndex,
  submitted,
  selections,
  submissionLocked = false,
  showSubmit = true,
  onSelect,
  onSubmit,
}: TrueFalseCardProps) => {
  const canSubmit = areTrueFalseItemsComplete(card, selections);
  const isCorrect = isTrueFalseCardCorrect(card, selections);
  const resultLabel = submitted ? (isCorrect ? "Correct" : "Incorrect") : "";
  const showActions = showSubmit || submitted;

  return (
    <article className="flashcard-item truefalse-card">
      <h3 className="flashcard-question">True/False</h3>
      <ul className="truefalse-list">
        {card.items.map((item) => {
          const selected = selections[item.id];
          const isItemCorrect = submitted && selected === item.correct;
          const isItemIncorrect = submitted && selected && selected !== item.correct;
          const trueClasses = [
            "truefalse-option",
            selected === "wahr" ? "selected" : "",
            submitted && item.correct === "wahr" ? "correct" : "",
            submitted && selected === "wahr" && isItemIncorrect ? "incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const falseClasses = [
            "truefalse-option",
            selected === "falsch" ? "selected" : "",
            submitted && item.correct === "falsch" ? "correct" : "",
            submitted && selected === "falsch" && isItemIncorrect ? "incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={item.id} className="truefalse-item">
              <div className="truefalse-question">{item.question}</div>
              <div className="truefalse-options">
                <button
                  type="button"
                  className={trueClasses}
                  onClick={() => onSelect(cardIndex, item.id, "wahr")}
                  aria-pressed={selected === "wahr"}
                  disabled={submitted}
                >
                  True
                </button>
                <button
                  type="button"
                  className={falseClasses}
                  onClick={() => onSelect(cardIndex, item.id, "falsch")}
                  aria-pressed={selected === "falsch"}
                  disabled={submitted}
                >
                  False
                </button>
              </div>
              {submitted ? (
                <span
                  className={`truefalse-result ${
                    isItemCorrect ? "correct" : "incorrect"
                  }`}
                >
                  {isItemCorrect ? "Correct" : "Incorrect"}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {showActions ? (
        <div className="flashcard-actions">
          {showSubmit ? (
            <button
              type="button"
              className="ghost small flashcard-submit"
              onClick={() => onSubmit(cardIndex, canSubmit)}
              disabled={submitted || !canSubmit || submissionLocked}
            >
              Submit
            </button>
          ) : null}
          {submitted ? (
            <span className={`flashcard-result ${isCorrect ? "correct" : "incorrect"}`}>
              {resultLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      {submitted ? (
        <div className="truefalse-solution">
          <span className="label">Solution</span>
          <ul className="truefalse-solution-list">
            {card.items.map((item) => (
              <li key={`solution-${item.id}`} className="truefalse-solution-item">
                <span>{item.question}</span>
                <span className="truefalse-solution-answer">
                  {item.correct === "wahr" ? "True" : "False"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
};

---

## 📝 icons.tsx — ./components/icons.tsx

export const FolderIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

export const FileIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 4h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    <path d="M14 4v5h5" />
  </svg>
);

export const CardsIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="6" width="12" height="7" rx="2" />
    <rect x="7" y="11" width="12" height="7" rx="2" />
  </svg>
);

export const HelpIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 1 1 5 1c0 1.4-1.5 2-2.4 2.7-0.4 0.3-0.6 0.7-0.6 1.3" />
    <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const SettingsIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="4" y1="6" x2="20" y2="6" />
    <circle cx="9" cy="6" r="2.5" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <circle cx="14" cy="12" r="2.5" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="11" cy="18" r="2.5" />
  </svg>
);

---

## 📝 KpiGrid.tsx — ./components/KpiGrid.tsx

type KpiItem = {
  label: string;
  value: number;
};

type KpiGridProps = {
  items: KpiItem[];
};

export const KpiGrid = ({ items }: KpiGridProps) => (
  <div className="kpi-grid">
    {items.map((kpi) => (
      <div key={kpi.label} className="kpi-card">
        <span className="kpi-label">{kpi.label}</span>
        <span className="kpi-value">{kpi.value}</span>
      </div>
    ))}
  </div>
);

---

## 📝 LargeVaultWarningModal.tsx — ./components/LargeVaultWarningModal.tsx

type LargeVaultWarningModalProps = {
  count: number | null;
  onClose: () => void;
};

export const LargeVaultWarningModal = ({
  count,
  onClose,
}: LargeVaultWarningModalProps) => {
  if (count === null) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="large-vault-warning-title"
        aria-describedby="large-vault-warning-body"
      >
        <h3 id="large-vault-warning-title">Large Vault Detected</h3>
        <div className="modal-body" id="large-vault-warning-body">
          <p className="muted">
            This vault contains {count} Markdown files. Loading and scanning may be
            slower.
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

---

## 📝 PreviewPanel.tsx — ./components/PreviewPanel.tsx

import { type MouseEvent, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";

const markdownSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
  ],
  attributes: {
    ...defaultSchema.attributes,
    table: [...(defaultSchema.attributes?.table ?? []), "className"],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
  },
};

type PreviewPanelProps = {
  editDraft: string;
  editError: string;
  editCaretIndex: number | null;
  isEditing: boolean;
  emptyPreview: string;
  preview: string;
  previewError: string;
  previewState: LoadState;
  rawPreview: boolean;
  selectedFile: VaultFile | null;
  canEdit: boolean;
  onEditChange: (value: string) => void;
  onEditCaretApplied: () => void;
  onEditExit: () => void;
  onEditStart: (options?: {
    caretIndex?: number | null;
    origin?: "raw" | "markdown";
  }) => void;
  onToggleRawPreview: () => void;
};

const getRangeOffset = (container: HTMLElement, range: Range) => {
  const offsetRange = document.createRange();
  offsetRange.setStart(container, 0);
  offsetRange.setEnd(range.startContainer, range.startOffset);
  return offsetRange.toString().length;
};

const getSelectionRange = (container: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer)) {
    return null;
  }
  return range;
};

const getRangeFromPoint = (x: number, y: number) => {
  if ("caretRangeFromPoint" in document) {
    return (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null })
      .caretRangeFromPoint?.(x, y) ?? null;
  }
  if ("caretPositionFromPoint" in document) {
    const position = (
      document as Document & {
        caretPositionFromPoint?: (
          x: number,
          y: number,
        ) => { offsetNode: Node; offset: number } | null;
      }
    ).caretPositionFromPoint?.(x, y);
    if (position) {
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
  }
  return null;
};

const getRangeFromEvent = (
  event: MouseEvent<HTMLDivElement>,
  container: HTMLElement,
) => {
  const rangeFromPoint = getRangeFromPoint(event.clientX, event.clientY);
  if (rangeFromPoint && container.contains(rangeFromPoint.startContainer)) {
    return rangeFromPoint;
  }
  return getSelectionRange(container);
};

const mapPlainOffsetToRawIndex = (rawMarkdown: string, plainOffset: number) => {
  if (plainOffset <= 0) {
    return 0;
  }
  let rawIndex = 0;
  let plainIndex = 0;
  let inFence = false;
  let inInlineCode = false;
  let inLinkText = false;
  let inLinkUrl = false;
  let lineStart = true;

  const skipToLineEnd = () => {
    while (rawIndex < rawMarkdown.length && rawMarkdown[rawIndex] !== "\n") {
      rawIndex += 1;
    }
  };

  while (rawIndex < rawMarkdown.length) {
    const char = rawMarkdown[rawIndex];

    if (lineStart && rawMarkdown.startsWith("```", rawIndex)) {
      inFence = !inFence;
      skipToLineEnd();
      continue;
    }

    if (char === "\n") {
      lineStart = true;
      if (plainIndex >= plainOffset) {
        return rawIndex;
      }
      plainIndex += 1;
      rawIndex += 1;
      continue;
    }

    if (lineStart && !inFence) {
      if (char === "#") {
        while (rawMarkdown[rawIndex] === "#") {
          rawIndex += 1;
        }
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
      if (char === ">") {
        rawIndex += 1;
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
      if (
        (char === "-" || char === "*" || char === "+") &&
        rawMarkdown[rawIndex + 1] === " "
      ) {
        rawIndex += 2;
        continue;
      }
      if (char >= "0" && char <= "9") {
        const markerStart = rawIndex;
        while (rawMarkdown[rawIndex] >= "0" && rawMarkdown[rawIndex] <= "9") {
          rawIndex += 1;
        }
        if (
          rawMarkdown[rawIndex] === "." &&
          rawMarkdown[rawIndex + 1] === " "
        ) {
          rawIndex += 2;
          continue;
        }
        rawIndex = markerStart;
      }
    }

    lineStart = false;

    if (!inFence) {
      if (inLinkUrl) {
        if (char === ")") {
          inLinkUrl = false;
        }
        rawIndex += 1;
        continue;
      }
      if (char === "`") {
        inInlineCode = !inInlineCode;
        rawIndex += 1;
        continue;
      }
      if (!inInlineCode && (char === "*" || char === "_")) {
        rawIndex += 1;
        continue;
      }
      if (char === "!" && rawMarkdown[rawIndex + 1] === "[") {
        rawIndex += 1;
        continue;
      }
      if (char === "[") {
        inLinkText = true;
        rawIndex += 1;
        continue;
      }
      if (inLinkText && char === "]") {
        inLinkText = false;
        if (rawMarkdown[rawIndex + 1] === "(") {
          inLinkUrl = true;
          rawIndex += 2;
          continue;
        }
        rawIndex += 1;
        continue;
      }
    }

    if (plainIndex >= plainOffset) {
      return rawIndex;
    }
    plainIndex += 1;
    rawIndex += 1;
  }

  return rawMarkdown.length;
};

const mapRawIndexToPlainOffset = (rawMarkdown: string, rawIndexTarget: number) => {
  if (rawIndexTarget <= 0) {
    return 0;
  }
  const target = Math.min(rawIndexTarget, rawMarkdown.length);
  let rawIndex = 0;
  let plainIndex = 0;
  let inFence = false;
  let inInlineCode = false;
  let inLinkText = false;
  let inLinkUrl = false;
  let lineStart = true;

  const skipToLineEnd = () => {
    while (rawIndex < rawMarkdown.length && rawMarkdown[rawIndex] !== "\n") {
      rawIndex += 1;
    }
  };

  while (rawIndex < rawMarkdown.length && rawIndex < target) {
    const char = rawMarkdown[rawIndex];

    if (lineStart && rawMarkdown.startsWith("```", rawIndex)) {
      inFence = !inFence;
      skipToLineEnd();
      continue;
    }

    if (char === "\n") {
      lineStart = true;
      plainIndex += 1;
      rawIndex += 1;
      continue;
    }

    if (lineStart && !inFence) {
      if (char === "#") {
        while (rawMarkdown[rawIndex] === "#") {
          rawIndex += 1;
        }
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
      if (char === ">") {
        rawIndex += 1;
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
      if (
        (char === "-" || char === "*" || char === "+") &&
        rawMarkdown[rawIndex + 1] === " "
      ) {
        rawIndex += 2;
        continue;
      }
      if (char >= "0" && char <= "9") {
        const markerStart = rawIndex;
        while (rawMarkdown[rawIndex] >= "0" && rawMarkdown[rawIndex] <= "9") {
          rawIndex += 1;
        }
        if (
          rawMarkdown[rawIndex] === "." &&
          rawMarkdown[rawIndex + 1] === " "
        ) {
          rawIndex += 2;
          continue;
        }
        rawIndex = markerStart;
      }
    }

    lineStart = false;

    if (!inFence) {
      if (inLinkUrl) {
        if (char === ")") {
          inLinkUrl = false;
        }
        rawIndex += 1;
        continue;
      }
      if (char === "`") {
        inInlineCode = !inInlineCode;
        rawIndex += 1;
        continue;
      }
      if (!inInlineCode && (char === "*" || char === "_")) {
        rawIndex += 1;
        continue;
      }
      if (char === "!" && rawMarkdown[rawIndex + 1] === "[") {
        rawIndex += 1;
        continue;
      }
      if (char === "[") {
        inLinkText = true;
        rawIndex += 1;
        continue;
      }
      if (inLinkText && char === "]") {
        inLinkText = false;
        if (rawMarkdown[rawIndex + 1] === "(") {
          inLinkUrl = true;
          rawIndex += 2;
          continue;
        }
        rawIndex += 1;
        continue;
      }
    }

    plainIndex += 1;
    rawIndex += 1;
  }

  return plainIndex;
};

const findTextNodeAtOffset = (container: HTMLElement, offset: number) => {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
  );
  const range = document.createRange();
  range.setStart(container, 0);

  let current = walker.nextNode() as Text | null;
  let lastTextNode: Text | null = null;

  while (current) {
    lastTextNode = current;
    const nodeLength = current.nodeValue?.length ?? 0;
    range.setEnd(current, nodeLength);
    const endOffset = range.toString().length;

    if (offset <= endOffset) {
      let low = 0;
      let high = nodeLength;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        range.setEnd(current, mid);
        const midOffset = range.toString().length;
        if (midOffset < offset) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      return { node: current, offset: low };
    }

    current = walker.nextNode() as Text | null;
  }

  if (lastTextNode) {
    return {
      node: lastTextNode,
      offset: lastTextNode.nodeValue?.length ?? 0,
    };
  }

  return null;
};

const setCaretAtPlainOffset = (container: HTMLElement, offset: number) => {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const length = container.innerText.length;
  const clampedOffset = Math.max(0, Math.min(offset, length));
  const resolved = findTextNodeAtOffset(container, clampedOffset);
  const range = document.createRange();
  if (resolved) {
    range.setStart(resolved.node, resolved.offset);
  } else {
    range.setStart(container, 0);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

const escapeMarkdownText = (text: string) =>
  text
    .replace(/\u00a0/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\~");

const escapeMarkdownLinkText = (text: string) =>
  escapeMarkdownText(text).replace(/\[/g, "\\[").replace(/]/g, "\\]");

const escapeMarkdownTableCell = (text: string) =>
  escapeMarkdownText(text).replace(/\|/g, "\\|");

const wrapInlineCode = (text: string) => {
  const normalized = text.replace(/\u00a0/g, " ").replace(/\n+/g, " ");
  const matches = normalized.match(/`+/g);
  const fenceLength = matches
    ? Math.max(...matches.map((match) => match.length)) + 1
    : 1;
  const fence = "`".repeat(fenceLength);
  const needsPadding =
    normalized.startsWith(" ") || normalized.endsWith(" ");
  const content = needsPadding ? ` ${normalized} ` : normalized;
  return `${fence}${content}${fence}`;
};

const wrapCodeBlock = (text: string) => {
  const normalized = text.replace(/\r\n?/g, "\n");
  const matches = normalized.match(/`+/g);
  const fenceLength = matches
    ? Math.max(...matches.map((match) => match.length)) + 1
    : 3;
  const fence = "`".repeat(Math.max(3, fenceLength));
  const trimmed = normalized.replace(/\n$/, "");
  return `${fence}\n${trimmed}\n${fence}\n\n`;
};

type MarkdownSerializeContext = {
  listDepth: number;
};

const serializeMarkdownChildren = (
  node: ParentNode,
  context: MarkdownSerializeContext,
) =>
  Array.from(node.childNodes)
    .map((child) => serializeMarkdownNode(child, context))
    .join("");

const serializeMarkdownNode = (
  node: Node,
  context: MarkdownSerializeContext,
): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdownText(node.nodeValue ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (tag === "br") {
    return "\n";
  }

  if (tag === "p" || tag === "div") {
    const content = serializeMarkdownChildren(element, context).trim();
    return content ? `${content}\n\n` : "\n\n";
  }

  if (tag.startsWith("h") && tag.length === 2) {
    const level = Number(tag[1]);
    if (!Number.isNaN(level)) {
      const content = serializeMarkdownChildren(element, context).trim();
      return `${"#".repeat(level)} ${content}\n\n`;
    }
  }

  if (tag === "strong" || tag === "b") {
    return `**${serializeMarkdownChildren(element, context)}**`;
  }

  if (tag === "em" || tag === "i") {
    return `*${serializeMarkdownChildren(element, context)}*`;
  }

  if (tag === "del" || tag === "s") {
    return `~~${serializeMarkdownChildren(element, context)}~~`;
  }

  if (tag === "code") {
    if (element.parentElement?.tagName.toLowerCase() === "pre") {
      return "";
    }
    return wrapInlineCode(element.textContent ?? "");
  }

  if (tag === "pre") {
    const code = element.querySelector("code")?.textContent ?? element.textContent ?? "";
    return wrapCodeBlock(code);
  }

  if (tag === "blockquote") {
    const content = serializeMarkdownChildren(element, context)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const lines = content.split("\n");
    return `${lines.map((line) => (line ? `> ${line}` : ">")).join("\n")}\n\n`;
  }

  if (tag === "ul" || tag === "ol") {
    return serializeMarkdownList(element, context);
  }

  if (tag === "li") {
    return serializeMarkdownChildren(element, context).trim();
  }

  if (tag === "a") {
    const href = element.getAttribute("href") ?? "";
    const text = serializeMarkdownChildren(element, context).trim();
    if (!href) {
      return text;
    }
    return `[${escapeMarkdownLinkText(text)}](${href})`;
  }

  if (tag === "hr") {
    return "---\n\n";
  }

  if (tag === "table") {
    return serializeMarkdownTable(element, context);
  }

  return serializeMarkdownChildren(element, context);
};

const serializeMarkdownList = (
  element: HTMLElement,
  context: MarkdownSerializeContext,
) => {
  const isOrdered = element.tagName.toLowerCase() === "ol";
  let index = Number(element.getAttribute("start") ?? "1");
  if (Number.isNaN(index)) {
    index = 1;
  }
  const indent = "  ".repeat(context.listDepth);
  const items = Array.from(element.children).filter(
    (child) => child.tagName.toLowerCase() === "li",
  );
  const lines: string[] = [];

  items.forEach((item, itemIndex) => {
    const content = serializeMarkdownChildren(item, {
      ...context,
      listDepth: context.listDepth + 1,
    })
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const marker = isOrdered ? `${index + itemIndex}. ` : "- ";
    const itemLines = content ? content.split("\n") : [""];
    lines.push(`${indent}${marker}${itemLines[0]}`);
    itemLines.slice(1).forEach((line) => {
      lines.push(`${indent}  ${line}`);
    });
  });

  return `${lines.join("\n")}\n\n`;
};

const serializeMarkdownTable = (
  element: HTMLElement,
  context: MarkdownSerializeContext,
) => {
  const rows = Array.from(element.querySelectorAll("tr"));
  if (rows.length === 0) {
    return "";
  }
  const headerRow =
    element.querySelector("thead tr") ?? rows[0];
  const headerCells = Array.from(headerRow.children).map((cell) =>
    serializeTableCell(cell as HTMLElement, context),
  );
  const bodyRows = rows.filter((row) => row !== headerRow);

  const headerLine = `| ${headerCells.join(" | ")} |`;
  const separatorLine = `| ${headerCells.map(() => "---").join(" | ")} |`;
  const bodyLines = bodyRows.map((row) => {
    const cells = Array.from(row.children).map((cell) =>
      serializeTableCell(cell as HTMLElement, context),
    );
    return `| ${cells.join(" | ")} |`;
  });

  return `${[headerLine, separatorLine, ...bodyLines].join("\n")}\n\n`;
};

const serializeTableCell = (
  element: HTMLElement,
  context: MarkdownSerializeContext,
) => {
  const text = serializeMarkdownChildren(element, context)
    .replace(/\n+/g, " ")
    .trim();
  return escapeMarkdownTableCell(text);
};

const serializeMarkdownFromHtml = (container: HTMLElement) => {
  const markdown = serializeMarkdownChildren(container, { listDepth: 0 });
  return markdown.replace(/\n{3,}/g, "\n\n").trimEnd();
};

const resolveRawCaretIndex = (container: HTMLElement, range: Range | null) => {
  const resolvedRange = range ?? getSelectionRange(container);
  if (!resolvedRange) {
    return null;
  }
  return getRangeOffset(container, resolvedRange);
};

const resolveMarkdownCaretIndex = (
  container: HTMLElement,
  rawMarkdown: string,
  range: Range | null,
) => {
  const resolvedRange = range ?? getSelectionRange(container);
  if (!resolvedRange) {
    return null;
  }
  const plainOffset = getRangeOffset(container, resolvedRange);
  if (rawMarkdown.length === 0) {
    return 0;
  }
  return mapPlainOffsetToRawIndex(rawMarkdown, plainOffset);
};

export const PreviewPanel = ({
  editDraft,
  editError,
  editCaretIndex,
  isEditing,
  emptyPreview,
  preview,
  previewError,
  previewState,
  rawPreview,
  selectedFile,
  canEdit,
  onEditChange,
  onEditCaretApplied,
  onEditExit,
  onEditStart,
  onToggleRawPreview,
}: PreviewPanelProps) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const markdownEditorRef = useRef<HTMLDivElement | null>(null);
  const markdownEditorHtmlRef = useRef<string | null>(null);
  const markdownEditorReadyRef = useRef(false);

  useEffect(() => {
    if (!isEditing || rawPreview) {
      markdownEditorReadyRef.current = false;
      if (!isEditing) {
        markdownEditorHtmlRef.current = null;
      }
      return;
    }
    if (!markdownEditorRef.current || markdownEditorReadyRef.current) {
      return;
    }
    markdownEditorRef.current.innerHTML = markdownEditorHtmlRef.current ?? "";
    markdownEditorReadyRef.current = true;
  }, [isEditing, rawPreview]);

  useEffect(() => {
    if (!isEditing || !rawPreview || !editorRef.current) {
      return;
    }
    if (typeof editCaretIndex !== "number") {
      return;
    }
    const editor = editorRef.current;
    const desiredIndex = editCaretIndex;
    const nextIndex = Math.max(0, Math.min(desiredIndex, editor.value.length));
    const handle = window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(nextIndex, nextIndex);
      onEditCaretApplied();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [editCaretIndex, isEditing, onEditCaretApplied, rawPreview]);

  useEffect(() => {
    if (!isEditing || rawPreview || !markdownEditorRef.current) {
      return;
    }
    if (typeof editCaretIndex !== "number") {
      return;
    }
    const editor = markdownEditorRef.current;
    const plainOffset = mapRawIndexToPlainOffset(editDraft, editCaretIndex);
    const handle = window.requestAnimationFrame(() => {
      editor.focus();
      setCaretAtPlainOffset(editor, plainOffset);
      onEditCaretApplied();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [editCaretIndex, editDraft, isEditing, onEditCaretApplied, rawPreview]);

  const handlePreviewClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!canEdit || isEditing) {
        return;
      }
      const origin = rawPreview ? "raw" : "markdown";
      let caretIndex = preview.length === 0 ? 0 : null;
      if (previewRef.current) {
        const selection = getSelectionRange(previewRef.current);
        if (selection && !selection.collapsed) {
          return;
        }
        const range = getRangeFromEvent(event, previewRef.current);
        const resolvedIndex = rawPreview
          ? resolveRawCaretIndex(previewRef.current, range)
          : resolveMarkdownCaretIndex(previewRef.current, preview, range);
        if (typeof resolvedIndex === "number") {
          caretIndex = resolvedIndex;
        }
        if (!rawPreview) {
          markdownEditorHtmlRef.current = previewRef.current.innerHTML;
        }
      } else if (!rawPreview) {
        markdownEditorHtmlRef.current = "";
      }
      if (caretIndex === null && preview.length > 0) {
        caretIndex = preview.length;
      }
      onEditStart({ caretIndex, origin });
    },
    [canEdit, isEditing, onEditStart, preview, rawPreview],
  );

  const handleMarkdownInput = useCallback(() => {
    if (!markdownEditorRef.current) {
      return;
    }
    const nextValue = serializeMarkdownFromHtml(markdownEditorRef.current);
    onEditChange(nextValue);
  }, [onEditChange]);

  return (
    <section className="panel preview-panel">
      <div className="panel-header">
        <div>
          <h2>Vorschau</h2>
          <p className="muted">
            {selectedFile?.relative_path ?? "Keine Datei ausgewaehlt"}
          </p>
        </div>
        <div className="preview-actions">
          <button
            type="button"
            className={`ghost small ${rawPreview ? "active" : ""}`}
            onClick={onToggleRawPreview}
            aria-pressed={rawPreview}
            disabled={!selectedFile}
          >
            {rawPreview ? "Markdown" : "Rohtext"}
          </button>
          {previewState === "loading" ? <span className="chip">Lade...</span> : null}
        </div>
      </div>
      <div className="panel-body preview-body">
        {previewState === "error" ? (
          <div className="error">{previewError}</div>
        ) : null}
        <div className="preview-content" onMouseUp={handlePreviewClick}>
          {isEditing ? (
            rawPreview ? (
              <textarea
                ref={editorRef}
                className="preview-editor"
                value={editDraft}
                onChange={(event) => onEditChange(event.target.value)}
                onBlur={onEditExit}
                aria-label="Edit markdown preview"
              />
            ) : (
              <div
                ref={markdownEditorRef}
                className="preview preview-editor markdown"
                contentEditable
                suppressContentEditableWarning
                onInput={handleMarkdownInput}
                onBlur={onEditExit}
                role="textbox"
                aria-multiline="true"
                aria-label="Edit markdown preview"
              />
            )
          ) : preview ? (
            <div
              ref={previewRef}
              className={`preview ${rawPreview ? "raw" : "markdown"}`}
            >
              {rawPreview ? (
                <pre>{preview}</pre>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[[rehypeSanitize, markdownSchema]]}
                  components={{
                    table: ({ node: _node, ...props }) => (
                      <div className="markdown-table">
                        <table {...props} />
                      </div>
                    ),
                  }}
                >
                  {preview}
                </ReactMarkdown>
              )}
            </div>
          ) : (
            <div className="preview placeholder">{emptyPreview}</div>
          )}
        </div>
        {editError ? <div className="error">{editError}</div> : null}
      </div>
    </section>
  );
};

---

## 📝 AppearanceSection.tsx — ./components/settings/AppearanceSection.tsx

import { type ThemeMode } from "../../lib/theme";

type AppearanceSectionProps = {
  accentColor: string;
  accentDraft: string;
  accentError: string;
  editorExactColors: boolean;
  editorBlueprintGrid: boolean;
  editorBlueprintGridIntensity: "light" | "medium" | "strong";
  onAccentInputChange: (value: string) => void;
  onAccentPick: (value: string) => void;
  onCopyAccent: () => void;
  onEditorExactColorsToggle: (value: boolean) => void;
  onEditorBlueprintGridToggle: (value: boolean) => void;
  onEditorBlueprintGridIntensityChange: (
    value: "light" | "medium" | "strong",
  ) => void;
  onThemeToggle: (nextTheme: ThemeMode) => void;
  theme: ThemeMode;
};

const ACCENT_PALETTE = [
  "#E07A5F",
  "#2F8F83",
  "#3A7D44",
  "#3B82F6",
  "#D97706",
  "#DC2626",
];
const GRID_INTENSITY_OPTIONS: Array<"light" | "medium" | "strong"> = [
  "light",
  "medium",
  "strong",
];

export const AppearanceSection = ({
  accentColor,
  accentDraft,
  accentError,
  editorExactColors,
  editorBlueprintGrid,
  editorBlueprintGridIntensity,
  onAccentInputChange,
  onAccentPick,
  onCopyAccent,
  onEditorExactColorsToggle,
  onEditorBlueprintGridToggle,
  onEditorBlueprintGridIntensityChange,
  onThemeToggle,
  theme,
}: AppearanceSectionProps) => (
  <section className="panel appearance-panel">
    <h2>Appearance</h2>
    <p className="muted">
      Theme und Akzentfarbe praegen die Oberflaeche und bleiben gespeichert.
    </p>
    <div className="appearance-layout">
      <div className="appearance-main">
        <div className="setting-row">
          <span className="label">Theme</span>
          <div className="theme-toggle">
            <span className="toggle-label">Hell</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={theme === "dark"}
                onChange={(event) =>
                  onThemeToggle(event.target.checked ? "dark" : "light")
                }
                aria-label="Theme umschalten"
              />
              <span className="slider" />
            </label>
            <span className="toggle-label">Dunkel</span>
          </div>
          <span className="helper-text">
            Wechselt Hintergrund, Kontrast und Panels.
          </span>
        </div>
        <div className="setting-row">
          <span className="label">Akzentfarbe</span>
          <div className="accent-controls">
            <input
              type="color"
              className="color-wheel"
              value={accentColor}
              onChange={(event) => onAccentPick(event.target.value)}
              aria-label="Akzentfarbe auswaehlen"
            />
            <div className="accent-palette">
              {ACCENT_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`accent-swatch ${
                    accentColor === color ? "active" : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => onAccentPick(color)}
                  aria-label={`Akzentfarbe ${color}`}
                />
              ))}
            </div>
          </div>
          <div className="accent-hex">
            <input
              type="text"
              className="hex-input"
              value={accentDraft}
              onChange={(event) => onAccentInputChange(event.target.value)}
              placeholder="#RRGGBB"
              aria-label="Akzentfarbe als HEX"
            />
            <button type="button" className="ghost small" onClick={onCopyAccent}>
              Kopieren
            </button>
          </div>
          <span className={`helper-text ${accentError ? "error-text" : ""}`}>
            {accentError || "HEX Wert der Akzentfarbe (#RRGGBB)."}
          </span>
        </div>
      </div>
      <div className="appearance-editor-panel">
        <header className="appearance-editor-header">
          <h3>Markdown Editor</h3>
        </header>
        <div className="setting-row">
          <span className="label">EXACT COLORS (MARKDOWN EDITOR)</span>
          <div className="theme-toggle">
            <span className="toggle-label">Off</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={editorExactColors}
                onChange={(event) =>
                  onEditorExactColorsToggle(event.target.checked)
                }
                aria-label="Exact markdown editor colors"
              />
              <span className="slider" />
            </label>
            <span className="toggle-label">On</span>
          </div>
        </div>
        <div className="setting-row">
          <span className="label">BLUEPRINT GRID (MARKDOWN EDITOR)</span>
          <div className="appearance-editor-inline">
            <div className="theme-toggle">
              <span className="toggle-label">Off</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={editorBlueprintGrid}
                  onChange={(event) =>
                    onEditorBlueprintGridToggle(event.target.checked)
                  }
                  aria-label="Blueprint grid for markdown editor"
                />
                <span className="slider" />
              </label>
              <span className="toggle-label">On</span>
            </div>
            <div className="appearance-grid-intensity">
              <span className="toggle-label">Intensity</span>
              <div className="pill-grid">
                {GRID_INTENSITY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`pill pill-button ${
                      editorBlueprintGridIntensity === option ? "active" : ""
                    }`}
                    aria-pressed={editorBlueprintGridIntensity === option}
                    onClick={() => onEditorBlueprintGridIntensityChange(option)}
                  >
                    {option.charAt(0).toUpperCase()}
                    {option.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

---

## 📝 DataSyncTabContent.tsx — ./components/settings/DataSyncTabContent.tsx

type AppLanguage = "de" | "en";

const LANGUAGE_LABELS: Record<
  AppLanguage,
  { heading: string; placeholder: string; deLabel: string; enLabel: string }
> = {
  de: {
    heading: "Sprache",
    placeholder: "Kommt spaeter.",
    deLabel: "Deutsch",
    enLabel: "Englisch",
  },
  en: {
    heading: "Language",
    placeholder: "Coming later.",
    deLabel: "German",
    enLabel: "English",
  },
};

export const DataSyncTabContent = () => (
  <>
    <div className="setting-row">
      <span className="label">Local storage path</span>
      <input
        type="text"
        className="text-input"
        value="—"
        disabled
        aria-label="Local storage path"
      />
    </div>
    <div className="setting-row">
      <span className="label">Export / Import (JSON)</span>
      <div className="setting-actions">
        <button type="button" className="ghost small" disabled>
          Export JSON
        </button>
        <button type="button" className="ghost small" disabled>
          Import JSON
        </button>
      </div>
      <span className="helper-text">Coming later.</span>
    </div>
    <div className="setting-row">
      <span className="label">Sync provider</span>
      <input
        type="text"
        className="text-input"
        value="Coming later."
        disabled
        aria-label="Sync provider"
      />
    </div>
  </>
);

type LanguageTabContentProps = {
  language: AppLanguage;
  onLanguageChange: (value: AppLanguage) => void;
};

export const LanguageTabContent = ({
  language,
  onLanguageChange,
}: LanguageTabContentProps) => {
  const labels = LANGUAGE_LABELS[language];
  return (
    <>
      <p className="muted">{labels.placeholder}</p>
      <div className="setting-row">
        <span className="label">{labels.heading}</span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${language === "de" ? "active" : ""}`}
            aria-pressed={language === "de"}
            onClick={() => onLanguageChange("de")}
          >
            {labels.deLabel}
          </button>
          <button
            type="button"
            className={`pill pill-button ${language === "en" ? "active" : ""}`}
            aria-pressed={language === "en"}
            onClick={() => onLanguageChange("en")}
          >
            {labels.enLabel}
          </button>
        </div>
        <span className="helper-text">{labels.placeholder}</span>
      </div>
    </>
  );
};

---

## 📝 FastFlashcardToolsSettings.tsx — ./components/settings/FastFlashcardToolsSettings.tsx

import { type FlashcardMode, type FlashcardOrder, type FlashcardScope } from "../../features/flashcards/useFlashcards";

type FastFlashcardToolsSettingsProps = {
  fastFlashcardOrder: FlashcardOrder;
  fastFlashcardMode: FlashcardMode;
  fastFlashcardScope: FlashcardScope;
  setFastFlashcardOrder: (value: FlashcardOrder) => void;
  setFastFlashcardMode: (value: FlashcardMode) => void;
  setFastFlashcardScope: (value: FlashcardScope) => void;
  showSectionDividers?: boolean;
};

export const FastFlashcardToolsSettings = ({
  fastFlashcardOrder,
  fastFlashcardMode,
  fastFlashcardScope,
  setFastFlashcardOrder,
  setFastFlashcardMode,
  setFastFlashcardScope,
  showSectionDividers = false,
}: FastFlashcardToolsSettingsProps) => {
  const containerClass = [
    "fast-flashcard-tools-settings",
    showSectionDividers ? "fast-flashcard-tools-settings--dividers" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClass}>
      <div className="fast-flashcard-tools-settings-section">
        <div className="toolbar-section">
          <span className="label">ORDER</span>
          <div className="pill-grid">
            <button
              type="button"
              className={`pill pill-button ${
                fastFlashcardOrder === "in-order" ? "active" : ""
              }`}
              aria-pressed={fastFlashcardOrder === "in-order"}
              onClick={() => setFastFlashcardOrder("in-order")}
            >
              In order
            </button>
            <button
              type="button"
              className={`pill pill-button ${
                fastFlashcardOrder === "random" ? "active" : ""
              }`}
              aria-pressed={fastFlashcardOrder === "random"}
              onClick={() => setFastFlashcardOrder("random")}
            >
              Random
            </button>
          </div>
        </div>
      </div>
      <div className="fast-flashcard-tools-settings-section">
        <div className="toolbar-section">
          <span className="label">MODE</span>
          <select
            className="text-input"
            value={fastFlashcardMode}
            onChange={(event) =>
              setFastFlashcardMode(event.target.value as FlashcardMode)
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
      </div>
      <div className="fast-flashcard-tools-settings-section">
        <div className="toolbar-section">
          <span className="label">DEFAULT SCOPE</span>
          <div className="pill-grid">
            <button
              type="button"
              className={`pill pill-button ${
                fastFlashcardScope === "current" ? "active" : ""
              }`}
              aria-pressed={fastFlashcardScope === "current"}
              onClick={() => setFastFlashcardScope("current")}
            >
              Current note
            </button>
            <button
              type="button"
              className={`pill pill-button ${
                fastFlashcardScope === "vault" ? "active" : ""
              }`}
              aria-pressed={fastFlashcardScope === "vault"}
              onClick={() => setFastFlashcardScope("vault")}
            >
              Whole vault
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

---

## 📝 FlashcardsSettingsSection.tsx — ./components/settings/FlashcardsSettingsSection.tsx

import type {
  FlashcardMode,
  FlashcardOrder,
  FlashcardPageSize,
  FlashcardScope,
  StatsResetMode,
} from "../../features/flashcards/useFlashcards";

type FlashcardsSettingsSectionProps = {
  flashcardMode: FlashcardMode;
  flashcardOrder: FlashcardOrder;
  flashcardPageSize: FlashcardPageSize;
  flashcardPageSizes: FlashcardPageSize[];
  flashcardScope: FlashcardScope;
  setFlashcardMode: (value: FlashcardMode) => void;
  setFlashcardOrder: (value: FlashcardOrder) => void;
  setFlashcardPageSize: (value: FlashcardPageSize) => void;
  setFlashcardScope: (value: FlashcardScope) => void;
  setStatsResetMode: (value: StatsResetMode) => void;
  statsResetMode: StatsResetMode;
};

export const FlashcardsSettingsSection = ({
  flashcardMode,
  flashcardOrder,
  flashcardPageSize,
  flashcardPageSizes,
  flashcardScope,
  setFlashcardMode,
  setFlashcardOrder,
  setFlashcardPageSize,
  setFlashcardScope,
  setStatsResetMode,
  statsResetMode,
}: FlashcardsSettingsSectionProps) => (
  <section className="panel settings-flashcards-panel">
    <div className="panel-header">
      <div>
        <h2>Flashcard Tools</h2>
        <p className="muted">Default behavior for scans and review sessions.</p>
      </div>
    </div>
    <div className="panel-body">
      <div className="setting-row">
        <span className="label">DEFAULT ORDER</span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${
              flashcardOrder === "in-order" ? "active" : ""
            }`}
            aria-pressed={flashcardOrder === "in-order"}
            onClick={() => setFlashcardOrder("in-order")}
          >
            In order
          </button>
          <button
            type="button"
            className={`pill pill-button ${flashcardOrder === "random" ? "active" : ""}`}
            aria-pressed={flashcardOrder === "random"}
            onClick={() => setFlashcardOrder("random")}
          >
            Random
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">MODE</span>
        <select
          className="text-input"
          value={flashcardMode}
          onChange={(event) =>
            setFlashcardMode(event.target.value as FlashcardMode)
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
        <span className="label">PAGE SIZE</span>
        <div className="pill-grid">
          {flashcardPageSizes.map((size) => (
            <button
              key={size}
              type="button"
              className={`pill pill-button ${
                flashcardPageSize === size ? "active" : ""
              }`}
              aria-pressed={flashcardPageSize === size}
              onClick={() => setFlashcardPageSize(size)}
            >
              {size}
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
              flashcardScope === "current" ? "active" : ""
            }`}
            aria-pressed={flashcardScope === "current"}
            onClick={() => setFlashcardScope("current")}
          >
            Current note
          </button>
          <button
            type="button"
            className={`pill pill-button ${flashcardScope === "vault" ? "active" : ""}`}
            aria-pressed={flashcardScope === "vault"}
            onClick={() => setFlashcardScope("vault")}
          >
            Whole vault
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">STATISTICS RESET</span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${statsResetMode === "scan" ? "active" : ""}`}
            aria-pressed={statsResetMode === "scan"}
            onClick={() => setStatsResetMode("scan")}
          >
            Per scan
          </button>
          <button
            type="button"
            className={`pill pill-button ${statsResetMode === "session" ? "active" : ""}`}
            aria-pressed={statsResetMode === "session"}
            onClick={() => setStatsResetMode("session")}
          >
            Per session
          </button>
        </div>
      </div>
    </div>
  </section>
);

---

## 📝 PerformanceTabContent.tsx — ./components/settings/PerformanceTabContent.tsx

type PerformanceTabContentProps = {
  maxFilesPerScan: string;
  onMaxFilesPerScanChange: (value: string) => void;
  scanParallelism: "low" | "medium" | "high";
  setScanParallelism: (value: "low" | "medium" | "high") => void;
};

export const PerformanceTabContent = ({
  maxFilesPerScan,
  onMaxFilesPerScanChange,
  scanParallelism,
  setScanParallelism,
}: PerformanceTabContentProps) => (
  <>
    <div className="setting-row">
      <span className="label">Max files per vault scan</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="text-input"
        value={maxFilesPerScan}
        onChange={(event) => onMaxFilesPerScanChange(event.target.value)}
        placeholder="Optional"
        aria-label="Max files per vault scan"
      />
      <span className="helper-text">
        Leave empty to disable the large vault warning.
      </span>
    </div>
    <div className="setting-row">
      <span className="label">Scan parallelism</span>
      <div className="pill-grid">
        {(["low", "medium", "high"] as const).map((level) => (
          <button
            key={level}
            type="button"
            className={`pill pill-button ${scanParallelism === level ? "active" : ""}`}
            aria-pressed={scanParallelism === level}
            onClick={() => setScanParallelism(level)}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>
    </div>
  </>
);

---

## 📝 ResetSessionHistoryModal.tsx — ./components/settings/ResetSessionHistoryModal.tsx

type ResetSessionHistoryModalProps = {
  isOpen: boolean;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ResetSessionHistoryModal = ({
  isOpen,
  isPending = false,
  onCancel,
  onConfirm,
}: ResetSessionHistoryModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-session-history-title"
        aria-describedby="reset-session-history-body"
      >
        <h3 id="reset-session-history-title">Reset Session History</h3>
        <div className="modal-body" id="reset-session-history-body">
          <p className="muted">
            This will delete all saved session results (top scores and recent runs).
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Resetting..." : "Reset"}
          </button>
        </div>
      </div>
    </div>
  );
};

---

## 📝 SpacedRepetitionSettingsSection.tsx — ./components/settings/SpacedRepetitionSettingsSection.tsx

import type {
  SpacedRepetitionBoxes,
  SpacedRepetitionOrder,
  SpacedRepetitionPageSize,
  SpacedRepetitionRepetitionStrength,
} from "../../features/spaced-repetition/useSpacedRepetition";

type SpacedRepetitionSettingsSectionProps = {
  spacedRepetitionBoxes: SpacedRepetitionBoxes;
  spacedRepetitionBoxOptions: SpacedRepetitionBoxes[];
  spacedRepetitionOrder: SpacedRepetitionOrder;
  spacedRepetitionPageSize: SpacedRepetitionPageSize;
  spacedRepetitionPageSizes: SpacedRepetitionPageSize[];
  spacedRepetitionRepetitionStrength: SpacedRepetitionRepetitionStrength;
  setSpacedRepetitionBoxes: (value: SpacedRepetitionBoxes) => void;
  setSpacedRepetitionOrder: (value: SpacedRepetitionOrder) => void;
  setSpacedRepetitionPageSize: (value: SpacedRepetitionPageSize) => void;
  setSpacedRepetitionRepetitionStrength: (
    value: SpacedRepetitionRepetitionStrength,
  ) => void;
};

export const SpacedRepetitionSettingsSection = ({
  spacedRepetitionBoxes,
  spacedRepetitionBoxOptions,
  spacedRepetitionOrder,
  spacedRepetitionPageSize,
  spacedRepetitionPageSizes,
  spacedRepetitionRepetitionStrength,
  setSpacedRepetitionBoxes,
  setSpacedRepetitionOrder,
  setSpacedRepetitionPageSize,
  setSpacedRepetitionRepetitionStrength,
}: SpacedRepetitionSettingsSectionProps) => (
  <section className="panel spaced-repetition-panel">
    <div className="panel-header">
      <div>
        <h2>Spaced Repetition Tools</h2>
        <p className="muted">Configure spaced repetition behavior.</p>
      </div>
    </div>
    <div className="panel-body">
      <div className="setting-row">
        <span className="label">DEFAULT ORDER</span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionOrder === "in-order" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionOrder === "in-order"}
            onClick={() => setSpacedRepetitionOrder("in-order")}
          >
            In order
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionOrder === "random" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionOrder === "random"}
            onClick={() => setSpacedRepetitionOrder("random")}
          >
            Random
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionOrder === "repetition" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionOrder === "repetition"}
            onClick={() => setSpacedRepetitionOrder("repetition")}
          >
            Repetition
          </button>
        </div>
        <span className="helper-text">
          In order keeps scan order. Random shuffles on load. Repetition prioritizes
          lower boxes and skips the last box.
        </span>
      </div>
      <div className="setting-row">
        <span className="label">PAGE SIZE</span>
        <div className="pill-grid">
          {spacedRepetitionPageSizes.map((size) => (
            <button
              key={size}
              type="button"
              className={`pill pill-button ${
                spacedRepetitionPageSize === size ? "active" : ""
              }`}
              aria-pressed={spacedRepetitionPageSize === size}
              onClick={() => setSpacedRepetitionPageSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span className="label">BOXES</span>
        <div className="pill-grid">
          {spacedRepetitionBoxOptions.map((box) => (
            <button
              key={box}
              type="button"
              className={`pill pill-button ${spacedRepetitionBoxes === box ? "active" : ""}`}
              aria-pressed={spacedRepetitionBoxes === box}
              onClick={() => setSpacedRepetitionBoxes(box)}
            >
              {box} Boxes
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span className="label">REPETITION STRENGTH</span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionRepetitionStrength === "weak" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionRepetitionStrength === "weak"}
            onClick={() => setSpacedRepetitionRepetitionStrength("weak")}
          >
            Weak
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionRepetitionStrength === "medium" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionRepetitionStrength === "medium"}
            onClick={() => setSpacedRepetitionRepetitionStrength("medium")}
          >
            Medium
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionRepetitionStrength === "strong" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionRepetitionStrength === "strong"}
            onClick={() => setSpacedRepetitionRepetitionStrength("strong")}
          >
            Strong
          </button>
        </div>
      </div>
    </div>
  </section>
);

---

## 📝 VaultIndexSection.tsx — ./components/settings/VaultIndexSection.tsx

import { useState } from "react";
import { type LoadState } from "../../lib/types";
import { DataSyncTabContent } from "./DataSyncTabContent";

type VaultIndexTab = "vault" | "data-sync";

type VaultIndexSectionProps = {
  lastOpenedFile: string | null;
  listState: LoadState;
  onCopyVaultPath: () => void;
  onRescanVault: () => void;
  vaultIndexedComplete: boolean;
  vaultPath: string | null;
};

export const VaultIndexSection = ({
  lastOpenedFile,
  listState,
  onCopyVaultPath,
  onRescanVault,
  vaultIndexedComplete,
  vaultPath,
}: VaultIndexSectionProps) => {
  const [activeTab, setActiveTab] = useState<VaultIndexTab>("vault");
  const isVaultTab = activeTab === "vault";

  return (
    <section className="panel vault-index-panel">
      <div className="panel-header settings-tab-header">
        <div>
          <h2>Vault &amp; Index</h2>
        </div>
        <div className="settings-tabs" role="tablist" aria-label="Vault settings tabs">
          <button
            type="button"
            className={`pill pill-button ${isVaultTab ? "active" : ""}`}
            onClick={() => setActiveTab("vault")}
            role="tab"
            aria-selected={isVaultTab}
            aria-controls="vault-index-tab-panel"
            id="vault-index-tab"
          >
            Vault &amp; Index
          </button>
          <button
            type="button"
            className={`pill pill-button ${isVaultTab ? "" : "active"}`}
            onClick={() => setActiveTab("data-sync")}
            role="tab"
            aria-selected={!isVaultTab}
            aria-controls="data-sync-tab-panel"
            id="data-sync-tab"
          >
            Data &amp; Sync
          </button>
        </div>
      </div>
      {isVaultTab ? (
        <div
          className="settings-tab-panel"
          role="tabpanel"
          id="vault-index-tab-panel"
          aria-labelledby="vault-index-tab"
        >
          <p className="muted">Vault path, last opened note, and index status.</p>
          <div className="setting-row">
            <span className="label">Current vault path</span>
            <div className="setting-inline">
              <span className="value path-value">{vaultPath ?? "—"}</span>
              <button
                type="button"
                className="ghost small"
                onClick={onCopyVaultPath}
                disabled={!vaultPath}
              >
                Copy
              </button>
            </div>
          </div>
          <div className="setting-row">
            <span className="label">Last opened</span>
            <span className="value path-value">
              {lastOpenedFile ?? "Not loaded yet"}
            </span>
          </div>
          <div className="setting-row">
            <span className="label">Status indicators</span>
            <div className="status-list">
              <div className="status-item">
                <label className="status-checkbox">
                  <input
                    type="checkbox"
                    checked={vaultIndexedComplete}
                    disabled
                    aria-label="Fully processed"
                  />
                  <span>Fully processed</span>
                </label>
                <span className="helper-text">
                  All notes have been scanned and indexed.
                </span>
              </div>
              <div className="status-item">
                <div className="status-row">
                  <span>Watcher active</span>
                  <div className="toggle-row">
                    <span className="toggle-label">Coming later</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={false}
                        disabled
                        aria-label="Watcher active (coming later)"
                      />
                      <span className="slider" />
                    </label>
                  </div>
                </div>
              </div>
              <div className="status-item">
                <div className="status-row">
                  <span>Auto-scan</span>
                  <div className="toggle-row">
                    <span className="toggle-label">Coming later</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={false}
                        disabled
                        aria-label="Auto-scan (coming later)"
                      />
                      <span className="slider" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="setting-row">
            <span className="label">Actions</span>
            <div className="setting-actions">
              <button
                type="button"
                className="ghost small"
                onClick={onRescanVault}
                disabled={!vaultPath || listState === "loading"}
              >
                Rescan vault
              </button>
              <button type="button" className="ghost small" disabled>
                Reset index
              </button>
            </div>
            <span className="helper-text">Reset index is coming later.</span>
          </div>
        </div>
      ) : (
        <div
          className="settings-tab-panel"
          role="tabpanel"
          id="data-sync-tab-panel"
          aria-labelledby="data-sync-tab"
        >
          <p className="muted">Storage and sync options will land here later.</p>
          <div className="settings-tab-content">
            <DataSyncTabContent />
          </div>
        </div>
      )}
    </section>
  );
};

---

## 📝 SidebarNav.tsx — ./components/SidebarNav.tsx

import { useMemo, useState } from "react";
import { useAppState } from "./AppStateProvider";
import { vaultBaseName } from "../lib/path";
import { VaultTree } from "./VaultTree";
import { CardsIcon, FolderIcon, HelpIcon, SettingsIcon } from "./icons";
import { helpTopics, resolveText } from "../pages/help/helpContent";
import { SETTINGS_PAGES } from "../features/settings/settingsNavigation";

type TabKey =
  | "dashboard"
  | "flashcard"
  | "spaced-repetition"
  | "fast-flashcard"
  | "help"
  | "settings";

type ToolbarMode = "cards" | "vault" | "settings" | "help";

type SidebarNavProps = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  isMobileNavOpen: boolean;
  onMobileNavClose: () => void;
};

export const SidebarNav = ({
  activeTab,
  onTabChange,
  isMobileNavOpen,
  onMobileNavClose,
}: SidebarNavProps) => {
  const { actions, help, preview, settings, settingsNav, vault } = useAppState();
  const [toolbarMode, setToolbarMode] = useState<ToolbarMode>("cards");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const { activeSettingsPage, setActiveSettingsPage } = settingsNav;
  const isToolbarCollapsed = settings.rightToolbarCollapsed;
  const vaultRootName = useMemo(
    () => vaultBaseName(vault.vaultPath),
    [vault.vaultPath],
  );
  const fileCountLabel = useMemo(() => {
    if (!vault.vaultPath) {
      return "No vault selected";
    }
    if (vault.files.length === 0) {
      return "Keine Markdown-Dateien";
    }
    return `${vault.files.length} Markdown-Datei${
      vault.files.length === 1 ? "" : "en"
    }`;
  }, [vault.files.length, vault.vaultPath]);
  const isCollapsed = isToolbarCollapsed && !isMobileNavOpen;
  const isCardsTab =
    activeTab === "dashboard" ||
    activeTab === "flashcard" ||
    activeTab === "fast-flashcard" ||
    activeTab === "spaced-repetition";
  const toggleLabel = isToolbarCollapsed ? "Expand toolbar" : "Collapse toolbar";
  const toggleSymbol = isToolbarCollapsed ? ">" : "<";
  const helpTopicOrder = [
    "flashcard-syntax",
    "app-sections",
    "settings",
    "advanced",
    "vault",
    "extras",
  ];
  const helpNavTopics = helpTopicOrder
    .map((id) => helpTopics.find((topic) => topic.id === id))
    .filter((topic): topic is (typeof helpTopics)[number] => Boolean(topic));
  const handleTogglePath = (path: string, isOpen: boolean) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (isOpen) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  };

  return (
    <aside
      id="app-sidebar"
      className={`sidebar ${isCollapsed ? "collapsed" : ""}`}
      aria-label="Primary navigation"
    >
      <button
        type="button"
        className="sidebar-handle"
        onClick={() => settings.setRightToolbarCollapsed((prev) => !prev)}
        aria-label={toggleLabel}
        title={toggleLabel}
      >
        <span className="sidebar-handle-chevron" aria-hidden="true">
          {toggleSymbol}
        </span>
      </button>
      {isCollapsed ? null : (
        <>
          <div className="sidebar-head">
            <button
              type="button"
              className="mobile-nav-close"
              onClick={onMobileNavClose}
              aria-label="Close navigation"
            >
              Close
            </button>
            <button
              type="button"
              className="vault-status"
              onClick={actions.handlePickVault}
              title={vault.vaultPath ?? "Select vault"}
              aria-label="Select vault"
            >
              <span className="label">Active Vault</span>
              <span className="value">
                Vault: {vault.vaultPath ? vaultRootName : "Not set"}
              </span>
            </button>
            <div className="sidebar-icon-row">
              <button
                type="button"
                className={`nav-icon sidebar-icon-button ${
                  toolbarMode === "cards" ? "active" : ""
                }`}
                onClick={() => {
                  setToolbarMode("cards");
                  if (!isCardsTab) {
                    onTabChange("flashcard");
                  }
                }}
                aria-label="Study flashcards"
                title="Study"
              >
                <CardsIcon />
              </button>
              <button
                type="button"
                className={`nav-icon sidebar-icon-button ${
                  toolbarMode === "vault" ? "active" : ""
                }`}
                onClick={() => {
                  setToolbarMode("vault");
                  if (activeTab !== "dashboard") {
                    onTabChange("dashboard");
                  }
                }}
                aria-label="Vault directory"
                aria-controls="sidebar-vault-panel"
                aria-expanded={toolbarMode === "vault"}
                title="Vault directory"
              >
                <FolderIcon />
              </button>
              <button
                type="button"
                className={`nav-icon sidebar-icon-button ${
                  toolbarMode === "settings" ? "active" : ""
                }`}
                onClick={() => {
                  setToolbarMode("settings");
                  onTabChange("settings");
                }}
                aria-label="Settings"
                title="Settings"
              >
                <SettingsIcon />
              </button>
              <button
                type="button"
                className={`nav-icon sidebar-icon-button ${
                  toolbarMode === "help" ? "active" : ""
                }`}
                onClick={() => {
                  setToolbarMode("help");
                  onTabChange("help");
                }}
                aria-label="Help"
                title="Help"
              >
                <HelpIcon />
              </button>
            </div>
            <div
              className="sidebar-divider sidebar-divider-muted"
              aria-hidden="true"
            />
          </div>
          {toolbarMode === "cards" ? (
            <nav className="nav">
              <button
                type="button"
                className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
                onClick={() => onTabChange("dashboard")}
              >
                Makedon
              </button>
              <button
                type="button"
                className={`nav-item ${activeTab === "flashcard" ? "active" : ""}`}
                onClick={() => onTabChange("flashcard")}
              >
                Flashcard
              </button>
              <button
                type="button"
                className={`nav-item ${
                  activeTab === "fast-flashcard" ? "active" : ""
                }`}
                onClick={() => onTabChange("fast-flashcard")}
              >
                Fast Flashcard
              </button>
              <button
                type="button"
                className={`nav-item ${
                  activeTab === "spaced-repetition" ? "active" : ""
                }`}
                onClick={() => onTabChange("spaced-repetition")}
              >
                Spaced Repetition
              </button>
            </nav>
          ) : null}
          {toolbarMode === "vault" ? (
            <div className="sidebar-vault-panel" id="sidebar-vault-panel">
              <VaultTree
                expandedPaths={expandedPaths}
                fileCountLabel={fileCountLabel}
                files={vault.files}
                listError={vault.listError}
                listState={vault.listState}
                onTogglePath={handleTogglePath}
                onSelectFile={actions.handleSelectFile}
                selectedFile={preview.selectedFile}
                vaultPath={vault.vaultPath}
              />
            </div>
          ) : null}
          {toolbarMode === "settings" ? (
            <>
              <nav className="nav settings-nav" aria-label="Settings pages">
                {SETTINGS_PAGES.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    className={`nav-item ${
                      activeSettingsPage === page.id ? "active" : ""
                    }`}
                    aria-pressed={activeSettingsPage === page.id}
                    aria-controls={`settings-page-${page.id}`}
                    onClick={() => {
                      setActiveSettingsPage(page.id);
                      if (activeTab !== "settings") {
                        onTabChange("settings");
                      }
                    }}
                  >
                    {page.label}
                  </button>
                ))}
              </nav>
            </>
          ) : null}
          {toolbarMode === "help" ? (
            <nav className="nav">
              {helpNavTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className={`nav-item ${
                    help.activeTopicId === topic.id ? "active" : ""
                  }`}
                  onClick={() => {
                    help.setActiveTopicId(topic.id);
                    onTabChange("help");
                  }}
                >
                  {resolveText(topic.title, settings.language)}
                </button>
              ))}
            </nav>
          ) : null}
        </>
      )}
    </aside>
  );
};

---

## 📝 StatsPanel.tsx — ./components/StatsPanel.tsx

import { useMemo, type CSSProperties } from "react";

type StatsPanelProps = {
  correctCount: number;
  correctPercent: number;
  incorrectCount: number;
  totalQuestions: number;
};

export const StatsPanel = ({
  correctCount,
  correctPercent,
  incorrectCount,
  totalQuestions,
}: StatsPanelProps) => {
  const statsTotal = correctCount + incorrectCount;
  const statsChartStyle = useMemo(
    () =>
      ({
        "--correct-percent": `${correctPercent}%`,
      }) as CSSProperties,
    [correctPercent],
  );
  const statsChartClass = statsTotal === 0 ? "stats-chart empty" : "stats-chart";

  return (
    <section className="panel stats-panel">
      <div className="panel-header">
        <div>
          <h2>Statistics</h2>
        </div>
      </div>
      <div className="panel-body">
        <div className="stats-summary">
          <div className="stats-counters">
            <div className="stats-counter">
              <span className="stats-label">Correct</span>
              <span className="stats-value">{correctCount}</span>
            </div>
            <div className="stats-counter">
              <span className="stats-label">Incorrect</span>
              <span className="stats-value">{incorrectCount}</span>
            </div>
            <div className="stats-counter">
              <span className="stats-label">Total</span>
              <span className="stats-value">{totalQuestions}</span>
            </div>
          </div>
          <div
            className={statsChartClass}
            style={statsChartStyle}
            role="img"
            aria-label={`Correct ${correctCount}, Incorrect ${incorrectCount}, Total ${totalQuestions}`}
          >
            <div className="stats-chart-label">
              <span className="stats-chart-total">{totalQuestions}</span>
              <span className="stats-chart-caption">Total</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

---

## 📝 VaultTree.tsx — ./components/VaultTree.tsx

import { useMemo, type CSSProperties } from "react";
import { FileIcon, FolderIcon } from "./icons";
import { vaultBaseName } from "../lib/path";
import { buildTree, type TreeNode, type VaultFile } from "../lib/tree";
import { type LoadState } from "../lib/types";

const INDENT_STEP = 12;
const OVERFLOW_DEPTH = 4;

const getIndentVars = (depth: number): CSSProperties =>
  ({
    "--tree-indent": `${depth * INDENT_STEP}px`,
    "--tree-overflow": `${Math.max(0, depth - OVERFLOW_DEPTH) * INDENT_STEP}px`,
  } as CSSProperties);

const getMaxDepth = (nodes: TreeNode[], depth: number): number => {
  let maxDepth = depth;
  for (const node of nodes) {
    if (node.type === "dir" && node.children?.length) {
      maxDepth = Math.max(maxDepth, getMaxDepth(node.children, depth + 1));
    } else {
      maxDepth = Math.max(maxDepth, depth);
    }
  }
  return maxDepth;
};

type VaultTreeProps = {
  expandedPaths: Set<string>;
  fileCountLabel: string;
  files: VaultFile[];
  listError: string;
  listState: LoadState;
  onTogglePath: (path: string, isOpen: boolean) => void;
  onSelectFile: (file: VaultFile) => void;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
};

export const VaultTree = ({
  expandedPaths,
  fileCountLabel,
  files,
  listError,
  listState,
  onTogglePath,
  onSelectFile,
  selectedFile,
  vaultPath,
}: VaultTreeProps) => {
  const vaultRootName = useMemo(() => vaultBaseName(vaultPath), [vaultPath]);
  const treeNodes = useMemo(() => buildTree(files), [files]);
  const maxDepth = useMemo(
    () => (treeNodes.length ? getMaxDepth(treeNodes, 1) : 0),
    [treeNodes],
  );
  const hasDeepIndent = maxDepth > OVERFLOW_DEPTH;

  const renderTreeNodes = (nodes: TreeNode[], depth: number) =>
    nodes.map((node) => {
      const indentStyle = getIndentVars(depth);
      if (node.type === "dir") {
        const isOpen = expandedPaths.has(node.path);
        return (
          <details
            className="tree-dir"
            key={node.path}
            open={isOpen}
            onToggle={(event) => {
              onTogglePath(node.path, event.currentTarget.open);
            }}
          >
            <summary className="tree-item" title={node.path} style={indentStyle}>
              <span className="tree-icon">
                <FolderIcon />
              </span>
              <span className="tree-name">{node.name}</span>
            </summary>
            <div className="tree-children">
              {renderTreeNodes(node.children ?? [], depth + 1)}
            </div>
          </details>
        );
      }

      const fileRef =
        node.file ??
        (node.fullPath ? { path: node.fullPath, relative_path: node.path } : null);
      const isActive = !!fileRef && selectedFile?.path === fileRef.path;

      return (
        <button
          type="button"
          key={node.path}
          className={`tree-item tree-file ${isActive ? "active" : ""}`}
          onClick={() => fileRef && onSelectFile(fileRef)}
          title={node.path}
          disabled={!fileRef}
          style={indentStyle}
        >
          <span className="tree-icon">
            <FileIcon />
          </span>
          <span className="tree-name">{node.name}</span>
        </button>
      );
    });

  return (
    <div className="vault-details">
      <div className="vault-details-header">
        <span>Vault Directory</span>
        <span className="vault-summary">{fileCountLabel}</span>
      </div>
      <div className="vault-body">
        <div
          className={`vault-tree-scroll${hasDeepIndent ? " vault-tree-scroll-wide" : ""}`}
        >
          {!vaultPath ? (
            <div className="empty-state">
              Select a vault to view the directory.
            </div>
          ) : null}
          {listState === "loading" ? <span className="chip">Scanne...</span> : null}
          {listError ? <div className="error">{listError}</div> : null}
          {vaultPath && listState === "idle" && treeNodes.length === 0 ? (
            <div className="empty-state">Keine Markdown-Dateien in diesem Vault.</div>
          ) : null}
          {vaultPath && listState === "idle" && treeNodes.length > 0 ? (
            <div className="vault-tree">
              <details className="tree-dir" open>
                <summary
                  className="tree-item"
                  style={getIndentVars(0)}
                >
                  <span className="tree-icon">
                    <FolderIcon />
                  </span>
                  <span className="tree-name">{vaultRootName}</span>
                </summary>
                <div className="tree-children">
                  {renderTreeNodes(treeNodes, 1)}
                </div>
              </details>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

---

## 📝 constants.ts — ./features/fast-flashcard/constants.ts

export const FAST_FLASHCARD_DURATIONS = [3, 6, 12, 24, 48] as const;

export type FastFlashcardDuration = (typeof FAST_FLASHCARD_DURATIONS)[number];

---

## 📝 logic.test.ts — ./features/flashcards/logic.test.ts

import { describe, expect, it } from "vitest";
import type { Flashcard } from "../../lib/flashcards";
import {
  calculateFlashcardStats,
  evaluateFlashcardResult,
  type CompositePartState,
} from "./logic";

const buildCompositeCard = (): Flashcard => ({
  kind: "composite",
  parts: [
    {
      kind: "multiple-choice",
      question: "Pick one",
      options: [
        { key: "a", text: "A" },
        { key: "b", text: "B" },
      ],
      correctKeys: ["a"],
    },
  ],
});

describe("evaluateFlashcardResult", () => {
  it("returns incorrect when a composite part is wrong", () => {
    const card = buildCompositeCard();
    const compositeStates: Record<number, CompositePartState[]> = {
      0: [{ selections: ["b"] }],
    };

    const result = evaluateFlashcardResult(
      card,
      0,
      {},
      {},
      {},
      {},
      compositeStates,
    );

    expect(result).toBe("incorrect");
  });
});

describe("calculateFlashcardStats", () => {
  it("counts composite submissions using the same result logic", () => {
    const card = buildCompositeCard();
    const compositeStates: Record<number, CompositePartState[]> = {
      0: [{ selections: ["b"] }],
    };

    const stats = calculateFlashcardStats(
      [card],
      { 0: true },
      {},
      {},
      {},
      {},
      compositeStates,
    );

    expect(stats).toEqual({
      correctCount: 0,
      incorrectCount: 1,
      correctPercent: 0,
    });
  });
});

---

## 📝 logic.ts — ./features/flashcards/logic.ts

import type { DragEvent } from "react";
import {
  isDragAnswerMatch,
  isInputAnswerMatch,
  type ClozeSegment,
  type FlashcardPart,
  type Flashcard,
} from "../../lib/flashcards";

export type TrueFalseSelection = "wahr" | "falsch";
export type FlashcardResult = "correct" | "incorrect" | "neutral";
export type FlashcardSelfGrade = Exclude<FlashcardResult, "neutral">;

export type FlashcardStats = {
  correctCount: number;
  incorrectCount: number;
  correctPercent: number;
};

export type ClozeDragPayload = {
  cardIndex: number;
  tokenId: string;
  partIndex?: number;
};

export type CompositePartState = {
  selections?: string[];
  trueFalseSelections?: Record<string, TrueFalseSelection>;
  clozeResponses?: Record<string, string>;
  textResponse?: string;
  textRevealed?: boolean;
  selfGrade?: FlashcardSelfGrade;
};

type ClozeBlankSegment = Extract<ClozeSegment, { type: "blank" }>;

export const CLOZE_TOKEN_DRAG_TYPE = "application/x-cloze-token";

export const setClozeDragPayload = (
  event: DragEvent<HTMLElement>,
  payload: ClozeDragPayload,
) => {
  event.dataTransfer.setData(CLOZE_TOKEN_DRAG_TYPE, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "move";
};

export const getClozeDragPayload = (event: DragEvent<HTMLElement>) => {
  const raw = event.dataTransfer.getData(CLOZE_TOKEN_DRAG_TYPE);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ClozeDragPayload;
    if (typeof parsed.cardIndex !== "number" || typeof parsed.tokenId !== "string") {
      return null;
    }
    if (
      "partIndex" in parsed &&
      typeof parsed.partIndex !== "number" &&
      parsed.partIndex !== undefined
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const handleClozeTokenDragStart = (
  event: DragEvent<HTMLElement>,
  payload: ClozeDragPayload,
) => {
  event.dataTransfer.clearData();
  setClozeDragPayload(event, payload);
};

export const handleClozeBlankDragOver = (event: DragEvent<HTMLElement>) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
};

export const shuffleFlashcards = <T,>(cards: T[]) => {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const getClozeBlanks = (segments: ClozeSegment[]) =>
  segments.filter((segment): segment is ClozeBlankSegment => segment.type === "blank");

const isClozeBlankFilled = (
  blank: ClozeBlankSegment,
  responses: Record<string, string>,
  tokenById: Map<string, string>,
) => {
  const value = responses[blank.id] ?? "";
  if (blank.kind === "input") {
    return value.trim().length > 0;
  }
  return tokenById.has(value);
};

const isClozeBlankCorrect = (
  blank: ClozeBlankSegment,
  responses: Record<string, string>,
  tokenById: Map<string, string>,
) => {
  const value = responses[blank.id] ?? "";
  if (blank.kind === "input") {
    return isInputAnswerMatch(value, blank.solution);
  }
  return isDragAnswerMatch(tokenById.get(value) ?? "", blank.solution);
};

export const areClozeBlanksComplete = (
  card: Extract<Flashcard, { kind: "cloze" }>,
  responses: Record<string, string>,
) => {
  const blanks = getClozeBlanks(card.segments);
  if (blanks.length === 0) {
    return false;
  }
  const tokenById = new Map(card.dragTokens.map((token) => [token.id, token.value]));
  return blanks.every((blank) => isClozeBlankFilled(blank, responses, tokenById));
};

export const isClozeCardCorrect = (
  card: Extract<Flashcard, { kind: "cloze" }>,
  responses: Record<string, string>,
) => {
  const blanks = getClozeBlanks(card.segments);
  if (blanks.length === 0) {
    return false;
  }
  const tokenById = new Map(card.dragTokens.map((token) => [token.id, token.value]));
  return blanks.every((blank) => isClozeBlankCorrect(blank, responses, tokenById));
};

export const areTrueFalseItemsComplete = (
  card: Extract<Flashcard, { kind: "true-false" }>,
  selections: Record<string, TrueFalseSelection>,
) => {
  if (card.items.length === 0) {
    return false;
  }
  return card.items.every((item) => Boolean(selections[item.id]));
};

export const isTrueFalseCardCorrect = (
  card: Extract<Flashcard, { kind: "true-false" }>,
  selections: Record<string, TrueFalseSelection>,
) => {
  if (card.items.length === 0) {
    return false;
  }
  return card.items.every((item) => selections[item.id] === item.correct);
};

export const isFlashcardPartComplete = (
  part: FlashcardPart,
  state: CompositePartState = {},
) => {
  if (part.kind === "multiple-choice") {
    return (state.selections ?? []).length > 0;
  }
  if (part.kind === "true-false") {
    return areTrueFalseItemsComplete(part, state.trueFalseSelections ?? {});
  }
  if (part.kind === "cloze") {
    return areClozeBlanksComplete(part, state.clozeResponses ?? {});
  }
  return Boolean(state.selfGrade);
};

const isExactKeyMatch = (selected: string[], correct: string[]) => {
  if (selected.length !== correct.length) {
    return false;
  }
  const selectedSet = new Set(selected);
  if (selectedSet.size !== correct.length) {
    return false;
  }
  return correct.every((key) => selectedSet.has(key));
};

export const evaluateFlashcardPartResult = (
  part: FlashcardPart,
  state: CompositePartState = {},
): FlashcardResult => {
  if (part.kind === "multiple-choice") {
    if (part.correctKeys.length === 0) {
      return "neutral";
    }
    const selected = state.selections ?? [];
    return isExactKeyMatch(selected, part.correctKeys) ? "correct" : "incorrect";
  }

  if (part.kind === "true-false") {
    const selections = state.trueFalseSelections ?? {};
    return isTrueFalseCardCorrect(part, selections) ? "correct" : "incorrect";
  }

  if (part.kind === "cloze") {
    const responses = state.clozeResponses ?? {};
    return isClozeCardCorrect(part, responses) ? "correct" : "incorrect";
  }

  return state.selfGrade ?? "neutral";
};

export const evaluateFlashcardResult = (
  card: Flashcard,
  cardIndex: number,
  selections: Record<number, string[]>,
  trueFalseSelections: Record<number, Record<string, TrueFalseSelection>>,
  clozeResponses: Record<number, Record<string, string>>,
  selfGrades: Record<number, FlashcardSelfGrade> = {},
  compositeStates?: Record<number, CompositePartState[]>,
): FlashcardResult => {
  if (card.kind === "composite") {
    const partStates = compositeStates?.[cardIndex] ?? [];
    const allCorrect = card.parts.every((part, partIndex) =>
      evaluateFlashcardPartResult(part, partStates[partIndex] ?? {}) === "correct",
    );
    return allCorrect ? "correct" : "incorrect";
  }

  if (card.kind === "multiple-choice") {
    if (card.correctKeys.length === 0) {
      return "neutral";
    }
    const selected = selections[cardIndex] ?? [];
    return isExactKeyMatch(selected, card.correctKeys) ? "correct" : "incorrect";
  }

  if (card.kind === "true-false") {
    if (card.items.length === 0) {
      return "neutral";
    }
    const selectionsForCard = trueFalseSelections[cardIndex] ?? {};
    return isTrueFalseCardCorrect(card, selectionsForCard) ? "correct" : "incorrect";
  }

  if (card.kind === "cloze") {
    const blanks = getClozeBlanks(card.segments);
    if (blanks.length === 0) {
      return "neutral";
    }
    const responses = clozeResponses[cardIndex] ?? {};
    return isClozeCardCorrect(card, responses) ? "correct" : "incorrect";
  }

  const grade = selfGrades[cardIndex];
  return grade ?? "neutral";
};

export const calculateFlashcardStats = (
  flashcards: Flashcard[],
  submissions: Record<number, boolean>,
  selections: Record<number, string[]>,
  trueFalseSelections: Record<number, Record<string, TrueFalseSelection>>,
  clozeResponses: Record<number, Record<string, string>>,
  selfGrades: Record<number, FlashcardSelfGrade> = {},
  compositeStates?: Record<number, CompositePartState[]>,
): FlashcardStats => {
  let correct = 0;
  let incorrect = 0;

  flashcards.forEach((card, index) => {
    if (!submissions[index]) {
      return;
    }
    const result = evaluateFlashcardResult(
      card,
      index,
      selections,
      trueFalseSelections,
      clozeResponses,
      selfGrades,
      compositeStates,
    );
    if (result === "correct") {
      correct += 1;
    } else if (result === "incorrect") {
      incorrect += 1;
    }
  });

  const total = correct + incorrect;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correctCount: correct, incorrectCount: incorrect, correctPercent: percent };
};

---

## 📝 useFlashcards.ts — ./features/flashcards/useFlashcards.ts

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  parseFlashcards,
  type Flashcard,
  type FlashcardDetectedType,
  type FlashcardPart,
} from "../../lib/flashcards";
import {
  evaluateFlashcardResult,
  getClozeDragPayload,
  handleClozeBlankDragOver,
  handleClozeTokenDragStart,
  shuffleFlashcards,
  type CompositePartState,
  type FlashcardSelfGrade,
  type TrueFalseSelection,
} from "./logic";
import { type VaultFile } from "../../lib/tree";

export type FlashcardOrder = "in-order" | "random";
export type FlashcardMode =
  | "all"
  | "qa"
  | "multiple-choice"
  | "mix"
  | "fill-blank"
  | "assignment"
  | "true-false"
  | "yes-no";
export type FlashcardScope = "current" | "vault";
export type FlashcardPageSize = 1 | 2 | 3 | 5;
export type StatsResetMode = "scan" | "session";

export const FLASHCARD_PAGE_SIZES: FlashcardPageSize[] = [1, 2, 3, 5];
export const DEFAULT_FLASHCARD_PAGE_SIZE: FlashcardPageSize = 2;

const normalizeFlashcardPageSize = (value: number) => {
  if (value === 10) {
    return 5;
  }
  return FLASHCARD_PAGE_SIZES.includes(value as FlashcardPageSize)
    ? (value as FlashcardPageSize)
    : DEFAULT_FLASHCARD_PAGE_SIZE;
};

const normalizeFlashcardMode = (
  mode: FlashcardMode,
): Exclude<FlashcardMode, "yes-no"> =>
  mode === "yes-no" ? "true-false" : mode;

const getDetectedTypesForPart = (card: FlashcardPart): FlashcardDetectedType[] => {
  if (card.kind === "multiple-choice") {
    return ["multiple-choice"];
  }
  if (card.kind === "true-false") {
    return ["true-false"];
  }
  if (card.kind === "free-text") {
    return ["qa"];
  }

  const types: FlashcardDetectedType[] = [];
  const hasInputBlank = card.segments.some(
    (segment) => segment.type === "blank" && segment.kind === "input",
  );
  const hasDragBlank = card.segments.some(
    (segment) => segment.type === "blank" && segment.kind === "drag",
  );
  if (hasInputBlank) {
    types.push("fill-blank");
  }
  if (hasDragBlank) {
    types.push("assignment");
  }
  return types.length > 0 ? types : ["fill-blank"];
};

const getPrimaryTypeFromKind = (card: Flashcard): FlashcardDetectedType => {
  if (card.primaryType) {
    return card.primaryType;
  }
  if (card.kind === "composite") {
    const detected = card.detectedTypes ?? [];
    if (detected.length > 0) {
      return detected[0];
    }
    const partTypes = card.parts.flatMap(getDetectedTypesForPart);
    return partTypes[0] ?? "qa";
  }
  if (card.kind === "multiple-choice") {
    return "multiple-choice";
  }
  if (card.kind === "true-false") {
    return "true-false";
  }
  if (card.kind === "cloze") {
    const hasInputBlank = card.segments.some(
      (segment) => segment.type === "blank" && segment.kind === "input",
    );
    const hasDragBlank = card.segments.some(
      (segment) => segment.type === "blank" && segment.kind === "drag",
    );
    if (hasDragBlank && !hasInputBlank) {
      return "assignment";
    }
    return "fill-blank";
  }
  return "qa";
};

const getDetectedTypes = (card: Flashcard): FlashcardDetectedType[] => {
  const detected = card.detectedTypes;
  if (detected && detected.length > 0) {
    return detected;
  }
  if (card.kind === "composite") {
    const types: FlashcardDetectedType[] = [];
    card.parts.forEach((part) => {
      getDetectedTypesForPart(part).forEach((type) => {
        if (!types.includes(type)) {
          types.push(type);
        }
      });
    });
    return types.length > 0 ? types : ["qa"];
  }
  if (card.kind === "cloze") {
    const types: FlashcardDetectedType[] = [];
    const hasInputBlank = card.segments.some(
      (segment) => segment.type === "blank" && segment.kind === "input",
    );
    const hasDragBlank = card.segments.some(
      (segment) => segment.type === "blank" && segment.kind === "drag",
    );
    if (hasInputBlank) {
      types.push("fill-blank");
    }
    if (hasDragBlank) {
      types.push("assignment");
    }
    if (types.length > 0) {
      return types;
    }
  }
  return [card.primaryType ?? getPrimaryTypeFromKind(card)];
};

const matchesFlashcardMode = (card: Flashcard, mode: FlashcardMode) => {
  const resolvedMode = normalizeFlashcardMode(mode);
  if (resolvedMode === "all") {
    return true;
  }
  const detectedTypes = getDetectedTypes(card);
  const isMix = card.isMixed ?? detectedTypes.length >= 2;
  if (resolvedMode === "mix") {
    return isMix;
  }
  if (isMix) {
    return false;
  }
  const primaryType = card.primaryType ?? getPrimaryTypeFromKind(card);
  return primaryType === resolvedMode;
};

type ScanOptions = {
  scopeOverride?: FlashcardScope;
  allowVaultFallback?: boolean;
  orderOverride?: FlashcardOrder;
};

type UseFlashcardsOptions = {
  files: VaultFile[];
  preview: string;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
  settings: {
    flashcardMode: FlashcardMode;
    flashcardOrder: FlashcardOrder;
    flashcardPageSize: FlashcardPageSize;
    flashcardScope: FlashcardScope;
    setFlashcardMode: (value: FlashcardMode) => void;
    setFlashcardOrder: (value: FlashcardOrder) => void;
    setFlashcardPageSize: (value: FlashcardPageSize) => void;
    setFlashcardScope: (value: FlashcardScope) => void;
    setSolutionRevealEnabled: (value: boolean) => void;
    setStatsResetMode: (value: StatsResetMode) => void;
    solutionRevealEnabled: boolean;
    statsResetMode: StatsResetMode;
  };
};

export const useFlashcards = ({
  files,
  preview,
  selectedFile,
  vaultPath,
  settings,
}: UseFlashcardsOptions) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const {
    flashcardMode,
    flashcardOrder,
    flashcardPageSize,
    flashcardScope,
    setFlashcardMode,
    setFlashcardOrder,
    setFlashcardPageSize,
    setFlashcardScope,
    setSolutionRevealEnabled,
    setStatsResetMode,
    solutionRevealEnabled,
    statsResetMode,
  } = settings;
  const [flashcardPage, setFlashcardPage] = useState(0);
  const [isFlashcardScanning, setIsFlashcardScanning] = useState(false);
  const [flashcardSelections, setFlashcardSelections] = useState<
    Record<number, string[]>
  >({});
  const [flashcardTextResponses, setFlashcardTextResponses] = useState<
    Record<number, string>
  >({});
  const [flashcardTextRevealed, setFlashcardTextRevealed] = useState<
    Record<number, boolean>
  >({});
  const [flashcardSelfGrades, setFlashcardSelfGrades] = useState<
    Record<number, FlashcardSelfGrade>
  >({});
  const [flashcardSubmissions, setFlashcardSubmissions] = useState<
    Record<number, boolean>
  >({});
  const [flashcardTrueFalseSelections, setFlashcardTrueFalseSelections] =
    useState<Record<number, Record<string, TrueFalseSelection>>>({});
  const [flashcardClozeResponses, setFlashcardClozeResponses] = useState<
    Record<number, Record<string, string>>
  >({});
  const [flashcardCompositeStates, setFlashcardCompositeStates] = useState<
    Record<number, CompositePartState[]>
  >({});
  const takeSnapshot = useCallback(
    () => ({
      flashcards,
      flashcardSelections,
      flashcardTextResponses,
      flashcardTextRevealed,
      flashcardSelfGrades,
      flashcardSubmissions,
      flashcardTrueFalseSelections,
      flashcardClozeResponses,
      flashcardCompositeStates,
      flashcardPage,
    }),
    [
      flashcardClozeResponses,
      flashcardCompositeStates,
      flashcardPage,
      flashcardSelections,
      flashcardSelfGrades,
      flashcardSubmissions,
      flashcardTextResponses,
      flashcardTextRevealed,
      flashcardTrueFalseSelections,
      flashcards,
    ],
  );

  const restoreSnapshot = useCallback(
    (snapshot: {
      flashcards: Flashcard[];
      flashcardSelections: Record<number, string[]>;
      flashcardTextResponses: Record<number, string>;
      flashcardTextRevealed: Record<number, boolean>;
      flashcardSelfGrades: Record<number, FlashcardSelfGrade>;
      flashcardSubmissions: Record<number, boolean>;
      flashcardTrueFalseSelections: Record<number, Record<string, TrueFalseSelection>>;
      flashcardClozeResponses: Record<number, Record<string, string>>;
      flashcardCompositeStates: Record<number, CompositePartState[]>;
      flashcardPage: number;
    }) => {
      setFlashcards(snapshot.flashcards);
      setFlashcardSelections(snapshot.flashcardSelections);
      setFlashcardTextResponses(snapshot.flashcardTextResponses);
      setFlashcardTextRevealed(snapshot.flashcardTextRevealed);
      setFlashcardSelfGrades(snapshot.flashcardSelfGrades);
      setFlashcardSubmissions(snapshot.flashcardSubmissions);
      setFlashcardTrueFalseSelections(snapshot.flashcardTrueFalseSelections);
      setFlashcardClozeResponses(snapshot.flashcardClozeResponses);
      setFlashcardCompositeStates(snapshot.flashcardCompositeStates);
      setFlashcardPage(snapshot.flashcardPage);
    },
    [],
  );

  const resolvedFlashcardPageSize = useMemo(
    () => normalizeFlashcardPageSize(flashcardPageSize),
    [flashcardPageSize],
  );

  const filteredFlashcardIndices = useMemo(() => {
    return flashcards.reduce<number[]>((accumulator, card, cardIndex) => {
      if (matchesFlashcardMode(card, flashcardMode)) {
        accumulator.push(cardIndex);
      }
      return accumulator;
    }, []);
  }, [flashcards, flashcardMode]);

  const orderedFlashcardIndices = useMemo(() => {
    if (flashcardOrder === "random") {
      return shuffleFlashcards(filteredFlashcardIndices);
    }
    return filteredFlashcardIndices;
  }, [filteredFlashcardIndices, flashcardOrder]);

  const orderedFlashcardEntries = useMemo(
    () =>
      orderedFlashcardIndices.map((cardIndex) => ({
        cardIndex,
        card: flashcards[cardIndex]!,
      })),
    [flashcards, orderedFlashcardIndices],
  );

  const flashcardPageCount = useMemo(
    () => Math.ceil(orderedFlashcardIndices.length / resolvedFlashcardPageSize),
    [orderedFlashcardIndices.length, resolvedFlashcardPageSize],
  );

  const flashcardPageIndex = useMemo(
    () => Math.min(flashcardPage, Math.max(0, flashcardPageCount - 1)),
    [flashcardPage, flashcardPageCount],
  );

  const flashcardPageStart = flashcardPageIndex * resolvedFlashcardPageSize;

  const visibleFlashcardEntries = useMemo(() => {
    return orderedFlashcardIndices
      .slice(flashcardPageStart, flashcardPageStart + resolvedFlashcardPageSize)
      .map((cardIndex) => ({
        cardIndex,
        card: flashcards[cardIndex]!,
      }));
  }, [
    flashcardPageStart,
    flashcards,
    orderedFlashcardIndices,
    resolvedFlashcardPageSize,
  ]);

  const visibleFlashcards = useMemo(
    () => visibleFlashcardEntries.map((entry) => entry.card),
    [visibleFlashcardEntries],
  );

  const filteredFlashcardCount = orderedFlashcardIndices.length;

  const canGoBack = flashcardPageIndex > 0;
  const canGoNext = flashcardPageIndex < flashcardPageCount - 1;

  const { correctCount, incorrectCount, correctPercent } = useMemo(() => {
    let correct = 0;
    let incorrect = 0;

    orderedFlashcardIndices.forEach((cardIndex) => {
      if (!flashcardSubmissions[cardIndex]) {
        return;
      }
      const card = flashcards[cardIndex];
      if (!card) {
        return;
      }
      const result = evaluateFlashcardResult(
        card,
        cardIndex,
        flashcardSelections,
        flashcardTrueFalseSelections,
        flashcardClozeResponses,
        flashcardSelfGrades,
        flashcardCompositeStates,
      );
      if (result === "correct") {
        correct += 1;
      } else if (result === "incorrect") {
        incorrect += 1;
      }
    });

    const total = correct + incorrect;
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correctCount: correct, incorrectCount: incorrect, correctPercent: percent };
  }, [
    flashcardClozeResponses,
    flashcardCompositeStates,
    flashcardSelections,
    flashcardSelfGrades,
    flashcardSubmissions,
    flashcardTrueFalseSelections,
    flashcards,
    orderedFlashcardIndices,
  ]);

  useEffect(() => {
    const normalized = normalizeFlashcardPageSize(flashcardPageSize);
    if (normalized !== flashcardPageSize) {
      setFlashcardPageSize(normalized);
    }
  }, [flashcardPageSize]);

  useEffect(() => {
    const maxPage = Math.max(0, flashcardPageCount - 1);
    if (flashcardPage > maxPage) {
      setFlashcardPage(maxPage);
    }
  }, [flashcardPage, flashcardPageCount]);

  const resetFlashcards = useCallback((options?: { keepScanning?: boolean }) => {
    setFlashcards([]);
    setFlashcardSelections({});
    setFlashcardTextResponses({});
    setFlashcardTextRevealed({});
    setFlashcardSelfGrades({});
    setFlashcardSubmissions({});
    setFlashcardTrueFalseSelections({});
    setFlashcardClozeResponses({});
    setFlashcardCompositeStates({});
    setFlashcardPage(0);
    if (!options?.keepScanning) {
      setIsFlashcardScanning(false);
    }
  }, []);

  const scanFlashcards = useCallback(
    async (options?: ScanOptions) => {
      const scope = options?.scopeOverride ?? flashcardScope;
      const shouldFallbackToVault =
        options?.allowVaultFallback && scope === "current" && !selectedFile;
      const resolvedScope = shouldFallbackToVault ? "vault" : scope;

      if (resolvedScope === "vault") {
        if (!vaultPath || files.length === 0) {
          return [];
        }

        const results = await Promise.allSettled(
          files.map(async (file) => {
            const contents = await invoke<string>("read_text_file", {
              path: file.path,
            });
            return parseFlashcards(contents);
          }),
        );

        const merged: Flashcard[] = [];
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            merged.push(...result.value);
          } else {
            console.warn(
              "Failed to read markdown file",
              files[index]?.path,
              result.reason,
            );
          }
        });

        return merged;
      }

      const cards = parseFlashcards(preview);
      return cards;
    },
    [files, flashcardScope, preview, selectedFile, vaultPath],
  );

  const handleFlashcardScan = useCallback(async () => {
    setIsFlashcardScanning(true);
    resetFlashcards({ keepScanning: true });

    try {
      const cards = await scanFlashcards();
      setFlashcards(cards);
    } finally {
      setIsFlashcardScanning(false);
    }
  }, [resetFlashcards, scanFlashcards]);

  const handleFlashcardOptionSelect = useCallback(
    (cardIndex: number, keys: string[]) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      const uniqueKeys = Array.from(new Set(keys));
      setFlashcardSelections((prev) => ({ ...prev, [cardIndex]: uniqueKeys }));
    },
    [flashcardSubmissions],
  );

  const handleTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: TrueFalseSelection) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      setFlashcardTrueFalseSelections((prev) => {
        const current = { ...(prev[cardIndex] ?? {}) };
        current[itemId] = value;
        return { ...prev, [cardIndex]: current };
      });
    },
    [flashcardSubmissions],
  );

  const handleFlashcardSubmit = useCallback(
    (cardIndex: number, canSubmit: boolean) => {
      if (!canSubmit) {
        return;
      }
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      setFlashcardSubmissions((prev) => ({ ...prev, [cardIndex]: true }));
    },
    [flashcardSubmissions],
  );

  const handleFlashcardTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      if (flashcardSubmissions[cardIndex] || flashcardTextRevealed[cardIndex]) {
        return;
      }
      setFlashcardTextResponses((prev) => ({ ...prev, [cardIndex]: value }));
    },
    [flashcardSubmissions, flashcardTextRevealed],
  );

  const handleFlashcardTextCheck = useCallback(
    (cardIndex: number) => {
      if (flashcardSubmissions[cardIndex] || flashcardTextRevealed[cardIndex]) {
        return;
      }
      setFlashcardTextRevealed((prev) => ({ ...prev, [cardIndex]: true }));
    },
    [flashcardSubmissions, flashcardTextRevealed],
  );

  const handleFlashcardSelfGrade = useCallback(
    (cardIndex: number, grade: FlashcardSelfGrade) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      setFlashcardSelfGrades((prev) => ({ ...prev, [cardIndex]: grade }));
      setFlashcardSubmissions((prev) => ({ ...prev, [cardIndex]: true }));
    },
    [flashcardSubmissions],
  );

  const updateCompositePartState = useCallback(
    (
      cardIndex: number,
      partIndex: number,
      updater: (current: CompositePartState) => CompositePartState,
    ) => {
      setFlashcardCompositeStates((prev) => {
        const nextParts = [...(prev[cardIndex] ?? [])];
        const current = nextParts[partIndex] ?? {};
        const nextState = updater(current);
        nextParts[partIndex] = nextState;
        return { ...prev, [cardIndex]: nextParts };
      });
    },
    [],
  );

  const handleCompositeOptionSelect = useCallback(
    (cardIndex: number, partIndex: number, keys: string[]) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      const uniqueKeys = Array.from(new Set(keys));
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        selections: uniqueKeys,
      }));
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeTrueFalseSelect = useCallback(
    (cardIndex: number, partIndex: number, itemId: string, value: TrueFalseSelection) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        trueFalseSelections: {
          ...(current.trueFalseSelections ?? {}),
          [itemId]: value,
        },
      }));
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeClozeInputChange = useCallback(
    (cardIndex: number, partIndex: number, blankId: string, value: string) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        clozeResponses: {
          ...(current.clozeResponses ?? {}),
          [blankId]: value,
        },
      }));
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      partIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      event.preventDefault();
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      const payload = getClozeDragPayload(event);
      if (!payload || payload.cardIndex !== cardIndex || payload.partIndex !== partIndex) {
        return;
      }
      if (payload.tokenId === blankId) {
        return;
      }
      if (!validTokenIds.has(payload.tokenId)) {
        return;
      }

      updateCompositePartState(cardIndex, partIndex, (current) => {
        const responses = { ...(current.clozeResponses ?? {}) };
        const existingBlankId = Object.entries(responses).find(
          ([key, value]) => value === payload.tokenId && key !== blankId,
        )?.[0];
        if (existingBlankId) {
          delete responses[existingBlankId];
        }
        if (dragBlankIds.has(blankId)) {
          responses[blankId] = payload.tokenId;
        }
        return { ...current, clozeResponses: responses };
      });
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeClozeTokenRemove = useCallback(
    (cardIndex: number, partIndex: number, blankId: string) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => {
        const responses = { ...(current.clozeResponses ?? {}) };
        delete responses[blankId];
        return { ...current, clozeResponses: responses };
      });
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeTextInputChange = useCallback(
    (cardIndex: number, partIndex: number, value: string) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => {
        if (current.textRevealed) {
          return current;
        }
        return { ...current, textResponse: value };
      });
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeTextCheck = useCallback(
    (cardIndex: number, partIndex: number) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => {
        if (current.textRevealed) {
          return current;
        }
        return { ...current, textRevealed: true };
      });
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeSelfGrade = useCallback(
    (cardIndex: number, partIndex: number, grade: FlashcardSelfGrade) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        selfGrade: grade,
      }));
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleFlashcardPageBack = useCallback(() => {
    setFlashcardPage((prev) => Math.max(0, prev - 1));
  }, []);

  const handleFlashcardPageNext = useCallback(() => {
    if (flashcardPageCount <= 0) {
      return;
    }
    setFlashcardPage((prev) => Math.min(flashcardPageCount - 1, prev + 1));
  }, [flashcardPageCount]);

  const handleClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      setFlashcardClozeResponses((prev) => {
        const current = { ...(prev[cardIndex] ?? {}) };
        current[blankId] = value;
        return { ...prev, [cardIndex]: current };
      });
    },
    [],
  );

  const handleClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      event.preventDefault();
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      const payload = getClozeDragPayload(event);
      if (!payload || payload.cardIndex !== cardIndex) {
        return;
      }
      if (payload.tokenId === blankId) {
        return;
      }
      if (!validTokenIds.has(payload.tokenId)) {
        return;
      }

      setFlashcardClozeResponses((prev) => {
        const current = { ...(prev[cardIndex] ?? {}) };
        const existingBlankId = Object.entries(current).find(
          ([key, value]) => value === payload.tokenId && key !== blankId,
        )?.[0];
        if (existingBlankId) {
          delete current[existingBlankId];
        }
        if (dragBlankIds.has(blankId)) {
          current[blankId] = payload.tokenId;
        }
        return { ...prev, [cardIndex]: current };
      });
    },
    [flashcardSubmissions],
  );

  const handleClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      setFlashcardClozeResponses((prev) => {
        const current = { ...(prev[cardIndex] ?? {}) };
        delete current[blankId];
        return { ...prev, [cardIndex]: current };
      });
    },
    [flashcardSubmissions],
  );

  return {
    canGoBack,
    canGoNext,
    correctCount,
    flashcardClozeResponses,
    flashcardCompositeStates,
    flashcardMode,
    flashcardOrder,
    flashcardPage,
    flashcardPageCount,
    flashcardPageIndex,
    flashcardPageSize,
    flashcardPageStart,
    flashcardScope,
    flashcardSelections,
    flashcardSelfGrades,
    flashcardSubmissions,
    flashcardTextResponses,
    flashcardTextRevealed,
    flashcardTrueFalseSelections,
    flashcards,
    filteredFlashcardCount,
    handleClozeBlankDragOver,
    handleClozeInputChange,
    handleClozeTokenDragStart,
    handleClozeTokenDrop,
    handleClozeTokenRemove,
    handleFlashcardOptionSelect,
    handleFlashcardPageBack,
    handleFlashcardPageNext,
    handleFlashcardScan,
    handleFlashcardSelfGrade,
    handleFlashcardSubmit,
    handleFlashcardTextCheck,
    handleFlashcardTextInputChange,
    handleTrueFalseSelect,
    handleCompositeOptionSelect,
    handleCompositeTrueFalseSelect,
    handleCompositeClozeInputChange,
    handleCompositeClozeTokenDrop,
    handleCompositeClozeTokenRemove,
    handleCompositeTextInputChange,
    handleCompositeTextCheck,
    handleCompositeSelfGrade,
    incorrectCount,
    isFlashcardScanning,
    resetFlashcards,
    restoreSnapshot,
    scanFlashcards,
    setFlashcardMode,
    setFlashcardOrder,
    setFlashcardPageSize,
    setFlashcardScope,
    setIsFlashcardScanning,
    setSolutionRevealEnabled,
    setStatsResetMode,
    solutionRevealEnabled,
    statsResetMode,
    takeSnapshot,
    orderedFlashcardEntries,
    visibleFlashcardEntries,
    visibleFlashcards,
    correctPercent,
  };
};

---

## 📝 usePreview.ts — ./features/preview/usePreview.ts

import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { asErrorMessage } from "../../lib/errors";
import { type LoadState } from "../../lib/types";
import { type VaultFile } from "../../lib/tree";

export type PreviewSnapshot = {
  selectedFile: VaultFile | null;
  preview: string;
  previewState: LoadState;
  previewError: string;
  rawPreview: boolean;
};

export const usePreview = () => {
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [preview, setPreview] = useState("");
  const [previewState, setPreviewState] = useState<LoadState>("idle");
  const [previewError, setPreviewError] = useState("");
  const [rawPreview, setRawPreview] = useState(false);

  const takeSnapshot = useCallback(
    (): PreviewSnapshot => ({
      selectedFile,
      preview,
      previewState,
      previewError,
      rawPreview,
    }),
    [preview, previewError, previewState, rawPreview, selectedFile],
  );

  const restoreSnapshot = useCallback((snapshot: PreviewSnapshot) => {
    setSelectedFile(snapshot.selectedFile);
    setPreview(snapshot.preview);
    setPreviewState(snapshot.previewState);
    setPreviewError(snapshot.previewError);
    setRawPreview(snapshot.rawPreview);
  }, []);

  const resetPreview = useCallback(() => {
    setSelectedFile(null);
    setPreview("");
    setPreviewState("idle");
    setPreviewError("");
  }, []);

  const selectFile = useCallback(async (file: VaultFile) => {
    setSelectedFile(file);
    setPreview("");
    setPreviewError("");
    setPreviewState("loading");
    try {
      const contents = await invoke<string>("read_text_file", {
        path: file.path,
      });
      setPreview(contents);
      setPreviewState("idle");
    } catch (error) {
      const message = asErrorMessage(error, "Failed to load file contents.");
      setPreviewError(message);
      setPreviewState("error");
    }
  }, []);

  return {
    preview,
    previewError,
    previewState,
    rawPreview,
    resetPreview,
    restoreSnapshot,
    selectFile,
    selectedFile,
    setPreview,
    setPreviewError,
    setPreviewState,
    setRawPreview,
    takeSnapshot,
  };
};

---

## 📝 settingsNavigation.ts — ./features/settings/settingsNavigation.ts

export const SETTINGS_PAGES = [
  { id: "app-settings", label: "App Settings" },
  { id: "review-tools", label: "Review Tools" },
  { id: "appearance", label: "Appearance" },
] as const;

export type SettingsPageId = (typeof SETTINGS_PAGES)[number]["id"];

---

## 📝 useAppSettings.ts — ./features/settings/useAppSettings.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_ACCENT, isValidHex, normalizeHex } from "../../lib/color";
import { applyAccentColor, applyTheme, type ThemeMode } from "../../lib/theme";
import {
  DEFAULT_FLASHCARD_PAGE_SIZE,
  FLASHCARD_PAGE_SIZES,
  type FlashcardMode,
  type FlashcardOrder,
  type FlashcardPageSize,
  type FlashcardScope,
  type StatsResetMode,
} from "../flashcards/useFlashcards";
import {
  FAST_FLASHCARD_DURATIONS,
  type FastFlashcardDuration,
} from "../fast-flashcard/constants";
import {
  DEFAULT_SPACED_REPETITION_PAGE_SIZE,
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
  type SpacedRepetitionBoxes,
  type SpacedRepetitionOrder,
  type SpacedRepetitionPageSize,
  type SpacedRepetitionRepetitionStrength,
} from "../spaced-repetition/useSpacedRepetition";

type AppLanguage = "de" | "en";
type EditorGridIntensity = "light" | "medium" | "strong";
type SpacedRepetitionStatsView = "boxes" | "vault" | "completed";

type AppSettings = {
  active_note_path?: string | null;
  vault_path?: string | null;
  theme?: string | null;
  accent_color?: string | null;
  editor_exact_colors?: boolean | null;
  editor_blueprint_grid?: boolean | null;
  editor_blueprint_grid_intensity?: string | null;
  language?: AppLanguage | null;
  max_files_per_scan?: string | null;
  scan_parallelism?: string | null;
  flashcard_order?: string | null;
  flashcard_mode?: string | null;
  flashcard_scope?: string | null;
  flashcard_page_size?: number | null;
  flashcard_solution_reveal_enabled?: boolean | null;
  flashcard_stats_reset_mode?: string | null;
  fast_flashcard_order?: string | null;
  fast_flashcard_mode?: string | null;
  fast_flashcard_scope?: string | null;
  fast_flashcard_duration?: number | null;
  spaced_repetition_boxes?: number | null;
  spaced_repetition_order?: string | null;
  spaced_repetition_page_size?: number | null;
  spaced_repetition_repetition_strength?: string | null;
  spaced_repetition_stats_view?: string | null;
  right_toolbar_collapsed?: boolean | null;
};

type PersistUpdates = {
  activeNotePath?: string | null;
  vaultPath?: string | null;
  theme?: ThemeMode;
  accentColor?: string;
  editorExactColors?: boolean;
  editorBlueprintGrid?: boolean;
  editorBlueprintGridIntensity?: EditorGridIntensity;
  language?: AppLanguage;
  maxFilesPerScan?: string;
  scanParallelism?: "low" | "medium" | "high";
  flashcardOrder?: FlashcardOrder;
  flashcardMode?: FlashcardMode;
  flashcardScope?: FlashcardScope;
  flashcardPageSize?: FlashcardPageSize;
  solutionRevealEnabled?: boolean;
  statsResetMode?: StatsResetMode;
  fastFlashcardOrder?: FlashcardOrder;
  fastFlashcardMode?: FlashcardMode;
  fastFlashcardScope?: FlashcardScope;
  fastFlashcardDuration?: number;
  spacedRepetitionBoxes?: SpacedRepetitionBoxes;
  spacedRepetitionOrder?: SpacedRepetitionOrder;
  spacedRepetitionPageSize?: SpacedRepetitionPageSize;
  spacedRepetitionRepetitionStrength?: SpacedRepetitionRepetitionStrength;
  spacedRepetitionStatsView?: SpacedRepetitionStatsView;
  rightToolbarCollapsed?: boolean;
};

export const DEFAULT_THEME: ThemeMode = "light";
export const DEFAULT_LANGUAGE: AppLanguage = "de";
const DEFAULT_EDITOR_EXACT_COLORS = true;
const DEFAULT_EDITOR_BLUEPRINT_GRID = false;
const DEFAULT_EDITOR_BLUEPRINT_GRID_INTENSITY: EditorGridIntensity = "medium";
const DEFAULT_MAX_FILES_PER_SCAN = "50";
const DEFAULT_SCAN_PARALLELISM: "low" | "medium" | "high" = "medium";
const DEFAULT_FLASHCARD_ORDER: FlashcardOrder = "in-order";
const DEFAULT_FLASHCARD_MODE: FlashcardMode = "all";
const DEFAULT_FLASHCARD_SCOPE: FlashcardScope = "current";
const DEFAULT_STATS_RESET_MODE: StatsResetMode = "scan";
const DEFAULT_FAST_FLASHCARD_ORDER: FlashcardOrder = DEFAULT_FLASHCARD_ORDER;
const DEFAULT_FAST_FLASHCARD_MODE: FlashcardMode = DEFAULT_FLASHCARD_MODE;
const DEFAULT_FAST_FLASHCARD_SCOPE: FlashcardScope = DEFAULT_FLASHCARD_SCOPE;
const DEFAULT_FAST_FLASHCARD_DURATION = 6;
const DEFAULT_SPACED_REPETITION_BOXES: SpacedRepetitionBoxes = 5;
const DEFAULT_SPACED_REPETITION_ORDER: SpacedRepetitionOrder = "in-order";
const DEFAULT_SPACED_REPETITION_REPETITION_STRENGTH: SpacedRepetitionRepetitionStrength =
  "medium";
const DEFAULT_SPACED_REPETITION_STATS_VIEW: SpacedRepetitionStatsView = "boxes";
const DEFAULT_RIGHT_TOOLBAR_COLLAPSED = false;

export const useAppSettings = () => {
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [accentDraft, setAccentDraft] = useState(DEFAULT_ACCENT);
  const [accentError, setAccentError] = useState("");
  const [editorExactColors, setEditorExactColors] = useState(
    DEFAULT_EDITOR_EXACT_COLORS,
  );
  const [editorBlueprintGrid, setEditorBlueprintGrid] = useState(
    DEFAULT_EDITOR_BLUEPRINT_GRID,
  );
  const [editorBlueprintGridIntensity, setEditorBlueprintGridIntensity] =
    useState<EditorGridIntensity>(DEFAULT_EDITOR_BLUEPRINT_GRID_INTENSITY);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [activeNotePath, setActiveNotePath] = useState<string | null>(null);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_LANGUAGE);
  const [maxFilesPerScan, setMaxFilesPerScan] = useState(
    DEFAULT_MAX_FILES_PER_SCAN,
  );
  const [scanParallelism, setScanParallelism] = useState<
    "low" | "medium" | "high"
  >(DEFAULT_SCAN_PARALLELISM);
  const [flashcardOrder, setFlashcardOrder] =
    useState<FlashcardOrder>(DEFAULT_FLASHCARD_ORDER);
  const [flashcardMode, setFlashcardMode] =
    useState<FlashcardMode>(DEFAULT_FLASHCARD_MODE);
  const [flashcardScope, setFlashcardScope] =
    useState<FlashcardScope>(DEFAULT_FLASHCARD_SCOPE);
  const [flashcardPageSize, setFlashcardPageSize] =
    useState<FlashcardPageSize>(DEFAULT_FLASHCARD_PAGE_SIZE);
  const [solutionRevealEnabled, setSolutionRevealEnabled] = useState(true);
  const [statsResetMode, setStatsResetMode] =
    useState<StatsResetMode>(DEFAULT_STATS_RESET_MODE);
  const [fastFlashcardOrder, setFastFlashcardOrder] =
    useState<FlashcardOrder>(DEFAULT_FAST_FLASHCARD_ORDER);
  const [fastFlashcardMode, setFastFlashcardMode] =
    useState<FlashcardMode>(DEFAULT_FAST_FLASHCARD_MODE);
  const [fastFlashcardScope, setFastFlashcardScope] =
    useState<FlashcardScope>(DEFAULT_FAST_FLASHCARD_SCOPE);
  const [fastFlashcardDuration, setFastFlashcardDuration] = useState(
    DEFAULT_FAST_FLASHCARD_DURATION,
  );
  const [spacedRepetitionBoxes, setSpacedRepetitionBoxes] =
    useState<SpacedRepetitionBoxes>(DEFAULT_SPACED_REPETITION_BOXES);
  const [spacedRepetitionOrder, setSpacedRepetitionOrder] =
    useState<SpacedRepetitionOrder>(DEFAULT_SPACED_REPETITION_ORDER);
  const [spacedRepetitionPageSize, setSpacedRepetitionPageSize] =
    useState<SpacedRepetitionPageSize>(DEFAULT_SPACED_REPETITION_PAGE_SIZE);
  const [
    spacedRepetitionRepetitionStrength,
    setSpacedRepetitionRepetitionStrength,
  ] = useState<SpacedRepetitionRepetitionStrength>(
    DEFAULT_SPACED_REPETITION_REPETITION_STRENGTH,
  );
  const [spacedRepetitionStatsView, setSpacedRepetitionStatsView] =
    useState<SpacedRepetitionStatsView>(DEFAULT_SPACED_REPETITION_STATS_VIEW);
  const [rightToolbarCollapsed, setRightToolbarCollapsed] = useState(
    DEFAULT_RIGHT_TOOLBAR_COLLAPSED,
  );
  const autoSaveReady = useRef(false);
  const autoSaveTimer = useRef<number | null>(null);

  const saveSettings = useCallback(
    async (settings: {
      activeNotePath: string | null;
      vaultPath: string | null;
      theme: ThemeMode;
      accentColor: string;
      editorExactColors: boolean;
      editorBlueprintGrid: boolean;
      editorBlueprintGridIntensity: EditorGridIntensity;
      language: AppLanguage;
      maxFilesPerScan: string;
      scanParallelism: "low" | "medium" | "high";
      flashcardOrder: FlashcardOrder;
      flashcardMode: FlashcardMode;
      flashcardScope: FlashcardScope;
      flashcardPageSize: FlashcardPageSize;
      solutionRevealEnabled: boolean;
      statsResetMode: StatsResetMode;
      spacedRepetitionBoxes: SpacedRepetitionBoxes;
      spacedRepetitionOrder: SpacedRepetitionOrder;
      spacedRepetitionPageSize: SpacedRepetitionPageSize;
      spacedRepetitionRepetitionStrength: SpacedRepetitionRepetitionStrength;
      spacedRepetitionStatsView: SpacedRepetitionStatsView;
      rightToolbarCollapsed: boolean;
      fastFlashcardOrder: FlashcardOrder;
      fastFlashcardMode: FlashcardMode;
      fastFlashcardScope: FlashcardScope;
      fastFlashcardDuration: number;
    }) => {
      try {
        await invoke("save_app_settings", {
          activeNotePath: settings.activeNotePath,
          vaultPath: settings.vaultPath,
          theme: settings.theme,
          accentColor: settings.accentColor,
          editorExactColors: settings.editorExactColors,
          editorBlueprintGrid: settings.editorBlueprintGrid,
          editorBlueprintGridIntensity: settings.editorBlueprintGridIntensity,
          language: settings.language,
          maxFilesPerScan: settings.maxFilesPerScan,
          scanParallelism: settings.scanParallelism,
          flashcardOrder: settings.flashcardOrder,
          flashcardMode: settings.flashcardMode,
          flashcardScope: settings.flashcardScope,
          flashcardPageSize: settings.flashcardPageSize,
          flashcardSolutionRevealEnabled: settings.solutionRevealEnabled,
          flashcardStatsResetMode: settings.statsResetMode,
          fastFlashcardOrder: settings.fastFlashcardOrder,
          fastFlashcardMode: settings.fastFlashcardMode,
          fastFlashcardScope: settings.fastFlashcardScope,
          fastFlashcardDuration: settings.fastFlashcardDuration,
          spacedRepetitionBoxes: settings.spacedRepetitionBoxes,
          spacedRepetitionOrder: settings.spacedRepetitionOrder,
          spacedRepetitionPageSize: settings.spacedRepetitionPageSize,
          spacedRepetitionRepetitionStrength:
            settings.spacedRepetitionRepetitionStrength,
          spacedRepetitionStatsView: settings.spacedRepetitionStatsView,
          rightToolbarCollapsed: settings.rightToolbarCollapsed,
        });
        return true;
      } catch (error) {
        console.error("Failed to save settings", error);
        return false;
      }
    },
    [],
  );

  const persistSettings = useCallback(
    async (updates: PersistUpdates) => {
      if (!settingsLoaded) {
        return false;
      }
      const nextSettings = {
        activeNotePath: updates.activeNotePath ?? activeNotePath,
        vaultPath: updates.vaultPath ?? vaultPath,
        theme: updates.theme ?? theme,
        accentColor: updates.accentColor ?? accentColor,
        editorExactColors: updates.editorExactColors ?? editorExactColors,
        editorBlueprintGrid: updates.editorBlueprintGrid ?? editorBlueprintGrid,
        editorBlueprintGridIntensity:
          updates.editorBlueprintGridIntensity ?? editorBlueprintGridIntensity,
        language: updates.language ?? language,
        maxFilesPerScan: updates.maxFilesPerScan ?? maxFilesPerScan,
        scanParallelism: updates.scanParallelism ?? scanParallelism,
        flashcardOrder: updates.flashcardOrder ?? flashcardOrder,
        flashcardMode: updates.flashcardMode ?? flashcardMode,
        flashcardScope: updates.flashcardScope ?? flashcardScope,
        fastFlashcardOrder: updates.fastFlashcardOrder ?? fastFlashcardOrder,
        fastFlashcardMode: updates.fastFlashcardMode ?? fastFlashcardMode,
        fastFlashcardScope: updates.fastFlashcardScope ?? fastFlashcardScope,
        fastFlashcardDuration:
          updates.fastFlashcardDuration ?? fastFlashcardDuration,
        flashcardPageSize: updates.flashcardPageSize ?? flashcardPageSize,
        solutionRevealEnabled:
          updates.solutionRevealEnabled ?? solutionRevealEnabled,
        statsResetMode: updates.statsResetMode ?? statsResetMode,
        spacedRepetitionBoxes:
          updates.spacedRepetitionBoxes ?? spacedRepetitionBoxes,
        spacedRepetitionOrder:
          updates.spacedRepetitionOrder ?? spacedRepetitionOrder,
        spacedRepetitionPageSize:
          updates.spacedRepetitionPageSize ?? spacedRepetitionPageSize,
        spacedRepetitionRepetitionStrength:
          updates.spacedRepetitionRepetitionStrength ??
          spacedRepetitionRepetitionStrength,
        spacedRepetitionStatsView:
          updates.spacedRepetitionStatsView ?? spacedRepetitionStatsView,
        rightToolbarCollapsed:
          updates.rightToolbarCollapsed ?? rightToolbarCollapsed,
      };
      const saved = await saveSettings(nextSettings);
      if (saved && "activeNotePath" in updates) {
        setActiveNotePath(nextSettings.activeNotePath ?? null);
      }
      if (saved && "vaultPath" in updates) {
        setVaultPath(nextSettings.vaultPath ?? null);
      }
      return saved;
    },
    [
      activeNotePath,
      accentColor,
      editorExactColors,
      editorBlueprintGrid,
      editorBlueprintGridIntensity,
      flashcardMode,
      flashcardOrder,
      fastFlashcardMode,
      fastFlashcardOrder,
      fastFlashcardScope,
      fastFlashcardDuration,
      flashcardPageSize,
      flashcardScope,
      language,
      maxFilesPerScan,
      saveSettings,
      scanParallelism,
      settingsLoaded,
      solutionRevealEnabled,
      spacedRepetitionBoxes,
      spacedRepetitionOrder,
      spacedRepetitionPageSize,
      spacedRepetitionRepetitionStrength,
      spacedRepetitionStatsView,
      statsResetMode,
      theme,
      vaultPath,
      rightToolbarCollapsed,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    const restoreSettings = async () => {
      try {
        const settings = await invoke<AppSettings>("load_app_settings");
        if (cancelled) {
          return;
        }

        const storedTheme = settings.theme === "dark" ? "dark" : DEFAULT_THEME;
        const storedAccentRaw = settings.accent_color ?? DEFAULT_ACCENT;
        const storedAccent = normalizeHex(storedAccentRaw);
        const resolvedAccent = isValidHex(storedAccent)
          ? storedAccent
          : DEFAULT_ACCENT;
        const storedEditorExactColors =
          typeof settings.editor_exact_colors === "boolean"
            ? settings.editor_exact_colors
            : DEFAULT_EDITOR_EXACT_COLORS;
        const storedEditorBlueprintGrid =
          typeof settings.editor_blueprint_grid === "boolean"
            ? settings.editor_blueprint_grid
            : DEFAULT_EDITOR_BLUEPRINT_GRID;
        const storedEditorBlueprintGridIntensity =
          settings.editor_blueprint_grid_intensity === "light" ||
          settings.editor_blueprint_grid_intensity === "strong" ||
          settings.editor_blueprint_grid_intensity === "medium"
            ? settings.editor_blueprint_grid_intensity
            : DEFAULT_EDITOR_BLUEPRINT_GRID_INTENSITY;
        const storedLanguage =
          settings.language === "en" ? "en" : DEFAULT_LANGUAGE;
        const maxFilesRaw = settings.max_files_per_scan;
        const maxFilesValue =
          typeof maxFilesRaw === "number"
            ? String(maxFilesRaw)
            : typeof maxFilesRaw === "string"
              ? maxFilesRaw.trim()
              : DEFAULT_MAX_FILES_PER_SCAN;
        const storedMaxFilesPerScan =
          maxFilesValue === ""
            ? ""
            : /^[0-9]+$/.test(maxFilesValue)
              ? maxFilesValue
              : DEFAULT_MAX_FILES_PER_SCAN;
        const storedScanParallelism =
          settings.scan_parallelism === "low" ||
          settings.scan_parallelism === "high" ||
          settings.scan_parallelism === "medium"
            ? settings.scan_parallelism
            : DEFAULT_SCAN_PARALLELISM;
        const storedFlashcardOrder =
          settings.flashcard_order === "random"
            ? "random"
            : DEFAULT_FLASHCARD_ORDER;
        const storedFlashcardMode =
          settings.flashcard_mode === "all" ||
          settings.flashcard_mode === "qa" ||
          settings.flashcard_mode === "multiple-choice" ||
          settings.flashcard_mode === "mix" ||
          settings.flashcard_mode === "fill-blank" ||
          settings.flashcard_mode === "assignment" ||
          settings.flashcard_mode === "true-false"
            ? settings.flashcard_mode
            : settings.flashcard_mode === "yes-no"
              ? "true-false"
              : DEFAULT_FLASHCARD_MODE;
        const storedFlashcardScope =
          settings.flashcard_scope === "vault"
            ? "vault"
            : DEFAULT_FLASHCARD_SCOPE;
        const storedFastFlashcardOrder =
          settings.fast_flashcard_order === "random"
            ? "random"
            : DEFAULT_FAST_FLASHCARD_ORDER;
        const storedFastFlashcardMode =
          settings.fast_flashcard_mode === "all" ||
          settings.fast_flashcard_mode === "qa" ||
          settings.fast_flashcard_mode === "multiple-choice" ||
          settings.fast_flashcard_mode === "mix" ||
          settings.fast_flashcard_mode === "fill-blank" ||
          settings.fast_flashcard_mode === "assignment" ||
          settings.fast_flashcard_mode === "true-false"
            ? settings.fast_flashcard_mode
            : settings.fast_flashcard_mode === "yes-no"
              ? "true-false"
              : DEFAULT_FAST_FLASHCARD_MODE;
        const storedFastFlashcardScope =
          settings.fast_flashcard_scope === "vault"
            ? "vault"
            : DEFAULT_FAST_FLASHCARD_SCOPE;
        const storedFastFlashcardDurationRaw = settings.fast_flashcard_duration;
        const storedFastFlashcardDurationValue =
          typeof storedFastFlashcardDurationRaw === "number"
            ? storedFastFlashcardDurationRaw
            : typeof storedFastFlashcardDurationRaw === "string"
              ? Number.parseInt(storedFastFlashcardDurationRaw, 10)
              : DEFAULT_FAST_FLASHCARD_DURATION;
        const storedFastFlashcardDuration =
          FAST_FLASHCARD_DURATIONS.includes(
            storedFastFlashcardDurationValue as FastFlashcardDuration,
          )
            ? (storedFastFlashcardDurationValue as FastFlashcardDuration)
            : DEFAULT_FAST_FLASHCARD_DURATION;
        const storedFlashcardPageSizeRaw = settings.flashcard_page_size;
        const migratedFlashcardPageSize =
          storedFlashcardPageSizeRaw === 10
            ? 5
            : storedFlashcardPageSizeRaw;
        const storedFlashcardPageSize =
          typeof migratedFlashcardPageSize === "number" &&
          FLASHCARD_PAGE_SIZES.includes(
            migratedFlashcardPageSize as FlashcardPageSize,
          )
            ? (migratedFlashcardPageSize as FlashcardPageSize)
            : DEFAULT_FLASHCARD_PAGE_SIZE;
        const storedSolutionRevealEnabled =
          typeof settings.flashcard_solution_reveal_enabled === "boolean"
            ? settings.flashcard_solution_reveal_enabled
            : true;
        const storedStatsResetMode =
          settings.flashcard_stats_reset_mode === "session"
            ? "session"
            : DEFAULT_STATS_RESET_MODE;
        const storedSpacedRepetitionBoxes =
          typeof settings.spaced_repetition_boxes === "number" &&
          SPACED_REPETITION_BOXES.includes(
            settings.spaced_repetition_boxes as SpacedRepetitionBoxes,
          )
            ? (settings.spaced_repetition_boxes as SpacedRepetitionBoxes)
            : DEFAULT_SPACED_REPETITION_BOXES;
        const storedSpacedRepetitionOrder =
          settings.spaced_repetition_order === "random" ||
          settings.spaced_repetition_order === "repetition"
            ? settings.spaced_repetition_order
            : DEFAULT_SPACED_REPETITION_ORDER;
        const storedSpacedRepetitionPageSizeRaw =
          settings.spaced_repetition_page_size;
        const migratedSpacedRepetitionPageSize =
          storedSpacedRepetitionPageSizeRaw === 10
            ? 5
            : storedSpacedRepetitionPageSizeRaw;
        const storedSpacedRepetitionPageSize =
          typeof migratedSpacedRepetitionPageSize === "number" &&
          SPACED_REPETITION_PAGE_SIZES.includes(
            migratedSpacedRepetitionPageSize as SpacedRepetitionPageSize,
          )
            ? (migratedSpacedRepetitionPageSize as SpacedRepetitionPageSize)
            : DEFAULT_SPACED_REPETITION_PAGE_SIZE;
        const storedSpacedRepetitionRepetitionStrength =
          settings.spaced_repetition_repetition_strength === "weak" ||
          settings.spaced_repetition_repetition_strength === "strong" ||
          settings.spaced_repetition_repetition_strength === "medium"
            ? settings.spaced_repetition_repetition_strength
            : DEFAULT_SPACED_REPETITION_REPETITION_STRENGTH;
        const storedSpacedRepetitionStatsView =
          settings.spaced_repetition_stats_view === "vault" ||
          settings.spaced_repetition_stats_view === "completed"
            ? settings.spaced_repetition_stats_view
            : DEFAULT_SPACED_REPETITION_STATS_VIEW;
        const storedActiveNotePath =
          typeof settings.active_note_path === "string"
            ? settings.active_note_path
            : null;
        const storedRightToolbarCollapsed =
          typeof settings.right_toolbar_collapsed === "boolean"
            ? settings.right_toolbar_collapsed
            : DEFAULT_RIGHT_TOOLBAR_COLLAPSED;
        setTheme(storedTheme);
        setAccentColor(resolvedAccent);
        setAccentDraft(resolvedAccent);
        setAccentError("");
        setEditorExactColors(storedEditorExactColors);
        setEditorBlueprintGrid(storedEditorBlueprintGrid);
        setEditorBlueprintGridIntensity(storedEditorBlueprintGridIntensity);
        setActiveNotePath(storedActiveNotePath);
        setVaultPath(settings.vault_path ?? null);
        setLanguage(storedLanguage);
        setMaxFilesPerScan(storedMaxFilesPerScan);
        setScanParallelism(storedScanParallelism);
        setFlashcardOrder(storedFlashcardOrder);
        setFlashcardMode(storedFlashcardMode);
        setFlashcardScope(storedFlashcardScope);
        setFastFlashcardOrder(storedFastFlashcardOrder);
        setFastFlashcardMode(storedFastFlashcardMode);
        setFastFlashcardScope(storedFastFlashcardScope);
        setFastFlashcardDuration(storedFastFlashcardDuration);
        setFlashcardPageSize(storedFlashcardPageSize);
        setSolutionRevealEnabled(storedSolutionRevealEnabled);
        setStatsResetMode(storedStatsResetMode);
        setSpacedRepetitionBoxes(storedSpacedRepetitionBoxes);
        setSpacedRepetitionOrder(storedSpacedRepetitionOrder);
        setSpacedRepetitionPageSize(storedSpacedRepetitionPageSize);
        setSpacedRepetitionRepetitionStrength(
          storedSpacedRepetitionRepetitionStrength,
        );
        setSpacedRepetitionStatsView(storedSpacedRepetitionStatsView);
        setRightToolbarCollapsed(storedRightToolbarCollapsed);
        setSettingsLoaded(true);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load settings", error);
          setSettingsLoaded(true);
        }
      }
    };

    void restoreSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyAccentColor(accentColor);
  }, [accentColor]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mdEditorColors = editorExactColors ? "on" : "off";
  }, [editorExactColors]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mdEditorGrid = editorBlueprintGrid ? "on" : "off";
  }, [editorBlueprintGrid]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mdEditorGridIntensity = editorBlueprintGridIntensity;
  }, [editorBlueprintGridIntensity]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    if (!autoSaveReady.current) {
      autoSaveReady.current = true;
      return;
    }
    if (autoSaveTimer.current) {
      window.clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = window.setTimeout(() => {
      void saveSettings({
        activeNotePath,
        vaultPath,
        theme,
        accentColor,
        editorExactColors,
        editorBlueprintGrid,
        editorBlueprintGridIntensity,
        language,
        maxFilesPerScan,
        scanParallelism,
        flashcardOrder,
        flashcardMode,
        flashcardScope,
        flashcardPageSize,
        solutionRevealEnabled,
        statsResetMode,
        spacedRepetitionBoxes,
        spacedRepetitionOrder,
        spacedRepetitionPageSize,
        spacedRepetitionRepetitionStrength,
        spacedRepetitionStatsView,
        rightToolbarCollapsed,
        fastFlashcardOrder,
        fastFlashcardMode,
        fastFlashcardScope,
        fastFlashcardDuration,
      });
    }, 300);

    return () => {
      if (autoSaveTimer.current) {
        window.clearTimeout(autoSaveTimer.current);
      }
    };
  }, [
    accentColor,
    activeNotePath,
    editorExactColors,
    editorBlueprintGrid,
    editorBlueprintGridIntensity,
    flashcardMode,
    flashcardOrder,
    fastFlashcardMode,
    fastFlashcardOrder,
    fastFlashcardScope,
    fastFlashcardDuration,
    flashcardPageSize,
    flashcardScope,
    language,
    maxFilesPerScan,
    saveSettings,
    scanParallelism,
    settingsLoaded,
    solutionRevealEnabled,
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionPageSize,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionStatsView,
    statsResetMode,
    theme,
    vaultPath,
    rightToolbarCollapsed,
  ]);

  return {
    accentColor,
    activeNotePath,
    accentDraft,
    accentError,
    editorExactColors,
    editorBlueprintGrid,
    editorBlueprintGridIntensity,
    flashcardMode,
    flashcardOrder,
    fastFlashcardMode,
    fastFlashcardOrder,
    fastFlashcardScope,
    fastFlashcardDuration,
    flashcardPageSize,
    flashcardScope,
    language,
    maxFilesPerScan,
    persistSettings,
    scanParallelism,
    setAccentColor,
    setAccentDraft,
    setAccentError,
    setActiveNotePath,
    setEditorExactColors,
    setEditorBlueprintGrid,
    setEditorBlueprintGridIntensity,
    setFlashcardMode,
    setFlashcardOrder,
    setFlashcardPageSize,
    setFlashcardScope,
    setFastFlashcardMode,
    setFastFlashcardOrder,
    setFastFlashcardScope,
    setFastFlashcardDuration,
    setLanguage,
    setMaxFilesPerScan,
    setRightToolbarCollapsed,
    setScanParallelism,
    setSolutionRevealEnabled,
    setSpacedRepetitionBoxes,
    setSpacedRepetitionOrder,
    setSpacedRepetitionPageSize,
    setSpacedRepetitionRepetitionStrength,
    setSpacedRepetitionStatsView,
    setStatsResetMode,
    setTheme,
    settingsLoaded,
    solutionRevealEnabled,
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionPageSize,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionStatsView,
    statsResetMode,
    theme,
    vaultPath,
    rightToolbarCollapsed,
  };
};

---

## 📝 logic.ts — ./features/spaced-repetition/logic.ts

import type { Flashcard, FlashcardPart } from "../../lib/flashcards";
import type {
  CompositePartState,
  FlashcardResult,
  FlashcardSelfGrade,
  TrueFalseSelection,
} from "../flashcards/logic";

export const MAX_SPACED_REPETITION_BOX = 8;
export type SpacedRepetitionRepetitionStrength = "weak" | "medium" | "strong";

// Index 0..7 maps to boxes 1..8 for weighted repetition order.
const REPETITION_WEIGHTS: Record<SpacedRepetitionRepetitionStrength, number[]> = {
  weak: [6, 5, 4, 3, 2, 2, 1, 1],
  medium: [8, 5, 3, 2, 1, 1, 1, 1],
  strong: [12, 6, 3, 2, 1, 1, 1, 1],
};

export type SpacedRepetitionCardProgress = {
  boxCanonical: number;
  attempts: number;
  lastResult: FlashcardResult;
  lastReviewedAt: string | null;
};

type SpacedRepetitionCardProgressInput = Partial<SpacedRepetitionCardProgress> & {
  box?: number;
  boxCanonical?: number;
};

export type SpacedRepetitionSession = {
  flashcards: Flashcard[];
  cardIds: string[];
  selections: Record<number, string[]>;
  textResponses: Record<number, string>;
  textRevealed: Record<number, boolean>;
  selfGrades: Record<number, FlashcardSelfGrade>;
  submissions: Record<number, boolean>;
  trueFalseSelections: Record<number, Record<string, TrueFalseSelection>>;
  clozeResponses: Record<number, Record<string, string>>;
  compositeStates: Record<number, CompositePartState[]>;
  page: number;
  cardProgressById: Record<string, SpacedRepetitionCardProgress>;
  completedPerDay: Record<string, number>;
};

export type SpacedRepetitionUser = {
  id: string;
  name: string;
  createdAt: string;
};

export type SpacedRepetitionUserState = {
  cardStates: Record<string, SpacedRepetitionCardProgress>;
  lastLoadedAt: string | null;
  completedPerDay: Record<string, number>;
};

export type SpacedRepetitionStorage = {
  users: SpacedRepetitionUser[];
  userStateById: Record<string, SpacedRepetitionUserState>;
  lastActiveUserId: string | null;
};

export const createSpacedRepetitionUserId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const getFlashcardPartIdentityPayload = (card: FlashcardPart) => {
  if (card.kind === "multiple-choice") {
    return {
      kind: card.kind,
      question: card.question,
      options: card.options,
      correctKeys: [...card.correctKeys].sort((a, b) => a.localeCompare(b)),
    };
  }

  if (card.kind === "true-false") {
    return {
      kind: card.kind,
      items: card.items,
    };
  }

  if (card.kind === "free-text") {
    return {
      kind: card.kind,
      front: card.front,
      back: card.back,
    };
  }

  return {
    kind: card.kind,
    question: card.question,
    segments: card.segments,
    dragTokens: card.dragTokens,
  };
};

const getFlashcardLegacyPartIdentityPayload = (card: FlashcardPart) => {
  if (card.kind === "multiple-choice") {
    return {
      kind: card.kind,
      question: card.question,
      options: card.options,
      correctKeys: card.correctKeys,
    };
  }

  if (card.kind === "true-false") {
    return {
      kind: card.kind,
      items: card.items,
    };
  }

  if (card.kind === "free-text") {
    return {
      kind: card.kind,
      front: card.front,
      back: card.back,
    };
  }

  return {
    kind: card.kind,
    question: card.question,
    segments: card.segments,
    dragTokens: card.dragTokens,
  };
};

const getFlashcardIdentityPayload = (card: Flashcard) => {
  if (card.kind === "composite") {
    return {
      kind: card.kind,
      parts: card.parts.map(getFlashcardPartIdentityPayload),
    };
  }
  return getFlashcardPartIdentityPayload(card);
};

const getFlashcardLegacyIdentityPayload = (card: Flashcard) => {
  if (card.kind === "composite") {
    return {
      kind: card.kind,
      parts: card.parts.map(getFlashcardLegacyPartIdentityPayload),
    };
  }
  return getFlashcardLegacyPartIdentityPayload(card);
};

export const getFlashcardId = (card: Flashcard) =>
  `card-${hashString(JSON.stringify(getFlashcardIdentityPayload(card)))}`;

const getFlashcardLegacyId = (card: Flashcard) =>
  `card-${hashString(JSON.stringify(getFlashcardLegacyIdentityPayload(card)))}`;

export const createEmptySpacedRepetitionSession = (): SpacedRepetitionSession => ({
  flashcards: [],
  cardIds: [],
  selections: {},
  textResponses: {},
  textRevealed: {},
  selfGrades: {},
  submissions: {},
  trueFalseSelections: {},
  clozeResponses: {},
  compositeStates: {},
  page: 0,
  cardProgressById: {},
  completedPerDay: {},
});

export const createEmptySpacedRepetitionUserState = (): SpacedRepetitionUserState => ({
  cardStates: {},
  lastLoadedAt: null,
  completedPerDay: {},
});

export const normalizeSpacedRepetitionCardProgress = (
  progress?: SpacedRepetitionCardProgressInput | null,
): SpacedRepetitionCardProgress => {
  const rawBoxCanonical =
    typeof progress?.boxCanonical === "number" && Number.isFinite(progress.boxCanonical)
      ? progress.boxCanonical
      : typeof progress?.box === "number" && Number.isFinite(progress.box)
        ? progress.box
        : 1;
  const clampedBoxCanonical = Math.min(
    MAX_SPACED_REPETITION_BOX,
    Math.max(1, rawBoxCanonical),
  );

  return {
    boxCanonical: clampedBoxCanonical,
    attempts:
      typeof progress?.attempts === "number" && Number.isFinite(progress.attempts)
        ? Math.max(0, progress.attempts)
        : 0,
    lastResult:
      progress?.lastResult === "correct" || progress?.lastResult === "incorrect"
        ? progress.lastResult
        : "neutral",
    lastReviewedAt:
      typeof progress?.lastReviewedAt === "string"
        ? progress.lastReviewedAt
        : null,
  };
};

export const getSpacedRepetitionEffectiveBox = (
  progress: SpacedRepetitionCardProgress,
  boxCount: number,
) => Math.min(progress.boxCanonical, boxCount);

const shuffleEntries = <T>(entries: T[]) => {
  const copy = [...entries];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const buildWeightedOrder = <T extends { progress: SpacedRepetitionCardProgress }>(
  entries: T[],
  boxCount: number,
  strength: SpacedRepetitionRepetitionStrength,
) => {
  const weights = REPETITION_WEIGHTS[strength];
  const candidates = entries
    .map((entry) => {
      const effectiveBox = getSpacedRepetitionEffectiveBox(entry.progress, boxCount);
      return {
        entry,
        effectiveBox,
        weight: Math.max(1, weights[effectiveBox - 1] ?? 1),
      };
    })
    .filter((candidate) => candidate.effectiveBox < boxCount);

  const ordered: T[] = [];
  while (candidates.length > 0) {
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    let threshold = Math.random() * totalWeight;
    const index = candidates.findIndex((candidate) => {
      threshold -= candidate.weight;
      return threshold <= 0;
    });
    const pickedIndex = index >= 0 ? index : candidates.length - 1;
    const [picked] = candidates.splice(pickedIndex, 1);
    ordered.push(picked.entry);
  }
  return ordered;
};

export const buildSpacedRepetitionSession = (
  flashcards: Flashcard[],
  existingCardStates: Record<string, SpacedRepetitionCardProgress> = {},
  options?: {
    order?: "in-order" | "random" | "repetition";
    boxCount?: number;
    repetitionStrength?: SpacedRepetitionRepetitionStrength;
  },
): SpacedRepetitionSession => {
  const nextCardStates = Object.fromEntries(
    Object.entries(existingCardStates).map(([cardId, progress]) => [
      cardId,
      normalizeSpacedRepetitionCardProgress(progress),
    ]),
  );

  const cardIds = flashcards.map((card) => {
    const cardId = getFlashcardId(card);
    const legacyId = getFlashcardLegacyId(card);
    if (!nextCardStates[cardId]) {
      if (legacyId !== cardId && nextCardStates[legacyId]) {
        nextCardStates[cardId] = nextCardStates[legacyId];
        delete nextCardStates[legacyId];
      } else {
        nextCardStates[cardId] = normalizeSpacedRepetitionCardProgress(null);
      }
    }
    return cardId;
  });

  const entries = flashcards.map((card, index) => ({
    card,
    cardId: cardIds[index],
    progress: nextCardStates[cardIds[index]],
  }));
  const order = options?.order ?? "in-order";
  const boxCount = options?.boxCount ?? MAX_SPACED_REPETITION_BOX;
  const orderedEntries =
    order === "random"
      ? shuffleEntries(entries)
      : order === "repetition"
        ? buildWeightedOrder(
            entries,
            boxCount,
            options?.repetitionStrength ?? "medium",
          )
        : entries;

  return {
    ...createEmptySpacedRepetitionSession(),
    flashcards: orderedEntries.map((entry) => entry.card),
    cardIds: orderedEntries.map((entry) => entry.cardId),
    cardProgressById: nextCardStates,
  };
};

---

## 📝 useSpacedRepetition.ts — ./features/spaced-repetition/useSpacedRepetition.ts

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  evaluateFlashcardResult,
  getClozeDragPayload,
  type CompositePartState,
  type FlashcardSelfGrade,
  type TrueFalseSelection,
} from "../flashcards/logic";
import type { FlashcardOrder, FlashcardScope } from "../flashcards/useFlashcards";
import type { Flashcard } from "../../lib/flashcards";
import {
  buildSpacedRepetitionSession,
  createEmptySpacedRepetitionSession,
  createEmptySpacedRepetitionUserState,
  createSpacedRepetitionUserId,
  getFlashcardId,
  getSpacedRepetitionEffectiveBox,
  MAX_SPACED_REPETITION_BOX,
  normalizeSpacedRepetitionCardProgress,
  type SpacedRepetitionRepetitionStrength,
  type SpacedRepetitionSession,
  type SpacedRepetitionStorage,
  type SpacedRepetitionUser,
  type SpacedRepetitionUserState,
} from "./logic";

export type SpacedRepetitionPageSize = 1 | 2 | 3 | 5;
export type SpacedRepetitionBoxes = 3 | 5 | 8;
export type SpacedRepetitionOrder = "in-order" | "random" | "repetition";
export type SpacedRepetitionStatsView = "boxes" | "vault" | "completed";
export type { SpacedRepetitionRepetitionStrength };

export const SPACED_REPETITION_PAGE_SIZES: SpacedRepetitionPageSize[] = [
  1, 2, 3, 5,
];
export const DEFAULT_SPACED_REPETITION_PAGE_SIZE: SpacedRepetitionPageSize = 2;
export const SPACED_REPETITION_BOXES: SpacedRepetitionBoxes[] = [3, 5, 8];
const DAY_MS = 24 * 60 * 60 * 1000;
const BERLIN_TIME_ZONE = "Europe/Berlin";
const berlinDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BERLIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const berlinWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BERLIN_TIME_ZONE,
  weekday: "short",
});

const buildBerlinDateKey = (date: Date) => {
  const parts = berlinDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  if (!year || !month || !day) {
    return berlinDateFormatter.format(date);
  }
  return `${year}-${month}-${day}`;
};

const buildBerlinWeekdayLabel = (date: Date) =>
  berlinWeekdayFormatter.format(date);

const buildLastSevenDays = (now = new Date()) => {
  const days: Date[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    days.push(new Date(now.getTime() - offset * DAY_MS));
  }
  return days;
};

const normalizeCompletedPerDay = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, count]) => typeof count === "number" && Number.isFinite(count))
      .map(([key, count]) => [key, Math.max(0, Math.floor(count))]),
  );
};

const normalizeSpacedRepetitionPageSize = (value: number) => {
  if (value === 10) {
    return 5;
  }
  return SPACED_REPETITION_PAGE_SIZES.includes(value as SpacedRepetitionPageSize)
    ? (value as SpacedRepetitionPageSize)
    : DEFAULT_SPACED_REPETITION_PAGE_SIZE;
};

type UseSpacedRepetitionOptions = {
  isFlashcardScanning: boolean;
  scanFlashcards: (options?: {
    scopeOverride?: FlashcardScope;
    allowVaultFallback?: boolean;
    orderOverride?: FlashcardOrder;
  }) => Promise<Flashcard[]>;
  setIsFlashcardScanning: (value: boolean) => void;
  settings: {
    spacedRepetitionBoxes: SpacedRepetitionBoxes;
    spacedRepetitionOrder: SpacedRepetitionOrder;
    spacedRepetitionPageSize: SpacedRepetitionPageSize;
    spacedRepetitionRepetitionStrength: SpacedRepetitionRepetitionStrength;
    spacedRepetitionStatsView: SpacedRepetitionStatsView;
    setSpacedRepetitionBoxes: (value: SpacedRepetitionBoxes) => void;
    setSpacedRepetitionOrder: (value: SpacedRepetitionOrder) => void;
    setSpacedRepetitionPageSize: (value: SpacedRepetitionPageSize) => void;
    setSpacedRepetitionRepetitionStrength: (
      value: SpacedRepetitionRepetitionStrength,
    ) => void;
    setSpacedRepetitionStatsView: (value: SpacedRepetitionStatsView) => void;
  };
};

export const useSpacedRepetition = ({
  isFlashcardScanning,
  scanFlashcards,
  setIsFlashcardScanning,
  settings,
}: UseSpacedRepetitionOptions) => {
  const {
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionPageSize,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionStatsView,
    setSpacedRepetitionBoxes,
    setSpacedRepetitionOrder,
    setSpacedRepetitionPageSize,
    setSpacedRepetitionRepetitionStrength,
    setSpacedRepetitionStatsView,
  } = settings;
  const [spacedRepetitionUsers, setSpacedRepetitionUsers] = useState<
    SpacedRepetitionUser[]
  >([]);
  const [spacedRepetitionActiveUserId, setSpacedRepetitionActiveUserId] =
    useState<string | null>(null);
  const [spacedRepetitionSelectedUserId, setSpacedRepetitionSelectedUserId] =
    useState<string>("");
  const [spacedRepetitionNewUserName, setSpacedRepetitionNewUserName] =
    useState("");
  const [spacedRepetitionUserError, setSpacedRepetitionUserError] =
    useState("");
  const [spacedRepetitionUserStateById, setSpacedRepetitionUserStateById] =
    useState<Record<string, SpacedRepetitionUserState>>({});
  const [spacedRepetitionDataLoaded, setSpacedRepetitionDataLoaded] =
    useState(false);
  const [spacedRepetitionSessions, setSpacedRepetitionSessions] = useState<
    Record<string, SpacedRepetitionSession>
  >({});

  const spacedRepetitionActiveUser = spacedRepetitionActiveUserId
    ? spacedRepetitionUsers.find((user) => user.id === spacedRepetitionActiveUserId)
        ?.name ?? null
    : null;
  const spacedRepetitionActiveUserState = spacedRepetitionActiveUserId
    ? spacedRepetitionUserStateById[spacedRepetitionActiveUserId] ?? null
    : null;
  const spacedRepetitionSession = spacedRepetitionActiveUserId
    ? spacedRepetitionSessions[spacedRepetitionActiveUserId]
    : undefined;
  const spacedRepetitionFlashcards = spacedRepetitionSession?.flashcards ?? [];
  const spacedRepetitionSelections = spacedRepetitionSession?.selections ?? {};
  const spacedRepetitionTextResponses =
    spacedRepetitionSession?.textResponses ?? {};
  const spacedRepetitionTextRevealed = spacedRepetitionSession?.textRevealed ?? {};
  const spacedRepetitionSelfGrades = spacedRepetitionSession?.selfGrades ?? {};
  const spacedRepetitionSubmissions =
    spacedRepetitionSession?.submissions ?? {};
  const spacedRepetitionTrueFalseSelections =
    spacedRepetitionSession?.trueFalseSelections ?? {};
  const spacedRepetitionClozeResponses =
    spacedRepetitionSession?.clozeResponses ?? {};
  const spacedRepetitionCompositeStates =
    spacedRepetitionSession?.compositeStates ?? {};
  const spacedRepetitionPage = spacedRepetitionSession?.page ?? 0;
  const spacedRepetitionCardStates =
    spacedRepetitionSession?.cardProgressById ??
    spacedRepetitionActiveUserState?.cardStates ??
    {};
  const spacedRepetitionCompletedPerDay =
    spacedRepetitionSession?.completedPerDay ??
    spacedRepetitionActiveUserState?.completedPerDay ??
    {};

  const resolvedSpacedRepetitionPageSize = useMemo(
    () => normalizeSpacedRepetitionPageSize(spacedRepetitionPageSize),
    [spacedRepetitionPageSize],
  );

  const spacedRepetitionPageCount = useMemo(
    () =>
      Math.ceil(spacedRepetitionFlashcards.length / resolvedSpacedRepetitionPageSize),
    [resolvedSpacedRepetitionPageSize, spacedRepetitionFlashcards.length],
  );

  const spacedRepetitionPageIndex = useMemo(
    () =>
      Math.min(
        spacedRepetitionPage,
        Math.max(0, spacedRepetitionPageCount - 1),
      ),
    [spacedRepetitionPage, spacedRepetitionPageCount],
  );

  const spacedRepetitionPageStart =
    spacedRepetitionPageIndex * resolvedSpacedRepetitionPageSize;

  const spacedRepetitionVisibleFlashcards = useMemo(() => {
    return spacedRepetitionFlashcards.slice(
      spacedRepetitionPageStart,
      spacedRepetitionPageStart + resolvedSpacedRepetitionPageSize,
    );
  }, [
    resolvedSpacedRepetitionPageSize,
    spacedRepetitionFlashcards,
    spacedRepetitionPageStart,
  ]);

  const spacedRepetitionCanGoBack = spacedRepetitionPageIndex > 0;
  const spacedRepetitionCanGoNext =
    spacedRepetitionPageIndex < spacedRepetitionPageCount - 1;

  const spacedRepetitionStatusLabel =
    spacedRepetitionFlashcards.length === 0
      ? "No cards loaded yet"
      : `${spacedRepetitionFlashcards.length} cards loaded`;

  const spacedRepetitionEmptyState = spacedRepetitionActiveUser
    ? "Click the active user to load cards."
    : "Select a user to begin.";

  const {
    correctCount: spacedRepetitionCorrectCount,
    incorrectCount: spacedRepetitionIncorrectCount,
    total: spacedRepetitionTotalQuestions,
  } = useMemo(() => {
    const cardStates = Object.values(spacedRepetitionCardStates);
    let correct = 0;
    let incorrect = 0;
    cardStates.forEach((state) => {
      const normalized = normalizeSpacedRepetitionCardProgress(state);
      if (normalized.lastResult === "correct") {
        correct += 1;
      } else if (normalized.lastResult === "incorrect") {
        incorrect += 1;
      }
    });
    return { correctCount: correct, incorrectCount: incorrect, total: cardStates.length };
  }, [spacedRepetitionCardStates]);

  const spacedRepetitionCorrectPercent = useMemo(() => {
    const total = spacedRepetitionCorrectCount + spacedRepetitionIncorrectCount;
    if (total === 0) {
      return 0;
    }
    return Math.round((spacedRepetitionCorrectCount / total) * 100);
  }, [spacedRepetitionCorrectCount, spacedRepetitionIncorrectCount]);

  const spacedRepetitionProgressStats = useMemo(() => {
    const cardStates = Object.values(spacedRepetitionCardStates);
    const total = cardStates.length;
    if (total === 0) {
      return {
        dueNow: 0,
        dueToday: 0,
        inQueue: 0,
        completedToday: 0,
      };
    }

    const dueTodayThreshold = Math.min(2, spacedRepetitionBoxes);
    let dueNow = 0;
    let dueToday = 0;
    let completedEver = 0;

    for (const progress of cardStates) {
      const normalized = normalizeSpacedRepetitionCardProgress(progress);
      const effectiveBox = getSpacedRepetitionEffectiveBox(
        normalized,
        spacedRepetitionBoxes,
      );
      if (normalized.attempts > 0) {
        completedEver += 1;
      }
      if (effectiveBox <= 1) {
        dueNow += 1;
      }
      if (effectiveBox <= dueTodayThreshold) {
        dueToday += 1;
      }
    }

    const todayKey = buildBerlinDateKey(new Date());
    const completedToday = todayKey
      ? spacedRepetitionCompletedPerDay[todayKey] ?? 0
      : 0;

    return {
      dueNow,
      dueToday,
      inQueue: total - completedEver,
      completedToday,
    };
  }, [
    spacedRepetitionBoxes,
    spacedRepetitionCardStates,
    spacedRepetitionCompletedPerDay,
  ]);

  const spacedRepetitionBoxCounts = useMemo(() => {
    const counts = Array.from({ length: spacedRepetitionBoxes }, () => 0);
    Object.values(spacedRepetitionCardStates).forEach((progress) => {
      const normalized = normalizeSpacedRepetitionCardProgress(progress);
      const effectiveBox = getSpacedRepetitionEffectiveBox(
        normalized,
        spacedRepetitionBoxes,
      );
      const index = Math.max(1, Math.min(spacedRepetitionBoxes, effectiveBox)) - 1;
      counts[index] += 1;
    });
    return counts;
  }, [spacedRepetitionBoxes, spacedRepetitionCardStates]);

  const spacedRepetitionCompletedSeries = useMemo(() => {
    const days = buildLastSevenDays();
    const labels = days.map((day) => buildBerlinWeekdayLabel(day));
    const data = days.map((day) => {
      const key = buildBerlinDateKey(day);
      if (!key) {
        return 0;
      }
      return spacedRepetitionCompletedPerDay[key] ?? 0;
    });
    return { labels, data };
  }, [spacedRepetitionCompletedPerDay]);

  const updateActiveSpacedRepetitionSession = useCallback(
    (updater: (session: SpacedRepetitionSession) => SpacedRepetitionSession) => {
      if (!spacedRepetitionActiveUserId) {
        return;
      }
      setSpacedRepetitionSessions((prev) => {
        const current =
          prev[spacedRepetitionActiveUserId] ?? createEmptySpacedRepetitionSession();
        const next = updater(current);
        if (next === current) {
          return prev;
        }
        return { ...prev, [spacedRepetitionActiveUserId]: next };
      });
    },
    [spacedRepetitionActiveUserId],
  );

  useEffect(() => {
    let cancelled = false;

    const restoreSpacedRepetitionData = async () => {
      try {
        const storage = await invoke<SpacedRepetitionStorage>(
          "load_spaced_repetition_data",
        );
        if (cancelled) {
          return;
        }
        const users = Array.isArray(storage.users)
          ? storage.users
              .map((user) => {
                if (!user || typeof user !== "object") {
                  return null;
                }
                const id = "id" in user && typeof user.id === "string" ? user.id : "";
                const name =
                  "name" in user && typeof user.name === "string" ? user.name : "";
                if (!id || !name) {
                  return null;
                }
                const createdAt =
                  "createdAt" in user && typeof user.createdAt === "string"
                    ? user.createdAt
                    : new Date().toISOString();
                return { id, name, createdAt };
              })
              .filter((user): user is SpacedRepetitionUser => Boolean(user))
          : [];
        const userStateByIdRaw =
          storage.userStateById && typeof storage.userStateById === "object"
            ? storage.userStateById
            : {};
        const userIds = new Set(users.map((user) => user.id));
        const userStateById = Object.fromEntries(
          Object.entries(userStateByIdRaw)
            .filter(([userId]) => userIds.has(userId))
            .map(([userId, state]) => {
              const cardStatesRaw =
                state && typeof state === "object" && "cardStates" in state
                  ? (state as SpacedRepetitionUserState).cardStates
                  : {};
              const normalizedCardStates = Object.fromEntries(
                Object.entries(cardStatesRaw ?? {}).map(([cardId, progress]) => [
                  cardId,
                  normalizeSpacedRepetitionCardProgress(progress),
                ]),
              );
              const completedPerDayRaw =
                state && typeof state === "object" && "completedPerDay" in state
                  ? (state as SpacedRepetitionUserState).completedPerDay
                  : {};
              const completedPerDay = normalizeCompletedPerDay(completedPerDayRaw);
              const lastLoadedAt =
                state &&
                typeof state === "object" &&
                "lastLoadedAt" in state &&
                typeof (state as SpacedRepetitionUserState).lastLoadedAt === "string"
                  ? (state as SpacedRepetitionUserState).lastLoadedAt
                  : null;
              return [
                userId,
                {
                  cardStates: normalizedCardStates,
                  completedPerDay,
                  lastLoadedAt,
                },
              ];
            }),
        );
        const lastActiveUserId =
          storage.lastActiveUserId &&
          users.some((user) => user.id === storage.lastActiveUserId)
            ? storage.lastActiveUserId
            : null;

        setSpacedRepetitionUsers(users);
        setSpacedRepetitionUserStateById(userStateById);

        if (lastActiveUserId && users.some((user) => user.id === lastActiveUserId)) {
          setSpacedRepetitionActiveUserId(lastActiveUserId);
          setSpacedRepetitionSelectedUserId(lastActiveUserId);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load spaced repetition data", error);
          setSpacedRepetitionUsers([]);
          setSpacedRepetitionUserStateById({});
          setSpacedRepetitionActiveUserId(null);
          setSpacedRepetitionSelectedUserId("");
        }
      } finally {
        if (!cancelled) {
          setSpacedRepetitionDataLoaded(true);
        }
      }
    };

    void restoreSpacedRepetitionData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!spacedRepetitionDataLoaded) {
      return;
    }
    const storage: SpacedRepetitionStorage = {
      users: spacedRepetitionUsers,
      userStateById: spacedRepetitionUserStateById,
      lastActiveUserId: spacedRepetitionActiveUserId,
    };
    void invoke("save_spaced_repetition_data", { storage }).catch((error) => {
      console.error("Failed to save spaced repetition data", error);
    });
  }, [
    spacedRepetitionActiveUserId,
    spacedRepetitionDataLoaded,
    spacedRepetitionUserStateById,
    spacedRepetitionUsers,
  ]);

  useEffect(() => {
    const normalized = normalizeSpacedRepetitionPageSize(spacedRepetitionPageSize);
    if (normalized !== spacedRepetitionPageSize) {
      setSpacedRepetitionPageSize(normalized);
    }
  }, [spacedRepetitionPageSize]);

  useEffect(() => {
    if (!spacedRepetitionActiveUserId) {
      return;
    }
    setSpacedRepetitionSessions((prev) => {
      if (prev[spacedRepetitionActiveUserId]) {
        return prev;
      }
      const storedState =
        spacedRepetitionUserStateById[spacedRepetitionActiveUserId];
      return {
        ...prev,
        [spacedRepetitionActiveUserId]: {
          ...createEmptySpacedRepetitionSession(),
          cardProgressById: storedState?.cardStates ?? {},
          completedPerDay: storedState?.completedPerDay ?? {},
        },
      };
    });
  }, [spacedRepetitionActiveUserId, spacedRepetitionUserStateById]);

  useEffect(() => {
    if (!spacedRepetitionActiveUserId) {
      return;
    }
    const maxPage = Math.max(0, spacedRepetitionPageCount - 1);
    if (spacedRepetitionPage > maxPage) {
      updateActiveSpacedRepetitionSession((session) => ({
        ...session,
        page: maxPage,
      }));
    }
  }, [
    spacedRepetitionActiveUserId,
    spacedRepetitionPage,
    spacedRepetitionPageCount,
    updateActiveSpacedRepetitionSession,
  ]);

  useEffect(() => {
    if (!spacedRepetitionActiveUserId) {
      return;
    }
    const session = spacedRepetitionSessions[spacedRepetitionActiveUserId];
    if (!session) {
      return;
    }
    setSpacedRepetitionUserStateById((prev) => {
      const current =
        prev[spacedRepetitionActiveUserId] ?? createEmptySpacedRepetitionUserState();
      if (
        current.cardStates === session.cardProgressById &&
        current.completedPerDay === session.completedPerDay
      ) {
        return prev;
      }
      return {
        ...prev,
        [spacedRepetitionActiveUserId]: {
          ...current,
          cardStates: session.cardProgressById,
          completedPerDay: session.completedPerDay,
        },
      };
    });
  }, [spacedRepetitionActiveUserId, spacedRepetitionSessions]);

  const handleSpacedRepetitionCreateUser = useCallback(() => {
    const trimmed = spacedRepetitionNewUserName.trim();
    if (!trimmed) {
      setSpacedRepetitionUserError("User name is required.");
      return;
    }
    const normalized = trimmed.toLowerCase();
    const hasDuplicate = spacedRepetitionUsers.some(
      (user) => user.name.trim().toLowerCase() === normalized,
    );
    if (hasDuplicate) {
      setSpacedRepetitionUserError("User name already exists.");
      return;
    }

    const newUser: SpacedRepetitionUser = {
      id: createSpacedRepetitionUserId(),
      name: trimmed,
      createdAt: new Date().toISOString(),
    };

    setSpacedRepetitionUsers((prev) => [...prev, newUser]);
    setSpacedRepetitionUserStateById((prev) => ({
      ...prev,
      [newUser.id]: createEmptySpacedRepetitionUserState(),
    }));
    setSpacedRepetitionActiveUserId(newUser.id);
    setSpacedRepetitionSelectedUserId(newUser.id);
    setSpacedRepetitionNewUserName("");
    setSpacedRepetitionUserError("");
  }, [spacedRepetitionNewUserName, spacedRepetitionUsers]);

  const handleSpacedRepetitionLoadUser = useCallback(() => {
    if (!spacedRepetitionSelectedUserId) {
      return;
    }
    setSpacedRepetitionActiveUserId(spacedRepetitionSelectedUserId);
    setSpacedRepetitionUserStateById((prev) => {
      const current =
        prev[spacedRepetitionSelectedUserId] ?? createEmptySpacedRepetitionUserState();
      return {
        ...prev,
        [spacedRepetitionSelectedUserId]: {
          ...current,
          lastLoadedAt: new Date().toISOString(),
        },
      };
    });
    setSpacedRepetitionUserError("");
  }, [spacedRepetitionSelectedUserId]);

  const handleSpacedRepetitionDeleteUser = useCallback(() => {
    if (!spacedRepetitionSelectedUserId) {
      return;
    }
    const deletedId = spacedRepetitionSelectedUserId;

    setSpacedRepetitionSessions((prev) => {
      if (!prev[deletedId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[deletedId];
      return next;
    });
    setSpacedRepetitionUserStateById((prev) => {
      if (!prev[deletedId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[deletedId];
      return next;
    });
    setSpacedRepetitionUsers((prev) => {
      const next = prev.filter((user) => user.id !== deletedId);
      const nextSelected = next[0]?.id ?? "";
      if (spacedRepetitionActiveUserId === deletedId) {
        setSpacedRepetitionActiveUserId(null);
      }
      setSpacedRepetitionSelectedUserId(nextSelected);
      return next;
    });
    setSpacedRepetitionUserError("");
  }, [spacedRepetitionActiveUserId, spacedRepetitionSelectedUserId]);

  const handleSpacedRepetitionActiveUserLoadCards = useCallback(async (
    options?: { boxFilter?: number | null },
  ) => {
    if (!spacedRepetitionActiveUserId || isFlashcardScanning) {
      return;
    }
    const activeUserId = spacedRepetitionActiveUserId;
    const boxFilter =
      typeof options?.boxFilter === "number" ? options.boxFilter : null;
    setIsFlashcardScanning(true);
    try {
      const cards = await scanFlashcards({
        scopeOverride: "vault",
        orderOverride: "in-order",
      });
      const storedCardStates =
        spacedRepetitionUserStateById[activeUserId]?.cardStates ?? {};
      const storedCompletedPerDay =
        spacedRepetitionUserStateById[activeUserId]?.completedPerDay ?? {};
      const loadOrder =
        boxFilter && spacedRepetitionOrder === "repetition"
          ? "in-order"
          : spacedRepetitionOrder;
      const nextSession = buildSpacedRepetitionSession(cards, storedCardStates, {
        order: loadOrder,
        boxCount: spacedRepetitionBoxes,
        repetitionStrength: spacedRepetitionRepetitionStrength,
      });
      const filteredSession =
        boxFilter === null
          ? nextSession
          : (() => {
              const entries = nextSession.flashcards.map((card, index) => {
                const cardId = nextSession.cardIds[index] ?? getFlashcardId(card);
                const progress = normalizeSpacedRepetitionCardProgress(
                  nextSession.cardProgressById[cardId],
                );
                return {
                  card,
                  cardId,
                  effectiveBox: getSpacedRepetitionEffectiveBox(
                    progress,
                    spacedRepetitionBoxes,
                  ),
                };
              });
              const filteredEntries = entries.filter(
                (entry) => entry.effectiveBox === boxFilter,
              );
              return {
                ...nextSession,
                flashcards: filteredEntries.map((entry) => entry.card),
                cardIds: filteredEntries.map((entry) => entry.cardId),
                page: 0,
              };
            })();
      setSpacedRepetitionSessions((prev) => ({
        ...prev,
        [activeUserId]: {
          ...filteredSession,
          completedPerDay: storedCompletedPerDay,
        },
      }));
      setSpacedRepetitionUserStateById((prev) => {
        const current = prev[activeUserId] ?? createEmptySpacedRepetitionUserState();
        return {
          ...prev,
          [activeUserId]: {
            ...current,
            cardStates: nextSession.cardProgressById,
            lastLoadedAt: new Date().toISOString(),
          },
        };
      });
    } finally {
      setIsFlashcardScanning(false);
    }
  }, [
    isFlashcardScanning,
    scanFlashcards,
    setIsFlashcardScanning,
    spacedRepetitionActiveUserId,
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionUserStateById,
  ]);

  const handleSpacedRepetitionOptionSelect = useCallback(
    (cardIndex: number, keys: string[]) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const uniqueKeys = Array.from(new Set(keys));
        return {
          ...session,
          selections: { ...session.selections, [cardIndex]: uniqueKeys },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: TrueFalseSelection) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const current = { ...(session.trueFalseSelections[cardIndex] ?? {}) };
        current[itemId] = value;
        return {
          ...session,
          trueFalseSelections: {
            ...session.trueFalseSelections,
            [cardIndex]: current,
          },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const updateCompositePartState = useCallback(
    (
      cardIndex: number,
      partIndex: number,
      updater: (current: CompositePartState) => CompositePartState,
    ) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const nextParts = [...(session.compositeStates[cardIndex] ?? [])];
        const current = nextParts[partIndex] ?? {};
        const nextState = updater(current);
        nextParts[partIndex] = nextState;
        return {
          ...session,
          compositeStates: {
            ...session.compositeStates,
            [cardIndex]: nextParts,
          },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionCompositeOptionSelect = useCallback(
    (cardIndex: number, partIndex: number, keys: string[]) => {
      const uniqueKeys = Array.from(new Set(keys));
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        selections: uniqueKeys,
      }));
    },
    [updateCompositePartState],
  );

  const handleSpacedRepetitionCompositeTrueFalseSelect = useCallback(
    (cardIndex: number, partIndex: number, itemId: string, value: TrueFalseSelection) => {
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        trueFalseSelections: {
          ...(current.trueFalseSelections ?? {}),
          [itemId]: value,
        },
      }));
    },
    [updateCompositePartState],
  );

  const handleSpacedRepetitionSubmit = useCallback(
    (cardIndex: number, canSubmit: boolean, selfGrade?: FlashcardSelfGrade) => {
      if (!canSubmit) {
        return;
      }
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const card = session.flashcards[cardIndex];
        if (!card) {
          return session;
        }
        const cardIds =
          session.cardIds.length === session.flashcards.length
            ? session.cardIds
            : session.flashcards.map(getFlashcardId);
        const cardId = cardIds[cardIndex] ?? getFlashcardId(card);
        const nextSelfGrades = selfGrade
          ? { ...session.selfGrades, [cardIndex]: selfGrade }
          : session.selfGrades;
        const result =
          selfGrade ??
          evaluateFlashcardResult(
            card,
            cardIndex,
            session.selections,
            session.trueFalseSelections,
            session.clozeResponses,
            nextSelfGrades,
            session.compositeStates,
          );
        const currentProgress = normalizeSpacedRepetitionCardProgress(
          session.cardProgressById[cardId],
        );
        const effectiveBox = getSpacedRepetitionEffectiveBox(
          currentProgress,
          spacedRepetitionBoxes,
        );
        const baseBox =
          currentProgress.boxCanonical > spacedRepetitionBoxes
            ? effectiveBox
            : currentProgress.boxCanonical;
        let nextBox = baseBox;
        if (result === "correct") {
          nextBox = Math.min(baseBox + 1, MAX_SPACED_REPETITION_BOX);
        } else if (result === "incorrect") {
          nextBox = Math.max(baseBox - 1, 1);
        }
        const nextProgress = {
          boxCanonical: nextBox,
          attempts: currentProgress.attempts + 1,
          lastResult: result,
          lastReviewedAt: new Date().toISOString(),
        };
        const todayKey = buildBerlinDateKey(new Date());
        const nextCompletedPerDay = todayKey
          ? {
              ...session.completedPerDay,
              [todayKey]: (session.completedPerDay[todayKey] ?? 0) + 1,
            }
          : session.completedPerDay;

        return {
          ...session,
          cardIds,
          submissions: { ...session.submissions, [cardIndex]: true },
          selfGrades: nextSelfGrades,
          cardProgressById: {
            ...session.cardProgressById,
            [cardId]: nextProgress,
          },
          completedPerDay: nextCompletedPerDay,
        };
      });
    },
    [spacedRepetitionBoxes, updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionCompositeTextInputChange = useCallback(
    (cardIndex: number, partIndex: number, value: string) => {
      updateCompositePartState(cardIndex, partIndex, (current) => {
        if (current.textRevealed) {
          return current;
        }
        return { ...current, textResponse: value };
      });
    },
    [updateCompositePartState],
  );

  const handleSpacedRepetitionCompositeTextCheck = useCallback(
    (cardIndex: number, partIndex: number) => {
      updateCompositePartState(cardIndex, partIndex, (current) => {
        if (current.textRevealed) {
          return current;
        }
        return { ...current, textRevealed: true };
      });
    },
    [updateCompositePartState],
  );

  const handleSpacedRepetitionCompositeSelfGrade = useCallback(
    (cardIndex: number, partIndex: number, grade: FlashcardSelfGrade) => {
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        selfGrade: grade,
      }));
    },
    [updateCompositePartState],
  );

  const handleSpacedRepetitionTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex] || session.textRevealed[cardIndex]) {
          return session;
        }
        return {
          ...session,
          textResponses: { ...session.textResponses, [cardIndex]: value },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionTextCheck = useCallback(
    (cardIndex: number) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex] || session.textRevealed[cardIndex]) {
          return session;
        }
        return {
          ...session,
          textRevealed: { ...session.textRevealed, [cardIndex]: true },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionSelfGrade = useCallback(
    (cardIndex: number, grade: FlashcardSelfGrade) => {
      handleSpacedRepetitionSubmit(cardIndex, true, grade);
    },
    [handleSpacedRepetitionSubmit],
  );

  const handleSpacedRepetitionPageBack = useCallback(() => {
    updateActiveSpacedRepetitionSession((session) => ({
      ...session,
      page: Math.max(0, session.page - 1),
    }));
  }, [updateActiveSpacedRepetitionSession]);

  const handleSpacedRepetitionPageNext = useCallback(() => {
    if (spacedRepetitionPageCount <= 0) {
      return;
    }
    updateActiveSpacedRepetitionSession((session) => ({
      ...session,
      page: Math.min(spacedRepetitionPageCount - 1, session.page + 1),
    }));
  }, [spacedRepetitionPageCount, updateActiveSpacedRepetitionSession]);

  const handleSpacedRepetitionClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const current = { ...(session.clozeResponses[cardIndex] ?? {}) };
        current[blankId] = value;
        return {
          ...session,
          clozeResponses: { ...session.clozeResponses, [cardIndex]: current },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionCompositeClozeInputChange = useCallback(
    (cardIndex: number, partIndex: number, blankId: string, value: string) => {
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        clozeResponses: {
          ...(current.clozeResponses ?? {}),
          [blankId]: value,
        },
      }));
    },
    [updateCompositePartState],
  );

  const handleSpacedRepetitionClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      event.preventDefault();
      if (spacedRepetitionSubmissions[cardIndex]) {
        return;
      }
      const payload = getClozeDragPayload(event);
      if (!payload || payload.cardIndex !== cardIndex) {
        return;
      }
      if (payload.tokenId === blankId) {
        return;
      }
      if (!validTokenIds.has(payload.tokenId)) {
        return;
      }

      updateActiveSpacedRepetitionSession((session) => {
        const current = { ...(session.clozeResponses[cardIndex] ?? {}) };
        const existingBlankId = Object.entries(current).find(
          ([key, value]) => value === payload.tokenId && key !== blankId,
        )?.[0];
        if (existingBlankId) {
          delete current[existingBlankId];
        }
        if (dragBlankIds.has(blankId)) {
          current[blankId] = payload.tokenId;
        }
        return {
          ...session,
          clozeResponses: { ...session.clozeResponses, [cardIndex]: current },
        };
      });
    },
    [spacedRepetitionSubmissions, updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionCompositeClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      partIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      event.preventDefault();
      if (spacedRepetitionSubmissions[cardIndex]) {
        return;
      }
      const payload = getClozeDragPayload(event);
      if (!payload || payload.cardIndex !== cardIndex || payload.partIndex !== partIndex) {
        return;
      }
      if (payload.tokenId === blankId) {
        return;
      }
      if (!validTokenIds.has(payload.tokenId)) {
        return;
      }

      updateCompositePartState(cardIndex, partIndex, (current) => {
        const responses = { ...(current.clozeResponses ?? {}) };
        const existingBlankId = Object.entries(responses).find(
          ([key, value]) => value === payload.tokenId && key !== blankId,
        )?.[0];
        if (existingBlankId) {
          delete responses[existingBlankId];
        }
        if (dragBlankIds.has(blankId)) {
          responses[blankId] = payload.tokenId;
        }
        return { ...current, clozeResponses: responses };
      });
    },
    [spacedRepetitionSubmissions, updateCompositePartState],
  );

  const handleSpacedRepetitionClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      if (spacedRepetitionSubmissions[cardIndex]) {
        return;
      }
      updateActiveSpacedRepetitionSession((session) => {
        const current = { ...(session.clozeResponses[cardIndex] ?? {}) };
        delete current[blankId];
        return {
          ...session,
          clozeResponses: { ...session.clozeResponses, [cardIndex]: current },
        };
      });
    },
    [spacedRepetitionSubmissions, updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionCompositeClozeTokenRemove = useCallback(
    (cardIndex: number, partIndex: number, blankId: string) => {
      if (spacedRepetitionSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => {
        const responses = { ...(current.clozeResponses ?? {}) };
        delete responses[blankId];
        return { ...current, clozeResponses: responses };
      });
    },
    [spacedRepetitionSubmissions, updateCompositePartState],
  );

  return {
    handleSpacedRepetitionActiveUserLoadCards,
    handleSpacedRepetitionClozeInputChange,
    handleSpacedRepetitionClozeTokenDrop,
    handleSpacedRepetitionClozeTokenRemove,
    handleSpacedRepetitionCompositeClozeInputChange,
    handleSpacedRepetitionCompositeClozeTokenDrop,
    handleSpacedRepetitionCompositeClozeTokenRemove,
    handleSpacedRepetitionCreateUser,
    handleSpacedRepetitionDeleteUser,
    handleSpacedRepetitionLoadUser,
    handleSpacedRepetitionOptionSelect,
    handleSpacedRepetitionCompositeOptionSelect,
    handleSpacedRepetitionPageBack,
    handleSpacedRepetitionPageNext,
    handleSpacedRepetitionSelfGrade,
    handleSpacedRepetitionCompositeSelfGrade,
    handleSpacedRepetitionSubmit,
    handleSpacedRepetitionTextCheck,
    handleSpacedRepetitionTextInputChange,
    handleSpacedRepetitionCompositeTextCheck,
    handleSpacedRepetitionCompositeTextInputChange,
    handleSpacedRepetitionTrueFalseSelect,
    handleSpacedRepetitionCompositeTrueFalseSelect,
    setSpacedRepetitionActiveUserId,
    setSpacedRepetitionBoxes,
    setSpacedRepetitionNewUserName,
    setSpacedRepetitionOrder,
    setSpacedRepetitionPageSize,
    setSpacedRepetitionRepetitionStrength,
    setSpacedRepetitionSelectedUserId,
    setSpacedRepetitionStatsView,
    setSpacedRepetitionUserError,
    spacedRepetitionActiveUser,
    spacedRepetitionBoxes,
    spacedRepetitionBoxCounts,
    spacedRepetitionCanGoBack,
    spacedRepetitionCanGoNext,
    spacedRepetitionClozeResponses,
    spacedRepetitionCompositeStates,
    spacedRepetitionCompletedChartData: spacedRepetitionCompletedSeries.data,
    spacedRepetitionCompletedChartLabels: spacedRepetitionCompletedSeries.labels,
    spacedRepetitionCorrectCount,
    spacedRepetitionCorrectPercent,
    spacedRepetitionDataLoaded,
    spacedRepetitionEmptyState,
    spacedRepetitionFlashcards,
    spacedRepetitionIncorrectCount,
    spacedRepetitionNewUserName,
    spacedRepetitionOrder,
    spacedRepetitionPage,
    spacedRepetitionPageCount,
    spacedRepetitionPageSize,
    spacedRepetitionPageStart,
    spacedRepetitionCardStates,
    spacedRepetitionProgressStats,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionSelectedUserId,
    spacedRepetitionSelections,
    spacedRepetitionSessions,
    spacedRepetitionStatusLabel,
    spacedRepetitionStatsView,
    spacedRepetitionSubmissions,
    spacedRepetitionTextRevealed,
    spacedRepetitionTextResponses,
    spacedRepetitionSelfGrades,
    spacedRepetitionTotalQuestions,
    spacedRepetitionTrueFalseSelections,
    spacedRepetitionUserError,
    spacedRepetitionUserStateById,
    spacedRepetitionUsers,
    spacedRepetitionVisibleFlashcards,
    updateActiveSpacedRepetitionSession,
  };
};

---

## 📝 useVault.ts — ./features/vault/useVault.ts

import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { asErrorMessage } from "../../lib/errors";
import { type LoadState } from "../../lib/types";
import { type VaultFile } from "../../lib/tree";

type LoadOptions = {
  persist: boolean;
  clearOnFailure?: boolean;
  errorMessage?: string;
};

type PickOptions = {
  errorMessage?: string;
  onBeforeLoad?: () => void;
  onLoadFailed?: () => void;
};

export type VaultSnapshot = {
  vaultPath: string | null;
  files: VaultFile[];
  listState: LoadState;
  listError: string;
};

type UseVaultOptions = {
  persistSettings: (updates: { vaultPath?: string | null }) => Promise<boolean>;
};

export const useVault = ({ persistSettings }: UseVaultOptions) => {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [listError, setListError] = useState("");

  const takeSnapshot = useCallback(
    (): VaultSnapshot => ({
      vaultPath,
      files,
      listState,
      listError,
    }),
    [files, listError, listState, vaultPath],
  );

  const restoreSnapshot = useCallback((snapshot: VaultSnapshot) => {
    setVaultPath(snapshot.vaultPath);
    setFiles(snapshot.files);
    setListState(snapshot.listState);
    setListError(snapshot.listError);
  }, []);

  const loadVault = useCallback(
    async (path: string, options: LoadOptions): Promise<VaultFile[] | null> => {
      setListError("");
      setVaultPath(path);
      setFiles([]);
      setListState("loading");
      try {
        const results = await invoke<VaultFile[]>("list_markdown_files", {
          vaultPath: path,
        });
        setFiles(results);
        setListState("idle");
        if (options.persist) {
          await persistSettings({ vaultPath: path });
        }
        return results;
      } catch (error) {
        const message = asErrorMessage(error, "Failed to list markdown files.");
        setListError(options.errorMessage ?? message);
        setListState("error");
        if (options.clearOnFailure) {
          setVaultPath(null);
          await persistSettings({ vaultPath: null });
        }
        return null;
      }
    },
    [persistSettings],
  );

  const pickVault = useCallback(
    async (options?: PickOptions): Promise<VaultFile[] | null> => {
      setListError("");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Vault auswaehlen",
      });

      if (!selected || Array.isArray(selected)) {
        return null;
      }

      const snapshot = takeSnapshot();
      options?.onBeforeLoad?.();

      const errorMessage =
        options?.errorMessage ?? "Ausgewaehlter Vault ist nicht verfuegbar.";
      const results = await loadVault(selected, {
        persist: true,
        clearOnFailure: false,
        errorMessage,
      });

      if (!results) {
        restoreSnapshot(snapshot);
        setListError(errorMessage);
        options?.onLoadFailed?.();
      }

      return results;
    },
    [loadVault, restoreSnapshot, takeSnapshot],
  );

  const rescanVault = useCallback(async () => {
    if (!vaultPath || listState === "loading") {
      return;
    }
    setListError("");
    setListState("loading");
    try {
      const results = await invoke<VaultFile[]>("list_markdown_files", {
        vaultPath,
      });
      setFiles(results);
      setListState("idle");
    } catch (error) {
      const message = asErrorMessage(error, "Vault konnte nicht neu gescannt werden.");
      setListError(message);
      setListState("error");
    }
  }, [listState, vaultPath]);

  return {
    files,
    listError,
    listState,
    loadVault,
    pickVault,
    rescanVault,
    restoreSnapshot,
    setFiles,
    setListError,
    setListState,
    setVaultPath,
    takeSnapshot,
    vaultPath,
  };
};

---

## 📝 chart.ts — ./lib/chart.ts

export const buildLineChartPoints = (values: number[]) => {
  if (values.length === 0) {
    return "";
  }
  const maxValue = Math.max(1, ...values);
  const step = values.length === 1 ? 0 : 100 / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = 40 - (value / maxValue) * 30;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};

---

## 📝 color.ts — ./lib/color.ts

export const DEFAULT_ACCENT = "#E07A5F";

export const normalizeHex = (value: string) => {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) {
    return "";
  }
  if (!trimmed.startsWith("#")) {
    return `#${trimmed}`;
  }
  return `#${trimmed.slice(1)}`;
};

export const isValidHex = (value: string) => /^#[0-9A-F]{6}$/.test(value);

export const hexToRgb = (value: string) => {
  if (!isValidHex(value)) {
    return null;
  }
  const hex = value.slice(1);
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
};

export const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (channel: number) =>
    channel.toString(16).toUpperCase().padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const mixChannel = (from: number, to: number, amount: number) =>
  Math.round(from + (to - from) * amount);

export const mixRgb = (
  rgb: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
  amount: number,
) => ({
  r: mixChannel(rgb.r, target.r, amount),
  g: mixChannel(rgb.g, target.g, amount),
  b: mixChannel(rgb.b, target.b, amount),
});

export const contrastFor = (rgb: { r: number; g: number; b: number }) => {
  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luminance > 170 ? "#1A1A1A" : "#FFFFFF";
};

export const buildAccentTokens = (value: string, fallback = DEFAULT_ACCENT) => {
  const normalized = normalizeHex(value);
  const rgb = hexToRgb(normalized) ?? hexToRgb(fallback)!;
  const strong = mixRgb(rgb, { r: 0, g: 0, b: 0 }, 0.18);
  const highlight = mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.28);
  return {
    accentRgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    accent: rgbToHex(rgb.r, rgb.g, rgb.b),
    accentStrong: rgbToHex(strong.r, strong.g, strong.b),
    accentSoft: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
    accentHighlight: rgbToHex(highlight.r, highlight.g, highlight.b),
    accentBorder: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`,
    accentContrast: contrastFor(rgb),
    accentContrastStrong: contrastFor(strong),
  };
};

---

## 📝 errors.ts — ./lib/errors.ts

export const asErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
};

---

## 📝 flashcardKeywords.ts — ./lib/flashcardKeywords.ts

export const answerMarkers = [
  "Answer:",
  "Antwort:",
  "Réponse:",
  "Respuesta:",
  "Resposta:",
  "Risposta:",
  "Antwoord:",
  "Svar:",
  "Vastaus:",
  "Odpowiedź:",
  "Odpověď:",
  "Odpoveď:",
  "Válasz:",
  "Răspuns:",
  "Cevap:",
  "Ответ:",
  "Απάντηση:",
  "إجابة:",
];

export const trueTokens = [
  "true",
  "yes",
  "ja",
  "wahr",
  "vrai",
  "verdadero",
  "verdadeiro",
  "vero",
  "waar",
  "sant",
  "sann",
  "sandt",
  "tosi",
  "prawda",
  "pravda",
  "igaz",
  "adevărat",
  "doğru",
  "правда",
  "αληθές",
  "صحيح",
];

export const falseTokens = [
  "false",
  "no",
  "nein",
  "falsch",
  "faux",
  "falso",
  "onwaar",
  "falskt",
  "usann",
  "falsk",
  "epätosi",
  "fałsz",
  "nepravda",
  "hamis",
  "fals",
  "yanlış",
  "ложь",
  "ψευδές",
  "خطأ",
];

---

## 📝 flashcards.test.ts — ./lib/flashcards.test.ts

import { describe, expect, it } from "vitest";
import {
  isDragAnswerMatch,
  isInputAnswerMatch,
  parseFlashcards,
  type Flashcard,
} from "./flashcards";

const getCompositeParts = (card: Flashcard | undefined) => {
  expect(card?.kind).toBe("composite");
  if (!card || card.kind !== "composite") {
    throw new Error("Expected composite card");
  }
  return card.parts;
};

const getSinglePart = (card: Flashcard | undefined) => {
  const parts = getCompositeParts(card);
  expect(parts).toHaveLength(1);
  return parts[0];
};

describe("parseFlashcards", () => {
  it("parses a single card", () => {
    const markdown = `#card
1.5 Which SQL category controls access rights?
a) DML
b) DDL
c) TCL
d) DCL

-d
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.question).toBe("1.5 Which SQL category controls access rights?");
      expect(part.options).toEqual([
        { key: "a", text: "DML" },
        { key: "b", text: "DDL" },
        { key: "c", text: "TCL" },
        { key: "d", text: "DCL" },
      ]);
      expect(part.correctKeys).toEqual(["d"]);
    }
  });

  it("parses multiple cards in one document", () => {
    const markdown = `Intro text.

#card
First question?
a) One
b) Two
-b
#

Some notes between.

#card
Second question?
a) Alpha
b) Beta
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(2);
    const firstPart = getSinglePart(cards[0]);
    const secondPart = getSinglePart(cards[1]);
    expect(firstPart.kind).toBe("multiple-choice");
    expect(secondPart.kind).toBe("multiple-choice");
    if (firstPart.kind === "multiple-choice") {
      expect(firstPart.question).toBe("First question?");
    }
    if (secondPart.kind === "multiple-choice") {
      expect(secondPart.question).toBe("Second question?");
    }
  });

  it("parses multiple parts inside a single block", () => {
    const markdown = `#card
Statement 1. Wahr/Falsch?
-wahr

What is SQL?
Answer: A query language.

Pick one.
a) First
b) Second
-a
Pick two.
a) Alpha
b) Beta
c) Gamma
-a
-c

Cloze sample.
Use %%token%% with \`drag\`.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const parts = getCompositeParts(cards[0]);
    expect(parts.map((part) => part.kind)).toEqual([
      "true-false",
      "free-text",
      "multiple-choice",
      "multiple-choice",
      "cloze",
    ]);
    const [trueFalsePart, freeTextPart, singleMc, multiMc, clozePart] = parts;
    if (trueFalsePart.kind === "true-false") {
      expect(trueFalsePart.items).toHaveLength(1);
    }
    if (freeTextPart.kind === "free-text") {
      expect(freeTextPart.front).toBe("What is SQL?");
      expect(freeTextPart.back).toBe("A query language.");
    }
    if (singleMc.kind === "multiple-choice") {
      expect(singleMc.options).toEqual([
        { key: "a", text: "First" },
        { key: "b", text: "Second" },
      ]);
      expect(singleMc.correctKeys).toEqual(["a"]);
    }
    if (multiMc.kind === "multiple-choice") {
      expect(multiMc.options).toEqual([
        { key: "a", text: "Alpha" },
        { key: "b", text: "Beta" },
        { key: "c", text: "Gamma" },
      ]);
      expect(multiMc.correctKeys).toEqual(["a", "c"]);
    }
    if (clozePart.kind === "cloze") {
      expect(clozePart.dragTokens).toEqual([{ id: "token-0", value: "drag" }]);
    }
  });

  it("splits parts on separators inside a block", () => {
    const markdown = `#card
First question?
Answer: One
---
Second question?
Answer: Two
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const parts = getCompositeParts(cards[0]);
    expect(parts).toHaveLength(2);
    const [first, second] = parts;
    expect(first.kind).toBe("free-text");
    expect(second.kind).toBe("free-text");
    if (first.kind === "free-text") {
      expect(first.front).toBe("First question?");
      expect(first.back).toBe("One");
    }
    if (second.kind === "free-text") {
      expect(second.front).toBe("Second question?");
      expect(second.back).toBe("Two");
    }
  });

  it("parses a front/back card with Answer marker", () => {
    const markdown = `#card
What is SQL used for as a common interface?
Answer: SQL is used to define, manipulate, manage permissions, and handle transactions.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("What is SQL used for as a common interface?");
      expect(part.back).toBe(
        "SQL is used to define, manipulate, manage permissions, and handle transactions.",
      );
    }
  });

  it("parses a front/back card with Antwort marker", () => {
    const markdown = `#card
1. Was ist eine Transaktion?
Antwort:
Eine Transaktion ist eine atomare Einheit von Operationen.
#
`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("1. Was ist eine Transaktion?");
      expect(part.back).toBe(
        "Eine Transaktion ist eine atomare Einheit von Operationen.",
      );
    }
  });

  it("parses a front/back card with Reponse marker", () => {
    const markdown = `#card
Que signifie SQL ?
Reponse: SQL est un langage pour interroger des bases de donnees.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("Que signifie SQL ?");
      expect(part.back).toBe(
        "SQL est un langage pour interroger des bases de donnees.",
      );
    }
  });

  it("parses a single true/false item", () => {
    const markdown = `#card
1. The earth orbits the sun. Wahr/Falsch?
-wahr
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("true-false");
    if (part.kind === "true-false") {
      expect(part.items).toEqual([
        {
          id: "tf-0",
          question: "1. The earth orbits the sun. Wahr/Falsch?",
          correct: "wahr",
        },
      ]);
    }
  });

  it("parses true/false items without suffix in other languages", () => {
    const markdown = `#card
La tierra orbita el sol.
-verdadero
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("true-false");
    if (part.kind === "true-false") {
      expect(part.items).toEqual([
        {
          id: "tf-0",
          question: "La tierra orbita el sol.",
          correct: "wahr",
        },
      ]);
    }
  });

  it("parses multiple true/false items in one block", () => {
    const markdown = `#card
2. Water boils at 100C. Wahr/Falsch?
-wahr
3. The moon is a planet. Wahr/Falsch?
-falsch
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const parts = getCompositeParts(cards[0]);
    expect(parts).toHaveLength(2);
    const [first, second] = parts;
    expect(first.kind).toBe("true-false");
    expect(second.kind).toBe("true-false");
    if (first.kind === "true-false") {
      expect(first.items).toEqual([
        {
          id: "tf-0",
          question: "2. Water boils at 100C. Wahr/Falsch?",
          correct: "wahr",
        },
      ]);
    }
    if (second.kind === "true-false") {
      expect(second.items).toEqual([
        {
          id: "tf-0",
          question: "3. The moon is a planet. Wahr/Falsch?",
          correct: "falsch",
        },
      ]);
    }
  });

  it("skips true/false questions without valid markers", () => {
    const markdown = `#card
Missing marker. Wahr/Falsch?
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(0);
  });

  it("parses true/false markers case-insensitively", () => {
    const markdown = `#card
Case check. Wahr/Falsch?
-FALSCH
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("true-false");
    if (part.kind === "true-false") {
      expect(part.items[0]?.correct).toBe("falsch");
    }
  });

  it("parses true/false markers with spacing and punctuation", () => {
    const markdown = `#card
Spacing check.
- falsch,
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("true-false");
    if (part.kind === "true-false") {
      expect(part.items[0]?.correct).toBe("falsch");
    }
  });

  it("collects multiple correct markers", () => {
    const markdown = `#card
Choose two.
a) One
b) Two
c) Three

-a
-d
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.correctKeys).toEqual(["a", "d"]);
    }
  });

  it("ignores irrelevant text outside cards", () => {
    const markdown = `Random text.
- Not a marker.
#card
Question?
a) Option
#
More text.`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.question).toBe("Question?");
    }
  });

  it("parses multiple cloze cards with separators", () => {
    const markdown = `Intro section.
---
#card
First.
Fill %%one%% and \`alpha\`.
#
---
#card
Second.
Only \`beta\`.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(2);
    const firstPart = getSinglePart(cards[0]);
    const secondPart = getSinglePart(cards[1]);
    expect(firstPart.kind).toBe("cloze");
    expect(secondPart.kind).toBe("cloze");
    if (firstPart.kind === "cloze") {
      expect(firstPart.dragTokens).toEqual([{ id: "token-0", value: "alpha" }]);
      expect(firstPart.segments).toEqual([
        { type: "text", value: "Fill " },
        { type: "blank", id: "blank-0", kind: "input", solution: "one" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-1", kind: "drag", solution: "alpha" },
        { type: "text", value: "." },
      ]);
    }
    if (secondPart.kind === "cloze") {
      expect(secondPart.dragTokens).toEqual([{ id: "token-0", value: "beta" }]);
      expect(secondPart.segments).toEqual([
        { type: "text", value: "Only " },
        { type: "blank", id: "blank-0", kind: "drag", solution: "beta" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("skips cards with missing end markers", () => {
    const markdown = `#card
Question without end?
a) Option`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(0);
  });

  it("parses cloze cards with %% blanks", () => {
    const markdown = `#card
Define foreign key.
A foreign key is an %% attribute or attribute set %% that references a %%primary key%% in another %% table %%.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.question).toBe("Define foreign key.");
      expect(part.dragTokens).toEqual([]);
      expect(part.segments).toEqual([
        { type: "text", value: "A foreign key is an " },
        {
          type: "blank",
          id: "blank-0",
          kind: "input",
          solution: "attribute or attribute set",
        },
        { type: "text", value: " that references a " },
        { type: "blank", id: "blank-1", kind: "input", solution: "primary key" },
        { type: "text", value: " in another " },
        { type: "blank", id: "blank-2", kind: "input", solution: "table" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("supports multiple blanks with and without spacing", () => {
    const markdown = `#card
Short cloze.
%%alpha%% and %% beta %% then %%gamma%%.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.segments).toEqual([
        { type: "blank", id: "blank-0", kind: "input", solution: "alpha" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-1", kind: "input", solution: "beta" },
        { type: "text", value: " then " },
        { type: "blank", id: "blank-2", kind: "input", solution: "gamma" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("collects backtick tokens alongside blanks", () => {
    const markdown = `#card
Mixed markers.
Use %%blank%% with \`alpha\` and \`beta\`.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([
        { id: "token-0", value: "alpha" },
        { id: "token-1", value: "beta" },
      ]);
      expect(part.segments).toEqual([
        { type: "text", value: "Use " },
        { type: "blank", id: "blank-0", kind: "input", solution: "blank" },
        { type: "text", value: " with " },
        { type: "blank", id: "blank-1", kind: "drag", solution: "alpha" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-2", kind: "drag", solution: "beta" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("keeps cards with only backtick tokens", () => {
    const markdown = `#card
Only tokens.
Use \`alpha\` and \`beta\` here.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([
        { id: "token-0", value: "alpha" },
        { id: "token-1", value: "beta" },
      ]);
      expect(part.segments).toEqual([
        { type: "text", value: "Use " },
        { type: "blank", id: "blank-0", kind: "drag", solution: "alpha" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-1", kind: "drag", solution: "beta" },
        { type: "text", value: " here." },
      ]);
    }
  });

  it("keeps duplicate tokens with unique ids", () => {
    const markdown = `#card
Duplicate tokens.
Use \`same\` and \`same\` again.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([
        { id: "token-0", value: "same" },
        { id: "token-1", value: "same" },
      ]);
    }
  });

  it("handles unclosed %% safely", () => {
    const markdown = `#card
Broken markers.
Valid %%answer%% and %%unfinished.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([]);
      expect(part.segments).toEqual([
        { type: "text", value: "Valid " },
        { type: "blank", id: "blank-0", kind: "input", solution: "answer" },
        { type: "text", value: " and %%unfinished." },
      ]);
    }
  });

  it("handles unclosed backticks safely", () => {
    const markdown = `#card
Broken token.
Valid %%answer%% and \`unfinished.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([]);
      expect(part.segments).toEqual([
        { type: "text", value: "Valid " },
        { type: "blank", id: "blank-0", kind: "input", solution: "answer" },
        { type: "text", value: " and `unfinished." },
      ]);
    }
  });

  it("ignores markers inside fenced code blocks", () => {
    const markdown = `#card
Question.
Code:
~~~
\`ignored\`
%%not%%
~~~
Outside \`token\` and %%blank%%.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([{ id: "token-0", value: "token" }]);
      const blanks = part.segments.filter((segment) => segment.type === "blank");
      expect(blanks).toEqual([
        { type: "blank", id: "blank-0", kind: "drag", solution: "token" },
        { type: "blank", id: "blank-1", kind: "input", solution: "blank" },
      ]);
    }
  });

  it("skips cards with empty blanks", () => {
    const markdown = `#card
Empty blank.
%%%%
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(0);
  });

  it("matches input blanks case-insensitively with trim", () => {
    expect(isInputAnswerMatch(" Atomic Values ", "atomic values")).toBe(true);
    expect(isInputAnswerMatch("Atomic", "atom")).toBe(false);
  });

  it("matches drag tokens by trimmed exact value", () => {
    expect(isDragAnswerMatch("Token", "Token")).toBe(true);
    expect(isDragAnswerMatch("Token ", "Token")).toBe(true);
    expect(isDragAnswerMatch("token", "Token")).toBe(false);
  });
});

---

## 📝 flashcards.ts — ./lib/flashcards.ts

import { answerMarkers, falseTokens, trueTokens } from "./flashcardKeywords";

/**
 * Flashcard syntax:
 * v1 (multiple choice)
 * #card
 * Question line
 * a) Option text
 * -a
 * #
 *
 * v3 (cloze blanks + tokens)
 * #card
 * Question line
 * Body text with input blanks like %%answer%% and drag tokens like `token`
 * #
 *
 * v4 (true/false)
 * #card
 * Statement Wahr/Falsch?
 * -wahr
 * #
 *
 * Invalid cards (missing end marker, empty question, no options/blanks/tokens) are skipped.
 */
export type FlashcardOption = {
  key: string;
  text: string;
};

export type MultipleChoiceCard = {
  kind: "multiple-choice";
  question: string;
  options: FlashcardOption[];
  correctKeys: string[];
};

export type FreeTextCard = {
  kind: "free-text";
  front: string;
  back: string;
};

export type TrueFalseItem = {
  id: string;
  question: string;
  correct: "wahr" | "falsch";
};

export type TrueFalseCard = {
  kind: "true-false";
  items: TrueFalseItem[];
};

export type ClozeSegment =
  | { type: "text"; value: string }
  | { type: "blank"; id: string; kind: "input" | "drag"; solution: string };

export type ClozeDragToken = {
  id: string;
  value: string;
};

export type ClozeCard = {
  kind: "cloze";
  question: string;
  segments: ClozeSegment[];
  dragTokens: ClozeDragToken[];
};

export type FlashcardPart = MultipleChoiceCard | FreeTextCard | TrueFalseCard | ClozeCard;

export type CompositeFlashcard = {
  kind: "composite";
  parts: FlashcardPart[];
};

export type FlashcardDetectedType =
  | "qa"
  | "multiple-choice"
  | "fill-blank"
  | "assignment"
  | "true-false";

export type FlashcardMetadata = {
  primaryType?: FlashcardDetectedType;
  detectedTypes?: FlashcardDetectedType[];
  isMixed?: boolean;
};

export type Flashcard = (FlashcardPart | CompositeFlashcard) & FlashcardMetadata;

export const normalizeInputAnswer = (value: string) => value.trim().toLowerCase();

export const isInputAnswerMatch = (input: string, solution: string) =>
  normalizeInputAnswer(input) === normalizeInputAnswer(solution);

export const normalizeDragAnswer = (value: string) => value.trim();

export const isDragAnswerMatch = (tokenValue: string, solution: string) =>
  normalizeDragAnswer(tokenValue) === normalizeDragAnswer(solution);

const normalizeLines = (markdown: string) =>
  markdown.replace(/\r\n?/g, "\n").split("\n");

const optionPattern = /^([A-Za-z])\)\s+(.*)$/;
const markerPattern = /^-([A-Za-z])$/;
const assignmentPattern = /^(.+?)=>\s*(.+)$/;
const separatorLine = "---";

const normalizeKeyword = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizedTrueTokens = new Set(trueTokens.map(normalizeKeyword));
const normalizedFalseTokens = new Set(falseTokens.map(normalizeKeyword));
const normalizedAnswerMarkers = answerMarkers.map((marker) => ({
  raw: marker,
  normalized: normalizeKeyword(marker),
}));

const trimEmptyLines = (lines: string[]) => {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim() === "") {
    start += 1;
  }
  while (end > start && lines[end - 1].trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
};

const isSeparatorLine = (line: string) => line.trim() === separatorLine;

const isAssignmentLine = (line: string) => {
  const match = line.match(assignmentPattern);
  if (!match) {
    return false;
  }
  const left = match[1].trim();
  const right = match[2].trim();
  return Boolean(left && right);
};

const normalizeAssignmentLine = (line: string) => {
  const match = line.match(assignmentPattern);
  if (!match) {
    return null;
  }
  const left = match[1].trimEnd();
  const right = match[2].trim();
  if (!left || !right) {
    return null;
  }
  const normalizedRight =
    right.startsWith("`") && right.endsWith("`") ? right : `\`${right}\``;
  return `${left} => ${normalizedRight}`;
};

const isOptionLine = (line: string) => optionPattern.test(line.trim());
const isCorrectMarkerLine = (line: string) => markerPattern.test(line.trim());
const isTrueFalseMarkerLine = (line: string) =>
  normalizeTrueFalseMarker(line.trim()) !== null;
const isAnswerMarkerLine = (line: string) => Boolean(findAnswerMarkerMatch(line));
const hasClozeMarker = (line: string) => line.includes("%%") || line.includes("`");

const appendText = (segments: ClozeSegment[], text: string) => {
  if (!text) {
    return;
  }
  const last = segments[segments.length - 1];
  if (last?.type === "text") {
    last.value += text;
  } else {
    segments.push({ type: "text", value: text });
  }
};

const parseClozeSegments = (lines: string[]) => {
  const segments: ClozeSegment[] = [];
  const dragTokens: ClozeDragToken[] = [];
  let blankIndex = 0;
  let tokenIndex = 0;
  let inFence = false;
  const fencePattern = /^(```|~~~)/;

  const handleLine = (line: string) => {
    let cursor = 0;

    while (cursor < line.length) {
      const nextInput = line.indexOf("%%", cursor);
      const nextDrag = line.indexOf("`", cursor);
      const nextMarker = Math.min(
        nextInput === -1 ? Number.POSITIVE_INFINITY : nextInput,
        nextDrag === -1 ? Number.POSITIVE_INFINITY : nextDrag,
      );

      if (!Number.isFinite(nextMarker)) {
        appendText(segments, line.slice(cursor));
        break;
      }

      if (nextMarker > cursor) {
        appendText(segments, line.slice(cursor, nextMarker));
      }

      if (nextMarker === nextInput) {
        const end = line.indexOf("%%", nextInput + 2);
        if (end === -1) {
          appendText(segments, line.slice(nextInput));
          break;
        }
        const rawSolution = line.slice(nextInput + 2, end);
        const solution = rawSolution.trim();
        if (!solution) {
          return null;
        }
        segments.push({
          type: "blank",
          id: `blank-${blankIndex}`,
          kind: "input",
          solution,
        });
        blankIndex += 1;
        cursor = end + 2;
        continue;
      }

      const end = line.indexOf("`", nextDrag + 1);
      if (end === -1) {
        appendText(segments, line.slice(nextDrag));
        break;
      }
      const rawToken = line.slice(nextDrag + 1, end);
      const value = rawToken.trim();
      if (!value) {
        appendText(segments, line.slice(nextDrag, end + 1));
        cursor = end + 1;
        continue;
      }
      segments.push({
        type: "blank",
        id: `blank-${blankIndex}`,
        kind: "drag",
        solution: value,
      });
      dragTokens.push({ id: `token-${tokenIndex}`, value });
      blankIndex += 1;
      tokenIndex += 1;
      cursor = end + 1;
    }

    return true;
  };

  const trimmedLines = trimEmptyLines(lines);
  for (let lineIndex = 0; lineIndex < trimmedLines.length; lineIndex += 1) {
    const line = trimmedLines[lineIndex];
    const trimmed = line.trimStart();
    if (fencePattern.test(trimmed)) {
      inFence = !inFence;
      appendText(segments, line);
    } else if (inFence) {
      appendText(segments, line);
    } else {
      const parsed = handleLine(line);
      if (!parsed) {
        return null;
      }
    }

    if (lineIndex < trimmedLines.length - 1) {
      appendText(segments, "\n");
    }
  }

  return { segments, dragTokens };
};

const normalizeTrueFalseMarker = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("-")) {
    return null;
  }
  const rawToken = trimmed.slice(1).trim();
  if (!rawToken) {
    return null;
  }
  const cleaned = rawToken.replace(/[.,;:!?]+$/g, "");
  const normalized = normalizeKeyword(cleaned);
  if (normalizedTrueTokens.has(normalized)) {
    return "wahr";
  }
  if (normalizedFalseTokens.has(normalized)) {
    return "falsch";
  }
  return null;
};

const parseTrueFalseItems = (lines: string[]) => {
  const items: TrueFalseItem[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const question = lines[index].trim();
    if (!question) {
      continue;
    }

    let markerIndex = index + 1;
    while (markerIndex < lines.length && lines[markerIndex].trim() === "") {
      markerIndex += 1;
    }
    if (markerIndex >= lines.length) {
      continue;
    }

    const marker = normalizeTrueFalseMarker(lines[markerIndex].trim());
    if (!marker) {
      continue;
    }

    items.push({
      id: `tf-${items.length}`,
      question,
      correct: marker,
    });
    index = markerIndex;
  }

  return items;
};

const findAnswerMarkerMatch = (line: string) => {
  const trimmedLine = line.trimStart();
  const normalizedLine = normalizeKeyword(trimmedLine);
  for (const marker of normalizedAnswerMarkers) {
    if (normalizedLine.startsWith(marker.normalized)) {
      const colonIndex = trimmedLine.indexOf(":");
      const markerEndIndex = colonIndex >= 0 ? colonIndex + 1 : marker.raw.length;
      return { trimmedLine, markerEndIndex };
    }
  }
  return null;
};

const findAnswerMarkerLine = (lines: string[]) => {
  for (let index = 0; index < lines.length; index += 1) {
    const match = findAnswerMarkerMatch(lines[index] ?? "");
    if (match) {
      return { index, match };
    }
  }
  return null;
};

const splitAnswerCard = (lines: string[]) => {
  const markerInfo = findAnswerMarkerLine(lines);
  if (!markerInfo) {
    return null;
  }
  const frontLines = trimEmptyLines(lines.slice(0, markerInfo.index));
  const inlineAnswer = markerInfo.match.trimmedLine
    .slice(markerInfo.match.markerEndIndex)
    .trimStart();
  const backLines = [inlineAnswer, ...lines.slice(markerInfo.index + 1)];
  const normalizedFront = trimEmptyLines(frontLines).join("\n").trim();
  const normalizedBack = trimEmptyLines(backLines).join("\n").trim();
  if (!normalizedFront || !normalizedBack) {
    return null;
  }
  return {
    front: normalizedFront,
    back: normalizedBack,
  };
};

const pushUnique = (items: string[], value: string) => {
  if (!items.includes(value)) {
    items.push(value);
  }
};

type CardSplitState = {
  hasQuestion: boolean;
  hasOption: boolean;
  hasCorrectMarker: boolean;
  hasAnswerMarker: boolean;
  hasTrueFalseMarker: boolean;
  hasClozeMarker: boolean;
  hasAssignmentLine: boolean;
};

const createSplitState = (): CardSplitState => ({
  hasQuestion: false,
  hasOption: false,
  hasCorrectMarker: false,
  hasAnswerMarker: false,
  hasTrueFalseMarker: false,
  hasClozeMarker: false,
  hasAssignmentLine: false,
});

const splitCardLines = (lines: string[]) => {
  const blocks: string[][] = [];
  let current: string[] = [];
  let state = createSplitState();

  const reset = () => {
    current = [];
    state = createSplitState();
  };

  const flush = () => {
    const trimmed = trimEmptyLines(current);
    if (trimmed.length > 0) {
      blocks.push(trimmed);
    }
    reset();
  };

  const updateState = (line: string) => {
    const trimmed = line.trim();
    if (!state.hasQuestion && trimmed) {
      state.hasQuestion = true;
    }
    if (isOptionLine(line)) {
      state.hasOption = true;
    }
    if (isCorrectMarkerLine(line)) {
      state.hasCorrectMarker = true;
    }
    if (isAnswerMarkerLine(line)) {
      state.hasAnswerMarker = true;
    }
    if (isTrueFalseMarkerLine(line)) {
      state.hasTrueFalseMarker = true;
    }
    if (hasClozeMarker(line)) {
      state.hasClozeMarker = true;
    }
    if (isAssignmentLine(line)) {
      state.hasAssignmentLine = true;
    }
  };

  const isComplete = () =>
    state.hasTrueFalseMarker ||
    (state.hasOption && state.hasCorrectMarker) ||
    state.hasAnswerMarker ||
    state.hasClozeMarker ||
    state.hasAssignmentLine;

  const findNextNonEmpty = (startIndex: number) => {
    for (let i = startIndex; i < lines.length; i += 1) {
      const trimmed = lines[i].trim();
      if (!trimmed || isSeparatorLine(lines[i])) {
        continue;
      }
      return trimmed;
    }
    return null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (isSeparatorLine(line)) {
      flush();
      continue;
    }

    if (
      current.length > 0 &&
      state.hasOption &&
      state.hasCorrectMarker &&
      trimmed &&
      !isOptionLine(line) &&
      !isCorrectMarkerLine(line)
    ) {
      flush();
    }

    current.push(line);
    updateState(line);

    if (state.hasTrueFalseMarker && state.hasQuestion && isTrueFalseMarkerLine(line)) {
      flush();
      continue;
    }

    if (!trimmed && isComplete()) {
      const nextNonEmpty = findNextNonEmpty(index + 1);
      if (nextNonEmpty) {
        flush();
      }
    }
  }

  flush();
  return blocks;
};

const parseCardLines = (
  cardLines: string[],
): { part: FlashcardPart; detectedTypes: FlashcardDetectedType[] } | null => {
  const questionIndex = cardLines.findIndex((entry) => entry.trim() !== "");
  if (questionIndex === -1) {
    return null;
  }
  const question = cardLines[questionIndex].trim();
  const bodyLines = cardLines.slice(questionIndex + 1);
  const contentLines = cardLines.slice(questionIndex);

  const options: FlashcardOption[] = [];
  const correctKeys: string[] = [];
  const clozeLines: string[] = [];
  let hasAssignmentLines = false;

  bodyLines.forEach((rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      clozeLines.push("");
      return;
    }

    const optionMatch = trimmed.match(optionPattern);
    if (optionMatch) {
      const text = optionMatch[2].trim();
      if (text) {
        options.push({
          key: optionMatch[1].toLowerCase(),
          text,
        });
      }
      return;
    }

    const markerMatch = trimmed.match(markerPattern);
    if (markerMatch) {
      pushUnique(correctKeys, markerMatch[1].toLowerCase());
      return;
    }

    const assignmentLine = normalizeAssignmentLine(rawLine);
    if (assignmentLine) {
      hasAssignmentLines = true;
      clozeLines.push(assignmentLine);
      return;
    }

    clozeLines.push(rawLine);
  });

  const detectedTypes: FlashcardDetectedType[] = [];
  if (options.length > 0) {
    pushUnique(detectedTypes, "multiple-choice");
  }

  const trueFalseItems = parseTrueFalseItems(cardLines.slice(questionIndex));
  if (trueFalseItems.length > 0) {
    pushUnique(detectedTypes, "true-false");
  }

  const answerCard = splitAnswerCard(contentLines);
  if (answerCard) {
    pushUnique(detectedTypes, "qa");
  }

  const parsed = parseClozeSegments(clozeLines);
  let hasInputBlanks = false;
  let hasDragBlanks = false;
  if (parsed) {
    parsed.segments.forEach((segment) => {
      if (segment.type !== "blank") {
        return;
      }
      if (segment.kind === "input") {
        hasInputBlanks = true;
      } else {
        hasDragBlanks = true;
      }
    });
  }
  if (hasInputBlanks) {
    pushUnique(detectedTypes, "fill-blank");
  }
  if (hasDragBlanks || hasAssignmentLines) {
    pushUnique(detectedTypes, "assignment");
  }

  if (options.length > 0) {
    return {
      part: {
        kind: "multiple-choice",
        question,
        options,
        correctKeys,
      },
      detectedTypes,
    };
  }

  if (trueFalseItems.length > 0) {
    return {
      part: {
        kind: "true-false",
        items: trueFalseItems,
      },
      detectedTypes,
    };
  }

  if (answerCard) {
    return {
      part: {
        kind: "free-text",
        ...answerCard,
      },
      detectedTypes,
    };
  }

  if (!parsed) {
    return null;
  }
  if (hasInputBlanks || hasDragBlanks || hasAssignmentLines) {
    return {
      part: {
        kind: "cloze",
        question,
        segments: parsed.segments,
        dragTokens: parsed.dragTokens,
      },
      detectedTypes,
    };
  }

  return null;
};

export const parseFlashcards = (markdown: string): Flashcard[] => {
  const lines = normalizeLines(markdown);
  const cards: Flashcard[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (line !== "#card") {
      index += 1;
      continue;
    }

    const cardLines: string[] = [];
    let foundEnd = false;

    index += 1;

    while (index < lines.length) {
      const trimmed = lines[index].trim();
      if (trimmed === "#") {
        foundEnd = true;
        index += 1;
        break;
      }
      if (trimmed === "#card") {
        break;
      }
      cardLines.push(lines[index]);
      index += 1;
    }

    if (!foundEnd) {
      continue;
    }

    const blocks = splitCardLines(cardLines);
    const parts: FlashcardPart[] = [];
    const detectedTypes: FlashcardDetectedType[] = [];

    blocks.forEach((block) => {
      const parsed = parseCardLines(block);
      if (!parsed) {
        return;
      }
      parts.push(parsed.part);
      parsed.detectedTypes.forEach((detected) => {
        pushUnique(detectedTypes, detected);
      });
    });

    if (parts.length === 0) {
      continue;
    }

    const isMixed = detectedTypes.length >= 2;
    const primaryType = detectedTypes.length === 1 ? detectedTypes[0] : undefined;

    cards.push({
      kind: "composite",
      parts,
      primaryType,
      detectedTypes,
      isMixed,
    });
  }

  return cards;
};

---

## 📝 path.ts — ./lib/path.ts

export const normalizeRelativePath = (value: string) =>
  value.replace(/\\/g, "/").replace(/^\/+/, "");

export const vaultBaseName = (value: string | null) => {
  if (!value) {
    return "Vault";
  }
  const trimmed = value.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || "Vault";
};

---

## 📝 theme.ts — ./lib/theme.ts

import { buildAccentTokens } from "./color";

export type ThemeMode = "light" | "dark";

export const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

export const applyAccentColor = (value: string) => {
  const root = document.documentElement;
  const tokens = buildAccentTokens(value);
  root.style.setProperty("--accent-rgb", tokens.accentRgb);
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--accent-strong", tokens.accentStrong);
  root.style.setProperty("--accent-soft", tokens.accentSoft);
  root.style.setProperty("--accent-highlight", tokens.accentHighlight);
  root.style.setProperty("--accent-border", tokens.accentBorder);
  root.style.setProperty("--accent-contrast", tokens.accentContrast);
  root.style.setProperty("--accent-contrast-strong", tokens.accentContrastStrong);
};

---

## 📝 tree.ts — ./lib/tree.ts

import { normalizeRelativePath } from "./path";

export type VaultFile = {
  path: string;
  relative_path: string;
};

export type TreeNode = {
  name: string;
  path: string;
  type: "dir" | "file";
  children?: TreeNode[];
  file?: VaultFile;
  fullPath?: string;
};

export const buildTree = (files: VaultFile[]): TreeNode[] => {
  const root: TreeNode = {
    name: "__root__",
    path: "",
    type: "dir",
    children: [],
  };

  for (const file of files) {
    const relative = normalizeRelativePath(file.relative_path);
    const parts = relative.split("/").filter(Boolean);
    if (parts.length === 0) {
      continue;
    }
    let current = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (isFile) {
        const existing = current.children?.find(
          (child) => child.type === "file" && child.path === currentPath,
        );
        if (!existing) {
          current.children = current.children ?? [];
          current.children.push({
            name: part,
            path: currentPath,
            type: "file",
            file,
            fullPath: file.path,
          });
        }
        return;
      }

      let next = current.children?.find(
        (child) => child.type === "dir" && child.name === part,
      );
      if (!next) {
        next = {
          name: part,
          path: currentPath,
          type: "dir",
          children: [],
        };
        current.children = current.children ?? [];
        current.children.push(next);
      }
      current = next;
    });
  }

  return sortNodes(root.children ?? []);
};

export const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return sorted.map((node) => {
    if (node.type === "dir" && node.children) {
      return { ...node, children: sortNodes(node.children) };
    }
    return node;
  });
};

---

## 📝 types.ts — ./lib/types.ts

export type LoadState = "idle" | "loading" | "error";

---

## 📝 main.tsx — ./main.tsx

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

---

## 📝 DashboardPage.tsx — ./pages/DashboardPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileList } from "../components/FileList";
import { PreviewPanel } from "../components/PreviewPanel";
import { useAppState } from "../components/AppStateProvider";
import { asErrorMessage } from "../lib/errors";

const emptyPreview = "Waehle eine Notiz fuer die Vorschau.";

export const DashboardPage = () => {
  const { actions, preview, vault } = useAppState();
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editCaretIndex, setEditCaretIndex] = useState<number | null>(null);
  const fileCountLabel = useMemo(() => {
    if (!vault.vaultPath) {
      return "No vault selected";
    }
    if (vault.files.length === 0) {
      return "Keine Markdown-Dateien";
    }
    return `${vault.files.length} Markdown-Datei${
      vault.files.length === 1 ? "" : "en"
    }`;
  }, [vault.files.length, vault.vaultPath]);
  const canEdit =
    Boolean(preview.selectedFile) && preview.previewState === "idle";

  useEffect(() => {
    setIsEditing(false);
    setEditDraft("");
    setEditError("");
    setIsSaving(false);
    setEditCaretIndex(null);
  }, [preview.selectedFile?.path]);

  const handleEditStart = useCallback(
    (options?: { caretIndex?: number | null; origin?: "raw" | "markdown" }) => {
      if (!preview.selectedFile || preview.previewState !== "idle") {
        return;
      }
      setEditDraft(preview.preview);
      setEditError("");
      setEditCaretIndex(
        typeof options?.caretIndex === "number" ? options.caretIndex : null,
      );
      setIsEditing(true);
    },
    [preview],
  );

  const handleEditAutosave = useCallback(async () => {
    if (!preview.selectedFile || !isEditing || isSaving) {
      return false;
    }
    if (editDraft === preview.preview) {
      setIsEditing(false);
      setEditCaretIndex(null);
      return true;
    }
    setIsSaving(true);
    setEditError("");
    try {
      await invoke("write_text_file", {
        path: preview.selectedFile.path,
        contents: editDraft,
      });
      preview.setPreview(editDraft);
      setIsEditing(false);
      setEditCaretIndex(null);
      return true;
    } catch (error) {
      setEditError(asErrorMessage(error, "Failed to save file."));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [editDraft, isEditing, isSaving, preview]);

  const handleToggleRawPreview = useCallback(async () => {
    if (isEditing) {
      const saved = await handleEditAutosave();
      if (!saved) {
        return;
      }
    }
    preview.setRawPreview((current) => !current);
  }, [handleEditAutosave, isEditing, preview]);
  const handleEditCaretApplied = useCallback(() => {
    setEditCaretIndex(null);
  }, []);

  return (
    <div className="dashboard-page">
      <header className="content-header">
        <div>
          <p className="eyebrow">Makedon</p>
          <h1>Vault</h1>
          <p className="muted">
            Waehle einen Vault, scanne Markdown-Dateien und sieh dir Inhalte sofort
            an.
          </p>
        </div>
      </header>

      <div className="workspace">
        <PreviewPanel
          emptyPreview={emptyPreview}
          editDraft={editDraft}
          editError={editError}
          editCaretIndex={editCaretIndex}
          isEditing={isEditing}
          preview={preview.preview}
          previewError={preview.previewError}
          previewState={preview.previewState}
          rawPreview={preview.rawPreview}
          selectedFile={preview.selectedFile}
          canEdit={canEdit}
          onEditChange={setEditDraft}
          onEditCaretApplied={handleEditCaretApplied}
          onEditExit={handleEditAutosave}
          onEditStart={handleEditStart}
          onToggleRawPreview={handleToggleRawPreview}
        />

        <FileList
          fileCountLabel={fileCountLabel}
          files={vault.files}
          listError={vault.listError}
          listState={vault.listState}
          onSelectFile={actions.handleSelectFile}
          selectedFile={preview.selectedFile}
          vaultPath={vault.vaultPath}
        />
      </div>
    </div>
  );
};

---

## 📝 FastCardHost.tsx — ./pages/fast-flashcard/components/FastCardHost.tsx

import type { DragEvent } from "react";
import { ClozeCard } from "../../../components/flashcards/ClozeCard";
import { CompositeCard } from "../../../components/flashcards/CompositeCard";
import { FreeTextCard } from "../../../components/flashcards/FreeTextCard";
import { MultipleChoiceCard } from "../../../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../../../components/flashcards/TrueFalseCard";

type FastCardHostProps = {
  hasScannedCards: boolean;
  hasFilteredCards: boolean;
  currentEntry: { card: any; cardIndex: number } | null;
  isCurrentSubmitted: boolean;
  submissionLocked: boolean;
  fastFlashcards: {
    flashcardCompositeStates: Record<number, any[]>;
    flashcardClozeResponses: Record<number, Record<string, string>>;
    flashcardTrueFalseSelections: Record<number, Record<string, any>>;
    flashcardTextResponses: Record<number, string>;
    flashcardTextRevealed: Record<number, boolean>;
    flashcardSelfGrades: Record<number, any>;
    flashcardSelections: Record<number, string[]>;
    handleClozeTokenDragStart: (event: DragEvent<HTMLElement>) => void;
    handleClozeBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  };
  orderedEntries: { cardIndex: number; card: any }[];
  canGoBack: boolean;
  canGoNext: boolean;
  setFastCardPosition: (value: (prev: number) => number) => void;
  handleOptionSelect: (cardIndex: number, keys: string[]) => void;
  handleTrueFalseSelect: (
    cardIndex: number,
    itemId: string,
    value: "wahr" | "falsch",
  ) => void;
  handleClozeInputChange: (cardIndex: number, blankId: string, value: string) => void;
  handleClozeTokenDrop: (
    event: DragEvent<HTMLElement>,
    cardIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  handleClozeTokenRemove: (cardIndex: number, blankId: string) => void;
  handleTextInputChange: (cardIndex: number, value: string) => void;
  handleTextCheck: (cardIndex: number) => void;
  handleCompositeOptionSelect: (
    cardIndex: number,
    partIndex: number,
    keys: string[],
  ) => void;
  handleCompositeTrueFalseSelect: (
    cardIndex: number,
    partIndex: number,
    itemId: string,
    value: "wahr" | "falsch",
  ) => void;
  handleCompositeClozeInputChange: (
    cardIndex: number,
    partIndex: number,
    blankId: string,
    value: string,
  ) => void;
  handleCompositeClozeTokenDrop: (
    event: DragEvent<HTMLElement>,
    cardIndex: number,
    partIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  handleCompositeClozeTokenRemove: (
    cardIndex: number,
    partIndex: number,
    blankId: string,
  ) => void;
  handleCompositeTextInputChange: (
    cardIndex: number,
    partIndex: number,
    value: string,
  ) => void;
  handleCompositeTextCheck: (cardIndex: number, partIndex: number) => void;
  handleCompositeSelfGrade: (
    cardIndex: number,
    partIndex: number,
    grade: "correct" | "incorrect",
  ) => void;
  handleFastSubmit: (cardIndex: number, canSubmit: boolean) => void;
  handleFastSelfGrade: (cardIndex: number, grade: "correct" | "incorrect") => void;
};

export const FastCardHost = ({
  hasScannedCards,
  hasFilteredCards,
  currentEntry,
  isCurrentSubmitted,
  submissionLocked,
  fastFlashcards,
  orderedEntries,
  canGoBack,
  canGoNext,
  setFastCardPosition,
  handleOptionSelect,
  handleTrueFalseSelect,
  handleClozeInputChange,
  handleClozeTokenDrop,
  handleClozeTokenRemove,
  handleTextInputChange,
  handleTextCheck,
  handleCompositeOptionSelect,
  handleCompositeTrueFalseSelect,
  handleCompositeClozeInputChange,
  handleCompositeClozeTokenDrop,
  handleCompositeClozeTokenRemove,
  handleCompositeTextInputChange,
  handleCompositeTextCheck,
  handleCompositeSelfGrade,
  handleFastSubmit,
  handleFastSelfGrade,
}: FastCardHostProps) => (
  <div className="panel-body">
    {!hasScannedCards ? (
      <div className="empty-state">
        Select a note from DASHBOARD and start the flashcard scan
      </div>
    ) : !hasFilteredCards ? (
      <div className="empty-state">No cards match the selected mode.</div>
    ) : currentEntry ? (
      <div className="flashcard-list">
        {currentEntry.card.kind === "composite" ? (
          <CompositeCard
            key={`fast-flashcard-${currentEntry.cardIndex}`}
            card={currentEntry.card}
            cardIndex={currentEntry.cardIndex}
            submitted={isCurrentSubmitted}
            submissionLocked={submissionLocked}
            partStates={
              fastFlashcards.flashcardCompositeStates[currentEntry.cardIndex] ?? []
            }
            onOptionSelect={handleCompositeOptionSelect}
            onTrueFalseSelect={handleCompositeTrueFalseSelect}
            onClozeInputChange={handleCompositeClozeInputChange}
            onClozeTokenDrop={handleCompositeClozeTokenDrop}
            onClozeTokenRemove={handleCompositeClozeTokenRemove}
            onClozeTokenDragStart={fastFlashcards.handleClozeTokenDragStart}
            onBlankDragOver={fastFlashcards.handleClozeBlankDragOver}
            onTextInputChange={handleCompositeTextInputChange}
            onTextCheck={handleCompositeTextCheck}
            onSelfGrade={handleCompositeSelfGrade}
            onSubmit={handleFastSubmit}
          />
        ) : currentEntry.card.kind === "cloze" ? (
          <ClozeCard
            key={`fast-flashcard-${currentEntry.cardIndex}`}
            card={currentEntry.card}
            cardIndex={currentEntry.cardIndex}
            submitted={isCurrentSubmitted}
            submissionLocked={submissionLocked}
            responses={
              fastFlashcards.flashcardClozeResponses[currentEntry.cardIndex] ?? {}
            }
            onInputChange={handleClozeInputChange}
            onTokenDrop={handleClozeTokenDrop}
            onTokenRemove={handleClozeTokenRemove}
            onTokenDragStart={fastFlashcards.handleClozeTokenDragStart}
            onBlankDragOver={fastFlashcards.handleClozeBlankDragOver}
            onSubmit={handleFastSubmit}
          />
        ) : currentEntry.card.kind === "true-false" ? (
          <TrueFalseCard
            key={`fast-flashcard-${currentEntry.cardIndex}`}
            card={currentEntry.card}
            cardIndex={currentEntry.cardIndex}
            submitted={isCurrentSubmitted}
            submissionLocked={submissionLocked}
            selections={
              fastFlashcards.flashcardTrueFalseSelections[currentEntry.cardIndex] ?? {}
            }
            onSelect={handleTrueFalseSelect}
            onSubmit={handleFastSubmit}
          />
        ) : currentEntry.card.kind === "free-text" ? (
          <FreeTextCard
            key={`fast-flashcard-${currentEntry.cardIndex}`}
            card={currentEntry.card}
            cardIndex={currentEntry.cardIndex}
            submitted={isCurrentSubmitted}
            submissionLocked={submissionLocked}
            response={fastFlashcards.flashcardTextResponses[currentEntry.cardIndex] ?? ""}
            revealed={
              fastFlashcards.flashcardTextRevealed[currentEntry.cardIndex] ?? false
            }
            selfGrade={fastFlashcards.flashcardSelfGrades[currentEntry.cardIndex]}
            onInputChange={handleTextInputChange}
            onCheck={handleTextCheck}
            onSelfGrade={handleFastSelfGrade}
          />
        ) : (
          <MultipleChoiceCard
            key={`fast-flashcard-${currentEntry.cardIndex}`}
            card={currentEntry.card}
            cardIndex={currentEntry.cardIndex}
            submitted={isCurrentSubmitted}
            submissionLocked={submissionLocked}
            selectedKeys={
              fastFlashcards.flashcardSelections[currentEntry.cardIndex] ?? []
            }
            onSelect={handleOptionSelect}
            onSubmit={handleFastSubmit}
          />
        )}
      </div>
    ) : (
      <div className="empty-state">No cards available.</div>
    )}
    <div className="flashcard-pagination">
      <button
        type="button"
        className="ghost small"
        onClick={() => setFastCardPosition((prev) => Math.max(0, prev - 1))}
        disabled={!canGoBack}
      >
        Back
      </button>
      <button
        type="button"
        className="ghost small"
        onClick={() =>
          setFastCardPosition((prev) =>
            Math.min(prev + 1, Math.max(orderedEntries.length - 1, 0)),
          )
        }
        disabled={!canGoNext}
      >
        Next
      </button>
    </div>
  </div>
);

---

## 📝 FastHeader.tsx — ./pages/fast-flashcard/components/FastHeader.tsx

import { fastFlashcardStatusLabel } from "../hooks/useFastSession";

type FastHeaderProps = {
  hasScannedCards: boolean;
};

export const FastHeader = ({ hasScannedCards }: FastHeaderProps) => (
  <div className="panel-header">
    <div>
      <h2>Flashcard</h2>
      {!hasScannedCards ? (
        <p className="muted">{fastFlashcardStatusLabel}</p>
      ) : null}
    </div>
  </div>
);

---

## 📝 FastHistoryPanel.tsx — ./pages/fast-flashcard/components/FastHistoryPanel.tsx

import type { FastFlashcardSessionSummary } from "../hooks/useFastSession";
import { formatSessionPace, formatSessionTimestamp } from "../hooks/useFastSession";

type FastHistoryPanelProps = {
  sessionHistory: FastFlashcardSessionSummary[];
  topSessions: FastFlashcardSessionSummary[];
  lastSessions: FastFlashcardSessionSummary[];
};

export const FastHistoryPanel = ({
  sessionHistory,
  topSessions,
  lastSessions,
}: FastHistoryPanelProps) => (
  <section className="panel fast-history-panel">
    <div className="panel-header">
      <div>
        <h2>Session History</h2>
      </div>
    </div>
    <div className="panel-body">
      {sessionHistory.length === 0 ? (
        <div className="empty-state">No sessions yet.</div>
      ) : (
        <div className="fast-history-sections">
          <div className="fast-session-section">
            <div>
              <h3 className="fast-section-title">Top 3 Sessions</h3>
            </div>
            <div className="fast-session-table">
              <div className="fast-session-row header">
                <span className="fast-session-cell timestamp">Date/Time</span>
                <span className="fast-session-cell">Score</span>
                <span className="fast-session-cell">Accuracy</span>
                <span className="fast-session-cell">Pace</span>
              </div>
              {topSessions.map((session) => (
                <div key={session.id} className="fast-session-row">
                  <span className="fast-session-cell timestamp">
                    {formatSessionTimestamp(session.endedAt)}
                  </span>
                  <span className="fast-session-cell">{session.score}</span>
                  <span className="fast-session-cell">{session.accuracy}%</span>
                  <span className="fast-session-cell">
                    {formatSessionPace(session.pace)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="fast-session-section">
            <div>
              <h3 className="fast-section-title">Last 5 Sessions</h3>
            </div>
            <div className="fast-session-table">
              <div className="fast-session-row header">
                <span className="fast-session-cell timestamp">Date/Time</span>
                <span className="fast-session-cell">Score</span>
                <span className="fast-session-cell">Accuracy</span>
                <span className="fast-session-cell">Pace</span>
              </div>
              {lastSessions.map((session) => (
                <div key={session.id} className="fast-session-row">
                  <span className="fast-session-cell timestamp">
                    {formatSessionTimestamp(session.endedAt)}
                  </span>
                  <span className="fast-session-cell">{session.score}</span>
                  <span className="fast-session-cell">{session.accuracy}%</span>
                  <span className="fast-session-cell">
                    {formatSessionPace(session.pace)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  </section>
);

---

## 📝 FastStatsPanel.tsx — ./pages/fast-flashcard/components/FastStatsPanel.tsx

import type { CSSProperties } from "react";
import type { FastFlashcardSessionStats } from "../hooks/useFastSession";

type FastStatsPanelProps = {
  isTimeModeEnabled: boolean;
  timeModeActive: boolean;
  timeStatusLabel: string;
  timeProgressStyle: CSSProperties;
  selectedDuration: number;
  statsChartClass: string;
  statsChartStyle: CSSProperties;
  statsCorrect: number;
  statsIncorrect: number;
  statsTotal: number;
  sessionStats: FastFlashcardSessionStats;
  sessionCompleted: number;
  sessionMissed: number;
  sessionAccuracy: number;
  sessionPace: string;
  sessionScore: number;
  sessionMultiplier: number;
  handleTimeToggle: () => void;
};

export const FastStatsPanel = ({
  isTimeModeEnabled,
  timeModeActive,
  timeStatusLabel,
  timeProgressStyle,
  selectedDuration,
  statsChartClass,
  statsChartStyle,
  statsCorrect,
  statsIncorrect,
  statsTotal,
  sessionStats,
  sessionCompleted,
  sessionMissed,
  sessionAccuracy,
  sessionPace,
  sessionScore,
  sessionMultiplier,
  handleTimeToggle,
}: FastStatsPanelProps) => (
  <section className="panel fast-stats-panel">
    <div className="panel-header">
      <div>
        <h2>Statistics Diagram</h2>
        <p className="muted">Progress trends over time</p>
      </div>
    </div>
    <div className="panel-body">
      <div className="fast-stats-switch">
        <span className="label">View</span>
        <button
          type="button"
          className={`timer-start-button ${isTimeModeEnabled ? "active" : ""}`}
          onClick={handleTimeToggle}
          aria-pressed={isTimeModeEnabled}
        >
          <span className="timer-start-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="7.5" />
              <path d="M12 7.5v4.4l2.8 1.8" />
            </svg>
          </span>
          <span className="timer-start-text">
            <span className="timer-start-meta">Time</span>
            <span className="timer-start-action">
              {isTimeModeEnabled ? "Stop" : "Start"}
            </span>
          </span>
        </button>
      </div>
      <div className="fast-stats-blocks">
        <div className="fast-time-block">
          <div className="fast-block-header">
            <span className="label">Time</span>
            <span
              className={`fast-time-status ${
                timeModeActive ? "active" : "inactive"
              }`}
            >
              {timeStatusLabel}
            </span>
          </div>
          <div className="fast-time-meter" style={timeProgressStyle} aria-hidden="true" />
          <div className="fast-time-scale">
            <span>0s</span>
            <span>{selectedDuration}s</span>
          </div>
        </div>
        <div className="fast-stats-block">
          <div className="fast-stats-block-header">
            <span className="label">Statistics</span>
          </div>
          <div className="fast-stats-grid">
            <div className="fast-stats-labels">
              <span className="stats-label">Correct</span>
              <span className="stats-label">Incorrect</span>
              <span className="stats-label">Total</span>
            </div>
            <div
              className={statsChartClass}
              style={statsChartStyle}
              role="img"
              aria-label={`Total ${statsTotal}`}
            >
              <div className="stats-chart-label">
                <span className="stats-chart-total">{statsTotal}</span>
                <span className="stats-chart-caption">Total</span>
              </div>
            </div>
            <div className="fast-stats-values">
              <span className="stats-value">{statsCorrect}</span>
              <span className="stats-value">{statsIncorrect}</span>
              <span className="stats-value">{statsTotal}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="fast-session-section">
        <div className="fast-section-header">
          <div>
            <h3 className="fast-section-title">Session Momentum</h3>
            <p className="muted">Your progress for the current timer run.</p>
          </div>
        </div>
        <div className="fast-session-grid">
          <div className="fast-session-card">
            <span className="label">Cards</span>
            <span className="fast-session-value">{sessionCompleted}</span>
            <span className="fast-session-sub">Completed</span>
          </div>
          <div className="fast-session-card">
            <span className="label">Accuracy</span>
            <span className="fast-session-value">{sessionAccuracy}%</span>
            <span className="fast-session-sub">
              {sessionStats.correct} correct / {sessionMissed} missed
            </span>
          </div>
          <div className="fast-session-card">
            <span className="label">Pace</span>
            <span className="fast-session-value">{sessionPace}</span>
            <span className="fast-session-sub">cards / min</span>
          </div>
          <div className="fast-session-card">
            <span className="label">Score</span>
            <span className="fast-session-value">{sessionScore}</span>
            <span className="fast-session-sub">
              +10 / -5 • x{sessionMultiplier.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
);

---

## 📝 FastToolsPanel.tsx — ./pages/fast-flashcard/components/FastToolsPanel.tsx

import { FastFlashcardToolsSettings } from "../../../components/settings/FastFlashcardToolsSettings";
import { FAST_FLASHCARD_DURATIONS } from "../../../features/fast-flashcard/constants";

type FastToolsPanelProps = {
  fastFlashcards: {
    handleFlashcardScan: () => void;
    isFlashcardScanning: boolean;
  };
  settings: {
    fastFlashcardOrder: string;
    fastFlashcardMode: string;
    fastFlashcardScope: string;
    setFastFlashcardOrder: (value: string) => void;
    setFastFlashcardMode: (value: string) => void;
    setFastFlashcardScope: (value: string) => void;
  };
  selectedDuration: number;
  setSelectedDuration: (value: number) => void;
  isTimeModeEnabled: boolean;
};

export const FastToolsPanel = ({
  fastFlashcards,
  settings,
  selectedDuration,
  setSelectedDuration,
  isTimeModeEnabled,
}: FastToolsPanelProps) => (
  <section className="panel fast-tools-panel">
    <div className="panel-header">
      <div>
        <h2>Fast Flashcard Tools</h2>
        <p className="muted">Scan current notes for cards.</p>
      </div>
    </div>
    <div className="panel-body">
      <button
        type="button"
        className="primary"
        onClick={fastFlashcards.handleFlashcardScan}
        disabled={fastFlashcards.isFlashcardScanning}
      >
        {fastFlashcards.isFlashcardScanning ? "Scanning..." : "Flashcard"}
      </button>
      <div className="flashcard-controls">
        <div className="toolbar-section">
          <span className="label">Duration</span>
          <div className="pill-grid">
            {FAST_FLASHCARD_DURATIONS.map((duration) => (
              <button
                key={duration}
                type="button"
                className={`pill pill-button ${
                  selectedDuration === duration ? "active" : ""
                }`}
                aria-pressed={selectedDuration === duration}
                disabled={isTimeModeEnabled}
                title={isTimeModeEnabled ? "Stop timer to change duration" : undefined}
                onClick={() => setSelectedDuration(duration)}
              >
                {duration}s
              </button>
            ))}
          </div>
        </div>
        <FastFlashcardToolsSettings
          fastFlashcardOrder={settings.fastFlashcardOrder}
          fastFlashcardMode={settings.fastFlashcardMode}
          fastFlashcardScope={settings.fastFlashcardScope}
          setFastFlashcardOrder={settings.setFastFlashcardOrder}
          setFastFlashcardMode={settings.setFastFlashcardMode}
          setFastFlashcardScope={settings.setFastFlashcardScope}
        />
      </div>
    </div>
  </section>
);

---

## 📝 FastFlashcardPage.tsx — ./pages/fast-flashcard/FastFlashcardPage.tsx

import { FastCardHost } from "./components/FastCardHost";
import { FastHeader } from "./components/FastHeader";
import { FastHistoryPanel } from "./components/FastHistoryPanel";
import { FastStatsPanel } from "./components/FastStatsPanel";
import { FastToolsPanel } from "./components/FastToolsPanel";
import { useFastSession } from "./hooks/useFastSession";

export const FastFlashcardPage = () => {
  const {
    fastFlashcards,
    settings,
    orderedEntries,
    currentEntry,
    hasScannedCards,
    hasFilteredCards,
    isCurrentSubmitted,
    submissionLocked,
    handleCompositeOptionSelect,
    handleCompositeTrueFalseSelect,
    handleCompositeClozeInputChange,
    handleCompositeClozeTokenDrop,
    handleCompositeClozeTokenRemove,
    handleCompositeTextInputChange,
    handleCompositeTextCheck,
    handleCompositeSelfGrade,
    handleOptionSelect,
    handleTrueFalseSelect,
    handleClozeInputChange,
    handleClozeTokenDrop,
    handleClozeTokenRemove,
    handleTextInputChange,
    handleTextCheck,
    handleFastSubmit,
    handleFastSelfGrade,
    canGoBack,
    canGoNext,
    setFastCardPosition,
    statsCorrect,
    statsIncorrect,
    statsTotal,
    statsChartClass,
    statsChartStyle,
    isTimeModeEnabled,
    timeModeActive,
    handleTimeToggle,
    timeStatusLabel,
    timeProgressStyle,
    selectedDuration,
    setSelectedDuration,
    sessionStats,
    sessionCompleted,
    sessionMissed,
    sessionAccuracy,
    sessionPace,
    sessionScore,
    sessionMultiplier,
    sessionHistory,
    topSessions,
    lastSessions,
  } = useFastSession();

  return (
    <div className="fast-flashcard-layout">
      <FastStatsPanel
        isTimeModeEnabled={isTimeModeEnabled}
        timeModeActive={timeModeActive}
        timeStatusLabel={timeStatusLabel}
        timeProgressStyle={timeProgressStyle}
        selectedDuration={selectedDuration}
        statsChartClass={statsChartClass}
        statsChartStyle={statsChartStyle}
        statsCorrect={statsCorrect}
        statsIncorrect={statsIncorrect}
        statsTotal={statsTotal}
        sessionStats={sessionStats}
        sessionCompleted={sessionCompleted}
        sessionMissed={sessionMissed}
        sessionAccuracy={sessionAccuracy}
        sessionPace={sessionPace}
        sessionScore={sessionScore}
        sessionMultiplier={sessionMultiplier}
        handleTimeToggle={handleTimeToggle}
      />
      <FastToolsPanel
        fastFlashcards={fastFlashcards}
        settings={settings}
        selectedDuration={selectedDuration}
        setSelectedDuration={setSelectedDuration}
        isTimeModeEnabled={isTimeModeEnabled}
      />
      <FastHistoryPanel
        sessionHistory={sessionHistory}
        topSessions={topSessions}
        lastSessions={lastSessions}
      />
      <section className="panel fast-flashcard-panel">
        <FastHeader hasScannedCards={hasScannedCards} />
        <FastCardHost
          hasScannedCards={hasScannedCards}
          hasFilteredCards={hasFilteredCards}
          currentEntry={currentEntry}
          isCurrentSubmitted={isCurrentSubmitted}
          submissionLocked={submissionLocked}
          fastFlashcards={fastFlashcards}
          orderedEntries={orderedEntries}
          canGoBack={canGoBack}
          canGoNext={canGoNext}
          setFastCardPosition={setFastCardPosition}
          handleOptionSelect={handleOptionSelect}
          handleTrueFalseSelect={handleTrueFalseSelect}
          handleClozeInputChange={handleClozeInputChange}
          handleClozeTokenDrop={handleClozeTokenDrop}
          handleClozeTokenRemove={handleClozeTokenRemove}
          handleTextInputChange={handleTextInputChange}
          handleTextCheck={handleTextCheck}
          handleCompositeOptionSelect={handleCompositeOptionSelect}
          handleCompositeTrueFalseSelect={handleCompositeTrueFalseSelect}
          handleCompositeClozeInputChange={handleCompositeClozeInputChange}
          handleCompositeClozeTokenDrop={handleCompositeClozeTokenDrop}
          handleCompositeClozeTokenRemove={handleCompositeClozeTokenRemove}
          handleCompositeTextInputChange={handleCompositeTextInputChange}
          handleCompositeTextCheck={handleCompositeTextCheck}
          handleCompositeSelfGrade={handleCompositeSelfGrade}
          handleFastSubmit={handleFastSubmit}
          handleFastSelfGrade={handleFastSelfGrade}
        />
      </section>
    </div>
  );
};

---

## 📝 useFastSession.ts — ./pages/fast-flashcard/hooks/useFastSession.ts

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppState } from "../../../components/AppStateProvider";
import { evaluateFlashcardResult } from "../../../features/flashcards/logic";

export const fastFlashcardStatusLabel = "Not scanned yet";

export type FastFlashcardResult = "correct" | "incorrect" | "timeout";

export type FastFlashcardSessionSummary = {
  id: string;
  endedAt: string;
  score: number;
  correct: number;
  incorrect: number;
  timeout?: number;
  total: number;
  accuracy: number;
  pace: number;
  durationMs: number;
};

type FastFlashcardStorage = {
  sessions: FastFlashcardSessionSummary[];
};

type FastFlashcardHistoryResetListener = () => void;

const fastFlashcardHistoryResetListeners =
  new Set<FastFlashcardHistoryResetListener>();

export const subscribeFastFlashcardHistoryReset = (
  listener: FastFlashcardHistoryResetListener,
) => {
  fastFlashcardHistoryResetListeners.add(listener);
  return () => {
    fastFlashcardHistoryResetListeners.delete(listener);
  };
};

export const resetFastFlashcardHistory = async () => {
  try {
    const storage: FastFlashcardStorage = { sessions: [] };
    await invoke("save_fast_flashcard_data", { storage });
    fastFlashcardHistoryResetListeners.forEach((listener) => listener());
    return true;
  } catch (error) {
    console.warn("Failed to reset fast flashcard history", error);
    return false;
  }
};

export type FastFlashcardSessionStats = {
  correct: number;
  incorrect: number;
  timeout: number;
};

const FAST_FLASHCARD_SCORE_BY_RESULT: Record<FastFlashcardResult, number> = {
  correct: 10,
  incorrect: -5,
  timeout: -5,
};

const FAST_FLASHCARD_DURATION_MULTIPLIER: Record<number, number> = {
  3: 1.5,
  6: 1.2,
  12: 1.0,
  24: 0.8,
  48: 0.5,
};

const getFastFlashcardMultiplier = (duration: number) =>
  FAST_FLASHCARD_DURATION_MULTIPLIER[duration] ?? 1;

const buildSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getSessionTimeValue = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const formatSessionTimestamp = (value: string) => {
  const timestamp = getSessionTimeValue(value);
  if (!timestamp) {
    return value;
  }
  return new Date(timestamp).toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatSessionPace = (pace: number) =>
  Number.isFinite(pace) ? pace.toFixed(1) : "0.0";

export const useFastSession = () => {
  const { fastFlashcards, settings } = useAppState();
  const {
    flashcardSubmissions,
    handleFlashcardSelfGrade,
    handleFlashcardSubmit,
  } = fastFlashcards;
  const [fastCardPosition, setFastCardPosition] = useState(0);
  const [isTimeModeEnabled, setIsTimeModeEnabled] = useState(false);
  const selectedDuration = settings.fastFlashcardDuration;
  const setSelectedDuration = settings.setFastFlashcardDuration;
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [sessionStats, setSessionStats] = useState<FastFlashcardSessionStats>({
    correct: 0,
    incorrect: 0,
    timeout: 0,
  });
  const [sessionElapsedMs, setSessionElapsedMs] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<
    FastFlashcardSessionSummary[]
  >([]);
  const [sessionHistoryLoaded, setSessionHistoryLoaded] = useState(false);
  const timerRef = useRef<number | null>(null);
  const sessionTimerRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const sessionCountedRef = useRef<Set<number>>(new Set());
  const sessionResultsRef = useRef<Map<number, FastFlashcardResult>>(new Map());
  const sessionTimeoutsRef = useRef<Set<number>>(new Set());
  const prevTimeModeRef = useRef(false);

  const orderedEntries = fastFlashcards.orderedFlashcardEntries;
  const currentEntry = orderedEntries[fastCardPosition] ?? null;
  const currentCardIndex = currentEntry?.cardIndex;
  const hasScannedCards = fastFlashcards.flashcards.length > 0;
  const hasFilteredCards = orderedEntries.length > 0;
  const statsCorrect = fastFlashcards.correctCount;
  const statsIncorrect = fastFlashcards.incorrectCount;
  const statsTotal = statsCorrect + statsIncorrect;
  const statsChartClass = statsTotal === 0 ? "stats-chart empty" : "stats-chart";
  const timeModeActive = isTimeModeEnabled;
  const isCurrentSubmitted =
    currentCardIndex !== undefined &&
    Boolean(flashcardSubmissions[currentCardIndex]);
  const submissionLocked = !timeModeActive;
  const isTimerRunning =
    timeModeActive && currentCardIndex !== undefined && !isCurrentSubmitted;

  const currentResult = useMemo(() => {
    if (!currentEntry || !isCurrentSubmitted) {
      return "neutral";
    }
    return evaluateFlashcardResult(
      currentEntry.card,
      currentEntry.cardIndex,
      fastFlashcards.flashcardSelections,
      fastFlashcards.flashcardTrueFalseSelections,
      fastFlashcards.flashcardClozeResponses,
      fastFlashcards.flashcardSelfGrades,
      fastFlashcards.flashcardCompositeStates,
    );
  }, [
    currentEntry,
    fastFlashcards.flashcardClozeResponses,
    fastFlashcards.flashcardCompositeStates,
    fastFlashcards.flashcardSelections,
    fastFlashcards.flashcardSelfGrades,
    fastFlashcards.flashcardTrueFalseSelections,
    isCurrentSubmitted,
  ]);

  const canGoBack =
    timeModeActive &&
    isCurrentSubmitted &&
    currentResult === "correct" &&
    fastCardPosition > 0;
  const canGoNext =
    timeModeActive &&
    isCurrentSubmitted &&
    fastCardPosition < orderedEntries.length - 1;

  const correctPercent =
    statsTotal > 0 ? Math.round((statsCorrect / statsTotal) * 100) : 0;

  const statsChartStyle = useMemo(
    () =>
      ({
        "--correct-percent": `${correctPercent}%`,
      }) as CSSProperties,
    [correctPercent],
  );

  const remainingSeconds = Math.max(0, timeRemaining ?? selectedDuration);
  const timeProgress = timeModeActive
    ? isTimerRunning
      ? Math.max(0, Math.min(1, remainingSeconds / selectedDuration))
      : 1
    : 0;

  const timeStatusLabel = !timeModeActive
    ? "Inactive"
    : isTimerRunning
      ? `Remaining: ${remainingSeconds}s`
      : "Ready";

  const timeProgressStyle = useMemo(
    () =>
      ({
        "--fast-time-progress": `${Math.round(timeProgress * 100)}%`,
      }) as CSSProperties,
    [timeProgress],
  );

  const registerSessionResult = useCallback(
    (cardIndex: number, result: FastFlashcardResult) => {
      const results = sessionResultsRef.current;
      if (results.has(cardIndex)) {
        return;
      }
      results.set(cardIndex, result);
      setSessionStats((prev) => {
        if (result === "correct") {
          return { ...prev, correct: prev.correct + 1 };
        }
        if (result === "incorrect") {
          return { ...prev, incorrect: prev.incorrect + 1 };
        }
        return { ...prev, timeout: prev.timeout + 1 };
      });
    },
    [],
  );

  const resolveSessionResult = useCallback(
    (cardIndex: number): FastFlashcardResult | null => {
      if (sessionTimeoutsRef.current.has(cardIndex)) {
        sessionTimeoutsRef.current.delete(cardIndex);
        return "timeout";
      }
      const card = fastFlashcards.flashcards[cardIndex];
      if (!card) {
        return null;
      }
      const result = evaluateFlashcardResult(
        card,
        cardIndex,
        fastFlashcards.flashcardSelections,
        fastFlashcards.flashcardTrueFalseSelections,
        fastFlashcards.flashcardClozeResponses,
        fastFlashcards.flashcardSelfGrades,
        fastFlashcards.flashcardCompositeStates,
      );
      if (result === "correct" || result === "incorrect") {
        return result;
      }
      return null;
    },
    [
      fastFlashcards.flashcardClozeResponses,
      fastFlashcards.flashcardCompositeStates,
      fastFlashcards.flashcardSelections,
      fastFlashcards.flashcardSelfGrades,
      fastFlashcards.flashcardTrueFalseSelections,
      fastFlashcards.flashcards,
    ],
  );

  const recordSessionResults = useCallback(
    (indices: number[]) => {
      if (indices.length === 0) {
        return;
      }
      const counted = sessionCountedRef.current;
      indices.forEach((index) => counted.add(index));
      indices.forEach((index) => {
        const result = resolveSessionResult(index);
        if (result) {
          registerSessionResult(index, result);
        }
      });
    },
    [registerSessionResult, resolveSessionResult],
  );

  useEffect(() => {
    let cancelled = false;

    const loadSessions = async () => {
      try {
        const storage = await invoke<FastFlashcardStorage>(
          "load_fast_flashcard_data",
        );
        if (cancelled) {
          return;
        }
        const sessions = Array.isArray(storage?.sessions) ? storage.sessions : [];
        setSessionHistory(sessions);
      } catch (error) {
        console.warn("Failed to load fast flashcard sessions", error);
      } finally {
        if (!cancelled) {
          setSessionHistoryLoaded(true);
        }
      }
    };

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      subscribeFastFlashcardHistoryReset(() => {
        setSessionHistory([]);
      }),
    [],
  );

  useEffect(() => {
    if (!sessionHistoryLoaded) {
      return;
    }
    const storage: FastFlashcardStorage = {
      sessions: sessionHistory,
    };
    void invoke("save_fast_flashcard_data", { storage }).catch((error) => {
      console.warn("Failed to save fast flashcard sessions", error);
    });
  }, [sessionHistory, sessionHistoryLoaded]);

  useEffect(() => {
    if (fastCardPosition < orderedEntries.length) {
      return;
    }
    setFastCardPosition(0);
  }, [fastCardPosition, orderedEntries.length]);

  useEffect(() => {
    setFastCardPosition(0);
  }, [fastFlashcards.flashcardMode, fastFlashcards.flashcardOrder]);

  useEffect(() => {
    setFastCardPosition(0);
  }, [fastFlashcards.flashcards]);

  useEffect(() => {
    const wasEnabled = prevTimeModeRef.current;
    if (!wasEnabled && isTimeModeEnabled) {
      sessionStartRef.current = Date.now();
      const baseline = new Set(
        Object.keys(flashcardSubmissions)
          .map((key) => Number(key))
          .filter((index) => flashcardSubmissions[index]),
      );
      sessionCountedRef.current = baseline;
      sessionResultsRef.current = new Map();
      sessionTimeoutsRef.current = new Set();
      setSessionStats({ correct: 0, incorrect: 0, timeout: 0 });
      setSessionElapsedMs(0);
    }
    prevTimeModeRef.current = isTimeModeEnabled;
  }, [flashcardSubmissions, isTimeModeEnabled]);

  useEffect(() => {
    if (!timeModeActive) {
      return;
    }

    const counted = sessionCountedRef.current;
    const submittedIndices = Object.keys(flashcardSubmissions)
      .map((key) => Number(key))
      .filter((index) => flashcardSubmissions[index]);
    const newIndices = submittedIndices.filter((index) => !counted.has(index));

    recordSessionResults(newIndices);
  }, [
    flashcardSubmissions,
    fastFlashcards.flashcardClozeResponses,
    fastFlashcards.flashcardCompositeStates,
    fastFlashcards.flashcardSelections,
    fastFlashcards.flashcardSelfGrades,
    fastFlashcards.flashcardTrueFalseSelections,
    fastFlashcards.flashcards,
    recordSessionResults,
    timeModeActive,
  ]);

  useEffect(() => {
    if (!timeModeActive || !sessionStartRef.current) {
      if (sessionTimerRef.current !== null) {
        window.clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      return;
    }

    const updateElapsed = () => {
      if (!sessionStartRef.current) {
        return;
      }
      setSessionElapsedMs(Date.now() - sessionStartRef.current);
    };

    updateElapsed();
    if (sessionTimerRef.current !== null) {
      window.clearInterval(sessionTimerRef.current);
    }
    sessionTimerRef.current = window.setInterval(updateElapsed, 1000);

    return () => {
      if (sessionTimerRef.current !== null) {
        window.clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    };
  }, [timeModeActive]);

  const handleTimeout = useCallback(() => {
    if (!currentEntry) {
      return;
    }
    if (!flashcardSubmissions[currentEntry.cardIndex]) {
      sessionTimeoutsRef.current.add(currentEntry.cardIndex);
      if (currentEntry.card.kind === "free-text") {
        handleFlashcardSelfGrade(currentEntry.cardIndex, "incorrect");
      } else {
        handleFlashcardSubmit(currentEntry.cardIndex, true);
      }
    }
  }, [
    currentEntry,
    flashcardSubmissions,
    handleFlashcardSelfGrade,
    handleFlashcardSubmit,
  ]);

  useEffect(() => {
    if (
      !timeModeActive ||
      currentCardIndex === undefined ||
      isCurrentSubmitted
    ) {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimeRemaining(null);
      return;
    }

    setTimeRemaining(selectedDuration);
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev === null ? selectedDuration : prev - 1;
        if (next <= 0) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          handleTimeout();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    currentCardIndex,
    handleTimeout,
    isCurrentSubmitted,
    selectedDuration,
    timeModeActive,
  ]);

  const handleOptionSelect = useCallback(
    (cardIndex: number, keys: string[]) => {
      fastFlashcards.handleFlashcardOptionSelect(cardIndex, keys);
    },
    [fastFlashcards],
  );

  const handleTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: "wahr" | "falsch") => {
      fastFlashcards.handleTrueFalseSelect(cardIndex, itemId, value);
    },
    [fastFlashcards],
  );

  const handleClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      fastFlashcards.handleClozeInputChange(cardIndex, blankId, value);
    },
    [fastFlashcards],
  );

  const handleClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      fastFlashcards.handleClozeTokenDrop(
        event,
        cardIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [fastFlashcards],
  );

  const handleClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      fastFlashcards.handleClozeTokenRemove(cardIndex, blankId);
    },
    [fastFlashcards],
  );

  const handleTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      fastFlashcards.handleFlashcardTextInputChange(cardIndex, value);
    },
    [fastFlashcards],
  );

  const handleTextCheck = useCallback(
    (cardIndex: number) => {
      fastFlashcards.handleFlashcardTextCheck(cardIndex);
    },
    [fastFlashcards],
  );

  const handleCompositeOptionSelect = useCallback(
    (cardIndex: number, partIndex: number, keys: string[]) => {
      fastFlashcards.handleCompositeOptionSelect(cardIndex, partIndex, keys);
    },
    [fastFlashcards],
  );

  const handleCompositeTrueFalseSelect = useCallback(
    (
      cardIndex: number,
      partIndex: number,
      itemId: string,
      value: "wahr" | "falsch",
    ) => {
      fastFlashcards.handleCompositeTrueFalseSelect(
        cardIndex,
        partIndex,
        itemId,
        value,
      );
    },
    [fastFlashcards],
  );

  const handleCompositeClozeInputChange = useCallback(
    (cardIndex: number, partIndex: number, blankId: string, value: string) => {
      fastFlashcards.handleCompositeClozeInputChange(
        cardIndex,
        partIndex,
        blankId,
        value,
      );
    },
    [fastFlashcards],
  );

  const handleCompositeClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      partIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      fastFlashcards.handleCompositeClozeTokenDrop(
        event,
        cardIndex,
        partIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [fastFlashcards],
  );

  const handleCompositeClozeTokenRemove = useCallback(
    (cardIndex: number, partIndex: number, blankId: string) => {
      fastFlashcards.handleCompositeClozeTokenRemove(
        cardIndex,
        partIndex,
        blankId,
      );
    },
    [fastFlashcards],
  );

  const handleCompositeTextInputChange = useCallback(
    (cardIndex: number, partIndex: number, value: string) => {
      fastFlashcards.handleCompositeTextInputChange(
        cardIndex,
        partIndex,
        value,
      );
    },
    [fastFlashcards],
  );

  const handleCompositeTextCheck = useCallback(
    (cardIndex: number, partIndex: number) => {
      fastFlashcards.handleCompositeTextCheck(cardIndex, partIndex);
    },
    [fastFlashcards],
  );

  const handleCompositeSelfGrade = useCallback(
    (cardIndex: number, partIndex: number, grade: "correct" | "incorrect") => {
      fastFlashcards.handleCompositeSelfGrade(cardIndex, partIndex, grade);
    },
    [fastFlashcards],
  );

  const finalizeSession = useCallback(() => {
    if (!sessionStartRef.current) {
      return;
    }
    const counted = sessionCountedRef.current;
    const submittedIndices = Object.keys(flashcardSubmissions)
      .map((key) => Number(key))
      .filter((index) => flashcardSubmissions[index])
      .filter((index) => !counted.has(index));
    recordSessionResults(submittedIndices);

    let correct = 0;
    let incorrect = 0;
    let timeout = 0;
    sessionResultsRef.current.forEach((result) => {
      if (result === "correct") {
        correct += 1;
      } else if (result === "incorrect") {
        incorrect += 1;
      } else {
        timeout += 1;
      }
    });

    const total = correct + incorrect + timeout;
    if (total === 0) {
      return;
    }
    const durationMs = Math.max(0, Date.now() - sessionStartRef.current);
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const pace =
      durationMs > 0 ? Number((total / (durationMs / 60000)).toFixed(1)) : 0;
    const baseScore =
      correct * FAST_FLASHCARD_SCORE_BY_RESULT.correct +
      incorrect * FAST_FLASHCARD_SCORE_BY_RESULT.incorrect +
      timeout * FAST_FLASHCARD_SCORE_BY_RESULT.timeout;
    const multiplier = getFastFlashcardMultiplier(selectedDuration);
    const score = Math.round(baseScore * multiplier);

    setSessionElapsedMs(durationMs);
    setSessionHistory((prev) => [
      ...prev,
      {
        id: buildSessionId(),
        endedAt: new Date().toISOString(),
        score,
        correct,
        incorrect,
        timeout,
        total,
        accuracy,
        pace,
        durationMs,
      },
    ]);
  }, [flashcardSubmissions, recordSessionResults, selectedDuration]);

  const handleTimeToggle = useCallback(() => {
    setIsTimeModeEnabled((prev) => {
      if (prev) {
        finalizeSession();
      }
      return !prev;
    });
  }, [finalizeSession]);

  const handleFastSubmit = useCallback(
    (cardIndex: number, canSubmit: boolean) => {
      if (!timeModeActive) {
        return;
      }
      handleFlashcardSubmit(cardIndex, canSubmit);
    },
    [handleFlashcardSubmit, timeModeActive],
  );

  const handleFastSelfGrade = useCallback(
    (cardIndex: number, grade: "correct" | "incorrect") => {
      if (!timeModeActive) {
        return;
      }
      handleFlashcardSelfGrade(cardIndex, grade);
    },
    [handleFlashcardSelfGrade, timeModeActive],
  );

  const sessionCompleted =
    sessionStats.correct + sessionStats.incorrect + sessionStats.timeout;
  const sessionMissed = sessionStats.incorrect + sessionStats.timeout;
  const sessionAccuracy =
    sessionCompleted > 0
      ? Math.round((sessionStats.correct / sessionCompleted) * 100)
      : 0;
  const sessionBaseScore =
    sessionStats.correct * FAST_FLASHCARD_SCORE_BY_RESULT.correct +
    sessionStats.incorrect * FAST_FLASHCARD_SCORE_BY_RESULT.incorrect +
    sessionStats.timeout * FAST_FLASHCARD_SCORE_BY_RESULT.timeout;
  const sessionMultiplier = getFastFlashcardMultiplier(selectedDuration);
  const sessionScore = Math.round(sessionBaseScore * sessionMultiplier);
  const sessionMinutes = sessionElapsedMs / 60000;
  const sessionPace =
    sessionMinutes > 0 ? (sessionCompleted / sessionMinutes).toFixed(1) : "0.0";
  const lastSessions = useMemo(() => {
    return [...sessionHistory]
      .sort((a, b) => getSessionTimeValue(b.endedAt) - getSessionTimeValue(a.endedAt))
      .slice(0, 5);
  }, [sessionHistory]);
  const topSessions = useMemo(() => {
    return [...sessionHistory]
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return getSessionTimeValue(b.endedAt) - getSessionTimeValue(a.endedAt);
      })
      .slice(0, 3);
  }, [sessionHistory]);

  return {
    fastFlashcards,
    settings,
    orderedEntries,
    currentEntry,
    hasScannedCards,
    hasFilteredCards,
    isCurrentSubmitted,
    submissionLocked,
    handleCompositeOptionSelect,
    handleCompositeTrueFalseSelect,
    handleCompositeClozeInputChange,
    handleCompositeClozeTokenDrop,
    handleCompositeClozeTokenRemove,
    handleCompositeTextInputChange,
    handleCompositeTextCheck,
    handleCompositeSelfGrade,
    handleOptionSelect,
    handleTrueFalseSelect,
    handleClozeInputChange,
    handleClozeTokenDrop,
    handleClozeTokenRemove,
    handleTextInputChange,
    handleTextCheck,
    handleFastSubmit,
    handleFastSelfGrade,
    canGoBack,
    canGoNext,
    setFastCardPosition,
    statsCorrect,
    statsIncorrect,
    statsTotal,
    statsChartClass,
    statsChartStyle,
    isTimeModeEnabled,
    timeModeActive,
    handleTimeToggle,
    timeStatusLabel,
    timeProgressStyle,
    selectedDuration,
    setSelectedDuration,
    sessionStats,
    sessionCompleted,
    sessionMissed,
    sessionAccuracy,
    sessionPace,
    sessionScore,
    sessionMultiplier,
    sessionHistory,
    topSessions,
    lastSessions,
  };
};

---

## 📝 FastFlashcardPage.tsx — ./pages/FastFlashcardPage.tsx

export { FastFlashcardPage } from "./fast-flashcard/FastFlashcardPage";

---

## 📝 FlashcardPage.tsx — ./pages/FlashcardPage.tsx

import { useCallback, useEffect, useState, type DragEvent } from "react";
import { ClozeCard } from "../components/flashcards/ClozeCard";
import { CompositeCard } from "../components/flashcards/CompositeCard";
import { FreeTextCard } from "../components/flashcards/FreeTextCard";
import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../components/flashcards/TrueFalseCard";
import { StatsPanel } from "../components/StatsPanel";
import { useAppState } from "../components/AppStateProvider";
import {
  areClozeBlanksComplete,
  areTrueFalseItemsComplete,
  isFlashcardPartComplete,
} from "../features/flashcards/logic";
import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards";

const flashcardStatusLabel = "Not scanned yet";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
};

export const FlashcardPage = () => {
  const { flashcards } = useAppState();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const totalQuestions = flashcards.filteredFlashcardCount;
  const hasScannedCards = flashcards.flashcards.length > 0;
  const hasFilteredCards = flashcards.filteredFlashcardCount > 0;
  const focusLabel = isFocusMode ? "Exit focus mode" : "Enter focus mode";

  useEffect(() => {
    document.body.classList.toggle("focus-mode", isFocusMode);
    return () => {
      document.body.classList.remove("focus-mode");
    };
  }, [isFocusMode]);

  useEffect(() => {
    if (!isFocusMode) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setIsFocusMode(false);
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (flashcards.canGoBack) {
          flashcards.handleFlashcardPageBack();
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (flashcards.canGoNext) {
          flashcards.handleFlashcardPageNext();
        }
        return;
      }

      if (event.key !== "Enter" && event.key !== "NumpadEnter") {
        return;
      }

      const visibleEntries = flashcards.visibleFlashcardEntries;
      if (visibleEntries.length === 0) {
        return;
      }

      const findFirstSubmittableIndex = () => {
        for (let localIndex = 0; localIndex < visibleEntries.length; localIndex += 1) {
          const entry = visibleEntries[localIndex];
          const cardIndex = entry.cardIndex;
          const card = entry.card;
          if (flashcards.flashcardSubmissions[cardIndex]) {
            continue;
          }
          if (card.kind === "composite") {
            const partStates = flashcards.flashcardCompositeStates[cardIndex] ?? [];
            const canSubmit =
              card.parts.length > 0 &&
              card.parts.every((part, partIndex) =>
                isFlashcardPartComplete(part, partStates[partIndex] ?? {}),
              );
            if (canSubmit) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "multiple-choice") {
            if ((flashcards.flashcardSelections[cardIndex] ?? []).length > 0) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "true-false") {
            const selections = flashcards.flashcardTrueFalseSelections[cardIndex] ?? {};
            if (areTrueFalseItemsComplete(card, selections)) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "free-text") {
            continue;
          }
          const responses = flashcards.flashcardClozeResponses[cardIndex] ?? {};
          if (areClozeBlanksComplete(card, responses)) {
            return cardIndex;
          }
        }
        return null;
      };

      const resolvedIndex =
        activeCardIndex !== null &&
        visibleEntries.some((entry) => entry.cardIndex === activeCardIndex)
          ? activeCardIndex
          : findFirstSubmittableIndex();

      if (resolvedIndex === null) {
        return;
      }

      const resolvedEntry = visibleEntries.find(
        (entry) => entry.cardIndex === resolvedIndex,
      );
      const card = resolvedEntry?.card;
      if (!card || flashcards.flashcardSubmissions[resolvedIndex]) {
        return;
      }
      if (card.kind === "composite") {
        const partStates = flashcards.flashcardCompositeStates[resolvedIndex] ?? [];
        const canSubmit =
          card.parts.length > 0 &&
          card.parts.every((part, partIndex) =>
            isFlashcardPartComplete(part, partStates[partIndex] ?? {}),
          );
        if (!canSubmit) {
          return;
        }
      } else if (card.kind === "multiple-choice") {
        if ((flashcards.flashcardSelections[resolvedIndex] ?? []).length === 0) {
          return;
        }
      } else if (card.kind === "true-false") {
        const selections = flashcards.flashcardTrueFalseSelections[resolvedIndex] ?? {};
        if (!areTrueFalseItemsComplete(card, selections)) {
          return;
        }
      } else if (card.kind === "free-text") {
        return;
      } else {
      const responses = flashcards.flashcardClozeResponses[resolvedIndex] ?? {};
      if (!areClozeBlanksComplete(card, responses)) {
        return;
      }
    }

    event.preventDefault();
    flashcards.handleFlashcardSubmit(resolvedIndex, true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeCardIndex,
    flashcards,
    isFocusMode,
  ]);

  const handleOptionSelect = useCallback(
    (cardIndex: number, keys: string[]) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleFlashcardOptionSelect(cardIndex, keys);
    },
    [flashcards],
  );

  const handleTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: "wahr" | "falsch") => {
      setActiveCardIndex(cardIndex);
      flashcards.handleTrueFalseSelect(cardIndex, itemId, value);
    },
    [flashcards],
  );

  const handleClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleClozeInputChange(cardIndex, blankId, value);
    },
    [flashcards],
  );

  const handleClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleClozeTokenDrop(
        event,
        cardIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [flashcards],
  );

  const handleClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleClozeTokenRemove(cardIndex, blankId);
    },
    [flashcards],
  );

  const handleTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleFlashcardTextInputChange(cardIndex, value);
    },
    [flashcards],
  );

  const handleTextCheck = useCallback(
    (cardIndex: number) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleFlashcardTextCheck(cardIndex);
    },
    [flashcards],
  );

  const handleSelfGrade = useCallback(
    (cardIndex: number, grade: "correct" | "incorrect") => {
      setActiveCardIndex(cardIndex);
      flashcards.handleFlashcardSelfGrade(cardIndex, grade);
    },
    [flashcards],
  );

  const handleCompositeOptionSelect = useCallback(
    (cardIndex: number, partIndex: number, keys: string[]) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeOptionSelect(cardIndex, partIndex, keys);
    },
    [flashcards],
  );

  const handleCompositeTrueFalseSelect = useCallback(
    (cardIndex: number, partIndex: number, itemId: string, value: "wahr" | "falsch") => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeTrueFalseSelect(cardIndex, partIndex, itemId, value);
    },
    [flashcards],
  );

  const handleCompositeClozeInputChange = useCallback(
    (cardIndex: number, partIndex: number, blankId: string, value: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeClozeInputChange(cardIndex, partIndex, blankId, value);
    },
    [flashcards],
  );

  const handleCompositeClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      partIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeClozeTokenDrop(
        event,
        cardIndex,
        partIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [flashcards],
  );

  const handleCompositeClozeTokenRemove = useCallback(
    (cardIndex: number, partIndex: number, blankId: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeClozeTokenRemove(cardIndex, partIndex, blankId);
    },
    [flashcards],
  );

  const handleCompositeTextInputChange = useCallback(
    (cardIndex: number, partIndex: number, value: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeTextInputChange(cardIndex, partIndex, value);
    },
    [flashcards],
  );

  const handleCompositeTextCheck = useCallback(
    (cardIndex: number, partIndex: number) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeTextCheck(cardIndex, partIndex);
    },
    [flashcards],
  );

  const handleCompositeSelfGrade = useCallback(
    (cardIndex: number, partIndex: number, grade: "correct" | "incorrect") => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeSelfGrade(cardIndex, partIndex, grade);
    },
    [flashcards],
  );

  return (
    <div className={`flashcard-layout ${isFocusMode ? "focus-mode" : ""}`}>
      <section className="panel flashcard-panel">
        <div className="panel-header">
          <div>
            <h2>Flashcard</h2>
            {!hasScannedCards ? (
              <p className="muted">{flashcardStatusLabel}</p>
            ) : null}
          </div>
          <div className="panel-actions">
            <button
              type="button"
              className={`focus-toggle ${isFocusMode ? "active" : ""}`}
              onClick={() => setIsFocusMode((prev) => !prev)}
              aria-pressed={isFocusMode}
              aria-label={focusLabel}
              title={focusLabel}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                <circle cx="12" cy="12" r="3.5" />
              </svg>
            </button>
          </div>
        </div>
        <div className="panel-body">
          {!hasScannedCards ? (
            <div className="empty-state">
              Select a note from DASHBOARD and start the flashcard scan
            </div>
          ) : !hasFilteredCards ? (
            <div className="empty-state">No cards match the selected mode.</div>
          ) : (
            <div className="flashcard-list">
              {flashcards.visibleFlashcardEntries.map((entry) => {
                const cardIndex = entry.cardIndex;
                const card = entry.card;
                const submitted = !!flashcards.flashcardSubmissions[cardIndex];

                if (card.kind === "composite") {
                  return (
                    <CompositeCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      partStates={flashcards.flashcardCompositeStates[cardIndex] ?? []}
                      onOptionSelect={handleCompositeOptionSelect}
                      onTrueFalseSelect={handleCompositeTrueFalseSelect}
                      onClozeInputChange={handleCompositeClozeInputChange}
                      onClozeTokenDrop={handleCompositeClozeTokenDrop}
                      onClozeTokenRemove={handleCompositeClozeTokenRemove}
                      onClozeTokenDragStart={flashcards.handleClozeTokenDragStart}
                      onBlankDragOver={flashcards.handleClozeBlankDragOver}
                      onTextInputChange={handleCompositeTextInputChange}
                      onTextCheck={handleCompositeTextCheck}
                      onSelfGrade={handleCompositeSelfGrade}
                      onSubmit={flashcards.handleFlashcardSubmit}
                    />
                  );
                }

                if (card.kind === "cloze") {
                  return (
                    <ClozeCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      responses={flashcards.flashcardClozeResponses[cardIndex] ?? {}}
                      onInputChange={handleClozeInputChange}
                      onTokenDrop={handleClozeTokenDrop}
                      onTokenRemove={handleClozeTokenRemove}
                      onTokenDragStart={flashcards.handleClozeTokenDragStart}
                      onBlankDragOver={flashcards.handleClozeBlankDragOver}
                      onSubmit={flashcards.handleFlashcardSubmit}
                    />
                  );
                }

                if (card.kind === "true-false") {
                  return (
                    <TrueFalseCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      selections={flashcards.flashcardTrueFalseSelections[cardIndex] ?? {}}
                      onSelect={handleTrueFalseSelect}
                      onSubmit={flashcards.handleFlashcardSubmit}
                    />
                  );
                }

                if (card.kind === "free-text") {
                  return (
                    <FreeTextCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      response={flashcards.flashcardTextResponses[cardIndex] ?? ""}
                      revealed={flashcards.flashcardTextRevealed[cardIndex] ?? false}
                      selfGrade={flashcards.flashcardSelfGrades[cardIndex]}
                      onInputChange={handleTextInputChange}
                      onCheck={handleTextCheck}
                      onSelfGrade={handleSelfGrade}
                    />
                  );
                }

                return (
                  <MultipleChoiceCard
                    key={`flashcard-${cardIndex}`}
                    card={card}
                    cardIndex={cardIndex}
                    submitted={submitted}
                    selectedKeys={flashcards.flashcardSelections[cardIndex] ?? []}
                    onSelect={handleOptionSelect}
                    onSubmit={flashcards.handleFlashcardSubmit}
                  />
                );
              })}
            </div>
          )}
          <div className="flashcard-pagination">
            <button
              type="button"
              className="ghost small"
              onClick={flashcards.handleFlashcardPageBack}
              disabled={!flashcards.canGoBack}
            >
              Back
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={flashcards.handleFlashcardPageNext}
              disabled={!flashcards.canGoNext}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {isFocusMode ? null : (
        <div className="flashcard-sidebar">
          <section className="panel toolbar-panel">
            <div className="panel-header">
              <div>
                <h2>Flashcard Tools</h2>
                <p className="muted">Scan current notes for cards.</p>
              </div>
            </div>
            <div className="panel-body">
              <button
                type="button"
                className="primary"
                onClick={flashcards.handleFlashcardScan}
                disabled={flashcards.isFlashcardScanning}
              >
                {flashcards.isFlashcardScanning ? "Scanning..." : "Flashcard"}
              </button>
              <div className="flashcard-controls">
                <div className="toolbar-section">
                  <span className="label">ORDER</span>
                  <div className="pill-grid">
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardOrder === "in-order" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardOrder === "in-order"}
                      onClick={() => flashcards.setFlashcardOrder("in-order")}
                    >
                      In order
                    </button>
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardOrder === "random" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardOrder === "random"}
                      onClick={() => flashcards.setFlashcardOrder("random")}
                    >
                      Random
                    </button>
                  </div>
                </div>
                <div className="toolbar-section">
                  <span className="label">MODE</span>
                  <select
                    className="text-input"
                    value={flashcards.flashcardMode}
                    onChange={(event) =>
                      flashcards.setFlashcardMode(
                        event.target.value as typeof flashcards.flashcardMode,
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
                <div className="toolbar-section">
                  <span className="label">PAGE SIZE</span>
                  <div className="pill-grid">
                    {FLASHCARD_PAGE_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`pill pill-button ${
                          flashcards.flashcardPageSize === size ? "active" : ""
                        }`}
                        aria-pressed={flashcards.flashcardPageSize === size}
                        onClick={() => flashcards.setFlashcardPageSize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="toolbar-section">
                  <span className="label">DEFAULT SCOPE</span>
                  <div className="pill-grid">
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardScope === "current" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardScope === "current"}
                      onClick={() => flashcards.setFlashcardScope("current")}
                    >
                      Current note
                    </button>
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardScope === "vault" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardScope === "vault"}
                      onClick={() => flashcards.setFlashcardScope("vault")}
                    >
                      Whole vault
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <StatsPanel
            correctCount={flashcards.correctCount}
            correctPercent={flashcards.correctPercent}
            incorrectCount={flashcards.incorrectCount}
            totalQuestions={totalQuestions}
          />
        </div>
      )}
    </div>
  );
};

---

## 📝 appSections.ts — ./pages/help/content/appSections.ts

import { AppSectionData, AppSectionId, LocalizedText } from "./types";

export const APP_SECTION_ORDER: AppSectionId[] = [
  "dashboard",
  "flashcard",
  "fast-flashcard",
  "spaced-repetition",
];

export const APP_SECTION_GROUND_RULES: {
  paragraph: LocalizedText;
  bullets: LocalizedText[];
} = {
  paragraph: {
    en: "Start at Makedon to pick a note and scan its cards, then use the sections below to understand how each tool manages your reviews. This quick orientation helps you decide where to continue next.",
    de: "Beginne in Makedon, wähle eine Notiz und scanne sie, dann nutze die unten stehenden Sektionen, um zu verstehen, wie jedes Tool deine Wiederholungen steuert. Diese kurze Orientierung hilft dir, den naechsten Schritt sicher zu waehlen.",
  },
  bullets: [
    {
      en: "Choose one of the four sections on the left; the detail panel updates instantly so you can keep reading without leaving the page.",
      de: "Wähle eine der vier Sektionen links; der Detailbereich aktualisiert sich sofort, damit du ohne Seitenwechsel weiterlesen kannst.",
    },
    {
      en: "The highlighted entry marks your current location and makes it easy to switch topics.",
      de: "Der markierte Eintrag zeigt dir, wo du gerade bist, und erleichtert den Wechsel zwischen Themen.",
    },
    {
      en: "Use the Back button or breadcrumb to return to the overview when you are done.",
      de: "Nutze Zurück oder die Breadcrumb, um nach dem Lesen zur Übersicht zurückzukehren.",
    },
    {
      en: "Each detail panel explains what you see, how to act, and how filtering works for that tool, step by step.",
      de: "Jeder Detailbereich beschreibt, was du siehst, welche Aktionen möglich sind und wie das Filtern in diesem Tool funktioniert, Schritt fuer Schritt.",
    },
  ],
};

export const APP_SECTION_LABELS = {
  groundRulesTitle: { en: "Ground rules", de: "Grundregeln" },
  typicalAction: { en: "Typical action", de: "Typische Aktion" },
  whatIs: { en: "What is it?", de: "Was ist das?" },
  purpose: { en: "What is it for?", de: "Wofuer ist es?" },
  whatYouSee: { en: "What you see there", de: "Was du dort siehst" },
  showCards: { en: "Show cards & filter", de: "Karten anzeigen & filtern" },
  workflow: { en: "Core workflow", de: "Core-Workflow" },
  tips: { en: "Tips", de: "Tipps" },
};

export const APP_SECTION_DATA: Record<AppSectionId, AppSectionData> = {
  dashboard: {
    title: { en: "Makedon", de: "Makedon" },
    summary: {
      en: "Note list, scan status, and quick previews to orient you before review.",
      de: "Notizenliste mit Scan-Status und Vorschauen, damit du dich vor dem Review orientierst.",
    },
    action: {
      en: "Pick a note",
      de: "Notiz wählen",
    },
    detail: {
      whatIs: {
        en: "Makedon shows vault notes, scan health, and shortcuts before any review. It is the starting hub where you decide what to study next.",
        de: "Makedon zeigt Vault-Notizen, Scan-Status und Schnellaktionen vor jeder Wiederholung. Es ist der Startpunkt, an dem du entscheidest, was als naechstes dran ist.",
      },
      purpose: [
        {
          en: "Choose the note you want to study and see recent scan timestamps to confirm it is up to date.",
          de: "Wähle die Notiz aus und sieh die letzten Scanzeiten, damit du weisst, ob sie aktuell ist.",
        },
        {
          en: "Trigger scans or rescans so the latest cards flow into the review tools and appear immediately.",
          de: "Starte Scans/Rescans, damit neue Karten in den Review-Tools verfuegbar sind und sofort erscheinen.",
        },
        {
          en: "Open a preview or jump directly into one of the review tools via quick actions for a faster start.",
          de: "Öffne die Vorschau oder spring per Schnellaktion direkt in ein Review-Tool, um schneller zu starten.",
        },
      ],
      whatYouSee: {
        en: "A note list with status badges, timestamps, quick actions, and filters for recently scanned items, plus quick access to previews.",
        de: "Eine Notizenliste mit Badges, Zeitstempeln, Schnellaktionen und Filtern fuer kuerzlich gescannte Notizen sowie direktem Zugang zur Vorschau.",
      },
      workflow: {
        en: "Select note → Scan/Rescan → open Flashcard/Fast Flashcard/Spaced Repetition to review.",
        de: "Notiz wählen → Scannen/Rescan → Flashcard/Fast Flashcard/Spaced Repetition öffnen und wiederholen.",
      },
      showCards: {
        en: "Scanned cards feed the three tools; adjust their filters to control the reviews and narrow the focus.",
        de: "Gescannten Karten landen in den Tools; passe deren Filter an, um die Auswahl zu steuern und den Fokus zu setzen.",
      },
      tips: {
        en: "Filter by scan status to focus on notes you just updated and avoid outdated cards.",
        de: "Filtere nach Scan-Status, um frisch bearbeitete Notizen zu priorisieren und veraltete Karten zu vermeiden.",
      },
    },
  },
  flashcard: {
    title: { en: "Flashcard", de: "Flashcard" },
    summary: {
      en: "Standard review with stats and filters to pace a focused session.",
      de: "Normale Wiederholung mit Statistiken und Filtern, damit die Session klar strukturiert bleibt.",
    },
    action: {
      en: "Start a review",
      de: "Review starten",
    },
    detail: {
      whatIs: {
        en: "Flashcard Tools deliver single-card reviews with a stats diagram, counters, and navigation. It is the classic mode for steady, deliberate practice.",
        de: "Die Flashcard Tools bieten Einzelkarten-Wiederholungen mit Diagramm, Zählern und Navigation. Das ist der klassische Modus fuer ruhiges, systematisches Lernen.",
      },
      purpose: [
        {
          en: "Answer cards while tracking accuracy and totals, so progress stays visible.",
          de: "Beantworte Karten und behalte Genauigkeit und Totale im Blick, damit der Fortschritt sichtbar bleibt.",
        },
        {
          en: "Tweak ORDER, MODE, DEFAULT SCOPE, PAGE SIZE, solution reveal, and stats reset to shape each session and reuse settings later.",
          de: "Passe ORDER, MODE, DEFAULT SCOPE, PAGE SIZE, Solution Reveal und Statistik-Reset an den Ablauf an und nutze diese Einstellungen erneut.",
        },
      ],
      whatYouSee: {
        en: "Card view with submission buttons, counters, stats diagram, and Flashcard Tools controls for order, scope, and mode.",
        de: "Kartenbereich mit Abgabe, Zählern, Diagramm und Flashcard Tools-Schaltern fuer Order, Scope und Mode.",
      },
      workflow: {
        en: "Scan note → open Flashcard → adjust filters → answer sequentially and watch stats update.",
        de: "Notiz scannen → Flashcard öffnen → Filter anpassen → Karten nacheinander beantworten und Statistiken verfolgen.",
      },
      showCards: {
        en: "Cards respect the selected scope/order/mode/page size; changes refresh the content instantly and update the order.",
        de: "Die Karten folgen Scope, Order, Mode und Page Size; Anpassungen aktualisieren sofort und passen die Reihenfolge an.",
      },
      tips: {
        en: "Use solution reveal for tricky cards and reset stats when restarting a session for a clean run.",
        de: "Nutze Solution Reveal bei schwierigen Karten und setze Statistiken zurück, wenn du eine Session sauber neu starten willst.",
      },
    },
  },
  "fast-flashcard": {
    title: { en: "Fast Flashcard", de: "Fast Flashcard" },
    summary: {
      en: "Timed sprints with duration pills and scoring for quick practice.",
      de: "Zeitgesteuerte Sprints mit Dauer-Buttons und Score fuer schnelle Uebungen.",
    },
    action: {
      en: "Start the timer",
      de: "Timer starten",
    },
    detail: {
      whatIs: {
        en: "Fast Flashcard wraps cards in a timer, momentum cards, and a duration-weighted score. It rewards speed while still tracking accuracy.",
        de: "Fast Flashcard kombiniert Karten mit Timer, Momentum-Karten und dauergewichteten Punkten. Es belohnt Tempo und misst zugleich die Genauigkeit.",
      },
      purpose: [
        {
          en: "Practice fast repetitions and measure pace/accuracy across short runs.",
          de: "Trainiere schnelle Wiederholungen und messe Tempo/Genauigkeit ueber kurze Laeufe.",
        },
        {
          en: "Compare session stats via the history panel to see trends over time.",
          de: "Vergleiche Sessions ueber den Verlauf, um Trends ueber die Zeit zu erkennen.",
        },
      ],
      whatYouSee: {
        en: "Timer block, stats diagram, session momentum cards (Cards/Accuracy/Pace/Score), flashcard list, submission outcome pill, and duration pills alongside ORDER/MODE/DEFAULT SCOPE for quick setup.",
        de: "Timer, Diagramm, Session-Karten, Kartenliste, Submit-Ergebnis und Fast Flashcard Tools mit Dauer-Buttons sowie ORDER/MODE/DEFAULT SCOPE fuer schnelles Setup.",
      },
      workflow: {
        en: "Scan note → choose duration → start Fast Flashcard → submit before time ends and continue with the next card.",
        de: "Notiz scannen → Dauer wählen → Fast Flashcard starten → vor Ablauf abgeben und mit der naechsten Karte weitermachen.",
      },
      showCards: {
        en: "Cards follow Fast Flashcard filters; adjust ORDER, MODE, DEFAULT SCOPE, and duration pills to tweak pacing and difficulty.",
        de: "Die Karten folgen Fast Flashcard-Filtern; ändere ORDER, MODE, DEFAULT SCOPE und Dauer-Buttons, um Tempo und Schwierigkeit zu steuern.",
      },
      tips: {
        en: "Stop the timer between runs to reset session stats without affecting history and keep comparisons clean.",
        de: "Pause den Timer zwischen Läufen, um Session-Stats zu resetten ohne den Verlauf zu beeinflussen und Vergleiche sauber zu halten.",
      },
    },
  },
  "spaced-repetition": {
    title: { en: "Spaced Repetition", de: "Spaced Repetition" },
    summary: {
      en: "Box-based sessions with weighted order for long-term retention.",
      de: "Boxen-Sessionen mit gewichteter Reihenfolge fuer langfristige Wiederholung.",
    },
    action: {
      en: "Run a session",
      de: "Session starten",
    },
    detail: {
      whatIs: {
        en: "Spaced Repetition fits cards into Leitner boxes and runs adjustable sessions for retention. It focuses practice on weaker cards and spaces repeats over time.",
        de: "Spaced Repetition ordnet Karten in Leitner-Boxen und fuehrt einstellbare Sessions durch. Der Fokus liegt auf schwachen Karten und gestaffelten Wiederholungen.",
      },
      purpose: [
        {
          en: "Focus on difficult cards by selecting specific boxes and controlling the mix.",
          de: "Fokussiere schwierige Karten ueber Boxenauswahl und steuere die Mischung.",
        },
        {
          en: "Choose order, page size, and repetition strength for pacing and workload.",
          de: "Waehle Order, Page Size und Repetition Strength fuer Tempo und Umfang.",
        },
        {
          en: "Let answers promote/demote cards automatically so progress is reflected in the boxes.",
          de: "Lass Antworten Karten automatisch befoerdern oder zurueckstufen, damit der Fortschritt in den Boxen sichtbar ist.",
        },
      ],
      whatYouSee: {
        en: "Box grid with counts, queue preview, and controls for order/page size/repetition strength, so you can see what is due.",
        de: "Boxen-Raster mit Zaehlern, Queue-Preview und Controls fuer Order/Page Size/Repetition Strength, damit du siehst, was ansteht.",
      },
      workflow: {
        en: "Scan note → open Spaced Repetition → pick boxes/order → run session and observe box changes.",
        de: "Notiz scannen → Spaced Repetition öffnen → Boxen/Order wählen → Session durchführen und Boxenveraenderungen beobachten.",
      },
      showCards: {
        en: "Only cards from selected boxes appear; order and page size plus repetition strength decide repetition frequency and spacing.",
        de: "Nur Karten aus gewaehlten Boxen erscheinen; Order/Page Size und Repetition Strength bestimmen Frequenz und Abstand.",
      },
      tips: {
        en: "Boost repetition strength when lower boxes need more practice, then scale back once accuracy improves.",
        de: "Erhoehe die Repetition Strength, wenn niedrigere Boxen mehr Uebung brauchen, und reduziere sie wieder, wenn die Genauigkeit steigt.",
      },
    },
  },
};

---

## 📝 i18n.ts — ./pages/help/content/i18n.ts

import { AppLanguage, LocalizedText } from "./types";

export const resolveText = (value: LocalizedText, language: AppLanguage) => {
  if (language === "de") {
    return value.de ?? value.en ?? "";
  }
  return value.en ?? value.de ?? "";
};

export const resolveList = (items: LocalizedText[] | undefined, language: AppLanguage) =>
  (items ?? [])
    .map((item) => resolveText(item, language))
    .filter((item) => item.trim() !== "");

---

## 📝 labels.ts — ./pages/help/content/labels.ts

export const helpHeader = {
  eyebrow: { en: "Help", de: "Hilfe" },
  title: { en: "Help", de: "Hilfe" },
  summary: {
    en: "Quick reminders for the workflow and syntax.",
    de: "Kurze Hinweise zum Workflow und zur Syntax.",
  },
};

export const helpLabels = {
  back: { en: "Back", de: "Zurueck" },
  copy: { en: "Copy", de: "Kopieren" },
  copied: { en: "Copied", de: "Kopiert" },
  copyExample: { en: "Copy example", de: "Beispiel kopieren" },
  copyPrompt: { en: "Copy LLM prompt", de: "LLM-Prompt kopieren" },
  promptTemplate: { en: "LLM prompt template", de: "LLM-Prompt-Template" },
  example: { en: "Example", de: "Beispiel" },
  rules: { en: "Rules", de: "Regeln" },
  whatItIs: { en: "What it is", de: "Was ist es" },
  mistakes: { en: "Common mistakes", de: "Haeufige Fehler" },
  markers: { en: "Markers", de: "Marker" },
  draft: { en: "Draft", de: "Entwurf" },
  openTopic: { en: "Open topic", de: "Thema oeffnen" },
};

---

## 📝 entries.ts — ./pages/help/content/syntax/entries.ts

import { SyntaxEntry } from "../types";

const joinLines = (lines: string[]) => lines.join("\n");

export const flashcardSyntaxEntries: SyntaxEntry[] = [
  {
    id: "separator-block",
    title: { en: "Structured separator block", de: "Strukturierter Separator-Block" },
    markers: ["---", "#card", "#"],
    keyRule: {
      en: "Use --- to wrap cards; only #card/# defines card content.",
      de: "--- kann Karten umrahmen; nur #card/# definiert Karteninhalt.",
    },
    snippet: {
      en: "---\n#card",
      de: "---\n#card",
    },
    detail: {
      en: {
        whatItIs:
          "Markdown separators (---) can wrap card blocks to structure notes. The parser still relies on #card and #; text outside the block is ignored.",
        rules: [
          "Use --- on its own lines if you want separators.",
          "Cards still require #card and # on their own lines.",
          "Content outside #card/# is ignored.",
          "Do not expect --- to start or end a card by itself.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        rulesNote:
          "Cards must be wrapped with #card and #. The first non-empty line is the question. The remaining lines define the card type (options, blanks, or Answer/Antwort marker). Workflow: Makedon -> select note -> scan -> review (via Flashcard Tools or Spaced Repetition).",
        promptTemplate: joinLines([
          "Create one flashcard and optionally wrap it with markdown separators.",
          "Return only the #card block (and optional --- lines).",
          "Rules:",
          "- #card/# define the card.",
          "- --- is optional and must be on its own lines.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "---",
          "#card",
          "{{prompt}}",
          "Answer: {{answer}}",
          "#",
          "---",
        ]),
        example: joinLines([
          "---",
          "#card",
          "Define CPU.",
          "Answer: The central processing unit.",
          "#",
          "---",
        ]),
        mistakes: [
          "Using --- without #card/#.",
          "Placing --- inside the #card block.",
        ],
      },
      de: {
        whatItIs:
          "Markdown-Trennlinien (---) koennen Kartenbloecke optisch gruppieren. Der Parser nutzt weiterhin #card und #; Text ausserhalb wird ignoriert.",
        rules: [
          "--- nur als eigene Zeile verwenden.",
          "Karten brauchen weiterhin #card und # auf eigenen Zeilen.",
          "Inhalt ausserhalb #card/# wird ignoriert.",
          "--- ersetzt keine #card/#-Markierung.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        rulesNote:
          "Karten muessen mit #card und # umschlossen sein. Die erste nicht-leere Zeile ist die Frage. Die restlichen Zeilen definieren den Kartentyp (Optionen, Luecken oder Answer-/Antwort-Marker). Workflow: Makedon -> Notiz waehlen -> scannen -> wiederholen (ueber Flashcard Tools oder Spaced Repetition).",
        promptTemplate: joinLines([
          "Erstelle eine Karte und umrahme sie optional mit Markdown-Trennlinien.",
          "Antworte nur mit dem #card-Block (und optional ---).",
          "Regeln:",
          "- #card/# definieren die Karte.",
          "- --- ist optional und steht allein in der Zeile.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "---",
          "#card",
          "{{frage}}",
          "Antwort: {{antwort}}",
          "#",
          "---",
        ]),
        example: joinLines([
          "---",
          "#card",
          "Definiere CPU.",
          "Antwort: Die zentrale Verarbeitungseinheit.",
          "#",
          "---",
        ]),
        mistakes: [
          "--- ohne #card/# verwenden.",
          "--- innerhalb des #card-Blocks platzieren.",
        ],
      },
    },
  },
  {
    id: "qa-classic",
    title: { en: "Classic Q&A", de: "Klassische Q&A" },
    markers: ["Answer:", "Antwort:"],
    keyRule: {
      en: "Answer:/Antwort: splits front and back; answers can be multiline.",
      de: "Answer:/Antwort: trennt Vorder- und Rueckseite; Antworten koennen mehrzeilig sein.",
    },
    snippet: {
      en: "Answer: {{answer}}",
      de: "Antwort: {{antwort}}",
    },
    detail: {
      en: {
        whatItIs:
          "Use a direct question on the first non-empty line and provide the answer after the Answer: marker. The answer may be inline or on the following lines. Answer: and Antwort: behave identically; only the label language changes.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Start the answer with Answer: (or Antwort:) inside the block.",
          "Answer: and Antwort: behave identically; only the label language changes.",
          "Do not mix with other card types.",
        ],
        promptTemplate: joinLines([
          "Write exactly one flashcard in FMDFlashcard syntax.",
          "Return only the #card block.",
          "Rules:",
          "- First non-empty line is the prompt.",
          "- Use Answer: (or Antwort:) to start the answer.",
          "- Do not mix with other card types.",
          "Template:",
          "#card",
          "{{prompt}}",
          "Answer: {{answer}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "What is SQL?",
          "Answer: A language for querying databases.",
          "#",
        ]),
        mistakes: [
          "Placing Answer: before the prompt.",
          "Putting #card and # on the same line.",
          "Mixing with multiple choice or true/false.",
        ],
      },
      de: {
        whatItIs:
          "Nutze eine direkte Frage in der ersten nicht-leeren Zeile und schreibe die Antwort nach dem Marker Antwort: (oder Answer:). Die Antwort darf in derselben Zeile oder in den folgenden Zeilen stehen. Answer: und Antwort: verhalten sich identisch; nur die Sprache des Labels aendert sich.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "Antwort mit Antwort: (oder Answer:) starten.",
          "Answer: und Antwort: verhalten sich identisch; nur die Sprache des Labels aendert sich.",
          "Nicht mit anderen Kartentypen mischen.",
        ],
        promptTemplate: joinLines([
          "Erstelle genau eine Karte in FMDFlashcard-Syntax.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Erste nicht-leere Zeile ist die Frage.",
          "- Starte die Antwort mit Antwort: (oder Answer:).",
          "- Nicht mit anderen Kartentypen mischen.",
          "Template:",
          "#card",
          "{{frage}}",
          "Antwort: {{antwort}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Was ist SQL?",
          "Antwort: Eine Sprache zum Abfragen von Datenbanken.",
          "#",
        ]),
        mistakes: [
          "Antwort: vor die Frage setzen.",
          "#card und # in derselben Zeile schreiben.",
          "Mit Multiple Choice oder True/False mischen.",
        ],
      },
    },
  },
  {
    id: "mc-single",
    title: { en: "Multiple choice (Single Answer)", de: "Multiple Choice (eine Antwort)" },
    markers: ["a)", "b)", "c)", "-a"],
    keyRule: {
      en: "At least two options, exactly one correct marker (-a, -b, ...).",
      de: "Mindestens zwei Optionen, genau ein korrekter Marker (-a, -b, ...).",
    },
    snippet: {
      en: "a) {{option_a}}\n-b",
      de: "a) {{option_a}}\n-b",
    },
    detail: {
      en: {
        whatItIs:
          "A multiple choice card with exactly one correct option. Label options as a), b), c) and mark the correct option with a single -a, -b, or -c line.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Provide at least two options labeled a), b), c) ...",
          "Include exactly one correct marker (-a, -b, ...).",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one multiple choice flashcard with a single correct answer.",
          "Return only the #card block.",
          "Rules:",
          "- Prompt on the first non-empty line.",
          "- Options labeled a), b), c)...",
          "- Exactly one correct marker (-a, -b, ...).",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt}}",
          "a) {{option_a}}",
          "b) {{option_b}}",
          "c) {{option_c}}",
          "-{{correct_letter}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Which planet is known as the Red Planet?",
          "a) Earth",
          "b) Mars",
          "c) Venus",
          "-b",
          "#",
        ]),
        mistakes: [
          "Marking more than one correct option.",
          "Using option labels without a correct marker.",
        ],
      },
      de: {
        whatItIs:
          "Eine Multiple-Choice-Karte mit genau einer richtigen Antwort. Optionen als a), b), c) schreiben und genau einen Marker -a, -b oder -c setzen.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "Mindestens zwei Optionen mit a), b), c) ...",
          "Genau einen korrekten Marker setzen (-a, -b, ...).",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Multiple-Choice-Karte mit genau einer richtigen Antwort.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Frage in der ersten nicht-leeren Zeile.",
          "- Optionen als a), b), c)...",
          "- Genau ein korrekter Marker (-a, -b, ...).",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage}}",
          "a) {{option_a}}",
          "b) {{option_b}}",
          "c) {{option_c}}",
          "-{{korrekt}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Welcher Planet ist der Rote Planet?",
          "a) Erde",
          "b) Mars",
          "c) Venus",
          "-b",
          "#",
        ]),
        mistakes: [
          "Mehrere richtige Marker setzen.",
          "Keine Option als richtig markieren.",
        ],
      },
    },
  },
  {
    id: "mc-multi",
    title: {
      en: "Multiple choice (Multiple Answers)",
      de: "Multiple Choice (mehrere Antworten)",
    },
    markers: ["a)", "b)", "c)", "-a", "-c"],
    keyRule: {
      en: "At least two options; multiple correct markers allowed.",
      de: "Mindestens zwei Optionen; mehrere korrekte Marker erlaubt.",
    },
    detail: {
      en: {
        whatItIs:
          "A multiple choice card with more than one correct option. Label options as a), b), c) and list every correct marker on its own line.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Provide at least two options labeled a), b), c) ...",
          "Allow multiple correct markers (-a, -b, -c).",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one multiple choice flashcard with multiple correct answers.",
          "Return only the #card block.",
          "Rules:",
          "- Prompt on the first non-empty line.",
          "- Options labeled a), b), c)...",
          "- List every correct marker on its own line.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt}}",
          "a) {{option_a}}",
          "b) {{option_b}}",
          "c) {{option_c}}",
          "-{{correct_letter_1}}",
          "-{{correct_letter_2}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Which numbers are prime?",
          "a) 2",
          "b) 4",
          "c) 5",
          "-a",
          "-c",
          "#",
        ]),
        mistakes: [
          "Using only one correct marker for a multi-answer prompt.",
          "Forgetting to mark all correct options.",
        ],
      },
      de: {
        whatItIs:
          "Eine Multiple-Choice-Karte mit mehreren richtigen Antworten. Optionen als a), b), c) schreiben und alle korrekten Marker jeweils in einer eigenen Zeile angeben.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "Mindestens zwei Optionen mit a), b), c) ...",
          "Mehrere korrekte Marker erlaubt (-a, -b, -c).",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Multiple-Choice-Karte mit mehreren richtigen Antworten.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Frage in der ersten nicht-leeren Zeile.",
          "- Optionen als a), b), c)...",
          "- Alle korrekten Marker jeweils in eigener Zeile.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage}}",
          "a) {{option_a}}",
          "b) {{option_b}}",
          "c) {{option_c}}",
          "-{{korrekt_1}}",
          "-{{korrekt_2}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Welche Zahlen sind prim?",
          "a) 2",
          "b) 4",
          "c) 5",
          "-a",
          "-c",
          "#",
        ]),
        mistakes: [
          "Nur einen Marker setzen, obwohl mehrere Antworten richtig sind.",
          "Nicht alle korrekten Optionen markieren.",
        ],
      },
    },
  },
  {
    id: "true-false",
    title: { en: "True/False statements", de: "True/False-Aussagen" },
    markers: ["-true", "-false", "-wahr", "-falsch"],
    keyRule: {
      en: "Each statement line is followed by -true/-false (or -wahr/-falsch).",
      de: "Jede Aussage wird von -true/-false (oder -wahr/-falsch) gefolgt.",
    },
    snippet: {
      en: "Statement\n-true",
      de: "Aussage\n-true",
    },
    detail: {
      en: {
        whatItIs:
          "A statement followed by -true or -false. You can stack multiple statements in one card, as long as every statement line is immediately followed by its marker.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the first statement.",
          "Each statement line must be followed by -true/-false or -wahr/-falsch.",
          "You may stack multiple statement/marker pairs.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
          "Multilingual markers supported: -true/-false and -wahr/-falsch.",
        ],
        promptTemplate: joinLines([
          "Create one true/false flashcard, optionally with multiple statements.",
          "Return only the #card block.",
          "Rules:",
          "- Each statement line is followed by -true or -false.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "- Markers can be -true/-false or -wahr/-falsch.",
          "Template:",
          "#card",
          "{{statement_1}}",
          "-{{true_or_false_1}}",
          "{{statement_2}}",
          "-{{true_or_false_2}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "The Earth orbits the Sun.",
          "-true",
          "Pluto is a planet.",
          "-false",
          "#",
        ]),
        mistakes: [
          "Writing two statements and only one marker.",
          "Placing a marker without a statement line.",
        ],
      },
      de: {
        whatItIs:
          "Eine Aussage gefolgt von -true oder -false. Du kannst mehrere Aussagen stapeln, solange jede Aussage direkt ihren Marker hat.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die erste Aussage.",
          "Jede Aussage braucht direkt danach -true/-false oder -wahr/-falsch.",
          "Mehrere Aussage/Marker-Paare sind erlaubt.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Mehrsprachige Marker: -true/-false und -wahr/-falsch.",
        ],
        promptTemplate: joinLines([
          "Erstelle eine True/False-Karte, optional mit mehreren Aussagen.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Jede Aussage wird direkt von -true oder -false gefolgt.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "- Marker koennen -true/-false oder -wahr/-falsch sein.",
          "Template:",
          "#card",
          "{{aussage_1}}",
          "-{{true_oder_false_1}}",
          "{{aussage_2}}",
          "-{{true_oder_false_2}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Die Erde kreist um die Sonne.",
          "-true",
          "Pluto ist ein Planet.",
          "-false",
          "#",
        ]),
        mistakes: [
          "Zwei Aussagen schreiben, aber nur einen Marker setzen.",
          "Marker ohne Aussagezeile setzen.",
        ],
      },
    },
  },
  {
    id: "inline-code-multi",
    title: { en: "Inline-code tokens", de: "Inline-Code-Tokens" },
    markers: ["`token`"],
    keyRule: {
      en: "Multiple `...` tokens in one line create multiple drag blanks.",
      de: "Mehrere `...`-Tokens in einer Zeile erzeugen mehrere Drag-Luecken.",
    },
    snippet: {
      en: "`git` `status`",
      de: "`git` `status`",
    },
    detail: {
      en: {
        whatItIs:
          "Inline code tokens (`...`) become draggable blanks. You can place multiple tokens in one line to create multiple blanks.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Use backticks around each token.",
          "Multiple tokens per line are allowed.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one inline-code flashcard with multiple drag tokens.",
          "Return only the #card block.",
          "Rules:",
          "- Use backticks around each token.",
          "- You may include multiple tokens per line.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt}}",
          "{{text_with_`token_1`_and_`token_2`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Complete the command:",
          "`git` `status` shows changes.",
          "#",
        ]),
        mistakes: [
          "Using single quotes instead of backticks.",
          "Leaving a token without closing backticks.",
        ],
      },
      de: {
        whatItIs:
          "Inline-Code-Tokens (`...`) werden zu Drag-Luecken. Du kannst mehrere Tokens in einer Zeile setzen, um mehrere Luecken zu erzeugen.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "Jeden Token mit Backticks markieren.",
          "Mehrere Tokens pro Zeile sind erlaubt.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Inline-Code-Karte mit mehreren Drag-Tokens.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Tokens mit Backticks markieren.",
          "- Mehrere Tokens pro Zeile sind erlaubt.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage}}",
          "{{text_mit_`token_1`_und_`token_2`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Vervollstaendige den Befehl:",
          "`git` `status` zeigt Aenderungen.",
          "#",
        ]),
        mistakes: [
          "Einfache Anfuehrungszeichen statt Backticks nutzen.",
          "Token ohne schliessende Backticks.",
        ],
      },
    },
  },
  {
    id: "cloze-typed",
    title: { en: "Cloze (typed blanks)", de: "Cloze (Eingabe-Luecken)" },
    markers: ["%%...%%"],
    keyRule: {
      en: "%%...%% creates typed input blanks.",
      de: "%%...%% erzeugt Eingabe-Luecken.",
    },
    snippet: {
      en: "%%Paris%%",
      de: "%%Paris%%",
    },
    detail: {
      en: {
        whatItIs:
          "Cloze cards hide parts of a sentence inside %%...%% and require typed input for each blank.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Use %%...%% to mark each typed blank.",
          "Each blank must have content inside the %%...%% markers.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one cloze flashcard with typed blanks.",
          "Return only the #card block.",
          "Rules:",
          "- First non-empty line is the prompt.",
          "- Use %%...%% for each blank.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt_with_%%cloze%%}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Fill in: The capital of France is %%Paris%%.",
          "#",
        ]),
        mistakes: [
          "Leaving an empty %%...%% segment.",
          "Forgetting to close a %%...%% marker.",
        ],
      },
      de: {
        whatItIs:
          "Cloze-Karten verstecken Teile eines Satzes in %%...%% und erwarten eine getippte Eingabe fuer jede Luecke.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "%%...%% fuer jede Eingabe-Luecke nutzen.",
          "Jede Luecke muss Inhalt zwischen %%...%% haben.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Cloze-Karte mit Eingabe-Luecken.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Erste nicht-leere Zeile ist die Frage.",
          "- %%...%% fuer jede Luecke nutzen.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage_mit_%%cloze%%}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Ergaenze: Die Hauptstadt von Frankreich ist %%Paris%%.",
          "#",
        ]),
        mistakes: [
          "Leere %%...%%-Luecken lassen.",
          "%%...%%-Marker nicht schliessen.",
        ],
      },
    },
  },
  {
    id: "cloze-inline",
    title: { en: "Cloze + inline code", de: "Cloze + Inline-Code" },
    markers: ["%%...%%", "`token`"],
    keyRule: {
      en: "Typed cloze blanks and inline-code drag tokens can be combined.",
      de: "Cloze-Luecken und Inline-Code-Drag-Tokens koennen kombiniert werden.",
    },
    snippet: {
      en: "%%Paris%% and `Seine`",
      de: "%%Paris%% und `Seine`",
    },
    detail: {
      en: {
        whatItIs:
          "Cloze blanks (%%...%%) are typed inputs, while inline code tokens (`...`) become drag blanks. You can use both in one card and combine with other syntaxes if desired.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Use %%...%% for typed cloze blanks.",
          "Use `...` for drag tokens.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one cloze flashcard that may combine typed blanks and drag tokens.",
          "Return only the #card block.",
          "Rules:",
          "- First non-empty line is the prompt.",
          "- Typed blanks use %%...%%.",
          "- Drag tokens use `...`.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt_with_%%cloze%%_and_`token`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Fill in: The capital of France is %%Paris%% and the river is `Seine`.",
          "#",
        ]),
        mistakes: [
          "Leaving an empty %%...%% segment.",
          "Forgetting backticks around a drag token.",
        ],
      },
      de: {
        whatItIs:
          "Cloze-Luecken (%%...%%) sind Eingabefelder, Inline-Code-Tokens (`...`) werden zu Drag-Luecken. Beides kann in einer Karte stehen und mit anderen Syntaxen kombiniert werden.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "%%...%% fuer Cloze-Eingaben nutzen.",
          "`...` fuer Drag-Tokens nutzen.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Cloze-Karte, die Eingabeblanks und Drag-Tokens kombinieren darf.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Erste nicht-leere Zeile ist die Frage.",
          "- Eingabeblanks mit %%...%%.",
          "- Drag-Tokens mit `...`.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage_mit_%%cloze%%_und_`token`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Fill in: Die Hauptstadt von Frankreich ist %%Paris%% und der Fluss ist `Seine`.",
          "#",
        ]),
        mistakes: [
          "Leere %%...%%-Blaenke lassen.",
          "Backticks fuer Drag-Tokens vergessen.",
        ],
      },
    },
  },
];

---

## 📝 overview.ts — ./pages/help/content/syntax/overview.ts

export const flashcardSyntaxOverview = {
  title: { en: "Core rules", de: "Grundregeln" },
  bullets: [
    {
      en: "Wrap every card with #card and # on their own lines; content outside is ignored.",
      de: "Jede Karte mit #card und # auf eigenen Zeilen umschliessen; Inhalt ausserhalb wird ignoriert.",
    },
    {
      en: "The first non-empty line is the prompt.",
      de: "Die erste nicht-leere Zeile ist die Frage.",
    },
    {
      en: "Syntaxes can be combined in one #card block when desired; keep markers clear and consistent.",
      de: "Syntaxen koennen bei Bedarf in einem #card-Block kombiniert werden; Marker klar und konsistent halten.",
    },
  ],
};

---

## 📝 topics.ts — ./pages/help/content/topics.ts

import { HelpTopic } from "./types";

export const helpTopics: HelpTopic[] = [
  {
    id: "flashcard-syntax",
    title: { en: "Flashcard syntax", de: "Karteikarten-Syntax" },
    summary: {
      en: "Complete syntax reference with examples for every supported card type, plus rules and copy-ready templates.",
      de: "Komplette Syntax-Referenz mit Beispielen fuer alle Kartentypen sowie Regeln und Vorlagen zum Kopieren.",
    },
    sections: [],
  },
  {
    id: "app-sections",
    title: { en: "App Sections", de: "App Sections" },
    summary: {
      en: "Overview, navigation, and typical workflows for new users, with a quick tour of each main area.",
      de: "Ueberblick, Navigation und typische Workflows fuer neue Nutzer, inklusive kurzem Rundgang durch alle Hauptbereiche.",
    },
    sections: [],
  },
  {
    id: "settings",
    title: { en: "Settings explained", de: "Einstellungen erklaert" },
    summary: {
      en: "What the main options control and where defaults live, so you can predict tool behavior between sessions.",
      de: "Welche Optionen was steuern und wo Standards gesetzt werden, damit das Tool-Verhalten nachvollziehbar bleibt.",
    },
    sections: [
      {
        id: "settings-flashcards",
        title: { en: "Flashcard Tools defaults", de: "Flashcard-Tools-Defaults" },
        bullets: [
          {
            en: "Scan scope, order, page size, and stats reset define the review flow and which cards appear.",
            de: "Scan-Scope, Reihenfolge, Page Size und Statistik-Reset steuern den Ablauf und welche Karten erscheinen.",
          },
        ],
      },
      {
        id: "settings-sr",
        title: {
          en: "Spaced Repetition defaults",
          de: "Spaced Repetition-Defaults",
        },
        bullets: [
          {
            en: "Boxes, order, page size, and repetition strength set SR behavior and repeat frequency.",
            de: "Boxen, Reihenfolge, Page Size und Repetition Strength bestimmen SR und die Wiederholfrequenz.",
          },
        ],
      },
      {
        id: "settings-language",
        title: { en: "Language & appearance", de: "Sprache & Aussehen" },
        bullets: [
          {
            en: "Language switches labels instantly; theme and accent change visuals without touching your data.",
            de: "Sprache schaltet Labels sofort um; Theme und Accent aendern die Optik ohne deine Daten zu veraendern.",
          },
        ],
      },
      {
        id: "settings-persistence",
        title: { en: "Persistence", de: "Persistenz" },
        bullets: [
          {
            en: "All settings and tool options are saved automatically and restored after restart.",
            de: "Alle Einstellungen und Tool-Optionen werden automatisch gespeichert und nach Neustart wiederhergestellt.",
          },
        ],
      },
    ],
  },
  {
    id: "advanced",
    title: { en: "More settings / Advanced", de: "Weitere Einstellungen / Advanced" },
    summary: {
      en: "Performance, layout tweaks, and power options for heavier vaults or personal preferences.",
      de: "Performance, Layout-Anpassungen und Power-Optionen fuer groessere Vaults oder persoenliche Vorlieben.",
    },
    sections: [
      {
        id: "advanced-performance",
        title: { en: "Performance", de: "Performance" },
        bullets: [
          {
            en: "Max files per scan and scan parallelism limit how much is indexed at once; lower values can reduce load.",
            de: "Max Files pro Scan und Scan-Parallelism begrenzen die Indexierung; kleinere Werte entlasten das System.",
          },
        ],
      },
      {
        id: "advanced-layout",
        title: { en: "Layout", de: "Layout" },
        bullets: [
          {
            en: "The right toolbar can be collapsed and restored with the FMD toggle to free screen space.",
            de: "Die rechte Toolbar laesst sich ueber den FMD-Schalter einklappen, um mehr Platz zu schaffen.",
          },
        ],
      },
      {
        id: "advanced-data",
        title: { en: "Data & Sync", de: "Data & Sync" },
        bullets: [
          {
            en: "Data & Sync collects storage-related options; some items may be placeholders depending on the build.",
            de: "Data & Sync enthaelt Speicher-Optionen; einige Punkte koennen je nach Build Platzhalter sein.",
          },
        ],
      },
    ],
  },
  {
    id: "vault",
    title: { en: "Load a vault", de: "Vault laden" },
    summary: {
      en: "Select a vault, confirm permissions, and troubleshoot common issues when lists stay empty.",
      de: "Vault auswaehlen, Berechtigungen bestaetigen und typische Probleme bei leeren Listen beheben.",
    },
    sections: [
      {
        id: "vault-select",
        title: { en: "Select a vault", de: "Vault auswaehlen" },
        bullets: [
          {
            en: "Use Makedon to choose a folder and allow access when prompted; confirm the correct path.",
            de: "In Makedon einen Ordner waehlen und Zugriff erlauben; den richtigen Pfad bestaetigen.",
          },
          {
            en: "After loading, pick a note to preview and scan so cards populate the tools.",
            de: "Nach dem Laden eine Notiz waehlen, Vorschau pruefen und scannen, damit Karten geladen werden.",
          },
        ],
      },
      {
        id: "vault-issues",
        title: { en: "Common issues", de: "Haeufige Probleme" },
        bullets: [
          {
            en: "Missing permissions can block the file list or previews; re-approve access if needed.",
            de: "Fehlende Berechtigungen blockieren Dateiliste oder Vorschau; Zugriff ggf. erneut erlauben.",
          },
          {
            en: "If the list is empty, verify the path, markdown file types, and any active filters.",
            de: "Bei leerer Liste Pfad, Markdown-Dateien und aktive Filter pruefen.",
          },
          {
            en: "If the vault moved, reselect it in Makedon and scan again.",
            de: "Wenn der Vault verschoben wurde, neu in Makedon auswaehlen und erneut scannen.",
          },
        ],
      },
    ],
  },
  {
    id: "extras",
    title: { en: "Additional features", de: "Weitere Funktionsbereiche" },
    summary: {
      en: "Focus mode, shortcuts, and optional tooling to speed up review and reduce distractions.",
      de: "Fokusmodus, Shortcuts und optionale Funktionen fuer schnelleres Review und weniger Ablenkung.",
    },
    sections: [
      {
        id: "extras-focus",
        title: { en: "Focus mode", de: "Fokusmodus" },
        bullets: [
          {
            en: "Use the eye icon to focus on the card and hide the rest of the UI for distraction-free review.",
            de: "Mit dem Auge-Icon nur die Karte anzeigen und den Rest fuer konzentriertes Review ausblenden.",
          },
          {
            en: "Press Esc to exit focus mode and restore the full layout.",
            de: "Mit Esc den Fokusmodus verlassen und das volle Layout wiederherstellen.",
          },
        ],
      },
      {
        id: "extras-shortcuts",
        title: { en: "Shortcuts", de: "Shortcuts" },
        bullets: [
          {
            en: "In focus mode: Left/Right for Back/Next, Enter to submit when possible, keeping hands on the keyboard.",
            de: "Im Fokusmodus: Links/Rechts fuer Zurueck/Weiter, Enter zum Abgeben; Haende bleiben auf der Tastatur.",
          },
          {
            en: "Shortcuts are ignored while typing in inputs to avoid accidental submissions.",
            de: "Shortcuts werden in Eingabefeldern ignoriert, um Fehlklicks zu vermeiden.",
          },
        ],
      },
      {
        id: "extras-import",
        title: { en: "Import / Export", de: "Import / Export" },
        bullets: [
          {
            en: "If available, use Data & Sync to manage exports; otherwise it is coming later and not yet wired.",
            de: "Falls vorhanden, ueber Data & Sync exportieren; sonst Coming Later und noch nicht verfuegbar.",
          },
        ],
      },
    ],
  },
];

---

## 📝 types.ts — ./pages/help/content/types.ts

export type AppLanguage = "de" | "en";
export type LocalizedText = { de?: string; en?: string };

export type HelpExample = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  code: string;
};

export type SyntaxDetail = {
  whatItIs: string;
  rules: string[];
  rulesNote?: string;
  promptTemplate: string;
  example: string;
  mistakes?: string[];
};

export type SyntaxEntry = {
  id: string;
  title: LocalizedText;
  markers: string[];
  keyRule: LocalizedText;
  snippet?: LocalizedText;
  detail: { en: SyntaxDetail; de: SyntaxDetail };
};

export type HelpSection = {
  id: string;
  title: LocalizedText;
  bullets?: LocalizedText[];
  examples?: HelpExample[];
  tone?: "help-block";
};

export type HelpTopic = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  sections: HelpSection[];
  draft?: boolean;
  icon?: string;
};

export type AppSectionId =
  | "dashboard"
  | "flashcard"
  | "fast-flashcard"
  | "spaced-repetition";

export type AppSectionDetail = {
  whatIs: LocalizedText;
  purpose: LocalizedText[];
  whatYouSee: LocalizedText;
  workflow: LocalizedText;
  showCards: LocalizedText;
  tips?: LocalizedText;
};

export type AppSectionData = {
  title: LocalizedText;
  summary: LocalizedText;
  action: LocalizedText;
  detail: AppSectionDetail;
};

---

## 📝 helpContent.ts — ./pages/help/helpContent.ts

export * from "./content/types";
export * from "./content/i18n";
export * from "./content/labels";
export * from "./content/topics";
export * from "./content/appSections";
export * from "./content/syntax/overview";
export * from "./content/syntax/entries";

---

## 📝 AppSectionsGuidePanel.tsx — ./pages/help/sections/AppSectionsGuidePanel.tsx

import { useEffect, useState } from "react";
import {
  APP_SECTION_DATA,
  APP_SECTION_GROUND_RULES,
  APP_SECTION_LABELS,
  APP_SECTION_ORDER,
  AppLanguage,
  AppSectionId,
  resolveText,
} from "../helpContent";

type AppSectionsGuidePanelProps = {
  language: AppLanguage;
};

export const AppSectionsGuidePanel = ({ language }: AppSectionsGuidePanelProps) => {
  const [selectedSectionId, setSelectedSectionId] =
    useState<AppSectionId>("dashboard");
  const [sectionLanguage, setSectionLanguage] = useState<AppLanguage>(language);
  const selectedSection = APP_SECTION_DATA[selectedSectionId];

  useEffect(() => {
    setSectionLanguage(language);
  }, [language]);

  return (
    <div className="help-detail-sections">
      <div className="help-detail-section help-block">
        <div className="help-item-header">
          <span className="help-block-title">
            {resolveText(APP_SECTION_LABELS.groundRulesTitle, sectionLanguage)}
          </span>
        </div>
        <p className="help-syntax-text">
          {resolveText(APP_SECTION_GROUND_RULES.paragraph, sectionLanguage)}
        </p>
        <ul className="help-list">
          {APP_SECTION_GROUND_RULES.bullets.map((bullet, index) => (
            <li key={`ground-${index}`}>
              {resolveText(bullet, sectionLanguage)}
            </li>
          ))}
        </ul>
      </div>
      <div className="help-syntax-layout">
        <div className="help-syntax-cards" role="tablist">
          {APP_SECTION_ORDER.map((sectionId) => {
            const section = APP_SECTION_DATA[sectionId];
            const isActive = selectedSectionId === sectionId;
            return (
              <button
                key={sectionId}
                type="button"
                className={`help-syntax-card${isActive ? " active" : ""}`}
                onClick={() => setSelectedSectionId(sectionId)}
                role="tab"
                aria-selected={isActive}
              >
                <div className="help-syntax-card-title">
                  {resolveText(section.title, sectionLanguage)}
                </div>
                <div className="help-syntax-card-meta">
                  <span className="help-syntax-card-label">
                    {resolveText(
                      APP_SECTION_LABELS.typicalAction,
                      sectionLanguage,
                    )}
                  </span>
                  <span>{resolveText(section.action, sectionLanguage)}</span>
                </div>
                <div className="help-syntax-card-rule">
                  {resolveText(section.summary, sectionLanguage)}
                </div>
              </button>
            );
          })}
        </div>
        <div className="help-syntax-detail">
          <div className="help-syntax-detail-header">
            <div className="help-syntax-detail-title">
              {resolveText(selectedSection.title, sectionLanguage)}
            </div>
            <div className="help-syntax-lang-tabs">
              <button
                type="button"
                className={`help-syntax-lang${
                  sectionLanguage === "en" ? " active" : ""
                }`}
                onClick={() => setSectionLanguage("en")}
              >
                EN
              </button>
              <button
                type="button"
                className={`help-syntax-lang${
                  sectionLanguage === "de" ? " active" : ""
                }`}
                onClick={() => setSectionLanguage("de")}
              >
                DE
              </button>
            </div>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">
                {resolveText(APP_SECTION_LABELS.whatIs, sectionLanguage)}
              </span>
            </div>
            <p className="help-syntax-text">
              {resolveText(selectedSection.detail.whatIs, sectionLanguage)}
            </p>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">
                {resolveText(APP_SECTION_LABELS.purpose, sectionLanguage)}
              </span>
            </div>
            <ul className="help-syntax-list">
              {selectedSection.detail.purpose.map((item, index) => (
                <li key={`${selectedSectionId}-purpose-${index}`}>
                  {resolveText(item, sectionLanguage)}
                </li>
              ))}
            </ul>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">
                {resolveText(APP_SECTION_LABELS.whatYouSee, sectionLanguage)}
              </span>
            </div>
            <p className="help-syntax-text">
              {resolveText(selectedSection.detail.whatYouSee, sectionLanguage)}
            </p>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">
                {resolveText(APP_SECTION_LABELS.showCards, sectionLanguage)}
              </span>
            </div>
            <p className="help-syntax-text">
              {resolveText(selectedSection.detail.showCards, sectionLanguage)}
            </p>
          </div>
          {selectedSection.detail.tips ? (
            <div className="help-syntax-section">
              <div className="help-syntax-section-header">
                <span className="label">
                  {resolveText(APP_SECTION_LABELS.tips, sectionLanguage)}
                </span>
              </div>
              <p className="help-syntax-text">
                {resolveText(selectedSection.detail.tips, sectionLanguage)}
              </p>
            </div>
          ) : null}
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">
                {resolveText(APP_SECTION_LABELS.workflow, sectionLanguage)}
              </span>
            </div>
            <p className="help-syntax-text">
              {resolveText(selectedSection.detail.workflow, sectionLanguage)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

---

## 📝 HelpDetailSection.tsx — ./pages/help/sections/HelpDetailSection.tsx

import { AppLanguage, HelpTopic, SyntaxEntry, helpLabels, resolveText } from "../helpContent";
import { AppSectionsGuidePanel } from "./AppSectionsGuidePanel";
import { HelpTopicSections } from "./HelpTopicSections";
import { SyntaxSection } from "./SyntaxSection";

type HelpDetailSectionProps = {
  titleText: string;
  activeTopic: HelpTopic;
  language: AppLanguage;
  isSyntaxTopic: boolean;
  isAppSectionsTopic: boolean;
  activeSyntax: SyntaxEntry | null;
  setActiveTopicId: (value: string | null) => void;
  setActiveSyntaxId: (value: string | null) => void;
  syntaxLanguage: AppLanguage;
  setSyntaxLanguage: (value: AppLanguage) => void;
  copyLabel: string;
  copiedLabel: string;
  copiedItemId: string | null;
  handleCopy: (text: string, copyId: string) => void;
  overviewBullets: string[];
  syntaxCopyExampleLabel: string;
  syntaxCopyPromptLabel: string;
  syntaxCopiedLabel: string;
  syntaxPromptLabel: string;
  syntaxExampleLabel: string;
  syntaxRulesLabel: string;
  syntaxWhatItIsLabel: string;
  syntaxMistakesLabel: string;
  syntaxMarkersLabel: string;
};

export const HelpDetailSection = ({
  titleText,
  activeTopic,
  language,
  isSyntaxTopic,
  isAppSectionsTopic,
  activeSyntax,
  setActiveTopicId,
  setActiveSyntaxId,
  syntaxLanguage,
  setSyntaxLanguage,
  copyLabel,
  copiedLabel,
  copiedItemId,
  handleCopy,
  overviewBullets,
  syntaxCopyExampleLabel,
  syntaxCopyPromptLabel,
  syntaxCopiedLabel,
  syntaxPromptLabel,
  syntaxExampleLabel,
  syntaxRulesLabel,
  syntaxWhatItIsLabel,
  syntaxMistakesLabel,
  syntaxMarkersLabel,
}: HelpDetailSectionProps) => (
  <>
    <div className="help-detail-header">
      <div className="help-breadcrumb">
        <span>{titleText}</span>
        <span className="help-crumb-sep">&gt;</span>
        <span className="help-breadcrumb-current">
          {resolveText(activeTopic.title, language)}
        </span>
        {isSyntaxTopic && activeSyntax ? (
          <>
            <span className="help-crumb-sep">&gt;</span>
            <span className="help-breadcrumb-current help-breadcrumb-leaf">
              {resolveText(activeSyntax.title, syntaxLanguage)}
            </span>
          </>
        ) : null}
        {activeTopic.draft ? (
          <span className="chip">{resolveText(helpLabels.draft, language)}</span>
        ) : null}
      </div>
      <button
        type="button"
        className="ghost small"
        onClick={() => setActiveTopicId(null)}
      >
        {resolveText(helpLabels.back, language)}
      </button>
    </div>
    <p className="muted">{resolveText(activeTopic.summary, language)}</p>
    {isSyntaxTopic ? (
      <SyntaxSection
        overviewBullets={overviewBullets}
        activeSyntax={activeSyntax}
        syntaxLanguage={syntaxLanguage}
        setActiveSyntaxId={setActiveSyntaxId}
        setSyntaxLanguage={setSyntaxLanguage}
        handleCopy={handleCopy}
        copiedItemId={copiedItemId}
        syntaxCopyExampleLabel={syntaxCopyExampleLabel}
        syntaxCopyPromptLabel={syntaxCopyPromptLabel}
        syntaxCopiedLabel={syntaxCopiedLabel}
        syntaxPromptLabel={syntaxPromptLabel}
        syntaxExampleLabel={syntaxExampleLabel}
        syntaxRulesLabel={syntaxRulesLabel}
        syntaxWhatItIsLabel={syntaxWhatItIsLabel}
        syntaxMistakesLabel={syntaxMistakesLabel}
        syntaxMarkersLabel={syntaxMarkersLabel}
      />
    ) : isAppSectionsTopic ? (
      <AppSectionsGuidePanel language={language} />
    ) : (
      <HelpTopicSections
        activeTopic={activeTopic}
        language={language}
        copiedItemId={copiedItemId}
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
        handleCopy={handleCopy}
      />
    )}
  </>
);

---

## 📝 HelpHeaderSection.tsx — ./pages/help/sections/HelpHeaderSection.tsx

type HelpHeaderSectionProps = {
  eyebrowText: string;
  titleText: string;
  summaryText: string;
};

export const HelpHeaderSection = ({
  eyebrowText,
  titleText,
  summaryText,
}: HelpHeaderSectionProps) => (
  <header className="content-header">
    <div>
      <p className="eyebrow">{eyebrowText}</p>
      <h1>{titleText}</h1>
      <p className="muted">{summaryText}</p>
    </div>
  </header>
);

---

## 📝 HelpOverviewSection.tsx — ./pages/help/sections/HelpOverviewSection.tsx

import { AppLanguage, HelpTopic, helpLabels, resolveText } from "../helpContent";

type HelpOverviewSectionProps = {
  helpTopics: HelpTopic[];
  language: AppLanguage;
  setActiveTopicId: (value: string | null) => void;
};

export const HelpOverviewSection = ({
  helpTopics,
  language,
  setActiveTopicId,
}: HelpOverviewSectionProps) => (
  <div className="help-overview-grid">
    {helpTopics.map((topic) => (
      <button
        key={topic.id}
        type="button"
        className="help-topic-card"
        aria-label={`${resolveText(helpLabels.openTopic, language)}: ${resolveText(
          topic.title,
          language,
        )}`}
        onClick={() => setActiveTopicId(topic.id)}
      >
        {topic.icon ? <span className="help-topic-icon">{topic.icon}</span> : null}
        <div className="help-topic-content">
          <div className="help-topic-title">{resolveText(topic.title, language)}</div>
          <div className="help-topic-summary">
            {resolveText(topic.summary, language)}
          </div>
        </div>
        {topic.draft ? (
          <span className="chip">
            {resolveText(helpLabels.draft, language)}
          </span>
        ) : null}
        <span className="help-topic-arrow">&gt;</span>
      </button>
    ))}
  </div>
);

---

## 📝 HelpTopicHeadingsBlock.tsx — ./pages/help/sections/HelpTopicHeadingsBlock.tsx

import { AppLanguage, HelpTopic, resolveText } from "../helpContent";

type HelpTopicHeadingsBlockProps = {
  helpTopics: HelpTopic[];
  language: AppLanguage;
  activeTopicId: string;
  setActiveTopicId: (value: string | null) => void;
};

export const HelpTopicHeadingsBlock = ({
  helpTopics,
  language,
  activeTopicId,
  setActiveTopicId,
}: HelpTopicHeadingsBlockProps) => (
  <div className="pill-grid">
    {helpTopics.map((topic) => (
      <button
        key={topic.id}
        type="button"
        className={`pill pill-button${activeTopicId === topic.id ? " active" : ""}`}
        aria-pressed={activeTopicId === topic.id}
        onClick={() => setActiveTopicId(topic.id)}
      >
        {resolveText(topic.title, language)}
      </button>
    ))}
  </div>
);

---

## 📝 HelpTopicSections.tsx — ./pages/help/sections/HelpTopicSections.tsx

import {
  AppLanguage,
  HelpTopic,
  resolveList,
  resolveText,
} from "../helpContent";

type HelpTopicSectionsProps = {
  activeTopic: HelpTopic;
  language: AppLanguage;
  copiedItemId: string | null;
  copyLabel: string;
  copiedLabel: string;
  handleCopy: (text: string, copyId: string) => void;
};

export const HelpTopicSections = ({
  activeTopic,
  language,
  copiedItemId,
  copyLabel,
  copiedLabel,
  handleCopy,
}: HelpTopicSectionsProps) => (
  <div className="help-detail-sections">
    {activeTopic.sections.map((section) => {
      const bullets = resolveList(section.bullets, language);
      const examples = section.examples ?? [];
      const sectionLabelClass =
        section.tone === "help-block" ? "help-block-title" : "label";
      const sectionClassName =
        section.tone === "help-block"
          ? "help-detail-section help-block"
          : "help-detail-section";
      return (
        <div key={section.id} className={sectionClassName}>
          <div className="help-item-header">
            <span className={sectionLabelClass}>
              {resolveText(section.title, language)}
            </span>
          </div>
          {bullets.length > 0 ? (
            <ul className="help-list">
              {bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {examples.length > 0 ? (
            <div className="help-examples">
              {examples.map((example) => {
                const exampleTitle = resolveText(example.title, language);
                const exampleDescription = resolveText(
                  example.description,
                  language,
                );
                const copyId = `example-${example.id}`;
                const isCopied = copiedItemId === copyId;
                return (
                  <div key={example.id} className="help-example">
                    <div className="help-example-header">
                      <div className="help-example-text">
                        <div className="help-example-title">{exampleTitle}</div>
                        {exampleDescription ? (
                          <p className="help-example-description">
                            {exampleDescription}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="ghost small help-copy"
                        onClick={() => handleCopy(example.code, copyId)}
                        aria-label={`${copyLabel}: ${exampleTitle}`}
                      >
                        {isCopied ? copiedLabel : copyLabel}
                      </button>
                    </div>
                    <pre className="help-code">{example.code}</pre>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    })}
  </div>
);

---

## 📝 SyntaxSection.tsx — ./pages/help/sections/SyntaxSection.tsx

import {
  AppLanguage,
  SyntaxEntry,
  flashcardSyntaxEntries,
  flashcardSyntaxOverview,
  resolveText,
} from "../helpContent";

type SyntaxSectionProps = {
  overviewBullets: string[];
  activeSyntax: SyntaxEntry | null;
  syntaxLanguage: AppLanguage;
  setActiveSyntaxId: (value: string | null) => void;
  setSyntaxLanguage: (value: AppLanguage) => void;
  handleCopy: (text: string, copyId: string) => void;
  copiedItemId: string | null;
  syntaxCopyExampleLabel: string;
  syntaxCopyPromptLabel: string;
  syntaxCopiedLabel: string;
  syntaxPromptLabel: string;
  syntaxExampleLabel: string;
  syntaxRulesLabel: string;
  syntaxWhatItIsLabel: string;
  syntaxMistakesLabel: string;
  syntaxMarkersLabel: string;
};

export const SyntaxSection = ({
  overviewBullets,
  activeSyntax,
  syntaxLanguage,
  setActiveSyntaxId,
  setSyntaxLanguage,
  handleCopy,
  copiedItemId,
  syntaxCopyExampleLabel,
  syntaxCopyPromptLabel,
  syntaxCopiedLabel,
  syntaxPromptLabel,
  syntaxExampleLabel,
  syntaxRulesLabel,
  syntaxWhatItIsLabel,
  syntaxMistakesLabel,
  syntaxMarkersLabel,
}: SyntaxSectionProps) => (
  <div className="help-detail-sections">
    <div className="help-detail-section help-block">
      <div className="help-item-header">
        <span className="help-block-title">
          {resolveText(flashcardSyntaxOverview.title, syntaxLanguage)}
        </span>
      </div>
      {overviewBullets.length > 0 ? (
        <ul className="help-list">
          {overviewBullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
    <div className="help-syntax-layout">
      <div className="help-syntax-cards" role="tablist">
        {flashcardSyntaxEntries.map((entry) => {
          const isActive = entry.id === activeSyntax?.id;
          const entryTitle = resolveText(entry.title, syntaxLanguage);
          const entrySnippet = entry.snippet
            ? resolveText(entry.snippet, syntaxLanguage)
            : "";
          return (
            <button
              key={entry.id}
              type="button"
              className={`help-syntax-card${isActive ? " active" : ""}`}
              onClick={() => setActiveSyntaxId(entry.id)}
              role="tab"
              aria-selected={isActive}
            >
              <div className="help-syntax-card-title">{entryTitle}</div>
              <div className="help-syntax-card-meta">
                <span className="help-syntax-card-label">{syntaxMarkersLabel}</span>
                <div className="help-syntax-token-list">
                  {entry.markers.map((marker) => (
                    <span key={marker} className="help-syntax-token">
                      {marker}
                    </span>
                  ))}
                </div>
              </div>
              <div className="help-syntax-card-rule">
                {resolveText(entry.keyRule, syntaxLanguage)}
              </div>
              {entrySnippet ? (
                <pre className="help-syntax-snippet">{entrySnippet}</pre>
              ) : null}
            </button>
          );
        })}
      </div>
      {activeSyntax ? (
        <div className="help-syntax-detail">
          <div className="help-syntax-detail-header">
            <div className="help-syntax-detail-title">
              {resolveText(activeSyntax.title, syntaxLanguage)}
            </div>
            <div className="help-syntax-lang-tabs">
              <button
                type="button"
                className={`help-syntax-lang${
                  syntaxLanguage === "en" ? " active" : ""
                }`}
                onClick={() => setSyntaxLanguage("en")}
              >
                EN
              </button>
              <button
                type="button"
                className={`help-syntax-lang${
                  syntaxLanguage === "de" ? " active" : ""
                }`}
                onClick={() => setSyntaxLanguage("de")}
              >
                DE
              </button>
            </div>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">{syntaxWhatItIsLabel}</span>
            </div>
            <p className="help-syntax-text">
              {activeSyntax.detail[syntaxLanguage].whatItIs}
            </p>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">{syntaxRulesLabel}</span>
            </div>
            {activeSyntax.detail[syntaxLanguage].rulesNote ? (
              <p className="help-syntax-text">
                {activeSyntax.detail[syntaxLanguage].rulesNote}
              </p>
            ) : null}
            <ul className="help-syntax-list">
              {activeSyntax.detail[syntaxLanguage].rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">{syntaxPromptLabel}</span>
              <button
                type="button"
                className="ghost small help-copy"
                onClick={() =>
                  handleCopy(
                    activeSyntax.detail[syntaxLanguage].promptTemplate,
                    `syntax-prompt-${activeSyntax.id}-${syntaxLanguage}`,
                  )
                }
                aria-label={`${syntaxCopyPromptLabel}: ${resolveText(
                  activeSyntax.title,
                  syntaxLanguage,
                )}`}
              >
                {copiedItemId ===
                `syntax-prompt-${activeSyntax.id}-${syntaxLanguage}`
                  ? syntaxCopiedLabel
                  : syntaxCopyPromptLabel}
              </button>
            </div>
            <pre className="help-code">
              {activeSyntax.detail[syntaxLanguage].promptTemplate}
            </pre>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">{syntaxExampleLabel}</span>
              <button
                type="button"
                className="ghost small help-copy"
                onClick={() =>
                  handleCopy(
                    activeSyntax.detail[syntaxLanguage].example,
                    `syntax-example-${activeSyntax.id}-${syntaxLanguage}`,
                  )
                }
                aria-label={`${syntaxCopyExampleLabel}: ${resolveText(
                  activeSyntax.title,
                  syntaxLanguage,
                )}`}
              >
                {copiedItemId ===
                `syntax-example-${activeSyntax.id}-${syntaxLanguage}`
                  ? syntaxCopiedLabel
                  : syntaxCopyExampleLabel}
              </button>
            </div>
            <pre className="help-code">
              {activeSyntax.detail[syntaxLanguage].example}
            </pre>
          </div>
          {activeSyntax.detail[syntaxLanguage].mistakes?.length ? (
            <div className="help-syntax-section">
              <div className="help-syntax-section-header">
                <span className="label">{syntaxMistakesLabel}</span>
              </div>
              <ul className="help-syntax-list">
                {activeSyntax.detail[syntaxLanguage].mistakes?.map((mistake) => (
                  <li key={mistake}>{mistake}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  </div>
);

---

## 📝 HelpPage.tsx — ./pages/HelpPage.tsx

import { useEffect, useRef, useState } from "react";
import { useAppState } from "../components/AppStateProvider";
import {
  AppLanguage,
  flashcardSyntaxEntries,
  flashcardSyntaxOverview,
  helpHeader,
  helpLabels,
  helpTopics,
  resolveList,
  resolveText,
} from "./help/helpContent";
import { HelpDetailSection } from "./help/sections/HelpDetailSection";
import { HelpHeaderSection } from "./help/sections/HelpHeaderSection";
import { HelpOverviewSection } from "./help/sections/HelpOverviewSection";
import { HelpTopicHeadingsBlock } from "./help/sections/HelpTopicHeadingsBlock";

export const HelpPage = () => {
  const { help, settings } = useAppState();
  const { activeTopicId, setActiveTopicId } = help;
  const [activeSyntaxId, setActiveSyntaxId] = useState<string | null>(
    flashcardSyntaxEntries[0]?.id ?? null,
  );
  const [syntaxLanguage, setSyntaxLanguage] = useState<AppLanguage>(
    settings.language,
  );
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const language = settings.language;
  const activeTopic = helpTopics.find((topic) => topic.id === activeTopicId) ?? null;
  const isSyntaxTopic = activeTopic?.id === "flashcard-syntax";
  const isAppSectionsTopic = activeTopic?.id === "app-sections";
  const activeSyntax =
    flashcardSyntaxEntries.find((entry) => entry.id === activeSyntaxId) ??
    flashcardSyntaxEntries[0] ??
    null;

  const titleText = resolveText(helpHeader.title, language);
  const eyebrowText = resolveText(helpHeader.eyebrow, language);
  const summaryText = resolveText(helpHeader.summary, language);

  const copyLabel = resolveText(helpLabels.copy, language);
  const copiedLabel = resolveText(helpLabels.copied, language);
  const syntaxCopyExampleLabel = resolveText(
    helpLabels.copyExample,
    syntaxLanguage,
  );
  const syntaxCopyPromptLabel = resolveText(helpLabels.copyPrompt, syntaxLanguage);
  const syntaxCopiedLabel = resolveText(helpLabels.copied, syntaxLanguage);
  const syntaxPromptLabel = resolveText(helpLabels.promptTemplate, syntaxLanguage);
  const syntaxExampleLabel = resolveText(helpLabels.example, syntaxLanguage);
  const syntaxRulesLabel = resolveText(helpLabels.rules, syntaxLanguage);
  const syntaxWhatItIsLabel = resolveText(helpLabels.whatItIs, syntaxLanguage);
  const syntaxMistakesLabel = resolveText(helpLabels.mistakes, syntaxLanguage);
  const syntaxMarkersLabel = resolveText(helpLabels.markers, syntaxLanguage);
  const overviewBullets = resolveList(
    flashcardSyntaxOverview.bullets,
    syntaxLanguage,
  );

  const handleCopy = async (text: string, copyId: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedItemId(copyId);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedItemId(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy example", error);
    }
  };

  useEffect(() => {
    if (activeTopicId !== "flashcard-syntax") {
      return;
    }
    setActiveSyntaxId((prev) => {
      if (prev && flashcardSyntaxEntries.some((entry) => entry.id === prev)) {
        return prev;
      }
      return flashcardSyntaxEntries[0]?.id ?? null;
    });
    setSyntaxLanguage(settings.language);
  }, [activeTopicId, settings.language]);

  useEffect(() => {
    if (!activeTopicId) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setActiveTopicId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTopicId]);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  return (
    <>
      <HelpHeaderSection
        eyebrowText={eyebrowText}
        titleText={titleText}
        summaryText={summaryText}
      />
      <section className="panel help-panel">
        <div className="panel-body help-body">
          {activeTopic ? (
            <>
              <HelpTopicHeadingsBlock
                helpTopics={helpTopics}
                language={language}
                activeTopicId={activeTopic.id}
                setActiveTopicId={setActiveTopicId}
              />
              <HelpDetailSection
                titleText={titleText}
                activeTopic={activeTopic}
                language={language}
                isSyntaxTopic={isSyntaxTopic}
                isAppSectionsTopic={isAppSectionsTopic}
                activeSyntax={activeSyntax}
                setActiveTopicId={setActiveTopicId}
                setActiveSyntaxId={setActiveSyntaxId}
                syntaxLanguage={syntaxLanguage}
                setSyntaxLanguage={setSyntaxLanguage}
                copyLabel={copyLabel}
                copiedLabel={copiedLabel}
                copiedItemId={copiedItemId}
                handleCopy={handleCopy}
                overviewBullets={overviewBullets}
                syntaxCopyExampleLabel={syntaxCopyExampleLabel}
                syntaxCopyPromptLabel={syntaxCopyPromptLabel}
                syntaxCopiedLabel={syntaxCopiedLabel}
                syntaxPromptLabel={syntaxPromptLabel}
                syntaxExampleLabel={syntaxExampleLabel}
                syntaxRulesLabel={syntaxRulesLabel}
                syntaxWhatItIsLabel={syntaxWhatItIsLabel}
                syntaxMistakesLabel={syntaxMistakesLabel}
                syntaxMarkersLabel={syntaxMarkersLabel}
              />
            </>
          ) : (
            <HelpOverviewSection
              helpTopics={helpTopics}
              language={language}
              setActiveTopicId={setActiveTopicId}
            />
          )}
        </div>
      </section>
    </>
  );
};

---

## 📝 SettingsPage.tsx — ./pages/SettingsPage.tsx

import { useCallback, useMemo, useState } from "react";
import { useAppState } from "../components/AppStateProvider";
import { AppearanceSection } from "../components/settings/AppearanceSection";
import { FlashcardsSettingsSection } from "../components/settings/FlashcardsSettingsSection";
import { ResetSessionHistoryModal } from "../components/settings/ResetSessionHistoryModal";
import { LanguageTabContent } from "../components/settings/DataSyncTabContent";
import { PerformanceTabContent } from "../components/settings/PerformanceTabContent";
import { SpacedRepetitionSettingsSection } from "../components/settings/SpacedRepetitionSettingsSection";
import { VaultIndexSection } from "../components/settings/VaultIndexSection";
import { FAST_FLASHCARD_DURATIONS } from "../features/fast-flashcard/constants";
import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards";
import {
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
} from "../features/spaced-repetition/useSpacedRepetition";
import { resetFastFlashcardHistory } from "./fast-flashcard/hooks/useFastSession";

export const SettingsPage = () => {
  const {
    actions,
    flashcards,
    preview,
    settings,
    settingsNav,
    spacedRepetition,
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
  const { activeSettingsPage } = settingsNav;

  const handleResetHistoryConfirm = useCallback(async () => {
    setIsResetHistoryPending(true);
    const success = await resetFastFlashcardHistory();
    setIsResetHistoryPending(false);
    if (success) {
      setIsResetHistoryOpen(false);
    }
  }, [setIsResetHistoryOpen, resetFastFlashcardHistory]);

  return (
    <>
      <header className="content-header">
        <div>
          <p className="eyebrow">SETTINGS</p>
          <h1>Settings</h1>
          <p className="muted">
            Adjust your workflow. The next features build on this vault foundation.
          </p>
        </div>
        <div className="actions">
          <button type="button" className="primary" onClick={actions.handlePickVault}>
            Vault auswaehlen
          </button>
        </div>
      </header>
      {activeSettingsPage === "app-settings" ? (
        <div className="settings-page settings-app-grid" id="settings-page-app-settings">
          <VaultIndexSection
            lastOpenedFile={lastOpenedFile}
            listState={vault.listState}
            onCopyVaultPath={actions.handleCopyVaultPath}
            onRescanVault={actions.handleRescanVault}
            vaultIndexedComplete={vaultIndexedComplete}
            vaultPath={vault.vaultPath}
          />
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
      ) : null}
      {activeSettingsPage === "review-tools" ? (
        <div className="settings-page settings-review-grid" id="settings-page-review-tools">
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
          />
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
          />
        </div>
      ) : null}
      {activeSettingsPage === "appearance" ? (
        <div className="settings-page settings-single-column" id="settings-page-appearance">
          <AppearanceSection
            accentColor={settings.accentColor}
            accentDraft={settings.accentDraft}
            accentError={settings.accentError}
            editorExactColors={settings.editorExactColors}
            editorBlueprintGrid={settings.editorBlueprintGrid}
            editorBlueprintGridIntensity={settings.editorBlueprintGridIntensity}
            onAccentInputChange={actions.handleAccentInputChange}
            onAccentPick={actions.handleAccentPick}
            onCopyAccent={actions.handleCopyAccent}
            onEditorExactColorsToggle={settings.setEditorExactColors}
            onEditorBlueprintGridToggle={settings.setEditorBlueprintGrid}
            onEditorBlueprintGridIntensityChange={
              settings.setEditorBlueprintGridIntensity
            }
            onThemeToggle={actions.handleThemeChange}
            theme={settings.theme}
          />
          <section className="panel settings-language-panel">
            <div className="panel-header">
              <div>
                <h2>Language</h2>
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
      ) : null}
      <ResetSessionHistoryModal
        isOpen={isResetHistoryOpen}
        isPending={isResetHistoryPending}
        onCancel={() => setIsResetHistoryOpen(false)}
        onConfirm={handleResetHistoryConfirm}
      />
    </>
  );
};

---

## 📝 SrBoxesPanel.tsx — ./pages/spaced-repetition/components/SrBoxesPanel.tsx

import type { CSSProperties } from "react";

type SrBoxesPanelProps = {
  spacedRepetitionBoxCounts: number[];
  maxBoxCount: number;
  activeBoxFilter: number | null;
  toggleBoxFilter: (boxNumber: number) => void;
};

export const SrBoxesPanel = ({
  spacedRepetitionBoxCounts,
  maxBoxCount,
  activeBoxFilter,
  toggleBoxFilter,
}: SrBoxesPanelProps) => (
  <div className="sr-box-chart">
    <div className="sr-box-chart-header">
      <span className="label">BOXES</span>
    </div>
    <div className="sr-box-chart-grid">
      {spacedRepetitionBoxCounts.map((count, index) => {
        const heightPercent =
          maxBoxCount > 0 ? Math.round((count / maxBoxCount) * 100) : 0;
        const barStyle = {
          "--bar-height": count > 0 ? `${Math.max(heightPercent, 6)}%` : "0%",
        } as CSSProperties;
        const boxNumber = index + 1;
        const isFilterActive = activeBoxFilter === boxNumber;

        return (
          <button
            key={`box-${boxNumber}`}
            type="button"
            className={`sr-box-column ${isFilterActive ? "active" : ""}`}
            aria-pressed={isFilterActive}
            onClick={() => toggleBoxFilter(boxNumber)}
          >
            <span className="sr-box-count">{count}</span>
            <div className="sr-box-bar" style={barStyle}>
              <div className="sr-box-bar-fill" />
            </div>
            <span className="sr-box-label">{boxNumber}</span>
          </button>
        );
      })}
    </div>
  </div>
);

---

## 📝 SrCardHost.tsx — ./pages/spaced-repetition/components/SrCardHost.tsx

import type { DragEvent } from "react";
import { ClozeCard } from "../../../components/flashcards/ClozeCard";
import { CompositeCard } from "../../../components/flashcards/CompositeCard";
import { FreeTextCard } from "../../../components/flashcards/FreeTextCard";
import { MultipleChoiceCard } from "../../../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../../../components/flashcards/TrueFalseCard";
import { SrReviewActions } from "./SrReviewActions";

type SrCardHostProps = {
  filteredFlashcardEntries: { card: any; cardIndex: number }[];
  showBoxEmptyMessage: boolean;
  activeBoxFilter: number | null;
  spacedRepetitionEmptyState: string;
  spacedRepetitionSubmissions: Record<number, boolean>;
  spacedRepetitionCompositeStates?: Record<number, any[]>;
  spacedRepetitionClozeResponses: Record<number, Record<string, string>>;
  spacedRepetitionTrueFalseSelections: Record<number, Record<string, any>>;
  spacedRepetitionTextResponses: Record<number, string>;
  spacedRepetitionTextRevealed: Record<number, boolean>;
  spacedRepetitionSelfGrades: Record<number, any>;
  spacedRepetitionSelections: Record<number, string[]>;
  handleCompositeOptionSelect: (cardIndex: number, partIndex: number, keys: string[]) => void;
  handleCompositeTrueFalseSelect: (
    cardIndex: number,
    partIndex: number,
    itemId: string,
    value: "wahr" | "falsch",
  ) => void;
  handleCompositeClozeInputChange: (
    cardIndex: number,
    partIndex: number,
    blankId: string,
    value: string,
  ) => void;
  handleCompositeClozeTokenDrop: (
    event: DragEvent<HTMLElement>,
    cardIndex: number,
    partIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  handleCompositeClozeTokenRemove: (
    cardIndex: number,
    partIndex: number,
    blankId: string,
  ) => void;
  handleCompositeTextInputChange: (
    cardIndex: number,
    partIndex: number,
    value: string,
  ) => void;
  handleCompositeTextCheck: (cardIndex: number, partIndex: number) => void;
  handleCompositeSelfGrade: (
    cardIndex: number,
    partIndex: number,
    grade: "correct" | "incorrect",
  ) => void;
  handleOptionSelect: (cardIndex: number, keys: string[]) => void;
  handleTrueFalseSelect: (
    cardIndex: number,
    itemId: string,
    value: "wahr" | "falsch",
  ) => void;
  handleClozeInputChange: (cardIndex: number, blankId: string, value: string) => void;
  handleClozeTokenDrop: (
    event: DragEvent<HTMLElement>,
    cardIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  handleClozeTokenRemove: (cardIndex: number, blankId: string) => void;
  handleTextInputChange: (cardIndex: number, value: string) => void;
  handleTextCheck: (cardIndex: number) => void;
  handleSelfGrade: (cardIndex: number, grade: "correct" | "incorrect") => void;
  handleSpacedRepetitionSubmit: (cardIndex: number, isFocusSubmit?: boolean) => void;
  handleClozeTokenDragStart: (event: DragEvent<HTMLElement>) => void;
  handleClozeBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  spacedRepetitionCanGoBack: boolean;
  spacedRepetitionCanGoNext: boolean;
  handleSpacedRepetitionPageBack: () => void;
  handleSpacedRepetitionPageNext: () => void;
};

export const SrCardHost = ({
  filteredFlashcardEntries,
  showBoxEmptyMessage,
  activeBoxFilter,
  spacedRepetitionEmptyState,
  spacedRepetitionSubmissions,
  spacedRepetitionCompositeStates,
  spacedRepetitionClozeResponses,
  spacedRepetitionTrueFalseSelections,
  spacedRepetitionTextResponses,
  spacedRepetitionTextRevealed,
  spacedRepetitionSelfGrades,
  spacedRepetitionSelections,
  handleCompositeOptionSelect,
  handleCompositeTrueFalseSelect,
  handleCompositeClozeInputChange,
  handleCompositeClozeTokenDrop,
  handleCompositeClozeTokenRemove,
  handleCompositeTextInputChange,
  handleCompositeTextCheck,
  handleCompositeSelfGrade,
  handleOptionSelect,
  handleTrueFalseSelect,
  handleClozeInputChange,
  handleClozeTokenDrop,
  handleClozeTokenRemove,
  handleTextInputChange,
  handleTextCheck,
  handleSelfGrade,
  handleSpacedRepetitionSubmit,
  handleClozeTokenDragStart,
  handleClozeBlankDragOver,
  spacedRepetitionCanGoBack,
  spacedRepetitionCanGoNext,
  handleSpacedRepetitionPageBack,
  handleSpacedRepetitionPageNext,
}: SrCardHostProps) => (
  <div className="panel-body">
    {filteredFlashcardEntries.length === 0 ? (
      <div className="empty-state">
        {showBoxEmptyMessage
          ? `No cards currently in box ${activeBoxFilter}.`
          : spacedRepetitionEmptyState}
      </div>
    ) : (
      <div className="flashcard-list">
        {filteredFlashcardEntries.map(({ card, cardIndex }) => {
          const submitted = !!spacedRepetitionSubmissions[cardIndex];

          if (card.kind === "composite") {
            return (
              <CompositeCard
                key={`flashcard-${cardIndex}`}
                card={card}
                cardIndex={cardIndex}
                submitted={submitted}
                partStates={spacedRepetitionCompositeStates?.[cardIndex] ?? []}
                onOptionSelect={handleCompositeOptionSelect}
                onTrueFalseSelect={handleCompositeTrueFalseSelect}
                onClozeInputChange={handleCompositeClozeInputChange}
                onClozeTokenDrop={handleCompositeClozeTokenDrop}
                onClozeTokenRemove={handleCompositeClozeTokenRemove}
                onClozeTokenDragStart={handleClozeTokenDragStart}
                onBlankDragOver={handleClozeBlankDragOver}
                onTextInputChange={handleCompositeTextInputChange}
                onTextCheck={handleCompositeTextCheck}
                onSelfGrade={handleCompositeSelfGrade}
                onSubmit={handleSpacedRepetitionSubmit}
              />
            );
          }

          if (card.kind === "cloze") {
            return (
              <ClozeCard
                key={`flashcard-${cardIndex}`}
                card={card}
                cardIndex={cardIndex}
                submitted={submitted}
                responses={spacedRepetitionClozeResponses[cardIndex] ?? {}}
                onInputChange={handleClozeInputChange}
                onTokenDrop={handleClozeTokenDrop}
                onTokenRemove={handleClozeTokenRemove}
                onTokenDragStart={handleClozeTokenDragStart}
                onBlankDragOver={handleClozeBlankDragOver}
                onSubmit={handleSpacedRepetitionSubmit}
              />
            );
          }

          if (card.kind === "true-false") {
            return (
              <TrueFalseCard
                key={`flashcard-${cardIndex}`}
                card={card}
                cardIndex={cardIndex}
                submitted={submitted}
                selections={spacedRepetitionTrueFalseSelections[cardIndex] ?? {}}
                onSelect={handleTrueFalseSelect}
                onSubmit={handleSpacedRepetitionSubmit}
              />
            );
          }

          if (card.kind === "free-text") {
            return (
              <FreeTextCard
                key={`flashcard-${cardIndex}`}
                card={card}
                cardIndex={cardIndex}
                submitted={submitted}
                response={spacedRepetitionTextResponses[cardIndex] ?? ""}
                revealed={spacedRepetitionTextRevealed[cardIndex] ?? false}
                selfGrade={spacedRepetitionSelfGrades[cardIndex]}
                onInputChange={handleTextInputChange}
                onCheck={handleTextCheck}
                onSelfGrade={handleSelfGrade}
              />
            );
          }

          return (
            <MultipleChoiceCard
              key={`flashcard-${cardIndex}`}
              card={card}
              cardIndex={cardIndex}
              submitted={submitted}
              selectedKeys={spacedRepetitionSelections[cardIndex] ?? []}
              onSelect={handleOptionSelect}
              onSubmit={handleSpacedRepetitionSubmit}
            />
          );
        })}
      </div>
    )}
    <SrReviewActions
      spacedRepetitionCanGoBack={spacedRepetitionCanGoBack}
      spacedRepetitionCanGoNext={spacedRepetitionCanGoNext}
      handleSpacedRepetitionPageBack={handleSpacedRepetitionPageBack}
      handleSpacedRepetitionPageNext={handleSpacedRepetitionPageNext}
    />
  </div>
);

---

## 📝 SrDeleteModal.tsx — ./pages/spaced-repetition/components/SrDeleteModal.tsx

type SrDeleteModalProps = {
  isDeleteDialogOpen: boolean;
  deleteTargetName: string;
  deleteConfirmInput: string;
  setDeleteConfirmInput: (value: string) => void;
  handleDeleteCancel: () => void;
  handleDeleteConfirm: () => void;
  canConfirmDelete: boolean;
};

export const SrDeleteModal = ({
  isDeleteDialogOpen,
  deleteTargetName,
  deleteConfirmInput,
  setDeleteConfirmInput,
  handleDeleteCancel,
  handleDeleteConfirm,
  canConfirmDelete,
}: SrDeleteModalProps) =>
  isDeleteDialogOpen ? (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
      >
        <h3 id="delete-user-title">Delete user</h3>
        <p className="muted">
          This permanently deletes the user and all spaced repetition progress.
        </p>
        <div className="modal-body">
          <span className="label">Type {deleteTargetName} to confirm</span>
          <input
            type="text"
            className="text-input"
            value={deleteConfirmInput}
            onChange={(event) => setDeleteConfirmInput(event.target.value)}
            aria-label="Type the username to confirm deletion"
          />
          <span className="helper-text">
            Match is case-sensitive. Leading/trailing spaces are ignored.
          </span>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={handleDeleteCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleDeleteConfirm}
            disabled={!canConfirmDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  ) : null;

---

## 📝 SrHeader.tsx — ./pages/spaced-repetition/components/SrHeader.tsx

import type { Dispatch, SetStateAction } from "react";

type SrHeaderProps = {
  spacedRepetitionStatusLabel: string;
  isFocusMode: boolean;
  focusLabel: string;
  setIsFocusMode: Dispatch<SetStateAction<boolean>>;
};

export const SrHeader = ({
  spacedRepetitionStatusLabel,
  isFocusMode,
  focusLabel,
  setIsFocusMode,
}: SrHeaderProps) => (
  <div className="panel-header">
    <div>
      <h2>Flashcard</h2>
      <p className="muted">{spacedRepetitionStatusLabel}</p>
    </div>
    <div className="panel-actions">
      <button
        type="button"
        className={`focus-toggle ${isFocusMode ? "active" : ""}`}
        onClick={() => setIsFocusMode((prev) => !prev)}
        aria-pressed={isFocusMode}
        aria-label={focusLabel}
        title={focusLabel}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      </button>
    </div>
  </div>
);

---

## 📝 SrReviewActions.tsx — ./pages/spaced-repetition/components/SrReviewActions.tsx

type SrReviewActionsProps = {
  spacedRepetitionCanGoBack: boolean;
  spacedRepetitionCanGoNext: boolean;
  handleSpacedRepetitionPageBack: () => void;
  handleSpacedRepetitionPageNext: () => void;
};

export const SrReviewActions = ({
  spacedRepetitionCanGoBack,
  spacedRepetitionCanGoNext,
  handleSpacedRepetitionPageBack,
  handleSpacedRepetitionPageNext,
}: SrReviewActionsProps) => (
  <div className="flashcard-pagination">
    <button
      type="button"
      className="ghost small"
      onClick={handleSpacedRepetitionPageBack}
      disabled={!spacedRepetitionCanGoBack}
    >
      Back
    </button>
    <button
      type="button"
      className="ghost small"
      onClick={handleSpacedRepetitionPageNext}
      disabled={!spacedRepetitionCanGoNext}
    >
      Next
    </button>
  </div>
);

---

## 📝 SrStatsAndChart.tsx — ./pages/spaced-repetition/components/SrStatsAndChart.tsx

import type { CSSProperties } from "react";
import { buildLineChartPoints } from "../../../lib/chart";
import { type SpacedRepetitionStatsView } from "../../../features/spaced-repetition/useSpacedRepetition";
import { SrBoxesPanel } from "./SrBoxesPanel";

type SrStatsAndChartProps = {
  statsView: SpacedRepetitionStatsView;
  setSpacedRepetitionStatsView: (value: SpacedRepetitionStatsView) => void;
  spacedRepetitionBoxCounts: number[];
  maxBoxCount: number;
  activeBoxFilter: number | null;
  toggleBoxFilter: (boxNumber: number) => void;
  vaultName: string;
  vaultFilesCount: number;
  spacedRepetitionFlashcardsLength: number;
  spacedRepetitionCompletedChartData: number[];
  spacedRepetitionCompletedChartLabels: string[];
  statsChartClass: string;
  statsChartStyle: CSSProperties;
  spacedRepetitionCorrectCount: number;
  spacedRepetitionIncorrectCount: number;
  spacedRepetitionTotalQuestions: number;
};

export const SrStatsAndChart = ({
  statsView,
  setSpacedRepetitionStatsView,
  spacedRepetitionBoxCounts,
  maxBoxCount,
  activeBoxFilter,
  toggleBoxFilter,
  vaultName,
  vaultFilesCount,
  spacedRepetitionFlashcardsLength,
  spacedRepetitionCompletedChartData,
  spacedRepetitionCompletedChartLabels,
  statsChartClass,
  statsChartStyle,
  spacedRepetitionCorrectCount,
  spacedRepetitionIncorrectCount,
  spacedRepetitionTotalQuestions,
}: SrStatsAndChartProps) => (
  <section className="panel sr-diagram-panel">
    <div className="panel-header">
      <div>
        <h2>Statistics Diagram</h2>
        <p className="muted">Progress trends over time.</p>
      </div>
    </div>
    <div className="panel-body">
      <div className="sr-stats-top">
        <div className="sr-stats-left">
          <div className="sr-stats-switch">
            <span className="label">View</span>
            <div className="pill-grid">
              <button
                type="button"
                className={`pill pill-button ${statsView === "boxes" ? "active" : ""}`}
                aria-pressed={statsView === "boxes"}
                onClick={() => setSpacedRepetitionStatsView("boxes")}
              >
                Boxes
              </button>
              <button
                type="button"
                className={`pill pill-button ${statsView === "vault" ? "active" : ""}`}
                aria-pressed={statsView === "vault"}
                onClick={() => setSpacedRepetitionStatsView("vault")}
              >
                Active vault
              </button>
              <button
                type="button"
                className={`pill pill-button ${
                  statsView === "completed" ? "active" : ""
                }`}
                aria-pressed={statsView === "completed"}
                onClick={() => setSpacedRepetitionStatsView("completed")}
              >
                Completed per day
              </button>
            </div>
          </div>
          {statsView === "boxes" ? (
            <SrBoxesPanel
              spacedRepetitionBoxCounts={spacedRepetitionBoxCounts}
              maxBoxCount={maxBoxCount}
              activeBoxFilter={activeBoxFilter}
              toggleBoxFilter={toggleBoxFilter}
            />
          ) : statsView === "vault" ? (
            <div className="sr-vault-card">
              <div className="sr-vault-row">
                <span className="label">Vault</span>
                <span className="value">{vaultName}</span>
              </div>
              <div className="sr-vault-row">
                <span className="label">Notes</span>
                <span className="value">{vaultFilesCount}</span>
              </div>
              <div className="sr-vault-row">
                <span className="label">Cards loaded</span>
                <span className="value">{spacedRepetitionFlashcardsLength}</span>
              </div>
            </div>
          ) : (
            <div className="chart-card">
              <div className="chart-header">
                <span className="label">Completed per day</span>
                <span className="chart-meta">Last 7 days</span>
              </div>
              <div className="chart-canvas">
                <svg
                  className="sr-chart"
                  viewBox="0 0 100 40"
                  role="img"
                  aria-label="Completed per day"
                >
                  <line
                    x1="0"
                    y1="40"
                    x2="100"
                    y2="40"
                    className="sr-chart-axis"
                  />
                  <polyline
                    className="sr-chart-line"
                    points={buildLineChartPoints(spacedRepetitionCompletedChartData)}
                  />
                </svg>
              </div>
              <div className="chart-axis">
                {spacedRepetitionCompletedChartLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="sr-stats-right">
          <span className="label">Statistics</span>
          <div className="stats-summary">
            <div className="stats-counters">
              <div className="stats-counter">
                <span className="stats-label">Correct</span>
                <span className="stats-value">{spacedRepetitionCorrectCount}</span>
              </div>
              <div className="stats-counter">
                <span className="stats-label">Incorrect</span>
                <span className="stats-value">{spacedRepetitionIncorrectCount}</span>
              </div>
              <div className="stats-counter">
                <span className="stats-label">Total</span>
                <span className="stats-value">{spacedRepetitionTotalQuestions}</span>
              </div>
            </div>
            <div
              className={statsChartClass}
              style={statsChartStyle}
              role="img"
              aria-label={`Correct ${spacedRepetitionCorrectCount}, Incorrect ${spacedRepetitionIncorrectCount}, Total ${spacedRepetitionTotalQuestions}`}
            >
              <div className="stats-chart-label">
                <span className="stats-chart-total">{spacedRepetitionTotalQuestions}</span>
                <span className="stats-chart-caption">Total</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

---

## 📝 SrStatsPanel.tsx — ./pages/spaced-repetition/components/SrStatsPanel.tsx

import { KpiGrid } from "../../../components/KpiGrid";

type SrStatsPanelProps = {
  kpiItems: { label: string; value: number }[];
};

export const SrStatsPanel = ({ kpiItems }: SrStatsPanelProps) => (
  <section className="panel stats-panel sr-stats-panel">
    <div className="panel-header">
      <div>
        <h2>Statistics</h2>
      </div>
    </div>
    <div className="panel-body">
      <KpiGrid items={kpiItems} />
    </div>
  </section>
);

---

## 📝 SrToolsPanel.tsx — ./pages/spaced-repetition/components/SrToolsPanel.tsx

import {
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
  type SpacedRepetitionBoxes,
  type SpacedRepetitionOrder,
  type SpacedRepetitionPageSize,
} from "../../../features/spaced-repetition/useSpacedRepetition";

type SrToolsPanelProps = {
  spacedRepetitionBoxes: SpacedRepetitionBoxes;
  setSpacedRepetitionBoxes: (value: SpacedRepetitionBoxes) => void;
  spacedRepetitionOrder: SpacedRepetitionOrder;
  setSpacedRepetitionOrder: (value: SpacedRepetitionOrder) => void;
  spacedRepetitionPageSize: SpacedRepetitionPageSize;
  setSpacedRepetitionPageSize: (value: SpacedRepetitionPageSize) => void;
};

export const SrToolsPanel = ({
  spacedRepetitionBoxes,
  setSpacedRepetitionBoxes,
  spacedRepetitionOrder,
  setSpacedRepetitionOrder,
  spacedRepetitionPageSize,
  setSpacedRepetitionPageSize,
}: SrToolsPanelProps) => (
  <section className="panel sr-tools-panel">
    <div className="panel-header">
      <div>
        <h2>Spaced Repetition</h2>
      </div>
    </div>
    <div className="panel-body">
      <div className="setting-row">
        <span className="label">Boxes</span>
        <div className="pill-grid">
          {SPACED_REPETITION_BOXES.map((box) => (
            <button
              key={box}
              type="button"
              className={`pill pill-button ${spacedRepetitionBoxes === box ? "active" : ""}`}
              aria-pressed={spacedRepetitionBoxes === box}
              onClick={() => setSpacedRepetitionBoxes(box)}
            >
              {box} Boxes
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span className="label">Default order</span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionOrder === "in-order" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionOrder === "in-order"}
            onClick={() => setSpacedRepetitionOrder("in-order")}
          >
            In order
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionOrder === "random" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionOrder === "random"}
            onClick={() => setSpacedRepetitionOrder("random")}
          >
            Random
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionOrder === "repetition" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionOrder === "repetition"}
            onClick={() => setSpacedRepetitionOrder("repetition")}
          >
            Repetition
          </button>
        </div>
        <span className="helper-text">
          In order keeps scan order. Random shuffles on load. Repetition prioritizes
          lower boxes and skips the last box.
        </span>
      </div>
      <div className="setting-row">
        <span className="label">Page size</span>
        <div className="pill-grid">
          {SPACED_REPETITION_PAGE_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={`pill pill-button ${
                spacedRepetitionPageSize === size ? "active" : ""
              }`}
              aria-pressed={spacedRepetitionPageSize === size}
              onClick={() => setSpacedRepetitionPageSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  </section>
);

---

## 📝 SrUserPanel.tsx — ./pages/spaced-repetition/components/SrUserPanel.tsx

type SrUserPanelProps = {
  flashcards: {
    isFlashcardScanning: boolean;
  };
  spacedRepetition: {
    spacedRepetitionActiveUser: string | null;
    spacedRepetitionSelectedUserId: string;
    spacedRepetitionUsers: { id: string; name: string }[];
    spacedRepetitionNewUserName: string;
    spacedRepetitionUserError: string;
    handleSpacedRepetitionActiveUserLoadCards: () => void;
    setSpacedRepetitionSelectedUserId: (value: string) => void;
    setSpacedRepetitionNewUserName: (value: string) => void;
    setSpacedRepetitionUserError: (value: string) => void;
    handleSpacedRepetitionCreateUser: () => void;
    handleSpacedRepetitionLoadUser: () => void;
  };
  handleDeleteOpen: () => void;
};

export const SrUserPanel = ({
  flashcards,
  spacedRepetition,
  handleDeleteOpen,
}: SrUserPanelProps) => (
  <section className="panel sr-user-panel">
    <div className="panel-header">
      <div>
        <h2>User Tools</h2>
      </div>
    </div>
    <div className="panel-body">
      <div className="setting-row">
        <span className="label">Active user</span>
        <button
          type="button"
          className="value active-user-button"
          onClick={spacedRepetition.handleSpacedRepetitionActiveUserLoadCards}
          disabled={
            !spacedRepetition.spacedRepetitionActiveUser ||
            flashcards.isFlashcardScanning
          }
          aria-label="Load flashcards for active user"
        >
          {spacedRepetition.spacedRepetitionActiveUser ?? "—"}
        </button>
      </div>
      <div className="setting-row">
        <span className="label">User list</span>
        <select
          className="text-input"
          value={spacedRepetition.spacedRepetitionSelectedUserId}
          onChange={(event) =>
            spacedRepetition.setSpacedRepetitionSelectedUserId(event.target.value)
          }
          aria-label="Select user"
        >
          <option value="">Select user</option>
          {spacedRepetition.spacedRepetitionUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>
      <div className="setting-row">
        <span className="label">New user</span>
        <div className="setting-inline">
          <input
            type="text"
            className="text-input"
            value={spacedRepetition.spacedRepetitionNewUserName}
            onChange={(event) => {
              spacedRepetition.setSpacedRepetitionNewUserName(event.target.value);
              if (spacedRepetition.spacedRepetitionUserError) {
                spacedRepetition.setSpacedRepetitionUserError("");
              }
            }}
            placeholder="User name"
            aria-label="New user name"
          />
          <button
            type="button"
            className="ghost small"
            onClick={spacedRepetition.handleSpacedRepetitionCreateUser}
          >
            Create
          </button>
        </div>
        {spacedRepetition.spacedRepetitionUserError ? (
          <span className="helper-text error-text">
            {spacedRepetition.spacedRepetitionUserError}
          </span>
        ) : null}
      </div>
      <div className="setting-row">
        <span className="label">Actions</span>
        <div className="setting-actions">
          <button
            type="button"
            className="ghost small"
            onClick={spacedRepetition.handleSpacedRepetitionLoadUser}
            disabled={!spacedRepetition.spacedRepetitionSelectedUserId}
          >
            Load
          </button>
          <button
            type="button"
            className="ghost small"
            onClick={handleDeleteOpen}
            disabled={!spacedRepetition.spacedRepetitionSelectedUserId}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </section>
);

---

## 📝 useSrSessionViewModel.ts — ./pages/spaced-repetition/hooks/useSrSessionViewModel.ts

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { useAppState } from "../../../components/AppStateProvider";
import { vaultBaseName } from "../../../lib/path";
import {
  areClozeBlanksComplete,
  areTrueFalseItemsComplete,
  isFlashcardPartComplete,
} from "../../../features/flashcards/logic";
import {
  getFlashcardId,
  getSpacedRepetitionEffectiveBox,
  normalizeSpacedRepetitionCardProgress,
} from "../../../features/spaced-repetition/logic";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
};

export const useSrSessionViewModel = () => {
  const { flashcards, spacedRepetition, vault } = useAppState();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [activeBoxFilter, setActiveBoxFilter] = useState<number | null>(null);
  const statsView = spacedRepetition.spacedRepetitionStatsView;
  const focusLabel = isFocusMode ? "Exit focus mode" : "Enter focus mode";
  const vaultName = useMemo(
    () => (vault.vaultPath ? vaultBaseName(vault.vaultPath) : "—"),
    [vault.vaultPath],
  );
  const showBoxEmptyMessage =
    statsView === "boxes" &&
    activeBoxFilter !== null &&
    Boolean(spacedRepetition.spacedRepetitionActiveUser);
  const selectedUser = useMemo(
    () =>
      spacedRepetition.spacedRepetitionUsers.find(
        (user) => user.id === spacedRepetition.spacedRepetitionSelectedUserId,
      ),
    [
      spacedRepetition.spacedRepetitionSelectedUserId,
      spacedRepetition.spacedRepetitionUsers,
    ],
  );
  const deleteTargetName = selectedUser?.name ?? "";
  const deleteInputValue = deleteConfirmInput.trim();
  const canConfirmDelete =
    Boolean(deleteTargetName) && deleteInputValue === deleteTargetName;

  const statsTotal =
    spacedRepetition.spacedRepetitionCorrectCount +
    spacedRepetition.spacedRepetitionIncorrectCount;
  const statsChartClass = statsTotal === 0 ? "stats-chart empty" : "stats-chart";
  const statsChartStyle = useMemo(
    () =>
      ({
        "--correct-percent": `${spacedRepetition.spacedRepetitionCorrectPercent}%`,
      }) as CSSProperties,
    [spacedRepetition.spacedRepetitionCorrectPercent],
  );
  const maxBoxCount = Math.max(...spacedRepetition.spacedRepetitionBoxCounts, 0);
  const visibleFlashcardEntries = useMemo(
    () =>
      spacedRepetition.spacedRepetitionVisibleFlashcards.map((card, localIndex) => ({
        card,
        cardIndex: spacedRepetition.spacedRepetitionPageStart + localIndex,
      })),
    [
      spacedRepetition.spacedRepetitionPageStart,
      spacedRepetition.spacedRepetitionVisibleFlashcards,
    ],
  );
  const filteredFlashcardEntries = useMemo(() => {
    if (
      activeBoxFilter === null ||
      statsView !== "boxes" ||
      !spacedRepetition.spacedRepetitionCardStates
    ) {
      return visibleFlashcardEntries;
    }
    return visibleFlashcardEntries.filter(({ card }) => {
      const cardId = getFlashcardId(card);
      const progress = spacedRepetition.spacedRepetitionCardStates[cardId] ?? null;
      const normalized = normalizeSpacedRepetitionCardProgress(progress);
      const effectiveBox = getSpacedRepetitionEffectiveBox(
        normalized,
        spacedRepetition.spacedRepetitionBoxes,
      );
      return effectiveBox === activeBoxFilter;
    });
  }, [
    activeBoxFilter,
    statsView,
    spacedRepetition.spacedRepetitionBoxes,
    spacedRepetition.spacedRepetitionCardStates,
    visibleFlashcardEntries,
  ]);
  const toggleBoxFilter = useCallback(
    (boxNumber: number) => {
      const nextFilter = activeBoxFilter === boxNumber ? null : boxNumber;
      setActiveBoxFilter(nextFilter);
      spacedRepetition.handleSpacedRepetitionActiveUserLoadCards({
        boxFilter: nextFilter,
      });
    },
    [activeBoxFilter, spacedRepetition],
  );

  const kpiItems = [
    { label: "Correct", value: spacedRepetition.spacedRepetitionCorrectCount },
    { label: "Incorrect", value: spacedRepetition.spacedRepetitionIncorrectCount },
    { label: "Total", value: spacedRepetition.spacedRepetitionTotalQuestions },
    {
      label: "Due now",
      value: spacedRepetition.spacedRepetitionProgressStats.dueNow,
    },
    {
      label: "Due today",
      value: spacedRepetition.spacedRepetitionProgressStats.dueToday,
    },
    {
      label: "In queue",
      value: spacedRepetition.spacedRepetitionProgressStats.inQueue,
    },
    {
      label: "Completed today",
      value: spacedRepetition.spacedRepetitionProgressStats.completedToday,
    },
  ];

  useEffect(() => {
    if (!isDeleteDialogOpen) {
      return;
    }
    if (!selectedUser) {
      setIsDeleteDialogOpen(false);
      setDeleteConfirmInput("");
    }
  }, [isDeleteDialogOpen, selectedUser]);

  useEffect(() => {
    document.body.classList.toggle("focus-mode", isFocusMode);
    return () => {
      document.body.classList.remove("focus-mode");
    };
  }, [isFocusMode]);

  useEffect(() => {
    if (!isFocusMode) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setIsFocusMode(false);
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (spacedRepetition.spacedRepetitionCanGoBack) {
          spacedRepetition.handleSpacedRepetitionPageBack();
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (spacedRepetition.spacedRepetitionCanGoNext) {
          spacedRepetition.handleSpacedRepetitionPageNext();
        }
        return;
      }

      if (event.key !== "Enter" && event.key !== "NumpadEnter") {
        return;
      }

      const visibleCards = spacedRepetition.spacedRepetitionVisibleFlashcards;
      if (visibleCards.length === 0) {
        return;
      }

      const findFirstSubmittableIndex = () => {
        for (let localIndex = 0; localIndex < visibleCards.length; localIndex += 1) {
          const cardIndex =
            spacedRepetition.spacedRepetitionPageStart + localIndex;
          const card = visibleCards[localIndex];
          if (spacedRepetition.spacedRepetitionSubmissions[cardIndex]) {
            continue;
          }
          if (card.kind === "composite") {
            const partStates =
              spacedRepetition.spacedRepetitionCompositeStates?.[cardIndex] ?? [];
            const canSubmit =
              card.parts.length > 0 &&
              card.parts.every((part, partIndex) =>
                isFlashcardPartComplete(part, partStates[partIndex] ?? {}),
              );
            if (canSubmit) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "multiple-choice") {
            if (
              (spacedRepetition.spacedRepetitionSelections[cardIndex] ?? []).length > 0
            ) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "true-false") {
            const selections =
              spacedRepetition.spacedRepetitionTrueFalseSelections[cardIndex] ?? {};
            if (areTrueFalseItemsComplete(card, selections)) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "free-text") {
            continue;
          }
          const responses =
            spacedRepetition.spacedRepetitionClozeResponses[cardIndex] ?? {};
          if (areClozeBlanksComplete(card, responses)) {
            return cardIndex;
          }
        }
        return null;
      };

      const resolvedIndex =
        activeCardIndex !== null &&
        activeCardIndex >= spacedRepetition.spacedRepetitionPageStart &&
        activeCardIndex <
          spacedRepetition.spacedRepetitionPageStart +
            spacedRepetition.spacedRepetitionVisibleFlashcards.length
          ? activeCardIndex
          : findFirstSubmittableIndex();

      if (resolvedIndex === null) {
        return;
      }

      const localIndex = resolvedIndex - spacedRepetition.spacedRepetitionPageStart;
      const card = visibleCards[localIndex];
      if (!card || spacedRepetition.spacedRepetitionSubmissions[resolvedIndex]) {
        return;
      }
      if (card.kind === "composite") {
        const partStates =
          spacedRepetition.spacedRepetitionCompositeStates?.[resolvedIndex] ?? [];
        const canSubmit =
          card.parts.length > 0 &&
          card.parts.every((part, partIndex) =>
            isFlashcardPartComplete(part, partStates[partIndex] ?? {}),
          );
        if (!canSubmit) {
          return;
        }
      } else if (card.kind === "multiple-choice") {
        if (
          (spacedRepetition.spacedRepetitionSelections[resolvedIndex] ?? []).length ===
          0
        ) {
          return;
        }
      } else if (card.kind === "true-false") {
        const selections =
          spacedRepetition.spacedRepetitionTrueFalseSelections[resolvedIndex] ?? {};
        if (!areTrueFalseItemsComplete(card, selections)) {
          return;
        }
      } else if (card.kind === "free-text") {
        return;
      } else {
        const responses =
          spacedRepetition.spacedRepetitionClozeResponses[resolvedIndex] ?? {};
        if (!areClozeBlanksComplete(card, responses)) {
          return;
        }
      }

      event.preventDefault();
      spacedRepetition.handleSpacedRepetitionSubmit(resolvedIndex, true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCardIndex, isFocusMode, spacedRepetition]);

  const handleOptionSelect = useCallback(
    (cardIndex: number, keys: string[]) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionOptionSelect(cardIndex, keys);
    },
    [spacedRepetition],
  );

  const handleTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: "wahr" | "falsch") => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionTrueFalseSelect(
        cardIndex,
        itemId,
        value,
      );
    },
    [spacedRepetition],
  );

  const handleClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionClozeInputChange(
        cardIndex,
        blankId,
        value,
      );
    },
    [spacedRepetition],
  );

  const handleClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionClozeTokenDrop(
        event,
        cardIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [spacedRepetition],
  );

  const handleClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionClozeTokenRemove(cardIndex, blankId);
    },
    [spacedRepetition],
  );

  const handleTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionTextInputChange(cardIndex, value);
    },
    [spacedRepetition],
  );

  const handleTextCheck = useCallback(
    (cardIndex: number) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionTextCheck(cardIndex);
    },
    [spacedRepetition],
  );

  const handleSelfGrade = useCallback(
    (cardIndex: number, grade: "correct" | "incorrect") => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionSelfGrade(cardIndex, grade);
    },
    [spacedRepetition],
  );

  const handleCompositeOptionSelect = useCallback(
    (cardIndex: number, partIndex: number, keys: string[]) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeOptionSelect(
        cardIndex,
        partIndex,
        keys,
      );
    },
    [spacedRepetition],
  );

  const handleCompositeTrueFalseSelect = useCallback(
    (cardIndex: number, partIndex: number, itemId: string, value: "wahr" | "falsch") => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeTrueFalseSelect(
        cardIndex,
        partIndex,
        itemId,
        value,
      );
    },
    [spacedRepetition],
  );

  const handleCompositeClozeInputChange = useCallback(
    (cardIndex: number, partIndex: number, blankId: string, value: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeClozeInputChange(
        cardIndex,
        partIndex,
        blankId,
        value,
      );
    },
    [spacedRepetition],
  );

  const handleCompositeClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      partIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeClozeTokenDrop(
        event,
        cardIndex,
        partIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [spacedRepetition],
  );

  const handleCompositeClozeTokenRemove = useCallback(
    (cardIndex: number, partIndex: number, blankId: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeClozeTokenRemove(
        cardIndex,
        partIndex,
        blankId,
      );
    },
    [spacedRepetition],
  );

  const handleCompositeTextInputChange = useCallback(
    (cardIndex: number, partIndex: number, value: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeTextInputChange(
        cardIndex,
        partIndex,
        value,
      );
    },
    [spacedRepetition],
  );

  const handleCompositeTextCheck = useCallback(
    (cardIndex: number, partIndex: number) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeTextCheck(cardIndex, partIndex);
    },
    [spacedRepetition],
  );

  const handleCompositeSelfGrade = useCallback(
    (cardIndex: number, partIndex: number, grade: "correct" | "incorrect") => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeSelfGrade(
        cardIndex,
        partIndex,
        grade,
      );
    },
    [spacedRepetition],
  );

  const handleDeleteOpen = useCallback(() => {
    if (!selectedUser) {
      return;
    }
    setDeleteConfirmInput("");
    setIsDeleteDialogOpen(true);
  }, [selectedUser]);

  const handleDeleteCancel = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setDeleteConfirmInput("");
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!canConfirmDelete) {
      return;
    }
    spacedRepetition.handleSpacedRepetitionDeleteUser();
    setIsDeleteDialogOpen(false);
    setDeleteConfirmInput("");
  }, [canConfirmDelete, spacedRepetition]);

  return {
    flashcards,
    spacedRepetition,
    vault,
    isFocusMode,
    setIsFocusMode,
    activeBoxFilter,
    statsView,
    focusLabel,
    vaultName,
    showBoxEmptyMessage,
    statsChartClass,
    statsChartStyle,
    maxBoxCount,
    filteredFlashcardEntries,
    toggleBoxFilter,
    kpiItems,
    handleOptionSelect,
    handleTrueFalseSelect,
    handleClozeInputChange,
    handleClozeTokenDrop,
    handleClozeTokenRemove,
    handleTextInputChange,
    handleTextCheck,
    handleSelfGrade,
    handleCompositeOptionSelect,
    handleCompositeTrueFalseSelect,
    handleCompositeClozeInputChange,
    handleCompositeClozeTokenDrop,
    handleCompositeClozeTokenRemove,
    handleCompositeTextInputChange,
    handleCompositeTextCheck,
    handleCompositeSelfGrade,
    handleDeleteOpen,
    handleDeleteCancel,
    handleDeleteConfirm,
    isDeleteDialogOpen,
    deleteConfirmInput,
    setDeleteConfirmInput,
    deleteTargetName,
    canConfirmDelete,
  };
};

---

## 📝 SpacedRepetitionPage.tsx — ./pages/spaced-repetition/SpacedRepetitionPage.tsx

import { SrCardHost } from "./components/SrCardHost";
import { SrDeleteModal } from "./components/SrDeleteModal";
import { SrHeader } from "./components/SrHeader";
import { SrStatsAndChart } from "./components/SrStatsAndChart";
import { SrStatsPanel } from "./components/SrStatsPanel";
import { SrToolsPanel } from "./components/SrToolsPanel";
import { SrUserPanel } from "./components/SrUserPanel";
import { useSrSessionViewModel } from "./hooks/useSrSessionViewModel";

export const SpacedRepetitionPage = () => {
  const {
    flashcards,
    spacedRepetition,
    vault,
    isFocusMode,
    setIsFocusMode,
    activeBoxFilter,
    statsView,
    focusLabel,
    vaultName,
    showBoxEmptyMessage,
    statsChartClass,
    statsChartStyle,
    maxBoxCount,
    filteredFlashcardEntries,
    toggleBoxFilter,
    kpiItems,
    handleOptionSelect,
    handleTrueFalseSelect,
    handleClozeInputChange,
    handleClozeTokenDrop,
    handleClozeTokenRemove,
    handleTextInputChange,
    handleTextCheck,
    handleSelfGrade,
    handleCompositeOptionSelect,
    handleCompositeTrueFalseSelect,
    handleCompositeClozeInputChange,
    handleCompositeClozeTokenDrop,
    handleCompositeClozeTokenRemove,
    handleCompositeTextInputChange,
    handleCompositeTextCheck,
    handleCompositeSelfGrade,
    handleDeleteOpen,
    handleDeleteCancel,
    handleDeleteConfirm,
    isDeleteDialogOpen,
    deleteConfirmInput,
    setDeleteConfirmInput,
    deleteTargetName,
    canConfirmDelete,
  } = useSrSessionViewModel();

  return (
    <div className={`spaced-repetition-layout ${isFocusMode ? "focus-mode" : ""}`}>
      {isFocusMode ? null : (
        <SrStatsAndChart
          statsView={statsView}
          setSpacedRepetitionStatsView={
            spacedRepetition.setSpacedRepetitionStatsView
          }
          spacedRepetitionBoxCounts={spacedRepetition.spacedRepetitionBoxCounts}
          maxBoxCount={maxBoxCount}
          activeBoxFilter={activeBoxFilter}
          toggleBoxFilter={toggleBoxFilter}
          vaultName={vaultName}
          vaultFilesCount={vault.files.length}
          spacedRepetitionFlashcardsLength={
            spacedRepetition.spacedRepetitionFlashcards.length
          }
          spacedRepetitionCompletedChartData={
            spacedRepetition.spacedRepetitionCompletedChartData
          }
          spacedRepetitionCompletedChartLabels={
            spacedRepetition.spacedRepetitionCompletedChartLabels
          }
          statsChartClass={statsChartClass}
          statsChartStyle={statsChartStyle}
          spacedRepetitionCorrectCount={spacedRepetition.spacedRepetitionCorrectCount}
          spacedRepetitionIncorrectCount={
            spacedRepetition.spacedRepetitionIncorrectCount
          }
          spacedRepetitionTotalQuestions={
            spacedRepetition.spacedRepetitionTotalQuestions
          }
        />
      )}

      {isFocusMode ? null : (
        <SrUserPanel
          flashcards={flashcards}
          spacedRepetition={spacedRepetition}
          handleDeleteOpen={handleDeleteOpen}
        />
      )}

      <section className="panel sr-flashcards-panel">
        <SrHeader
          spacedRepetitionStatusLabel={spacedRepetition.spacedRepetitionStatusLabel}
          isFocusMode={isFocusMode}
          focusLabel={focusLabel}
          setIsFocusMode={setIsFocusMode}
        />
        <SrCardHost
          filteredFlashcardEntries={filteredFlashcardEntries}
          showBoxEmptyMessage={showBoxEmptyMessage}
          activeBoxFilter={activeBoxFilter}
          spacedRepetitionEmptyState={spacedRepetition.spacedRepetitionEmptyState}
          spacedRepetitionSubmissions={spacedRepetition.spacedRepetitionSubmissions}
          spacedRepetitionCompositeStates={
            spacedRepetition.spacedRepetitionCompositeStates
          }
          spacedRepetitionClozeResponses={
            spacedRepetition.spacedRepetitionClozeResponses
          }
          spacedRepetitionTrueFalseSelections={
            spacedRepetition.spacedRepetitionTrueFalseSelections
          }
          spacedRepetitionTextResponses={
            spacedRepetition.spacedRepetitionTextResponses
          }
          spacedRepetitionTextRevealed={
            spacedRepetition.spacedRepetitionTextRevealed
          }
          spacedRepetitionSelfGrades={spacedRepetition.spacedRepetitionSelfGrades}
          spacedRepetitionSelections={spacedRepetition.spacedRepetitionSelections}
          handleCompositeOptionSelect={handleCompositeOptionSelect}
          handleCompositeTrueFalseSelect={handleCompositeTrueFalseSelect}
          handleCompositeClozeInputChange={handleCompositeClozeInputChange}
          handleCompositeClozeTokenDrop={handleCompositeClozeTokenDrop}
          handleCompositeClozeTokenRemove={handleCompositeClozeTokenRemove}
          handleCompositeTextInputChange={handleCompositeTextInputChange}
          handleCompositeTextCheck={handleCompositeTextCheck}
          handleCompositeSelfGrade={handleCompositeSelfGrade}
          handleOptionSelect={handleOptionSelect}
          handleTrueFalseSelect={handleTrueFalseSelect}
          handleClozeInputChange={handleClozeInputChange}
          handleClozeTokenDrop={handleClozeTokenDrop}
          handleClozeTokenRemove={handleClozeTokenRemove}
          handleTextInputChange={handleTextInputChange}
          handleTextCheck={handleTextCheck}
          handleSelfGrade={handleSelfGrade}
          handleSpacedRepetitionSubmit={
            spacedRepetition.handleSpacedRepetitionSubmit
          }
          handleClozeTokenDragStart={flashcards.handleClozeTokenDragStart}
          handleClozeBlankDragOver={flashcards.handleClozeBlankDragOver}
          spacedRepetitionCanGoBack={spacedRepetition.spacedRepetitionCanGoBack}
          spacedRepetitionCanGoNext={spacedRepetition.spacedRepetitionCanGoNext}
          handleSpacedRepetitionPageBack={
            spacedRepetition.handleSpacedRepetitionPageBack
          }
          handleSpacedRepetitionPageNext={
            spacedRepetition.handleSpacedRepetitionPageNext
          }
        />
      </section>

      {isFocusMode ? null : (
        <SrToolsPanel
          spacedRepetitionBoxes={spacedRepetition.spacedRepetitionBoxes}
          setSpacedRepetitionBoxes={spacedRepetition.setSpacedRepetitionBoxes}
          spacedRepetitionOrder={spacedRepetition.spacedRepetitionOrder}
          setSpacedRepetitionOrder={spacedRepetition.setSpacedRepetitionOrder}
          spacedRepetitionPageSize={spacedRepetition.spacedRepetitionPageSize}
          setSpacedRepetitionPageSize={spacedRepetition.setSpacedRepetitionPageSize}
        />
      )}

      {isFocusMode ? null : <SrStatsPanel kpiItems={kpiItems} />}

      <SrDeleteModal
        isDeleteDialogOpen={isDeleteDialogOpen}
        deleteTargetName={deleteTargetName}
        deleteConfirmInput={deleteConfirmInput}
        setDeleteConfirmInput={setDeleteConfirmInput}
        handleDeleteCancel={handleDeleteCancel}
        handleDeleteConfirm={handleDeleteConfirm}
        canConfirmDelete={canConfirmDelete}
      />
    </div>
  );
};

---

## 📝 SpacedRepetitionPage.tsx — ./pages/SpacedRepetitionPage.tsx

export { SpacedRepetitionPage } from "./spaced-repetition/SpacedRepetitionPage";

---

## 📝 base.css — ./styles/base.css


* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--page-bg);
  color: var(--ink);
}

#root {
  min-height: 100vh;
}

@keyframes riseIn {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

---

## 📝 buttons.css — ./styles/components/buttons.css


button {
  border: none;
  font: inherit;
}

.primary,
.ghost {
  padding: 12px 18px;
  border-radius: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s ease;
}

.primary {
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: var(--shadow-soft);
}

.primary:hover {
  background: var(--accent-strong);
  color: var(--accent-contrast-strong);
}

.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.ghost {
  background: transparent;
  border: 1px dashed var(--line);
  color: var(--ink);
}

.ghost:hover {
  border-color: var(--accent-strong);
  color: var(--accent-strong);
}

.ghost:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ghost.small.active {
  border-color: var(--accent-border);
  color: var(--accent-strong);
}

.ghost.small {
  padding: 8px 12px;
  font-size: 0.85rem;
}

---

## 📝 content.css — ./styles/components/content.css


.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: riseIn 0.6s ease both;
  animation-delay: 0.05s;
  min-height: 0;
  overflow: auto;
}

.mobile-nav-header {
  display: none;
  align-items: center;
  justify-content: flex-start;
}

.mobile-nav-toggle {
  align-self: flex-start;
}

.mobile-nav-backdrop {
  position: fixed;
  inset: 0;
  border: none;
  padding: 0;
  margin: 0;
  background: rgba(10, 12, 16, 0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 25;
}

.mobile-nav-close {
  display: none;
  margin-left: auto;
  border: 1px solid var(--line-soft);
  background: transparent;
  color: var(--ink);
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 0.75rem;
  cursor: pointer;
}

.mobile-nav-close:hover {
  border-color: var(--accent-border);
  color: var(--accent-strong);
}

.content-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: center;
  flex-wrap: wrap;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-size: 0.75rem;
  margin: 0 0 6px;
}

h1 {
  margin: 0 0 6px;
  font-size: 2rem;
}

h2 {
  margin: 0 0 6px;
  font-size: 1.2rem;
}

.muted {
  color: var(--muted);
  margin: 0;
}

.actions {
  display: flex;
  gap: 12px;
}

.vault-details {
  background: var(--panel);
  border-radius: 18px;
  padding: 14px 18px;
  border: 1px solid var(--line-soft);
  box-shadow: var(--shadow-soft);
}

.vault-details-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
}

.vault-summary {
  font-size: 0.85rem;
  color: var(--muted);
}

.vault-body {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vault-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 100%;
}

.vault-tree-scroll {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

.vault-tree-scroll.vault-tree-scroll-wide {
  overflow-x: auto;
}

.tree-dir {
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

.tree-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: nowrap;
  gap: 6px;
  padding: 5px 8px;
  padding-left: calc(8px + var(--tree-indent, 0px));
  border-radius: 6px;
  background: var(--accent-weak-bg);
  border: 1px solid transparent;
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  transition: 0.2s ease;
  min-width: 0;
}

.tree-item:hover {
  border-color: var(--accent-border);
}

.tree-item.active {
  border-color: var(--accent-border);
  background: var(--accent-active-bg);
}

.vault-tree-scroll.vault-tree-scroll-wide .tree-item {
  min-width: calc(100% + var(--tree-overflow, 0px));
}

.tree-dir summary {
  list-style: none;
  display: flex;
  align-items: center;
}

.tree-dir summary::-webkit-details-marker {
  display: none;
}

.tree-dir summary::after {
  content: ">";
  margin-left: auto;
  color: var(--muted);
  font-size: 0.7rem;
  transition: transform 0.2s ease;
}

.tree-dir[open] summary::after {
  transform: rotate(90deg);
}

.tree-children {
  margin-left: 0;
  padding-left: 0;
  padding-top: 6px;
  border-left: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tree-icon {
  width: 14px;
  height: 14px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--accent);
}

.tree-icon svg {
  width: 12px;
  height: 12px;
}

.tree-file {
  background: var(--panel);
  width: calc(100% - 8px);
}

.vault-tree-scroll.vault-tree-scroll-wide .tree-file {
  min-width: calc(100% + var(--tree-overflow, 0px) - 8px);
}

.tree-name {
  flex: 1;
  min-width: 0;
  line-height: 1.2;
  max-height: calc(1.2em * 2);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  text-overflow: ellipsis;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 0.8fr);
  gap: 24px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
}

.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: 100%;
  min-height: 0;
}

.workspace > * {
  min-height: 0;
}

.workspace .panel,
.workspace .vault-details {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.workspace .panel-body,
.workspace .vault-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.flashcard-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: start;
}

.fast-flashcard-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  grid-template-rows: auto auto;
  gap: 18px 24px;
  align-items: stretch;
}

.spaced-repetition-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  grid-template-rows: auto auto auto;
  gap: 24px;
  align-items: start;
}

body.focus-mode .app-shell,
body.focus-mode .app-shell.sidebar-collapsed {
  grid-template-columns: 1fr;
  padding: 16px;
}

body.focus-mode .sidebar {
  display: none;
}

body.focus-mode .flashcard-layout,
body.focus-mode .spaced-repetition-layout {
  grid-template-columns: 1fr;
}

body.focus-mode .flashcard-panel {
  width: 100%;
  max-width: 100%;
  margin: 0;
  justify-self: stretch;
}

body.focus-mode .sr-flashcards-panel {
  width: 100%;
  max-width: 100%;
  margin: 0;
}

.fast-stats-panel {
  grid-column: 1;
  grid-row: 1;
}

.fast-stats-panel .panel-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.fast-tools-panel {
  grid-column: 2;
  grid-row: 1;
}

.fast-flashcard-tools-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fast-flashcard-tools-settings--dividers .fast-flashcard-tools-settings-section {
  padding-top: 0;
}

.fast-flashcard-tools-settings--dividers
.fast-flashcard-tools-settings-section + .fast-flashcard-tools-settings-section {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.fast-flashcard-panel {
  grid-column: 1;
  grid-row: 2;
}

.fast-history-panel {
  grid-column: 2;
  grid-row: 2;
  min-height: 0;
}

.fast-history-panel .panel-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

body.focus-mode .flashcard-panel img,
body.focus-mode .sr-flashcards-panel img {
  max-width: 100%;
  height: auto;
  display: block;
}

body.focus-mode .flashcard-sidebar,
body.focus-mode .sr-diagram-panel,
body.focus-mode .sr-user-panel,
body.focus-mode .sr-tools-panel,
body.focus-mode .sr-stats-panel {
  display: none;
}

.spaced-repetition-layout .sr-diagram-panel {
  grid-column: 1;
  grid-row: 1;
}

.spaced-repetition-layout .sr-user-panel {
  grid-column: 2;
  grid-row: 1;
}

.spaced-repetition-layout .sr-flashcards-panel {
  grid-column: 1;
  grid-row: 2;
}

.spaced-repetition-layout .sr-tools-panel {
  grid-column: 2;
  grid-row: 2;
}

.spaced-repetition-layout .sr-stats-panel {
  grid-column: 1 / span 2;
  grid-row: 3;
}

.flashcard-sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

---

## 📝 flashcards.css — ./styles/components/flashcards.css


.flashcard-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.flashcard-item {
  padding: 14px;
  border-radius: 16px;
  background: var(--block-bg);
  border: 1px solid var(--block-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.composite-card {
  gap: 16px;
}

.composite-parts {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.composite-card .flashcard-item {
  background: var(--panel);
}

.flashcard-question {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.flashcard-options {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.truefalse-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.truefalse-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
}

.truefalse-question {
  font-weight: 600;
  color: var(--ink);
}

.truefalse-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.truefalse-option {
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  padding: 6px 12px;
  background: var(--accent-weak-bg);
  color: var(--ink);
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s ease;
}

.truefalse-option.selected {
  border-color: var(--accent-border);
  background: var(--accent-soft);
}

.truefalse-option.correct {
  border-color: var(--accent-strong);
  background: var(--accent-soft);
}

.truefalse-option.incorrect {
  border-color: var(--error-border);
  background: var(--error-bg);
}

.truefalse-option:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.truefalse-result {
  font-size: 0.8rem;
  font-weight: 600;
}

.truefalse-result.correct {
  color: var(--accent-strong);
}

.truefalse-result.incorrect {
  color: var(--error-ink);
}

.truefalse-solution {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.truefalse-solution-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.truefalse-solution-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--muted);
}

.truefalse-solution-answer {
  font-weight: 600;
  color: var(--ink);
}

.flashcard-option {
  width: 100%;
  border: 1px solid var(--line-soft);
  background: var(--panel);
  border-radius: 12px;
  padding: 8px 10px;
  display: flex;
  gap: 8px;
  align-items: center;
  text-align: left;
  cursor: pointer;
  transition: 0.2s ease;
}

.flashcard-option:hover {
  border-color: var(--accent-border);
  background: var(--accent-hover-bg);
}

.flashcard-option.selected {
  border-color: var(--accent-strong);
  background: var(--accent-active-bg);
}

.flashcard-option.correct {
  border-color: var(--accent-strong);
  background: var(--accent-soft);
}

.flashcard-option.incorrect {
  border-color: var(--error-border);
  background: var(--error-bg);
}

.flashcard-option:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.flashcard-key {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: lowercase;
  flex-shrink: 0;
}

.flashcard-text {
  color: var(--ink);
}

.flashcard-pagination {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.flashcard-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.flashcard-text-block {
  font-weight: 600;
  color: var(--ink);
  white-space: pre-wrap;
}

.flashcard-input {
  width: 100%;
  min-height: 120px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
  color: var(--ink);
  font: inherit;
  resize: vertical;
}

.flashcard-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.flashcard-answer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.flashcard-answer-text {
  color: var(--ink);
  white-space: pre-wrap;
}

.cloze-text {
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--ink);
}

.cloze-blank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 120px;
  min-height: 36px;
  padding: 6px 8px;
  margin: 0 4px;
  border-radius: 10px;
  border: 1px dashed var(--line);
  background: var(--panel);
  vertical-align: middle;
}

.cloze-blank.input {
  min-width: 90px;
}

.cloze-blank.filled {
  border-style: solid;
  background: var(--accent-weak-bg);
}

.cloze-blank.correct {
  border-color: var(--accent-border);
  background: var(--accent-soft);
}

.cloze-blank.incorrect {
  border-color: var(--error-border);
  background: var(--error-bg);
}

.cloze-input {
  border: 1px solid var(--line-soft);
  background: var(--accent-weak-bg);
  color: var(--ink);
  border-radius: 8px;
  padding: 4px 6px;
  font-size: 0.85rem;
  min-width: 80px;
}

.cloze-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.cloze-blank.correct .cloze-input {
  border-color: var(--accent-border);
}

.cloze-blank.incorrect .cloze-input {
  border-color: var(--error-border);
}

.cloze-placeholder {
  font-size: 0.75rem;
  color: var(--muted);
}

.cloze-token {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.token-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.token-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 36px;
}

.token-chip {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--accent-weak-bg);
  color: var(--ink);
  cursor: grab;
  user-select: none;
}

.token-chip:active {
  cursor: grabbing;
}

.token-chip:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.token-chip.used {
  opacity: 0.6;
}

.token-remove {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
}

.token-remove:hover {
  color: var(--ink);
  border-color: var(--line-soft);
}

.cloze-solution {
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--ink);
}

.cloze-solution-token {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  margin: 0 2px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 600;
}

.token-solution {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.flashcard-submit {
  border-style: solid;
}

.flashcard-result {
  font-weight: 600;
}

.flashcard-result.correct {
  color: var(--accent-strong);
}

.flashcard-result.incorrect {
  color: var(--error-ink);
}

.flashcard-result.neutral {
  color: var(--muted);
}

---

## 📝 help.css — ./styles/components/help.css


.help-panel .panel-body {
  min-height: auto;
}

.help-body {
  gap: 16px;
}

.help-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.help-item:first-child {
  border-top: none;
  padding-top: 0;
}

.help-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.help-block-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
  text-transform: none;
  letter-spacing: 0;
}

.help-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--muted);
}

.help-list li {
  line-height: 1.5;
}

.help-examples {
  display: grid;
  gap: 10px;
}

.help-example {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.help-example-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.help-example-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.help-example-title {
  font-weight: 600;
}

.help-example-description {
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.4;
}

.help-copy {
  flex-shrink: 0;
}

.help-code {
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--accent-weak-border);
  background: var(--accent-weak-bg);
  font-family: var(--mono);
  font-size: 0.82rem;
  white-space: pre-wrap;
}

.help-overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.help-topic-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  background: var(--accent-weak-bg);
  border: 1px solid var(--accent-weak-border);
  text-align: left;
  cursor: pointer;
  transition: 0.2s ease;
}

.help-topic-card:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-soft);
  transform: translateY(-1px);
}

.help-topic-card:focus-visible {
  outline: 2px solid var(--accent-focus-ring);
  outline-offset: 2px;
}

.help-topic-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.help-topic-icon {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel);
  border: 1px solid var(--line-soft);
  color: var(--muted);
  font-size: 0.85rem;
}

.help-topic-title {
  font-weight: 600;
}

.help-topic-summary {
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.4;
}

.help-topic-arrow {
  margin-left: auto;
  color: var(--muted);
  font-weight: 700;
}

.help-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.help-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.help-breadcrumb-current {
  color: var(--ink);
  font-weight: 600;
}

.help-breadcrumb-leaf {
  color: var(--accent-strong);
}

.help-crumb-sep {
  color: var(--muted);
}

.help-detail-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.help-detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--line-soft);
}

.help-detail-section:first-child {
  border-top: none;
  padding-top: 0;
}

.help-syntax-layout {
  display: grid;
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.help-syntax-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.help-syntax-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--accent-weak-border);
  background: var(--accent-weak-bg);
  text-align: left;
  cursor: pointer;
  transition: 0.2s ease;
}

.help-syntax-card:hover {
  border-color: var(--accent-border);
  transform: translateY(-1px);
}

.help-syntax-card:focus-visible {
  outline: 2px solid var(--accent-focus-ring);
  outline-offset: 2px;
}

.help-syntax-card.active {
  border-color: var(--accent-border);
  background: var(--accent-active-bg);
  box-shadow: var(--shadow-soft), inset 4px 0 0 var(--accent-strong);
}

.help-syntax-card.active .help-syntax-card-title {
  color: var(--accent-strong);
}

.help-syntax-card-title {
  font-weight: 600;
}

.help-syntax-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: 0.78rem;
}

.help-syntax-card-label {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.65rem;
}

.help-syntax-token-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.help-syntax-token {
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel);
  font-family: var(--mono);
  font-size: 0.72rem;
  color: var(--ink);
}

.help-syntax-card-rule {
  color: var(--muted);
  font-size: 0.85rem;
  line-height: 1.4;
}

.help-syntax-snippet {
  margin: 0;
  padding: 8px;
  border-radius: 10px;
  border: 1px dashed var(--line-soft);
  background: var(--panel);
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--muted);
  white-space: pre-wrap;
}

.help-syntax-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--accent-weak-border);
  background: var(--accent-weak-bg);
  min-width: 0;
}

.help-syntax-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.help-syntax-detail-title {
  font-weight: 600;
  font-size: 1rem;
}

.help-syntax-lang-tabs {
  display: flex;
  gap: 6px;
}

.help-syntax-lang {
  border-radius: 999px;
  border: 1px solid var(--line-soft);
  padding: 4px 10px;
  font-size: 0.75rem;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
}

.help-syntax-lang:focus-visible {
  outline: 2px solid var(--accent-focus-ring);
  outline-offset: 2px;
}

.help-syntax-lang.active {
  border-color: var(--accent-border);
  color: var(--ink);
  background: var(--panel);
}

.help-syntax-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--line-soft);
}

.help-syntax-section:first-of-type {
  border-top: none;
  padding-top: 0;
}

.help-syntax-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.help-syntax-text {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
}

.help-syntax-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--muted);
}

@media (max-width: 960px) {
  .help-syntax-layout {
    grid-template-columns: 1fr;
  }
}

---

## 📝 modals.css — ./styles/components/modals.css


.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 16, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 20;
}

.modal-panel {
  width: min(420px, 100%);
  background: var(--panel);
  border-radius: 18px;
  border: 1px solid var(--line-soft);
  padding: 20px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

---

## 📝 panel-layout.css — ./styles/components/panel-layout.css


.workspace .panel:nth-child(1) {
  animation-delay: 0.1s;
}

.workspace .panel:nth-child(2) {
  animation-delay: 0.16s;
}

.workspace .panel:nth-child(3) {
  animation-delay: 0.22s;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.focus-toggle {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid var(--accent-weak-border);
  background: var(--accent-weak-bg);
  color: var(--ink);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: 0.2s ease;
}

.focus-toggle:hover {
  border-color: var(--accent-border);
  background: var(--accent-hover-bg);
  color: var(--accent-strong);
}

.focus-toggle.active {
  background: var(--accent-active-bg);
  border-color: var(--accent-weak-border);
  color: var(--accent-strong);
}

.focus-toggle:focus-visible {
  outline: 2px solid var(--accent-focus-ring);
  outline-offset: 2px;
}

.focus-toggle svg {
  width: 18px;
  height: 18px;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-content {
  flex: 1;
  min-height: 0;
  display: flex;
}

.preview-edit-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
  align-self: flex-end;
}

.preview-edit-button {
  padding: 6px 10px;
  font-size: 0.8rem;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 240px;
}

.panel-body.preview-body {
  flex: 1;
  min-height: 0;
}

.workspace .panel-body {
  flex: 1;
  min-height: 0;
}

.list-panel .panel-body,
.preview-panel .panel-body {
  overflow: hidden;
}

---

## 📝 panels.css — ./styles/components/panels.css


.panel {
  background: var(--panel);
  border-radius: 20px;
  padding: 20px;
  box-shadow: var(--shadow-soft);
  border: 1px solid var(--line-soft);
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: riseIn 0.6s ease both;
}

.toolbar-panel .panel-body {
  min-height: auto;
}

.toolbar-panel .primary {
  width: 100%;
}

.flashcard-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.timer-start-button {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: var(--accent);
  color: var(--accent-contrast);
  font-weight: 600;
  transition: 0.2s ease;
  box-shadow: var(--shadow-soft);
}

.timer-start-button:not(.active):hover {
  background: var(--accent-strong);
}

.timer-start-button.active {
  background: var(--panel);
  border-color: var(--accent);
  color: var(--accent-strong);
  box-shadow: none;
}

.timer-start-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.timer-start-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.1;
}

.timer-start-meta {
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.8;
}

.timer-start-action {
  font-size: 0.95rem;
  font-weight: 700;
}

.timer-start-icon svg {
  width: 18px;
  height: 18px;
}

.pill-button {
  border: 1px solid transparent;
  cursor: pointer;
  transition: 0.2s ease;
}

.pill-button:hover {
  border-color: var(--accent-border);
}

.pill-button.active {
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: var(--shadow-soft);
}

.pill-button:focus-visible {
  outline: 2px solid var(--accent-focus-ring);
  outline-offset: 2px;
}

.pill-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

---

## 📝 preview.css — ./styles/components/preview.css


.file-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.file-item {
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--accent-weak-bg);
  border: 1px solid transparent;
  cursor: pointer;
  transition: 0.2s ease;
}

.file-item:hover {
  border-color: var(--accent-border);
}

.file-item.active {
  border-color: var(--accent-border);
  background: var(--accent-active-bg);
}

.file-name {
  font-size: 0.9rem;
  color: var(--ink);
}

.preview {
  margin: 0;
  padding: 16px;
  background-color: var(--md-surface-bg);
  color: var(--preview-ink);
  border-radius: 16px;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: auto;
}

.preview-editor {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--md-editor-border);
  background-color: var(--md-editor-bg);
  color: var(--preview-ink);
  font-family: var(--mono);
  font-size: 0.85rem;
  resize: none;
  caret-color: var(--md-editor-caret);
}

.preview.preview-editor.markdown {
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.6;
  white-space: normal;
}

.preview-editor:hover {
  border-color: var(--md-editor-border-hover);
}

.preview-editor:focus-visible {
  outline: none;
  border-color: var(--md-editor-focus-border);
  box-shadow: 0 0 0 2px var(--md-editor-focus-glow);
}

.preview-editor::selection {
  background: var(--md-editor-selection-bg);
  color: var(--preview-ink);
}

:root[data-md-editor-grid="on"] .preview-editor,
:root[data-md-editor-grid="on"] .preview.markdown,
:root[data-md-editor-grid="on"] .preview.raw {
  background-image:
    radial-gradient(
      circle at 50% 50%,
      var(--md-grid-line-color) 0,
      var(--md-grid-line-color) var(--md-grid-dot),
      transparent calc(var(--md-grid-dot) + 0.5px)
    ),
    radial-gradient(
      ellipse var(--md-grid-line) calc(var(--md-grid-stroke) / 2)
        at 50% calc(50% - var(--md-grid-cross-offset)),
      var(--md-grid-line-color) 0,
      var(--md-grid-line-color) 100%,
      transparent 100%
    ),
    radial-gradient(
      ellipse var(--md-grid-line) calc(var(--md-grid-stroke) / 2)
        at 50% calc(50% + var(--md-grid-cross-offset)),
      var(--md-grid-line-color) 0,
      var(--md-grid-line-color) 100%,
      transparent 100%
    ),
    radial-gradient(
      ellipse calc(var(--md-grid-stroke) / 2) var(--md-grid-line)
        at calc(50% - var(--md-grid-cross-offset)) 50%,
      var(--md-grid-line-color) 0,
      var(--md-grid-line-color) 100%,
      transparent 100%
    ),
    radial-gradient(
      ellipse calc(var(--md-grid-stroke) / 2) var(--md-grid-line)
        at calc(50% + var(--md-grid-cross-offset)) 50%,
      var(--md-grid-line-color) 0,
      var(--md-grid-line-color) 100%,
      transparent 100%
    );
  background-size: var(--md-grid-size) var(--md-grid-size);
  background-position: 0 0;
  background-repeat: repeat;
  background-attachment: local;
}

.preview.markdown ::selection,
.preview.raw ::selection {
  background: var(--md-selection-bg);
  color: var(--preview-ink);
}

.preview.raw {
  font-family: var(--mono);
  font-size: 0.85rem;
  white-space: pre-wrap;
}

.preview.raw pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: inherit;
}

.preview.markdown {
  font-size: 0.95rem;
  line-height: 1.6;
}

.preview.markdown > :first-child {
  margin-top: 0;
}

.preview.markdown h1 {
  font-size: 1.4rem;
  margin: 0 0 0.6rem;
}

.preview.markdown h2 {
  font-size: 1.2rem;
  margin: 1.2rem 0 0.6rem;
}

.preview.markdown h3 {
  font-size: 1.05rem;
  margin: 1rem 0 0.5rem;
}

.preview.markdown p {
  margin: 0 0 0.8rem;
}

.preview.markdown ul,
.preview.markdown ol {
  margin: 0 0 0.8rem;
  padding-left: 1.4rem;
}

.preview.markdown a {
  color: var(--md-link);
  text-decoration: underline;
}

.preview.markdown a:hover {
  color: var(--md-link-hover);
}

.preview.markdown code {
  font-family: var(--mono);
  font-size: 0.85rem;
  background: var(--preview-code-bg);
  border: 1px solid var(--preview-code-border);
  border-radius: 6px;
  padding: 2px 6px;
}

.preview.markdown pre {
  margin: 0 0 0.8rem;
  padding: 12px;
  background: var(--preview-code-bg);
  border: 1px solid var(--preview-code-border);
  border-radius: 12px;
  overflow-x: auto;
}

.preview.markdown pre code {
  background: transparent;
  border: none;
  padding: 0;
}

.preview.markdown blockquote {
  margin: 0 0 0.8rem;
  padding-left: 12px;
  border-left: 3px solid var(--md-blockquote-border);
  color: var(--preview-ink);
  opacity: 0.9;
}

.markdown-table {
  width: 100%;
  overflow-x: auto;
  margin: 0 0 0.8rem;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--md-table-bg);
}

.preview.markdown table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.preview.markdown thead th {
  background: var(--md-table-head-bg);
  text-align: left;
  font-weight: 600;
}

.preview.markdown th,
.preview.markdown td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--line-soft);
  border-right: 1px solid var(--line-soft);
}

.preview.markdown tr > :last-child {
  border-right: none;
}

.preview.markdown tbody tr:last-child th,
.preview.markdown tbody tr:last-child td {
  border-bottom: none;
}

.preview.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  flex: 1;
  min-height: 0;
  text-align: center;
  color: var(--muted);
  font-style: italic;
}

---

## 📝 responsive.css — ./styles/components/responsive.css


@media (max-width: 1200px) {
  .flashcard-layout {
    grid-template-columns: 1fr;
  }

  .fast-flashcard-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto auto;
  }

  .fast-stats-panel {
    grid-column: 1;
    grid-row: 1;
  }

  .fast-tools-panel {
    grid-column: 1;
    grid-row: 2;
  }

  .fast-history-panel {
    grid-column: 1;
    grid-row: 3;
  }

  .fast-session-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .fast-flashcard-panel {
    grid-column: 1;
    grid-row: 4;
  }

  .fast-stats-blocks {
    grid-template-columns: 1fr;
  }

  .spaced-repetition-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto auto auto;
  }

  .spaced-repetition-layout .sr-diagram-panel {
    grid-column: 1;
    grid-row: 1;
  }

  .spaced-repetition-layout .sr-user-panel {
    grid-column: 1;
    grid-row: 2;
  }

  .spaced-repetition-layout .sr-flashcards-panel {
    grid-column: 1;
    grid-row: 3;
  }

  .spaced-repetition-layout .sr-tools-panel {
    grid-column: 1;
    grid-row: 4;
  }

  .spaced-repetition-layout .sr-stats-panel {
    grid-column: 1;
    grid-row: 5;
  }

  .sr-stats-top {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 980px) {
  .app-shell,
  .app-shell.sidebar-collapsed {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: min(320px, 85vw);
    max-height: 100vh;
    overflow-y: auto;
    transform: translateX(-110%);
    transition: transform 0.2s ease;
    z-index: 30;
  }

  .app-shell.nav-open .sidebar {
    transform: translateX(0);
  }

  .app-shell.dashboard-active .content {
    overflow: auto;
  }

  .mobile-nav-header {
    display: flex;
  }

  .mobile-nav-close {
    display: inline-flex;
  }

  .app-shell.nav-open .mobile-nav-backdrop {
    opacity: 1;
    pointer-events: auto;
  }

  .dashboard-page {
    height: auto;
  }

  .workspace {
    grid-template-columns: 1fr;
    flex: 0 0 auto;
  }

  .workspace .panel,
  .workspace .vault-details {
    height: auto;
  }

  .sidebar {
    order: 1;
  }

  .content {
    order: 2;
  }
}

---

## 📝 settings.css — ./styles/components/settings.css


.settings-nav .nav-item {
  width: 100%;
}

.settings-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.settings-page .panel {
  min-width: 0;
}

.settings-single-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-app-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  align-items: start;
}

.settings-app-grid .vault-index-panel {
  grid-column: 1;
}

.settings-app-grid .settings-performance-panel {
  grid-column: 2;
}

.settings-review-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  align-items: stretch;
}

.settings-review-grid .panel {
  height: 100%;
}

.settings-tab-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-tab-header {
  flex-wrap: wrap;
  align-items: flex-start;
}

.settings-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.settings-tab-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 1200px) {
  .settings-app-grid {
    grid-template-columns: 1fr;
  }

  .settings-app-grid .vault-index-panel,
  .settings-app-grid .settings-performance-panel {
    grid-column: 1;
  }
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.settings-flashcards-panel .setting-row:first-of-type,
.fast-flashcard-tools-panel .setting-row:first-of-type,
.spaced-repetition-panel .setting-row:first-of-type {
  border-top: none;
  padding-top: 0;
}


.setting-subrow {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.spaced-repetition-layout .setting-row {
  border-top: none;
  padding-top: 0;
}

.setting-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.setting-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.status-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
}

.status-checkbox input {
  accent-color: var(--accent);
}

.appearance-panel .setting-row:first-of-type {
  border-top: none;
  padding-top: 0;
}

.appearance-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 320px);
  gap: 20px;
  align-items: start;
}

.appearance-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.appearance-editor-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--accent-weak-border);
  background: var(--accent-weak-bg);
}

.appearance-editor-header h3 {
  margin: 0;
  font-size: 1rem;
}

.appearance-editor-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.appearance-grid-intensity {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.appearance-grid-intensity .pill-grid {
  gap: 6px;
}

@media (max-width: 960px) {
  .appearance-layout {
    grid-template-columns: 1fr;
  }
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toggle-label {
  font-size: 0.85rem;
  color: var(--muted);
}

.switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 46px;
  height: 26px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--line);
  border-radius: 999px;
  transition: background 0.2s ease;
}

.slider::before {
  content: "";
  position: absolute;
  width: 20px;
  height: 20px;
  left: 3px;
  top: 3px;
  border-radius: 50%;
  background: var(--panel);
  box-shadow: var(--shadow-soft);
  transition: transform 0.2s ease;
}

.switch input:checked + .slider {
  background: var(--accent);
}

.switch input:checked + .slider::before {
  transform: translateX(20px);
}

.switch input:disabled + .slider {
  background: var(--line-soft);
  opacity: 0.6;
  cursor: not-allowed;
}

.text-input {
  min-width: 140px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--field-border);
  background: var(--field-bg);
  color: var(--ink);
  font-size: 0.85rem;
}

.text-input:focus-visible {
  outline: none;
  border-color: var(--accent-border);
  box-shadow: 0 0 0 2px var(--field-glow);
}

.text-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.accent-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.color-wheel {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--field-border);
  background: var(--field-bg);
  padding: 0;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.color-wheel::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-wheel::-webkit-color-swatch {
  border: none;
  border-radius: 10px;
}

.color-wheel::-moz-color-swatch {
  border: none;
  border-radius: 10px;
}

.accent-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.accent-swatch {
  width: 26px;
  height: 26px;
  border-radius: 9px;
  border: 2px solid transparent;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px var(--line-soft);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.accent-swatch:hover {
  transform: translateY(-1px);
}

.accent-swatch.active {
  box-shadow:
    inset 0 0 0 1px var(--line-soft),
    0 0 0 2px var(--panel),
    0 0 0 4px var(--accent-border);
}

.accent-hex {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hex-input {
  min-width: 120px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--field-border);
  background: var(--field-bg);
  color: var(--ink);
  font-family: var(--mono);
  font-size: 0.85rem;
}

.helper-text {
  font-size: 0.8rem;
  color: var(--muted);
}

.helper-text.error-text {
  color: var(--accent-strong);
}

.path-value {
  word-break: break-all;
  overflow-wrap: anywhere;
}

.pill-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.85rem;
  font-weight: 600;
}

---

## 📝 spaced-repetition.css — ./styles/components/spaced-repetition.css


.sr-vault-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sr-box-chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
  gap: 12px;
  align-items: end;
  min-height: 140px;
}

.sr-box-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
  border-radius: 16px;
  border: 1px solid transparent;
  background: transparent;
  padding: 10px 6px 8px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  font: inherit;
  color: inherit;
  text-align: center;
  appearance: none;
  -webkit-appearance: none;
}

.sr-box-column:focus-visible {
  outline: 2px solid var(--accent-focus-ring);
  outline-offset: 3px;
}

.sr-box-column.active {
  border-color: var(--accent-border);
  background: var(--accent-soft);
  box-shadow: 0 0 0 1px var(--accent-border);
}

.sr-box-count {
  font-weight: 700;
  font-size: 0.9rem;
}

.sr-box-label {
  font-size: 0.7rem;
  color: var(--muted);
}

.sr-box-bar {
  width: 100%;
  height: 120px;
  background: var(--panel);
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  display: flex;
  align-items: flex-end;
  padding: 6px;
}

.sr-box-bar-fill {
  width: 100%;
  height: var(--bar-height);
  background: linear-gradient(180deg, var(--accent) 0%, var(--accent-strong) 100%);
  border-radius: 10px;
  transition: height 0.2s ease;
}

---

## 📝 stats.css — ./styles/components/stats.css


.stats-panel .panel-body {
  min-height: auto;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.kpi-card {
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--block-bg);
  border: 1px solid var(--block-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kpi-label {
  color: var(--muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.kpi-value {
  font-weight: 700;
  font-size: 1.2rem;
}

.chart-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  background: var(--block-bg);
  border: 1px solid var(--block-border);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chart-meta {
  font-size: 0.75rem;
  color: var(--muted);
}

.chart-canvas {
  padding: 10px;
  border-radius: 12px;
  background: var(--panel);
  border: 1px solid var(--line-soft);
}

.sr-chart {
  width: 100%;
  height: 120px;
}

.sr-chart-axis {
  stroke: var(--line);
  stroke-width: 0.8;
}

.sr-chart-line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
}

.chart-axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--muted);
}

.stats-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.fast-stats-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.fast-stats-blocks {
  display: grid;
  grid-template-columns: minmax(0, 0.6fr) minmax(0, 1fr);
  gap: 12px;
}

.fast-time-block,
.fast-stats-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 16px;
  background: var(--block-bg);
  border: 1px solid var(--block-border);
}

.fast-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.fast-stats-block-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.fast-stats-grid {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.fast-stats-grid .stats-chart {
  justify-self: center;
}

.fast-stats-labels,
.fast-stats-values {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fast-stats-values {
  text-align: right;
}

.fast-time-meter {
  width: 100%;
  height: 14px;
  border-radius: 999px;
  background: var(--chip-bg);
  border: 1px solid var(--line-soft);
  position: relative;
  overflow: hidden;
}

.fast-time-meter::after {
  content: "";
  position: absolute;
  inset: 0;
  width: var(--fast-time-progress, 0%);
  background: linear-gradient(90deg, var(--accent) 0%, var(--accent-highlight) 100%);
  box-shadow: 0 0 8px var(--accent-glow);
  transition: width 0.2s ease;
}

.fast-time-status {
  font-size: 0.8rem;
  color: var(--muted);
}

.fast-time-status.active {
  color: var(--ink);
}

.fast-time-scale {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--muted);
}

.fast-session-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fast-history-sections {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.fast-section-title {
  margin: 0 0 4px;
  font-size: 1.05rem;
}

.fast-session-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.fast-session-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 16px;
  border: 1px solid var(--block-border);
  background: var(--block-bg);
}

.fast-session-value {
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.1;
}

.fast-session-sub {
  font-size: 0.75rem;
  color: var(--muted);
}

.fast-session-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fast-session-row {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) repeat(3, minmax(0, 0.7fr));
  gap: 8px;
  align-items: center;
  font-size: 0.85rem;
}

.fast-session-row.header {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.fast-session-cell {
  text-align: right;
}

.fast-session-cell.timestamp {
  text-align: left;
}

.stats-counters {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-counter {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.stats-label {
  color: var(--muted);
  font-size: 0.85rem;
}

.stats-value {
  font-weight: 700;
  font-size: 1.1rem;
}

.stats-chart {
  --stats-primary: var(--accent);
  --stats-secondary: var(--error-ink);
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: conic-gradient(
    var(--stats-primary) 0 var(--correct-percent),
    var(--stats-secondary) var(--correct-percent) 100%
  );
  position: relative;
  flex-shrink: 0;
}

.stats-chart::after {
  content: "";
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  background: var(--panel);
  border: 1px solid var(--line-soft);
  z-index: 1;
}

.stats-chart.empty {
  background: conic-gradient(var(--line) 0 100%);
}

.stats-chart-label {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  z-index: 2;
  pointer-events: none;
}

.stats-chart-total {
  font-weight: 700;
  font-size: 1.1rem;
}

.stats-chart-caption {
  font-size: 0.7rem;
  color: var(--muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sr-stats-top {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.9fr);
  gap: 16px;
  align-items: start;
}

.sr-stats-left,
.sr-stats-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sr-stats-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.sr-stats-right .stats-summary {
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

.sr-stats-right .stats-counters {
  width: 100%;
}

.sr-stats-right .stats-counter {
  width: 100%;
}

.sr-box-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  background: var(--block-bg);
  border: 1px solid var(--block-border);
}

.sr-box-chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sr-vault-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  background: var(--block-bg);
  border: 1px solid var(--block-border);
}

---

## 📝 utility.css — ./styles/components/utility.css


.empty-state {
  padding: 18px;
  border-radius: 16px;
  border: 1px dashed var(--block-border);
  color: var(--muted);
  background: var(--block-bg);
}

.error {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--error-bg);
  border: 1px solid var(--error-border);
  color: var(--error-ink);
}

.chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--chip-bg);
  font-size: 0.8rem;
  color: var(--muted);
}

---

## 📝 layout.css — ./styles/layout.css

.app-shell {
  --sidebar-width: 260px;
  --sidebar-collapsed-width: 36px;
  position: relative;
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: minmax(0, 1fr);
  gap: 24px;
  padding: 24px;
  min-height: 100vh;
  height: 100vh;
  animation: riseIn 0.6s ease both;
  transition: grid-template-columns 0.2s ease;
}

.app-shell.sidebar-collapsed {
  --sidebar-width: var(--sidebar-collapsed-width);
}

.app-shell.dashboard-active {
  height: 100vh;
  grid-template-rows: minmax(0, 1fr);
}

.app-shell.dashboard-active .content {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.app-shell::before {
  content: "";
  position: absolute;
  inset: 32px 40px auto auto;
  width: 240px;
  height: 240px;
  background: var(--glow);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.app-shell > * {
  position: relative;
  z-index: 1;
}

.sidebar {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: var(--panel);
  border-radius: 24px;
  padding: 24px;
  box-shadow: var(--shadow);
  border: 1px solid var(--line-soft);
  transition: padding 0.2s ease;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.sidebar.collapsed {
  padding: 8px 6px;
  gap: 0;
  align-items: stretch;
  justify-content: flex-start;
}

.sidebar-handle {
  position: absolute;
  inset: 0 auto 0 0;
  width: 8px;
  border: none;
  padding: 0;
  margin: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 24px 0 0 24px;
  transition: background 0.2s ease, color 0.2s ease;
  display: grid;
  place-items: center;
  z-index: 2;
}

.sidebar-handle:hover,
.sidebar-handle:focus-visible {
  background: rgba(255, 255, 255, 0.08);
  color: var(--accent-strong);
}

.sidebar-handle:focus-visible {
  outline: 2px solid var(--accent-focus-ring);
  outline-offset: 2px;
}

.sidebar-handle-chevron {
  font-size: 0.75rem;
  font-weight: 700;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.sidebar-handle:hover .sidebar-handle-chevron,
.sidebar-handle:focus-visible .sidebar-handle-chevron {
  opacity: 1;
}

.sidebar-head {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-divider {
  height: 1px;
  width: 100%;
  background: var(--line-soft);
  opacity: 0.6;
}

.sidebar-divider-muted {
  opacity: 0.35;
}

.sidebar-icon-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.sidebar-icon-button {
  width: 100%;
  height: 40px;
  border-radius: 12px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nav-item {
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink);
  padding: 12px 16px;
  border-radius: 14px;
  text-align: left;
  font-weight: 600;
  transition: 0.2s ease;
  cursor: pointer;
}

.nav-item:hover {
  background: var(--accent-hover-bg);
}

.nav-item.active {
  background: var(--accent-active-bg);
  border-color: var(--accent-weak-border);
  color: var(--accent-strong);
}

.nav-item-help {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.nav-subtext {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--muted);
}

.nav-item.active .nav-subtext {
  color: var(--accent-strong);
}

.vault-status {
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--accent-weak-bg);
  border: 1px solid var(--accent-weak-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  cursor: pointer;
  transition: 0.2s ease;
}

.vault-status:hover {
  border-color: var(--accent-border);
  color: var(--accent-strong);
}

.vault-status:focus-visible {
  outline: 2px solid var(--accent-focus-ring);
  outline-offset: 2px;
}

.nav-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--accent-weak-bg);
  border: 1px solid var(--accent-weak-border);
  display: grid;
  place-items: center;
  color: var(--ink);
  cursor: pointer;
  transition: 0.2s ease;
}

.nav-icon:hover {
  border-color: var(--accent-border);
  color: var(--accent);
}

.nav-icon.active {
  background: var(--accent-active-bg);
  border-color: var(--accent-weak-border);
  color: var(--accent-strong);
}

.nav-icon svg {
  width: 20px;
  height: 20px;
}

.sidebar-vault-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  height: 100%;
}

/* FIX: this wrapper must fill the remaining height and allow inner scroll areas to work */
.sidebar-mode-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-width: 0;

  flex: 1 1 auto;     /* added */
  min-height: 0;      /* added */
  overflow: hidden;   /* added: prevents “escape”, scroll happens in the inner list */
}

.sidebar .vault-details {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
  height: 100%;
  max-height: none;
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  overflow: hidden;
}

.sidebar .vault-details-header {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 4px;
}

.sidebar .vault-summary {
  display: block;
  width: 100%;
}

.sidebar .vault-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px 0 0;
}

/* This is the ONLY vertical scroll container for the tree */
.sidebar .vault-tree-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  background: var(--accent-weak-bg);
  border-radius: 16px;
  border: 1px solid var(--accent-weak-border);

  min-height: 0; /* added: helps nested flex children shrink/scroll correctly */
}

.label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: var(--muted);
}

.value {
  font-weight: 700;
}

.active-user-button {
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.active-user-button:not(:disabled):hover {
  color: var(--accent-strong);
  text-decoration: underline;
}

.active-user-button:focus-visible {
  outline: 2px solid var(--accent-focus-ring);
  outline-offset: 2px;
  border-radius: 6px;
}

.active-user-button:disabled {
  color: var(--muted);
  cursor: not-allowed;
}

.path {
  font-size: 0.85rem;
  color: var(--muted);
  word-break: break-all;
}

---

## 📝 tokens.css — ./styles/tokens.css

:root {
  font-family: "Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.5;
  font-weight: 400;
  color: var(--ink);
  background-color: var(--bg);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color-scheme: light;
  --bg: #f3efe6;
  --bg-strong: #ece6da;
  --page-bg-base: #f3efe6;
  --page-bg-spot-base: #f7dccb;
  --page-bg-edge-base: #e6f0ee;
  --page-bg: var(--bg-gradient);
  --panel: #ffffff;
  --panel-warm: #f8f2e8;
  --ink: #141717;
  --muted: #5b6265;
  --line: rgba(18, 24, 27, 0.12);
  --line-soft: rgba(18, 24, 27, 0.08);
  --block-bg-base: var(--panel);
  --block-bg: var(--block-bg-base);
  --block-border-base: var(--line-soft);
  --block-border: var(--block-border-base);
  --block-glow: transparent;
  --field-bg-base: var(--panel);
  --field-bg: var(--field-bg-base);
  --field-border-base: var(--line-soft);
  --field-border: var(--field-border-base);
  --field-glow: transparent;
  --accent: #e07a5f;
  --accent-rgb: 224, 122, 95;
  --accent-strong: #cc5c3f;
  --accent-soft: rgba(224, 122, 95, 0.14);
  --accent-highlight: #f2cc8f;
  --accent-border: rgba(224, 122, 95, 0.35);
  --accent-weak-bg: rgba(var(--accent-rgb), 0.06);
  --accent-hover-bg: rgba(var(--accent-rgb), 0.1);
  --accent-active-bg: rgba(var(--accent-rgb), 0.14);
  --accent-weak-border: rgba(var(--accent-rgb), 0.24);
  --accent-focus-ring: rgba(var(--accent-rgb), 0.38);
  --accent-glow: rgba(var(--accent-rgb), 0.28);
  --accent-contrast: #1a1a1a;
  --accent-contrast-strong: #ffffff;
  --shadow: 0 20px 40px rgba(19, 26, 28, 0.1);
  --shadow-soft: 0 12px 24px rgba(19, 26, 28, 0.08);
  --mono: "JetBrains Mono", "Fira Code", "IBM Plex Mono", monospace;
  --bg-gradient: radial-gradient(
    circle at top left,
    var(--page-bg-spot-base) 0%,
    var(--page-bg-base) 45%,
    var(--page-bg-edge-base) 100%
  );
  --preview-bg: var(--panel);
  --preview-ink: var(--ink);
  --preview-code-bg: #ffffff;
  --preview-code-border: var(--line-soft);
  --md-surface-bg: var(--preview-bg);
  --md-table-bg: var(--preview-bg);
  --md-table-head-bg: var(--accent-weak-bg);
  --md-link: var(--accent);
  --md-link-hover: var(--accent-strong);
  --md-blockquote-border: var(--accent);
  --md-selection-bg: var(--accent-soft);
  --md-editor-bg: var(--md-surface-bg);
  --md-editor-border: var(--line-soft);
  --md-editor-border-hover: var(--line);
  --md-editor-focus-border: var(--accent-border);
  --md-editor-focus-glow: transparent;
  --md-editor-selection-bg: var(--md-selection-bg);
  --md-editor-caret: var(--md-link);
  --md-grid-size: 28px;
  --md-grid-dot: 1px;
  --md-grid-stroke: 6px;
  --md-grid-cross-offset: 7px;
  --md-grid-line: 1px;
  --md-grid-line-neutral-light: rgba(20, 23, 23, 0.02);
  --md-grid-line-neutral-medium: rgba(20, 23, 23, 0.035);
  --md-grid-line-neutral-strong: rgba(20, 23, 23, 0.05);
  --md-grid-line-accent-light: transparent;
  --md-grid-line-accent-medium: transparent;
  --md-grid-line-accent-strong: transparent;
  --md-grid-line-accent: var(--md-grid-line-accent-medium);
  --md-grid-line-neutral: var(--md-grid-line-neutral-medium);
  --md-grid-line-color: var(--md-grid-line-accent);
  --chip-bg: rgba(20, 23, 23, 0.06);
  --glow: radial-gradient(circle, var(--accent-glow), transparent 70%);
  --error-bg: rgba(204, 92, 63, 0.12);
  --error-border: rgba(204, 92, 63, 0.3);
  --error-ink: #7a2e1c;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0f1417;
  --bg-strong: #121a1f;
  --page-bg-base: #0f1417;
  --page-bg-spot-base: #1b2a33;
  --page-bg-edge-base: #0b1012;
  --panel: #151c20;
  --panel-warm: #1b2429;
  --ink: #edf2f4;
  --muted: #a3abb0;
  --line: rgba(237, 242, 244, 0.16);
  --line-soft: rgba(237, 242, 244, 0.1);
  --block-bg-base: var(--panel);
  --block-bg: var(--block-bg-base);
  --block-border-base: var(--line-soft);
  --block-border: var(--block-border-base);
  --block-glow: transparent;
  --shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
  --shadow-soft: 0 12px 24px rgba(0, 0, 0, 0.3);
  --bg-gradient: radial-gradient(
    circle at top left,
    var(--page-bg-spot-base) 0%,
    var(--page-bg-base) 55%,
    var(--page-bg-edge-base) 100%
  );
  --preview-bg: var(--panel);
  --preview-ink: var(--ink);
  --preview-code-bg: #000000;
  --preview-code-border: var(--line-soft);
  --accent-weak-bg: rgba(var(--accent-rgb), 0.05);
  --accent-hover-bg: rgba(var(--accent-rgb), 0.08);
  --accent-active-bg: rgba(var(--accent-rgb), 0.12);
  --accent-weak-border: rgba(var(--accent-rgb), 0.2);
  --accent-focus-ring: rgba(var(--accent-rgb), 0.32);
  --accent-glow: rgba(var(--accent-rgb), 0.24);
  --md-grid-line-neutral-light: rgba(0, 0, 0, 0.035);
  --md-grid-line-neutral-medium: rgba(0, 0, 0, 0.055);
  --md-grid-line-neutral-strong: rgba(0, 0, 0, 0.07);
  --chip-bg: rgba(237, 242, 244, 0.08);
  --glow: radial-gradient(circle, var(--accent-glow), transparent 70%);
  --error-bg: rgba(204, 92, 63, 0.2);
  --error-border: rgba(204, 92, 63, 0.45);
  --error-ink: #f6c1b2;
}

@supports (color: color-mix(in srgb, white 50%, black)) {
  :root {
    --page-bg: radial-gradient(
      circle at top left,
      color-mix(in srgb, var(--page-bg-spot-base) 94%, var(--accent) 6%) 0%,
      color-mix(in srgb, var(--page-bg-base) 96%, var(--accent) 4%) 45%,
      color-mix(in srgb, var(--page-bg-edge-base) 96%, var(--accent) 4%) 100%
    );
    --field-bg: color-mix(in srgb, var(--field-bg-base) 95%, var(--accent) 5%);
    --field-border: color-mix(
      in srgb,
      var(--field-border-base) 90%,
      var(--accent) 10%
    );
    --field-glow: color-mix(in srgb, var(--accent) 18%, transparent);
    --block-bg: color-mix(in srgb, var(--block-bg-base) 95%, var(--accent) 5%);
    --block-border: color-mix(
      in srgb,
      var(--block-border-base) 92%,
      var(--accent) 8%
    );
    --block-glow: color-mix(in srgb, var(--accent) 12%, transparent);
    --accent-weak-bg: color-mix(in srgb, var(--panel) 94%, var(--accent) 6%);
    --accent-hover-bg: color-mix(in srgb, var(--panel) 90%, var(--accent) 10%);
    --accent-active-bg: color-mix(in srgb, var(--panel) 86%, var(--accent) 14%);
    --accent-weak-border: color-mix(
      in srgb,
      var(--line-soft) 70%,
      var(--accent) 30%
    );
    --accent-focus-ring: color-mix(in srgb, var(--accent) 45%, transparent);
    --accent-glow: color-mix(in srgb, var(--accent) 26%, transparent);
    --md-surface-bg: color-mix(in srgb, var(--preview-bg) 94%, var(--md-link) 6%);
    --md-table-bg: color-mix(in srgb, var(--preview-bg) 94%, var(--md-link) 6%);
    --md-table-head-bg: color-mix(in srgb, var(--preview-bg) 88%, var(--md-link) 12%);
    --md-editor-focus-glow: color-mix(in srgb, var(--md-link) 22%, transparent);
    --md-grid-line-accent-light: color-mix(
      in srgb,
      var(--md-link) 3%,
      transparent
    );
    --md-grid-line-accent-medium: color-mix(
      in srgb,
      var(--md-link) 4%,
      transparent
    );
    --md-grid-line-accent-strong: color-mix(
      in srgb,
      var(--md-link) 5%,
      transparent
    );
  }

  :root[data-theme="dark"] {
    --block-bg: color-mix(in srgb, var(--block-bg-base) 94%, var(--accent) 6%);
    --block-border: color-mix(
      in srgb,
      var(--block-border-base) 90%,
      var(--accent) 10%
    );
    --block-glow: color-mix(in srgb, var(--accent) 14%, transparent);
    --accent-weak-bg: color-mix(in srgb, var(--panel) 96%, var(--accent) 4%);
    --accent-hover-bg: color-mix(in srgb, var(--panel) 93%, var(--accent) 7%);
    --accent-active-bg: color-mix(in srgb, var(--panel) 90%, var(--accent) 10%);
    --accent-weak-border: color-mix(
      in srgb,
      var(--line-soft) 65%,
      var(--accent) 35%
    );
    --accent-focus-ring: color-mix(in srgb, var(--accent) 50%, transparent);
    --accent-glow: color-mix(in srgb, var(--accent) 30%, transparent);
    --md-grid-line-accent-light: color-mix(
      in srgb,
      var(--md-link) 4%,
      transparent
    );
    --md-grid-line-accent-medium: color-mix(
      in srgb,
      var(--md-link) 6%,
      transparent
    );
    --md-grid-line-accent-strong: color-mix(
      in srgb,
      var(--md-link) 7%,
      transparent
    );
  }
}

:root[data-md-editor-grid-intensity="light"] {
  --md-grid-line-accent: var(--md-grid-line-accent-light);
  --md-grid-line-neutral: var(--md-grid-line-neutral-light);
}

:root[data-md-editor-grid-intensity="medium"] {
  --md-grid-line-accent: var(--md-grid-line-accent-medium);
  --md-grid-line-neutral: var(--md-grid-line-neutral-medium);
}

:root[data-md-editor-grid-intensity="strong"] {
  --md-grid-line-accent: var(--md-grid-line-accent-strong);
  --md-grid-line-neutral: var(--md-grid-line-neutral-strong);
}

:root[data-md-editor-colors="off"] {
  --md-surface-bg: var(--preview-bg);
  --md-table-bg: var(--preview-bg);
  --md-table-head-bg: var(--panel-warm);
  --md-link: var(--preview-ink);
  --md-link-hover: var(--preview-ink);
  --md-blockquote-border: var(--line);
  --md-selection-bg: var(--line-soft);
  --md-editor-focus-border: var(--line);
  --md-editor-focus-glow: var(--line-soft);
  --md-grid-line-color: var(--md-grid-line-neutral);
}

---

## 📝 vite-env.d.ts — ./vite-env.d.ts

/// <reference types="vite/client" />

---

