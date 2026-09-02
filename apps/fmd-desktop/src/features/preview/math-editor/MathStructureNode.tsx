import type { CSSProperties, ReactNode } from "react";
import { getSlotLabel } from "./ast";
import type { FormulaNode, FormulaRowNode, MathEditorCommand, SlotPath } from "./types";

type RenderRow = (
  row: FormulaRowNode,
  path: SlotPath,
  label: string,
  compact?: boolean,
) => ReactNode;

const DISPLAY_VALUE_MAP: Record<string, string> = {
  "\\times": "×",
  "\\div": "÷",
  "\\pi": "π",
  "\\theta": "θ",
  "\\alpha": "α",
  "\\infty": "∞",
  "\\partial": "∂",
  "\\nabla": "∇",
  "\\to": "→",
  "\\in": "∈",
  "\\subset": "⊂",
  "\\forall": "∀",
  "\\exists": "∃",
  "\\neq": "≠",
  "\\le": "≤",
  "\\ge": "≥",
  "\\{": "{",
  "\\}": "}",
};

const getDisplayValue = (value: string) => DISPLAY_VALUE_MAP[value] ?? value;

const getMatrixEnvironmentLabel = (environment: "matrix" | "pmatrix" | "bmatrix") => {
  switch (environment) {
    case "pmatrix":
      return "Paren matrix";
    case "bmatrix":
      return "Bracket matrix";
    case "matrix":
      return "Matrix";
  }
};

export const MathStructureNode = ({
  node,
  path,
  renderRow,
  onDispatch,
}: {
  node: FormulaNode;
  path: SlotPath;
  renderRow: RenderRow;
  onDispatch: (command: MathEditorCommand) => void;
}) => {
  switch (node.kind) {
    case "identifier":
    case "number":
    case "operator":
    case "relation":
    case "symbol":
    case "placeholder":
      return (
        <span className={`markdown-hybrid-structural-math-token is-${node.kind}`}>
          {getDisplayValue(node.value)}
        </span>
      );
    case "text": {
      const slot = { nodeId: node.id, slotName: "body" } as const;
      return (
        <span className="markdown-hybrid-structural-math-node is-text">
          <span className="markdown-hybrid-structural-math-node-label">Text</span>
          {renderRow(node.body, [...path, slot], getSlotLabel(slot), true)}
        </span>
      );
    }
    case "fraction": {
      const numeratorSlot = { nodeId: node.id, slotName: "numerator" } as const;
      const denominatorSlot = { nodeId: node.id, slotName: "denominator" } as const;
      return (
        <span className="markdown-hybrid-structural-math-node is-fraction">
          <span className="markdown-hybrid-structural-math-fraction-slot is-numerator">
            {renderRow(node.numerator, [...path, numeratorSlot], getSlotLabel(numeratorSlot), true)}
          </span>
          <span className="markdown-hybrid-structural-math-fraction-line" />
          <span className="markdown-hybrid-structural-math-fraction-slot is-denominator">
            {renderRow(
              node.denominator,
              [...path, denominatorSlot],
              getSlotLabel(denominatorSlot),
              true,
            )}
          </span>
        </span>
      );
    }
    case "sqrt": {
      const slot = { nodeId: node.id, slotName: "radicand" } as const;
      return (
        <span className="markdown-hybrid-structural-math-node is-sqrt">
          <span className="markdown-hybrid-structural-math-radical">√</span>
          <span className="markdown-hybrid-structural-math-slot-shell is-radicand">
            {renderRow(node.radicand, [...path, slot], getSlotLabel(slot), true)}
          </span>
        </span>
      );
    }
    case "root": {
      const indexSlot = { nodeId: node.id, slotName: "index" } as const;
      const radicandSlot = { nodeId: node.id, slotName: "radicand" } as const;
      return (
        <span className="markdown-hybrid-structural-math-node is-root">
          <span className="markdown-hybrid-structural-math-root-index">
            {renderRow(node.index, [...path, indexSlot], getSlotLabel(indexSlot), true)}
          </span>
          <span className="markdown-hybrid-structural-math-radical">√</span>
          <span className="markdown-hybrid-structural-math-slot-shell is-radicand">
            {renderRow(node.radicand, [...path, radicandSlot], getSlotLabel(radicandSlot), true)}
          </span>
        </span>
      );
    }
    case "sup": {
      const baseSlot = { nodeId: node.id, slotName: "base" } as const;
      const exponentSlot = { nodeId: node.id, slotName: "exponent" } as const;
      return (
        <span className="markdown-hybrid-structural-math-node is-script">
          <span className="markdown-hybrid-structural-math-slot-shell is-base">
            {renderRow(node.base, [...path, baseSlot], getSlotLabel(baseSlot), true)}
          </span>
          <span className="markdown-hybrid-structural-math-script-stack">
            <sup>
              {renderRow(node.exponent, [...path, exponentSlot], getSlotLabel(exponentSlot), true)}
            </sup>
          </span>
        </span>
      );
    }
    case "sub": {
      const baseSlot = { nodeId: node.id, slotName: "base" } as const;
      const subscriptSlot = { nodeId: node.id, slotName: "subscript" } as const;
      return (
        <span className="markdown-hybrid-structural-math-node is-script">
          <span className="markdown-hybrid-structural-math-slot-shell is-base">
            {renderRow(node.base, [...path, baseSlot], getSlotLabel(baseSlot), true)}
          </span>
          <span className="markdown-hybrid-structural-math-script-stack">
            <sub>
              {renderRow(
                node.subscript,
                [...path, subscriptSlot],
                getSlotLabel(subscriptSlot),
                true,
              )}
            </sub>
          </span>
        </span>
      );
    }
    case "subsup": {
      const baseSlot = { nodeId: node.id, slotName: "base" } as const;
      const subscriptSlot = { nodeId: node.id, slotName: "subscript" } as const;
      const exponentSlot = { nodeId: node.id, slotName: "exponent" } as const;
      return (
        <span className="markdown-hybrid-structural-math-node is-script">
          <span className="markdown-hybrid-structural-math-slot-shell is-base">
            {renderRow(node.base, [...path, baseSlot], getSlotLabel(baseSlot), true)}
          </span>
          <span className="markdown-hybrid-structural-math-script-stack">
            <sup>
              {renderRow(node.exponent, [...path, exponentSlot], getSlotLabel(exponentSlot), true)}
            </sup>
            <sub>
              {renderRow(
                node.subscript,
                [...path, subscriptSlot],
                getSlotLabel(subscriptSlot),
                true,
              )}
            </sub>
          </span>
        </span>
      );
    }
    case "delimited": {
      const slot = { nodeId: node.id, slotName: "body" } as const;
      return (
        <span className="markdown-hybrid-structural-math-node is-delimited">
          <span className="markdown-hybrid-structural-math-delimiter">
            {getDisplayValue(node.leftDelimiter)}
          </span>
          {renderRow(node.body, [...path, slot], getSlotLabel(slot), true)}
          <span className="markdown-hybrid-structural-math-delimiter">
            {getDisplayValue(node.rightDelimiter)}
          </span>
        </span>
      );
    }
    case "absolute": {
      const slot = { nodeId: node.id, slotName: "body" } as const;
      return (
        <span className="markdown-hybrid-structural-math-node is-delimited">
          <span className="markdown-hybrid-structural-math-delimiter">|</span>
          {renderRow(node.body, [...path, slot], getSlotLabel(slot), true)}
          <span className="markdown-hybrid-structural-math-delimiter">|</span>
        </span>
      );
    }
    case "functionCall": {
      const slot = { nodeId: node.id, slotName: "argument" } as const;
      return (
        <span className="markdown-hybrid-structural-math-node is-function">
          <span className="markdown-hybrid-structural-math-node-label">{node.name}</span>
          {renderRow(node.argument, [...path, slot], getSlotLabel(slot), true)}
        </span>
      );
    }
    case "integral": {
      const lowerSlot = { nodeId: node.id, slotName: "lower" } as const;
      const upperSlot = { nodeId: node.id, slotName: "upper" } as const;
      const integrandSlot = { nodeId: node.id, slotName: "integrand" } as const;
      const differentialSlot = { nodeId: node.id, slotName: "differential" } as const;
      return (
        <span className="markdown-hybrid-structural-math-node is-operator-stack">
          <span className="markdown-hybrid-structural-math-operator-frame">
            <span className="markdown-hybrid-structural-math-operator-symbol">∫</span>
            <span className="markdown-hybrid-structural-math-operator-bounds">
              <sup>
                {renderRow(node.upper, [...path, upperSlot], getSlotLabel(upperSlot), true)}
              </sup>
              <sub>
                {renderRow(node.lower, [...path, lowerSlot], getSlotLabel(lowerSlot), true)}
              </sub>
            </span>
          </span>
          <span className="markdown-hybrid-structural-math-operator-body">
            {renderRow(node.integrand, [...path, integrandSlot], getSlotLabel(integrandSlot), true)}
            <span className="markdown-hybrid-structural-math-operator-differential">
              {renderRow(
                node.differential,
                [...path, differentialSlot],
                getSlotLabel(differentialSlot),
                true,
              )}
            </span>
          </span>
        </span>
      );
    }
    case "sum":
    case "product": {
      const lowerSlot = { nodeId: node.id, slotName: "lower" } as const;
      const upperSlot = { nodeId: node.id, slotName: "upper" } as const;
      const bodySlot = { nodeId: node.id, slotName: "body" } as const;
      return (
        <span className="markdown-hybrid-structural-math-node is-operator-stack">
          <span className="markdown-hybrid-structural-math-operator-frame">
            <span className="markdown-hybrid-structural-math-operator-symbol">
              {node.kind === "sum" ? "∑" : "∏"}
            </span>
            <span className="markdown-hybrid-structural-math-operator-bounds">
              <sup>
                {renderRow(node.upper, [...path, upperSlot], getSlotLabel(upperSlot), true)}
              </sup>
              <sub>
                {renderRow(node.lower, [...path, lowerSlot], getSlotLabel(lowerSlot), true)}
              </sub>
            </span>
          </span>
          <span className="markdown-hybrid-structural-math-operator-body">
            {renderRow(node.body, [...path, bodySlot], getSlotLabel(bodySlot), true)}
          </span>
        </span>
      );
    }
    case "limit": {
      const approachSlot = { nodeId: node.id, slotName: "approach" } as const;
      const bodySlot = { nodeId: node.id, slotName: "body" } as const;
      return (
        <span className="markdown-hybrid-structural-math-node is-limit">
          <span className="markdown-hybrid-structural-math-limit-head">
            <span className="markdown-hybrid-structural-math-node-label">lim</span>
            <sub>
              {renderRow(node.approach, [...path, approachSlot], getSlotLabel(approachSlot), true)}
            </sub>
          </span>
          {renderRow(node.body, [...path, bodySlot], getSlotLabel(bodySlot), true)}
        </span>
      );
    }
    case "matrix":
      return (
        <span className="markdown-hybrid-structural-math-node is-matrix">
          <span className="markdown-hybrid-structural-math-node-toolbar">
            <span>{getMatrixEnvironmentLabel(node.environment)}</span>
            <button
              type="button"
              className="ghost small"
              onClick={() => onDispatch({ type: "insertMatrixRow", nodeId: node.id })}
            >
              + Row
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={() => onDispatch({ type: "insertMatrixColumn", nodeId: node.id })}
            >
              + Col
            </button>
          </span>
          <span
            className="markdown-hybrid-structural-math-matrix-grid"
            style={
              {
                "--md-math-matrix-cols": String(node.cells[0]?.length ?? 1),
              } as CSSProperties
            }
          >
            {node.cells.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const slot = { nodeId: node.id, slotName: "cell", rowIndex, colIndex } as const;
                return (
                  <span
                    key={`${node.id}-${rowIndex}-${colIndex}`}
                    className="markdown-hybrid-structural-math-matrix-cell"
                  >
                    {renderRow(cell, [...path, slot], getSlotLabel(slot), true)}
                  </span>
                );
              }),
            )}
          </span>
        </span>
      );
    case "vector":
      return (
        <span className="markdown-hybrid-structural-math-node is-vector">
          {node.cells.map((cell, rowIndex) => {
            const slot = { nodeId: node.id, slotName: "cell", rowIndex } as const;
            return (
              <span
                key={`${node.id}-${rowIndex}`}
                className="markdown-hybrid-structural-math-matrix-cell"
              >
                {renderRow(cell, [...path, slot], getSlotLabel(slot), true)}
              </span>
            );
          })}
        </span>
      );
    case "cases":
      return (
        <span className="markdown-hybrid-structural-math-node is-cases">
          <span className="markdown-hybrid-structural-math-node-toolbar">
            <span>Cases</span>
            <button
              type="button"
              className="ghost small"
              onClick={() => onDispatch({ type: "insertCasesRow", nodeId: node.id })}
            >
              + Row
            </button>
          </span>
          {node.rows.map((row, rowIndex) => {
            const valueSlot = { nodeId: node.id, slotName: "value", rowIndex } as const;
            const conditionSlot = { nodeId: node.id, slotName: "condition", rowIndex } as const;
            return (
              <span key={row.id} className="markdown-hybrid-structural-math-dual-row">
                {renderRow(row.value, [...path, valueSlot], getSlotLabel(valueSlot), true)}
                <span className="markdown-hybrid-structural-math-dual-separator">if</span>
                {renderRow(
                  row.condition,
                  [...path, conditionSlot],
                  getSlotLabel(conditionSlot),
                  true,
                )}
              </span>
            );
          })}
        </span>
      );
    case "aligned":
      return (
        <span className="markdown-hybrid-structural-math-node is-aligned">
          <span className="markdown-hybrid-structural-math-node-toolbar">
            <span>Aligned</span>
            <button
              type="button"
              className="ghost small"
              onClick={() => onDispatch({ type: "insertAlignedRow", nodeId: node.id })}
            >
              + Row
            </button>
          </span>
          {node.rows.map((row, rowIndex) => {
            const leftSlot = { nodeId: node.id, slotName: "left", rowIndex } as const;
            const rightSlot = { nodeId: node.id, slotName: "right", rowIndex } as const;
            return (
              <span key={row.id} className="markdown-hybrid-structural-math-dual-row">
                {renderRow(row.left, [...path, leftSlot], getSlotLabel(leftSlot), true)}
                <span className="markdown-hybrid-structural-math-dual-separator">=</span>
                {renderRow(row.right, [...path, rightSlot], getSlotLabel(rightSlot), true)}
              </span>
            );
          })}
        </span>
      );
  }
};
