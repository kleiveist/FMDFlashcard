/**
 * @file apps/fmd-desktop/src/features/preview/markdownBlocks.worker.ts
 *
 * Purpose:
 * - Runs markdown block parsing off the main thread.
 * - Applies incremental parse updates when possible.
 */

import {
  parseMarkdownDocument,
  type MarkdownDocumentSnapshot,
} from "./markdownDocumentModel";
import { type MarkdownBlock } from "./markdownBlocks";
import type {
  MarkdownBlockWorkerRequest,
  MarkdownBlockWorkerResponse,
} from "./markdownBlocks.worker.types";

type WorkerContextLike = {
  postMessage: (response: MarkdownBlockWorkerResponse) => void;
  onmessage: ((event: MessageEvent<MarkdownBlockWorkerRequest>) => void) | null;
};

const sanitizeSnapshot = (
  snapshot: MarkdownDocumentSnapshot,
): MarkdownDocumentSnapshot => ({
  markdown: snapshot.markdown,
  version: snapshot.version,
  blocks: snapshot.blocks.map((block): MarkdownBlock => ({
    id: block.id,
    kind: block.kind,
    raw: block.raw,
    startLine: block.startLine,
    endLine: block.endLine,
    startOffset: block.startOffset,
    endOffset: block.endOffset,
    meta: block.meta,
  })),
});

const workerContext = self as unknown as WorkerContextLike;

workerContext.onmessage = (event: MessageEvent<MarkdownBlockWorkerRequest>) => {
  const request = event.data;
  if (!request || request.type !== "parse") {
    return;
  }

  try {
    const result = parseMarkdownDocument(
      request.markdown,
      request.previousSnapshot,
      request.nextVersion,
    );

    const response: MarkdownBlockWorkerResponse = {
      type: "parsed",
      requestId: request.requestId,
      snapshot: sanitizeSnapshot(result.snapshot),
      stats: result.stats,
    };

    workerContext.postMessage(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown markdown parse worker error.";
    const response: MarkdownBlockWorkerResponse = {
      type: "error",
      requestId: request.requestId,
      message,
    };
    workerContext.postMessage(response);
  }
};

export {};
