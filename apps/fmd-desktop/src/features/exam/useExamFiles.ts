/**
 * @file apps/fmd-desktop/src/features/exam/useExamFiles.ts
 *
 * Zweck:
 * - Stellt eine zentrale Exam-Datei-Liste aus dem Vault bereit.
 */

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parseExamTasks } from "../../lib/exam";
import { asErrorMessage } from "../../lib/errors";
import { compareNaturalPath } from "../../lib/naturalSort";
import type { LoadState } from "../../lib/types";
import type { VaultFile } from "../../lib/tree";
import { type ExamFileEntry } from "./types";

type UseExamFilesOptions = {
  files: VaultFile[];
  vaultPath: string | null;
};

type ExamFileClassification = Pick<
  ExamFileEntry,
  "status" | "taskCount" | "hasExamBlock" | "error"
>;

export const classifyExamMarkdown = (contents: string): ExamFileClassification => {
  const trimmed = contents.trim();
  if (!trimmed) {
    return {
      status: "empty",
      taskCount: 0,
      hasExamBlock: false,
      error: null,
    };
  }

  const parsed = parseExamTasks(contents);
  const taskCount = parsed.tasks.length;
  const hasExamBlock = parsed.hasExamBlock;
  const status = hasExamBlock && taskCount > 0 ? "valid" : "no-tasks";

  return {
    status,
    taskCount,
    hasExamBlock,
    error: null,
  };
};

export const buildExamFileErrorEntry = (file: VaultFile, error: unknown): ExamFileEntry => ({
  ...file,
  status: "error",
  taskCount: 0,
  hasExamBlock: false,
  error: asErrorMessage(error, "Datei konnte nicht gelesen werden."),
});

export const useExamFiles = ({ files, vaultPath }: UseExamFilesOptions) => {
  const [examFiles, setExamFiles] = useState<ExamFileEntry[]>([]);
  const [examFilesState, setExamFilesState] = useState<LoadState>("idle");
  const [examFilesError, setExamFilesError] = useState("");

  useEffect(() => {
    if (!vaultPath) {
      setExamFiles([]);
      setExamFilesState("idle");
      setExamFilesError("");
      return;
    }

    const markdownFiles = files
      .filter((file) => file.relative_path.toLowerCase().endsWith(".md"))
      .slice()
      .sort((left, right) => compareNaturalPath(left.relative_path, right.relative_path));

    if (markdownFiles.length === 0) {
      setExamFiles([]);
      setExamFilesState("idle");
      setExamFilesError("");
      return;
    }

    let cancelled = false;
    setExamFilesState("loading");
    setExamFilesError("");

    const scanFiles = async () => {
      const results = await Promise.allSettled(
        markdownFiles.map(async (file) => {
          const contents = await invoke<string>("read_text_file", {
            path: file.path,
          });
          return {
            ...file,
            ...classifyExamMarkdown(contents),
          } satisfies ExamFileEntry;
        }),
      );

      if (cancelled) {
        return;
      }

      const nextExamFiles: ExamFileEntry[] = [];
      let failures = 0;

      results.forEach((result, index) => {
        const file = markdownFiles[index];
        if (!file) {
          return;
        }
        if (result.status === "fulfilled") {
          nextExamFiles.push(result.value);
          return;
        }

        failures += 1;
        nextExamFiles.push(buildExamFileErrorEntry(file, result.reason));
        console.warn("Failed to scan exam file", file.path, result.reason);
      });

      if (failures > 0 && nextExamFiles.length > 0) {
        setExamFilesError(
          `${failures} Markdown-Datei(en) konnten nicht vollstaendig gescannt werden.`,
        );
      }

      setExamFiles(nextExamFiles);
      setExamFilesState("idle");
    };

    void scanFiles();

    return () => {
      cancelled = true;
    };
  }, [files, vaultPath]);

  return { examFiles, examFilesState, examFilesError };
};
