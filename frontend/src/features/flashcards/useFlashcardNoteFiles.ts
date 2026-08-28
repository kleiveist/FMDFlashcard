/**
 * @file frontend/src/features/flashcards/useFlashcardNoteFiles.ts
 *
 * Zweck:
 * - Liefert eine zentrale Liste von Markdown-Dateien mit gueltigen
 *   #card ... #endcard-Flashcard-Bloecken.
 */

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { LoadState } from "../../lib/types";
import type { VaultFile } from "../../lib/tree";
import type { FlashcardFileEntry } from "./useFlashcards";
import { parseFlashcards } from "../../lib/flashcards";

type UseFlashcardNoteFilesOptions = {
  files: VaultFile[];
  vaultPath: string | null;
};

const countFlashcardBlocks = (markdown: string) => parseFlashcards(markdown).length;

export const useFlashcardNoteFiles = ({
  files,
  vaultPath,
}: UseFlashcardNoteFilesOptions) => {
  const [noteFiles, setNoteFiles] = useState<FlashcardFileEntry[]>([]);
  const [noteFilesState, setNoteFilesState] = useState<LoadState>("idle");
  const [noteFilesError, setNoteFilesError] = useState("");

  useEffect(() => {
    if (!vaultPath) {
      setNoteFiles([]);
      setNoteFilesState("idle");
      setNoteFilesError("");
      return;
    }
    const markdownFiles = files.filter((file) =>
      file.relative_path.toLowerCase().endsWith(".md"),
    );
    if (markdownFiles.length === 0) {
      setNoteFiles([]);
      setNoteFilesState("idle");
      setNoteFilesError("");
      return;
    }

    let cancelled = false;
    setNoteFilesState("loading");
    setNoteFilesError("");

    const scanFiles = async () => {
      const results = await Promise.allSettled(
        markdownFiles.map(async (file) => {
          const contents = await invoke<string>("read_text_file", {
            path: file.path,
          });
          const flashcardCount = countFlashcardBlocks(contents);
          return flashcardCount > 0 ? { ...file, flashcardCount } : null;
        }),
      );

      if (cancelled) {
        return;
      }

      const nextFiles: FlashcardFileEntry[] = [];
      let failures = 0;

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          if (result.value) {
            nextFiles.push(result.value);
          }
        } else {
          failures += 1;
          console.warn("Failed to scan flashcard note file", result.reason);
        }
      });

      if (failures > 0 && nextFiles.length === 0) {
        setNoteFilesError("Flashcard-Dateien konnten nicht gescannt werden.");
      }

      setNoteFiles(nextFiles);
      setNoteFilesState("idle");
    };

    void scanFiles();

    return () => {
      cancelled = true;
    };
  }, [files, vaultPath]);

  return {
    noteFiles,
    noteFilesState,
    noteFilesError,
  };
};
