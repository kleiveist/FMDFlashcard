/**
 * @file apps/fmd-desktop/src/features/exam-results/frontmatterStats.ts
 *
 * Zweck:
 * - Schreibt/aktualisiert Exam-Result-Statistiken im Markdown-Frontmatter.
 */

import {
  addFrontmatterProperty,
  parseFrontmatterDocument,
  removeFrontmatterProperty,
} from "../preview/frontmatter";

export const EXAM_RESULTS_FRONTMATTER_SCORE_KEY = "Score";
export const EXAM_RESULTS_FRONTMATTER_PERCENT_KEY = "percent";
export const EXAM_RESULTS_FRONTMATTER_STATUS_KEY = "status";

type ExamResultStatsValues = {
  score: string;
  percent: string;
  status: string;
};

const normalizeLineEnding = (value: "\n" | "\r\n" | string) =>
  value === "\r\n" ? "\r\n" : "\n";

const serializeYamlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

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
    "---",
  ];
  if (body.length > 0) {
    lines.push(body);
  }
  return lines.join(lineEnding);
};

const TARGET_KEYS = [
  EXAM_RESULTS_FRONTMATTER_SCORE_KEY,
  EXAM_RESULTS_FRONTMATTER_PERCENT_KEY,
  EXAM_RESULTS_FRONTMATTER_STATUS_KEY,
] as const;

const findMatchingKeys = (keys: string[]) => {
  const expected = new Set(TARGET_KEYS.map((key) => key.toLowerCase()));
  return keys.filter((key) => expected.has(key.trim().toLowerCase()));
};

const removeMatchingKeys = (markdown: string, keys: string[]) => {
  let nextMarkdown = markdown;
  for (const key of keys) {
    const removed = removeFrontmatterProperty({
      markdown: nextMarkdown,
      key,
    });
    if (removed.error) {
      return removed;
    }
    nextMarkdown = removed.markdown;
  }
  return { markdown: nextMarkdown, error: null as string | null };
};

const addStatsKeys = (markdown: string, stats: ExamResultStatsValues) => {
  const orderedEntries: Array<[string, string]> = [
    [EXAM_RESULTS_FRONTMATTER_SCORE_KEY, stats.score],
    [EXAM_RESULTS_FRONTMATTER_PERCENT_KEY, stats.percent],
    [EXAM_RESULTS_FRONTMATTER_STATUS_KEY, stats.status],
  ];
  let nextMarkdown = markdown;
  for (const [key, value] of orderedEntries) {
    const added = addFrontmatterProperty({
      markdown: nextMarkdown,
      key,
      value,
      kind: "text",
    });
    if (added.error) {
      return added;
    }
    nextMarkdown = added.markdown;
  }
  return { markdown: nextMarkdown, error: null as string | null };
};

export const upsertExamResultStatsFrontmatter = ({
  markdown,
  score,
  percent,
  status,
}: {
  markdown: string;
  score: string;
  percent: string;
  status: string;
}): { markdown: string; error: string | null } => {
  const stats: ExamResultStatsValues = {
    score: score.trim(),
    percent: percent.trim(),
    status: status.trim(),
  };
  if (!stats.score || !stats.percent || !stats.status) {
    return { markdown, error: "Score, percent and status are required." };
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

  const matchingKeys = findMatchingKeys(parsed.properties.map((property) => property.key));
  const removed = removeMatchingKeys(markdown, matchingKeys);
  if (removed.error) {
    return removed;
  }
  return addStatsKeys(removed.markdown, stats);
};

