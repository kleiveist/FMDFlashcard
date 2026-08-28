/**
 * @file apps/fmd-desktop/src/features/exam-results/frontmatterStats.ts
 *
 * Zweck:
 * - Schreibt/aktualisiert Exam-Result-Statistiken im Markdown-Frontmatter.
 */

import { parseFrontmatterDocument } from "../preview/frontmatter";

export const EXAM_RESULTS_FRONTMATTER_SCORE_KEY = "Score";
export const EXAM_RESULTS_FRONTMATTER_PERCENT_KEY = "percent";
export const EXAM_RESULTS_FRONTMATTER_STATUS_KEY = "status";
export const EXAM_RESULTS_FRONTMATTER_CORRECTED_SCORE_KEY = "Corrected score";
export const EXAM_RESULTS_FRONTMATTER_CORRECTED_PERCENT_KEY = "Corrected percent";
export const EXAM_RESULTS_FRONTMATTER_CORRECTED_STATUS_KEY = "Corrected status";

type ExamResultStatsValues = {
  score: string;
  percent: string;
  status: string;
  correctedScore?: string | null;
  correctedPercent?: string | null;
  correctedStatus?: string | null;
};

const normalizeLineEnding = (value: "\n" | "\r\n" | string) =>
  value === "\r\n" ? "\r\n" : "\n";

const serializeYamlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

const normalizePercentForWrite = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.endsWith("%")
    ? trimmed.slice(0, -1).trim()
    : trimmed;
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return String(parsed);
};

const normalizeStatusCodeForWrite = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/^([0-9A-Za-z!]+)/u);
  if (!match?.[1]) {
    return null;
  }
  return match[1];
};

const buildFrontmatterBlock = (
  stats: ExamResultStatsValues,
  lineEnding: "\n" | "\r\n",
  body: string,
) => {
  const lines = [
    "---",
    `${EXAM_RESULTS_FRONTMATTER_SCORE_KEY}: ${serializeYamlString(stats.score)}`,
    `${EXAM_RESULTS_FRONTMATTER_PERCENT_KEY}: ${serializeYamlString(stats.percent)}`,
    `${EXAM_RESULTS_FRONTMATTER_STATUS_KEY}: ${serializeYamlString(stats.status)}`,
  ];
  if (
    stats.correctedScore &&
    stats.correctedPercent &&
    stats.correctedStatus
  ) {
    lines.push(
      `${EXAM_RESULTS_FRONTMATTER_CORRECTED_SCORE_KEY}: ${serializeYamlString(stats.correctedScore)}`,
      `${EXAM_RESULTS_FRONTMATTER_CORRECTED_PERCENT_KEY}: ${serializeYamlString(stats.correctedPercent)}`,
      `${EXAM_RESULTS_FRONTMATTER_CORRECTED_STATUS_KEY}: ${serializeYamlString(stats.correctedStatus)}`,
    );
  }
  lines.push("---");
  if (body.length > 0) {
    lines.push(body);
  }
  return lines.join(lineEnding);
};

const FRONTMATTER_BLOCK_PATTERN =
  /^(?<bom>\uFEFF)?---[ \t]*\r?\n(?<yaml>[\s\S]*?)\r?\n---[ \t]*(?<separator>\r?\n|$)(?<body>[\s\S]*)$/;

const TARGET_KEYS = [
  EXAM_RESULTS_FRONTMATTER_SCORE_KEY,
  EXAM_RESULTS_FRONTMATTER_PERCENT_KEY,
  EXAM_RESULTS_FRONTMATTER_STATUS_KEY,
] as const;

const TARGET_CORRECTED_KEYS = [
  EXAM_RESULTS_FRONTMATTER_CORRECTED_SCORE_KEY,
  EXAM_RESULTS_FRONTMATTER_CORRECTED_PERCENT_KEY,
  EXAM_RESULTS_FRONTMATTER_CORRECTED_STATUS_KEY,
] as const;

const findMatchingKeys = (
  keys: string[],
  options?: { includeCorrected?: boolean },
) => {
  const expected = new Set(
    [
      ...TARGET_KEYS,
      ...(options?.includeCorrected ? TARGET_CORRECTED_KEYS : []),
    ].map((key) => key.toLowerCase()),
  );
  return keys.filter((key) => expected.has(key.trim().toLowerCase()));
};

const rebuildFrontmatterDocument = ({
  bom,
  yamlLines,
  lineEnding,
  separator,
  body,
}: {
  bom: string;
  yamlLines: string[];
  lineEnding: "\n" | "\r\n";
  separator: string;
  body: string;
}) => {
  const nextFrontmatter = ["---", ...yamlLines, "---"].join(lineEnding);
  if (!separator) {
    return `${bom}${nextFrontmatter}`;
  }
  return `${bom}${nextFrontmatter}${lineEnding}${body}`;
};

const removeMatchingKeys = (markdown: string, keys: string[]) => {
  const match = markdown.match(FRONTMATTER_BLOCK_PATTERN);
  if (!match?.groups) {
    return { markdown, error: "No YAML frontmatter block found at document start." };
  }
  const yamlContent = match.groups.yaml ?? "";
  const yamlLines = yamlContent.trim() === "" ? [] : yamlContent.split(/\r?\n/);
  const removableKeys = new Set(keys.map((key) => key.trim().toLowerCase()));
  const filteredYamlLines = yamlLines.filter((line) => {
    if (/^\s/.test(line)) {
      return true;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      return true;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    return !removableKeys.has(key);
  });

  return {
    markdown: rebuildFrontmatterDocument({
      bom: match.groups.bom ?? "",
      yamlLines: filteredYamlLines,
      lineEnding: normalizeLineEnding(parseFrontmatterDocument(markdown).lineEnding),
      separator: match.groups.separator ?? "",
      body: match.groups.body ?? "",
    }),
    error: null as string | null,
  };
};

const addStatsKeys = (markdown: string, stats: ExamResultStatsValues) => {
  const match = markdown.match(FRONTMATTER_BLOCK_PATTERN);
  if (!match?.groups) {
    return { markdown, error: "No YAML frontmatter block found at document start." };
  }

  const lineEnding = normalizeLineEnding(parseFrontmatterDocument(markdown).lineEnding);
  const bom = match.groups.bom ?? "";
  const separator = match.groups.separator ?? "";
  const body = match.groups.body ?? "";
  const yamlContent = match.groups.yaml ?? "";
  const yamlLines = yamlContent.trim() === "" ? [] : yamlContent.split(/\r?\n/);
  const statsLines = [
    `${EXAM_RESULTS_FRONTMATTER_SCORE_KEY}: ${serializeYamlString(stats.score)}`,
    `${EXAM_RESULTS_FRONTMATTER_PERCENT_KEY}: ${serializeYamlString(stats.percent)}`,
    `${EXAM_RESULTS_FRONTMATTER_STATUS_KEY}: ${serializeYamlString(stats.status)}`,
  ];

  if (
    stats.correctedScore &&
    stats.correctedPercent &&
    stats.correctedStatus
  ) {
    statsLines.push(
      `${EXAM_RESULTS_FRONTMATTER_CORRECTED_SCORE_KEY}: ${serializeYamlString(stats.correctedScore)}`,
      `${EXAM_RESULTS_FRONTMATTER_CORRECTED_PERCENT_KEY}: ${serializeYamlString(stats.correctedPercent)}`,
      `${EXAM_RESULTS_FRONTMATTER_CORRECTED_STATUS_KEY}: ${serializeYamlString(stats.correctedStatus)}`,
    );
  }
  return {
    markdown: rebuildFrontmatterDocument({
      bom,
      yamlLines: [...yamlLines, ...statsLines],
      lineEnding,
      separator,
      body,
    }),
    error: null as string | null,
  };
};

export const upsertExamResultStatsFrontmatter = ({
  markdown,
  score,
  percent,
  status,
  correctedScore,
  correctedPercent,
  correctedStatus,
}: {
  markdown: string;
  score: string;
  percent: string;
  status: string;
  correctedScore?: string | null;
  correctedPercent?: string | null;
  correctedStatus?: string | null;
}): { markdown: string; error: string | null } => {
  const normalizedCorrectedScore = correctedScore?.trim() ?? null;
  const normalizedCorrectedPercent = correctedPercent?.trim() ?? null;
  const normalizedCorrectedStatus = correctedStatus?.trim() ?? null;
  const hasAnyCorrectedValue = Boolean(
    normalizedCorrectedScore ||
      normalizedCorrectedPercent ||
      normalizedCorrectedStatus,
  );
  const hasCompleteCorrectedValue =
    Boolean(normalizedCorrectedScore) &&
    Boolean(normalizedCorrectedPercent) &&
    Boolean(normalizedCorrectedStatus);
  const normalizedPercent = normalizePercentForWrite(percent);
  const normalizedStatus = normalizeStatusCodeForWrite(status);
  const normalizedCorrectedPercentForWrite = hasCompleteCorrectedValue
    ? normalizePercentForWrite(normalizedCorrectedPercent)
    : null;
  const normalizedCorrectedStatusForWrite = hasCompleteCorrectedValue
    ? normalizeStatusCodeForWrite(normalizedCorrectedStatus)
    : null;
  const stats: ExamResultStatsValues = {
    score: score.trim(),
    percent: normalizedPercent ?? "",
    status: normalizedStatus ?? "",
    correctedScore: hasCompleteCorrectedValue ? normalizedCorrectedScore : null,
    correctedPercent: hasCompleteCorrectedValue ? (normalizedCorrectedPercentForWrite ?? null) : null,
    correctedStatus: hasCompleteCorrectedValue ? (normalizedCorrectedStatusForWrite ?? null) : null,
  };
  if (!stats.score || !stats.percent || !stats.status) {
    return { markdown, error: "Score, percent and status are required." };
  }
  if (hasAnyCorrectedValue && !hasCompleteCorrectedValue) {
    return {
      markdown,
      error: "Corrected score, percent and status must be provided together.",
    };
  }
  if (
    hasCompleteCorrectedValue &&
    (!normalizedCorrectedPercentForWrite || !normalizedCorrectedStatusForWrite)
  ) {
    return {
      markdown,
      error: "Corrected percent and corrected status must use valid raw values.",
    };
  }

  const parsed = parseFrontmatterDocument(markdown);
  if (parsed.error) {
    return { markdown, error: parsed.error };
  }

  if (!parsed.hasFrontmatter) {
    const lineEnding = normalizeLineEnding(parsed.lineEnding);
    const hasBom = markdown.startsWith("\uFEFF");
    const sourceBody = hasBom ? markdown.slice(1) : markdown;
    const nextMarkdown = buildFrontmatterBlock(stats, lineEnding, sourceBody);
    return {
      markdown: hasBom ? `\uFEFF${nextMarkdown}` : nextMarkdown,
      error: null,
    };
  }

  const matchingKeys = findMatchingKeys(parsed.properties.map((property) => property.key), {
    includeCorrected: hasCompleteCorrectedValue,
  });
  const removed = removeMatchingKeys(markdown, matchingKeys);
  if (removed.error) {
    return removed;
  }
  return addStatsKeys(removed.markdown, stats);
};
