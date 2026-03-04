/**
 * @file apps/fmd-desktop/src/lib/cardMedia.ts
 *
 * Zweck:
 * - Definiert die strukturierte Karten-Medien-Syntax.
 * - Parst legacy und kanonische #media-Bloecke.
 * - Validiert SVG und bereitet PNG-Kandidaten / Aufloesung vor.
 */

import { normalizeRelativePath } from "./path";
import type { VaultPngAsset } from "./tree";
import { extractVaultAssetRelativePath } from "./vaultAssets";

export type MediaFit = "contain" | "cover";
export type MediaKind = "png" | "svg";

export type MediaItem = {
  id: string;
  type: MediaKind;
  src: string;
  inlineSvg?: string;
  alt?: string;
  title?: string;
  caption?: string;
  width?: number | null;
  height?: number | null;
  fit: MediaFit;
  rawBlock: string;
};

export type MediaRenderState = {
  item: MediaItem;
  mode: "preview" | "source";
  resolvedPngAsset?: VaultPngAsset | null;
  sanitizedSvg?: string | null;
  invalidReason?: string;
};

export type EditorMediaDraft = {
  id: string;
  type: MediaKind;
  src: string;
  inlineSvg: string;
  alt: string;
  title: string;
  caption: string;
  width: string;
  height: string;
  fit: MediaFit;
};

export type VaultImageCandidate = {
  id: string;
  relPath: string;
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

type MediaScalarFields = {
  type?: string;
  src?: string;
  alt?: string;
  title?: string;
  caption?: string;
  width?: string;
  height?: string;
  fit?: string;
};

type ParseMediaBlockOptions = {
  scope?: string;
  sourceIndex?: number;
};

const mediaFencePattern = /^\s*(```|~~~)(.*)$/;
const mediaFieldPattern = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/;
const supportedImageExtensionPattern =
  /\.(?:png|jpe?g|gif|webp|bmp|svg)(?:[?#].*)?$/i;
const unsafeSvgTags = new Set(["script", "foreignobject"]);

const normalizeLines = (value: string) => value.replace(/\r\n?/g, "\n").split("\n");

const trimEmptyLines = (lines: string[]) => {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.trim() === "") {
    start += 1;
  }
  while (end > start && lines[end - 1]?.trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
};

const basenameWithoutExtension = (value: string) => {
  const parts = value.split("/");
  const fileName = parts[parts.length - 1] ?? value;
  return fileName.replace(/\.[^.]+$/, "");
};

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

const hashString = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return Math.abs(hash >>> 0).toString(36);
};

const buildMediaId = (
  type: MediaKind,
  src: string,
  options?: ParseMediaBlockOptions,
  occurrence = 0,
) => {
  const scope = options?.scope ?? "media";
  const sourceIndex = options?.sourceIndex ?? 0;
  return `media-${hashString(`${scope}:${sourceIndex}:${occurrence}:${type}:${src}`)}`;
};

const parsePositiveInteger = (value?: string) => {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeMediaFit = (value?: string): MediaFit =>
  value?.trim().toLowerCase() === "cover" ? "cover" : "contain";

const normalizeMediaAlt = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim() ?? "";
  return trimmed || fallback;
};

const trimOptional = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
};

export const normalizeMediaRelativePath = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (/^[A-Za-z]:[\\/]/.test(trimmed) || /^[\\/]{1,2}/.test(trimmed)) {
    return null;
  }
  const normalized = normalizeRelativePath(trimmed).replace(/^\/+/, "");
  if (!normalized) {
    return null;
  }
  const parts = normalized.split("/");
  if (parts.some((segment) => segment === "..")) {
    return null;
  }
  return normalized;
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

const buildMediaItem = (
  base: Omit<MediaItem, "id" | "rawBlock">,
  options?: ParseMediaBlockOptions,
  occurrence = 0,
): MediaItem => {
  const item: MediaItem = {
    ...base,
    id: buildMediaId(base.type, base.src, options, occurrence),
    rawBlock: "",
  };
  item.rawBlock = serializeMediaItem(item);
  return item;
};

export const serializeMediaItem = (item: Omit<MediaItem, "rawBlock"> | MediaItem) => {
  const headerLines = [
    "#media",
    `type: ${item.type}`,
    `src: ${item.type === "svg" ? "inline" : item.src}`,
  ];

  if (trimOptional(item.alt)) {
    headerLines.push(`alt: ${trimOptional(item.alt)}`);
  }
  if (trimOptional(item.title)) {
    headerLines.push(`title: ${trimOptional(item.title)}`);
  }
  if (trimOptional(item.caption)) {
    headerLines.push(`caption: ${trimOptional(item.caption)}`);
  }
  if (typeof item.width === "number" && Number.isFinite(item.width) && item.width > 0) {
    headerLines.push(`width: ${item.width}`);
  }
  if (typeof item.height === "number" && Number.isFinite(item.height) && item.height > 0) {
    headerLines.push(`height: ${item.height}`);
  }
  if ((item.fit ?? "contain") !== "contain") {
    headerLines.push(`fit: ${item.fit}`);
  }

  if (item.type === "svg") {
    const svgSource = item.inlineSvg?.trim() ?? "";
    return [
      ...headerLines,
      "",
      "```svg",
      svgSource,
      "```",
      "#mediaend",
    ].join("\n");
  }

  return [...headerLines, "#mediaend"].join("\n");
};

export const serializeMediaItems = (items?: MediaItem[] | null) =>
  (items ?? []).map((item) => serializeMediaItem(item));

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
  alt: partial?.alt ?? "",
  title: partial?.title ?? "",
  caption: partial?.caption ?? "",
  width: partial?.width ?? "",
  height: partial?.height ?? "",
  fit: partial?.fit ?? "contain",
});

export const cloneEditorMediaDraft = (draft: EditorMediaDraft): EditorMediaDraft =>
  createEditorMediaDraft(draft);

export const editorMediaDraftToItem = (
  draft: EditorMediaDraft,
  options?: ParseMediaBlockOptions,
  occurrence = 0,
): MediaItem =>
  buildMediaItem(
    {
      type: draft.type,
      src:
        draft.type === "svg"
          ? "inline"
          : normalizeMediaRelativePath(draft.src) ?? draft.src.trim(),
      inlineSvg: draft.type === "svg" ? draft.inlineSvg.trim() : undefined,
      alt: trimOptional(draft.alt),
      title: trimOptional(draft.title),
      caption: trimOptional(draft.caption),
      width: parsePositiveInteger(draft.width),
      height: parsePositiveInteger(draft.height),
      fit: draft.fit,
    },
    options,
    occurrence,
  );

export const mediaItemToDraft = (item: MediaItem): EditorMediaDraft =>
  createEditorMediaDraft({
    id: item.id,
    type: item.type,
    src: item.type === "svg" ? "" : item.src,
    inlineSvg: item.inlineSvg ?? "",
    alt: item.alt ?? "",
    title: item.title ?? "",
    caption: item.caption ?? "",
    width: typeof item.width === "number" ? String(item.width) : "",
    height: typeof item.height === "number" ? String(item.height) : "",
    fit: item.fit,
  });

export const mediaItemsToDrafts = (items?: MediaItem[] | null) =>
  (items ?? []).map(mediaItemToDraft);

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
        displayName: asset.file_name,
        folder,
        sizeBytes: asset.size_bytes ?? null,
        lastModified: asset.last_modified ?? null,
        searchText: [asset.file_name, folder, relPath].filter(Boolean).join(" ").toLowerCase(),
      };
    });

export const resolveMediaPngAsset = (
  item: MediaItem,
  assets?: VaultPngAsset[] | null,
) => {
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

const parseLegacyWikilinkMediaLine = (
  line: string,
  options?: ParseMediaBlockOptions,
  occurrence = 0,
) => {
  const relativePath = extractVaultAssetRelativePath(line);
  const normalized = normalizeMediaRelativePath(relativePath);
  if (!normalized || !isSupportedImageRelativePath(normalized)) {
    return null;
  }
  return buildMediaItem(
    {
      type: "png",
      src: normalized,
      alt: basenameWithoutExtension(normalized),
      fit: "contain",
    },
    options,
    occurrence,
  );
};

const parseLegacyMediaBody = (value: string, options?: ParseMediaBlockOptions): MediaItem[] => {
  const lines = normalizeLines(value);
  const items: MediaItem[] = [];
  let index = 0;
  let occurrence = 0;

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

      if (foundEnd && infoString === "svg") {
        items.push(
          buildMediaItem(
            {
              type: "svg",
              src: "inline",
              inlineSvg: blockLines.join("\n").trim(),
              fit: "contain",
            },
            options,
            occurrence,
          ),
        );
        occurrence += 1;
      }
      continue;
    }

    if (/^\[\[.+\]\]$/.test(trimmed)) {
      const item = parseLegacyWikilinkMediaLine(trimmed, options, occurrence);
      if (item) {
        items.push(item);
        occurrence += 1;
      }
    }

    index += 1;
  }

  return items;
};

const parseStructuredMediaBody = (
  value: string,
  options?: ParseMediaBlockOptions,
): MediaItem[] | null => {
  const lines = normalizeLines(value);
  const firstNonEmpty = lines.find((line) => line.trim() !== "");
  if (!firstNonEmpty) {
    return [];
  }
  if (!mediaFieldPattern.test(firstNonEmpty.trim())) {
    return null;
  }

  const fields: MediaScalarFields = {};
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      break;
    }
    const match = trimmed.match(mediaFieldPattern);
    if (!match) {
      return null;
    }
    fields[(match[1] ?? "").toLowerCase() as keyof MediaScalarFields] = match[2] ?? "";
    index += 1;
  }

  const mediaType = (fields.type ?? "").trim().toLowerCase();
  if (mediaType !== "png" && mediaType !== "svg") {
    return null;
  }

  const fit = normalizeMediaFit(fields.fit);
  const width = parsePositiveInteger(fields.width);
  const height = parsePositiveInteger(fields.height);
  const title = trimOptional(fields.title);
  const caption = trimOptional(fields.caption);

  if (mediaType === "png") {
    const rawSrc = (fields.src ?? "").trim();
    if (!rawSrc) {
      return [];
    }
    const normalizedSrc = normalizeMediaRelativePath(rawSrc) ?? rawSrc;
    return [
      buildMediaItem(
        {
          type: "png",
          src: normalizedSrc,
          alt: normalizeMediaAlt(fields.alt, basenameWithoutExtension(normalizedSrc)),
          title,
          caption,
          width,
          height,
          fit,
        },
        options,
      ),
    ];
  }

  const svgSrc = (fields.src ?? "").trim().toLowerCase();
  const remainder = trimEmptyLines(lines.slice(index));
  if (svgSrc !== "inline") {
    return remainder.length > 0
      ? [
          buildMediaItem(
            {
              type: "svg",
              src: "inline",
              inlineSvg: remainder.join("\n").trim(),
              alt: trimOptional(fields.alt),
              title,
              caption,
              width,
              height,
              fit,
            },
            options,
          ),
        ]
      : [];
  }
  if (remainder.length < 3) {
    return [
      buildMediaItem(
        {
          type: "svg",
          src: "inline",
          inlineSvg: remainder.join("\n").trim(),
          alt: trimOptional(fields.alt),
          title,
          caption,
          width,
          height,
          fit,
        },
        options,
      ),
    ];
  }
  const openingFence = remainder[0]?.trimStart().match(mediaFencePattern);
  const closingFence = remainder[remainder.length - 1]?.trimStart().match(mediaFencePattern);
  if (
    !openingFence ||
    !closingFence ||
    openingFence[1] !== closingFence[1] ||
    (openingFence[2]?.trim() ?? "") !== "svg"
  ) {
    return [
      buildMediaItem(
        {
          type: "svg",
          src: "inline",
          inlineSvg: remainder.join("\n").trim(),
          alt: trimOptional(fields.alt),
          title,
          caption,
          width,
          height,
          fit,
        },
        options,
      ),
    ];
  }
  const inlineSvg = remainder.slice(1, -1).join("\n").trim();
  return [
    buildMediaItem(
      {
        type: "svg",
        src: "inline",
        inlineSvg,
        alt: trimOptional(fields.alt),
        title,
        caption,
        width,
        height,
        fit,
      },
      options,
    ),
  ];
};

export const parseMediaBlockBody = (
  value?: string | null,
  options?: ParseMediaBlockOptions,
): MediaItem[] => {
  if (!value || !value.trim()) {
    return [];
  }
  const structured = parseStructuredMediaBody(value, options);
  if (structured !== null) {
    return structured;
  }
  return parseLegacyMediaBody(value, options);
};

export const parseCardMediaText = (value?: string | null): MediaItem[] =>
  parseMediaBlockBody(value, { scope: "legacy-card-media" });

export const parseMediaBlocks = (
  blocks: Array<{ text: string; startIndex?: number }> | string[],
  scope = "media-block",
) => {
  const items: MediaItem[] = [];
  let occurrence = 0;
  blocks.forEach((block, blockIndex) => {
    const text = typeof block === "string" ? block : block.text;
    const sourceIndex =
      typeof block === "string" ? blockIndex : (block.startIndex ?? blockIndex);
    parseMediaBlockBody(text, { scope, sourceIndex }).forEach((item) => {
      items.push({
        ...item,
        id: buildMediaId(item.type, item.src, { scope, sourceIndex }, occurrence),
        rawBlock: serializeMediaItem(item),
      });
      occurrence += 1;
    });
  });
  return items;
};
