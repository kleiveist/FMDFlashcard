/**
 * @file apps/fmd-desktop/src/pages/spaced-repetition/hooks/useSrSessionViewModel.ts
 *
 * Zweck:
 * - Stellt den Hook useSrSessionViewModel fuer Spaced Repetition bereit.
 *
 * Verantwortlichkeiten:
 * - Verwaltet State und Ableitungen fuer Spaced Repetition.
 * - Stellt Aktionen und Handler fuer die UI bereit.
 * - Bietet konsolidierte Daten fuer Komponenten.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/AppStateProvider.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/lib/path.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/features/flashcards/logic.ts: Feature-Logik oder Hook.
 *
 * Exportiert:
 * - useSrSessionViewModel: Hook fuer Spaced Repetition.
 *
 * Hinweise:
 * - Hook darf nur innerhalb von React-Komponenten genutzt werden.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { useAppState } from "../../../components/AppStateProvider";
import { vaultBaseName } from "../../../lib/path";
import {
  formatBinding,
  getEffectiveBinding,
  getShortcutPlatform,
  isEditableTarget,
  matchesBinding,
} from "../../../lib/shortcuts/bindings";
import { getShortcutById } from "../../../lib/shortcuts/registry";
import {
  areClozeBlanksComplete,
  areTrueFalseItemsComplete,
  isFlashcardPartComplete,
} from "../../../features/flashcards/logic";
import { matchesFlashcardMode } from "../../../features/flashcards/useFlashcards";
import { resolveFlashcardAutoCardTypeInstances } from "../../../lib/exam/autoCards";
import { resolveAutoCardTypeValueSum } from "../../../lib/exam/pointsScoring";
import {
  getFlashcardId,
  getSpacedRepetitionEffectiveBox,
  hashString,
  normalizeSpacedRepetitionCardProgress,
} from "../../../features/spaced-repetition/logic";

const srToggleCommand = getShortcutById("toggleViewMode");
const srPrevCommand = getShortcutById("studyPrevious");
const srNextCommand = getShortcutById("studyNext");
const srSubmitCommand = getShortcutById("studySubmit");

export const useSrSessionViewModel = () => {
  const { flashcards, settings, spacedRepetition, vault } = useAppState();
  const spacedRepetitionHelpEnabled = settings.spacedRepetitionHelpEnabled;
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [activeBoxFilter, setActiveBoxFilter] = useState<number | null>(null);
  const [autoTimeRemainingSeconds, setAutoTimeRemainingSeconds] =
    useState<number | null>(null);
  const autoTimeTimerRef = useRef<number | null>(null);
  const flashcardFilterMode = settings.flashcardMode;
  const setFlashcardFilterMode = settings.setFlashcardMode;
  const statsView = spacedRepetition.spacedRepetitionStatsView;
  const platform = getShortcutPlatform();
  const shortcutBindings = useMemo(() => {
    const bindings = settings.keyboardShortcuts.bindings;
    return {
      toggle: srToggleCommand
        ? getEffectiveBinding(srToggleCommand, bindings, platform)
        : null,
      prev: srPrevCommand ? getEffectiveBinding(srPrevCommand, bindings, platform) : null,
      next: srNextCommand ? getEffectiveBinding(srNextCommand, bindings, platform) : null,
      submit: srSubmitCommand
        ? getEffectiveBinding(srSubmitCommand, bindings, platform)
        : null,
    };
  }, [platform, settings.keyboardShortcuts.bindings]);
  const viewLabel = "View";
  const toggleShortcutLabel = shortcutBindings.toggle
    ? formatBinding(shortcutBindings.toggle, platform)
    : null;
  const focusTitle = toggleShortcutLabel
    ? `${viewLabel} (${toggleShortcutLabel})`
    : viewLabel;
  const prevShortcutTitle = shortcutBindings.prev
    ? `Back (${formatBinding(shortcutBindings.prev, platform)})`
    : "Back";
  const nextShortcutTitle = shortcutBindings.next
    ? `Next (${formatBinding(shortcutBindings.next, platform)})`
    : "Next";
  const vaultId = useMemo(
    () => (vault.vaultPath ? hashString(vault.vaultPath) : null),
    [vault.vaultPath],
  );
  const cardIdContext = useMemo(
    () => (vaultId ? { vaultId } : undefined),
    [vaultId],
  );
  const vaultName = useMemo(
    () => (vault.vaultPath ? vaultBaseName(vault.vaultPath) : "—"),
    [vault.vaultPath],
  );
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
  const flashcardEntries = useMemo(
    () =>
      spacedRepetition.spacedRepetitionFlashcards.map((card, cardIndex) => ({
        card,
        cardIndex,
      })),
    [spacedRepetition.spacedRepetitionFlashcards],
  );
  const filteredFlashcardEntries = useMemo(() => {
    let entries = flashcardEntries;

    if (
      activeBoxFilter !== null &&
      statsView === "boxes" &&
      spacedRepetition.spacedRepetitionCardStates
    ) {
      entries = entries.filter(({ card }) => {
        const cardId = getFlashcardId(card, cardIdContext);
        const progress = spacedRepetition.spacedRepetitionCardStates[cardId] ?? null;
        const normalized = normalizeSpacedRepetitionCardProgress(progress);
        const effectiveBox = getSpacedRepetitionEffectiveBox(
          normalized,
          spacedRepetition.spacedRepetitionBoxes,
        );
        return effectiveBox === activeBoxFilter;
      });
    }

    if (flashcardFilterMode !== "all") {
      entries = entries.filter(({ card }) =>
        matchesFlashcardMode(card, flashcardFilterMode),
      );
    }

    return entries;
  }, [
    activeBoxFilter,
    cardIdContext,
    flashcardFilterMode,
    flashcardEntries,
    spacedRepetition.spacedRepetitionBoxes,
    spacedRepetition.spacedRepetitionCardStates,
    statsView,
  ]);
  const filteredPageCount = useMemo(() => {
    if (filteredFlashcardEntries.length === 0) {
      return 0;
    }
    return Math.ceil(
      filteredFlashcardEntries.length / spacedRepetition.spacedRepetitionPageSize,
    );
  }, [
    filteredFlashcardEntries.length,
    spacedRepetition.spacedRepetitionPageSize,
  ]);
  const filteredPageIndex = useMemo(() => {
    if (filteredPageCount === 0) {
      return 0;
    }
    return Math.min(
      spacedRepetition.spacedRepetitionPage,
      Math.max(0, filteredPageCount - 1),
    );
  }, [filteredPageCount, spacedRepetition.spacedRepetitionPage]);
  const filteredPageStart =
    filteredPageIndex * spacedRepetition.spacedRepetitionPageSize;
  const pagedFlashcardEntries = useMemo(
    () =>
      filteredFlashcardEntries.slice(
        filteredPageStart,
        filteredPageStart + spacedRepetition.spacedRepetitionPageSize,
      ),
    [
      filteredFlashcardEntries,
      filteredPageStart,
      spacedRepetition.spacedRepetitionPageSize,
    ],
  );
  const flashcardsPanelCanGoBack =
    filteredPageCount > 0 && filteredPageIndex > 0;
  const flashcardsPanelCanGoNext =
    filteredPageCount > 0 && filteredPageIndex < filteredPageCount - 1;
  const handleFlashcardsPanelPageBack = useCallback(() => {
    if (filteredPageCount === 0) {
      return;
    }
    spacedRepetition.setSpacedRepetitionPage(Math.max(0, filteredPageIndex - 1));
  }, [filteredPageCount, filteredPageIndex, spacedRepetition]);
  const handleFlashcardsPanelPageNext = useCallback(() => {
    if (filteredPageCount === 0) {
      return;
    }
    spacedRepetition.setSpacedRepetitionPage(
      Math.min(filteredPageCount - 1, filteredPageIndex + 1),
    );
  }, [filteredPageCount, filteredPageIndex, spacedRepetition]);
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

  const autoTimeEnabled = settings.spacedRepetitionAutoTimeEnabled;
  const activeTimedEntry = useMemo(() => {
    if (!autoTimeEnabled) {
      return null;
    }
    const unsubmittedVisibleEntries = pagedFlashcardEntries.filter(
      (entry) => !spacedRepetition.spacedRepetitionSubmissions[entry.cardIndex],
    );
    if (unsubmittedVisibleEntries.length === 0) {
      return null;
    }
    if (activeCardIndex !== null) {
      const activeEntry = unsubmittedVisibleEntries.find(
        (entry) => entry.cardIndex === activeCardIndex,
      );
      if (activeEntry) {
        return activeEntry;
      }
    }
    return unsubmittedVisibleEntries[0] ?? null;
  }, [
    activeCardIndex,
    autoTimeEnabled,
    pagedFlashcardEntries,
    spacedRepetition.spacedRepetitionSubmissions,
  ]);
  const activeTimedDurationSeconds = useMemo(() => {
    if (!activeTimedEntry) {
      return 0;
    }
    return resolveAutoCardTypeValueSum({
      taskTypes: resolveFlashcardAutoCardTypeInstances(activeTimedEntry.card),
      typeValues: settings.examTaskTypeDefaultTimeSeconds,
    });
  }, [activeTimedEntry, settings.examTaskTypeDefaultTimeSeconds]);
  const handleAutoTimeTimeout = useCallback(
    (cardIndex: number) => {
      if (spacedRepetition.spacedRepetitionSubmissions[cardIndex]) {
        return;
      }
      const timedCard = spacedRepetition.spacedRepetitionFlashcards[cardIndex];
      if (!timedCard) {
        return;
      }
      if (timedCard.kind === "free-text") {
        spacedRepetition.handleSpacedRepetitionSelfGrade(cardIndex, "incorrect");
        return;
      }
      spacedRepetition.handleSpacedRepetitionSubmit(cardIndex, true);
    },
    [
      spacedRepetition,
      spacedRepetition.spacedRepetitionFlashcards,
      spacedRepetition.spacedRepetitionSubmissions,
    ],
  );

  useEffect(() => {
    if (!autoTimeEnabled || !activeTimedEntry) {
      if (autoTimeTimerRef.current !== null) {
        window.clearInterval(autoTimeTimerRef.current);
        autoTimeTimerRef.current = null;
      }
      setAutoTimeRemainingSeconds(null);
      return;
    }

    if (activeTimedDurationSeconds <= 0) {
      setAutoTimeRemainingSeconds(0);
      handleAutoTimeTimeout(activeTimedEntry.cardIndex);
      return;
    }

    setAutoTimeRemainingSeconds(activeTimedDurationSeconds);
    if (autoTimeTimerRef.current !== null) {
      window.clearInterval(autoTimeTimerRef.current);
    }
    autoTimeTimerRef.current = window.setInterval(() => {
      setAutoTimeRemainingSeconds((prev) => {
        const next = prev === null ? activeTimedDurationSeconds : prev - 1;
        if (next <= 0) {
          if (autoTimeTimerRef.current !== null) {
            window.clearInterval(autoTimeTimerRef.current);
            autoTimeTimerRef.current = null;
          }
          handleAutoTimeTimeout(activeTimedEntry.cardIndex);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (autoTimeTimerRef.current !== null) {
        window.clearInterval(autoTimeTimerRef.current);
        autoTimeTimerRef.current = null;
      }
    };
  }, [
    activeTimedDurationSeconds,
    activeTimedEntry,
    autoTimeEnabled,
    handleAutoTimeTimeout,
  ]);

  const autoTimeCurrentSeconds =
    activeTimedEntry === null
      ? null
      : Math.max(0, autoTimeRemainingSeconds ?? activeTimedDurationSeconds);
  const autoTimeProgressPercent = !activeTimedEntry
    ? 100
    : activeTimedDurationSeconds > 0 && autoTimeCurrentSeconds !== null
      ? Math.round(
          Math.max(
            0,
            Math.min(1, autoTimeCurrentSeconds / activeTimedDurationSeconds),
          ) * 100,
        )
      : 0;
  const autoTimeIsRunning =
    autoTimeEnabled &&
    activeTimedEntry !== null &&
    (autoTimeCurrentSeconds ?? 0) > 0;
  const autoTimeIsTimeUp =
    autoTimeEnabled &&
    activeTimedEntry !== null &&
    (autoTimeCurrentSeconds ?? 0) <= 0;
  const autoTimeStatusLabel = !autoTimeEnabled
    ? "Auto Time disabled"
    : activeTimedEntry === null
      ? "No active timed card"
      : `Remaining: ${autoTimeCurrentSeconds ?? 0}s`;

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
    if (filteredPageCount === 0) {
      if (spacedRepetition.spacedRepetitionPage !== 0) {
        spacedRepetition.setSpacedRepetitionPage(0);
      }
      return;
    }
    if (spacedRepetition.spacedRepetitionPage !== filteredPageIndex) {
      spacedRepetition.setSpacedRepetitionPage(filteredPageIndex);
    }
  }, [
    filteredPageCount,
    filteredPageIndex,
    spacedRepetition,
    spacedRepetition.spacedRepetitionPage,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const isEditable = isEditableTarget(event.target);

      const canTrigger = (
        command: typeof srToggleCommand,
        binding: string | null,
      ) => {
        if (!command || !binding) {
          return false;
        }
        if (!command.allowInTextInputs && isEditable) {
          return false;
        }
        return matchesBinding(event, binding);
      };

      if (canTrigger(srToggleCommand, shortcutBindings.toggle)) {
        event.preventDefault();
        setIsFocusMode((prev) => !prev);
        return;
      }

      if (canTrigger(srPrevCommand, shortcutBindings.prev)) {
        event.preventDefault();
        if (flashcardsPanelCanGoBack) {
          handleFlashcardsPanelPageBack();
        }
        return;
      }

      if (canTrigger(srNextCommand, shortcutBindings.next)) {
        event.preventDefault();
        if (flashcardsPanelCanGoNext) {
          handleFlashcardsPanelPageNext();
        }
        return;
      }

      if (!canTrigger(srSubmitCommand, shortcutBindings.submit)) {
        return;
      }

      const visibleEntries = pagedFlashcardEntries;
      if (visibleEntries.length === 0) {
        return;
      }

      const findFirstSubmittableIndex = () => {
        for (const entry of visibleEntries) {
          const cardIndex = entry.cardIndex;
          const card = entry.card;
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
  }, [
    activeCardIndex,
    flashcardsPanelCanGoBack,
    flashcardsPanelCanGoNext,
    handleFlashcardsPanelPageBack,
    handleFlashcardsPanelPageNext,
    pagedFlashcardEntries,
    shortcutBindings,
    spacedRepetition,
  ]);

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
    flashcardFilterMode,
    setFlashcardFilterMode,
    focusLabel: focusTitle,
    prevShortcutTitle,
    nextShortcutTitle,
    vaultName,
    statsChartClass,
    statsChartStyle,
    maxBoxCount,
    filteredFlashcardEntries: pagedFlashcardEntries,
    flashcardsPanelCanGoBack,
    flashcardsPanelCanGoNext,
    handleFlashcardsPanelPageBack,
    handleFlashcardsPanelPageNext,
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
    spacedRepetitionHelpEnabled,
    autoTimeEnabled,
    setAutoTimeEnabled: settings.setSpacedRepetitionAutoTimeEnabled,
    autoTimeStatusLabel,
    autoTimeProgressPercent,
    autoTimeIsRunning,
    autoTimeIsTimeUp,
  };
};
