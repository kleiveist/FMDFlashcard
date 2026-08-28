import { isLeafNode, serializePlainTextFromRow } from "./ast";
import type { FormulaNode, FormulaRowNode } from "./types";

const maybeWrapRow = (row: FormulaRowNode) => {
  const value = serializeRow(row);
  if (row.children.length <= 1) {
    return value;
  }
  return `{${value}}`;
};

const serializeDelimited = (value: string) => value;

export const serializeNode = (node: FormulaNode): string => {
  switch (node.kind) {
    case "identifier":
    case "number":
      return node.value;
    case "operator":
    case "relation":
    case "symbol":
      return node.value;
    case "placeholder":
      return "";
    case "text":
      return `\\text{${serializePlainTextFromRow(node.body)}}`;
    case "fraction":
      return `\\frac{${serializeRow(node.numerator)}}{${serializeRow(node.denominator)}}`;
    case "sqrt":
      return `\\sqrt{${serializeRow(node.radicand)}}`;
    case "root":
      return `\\sqrt[${serializeRow(node.index)}]{${serializeRow(node.radicand)}}`;
    case "sup":
      return `${maybeWrapRow(node.base)}^{${serializeRow(node.exponent)}}`;
    case "sub":
      return `${maybeWrapRow(node.base)}_{${serializeRow(node.subscript)}}`;
    case "subsup":
      return `${maybeWrapRow(node.base)}_{${serializeRow(node.subscript)}}^{${serializeRow(node.exponent)}}`;
    case "delimited":
      return `\\left${serializeDelimited(node.leftDelimiter)}${serializeRow(node.body)}\\right${
        serializeDelimited(node.rightDelimiter)
      }`;
    case "absolute":
      return `\\left|${serializeRow(node.body)}\\right|`;
    case "functionCall":
      return `\\${node.name} ${maybeWrapRow(node.argument)}`;
    case "integral": {
      const lower = serializeRow(node.lower);
      const upper = serializeRow(node.upper);
      const boundPrefix = `${lower ? `_{${lower}}` : ""}${upper ? `^{${upper}}` : ""}`;
      const differential = serializeRow(node.differential);
      return `\\int${boundPrefix} ${serializeRow(node.integrand)}${differential ? ` \\, ${differential}` : ""}`.trim();
    }
    case "limit":
      return `\\lim_{${serializeRow(node.approach)}} ${maybeWrapRow(node.body)}`.trim();
    case "sum":
      return `\\sum_{${serializeRow(node.lower)}}^{${serializeRow(node.upper)}} ${maybeWrapRow(node.body)}`.trim();
    case "product":
      return `\\prod_{${serializeRow(node.lower)}}^{${serializeRow(node.upper)}} ${maybeWrapRow(node.body)}`.trim();
    case "matrix":
      return [
        `\\begin{${node.environment}}`,
        node.cells.map((row) => row.map((cell) => serializeRow(cell)).join(" & ")).join(" \\\\\n"),
        `\\end{${node.environment}}`,
      ].join("\n");
    case "vector":
      return [
        `\\begin{${node.environment}}`,
        node.cells.map((cell) => serializeRow(cell)).join(" \\\\\n"),
        `\\end{${node.environment}}`,
      ].join("\n");
    case "cases":
      return [
        "\\begin{cases}",
        node.rows
          .map((row) => `${serializeRow(row.value)} & ${serializeRow(row.condition)}`)
          .join(" \\\\\n"),
        "\\end{cases}",
      ].join("\n");
    case "aligned":
      return [
        "\\begin{aligned}",
        node.rows
          .map((row) => `${serializeRow(row.left)} &= ${serializeRow(row.right)}`)
          .join(" \\\\\n"),
        "\\end{aligned}",
      ].join("\n");
  }
};

export const serializeRow = (row: FormulaRowNode) =>
  row.children.map((child) => serializeNode(child)).join("");

export const isSerializableMathTree = (row: FormulaRowNode): boolean =>
  row.children.every((child) => {
    if (isLeafNode(child)) {
      return true;
    }
    switch (child.kind) {
      case "text":
        return isSerializableMathTree(child.body);
      case "fraction":
        return isSerializableMathTree(child.numerator) && isSerializableMathTree(child.denominator);
      case "sqrt":
        return isSerializableMathTree(child.radicand);
      case "root":
        return isSerializableMathTree(child.index) && isSerializableMathTree(child.radicand);
      case "sup":
        return isSerializableMathTree(child.base) && isSerializableMathTree(child.exponent);
      case "sub":
        return isSerializableMathTree(child.base) && isSerializableMathTree(child.subscript);
      case "subsup":
        return isSerializableMathTree(child.base) &&
          isSerializableMathTree(child.subscript) &&
          isSerializableMathTree(child.exponent);
      case "delimited":
      case "absolute":
        return isSerializableMathTree(child.body);
      case "functionCall":
        return isSerializableMathTree(child.argument);
      case "integral":
        return isSerializableMathTree(child.lower) &&
          isSerializableMathTree(child.upper) &&
          isSerializableMathTree(child.integrand) &&
          isSerializableMathTree(child.differential);
      case "limit":
        return isSerializableMathTree(child.approach) && isSerializableMathTree(child.body);
      case "sum":
      case "product":
        return isSerializableMathTree(child.lower) &&
          isSerializableMathTree(child.upper) &&
          isSerializableMathTree(child.body);
      case "matrix":
        return child.cells.every((row) => row.every((cell) => isSerializableMathTree(cell)));
      case "vector":
        return child.cells.every((cell) => isSerializableMathTree(cell));
      case "cases":
        return child.rows.every((row) => isSerializableMathTree(row.value) && isSerializableMathTree(row.condition));
      case "aligned":
        return child.rows.every((row) => isSerializableMathTree(row.left) && isSerializableMathTree(row.right));
    }
  });
