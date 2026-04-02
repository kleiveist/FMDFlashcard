/**
 * @file apps/fmd-desktop/src/features/flashcards/useFlashcardAreaToggle.ts
 *
 * Shared area-toggle state for Flashcard/Fast/Repetition result headers.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { asErrorMessage } from "../../lib/errors";
import {
  applyTaskAreaToggle,
  resolveTaskMutationScope,
} from "../../lib/taskAreaToggle";
import {
  addTaskWrapper,
  findTaskWrapper,
  removeTaskWrapper,
} from "../../lib/exam/autoCards";
import type { FlashcardSourceMeta } from "./useFlashcards";

type UseFlashcardAreaToggleOptions = {
  sourceByIndex: Record<number, FlashcardSourceMeta | null | undefined>;
  previewPath: string | null;
  setPreview: (contents: string) => void;
  onRescanVault: (source?: string) => Promise<boolean>;
  rescanSource: string;
};

type FlashcardAreaToggleState = {
  enabled: boolean;
  pending: boolean;
  disabledReason: string;
  error: string;
  notice: string;
};

const removeIndexKey = <T,>(
  map: Record<number, T>,
  cardIndex: number,
): Record<number, T> => {
  if (!(cardIndex in map)) {
    return map;
  }
  const next = { ...map };
  delete next[cardIndex];
  return next;
};

export const useFlashcardAreaToggle = ({
  sourceByIndex,
  previewPath,
  setPreview,
  onRescanVault,
  rescanSource,
}: UseFlashcardAreaToggleOptions) => {
  const [pendingByIndex, setPendingByIndex] = useState<Record<number, boolean>>({});
  const [errorByIndex, setErrorByIndex] = useState<Record<number, string>>({});
  const [noticeByIndex, setNoticeByIndex] = useState<Record<number, string>>({});
  const [optimisticByIndex, setOptimisticByIndex] = useState<Record<number, boolean>>({});
  const pendingByIndexRef = useRef<Record<number, boolean>>({});

  useEffect(() => {
    setOptimisticByIndex((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(prev).forEach((rawKey) => {
        const cardIndex = Number(rawKey);
        const sourceMeta = sourceByIndex[cardIndex];
        if (!sourceMeta) {
          return;
        }
        if (sourceMeta.cardWrapper === prev[cardIndex]) {
          delete next[cardIndex];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [sourceByIndex]);

  const resolveEnabled = useCallback(
    (cardIndex: number) => {
      if (typeof optimisticByIndex[cardIndex] === "boolean") {
        return optimisticByIndex[cardIndex];
      }
      return Boolean(sourceByIndex[cardIndex]?.cardWrapper);
    },
    [optimisticByIndex, sourceByIndex],
  );

  const resolveDisabledReason = useCallback(
    (cardIndex: number) => {
      const sourceMeta = sourceByIndex[cardIndex];
      const scopeResolution = resolveTaskMutationScope({
        sourcePath: sourceMeta?.sourcePath,
        sourceRange: sourceMeta?.sourceRange,
      });
      return scopeResolution.scope ? "" : scopeResolution.reason;
    },
    [sourceByIndex],
  );

  const getToggleState = useCallback(
    (cardIndex: number): FlashcardAreaToggleState => ({
      enabled: resolveEnabled(cardIndex),
      pending: Boolean(pendingByIndex[cardIndex]),
      disabledReason: resolveDisabledReason(cardIndex),
      error: errorByIndex[cardIndex] ?? "",
      notice: noticeByIndex[cardIndex] ?? "",
    }),
    [errorByIndex, noticeByIndex, pendingByIndex, resolveDisabledReason, resolveEnabled],
  );

  const toggleCardArea = useCallback(
    (cardIndex: number, nextEnabled: boolean) => {
      if (pendingByIndexRef.current[cardIndex]) {
        return;
      }

      const sourceMeta = sourceByIndex[cardIndex];
      const scopeResolution = resolveTaskMutationScope({
        sourcePath: sourceMeta?.sourcePath,
        sourceRange: sourceMeta?.sourceRange,
      });
      if (!scopeResolution.scope) {
        setErrorByIndex((prev) => ({
          ...prev,
          [cardIndex]: scopeResolution.reason,
        }));
        return;
      }

      const previousEnabled = resolveEnabled(cardIndex);
      const scope = scopeResolution.scope;
      pendingByIndexRef.current = {
        ...pendingByIndexRef.current,
        [cardIndex]: true,
      };
      setPendingByIndex((prev) => ({ ...prev, [cardIndex]: true }));
      setErrorByIndex((prev) => ({ ...prev, [cardIndex]: "" }));
      setNoticeByIndex((prev) => ({ ...prev, [cardIndex]: "" }));
      setOptimisticByIndex((prev) => ({ ...prev, [cardIndex]: nextEnabled }));

      const applyToggle = async () => {
        try {
          const toggleResult = await applyTaskAreaToggle({
            scope,
            nextEnabled,
            mutators: {
              findWrapper: findTaskWrapper,
              addWrapper: addTaskWrapper,
              removeWrapper: removeTaskWrapper,
            },
            readSource: (path) => invoke<string>("read_text_file", { path }),
            writeSource: (path, contents) =>
              invoke("write_text_file_atomic", {
                path,
                contents,
              }),
            onSourceUpdated: ({ contents, wroteFile }) => {
              if (wroteFile && previewPath === scope.sourcePath) {
                setPreview(contents);
              }
            },
            onRescanVault: () => onRescanVault(rescanSource),
          });

          if (!toggleResult.rescanOk) {
            setNoticeByIndex((prev) => ({
              ...prev,
              [cardIndex]: toggleResult.wroteFile
                ? "File saved, but vault refresh failed. Some views may update after a manual refresh."
                : "Vault refresh failed. Some views may update after a manual refresh.",
            }));
          }
        } catch (error) {
          setOptimisticByIndex((prev) => ({
            ...prev,
            [cardIndex]: previousEnabled,
          }));
          setErrorByIndex((prev) => ({
            ...prev,
            [cardIndex]: asErrorMessage(error, "Failed to update task wrapper."),
          }));
        } finally {
          pendingByIndexRef.current = removeIndexKey(pendingByIndexRef.current, cardIndex);
          setPendingByIndex((prev) => removeIndexKey(prev, cardIndex));
        }
      };

      void applyToggle();
    },
    [
      onRescanVault,
      previewPath,
      rescanSource,
      resolveEnabled,
      setPreview,
      sourceByIndex,
    ],
  );

  return {
    getToggleState,
    toggleCardArea,
  };
};
