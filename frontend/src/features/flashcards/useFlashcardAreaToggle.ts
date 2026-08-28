/**
 * @file frontend/src/features/flashcards/useFlashcardAreaToggle.ts
 *
 * Shared staged area-toggle state for Flashcard/Fast/Repetition result headers.
 */

import { useCallback } from "react";
import { resolveTaskMutationScope, type TaskMutationScope } from "../../lib/taskAreaToggle";
import type { FlashcardSourceMeta } from "./useFlashcards";

type UseFlashcardAreaToggleOptions = {
  sourceByIndex: Record<number, FlashcardSourceMeta | null | undefined>;
  stageTaskAreaToggle: (scope: TaskMutationScope, nextEnabled: boolean) => void;
  getStagedTaskAreaToggle: (scope: TaskMutationScope) => boolean | null;
  getTaskAreaToggleNotice: (scope: TaskMutationScope) => string;
};

type FlashcardAreaToggleState = {
  enabled: boolean;
  pending: boolean; // reserved for future async staged operations
  disabledReason: string;
  error: string;
  notice: string;
};

export const useFlashcardAreaToggle = ({
  sourceByIndex,
  stageTaskAreaToggle,
  getStagedTaskAreaToggle,
  getTaskAreaToggleNotice,
}: UseFlashcardAreaToggleOptions) => {
  const resolveScope = useCallback(
    (cardIndex: number) => {
      const sourceMeta = sourceByIndex[cardIndex];
      return resolveTaskMutationScope({
        sourcePath: sourceMeta?.sourcePath,
        sourceRange: sourceMeta?.sourceRange,
      });
    },
    [sourceByIndex],
  );

  const resolveEnabled = useCallback(
    (cardIndex: number) => {
      const scopeResolution = resolveScope(cardIndex);
      if (scopeResolution.scope) {
        const stagedValue = getStagedTaskAreaToggle(scopeResolution.scope);
        if (typeof stagedValue === "boolean") {
          return stagedValue;
        }
      }
      return Boolean(sourceByIndex[cardIndex]?.cardWrapper);
    },
    [getStagedTaskAreaToggle, resolveScope, sourceByIndex],
  );

  const resolveDisabledReason = useCallback(
    (cardIndex: number) => {
      const scopeResolution = resolveScope(cardIndex);
      return scopeResolution.scope ? "" : scopeResolution.reason;
    },
    [resolveScope],
  );

  const resolveNotice = useCallback(
    (cardIndex: number) => {
      const scopeResolution = resolveScope(cardIndex);
      if (!scopeResolution.scope) {
        return "";
      }
      return getTaskAreaToggleNotice(scopeResolution.scope);
    },
    [getTaskAreaToggleNotice, resolveScope],
  );

  const getToggleState = useCallback(
    (cardIndex: number): FlashcardAreaToggleState => ({
      enabled: resolveEnabled(cardIndex),
      pending: false,
      disabledReason: resolveDisabledReason(cardIndex),
      error: "",
      notice: resolveNotice(cardIndex),
    }),
    [resolveDisabledReason, resolveEnabled, resolveNotice],
  );

  const toggleCardArea = useCallback(
    (cardIndex: number, nextEnabled: boolean) => {
      const scopeResolution = resolveScope(cardIndex);
      if (!scopeResolution.scope) {
        return;
      }
      stageTaskAreaToggle(scopeResolution.scope, nextEnabled);
    },
    [resolveScope, stageTaskAreaToggle],
  );

  return {
    getToggleState,
    toggleCardArea,
  };
};
