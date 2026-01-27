/**
 * @file apps/fmd-desktop/src/features/exam/useExamFiles.ts
 *
 * Zweck:
 * - Stellt eine zentrale Exam-Datei-Liste aus dem Vault bereit.
 */

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parseExamTasks } from "../../lib/exam";
import type { LoadState } from "../../lib/types";
import type { VaultFile } from "../../lib/tree";

type UseExamFilesOptions = {
  files: VaultFile[];
  vaultPath: string | null;
};

export const useExamFiles = ({ files, vaultPath }: UseExamFilesOptions) => {
  const [examFiles, setExamFiles] = useState<VaultFile[]>([]);
  const [examFilesState, setExamFilesState] = useState<LoadState>("idle");
  const [examFilesError, setExamFilesError] = useState("");

  useEffect(() => {
    if (!vaultPath) {
      setExamFiles([]);
      setExamFilesState("idle");
      setExamFilesError("");
      return;
    }
    const markdownFiles = files.filter((file) =>
      file.relative_path.toLowerCase().endsWith(".md"),
    );
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
          const parsed = parseExamTasks(contents);
          return parsed.hasExamBlock ? file : null;
        }),
      );

      if (cancelled) {
        return;
      }

      const nextExamFiles: VaultFile[] = [];
      let failures = 0;

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          if (result.value) {
            nextExamFiles.push(result.value);
          }
        } else {
          failures += 1;
          console.warn("Failed to scan exam file", result.reason);
        }
      });

      if (failures > 0 && nextExamFiles.length === 0) {
        setExamFilesError("Exam files could not be scanned.");
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
