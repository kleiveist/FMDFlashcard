import {
  createAbsoluteNode,
  createAlignedNode,
  createCasesNode,
  createDelimitedNode,
  createFractionNode,
  createFunctionCallNode,
  createIntegralNode,
  createLeaf,
  createLimitNode,
  createMatrixNode,
  createRootNode,
  createRow,
  createSeriesNode,
  createSubNode,
  createSubSupNode,
  createSupNode,
  createSqrtNode,
  createTextNode,
  rowFromText,
} from "./ast";
import { serializeRow } from "./serializer";
import type { FormulaNode, FormulaRowNode, MathImportResult } from "./types";

const GREEK_COMMANDS = new Set([
  "alpha",
  "beta",
  "gamma",
  "delta",
  "theta",
  "lambda",
  "mu",
  "pi",
  "sigma",
  "phi",
  "omega",
]);

const SYMBOL_COMMANDS = new Set([
  "infty",
  "partial",
  "nabla",
  "to",
  "in",
  "subset",
  "forall",
  "exists",
  "neq",
  "le",
  "ge",
  "times",
  "div",
  ",",
  ";",
  "cdot",
]);

const FUNCTION_COMMANDS = new Set(["sin", "cos", "tan", "log", "ln", "exp"]);

type ParseResult<T> = {
  ok: true;
  value: T;
} | {
  ok: false;
  reason: string;
};

class LatexParser {
  source: string;
  index = 0;

  constructor(source: string) {
    this.source = source;
  }

  eof() {
    return this.index >= this.source.length;
  }

  peek(length = 1) {
    return this.source.slice(this.index, this.index + length);
  }

  consume(length = 1) {
    const value = this.source.slice(this.index, this.index + length);
    this.index += length;
    return value;
  }

  skipWhitespace() {
    while (!this.eof() && /\s/.test(this.peek())) {
      this.consume();
    }
  }

  parseRow(stopTokens: string[] = []): ParseResult<FormulaRowNode> {
    const children: FormulaNode[] = [];
    while (!this.eof()) {
      this.skipWhitespace();
      if (this.eof()) {
        break;
      }
      if (stopTokens.some((token) => this.source.startsWith(token, this.index))) {
        break;
      }
      const atom = this.parseAtom();
      if (!atom.ok) {
        return atom;
      }
      if (Array.isArray(atom.value)) {
        children.push(...atom.value);
      } else if (atom.value) {
        children.push(atom.value);
      }
    }
    return { ok: true, value: createRow(children) };
  }

  parseAtom(): ParseResult<FormulaNode | FormulaNode[] | null> {
    const next = this.peek();
    if (!next) {
      return { ok: true, value: null };
    }
    if (next === "{") {
      this.consume();
      const group = this.parseRow(["}"]);
      if (!group.ok) {
        return group;
      }
      if (this.peek() !== "}") {
        return { ok: false, reason: "Missing closing brace." };
      }
      this.consume();
      return { ok: true, value: group.value.children };
    }
    if (next === "(" || next === "[" || next === ")" || next === "]") {
      this.consume();
      return { ok: true, value: createLeaf("symbol", next) };
    }
    if (next === "|" ) {
      this.consume();
      return { ok: true, value: createLeaf("symbol", "|") };
    }
    if (next === "^" || next === "_") {
      return { ok: false, reason: `Unexpected script token ${next}.` };
    }
    if (next === "\\") {
      return this.parseCommandAtom();
    }
    this.consume();
    const leaf = createLeaf(classifyInlineCharacter(next), next);
    return this.parseTrailingScripts(leaf);
  }

  parseCommandAtom(): ParseResult<FormulaNode | FormulaNode[] | null> {
    this.consume();
    const command = this.readCommandName();
    if (!command) {
      return { ok: false, reason: "Invalid command." };
    }
    if (command === "frac") {
      const numerator = this.parseRequiredGroup();
      if (!numerator.ok) {
        return numerator;
      }
      const denominator = this.parseRequiredGroup();
      if (!denominator.ok) {
        return denominator;
      }
      return this.parseTrailingScripts(createFractionNode(numerator.value, denominator.value));
    }
    if (command === "sqrt") {
      const index = this.peek() === "[" ? this.parseRequiredBracketGroup() : null;
      if (index && !index.ok) {
        return index;
      }
      const radicand = this.parseRequiredGroup();
      if (!radicand.ok) {
        return radicand;
      }
      return this.parseTrailingScripts(
        index ? createRootNode(index.value, radicand.value) : createSqrtNode(radicand.value),
      );
    }
    if (command === "left") {
      const delimited = this.parseLeftRightDelimited();
      if (!delimited.ok) {
        return delimited;
      }
      return this.parseTrailingScripts(delimited.value);
    }
    if (command === "text") {
      const rawGroup = this.parseRequiredRawGroup();
      if (!rawGroup.ok) {
        return rawGroup;
      }
      return this.parseTrailingScripts(createTextNode(rawGroup.value));
    }
    if (command === "begin") {
      const environmentNode = this.parseEnvironment();
      if (!environmentNode.ok) {
        return environmentNode;
      }
      return this.parseTrailingScripts(environmentNode.value);
    }
    if (command === "sum" || command === "prod") {
      const seriesNode = this.parseSeries(command === "sum" ? "sum" : "product");
      if (!seriesNode.ok) {
        return seriesNode;
      }
      return this.parseTrailingScripts(seriesNode.value);
    }
    if (command === "int") {
      const integralNode = this.parseIntegral();
      if (!integralNode.ok) {
        return integralNode;
      }
      return this.parseTrailingScripts(integralNode.value);
    }
    if (command === "lim") {
      const limitNode = this.parseLimit();
      if (!limitNode.ok) {
        return limitNode;
      }
      return this.parseTrailingScripts(limitNode.value);
    }
    if (FUNCTION_COMMANDS.has(command)) {
      const argument = this.parseOptionalArgumentRow();
      if (!argument.ok) {
        return argument;
      }
      return this.parseTrailingScripts(createFunctionCallNode(command, argument.value ?? createRow()));
    }
    if (GREEK_COMMANDS.has(command) || SYMBOL_COMMANDS.has(command)) {
      return this.parseTrailingScripts(
        createLeaf(
          command === "neq" || command === "le" || command === "ge" ? "relation" : "symbol",
          `\\${command}`,
        ),
      );
    }
    if (command === ",") {
      return this.parseTrailingScripts(createLeaf("symbol", "\\,"));
    }
    return { ok: false, reason: `Unsupported command \\${command}.` };
  }

  parseTrailingScripts(base: FormulaNode): ParseResult<FormulaNode> {
    let nextBase = base;
    while (!this.eof()) {
      this.skipWhitespace();
      const token = this.peek();
      if (token !== "^" && token !== "_") {
        break;
      }
      this.consume();
      const scriptRow = this.parseScriptArgument();
      if (!scriptRow.ok) {
        return scriptRow;
      }
      if (token === "^") {
        if (nextBase.kind === "sub") {
          nextBase = createSubSupNode(nextBase.base, nextBase.subscript, scriptRow.value);
        } else if (nextBase.kind === "subsup") {
          nextBase = createSubSupNode(nextBase.base, nextBase.subscript, scriptRow.value);
        } else {
          nextBase = createSupNode(createRow([nextBase]), scriptRow.value);
        }
      } else if (nextBase.kind === "sup") {
        nextBase = createSubSupNode(nextBase.base, scriptRow.value, nextBase.exponent);
      } else if (nextBase.kind === "subsup") {
        nextBase = createSubSupNode(nextBase.base, scriptRow.value, nextBase.exponent);
      } else {
        nextBase = createSubNode(createRow([nextBase]), scriptRow.value);
      }
    }
    return { ok: true, value: nextBase };
  }

  parseScriptArgument(): ParseResult<FormulaRowNode> {
    this.skipWhitespace();
    if (this.peek() === "{") {
      return this.parseRequiredGroup();
    }
    const atom = this.parseAtom();
    if (!atom.ok) {
      return atom as ParseResult<FormulaRowNode>;
    }
    if (!atom.value) {
      return { ok: false, reason: "Missing script argument." };
    }
    return {
      ok: true,
      value: createRow(Array.isArray(atom.value) ? atom.value : [atom.value]),
    };
  }

  parseRequiredGroup(): ParseResult<FormulaRowNode> {
    this.skipWhitespace();
    if (this.peek() !== "{") {
      return { ok: false, reason: "Expected group." };
    }
    this.consume();
    const body = this.parseRow(["}"]);
    if (!body.ok) {
      return body;
    }
    if (this.peek() !== "}") {
      return { ok: false, reason: "Missing closing brace." };
    }
    this.consume();
    return body;
  }

  parseRequiredBracketGroup(): ParseResult<FormulaRowNode> {
    this.skipWhitespace();
    if (this.peek() !== "[") {
      return { ok: false, reason: "Expected bracket group." };
    }
    this.consume();
    const body = this.parseRow(["]"]);
    if (!body.ok) {
      return body;
    }
    if (this.peek() !== "]") {
      return { ok: false, reason: "Missing closing bracket." };
    }
    this.consume();
    return body;
  }

  parseRequiredRawGroup(): ParseResult<string> {
    this.skipWhitespace();
    if (this.peek() !== "{") {
      return { ok: false, reason: "Expected raw group." };
    }
    this.consume();
    let depth = 1;
    let value = "";
    while (!this.eof() && depth > 0) {
      const char = this.consume();
      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          break;
        }
      }
      value += char;
    }
    if (depth !== 0) {
      return { ok: false, reason: "Missing closing raw group." };
    }
    return { ok: true, value };
  }

  parseLeftRightDelimited(): ParseResult<FormulaNode> {
    this.skipWhitespace();
    const leftDelimiter = this.readDelimiterToken();
    if (!leftDelimiter) {
      return { ok: false, reason: "Missing left delimiter." };
    }
    const body = this.parseRow(["\\right"]);
    if (!body.ok) {
      return body;
    }
    if (!this.source.startsWith("\\right", this.index)) {
      return { ok: false, reason: "Missing \\right delimiter." };
    }
    this.consume("\\right".length);
    this.skipWhitespace();
    const rightDelimiter = this.readDelimiterToken();
    if (!rightDelimiter) {
      return { ok: false, reason: "Missing right delimiter." };
    }
    if (leftDelimiter === "|" && rightDelimiter === "|") {
      return { ok: true, value: createAbsoluteNode(body.value) };
    }
    return {
      ok: true,
      value: createDelimitedNode(leftDelimiter, rightDelimiter, body.value),
    };
  }

  parseSeries(kind: "sum" | "product"): ParseResult<FormulaNode> {
    const lower = this.parseOptionalScript("_");
    if (!lower.ok) {
      return lower;
    }
    const upper = this.parseOptionalScript("^");
    if (!upper.ok) {
      return upper;
    }
    const body = this.parseOptionalArgumentRow();
    if (!body.ok) {
      return body;
    }
    return {
      ok: true,
      value: createSeriesNode(kind, lower.value ?? createRow(), upper.value ?? createRow(), body.value ?? createRow()),
    };
  }

  parseIntegral(): ParseResult<FormulaNode> {
    const lower = this.parseOptionalScript("_");
    if (!lower.ok) {
      return lower;
    }
    const upper = this.parseOptionalScript("^");
    if (!upper.ok) {
      return upper;
    }
    const body = this.parseOptionalArgumentRow();
    if (!body.ok) {
      return body;
    }
    const integral = createIntegralNode(lower.value ?? createRow(), upper.value ?? createRow(), createRow(), createRow());
    const integrand = body.value ?? createRow();
    const differential = splitDifferentialRow(integrand);
    integral.integrand = differential.integrand;
    integral.differential = differential.differential;
    return { ok: true, value: integral };
  }

  parseLimit(): ParseResult<FormulaNode> {
    const approach = this.parseOptionalScript("_");
    if (!approach.ok) {
      return approach;
    }
    const body = this.parseOptionalArgumentRow();
    if (!body.ok) {
      return body;
    }
    return {
      ok: true,
      value: createLimitNode(approach.value ?? rowFromText("x\\to0"), body.value ?? createRow()),
    };
  }

  parseOptionalScript(token: "_" | "^"): ParseResult<FormulaRowNode | null> {
    this.skipWhitespace();
    if (this.peek() !== token) {
      return { ok: true, value: null };
    }
    this.consume();
    return this.parseScriptArgument();
  }

  parseOptionalArgumentRow(): ParseResult<FormulaRowNode | null> {
    this.skipWhitespace();
    if (this.eof()) {
      return { ok: true, value: null };
    }
    if (this.peek() === "{") {
      return this.parseRequiredGroup();
    }
    const atom = this.parseAtom();
    if (!atom.ok) {
      return atom as ParseResult<FormulaRowNode | null>;
    }
    if (!atom.value) {
      return { ok: true, value: null };
    }
    return {
      ok: true,
      value: createRow(Array.isArray(atom.value) ? atom.value : [atom.value]),
    };
  }

  parseEnvironment(): ParseResult<FormulaNode> {
    const envNameGroup = this.parseRequiredRawGroup();
    if (!envNameGroup.ok) {
      return envNameGroup as ParseResult<FormulaNode>;
    }
    const environment = envNameGroup.value.trim();
    const endMarker = `\\end{${environment}}`;
    const endIndex = this.source.indexOf(endMarker, this.index);
    if (endIndex < 0) {
      return { ok: false, reason: `Missing ${endMarker}.` };
    }
    const rawBody = this.source.slice(this.index, endIndex).trim();
    this.index = endIndex + endMarker.length;
    if (environment === "matrix" || environment === "pmatrix" || environment === "bmatrix") {
      return parseMatrixEnvironment(environment, rawBody);
    }
    if (environment === "cases") {
      return parseCasesEnvironment(rawBody);
    }
    if (environment === "aligned") {
      return parseAlignedEnvironment(rawBody);
    }
    return { ok: false, reason: `Unsupported environment ${environment}.` };
  }

  readCommandName() {
    if (!/[a-zA-Z]/.test(this.peek())) {
      return this.consume();
    }
    let value = "";
    while (!this.eof() && /[a-zA-Z]/.test(this.peek())) {
      value += this.consume();
    }
    return value;
  }

  readDelimiterToken() {
    const token = this.peek();
    if (!token) {
      return null;
    }
    if (token === "\\") {
      this.consume();
      const command = this.readCommandName();
      return command ? `\\${command}` : null;
    }
    return this.consume();
  }
}

const classifyInlineCharacter = (character: string) => {
  if (/\d/.test(character)) {
    return "number" as const;
  }
  if (/[=<>]/.test(character)) {
    return "relation" as const;
  }
  if (/[+\-*/]/.test(character)) {
    return "operator" as const;
  }
  return /[a-zA-Z]/.test(character) ? "identifier" as const : "symbol" as const;
};

const splitTopLevel = (source: string, separator: string) => {
  const parts: string[] = [];
  let depthBraces = 0;
  let depthBrackets = 0;
  let segmentStart = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depthBraces += 1;
    } else if (char === "}") {
      depthBraces = Math.max(0, depthBraces - 1);
    } else if (char === "[") {
      depthBrackets += 1;
    } else if (char === "]") {
      depthBrackets = Math.max(0, depthBrackets - 1);
    }
    if (depthBraces === 0 && depthBrackets === 0 && source.startsWith(separator, index)) {
      parts.push(source.slice(segmentStart, index).trim());
      segmentStart = index + separator.length;
      index += separator.length - 1;
    }
  }
  parts.push(source.slice(segmentStart).trim());
  return parts;
};

const parseInlineLatex = (latex: string): ParseResult<FormulaRowNode> => {
  const parser = new LatexParser(latex.trim());
  const result = parser.parseRow();
  if (!result.ok) {
    return result;
  }
  parser.skipWhitespace();
  if (!parser.eof()) {
    return { ok: false, reason: "Unexpected trailing tokens." };
  }
  return result;
};

const parseMatrixEnvironment = (
  environment: "matrix" | "pmatrix" | "bmatrix",
  rawBody: string,
): ParseResult<FormulaNode> => {
  const rowSources = splitTopLevel(rawBody, "\\\\").filter(Boolean);
  const parsedRows: FormulaRowNode[][] = [];
  for (const rowSource of rowSources) {
    const cellSources = splitTopLevel(rowSource, "&");
    const parsedCells: FormulaRowNode[] = [];
    for (const cellSource of cellSources) {
      const cell = parseInlineLatex(cellSource);
      if (!cell.ok) {
        return cell as ParseResult<FormulaNode>;
      }
      parsedCells.push(cell.value);
    }
    parsedRows.push(parsedCells);
  }
  const columnCount = Math.max(1, ...parsedRows.map((row) => row.length));
  const node = createMatrixNode(environment, Math.max(parsedRows.length, 1), columnCount);
  node.cells = parsedRows.map((row) => {
    const filled = [...row];
    while (filled.length < columnCount) {
      filled.push(createRow());
    }
    return filled;
  });
  return { ok: true, value: node };
};

const parseCasesEnvironment = (rawBody: string): ParseResult<FormulaNode> => {
  const rowSources = splitTopLevel(rawBody, "\\\\").filter(Boolean);
  const node = createCasesNode(Math.max(rowSources.length, 1));
  node.rows = [];
  for (const rowSource of rowSources) {
    const [valueSource = "", conditionSource = ""] = splitTopLevel(rowSource, "&");
    const value = parseInlineLatex(valueSource);
    if (!value.ok) {
      return value as ParseResult<FormulaNode>;
    }
    const condition = parseInlineLatex(conditionSource);
    if (!condition.ok) {
      return condition as ParseResult<FormulaNode>;
    }
    node.rows.push({
      id: `cases-row-${node.rows.length + 1}`,
      value: value.value,
      condition: condition.value,
    });
  }
  return { ok: true, value: node };
};

const parseAlignedEnvironment = (rawBody: string): ParseResult<FormulaNode> => {
  const rowSources = splitTopLevel(rawBody, "\\\\").filter(Boolean);
  const node = createAlignedNode(Math.max(rowSources.length, 1));
  node.rows = [];
  for (const rowSource of rowSources) {
    const [leftSource = "", rightSource = ""] = splitTopLevel(rowSource.replace("&=", "&"), "&");
    const left = parseInlineLatex(leftSource);
    if (!left.ok) {
      return left as ParseResult<FormulaNode>;
    }
    const right = parseInlineLatex(rightSource.replace(/^=/, "").trim());
    if (!right.ok) {
      return right as ParseResult<FormulaNode>;
    }
    node.rows.push({
      id: `aligned-row-${node.rows.length + 1}`,
      left: left.value,
      right: right.value,
    });
  }
  return { ok: true, value: node };
};

const splitDifferentialRow = (row: FormulaRowNode) => {
  const serialized = serializeRow(row).trim();
  const match = serialized.match(/^(.*?)(?:\\,\s*)?(d[a-zA-Z]+)$/);
  if (!match) {
    return {
      integrand: row,
      differential: createRow(),
    };
  }
  const integrand = parseInlineLatex((match[1] ?? "").trim());
  const differential = parseInlineLatex(match[2] ?? "");
  return {
    integrand: integrand.ok ? integrand.value : row,
    differential: differential.ok ? differential.value : createRow(),
  };
};

export const importMathLatex = (latex: string): MathImportResult => {
  const trimmed = latex.trim();
  if (!trimmed) {
    return {
      mode: "structured",
      ast: createRow(),
      rawLatex: "",
    };
  }
  const parsed = parseInlineLatex(trimmed);
  if (!parsed.ok) {
    return {
      mode: "raw-fallback",
      rawLatex: trimmed,
      reason: parsed.reason,
    };
  }
  return {
    mode: "structured",
    ast: parsed.value,
    rawLatex: trimmed,
  };
};
