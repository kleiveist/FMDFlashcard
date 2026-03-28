import { normalizeRelativePath } from "../../lib/path";
import type { VaultFile } from "../../lib/tree";

export type PageLinkPickerReplaceRange = {
  start: number;
  end: number;
};

export type TypedLinkPickerMode = "page" | "image";

export type TypedLinkPickerTrigger = {
  mode: TypedLinkPickerMode;
  replaceRange: PageLinkPickerReplaceRange;
  initialQuery: string;
};

export type PageLinkCandidate = {
  id: string;
  target: string;
  wikilink: string;
  label: string;
  sublabel?: string;
  searchText: string;
};

const inlineWikilinkOpenTrigger = /\[\[$/;
const inlineImageEmbedOpenTrigger = /!\[\[$/;

export const stripMarkdownExtension = (value: string) => value.replace(/\.md$/i, "");

export const getPathBasename = (value: string) => {
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
};

export const resolveWikilinkLabelFromTarget = (target: string) =>
  stripMarkdownExtension(getPathBasename(target.trim()));

export const detectTypedPageLinkTrigger = (
  value: string,
  selectionStart: number | null | undefined,
): PageLinkPickerReplaceRange | null => {
  if (typeof selectionStart !== "number") {
    return null;
  }
  const safeSelectionStart = Math.max(0, Math.min(selectionStart, value.length));
  const before = value.slice(0, safeSelectionStart);
  if (safeSelectionStart >= 3 && value[safeSelectionStart - 3] === "!") {
    return null;
  }
  if (!inlineWikilinkOpenTrigger.test(before)) {
    return null;
  }
  return {
    start: safeSelectionStart - 2,
    end: safeSelectionStart,
  };
};

export const detectTypedImageEmbedTrigger = (
  value: string,
  selectionStart: number | null | undefined,
): PageLinkPickerReplaceRange | null => {
  if (typeof selectionStart !== "number") {
    return null;
  }
  const safeSelectionStart = Math.max(0, Math.min(selectionStart, value.length));
  const before = value.slice(0, safeSelectionStart);
  if (!inlineImageEmbedOpenTrigger.test(before)) {
    return null;
  }
  return {
    start: safeSelectionStart - 3,
    end: safeSelectionStart,
  };
};

export const resolveTypedLinkPickerTriggerAtCaret = (
  value: string,
  selectionStart: number | null | undefined,
): TypedLinkPickerTrigger | null => {
  if (typeof selectionStart !== "number") {
    return null;
  }
  const clampedCaret = Math.max(0, Math.min(selectionStart, value.length));
  const probeOffsets: number[] = [];
  const pushProbeOffset = (nextValue: number) => {
    const next = Math.max(0, Math.min(nextValue, value.length));
    if (!probeOffsets.includes(next)) {
      probeOffsets.push(next);
    }
  };

  // Some environments report textarea/contentEditable selection behind
  // during input. Probe a local offset window around the reported caret.
  for (let delta = 0; delta <= 12; delta += 1) {
    pushProbeOffset(clampedCaret + delta);
    if (delta > 0) {
      pushProbeOffset(clampedCaret - delta);
    }
  }

  type ProbeMatchCandidate = TypedLinkPickerTrigger & {
    probeDistance: number;
  };

  const resolveProbeCandidate = (
    mode: TypedLinkPickerMode,
    replaceRange: PageLinkPickerReplaceRange,
    probeOffset: number,
  ): ProbeMatchCandidate | null => {
    let queryEnd = Math.max(replaceRange.end, clampedCaret, probeOffset);
    // Small caret drift compensation: when caret reports exactly at trigger end,
    // include a single safe char after the trigger (e.g. "[[a" with caret at 2).
    if (queryEnd === replaceRange.end && clampedCaret >= replaceRange.end) {
      const nextChar = value[replaceRange.end] ?? "";
      if (
        nextChar &&
        nextChar !== "\n" &&
        nextChar !== "\r" &&
        nextChar !== "]"
      ) {
        queryEnd = replaceRange.end + 1;
      }
    }
    const initialQuery = queryEnd > replaceRange.end
      ? value.slice(replaceRange.end, queryEnd)
      : "";
    if (
      initialQuery.includes("\n") ||
      initialQuery.includes("\r") ||
      initialQuery.includes("]]")
    ) {
      return null;
    }
    const closeProbe = value.slice(
      replaceRange.end,
      Math.min(value.length, queryEnd + 12),
    );
    if (closeProbe.includes("]]")) {
      return null;
    }
    return {
      mode,
      replaceRange,
      initialQuery,
      probeDistance: Math.abs(probeOffset - clampedCaret),
    };
  };

  let bestProbeCandidate: ProbeMatchCandidate | null = null;
  const shouldPreferProbeCandidate = (
    candidate: ProbeMatchCandidate,
    current: ProbeMatchCandidate | null,
  ) => {
    if (!current) {
      return true;
    }
    if (candidate.replaceRange.start !== current.replaceRange.start) {
      return candidate.replaceRange.start > current.replaceRange.start;
    }
    if (candidate.initialQuery.length !== current.initialQuery.length) {
      return candidate.initialQuery.length > current.initialQuery.length;
    }
    return candidate.probeDistance < current.probeDistance;
  };

  for (const probeOffset of probeOffsets) {
    const imageTrigger = detectTypedImageEmbedTrigger(value, probeOffset);
    if (imageTrigger) {
      const candidate = resolveProbeCandidate("image", imageTrigger, probeOffset);
      if (candidate && shouldPreferProbeCandidate(candidate, bestProbeCandidate)) {
        bestProbeCandidate = candidate;
      }
    }
    const pageTrigger = detectTypedPageLinkTrigger(value, probeOffset);
    if (pageTrigger) {
      const candidate = resolveProbeCandidate("page", pageTrigger, probeOffset);
      if (candidate && shouldPreferProbeCandidate(candidate, bestProbeCandidate)) {
        bestProbeCandidate = candidate;
      }
    }
  }

  if (bestProbeCandidate) {
    const { mode, replaceRange, initialQuery } = bestProbeCandidate;
    return { mode, replaceRange, initialQuery };
  }

  // Fallback: detect the latest unclosed trigger on the current caret line
  // even when offset mapping drifted significantly.
  const windowStart = Math.max(0, clampedCaret - 160);
  const windowEnd = Math.min(value.length, clampedCaret + 160);
  const windowValue = value.slice(windowStart, windowEnd);
  let bestCandidate:
    | {
      mode: TypedLinkPickerMode;
      replaceRange: PageLinkPickerReplaceRange;
    }
    | null = null;

  const considerCandidate = (mode: TypedLinkPickerMode, start: number, openLength: number) => {
    if (start > clampedCaret + 12) {
      return;
    }
    if (start > 0 && value[start - 1] === "\\") {
      return;
    }
    const end = start + openLength;
    if (end > value.length) {
      return;
    }
    const typedSegment = value.slice(end, Math.max(end, clampedCaret));
    if (typedSegment.includes("\n") || typedSegment.includes("\r") || typedSegment.includes("]]")) {
      return;
    }
    const closeProbe = value.slice(end, Math.min(value.length, clampedCaret + 12));
    if (closeProbe.includes("]]")) {
      return;
    }
    if (!bestCandidate || start > bestCandidate.replaceRange.start) {
      bestCandidate = {
        mode,
        replaceRange: { start, end },
      };
    }
  };

  for (let index = 0; index < windowValue.length; index += 1) {
    if (windowValue.startsWith("![[", index)) {
      considerCandidate("image", windowStart + index, 3);
      continue;
    }
    if (windowValue.startsWith("[[", index)) {
      const globalStart = windowStart + index;
      if (globalStart > 0 && value[globalStart - 1] === "!") {
        continue;
      }
      considerCandidate("page", globalStart, 2);
    }
  }

  if (bestCandidate) {
    return {
      mode: bestCandidate.mode,
      replaceRange: bestCandidate.replaceRange,
      initialQuery: clampedCaret > bestCandidate.replaceRange.end
        ? value.slice(bestCandidate.replaceRange.end, clampedCaret)
        : "",
    };
  }
  return null;
};

export const buildPageLinkCandidates = (vaultFiles?: VaultFile[]): PageLinkCandidate[] => {
  if (!vaultFiles || vaultFiles.length === 0) {
    return [];
  }
  const seenTargets = new Set<string>();
  const candidates: PageLinkCandidate[] = [];

  for (const file of vaultFiles) {
    const relative = normalizeRelativePath(file.relative_path ?? "");
    if (!/\.md$/i.test(relative)) {
      continue;
    }
    const normalizedRelative = relative.replace(/^\/+/, "");
    const target = stripMarkdownExtension(normalizedRelative);
    if (!target) {
      continue;
    }
    const targetKey = target.toLowerCase();
    if (seenTargets.has(targetKey)) {
      continue;
    }
    seenTargets.add(targetKey);
    const label = resolveWikilinkLabelFromTarget(target);
    candidates.push({
      id: `${targetKey}:${normalizedRelative.toLowerCase()}`,
      target,
      wikilink: `[[${target}]]`,
      label,
      sublabel: normalizedRelative === `${label}.md` ? undefined : normalizedRelative,
      searchText: `${label} ${target} ${normalizedRelative}`.toLowerCase(),
    });
  }

  candidates.sort((left, right) => {
    const labelCompare = left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
    if (labelCompare !== 0) {
      return labelCompare;
    }
    return left.target.localeCompare(right.target, undefined, { sensitivity: "base" });
  });
  return candidates;
};

export const filterPageLinkCandidates = (candidates: PageLinkCandidate[], query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return candidates;
  }
  return candidates.filter((candidate) => candidate.searchText.includes(normalizedQuery));
};
