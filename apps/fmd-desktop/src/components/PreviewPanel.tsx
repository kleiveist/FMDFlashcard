/**
 * @file apps/fmd-desktop/src/components/PreviewPanel.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Preview Panel.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/types.ts: Typen.
 * - apps/fmd-desktop/src/lib/tree.ts: Typen.
 *
 * Exportiert:
 * - PreviewPanel: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import {
  Children,
  Fragment,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  cloneElement,
  isValidElement,
  type SyntheticEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  MarkdownHybridEditor,
  type MarkdownHybridEditorHandle,
  type MarkdownHybridEditorMode,
} from "../features/preview/MarkdownHybridEditor";
import {
  parseMarkdownBlocks,
  type MarkdownBlock,
} from "../features/preview/markdownBlocks";
import { MarkdownHybridDatabaseBlock } from "../features/preview/database/database-block";
import {
  addFrontmatterProperty,
  collectFrontmatterValueSuggestions,
  extractWikilinkTarget,
  type FrontmatterProperty,
  type FrontmatterPropertyIcon,
  type FrontmatterPropertyKind,
  composeMarkdownWithBody,
  isLinkPropertyKey,
  normalizeWikilinkValue,
  parseFrontmatterDocument,
  parseFrontmatterLinks,
  removeFrontmatterProperty,
  reorderFrontmatterProperties,
  updateFrontmatterLinks,
  updateFrontmatterProperty,
} from "../features/preview/frontmatter";
import { normalizeRelativePath } from "../lib/path";
import {
  normalizeMarkdownPipeTables,
  normalizeMarkdownTableCellPreviewValue,
} from "../lib/markdownTables";
import {
  resolveMarkdownTableCellSegments,
  SHARED_TABLE_CELL_CONTENT_CLASS,
  SHARED_TABLE_CELL_IMAGE_CLASS,
  SHARED_TABLE_CELL_MEDIA_CLASS,
  SHARED_TABLE_WRAP_CLASS,
} from "../lib/markdownTableCellMedia";
import { renderMarkdownMathNode } from "../lib/markdownMath";
import {
  normalizeInlineFormattingForPreview,
  remarkPreserveOrderedListDelimiters,
  remarkPreserveSoftBreaks,
  resolveOrderedListDelimiter,
} from "../lib/markdownPreviewShared";
import { extractVaultAssetRelativePath, resolveVaultImageSrc } from "../lib/vaultAssets";
import { type LoadState } from "../lib/types";
import { type VaultFile, type VaultPngAsset } from "../lib/tree";
import {
  handleListEnterExitToRootParagraph,
  handleListSoftBreak,
  indentSelectedListItems,
  normalizeEditableListMarkers,
  outdentSelectedListItems,
  type CommandResult,
} from "./previewMarkdownListCommands";
import { useMediaQuery } from "../lib/useMediaQuery";
import { SMART_QUERY } from "../lib/breakpoints";
import { ChevronDownIcon, CodeIcon, EditIcon, GridEventIcon, MarkdownIcon } from "./icons";
import { FlashcardMediaGroup } from "./flashcards/FlashcardMediaGroup";
import { SvgPreviewBlock } from "./flashcards/SvgPreviewBlock";
import { extractSvgCodeBlockSource } from "./markdownSvg";
import { MarkdownHighlightedPre } from "./MarkdownHighlightedPre";
import {
  buildMarkdownMediaPreviewSource,
  type MarkdownMediaPreviewGroup,
} from "../lib/cardMedia";
import { applyHighlightToCodeElement, scheduleIdleTask } from "../lib/markdownCodeHighlight";
import { MARKDOWN_CODE_HIGHLIGHT_CONFIG } from "../lib/markdownCodeHighlightConfig";

export { normalizeInlineFormattingForPreview };

type CoverThumbnailSource = {
  src?: string | null;
  path: string;
  relativePath: string;
  lastModified?: number | null;
  sizeBytes?: number | null;
};

type CoverAlphaCropRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type CoverThumbnailCropScanResult =
  | { kind: "none" }
  | {
      kind: "crop";
      sourceWidth: number;
      sourceHeight: number;
      rect: CoverAlphaCropRect;
    };

const COVER_THUMBNAIL_ALPHA_THRESHOLD = 12;
const COVER_THUMBNAIL_CROP_PADDING_PX = 3;
const COVER_THUMBNAIL_NEAR_FULL_RATIO = 0.95;
const COVER_THUMBNAIL_MAX_SCAN_SIDE = 512;
const COVER_THUMBNAIL_FALLBACK_WIDTH = 176;
const COVER_THUMBNAIL_FALLBACK_HEIGHT = 99;

const readMarkdownElementProperty = (node: unknown, key: string) => {
  if (
    !node ||
    typeof node !== "object" ||
    !("properties" in node) ||
    !node.properties ||
    typeof node.properties !== "object"
  ) {
    return undefined;
  }
  const properties = node.properties as Record<string, unknown>;
  if (key in properties) {
    return properties[key];
  }
  const camelKey = key.replace(/-([a-z])/g, (_match, character: string) =>
    character.toUpperCase()
  );
  return properties[camelKey];
};

const mediaPlaceholderTextPattern = /__FMD_MEDIA_(\d+)__/;
const markdownFenceDelimiterPattern = /^\s*(```|~~~)/;
const standaloneMediaPlaceholderLinePattern =
  /^\s*<div\b[^>]*\bdata-fmd-media-block=(["'])true\1[^>]*>__FMD_MEDIA_\d+__<\/div>\s*$/;
const standaloneMarkdownImageLinePattern =
  /^\s*!\[[^\]\n]*\]\((?:\\.|[^()\n]|(?:\([^()\n]*\)))*\)\s*$/;

const isStandaloneMediaBoundaryLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  if (standaloneMediaPlaceholderLinePattern.test(trimmed)) {
    return true;
  }
  return standaloneMarkdownImageLinePattern.test(trimmed);
};

const enforceStandaloneMediaBlockBoundaries = (markdown: string) => {
  if (!markdown) {
    return markdown;
  }

  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const normalizedLines: string[] = [];
  let inFence = false;
  let activeFenceToken = "";

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const trimmedLine = line.trim();
    const fenceMatch = trimmedLine.match(markdownFenceDelimiterPattern);

    if (inFence) {
      normalizedLines.push(line);
      if (fenceMatch && (fenceMatch[1] ?? "") === activeFenceToken) {
        inFence = false;
        activeFenceToken = "";
      }
      continue;
    }

    if (fenceMatch) {
      inFence = true;
      activeFenceToken = fenceMatch[1] ?? "";
      normalizedLines.push(line);
      continue;
    }

    if (!isStandaloneMediaBoundaryLine(line)) {
      normalizedLines.push(line);
      continue;
    }

    const previousLine = normalizedLines[normalizedLines.length - 1];
    if (typeof previousLine === "string" && previousLine.trim() !== "") {
      normalizedLines.push("");
    }

    normalizedLines.push(line);

    const nextSourceLine = lines[lineIndex + 1];
    if (typeof nextSourceLine === "string" && nextSourceLine.trim() !== "") {
      normalizedLines.push("");
    }
  }

  return normalizedLines.join("\n");
};

const readMarkdownNodeText = (node: unknown): string => {
  if (!node || typeof node !== "object") {
    return "";
  }
  if ("type" in node && (node as { type?: unknown }).type === "text") {
    const value = (node as { value?: unknown }).value;
    return typeof value === "string" ? value : "";
  }
  if (!("children" in node)) {
    return "";
  }
  const children = (node as { children?: unknown }).children;
  if (!Array.isArray(children)) {
    return "";
  }
  return children.map((child) => readMarkdownNodeText(child)).join("");
};

const readMarkdownNodeSource = (node: unknown, source: string): string => {
  const resolveOffsetFromLineColumn = (line?: number, column?: number) => {
    if (typeof line !== "number" || typeof column !== "number" || line < 1 || column < 1) {
      return null;
    }
    let offset = 0;
    let currentLine = 1;
    while (currentLine < line && offset <= source.length) {
      const nextNewline = source.indexOf("\n", offset);
      if (nextNewline < 0) {
        return null;
      }
      offset = nextNewline + 1;
      currentLine += 1;
    }
    return Math.min(source.length, offset + column - 1);
  };

  if (
    node &&
    typeof node === "object" &&
    "position" in node &&
    node.position &&
    typeof node.position === "object"
  ) {
    const position = node.position as {
      start?: { offset?: number; line?: number; column?: number };
      end?: { offset?: number; line?: number; column?: number };
    };
    const startOffset = typeof position.start?.offset === "number"
      ? position.start.offset
      : resolveOffsetFromLineColumn(position.start?.line, position.start?.column);
    const endOffset = typeof position.end?.offset === "number"
      ? position.end.offset
      : resolveOffsetFromLineColumn(position.end?.line, position.end?.column);
    if (
      typeof startOffset === "number" &&
      typeof endOffset === "number" &&
      startOffset >= 0 &&
      endOffset >= startOffset &&
      endOffset <= source.length
    ) {
      const sliced = source.slice(startOffset, endOffset);
      if (sliced.length > 0) {
        return sliced;
      }
    }
  }
  return readMarkdownNodeText(node);
};

const renderMarkdownMediaGroup = ({
  node,
  groups,
  vaultPngAssets,
  vaultPath,
  sourceRelativePath,
}: {
  node: unknown;
  groups: MarkdownMediaPreviewGroup[];
  vaultPngAssets?: VaultPngAsset[];
  vaultPath?: string | null;
  sourceRelativePath?: string | null;
}) => {
  const mediaBlockMarker = readMarkdownElementProperty(node, "data-fmd-media-block");
  const placeholderMatch = readMarkdownNodeText(node).match(mediaPlaceholderTextPattern);
  const placeholderIndex = placeholderMatch
    ? Number.parseInt(placeholderMatch[1] ?? "", 10)
    : Number.NaN;
  const hasPlaceholderIndex = Number.isFinite(placeholderIndex);
  if (typeof mediaBlockMarker === "undefined" && !hasPlaceholderIndex) {
    return null;
  }
  const mediaIndexRaw = readMarkdownElementProperty(node, "data-media-index");
  let mediaIndex = Number.parseInt(
    String(mediaIndexRaw ?? ""),
    10,
  );
  if (!Number.isFinite(mediaIndex) && hasPlaceholderIndex) {
    mediaIndex = placeholderIndex;
  }
  const mediaGroup = Number.isFinite(mediaIndex)
    ? (groups[mediaIndex] ?? null)
    : (groups.length === 1 ? groups[0] ?? null : null);
  if (!mediaGroup) {
    return null;
  }
  if (mediaGroup.items.length === 0) {
    return (
      <pre className="flashcard-code-block media-block-card-source">
        <code>{mediaGroup.raw}</code>
      </pre>
    );
  }
  return (
    <FlashcardMediaGroup
      media={mediaGroup.items}
      vaultPngAssets={vaultPngAssets}
      vaultPath={vaultPath}
      sourceRelativePath={sourceRelativePath}
    />
  );
};

const coverThumbnailCropCache = new Map<string, CoverThumbnailCropScanResult>();
const coverThumbnailCropPending = new Map<string, Promise<CoverThumbnailCropScanResult>>();

const isPngImagePath = (value: string) => /\.png$/i.test(value);

const buildCoverThumbnailCropCacheKey = (source: CoverThumbnailSource) =>
  [
    normalizeRelativePath(source.relativePath || source.path || source.src || ""),
    source.lastModified ?? "na",
    source.sizeBytes ?? "na",
  ].join("::");

const clampCoverCropRect = (
  rect: CoverAlphaCropRect,
  width: number,
  height: number,
): CoverAlphaCropRect => {
  const x = Math.max(0, Math.min(width - 1, Math.floor(rect.x)));
  const y = Math.max(0, Math.min(height - 1, Math.floor(rect.y)));
  const maxWidth = Math.max(1, width - x);
  const maxHeight = Math.max(1, height - y);
  const w = Math.max(1, Math.min(maxWidth, Math.ceil(rect.w)));
  const h = Math.max(1, Math.min(maxHeight, Math.ceil(rect.h)));
  return { x, y, w, h };
};

const loadImageElement = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(new Error("Image API unavailable"));
      return;
    }
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });

const loadImageBitmapFromBlob = async (src: string) => {
  if (typeof fetch !== "function" || typeof createImageBitmap !== "function") {
    return null;
  }
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const blob = await response.blob();
  if (!blob) {
    return null;
  }
  return createImageBitmap(blob);
};

const tryReadCanvasPixels = (
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void,
  width: number,
  height: number,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = (canvas.getContext(
    "2d",
    { willReadFrequently: true } as CanvasRenderingContext2DSettings,
  ) ?? canvas.getContext("2d")) as CanvasRenderingContext2D | null;
  if (!context) {
    return null;
  }
  context.clearRect(0, 0, width, height);
  draw(context, width, height);
  return context.getImageData(0, 0, width, height).data;
};

const scanCoverThumbnailCrop = async (source: CoverThumbnailSource): Promise<CoverThumbnailCropScanResult> => {
  const src = source.src ?? source.path;
  if (!src) {
    return { kind: "none" };
  }
  if (!isPngImagePath(source.relativePath || source.path || src)) {
    return { kind: "none" };
  }
  if (typeof document === "undefined") {
    return { kind: "none" };
  }

  try {
    const image = await loadImageElement(src);
    const sourceWidth = Math.max(1, image.naturalWidth || image.width || 0);
    const sourceHeight = Math.max(1, image.naturalHeight || image.height || 0);
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return { kind: "none" };
    }

    const longestSide = Math.max(sourceWidth, sourceHeight);
    const scanScale = Math.min(1, COVER_THUMBNAIL_MAX_SCAN_SIDE / longestSide);
    const scanWidth = Math.max(1, Math.round(sourceWidth * scanScale));
    const scanHeight = Math.max(1, Math.round(sourceHeight * scanScale));

    let pixels: Uint8ClampedArray;
    try {
      const imagePixels = tryReadCanvasPixels(
        (context) => {
          context.drawImage(image, 0, 0, scanWidth, scanHeight);
        },
        scanWidth,
        scanHeight,
      );
      if (!imagePixels) {
        return { kind: "none" };
      }
      pixels = imagePixels;
    } catch {
      // Fallback for custom protocols / tainted canvas by decoding via Blob+ImageBitmap.
      try {
        const bitmap = await loadImageBitmapFromBlob(src);
        if (!bitmap) {
          return { kind: "none" };
        }
        try {
          const bitmapPixels = tryReadCanvasPixels(
            (context) => {
              context.drawImage(bitmap, 0, 0, scanWidth, scanHeight);
            },
            scanWidth,
            scanHeight,
          );
          if (!bitmapPixels) {
            return { kind: "none" };
          }
          pixels = bitmapPixels;
        } finally {
          bitmap.close();
        }
      } catch {
        return { kind: "none" };
      }
    }

    let minX = scanWidth;
    let minY = scanHeight;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < scanHeight; y += 1) {
      for (let x = 0; x < scanWidth; x += 1) {
        const alpha = pixels[(y * scanWidth + x) * 4 + 3] ?? 0;
        if (alpha <= COVER_THUMBNAIL_ALPHA_THRESHOLD) {
          continue;
        }
        if (x < minX) {
          minX = x;
        }
        if (y < minY) {
          minY = y;
        }
        if (x > maxX) {
          maxX = x;
        }
        if (y > maxY) {
          maxY = y;
        }
      }
    }

    if (maxX < 0 || maxY < 0) {
      return { kind: "none" };
    }

    const scaleBackX = sourceWidth / scanWidth;
    const scaleBackY = sourceHeight / scanHeight;
    const baseRect = {
      x: Math.floor(minX * scaleBackX),
      y: Math.floor(minY * scaleBackY),
      w: Math.ceil((maxX - minX + 1) * scaleBackX),
      h: Math.ceil((maxY - minY + 1) * scaleBackY),
    };
    const paddedRect = clampCoverCropRect(
      {
        x: baseRect.x - COVER_THUMBNAIL_CROP_PADDING_PX,
        y: baseRect.y - COVER_THUMBNAIL_CROP_PADDING_PX,
        w: baseRect.w + COVER_THUMBNAIL_CROP_PADDING_PX * 2,
        h: baseRect.h + COVER_THUMBNAIL_CROP_PADDING_PX * 2,
      },
      sourceWidth,
      sourceHeight,
    );

    const widthRatio = paddedRect.w / sourceWidth;
    const heightRatio = paddedRect.h / sourceHeight;
    if (
      widthRatio >= COVER_THUMBNAIL_NEAR_FULL_RATIO &&
      heightRatio >= COVER_THUMBNAIL_NEAR_FULL_RATIO
    ) {
      return { kind: "none" };
    }

    return {
      kind: "crop",
      sourceWidth,
      sourceHeight,
      rect: paddedRect,
    };
  } catch {
    return { kind: "none" };
  }
};

const getCoverThumbnailCropCached = async (
  source: CoverThumbnailSource,
): Promise<CoverThumbnailCropScanResult> => {
  const cacheKey = buildCoverThumbnailCropCacheKey(source);
  const cached = coverThumbnailCropCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const pending = coverThumbnailCropPending.get(cacheKey);
  if (pending) {
    return pending;
  }

  const nextPromise = scanCoverThumbnailCrop(source)
    .then((result) => {
      coverThumbnailCropCache.set(cacheKey, result);
      return result;
    })
    .finally(() => {
      coverThumbnailCropPending.delete(cacheKey);
    });

  coverThumbnailCropPending.set(cacheKey, nextPromise);
  return nextPromise;
};

const useCoverThumbnailCrop = (source: CoverThumbnailSource | null) => {
  const cacheKey = useMemo(
    () => (source ? buildCoverThumbnailCropCacheKey(source) : null),
    [source],
  );
  const [result, setResult] = useState<CoverThumbnailCropScanResult | null>(() =>
    cacheKey ? (coverThumbnailCropCache.get(cacheKey) ?? null) : null,
  );

  useEffect(() => {
    if (!source || !cacheKey) {
      setResult(null);
      return;
    }

    const cached = coverThumbnailCropCache.get(cacheKey);
    if (cached) {
      setResult(cached);
      return;
    }

    setResult(null);
    let cancelled = false;
    let timeoutHandle = 0;
    let idleHandle: number | null = null;

    const run = () => {
      void getCoverThumbnailCropCached(source).then((next) => {
        if (cancelled) {
          return;
        }
        setResult(next);
      });
    };

    const idleWindow = typeof window !== "undefined"
      ? (window as Window & {
          requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
          cancelIdleCallback?: (handle: number) => void;
        })
      : null;

    if (idleWindow?.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(run, { timeout: 120 });
    } else if (typeof window !== "undefined") {
      timeoutHandle = window.setTimeout(run, 24);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== null) {
        idleWindow?.cancelIdleCallback?.(idleHandle);
      }
      if (timeoutHandle) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [cacheKey, source]);

  return result;
};

type CoverThumbnailImageProps = {
  variant: "main" | "picker" | "add";
  image: CoverThumbnailSource;
  alt: string;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void;
};

type CoverThumbnailRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type CoverThumbnailTransformMode = "contain" | "cover" | "fill-height";

type CoverThumbnailTransformResult = {
  style: CSSProperties;
  contentWidth: number;
  contentHeight: number;
};

const COVER_THUMBNAIL_BACKDROP_SCALE_BOOST = 1.1;
const COVER_THUMBNAIL_BAR_EPSILON_PX = 1;

const resolveCoverThumbnailFallbackSize = (variant: CoverThumbnailImageProps["variant"]) => {
  if (variant === "picker") {
    return { width: 26, height: 26 };
  }
  if (variant === "add") {
    return { width: 24, height: 24 };
  }
  return {
    width: COVER_THUMBNAIL_FALLBACK_WIDTH,
    height: COVER_THUMBNAIL_FALLBACK_HEIGHT,
  };
};

const resolveCoverThumbnailFrameClassName = (variant: CoverThumbnailImageProps["variant"]) => {
  if (variant === "picker") {
    return "frontmatter-cover-thumb-frame frontmatter-cover-picker-thumb-frame";
  }
  if (variant === "add") {
    return "frontmatter-cover-thumb-frame frontmatter-add-cover-thumb-frame";
  }
  return "frontmatter-cover-thumbnail-viewport frontmatter-cover-thumb-frame";
};

const resolveCoverThumbnailForegroundClassName = (
  variant: CoverThumbnailImageProps["variant"],
  transformed: boolean,
) => {
  const transformedClass = transformed
    ? " frontmatter-cover-thumb-transformed frontmatter-cover-thumbnail-cropped"
    : "";
  if (variant === "picker") {
    return `frontmatter-cover-thumb-foreground frontmatter-cover-picker-thumb-foreground${transformedClass}`;
  }
  if (variant === "add") {
    return `frontmatter-cover-thumb-foreground frontmatter-add-cover-thumb-foreground${transformedClass}`;
  }
  return `frontmatter-cover-thumbnail frontmatter-cover-thumb-foreground${transformedClass}`;
};

const resolveCoverThumbnailBackdropClassName = (variant: CoverThumbnailImageProps["variant"]) => {
  if (variant === "picker") {
    return "frontmatter-cover-thumb-backdrop frontmatter-cover-picker-thumb-backdrop";
  }
  if (variant === "add") {
    return "frontmatter-cover-thumb-backdrop frontmatter-add-cover-thumb-backdrop";
  }
  return "frontmatter-cover-thumb-backdrop frontmatter-cover-thumbnail-backdrop";
};

const resolveCoverThumbnailTransform = ({
  viewportWidth,
  viewportHeight,
  sourceWidth,
  sourceHeight,
  rect,
  mode,
  scaleBoost = 1,
}: {
  viewportWidth: number;
  viewportHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  rect: CoverThumbnailRect;
  mode: CoverThumbnailTransformMode;
  scaleBoost?: number;
}): CoverThumbnailTransformResult | null => {
  if (
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    rect.w <= 0 ||
    rect.h <= 0
  ) {
    return null;
  }

  const scaleX = viewportWidth / rect.w;
  const scaleY = viewportHeight / rect.h;
  let baseScale: number;
  switch (mode) {
    case "cover":
      baseScale = Math.max(scaleX, scaleY);
      break;
    case "fill-height":
      baseScale = scaleY;
      break;
    default:
      baseScale = Math.min(scaleX, scaleY);
      break;
  }
  const scale = baseScale * Math.max(1, scaleBoost);
  const contentWidth = rect.w * scale;
  const contentHeight = rect.h * scale;
  const offsetX = (viewportWidth - contentWidth) / 2;
  const offsetY = (viewportHeight - contentHeight) / 2;
  const translateX = offsetX - rect.x * scale;
  const translateY = offsetY - rect.y * scale;

  return {
    contentWidth,
    contentHeight,
    style: {
      width: `${sourceWidth}px`,
      height: `${sourceHeight}px`,
      transformOrigin: "top left",
      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
    },
  };
};

const CoverThumbnailImage = ({
  variant,
  image,
  alt,
  onLoad,
  onError,
}: CoverThumbnailImageProps) => {
  const viewportRef = useRef<HTMLSpanElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [viewportSize, setViewportSize] = useState(() =>
    resolveCoverThumbnailFallbackSize(variant)
  );
  const crop = useCoverThumbnailCrop(image);

  useEffect(() => {
    setNaturalSize(null);
  }, [image.path, image.relativePath, image.src]);

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    let frame = 0;
    const measure = () => {
      const fallback = resolveCoverThumbnailFallbackSize(variant);
      const nextWidth = element.clientWidth || fallback.width;
      const nextHeight = element.clientHeight || fallback.height;
      setViewportSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };
    const scheduleMeasure = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", scheduleMeasure);
      return () => {
        if (frame) {
          window.cancelAnimationFrame(frame);
        }
        window.removeEventListener("resize", scheduleMeasure);
      };
    }

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(element);
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      observer.disconnect();
    };
  }, [variant]);

  const sourceMetrics = useMemo(() => {
    if (crop?.kind === "crop") {
      return {
        width: crop.sourceWidth,
        height: crop.sourceHeight,
        rect: crop.rect as CoverThumbnailRect,
      };
    }
    if (!naturalSize) {
      return null;
    }
    return {
      width: naturalSize.width,
      height: naturalSize.height,
      rect: {
        x: 0,
        y: 0,
        w: naturalSize.width,
        h: naturalSize.height,
      } satisfies CoverThumbnailRect,
    };
  }, [crop, naturalSize]);

  const foregroundTransform = useMemo(
    () =>
      sourceMetrics
        ? resolveCoverThumbnailTransform({
            viewportWidth: Math.max(1, viewportSize.width),
            viewportHeight: Math.max(1, viewportSize.height),
            sourceWidth: sourceMetrics.width,
            sourceHeight: sourceMetrics.height,
            rect: sourceMetrics.rect,
            mode: variant === "main" ? "fill-height" : "contain",
          })
        : null,
    [sourceMetrics, variant, viewportSize.height, viewportSize.width],
  );

  const backdropTransform = useMemo(
    () =>
      sourceMetrics
        ? resolveCoverThumbnailTransform({
            viewportWidth: Math.max(1, viewportSize.width),
            viewportHeight: Math.max(1, viewportSize.height),
            sourceWidth: sourceMetrics.width,
            sourceHeight: sourceMetrics.height,
            rect: sourceMetrics.rect,
            mode: "cover",
            scaleBoost: COVER_THUMBNAIL_BACKDROP_SCALE_BOOST,
          })
        : null,
    [sourceMetrics, viewportSize.height, viewportSize.width],
  );

  const freeSpace = useMemo(() => {
    if (!foregroundTransform) {
      return { x: 0, y: 0 };
    }
    const freeX = Math.max(0, viewportSize.width - foregroundTransform.contentWidth);
    const freeY = Math.max(0, viewportSize.height - foregroundTransform.contentHeight);
    return { x: freeX, y: freeY };
  }, [foregroundTransform, viewportSize.height, viewportSize.width]);

  const src = image.src ?? image.path;
  const hasEdgeGap = freeSpace.x > COVER_THUMBNAIL_BAR_EPSILON_PX ||
    freeSpace.y > COVER_THUMBNAIL_BAR_EPSILON_PX;
  const showBackdrop = variant === "main"
    ? Boolean(src) && (hasEdgeGap || !foregroundTransform)
    : Boolean(backdropTransform && hasEdgeGap);
  const isTransformed = Boolean(foregroundTransform);
  const frameClassName = resolveCoverThumbnailFrameClassName(variant);
  const foregroundClassName = resolveCoverThumbnailForegroundClassName(variant, isTransformed);
  const backdropClassName = resolveCoverThumbnailBackdropClassName(variant);

  return (
    <span ref={viewportRef} className={frameClassName}>
      {showBackdrop ? (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className={backdropClassName}
          style={backdropTransform?.style}
          draggable={false}
        />
      ) : null}
      <img
        src={src}
        alt={alt}
        className={foregroundClassName}
        style={foregroundTransform?.style}
        draggable={false}
        onLoad={(event) => {
          const nextWidth = event.currentTarget.naturalWidth || event.currentTarget.width || 0;
          const nextHeight = event.currentTarget.naturalHeight || event.currentTarget.height || 0;
          if (nextWidth > 0 && nextHeight > 0) {
            setNaturalSize((current) =>
              current && current.width === nextWidth && current.height === nextHeight
                ? current
                : { width: nextWidth, height: nextHeight }
            );
          }
          onLoad?.(event);
        }}
        onError={(event) => {
          onError?.(event);
        }}
      />
    </span>
  );
};

const markdownSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "br",
    "details",
    "kbd",
    "mark",
    "summary",
    "span",
    "sub",
    "sup",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "u",
  ],
  attributes: {
    ...defaultSchema.attributes,
    details: [...(defaultSchema.attributes?.details ?? []), "open"],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      "data-fmd-media-block",
      "data-media-index",
    ],
    mark: [...(defaultSchema.attributes?.mark ?? []), "className"],
    ol: [...(defaultSchema.attributes?.ol ?? []), "data-md-ordered-delimiter"],
    table: [...(defaultSchema.attributes?.table ?? []), "className"],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
    span: [...(defaultSchema.attributes?.span ?? []), "className"],
  },
};

const safeLinkProtocols = new Set(["http:", "https:", "mailto:"]);

const resolveSafeHref = (href: string) => {
  if (!href) {
    return null;
  }
  try {
    const parsed = new URL(href);
    if (!safeLinkProtocols.has(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const resolveEventElement = (target: EventTarget | null) => {
  if (!target) {
    return null;
  }
  if (target instanceof Element) {
    return target;
  }
  if (target instanceof Node && target.parentElement) {
    return target.parentElement;
  }
  return null;
};

const resolveAnchorTarget = (target: EventTarget | null) => {
  const element = resolveEventElement(target);
  return element?.closest("a[href]") as HTMLAnchorElement | null;
};

const copyTextToClipboard = async (value: string) => {
  if (!value) {
    return;
  }
  const normalized = value.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    await navigator.clipboard.writeText(normalized);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = normalized;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const exec = (document as Document & {
      execCommand?: (command: string) => boolean;
    }).execCommand;
    if (typeof exec === "function") {
      exec.call(document, "copy");
    }
  } finally {
    textarea.remove();
  }
};

const isModifierClick = (event: Pick<MouseEvent<HTMLElement>, "metaKey" | "ctrlKey">) =>
  event.metaKey || event.ctrlKey;

type MarkdownInlineSyntaxKind = "hash-tag" | "cloze" | "quoted-token";
type InlineSyntaxHighlightOptions = {
  collapseChainedClozeVariants?: boolean;
  hideInlineSyntaxDelimiters?: boolean;
};
type HybridMarkdownPreviewRenderOptions = {
  collapseClozeVariantsInView?: boolean;
  hideInlineSyntaxDelimiters?: boolean;
};

// Highlight inline FMD-style hash directives/tags like "#card", "#text", "#test".
// Headings are unaffected because Markdown headings require "# " (hash + space),
// while this pattern only matches hash tokens without a following space.
const markdownInlineSyntaxPattern = /#[A-Za-z0-9_-]+\b|%[^%\n]+%(?:%[^%\n]+%)*|"[^"\n]+"/g;

const resolveInlineSyntaxKind = (token: string): MarkdownInlineSyntaxKind | null => {
  if (/^#[A-Za-z0-9_-]+\b/.test(token)) {
    return "hash-tag";
  }
  if (/^%[^%\n]+%(?:%[^%\n]+%)*$/.test(token)) {
    return "cloze";
  }
  if (/^"[^"\n]+"$/.test(token)) {
    return "quoted-token";
  }
  return null;
};

const shouldSkipInlineSyntaxHighlight = (tagName: string | null) =>
  tagName === "code" ||
  tagName === "pre" ||
  tagName === "a" ||
  tagName === "kbd" ||
  tagName === "svg" ||
  tagName === "path" ||
  tagName === "button" ||
  tagName === "input" ||
  tagName === "textarea";

const resolveInlineSyntaxDisplayToken = (
  token: string,
  kind: MarkdownInlineSyntaxKind,
  options?: InlineSyntaxHighlightOptions,
) => {
  let displayToken = token;
  if (kind === "cloze" && options?.collapseChainedClozeVariants) {
    const firstTokenEnd = displayToken.indexOf("%", 1);
    if (firstTokenEnd > 0) {
      displayToken = displayToken.slice(0, firstTokenEnd + 1);
    }
  }
  if (!options?.hideInlineSyntaxDelimiters) {
    return displayToken;
  }
  if (kind === "cloze") {
    const clozeMatch = displayToken.match(/^%([^%\n]+)%$/);
    return clozeMatch ? clozeMatch[1] ?? displayToken : displayToken;
  }
  if (kind === "quoted-token") {
    const quotedMatch = displayToken.match(/^"([^"\n]+)"$/);
    return quotedMatch ? quotedMatch[1] ?? displayToken : displayToken;
  }
  return displayToken;
};

const highlightInlineSyntaxInText = (
  text: string,
  keyPrefix: string,
  options?: InlineSyntaxHighlightOptions,
): ReactNode => {
  if (!text || !markdownInlineSyntaxPattern.test(text)) {
    markdownInlineSyntaxPattern.lastIndex = 0;
    return text;
  }
  markdownInlineSyntaxPattern.lastIndex = 0;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  let match = markdownInlineSyntaxPattern.exec(text);

  while (match) {
    const token = match[0] ?? "";
    const startIndex = match.index;
    const endIndex = startIndex + token.length;
    if (startIndex > lastIndex) {
      parts.push(text.slice(lastIndex, startIndex));
    }
    const kind = resolveInlineSyntaxKind(token);
    if (!kind) {
      parts.push(token);
    } else {
      const displayToken = resolveInlineSyntaxDisplayToken(token, kind, options);
      parts.push(
        <span
          key={`${keyPrefix}-${tokenIndex}`}
          className={`md-inline-syntax md-inline-syntax-${kind}`}
          data-md-inline-syntax={kind}
        >
          {displayToken}
        </span>,
      );
    }
    lastIndex = endIndex;
    tokenIndex += 1;
    match = markdownInlineSyntaxPattern.exec(text);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
};

const highlightInlineSyntaxInNode = (
  node: ReactNode,
  keyPrefix = "md-inline",
  options?: InlineSyntaxHighlightOptions,
): ReactNode => {
  if (typeof node === "string") {
    const rendered = renderMarkdownMathNode(node, {
      keyPrefix: `${keyPrefix}-math`,
      renderText: (text, textKeyPrefix) => highlightInlineSyntaxInText(text, textKeyPrefix, options),
    });
    if (rendered.length === 1) {
      return rendered[0] ?? null;
    }
    return rendered;
  }
  if (typeof node === "number" || typeof node === "boolean" || node == null) {
    return node;
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return node;
  }

  const tagName = typeof node.type === "string" ? node.type.toLowerCase() : null;
  if (shouldSkipInlineSyntaxHighlight(tagName)) {
    return node;
  }

  const rawChildren = node.props.children;
  if (rawChildren == null) {
    return node;
  }
  const nextChildren = Children.map(rawChildren, (child, index) =>
    highlightInlineSyntaxInNode(child, `${keyPrefix}-${index}`, options),
  );
  return cloneElement(node, undefined, nextChildren);
};

const renderHighlightedInlineSyntaxChildren = (
  children: ReactNode,
  keyPrefix: string,
  options?: InlineSyntaxHighlightOptions,
) =>
  Children.map(children, (child, index) =>
    highlightInlineSyntaxInNode(child, `${keyPrefix}-${index}`, options),
  );

const mergeClassNames = (base: unknown, ...tokens: string[]) => {
  const existingTokens = typeof base === "string"
    ? base.split(/\s+/).filter(Boolean)
    : [];
  const merged = new Set(existingTokens);
  tokens.forEach((token) => {
    const trimmed = token.trim();
    if (trimmed) {
      merged.add(trimmed);
    }
  });
  return Array.from(merged).join(" ");
};

const ensureTableCellImageClassesInNode = (node: ReactNode): ReactNode => {
  if (
    typeof node === "string" ||
    typeof node === "number" ||
    typeof node === "boolean" ||
    node == null
  ) {
    return node;
  }
  if (!isValidElement<{ children?: ReactNode; className?: unknown }>(node)) {
    return node;
  }

  const rawChildren = node.props.children;
  const nextChildren = rawChildren == null
    ? rawChildren
    : Children.map(rawChildren, (child) => ensureTableCellImageClassesInNode(child));
  const tagName = typeof node.type === "string" ? node.type.toLowerCase() : null;

  if (tagName === "img") {
    return cloneElement(node, {
      className: mergeClassNames(
        node.props.className,
        "markdown-table-cell-image",
        SHARED_TABLE_CELL_IMAGE_CLASS,
      ),
    });
  }

  if (rawChildren == null) {
    return node;
  }

  return cloneElement(node, undefined, nextChildren);
};

const isMarkdownTableCellBreakNode = (node: ReactNode) =>
  isValidElement(node) &&
  typeof node.type === "string" &&
  node.type.toLowerCase() === "br";

const renderMarkdownTableCellChildren = (
  children: ReactNode,
  keyPrefix: string,
  options?: InlineSyntaxHighlightOptions,
) => {
  const nodes = Children.toArray(
    renderHighlightedInlineSyntaxChildren(children, keyPrefix, options),
  );
  const paragraphs: ReactNode[][] = [];
  let currentParagraph: ReactNode[] = [];
  let pendingBreakCount = 0;
  let syntheticKeyIndex = 0;

  const pushParagraph = () => {
    if (currentParagraph.length === 0) {
      return;
    }
    paragraphs.push(currentParagraph);
    currentParagraph = [];
  };

  const appendLineBreak = () => {
    if (currentParagraph.length === 0) {
      return;
    }
    currentParagraph.push(<br key={`${keyPrefix}-br-${syntheticKeyIndex}`} />);
    syntheticKeyIndex += 1;
  };

  const flushPendingBreaks = () => {
    if (pendingBreakCount <= 0) {
      return;
    }
    if (pendingBreakCount === 1) {
      appendLineBreak();
    } else {
      pushParagraph();
    }
    pendingBreakCount = 0;
  };

  const appendNormalizedText = (value: string) => {
    const normalizedValue = normalizeMarkdownTableCellPreviewValue(value);
    const paragraphChunks = normalizedValue.split("\n\n");
    paragraphChunks.forEach((paragraphChunk, paragraphIndex) => {
      if (paragraphIndex > 0) {
        pushParagraph();
      }
      const lineChunks = paragraphChunk.split("\n");
      lineChunks.forEach((lineChunk, lineIndex) => {
        if (lineIndex > 0) {
          appendLineBreak();
        }
        if (lineChunk) {
          currentParagraph.push(lineChunk);
        }
      });
    });
  };

  for (const node of nodes) {
    if (isMarkdownTableCellBreakNode(node)) {
      pendingBreakCount += 1;
      continue;
    }
    flushPendingBreaks();
    if (typeof node === "string") {
      appendNormalizedText(node);
      continue;
    }
    currentParagraph.push(node);
  }

  flushPendingBreaks();
  pushParagraph();

  return (
    <div className={`markdown-table-cell-preview ${SHARED_TABLE_CELL_CONTENT_CLASS}`}>
      {paragraphs.map((paragraph, index) => (
        <div
          key={`${keyPrefix}-paragraph-${index}`}
          className="markdown-table-cell-paragraph"
        >
          {paragraph}
        </div>
      ))}
    </div>
  );
};

const renderMarkdownTableCellWithMedia = ({
  node,
  children,
  keyPrefix,
  inlineHighlightOptions,
  markdownSource,
  vaultPngAssets,
  vaultPath,
  sourceRelativePath,
}: {
  node: unknown;
  children: ReactNode;
  keyPrefix: string;
  inlineHighlightOptions?: InlineSyntaxHighlightOptions;
  markdownSource: string;
  vaultPngAssets?: VaultPngAsset[];
  vaultPath?: string | null;
  sourceRelativePath?: string | null;
}) => {
  const cellSource = readMarkdownNodeSource(node, markdownSource);
  const cellText = readMarkdownNodeText(node);
  const segments = resolveMarkdownTableCellSegments({
    cellSource,
    cellText,
    scope: `preview-table-cell-${keyPrefix}`,
  });
  const hasMediaSegments = segments.some((segment) => segment.kind !== "text");
  if (!hasMediaSegments) {
    const normalizedChildren = Children.map(
      children,
      (child) => ensureTableCellImageClassesInNode(child),
    );
    return renderMarkdownTableCellChildren(
      normalizedChildren,
      keyPrefix,
      inlineHighlightOptions,
    );
  }

  const renderedSegments = segments.map((segment, index) => {
    const segmentKey = `${keyPrefix}-segment-${index}`;
    if (segment.kind === "text") {
      return <Fragment key={segmentKey}>{segment.text}</Fragment>;
    }
    if (segment.kind === "media") {
      return (
        <div
          className={`markdown-table-cell-media ${SHARED_TABLE_CELL_MEDIA_CLASS}`}
          key={segmentKey}
        >
          <FlashcardMediaGroup
            media={segment.items}
            vaultPngAssets={vaultPngAssets}
            vaultPath={vaultPath}
            sourceRelativePath={sourceRelativePath}
          />
        </div>
      );
    }
    return (
      <div
        className={`markdown-table-cell-media ${SHARED_TABLE_CELL_MEDIA_CLASS}`}
        key={segmentKey}
      >
        <img
          src={segment.src}
          alt={segment.alt ?? ""}
          title={segment.title}
          className={`markdown-table-cell-image ${SHARED_TABLE_CELL_IMAGE_CLASS}`}
          draggable={false}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  });

  return renderMarkdownTableCellChildren(
    renderedSegments,
    `${keyPrefix}-rich`,
    inlineHighlightOptions,
  );
};

type MarkdownViewRenderItem =
  | {
      type: "block";
      block: MarkdownBlock;
    }
  | {
      type: "group";
      groupId: string;
      blocks: MarkdownBlock[];
    };

type PreviewPanelEditorMode = "code" | "markdown" | "hybrid";

type PreviewPanelProps = {
  editDraft: string;
  editError: string;
  editCaretIndex: number | null;
  isEditing: boolean;
  emptyPreview: string;
  preview: string;
  previewError: string;
  previewState: LoadState;
  editorMode: PreviewPanelEditorMode;
  editEnabled: boolean;
  documentMode?: MarkdownHybridEditorMode;
  selectedFile: VaultFile | null;
  vaultFiles?: VaultFile[];
  vaultPngAssets?: VaultPngAsset[];
  vaultPath?: string | null;
  sourceRelativePath?: string | null;
  canEdit: boolean;
  markdownEditorStyle?: CSSProperties;
  onEditChange: (value: string) => void;
  onHybridDirtyChange?: (dirty: boolean) => void;
  onEditCaretApplied: () => void;
  onEditExit: () => void;
  onEditStart: (options?: {
    caretIndex?: number | null;
    origin?: "raw" | "markdown";
  }) => void;
  onSelectEditorMode: (editorMode: PreviewPanelEditorMode) => void | Promise<void>;
  onToggleEditEnabled: () => void | Promise<void>;
  onWriteSave?: () => void;
  onWriteCancel?: () => void;
  onFrontmatterSave?: (nextPreview: string) => Promise<boolean>;
  onNavigateWikilink?: (wikilink: string) => void;
  onOpenTaskProfileEditor?: (params: {
    taskValue: string | null;
    propertyKey: string;
  }) => Promise<void> | void;
  taskProfileSummariesByName?: Record<
    string,
    {
      taskCount: number;
      maxTotalPoints: number;
    }
  >;
  valueSuggestionsByKey?: Record<string, string[]>;
  keySuggestions?: string[];
  markdownTabs?: Array<{
    path: string;
    relativePath: string;
  }>;
  activeMarkdownTabPath?: string | null;
  onSelectMarkdownTab?: (path: string) => void;
  onCloseMarkdownTab?: (path: string) => void;
  onReorderMarkdownTabs?: (
    sourcePath: string,
    targetPath: string,
    position: "before" | "after",
  ) => void;
};

export const canStartPreviewEdit = ({
  editorMode,
  editEnabled,
}: {
  editorMode: PreviewPanelEditorMode;
  editEnabled: boolean;
}) => editorMode !== "hybrid" && editEnabled;

const MARKDOWN_EDITABLE_REHIGHLIGHT_DEBOUNCE_MS = 90;
const MARKDOWN_EDITABLE_REHIGHLIGHT_IDLE_TIMEOUT_MS = 160;
const PREVIEW_TAB_MIN_WIDTH_PX = 120;
const PREVIEW_TAB_MAX_WIDTH_PX = 360;
const PREVIEW_TAB_COMPACT_THRESHOLD_PX = 240;
const PREVIEW_TAB_FOLDER_MODE_MIN_TABS = 3;
const PREVIEW_TAB_ROOT_LABEL = "Root";
const PREVIEW_FOLDER_BUTTON_MIN_WIDTH_PX = 140;
const PREVIEW_FOLDER_BUTTON_MAX_WIDTH_PX = 260;

type MarkdownTabDisplayInfo = {
  path: string;
  fullLabel: string;
  fileLabel: string;
  folderLabel: string;
};

type MarkdownTabFolderEntry = {
  key: string;
  label: string;
};

const clampPreviewTabWidth = (value: number) =>
  Math.max(PREVIEW_TAB_MIN_WIDTH_PX, Math.min(PREVIEW_TAB_MAX_WIDTH_PX, value));

const clampPreviewFolderButtonWidth = (value: number) =>
  Math.max(PREVIEW_FOLDER_BUTTON_MIN_WIDTH_PX, Math.min(PREVIEW_FOLDER_BUTTON_MAX_WIDTH_PX, value));

const resolveMarkdownTabDisplayInfo = (tab: { path: string; relativePath: string }) => {
  const fullLabel = tab.relativePath || tab.path;
  const normalizedLabel = normalizeRelativePath(fullLabel);
  const normalizedSegments = normalizedLabel
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const fallbackSegments = fullLabel
    .split(/[\\/]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const segments = normalizedSegments.length > 0 ? normalizedSegments : fallbackSegments;
  const fallbackFileLabel = fullLabel.trim() || tab.path;
  const fileLabel = segments[segments.length - 1] ?? fallbackFileLabel;
  const folderLabel =
    segments.length > 1
      ? segments.slice(0, -1).join("/")
      : PREVIEW_TAB_ROOT_LABEL;

  return {
    path: tab.path,
    fullLabel,
    fileLabel,
    folderLabel,
  } satisfies MarkdownTabDisplayInfo;
};

const createMarkdownTabDragPreviewElement = (label: string) => {
  if (typeof document === "undefined") {
    return null;
  }
  const preview = document.createElement("div");
  preview.className = "preview-tab-drag-preview";
  preview.textContent = label;
  document.body.appendChild(preview);
  return preview;
};

const getRangeOffset = (container: HTMLElement, range: Range) => {
  const offsetRange = document.createRange();
  offsetRange.setStart(container, 0);
  offsetRange.setEnd(range.startContainer, range.startOffset);
  return offsetRange.toString().length;
};

const getSelectionRange = (container: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer)) {
    return null;
  }
  return range;
};

const getRangeFromPoint = (x: number, y: number) => {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretRangeFromPoint) {
    return doc.caretRangeFromPoint(x, y) ?? null;
  }
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y);
    if (position) {
      const range = doc.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
  }
  return null;
};

const getRangeFromEvent = (
  event: MouseEvent<HTMLDivElement>,
  container: HTMLElement,
) => {
  const rangeFromPoint = getRangeFromPoint(event.clientX, event.clientY);
  if (rangeFromPoint && container.contains(rangeFromPoint.startContainer)) {
    return rangeFromPoint;
  }
  return getSelectionRange(container);
};

type MarkdownOffsetMapOptions = {
  skipStructuralMarkers?: boolean;
};

const shouldSkipStructuralMarkers = (options?: MarkdownOffsetMapOptions) =>
  options?.skipStructuralMarkers ?? true;

const resolveListLineMarkerEnd = (rawMarkdown: string, startIndex: number) => {
  const first = rawMarkdown[startIndex];
  if (first === "-" || first === "*" || first === "+") {
    if (rawMarkdown[startIndex + 1] !== " ") {
      return null;
    }
    if (
      rawMarkdown[startIndex + 2] === "[" &&
      (rawMarkdown[startIndex + 3] === " " ||
        rawMarkdown[startIndex + 3] === "x" ||
        rawMarkdown[startIndex + 3] === "X") &&
      rawMarkdown[startIndex + 4] === "]" &&
      rawMarkdown[startIndex + 5] === " "
    ) {
      return startIndex + 6;
    }
    return startIndex + 2;
  }

  if (first >= "0" && first <= "9") {
    let index = startIndex;
    while (rawMarkdown[index] >= "0" && rawMarkdown[index] <= "9") {
      index += 1;
    }
    if (
      (rawMarkdown[index] === "." || rawMarkdown[index] === ")") &&
      rawMarkdown[index + 1] === " "
    ) {
      return index + 2;
    }
  }

  return null;
};

const resolveThematicBreakLineEnd = (rawMarkdown: string, startIndex: number) => {
  let index = startIndex;
  let dashCount = 0;
  while (index < rawMarkdown.length && rawMarkdown[index] !== "\n") {
    const char = rawMarkdown[index];
    if (char === "-") {
      dashCount += 1;
      index += 1;
      continue;
    }
    if (char === " " || char === "\t") {
      index += 1;
      continue;
    }
    return null;
  }
  return dashCount >= 3 ? index : null;
};

const mapPlainOffsetToRawIndex = (
  rawMarkdown: string,
  plainOffset: number,
  options?: MarkdownOffsetMapOptions,
) => {
  if (plainOffset <= 0) {
    return 0;
  }
  const skipStructuralMarkers = shouldSkipStructuralMarkers(options);
  let rawIndex = 0;
  let plainIndex = 0;
  let inFence = false;
  let inInlineCode = false;
  let inLinkText = false;
  let inLinkUrl = false;
  let lineStart = true;
  let escapeNext = false;

  const skipToLineEnd = () => {
    while (rawIndex < rawMarkdown.length && rawMarkdown[rawIndex] !== "\n") {
      rawIndex += 1;
    }
  };

  while (rawIndex < rawMarkdown.length) {
    const char = rawMarkdown[rawIndex];

    if (lineStart && !escapeNext && rawMarkdown.startsWith("```", rawIndex)) {
      inFence = !inFence;
      skipToLineEnd();
      continue;
    }

    if (char === "\n") {
      lineStart = true;
      escapeNext = false;
      if (plainIndex >= plainOffset) {
        return rawIndex;
      }
      plainIndex += 1;
      rawIndex += 1;
      continue;
    }

    const isEscaped = escapeNext;
    if (escapeNext) {
      escapeNext = false;
    }

    if (!inFence && !isEscaped && char === "\\") {
      lineStart = false;
      escapeNext = true;
      rawIndex += 1;
      continue;
    }

    if (!isEscaped && lineStart && !inFence && skipStructuralMarkers) {
      const thematicBreakEnd = resolveThematicBreakLineEnd(rawMarkdown, rawIndex);
      if (thematicBreakEnd !== null) {
        rawIndex = thematicBreakEnd;
        continue;
      }
      const listMarkerEnd = resolveListLineMarkerEnd(rawMarkdown, rawIndex);
      if (listMarkerEnd !== null) {
        rawIndex = listMarkerEnd;
        continue;
      }
      if (char === "#") {
        while (rawMarkdown[rawIndex] === "#") {
          rawIndex += 1;
        }
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
      if (char === ">") {
        rawIndex += 1;
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
    }

    lineStart = false;

    if (!inFence) {
      if (inLinkUrl) {
        if (char === ")") {
          inLinkUrl = false;
        }
        rawIndex += 1;
        continue;
      }
      if (!isEscaped) {
        if (char === "`") {
          inInlineCode = !inInlineCode;
          rawIndex += 1;
          continue;
        }
        if (!inInlineCode && (char === "*" || char === "_")) {
          rawIndex += 1;
          continue;
        }
        if (char === "!" && rawMarkdown[rawIndex + 1] === "[") {
          rawIndex += 1;
          continue;
        }
        if (char === "[") {
          inLinkText = true;
          rawIndex += 1;
          continue;
        }
        if (inLinkText && char === "]") {
          inLinkText = false;
          if (rawMarkdown[rawIndex + 1] === "(") {
            inLinkUrl = true;
            rawIndex += 2;
            continue;
          }
          rawIndex += 1;
          continue;
        }
      }
    }

    if (plainIndex >= plainOffset) {
      return rawIndex;
    }
    plainIndex += 1;
    rawIndex += 1;
  }

  return rawMarkdown.length;
};

const mapRawIndexToPlainOffset = (
  rawMarkdown: string,
  rawIndexTarget: number,
  options?: MarkdownOffsetMapOptions,
) => {
  if (rawIndexTarget <= 0) {
    return 0;
  }
  const skipStructuralMarkers = shouldSkipStructuralMarkers(options);
  const target = Math.min(rawIndexTarget, rawMarkdown.length);
  let rawIndex = 0;
  let plainIndex = 0;
  let inFence = false;
  let inInlineCode = false;
  let inLinkText = false;
  let inLinkUrl = false;
  let lineStart = true;
  let escapeNext = false;

  const skipToLineEnd = () => {
    while (rawIndex < rawMarkdown.length && rawMarkdown[rawIndex] !== "\n") {
      rawIndex += 1;
    }
  };

  while (rawIndex < rawMarkdown.length && rawIndex < target) {
    const char = rawMarkdown[rawIndex];

    if (lineStart && !escapeNext && rawMarkdown.startsWith("```", rawIndex)) {
      inFence = !inFence;
      skipToLineEnd();
      continue;
    }

    if (char === "\n") {
      lineStart = true;
      escapeNext = false;
      plainIndex += 1;
      rawIndex += 1;
      continue;
    }

    const isEscaped = escapeNext;
    if (escapeNext) {
      escapeNext = false;
    }

    if (!inFence && !isEscaped && char === "\\") {
      lineStart = false;
      escapeNext = true;
      rawIndex += 1;
      continue;
    }

    if (!isEscaped && lineStart && !inFence && skipStructuralMarkers) {
      const thematicBreakEnd = resolveThematicBreakLineEnd(rawMarkdown, rawIndex);
      if (thematicBreakEnd !== null) {
        rawIndex = thematicBreakEnd;
        continue;
      }
      const listMarkerEnd = resolveListLineMarkerEnd(rawMarkdown, rawIndex);
      if (listMarkerEnd !== null) {
        rawIndex = listMarkerEnd;
        continue;
      }
      if (char === "#") {
        while (rawMarkdown[rawIndex] === "#") {
          rawIndex += 1;
        }
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
      if (char === ">") {
        rawIndex += 1;
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
    }

    lineStart = false;

    if (!inFence) {
      if (inLinkUrl) {
        if (char === ")") {
          inLinkUrl = false;
        }
        rawIndex += 1;
        continue;
      }
      if (!isEscaped) {
        if (char === "`") {
          inInlineCode = !inInlineCode;
          rawIndex += 1;
          continue;
        }
        if (!inInlineCode && (char === "*" || char === "_")) {
          rawIndex += 1;
          continue;
        }
        if (char === "!" && rawMarkdown[rawIndex + 1] === "[") {
          rawIndex += 1;
          continue;
        }
        if (char === "[") {
          inLinkText = true;
          rawIndex += 1;
          continue;
        }
        if (inLinkText && char === "]") {
          inLinkText = false;
          if (rawMarkdown[rawIndex + 1] === "(") {
            inLinkUrl = true;
            rawIndex += 2;
            continue;
          }
          rawIndex += 1;
          continue;
        }
      }
    }

    plainIndex += 1;
    rawIndex += 1;
  }

  return plainIndex;
};

const findTextNodeAtOffset = (container: HTMLElement, offset: number) => {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
  );
  const range = document.createRange();
  range.setStart(container, 0);

  let current = walker.nextNode() as Text | null;
  let lastTextNode: Text | null = null;

  while (current) {
    lastTextNode = current;
    const nodeLength = current.nodeValue?.length ?? 0;
    range.setEnd(current, nodeLength);
    const endOffset = range.toString().length;

    if (offset <= endOffset) {
      let low = 0;
      let high = nodeLength;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        range.setEnd(current, mid);
        const midOffset = range.toString().length;
        if (midOffset < offset) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      return { node: current, offset: low };
    }

    current = walker.nextNode() as Text | null;
  }

  if (lastTextNode) {
    return {
      node: lastTextNode,
      offset: lastTextNode.nodeValue?.length ?? 0,
    };
  }

  return null;
};

type PlainSelectionOffsets = {
  start: number;
  end: number;
};

const getSelectionOffsetsWithinContainer = (
  container: HTMLElement,
): PlainSelectionOffsets | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
    return null;
  }

  const startRange = document.createRange();
  startRange.setStart(container, 0);
  startRange.setEnd(range.startContainer, range.startOffset);
  const endRange = document.createRange();
  endRange.setStart(container, 0);
  endRange.setEnd(range.endContainer, range.endOffset);

  return {
    start: startRange.toString().length,
    end: endRange.toString().length,
  };
};

const setSelectionAtPlainOffsets = (
  container: HTMLElement,
  startOffset: number,
  endOffset = startOffset,
) => {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const length = container.innerText.length;
  const clampedStart = Math.max(0, Math.min(startOffset, length));
  const clampedEnd = Math.max(0, Math.min(endOffset, length));
  const resolvedStart = findTextNodeAtOffset(container, clampedStart);
  const resolvedEnd = findTextNodeAtOffset(container, clampedEnd);
  const range = document.createRange();
  if (resolvedStart) {
    range.setStart(resolvedStart.node, resolvedStart.offset);
  } else {
    range.setStart(container, 0);
  }
  if (resolvedEnd) {
    range.setEnd(resolvedEnd.node, resolvedEnd.offset);
  } else {
    range.setEnd(container, 0);
  }
  selection.removeAllRanges();
  selection.addRange(range);
};

const setCaretAtPlainOffset = (container: HTMLElement, offset: number) => {
  setSelectionAtPlainOffsets(container, offset, offset);
};

const replaceHeadingElementLevel = (heading: HTMLElement, level: number) => {
  const normalizedLevel = Math.max(1, Math.min(6, level));
  const targetTag = `h${normalizedLevel}`;
  if (heading.tagName.toLowerCase() === targetTag) {
    return heading;
  }

  const replacement = heading.ownerDocument.createElement(targetTag);
  Array.from(heading.attributes).forEach((attribute) => {
    if (attribute.name === "data-md-heading-active") {
      return;
    }
    replacement.setAttribute(attribute.name, attribute.value);
  });

  while (heading.firstChild) {
    replacement.appendChild(heading.firstChild);
  }
  heading.replaceWith(replacement);
  return replacement;
};

const isInteractionMarkerLine = (line: string) => {
  const trimmed = line.trim().toLowerCase();
  return trimmed === "-true" ||
    trimmed === "-false" ||
    (trimmed.length === 2 &&
      trimmed[0] === "-" &&
      trimmed[1] >= "a" &&
      trimmed[1] <= "d");
};

const isFmdDirectiveLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed === "---") {
    return true;
  }
  const lowered = trimmed.toLowerCase();
  if (
    lowered === "#exam" ||
    lowered === "#endexam" ||
    lowered === "#card" ||
    lowered === "#endcard" ||
    lowered === "#help" ||
    lowered === "#helpend"
  ) {
    return true;
  }
  return isInteractionMarkerLine(trimmed);
};

const escapeMarkdownLineStart = (line: string) => {
  if (!line || isFmdDirectiveLine(line)) {
    return line;
  }
  const match = line.match(/^([ \t]*)(.*)$/);
  if (!match) {
    return line;
  }
  const indent = match[1];
  const content = match[2];
  if (!content) {
    return line;
  }
  if (/^#+(?=\s|$)/.test(content)) {
    return `${indent}\\${content}`;
  }
  if (content.startsWith("-") && (content.length === 1 || content[1] === " ")) {
    return `${indent}\\${content}`;
  }
  return line;
};

const escapeMarkdownLineStarts = (value: string) =>
  value
    .split(/(\r?\n)/)
    .map((part, index) =>
      index % 2 === 1 ? part : escapeMarkdownLineStart(part),
    )
    .join("");

const escapeMarkdownText = (text: string, escapePipes = true) => {
  let next = text
    .replace(/\u00a0/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\~");
  if (escapePipes) {
    next = next.replace(/\|/g, "\\|");
  }
  return escapeMarkdownLineStarts(next);
};

const escapeMarkdownLinkText = (text: string) =>
  text.replace(/\[/g, "\\[").replace(/]/g, "\\]");

const escapeMarkdownTableCell = (text: string) =>
  text.replace(/\|/g, "\\|");

const wrapInlineCode = (text: string) => {
  const normalized = text.replace(/\u00a0/g, " ").replace(/\n+/g, " ");
  const matches = normalized.match(/`+/g);
  const fenceLength = matches
    ? Math.max(...matches.map((match) => match.length)) + 1
    : 1;
  const fence = "`".repeat(fenceLength);
  const needsPadding =
    normalized.startsWith(" ") || normalized.endsWith(" ");
  const content = needsPadding ? ` ${normalized} ` : normalized;
  return `${fence}${content}${fence}`;
};

const wrapCodeBlock = (text: string) => {
  const normalized = text.replace(/\r\n?/g, "\n");
  const matches = normalized.match(/`+/g);
  const fenceLength = matches
    ? Math.max(...matches.map((match) => match.length)) + 1
    : 3;
  const fence = "`".repeat(Math.max(3, fenceLength));
  const trimmed = normalized.replace(/\n$/, "");
  if (trimmed.trim().length === 0) {
    return `${fence}\n${fence}\n`;
  }
  return `${fence}\n${trimmed}\n${fence}\n`;
};

const resolveCodeFenceFromOpenMarker = (openMarker: string) =>
  openMarker.match(/^`{3,}/)?.[0] ?? "```";

const normalizeOpenCodeFenceMarker = (value: string | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed || !/^`{3,}/.test(trimmed)) {
    return "```";
  }
  return trimmed;
};

const normalizeCloseCodeFenceMarker = (
  value: string | null,
  openMarker: string,
) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed || !/^`{3,}$/.test(trimmed)) {
    return resolveCodeFenceFromOpenMarker(openMarker);
  }
  return trimmed;
};

const wrapCodeBlockWithMarkers = (
  text: string,
  openMarker: string,
  closeMarker: string,
) => {
  const normalized = text.replace(/\r\n?/g, "\n");
  const trimmed = normalized.replace(/\n$/, "");
  if (trimmed.trim().length === 0) {
    return `${openMarker}\n${closeMarker}\n`;
  }
  return `${openMarker}\n${trimmed}\n${closeMarker}\n`;
};

type MarkdownSerializeContext = {
  listDepth: number;
  escapePipes: boolean;
  inContentEditable: boolean;
};

const serializeMarkdownChildren = (
  node: ParentNode,
  context: MarkdownSerializeContext,
) =>
  Array.from(node.childNodes)
    .map((child) => serializeMarkdownNode(child, context))
    .join("");

const serializeMarkdownNode = (
  node: Node,
  context: MarkdownSerializeContext,
): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    let value = node.nodeValue ?? "";
    if (context.inContentEditable) {
      if (value.trim() === "" && /[\r\n]/.test(value)) {
        // Ignore editor-only whitespace separators between block nodes to avoid
        // rewriting single-line sequences into paragraph-separated output.
        return "";
      }

      const previousTag = node.previousSibling instanceof HTMLElement
        ? node.previousSibling.tagName.toLowerCase()
        : null;
      const nextTag = node.nextSibling instanceof HTMLElement
        ? node.nextSibling.tagName.toLowerCase()
        : null;

      // Browsers can inject newline text nodes around <br> in contentEditable.
      // Keep line breaks owned by <br> and strip duplicate newline chars from text.
      if (previousTag === "br") {
        value = value.replace(/^[\r\n]+[ \t]*/g, "");
      }
      if (nextTag === "br") {
        value = value.replace(/[ \t]*[\r\n]+$/g, "");
      }
    }
    return escapeMarkdownText(value, context.escapePipes);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (tag === "button" && element.classList.contains("md-code-copy-button")) {
    return "";
  }

  if (tag === "br") {
    return "\n";
  }

  if (tag === "p") {
    const content = serializeMarkdownChildren(element, context).trim();
    if (context.inContentEditable) {
      return content ? `${content}\n` : "\n";
    }
    return content ? `${content}\n\n` : "\n\n";
  }

  if (tag === "div") {
    // contentEditable uses div per line; keep single newline to avoid extra gaps.
    const content = serializeMarkdownChildren(element, context).trim();
    return content ? `${content}\n` : "\n";
  }

  if (tag.startsWith("h") && tag.length === 2) {
    const levelFromTag = Number(tag[1]);
    if (!Number.isNaN(levelFromTag)) {
      const content = serializeMarkdownChildren(element, context).trim();
      const markerMatch = content.match(/^\\?(#{1,6})(?:\s+|$)([\s\S]*)$/);
      const manualLevel = markerMatch ? markerMatch[1].length : null;
      const manualContent = markerMatch ? markerMatch[2].trimStart() : content;
      const resolvedLevel = Math.max(1, Math.min(6, manualLevel ?? levelFromTag));
      const newlineSuffix = context.inContentEditable ? "\n" : "\n\n";
      return manualContent
        ? `${"#".repeat(resolvedLevel)} ${manualContent}${newlineSuffix}`
        : `${"#".repeat(resolvedLevel)}${newlineSuffix}`;
    }
  }

  if (tag === "strong" || tag === "b") {
    return `**${serializeMarkdownChildren(element, context)}**`;
  }

  if (tag === "em" || tag === "i") {
    return `*${serializeMarkdownChildren(element, context)}*`;
  }

  if (tag === "del" || tag === "s") {
    return `~~${serializeMarkdownChildren(element, context)}~~`;
  }

  if (tag === "code") {
    if (element.parentElement?.tagName.toLowerCase() === "pre") {
      return "";
    }
    return wrapInlineCode(element.textContent ?? "");
  }

  if (tag === "pre") {
    const contentClone = element.cloneNode(true) as HTMLElement;
    contentClone.querySelectorAll(".md-code-fence-line").forEach((line) => line.remove());
    const code = contentClone.querySelector("code")?.textContent ?? contentClone.textContent ?? "";
    if (context.inContentEditable) {
      const openMarkerText = element.querySelector(
        ".md-code-fence-open > .md-code-fence-marker",
      )?.textContent ?? null;
      const closeMarkerText = element.querySelector(
        ".md-code-fence-close > .md-code-fence-marker",
      )?.textContent ?? null;
      if (
        element.hasAttribute("data-md-code-block") ||
        openMarkerText !== null ||
        closeMarkerText !== null
      ) {
        const openMarker = normalizeOpenCodeFenceMarker(openMarkerText);
        const closeMarker = normalizeCloseCodeFenceMarker(closeMarkerText, openMarker);
        return wrapCodeBlockWithMarkers(code, openMarker, closeMarker);
      }
    }
    const block = wrapCodeBlock(code);
    return context.inContentEditable ? block : `${block}\n`;
  }

  if (tag === "blockquote") {
    const content = serializeMarkdownChildren(element, context).trim();
    const lines = content.split("\n");
    const block = lines.map((line) => (line ? `> ${line}` : ">")).join("\n");
    return context.inContentEditable ? `${block}\n` : `${block}\n\n`;
  }

  if (tag === "ul" || tag === "ol") {
    return serializeMarkdownList(element, context);
  }

  if (tag === "li") {
    return serializeMarkdownChildren(element, context).trim();
  }

  if (tag === "a") {
    const href = element.getAttribute("href") ?? "";
    const text = serializeMarkdownChildren(element, context).trim();
    if (!href) {
      return text;
    }
    return `[${escapeMarkdownLinkText(text)}](${href})`;
  }

  if (tag === "hr") {
    return context.inContentEditable ? "---\n" : "---\n\n";
  }

  if (tag === "table") {
    return serializeMarkdownTable(element, context);
  }

  return serializeMarkdownChildren(element, context);
};

const serializeMarkdownList = (
  element: HTMLElement,
  context: MarkdownSerializeContext,
) => {
  const isOrdered = element.tagName.toLowerCase() === "ol";
  let index = Number(element.getAttribute("start") ?? "1");
  if (Number.isNaN(index)) {
    index = 1;
  }
  const indent = "  ".repeat(context.listDepth);
  const items = Array.from(element.children).filter(
    (child) => child.tagName.toLowerCase() === "li",
  );
  const lines: string[] = [];

  const resolveDefaultMarker = (itemIndex: number) => {
    if (!isOrdered) {
      return "- ";
    }
    const delimiter = element.getAttribute("data-md-ordered-delimiter") === ")" ? ")" : ".";
    return `${index + itemIndex}${delimiter} `;
  };

  const resolveManualMarker = (value: string, fallback: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }
    const taskMatch = trimmed.match(/^([-+*])\s+\[([ xX])\]$/);
    if (taskMatch) {
      const taskBullet = taskMatch[1] ?? "-";
      const taskState = taskMatch[2] ?? " ";
      const state = taskState.toLowerCase() === "x" ? "x" : " ";
      return `${taskBullet} [${state}] `;
    }
    const orderedMatch = trimmed.match(/^(\d+)([.)])$/);
    if (orderedMatch) {
      const number = orderedMatch[1] ?? "1";
      const delimiter = orderedMatch[2] ?? ".";
      return `${number}${delimiter} `;
    }
    if (/^[-+*]$/.test(trimmed)) {
      return `${trimmed} `;
    }
    return fallback;
  };

  items.forEach((item, itemIndex) => {
    const defaultMarker = resolveDefaultMarker(itemIndex);
    const markerElement = item.firstElementChild instanceof HTMLElement &&
        item.firstElementChild.classList.contains("md-list-marker")
      ? item.firstElementChild
      : null;
    const rawMarker = markerElement?.textContent ?? "";
    const marker = resolveManualMarker(rawMarker, defaultMarker);
    const contentSource = markerElement
      ? (() => {
          const clone = item.cloneNode(true) as HTMLElement;
          if (
            clone.firstElementChild instanceof HTMLElement &&
            clone.firstElementChild.classList.contains("md-list-marker")
          ) {
            clone.firstElementChild.remove();
          }
          return clone;
        })()
      : item;
    const content = serializeMarkdownChildren(contentSource, {
      ...context,
      listDepth: context.listDepth + 1,
    })
      .trim();
    const itemLines = content ? content.split("\n") : [""];
    lines.push(`${indent}${marker}${itemLines[0]}`);
    itemLines.slice(1).forEach((line) => {
      lines.push(`${indent}  ${line}`);
    });
  });

  const block = `${lines.join("\n")}\n`;
  return context.inContentEditable ? block : `${block}\n`;
};

const serializeMarkdownTable = (
  element: HTMLElement,
  context: MarkdownSerializeContext,
) => {
  const rows = Array.from(element.querySelectorAll("tr"));
  if (rows.length === 0) {
    return "";
  }
  const headerRow =
    element.querySelector("thead tr") ?? rows[0];
  const headerCells = Array.from(headerRow.children).map((cell) =>
    serializeTableCell(cell as HTMLElement, context),
  );
  const bodyRows = rows.filter((row) => row !== headerRow);

  const headerLine = `| ${headerCells.join(" | ")} |`;
  const separatorLine = `| ${headerCells.map(() => "---").join(" | ")} |`;
  const bodyLines = bodyRows.map((row) => {
    const cells = Array.from(row.children).map((cell) =>
      serializeTableCell(cell as HTMLElement, context),
    );
    return `| ${cells.join(" | ")} |`;
  });

  const block = `${[headerLine, separatorLine, ...bodyLines].join("\n")}\n`;
  return context.inContentEditable ? block : `${block}\n`;
};

const serializeTableCell = (
  element: HTMLElement,
  context: MarkdownSerializeContext,
) => {
  const text = serializeMarkdownChildren(element, {
    ...context,
    escapePipes: false,
  })
    .replace(/\n+/g, " ")
    .trim();
  return escapeMarkdownTableCell(text);
};

export const normalizeTableSpacingForRender = (markdown: string) =>
  normalizeMarkdownPipeTables(markdown);

export const serializeMarkdownFromHtml = (container: HTMLElement) => {
  const serialized = serializeMarkdownChildren(container, {
    listDepth: 0,
    escapePipes: true,
    inContentEditable: true,
  });
  return normalizeMarkdownPipeTables(serialized, {
    unescapeEscapedBoundaryPipes: true,
  });
};

export const buildEditableMarkdownHtml = (
  container: HTMLElement,
  rawMarkdown?: string,
) => {
  const clone = container.cloneNode(true) as HTMLElement;
  const parseListMarkersFromMarkdown = (markdown: string) => {
    if (!markdown) {
      return [] as string[];
    }
    const markers: string[] = [];
    const lines = markdown.split("\n");
    let inCodeFence = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) {
        inCodeFence = !inCodeFence;
        continue;
      }
      if (inCodeFence) {
        continue;
      }
      const taskMatch = line.match(/^\s*([-+*])\s+\[([ xX])\](?:\s|$)/);
      if (taskMatch) {
        const bullet = taskMatch[1] ?? "-";
        const stateRaw = taskMatch[2] ?? " ";
        const state = stateRaw.toLowerCase() === "x" ? "x" : " ";
        markers.push(`${bullet} [${state}] `);
        continue;
      }
      const orderedMatch = line.match(/^\s*(\d+)([.)])(?:\s|$)/);
      if (orderedMatch) {
        const number = orderedMatch[1] ?? "1";
        const delimiter = orderedMatch[2] ?? ".";
        markers.push(`${number}${delimiter} `);
        continue;
      }
      const unorderedMatch = line.match(/^\s*([-+*])(?:\s|$)/);
      if (unorderedMatch) {
        const bullet = unorderedMatch[1] ?? "-";
        markers.push(`${bullet} `);
      }
    }
    return markers;
  };

  const parseCodeFenceMarkersFromMarkdown = (markdown: string) => {
    if (!markdown) {
      return [] as Array<{ open: string; close: string }>;
    }
    const lines = markdown.split("\n");
    const markers: Array<{ open: string; close: string }> = [];
    let inFence = false;
    let openMarker = "";

    for (const line of lines) {
      if (!inFence) {
        const openMatch = line.match(/^\s*(`{3,}.*)$/);
        if (!openMatch) {
          continue;
        }
        openMarker = (openMatch[1] ?? "").trim();
        inFence = true;
        continue;
      }

      const closeMatch = line.match(/^\s*(`{3,})\s*$/);
      if (!closeMatch) {
        continue;
      }
      const normalizedOpen = normalizeOpenCodeFenceMarker(openMarker);
      markers.push({
        open: normalizedOpen,
        close: normalizeCloseCodeFenceMarker(closeMatch[1] ?? null, normalizedOpen),
      });
      openMarker = "";
      inFence = false;
    }

    if (inFence) {
      const normalizedOpen = normalizeOpenCodeFenceMarker(openMarker);
      markers.push({
        open: normalizedOpen,
        close: resolveCodeFenceFromOpenMarker(normalizedOpen),
      });
    }

    return markers;
  };

  const resolveOrderedMarker = (listItem: HTMLElement) => {
    const parent = listItem.parentElement;
    if (!parent || parent.tagName.toLowerCase() !== "ol") {
      return "1. ";
    }
    const start = Number.parseInt(parent.getAttribute("start") ?? "1", 10);
    const base = Number.isNaN(start) ? 1 : start;
    const siblings = Array.from(parent.children).filter(
      (child) => child.tagName.toLowerCase() === "li",
    );
    const itemIndex = siblings.indexOf(listItem);
    const resolvedIndex = itemIndex < 0 ? base : base + itemIndex;
    return `${resolvedIndex}. `;
  };

  const resolveTaskMarker = (listItem: HTMLElement) => {
    const checkbox = Array.from(listItem.children).find(
      (child): child is HTMLInputElement =>
        child instanceof HTMLInputElement &&
        child.type.toLowerCase() === "checkbox",
    );
    if (!checkbox && !listItem.classList.contains("task-list-item")) {
      return null;
    }
    const checked = checkbox?.checked || checkbox?.hasAttribute("checked");
    return `- [${checked ? "x" : " "}] `;
  };

  const removeTaskCheckboxes = (listItem: HTMLElement) => {
    const checkboxes = Array.from(listItem.children).filter(
      (child): child is HTMLInputElement =>
        child instanceof HTMLInputElement &&
        child.type.toLowerCase() === "checkbox",
    );
    checkboxes.forEach((checkbox) => {
      const nextSibling = checkbox.nextSibling;
      checkbox.remove();
      if (
        nextSibling &&
        nextSibling.nodeType === Node.TEXT_NODE &&
        (nextSibling.nodeValue ?? "").trim() === ""
      ) {
        nextSibling.remove();
      }
    });
  };

  const resolveListMarker = (listItem: HTMLElement, hint: string | null) => {
    if (hint) {
      return hint;
    }
    const taskMarker = resolveTaskMarker(listItem);
    if (taskMarker) {
      return taskMarker;
    }
    const parent = listItem.parentElement;
    if (parent?.tagName.toLowerCase() === "ol") {
      return resolveOrderedMarker(listItem);
    }
    return "- ";
  };
  const listMarkerHints = parseListMarkersFromMarkdown(rawMarkdown ?? "");
  const codeFenceHints = parseCodeFenceMarkersFromMarkdown(rawMarkdown ?? "");
  let listMarkerHintIndex = 0;
  let codeFenceHintIndex = 0;

  const createCodeCopyButton = (doc: Document) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "md-code-copy-button";
    button.setAttribute("aria-label", "Copy code block");
    button.setAttribute("title", "Copy code block");
    button.setAttribute("contenteditable", "false");
    button.setAttribute("tabindex", "-1");

    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");

    const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "9");
    rect.setAttribute("y", "9");
    rect.setAttribute("width", "10");
    rect.setAttribute("height", "10");
    rect.setAttribute("rx", "2");
    rect.setAttribute("stroke", "currentColor");
    rect.setAttribute("stroke-width", "1.7");

    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.7");
    path.setAttribute("stroke-linecap", "round");

    svg.appendChild(rect);
    svg.appendChild(path);
    button.appendChild(svg);
    return button;
  };

  clone.querySelectorAll(".frontmatter-panel").forEach((panel) => panel.remove());
  clone.querySelectorAll(".frontmatter-cover-panel").forEach((panel) => panel.remove());
  clone.querySelectorAll(".md-code-copy-button").forEach((button) => button.remove());
  clone.querySelectorAll<HTMLElement>("pre").forEach((codeBlock) => {
    let wrapper = codeBlock.parentElement;
    if (!wrapper || !wrapper.classList.contains("md-code-block")) {
      const createdWrapper = codeBlock.ownerDocument.createElement("div");
      createdWrapper.className = "md-code-block";
      codeBlock.replaceWith(createdWrapper);
      createdWrapper.appendChild(codeBlock);
      wrapper = createdWrapper;
    }
    wrapper.insertBefore(createCodeCopyButton(codeBlock.ownerDocument), wrapper.firstChild);

    const codeElement = codeBlock.querySelector<HTMLElement>("code");
    if (codeElement) {
      // Reset highlighted markup to plain text before entering contentEditable mode.
      const plainCode = codeElement.textContent ?? "";
      codeElement.textContent = plainCode;
      const nextCodeClassName = codeElement.className
        .split(/\s+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .filter((entry) => !entry.startsWith("hljs"))
        .join(" ");
      codeElement.className = nextCodeClassName;
      codeElement.removeAttribute("data-md-code-highlighted");
      codeElement.removeAttribute("data-md-code-language-label");
    }
    codeBlock.classList.remove("md-code-highlighted-pre");
    codeBlock.removeAttribute("data-md-code-highlighted");
    codeBlock.removeAttribute("data-md-code-language-label");

    codeBlock.setAttribute("data-md-code-block", "true");
    codeBlock.removeAttribute("data-md-code-active");
    if (codeBlock.querySelector(".md-code-fence-line")) {
      return;
    }
    const markerHint = codeFenceHints[codeFenceHintIndex] ?? null;
    codeFenceHintIndex += 1;
    const openMarkerText = markerHint?.open ?? "```";
    const closeMarkerText = markerHint?.close ?? "```";
    const openLine = codeBlock.ownerDocument.createElement("span");
    openLine.className = "md-code-fence-line md-code-fence-open";
    const openMarker = codeBlock.ownerDocument.createElement("span");
    openMarker.className = "md-code-fence-marker";
    openMarker.textContent = openMarkerText;
    openLine.appendChild(openMarker);
    codeBlock.insertBefore(openLine, codeBlock.firstChild);

    const closeLine = codeBlock.ownerDocument.createElement("span");
    closeLine.className = "md-code-fence-line md-code-fence-close";
    const closeMarker = codeBlock.ownerDocument.createElement("span");
    closeMarker.className = "md-code-fence-marker";
    closeMarker.textContent = closeMarkerText;
    closeLine.appendChild(closeMarker);
    codeBlock.appendChild(closeLine);
  });
  clone.querySelectorAll<HTMLElement>("li").forEach((item) => {
    if (
      item.firstElementChild instanceof HTMLElement &&
      item.firstElementChild.classList.contains("md-list-marker")
    ) {
      return;
    }
    const markerHint = listMarkerHints[listMarkerHintIndex] ?? null;
    listMarkerHintIndex += 1;
    const markerText = resolveListMarker(item, markerHint);
    removeTaskCheckboxes(item);
    const marker = item.ownerDocument.createElement("span");
    marker.className = "md-list-marker";
    marker.textContent = markerText;
    item.insertBefore(marker, item.firstChild);
  });
  clone.querySelectorAll<HTMLElement>("hr").forEach((rule) => {
    const markerLine = rule.ownerDocument.createElement("p");
    markerLine.setAttribute("data-md-hr-line", "true");
    const marker = rule.ownerDocument.createElement("span");
    marker.className = "md-hr-marker";
    marker.textContent = "---";
    markerLine.appendChild(marker);
    rule.replaceWith(markerLine);
  });
  clone.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6").forEach((heading) => {
    const levelRaw = Number.parseInt(heading.tagName.slice(1), 10);
    if (Number.isNaN(levelRaw)) {
      return;
    }
    const level = Math.max(1, Math.min(6, levelRaw));
    heading.setAttribute("data-md-heading-level", String(level));
    const text = heading.textContent ?? "";
    if (/^\s*\\?#{1,6}(?:\s|$)/.test(text)) {
      return;
    }
    const marker = heading.ownerDocument.createElement("span");
    marker.className = "md-heading-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = `${"#".repeat(level)} `;
    heading.insertBefore(marker, heading.firstChild);
  });
  return clone.innerHTML;
};

const resolveRawCaretIndex = (container: HTMLElement, range: Range | null) => {
  const resolvedRange = range ?? getSelectionRange(container);
  if (!resolvedRange) {
    return null;
  }
  return getRangeOffset(container, resolvedRange);
};

const resolveMarkdownCaretIndex = (
  container: HTMLElement,
  rawMarkdown: string,
  range: Range | null,
  options?: MarkdownOffsetMapOptions,
) => {
  const resolvedRange = range ?? getSelectionRange(container);
  if (!resolvedRange) {
    return null;
  }
  const plainOffset = getRangeOffset(container, resolvedRange);
  if (rawMarkdown.length === 0) {
    return 0;
  }
  return mapPlainOffsetToRawIndex(rawMarkdown, plainOffset, options);
};

const isExamTaskStartLine = (line: string) => {
  let trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("**")) {
    trimmed = trimmed.slice(2).trimStart();
  }

  if (trimmed.startsWith("-")) {
    trimmed = trimmed.slice(1);
  }

  const numberMatch = trimmed.match(/^(\d+)/);
  if (!numberMatch) {
    return false;
  }

  const numberRaw = numberMatch[1] ?? "";
  if (numberRaw.length > 1 && numberRaw.startsWith("0")) {
    return false;
  }

  const number = Number.parseInt(numberRaw, 10);
  if (number < 1 || number > 20) {
    return false;
  }

  let remainder = trimmed.slice(numberRaw.length);
  if (remainder.startsWith(")")) {
    remainder = remainder.slice(1);
  }
  if (remainder.startsWith("**")) {
    remainder = remainder.slice(2);
  }

  return remainder.length === 0 || /^\s/.test(remainder);
};

const isExamOptionLine = (line: string) =>
  /^[a-d]\)\s+\S/i.test(line.trim());

// Keep exam task numbering like "1)" editable by avoiding ordered-list parsing.
const escapeExamTaskListMarker = (line: string) => {
  if (!isExamTaskStartLine(line)) {
    return line;
  }
  const match = line.match(/^(\s*)(\d+)\)/);
  if (!match) {
    return line;
  }
  return `${match[1]}${match[2]}\\)${line.slice(match[0].length)}`;
};

const shouldExpandInlineExamLine = (line: string) => {
  const lowered = line.toLowerCase();
  return /\s-[a-d]\b/.test(lowered) ||
    /\s-(true|false)\b/.test(lowered) ||
    /\b[a-d]\)\s+\S/.test(lowered);
};

const ensureHardBreakSpacing = (value: string) => {
  if (!value) {
    return value;
  }
  const match = value.match(/[ \t]+$/);
  const trailingLength = match ? match[0].length : 0;
  if (trailingLength >= 2) {
    return value;
  }
  return `${value}${" ".repeat(2 - trailingLength)}`;
};

const splitExpandedExamLine = (expanded: string) => {
  const parts = expanded.split("\n");
  if (parts.length <= 1) {
    return parts;
  }
  return parts.map((part, index) => {
    if (index === parts.length - 1 || part === "") {
      return part;
    }
    return ensureHardBreakSpacing(part);
  });
};

const expandInlineExamLine = (line: string) => {
  if (!line || !shouldExpandInlineExamLine(line)) {
    return [line];
  }

  let expanded = line;
  expanded = expanded.replace(/\s-((?:true|false)|[a-d])\b/gi, "\n-$1");
  expanded = expanded.replace(/\s([a-d]\))\s*/gi, "\n$1 ");

  return splitExpandedExamLine(expanded);
};

export const applyInteractionSpacing = (markdown: string) => {
  if (!markdown) {
    return markdown;
  }
  // Preserve hard breaks and marker lines because exam/flashcard parsing is line-based.
  const sourceLines = markdown.split("\n");
  const expandedLines: string[] = [];
  let inCodeFence = false;

  for (let i = 0; i < sourceLines.length; i += 1) {
    const line = sourceLines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      expandedLines.push(line);
      continue;
    }
    if (inCodeFence) {
      expandedLines.push(line);
      continue;
    }
    expandedLines.push(...expandInlineExamLine(line));
  }

  const result: string[] = [];
  inCodeFence = false;

  for (let i = 0; i < expandedLines.length; i += 1) {
    const line = expandedLines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      result.push(line);
      continue;
    }

    result.push(line);
    if (inCodeFence || !isInteractionMarkerLine(trimmed)) {
      continue;
    }

    const nextLine = expandedLines[i + 1] ?? "";
    const nextTrimmed = nextLine.trim();
    if (nextTrimmed === "" || isInteractionMarkerLine(nextTrimmed)) {
      continue;
    }
    result.push("");
  }

  const normalized: string[] = [];
  inCodeFence = false;

  for (let i = 0; i < result.length; i += 1) {
    const line = result[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      normalized.push(line);
      continue;
    }
    if (inCodeFence) {
      normalized.push(line);
      continue;
    }

    let nextLine = line;
    if (trimmed) {
      if (isExamTaskStartLine(nextLine)) {
        nextLine = escapeExamTaskListMarker(nextLine);
        nextLine = ensureHardBreakSpacing(nextLine);
      } else if (isExamOptionLine(nextLine)) {
        nextLine = ensureHardBreakSpacing(nextLine);
      }
    }
    normalized.push(nextLine);
  }

  return normalized.join("\n");
};

const FrontmatterTextIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 6h12" />
    <path d="M6 12h12" />
    <path d="M6 18h8" />
  </svg>
);

const FrontmatterTaskIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M8 9h8" />
    <path d="M8 13h5" />
    <path d="M8 17h3" />
  </svg>
);

const FrontmatterNumberIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 5L6 19" />
    <path d="M16 5l-2 14" />
    <path d="M4 10h16" />
    <path d="M3 15h16" />
  </svg>
);

const FrontmatterToggleIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="8" width="18" height="8" rx="4" />
    <circle cx="9" cy="12" r="2.5" fill="currentColor" stroke="none" />
  </svg>
);

const FrontmatterTagIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 13l-7 7-9-9V4h7l9 9z" />
    <circle cx="8.5" cy="8.5" r="1.4" />
  </svg>
);

const FrontmatterLinkIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
    <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
  </svg>
);

const FrontmatterImageIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M3 16l5-4 4 3 3-2 6 5" />
  </svg>
);

const FrontmatterUnknownIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.2a2.4 2.4 0 0 1 4.8 0c0 1.4-1.5 1.9-2.3 2.5-.5.3-.7.7-.7 1.3" />
    <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const FrontmatterGripIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <circle cx="8" cy="7" r="1.2" />
    <circle cx="8" cy="12" r="1.2" />
    <circle cx="8" cy="17" r="1.2" />
    <circle cx="16" cy="7" r="1.2" />
    <circle cx="16" cy="12" r="1.2" />
    <circle cx="16" cy="17" r="1.2" />
  </svg>
);

const FrontmatterPropertyIconView = ({
  icon,
}: {
  icon: FrontmatterPropertyIcon;
}) => {
  switch (icon) {
    case "cover":
      return <FrontmatterImageIcon />;
    case "task":
      return <FrontmatterTaskIcon />;
    case "number":
      return <FrontmatterNumberIcon />;
    case "boolean":
      return <FrontmatterToggleIcon />;
    case "tags":
      return <FrontmatterTagIcon />;
    case "link":
      return <FrontmatterLinkIcon />;
    case "unknown":
      return <FrontmatterUnknownIcon />;
    default:
      return <FrontmatterTextIcon />;
  }
};

const stringifyPropertyValue = (property: FrontmatterProperty) => {
  if (Array.isArray(property.value)) {
    return property.value.join(", ");
  }
  if (typeof property.value === "number") {
    return String(property.value);
  }
  if (typeof property.value === "boolean") {
    return property.value ? "true" : "false";
  }
  return property.value ?? "";
};

const normalizeTags = (value: string[]) => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  value.forEach((tag) => {
    const clean = tag.trim();
    if (!clean || seen.has(clean)) {
      return;
    }
    seen.add(clean);
    normalized.push(clean);
  });
  return normalized;
};

type FrontmatterEditorMode = "idle" | "active" | "editing" | "committing";

const numericSuggestionPattern = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

const isNumericSuggestionValue = (value: string) =>
  numericSuggestionPattern.test(value.trim());

const sortSuggestionValues = (values: string[]) => {
  const allNumeric = values.length > 0 && values.every(isNumericSuggestionValue);
  const sorted = values.slice();
  if (allNumeric) {
    sorted.sort((left, right) => Number(left) - Number(right));
    return sorted;
  }
  sorted.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  return sorted;
};

const mergeSuggestionRecords = (...sources: Array<Record<string, string[]>>) => {
  const buckets = new Map<string, Set<string>>();
  sources.forEach((source) => {
    Object.entries(source).forEach(([key, values]) => {
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = new Set<string>();
        buckets.set(key, bucket);
      }
      values.forEach((value) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return;
        }
        bucket?.add(trimmed);
      });
    });
  });
  const merged: Record<string, string[]> = {};
  Array.from(buckets.entries()).forEach(([key, values]) => {
    merged[key] = sortSuggestionValues(Array.from(values));
  });
  return merged;
};

const mergeSuggestionKeyLists = (...sources: string[][]) => {
  const seen = new Set<string>();
  const merged: string[] = [];
  sources.forEach((source) => {
    source.forEach((key) => {
      const trimmed = key.trim();
      if (!trimmed || seen.has(trimmed)) {
        return;
      }
      seen.add(trimmed);
      merged.push(trimmed);
    });
  });
  return merged;
};

type FrontmatterAddPropertyType =
  | "text"
  | "task"
  | "link"
  | "number"
  | "cover"
  | "tags";

type FrontmatterAddTypeOption = {
  kind: FrontmatterAddPropertyType;
  icon: FrontmatterPropertyIcon;
  label: string;
  description: string;
};

const FRONTMATTER_DEFAULT_ADD_TYPE: FrontmatterAddPropertyType = "text";

const FRONTMATTER_ADD_TYPE_OPTIONS: FrontmatterAddTypeOption[] = [
  {
    kind: "text",
    icon: "text",
    label: "Text",
    description: "Freier Text",
  },
  {
    kind: "task",
    icon: "task",
    label: "Task",
    description: "Points-Profil Zuordnung",
  },
  {
    kind: "link",
    icon: "link",
    label: "Links",
    description: "Wikilink oder Name",
  },
  {
    kind: "number",
    icon: "number",
    label: "Nur Zahlen",
    description: "Nur numerische Werte",
  },
  {
    kind: "cover",
    icon: "cover",
    label: "Cover",
    description: "Bild-Wikilink",
  },
  {
    kind: "tags",
    icon: "tags",
    label: "Tags",
    description: "Tag-Liste",
  },
];

const addTypeSuggestionScope = "__frontmatter_add_type__";
const addKeySuggestionScope = "__frontmatter_add_key__";
const addValueSuggestionScope = "__frontmatter_add_value__";

const resolveAutoAddKeyForType = (kind: FrontmatterAddPropertyType) => {
  if (kind === "task") {
    return "Task";
  }
  if (kind === "link") {
    return "links";
  }
  if (kind === "tags") {
    return "tags";
  }
  if (kind === "cover") {
    return "Cover";
  }
  return null;
};

const isReservedTextSuggestionKey = (key: string) => {
  const normalized = key.trim().toLowerCase();
  return isLinkPropertyKey(key) || normalized === "tags" || normalized === "tag";
};

const COVER_KEY_NAMES = new Set(["cover", "image", "thumbnail"]);

const isCoverKeyName = (key: string) => COVER_KEY_NAMES.has(key.trim().toLowerCase());
const isTaskKeyName = (key: string) => key.trim().toLowerCase() === "task";

const resolveRelativePathCandidates = (
  target: string,
  sourceRelativePath?: string | null,
) => {
  const normalizedTarget = normalizeRelativePath(target).replace(/^\/+/, "");
  if (!normalizedTarget) {
    return [] as string[];
  }
  const candidates = new Set<string>();
  candidates.add(normalizedTarget);
  if (!normalizedTarget.includes("/") && sourceRelativePath) {
    const sourceNormalized = normalizeRelativePath(sourceRelativePath);
    const sourceSegments = sourceNormalized.split("/").filter(Boolean);
    sourceSegments.pop();
    if (sourceSegments.length > 0) {
      candidates.add([...sourceSegments, normalizedTarget].join("/"));
    }
  }
  return Array.from(candidates);
};

const imageSuggestionExtensionPattern = /\.(png|jpe?g|webp|gif|svg)$/i;
const coverPickerExtensionPattern = /\.png$/i;

const isImageSuggestionValue = (value: string) => {
  const normalized = normalizeWikilinkValue(value);
  if (!normalized.startsWith("[[") || !normalized.endsWith("]]")) {
    return false;
  }
  const inner = normalized.slice(2, -2);
  const [targetRaw] = inner.split("|");
  const target = targetRaw?.trim() ?? "";
  if (!target) {
    return false;
  }
  const [pathPart] = target.split(/[?#]/);
  return imageSuggestionExtensionPattern.test(pathPart ?? "");
};

const normalizeStableSuggestions = (values: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    next.push(trimmed);
  });
  return next;
};

const isScalarEditableKind = (kind: FrontmatterPropertyKind) =>
  kind === "text" ||
  kind === "task" ||
  kind === "unknown" ||
  kind === "link" ||
  kind === "cover" ||
  kind === "number";

const isPrintableCharacterKey = (
  event: Pick<KeyboardEvent<HTMLInputElement>, "key" | "metaKey" | "ctrlKey" | "altKey">,
) =>
  event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;

const resolveSuggestionValuesFromCommitted = (
  value: string | number | boolean | string[] | null,
) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? [String(value)] : [];
  }
  if (typeof value === "boolean") {
    return [value ? "true" : "false"];
  }
  return [];
};

const resolveWikilinkLabel = (wikilink: string) => {
  const trimmed = wikilink.trim();
  if (!trimmed.startsWith("[[") || !trimmed.endsWith("]]")) {
    return trimmed;
  }
  const inner = trimmed.slice(2, -2).trim();
  if (!inner) {
    return trimmed;
  }
  const [targetRaw, aliasRaw] = inner.split("|");
  const alias = aliasRaw?.trim();
  if (alias) {
    return alias;
  }
  return targetRaw?.trim() ?? trimmed;
};

type FrontmatterPropertiesPanelProps = {
  sourceMarkdown: string;
  properties: FrontmatterProperty[];
  showPropertiesPanel?: boolean;
  coverInteractive?: boolean;
  sourceRelativePath?: string | null;
  vaultFiles?: VaultFile[];
  vaultPngAssets?: VaultPngAsset[];
  vaultPath?: string | null;
  canEdit: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onFrontmatterSave?: (nextPreview: string) => Promise<boolean>;
  onNavigateWikilink?: (wikilink: string) => void;
  onOpenTaskProfileEditor?: (params: {
    taskValue: string | null;
    propertyKey: string;
  }) => Promise<void> | void;
  taskProfileSummariesByName?: Record<
    string,
    {
      taskCount: number;
      maxTotalPoints: number;
    }
  >;
  valueSuggestionsByKey?: Record<string, string[]>;
  keySuggestions?: string[];
};

const EMPTY_VALUE_SUGGESTIONS: Record<string, string[]> = {};
const EMPTY_KEY_SUGGESTIONS: string[] = [];

const FrontmatterPropertiesPanel = ({
  sourceMarkdown,
  properties,
  showPropertiesPanel = true,
  coverInteractive = true,
  sourceRelativePath,
  vaultFiles,
  vaultPngAssets,
  vaultPath,
  canEdit,
  isCollapsed,
  onToggleCollapsed,
  onFrontmatterSave,
  onNavigateWikilink,
  onOpenTaskProfileEditor,
  taskProfileSummariesByName,
  valueSuggestionsByKey = EMPTY_VALUE_SUGGESTIONS,
  keySuggestions = EMPTY_KEY_SUGGESTIONS,
}: FrontmatterPropertiesPanelProps) => {
  const linksDocument = useMemo(
    () => parseFrontmatterLinks(sourceMarkdown),
    [sourceMarkdown],
  );
  const visibleProperties = useMemo(
    () => properties.filter((property) => !isLinkPropertyKey(property.key)),
    [properties],
  );
  const coverProperty = useMemo(
    () =>
      visibleProperties.find(
        (property) => property.kind === "cover" || isCoverKeyName(property.key),
      ) ?? null,
    [visibleProperties],
  );
  const gridProperties = useMemo(
    () =>
      visibleProperties.filter(
        (property) => !(property.kind === "cover" || isCoverKeyName(property.key)),
      ),
    [visibleProperties],
  );
  const initialDrafts = useMemo(() => {
    const next: Record<string, string> = {};
    visibleProperties.forEach((property) => {
      next[property.key] = stringifyPropertyValue(property);
    });
    return next;
  }, [visibleProperties]);
  const initialSuggestionValues = useMemo(
    () =>
      mergeSuggestionRecords(
        valueSuggestionsByKey,
        collectFrontmatterValueSuggestions(visibleProperties),
      ),
    [valueSuggestionsByKey, visibleProperties],
  );
  const initialKeySuggestions = useMemo(
    () => mergeSuggestionKeyLists(keySuggestions),
    [keySuggestions],
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(initialDrafts);
  const [suggestionValuesByKey, setSuggestionValuesByKey] = useState<Record<string, string[]>>(
    initialSuggestionValues,
  );
  const [suggestionKeys, setSuggestionKeys] = useState<string[]>(
    initialKeySuggestions,
  );
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [panelError, setPanelError] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [linksInputDraft, setLinksInputDraft] = useState("");
  const [addTypeDraft, setAddTypeDraft] = useState<FrontmatterAddPropertyType>(
    FRONTMATTER_DEFAULT_ADD_TYPE,
  );
  const [addKeyDraft, setAddKeyDraft] = useState("");
  const [addValueDraft, setAddValueDraft] = useState("");
  const [addError, setAddError] = useState("");
  const [addEditorModes, setAddEditorModes] = useState<{
    type: FrontmatterEditorMode;
    key: FrontmatterEditorMode;
    value: FrontmatterEditorMode;
  }>({
    type: "idle",
    key: "idle",
    value: "idle",
  });
  const [editorModes, setEditorModes] = useState<Record<string, FrontmatterEditorMode>>({});
  const [openSuggestionsKey, setOpenSuggestionsKey] = useState<string | null>(null);
  const [suggestionCursor, setSuggestionCursor] = useState<Record<string, number>>({});
  const valueInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const linksInputRef = useRef<HTMLInputElement | null>(null);
  const addTypeButtonRef = useRef<HTMLButtonElement | null>(null);
  const addKeyInputRef = useRef<HTMLInputElement | null>(null);
  const addValueInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFrameHandlesRef = useRef<Set<number>>(new Set());
  const frontmatterCoverPanelRef = useRef<HTMLDivElement | null>(null);
  const frontmatterGridRef = useRef<HTMLDivElement | null>(null);
  const [dragPropertyKey, setDragPropertyKey] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{
    key: string;
    position: "before" | "after";
  } | null>(null);
  const [activeCoverKey, setActiveCoverKey] = useState<string | null>(null);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [coverImageErrors, setCoverImageErrors] = useState<
    Record<string, { src: string; relativePath: string; absolutePath: string }>
  >({});
  const existingPropertyKeys = useMemo(
    () => new Set(properties.map((property) => property.key.toLowerCase())),
    [properties],
  );
  const hasExistingLinkAttributes = useMemo(
    () => properties.some((property) => isLinkPropertyKey(property.key)),
    [properties],
  );
  const hasExistingTagsAttribute = useMemo(
    () => properties.some((property) => property.key.trim().toLowerCase() === "tags"),
    [properties],
  );
  const hasExistingTaskAttribute = useMemo(
    () => gridProperties.some((property) => property.kind === "task" || isTaskKeyName(property.key)),
    [gridProperties],
  );
  const hasExistingCoverAttribute = coverProperty !== null;
  const existingCoverPropertyKey = coverProperty?.key ?? null;
  const addTypeOptions = useMemo(
    () =>
      FRONTMATTER_ADD_TYPE_OPTIONS.filter((option) => {
        if (option.kind === "link" && hasExistingLinkAttributes) {
          return false;
        }
        if (option.kind === "tags" && hasExistingTagsAttribute) {
          return false;
        }
        if (option.kind === "task" && hasExistingTaskAttribute) {
          return false;
        }
        if (option.kind === "cover" && hasExistingCoverAttribute) {
          return false;
        }
        return true;
      }),
    [
      hasExistingCoverAttribute,
      hasExistingLinkAttributes,
      hasExistingTagsAttribute,
      hasExistingTaskAttribute,
    ],
  );

  useEffect(() => {
    setDrafts(initialDrafts);
    setEditorModes({});
    setAddEditorModes({ type: "idle", key: "idle", value: "idle" });
    setOpenSuggestionsKey(null);
    setSuggestionCursor({});
    setTagInputs({});
    setRowErrors({});
    setPanelError("");
    setDragPropertyKey(null);
    setDropHint(null);
    setActiveCoverKey(null);
    setIsCoverPickerOpen(false);
    setCoverImageErrors({});
  }, [initialDrafts]);

  useEffect(() => {
    setSuggestionValuesByKey(initialSuggestionValues);
  }, [initialSuggestionValues]);

  useEffect(() => {
    setSuggestionKeys(initialKeySuggestions);
  }, [initialKeySuggestions]);

  useEffect(() => {
    if (addTypeOptions.some((option) => option.kind === addTypeDraft)) {
      return;
    }
    setAddTypeDraft(FRONTMATTER_DEFAULT_ADD_TYPE);
  }, [addTypeDraft, addTypeOptions]);

  const scheduleAnimationFrame = useCallback((callback: () => void) => {
    const handle = window.requestAnimationFrame(() => {
      pendingFrameHandlesRef.current.delete(handle);
      callback();
    });
    pendingFrameHandlesRef.current.add(handle);
    return handle;
  }, []);

  useEffect(() => {
    return () => {
      pendingFrameHandlesRef.current.forEach((handle) => {
        window.cancelAnimationFrame(handle);
      });
      pendingFrameHandlesRef.current.clear();
    };
  }, []);

  const resetDraftsFromProperties = useCallback(() => {
    setDrafts(initialDrafts);
    setEditorModes({});
    setAddEditorModes({ type: "idle", key: "idle", value: "idle" });
    setOpenSuggestionsKey(null);
    setSuggestionCursor({});
    setTagInputs({});
    setRowErrors({});
    setActiveCoverKey(null);
    setIsCoverPickerOpen(false);
    setCoverImageErrors({});
  }, [initialDrafts]);

  const saveBusy = savingKey !== null;
  const controlsDisabled = !canEdit || saveBusy;
  const hasLinksRow =
    linksDocument.links.length > 0 ||
    properties.some((property) => isLinkPropertyKey(property.key));
  const collapsedAttributeCount = gridProperties.length + (hasLinksRow ? 1 : 0);

  const coverImageEntries = useMemo(
    () =>
      (vaultPngAssets && vaultPngAssets.length > 0
        ? vaultPngAssets
        : (vaultFiles ?? [])
            .filter((file) => coverPickerExtensionPattern.test(file.relative_path))
            .map((file) => ({
              path: file.path,
              relative_path: file.relative_path,
              file_name: normalizeRelativePath(file.relative_path).split("/").pop() ?? file.relative_path,
              last_modified: null,
              size_bytes: null,
            })))
        .map((asset) => {
          const relativePath = normalizeRelativePath(asset.relative_path);
          const fileName = asset.file_name?.trim() || relativePath.split("/").pop() || relativePath;
          const src = resolveVaultImageSrc({
            vaultPath,
            absolutePath: asset.path,
            relativePath,
          });
          return {
            path: asset.path,
            relativePath,
            fileName,
            src,
            lastModified: asset.last_modified ?? null,
            sizeBytes: asset.size_bytes ?? null,
          };
        })
        .sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    [vaultFiles, vaultPngAssets, vaultPath],
  );

  const updateSuggestionCache = useCallback((key: string, values: string[]) => {
    if (values.length === 0) {
      return;
    }
    setSuggestionValuesByKey((current) =>
      mergeSuggestionRecords(current, { [key]: values }),
    );
  }, []);

  const updateKeySuggestionCache = useCallback((keys: string[]) => {
    if (keys.length === 0) {
      return;
    }
    setSuggestionKeys((current) => mergeSuggestionKeyLists(current, keys));
  }, []);

  const resolveCoverImageFromTarget = useCallback(
    (target: string | null) => {
      if (!target) {
        return null;
      }
      const candidatePaths = resolveRelativePathCandidates(target, sourceRelativePath);
      if (candidatePaths.length > 0) {
        const exact = coverImageEntries.find((entry) =>
          candidatePaths.some((candidate) => candidate === entry.relativePath)
        );
        if (exact) {
          return exact;
        }
      }

      const targetFileName = normalizeRelativePath(target).split("/").pop()?.toLowerCase() ?? "";
      if (!targetFileName) {
        return null;
      }
      return coverImageEntries.find((entry) => entry.fileName.toLowerCase() === targetFileName) ??
        null;
    },
    [coverImageEntries, sourceRelativePath],
  );

  const focusExistingCoverRow = useCallback(() => {
    const normalizedKey = existingCoverPropertyKey?.trim().toLowerCase();
    if (!normalizedKey) {
      return;
    }
    const coverPanel = frontmatterCoverPanelRef.current;
    if (coverPanel && typeof coverPanel.scrollIntoView === "function") {
      coverPanel.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    setActiveCoverKey(existingCoverPropertyKey);
  }, [existingCoverPropertyKey]);

  const filteredCoverImageEntries = useMemo(
    () => coverImageEntries.filter((entry) => coverPickerExtensionPattern.test(entry.relativePath)),
    [coverImageEntries],
  );

  const activateCoverRow = useCallback(
    (
      key: string,
      options?: {
        openImagePicker?: boolean;
      },
    ) => {
      setActiveCoverKey(key);
      setIsCoverPickerOpen(options?.openImagePicker ?? false);
    },
    [],
  );

  const resolveSuggestionsForKey = useCallback(
    (key: string, rawInput: string) => {
      const source = suggestionValuesByKey[key] ?? [];
      if (source.length === 0) {
        return [];
      }
      const query = rawInput.trim().toLowerCase();
      if (!query) {
        return source;
      }
      return source.filter((value) => value.toLowerCase().includes(query));
    },
    [suggestionValuesByKey],
  );

  const resolveValueSuggestionsForAddKey = useCallback(
    (rawKey: string) => {
      const key = rawKey.trim();
      if (!key) {
        return [];
      }
      if (suggestionValuesByKey[key]) {
        return suggestionValuesByKey[key] ?? [];
      }
      const normalizedKey = key.toLowerCase();
      const resolvedKey = Object.keys(suggestionValuesByKey).find(
        (candidate) => candidate.toLowerCase() === normalizedKey,
      );
      if (!resolvedKey) {
        return [];
      }
      return suggestionValuesByKey[resolvedKey] ?? [];
    },
    [suggestionValuesByKey],
  );

  const resolveAddKeySuggestions = useCallback(
    (rawInput: string) => {
      if (suggestionKeys.length === 0) {
        return [];
      }
      const query = rawInput.trim().toLowerCase();
      return suggestionKeys.filter((key) => {
        const normalized = key.toLowerCase();
        if (existingPropertyKeys.has(normalized)) {
          return false;
        }
        if (addTypeDraft === "text" && isReservedTextSuggestionKey(key)) {
          return false;
        }
        if (hasExistingTaskAttribute && isTaskKeyName(key)) {
          return false;
        }
        if (hasExistingCoverAttribute && isCoverKeyName(key)) {
          return false;
        }
        if (!query) {
          return true;
        }
        return normalized.includes(query);
      });
    },
    [
      addTypeDraft,
      existingPropertyKeys,
      hasExistingCoverAttribute,
      hasExistingTaskAttribute,
      suggestionKeys,
    ],
  );

  const resolveAddValueSuggestions = useCallback(
    ({
      key,
      kind,
      rawInput,
    }: {
      key: string;
      kind: FrontmatterAddPropertyType;
      rawInput: string;
    }) => {
      let rawSource = resolveValueSuggestionsForAddKey(key);
      if (kind === "cover") {
        rawSource = normalizeStableSuggestions([
          ...rawSource,
          ...coverImageEntries.map((entry) => normalizeWikilinkValue(entry.relativePath)),
        ]);
      }
      if (rawSource.length === 0) {
        return [];
      }
      let source = normalizeStableSuggestions(rawSource);
      if (kind === "number") {
        source = sortSuggestionValues(source.filter(isNumericSuggestionValue));
      } else if (kind === "link") {
        source = sortSuggestionValues(
          normalizeStableSuggestions(source.map((value) => normalizeWikilinkValue(value))),
        );
      } else if (kind === "cover") {
        source = sortSuggestionValues(
          normalizeStableSuggestions(
            source
              .map((value) => normalizeWikilinkValue(value))
              .filter((value) => isImageSuggestionValue(value)),
          ),
        );
      } else {
        source = sortSuggestionValues(source);
      }
      if (source.length === 0) {
        return [];
      }
      const query = rawInput.trim().toLowerCase();
      if (!query) {
        return source;
      }
      return source.filter((value) => value.toLowerCase().includes(query));
    },
    [coverImageEntries, resolveValueSuggestionsForAddKey],
  );

  const activateEditor = useCallback((key: string) => {
    setEditorModes((current) => ({
      ...current,
      [key]: current[key] === "editing" || current[key] === "committing" ? current[key] : "active",
    }));
  }, []);

  const beginEditing = useCallback((key: string) => {
    setEditorModes((current) => ({
      ...current,
      [key]: "editing",
    }));
  }, []);

  const activateAddInput = useCallback((field: "type" | "key" | "value") => {
    setAddEditorModes((current) => ({
      ...current,
      [field]:
        current[field] === "editing" || current[field] === "committing"
          ? current[field]
          : "active",
    }));
  }, []);

  const beginAddEditing = useCallback((field: "type" | "key" | "value") => {
    setAddEditorModes((current) => ({
      ...current,
      [field]: "editing",
    }));
  }, []);

  const commitPropertyChange = useCallback(
    async ({
      property,
      kind,
      value,
    }: {
      property: FrontmatterProperty;
      kind: FrontmatterPropertyKind;
      value: string | number | boolean | string[] | null;
    }): Promise<boolean> => {
      if (!onFrontmatterSave || !canEdit || saveBusy) {
        return false;
      }
      const updated = updateFrontmatterProperty({
        markdown: sourceMarkdown,
        key: property.key,
        kind,
        value,
      });
      if (updated.error) {
        setPanelError(updated.error);
        resetDraftsFromProperties();
        return false;
      }

      setPanelError("");
      setSavingKey(property.key);
      let saved = false;
      try {
        saved = await onFrontmatterSave(updated.markdown);
      } catch {
        saved = false;
      } finally {
        setSavingKey(null);
      }
      if (!saved) {
        setPanelError("Eigenschaften konnten nicht gespeichert werden.");
        resetDraftsFromProperties();
        return false;
      }
      updateSuggestionCache(property.key, resolveSuggestionValuesFromCommitted(value));
      return true;
    },
    [
      canEdit,
      onFrontmatterSave,
      resetDraftsFromProperties,
      saveBusy,
      sourceMarkdown,
      updateSuggestionCache,
    ],
  );

  const commitLinksChange = useCallback(
    async (links: string[]) => {
      if (controlsDisabled || !onFrontmatterSave) {
        return false;
      }
      const updated = updateFrontmatterLinks({
        markdown: sourceMarkdown,
        links,
      });
      if (updated.error) {
        setPanelError(updated.error);
        return false;
      }
      setPanelError("");
      setSavingKey("__links__");
      let saved = false;
      try {
        saved = await onFrontmatterSave(updated.markdown);
      } catch {
        saved = false;
      } finally {
        setSavingKey(null);
      }
      if (!saved) {
        setPanelError("Eigenschaften konnten nicht gespeichert werden.");
      }
      return saved;
    },
    [controlsDisabled, onFrontmatterSave, sourceMarkdown],
  );

  const handleAddLink = useCallback(async (rawInput?: string) => {
    if (controlsDisabled) {
      return;
    }
    const normalized = normalizeWikilinkValue(
      rawInput ?? linksInputRef.current?.value ?? linksInputDraft,
    );
    if (!normalized) {
      return;
    }
    if (linksDocument.links.includes(normalized)) {
      setLinksInputDraft("");
      return;
    }
    const saved = await commitLinksChange([...linksDocument.links, normalized]);
    if (saved) {
      setLinksInputDraft("");
    }
  }, [commitLinksChange, controlsDisabled, linksDocument.links, linksInputDraft]);

  const handleRemoveLink = useCallback(
    (link: string) => {
      if (controlsDisabled) {
        return;
      }
      void commitLinksChange(linksDocument.links.filter((item) => item !== link));
    },
    [commitLinksChange, controlsDisabled, linksDocument.links],
  );

  const resolveSuggestionValuesFromAddedDraft = useCallback(
    ({
      kind,
      value,
    }: {
      kind: FrontmatterAddPropertyType;
      value: string;
    }) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return [];
      }
      if (kind === "number") {
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? [String(parsed)] : [];
      }
      if (kind === "link" || kind === "cover") {
        const normalized = normalizeWikilinkValue(trimmed);
        return normalized ? [normalized] : [];
      }
      if (kind === "tags") {
        return normalizeTags(
          value
            .split(/[\n,]/)
            .map((tag) => tag.trim())
            .filter((tag) => tag !== ""),
        );
      }
      return [trimmed];
    },
    [],
  );

  const setAddTypeSelection = useCallback(
    (kind: FrontmatterAddPropertyType) => {
      const autoKey = resolveAutoAddKeyForType(kind);
      setAddTypeDraft(kind);
      setOpenSuggestionsKey(null);
      setAddEditorModes((current) => ({
        ...current,
        type: "active",
        key: autoKey ? "idle" : current.key,
      }));
      if (addError) {
        setAddError("");
      }
      scheduleAnimationFrame(() => {
        if (autoKey) {
          addValueInputRef.current?.focus();
          return;
        }
        addKeyInputRef.current?.focus();
      });
    },
    [addError, scheduleAnimationFrame],
  );

  const handleAddProperty = useCallback(async () => {
    if (controlsDisabled || !onFrontmatterSave) {
      return;
    }
    const autoKey = resolveAutoAddKeyForType(addTypeDraft);
    const keyFromState = (autoKey ?? addKeyDraft).trim();
    const keyFromDom = (autoKey ?? (addKeyInputRef.current?.value ?? "")).trim();
    const nextKey = keyFromState || keyFromDom;
    const nextValue = addValueInputRef.current
      ? addValueInputRef.current.value
      : addValueDraft;
    if (!autoKey && keyFromDom && keyFromDom !== addKeyDraft) {
      setAddKeyDraft(keyFromDom);
    }
    if (nextValue !== addValueDraft) {
      setAddValueDraft(nextValue);
    }
    if (!nextKey) {
      setAddError("Bitte einen Attribut-Namen angeben.");
      return;
    }
    if (nextKey.includes(":")) {
      setAddError("Attribut-Name darf kein ':' enthalten.");
      return;
    }
    if (addTypeDraft === "link") {
      const hasLinks = properties.some((property) => isLinkPropertyKey(property.key));
      if (hasLinks) {
        setAddError("Links existiert bereits.");
        return;
      }
    }
    if (addTypeDraft === "tags") {
      const hasTags = properties.some((property) => property.key.trim().toLowerCase() === "tags");
      if (hasTags) {
        setAddError("Tags existiert bereits.");
        return;
      }
    }
    if (hasExistingTaskAttribute && (addTypeDraft === "task" || isTaskKeyName(nextKey))) {
      setAddError("Task existiert bereits - nur ein Task-Attribut moeglich.");
      return;
    }
    if (hasExistingCoverAttribute && (addTypeDraft === "cover" || isCoverKeyName(nextKey))) {
      setAddError("Cover existiert bereits - nur ein Cover moeglich.");
      focusExistingCoverRow();
      return;
    }

    const duplicate = properties.some((property) => property.key === nextKey);
    if (duplicate) {
      setAddError(`Attribut "${nextKey}" existiert bereits.`);
      return;
    }
    const updated = addFrontmatterProperty({
      markdown: sourceMarkdown,
      key: nextKey,
      value: nextValue,
      kind: addTypeDraft,
    });
    if (updated.error) {
      setAddError(updated.error);
      return;
    }

    setAddError("");
    setPanelError("");
    setSavingKey("__add__");
    let saved = false;
    try {
      saved = await onFrontmatterSave(updated.markdown);
    } catch {
      saved = false;
    } finally {
      setSavingKey(null);
    }
    if (!saved) {
      setPanelError("Eigenschaften konnten nicht gespeichert werden.");
      return;
    }
    updateKeySuggestionCache([nextKey]);
    const normalizedValues = resolveSuggestionValuesFromAddedDraft({
      kind: addTypeDraft,
      value: nextValue,
    });
    if (normalizedValues.length > 0) {
      updateSuggestionCache(nextKey, normalizedValues);
    }
    setAddTypeDraft(FRONTMATTER_DEFAULT_ADD_TYPE);
    setAddKeyDraft("");
    setAddValueDraft("");
    setAddEditorModes({ type: "idle", key: "idle", value: "idle" });
    setOpenSuggestionsKey(null);
    setSuggestionCursor((current) => ({
      ...current,
      [addTypeSuggestionScope]: 0,
      [addKeySuggestionScope]: 0,
      [addValueSuggestionScope]: 0,
    }));
  }, [
    addTypeDraft,
    addKeyDraft,
    addValueDraft,
    controlsDisabled,
    addKeyInputRef,
    addValueInputRef,
    onFrontmatterSave,
    hasExistingCoverAttribute,
    hasExistingTaskAttribute,
    focusExistingCoverRow,
    properties,
    sourceMarkdown,
    updateKeySuggestionCache,
    updateSuggestionCache,
    resolveSuggestionValuesFromAddedDraft,
  ]);

  const resolveDropPosition = useCallback(
    (event: Pick<DragEvent<HTMLDivElement>, "currentTarget" | "clientY">) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      return event.clientY > midpoint ? "after" : "before";
    },
    [],
  );

  const commitReorder = useCallback(
    async ({
      fromKey,
      toKey,
      position,
    }: {
      fromKey: string;
      toKey: string;
      position: "before" | "after";
    }) => {
      if (controlsDisabled || !onFrontmatterSave) {
        return;
      }
      if (fromKey === toKey) {
        return;
      }
      const updated = reorderFrontmatterProperties({
        markdown: sourceMarkdown,
        fromKey,
        toKey,
        position,
      });
      if (updated.error) {
        setPanelError(updated.error);
        return;
      }
      setPanelError("");
      setSavingKey("__reorder__");
      let saved = false;
      try {
        saved = await onFrontmatterSave(updated.markdown);
      } catch {
        saved = false;
      } finally {
        setSavingKey(null);
      }
      if (!saved) {
        setPanelError("Eigenschaften konnten nicht gespeichert werden.");
      }
    },
    [controlsDisabled, onFrontmatterSave, sourceMarkdown],
  );

  const commitRemoveProperty = useCallback(
    async (key: string) => {
      if (controlsDisabled || !onFrontmatterSave) {
        return false;
      }
      const updated = removeFrontmatterProperty({
        markdown: sourceMarkdown,
        key,
      });
      if (updated.error) {
        setPanelError(updated.error);
        return false;
      }
      setPanelError("");
      setSavingKey(key);
      let saved = false;
      try {
        saved = await onFrontmatterSave(updated.markdown);
      } catch {
        saved = false;
      } finally {
        setSavingKey(null);
      }
      if (!saved) {
        setPanelError("Eigenschaften konnten nicht gespeichert werden.");
      }
      return saved;
    },
    [controlsDisabled, onFrontmatterSave, sourceMarkdown],
  );

  const coverPanelKey = coverProperty?.key ?? "Cover";
  const coverCurrentValue =
    coverProperty && typeof coverProperty.value === "string" ? coverProperty.value : "";
  const coverDraftValue = coverProperty ? drafts[coverProperty.key] ?? "" : "";
  const coverPreferredValue = coverDraftValue || coverCurrentValue;
  const coverActiveWikilink = normalizeWikilinkValue(coverPreferredValue);
  const coverTarget =
    extractWikilinkTarget(coverActiveWikilink) ??
    extractVaultAssetRelativePath(coverPreferredValue);
  const coverTargetCandidates = coverTarget
    ? resolveRelativePathCandidates(coverTarget, sourceRelativePath)
    : [];
  const resolvedCoverImage = resolveCoverImageFromTarget(coverTarget);
  const coverImageSrc = resolvedCoverImage
    ? (resolvedCoverImage.src ?? resolvedCoverImage.path)
    : "";
  const coverImageError = resolvedCoverImage
    ? coverImageErrors[resolvedCoverImage.relativePath]
    : undefined;
  const hasCoverImageLoadError = Boolean(
    coverImageError && coverImageError.src === coverImageSrc,
  );
  const hasRenderableCoverImage = Boolean(resolvedCoverImage && !hasCoverImageLoadError);
  const coverDisplayWikilink = coverActiveWikilink ||
    (coverTarget ? normalizeWikilinkValue(coverTarget) : "");
  const coverDisplayName = coverDisplayWikilink || "Kein Cover";
  const coverDisplaySubline = coverDisplayWikilink;
  const isCoverBroken = Boolean(coverTarget) &&
    (!resolvedCoverImage || hasCoverImageLoadError);
  const coverRowError = coverProperty ? rowErrors[coverProperty.key] ?? "" : "";
  const isCoverPanelActive = activeCoverKey === coverPanelKey;
  const isCoverVisible = Boolean(coverProperty);
  const isCoverPanelEmpty = !isCoverVisible;
  const canInteractWithCover = coverInteractive && canEdit;
  const isCoverCompact = !hasRenderableCoverImage;
  const shouldRenderCoverPanel = canInteractWithCover || isCoverVisible || isCoverBroken;
  const coverPickerListId = `frontmatter-cover-picker-${coverPanelKey
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")}`;
  const isCoverPickerListOpen =
    canInteractWithCover &&
    isCoverPanelActive &&
    isCoverPickerOpen &&
    !controlsDisabled;

  useEffect(() => {
    if (canInteractWithCover) {
      return;
    }
    setIsCoverPickerOpen(false);
    setActiveCoverKey(null);
  }, [canInteractWithCover]);

  const commitCoverSelection = useCallback(
    async (nextRawValue: string) => {
      const nextValue = normalizeWikilinkValue(nextRawValue);
      if (!nextValue) {
        return false;
      }
      if (coverProperty) {
        setDrafts((current) => ({
          ...current,
          [coverProperty.key]: nextValue,
        }));
        setRowErrors((current) => ({
          ...current,
          [coverProperty.key]: "",
        }));
        const saved = await commitPropertyChange({
          property: coverProperty,
          kind: "cover",
          value: nextValue,
        });
        if (saved) {
          setIsCoverPickerOpen(false);
        }
        return saved;
      }
      if (controlsDisabled || !onFrontmatterSave) {
        return false;
      }
      const updated = addFrontmatterProperty({
        markdown: sourceMarkdown,
        key: coverPanelKey,
        value: nextValue,
        kind: "cover",
      });
      if (updated.error) {
        setPanelError(updated.error);
        return false;
      }
      setPanelError("");
      setSavingKey("__cover_add__");
      let saved = false;
      try {
        saved = await onFrontmatterSave(updated.markdown);
      } catch {
        saved = false;
      } finally {
        setSavingKey(null);
      }
      if (!saved) {
        setPanelError("Eigenschaften konnten nicht gespeichert werden.");
        return false;
      }
      updateKeySuggestionCache([coverPanelKey]);
      updateSuggestionCache(coverPanelKey, [nextValue]);
      setActiveCoverKey(coverPanelKey);
      setIsCoverPickerOpen(false);
      return true;
    },
    [
      commitPropertyChange,
      controlsDisabled,
      coverPanelKey,
      coverProperty,
      onFrontmatterSave,
      sourceMarkdown,
      updateKeySuggestionCache,
      updateSuggestionCache,
    ],
  );

  const handleRemoveCover = useCallback(() => {
    if (!coverProperty) {
      return;
    }
    void (async () => {
      const removed = await commitRemoveProperty(coverProperty.key);
      if (removed) {
        setIsCoverPickerOpen(false);
        setActiveCoverKey(null);
      }
    })();
  }, [commitRemoveProperty, coverProperty]);

  const addTypeOption = FRONTMATTER_ADD_TYPE_OPTIONS.find(
    (option) => option.kind === addTypeDraft,
  ) ?? addTypeOptions[0]!;
  const autoManagedAddKey = resolveAutoAddKeyForType(addTypeDraft);
  const isAddKeyAutoManaged = autoManagedAddKey !== null;
  const isAddKeyEditing = addEditorModes.key === "editing";
  const isAddValueEditing = addEditorModes.value === "editing";
  const isAddTypeDropdownOpen =
    openSuggestionsKey === addTypeSuggestionScope &&
    addTypeOptions.length > 0 &&
    !controlsDisabled;
  const addKeySuggestions = isAddKeyAutoManaged
    ? []
    : resolveAddKeySuggestions(isAddKeyEditing ? addKeyDraft : "");
  const selectedAddKey = ((autoManagedAddKey ?? addKeyDraft).trim()) ||
    ((autoManagedAddKey ?? (addKeyInputRef.current?.value ?? "")).trim());
  const addValueSuggestions = resolveAddValueSuggestions({
    key: selectedAddKey,
    kind: addTypeDraft,
    rawInput: isAddValueEditing ? addValueDraft : "",
  });
  const isAddValueEnabled = selectedAddKey.length > 0;
  const isAddKeyDropdownOpen =
    openSuggestionsKey === addKeySuggestionScope &&
    addKeySuggestions.length > 0 &&
    !isAddKeyAutoManaged &&
    !controlsDisabled;
  const isAddValueDropdownOpen =
    openSuggestionsKey === addValueSuggestionScope &&
    addValueSuggestions.length > 0 &&
    !controlsDisabled &&
    isAddValueEnabled;
  const addKeySuggestionListId = "frontmatter-add-key-suggestions";
  const addValueSuggestionListId = "frontmatter-add-value-suggestions";
  const addTypeSuggestionListId = "frontmatter-add-type-suggestions";
  const safeAddTypeSuggestionIndex = Math.max(
    0,
    Math.min(
      suggestionCursor[addTypeSuggestionScope] ?? addTypeOptions.findIndex(
        (option) => option.kind === addTypeDraft,
      ),
      Math.max(0, addTypeOptions.length - 1),
    ),
  );
  const safeAddKeySuggestionIndex = Math.max(
    0,
    Math.min(
      suggestionCursor[addKeySuggestionScope] ?? 0,
      Math.max(0, addKeySuggestions.length - 1),
    ),
  );
  const safeAddValueSuggestionIndex = Math.max(
    0,
    Math.min(
      suggestionCursor[addValueSuggestionScope] ?? 0,
      Math.max(0, addValueSuggestions.length - 1),
    ),
  );
  const activeAddKeySuggestion = addKeySuggestions[safeAddKeySuggestionIndex] ?? null;
  const activeAddValueSuggestion =
    addValueSuggestions[safeAddValueSuggestionIndex] ?? null;
  const activeAddTypeSuggestion = addTypeOptions[safeAddTypeSuggestionIndex] ?? null;

  return (
    <>
      {shouldRenderCoverPanel ? (
        <section
          ref={frontmatterCoverPanelRef}
          className={`frontmatter-cover-panel ${
            isCoverVisible ? "has-cover" : "is-empty"
          } ${
            isCoverCompact ? "is-compact" : ""
          } ${
            canInteractWithCover ? "" : "is-readonly"
          }`.trim()}
          aria-label="Cover"
        >
          <div className="frontmatter-cover-panel-stage">
            {canInteractWithCover ? (
              <button
                type="button"
                className={`frontmatter-cover-hero-button ${
                  isCoverPanelEmpty ? "is-empty" : ""
                } ${
                  isCoverCompact ? "is-compact" : ""
                }`.trim()}
                disabled={controlsDisabled}
                aria-label={coverTarget ? "Cover oeffnen" : "Cover auswaehlen"}
                title={
                  hasCoverImageLoadError
                    ? "Bild konnte nicht geladen werden. Klicken zum erneuten Laden."
                    : undefined
                }
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (controlsDisabled) {
                    return;
                  }
                  if ((event.metaKey || event.ctrlKey) && coverActiveWikilink) {
                    onNavigateWikilink?.(coverActiveWikilink);
                    return;
                  }
                  if (resolvedCoverImage && hasCoverImageLoadError) {
                    setCoverImageErrors((current) => {
                      if (!current[resolvedCoverImage.relativePath]) {
                        return current;
                      }
                      const next = { ...current };
                      delete next[resolvedCoverImage.relativePath];
                      return next;
                    });
                  }
                  if (!isCoverPanelActive) {
                    activateCoverRow(coverPanelKey, { openImagePicker: true });
                    return;
                  }
                  setIsCoverPickerOpen((current) => !current);
                }}
              >
                {hasRenderableCoverImage && resolvedCoverImage ? (
                  <CoverThumbnailImage
                    variant="main"
                    image={resolvedCoverImage}
                    alt={coverDisplayName}
                    onLoad={() => {
                      setCoverImageErrors((current) => {
                        if (!current[resolvedCoverImage.relativePath]) {
                          return current;
                        }
                        const next = { ...current };
                        delete next[resolvedCoverImage.relativePath];
                        return next;
                      });
                    }}
                    onError={(event) => {
                      const failedSrc =
                        event.currentTarget.currentSrc ||
                        event.currentTarget.src ||
                        resolvedCoverImage.src ||
                        resolvedCoverImage.path;
                      setCoverImageErrors((current) => ({
                        ...current,
                        [resolvedCoverImage.relativePath]: {
                          src: failedSrc,
                          relativePath: resolvedCoverImage.relativePath,
                          absolutePath: resolvedCoverImage.path,
                        },
                      }));
                    }}
                  />
                ) : !isCoverCompact ? (
                  <span className="frontmatter-cover-placeholder frontmatter-cover-hero-placeholder" aria-hidden="true">
                    <FrontmatterImageIcon />
                  </span>
                ) : null}
              </button>
            ) : (
              <div
                className={`frontmatter-cover-hero-button is-readonly ${
                  isCoverPanelEmpty ? "is-empty" : ""
                } ${
                  isCoverCompact ? "is-compact" : ""
                }`.trim()}
                role="img"
                aria-label={coverDisplayName}
              >
                {hasRenderableCoverImage && resolvedCoverImage ? (
                  <CoverThumbnailImage
                    variant="main"
                    image={resolvedCoverImage}
                    alt={coverDisplayName}
                    onLoad={() => {
                      setCoverImageErrors((current) => {
                        if (!current[resolvedCoverImage.relativePath]) {
                          return current;
                        }
                        const next = { ...current };
                        delete next[resolvedCoverImage.relativePath];
                        return next;
                      });
                    }}
                    onError={(event) => {
                      const failedSrc =
                        event.currentTarget.currentSrc ||
                        event.currentTarget.src ||
                        resolvedCoverImage.src ||
                        resolvedCoverImage.path;
                      setCoverImageErrors((current) => ({
                        ...current,
                        [resolvedCoverImage.relativePath]: {
                          src: failedSrc,
                          relativePath: resolvedCoverImage.relativePath,
                          absolutePath: resolvedCoverImage.path,
                        },
                      }));
                    }}
                  />
                ) : !isCoverCompact ? (
                  <span className="frontmatter-cover-placeholder frontmatter-cover-hero-placeholder" aria-hidden="true">
                    <FrontmatterImageIcon />
                  </span>
                ) : null}
              </div>
            )}
            {canInteractWithCover ? (
              <div className="frontmatter-cover-panel-actions">
                <div className="frontmatter-cover-picker-anchor">
                  <button
                    type="button"
                    className="frontmatter-cover-picker-trigger is-subtle"
                    disabled={controlsDisabled}
                    aria-label="Cover Bild aus Vault waehlen"
                    title="Cover waehlen"
                    aria-haspopup="listbox"
                    aria-expanded={isCoverPickerListOpen}
                    aria-controls={isCoverPickerListOpen ? coverPickerListId : undefined}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (controlsDisabled) {
                        return;
                      }
                      if (!isCoverPanelActive) {
                        activateCoverRow(coverPanelKey, { openImagePicker: true });
                        return;
                      }
                      setIsCoverPickerOpen((current) => !current);
                    }}
                  >
                    <span className="frontmatter-cover-trigger-icon" aria-hidden="true">
                      <FrontmatterImageIcon />
                    </span>
                  </button>
                  {isCoverPickerListOpen ? (
                    <ul
                      id={coverPickerListId}
                      className="frontmatter-cover-picker frontmatter-cover-panel-picker"
                      role="listbox"
                      aria-label="Cover Bildauswahl"
                    >
                      {filteredCoverImageEntries.length === 0 ? (
                        <li className="frontmatter-cover-picker-empty">
                          Keine PNG im aktiven Vault.
                        </li>
                      ) : (
                        filteredCoverImageEntries.map((entry) => {
                          const pickerSrc = entry.src ?? entry.path;
                          const pickerImageError = coverImageErrors[entry.relativePath];
                          const hasPickerImageError = Boolean(
                            pickerImageError && pickerImageError.src === pickerSrc,
                          );
                          return (
                            <li key={`cover-image-${entry.relativePath}`}>
                              <button
                                type="button"
                                className={`frontmatter-cover-picker-option ${
                                  coverTargetCandidates.includes(entry.relativePath)
                                    ? "active"
                                    : ""
                                }`}
                                role="option"
                                aria-selected={coverTargetCandidates.includes(entry.relativePath)}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                onClick={() => {
                                  void commitCoverSelection(entry.relativePath);
                                }}
                              >
                                {hasPickerImageError ? (
                                  <span className="frontmatter-cover-picker-thumb-placeholder" aria-hidden="true">
                                    <FrontmatterImageIcon />
                                  </span>
                                ) : (
                                  <CoverThumbnailImage
                                    variant="picker"
                                    image={entry}
                                    alt={entry.fileName}
                                    onError={(event) => {
                                      const failedSrc =
                                        event.currentTarget.currentSrc ||
                                        event.currentTarget.src ||
                                        entry.src ||
                                        entry.path;
                                      setCoverImageErrors((current) => ({
                                        ...current,
                                        [entry.relativePath]: {
                                          src: failedSrc,
                                          relativePath: entry.relativePath,
                                          absolutePath: entry.path,
                                        },
                                      }));
                                    }}
                                  />
                                )}
                                <span className="frontmatter-cover-picker-copy">
                                  <span title={entry.fileName}>
                                    {entry.fileName}
                                  </span>
                                  <span title={entry.relativePath}>
                                    {entry.relativePath}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  ) : null}
                </div>
                {isCoverVisible ? (
                  <button
                    type="button"
                    className="frontmatter-cover-picker-trigger frontmatter-cover-remove-trigger is-subtle"
                    disabled={controlsDisabled}
                    aria-label="Cover entfernen"
                    title="Cover entfernen"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleRemoveCover();
                    }}
                  >
                    <span className="frontmatter-cover-trigger-icon" aria-hidden="true">
                      ×
                    </span>
                  </button>
                ) : null}
              </div>
            ) : null}
            {!isCoverCompact && coverDisplaySubline && canInteractWithCover ? (
              <div className="frontmatter-cover-panel-copy">
                <span className="frontmatter-cover-name" title={coverDisplayName}>
                  {coverDisplayName}
                </span>
                <span className="frontmatter-cover-target" title={coverDisplaySubline}>
                  {coverDisplaySubline}
                </span>
              </div>
            ) : null}
          </div>
          {isCoverBroken ? (
            <span
              className="frontmatter-row-error"
              title={hasCoverImageLoadError ? "Bild konnte nicht geladen werden." : undefined}
            >
              {hasCoverImageLoadError ? "Bild konnte nicht geladen werden." : "Datei nicht gefunden."}
            </span>
          ) : null}
          {import.meta.env.DEV && hasCoverImageLoadError && coverImageError ? (
            <span className="frontmatter-cover-debug" title={coverImageError.src}>
              src: {coverImageError.src}
            </span>
          ) : null}
          {import.meta.env.DEV && hasCoverImageLoadError && coverImageError ? (
            <span className="frontmatter-cover-debug" title={coverImageError.absolutePath}>
              path: {coverImageError.absolutePath}
            </span>
          ) : null}
          {coverRowError ? <span className="frontmatter-row-error">{coverRowError}</span> : null}
          {!showPropertiesPanel && panelError ? (
            <span className="frontmatter-row-error">{panelError}</span>
          ) : null}
        </section>
      ) : null}
      {showPropertiesPanel ? (
        <section className="frontmatter-panel" aria-label="Eigenschaften">
        <div className="frontmatter-header">
        <button
          type="button"
          className="frontmatter-title-button"
          aria-expanded={!isCollapsed}
          onClick={onToggleCollapsed}
        >
          <h3>Eigenschaften</h3>
        </button>
        <div className="frontmatter-header-actions">
          {saveBusy ? <span className="chip">Speichere...</span> : null}
          <button
            type="button"
            className={`ghost small frontmatter-collapse-button ${isCollapsed ? "collapsed" : ""}`}
            aria-label={isCollapsed ? "Eigenschaften aufklappen" : "Eigenschaften einklappen"}
            aria-expanded={!isCollapsed}
            onClick={onToggleCollapsed}
          >
            <span className="frontmatter-collapse-icon" aria-hidden="true">
              <ChevronDownIcon />
            </span>
          </button>
        </div>
      </div>
      {!isCollapsed ? (
        <>
          <div
            ref={frontmatterGridRef}
            className="frontmatter-grid"
            role="table"
            aria-label="Frontmatter properties"
          >
            {gridProperties.map((property) => {
              const isRowSaving = savingKey === property.key;
              const rowDisabled = controlsDisabled || isRowSaving;
              const tags = Array.isArray(property.value) ? property.value : [];
              const rowError = rowErrors[property.key] ?? "";
              const editorMode = editorModes[property.key] ?? "idle";
              const isEditorEditing = editorMode === "editing";
              const isTaskRow = property.kind === "task" || isTaskKeyName(property.key);
              const suggestions = resolveSuggestionsForKey(
                property.key,
                isTaskRow ? "" : (drafts[property.key] ?? ""),
              );
              const suggestionListId = `frontmatter-suggestions-${property.key
                .toLowerCase()
                .replace(/[^a-z0-9_-]+/g, "-")}`;
              const safeSuggestionIndex = Math.max(
                0,
                Math.min(suggestionCursor[property.key] ?? 0, Math.max(0, suggestions.length - 1)),
              );
              const activeSuggestion = suggestions[safeSuggestionIndex] ?? null;
              const isDropdownOpen = openSuggestionsKey === property.key &&
                suggestions.length > 0 &&
                !rowDisabled &&
                isScalarEditableKind(property.kind);
              const isCoverRow = property.kind === "cover";
              const isCoverRowActive = isCoverRow && activeCoverKey === property.key;
              const taskCommittedValue =
                typeof property.value === "string" ? (property.value.trim() || null) : null;
              const taskDraftValue = (drafts[property.key] ?? "").trim() || null;
              const taskPropertyValue = taskDraftValue ?? taskCommittedValue;
              const taskProfileSummary = isTaskRow && taskPropertyValue
                ? (taskProfileSummariesByName?.[taskPropertyValue.toLowerCase()] ?? null)
                : null;
              const coverCurrentValue = typeof property.value === "string" ? property.value : "";
              const coverDraftValue = drafts[property.key] ?? "";
              const coverPreferredValue = coverDraftValue || coverCurrentValue;
              const coverActiveWikilink = normalizeWikilinkValue(coverPreferredValue);
              const coverTarget =
                extractWikilinkTarget(coverActiveWikilink) ??
                extractVaultAssetRelativePath(coverPreferredValue);
              const coverTargetCandidates = coverTarget
                ? resolveRelativePathCandidates(coverTarget, sourceRelativePath)
                : [];
              const resolvedCoverImage = resolveCoverImageFromTarget(coverTarget);
              const coverImageSrc = resolvedCoverImage
                ? (resolvedCoverImage.src ?? resolvedCoverImage.path)
                : "";
              const coverImageError = resolvedCoverImage
                ? coverImageErrors[resolvedCoverImage.relativePath]
                : undefined;
              const hasCoverImageLoadError = Boolean(
                coverImageError && coverImageError.src === coverImageSrc,
              );
              const coverDisplayWikilink = coverActiveWikilink ||
                (coverTarget ? normalizeWikilinkValue(coverTarget) : "");
              const coverDisplayName = coverDisplayWikilink || "Kein Wert";
              const coverDisplaySubline = coverDisplayWikilink;
              const isCoverBroken = Boolean(coverTarget) &&
                (!resolvedCoverImage || hasCoverImageLoadError);
              const coverPickerListId = `frontmatter-cover-picker-${property.key
                .toLowerCase()
                .replace(/[^a-z0-9_-]+/g, "-")}`;
              const isCoverPickerListOpen = isCoverRowActive && isCoverPickerOpen && !rowDisabled;

              const commitScalarDraft = async (rawInput: string) => {
                if (property.kind === "number") {
                  const value = rawInput.trim();
                  if (!value) {
                    setRowErrors((current) => ({ ...current, [property.key]: "" }));
                    return commitPropertyChange({
                      property,
                      kind: "number",
                      value: null,
                    });
                  }
                  const parsed = Number(value);
                  if (!Number.isFinite(parsed)) {
                    setRowErrors((current) => ({
                      ...current,
                      [property.key]: "Bitte eine gueltige Zahl eingeben.",
                    }));
                    return false;
                  }
                  setRowErrors((current) => ({ ...current, [property.key]: "" }));
                  return commitPropertyChange({
                    property,
                    kind: "number",
                    value: parsed,
                  });
                }
                const nextValue = property.kind === "link" || property.kind === "cover"
                  ? normalizeWikilinkValue(rawInput)
                  : rawInput;
                setDrafts((current) => ({
                  ...current,
                  [property.key]: nextValue,
                }));
                return commitPropertyChange({
                  property,
                  kind: property.kind,
                  value: nextValue.trim() === "" ? null : nextValue,
                });
              };

              const renderScalarInput = () => (
                <div className="frontmatter-input-wrap">
                  <input
                    type="text"
                    inputMode={property.kind === "number" ? "decimal" : undefined}
                    className="text-input frontmatter-input"
                    placeholder="Kein Wert"
                    aria-label={`${property.key} value`}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isDropdownOpen}
                    aria-controls={isDropdownOpen ? suggestionListId : undefined}
                    value={drafts[property.key] ?? ""}
                    readOnly={!isEditorEditing}
                    disabled={rowDisabled}
                    onChange={(event) => {
                      if (!isEditorEditing) {
                        return;
                      }
                      const next = event.target.value;
                      setDrafts((current) => ({ ...current, [property.key]: next }));
                      if (rowErrors[property.key]) {
                        setRowErrors((current) => ({ ...current, [property.key]: "" }));
                      }
                      setOpenSuggestionsKey(property.key);
                      setSuggestionCursor((current) => ({ ...current, [property.key]: 0 }));
                    }}
                    onFocus={() => {
                      if (rowDisabled) {
                        return;
                      }
                      activateEditor(property.key);
                      setOpenSuggestionsKey(property.key);
                      setSuggestionCursor((current) => ({ ...current, [property.key]: 0 }));
                    }}
                    onClick={() => {
                      if (rowDisabled) {
                        return;
                      }
                      activateEditor(property.key);
                      setOpenSuggestionsKey(property.key);
                    }}
                    onDoubleClick={() => {
                      if (rowDisabled) {
                        return;
                      }
                      beginEditing(property.key);
                      setOpenSuggestionsKey(property.key);
                    }}
                    onBlur={(event) => {
                      setOpenSuggestionsKey((current) =>
                        current === property.key ? null : current
                      );
                      const mode = editorModes[property.key] ?? "idle";
                      if (mode !== "editing") {
                        setEditorModes((current) => ({ ...current, [property.key]: "idle" }));
                        setDrafts((current) => ({
                          ...current,
                          [property.key]: stringifyPropertyValue(property),
                        }));
                        return;
                      }
                      const raw = event.currentTarget.value;
                      setEditorModes((current) => ({
                        ...current,
                        [property.key]: "committing",
                      }));
                      void (async () => {
                        const saved = await commitScalarDraft(raw);
                        setEditorModes((current) => ({
                          ...current,
                          [property.key]: saved ? "idle" : "editing",
                        }));
                      })();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "F2") {
                        event.preventDefault();
                        beginEditing(property.key);
                        setOpenSuggestionsKey(property.key);
                        return;
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setOpenSuggestionsKey((current) =>
                          current === property.key ? null : current
                        );
                        setEditorModes((current) => ({ ...current, [property.key]: "idle" }));
                        setDrafts((current) => ({
                          ...current,
                          [property.key]: stringifyPropertyValue(property),
                        }));
                        event.currentTarget.blur();
                        return;
                      }
                      if (isDropdownOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                        event.preventDefault();
                        const offset = event.key === "ArrowDown" ? 1 : -1;
                        setSuggestionCursor((current) => {
                          const existing = current[property.key] ?? 0;
                          const next = (existing + offset + suggestions.length) %
                            suggestions.length;
                          return { ...current, [property.key]: next };
                        });
                        return;
                      }
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (isDropdownOpen && activeSuggestion) {
                          setDrafts((current) => ({
                            ...current,
                            [property.key]: activeSuggestion,
                          }));
                          setOpenSuggestionsKey(null);
                          setEditorModes((current) => ({
                            ...current,
                            [property.key]: "committing",
                          }));
                          void (async () => {
                            const saved = await commitScalarDraft(activeSuggestion);
                            setEditorModes((current) => ({
                              ...current,
                              [property.key]: saved ? "idle" : "editing",
                            }));
                          })();
                          return;
                        }
                        if (!isEditorEditing && suggestions.length > 0) {
                          const firstSuggestion = suggestions[0] ?? "";
                          if (!firstSuggestion) {
                            return;
                          }
                          setDrafts((current) => ({
                            ...current,
                            [property.key]: firstSuggestion,
                          }));
                          setOpenSuggestionsKey(null);
                          setEditorModes((current) => ({
                            ...current,
                            [property.key]: "committing",
                          }));
                          void (async () => {
                            const saved = await commitScalarDraft(firstSuggestion);
                            setEditorModes((current) => ({
                              ...current,
                              [property.key]: saved ? "idle" : "editing",
                            }));
                          })();
                          return;
                        }
                        event.currentTarget.blur();
                        return;
                      }
                      if (event.key === "Tab") {
                        setOpenSuggestionsKey((current) =>
                          current === property.key ? null : current
                        );
                        return;
                      }
                      if (!isEditorEditing) {
                        if (isPrintableCharacterKey(event)) {
                          event.preventDefault();
                          const nextValue = `${drafts[property.key] ?? ""}${event.key}`;
                          setDrafts((current) => ({ ...current, [property.key]: nextValue }));
                          beginEditing(property.key);
                          setOpenSuggestionsKey(property.key);
                          setSuggestionCursor((current) => ({ ...current, [property.key]: 0 }));
                          scheduleAnimationFrame(() => {
                            const input = valueInputRefs.current[property.key];
                            if (!input) {
                              return;
                            }
                            input.focus();
                            input.setSelectionRange(nextValue.length, nextValue.length);
                          });
                          return;
                        }
                        if (event.key === "Backspace" || event.key === "Delete") {
                          event.preventDefault();
                          const currentValue = drafts[property.key] ?? "";
                          const nextValue = event.key === "Backspace"
                            ? currentValue.slice(0, -1)
                            : "";
                          setDrafts((current) => ({ ...current, [property.key]: nextValue }));
                          beginEditing(property.key);
                          setOpenSuggestionsKey(property.key);
                          setSuggestionCursor((current) => ({ ...current, [property.key]: 0 }));
                        }
                      }
                    }}
                    ref={(element) => {
                      valueInputRefs.current[property.key] = element;
                    }}
                  />
                  {isDropdownOpen ? (
                    <ul
                      id={suggestionListId}
                      className="frontmatter-suggestions"
                      role="listbox"
                      aria-label={`${property.key} Vorschlaege`}
                    >
                      {suggestions.map((suggestion, suggestionIndex) => (
                        <li key={`${property.key}-${suggestion}`}>
                          <button
                            type="button"
                            className={`frontmatter-suggestion-option ${
                              suggestionIndex === safeSuggestionIndex ? "active" : ""
                            }`}
                            role="option"
                            aria-selected={suggestionIndex === safeSuggestionIndex}
                            onMouseDown={(event) => {
                              event.preventDefault();
                            }}
                            onClick={() => {
                              setDrafts((current) => ({
                                ...current,
                                [property.key]: suggestion,
                              }));
                              setOpenSuggestionsKey(null);
                              setEditorModes((current) => ({
                                ...current,
                                [property.key]: "committing",
                              }));
                              void (async () => {
                                const saved = await commitScalarDraft(suggestion);
                                setEditorModes((current) => ({
                                  ...current,
                                  [property.key]: saved ? "idle" : "editing",
                                }));
                              })();
                            }}
                          >
                            {suggestion}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {rowError ? <span className="frontmatter-row-error">{rowError}</span> : null}
                </div>
              );

              const renderValueEditor = () => {
                switch (property.kind) {
                  case "boolean":
                    return (
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={property.value === true}
                          disabled={rowDisabled}
                          aria-label={`${property.key} value`}
                          onChange={(event) => {
                            void commitPropertyChange({
                              property,
                              kind: "boolean",
                              value: event.target.checked,
                            });
                          }}
                        />
                        <span className="slider" />
                      </label>
                    );
                  case "tags":
                    return (
                      <div className="frontmatter-tags-editor">
                        {tags.length > 0 ? (
                          <div className="frontmatter-tag-list">
                            {tags.map((tag, tagIndex) => (
                              <span
                                key={`${property.key}-${tag}-${tagIndex}`}
                                className="frontmatter-tag-chip"
                              >
                                <span>{tag}</span>
                                <button
                                  type="button"
                                  className="frontmatter-tag-remove"
                                  onClick={() => {
                                    const nextTags = tags.filter((item) => item !== tag);
                                    void commitPropertyChange({
                                      property,
                                      kind: "tags",
                                      value: nextTags,
                                    });
                                  }}
                                  disabled={rowDisabled}
                                  aria-label={`${tag} entfernen`}
                                >
                                  x
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="frontmatter-empty-value">Kein Wert</span>
                        )}
                        <input
                          type="text"
                          className="text-input frontmatter-input"
                          placeholder="Tag hinzufuegen"
                          aria-label={`${property.key} add tag`}
                          value={tagInputs[property.key] ?? ""}
                          disabled={rowDisabled}
                          onChange={(event) => {
                            const next = event.target.value;
                            setTagInputs((current) => ({ ...current, [property.key]: next }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") {
                              return;
                            }
                            event.preventDefault();
                            const value = (tagInputs[property.key] ?? "").trim();
                            if (!value) {
                              return;
                            }
                            const nextTags = normalizeTags([...tags, value]);
                            setTagInputs((current) => ({ ...current, [property.key]: "" }));
                            void commitPropertyChange({
                              property,
                              kind: "tags",
                              value: nextTags,
                            });
                          }}
                        />
                      </div>
                    );
                  case "cover":
                    return (
                      <div className="frontmatter-cover-editor">
                        <div className="frontmatter-cover-display">
                          <button
                            type="button"
                            className="frontmatter-cover-thumbnail-button"
                            disabled={rowDisabled}
                            aria-label={coverTarget ? "Cover oeffnen" : "Cover auswaehlen"}
                            title={
                              hasCoverImageLoadError
                                ? "Bild konnte nicht geladen werden. Klicken zum erneuten Laden."
                                : undefined
                            }
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (rowDisabled) {
                                return;
                              }
                              if ((event.metaKey || event.ctrlKey) && coverActiveWikilink) {
                                onNavigateWikilink?.(coverActiveWikilink);
                                return;
                              }
                              if (resolvedCoverImage && hasCoverImageLoadError) {
                                setCoverImageErrors((current) => {
                                  if (!current[resolvedCoverImage.relativePath]) {
                                    return current;
                                  }
                                  const next = { ...current };
                                  delete next[resolvedCoverImage.relativePath];
                                  return next;
                                });
                              }
                              if (!isCoverRowActive) {
                                activateCoverRow(property.key, { openImagePicker: true });
                                return;
                              }
                              setIsCoverPickerOpen((current) => !current);
                            }}
                          >
                            {resolvedCoverImage && !hasCoverImageLoadError ? (
                              <CoverThumbnailImage
                                variant="main"
                                image={resolvedCoverImage}
                                alt={coverDisplayName}
                                onLoad={() => {
                                  setCoverImageErrors((current) => {
                                    if (!current[resolvedCoverImage.relativePath]) {
                                      return current;
                                    }
                                    const next = { ...current };
                                    delete next[resolvedCoverImage.relativePath];
                                    return next;
                                  });
                                }}
                                onError={(event) => {
                                  const failedSrc =
                                    event.currentTarget.currentSrc ||
                                    event.currentTarget.src ||
                                    resolvedCoverImage.src ||
                                    resolvedCoverImage.path;
                                  setCoverImageErrors((current) => ({
                                    ...current,
                                    [resolvedCoverImage.relativePath]: {
                                      src: failedSrc,
                                      relativePath: resolvedCoverImage.relativePath,
                                      absolutePath: resolvedCoverImage.path,
                                    },
                                  }));
                                }}
                              />
                            ) : (
                              <span className="frontmatter-cover-placeholder" aria-hidden="true">
                                <FrontmatterImageIcon />
                              </span>
                            )}
                          </button>
                          <div className="frontmatter-cover-copy">
                            <span className="frontmatter-cover-name" title={coverDisplayName}>
                              {coverDisplayName}
                            </span>
                            {coverDisplaySubline ? (
                              <span
                                className="frontmatter-cover-target"
                                title={coverDisplaySubline}
                              >
                                {coverDisplaySubline}
                              </span>
                            ) : (
                              <span className="frontmatter-empty-value">Kein Wert</span>
                            )}
                            {isCoverBroken ? (
                              <span
                                className="frontmatter-row-error"
                                title={hasCoverImageLoadError ? "Bild konnte nicht geladen werden." : undefined}
                              >
                                {hasCoverImageLoadError ? "Bild konnte nicht geladen werden." : "Datei nicht gefunden."}
                              </span>
                            ) : null}
                            {import.meta.env.DEV && hasCoverImageLoadError && coverImageError ? (
                              <span className="frontmatter-cover-debug" title={coverImageError.src}>
                                src: {coverImageError.src}
                              </span>
                            ) : null}
                            {import.meta.env.DEV && hasCoverImageLoadError && coverImageError ? (
                              <span className="frontmatter-cover-debug" title={coverImageError.absolutePath}>
                                path: {coverImageError.absolutePath}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {isCoverRowActive ? (
                          <div className="frontmatter-cover-controls">
                            <div className="frontmatter-cover-control frontmatter-cover-picker-control">
                              {isCoverPickerListOpen ? (
                                <ul
                                  id={coverPickerListId}
                                  className="frontmatter-cover-picker"
                                  role="listbox"
                                  aria-label="Cover Bildauswahl"
                                >
                                  {filteredCoverImageEntries.length === 0 ? (
                                    <li className="frontmatter-cover-picker-empty">
                                      Keine PNG im aktiven Vault.
                                    </li>
                                  ) : (
                                    filteredCoverImageEntries.map((entry) => {
                                      const pickerSrc = entry.src ?? entry.path;
                                      const pickerImageError = coverImageErrors[entry.relativePath];
                                      const hasPickerImageError = Boolean(
                                        pickerImageError && pickerImageError.src === pickerSrc,
                                      );
                                      return (
                                        <li key={`cover-image-${entry.relativePath}`}>
                                          <button
                                            type="button"
                                            className={`frontmatter-cover-picker-option ${
                                              coverTargetCandidates.includes(entry.relativePath)
                                                ? "active"
                                                : ""
                                            }`}
                                            role="option"
                                            aria-selected={coverTargetCandidates.includes(
                                              entry.relativePath,
                                            )}
                                            onMouseDown={(event) => {
                                              event.preventDefault();
                                              event.stopPropagation();
                                            }}
                                            onClick={() => {
                                              const nextValue = normalizeWikilinkValue(
                                                entry.relativePath,
                                              );
                                              setDrafts((current) => ({
                                                ...current,
                                                [property.key]: nextValue,
                                              }));
                                              setRowErrors((current) => ({
                                                ...current,
                                                [property.key]: "",
                                              }));
                                              void (async () => {
                                                const saved = await commitPropertyChange({
                                                  property,
                                                  kind: "cover",
                                                  value: nextValue,
                                                });
                                                if (saved) {
                                                  setIsCoverPickerOpen(false);
                                                }
                                              })();
                                            }}
                                          >
                                            {hasPickerImageError ? (
                                              <span className="frontmatter-cover-picker-thumb-placeholder" aria-hidden="true">
                                                <FrontmatterImageIcon />
                                              </span>
                                            ) : (
                                              <CoverThumbnailImage
                                                variant="picker"
                                                image={entry}
                                                alt={entry.fileName}
                                                onError={(event) => {
                                                  const failedSrc =
                                                    event.currentTarget.currentSrc ||
                                                    event.currentTarget.src ||
                                                    entry.src ||
                                                    entry.path;
                                                  setCoverImageErrors((current) => ({
                                                    ...current,
                                                    [entry.relativePath]: {
                                                      src: failedSrc,
                                                      relativePath: entry.relativePath,
                                                      absolutePath: entry.path,
                                                    },
                                                  }));
                                                }}
                                              />
                                            )}
                                            <span className="frontmatter-cover-picker-copy">
                                              <span title={entry.fileName}>
                                                {entry.fileName}
                                              </span>
                                              <span title={entry.relativePath}>
                                                {entry.relativePath}
                                              </span>
                                            </span>
                                          </button>
                                        </li>
                                      );
                                    })
                                  )}
                                </ul>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        {rowError ? <span className="frontmatter-row-error">{rowError}</span> : null}
                      </div>
                    );
                  case "number":
                  case "link":
                  case "task":
                  case "unknown":
                  case "text":
                  default:
                    return renderScalarInput();
                }
              };

              return (
                <div
                  key={property.key}
                  className={`frontmatter-row ${
                    dragPropertyKey === property.key ? "is-dragging" : ""
                  } ${
                    isTaskRow ? "is-task-row" : ""
                  } ${
                    isCoverRowActive ? "frontmatter-row-cover-active" : ""
                  } ${
                    dropHint?.key === property.key
                      ? dropHint.position === "before"
                        ? "drop-before"
                        : "drop-after"
                      : ""
                  }`.trim()}
                  role="row"
                  data-frontmatter-key={property.key}
                  onClick={() => {
                    if (rowDisabled) {
                      return;
                    }
                    setActiveCoverKey(null);
                    setIsCoverPickerOpen(false);
                  }}
                  onDragOver={(event) => {
                    if (controlsDisabled || !dragPropertyKey) {
                      return;
                    }
                    if (dragPropertyKey === property.key) {
                      setDropHint(null);
                      return;
                    }
                    event.preventDefault();
                    const position = resolveDropPosition(event);
                    setDropHint({
                      key: property.key,
                      position,
                    });
                  }}
                  onDrop={(event) => {
                    if (controlsDisabled || !dragPropertyKey) {
                      return;
                    }
                    event.preventDefault();
                    const position = resolveDropPosition(event);
                    const fromKey = dragPropertyKey;
                    setDragPropertyKey(null);
                    setDropHint(null);
                    void commitReorder({
                      fromKey,
                      toKey: property.key,
                      position,
                    });
                  }}
                >
                  <div
                    className={`frontmatter-key ${controlsDisabled ? "" : "is-drag-handle"}`.trim()}
                    role="cell"
                    draggable={!controlsDisabled}
                    onDragStart={(event) => {
                      if (controlsDisabled) {
                        return;
                      }
                      setDragPropertyKey(property.key);
                      if (event.dataTransfer) {
                        event.dataTransfer.effectAllowed = "move";
                        try {
                          event.dataTransfer.setData("text/plain", property.key);
                        } catch {
                          // ignore dataTransfer limitations in certain runtimes
                        }
                      }
                    }}
                    onDragEnd={() => {
                      setDragPropertyKey(null);
                      setDropHint(null);
                    }}
                  >
                    <span className="frontmatter-grip" aria-hidden="true">
                      <FrontmatterGripIcon />
                    </span>
                    <span className="frontmatter-icon" aria-hidden="true">
                      <FrontmatterPropertyIconView icon={property.icon} />
                    </span>
                    {isTaskRow ? (
                      <button
                        type="button"
                        className="frontmatter-label frontmatter-label-button"
                        disabled={rowDisabled}
                        draggable={false}
                        title="Points Profile Editor oeffnen"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void onOpenTaskProfileEditor?.({
                            taskValue: taskPropertyValue,
                            propertyKey: property.key,
                          });
                        }}
                      >
                        {property.key}
                      </button>
                    ) : (
                      <span className="frontmatter-label">{property.key}</span>
                    )}
                    <button
                      type="button"
                      className="frontmatter-property-remove"
                      disabled={rowDisabled}
                      draggable={false}
                      aria-label={`${property.key} entfernen`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void commitRemoveProperty(property.key);
                      }}
                    >
                      x
                    </button>
                  </div>
                  <div className="frontmatter-value" role="cell">
                    {isTaskRow ? (
                      <div
                        className={`frontmatter-task-meta ${
                          taskProfileSummary ? "" : "is-missing"
                        }`.trim()}
                        aria-label="Task Profil Info"
                      >
                        <span className="frontmatter-task-meta-item">
                          <span className="frontmatter-task-meta-label">TASK COUNT</span>
                          <span className="frontmatter-task-meta-value">
                            {taskProfileSummary ? taskProfileSummary.taskCount : "-"}
                          </span>
                        </span>
                        <span className="frontmatter-task-meta-item">
                          <span className="frontmatter-task-meta-label">MAX TOTAL POINTS</span>
                          <span className="frontmatter-task-meta-value">
                            {taskProfileSummary ? taskProfileSummary.maxTotalPoints : "-"}
                          </span>
                        </span>
                      </div>
                    ) : null}
                    {renderValueEditor()}
                  </div>
                </div>
              );
            })}
            {hasLinksRow ? (
              <div className="frontmatter-row frontmatter-links-row" role="row" data-frontmatter-key="__links__">
                <div className="frontmatter-key" role="cell">
                  <span className="frontmatter-icon" aria-hidden="true">
                    <FrontmatterLinkIcon />
                  </span>
                  <span className="frontmatter-label">Links</span>
                  <button
                    type="button"
                    className="frontmatter-property-remove"
                    disabled={controlsDisabled}
                    draggable={false}
                    aria-label="Links entfernen"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void commitLinksChange([]);
                    }}
                  >
                    x
                  </button>
                </div>
                <div className="frontmatter-value" role="cell">
                  <div className="frontmatter-links-editor">
                    <input
                      ref={linksInputRef}
                      type="text"
                      className="text-input frontmatter-input"
                      placeholder="Link hinzufuegen ..."
                      aria-label="Link hinzufuegen"
                      value={linksInputDraft}
                      disabled={controlsDisabled}
                      onChange={(event) => {
                        setLinksInputDraft(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleAddLink(event.currentTarget.value);
                        }
                      }}
                    />
                    <ul className="frontmatter-links-list">
                      {linksDocument.links.map((link) => (
                        <li key={link} className="frontmatter-links-item">
                          <button
                            type="button"
                            className="frontmatter-inline-link"
                            onClick={() => {
                              onNavigateWikilink?.(link);
                            }}
                            title={extractWikilinkTarget(link) ?? link}
                          >
                            {resolveWikilinkLabel(link)}
                          </button>
                          <button
                            type="button"
                            className="frontmatter-link-remove"
                            disabled={controlsDisabled}
                            onClick={() => {
                              handleRemoveLink(link);
                            }}
                            aria-label={`${link} entfernen`}
                          >
                            x
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="frontmatter-add-row">
            <div className="frontmatter-add-input-wrap frontmatter-add-type-wrap">
              <button
                ref={addTypeButtonRef}
                type="button"
                className="frontmatter-type-select"
                aria-label="Attribut-Typ"
                aria-haspopup="listbox"
                aria-expanded={isAddTypeDropdownOpen}
                aria-controls={isAddTypeDropdownOpen ? addTypeSuggestionListId : undefined}
                disabled={controlsDisabled}
                onFocus={() => {
                  if (controlsDisabled) {
                    return;
                  }
                  activateAddInput("type");
                  setOpenSuggestionsKey(addTypeSuggestionScope);
                  setSuggestionCursor((current) => ({
                    ...current,
                    [addTypeSuggestionScope]: Math.max(
                      0,
                      addTypeOptions.findIndex((option) => option.kind === addTypeDraft),
                    ),
                  }));
                }}
                onClick={() => {
                  if (controlsDisabled) {
                    return;
                  }
                  activateAddInput("type");
                  setOpenSuggestionsKey(addTypeSuggestionScope);
                  setSuggestionCursor((current) => ({
                    ...current,
                    [addTypeSuggestionScope]: Math.max(
                      0,
                      addTypeOptions.findIndex((option) => option.kind === addTypeDraft),
                    ),
                  }));
                }}
                onDoubleClick={() => {
                  if (controlsDisabled) {
                    return;
                  }
                  beginAddEditing("type");
                  setOpenSuggestionsKey(addTypeSuggestionScope);
                }}
                onBlur={() => {
                  setOpenSuggestionsKey((current) =>
                    current === addTypeSuggestionScope ? null : current
                  );
                  setAddEditorModes((current) => ({
                    ...current,
                    type: "idle",
                  }));
                }}
                onKeyDown={(event) => {
                  if (event.key === "F2") {
                    event.preventDefault();
                    beginAddEditing("type");
                    setOpenSuggestionsKey(addTypeSuggestionScope);
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpenSuggestionsKey((current) =>
                      current === addTypeSuggestionScope ? null : current
                    );
                    setAddEditorModes((current) => ({
                      ...current,
                      type: "idle",
                    }));
                    return;
                  }
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    if (!isAddTypeDropdownOpen) {
                      setOpenSuggestionsKey(addTypeSuggestionScope);
                      setSuggestionCursor((current) => ({
                        ...current,
                        [addTypeSuggestionScope]: Math.max(
                          0,
                          addTypeOptions.findIndex((option) => option.kind === addTypeDraft),
                        ),
                      }));
                      return;
                    }
                    const offset = event.key === "ArrowDown" ? 1 : -1;
                    setSuggestionCursor((current) => {
                      const existing = current[addTypeSuggestionScope] ?? 0;
                      const next =
                        (existing + offset + addTypeOptions.length) %
                        addTypeOptions.length;
                      return { ...current, [addTypeSuggestionScope]: next };
                    });
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (isAddTypeDropdownOpen && activeAddTypeSuggestion) {
                      setAddTypeSelection(activeAddTypeSuggestion.kind);
                      return;
                    }
                    setOpenSuggestionsKey(addTypeSuggestionScope);
                    return;
                  }
                  if (event.key === "Tab") {
                    setOpenSuggestionsKey((current) =>
                      current === addTypeSuggestionScope ? null : current
                    );
                  }
                }}
              >
                <span className="frontmatter-type-select-icon" aria-hidden="true">
                  <FrontmatterPropertyIconView icon={addTypeOption.icon} />
                </span>
                <span className="frontmatter-type-select-label">{addTypeOption.label}</span>
                <span className="frontmatter-type-select-chevron" aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              </button>
              {isAddTypeDropdownOpen ? (
                <ul
                  id={addTypeSuggestionListId}
                  className="frontmatter-suggestions frontmatter-type-suggestions"
                  role="listbox"
                  aria-label="Attribut-Typ Vorschlaege"
                >
                  {addTypeOptions.map((option, optionIndex) => (
                    <li key={`add-type-${option.kind}`}>
                      <button
                        type="button"
                        className={`frontmatter-suggestion-option frontmatter-type-option ${
                          optionIndex === safeAddTypeSuggestionIndex ? "active" : ""
                        }`}
                        role="option"
                        aria-selected={optionIndex === safeAddTypeSuggestionIndex}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={() => {
                          setAddTypeSelection(option.kind);
                        }}
                      >
                        <span className="frontmatter-type-option-icon" aria-hidden="true">
                          <FrontmatterPropertyIconView icon={option.icon} />
                        </span>
                        <span className="frontmatter-type-option-copy">
                          <span className="frontmatter-type-option-label">{option.label}</span>
                          <span className="frontmatter-type-option-description">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="frontmatter-add-input-wrap">
              <input
                ref={addKeyInputRef}
                type="text"
                className="text-input frontmatter-add-key"
                placeholder={isAddKeyAutoManaged ? "Automatischer Name" : "Neues Attribut"}
                aria-label="Neues Attribut"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isAddKeyDropdownOpen}
                aria-controls={isAddKeyDropdownOpen ? addKeySuggestionListId : undefined}
                value={autoManagedAddKey ?? addKeyDraft}
                readOnly={isAddKeyAutoManaged || !isAddKeyEditing}
                disabled={controlsDisabled}
                onInput={(event) => {
                  if (isAddKeyAutoManaged) {
                    return;
                  }
                  setAddKeyDraft(event.currentTarget.value);
                  if (addError) {
                    setAddError("");
                  }
                  setOpenSuggestionsKey(addKeySuggestionScope);
                  setSuggestionCursor((current) => ({
                    ...current,
                    [addKeySuggestionScope]: 0,
                  }));
                }}
                onFocus={() => {
                  if (controlsDisabled) {
                    return;
                  }
                  if (isAddKeyAutoManaged) {
                    setOpenSuggestionsKey((current) =>
                      current === addKeySuggestionScope ? null : current
                    );
                    setAddEditorModes((current) => ({
                      ...current,
                      key: "idle",
                    }));
                    return;
                  }
                  activateAddInput("key");
                  setOpenSuggestionsKey(addKeySuggestionScope);
                  setSuggestionCursor((current) => ({
                    ...current,
                    [addKeySuggestionScope]: 0,
                  }));
                }}
                onClick={() => {
                  if (controlsDisabled) {
                    return;
                  }
                  if (isAddKeyAutoManaged) {
                    setOpenSuggestionsKey((current) =>
                      current === addKeySuggestionScope ? null : current
                    );
                    scheduleAnimationFrame(() => {
                      addValueInputRef.current?.focus();
                    });
                    return;
                  }
                  activateAddInput("key");
                  setOpenSuggestionsKey(addKeySuggestionScope);
                }}
                onDoubleClick={() => {
                  if (controlsDisabled || isAddKeyAutoManaged) {
                    return;
                  }
                  beginAddEditing("key");
                  setOpenSuggestionsKey(addKeySuggestionScope);
                }}
                onBlur={(event) => {
                  if (!isAddKeyAutoManaged) {
                    setAddKeyDraft(event.currentTarget.value);
                  }
                  setOpenSuggestionsKey((current) =>
                    current === addKeySuggestionScope ? null : current
                  );
                  setAddEditorModes((current) => ({
                    ...current,
                    key: "idle",
                  }));
                }}
                onKeyDown={(event) => {
                  if (isAddKeyAutoManaged) {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      scheduleAnimationFrame(() => {
                        addValueInputRef.current?.focus();
                      });
                      return;
                    }
                    if (event.key === "Tab") {
                      setOpenSuggestionsKey((current) =>
                        current === addKeySuggestionScope ? null : current
                      );
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setOpenSuggestionsKey((current) =>
                        current === addKeySuggestionScope ? null : current
                      );
                      event.currentTarget.blur();
                      return;
                    }
                    if (isPrintableCharacterKey(event) || event.key === "Backspace" || event.key === "Delete") {
                      event.preventDefault();
                    }
                    return;
                  }
                  if (event.key === "F2") {
                    event.preventDefault();
                    beginAddEditing("key");
                    setOpenSuggestionsKey(addKeySuggestionScope);
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpenSuggestionsKey((current) =>
                      current === addKeySuggestionScope ? null : current
                    );
                    setAddEditorModes((current) => ({
                      ...current,
                      key: "idle",
                    }));
                    event.currentTarget.blur();
                    return;
                  }
                  if (
                    isAddKeyDropdownOpen &&
                    (event.key === "ArrowDown" || event.key === "ArrowUp")
                  ) {
                    event.preventDefault();
                    const offset = event.key === "ArrowDown" ? 1 : -1;
                    setSuggestionCursor((current) => {
                      const existing = current[addKeySuggestionScope] ?? 0;
                      const next =
                        (existing + offset + addKeySuggestions.length) %
                        addKeySuggestions.length;
                      return { ...current, [addKeySuggestionScope]: next };
                    });
                    return;
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (isAddKeyDropdownOpen && activeAddKeySuggestion) {
                      setAddKeyDraft(activeAddKeySuggestion);
                      setOpenSuggestionsKey(null);
                      setAddEditorModes((current) => ({
                        ...current,
                        key: "active",
                      }));
                      if (addError) {
                        setAddError("");
                      }
                      scheduleAnimationFrame(() => {
                        addValueInputRef.current?.focus();
                      });
                      return;
                    }
                    scheduleAnimationFrame(() => {
                      addValueInputRef.current?.focus();
                    });
                    return;
                  }
                  if (event.key === "Tab") {
                    setOpenSuggestionsKey((current) =>
                      current === addKeySuggestionScope ? null : current
                    );
                    return;
                  }
                  if (!isAddKeyEditing) {
                    if (isPrintableCharacterKey(event)) {
                      event.preventDefault();
                      const nextValue = `${addKeyDraft}${event.key}`;
                      setAddKeyDraft(nextValue);
                      beginAddEditing("key");
                      setOpenSuggestionsKey(addKeySuggestionScope);
                      setSuggestionCursor((current) => ({
                        ...current,
                        [addKeySuggestionScope]: 0,
                      }));
                      if (addError) {
                        setAddError("");
                      }
                      scheduleAnimationFrame(() => {
                        const input = addKeyInputRef.current;
                        if (!input) {
                          return;
                        }
                        input.focus();
                        input.setSelectionRange(nextValue.length, nextValue.length);
                      });
                      return;
                    }
                    if (event.key === "Backspace" || event.key === "Delete") {
                      event.preventDefault();
                      const nextValue =
                        event.key === "Backspace" ? addKeyDraft.slice(0, -1) : "";
                      setAddKeyDraft(nextValue);
                      beginAddEditing("key");
                      setOpenSuggestionsKey(addKeySuggestionScope);
                      setSuggestionCursor((current) => ({
                        ...current,
                        [addKeySuggestionScope]: 0,
                      }));
                      if (addError) {
                        setAddError("");
                      }
                    }
                  }
                }}
              />
              {isAddKeyDropdownOpen ? (
                <ul
                  id={addKeySuggestionListId}
                  className="frontmatter-suggestions"
                  role="listbox"
                  aria-label="Attribut Vorschlaege"
                >
                  {addKeySuggestions.map((suggestion, suggestionIndex) => (
                    <li key={`add-key-${suggestion}`}>
                      <button
                        type="button"
                        className={`frontmatter-suggestion-option ${
                          suggestionIndex === safeAddKeySuggestionIndex ? "active" : ""
                        }`}
                        role="option"
                        aria-selected={suggestionIndex === safeAddKeySuggestionIndex}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={() => {
                          setAddKeyDraft(suggestion);
                          setOpenSuggestionsKey(null);
                          setAddEditorModes((current) => ({
                            ...current,
                            key: "active",
                          }));
                          if (addError) {
                            setAddError("");
                          }
                          scheduleAnimationFrame(() => {
                            addValueInputRef.current?.focus();
                          });
                        }}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="frontmatter-add-input-wrap">
              <input
                ref={addValueInputRef}
                type="text"
                className="text-input frontmatter-add-value"
                placeholder={addTypeDraft === "cover" ? "Bild aus Vault waehlen ..." : "Wert (optional)"}
                aria-label="Neuer Wert"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isAddValueDropdownOpen}
                aria-controls={isAddValueDropdownOpen ? addValueSuggestionListId : undefined}
                value={addValueDraft}
                readOnly={!isAddValueEditing}
                disabled={controlsDisabled}
                onInput={(event) => {
                  setAddValueDraft(event.currentTarget.value);
                  setOpenSuggestionsKey(addValueSuggestionScope);
                  setSuggestionCursor((current) => ({
                    ...current,
                    [addValueSuggestionScope]: 0,
                  }));
                }}
                onFocus={() => {
                  if (controlsDisabled || !isAddValueEnabled) {
                    return;
                  }
                  activateAddInput("value");
                  setOpenSuggestionsKey(addValueSuggestionScope);
                  setSuggestionCursor((current) => ({
                    ...current,
                    [addValueSuggestionScope]: 0,
                  }));
                }}
                onClick={() => {
                  if (controlsDisabled || !isAddValueEnabled) {
                    return;
                  }
                  activateAddInput("value");
                  setOpenSuggestionsKey(addValueSuggestionScope);
                }}
                onDoubleClick={() => {
                  if (controlsDisabled || !isAddValueEnabled) {
                    return;
                  }
                  beginAddEditing("value");
                  setOpenSuggestionsKey(addValueSuggestionScope);
                }}
                onBlur={(event) => {
                  setAddValueDraft(event.currentTarget.value);
                  setOpenSuggestionsKey((current) =>
                    current === addValueSuggestionScope ? null : current
                  );
                  setAddEditorModes((current) => ({
                    ...current,
                    value: "idle",
                  }));
                }}
                onKeyDown={(event) => {
                  if (event.key === "F2" && isAddValueEnabled) {
                    event.preventDefault();
                    beginAddEditing("value");
                    setOpenSuggestionsKey(addValueSuggestionScope);
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpenSuggestionsKey((current) =>
                      current === addValueSuggestionScope ? null : current
                    );
                    setAddEditorModes((current) => ({
                      ...current,
                      value: "idle",
                    }));
                    event.currentTarget.blur();
                    return;
                  }
                  if (
                    isAddValueDropdownOpen &&
                    (event.key === "ArrowDown" || event.key === "ArrowUp")
                  ) {
                    event.preventDefault();
                    const offset = event.key === "ArrowDown" ? 1 : -1;
                    setSuggestionCursor((current) => {
                      const existing = current[addValueSuggestionScope] ?? 0;
                      const next =
                        (existing + offset + addValueSuggestions.length) %
                        addValueSuggestions.length;
                      return { ...current, [addValueSuggestionScope]: next };
                    });
                    return;
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (isAddValueDropdownOpen && activeAddValueSuggestion) {
                      setAddValueDraft(activeAddValueSuggestion);
                      setOpenSuggestionsKey(null);
                      setAddEditorModes((current) => ({
                        ...current,
                        value: "active",
                      }));
                      return;
                    }
                    void handleAddProperty();
                    return;
                  }
                  if (event.key === "Tab") {
                    setOpenSuggestionsKey((current) =>
                      current === addValueSuggestionScope ? null : current
                    );
                    return;
                  }
                  if (!isAddValueEnabled) {
                    return;
                  }
                  if (!isAddValueEditing) {
                    if (isPrintableCharacterKey(event)) {
                      event.preventDefault();
                      const nextValue = `${addValueDraft}${event.key}`;
                      setAddValueDraft(nextValue);
                      beginAddEditing("value");
                      setOpenSuggestionsKey(addValueSuggestionScope);
                      setSuggestionCursor((current) => ({
                        ...current,
                        [addValueSuggestionScope]: 0,
                      }));
                      scheduleAnimationFrame(() => {
                        const input = addValueInputRef.current;
                        if (!input) {
                          return;
                        }
                        input.focus();
                        input.setSelectionRange(nextValue.length, nextValue.length);
                      });
                      return;
                    }
                    if (event.key === "Backspace" || event.key === "Delete") {
                      event.preventDefault();
                      const nextValue =
                        event.key === "Backspace" ? addValueDraft.slice(0, -1) : "";
                      setAddValueDraft(nextValue);
                      beginAddEditing("value");
                      setOpenSuggestionsKey(addValueSuggestionScope);
                      setSuggestionCursor((current) => ({
                        ...current,
                        [addValueSuggestionScope]: 0,
                      }));
                    }
                  }
                }}
              />
              {isAddValueDropdownOpen ? (
                <ul
                  id={addValueSuggestionListId}
                  className={`frontmatter-suggestions ${
                    addTypeDraft === "cover" ? "frontmatter-add-cover-suggestions" : ""
                  }`.trim()}
                  role="listbox"
                  aria-label="Wert Vorschlaege"
                >
                  {addValueSuggestions.map((suggestion, suggestionIndex) => (
                    <li key={`add-value-${selectedAddKey}-${suggestion}`}>
                      {addTypeDraft === "cover" ? (
                        (() => {
                          const suggestionTarget = extractWikilinkTarget(suggestion);
                          const suggestionImage = resolveCoverImageFromTarget(suggestionTarget);
                          const suggestionImageSrc = suggestionImage
                            ? (suggestionImage.src ?? suggestionImage.path)
                            : "";
                          const suggestionImageError = suggestionImage
                            ? coverImageErrors[suggestionImage.relativePath]
                            : undefined;
                          const hasSuggestionImageError = Boolean(
                            suggestionImageError && suggestionImageError.src === suggestionImageSrc,
                          );
                          return (
                            <button
                              type="button"
                              className={`frontmatter-suggestion-option frontmatter-add-cover-option ${
                                suggestionIndex === safeAddValueSuggestionIndex ? "active" : ""
                              }`}
                              role="option"
                              aria-selected={suggestionIndex === safeAddValueSuggestionIndex}
                              onMouseDown={(event) => {
                                event.preventDefault();
                              }}
                              onClick={() => {
                                setAddValueDraft(suggestion);
                                setOpenSuggestionsKey(null);
                                setAddEditorModes((current) => ({
                                  ...current,
                                  value: "active",
                                }));
                              }}
                            >
                              {suggestionImage && !hasSuggestionImageError ? (
                                <CoverThumbnailImage
                                  variant="add"
                                  image={suggestionImage}
                                  alt={suggestionImage.fileName}
                                  onError={(event) => {
                                    const failedSrc =
                                      event.currentTarget.currentSrc ||
                                      event.currentTarget.src ||
                                      suggestionImage.src ||
                                      suggestionImage.path;
                                    setCoverImageErrors((current) => ({
                                      ...current,
                                      [suggestionImage.relativePath]: {
                                        src: failedSrc,
                                        relativePath: suggestionImage.relativePath,
                                        absolutePath: suggestionImage.path,
                                      },
                                    }));
                                  }}
                                />
                              ) : (
                                <span className="frontmatter-add-cover-thumb-placeholder" aria-hidden="true">
                                  <FrontmatterImageIcon />
                                </span>
                              )}
                              <span className="frontmatter-add-cover-copy">
                                <span title={suggestionImage?.fileName ?? resolveWikilinkLabel(suggestion)}>
                                  {suggestionImage?.fileName ?? resolveWikilinkLabel(suggestion)}
                                </span>
                                <span title={suggestionTarget ?? suggestion}>
                                  {suggestionTarget ?? suggestion}
                                </span>
                              </span>
                            </button>
                          );
                        })()
                      ) : (
                        <button
                          type="button"
                          className={`frontmatter-suggestion-option ${
                            suggestionIndex === safeAddValueSuggestionIndex ? "active" : ""
                          }`}
                          role="option"
                          aria-selected={suggestionIndex === safeAddValueSuggestionIndex}
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          onClick={() => {
                            setAddValueDraft(suggestion);
                            setOpenSuggestionsKey(null);
                            setAddEditorModes((current) => ({
                              ...current,
                              value: "active",
                            }));
                          }}
                        >
                          {suggestion}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button
              type="button"
              className="ghost small frontmatter-add-button"
              onClick={() => {
                void handleAddProperty();
              }}
              disabled={controlsDisabled}
            >
              Attribut +
            </button>
          </div>
          {addError ? <div className="frontmatter-row-error">{addError}</div> : null}
        </>
      ) : (
        <p className="frontmatter-collapsed-hint">
          {collapsedAttributeCount} Attribute
        </p>
      )}
      {panelError ? <div className="error frontmatter-error">{panelError}</div> : null}
        </section>
      ) : null}
    </>
  );
};

export const PreviewPanel = ({
  editDraft,
  editError,
  editCaretIndex,
  isEditing,
  emptyPreview,
  preview,
  previewError,
  previewState,
  editorMode,
  editEnabled,
  documentMode = "edit",
  selectedFile,
  vaultFiles,
  vaultPngAssets,
  vaultPath,
  sourceRelativePath,
  canEdit,
  markdownEditorStyle,
  onEditChange,
  onHybridDirtyChange,
  onEditCaretApplied,
  onEditExit,
  onEditStart,
  onSelectEditorMode,
  onToggleEditEnabled,
  onWriteSave,
  onWriteCancel,
  onFrontmatterSave,
  onNavigateWikilink,
  onOpenTaskProfileEditor,
  taskProfileSummariesByName,
  valueSuggestionsByKey,
  keySuggestions,
  markdownTabs = [],
  activeMarkdownTabPath = null,
  onSelectMarkdownTab,
  onCloseMarkdownTab,
  onReorderMarkdownTabs,
}: PreviewPanelProps) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const markdownViewRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const markdownEditorScrollRef = useRef<HTMLDivElement | null>(null);
  const markdownEditorRef = useRef<HTMLDivElement | null>(null);
  const markdownTabStripRef = useRef<HTMLDivElement | null>(null);
  const hybridEditorRef = useRef<MarkdownHybridEditorHandle | null>(null);
  const markdownEditorHtmlRef = useRef<string | null>(null);
  const markdownEditorReadyRef = useRef(false);
  const applyingMarkdownCaretRef = useRef(false);
  const suppressRawEditorBlurExitRef = useRef(false);
  const rawCodeToggleClosePendingRef = useRef(false);
  const scrollStateRef = useRef({ top: 0, left: 0 });
  const lastCaretIndexRef = useRef<number | null>(null);
  const editableHighlightQueuedCodesRef = useRef<Set<HTMLElement>>(new Set());
  const editableHighlightQueueAllRef = useRef(false);
  const editableHighlightDebounceHandleRef = useRef(0);
  const editableHighlightCancelIdleRef = useRef<(() => void) | null>(null);
  const editableHighlightRunningRef = useRef(false);
  const onWriteSaveRef = useRef(onWriteSave);
  const [showFrontmatterTextFallback, setShowFrontmatterTextFallback] = useState(false);
  const [userFrontmatterCollapsed, setUserFrontmatterCollapsed] = useState<boolean | null>(
    null,
  );
  const [markdownTabStripWidth, setMarkdownTabStripWidth] = useState(0);
  const [activeMarkdownTabFolderLabel, setActiveMarkdownTabFolderLabel] = useState<string | null>(
    null,
  );
  const [dragMarkdownTabPath, setDragMarkdownTabPath] = useState<string | null>(null);
  const [markdownTabDropHint, setMarkdownTabDropHint] = useState<{
    path: string;
    position: "before" | "after";
  } | null>(null);
  const markdownTabDragPreviewRef = useRef<HTMLElement | null>(null);
  const isNarrowFrontmatterViewport = useMediaQuery(SMART_QUERY, false);
  const effectiveFrontmatterPanelCollapsed =
    userFrontmatterCollapsed ?? isNarrowFrontmatterViewport;
  onWriteSaveRef.current = onWriteSave;

  const previewFrontmatter = useMemo(
    () => parseFrontmatterDocument(preview),
    [preview],
  );
  const editFrontmatter = useMemo(() => parseFrontmatterDocument(editDraft), [editDraft]);
  const markdownPreviewBody = previewFrontmatter.hasFrontmatter
    ? previewFrontmatter.body
    : preview;
  const markdownEditBody = editFrontmatter.hasFrontmatter
    ? editFrontmatter.body
    : editDraft;
  const markdownEditBodyStartOffset = editFrontmatter.hasFrontmatter
    ? editFrontmatter.bodyStartOffset
    : 0;
  const hasFrontmatterError = previewFrontmatter.hasFrontmatter &&
    Boolean(previewFrontmatter.error);
  const isCodeMode = editorMode === "code";
  const isMarkdownMode = editorMode === "markdown";
  const isHybridMode = editorMode === "hybrid";
  const resolvedEditEnabled = documentMode === "write"
    ? true
    : (isHybridMode ? true : editEnabled);

  useEffect(() => {
    setShowFrontmatterTextFallback(false);
  }, [preview]);

  useLayoutEffect(() => {
    if (markdownTabs.length === 0) {
      setMarkdownTabStripWidth(0);
      return;
    }
    const element = markdownTabStripRef.current;
    if (!element) {
      return;
    }

    let frame = 0;
    const measure = () => {
      const nextWidth = element.clientWidth;
      setMarkdownTabStripWidth((current) => (current === nextWidth ? current : nextWidth));
    };
    const scheduleMeasure = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", scheduleMeasure);
      return () => {
        if (frame) {
          window.cancelAnimationFrame(frame);
        }
        window.removeEventListener("resize", scheduleMeasure);
      };
    }

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(element);
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      observer.disconnect();
    };
  }, [markdownTabs.length]);

  const captureScroll = useCallback((element: HTMLElement | null) => {
    if (!element) {
      return;
    }
    scrollStateRef.current.top = element.scrollTop;
    scrollStateRef.current.left = element.scrollLeft;
  }, []);

  const restoreScroll = useCallback((element: HTMLElement | null) => {
    if (!element) {
      return;
    }
    element.scrollTop = scrollStateRef.current.top;
    element.scrollLeft = scrollStateRef.current.left;
  }, []);

  const clearEditableHighlightDebounce = useCallback(() => {
    if (!editableHighlightDebounceHandleRef.current) {
      return;
    }
    window.clearTimeout(editableHighlightDebounceHandleRef.current);
    editableHighlightDebounceHandleRef.current = 0;
  }, []);

  const cancelEditableHighlightIdle = useCallback(() => {
    if (!editableHighlightCancelIdleRef.current) {
      return;
    }
    editableHighlightCancelIdleRef.current();
    editableHighlightCancelIdleRef.current = null;
  }, []);

  const resolveEditableCodeElementNearSelection = useCallback(
    (target: EventTarget | null) => {
      const editor = markdownEditorRef.current;
      if (!editor) {
        return null;
      }

      const sourceElement = resolveEventElement(target);
      const fromTarget = sourceElement
        ?.closest('pre[data-md-code-block="true"]')
        ?.querySelector<HTMLElement>("code");
      if (fromTarget && editor.contains(fromTarget)) {
        return fromTarget;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !selection.anchorNode) {
        return null;
      }
      if (!editor.contains(selection.anchorNode)) {
        return null;
      }

      const anchorElement = selection.anchorNode instanceof Element
        ? selection.anchorNode
        : selection.anchorNode.parentElement;
      const fromSelection = anchorElement
        ?.closest('pre[data-md-code-block="true"]')
        ?.querySelector<HTMLElement>("code");
      return fromSelection && editor.contains(fromSelection)
        ? fromSelection
        : null;
    },
    [],
  );

  const flushEditableCodeHighlights = useCallback(async () => {
    if (!MARKDOWN_CODE_HIGHLIGHT_CONFIG.highlightInContentEditable) {
      return;
    }
    if (editableHighlightRunningRef.current) {
      return;
    }

    const editor = markdownEditorRef.current;
    if (!editor) {
      editableHighlightQueueAllRef.current = false;
      editableHighlightQueuedCodesRef.current.clear();
      return;
    }

    editableHighlightRunningRef.current = true;
    try {
      const queuedAll = editableHighlightQueueAllRef.current;
      const queuedCodes = Array.from(editableHighlightQueuedCodesRef.current).filter(
        (codeElement) => editor.contains(codeElement),
      );
      editableHighlightQueueAllRef.current = false;
      editableHighlightQueuedCodesRef.current.clear();

      const codeElements = queuedAll
        ? Array.from(
            editor.querySelectorAll<HTMLElement>('pre[data-md-code-block="true"] > code'),
          )
        : queuedCodes;

      for (const codeElement of codeElements) {
        const preElementRaw = codeElement.closest('pre[data-md-code-block="true"]');
        const preElement = preElementRaw instanceof HTMLElement ? preElementRaw : null;
        const selectionOffsets = getSelectionOffsetsWithinContainer(codeElement);
        const plainCode = codeElement.textContent ?? "";
        codeElement.textContent = plainCode;

        try {
          await applyHighlightToCodeElement({
            codeElement,
            preElement,
            autoDetectWithoutLanguage: MARKDOWN_CODE_HIGHLIGHT_CONFIG.autoDetectWithoutLanguage,
            autoDetectCandidateLanguages:
              MARKDOWN_CODE_HIGHLIGHT_CONFIG.autoDetectCandidateLanguages,
          });
          if (!MARKDOWN_CODE_HIGHLIGHT_CONFIG.showLanguageLabel) {
            delete codeElement.dataset.mdCodeLanguageLabel;
            if (preElement) {
              delete preElement.dataset.mdCodeLanguageLabel;
            }
          }
        } catch {
          codeElement.textContent = plainCode;
        }

        if (selectionOffsets) {
          setSelectionAtPlainOffsets(codeElement, selectionOffsets.start, selectionOffsets.end);
        }
      }
    } finally {
      editableHighlightRunningRef.current = false;
      if (
        editableHighlightQueueAllRef.current ||
        editableHighlightQueuedCodesRef.current.size > 0
      ) {
        cancelEditableHighlightIdle();
        editableHighlightCancelIdleRef.current = scheduleIdleTask(
          () => {
            editableHighlightCancelIdleRef.current = null;
            void flushEditableCodeHighlights();
          },
          MARKDOWN_EDITABLE_REHIGHLIGHT_IDLE_TIMEOUT_MS,
        );
      }
    }
  }, [cancelEditableHighlightIdle]);

  const queueEditableCodeRehighlight = useCallback(
    (options?: { all?: boolean; codeElement?: HTMLElement | null; immediate?: boolean }) => {
      if (!MARKDOWN_CODE_HIGHLIGHT_CONFIG.highlightInContentEditable) {
        return;
      }
      const editor = markdownEditorRef.current;
      if (!editor) {
        return;
      }

      if (options?.all) {
        editableHighlightQueueAllRef.current = true;
      }

      if (options?.codeElement && editor.contains(options.codeElement)) {
        editableHighlightQueuedCodesRef.current.add(options.codeElement);
      } else if (!options?.all) {
        const activeCode = resolveEditableCodeElementNearSelection(null);
        if (activeCode) {
          editableHighlightQueuedCodesRef.current.add(activeCode);
        }
      }

      cancelEditableHighlightIdle();
      clearEditableHighlightDebounce();

      const scheduleRun = () => {
        editableHighlightDebounceHandleRef.current = 0;
        editableHighlightCancelIdleRef.current = scheduleIdleTask(
          () => {
            editableHighlightCancelIdleRef.current = null;
            void flushEditableCodeHighlights();
          },
          MARKDOWN_EDITABLE_REHIGHLIGHT_IDLE_TIMEOUT_MS,
        );
      };

      if (options?.immediate) {
        scheduleRun();
        return;
      }

      editableHighlightDebounceHandleRef.current = window.setTimeout(
        scheduleRun,
        MARKDOWN_EDITABLE_REHIGHLIGHT_DEBOUNCE_MS,
      );
    },
    [
      cancelEditableHighlightIdle,
      clearEditableHighlightDebounce,
      flushEditableCodeHighlights,
      resolveEditableCodeElementNearSelection,
    ],
  );

  useEffect(
    () => () => {
      clearEditableHighlightDebounce();
      cancelEditableHighlightIdle();
    },
    [cancelEditableHighlightIdle, clearEditableHighlightDebounce],
  );

  const syncMarkdownDraftFromEditor = useCallback(() => {
    if (!markdownEditorRef.current) {
      return;
    }
    if (applyingMarkdownCaretRef.current) {
      return;
    }
    const nextBody = serializeMarkdownFromHtml(markdownEditorRef.current);
    const nextValue = composeMarkdownWithBody(editDraft, nextBody);
    if (nextValue !== editDraft) {
      onEditChange(nextValue);
    }
  }, [editDraft, onEditChange]);

  const syncActiveMarkdownHeading = useCallback(() => {
    const editor = markdownEditorRef.current;
    if (!editor) {
      return;
    }
    const headings = Array.from(
      editor.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"),
    );
    const hrLines = Array.from(
      editor.querySelectorAll<HTMLElement>('[data-md-hr-line="true"]'),
    );
    const listItems = Array.from(
      editor.querySelectorAll<HTMLElement>("li"),
    ).filter(
      (item) =>
        item.firstElementChild instanceof HTMLElement &&
        item.firstElementChild.classList.contains("md-list-marker"),
    );
    const codeBlocks = Array.from(
      editor.querySelectorAll<HTMLElement>('pre[data-md-code-block="true"]'),
    );
    if (
      headings.length === 0 &&
      hrLines.length === 0 &&
      listItems.length === 0 &&
      codeBlocks.length === 0
    ) {
      return;
    }

    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : null;
    const inEditor = range ? editor.contains(range.startContainer) : false;
    const activeHeading = inEditor
      ? (range?.startContainer instanceof Element
          ? range.startContainer
          : range?.startContainer.parentElement
        )?.closest("h1,h2,h3,h4,h5,h6")
      : null;
    const activeHrLine = inEditor
      ? (range?.startContainer instanceof Element
          ? range.startContainer
          : range?.startContainer.parentElement
        )?.closest('[data-md-hr-line="true"]')
      : null;
    const activeListItem = inEditor
      ? (range?.startContainer instanceof Element
          ? range.startContainer
          : range?.startContainer.parentElement
        )?.closest("li")
      : null;
    const activeCodeBlock = inEditor
      ? (range?.startContainer instanceof Element
          ? range.startContainer
          : range?.startContainer.parentElement
        )?.closest('pre[data-md-code-block="true"]')
      : null;
    const retagQueue: Array<{
      heading: HTMLElement;
      resolvedLevel: number;
    }> = [];

    headings.forEach((heading) => {
      const levelRaw = Number.parseInt(heading.tagName.slice(1), 10);
      const fallbackLevel = Number.isNaN(levelRaw)
        ? Number.parseInt(heading.getAttribute("data-md-heading-level") ?? "1", 10)
        : levelRaw;
      const levelMatch = (heading.textContent ?? "").match(/^\s*\\?(#{1,6})(?:\s+|$)/);
      const resolvedLevel = levelMatch
        ? Math.max(1, Math.min(6, levelMatch[1].length))
        : Math.max(1, Math.min(6, Number.isFinite(fallbackLevel) ? fallbackLevel : 1));
      heading.setAttribute("data-md-heading-level", String(resolvedLevel));

      if (heading === activeHeading) {
        heading.setAttribute("data-md-heading-active", "true");
      } else {
        heading.removeAttribute("data-md-heading-active");
        if (resolvedLevel !== levelRaw) {
          retagQueue.push({ heading, resolvedLevel });
        }
      }
    });

    retagQueue.forEach(({ heading, resolvedLevel }) => {
      const retagged = replaceHeadingElementLevel(heading, resolvedLevel);
      retagged.setAttribute("data-md-heading-level", String(resolvedLevel));
      retagged.removeAttribute("data-md-heading-active");
    });

    hrLines.forEach((line) => {
      if (line === activeHrLine) {
        line.setAttribute("data-md-hr-active", "true");
      } else {
        line.removeAttribute("data-md-hr-active");
      }
    });

    listItems.forEach((item) => {
      if (item === activeListItem) {
        item.setAttribute("data-md-list-active", "true");
      } else {
        item.removeAttribute("data-md-list-active");
      }
    });

    codeBlocks.forEach((block) => {
      if (block === activeCodeBlock) {
        block.setAttribute("data-md-code-active", "true");
      } else {
        block.removeAttribute("data-md-code-active");
      }
    });
  }, []);

  useLayoutEffect(() => {
    if (!isEditing || isCodeMode) {
      markdownEditorReadyRef.current = false;
      if (!isEditing) {
        markdownEditorHtmlRef.current = null;
      }
      return;
    }
    if (!markdownEditorRef.current || markdownEditorReadyRef.current) {
      return;
    }
    markdownEditorRef.current.innerHTML = markdownEditorHtmlRef.current ?? "";
    markdownEditorReadyRef.current = true;
    syncActiveMarkdownHeading();
  }, [isCodeMode, isEditing, syncActiveMarkdownHeading]);

  useEffect(() => {
    if (!isEditing || isCodeMode) {
      editableHighlightQueueAllRef.current = false;
      editableHighlightQueuedCodesRef.current.clear();
      clearEditableHighlightDebounce();
      cancelEditableHighlightIdle();
      return;
    }

    queueEditableCodeRehighlight({ all: true, immediate: true });
  }, [
    cancelEditableHighlightIdle,
    clearEditableHighlightDebounce,
    isCodeMode,
    isEditing,
    queueEditableCodeRehighlight,
  ]);

  useEffect(() => {
    if (!isEditing || isCodeMode) {
      return;
    }
    const handleSelectionChange = () => {
      const editor = markdownEditorRef.current;
      if (!editor) {
        return;
      }
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
        return;
      }
      syncActiveMarkdownHeading();
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [isCodeMode, isEditing, syncActiveMarkdownHeading]);

  useLayoutEffect(() => {
    if (isEditing) {
      if (isCodeMode) {
        restoreScroll(editorRef.current);
      } else {
        restoreScroll(markdownEditorScrollRef.current);
      }
      return;
    }
    restoreScroll(previewRef.current);
  }, [isCodeMode, isEditing, restoreScroll]);

  useEffect(() => {
    if (!isEditing || !isCodeMode || !editorRef.current) {
      return;
    }
    if (typeof editCaretIndex !== "number") {
      return;
    }
    const editor = editorRef.current;
    const desiredIndex = editCaretIndex;
    const nextIndex = Math.max(0, Math.min(desiredIndex, editor.value.length));
    const handle = window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(nextIndex, nextIndex);
      lastCaretIndexRef.current = nextIndex;
      scrollStateRef.current.top = editor.scrollTop;
      scrollStateRef.current.left = editor.scrollLeft;
      onEditCaretApplied();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [editCaretIndex, isCodeMode, isEditing, onEditCaretApplied]);

  useEffect(() => {
    if (!isCodeMode || !resolvedEditEnabled || !isEditing || !editorRef.current) {
      return;
    }
    if (typeof editCaretIndex === "number") {
      return;
    }
    const editor = editorRef.current;
    const nextIndex = typeof lastCaretIndexRef.current === "number"
      ? Math.max(0, Math.min(lastCaretIndexRef.current, editor.value.length))
      : editor.value.length;
    const handle = window.requestAnimationFrame(() => {
      try {
        editor.focus({ preventScroll: true });
      } catch {
        editor.focus();
      }
      editor.setSelectionRange(nextIndex, nextIndex);
      lastCaretIndexRef.current = nextIndex;
    });
    return () => window.cancelAnimationFrame(handle);
  }, [editCaretIndex, isCodeMode, isEditing, resolvedEditEnabled]);

  useEffect(() => {
    if (!isEditing || isCodeMode || !markdownEditorRef.current) {
      return;
    }
    if (typeof editCaretIndex !== "number") {
      return;
    }
    const editor = markdownEditorRef.current;
    applyingMarkdownCaretRef.current = true;
    const bodyCaretIndex = Math.max(
      0,
      editCaretIndex - markdownEditBodyStartOffset,
    );
    const plainOffset = mapRawIndexToPlainOffset(markdownEditBody, bodyCaretIndex, {
      skipStructuralMarkers: false,
    });
    const desiredScrollTop = scrollStateRef.current.top;
    const desiredScrollLeft = scrollStateRef.current.left;
    const enforceScroll = () => {
      editor.scrollTop = desiredScrollTop;
      editor.scrollLeft = desiredScrollLeft;
    };
    const handle = window.requestAnimationFrame(() => {
      try {
        editor.focus({ preventScroll: true });
      } catch {
        editor.focus();
      }
      try {
        setCaretAtPlainOffset(editor, plainOffset);
        enforceScroll();
        lastCaretIndexRef.current = editCaretIndex;
        scrollStateRef.current.top = editor.scrollTop;
        scrollStateRef.current.left = editor.scrollLeft;
      } finally {
        applyingMarkdownCaretRef.current = false;
        onEditCaretApplied();
      }
    });
    return () => {
      window.cancelAnimationFrame(handle);
      applyingMarkdownCaretRef.current = false;
    };
  }, [
    editCaretIndex,
    isEditing,
    markdownEditBody,
    markdownEditBodyStartOffset,
    onEditCaretApplied,
    isCodeMode,
  ]);

  const handleCodeCopyClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const codeBlock = event.currentTarget.closest(".md-code-block");
      const code = codeBlock?.querySelector("pre > code")?.textContent ?? "";
      if (!code) {
        return;
      }
      void copyTextToClipboard(code);
    },
    [],
  );

  const renderMarkdownCodePre = useCallback(
    ({
      children,
      ...preProps
    }: ComponentPropsWithoutRef<"pre"> & { children?: ReactNode }) => {
      const svgSource = extractSvgCodeBlockSource(children);
      if (svgSource !== null) {
        return <SvgPreviewBlock source={svgSource} className="md-svg-preview-block" />;
      }
      return (
        <div className="md-code-block">
          <button
            type="button"
            className="md-code-copy-button"
            aria-label="Copy code block"
            title="Copy code block"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onMouseUp={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={handleCodeCopyClick}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <rect
                x="9"
                y="9"
                width="10"
                height="10"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <MarkdownHighlightedPre
            {...preProps}
            highlightSchedule="idle"
            autoDetectWithoutLanguage={MARKDOWN_CODE_HIGHLIGHT_CONFIG.autoDetectWithoutLanguage}
            autoDetectCandidateLanguages={
              MARKDOWN_CODE_HIGHLIGHT_CONFIG.autoDetectCandidateLanguages
            }
            showLanguageLabel={MARKDOWN_CODE_HIGHLIGHT_CONFIG.showLanguageLabel}
          >
            {children}
          </MarkdownHighlightedPre>
        </div>
      );
    },
    [handleCodeCopyClick],
  );

  const handleMarkdownEditorMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = resolveEventElement(event.target);
      if (!target?.closest(".md-code-copy-button")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const handleMarkdownEditorClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = resolveEventElement(event.target);
      const copyButton = target?.closest(".md-code-copy-button");
      if (!copyButton) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const codeBlock = copyButton.closest(".md-code-block");
      const code = codeBlock?.querySelector("pre > code")?.textContent ?? "";
      if (!code) {
        return;
      }
      void copyTextToClipboard(code);
    },
    [],
  );

  const handlePreviewLinkClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const link = resolveAnchorTarget(event.target);
      if (!link) {
        return;
      }
      const href = link.getAttribute("href")?.trim() ?? "";
      if (event.button !== 0) {
        event.preventDefault();
        return;
      }
      if (isModifierClick(event)) {
        const safeHref = resolveSafeHref(href);
        if (safeHref) {
          event.preventDefault();
          event.stopPropagation();
          void openUrl(safeHref);
          return;
        }
      }
      event.preventDefault();
    },
    [],
  );

  const handlePreviewClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!canEdit || isEditing) {
        return;
      }
      if (!canStartPreviewEdit({ editorMode, editEnabled: resolvedEditEnabled })) {
        return;
      }
      if (!isCodeMode && hasFrontmatterError && showFrontmatterTextFallback) {
        return;
      }
      const eventElement = resolveEventElement(event.target);
      if (!isCodeMode && eventElement?.closest(".frontmatter-panel, .frontmatter-cover-panel")) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      if (isModifierClick(event)) {
        const link = resolveAnchorTarget(event.target);
        const safeHref = link
          ? resolveSafeHref(link.getAttribute("href")?.trim() ?? "")
          : null;
        if (safeHref) {
          return;
        }
      }
      const origin = isCodeMode ? "raw" : "markdown";
      const bodyStartOffset = previewFrontmatter.hasFrontmatter
        ? previewFrontmatter.bodyStartOffset
        : 0;
      const markdownSource = previewFrontmatter.hasFrontmatter
        ? previewFrontmatter.body
        : preview;
      let caretIndex = isCodeMode
        ? preview.length === 0
          ? 0
          : null
        : markdownSource.length === 0
          ? bodyStartOffset
          : null;
      const selectionContainer = isCodeMode
        ? previewRef.current
        : (markdownViewRef.current ?? previewRef.current);
      if (selectionContainer) {
        captureScroll(previewRef.current ?? selectionContainer);
        const selection = getSelectionRange(selectionContainer);
        if (selection && !selection.collapsed) {
          return;
        }
        const range = getRangeFromEvent(event, selectionContainer);
        const resolvedIndex = isCodeMode
          ? resolveRawCaretIndex(selectionContainer, range)
          : resolveMarkdownCaretIndex(selectionContainer, markdownSource, range);
        if (typeof resolvedIndex === "number") {
          caretIndex = isCodeMode ? resolvedIndex : bodyStartOffset + resolvedIndex;
        }
        if (!isCodeMode) {
          markdownEditorHtmlRef.current = buildEditableMarkdownHtml(
            selectionContainer,
            markdownSource,
          );
        }
      } else if (!isCodeMode) {
        markdownEditorHtmlRef.current = "";
      }
      if (caretIndex === null) {
        if (typeof lastCaretIndexRef.current === "number") {
          caretIndex = lastCaretIndexRef.current;
        } else if (isCodeMode && preview.length > 0) {
          caretIndex = preview.length;
        } else if (!isCodeMode && markdownSource.length > 0) {
          caretIndex = bodyStartOffset + markdownSource.length;
        }
      }
      if (typeof caretIndex === "number") {
        lastCaretIndexRef.current = caretIndex;
      }
      onEditStart({ caretIndex, origin });
    },
    [
      canEdit,
      captureScroll,
      editorMode,
      isCodeMode,
      isEditing,
      onEditStart,
      preview,
      resolvedEditEnabled,
      hasFrontmatterError,
      previewFrontmatter.body,
      previewFrontmatter.bodyStartOffset,
      previewFrontmatter.hasFrontmatter,
      showFrontmatterTextFallback,
    ],
  );

  const handleRawEditorBlur = useCallback(
    (event: FocusEvent<HTMLTextAreaElement>) => {
      captureScroll(event.currentTarget);
      const caretIndex = event.currentTarget.selectionStart;
      if (typeof caretIndex === "number") {
        lastCaretIndexRef.current = caretIndex;
      } else {
        lastCaretIndexRef.current = event.currentTarget.value.length;
      }
      if (suppressRawEditorBlurExitRef.current) {
        suppressRawEditorBlurExitRef.current = false;
        return;
      }
      onEditExit();
    },
    [captureScroll, onEditExit],
  );

  const handleMarkdownEditorBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      captureScroll(markdownEditorScrollRef.current);
      const bodyCaretIndex = resolveMarkdownCaretIndex(
        event.currentTarget,
        markdownEditBody,
        null,
        { skipStructuralMarkers: false },
      );
      if (typeof bodyCaretIndex === "number") {
        lastCaretIndexRef.current = markdownEditBodyStartOffset + bodyCaretIndex;
      }
      onEditExit();
    },
    [
      captureScroll,
      markdownEditBody,
      markdownEditBodyStartOffset,
      markdownEditorScrollRef,
      onEditExit,
    ],
  );

  const applyMarkdownEditorCommand = useCallback(
    (command: (editor: HTMLElement) => CommandResult) => {
      const editor = markdownEditorRef.current;
      if (!editor) {
        return { handled: false, changed: false };
      }
      const result = command(editor);
      if (result.changed) {
        const activeCodeElement = resolveEditableCodeElementNearSelection(null);
        if (activeCodeElement) {
          queueEditableCodeRehighlight({ codeElement: activeCodeElement });
        }
        normalizeEditableListMarkers(editor);
        syncMarkdownDraftFromEditor();
        syncActiveMarkdownHeading();
      }
      return result;
    },
    [
      queueEditableCodeRehighlight,
      resolveEditableCodeElementNearSelection,
      syncActiveMarkdownHeading,
      syncMarkdownDraftFromEditor,
    ],
  );

  const handleMarkdownEditorBeforeInput = useCallback(
    (event: FormEvent<HTMLDivElement>) => {
      const editor = markdownEditorRef.current;
      if (!editor) {
        return;
      }
      const nativeEvent = event.nativeEvent as Event & {
        inputType?: string;
        isComposing?: boolean;
      };
      if (nativeEvent.isComposing) {
        return;
      }
      const inputType = nativeEvent.inputType ?? "";
      if (inputType !== "insertParagraph" && inputType !== "insertLineBreak") {
        return;
      }

      const result = applyMarkdownEditorCommand(
        inputType === "insertLineBreak"
          ? handleListSoftBreak
          : handleListEnterExitToRootParagraph,
      );
      if (result.handled) {
        event.preventDefault();
      }
    },
    [applyMarkdownEditorCommand],
  );

  const handleMarkdownEditorKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const nativeKeyboardEvent = event.nativeEvent as Event & { isComposing?: boolean };
      if (nativeKeyboardEvent.isComposing) {
        return;
      }

      if (event.key === "Tab") {
        const result = applyMarkdownEditorCommand(
          event.shiftKey ? outdentSelectedListItems : indentSelectedListItems,
        );
        if (result.handled) {
          event.preventDefault();
        }
        return;
      }

      // Fallback for environments where beforeinput is unreliable.
      if (event.key === "Enter") {
        const result = applyMarkdownEditorCommand(
          event.shiftKey ? handleListSoftBreak : handleListEnterExitToRootParagraph,
        );
        if (result.handled) {
          event.preventDefault();
        }
      }
    },
    [applyMarkdownEditorCommand],
  );

  const handleMarkdownInput = useCallback((event: FormEvent<HTMLDivElement>) => {
    const sourceCodeElement = resolveEditableCodeElementNearSelection(event.target);
    if (sourceCodeElement) {
      queueEditableCodeRehighlight({ codeElement: sourceCodeElement });
    }
    syncMarkdownDraftFromEditor();
    syncActiveMarkdownHeading();
  }, [
    queueEditableCodeRehighlight,
    resolveEditableCodeElementNearSelection,
    syncActiveMarkdownHeading,
    syncMarkdownDraftFromEditor,
  ]);

  const handleHybridBodyChange = useCallback(
    (nextBody: string) => {
      const nextValue = composeMarkdownWithBody(editDraft, nextBody);
      if (nextValue !== editDraft) {
        onEditChange(nextValue);
      }
    },
    [editDraft, onEditChange],
  );

  const renderHybridMarkdownPreview = useCallback(
    (
      sourceMarkdown: string,
      options?: HybridMarkdownPreviewRenderOptions,
    ) => {
      const inlineHighlightOptions: InlineSyntaxHighlightOptions | undefined =
        options?.collapseClozeVariantsInView || options?.hideInlineSyntaxDelimiters
          ? {
            collapseChainedClozeVariants: options?.collapseClozeVariantsInView === true,
            hideInlineSyntaxDelimiters: options?.hideInlineSyntaxDelimiters === true,
          }
          : undefined;
      const previewMarkdown = normalizeInlineFormattingForPreview(sourceMarkdown);
      const mediaPreview = buildMarkdownMediaPreviewSource(
        previewMarkdown,
        "preview-panel-hybrid",
      );
      return (
        <ReactMarkdown
          remarkPlugins={[
            remarkGfm,
            remarkPreserveSoftBreaks,
            remarkPreserveOrderedListDelimiters,
          ]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema]]}
          components={{
            h1: ({ node: _node, children, ...props }) => (
              <h1 {...props}>
                {renderHighlightedInlineSyntaxChildren(children, "h1", inlineHighlightOptions)}
              </h1>
            ),
            h2: ({ node: _node, children, ...props }) => (
              <h2 {...props}>
                {renderHighlightedInlineSyntaxChildren(children, "h2", inlineHighlightOptions)}
              </h2>
            ),
            h3: ({ node: _node, children, ...props }) => (
              <h3 {...props}>
                {renderHighlightedInlineSyntaxChildren(children, "h3", inlineHighlightOptions)}
              </h3>
            ),
            h4: ({ node: _node, children, ...props }) => (
              <h4 {...props}>
                {renderHighlightedInlineSyntaxChildren(children, "h4", inlineHighlightOptions)}
              </h4>
            ),
            h5: ({ node: _node, children, ...props }) => (
              <h5 {...props}>
                {renderHighlightedInlineSyntaxChildren(children, "h5", inlineHighlightOptions)}
              </h5>
            ),
            h6: ({ node: _node, children, ...props }) => (
              <h6 {...props}>
                {renderHighlightedInlineSyntaxChildren(children, "h6", inlineHighlightOptions)}
              </h6>
            ),
            p: ({ node: _node, children, ...props }) => (
              <p {...props}>
                {renderHighlightedInlineSyntaxChildren(children, "p", inlineHighlightOptions)}
              </p>
            ),
            ol: ({ node, ...props }) => {
              const delimiterFromNode =
                node &&
                typeof node === "object" &&
                "properties" in node &&
                node.properties &&
                typeof node.properties === "object"
                  ? (node.properties as Record<string, unknown>)["data-md-ordered-delimiter"]
                  : null;
              const delimiterFromPosition = resolveOrderedListDelimiter(
                previewMarkdown,
                node &&
                  typeof node === "object" &&
                  "position" in node &&
                  node.position &&
                  typeof node.position === "object" &&
                  "start" in node.position &&
                  node.position.start &&
                  typeof node.position.start === "object" &&
                  ("offset" in node.position.start || "line" in node.position.start)
                  ? (node.position.start as { offset?: number; line?: number })
                  : undefined,
              );
              if (delimiterFromNode !== ")" && delimiterFromPosition !== ")") {
                return <ol {...props} />;
              }
              const startRaw = props.start;
              const startValue = typeof startRaw === "number"
                ? startRaw
                : Number.parseInt(String(startRaw ?? "1"), 10);
              const previous = Number.isNaN(startValue) ? 0 : Math.max(0, startValue - 1);
              const style = {
                ...(props.style ?? {}),
                "--md-ordered-start": String(previous),
              } as CSSProperties;
              return <ol {...props} style={style} data-md-ordered-delimiter=")" />;
            },
            li: ({ node: _node, children, ...props }) => (
              <li {...props}>
                {renderHighlightedInlineSyntaxChildren(children, "li", inlineHighlightOptions)}
              </li>
            ),
            input: ({ node: _node, ...props }) => {
              const inputType = typeof props.type === "string" ? props.type.toLowerCase() : "";
              if (inputType !== "checkbox") {
                return <input {...props} />;
              }
              const className = [props.className, "md-task-list-checkbox"]
                .filter(Boolean)
                .join(" ");
              return (
                <input
                  {...props}
                  type="checkbox"
                  className={className}
                  data-md-task-checkbox="true"
                  disabled={false}
                  onChange={() => {}}
                />
              );
            },
            blockquote: ({ node: _node, children, ...props }) => (
              <blockquote {...props}>
                {renderHighlightedInlineSyntaxChildren(children, "blockquote", inlineHighlightOptions)}
              </blockquote>
            ),
            pre: ({ node: _node, children, ...props }) =>
              renderMarkdownCodePre({ children, ...props }),
            table: ({ node: _node, ...props }) => (
              <div className={`markdown-table ${SHARED_TABLE_WRAP_CLASS}`}>
                <table {...props} />
              </div>
            ),
            th: ({ node: _node, children, ...props }) => (
              <th {...props}>
                {renderMarkdownTableCellWithMedia({
                  node: _node,
                  children,
                  keyPrefix: "th",
                  inlineHighlightOptions,
                  markdownSource: mediaPreview.markdown,
                  vaultPngAssets,
                  vaultPath,
                  sourceRelativePath: sourceRelativePath ?? selectedFile?.relative_path,
                })}
              </th>
            ),
            div: ({ node, ...props }) =>
              renderMarkdownMediaGroup({
                node,
                groups: mediaPreview.groups,
                vaultPngAssets,
                vaultPath,
                sourceRelativePath: sourceRelativePath ?? selectedFile?.relative_path,
              }) ?? <div {...props} />,
            td: ({ node: _node, children, ...props }) => (
              <td {...props}>
                {renderMarkdownTableCellWithMedia({
                  node: _node,
                  children,
                  keyPrefix: "td",
                  inlineHighlightOptions,
                  markdownSource: mediaPreview.markdown,
                  vaultPngAssets,
                  vaultPath,
                  sourceRelativePath: sourceRelativePath ?? selectedFile?.relative_path,
                })}
              </td>
            ),
            img: ({ node: _node, ...props }) => (
              <img {...props} draggable={false} />
            ),
          }}
        >
          {mediaPreview.markdown}
        </ReactMarkdown>
      );
    },
    [renderMarkdownCodePre, selectedFile?.relative_path, sourceRelativePath, vaultPath, vaultPngAssets],
  );

  const markdownSource = isCodeMode
    ? preview
    : hasFrontmatterError && showFrontmatterTextFallback
      ? preview
      : markdownPreviewBody;
  const normalizedMarkdownSource = isCodeMode
    ? preview
    : normalizeTableSpacingForRender(markdownSource);
  const renderedPreview = isCodeMode
    ? preview
    : isMarkdownMode && resolvedEditEnabled
      ? normalizedMarkdownSource
      : applyInteractionSpacing(normalizedMarkdownSource);
  const markdownViewBlocks = useMemo(
    () => (
      isCodeMode
        ? []
        : parseMarkdownBlocks(enforceStandaloneMediaBlockBoundaries(renderedPreview))
    ),
    [isCodeMode, renderedPreview],
  );
  const markdownViewItems = useMemo(() => {
    if (markdownViewBlocks.length === 0) {
      return [] as MarkdownViewRenderItem[];
    }

    const items: MarkdownViewRenderItem[] = [];
    let activeGroupId: string | null = null;
    let activeGroupBlocks: MarkdownBlock[] = [];
    const pushActiveGroup = () => {
      if (!activeGroupId || activeGroupBlocks.length === 0) {
        activeGroupId = null;
        activeGroupBlocks = [];
        return;
      }
      items.push({
        type: "group",
        groupId: activeGroupId,
        blocks: activeGroupBlocks,
      });
      activeGroupId = null;
      activeGroupBlocks = [];
    };

    for (const block of markdownViewBlocks) {
      const nextGroupId = block.meta?.cardGroupId ?? null;
      if (!nextGroupId) {
        pushActiveGroup();
        items.push({ type: "block", block });
        continue;
      }
      if (activeGroupId === null) {
        activeGroupId = nextGroupId;
        activeGroupBlocks = [block];
        continue;
      }
      if (activeGroupId !== nextGroupId) {
        pushActiveGroup();
        activeGroupId = nextGroupId;
        activeGroupBlocks = [block];
        continue;
      }
      activeGroupBlocks.push(block);
    }

    pushActiveGroup();
    return items;
  }, [markdownViewBlocks]);
  const hasVisiblePreviewContent = isCodeMode
    ? preview.length > 0
    : markdownSource.length > 0;
  const isEditModeActive = resolvedEditEnabled;
  const frontmatterPanelSource = useMemo(() => {
    if (previewFrontmatter.hasFrontmatter && !previewFrontmatter.error) {
      return {
        sourceMarkdown: preview,
        properties: previewFrontmatter.properties,
        showPropertiesPanel: true,
      };
    }
    if (isEditModeActive && editFrontmatter.hasFrontmatter && !editFrontmatter.error) {
      return {
        sourceMarkdown: editDraft,
        properties: editFrontmatter.properties,
        showPropertiesPanel: true,
      };
    }
    if (canEdit) {
      const sourceMarkdown = isEditModeActive ? editDraft : preview;
      const parsedSource = isEditModeActive ? editFrontmatter : previewFrontmatter;
      if (!parsedSource.hasFrontmatter && !parsedSource.error) {
        return {
          sourceMarkdown,
          properties: [],
          showPropertiesPanel: false,
        };
      }
    }
    return null;
  }, [
    previewFrontmatter.hasFrontmatter,
    previewFrontmatter.error,
    previewFrontmatter.properties,
    preview,
    isEditModeActive,
    canEdit,
    editFrontmatter.hasFrontmatter,
    editFrontmatter.error,
    editFrontmatter.properties,
    editDraft,
  ]);
  const showFrontmatterPanel = !isCodeMode &&
    previewState === "idle" &&
    frontmatterPanelSource !== null;
  const canUseHybridMarkdownEditor = Boolean(
    isHybridMode &&
      canEdit &&
      previewState === "idle" &&
      !hasFrontmatterError,
  );
  const showMarkdownEditor = isMarkdownMode && resolvedEditEnabled;
  const showHybridMarkdownEditor = Boolean(
    canUseHybridMarkdownEditor &&
      resolvedEditEnabled,
  );
  const shouldAutoManageRawCodeEditSession = Boolean(
    isCodeMode &&
      canEdit &&
      selectedFile &&
      previewState === "idle",
  );
  const disableLegacyPreviewClick = isHybridMode;
  const canToggleEditMode = Boolean(
    !isHybridMode &&
      canEdit &&
      selectedFile &&
      previewState === "idle" &&
      documentMode !== "write",
  );
  const renderMarkdownViewBlock = useCallback(
    (block: MarkdownBlock, keyPrefix: string) => {
      const cardGroupId = block.meta?.cardGroupId;
      const cardGroupRole = block.meta?.cardGroupRole;
      const wrapperClassName = `preview-markdown-view-block preview-markdown-view-block-${block.kind}`;
      if (block.kind === "database-block") {
        return (
          <div
            key={keyPrefix}
            className={wrapperClassName}
            data-md-block-kind={block.kind}
            data-md-card-group-id={cardGroupId ?? undefined}
            data-md-card-group-role={cardGroupRole ?? undefined}
          >
            <MarkdownHybridDatabaseBlock
              raw={block.raw}
              vaultFiles={vaultFiles}
              sourceRelativePath={sourceRelativePath ?? selectedFile?.relative_path}
              onNavigateWikilink={onNavigateWikilink}
              onCommitRaw={() => {}}
              allowCellEditing={false}
            />
          </div>
        );
      }
      if (block.kind === "blank") {
        return (
          <div
            key={keyPrefix}
            className={`${wrapperClassName} preview-markdown-view-block-blank`}
            data-md-block-kind={block.kind}
            data-md-card-group-id={cardGroupId ?? undefined}
            data-md-card-group-role={cardGroupRole ?? undefined}
            aria-hidden="true"
          />
        );
      }
      return (
        <div
          key={keyPrefix}
          className={wrapperClassName}
          data-md-block-kind={block.kind}
          data-md-card-group-id={cardGroupId ?? undefined}
          data-md-card-group-role={cardGroupRole ?? undefined}
        >
          {renderHybridMarkdownPreview(normalizeTableSpacingForRender(block.raw), {
            collapseClozeVariantsInView: true,
            hideInlineSyntaxDelimiters: true,
          })}
        </div>
      );
    },
    [
      onNavigateWikilink,
      renderHybridMarkdownPreview,
      selectedFile?.relative_path,
      sourceRelativePath,
      vaultFiles,
    ],
  );

  const commitHybridEditIfNeeded = useCallback(async () => {
    if (!showHybridMarkdownEditor) {
      return true;
    }
    const result = await hybridEditorRef.current?.commitActiveEdit();
    return result ?? true;
  }, [showHybridMarkdownEditor]);

  const discardHybridEditIfNeeded = useCallback(async () => {
    if (!showHybridMarkdownEditor) {
      return true;
    }
    const result = await hybridEditorRef.current?.discardActiveEdit();
    return result ?? true;
  }, [showHybridMarkdownEditor]);

  const handleSelectEditorModeClick = useCallback(
    async (nextEditorMode: PreviewPanelEditorMode) => {
      if (editorMode === nextEditorMode) {
        return;
      }
      if (isHybridMode) {
        if (!await commitHybridEditIfNeeded()) {
          return;
        }
      }
      await onSelectEditorMode(nextEditorMode);
    },
    [commitHybridEditIfNeeded, editorMode, isHybridMode, onSelectEditorMode],
  );

  const handleEditModeToggle = useCallback(async () => {
    if (!canToggleEditMode) {
      return;
    }
    await onToggleEditEnabled();
  }, [canToggleEditMode, onToggleEditEnabled]);

  const handleWriteCancelClick = useCallback(async () => {
    if (isHybridMode && !await discardHybridEditIfNeeded()) {
      return;
    }
    onWriteCancel?.();
  }, [discardHybridEditIfNeeded, isHybridMode, onWriteCancel]);

  const handleWriteSaveClick = useCallback(async () => {
    if (isHybridMode && !await commitHybridEditIfNeeded()) {
      return;
    }
    if (isHybridMode) {
      await Promise.resolve();
      await new Promise<void>((resolve) => {
        if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
          setTimeout(resolve, 0);
          return;
        }
        window.requestAnimationFrame(() => resolve());
      });
    }
    onWriteSaveRef.current?.();
  }, [commitHybridEditIfNeeded, isHybridMode]);

  const handleToggleFrontmatterPanelCollapsed = useCallback(() => {
    setUserFrontmatterCollapsed(
      (current) => !(current ?? isNarrowFrontmatterViewport),
    );
  }, [isNarrowFrontmatterViewport]);

  const handleMarkdownTabSelect = useCallback(
    (path: string) => {
      onSelectMarkdownTab?.(path);
    },
    [onSelectMarkdownTab],
  );

  const handleMarkdownTabClose = useCallback(
    (event: MouseEvent<HTMLButtonElement>, path: string) => {
      event.preventDefault();
      event.stopPropagation();
      onCloseMarkdownTab?.(path);
    },
    [onCloseMarkdownTab],
  );

  const clearMarkdownTabDragPreview = useCallback(() => {
    const previewNode = markdownTabDragPreviewRef.current;
    if (!previewNode) {
      return;
    }
    if (previewNode.parentElement) {
      previewNode.parentElement.removeChild(previewNode);
    }
    markdownTabDragPreviewRef.current = null;
  }, []);

  useEffect(
    () => () => {
      clearMarkdownTabDragPreview();
    },
    [clearMarkdownTabDragPreview],
  );

  useEffect(() => {
    if (!dragMarkdownTabPath) {
      return;
    }
    if (markdownTabs.some((tab) => tab.path === dragMarkdownTabPath)) {
      return;
    }
    setDragMarkdownTabPath(null);
    setMarkdownTabDropHint(null);
    clearMarkdownTabDragPreview();
  }, [clearMarkdownTabDragPreview, dragMarkdownTabPath, markdownTabs]);

  const isMarkdownTabReorderEnabled = Boolean(onReorderMarkdownTabs) && markdownTabs.length > 1;

  const resolveMarkdownTabDropPosition = useCallback(
    (event: Pick<DragEvent<HTMLDivElement>, "currentTarget" | "clientX">) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      return event.clientX > midpoint ? "after" : "before";
    },
    [],
  );

  const handleMarkdownTabDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, path: string, label: string) => {
      if (!isMarkdownTabReorderEnabled) {
        return;
      }
      setDragMarkdownTabPath(path);
      setMarkdownTabDropHint(null);
      if (!event.dataTransfer) {
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("text/plain", path);
      } catch {
        // Ignore dataTransfer limitations in certain runtimes.
      }
      clearMarkdownTabDragPreview();
      const preview = createMarkdownTabDragPreviewElement(label);
      if (!preview) {
        return;
      }
      markdownTabDragPreviewRef.current = preview;
      event.dataTransfer.setDragImage(preview, 18, 12);
    },
    [clearMarkdownTabDragPreview, isMarkdownTabReorderEnabled],
  );

  const handleMarkdownTabDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>, targetPath: string) => {
      if (!isMarkdownTabReorderEnabled || !dragMarkdownTabPath) {
        return;
      }
      if (dragMarkdownTabPath === targetPath) {
        setMarkdownTabDropHint(null);
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      const position = resolveMarkdownTabDropPosition(event);
      setMarkdownTabDropHint((current) => {
        if (current?.path === targetPath && current.position === position) {
          return current;
        }
        return {
          path: targetPath,
          position,
        };
      });
    },
    [
      dragMarkdownTabPath,
      isMarkdownTabReorderEnabled,
      resolveMarkdownTabDropPosition,
    ],
  );

  const handleMarkdownTabDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>, targetPath: string) => {
      if (!markdownTabDropHint || markdownTabDropHint.path !== targetPath) {
        return;
      }
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
        return;
      }
      setMarkdownTabDropHint(null);
    },
    [markdownTabDropHint],
  );

  const handleMarkdownTabDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, targetPath: string) => {
      if (!isMarkdownTabReorderEnabled || !dragMarkdownTabPath) {
        return;
      }
      event.preventDefault();
      const sourcePath = dragMarkdownTabPath;
      setDragMarkdownTabPath(null);
      setMarkdownTabDropHint(null);
      clearMarkdownTabDragPreview();
      if (sourcePath === targetPath) {
        return;
      }
      const position = resolveMarkdownTabDropPosition(event);
      onReorderMarkdownTabs?.(sourcePath, targetPath, position);
    },
    [
      clearMarkdownTabDragPreview,
      dragMarkdownTabPath,
      isMarkdownTabReorderEnabled,
      onReorderMarkdownTabs,
      resolveMarkdownTabDropPosition,
    ],
  );

  const handleMarkdownTabDragEnd = useCallback(() => {
    setDragMarkdownTabPath(null);
    setMarkdownTabDropHint(null);
    clearMarkdownTabDragPreview();
  }, [clearMarkdownTabDragPreview]);

  const markdownTabDisplayInfos = useMemo(
    () => markdownTabs.map((tab) => resolveMarkdownTabDisplayInfo(tab)),
    [markdownTabs],
  );
  const availableTabStripWidth = useMemo(() => {
    if (markdownTabs.length === 0) {
      return 0;
    }
    if (markdownTabStripWidth > 0) {
      return markdownTabStripWidth;
    }
    return markdownTabs.length * PREVIEW_TAB_MAX_WIDTH_PX;
  }, [markdownTabStripWidth, markdownTabs.length]);
  const idealTabWidth =
    markdownTabs.length > 0
      ? availableTabStripWidth / markdownTabs.length
      : PREVIEW_TAB_MAX_WIDTH_PX;
  const resolvedTabWidth = clampPreviewTabWidth(idealTabWidth);
  const isCompactMarkdownTabLabels =
    markdownTabs.length > 0 && idealTabWidth < PREVIEW_TAB_COMPACT_THRESHOLD_PX;
  const hasFolderDifferences = useMemo(
    () => new Set(markdownTabDisplayInfos.map((tab) => tab.folderLabel)).size > 1,
    [markdownTabDisplayInfos],
  );
  const useFolderRowMode =
    markdownTabs.length >= PREVIEW_TAB_FOLDER_MODE_MIN_TABS && hasFolderDifferences;
  const markdownTabFolderEntries = useMemo(() => {
    if (!useFolderRowMode || markdownTabDisplayInfos.length === 0) {
      return [] as MarkdownTabFolderEntry[];
    }
    const seen = new Set<string>();
    const entries: MarkdownTabFolderEntry[] = [];
    markdownTabDisplayInfos.forEach((tab) => {
      if (seen.has(tab.folderLabel)) {
        return;
      }
      seen.add(tab.folderLabel);
      entries.push({
        key: `${tab.folderLabel}-${entries.length}`,
        label: tab.folderLabel,
      });
    });
    return entries;
  }, [markdownTabDisplayInfos, useFolderRowMode]);
  const filteredMarkdownTabDisplayInfos = useMemo(() => {
    if (!useFolderRowMode || !activeMarkdownTabFolderLabel) {
      return markdownTabDisplayInfos;
    }
    return markdownTabDisplayInfos.filter((tab) => tab.folderLabel === activeMarkdownTabFolderLabel);
  }, [activeMarkdownTabFolderLabel, markdownTabDisplayInfos, useFolderRowMode]);
  const resolvedFolderButtonWidth = useMemo(() => {
    if (markdownTabFolderEntries.length === 0) {
      return PREVIEW_FOLDER_BUTTON_MAX_WIDTH_PX;
    }
    const idealFolderButtonWidth = availableTabStripWidth / markdownTabFolderEntries.length;
    return clampPreviewFolderButtonWidth(idealFolderButtonWidth);
  }, [availableTabStripWidth, markdownTabFolderEntries.length]);
  const markdownTabStripStyle = useMemo(
    () =>
      ({
        "--preview-tab-width": `${resolvedTabWidth}px`,
        "--preview-folder-button-width": `${resolvedFolderButtonWidth}px`,
      }) as CSSProperties,
    [resolvedFolderButtonWidth, resolvedTabWidth],
  );

  useEffect(() => {
    if (!useFolderRowMode || markdownTabFolderEntries.length === 0) {
      setActiveMarkdownTabFolderLabel(null);
      return;
    }
    if (!activeMarkdownTabFolderLabel) {
      return;
    }
    const stillExists = markdownTabFolderEntries.some(
      (entry) => entry.label === activeMarkdownTabFolderLabel,
    );
    if (!stillExists) {
      setActiveMarkdownTabFolderLabel(null);
    }
  }, [activeMarkdownTabFolderLabel, markdownTabFolderEntries, useFolderRowMode]);

  const handleMarkdownFolderGroupSelect = useCallback(
    (folderLabel: string) => {
      const isActivatingFolder = activeMarkdownTabFolderLabel !== folderLabel;
      setActiveMarkdownTabFolderLabel((current) => {
        if (current === folderLabel) {
          return null;
        }
        return folderLabel;
      });
      if (!isActivatingFolder) {
        return;
      }

      const nextFolderTabs = markdownTabDisplayInfos.filter((tab) => tab.folderLabel === folderLabel);
      if (nextFolderTabs.length === 0) {
        return;
      }
      const activeTab = markdownTabDisplayInfos.find((tab) => tab.path === activeMarkdownTabPath);
      if (activeTab?.folderLabel === folderLabel) {
        return;
      }
      onSelectMarkdownTab?.(nextFolderTabs[0].path);
    },
    [
      activeMarkdownTabFolderLabel,
      activeMarkdownTabPath,
      markdownTabDisplayInfos,
      onSelectMarkdownTab,
    ],
  );

  useEffect(() => {
    if (!isEditing) {
      rawCodeToggleClosePendingRef.current = false;
      suppressRawEditorBlurExitRef.current = false;
    }
  }, [isEditing]);

  useEffect(() => {
    if (!shouldAutoManageRawCodeEditSession) {
      return;
    }

    if (resolvedEditEnabled) {
      rawCodeToggleClosePendingRef.current = false;
      if (isEditing) {
        return;
      }
      const fallbackCaretIndex = typeof lastCaretIndexRef.current === "number"
        ? Math.max(0, Math.min(lastCaretIndexRef.current, preview.length))
        : preview.length;
      onEditStart({ caretIndex: fallbackCaretIndex, origin: "raw" });
      return;
    }

    if (!isEditing || rawCodeToggleClosePendingRef.current) {
      return;
    }
    rawCodeToggleClosePendingRef.current = true;
    suppressRawEditorBlurExitRef.current = true;
    void onEditExit();
  }, [
    resolvedEditEnabled,
    isEditing,
    onEditExit,
    onEditStart,
    preview.length,
    shouldAutoManageRawCodeEditSession,
  ]);

  return (
    <section
      className="panel preview-panel"
      style={markdownEditorStyle}
      data-editor-mode={editorMode}
      data-edit-enabled={resolvedEditEnabled ? "true" : "false"}
    >
      <div className="panel-header">
        <div>
          <h2>Preview</h2>
          <p className="muted">
            {selectedFile?.relative_path ?? "Keine Datei ausgewaehlt"}
          </p>
        </div>
        <div className="preview-actions">
          <div className="preview-mode-toggle" role="group" aria-label="Editor mode">
            <button
              type="button"
              className={`ghost small preview-mode-button ${isCodeMode ? "active" : ""}`}
              onClick={() => {
                void handleSelectEditorModeClick("code");
              }}
              aria-pressed={isCodeMode}
              disabled={!selectedFile}
              aria-label="Code view"
              title="Code view"
            >
              <CodeIcon />
            </button>
            <button
              type="button"
              className={`ghost small preview-mode-button ${isMarkdownMode ? "active" : ""}`}
              onClick={() => {
                void handleSelectEditorModeClick("markdown");
              }}
              aria-pressed={isMarkdownMode}
              disabled={!selectedFile}
              aria-label="Markdown view"
              title="Markdown view"
            >
              <MarkdownIcon />
            </button>
            <button
              type="button"
              className={`ghost small preview-mode-button ${isHybridMode ? "active" : ""}`}
              onClick={() => {
                void handleSelectEditorModeClick("hybrid");
              }}
              aria-pressed={isHybridMode}
              disabled={!selectedFile}
              aria-label="Markdown hybrid edit mode"
              title="Markdown hybrid edit mode"
            >
              <GridEventIcon />
            </button>
          </div>
          <button
            type="button"
            className={`ghost small preview-mode-button preview-mode-edit-button ${
              resolvedEditEnabled ? "active edit-active" : ""
            } ${isHybridMode ? "is-forced-info" : ""}`}
            onClick={() => {
              void handleEditModeToggle();
            }}
            aria-pressed={resolvedEditEnabled}
            disabled={!canToggleEditMode}
            aria-label={isHybridMode ? "Edit mode (always enabled)" : "Toggle edit mode"}
            title={
              isHybridMode
                ? "Edit mode is always enabled in Markdown hybrid edit mode"
                : documentMode === "write"
                  ? "Edit mode is required while writing"
                  : "Toggle edit mode"
            }
          >
            <EditIcon />
          </button>
          {documentMode === "write" && selectedFile ? (
            <>
              <button
                type="button"
                className="ghost small"
                onClick={() => {
                  void handleWriteCancelClick();
                }}
                disabled={!selectedFile}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary small"
                onClick={() => {
                  void handleWriteSaveClick();
                }}
                disabled={!selectedFile}
              >
                Save
              </button>
            </>
          ) : null}
          {previewState === "loading" ? <span className="chip">Lade...</span> : null}
        </div>
      </div>
      {markdownTabs.length > 0 ? (
        <div
          ref={markdownTabStripRef}
          className={`preview-tab-strip ${useFolderRowMode ? "is-two-row" : ""}`}
          style={markdownTabStripStyle}
        >
          {useFolderRowMode ? (
            <div className="preview-tab-folder-row" role="toolbar" aria-label="Open markdown folders">
              {markdownTabFolderEntries.map((entry) => (
                <div
                  key={entry.key}
                  className="preview-tab-folder-group"
                >
                  <button
                    type="button"
                    className={`preview-tab-folder-button ${
                      activeMarkdownTabFolderLabel === entry.label ? "active" : ""
                    }`}
                    aria-pressed={activeMarkdownTabFolderLabel === entry.label}
                    title={entry.label}
                    onClick={() => handleMarkdownFolderGroupSelect(entry.label)}
                  >
                    <span className="preview-tab-folder-label">{entry.label}</span>
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="preview-tab-row" role="tablist" aria-label="Open markdown files">
            {filteredMarkdownTabDisplayInfos.map((tab) => {
              const isActive = activeMarkdownTabPath === tab.path;
              const visibleLabel = isCompactMarkdownTabLabels ? tab.fileLabel : tab.fullLabel;
              const isDropTarget = markdownTabDropHint?.path === tab.path;
              return (
                <div
                  key={tab.path}
                  className={`preview-tab ${isActive ? "active" : ""} ${
                    dragMarkdownTabPath === tab.path ? "is-drag-source" : ""
                  } ${
                    isDropTarget
                      ? markdownTabDropHint?.position === "before"
                        ? "is-drop-before"
                        : "is-drop-after"
                      : ""
                  }`.trim()}
                  draggable={isMarkdownTabReorderEnabled}
                  onDragStart={(event) =>
                    handleMarkdownTabDragStart(event, tab.path, tab.fullLabel)
                  }
                  onDragOver={(event) => handleMarkdownTabDragOver(event, tab.path)}
                  onDragLeave={(event) => handleMarkdownTabDragLeave(event, tab.path)}
                  onDrop={(event) => handleMarkdownTabDrop(event, tab.path)}
                  onDragEnd={handleMarkdownTabDragEnd}
                >
                  <button
                    type="button"
                    className={`preview-tab-button ${isActive ? "active" : ""}`}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleMarkdownTabSelect(tab.path)}
                    title={tab.fullLabel}
                  >
                    <span className="preview-tab-label">{visibleLabel}</span>
                  </button>
                  {onCloseMarkdownTab ? (
                    <button
                      type="button"
                      className="preview-tab-close"
                      draggable={false}
                      aria-label={`Close ${tab.fullLabel}`}
                      title={`Close ${tab.fullLabel}`}
                      onClick={(event) => handleMarkdownTabClose(event, tab.path)}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="panel-body preview-body">
        {previewState === "error" ? (
          <div className="error">{previewError}</div>
        ) : null}
        {previewState === "idle" && !isCodeMode && previewFrontmatter.hasFrontmatter &&
        previewFrontmatter.error ? (
          <section className="frontmatter-panel frontmatter-panel-error" aria-label="Eigenschaften">
            <div className="frontmatter-header">
              <h3>Eigenschaften</h3>
            </div>
            <div className="error">
              <p>YAML-Frontmatter konnte nicht gelesen werden.</p>
              <p className="frontmatter-parse-message">{previewFrontmatter.error}</p>
            </div>
            <div className="frontmatter-error-actions">
              <button
                type="button"
                className="ghost small"
                onClick={() => {
                  setShowFrontmatterTextFallback((current) => !current);
                }}
              >
                {showFrontmatterTextFallback
                  ? "Frontmatter wieder ausblenden"
                  : "Frontmatter als Text anzeigen"}
              </button>
            </div>
          </section>
        ) : null}
        <div
          className="preview-content"
          onClick={handlePreviewLinkClick}
          onAuxClick={handlePreviewLinkClick}
          onMouseUp={disableLegacyPreviewClick ? undefined : handlePreviewClick}
        >
          <div className="preview-surface">
            {showHybridMarkdownEditor ? (
              <div
                key="markdown-hybrid-edit"
                ref={previewRef}
                className="preview preview-editor markdown md-preview markdown-hybrid-surface"
                data-input-scope="editor"
                onScroll={(event) => captureScroll(event.currentTarget)}
              >
                {showFrontmatterPanel ? (
                  <FrontmatterPropertiesPanel
                    sourceMarkdown={frontmatterPanelSource?.sourceMarkdown ?? preview}
                    properties={frontmatterPanelSource?.properties ?? previewFrontmatter.properties}
                    showPropertiesPanel={frontmatterPanelSource?.showPropertiesPanel ?? true}
                    coverInteractive={canEdit && previewState === "idle" && documentMode !== "write"}
                    sourceRelativePath={sourceRelativePath ?? selectedFile?.relative_path}
                    vaultFiles={vaultFiles}
                    vaultPngAssets={vaultPngAssets}
                    vaultPath={vaultPath}
                    canEdit={
                      canEdit &&
                      previewState === "idle" &&
                      documentMode !== "write"
                    }
                    isCollapsed={effectiveFrontmatterPanelCollapsed}
                    onToggleCollapsed={handleToggleFrontmatterPanelCollapsed}
                    onFrontmatterSave={onFrontmatterSave}
                    onNavigateWikilink={onNavigateWikilink}
                    onOpenTaskProfileEditor={onOpenTaskProfileEditor}
                    taskProfileSummariesByName={taskProfileSummariesByName}
                    valueSuggestionsByKey={valueSuggestionsByKey}
                    keySuggestions={keySuggestions}
                  />
                ) : null}
                <MarkdownHybridEditor
                  ref={hybridEditorRef}
                  historyKey={selectedFile?.path ?? "none"}
                  markdown={markdownEditBody}
                  mode={documentMode}
                  vaultFiles={vaultFiles}
                  vaultPngAssets={vaultPngAssets}
                  vaultPath={vaultPath}
                  sourceHasFrontmatter={editFrontmatter.hasFrontmatter}
                  sourceRelativePath={sourceRelativePath ?? selectedFile?.relative_path}
                  onNavigateWikilink={onNavigateWikilink}
                  onChange={handleHybridBodyChange}
                  onDirtyChange={onHybridDirtyChange}
                  renderPreview={(source) =>
                    renderHybridMarkdownPreview(normalizeTableSpacingForRender(source))}
                />
              </div>
            ) : isEditing && (isCodeMode || showMarkdownEditor) ? (
              isCodeMode ? (
                <textarea
                  key="raw-edit"
                  ref={editorRef}
                  className="preview-editor"
                  data-input-scope="editor"
                  value={editDraft}
                  onChange={(event) => onEditChange(event.target.value)}
                  onBlur={handleRawEditorBlur}
                  onScroll={(event) => captureScroll(event.currentTarget)}
                  aria-label="Edit markdown preview"
                  readOnly={!resolvedEditEnabled}
                />
              ) : showMarkdownEditor ? (
                <div
                  key="markdown-edit"
                  ref={markdownEditorScrollRef}
                  className="preview preview-editor markdown md-preview"
                  data-input-scope="editor"
                  onScroll={(event) => captureScroll(event.currentTarget)}
                >
                  {showFrontmatterPanel ? (
                    <FrontmatterPropertiesPanel
                      sourceMarkdown={frontmatterPanelSource?.sourceMarkdown ?? preview}
                      properties={frontmatterPanelSource?.properties ?? previewFrontmatter.properties}
                      showPropertiesPanel={frontmatterPanelSource?.showPropertiesPanel ?? true}
                      coverInteractive={canEdit && previewState === "idle" && !isEditing}
                      sourceRelativePath={sourceRelativePath ?? selectedFile?.relative_path}
                      vaultFiles={vaultFiles}
                      vaultPngAssets={vaultPngAssets}
                      vaultPath={vaultPath}
                      canEdit={canEdit && previewState === "idle" && !isEditing}
                      isCollapsed={effectiveFrontmatterPanelCollapsed}
                      onToggleCollapsed={handleToggleFrontmatterPanelCollapsed}
                      onFrontmatterSave={onFrontmatterSave}
                      onNavigateWikilink={onNavigateWikilink}
                      onOpenTaskProfileEditor={onOpenTaskProfileEditor}
                      taskProfileSummariesByName={taskProfileSummariesByName}
                      valueSuggestionsByKey={valueSuggestionsByKey}
                      keySuggestions={keySuggestions}
                    />
                  ) : null}
                  <div
                    ref={markdownEditorRef}
                    className="preview-markdown-editable md-preview"
                    data-input-scope="editor"
                    contentEditable
                    suppressContentEditableWarning
                    onBeforeInput={handleMarkdownEditorBeforeInput}
                    onInput={handleMarkdownInput}
                    onBlur={handleMarkdownEditorBlur}
                    onFocus={syncActiveMarkdownHeading}
                    onKeyDown={handleMarkdownEditorKeyDown}
                    onKeyUp={syncActiveMarkdownHeading}
                    onMouseDown={handleMarkdownEditorMouseDown}
                    onMouseUp={syncActiveMarkdownHeading}
                    onClick={handleMarkdownEditorClick}
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Edit markdown preview"
                  />
                </div>
              ) : null
            ) : hasVisiblePreviewContent ? (
              <div
                key={isCodeMode ? "raw-view" : "markdown-view"}
                ref={previewRef}
                className={`preview ${isCodeMode ? "raw" : "markdown"}${
                  isCodeMode ? "" : " md-preview"
                }`}
                onScroll={(event) => captureScroll(event.currentTarget)}
              >
                {isCodeMode ? (
                  <pre>{preview}</pre>
                ) : (
                  <>
                    {showFrontmatterPanel ? (
                      <FrontmatterPropertiesPanel
                        sourceMarkdown={frontmatterPanelSource?.sourceMarkdown ?? preview}
                        properties={frontmatterPanelSource?.properties ?? previewFrontmatter.properties}
                        showPropertiesPanel={frontmatterPanelSource?.showPropertiesPanel ?? true}
                        coverInteractive={false}
                        sourceRelativePath={sourceRelativePath ?? selectedFile?.relative_path}
                        vaultFiles={vaultFiles}
                        vaultPngAssets={vaultPngAssets}
                        vaultPath={vaultPath}
                        canEdit={canEdit && previewState === "idle"}
                        isCollapsed={effectiveFrontmatterPanelCollapsed}
                        onToggleCollapsed={handleToggleFrontmatterPanelCollapsed}
                        onFrontmatterSave={onFrontmatterSave}
                        onNavigateWikilink={onNavigateWikilink}
                        onOpenTaskProfileEditor={onOpenTaskProfileEditor}
                        taskProfileSummariesByName={taskProfileSummariesByName}
                        valueSuggestionsByKey={valueSuggestionsByKey}
                        keySuggestions={keySuggestions}
                      />
                    ) : null}
                    <div ref={markdownViewRef} className="preview-markdown-view-root">
                      {markdownViewItems.map((item, itemIndex) =>
                        item.type === "group" ? (
                          <div
                            key={`group:${item.groupId}:${itemIndex}`}
                            className="preview-markdown-card-group"
                            data-md-card-group-id={item.groupId}
                          >
                            <span
                              className="md-card-group-rail preview-markdown-card-group-rail has-start-cap has-end-cap"
                              aria-hidden="true"
                            />
                            {item.blocks.map((block, blockIndex) =>
                              renderMarkdownViewBlock(
                                block,
                                `group:${item.groupId}:${itemIndex}:${blockIndex}:${block.id}`,
                              )
                            )}
                          </div>
                        ) : (
                          renderMarkdownViewBlock(item.block, `block:${itemIndex}:${item.block.id}`)
                        )
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div key="preview-empty" className="preview placeholder">
                {emptyPreview}
              </div>
            )}
          </div>
        </div>
        {editError ? <div className="error">{editError}</div> : null}
      </div>
    </section>
  );
};
