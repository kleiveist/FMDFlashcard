/**
 * @file apps/fmd-desktop/src/lib/cardMedia.ts
 *
 * Zweck:
 * - Parst und validiert Karten-Medien und sichert Inline-SVG fuer Preview/Runtime.
 */

import { extractVaultAssetRelativePath } from "./vaultAssets";

export type SvgValidationResult = {
  sanitized: string | null;
  invalidReason?: string;
};

export type CardImageMediaItem = {
  kind: "image";
  raw: string;
  relativePath: string;
};

export type CardSvgMediaItem = {
  kind: "svg";
  raw: string;
  sanitized: string | null;
  invalidReason?: string;
};

export type CardUnresolvedMediaItem = {
  kind: "unresolved";
  raw: string;
  label: string;
};

export type CardMediaItem =
  | CardImageMediaItem
  | CardSvgMediaItem
  | CardUnresolvedMediaItem;

const mediaFencePattern = /^\s*(```|~~~)(.*)$/;
const supportedImageExtensionPattern =
  /\.(?:png|jpe?g|gif|webp|bmp|svg)(?:[?#].*)?$/i;
const unsafeSvgTags = new Set(["script", "foreignobject"]);

const normalizeLines = (value: string) => value.replace(/\r\n?/g, "\n").split("\n");

const isSupportedImageRelativePath = (value: string) =>
  supportedImageExtensionPattern.test(value);

const isSafeSvgHref = (value: string) => value.trim().startsWith("#");

const hasParserError = (document: XMLDocument) => {
  const rootName = document.documentElement?.nodeName?.toLowerCase() ?? "";
  if (rootName === "parsererror") {
    return true;
  }
  return Boolean(document.getElementsByTagName("parsererror").length > 0);
};

const hasMeaningfulSvgContent = (element: Element): boolean => {
  const childNodes = Array.from(element.childNodes);
  return childNodes.some((child) => {
    if (child.nodeType === 1) {
      return true;
    }
    if (child.nodeType === 3) {
      return (child.textContent ?? "").trim().length > 0;
    }
    return false;
  });
};

const sanitizeSvgElement = (element: Element) => {
  Array.from(element.children).forEach((child) => {
    const tagName = child.tagName.toLowerCase();
    if (unsafeSvgTags.has(tagName)) {
      child.remove();
      return;
    }
    sanitizeSvgElement(child);
  });

  Array.from(element.attributes).forEach((attribute) => {
    const name = attribute.name.toLowerCase();
    if (name.startsWith("on")) {
      element.removeAttribute(attribute.name);
      return;
    }
    if (name === "href" || name === "xlink:href") {
      if (!isSafeSvgHref(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  });
};

export const validateSvgMarkup = (value: string): SvgValidationResult => {
  const source = value.trim();
  if (!source) {
    return { sanitized: null, invalidReason: "SVG is empty." };
  }
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    return { sanitized: null, invalidReason: "SVG parser unavailable." };
  }

  try {
    const parser = new DOMParser();
    const document = parser.parseFromString(source, "image/svg+xml");
    if (hasParserError(document)) {
      return { sanitized: null, invalidReason: "SVG could not be parsed." };
    }
    const root = document.documentElement;
    if (!root || root.tagName.toLowerCase() !== "svg") {
      return { sanitized: null, invalidReason: "Root element must be <svg>." };
    }

    sanitizeSvgElement(root);

    if (!hasMeaningfulSvgContent(root)) {
      return {
        sanitized: null,
        invalidReason: "SVG has no renderable content after sanitizing.",
      };
    }

    const serializer = new XMLSerializer();
    const sanitized = serializer.serializeToString(root).trim();
    if (!sanitized) {
      return { sanitized: null, invalidReason: "SVG sanitizing produced no output." };
    }

    return { sanitized };
  } catch {
    return { sanitized: null, invalidReason: "SVG validation failed." };
  }
};

const createUnresolvedMedia = (raw: string, label: string): CardUnresolvedMediaItem => ({
  kind: "unresolved",
  raw,
  label,
});

const parseWikilinkMediaLine = (line: string): CardMediaItem => {
  const relativePath = extractVaultAssetRelativePath(line);
  if (!relativePath) {
    return createUnresolvedMedia(line, "Unsupported media link");
  }
  if (!isSupportedImageRelativePath(relativePath)) {
    return createUnresolvedMedia(line, "Unsupported image type");
  }
  return {
    kind: "image",
    raw: line,
    relativePath,
  };
};

export const parseCardMediaText = (value?: string | null): CardMediaItem[] => {
  if (!value || !value.trim()) {
    return [];
  }

  const lines = normalizeLines(value);
  const items: CardMediaItem[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fenceMatch = line.trimStart().match(mediaFencePattern);
    if (fenceMatch) {
      const fenceToken = fenceMatch[1] ?? "";
      const infoString = fenceMatch[2]?.trim() ?? "";
      const blockLines: string[] = [];
      index += 1;
      let foundEnd = false;

      while (index < lines.length) {
        const current = lines[index] ?? "";
        const closingMatch = current.trimStart().match(mediaFencePattern);
        if (closingMatch && closingMatch[1] === fenceToken) {
          foundEnd = true;
          index += 1;
          break;
        }
        blockLines.push(current);
        index += 1;
      }

      const raw = blockLines.join("\n");
      if (infoString === "svg") {
        if (!foundEnd) {
          items.push(createUnresolvedMedia(raw, "Unclosed media code block"));
          continue;
        }
        const validation = validateSvgMarkup(raw);
        items.push({
          kind: "svg",
          raw,
          sanitized: validation.sanitized,
          invalidReason:
            validation.sanitized === null
              ? validation.invalidReason ?? "SVG invalid."
              : undefined,
        });
        continue;
      }

      items.push(
        createUnresolvedMedia(
          raw,
          foundEnd ? "Unsupported media code block" : "Unclosed media code block",
        ),
      );
      continue;
    }

    if (/^\[\[.+\]\]$/.test(trimmed)) {
      items.push(parseWikilinkMediaLine(trimmed));
      index += 1;
      continue;
    }

    items.push(createUnresolvedMedia(trimmed, "Unsupported media entry"));
    index += 1;
  }

  return items;
};
