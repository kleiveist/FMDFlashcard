import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parseFlashcards, type Flashcard } from "../../lib/flashcards";
import {
  calculateFlashcardStats,
  getClozeDragPayload,
  handleClozeBlankDragOver,
  handleClozeTokenDragStart,
  shuffleFlashcards,
  type FlashcardSelfGrade,
  type TrueFalseSelection,
} from "./logic";
import { type VaultFile } from "../../lib/tree";

export type FlashcardOrder = "in-order" | "random";
export type FlashcardMode = "multiple-choice" | "yes-no";
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

type ScanOptions = {
  scopeOverride?: FlashcardScope;
  allowVaultFallback?: boolean;
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
      flashcardPage,
    }),
    [
      flashcardClozeResponses,
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
      setFlashcardPage(snapshot.flashcardPage);
    },
    [],
  );

  const resolvedFlashcardPageSize = useMemo(
    () => normalizeFlashcardPageSize(flashcardPageSize),
    [flashcardPageSize],
  );

  const flashcardPageCount = useMemo(
    () => Math.ceil(flashcards.length / resolvedFlashcardPageSize),
    [flashcards.length, resolvedFlashcardPageSize],
  );

  const flashcardPageIndex = useMemo(
    () => Math.min(flashcardPage, Math.max(0, flashcardPageCount - 1)),
    [flashcardPage, flashcardPageCount],
  );

  const flashcardPageStart = flashcardPageIndex * resolvedFlashcardPageSize;

  const visibleFlashcards = useMemo(() => {
    return flashcards.slice(
      flashcardPageStart,
      flashcardPageStart + resolvedFlashcardPageSize,
    );
  }, [flashcards, flashcardPageStart, resolvedFlashcardPageSize]);

  const canGoBack = flashcardPageIndex > 0;
  const canGoNext = flashcardPageIndex < flashcardPageCount - 1;

  const { correctCount, incorrectCount, correctPercent } = useMemo(
    () =>
      calculateFlashcardStats(
        flashcards,
        flashcardSubmissions,
        flashcardSelections,
        flashcardTrueFalseSelections,
        flashcardClozeResponses,
        flashcardSelfGrades,
      ),
    [
      flashcards,
      flashcardClozeResponses,
      flashcardSelections,
      flashcardSelfGrades,
      flashcardSubmissions,
      flashcardTrueFalseSelections,
    ],
  );

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

        return flashcardOrder === "random" ? shuffleFlashcards(merged) : merged;
      }

      const cards = parseFlashcards(preview);
      return flashcardOrder === "random" ? shuffleFlashcards(cards) : cards;
    },
    [files, flashcardOrder, flashcardScope, preview, selectedFile, vaultPath],
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
    visibleFlashcards,
    correctPercent,
  };
};
