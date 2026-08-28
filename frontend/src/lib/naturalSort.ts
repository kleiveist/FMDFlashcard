import { normalizeRelativePath } from "./path";

const naturalBaseCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const naturalVariantCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "variant",
});

/**
 * Case-insensitive natural compare with deterministic case-sensitive fallback.
 */
export const compareNaturalText = (left: string, right: string) => {
  const primary = naturalBaseCollator.compare(left, right);
  if (primary !== 0) {
    return primary;
  }
  return naturalVariantCollator.compare(left, right);
};

export const compareNaturalPath = (left: string, right: string) =>
  compareNaturalText(normalizeRelativePath(left), normalizeRelativePath(right));
