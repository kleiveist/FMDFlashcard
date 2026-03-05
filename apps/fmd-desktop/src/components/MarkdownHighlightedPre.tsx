import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from "react";
import {
  extractRawLanguageFromClassName,
  flattenCodeTextContent,
  formatCodeLanguageLabel,
  normalizeLanguage,
  useMarkdownCodeHighlight,
} from "../lib/markdownCodeHighlight";
import { MARKDOWN_CODE_HIGHLIGHT_CONFIG } from "../lib/markdownCodeHighlightConfig";

type MarkdownHighlightedPreProps = ComponentPropsWithoutRef<"pre"> & {
  highlightSchedule?: "idle" | "immediate";
  autoDetectWithoutLanguage?: boolean;
  autoDetectCandidateLanguages?: readonly string[];
  showLanguageLabel?: boolean;
};

const joinClassName = (...values: Array<string | null | undefined>) =>
  values.filter(Boolean).join(" ");

const sanitizeCodeClassNames = (
  className: string | undefined,
  highlighted: boolean,
  language: string | null,
) => {
  const base = (className ?? "")
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => !entry.startsWith("hljs") && !/^language-/i.test(entry) && !/^lang-/i.test(entry));

  if (highlighted) {
    base.unshift("hljs");
  }
  if (language) {
    base.push(`language-${language}`);
  }

  return Array.from(new Set(base)).join(" ");
};

const resolveCodeElement = (children: ReactNode) =>
  Children.toArray(children).find(
    (node) => isValidElement(node) && typeof node.type === "string" && node.type.toLowerCase() === "code",
  ) ?? null;

export const MarkdownHighlightedPre = ({
  children,
  className,
  highlightSchedule = "idle",
  autoDetectWithoutLanguage = MARKDOWN_CODE_HIGHLIGHT_CONFIG.autoDetectWithoutLanguage,
  autoDetectCandidateLanguages = MARKDOWN_CODE_HIGHLIGHT_CONFIG.autoDetectCandidateLanguages,
  showLanguageLabel = MARKDOWN_CODE_HIGHLIGHT_CONFIG.showLanguageLabel,
  ...preProps
}: MarkdownHighlightedPreProps) => {
  const codeElement = resolveCodeElement(children);
  if (!codeElement || !isValidElement(codeElement)) {
    return (
      <pre {...preProps} className={className}>
        {children}
      </pre>
    );
  }

  const codeProps = codeElement.props as ComponentPropsWithoutRef<"code">;
  const codeText = flattenCodeTextContent(codeProps.children ?? null);
  if (codeText === null) {
    return (
      <pre {...preProps} className={className}>
        {children}
      </pre>
    );
  }

  const requestedLanguageRaw =
    extractRawLanguageFromClassName(codeProps.className) ??
    extractRawLanguageFromClassName(className);
  const requestedLanguage = normalizeLanguage(requestedLanguageRaw);

  const result = useMarkdownCodeHighlight({
    code: codeText,
    language: requestedLanguageRaw,
    autoDetectWithoutLanguage,
    autoDetectCandidateLanguages,
    schedule: highlightSchedule,
  });

  const effectiveLanguage = result.language ?? requestedLanguage;
  const languageLabel =
    showLanguageLabel && effectiveLanguage
      ? (result.languageLabel ?? formatCodeLanguageLabel(effectiveLanguage))
      : null;

  const codeClassName = sanitizeCodeClassNames(
    codeProps.className,
    result.highlighted,
    effectiveLanguage,
  );

  const {
    className: _ignoredCodeClassName,
    children: _ignoredCodeChildren,
    ...restCodeProps
  } = codeProps;

  return (
    <pre
      {...preProps}
      className={joinClassName(className, "md-code-highlighted-pre")}
      data-md-code-language={effectiveLanguage ?? undefined}
      data-md-code-language-label={languageLabel ?? undefined}
      data-md-code-highlighted={result.highlighted ? "true" : "false"}
      aria-label={effectiveLanguage ? `Code block (${languageLabel ?? effectiveLanguage})` : "Code block"}
    >
      <code
        {...restCodeProps}
        className={codeClassName}
        data-md-code-language={effectiveLanguage ?? undefined}
        data-md-code-language-label={languageLabel ?? undefined}
        data-md-code-highlighted={result.highlighted ? "true" : "false"}
        dangerouslySetInnerHTML={{ __html: result.html }}
      />
    </pre>
  );
};
