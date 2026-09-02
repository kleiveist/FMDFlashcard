/**
 * @file apps/fmd-desktop/src/features/exam-points/frontmatterTask.ts
 *
 * Zweck:
 * - Liest und schreibt die Task->Points-Profil-Zuordnung im Frontmatter.
 */

import {
  addFrontmatterProperty,
  parseFrontmatterDocument,
  removeFrontmatterProperty,
  updateFrontmatterProperty,
} from "../preview/frontmatter";
import { EXAM_POINTS_FRONTMATTER_KEY } from "../../lib/exam/pointsProfiles";

const normalizeLineEnding = (value: "\n" | "\r\n" | string) => (value === "\r\n" ? "\r\n" : "\n");

const serializeYamlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

const buildFrontmatterBlock = (profileName: string, lineEnding: "\n" | "\r\n", body: string) => {
  const lines = [
    "---",
    `${EXAM_POINTS_FRONTMATTER_KEY}: ${serializeYamlString(profileName)}`,
    "---",
  ];
  if (body.length > 0) {
    lines.push(body);
  }
  return lines.join(lineEnding);
};

const resolveTaskKey = (keys: string[]) => {
  const expected = EXAM_POINTS_FRONTMATTER_KEY.toLocaleLowerCase();
  return keys.find((key) => key.trim().toLocaleLowerCase() === expected) ?? null;
};

export const resolveExamTaskFrontmatterValue = (markdown: string) => {
  const parsed = parseFrontmatterDocument(markdown);
  if (!parsed.hasFrontmatter || parsed.error) {
    return null;
  }
  const key = resolveTaskKey(parsed.properties.map((property) => property.key));
  if (!key) {
    return null;
  }
  const property = parsed.properties.find((entry) => entry.key === key);
  if (!property || typeof property.value !== "string") {
    return null;
  }
  const trimmed = property.value.trim();
  return trimmed || null;
};

export const upsertExamTaskFrontmatterValue = ({
  markdown,
  profileName,
}: {
  markdown: string;
  profileName: string;
}): { markdown: string; error: string | null } => {
  const nextName = profileName.trim();
  if (!nextName) {
    return { markdown, error: "Profile name is required." };
  }
  const parsed = parseFrontmatterDocument(markdown);
  const taskKey = resolveTaskKey(parsed.properties.map((property) => property.key));

  if (!parsed.hasFrontmatter) {
    const lineEnding = normalizeLineEnding(parsed.lineEnding);
    const hasBom = markdown.startsWith("\uFEFF");
    const sourceBody = hasBom ? markdown.slice(1) : markdown;
    const nextMarkdown = buildFrontmatterBlock(nextName, lineEnding, sourceBody);
    return { markdown: hasBom ? `\uFEFF${nextMarkdown}` : nextMarkdown, error: null };
  }

  if (taskKey) {
    return updateFrontmatterProperty({
      markdown,
      key: taskKey,
      kind: "text",
      value: nextName,
    });
  }

  return addFrontmatterProperty({
    markdown,
    key: EXAM_POINTS_FRONTMATTER_KEY,
    value: nextName,
    kind: "text",
  });
};

export const removeExamTaskFrontmatterValue = ({
  markdown,
}: {
  markdown: string;
}): { markdown: string; error: string | null } => {
  const parsed = parseFrontmatterDocument(markdown);
  if (!parsed.hasFrontmatter || parsed.error) {
    return {
      markdown,
      error: parsed.error,
    };
  }

  const taskKey = resolveTaskKey(parsed.properties.map((property) => property.key));
  if (!taskKey) {
    return {
      markdown,
      error: null,
    };
  }

  return removeFrontmatterProperty({
    markdown,
    key: taskKey,
  });
};
