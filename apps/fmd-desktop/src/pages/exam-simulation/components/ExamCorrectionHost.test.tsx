/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamCorrectionHost.test.tsx
 *
 * Zweck:
 * - Verifiziert die Quellen-Badge-Steuerung im Correction-Host.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExamCorrectionHost } from "./ExamCorrectionHost";

const buildProps = (showSourceBadge = true) => ({
  task: {
    id: "task-1",
    index: 0,
    rawLines: ["Question"],
    prompt: "Question",
    gradingMode: "auto",
    sourceRange: { startLine: 0, endLine: 0 },
    cardWrapper: false,
    cardLines: ["Question"],
    warnings: [],
    sourceTitle: "exam.md",
    sessionTaskId: "session-task-1",
    sourceExamPath: "/vault/exam.md",
    sourceTaskIndex: 0,
    sessionIndex: 0,
    originalTaskNumber: 1,
    card: {
      kind: "composite",
      parts: [
        {
          kind: "free-text",
          front: "Question",
          back: "Answer",
        },
      ],
    },
  },
  queueIndex: 0,
  queueLength: 1,
  maxPoints: 5,
  partStates: [{}],
  submitted: false,
  showSourceBadge,
  canGoBack: false,
  canGoNext: false,
  onOptionSelect: vi.fn(),
  onTrueFalseSelect: vi.fn(),
  onClozeInputChange: vi.fn(),
  onClozeTokenDrop: vi.fn(),
  onClozeTokenRemove: vi.fn(),
  onTextInputChange: vi.fn(),
  onSubmit: vi.fn(),
  onBack: vi.fn(),
  onNext: vi.fn(),
  onBackToResults: vi.fn(),
});

describe("ExamCorrectionHost", () => {
  it("toggles source badge visibility via showSourceBadge", () => {
    const withSource = renderToStaticMarkup(
      createElement(ExamCorrectionHost, buildProps(true)),
    );
    expect(withSource).toContain("Quelle: exam.md");

    const withoutSource = renderToStaticMarkup(
      createElement(ExamCorrectionHost, buildProps(false)),
    );
    expect(withoutSource).not.toContain("Quelle: exam.md");
  });
});
