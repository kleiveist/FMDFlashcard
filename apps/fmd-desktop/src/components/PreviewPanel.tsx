import { type MouseEvent, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";

const markdownSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
  ],
  attributes: {
    ...defaultSchema.attributes,
    table: [...(defaultSchema.attributes?.table ?? []), "className"],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
  },
};

type PreviewPanelProps = {
  editDraft: string;
  editError: string;
  editCaretIndex: number | null;
  isEditing: boolean;
  emptyPreview: string;
  preview: string;
  previewError: string;
  previewState: LoadState;
  rawPreview: boolean;
  selectedFile: VaultFile | null;
  canEdit: boolean;
  onEditChange: (value: string) => void;
  onEditCaretApplied: () => void;
  onEditExit: () => void;
  onEditStart: (options?: {
    caretIndex?: number | null;
    origin?: "raw" | "markdown";
  }) => void;
  onToggleRawPreview: () => void;
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
  if ("caretRangeFromPoint" in document) {
    return (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null })
      .caretRangeFromPoint?.(x, y) ?? null;
  }
  if ("caretPositionFromPoint" in document) {
    const position = (
      document as Document & {
        caretPositionFromPoint?: (
          x: number,
          y: number,
        ) => { offsetNode: Node; offset: number } | null;
      }
    ).caretPositionFromPoint?.(x, y);
    if (position) {
      const range = document.createRange();
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

const mapPlainOffsetToRawIndex = (rawMarkdown: string, plainOffset: number) => {
  if (plainOffset <= 0) {
    return 0;
  }
  let rawIndex = 0;
  let plainIndex = 0;
  let inFence = false;
  let inInlineCode = false;
  let inLinkText = false;
  let inLinkUrl = false;
  let lineStart = true;

  const skipToLineEnd = () => {
    while (rawIndex < rawMarkdown.length && rawMarkdown[rawIndex] !== "\n") {
      rawIndex += 1;
    }
  };

  while (rawIndex < rawMarkdown.length) {
    const char = rawMarkdown[rawIndex];

    if (lineStart && rawMarkdown.startsWith("```", rawIndex)) {
      inFence = !inFence;
      skipToLineEnd();
      continue;
    }

    if (char === "\n") {
      lineStart = true;
      if (plainIndex >= plainOffset) {
        return rawIndex;
      }
      plainIndex += 1;
      rawIndex += 1;
      continue;
    }

    if (lineStart && !inFence) {
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
      if (
        (char === "-" || char === "*" || char === "+") &&
        rawMarkdown[rawIndex + 1] === " "
      ) {
        rawIndex += 2;
        continue;
      }
      if (char >= "0" && char <= "9") {
        const markerStart = rawIndex;
        while (rawMarkdown[rawIndex] >= "0" && rawMarkdown[rawIndex] <= "9") {
          rawIndex += 1;
        }
        if (
          rawMarkdown[rawIndex] === "." &&
          rawMarkdown[rawIndex + 1] === " "
        ) {
          rawIndex += 2;
          continue;
        }
        rawIndex = markerStart;
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

    if (plainIndex >= plainOffset) {
      return rawIndex;
    }
    plainIndex += 1;
    rawIndex += 1;
  }

  return rawMarkdown.length;
};

const mapRawIndexToPlainOffset = (rawMarkdown: string, rawIndexTarget: number) => {
  if (rawIndexTarget <= 0) {
    return 0;
  }
  const target = Math.min(rawIndexTarget, rawMarkdown.length);
  let rawIndex = 0;
  let plainIndex = 0;
  let inFence = false;
  let inInlineCode = false;
  let inLinkText = false;
  let inLinkUrl = false;
  let lineStart = true;

  const skipToLineEnd = () => {
    while (rawIndex < rawMarkdown.length && rawMarkdown[rawIndex] !== "\n") {
      rawIndex += 1;
    }
  };

  while (rawIndex < rawMarkdown.length && rawIndex < target) {
    const char = rawMarkdown[rawIndex];

    if (lineStart && rawMarkdown.startsWith("```", rawIndex)) {
      inFence = !inFence;
      skipToLineEnd();
      continue;
    }

    if (char === "\n") {
      lineStart = true;
      plainIndex += 1;
      rawIndex += 1;
      continue;
    }

    if (lineStart && !inFence) {
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
      if (
        (char === "-" || char === "*" || char === "+") &&
        rawMarkdown[rawIndex + 1] === " "
      ) {
        rawIndex += 2;
        continue;
      }
      if (char >= "0" && char <= "9") {
        const markerStart = rawIndex;
        while (rawMarkdown[rawIndex] >= "0" && rawMarkdown[rawIndex] <= "9") {
          rawIndex += 1;
        }
        if (
          rawMarkdown[rawIndex] === "." &&
          rawMarkdown[rawIndex + 1] === " "
        ) {
          rawIndex += 2;
          continue;
        }
        rawIndex = markerStart;
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

const setCaretAtPlainOffset = (container: HTMLElement, offset: number) => {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const length = container.innerText.length;
  const clampedOffset = Math.max(0, Math.min(offset, length));
  const resolved = findTextNodeAtOffset(container, clampedOffset);
  const range = document.createRange();
  if (resolved) {
    range.setStart(resolved.node, resolved.offset);
  } else {
    range.setStart(container, 0);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

const escapeMarkdownText = (text: string) =>
  text
    .replace(/\u00a0/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\~");

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
  return `${fence}\n${trimmed}\n${fence}\n\n`;
};

type MarkdownSerializeContext = {
  listDepth: number;
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
    return escapeMarkdownText(node.nodeValue ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (tag === "br") {
    return "\n";
  }

  if (tag === "p" || tag === "div") {
    const content = serializeMarkdownChildren(element, context).trim();
    return content ? `${content}\n\n` : "\n\n";
  }

  if (tag.startsWith("h") && tag.length === 2) {
    const level = Number(tag[1]);
    if (!Number.isNaN(level)) {
      const content = serializeMarkdownChildren(element, context).trim();
      return `${"#".repeat(level)} ${content}\n\n`;
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
    const code = element.querySelector("code")?.textContent ?? element.textContent ?? "";
    return wrapCodeBlock(code);
  }

  if (tag === "blockquote") {
    const content = serializeMarkdownChildren(element, context)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const lines = content.split("\n");
    return `${lines.map((line) => (line ? `> ${line}` : ">")).join("\n")}\n\n`;
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
    return "---\n\n";
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

  items.forEach((item, itemIndex) => {
    const content = serializeMarkdownChildren(item, {
      ...context,
      listDepth: context.listDepth + 1,
    })
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const marker = isOrdered ? `${index + itemIndex}. ` : "- ";
    const itemLines = content ? content.split("\n") : [""];
    lines.push(`${indent}${marker}${itemLines[0]}`);
    itemLines.slice(1).forEach((line) => {
      lines.push(`${indent}  ${line}`);
    });
  });

  return `${lines.join("\n")}\n\n`;
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

  return `${[headerLine, separatorLine, ...bodyLines].join("\n")}\n\n`;
};

const serializeTableCell = (
  element: HTMLElement,
  context: MarkdownSerializeContext,
) => {
  const text = serializeMarkdownChildren(element, context)
    .replace(/\n+/g, " ")
    .trim();
  return escapeMarkdownTableCell(text);
};

const serializeMarkdownFromHtml = (container: HTMLElement) => {
  const markdown = serializeMarkdownChildren(container, { listDepth: 0 });
  return markdown.replace(/\n{3,}/g, "\n\n").trimEnd();
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
) => {
  const resolvedRange = range ?? getSelectionRange(container);
  if (!resolvedRange) {
    return null;
  }
  const plainOffset = getRangeOffset(container, resolvedRange);
  if (rawMarkdown.length === 0) {
    return 0;
  }
  return mapPlainOffsetToRawIndex(rawMarkdown, plainOffset);
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
  rawPreview,
  selectedFile,
  canEdit,
  onEditChange,
  onEditCaretApplied,
  onEditExit,
  onEditStart,
  onToggleRawPreview,
}: PreviewPanelProps) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const markdownEditorRef = useRef<HTMLDivElement | null>(null);
  const markdownEditorHtmlRef = useRef<string | null>(null);
  const markdownEditorReadyRef = useRef(false);

  useEffect(() => {
    if (!isEditing || rawPreview) {
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
  }, [isEditing, rawPreview]);

  useEffect(() => {
    if (!isEditing || !rawPreview || !editorRef.current) {
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
      onEditCaretApplied();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [editCaretIndex, isEditing, onEditCaretApplied, rawPreview]);

  useEffect(() => {
    if (!isEditing || rawPreview || !markdownEditorRef.current) {
      return;
    }
    if (typeof editCaretIndex !== "number") {
      return;
    }
    const editor = markdownEditorRef.current;
    const plainOffset = mapRawIndexToPlainOffset(editDraft, editCaretIndex);
    const handle = window.requestAnimationFrame(() => {
      editor.focus();
      setCaretAtPlainOffset(editor, plainOffset);
      onEditCaretApplied();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [editCaretIndex, editDraft, isEditing, onEditCaretApplied, rawPreview]);

  const handlePreviewClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!canEdit || isEditing) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      const origin = rawPreview ? "raw" : "markdown";
      let caretIndex = preview.length === 0 ? 0 : null;
      if (previewRef.current) {
        const selection = getSelectionRange(previewRef.current);
        if (selection && !selection.collapsed) {
          return;
        }
        const range = getRangeFromEvent(event, previewRef.current);
        const resolvedIndex = rawPreview
          ? resolveRawCaretIndex(previewRef.current, range)
          : resolveMarkdownCaretIndex(previewRef.current, preview, range);
        if (typeof resolvedIndex === "number") {
          caretIndex = resolvedIndex;
        }
        if (!rawPreview) {
          markdownEditorHtmlRef.current = previewRef.current.innerHTML;
        }
      } else if (!rawPreview) {
        markdownEditorHtmlRef.current = "";
      }
      if (caretIndex === null && preview.length > 0) {
        caretIndex = preview.length;
      }
      onEditStart({ caretIndex, origin });
    },
    [canEdit, isEditing, onEditStart, preview, rawPreview],
  );

  const handleMarkdownInput = useCallback(() => {
    if (!markdownEditorRef.current) {
      return;
    }
    const nextValue = serializeMarkdownFromHtml(markdownEditorRef.current);
    onEditChange(nextValue);
  }, [onEditChange]);

  return (
    <section className="panel preview-panel">
      <div className="panel-header">
        <div>
          <h2>Vorschau</h2>
          <p className="muted">
            {selectedFile?.relative_path ?? "Keine Datei ausgewaehlt"}
          </p>
        </div>
        <div className="preview-actions">
          <button
            type="button"
            className={`ghost small ${rawPreview ? "active" : ""}`}
            onClick={onToggleRawPreview}
            aria-pressed={rawPreview}
            disabled={!selectedFile}
          >
            {rawPreview ? "Markdown" : "Rohtext"}
          </button>
          {previewState === "loading" ? <span className="chip">Lade...</span> : null}
        </div>
      </div>
      <div className="panel-body preview-body">
        {previewState === "error" ? (
          <div className="error">{previewError}</div>
        ) : null}
        <div className="preview-content" onMouseUp={handlePreviewClick}>
          {isEditing ? (
            rawPreview ? (
              <textarea
                ref={editorRef}
                className="preview-editor"
                value={editDraft}
                onChange={(event) => onEditChange(event.target.value)}
                onBlur={onEditExit}
                aria-label="Edit markdown preview"
              />
            ) : (
              <div
                ref={markdownEditorRef}
                className="preview preview-editor markdown"
                contentEditable
                suppressContentEditableWarning
                onInput={handleMarkdownInput}
                onBlur={onEditExit}
                role="textbox"
                aria-multiline="true"
                aria-label="Edit markdown preview"
              />
            )
          ) : preview ? (
            <div
              ref={previewRef}
              className={`preview ${rawPreview ? "raw" : "markdown"}`}
            >
              {rawPreview ? (
                <pre>{preview}</pre>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[[rehypeSanitize, markdownSchema]]}
                  components={{
                    table: ({ node: _node, ...props }) => (
                      <div className="markdown-table">
                        <table {...props} />
                      </div>
                    ),
                  }}
                >
                  {preview}
                </ReactMarkdown>
              )}
            </div>
          ) : (
            <div className="preview placeholder">{emptyPreview}</div>
          )}
        </div>
        {editError ? <div className="error">{editError}</div> : null}
      </div>
    </section>
  );
};
