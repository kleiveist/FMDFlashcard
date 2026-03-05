import { Children, isValidElement, type ReactNode, useEffect, useMemo, useState } from "react";
import { MARKDOWN_CODE_HIGHLIGHT_CONFIG } from "./markdownCodeHighlightConfig";

type HighlightJsLanguageFactory = (hljs: unknown) => unknown;

type HighlightJsCore = {
  registerLanguage: (name: string, language: HighlightJsLanguageFactory) => void;
  getLanguage: (name: string) => unknown;
  highlight: (
    code: string,
    options: { language: string; ignoreIllegals?: boolean },
  ) => { language?: string; value: string };
  highlightAuto: (
    code: string,
    languageSubset?: string[],
  ) => { language?: string; value: string };
};

type HighlightCacheValue = {
  html: string;
  highlighted: boolean;
  language: string | null;
  languageLabel: string | null;
};

export type MarkdownCodeHighlightResult = HighlightCacheValue & {
  cacheKey: string;
};

export type HighlightMarkdownCodeOptions = {
  code: string;
  language?: string | null;
  autoDetectWithoutLanguage?: boolean;
  autoDetectCandidateLanguages?: readonly string[];
};

export type UseMarkdownCodeHighlightOptions = HighlightMarkdownCodeOptions & {
  schedule?: "idle" | "immediate";
};

export type ApplyHighlightToCodeElementOptions = HighlightMarkdownCodeOptions & {
  preElement?: HTMLElement | null;
  codeElement: HTMLElement;
};

const MAX_HIGHLIGHT_CACHE_ENTRIES = 600;

const languageAliasMap: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  ps1: "powershell",
  pwsh: "powershell",
  yml: "yaml",
  md: "markdown",
  rb: "ruby",
  rs: "rust",
  "c++": "cpp",
  hpp: "cpp",
  cs: "csharp",
  objc: "objectivec",
  tex: "latex",
  docker: "dockerfile",
  gql: "graphql",
  plain: "plaintext",
  text: "plaintext",
  txt: "plaintext",
};

const supportedLanguages = new Set([
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "diff",
  "dockerfile",
  "go",
  "graphql",
  "groovy",
  "ini",
  "java",
  "javascript",
  "json",
  "kotlin",
  "latex",
  "less",
  "lua",
  "makefile",
  "markdown",
  "matlab",
  "objectivec",
  "perl",
  "php",
  "powershell",
  "python",
  "r",
  "ruby",
  "rust",
  "scala",
  "sql",
  "swift",
  "toml",
  "typescript",
  "vbnet",
  "xml",
  "yaml",
]);

const languageLoaders: Record<string, () => Promise<HighlightJsLanguageFactory>> = {
  bash: () => import("highlight.js/lib/languages/bash").then((module) => module.default),
  c: () => import("highlight.js/lib/languages/c").then((module) => module.default),
  cpp: () => import("highlight.js/lib/languages/cpp").then((module) => module.default),
  csharp: () => import("highlight.js/lib/languages/csharp").then((module) => module.default),
  css: () => import("highlight.js/lib/languages/css").then((module) => module.default),
  diff: () => import("highlight.js/lib/languages/diff").then((module) => module.default),
  dockerfile: () => import("highlight.js/lib/languages/dockerfile").then((module) => module.default),
  go: () => import("highlight.js/lib/languages/go").then((module) => module.default),
  graphql: () => import("highlight.js/lib/languages/graphql").then((module) => module.default),
  groovy: () => import("highlight.js/lib/languages/groovy").then((module) => module.default),
  ini: () => import("highlight.js/lib/languages/ini").then((module) => module.default),
  java: () => import("highlight.js/lib/languages/java").then((module) => module.default),
  javascript: () => import("highlight.js/lib/languages/javascript").then((module) => module.default),
  json: () => import("highlight.js/lib/languages/json").then((module) => module.default),
  kotlin: () => import("highlight.js/lib/languages/kotlin").then((module) => module.default),
  latex: () => import("highlight.js/lib/languages/latex").then((module) => module.default),
  less: () => import("highlight.js/lib/languages/less").then((module) => module.default),
  lua: () => import("highlight.js/lib/languages/lua").then((module) => module.default),
  makefile: () => import("highlight.js/lib/languages/makefile").then((module) => module.default),
  markdown: () => import("highlight.js/lib/languages/markdown").then((module) => module.default),
  matlab: () => import("highlight.js/lib/languages/matlab").then((module) => module.default),
  objectivec: () => import("highlight.js/lib/languages/objectivec").then((module) => module.default),
  perl: () => import("highlight.js/lib/languages/perl").then((module) => module.default),
  php: () => import("highlight.js/lib/languages/php").then((module) => module.default),
  powershell: () => import("highlight.js/lib/languages/powershell").then((module) => module.default),
  python: () => import("highlight.js/lib/languages/python").then((module) => module.default),
  r: () => import("highlight.js/lib/languages/r").then((module) => module.default),
  ruby: () => import("highlight.js/lib/languages/ruby").then((module) => module.default),
  rust: () => import("highlight.js/lib/languages/rust").then((module) => module.default),
  scala: () => import("highlight.js/lib/languages/scala").then((module) => module.default),
  sql: () => import("highlight.js/lib/languages/sql").then((module) => module.default),
  swift: () => import("highlight.js/lib/languages/swift").then((module) => module.default),
  // highlight.js ships TOML highlighting via the INI grammar module.
  toml: () => import("highlight.js/lib/languages/ini").then((module) => module.default),
  typescript: () => import("highlight.js/lib/languages/typescript").then((module) => module.default),
  vbnet: () => import("highlight.js/lib/languages/vbnet").then((module) => module.default),
  xml: () => import("highlight.js/lib/languages/xml").then((module) => module.default),
  yaml: () => import("highlight.js/lib/languages/yaml").then((module) => module.default),
};

const highlightCache = new Map<string, HighlightCacheValue>();
const languageLoadPromises = new Map<string, Promise<boolean>>();
let highlightJsCorePromise: Promise<HighlightJsCore | null> | null = null;

const languageClassPattern = /(?:^|\s)(?:language|lang)-([A-Za-z0-9_+-]+)(?=\s|$)/i;

const extractRawLanguageTokenFromClassName = (
  value: string | null | undefined,
): string | null => {
  if (!value) {
    return null;
  }
  const match = value.match(languageClassPattern);
  if (!match) {
    return null;
  }
  const token = (match[1] ?? "").trim().toLowerCase();
  return token.length > 0 ? token : null;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const hashText = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const buildCacheKey = (language: string, contentHash: string) => `(${language},${contentHash})`;

const readCachedValue = (cacheKey: string) => {
  const cached = highlightCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  highlightCache.delete(cacheKey);
  highlightCache.set(cacheKey, cached);
  return cached;
};

const writeCachedValue = (cacheKey: string, value: HighlightCacheValue) => {
  if (highlightCache.has(cacheKey)) {
    highlightCache.delete(cacheKey);
  }
  highlightCache.set(cacheKey, value);
  while (highlightCache.size > MAX_HIGHLIGHT_CACHE_ENTRIES) {
    const oldestKey = highlightCache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    highlightCache.delete(oldestKey);
  }
};

const sanitizeHighlightHtml = (html: string): string | null => {
  if (typeof document === "undefined") {
    return null;
  }
  const template = document.createElement("template");
  template.innerHTML = html;

  const isValidClassName = (value: string) => /^hljs(?:-[A-Za-z0-9_-]+)*$/.test(value);

  const validateNode = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      return true;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    const element = node as HTMLElement;
    if (element.tagName.toLowerCase() !== "span") {
      return false;
    }
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name !== "class") {
        return false;
      }
      const classNames = attribute.value
        .split(/\s+/)
        .map((className) => className.trim())
        .filter(Boolean);
      if (classNames.length === 0 || classNames.some((className) => !isValidClassName(className))) {
        return false;
      }
    }
    return Array.from(element.childNodes).every((child) => validateNode(child));
  };

  if (!Array.from(template.content.childNodes).every((node) => validateNode(node))) {
    return null;
  }

  return template.innerHTML;
};

const buildPlainResult = (code: string, cacheKey: string, language: string | null): MarkdownCodeHighlightResult => ({
  cacheKey,
  html: escapeHtml(code),
  highlighted: false,
  language,
  languageLabel: language ? formatCodeLanguageLabel(language) : null,
});

const getHighlightJsCore = async (): Promise<HighlightJsCore | null> => {
  if (!highlightJsCorePromise) {
    highlightJsCorePromise = import("highlight.js/lib/core")
      .then((module) => module.default as unknown as HighlightJsCore)
      .catch(() => null);
  }
  return highlightJsCorePromise;
};

const ensureLanguageRegistered = async (
  core: HighlightJsCore,
  language: string,
): Promise<boolean> => {
  if (core.getLanguage(language)) {
    return true;
  }

  const loader = languageLoaders[language];
  if (!loader) {
    return false;
  }

  const existingPromise = languageLoadPromises.get(language);
  if (existingPromise) {
    return existingPromise;
  }

  const loadingPromise = loader()
    .then((factory) => {
      if (!core.getLanguage(language)) {
        core.registerLanguage(language, factory);
      }
      return true;
    })
    .catch(() => false)
    .finally(() => {
      languageLoadPromises.delete(language);
    });

  languageLoadPromises.set(language, loadingPromise);
  return loadingPromise;
};

const resolveAutoDetectCandidates = (value: readonly string[] | undefined) => {
  const source = value && value.length > 0
    ? value
    : MARKDOWN_CODE_HIGHLIGHT_CONFIG.autoDetectCandidateLanguages;

  const normalized = source
    .map((entry) => normalizeLanguage(entry))
    .filter((entry): entry is string => Boolean(entry) && entry !== "plaintext");

  return Array.from(new Set(normalized));
};

const applyHighlightMetadata = (
  preElement: HTMLElement | null | undefined,
  codeElement: HTMLElement,
  result: MarkdownCodeHighlightResult,
  requestedLanguage: string | null,
) => {
  const effectiveLanguage = result.language ?? requestedLanguage;
  const languageLabel = effectiveLanguage ? formatCodeLanguageLabel(effectiveLanguage) : null;

  const cleanClassNames = (className: string) => className
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => !entry.startsWith("hljs") && !/^language-/i.test(entry) && !/^lang-/i.test(entry));

  const codeClassNames = cleanClassNames(codeElement.className);
  if (result.highlighted) {
    codeClassNames.unshift("hljs");
  }
  if (effectiveLanguage) {
    codeClassNames.push(`language-${effectiveLanguage}`);
  }
  codeElement.className = Array.from(new Set(codeClassNames)).join(" ");

  if (effectiveLanguage) {
    codeElement.dataset.mdCodeLanguage = effectiveLanguage;
  } else {
    delete codeElement.dataset.mdCodeLanguage;
  }

  if (languageLabel) {
    codeElement.dataset.mdCodeLanguageLabel = languageLabel;
  } else {
    delete codeElement.dataset.mdCodeLanguageLabel;
  }

  codeElement.dataset.mdCodeHighlighted = result.highlighted ? "true" : "false";

  if (!preElement) {
    return;
  }

  const preClassNames = cleanClassNames(preElement.className);
  preClassNames.push("md-code-highlighted-pre");
  preElement.className = Array.from(new Set(preClassNames)).join(" ");

  if (effectiveLanguage) {
    preElement.dataset.mdCodeLanguage = effectiveLanguage;
  } else {
    delete preElement.dataset.mdCodeLanguage;
  }

  if (languageLabel) {
    preElement.dataset.mdCodeLanguageLabel = languageLabel;
  } else {
    delete preElement.dataset.mdCodeLanguageLabel;
  }

  preElement.dataset.mdCodeHighlighted = result.highlighted ? "true" : "false";
  preElement.setAttribute(
    "aria-label",
    effectiveLanguage ? `Code block (${languageLabel ?? effectiveLanguage})` : "Code block",
  );
};

const deriveRequestedLanguage = (rawLanguage?: string | null) => {
  const normalized = normalizeLanguage(rawLanguage ?? "");
  if (!normalized) {
    return null;
  }
  if (normalized === "plaintext") {
    return "plaintext";
  }
  return normalized;
};

export const normalizeLanguage = (value: string | null | undefined): string | null => {
  const cleaned = (value ?? "").trim().toLowerCase();
  if (!cleaned) {
    return null;
  }

  const [firstToken] = cleaned.split(/\s+/);
  if (!firstToken) {
    return null;
  }

  const normalizedToken = firstToken
    .replace(/^language-/, "")
    .replace(/^lang-/, "");

  const mapped = languageAliasMap[normalizedToken] ?? normalizedToken;
  if (mapped === "plaintext") {
    return "plaintext";
  }

  return supportedLanguages.has(mapped) ? mapped : null;
};

export const extractLanguageFromClassName = (value: string | null | undefined): string | null => {
  const rawToken = extractRawLanguageTokenFromClassName(value);
  return rawToken ? normalizeLanguage(rawToken) : null;
};

export const extractRawLanguageFromClassName = (
  value: string | null | undefined,
): string | null => extractRawLanguageTokenFromClassName(value);

export const formatCodeLanguageLabel = (language: string): string => {
  const normalized = normalizeLanguage(language) ?? language.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  const explicitLabels: Record<string, string> = {
    c: "C",
    cpp: "C++",
    csharp: "C#",
    css: "CSS",
    diff: "Diff",
    go: "Go",
    ini: "INI",
    java: "Java",
    javascript: "JavaScript",
    json: "JSON",
    latex: "LaTeX",
    lua: "Lua",
    markdown: "Markdown",
    matlab: "MATLAB",
    objectivec: "Objective-C",
    perl: "Perl",
    php: "PHP",
    powershell: "PowerShell",
    python: "Python",
    r: "R",
    ruby: "Ruby",
    rust: "Rust",
    scala: "Scala",
    sql: "SQL",
    swift: "Swift",
    toml: "TOML",
    typescript: "TypeScript",
    vbnet: "VB.NET",
    xml: "XML",
    yaml: "YAML",
    bash: "Bash",
    dockerfile: "Dockerfile",
    graphql: "GraphQL",
    groovy: "Groovy",
    kotlin: "Kotlin",
    less: "Less",
    makefile: "Makefile",
  };

  return explicitLabels[normalized] ?? `${normalized[0]?.toUpperCase() ?? ""}${normalized.slice(1)}`;
};

export const flattenCodeTextContent = (value: ReactNode): string | null => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (value == null || typeof value === "boolean") {
    return "";
  }

  const nodes = Children.toArray(value);
  let text = "";

  for (const node of nodes) {
    if (typeof node === "string" || typeof node === "number") {
      text += String(node);
      continue;
    }

    if (!isValidElement<{ children?: ReactNode }>(node)) {
      return null;
    }

    if (typeof node.type === "string" && node.type.toLowerCase() === "br") {
      text += "\n";
      continue;
    }

    const nested = flattenCodeTextContent(node.props.children ?? null);
    if (nested === null) {
      return null;
    }
    text += nested;
  }

  return text;
};

export const scheduleIdleTask = (
  run: () => void,
  timeout = 120,
): (() => void) => {
  if (typeof window === "undefined") {
    run();
    return () => {};
  }

  let timeoutHandle = 0;
  let idleHandle: number | null = null;

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof idleWindow.requestIdleCallback === "function") {
    idleHandle = idleWindow.requestIdleCallback(run, { timeout });
  } else {
    timeoutHandle = window.setTimeout(run, 24);
  }

  return () => {
    if (idleHandle !== null) {
      idleWindow.cancelIdleCallback?.(idleHandle);
    }
    if (timeoutHandle) {
      window.clearTimeout(timeoutHandle);
    }
  };
};

const computeCodeHighlight = async (
  options: HighlightMarkdownCodeOptions,
): Promise<MarkdownCodeHighlightResult> => {
  const code = options.code ?? "";
  const hasExplicitLanguage = typeof options.language === "string" && options.language.trim().length > 0;
  const requestedLanguage = deriveRequestedLanguage(options.language);
  const hasUnsupportedLanguage = hasExplicitLanguage && !requestedLanguage;
  const autoDetect = (options.autoDetectWithoutLanguage
    ?? MARKDOWN_CODE_HIGHLIGHT_CONFIG.autoDetectWithoutLanguage) && !hasUnsupportedLanguage;
  const cacheLanguage = requestedLanguage
    ? requestedLanguage
    : hasUnsupportedLanguage
      ? "plain"
      : autoDetect
        ? "auto"
        : "plain";
  const cacheKey = buildCacheKey(cacheLanguage, hashText(code));

  const cached = readCachedValue(cacheKey);
  if (cached) {
    return {
      ...cached,
      cacheKey,
    };
  }

  if (hasUnsupportedLanguage) {
    const plain = buildPlainResult(code, cacheKey, null);
    writeCachedValue(cacheKey, plain);
    return plain;
  }

  if (!requestedLanguage && !autoDetect) {
    const plain = buildPlainResult(code, cacheKey, null);
    writeCachedValue(cacheKey, plain);
    return plain;
  }

  if (requestedLanguage === "plaintext") {
    const plain = buildPlainResult(code, cacheKey, "plaintext");
    writeCachedValue(cacheKey, plain);
    return plain;
  }

  const core = await getHighlightJsCore();
  if (!core) {
    const plain = buildPlainResult(code, cacheKey, requestedLanguage);
    writeCachedValue(cacheKey, plain);
    return plain;
  }

  try {
    if (requestedLanguage) {
      const isReady = await ensureLanguageRegistered(core, requestedLanguage);
      if (!isReady) {
        const plain = buildPlainResult(code, cacheKey, requestedLanguage);
        writeCachedValue(cacheKey, plain);
        return plain;
      }

      const highlighted = core.highlight(code, {
        language: requestedLanguage,
        ignoreIllegals: true,
      });
      const safeHtml = sanitizeHighlightHtml(highlighted.value);
      if (!safeHtml) {
        const plain = buildPlainResult(code, cacheKey, requestedLanguage);
        writeCachedValue(cacheKey, plain);
        return plain;
      }
      const result: MarkdownCodeHighlightResult = {
        cacheKey,
        html: safeHtml,
        highlighted: true,
        language: requestedLanguage,
        languageLabel: formatCodeLanguageLabel(requestedLanguage),
      };
      writeCachedValue(cacheKey, result);
      return result;
    }

    const candidates = resolveAutoDetectCandidates(options.autoDetectCandidateLanguages);
    if (candidates.length === 0) {
      const plain = buildPlainResult(code, cacheKey, null);
      writeCachedValue(cacheKey, plain);
      return plain;
    }

    const readiness = await Promise.all(
      candidates.map((language) => ensureLanguageRegistered(core, language)),
    );
    const availableCandidates = candidates.filter((_, index) => readiness[index]);
    if (availableCandidates.length === 0) {
      const plain = buildPlainResult(code, cacheKey, null);
      writeCachedValue(cacheKey, plain);
      return plain;
    }

    const highlighted = core.highlightAuto(code, availableCandidates);
    const safeHtml = sanitizeHighlightHtml(highlighted.value);
    if (!safeHtml) {
      const plain = buildPlainResult(code, cacheKey, null);
      writeCachedValue(cacheKey, plain);
      return plain;
    }

    const resolvedLanguage = normalizeLanguage(highlighted.language ?? "") ?? null;
    const result: MarkdownCodeHighlightResult = {
      cacheKey,
      html: safeHtml,
      highlighted: Boolean(resolvedLanguage),
      language: resolvedLanguage,
      languageLabel: resolvedLanguage ? formatCodeLanguageLabel(resolvedLanguage) : null,
    };
    writeCachedValue(cacheKey, result);
    return result;
  } catch {
    const plain = buildPlainResult(code, cacheKey, requestedLanguage);
    writeCachedValue(cacheKey, plain);
    return plain;
  }
};

const buildInitialHighlightResult = (
  options: HighlightMarkdownCodeOptions,
): MarkdownCodeHighlightResult => {
  const code = options.code ?? "";
  const hasExplicitLanguage = typeof options.language === "string" && options.language.trim().length > 0;
  const requestedLanguage = deriveRequestedLanguage(options.language);
  const hasUnsupportedLanguage = hasExplicitLanguage && !requestedLanguage;
  const autoDetect = (options.autoDetectWithoutLanguage
    ?? MARKDOWN_CODE_HIGHLIGHT_CONFIG.autoDetectWithoutLanguage) && !hasUnsupportedLanguage;
  const cacheLanguage = requestedLanguage
    ? requestedLanguage
    : hasUnsupportedLanguage
      ? "plain"
      : autoDetect
        ? "auto"
        : "plain";
  const cacheKey = buildCacheKey(cacheLanguage, hashText(code));
  const cached = readCachedValue(cacheKey);
  if (cached) {
    return {
      ...cached,
      cacheKey,
    };
  }

  return buildPlainResult(code, cacheKey, requestedLanguage && requestedLanguage !== "plaintext"
    ? requestedLanguage
    : null);
};

export const highlightMarkdownCode = async (
  options: HighlightMarkdownCodeOptions,
): Promise<MarkdownCodeHighlightResult> => computeCodeHighlight(options);

export const useMarkdownCodeHighlight = (
  options: UseMarkdownCodeHighlightOptions,
) => {
  const stableOptions = useMemo(
    () => ({
      code: options.code,
      language: options.language,
      autoDetectWithoutLanguage: options.autoDetectWithoutLanguage,
      autoDetectCandidateLanguages: options.autoDetectCandidateLanguages,
    }),
    [
      options.autoDetectCandidateLanguages,
      options.autoDetectWithoutLanguage,
      options.code,
      options.language,
    ],
  );

  const [result, setResult] = useState<MarkdownCodeHighlightResult>(() =>
    buildInitialHighlightResult(stableOptions));

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      void computeCodeHighlight(stableOptions).then((nextResult) => {
        if (cancelled) {
          return;
        }
        setResult((current) =>
          current.cacheKey === nextResult.cacheKey &&
            current.html === nextResult.html &&
            current.language === nextResult.language &&
            current.highlighted === nextResult.highlighted
            ? current
            : nextResult);
      });
    };

    if (options.schedule === "immediate") {
      run();
      return () => {
        cancelled = true;
      };
    }

    const cancelScheduled = scheduleIdleTask(run);

    return () => {
      cancelled = true;
      cancelScheduled();
    };
  }, [options.schedule, stableOptions]);

  return result;
};

export const applyHighlightToCodeElement = async (
  options: ApplyHighlightToCodeElementOptions,
) => {
  const codeElement = options.codeElement;
  const preElement = options.preElement ?? codeElement.closest("pre");
  const rawLanguage =
    (typeof options.language === "string" && options.language.trim().length > 0
      ? options.language
      : null) ??
    extractRawLanguageTokenFromClassName(codeElement.className) ??
    extractRawLanguageTokenFromClassName(preElement?.className);
  const requestedLanguage = deriveRequestedLanguage(rawLanguage);

  const result = await computeCodeHighlight({
    code: codeElement.textContent ?? "",
    language: rawLanguage,
    autoDetectWithoutLanguage: options.autoDetectWithoutLanguage,
    autoDetectCandidateLanguages: options.autoDetectCandidateLanguages,
  });

  codeElement.innerHTML = result.html;
  applyHighlightMetadata(preElement, codeElement, result, requestedLanguage);
  return result;
};

export const applyHighlightMetadataToElements = (
  preElement: HTMLElement | null | undefined,
  codeElement: HTMLElement,
  result: MarkdownCodeHighlightResult,
  requestedLanguage: string | null,
) => {
  applyHighlightMetadata(preElement, codeElement, result, requestedLanguage);
};
