import type { VaultFile } from "../../lib/tree";

export type ExamFileStatus = "valid" | "empty" | "no-tasks" | "error";

export type ExamFileEntry = VaultFile & {
  taskCount: number;
  hasExamBlock: boolean;
  status: ExamFileStatus;
  error: string | null;
};

export const EXAM_FILE_STATUS_LABELS: Record<ExamFileStatus, string> = {
  valid: "valid",
  empty: "empty",
  "no-tasks": "no exam tasks detected",
  error: "error",
};

export const resolveExamFileStatusReason = (entry: ExamFileEntry) => {
  if (entry.error) {
    return entry.error;
  }
  switch (entry.status) {
    case "valid":
      return "File can be used as an exam.";
    case "empty":
      return "File is empty.";
    case "no-tasks":
      return entry.hasExamBlock
        ? "Exam block found, but no valid tasks were detected."
        : "No valid #exam ... #endexam block with tasks was detected.";
    case "error":
    default:
      return "File could not be read or parsed.";
  }
};

export const splitExamFilePathParts = (relativePath: string) => {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) {
    return { fileName: relativePath, folderPath: "" };
  }
  const fileName = parts[parts.length - 1] ?? relativePath;
  const folderPath = parts.slice(0, -1).join("/");
  return { fileName, folderPath };
};
