/**
 * @file apps/fmd-desktop/src/lib/cardMedia.ts
 *
 * Zweck:
 * - Definiert Medienmodelle fuer PNG-Embeds und svg-Codefences.
 * - Validiert SVG und bereitet Vault-PNG-Kandidaten / Aufloesung vor.
 */

import { normalizeRelativePath } from "./path";
import type { VaultPngAsset } from "./tree";
import {
  buildMarkdownMediaPreviewData as buildPreviewData,
  extractMarkdownMediaTokensFromText,
  splitMarkdownMediaSource as splitMediaSource,
  stripMarkdownMediaFromLines,
  type MarkdownMediaPreviewData as RawMarkdownMediaPreviewData,
  type MarkdownMediaToken,
} from "./markdownMedia";
import { normalizeVaultAssetRelativePath } from "./vaultAssets";

export type MediaKind = "png" | "svg";

export type MediaItem = {
  id: string;
  type: MediaKind;
  src: string;
  inlineSvg?: string;
  label?: string;
  rawBlock: string;
};

export type EditorMediaDraft = {
  id: string;
  type: MediaKind;
  src: string;
  inlineSvg: string;
  label: string;
};

export type VaultImageCandidate = {
  id: string;
  relPath: string;
  absolutePath: string;
  displayName: string;
  folder: string;
  sizeBytes?: number | null;
  lastModified?: number | null;
  searchText: string;
};

export type SvgValidationResult = {
  sanitized: string | null;
  invalidReason?: string;
};

export type MarkdownMediaPreviewGroup = {
  index: number;
  items: MediaItem[];
  raw: string;
};

export type MarkdownMediaPreviewData = {
  markdown: string;
  groups: MarkdownMediaPreviewGroup[];
};

export type MarkdownMediaSourceSegment =
  | {
      kind: "markdown";
      source: string;
    }
  | {
      kind: "media";
      items: MediaItem[];
      raw: string;
    };

type ParseMediaOptions = {
  scope?: string;
  sourceIndex?: number;
};

const unsafeSvgTags = new Set(["script", "foreignobject"]);

const basenameWithoutExtension = (value: string) => {
  const parts = value.split("/");
  const fileName = parts[parts.length - 1] ?? value;
  return fileName.replace(/\.[^.]+$/, "");
};

const hashString = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return Math.abs(hash >>> 0).toString(36);
};

const buildMediaId = (
  item: Pick<MediaItem, "type" | "src" | "label" | "inlineSvg">,
  options?: ParseMediaOptions,
  occurrence = 0,
) => {
  const scope = options?.scope ?? "media";
  const sourceIndex = options?.sourceIndex ?? 0;
  return `media-${hashString(
    `${scope}:${sourceIndex}:${occurrence}:${item.type}:${item.src}:${item.label ?? ""}:${item.inlineSvg ?? ""}`,
  )}`;
};

export const normalizeMediaRelativePath = (value?: string | null) =>
  normalizeVaultAssetRelativePath(value);

const trimOptional = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
};

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
    if ((name === "href" || name === "xlink:href") && !isSafeSvgHref(attribute.value)) {
      element.removeAttribute(attribute.name);
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

export const serializePngEmbed = (src: string, label?: string | null) => {
  const normalizedSrc = normalizeMediaRelativePath(src) ?? src.trim();
  const normalizedLabel = trimOptional(label);
  return normalizedLabel ? `![[${normalizedSrc}|${normalizedLabel}]]` : `![[${normalizedSrc}]]`;
};

export const serializeSvgFence = (inlineSvg: string) =>
  ["```svg", inlineSvg.trim(), "```"].join("\n");

const buildMediaItem = (
  base: Omit<MediaItem, "id" | "rawBlock">,
  options?: ParseMediaOptions,
  occurrence = 0,
): MediaItem => {
  const rawBlock = base.type === "png"
    ? serializePngEmbed(base.src, base.label)
    : serializeSvgFence(base.inlineSvg ?? "");
  return {
    ...base,
    id: buildMediaId(base, options, occurrence),
    rawBlock,
  };
};

export const mediaTokenToItem = (
  token: MarkdownMediaToken,
  options?: ParseMediaOptions,
  occurrence = 0,
): MediaItem => {
  if (token.type === "png") {
    return {
      id: buildMediaId(token, options, occurrence),
      type: "png",
      src: token.src,
      label: token.label,
      rawBlock: token.raw,
    };
  }

  return {
    id: buildMediaId(token, options, occurrence),
    type: "svg",
    src: "inline",
    inlineSvg: token.inlineSvg,
    rawBlock: token.raw,
  };
};

export const mediaTokensToItems = (
  tokens: MarkdownMediaToken[],
  options?: ParseMediaOptions,
) =>
  tokens.map((token, occurrence) => mediaTokenToItem(token, options, occurrence));

const createMediaDraftId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `media-draft-${crypto.randomUUID()}`;
  }
  return `media-draft-${hashString(`${Date.now()}-${Math.random()}`)}`;
};

export const createEditorMediaDraft = (
  partial?: Partial<EditorMediaDraft>,
): EditorMediaDraft => ({
  id: partial?.id ?? createMediaDraftId(),
  type: partial?.type ?? "png",
  src: partial?.src ?? "",
  inlineSvg: partial?.inlineSvg ?? "",
  label: partial?.label ?? "",
});

export const cloneEditorMediaDraft = (draft: EditorMediaDraft): EditorMediaDraft =>
  createEditorMediaDraft(draft);

export const editorMediaDraftToItem = (
  draft: EditorMediaDraft,
  options?: ParseMediaOptions,
  occurrence = 0,
): MediaItem => {
  if (draft.type === "png") {
    return buildMediaItem(
      {
        type: "png",
        src: normalizeMediaRelativePath(draft.src) ?? draft.src.trim(),
        label: trimOptional(draft.label),
      },
      options,
      occurrence,
    );
  }

  return buildMediaItem(
    {
      type: "svg",
      src: "inline",
      inlineSvg: draft.inlineSvg.trim(),
    },
    options,
    occurrence,
  );
};

export const mediaItemToDraft = (item: MediaItem): EditorMediaDraft =>
  createEditorMediaDraft({
    id: item.id,
    type: item.type,
    src: item.type === "png" ? item.src : "",
    inlineSvg: item.type === "svg" ? item.inlineSvg ?? "" : "",
    label: item.label ?? "",
  });

export const mediaItemsToDrafts = (items?: MediaItem[] | null) =>
  (items ?? []).map(mediaItemToDraft);

export const parseCardMediaText = (value?: string | null): MediaItem[] =>
  mediaTokensToItems(extractMarkdownMediaTokensFromText(value), {
    scope: "card-media-text",
  });

export const extractMediaFromLines = (lines: string[], scope = "media") => {
  const extracted = stripMarkdownMediaFromLines(lines);
  return {
    contentLines: extracted.contentLines,
    items: mediaTokensToItems(extracted.tokens, { scope }),
  };
};

export const splitMarkdownMediaSegments = (
  source: string,
  scope = "media-source",
): MarkdownMediaSourceSegment[] =>
  splitMediaSource(source).map((segment, index) => {
    if (segment.kind === "markdown") {
      return segment;
    }
    return {
      kind: "media",
      items: mediaTokensToItems(segment.tokens, {
        scope,
        sourceIndex: index,
      }),
      raw: segment.raw,
    };
  });

export const buildMarkdownMediaPreviewSource = (
  markdown: string,
  scope = "media-preview",
): MarkdownMediaPreviewData => {
  const previewData: RawMarkdownMediaPreviewData = buildPreviewData(markdown);
  return {
    markdown: previewData.markdown,
    groups: previewData.groups.map((group, index) => ({
      index: group.index,
      raw: group.raw,
      items: mediaTokensToItems(group.tokens, {
        scope,
        sourceIndex: index,
      }),
    })),
  };
};

export const buildVaultImageCandidates = (assets?: VaultPngAsset[] | null): VaultImageCandidate[] =>
  (assets ?? [])
    .slice()
    .sort((left, right) => {
      const fileNameCompare = left.file_name.localeCompare(right.file_name, undefined, {
        sensitivity: "base",
      });
      if (fileNameCompare !== 0) {
        return fileNameCompare;
      }
      return left.relative_path.localeCompare(right.relative_path, undefined, {
        sensitivity: "base",
      });
    })
    .map((asset) => {
      const relPath = normalizeRelativePath(asset.relative_path);
      const folder = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
      return {
        id: `vault-image-${hashString(relPath)}`,
        relPath,
        absolutePath: asset.path,
        displayName: asset.file_name,
        folder,
        sizeBytes: asset.size_bytes ?? null,
        lastModified: asset.last_modified ?? null,
        searchText: [asset.file_name, folder, relPath].filter(Boolean).join(" ").toLowerCase(),
      };
    });

export const resolveMediaPngAsset = (item: MediaItem, assets?: VaultPngAsset[] | null) => {
  if (item.type !== "png") {
    return null;
  }
  const normalized = normalizeMediaRelativePath(item.src);
  if (!normalized) {
    return null;
  }
  return (
    (assets ?? []).find(
      (asset) =>
        normalizeRelativePath(asset.relative_path).toLowerCase() === normalized.toLowerCase(),
    ) ?? null
  );
};

export const resolveMediaLabel = (item: MediaItem) => {
  if (item.type !== "png") {
    return undefined;
  }
  return trimOptional(item.label) ?? basenameWithoutExtension(item.src);
};
