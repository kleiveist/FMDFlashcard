import type { VaultFile } from "./tree";

const MARKDOWN_FILE_PATTERN = /\.(md|markdown|mdx)$/i;
const CANVAS_FILE_PATTERN = /\.canvas$/i;

export type VaultDocumentKind = "markdown" | "canvas" | "unknown";

export const isMarkdownFilePath = (value: string) =>
  MARKDOWN_FILE_PATTERN.test(value);

export const isCanvasFilePath = (value: string) =>
  CANVAS_FILE_PATTERN.test(value);

export const resolveVaultDocumentKind = (value: string): VaultDocumentKind => {
  if (isMarkdownFilePath(value)) {
    return "markdown";
  }
  if (isCanvasFilePath(value)) {
    return "canvas";
  }
  return "unknown";
};

export const resolveVaultFileDocumentKind = (file: VaultFile): VaultDocumentKind =>
  resolveVaultDocumentKind(file.relative_path || file.path);

