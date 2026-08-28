/**
 * @file frontend/src/features/preview/useMarkdownDocumentModel.ts
 *
 * Purpose:
 * - Provides a markdown block document model backed by an optional web worker.
 * - Uses incremental reparsing and stale-response protection.
 */

import { useEffect, useRef, useState } from "react";
import {
  createMarkdownDocumentSnapshot,
  parseMarkdownDocument,
  type MarkdownDocumentSnapshot,
  type MarkdownParseStats,
} from "./markdownDocumentModel";
import { type MarkdownBlockParseProfile } from "./markdownBlocks";
import {
  type MarkdownBlockWorkerRequest,
  type MarkdownBlockWorkerResponse,
} from "./markdownBlocks.worker.types";

type MarkdownDocumentModelState = {
  snapshot: MarkdownDocumentSnapshot;
  stats: MarkdownParseStats;
};

type UseMarkdownDocumentModelResult = {
  snapshot: MarkdownDocumentSnapshot;
  stats: MarkdownParseStats;
};

type UseMarkdownDocumentModelOptions = {
  profile?: MarkdownBlockParseProfile;
};

const createFallbackStats = (markdown: string): MarkdownParseStats => ({
  mode: "full",
  diffRange: {
    changed: true,
    startOffset: 0,
    endOffsetPrev: 0,
    endOffsetNext: markdown.length,
  },
  changedBlockRange: null,
});

const canUseWorker = () => typeof Worker !== "undefined";

export const useMarkdownDocumentModel = (
  markdown: string,
  options?: UseMarkdownDocumentModelOptions,
): UseMarkdownDocumentModelResult => {
  const profile = options?.profile ?? "default";
  const [state, setState] = useState<MarkdownDocumentModelState>(() => ({
    snapshot: createMarkdownDocumentSnapshot(markdown, 0, { profile }),
    stats: createFallbackStats(markdown),
  }));

  const workerRef = useRef<Worker | null>(null);
  const workerUnavailableRef = useRef(false);
  const requestIdRef = useRef(0);
  const versionRef = useRef(0);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(
    () => () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    versionRef.current += 1;
    const nextVersion = versionRef.current;

    if (!canUseWorker() || workerUnavailableRef.current) {
      const next = parseMarkdownDocument(markdown, stateRef.current.snapshot, nextVersion, { profile });
      setState(next);
      return;
    }

    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(
          new URL("./markdownBlocks.worker.ts", import.meta.url),
          { type: "module" },
        );
      } catch {
        workerUnavailableRef.current = true;
        const fallback = parseMarkdownDocument(markdown, stateRef.current.snapshot, nextVersion, { profile });
        setState(fallback);
        return;
      }
    }

    const currentWorker = workerRef.current;
    if (!currentWorker) {
      const fallback = parseMarkdownDocument(markdown, stateRef.current.snapshot, nextVersion, { profile });
      setState(fallback);
      return;
    }
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    const handleMessage = (event: MessageEvent<MarkdownBlockWorkerResponse>) => {
      const payload = event.data;
      if (!payload || payload.requestId !== requestId) {
        return;
      }

      if (payload.type === "error") {
        workerUnavailableRef.current = true;
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
        const fallback = parseMarkdownDocument(markdown, stateRef.current.snapshot, nextVersion, { profile });
        setState(fallback);
        return;
      }

      if (payload.type === "parsed") {
        setState({
          snapshot: payload.snapshot,
          stats: payload.stats,
        });
      }
    };

    const handleError = () => {
      if (requestId !== requestIdRef.current) {
        return;
      }
      workerUnavailableRef.current = true;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      const fallback = parseMarkdownDocument(markdown, stateRef.current.snapshot, nextVersion, { profile });
      setState(fallback);
    };

    currentWorker.addEventListener("message", handleMessage);
    currentWorker.addEventListener("error", handleError);

    const requestPayload: MarkdownBlockWorkerRequest = {
      type: "parse",
      requestId,
      nextVersion,
      markdown,
      previousSnapshot: stateRef.current.snapshot,
      profile,
    };

    try {
      currentWorker.postMessage(requestPayload);
    } catch {
      const fallback = parseMarkdownDocument(markdown, stateRef.current.snapshot, nextVersion, { profile });
      setState(fallback);
      currentWorker.removeEventListener("message", handleMessage);
      currentWorker.removeEventListener("error", handleError);
      currentWorker.terminate();
      workerRef.current = null;
      workerUnavailableRef.current = true;
      return;
    }

    return () => {
      currentWorker.removeEventListener("message", handleMessage);
      currentWorker.removeEventListener("error", handleError);
    };
  }, [markdown, profile]);

  return {
    snapshot: state.snapshot,
    stats: state.stats,
  };
};
