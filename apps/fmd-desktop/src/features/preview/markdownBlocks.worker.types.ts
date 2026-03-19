/**
 * @file apps/fmd-desktop/src/features/preview/markdownBlocks.worker.types.ts
 *
 * Shared request/response types for markdown parse worker messaging.
 * Keep this separate from the worker entrypoint so the main-thread hook
 * does not import the worker module itself.
 */

import type {
  MarkdownDocumentSnapshot,
  MarkdownParseStats,
} from "./markdownDocumentModel";

type WorkerParseRequest = {
  type: "parse";
  requestId: number;
  nextVersion: number;
  markdown: string;
  previousSnapshot: MarkdownDocumentSnapshot | null;
};

type WorkerParseSuccessResponse = {
  type: "parsed";
  requestId: number;
  snapshot: MarkdownDocumentSnapshot;
  stats: MarkdownParseStats;
};

type WorkerParseErrorResponse = {
  type: "error";
  requestId: number;
  message: string;
};

export type MarkdownBlockWorkerRequest = WorkerParseRequest;

export type MarkdownBlockWorkerResponse =
  | WorkerParseSuccessResponse
  | WorkerParseErrorResponse;
