import katex from "katex";
import "katex/dist/katex.min.css";
import { useEffect, useMemo, useState } from "react";

export const MATH_BLOCK_DELIMITER = "$$";

export const isMathBlockDelimiterLine = (line: string) => /^\s*\$\$\s*$/.test(line);
export const isSingleLineMathBlockLine = (line: string) =>
  !isMathBlockDelimiterLine(line) && /^\s*\$\$[\s\S]*\$\$\s*$/.test(line);

const singleLineMathBlockPattern = /^[ \t]*\$\$([^\r\n]*?)\$\$[ \t]*$/;

type MathBlockBoundaries = {
  body: string;
  contentStart: number;
  contentEnd: number;
  hasOpeningDelimiter: boolean;
  hasClosingDelimiter: boolean;
  closingLineIndex: number;
};

type MathRenderResult =
  | {
      status: "empty";
    }
  | {
      status: "success";
      html: string;
    }
  | {
      status: "error";
      message: string;
      raw: string;
    };

export type MathToolboxCategoryId =
  "fractions" | "scripts" | "roots" | "operators" | "brackets" | "alignment" | "matrices" | "cases";

export type MathToolboxTemplate = {
  id: string;
  label: string;
  categoryId: MathToolboxCategoryId;
  snippet: string;
};

export const MATH_TOOLBOX_SECTIONS: ReadonlyArray<{
  id: MathToolboxCategoryId;
  label: string;
  items: MathToolboxTemplate[];
}> = [
  {
    id: "fractions",
    label: "Fractions",
    items: [
      {
        id: "frac-basic",
        label: "\\frac{a}{b}",
        categoryId: "fractions",
        snippet: String.raw`\frac{[[select]]a[[/select]]}{b}`,
      },
    ],
  },
  {
    id: "scripts",
    label: "Powers / Indices",
    items: [
      {
        id: "power-basic",
        label: "x^{n}",
        categoryId: "scripts",
        snippet: String.raw`x^{[[select]]n[[/select]]}`,
      },
      {
        id: "subscript-basic",
        label: "x_{i}",
        categoryId: "scripts",
        snippet: String.raw`x_{[[select]]i[[/select]]}`,
      },
    ],
  },
  {
    id: "roots",
    label: "Roots",
    items: [
      {
        id: "sqrt-basic",
        label: "\\sqrt{x}",
        categoryId: "roots",
        snippet: String.raw`\sqrt{[[select]]x[[/select]]}`,
      },
      {
        id: "sqrt-n",
        label: "\\sqrt[n]{x}",
        categoryId: "roots",
        snippet: String.raw`\sqrt[[cursor]][[[select]]n[[/select]]]{x}`,
      },
    ],
  },
  {
    id: "operators",
    label: "Sums / Integrals",
    items: [
      {
        id: "sum-basic",
        label: "\\sum_{i=1}^{n}",
        categoryId: "operators",
        snippet: String.raw`\sum_{[[select]]i=1[[/select]]}^{n}`,
      },
      {
        id: "integral-basic",
        label: "\\int_{a}^{b}",
        categoryId: "operators",
        snippet: String.raw`\int_{[[select]]a[[/select]]}^{b}`,
      },
    ],
  },
  {
    id: "brackets",
    label: "Brackets",
    items: [
      {
        id: "left-right-parens",
        label: "\\left( … \\right)",
        categoryId: "brackets",
        snippet: String.raw`\left([[select]]x[[/select]]\right)`,
      },
      {
        id: "left-right-brackets",
        label: "\\left[ … \\right]",
        categoryId: "brackets",
        snippet: String.raw`\left[ [[select]]x[[/select]] \right]`,
      },
    ],
  },
  {
    id: "alignment",
    label: "Alignment",
    items: [
      {
        id: "aligned",
        label: "aligned",
        categoryId: "alignment",
        snippet: [
          String.raw`\begin{aligned}`,
          String.raw`[[select]]a &= b \\`,
          String.raw`c &= d[[/select]]`,
          String.raw`\end{aligned}`,
        ].join("\n"),
      },
    ],
  },
  {
    id: "matrices",
    label: "Matrices",
    items: [
      {
        id: "matrix-basic",
        label: "matrix",
        categoryId: "matrices",
        snippet: [
          String.raw`\begin{matrix}`,
          String.raw`[[select]]a & b \\`,
          String.raw`c & d[[/select]]`,
          String.raw`\end{matrix}`,
        ].join("\n"),
      },
      {
        id: "pmatrix-basic",
        label: "pmatrix",
        categoryId: "matrices",
        snippet: [
          String.raw`\begin{pmatrix}`,
          String.raw`[[select]]a & b \\`,
          String.raw`c & d[[/select]]`,
          String.raw`\end{pmatrix}`,
        ].join("\n"),
      },
    ],
  },
  {
    id: "cases",
    label: "Cases",
    items: [
      {
        id: "cases-basic",
        label: "cases",
        categoryId: "cases",
        snippet: [
          String.raw`\begin{cases}`,
          String.raw`[[select]]x, & x > 0 \\`,
          String.raw`0, & x \le 0[[/select]]`,
          String.raw`\end{cases}`,
        ].join("\n"),
      },
    ],
  },
];

const buildLineStarts = (value: string) => {
  const lines = value.split("\n");
  const starts: number[] = [];
  let offset = 0;

  for (let index = 0; index < lines.length; index += 1) {
    starts.push(offset);
    offset += (lines[index] ?? "").length;
    if (index < lines.length - 1) {
      offset += 1;
    }
  }

  return { lines, starts };
};

export const resolveMathBlockBoundaries = (raw: string): MathBlockBoundaries => {
  const singleLineMatch = raw.match(singleLineMathBlockPattern);
  if (singleLineMatch) {
    const openingMatch = raw.match(/^\s*\$\$\s*/);
    const closingMatch = raw.match(/\s*\$\$\s*$/);
    const rawContentStart = openingMatch?.[0].length ?? 0;
    const rawContentEnd = raw.length - (closingMatch?.[0].length ?? 0);
    const rawContent = raw.slice(rawContentStart, rawContentEnd);
    const leadingTrimWidth = rawContent.length - rawContent.trimStart().length;
    const trailingTrimWidth = rawContent.length - rawContent.trimEnd().length;
    const body = rawContent.trim();
    const contentStart = rawContentStart + leadingTrimWidth;
    const contentEnd = Math.max(contentStart, rawContentEnd - trailingTrimWidth);
    return {
      body,
      contentStart,
      contentEnd,
      hasOpeningDelimiter: true,
      hasClosingDelimiter: true,
      closingLineIndex: 0,
    };
  }

  const { lines, starts } = buildLineStarts(raw);
  const hasOpeningDelimiter = isMathBlockDelimiterLine(lines[0] ?? "");
  const closingLineIndex = hasOpeningDelimiter
    ? lines.findIndex((line, index) => index > 0 && isMathBlockDelimiterLine(line))
    : -1;
  const hasClosingDelimiter = closingLineIndex > 0;

  if (!hasOpeningDelimiter) {
    return {
      body: raw,
      contentStart: 0,
      contentEnd: raw.length,
      hasOpeningDelimiter: false,
      hasClosingDelimiter: false,
      closingLineIndex: -1,
    };
  }

  const contentStart = starts[1] ?? raw.length;
  const closingLineStart = hasClosingDelimiter
    ? (starts[closingLineIndex] ?? raw.length)
    : raw.length;
  const contentEnd = hasClosingDelimiter
    ? Math.max(contentStart, closingLineStart - 1)
    : raw.length;

  return {
    body: raw.slice(contentStart, contentEnd),
    contentStart,
    contentEnd,
    hasOpeningDelimiter: true,
    hasClosingDelimiter,
    closingLineIndex,
  };
};

type MathRenderRuntime = {
  renderToString: (
    source: string,
    options: {
      displayMode: boolean;
      throwOnError: boolean;
      output: "html";
      trust: boolean;
      strict: "warn";
    },
  ) => string;
};

export const extractMathBlockBody = (raw: string) => resolveMathBlockBoundaries(raw).body;

export const normalizeMathBlockSource = (raw: string) => {
  const singleLineMatch = raw.match(singleLineMathBlockPattern);
  if (!singleLineMatch) {
    return raw;
  }
  const body = (singleLineMatch[1] ?? "").trim();
  return [MATH_BLOCK_DELIMITER, body, MATH_BLOCK_DELIMITER].join("\n");
};

type ResolvedTemplateSnippet = {
  text: string;
  selectionStart: number;
  selectionEnd: number;
};

const resolveTemplateSnippet = (template: MathToolboxTemplate): ResolvedTemplateSnippet => {
  const selectionOpen = "[[select]]";
  const selectionClose = "[[/select]]";
  const cursorMarker = "[[cursor]]";
  let text = template.snippet;
  let selectionStart = text.length;
  let selectionEnd = text.length;

  const selectionOpenIndex = text.indexOf(selectionOpen);
  const selectionCloseIndex = text.indexOf(selectionClose);
  if (selectionOpenIndex >= 0 && selectionCloseIndex > selectionOpenIndex) {
    const cursorIndex = text.indexOf(cursorMarker);
    text = text.replace(cursorMarker, "").replace(selectionOpen, "").replace(selectionClose, "");
    const cursorAdjustment =
      cursorIndex >= 0 && cursorIndex < selectionOpenIndex ? cursorMarker.length : 0;
    selectionStart = selectionOpenIndex - cursorAdjustment;
    selectionEnd = selectionCloseIndex - selectionOpen.length - cursorAdjustment;
    return {
      text,
      selectionStart,
      selectionEnd,
    };
  }

  const cursorIndex = text.indexOf(cursorMarker);
  if (cursorIndex >= 0) {
    text = text.replace(cursorMarker, "");
    selectionStart = cursorIndex;
    selectionEnd = cursorIndex;
  }

  return {
    text,
    selectionStart,
    selectionEnd,
  };
};

export const clampMathBlockSelection = (
  raw: string,
  selectionStart: number,
  selectionEnd: number,
) => {
  const boundaries = resolveMathBlockBoundaries(raw);
  const min = boundaries.contentStart;
  const max = boundaries.contentEnd;
  const start = Math.max(min, Math.min(selectionStart, max));
  const end = Math.max(min, Math.min(selectionEnd, max));
  return start <= end ? { start, end } : { start: end, end: start };
};

export const getMathBlockDefaultSelection = (raw: string) => {
  const boundaries = resolveMathBlockBoundaries(raw);
  return {
    start: boundaries.contentStart,
    end: boundaries.contentStart,
  };
};

export const insertMathTemplateIntoRaw = (
  raw: string,
  selectionStart: number,
  selectionEnd: number,
  template: MathToolboxTemplate,
) => {
  const resolvedSelection = clampMathBlockSelection(raw, selectionStart, selectionEnd);
  const snippet = resolveTemplateSnippet(template);
  const nextValue = `${raw.slice(0, resolvedSelection.start)}${snippet.text}${raw.slice(
    resolvedSelection.end,
  )}`;
  const insertionStart = resolvedSelection.start;
  return {
    value: nextValue,
    selection: {
      start: insertionStart + snippet.selectionStart,
      end: insertionStart + snippet.selectionEnd,
    },
  };
};

const katexRuntime = katex as MathRenderRuntime;

const renderKatex = (runtime: MathRenderRuntime, source: string) =>
  runtime.renderToString(source, {
    displayMode: true,
    throwOnError: true,
    output: "html",
    trust: false,
    strict: "warn",
  });

export const renderMathBlockMarkup = (
  source: string,
  runtime?: MathRenderRuntime | null,
): MathRenderResult => {
  const trimmed = source.trim();
  if (!trimmed) {
    return { status: "empty" };
  }
  if (!runtime) {
    return {
      status: "error",
      message: "KaTeX is not available.",
      raw: source,
    };
  }

  try {
    return {
      status: "success",
      html: renderKatex(runtime, trimmed),
    };
  } catch (error) {
    const lines = source
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length > 1) {
      try {
        return {
          status: "success",
          html: lines
            .map(
              (line) =>
                `<div class="markdown-hybrid-math-render-line">${renderKatex(runtime, line)}</div>`,
            )
            .join(""),
        };
      } catch {
        // Fall back to the original error below.
      }
    }

    const message = error instanceof Error ? error.message : "Unable to render LaTeX.";
    return {
      status: "error",
      message,
      raw: source,
    };
  }
};

const useDebouncedValue = (value: string, delayMs: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebouncedValue(value);
      return;
    }
    const handle = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);
    return () => window.clearTimeout(handle);
  }, [delayMs, value]);

  return debouncedValue;
};

export const MathBlockRenderer = ({
  source,
  debounceMs = 0,
}: {
  source: string;
  debounceMs?: number;
}) => {
  const debouncedSource = useDebouncedValue(source, debounceMs);

  const renderResult = useMemo(
    () => renderMathBlockMarkup(debouncedSource, katexRuntime),
    [debouncedSource],
  );

  if (renderResult.status === "empty") {
    return (
      <div className="markdown-hybrid-math-placeholder" aria-hidden="true">
        Display math preview
      </div>
    );
  }

  if (renderResult.status === "error") {
    return (
      <div className="markdown-hybrid-math-error" role="status" aria-live="polite">
        <div className="markdown-hybrid-math-error-message">
          Invalid LaTeX: {renderResult.message}
        </div>
        <pre className="markdown-hybrid-math-error-raw">{renderResult.raw}</pre>
      </div>
    );
  }

  return (
    <div
      className="markdown-hybrid-math-katex"
      dangerouslySetInnerHTML={{ __html: renderResult.html }}
    />
  );
};
