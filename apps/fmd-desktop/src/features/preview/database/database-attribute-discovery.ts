/**
 * @file apps/fmd-desktop/src/features/preview/database/database-attribute-discovery.ts
 *
 * Vault-bound discovery/indexing for database attribute suggestions.
 */

import { parseFrontmatterDocument } from "../frontmatter";
import {
  type DatabaseVaultAttributeIndex,
  type DatabaseVaultAttributeSuggestion,
} from "./database-types";

const toNormalizedKey = (value: string) => value.trim().toLowerCase();

const sortSuggestions = (suggestions: DatabaseVaultAttributeSuggestion[]) =>
  [...suggestions].sort((left, right) => {
    if (left.count !== right.count) {
      return right.count - left.count;
    }
    return left.key.localeCompare(right.key, undefined, { sensitivity: "base" });
  });

export const createEmptyVaultAttributeIndex = (): DatabaseVaultAttributeIndex => ({
  suggestions: [],
  byNormalizedKey: {},
});

export const buildVaultAttributeIndexFromMarkdownDocuments = (
  markdownDocuments: string[],
): DatabaseVaultAttributeIndex => {
  if (markdownDocuments.length === 0) {
    return createEmptyVaultAttributeIndex();
  }

  const keyCounts = new Map<string, number>();

  markdownDocuments.forEach((markdown) => {
    const parsed = parseFrontmatterDocument(markdown);
    if (!parsed.hasFrontmatter || parsed.error) {
      return;
    }
    parsed.properties.forEach((property) => {
      const trimmed = property.key.trim();
      if (!trimmed) {
        return;
      }
      const current = keyCounts.get(trimmed) ?? 0;
      keyCounts.set(trimmed, current + 1);
    });
  });

  if (keyCounts.size === 0) {
    return createEmptyVaultAttributeIndex();
  }

  const variantsByNormalized = new Map<string, Set<string>>();
  const totalCountsByNormalized = new Map<string, number>();

  keyCounts.forEach((count, rawKey) => {
    const normalized = toNormalizedKey(rawKey);
    if (!normalized) {
      return;
    }

    const variants = variantsByNormalized.get(normalized) ?? new Set<string>();
    variants.add(rawKey);
    variantsByNormalized.set(normalized, variants);

    const total = totalCountsByNormalized.get(normalized) ?? 0;
    totalCountsByNormalized.set(normalized, total + count);
  });

  const suggestions: DatabaseVaultAttributeSuggestion[] = [];
  const byNormalizedKey: Record<string, DatabaseVaultAttributeSuggestion> = {};

  variantsByNormalized.forEach((variants, normalizedKey) => {
    const sortedVariants = Array.from(variants).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: "base" }));
    const displayKey = sortedVariants.length > 1
      ? normalizedKey
      : (sortedVariants[0] ?? normalizedKey);
    const count = totalCountsByNormalized.get(normalizedKey) ?? 0;

    const suggestion: DatabaseVaultAttributeSuggestion = {
      key: displayKey,
      normalizedKey,
      count,
    };
    suggestions.push(suggestion);
    byNormalizedKey[normalizedKey] = suggestion;
  });

  return {
    suggestions: sortSuggestions(suggestions),
    byNormalizedKey,
  };
};
