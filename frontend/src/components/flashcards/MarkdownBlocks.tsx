/**
 * @file frontend/src/components/flashcards/MarkdownBlocks.tsx
 *
 * Zweck:
 * - Rendert Markdown-Inhalte in Flashcards konsistent mit der Preview-Pipeline.
 * - Unterstuetzt Cloze-Placeholder, Tabellen, Mathe und Media-Segmente.
 */

import {
  Children,
  Fragment,
  createContext,
  cloneElement,
  isValidElement,
  useContext,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type CSSProperties,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { splitMarkdownMediaSegments } from "../../lib/cardMedia";
import {
  normalizeInlineFormattingForPreview,
  remarkPreserveOrderedListDelimiters,
  remarkPreserveSoftBreaks,
  resolveOrderedListDelimiter,
} from "../../lib/markdownPreviewShared";
import {
  resolveMarkdownTableCellSegments,
  SHARED_TABLE_CELL_IMAGE_CLASS,
  SHARED_TABLE_CELL_MEDIA_CLASS,
  SHARED_TABLE_WRAP_CLASS,
} from "../../lib/markdownTableCellMedia";
import { renderMarkdownMathNode } from "../../lib/markdownMath";
import { flattenCodeTextContent } from "../../lib/markdownCodeHighlight";
import type { VaultPngAsset } from "../../lib/tree";
import { MarkdownHighlightedPre } from "../MarkdownHighlightedPre";
import { extractSvgCodeBlockSource } from "../markdownSvg";
import { FlashcardMediaGroup } from "./FlashcardMediaGroup";
import { SvgPreviewBlock } from "./SvgPreviewBlock";

export const CLOZE_PLACEHOLDER_PREFIX = "@@@CLOZE:";
export const CLOZE_PLACEHOLDER_SUFFIX = "@@@";

const buildPlaceholder = (id: string) =>
  `${CLOZE_PLACEHOLDER_PREFIX}${id}${CLOZE_PLACEHOLDER_SUFFIX}`;

const placeholderTokenPattern = /@@@CLOZE:([^@]+?)@@@/g;

type PlaceholderRenderer = ((id: string) => ReactNode) | undefined;

type PlaceholderRenderContextValue = {
  renderPlaceholderRef: { current: PlaceholderRenderer };
};

const PlaceholderRenderContext = createContext<PlaceholderRenderContextValue | null>(
  null,
);

const PlaceholderSlot = ({ id }: { id: string }) => {
  const context = useContext(PlaceholderRenderContext);
  const resolver = context?.renderPlaceholderRef.current;
  if (!resolver) {
    return buildPlaceholder(id);
  }
  const rendered = resolver(id);
  if (rendered === null || rendered === undefined) {
    return buildPlaceholder(id);
  }
  return <>{rendered}</>;
};

const markdownSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "br",
    "del",
    "mark",
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
    mark: [...(defaultSchema.attributes?.mark ?? []), "className"],
    ol: [...(defaultSchema.attributes?.ol ?? []), "data-md-ordered-delimiter"],
    table: [...(defaultSchema.attributes?.table ?? []), "className"],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
  },
};

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

const readMarkdownNodeStartPosition = (
  node: unknown,
): { offset?: number; line?: number } | undefined => {
  if (
    !node ||
    typeof node !== "object" ||
    !("position" in node) ||
    !node.position ||
    typeof node.position !== "object" ||
    !("start" in node.position) ||
    !node.position.start ||
    typeof node.position.start !== "object"
  ) {
    return undefined;
  }
  const start = node.position.start as {
    offset?: number;
    line?: number;
  };
  return {
    offset: typeof start.offset === "number" ? start.offset : undefined,
    line: typeof start.line === "number" ? start.line : undefined,
  };
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

const shouldSkipFlashcardRichTransform = (tagName: string | null) =>
  tagName === "code" ||
  tagName === "pre" ||
  tagName === "kbd" ||
  tagName === "samp" ||
  tagName === "svg" ||
  tagName === "path" ||
  tagName === "button" ||
  tagName === "input" ||
  tagName === "textarea";

const hasClozePlaceholderToken = (value: string) => {
  placeholderTokenPattern.lastIndex = 0;
  return placeholderTokenPattern.test(value);
};

const renderTextWithPlaceholders = (
  value: string,
  keyPrefix: string,
): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let placeholderOccurrence = 0;
  placeholderTokenPattern.lastIndex = 0;

  while ((match = placeholderTokenPattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(value.slice(lastIndex, match.index));
    }
    const placeholderId = match[1] ?? "";
    nodes.push(
      <PlaceholderSlot
        id={placeholderId}
        key={`${keyPrefix}-placeholder-${placeholderId}-${placeholderOccurrence}`}
      />,
    );
    placeholderOccurrence += 1;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes;
};

const resolveCodeElement = (children: ReactNode): ReactElement<ComponentPropsWithoutRef<"code">> | null => {
  const codeNode = Children.toArray(children).find(
    (node) => isValidElement(node) && typeof node.type === "string" && node.type.toLowerCase() === "code",
  );
  if (!codeNode || !isValidElement<ComponentPropsWithoutRef<"code">>(codeNode)) {
    return null;
  }
  return codeNode as ReactElement<ComponentPropsWithoutRef<"code">>;
};

const resolveCodeText = (children: ReactNode): string | null => {
  const codeElement = resolveCodeElement(children);
  if (!codeElement) {
    return null;
  }
  const codeProps = codeElement.props as ComponentPropsWithoutRef<"code">;
  return flattenCodeTextContent(codeProps.children ?? null);
};

const renderTextWithMathAndPlaceholders = (
  value: string,
  keyPrefix: string,
): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  placeholderTokenPattern.lastIndex = 0;
  let segmentIndex = 0;
  let placeholderOccurrence = 0;

  while ((match = placeholderTokenPattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      const textPart = value.slice(lastIndex, match.index);
      nodes.push(
        ...renderMarkdownMathNode(textPart, {
          keyPrefix: `${keyPrefix}-text-${segmentIndex}`,
        }),
      );
      segmentIndex += 1;
    }

    const placeholderId = match[1] ?? "";
    nodes.push(
      <PlaceholderSlot
        id={placeholderId}
        key={`${keyPrefix}-placeholder-${placeholderId}-${placeholderOccurrence}`}
      />,
    );
    placeholderOccurrence += 1;
    segmentIndex += 1;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    nodes.push(
      ...renderMarkdownMathNode(value.slice(lastIndex), {
        keyPrefix: `${keyPrefix}-tail-${segmentIndex}`,
      }),
    );
  }

  return nodes;
};

const renderFlashcardRichNode = (
  node: ReactNode,
  keyPrefix: string,
): ReactNode => {
  if (typeof node === "string") {
    const rendered = renderTextWithMathAndPlaceholders(node, keyPrefix);
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
  if (shouldSkipFlashcardRichTransform(tagName)) {
    return node;
  }
  const rawChildren = node.props.children;
  if (rawChildren == null) {
    return node;
  }
  const nextChildren = Children.map(rawChildren, (child, index) =>
    renderFlashcardRichNode(child, `${keyPrefix}-${index}`),
  );
  return cloneElement(node, undefined, nextChildren);
};

const renderFlashcardRichChildren = (children: ReactNode, keyPrefix: string) =>
  Children.map(children, (child, index) =>
    renderFlashcardRichNode(child, `${keyPrefix}-${index}`),
  );

type MarkdownBlocksProps = {
  text: string;
  className?: string;
  allowTableScroll?: boolean;
  renderPlaceholder?: (id: string) => ReactNode;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
};

const renderFlashcardInlineMarkdown = (
  source: string,
  keyPrefix: string,
) => {
  const normalizedSource = normalizeInlineFormattingForPreview(source);
  return (
    <ReactMarkdown
      key={`${keyPrefix}-markdown`}
      remarkPlugins={[
        remarkGfm,
        remarkPreserveSoftBreaks,
        remarkPreserveOrderedListDelimiters,
      ]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema]]}
      components={{
        p: ({ node: _node, children, ...props }) => (
          <p {...props}>
            {renderFlashcardRichChildren(children, `${keyPrefix}-p`)}
          </p>
        ),
        ol: ({ node, ...props }) => {
          const delimiterFromNode = readMarkdownElementProperty(node, "data-md-ordered-delimiter");
          const delimiterFromPosition = resolveOrderedListDelimiter(
            normalizedSource,
            readMarkdownNodeStartPosition(node),
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
            {renderFlashcardRichChildren(children, `${keyPrefix}-li`)}
          </li>
        ),
      }}
    >
      {normalizedSource}
    </ReactMarkdown>
  );
};

export const MarkdownBlocks = ({
  text,
  className,
  allowTableScroll = true,
  renderPlaceholder,
  vaultPath,
  vaultPngAssets,
}: MarkdownBlocksProps) => {
  const renderPlaceholderRef = useRef<PlaceholderRenderer>(renderPlaceholder);
  renderPlaceholderRef.current = renderPlaceholder;
  const placeholderRenderContext = useMemo<PlaceholderRenderContextValue>(
    () => ({ renderPlaceholderRef }),
    [renderPlaceholder],
  );
  const segments = useMemo(
    () => splitMarkdownMediaSegments(text, "flashcard-markdown"),
    [text],
  );
  const containerClass = useMemo(
    () => ["flashcard-markdown", className].filter(Boolean).join(" "),
    [className],
  );
  const tableClass = useMemo(
    () =>
      [
        "flashcard-table",
        allowTableScroll ? "scrollable" : "no-scroll",
        SHARED_TABLE_WRAP_CLASS,
      ].join(" "),
    [allowTableScroll],
  );

  const renderedSegments = useMemo(() => {
    const renderTableCellContent = ({
      node,
      children,
      keyPrefix,
      markdownSource,
    }: {
      node: unknown;
      children: ReactNode;
      keyPrefix: string;
      markdownSource: string;
    }) => {
      const cellSource = readMarkdownNodeSource(node, markdownSource);
      const cellText = readMarkdownNodeText(node);
      const resolvedSegments = resolveMarkdownTableCellSegments({
        cellSource,
        cellText,
        scope: `flashcard-table-cell-${keyPrefix}`,
      });
      const hasMediaSegments = resolvedSegments.some(
        (segment) => segment.kind !== "text",
      );
      if (!hasMediaSegments) {
        return renderFlashcardRichChildren(children, keyPrefix);
      }

      return resolvedSegments.map((segment, index) => {
        const segmentKey = `${keyPrefix}-segment-${index}`;
        if (segment.kind === "text") {
          return (
            <Fragment key={segmentKey}>
              {renderFlashcardInlineMarkdown(
                segment.text,
                `${segmentKey}-text`,
              )}
            </Fragment>
          );
        }
        if (segment.kind === "media") {
          return (
            <div
              className={`flashcard-table-cell-media ${SHARED_TABLE_CELL_MEDIA_CLASS}`}
              key={segmentKey}
            >
              <FlashcardMediaGroup
                media={segment.items}
                vaultPngAssets={vaultPngAssets}
                vaultPath={vaultPath}
              />
            </div>
          );
        }
        return (
          <div
            className={`flashcard-table-cell-media ${SHARED_TABLE_CELL_MEDIA_CLASS}`}
            key={segmentKey}
          >
            <img
              src={segment.src}
              alt={segment.alt ?? ""}
              title={segment.title}
              className={`flashcard-table-cell-image ${SHARED_TABLE_CELL_IMAGE_CLASS}`}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </div>
        );
      });
    };

    const renderMarkdownSegment = (source: string, keyPrefix: string) => {
      const normalizedSource = normalizeInlineFormattingForPreview(source);
      return (
        <ReactMarkdown
          key={`${keyPrefix}-markdown`}
          remarkPlugins={[
            remarkGfm,
            remarkPreserveSoftBreaks,
            remarkPreserveOrderedListDelimiters,
          ]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema]]}
          components={{
            h1: ({ node: _node, children, ...props }) => (
              <h1 {...props}>
                {renderFlashcardRichChildren(children, `${keyPrefix}-h1`)}
              </h1>
            ),
            h2: ({ node: _node, children, ...props }) => (
              <h2 {...props}>
                {renderFlashcardRichChildren(children, `${keyPrefix}-h2`)}
              </h2>
            ),
            h3: ({ node: _node, children, ...props }) => (
              <h3 {...props}>
                {renderFlashcardRichChildren(children, `${keyPrefix}-h3`)}
              </h3>
            ),
            h4: ({ node: _node, children, ...props }) => (
              <h4 {...props}>
                {renderFlashcardRichChildren(children, `${keyPrefix}-h4`)}
              </h4>
            ),
            h5: ({ node: _node, children, ...props }) => (
              <h5 {...props}>
                {renderFlashcardRichChildren(children, `${keyPrefix}-h5`)}
              </h5>
            ),
            h6: ({ node: _node, children, ...props }) => (
              <h6 {...props}>
                {renderFlashcardRichChildren(children, `${keyPrefix}-h6`)}
              </h6>
            ),
            p: ({ node: _node, children, ...props }) => (
              <p {...props}>
                {renderFlashcardRichChildren(children, `${keyPrefix}-p`)}
              </p>
            ),
            ol: ({ node, ...props }) => {
              const delimiterFromNode = readMarkdownElementProperty(
                node,
                "data-md-ordered-delimiter",
              );
              const delimiterFromPosition = resolveOrderedListDelimiter(
                normalizedSource,
                readMarkdownNodeStartPosition(node),
              );
              if (delimiterFromNode !== ")" && delimiterFromPosition !== ")") {
                return <ol {...props} />;
              }
              const startRaw = props.start;
              const startValue = typeof startRaw === "number"
                ? startRaw
                : Number.parseInt(String(startRaw ?? "1"), 10);
              const previous = Number.isNaN(startValue)
                ? 0
                : Math.max(0, startValue - 1);
              const style = {
                ...(props.style ?? {}),
                "--md-ordered-start": String(previous),
              } as CSSProperties;
              return (
                <ol {...props} style={style} data-md-ordered-delimiter=")" />
              );
            },
            li: ({ node: _node, children, ...props }) => (
              <li {...props}>
                {renderFlashcardRichChildren(children, `${keyPrefix}-li`)}
              </li>
            ),
            blockquote: ({ node: _node, children, ...props }) => (
              <blockquote {...props}>
                {renderFlashcardRichChildren(children, `${keyPrefix}-blockquote`)}
              </blockquote>
            ),
            pre: ({ node: _node, children, ...props }) => {
              const codeText = resolveCodeText(children);
              const hasClozePlaceholders = typeof codeText === "string" &&
                hasClozePlaceholderToken(codeText);
              const svgSource = hasClozePlaceholders ? null : extractSvgCodeBlockSource(children);
              if (svgSource !== null) {
                return (
                  <SvgPreviewBlock
                    source={svgSource}
                    className="md-svg-preview-block"
                  />
                );
              }
              const preClassName = ["flashcard-code-block", props.className]
                .filter(Boolean)
                .join(" ");
              if (hasClozePlaceholders && typeof codeText === "string") {
                const codeElement = resolveCodeElement(children);
                const codeProps = codeElement?.props as ComponentPropsWithoutRef<"code"> | undefined;
                if (codeProps) {
                  const {
                    className: codeClassName,
                    children: _ignoredCodeChildren,
                    ...restCodeProps
                  } = codeProps;
                  return (
                    <pre
                      {...props}
                      className={`${preClassName} flashcard-code-block-cloze`}
                      data-md-code-highlighted="false"
                    >
                      <code
                        {...restCodeProps}
                        className={codeClassName}
                        data-md-code-highlighted="false"
                      >
                        {renderTextWithPlaceholders(codeText, `${keyPrefix}-code`)}
                      </code>
                    </pre>
                  );
                }
              }
              return (
                <MarkdownHighlightedPre {...props} className={preClassName}>
                  {children}
                </MarkdownHighlightedPre>
              );
            },
            table: ({ node: _node, ...props }) => (
              <div className={tableClass}>
                <table {...props} />
              </div>
            ),
            th: ({ node: tableNode, children, ...props }) => (
              <th {...props}>
                {renderTableCellContent({
                  node: tableNode,
                  children,
                  keyPrefix: `${keyPrefix}-th`,
                  markdownSource: normalizedSource,
                })}
              </th>
            ),
            td: ({ node: tableNode, children, ...props }) => (
              <td {...props}>
                {renderTableCellContent({
                  node: tableNode,
                  children,
                  keyPrefix: `${keyPrefix}-td`,
                  markdownSource: normalizedSource,
                })}
              </td>
            ),
          }}
        >
          {normalizedSource}
        </ReactMarkdown>
      );
    };

    return segments.map((segment, segmentIndex) => {
      if (segment.kind === "media") {
        return (
          <FlashcardMediaGroup
            key={`media-${segmentIndex}`}
            media={segment.items}
            vaultPngAssets={vaultPngAssets}
            vaultPath={vaultPath}
          />
        );
      }
      return (
        <Fragment key={`markdown-${segmentIndex}`}>
          {renderMarkdownSegment(segment.source, `segment-${segmentIndex}`)}
        </Fragment>
      );
    });
  }, [segments, tableClass, vaultPngAssets, vaultPath]);

  return (
    <PlaceholderRenderContext.Provider value={placeholderRenderContext}>
      <div className={containerClass}>{renderedSegments}</div>
    </PlaceholderRenderContext.Provider>
  );
};
