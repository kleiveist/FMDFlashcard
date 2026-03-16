/**
 * @file apps/fmd-desktop/src/pages/exam-editor/components/ContentForms.tsx
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { MarkdownHybridEditor, type MarkdownHybridEditorHandle } from "../../../features/preview/MarkdownHybridEditor";
import type { CardBlueprint, ChoiceOption } from "../../../features/exam-editor/types";
import type { CardValidation } from "../../../features/exam-editor/validation";
import { serializeCardTypeLabel } from "../../../features/exam-editor/serializer";
import { ClozeCard as ClozeCardPreview } from "../../../components/flashcards/ClozeCard";
import { parseFlashcards, type ClozeCard as ClozeCardType } from "../../../lib/flashcards";
import { ExamMarkdown } from "../../exam-simulation/components/ExamMarkdown";
import { serializeChoiceRawBody } from "../../../features/exam-editor/choiceRawBody";
import type { VaultFile, VaultPngAsset } from "../../../lib/tree";

type BaseCardFormProps = {
  card: CardBlueprint;
  validation?: CardValidation;
  vaultFiles?: VaultFile[] | null;
  vaultPngAssets?: VaultPngAsset[] | null;
  vaultPath?: string | null;
  sourceRelativePath?: string | null;
  onPromptChange: (value: string) => void;
  onHelpChange: (value: string) => void;
};

type QaCardFormProps = BaseCardFormProps & {
  card: Extract<CardBlueprint, { type: "qa" }>;
  onAnswerChange: (value: string) => void;
};

type TfCardFormProps = BaseCardFormProps & {
  card: Extract<CardBlueprint, { type: "tf" }>;
  onCorrectChange: (value: "true" | "false") => void;
};

type ChoiceCardFormProps = BaseCardFormProps & {
  card: Extract<CardBlueprint, { type: "m1" | "m2" }>;
  onChoiceRawBodyChange: (value: string) => void;
  onOptionTextChange: (optionId: string, value: string) => void;
  onOptionToggle: (optionId: string, value: boolean) => void;
  onOptionSelect: (optionId: string) => void;
  onOptionAdd: () => void;
  onOptionRemove: (optionId: string) => void;
};

type ClozeCardFormProps = BaseCardFormProps & {
  card: Extract<CardBlueprint, { type: "cl" | "cd" | "cld" }>;
};

const noop = (..._args: unknown[]) => {};

const buildClozePreview = (prompt: string): ClozeCardType | null => {
  if (!prompt.trim()) {
    return null;
  }
  const source = `#card\n${prompt}\n#`;
  const parsed = parseFlashcards(source, { answerMatch: "line-start" });
  const card = parsed[0];
  if (!card || card.kind !== "composite") {
    return null;
  }
  const clozePart = card.parts.find((part) => part.kind === "cloze");
  return clozePart && clozePart.kind === "cloze" ? clozePart : null;
};

type CardContentFormProps = {
  card: CardBlueprint;
  validation?: CardValidation;
  onPromptChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onCorrectChange: (value: "true" | "false" | null) => void;
  onOptionTextChange: (optionId: string, value: string) => void;
  onOptionToggle: (optionId: string, value: boolean) => void;
  onOptionSelect: (optionId: string) => void;
  onOptionAdd: () => void;
  onOptionRemove: (optionId: string) => void;
  onChoiceRawBodyChange: (value: string) => void;
  onHelpChange: (value: string) => void;
  vaultFiles?: VaultFile[] | null;
  vaultPngAssets?: VaultPngAsset[] | null;
  vaultPath?: string | null;
  sourceRelativePath?: string | null;
};

const renderFieldError = (message?: string) =>
  message ? <span className="field-error">{message}</span> : null;

type StructuredInsertPanelProps = {
  onInsertTable: () => void;
  onInsertCodeBlock: () => void;
  onInsertMathBlock: () => void;
  onInsertPng: () => void;
};

const StructuredInsertPanel = ({
  onInsertTable,
  onInsertCodeBlock,
  onInsertMathBlock,
  onInsertPng,
}: StructuredInsertPanelProps) => (
  <details className="media-editor">
    <summary className="media-editor-summary">
      <span className="label">Structured Insert</span>
      <span className="muted small">Table, Code, Math, PNG</span>
    </summary>
    <div className="media-editor-body">
      <div className="structured-insert-grid">
        <button type="button" className="ghost small" onClick={onInsertTable}>
          Table
        </button>
        <button type="button" className="ghost small" onClick={onInsertCodeBlock}>
          Code block
        </button>
        <button type="button" className="ghost small" onClick={onInsertMathBlock}>
          Math block
        </button>
        <button type="button" className="ghost small" onClick={onInsertPng}>
          PNG image
        </button>
      </div>
    </div>
  </details>
);

type StructuredMarkdownFieldProps = {
  fieldId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  historyKey: string;
  error?: string;
  vaultFiles?: VaultFile[] | null;
  vaultPngAssets?: VaultPngAsset[] | null;
  vaultPath?: string | null;
  sourceRelativePath?: string | null;
  onActivateField: (fieldId: string) => void;
  onRegisterHandle: (fieldId: string, handle: MarkdownHybridEditorHandle | null) => void;
};

const StructuredMarkdownField = ({
  fieldId,
  label,
  value,
  onChange,
  historyKey,
  error,
  vaultFiles,
  vaultPngAssets,
  vaultPath,
  sourceRelativePath,
  onActivateField,
  onRegisterHandle,
}: StructuredMarkdownFieldProps) => {
  const renderPreview = useCallback(
    (source: string) => (
      <ExamMarkdown
        content={source}
        vaultPath={vaultPath}
        vaultPngAssets={vaultPngAssets}
      />
    ),
    [vaultPath, vaultPngAssets],
  );

  return (
    <div className="field" role="group" aria-label={label}>
      <span className="label">{label}</span>
      <div
        className="exam-structured-field-shell"
        onMouseDownCapture={() => onActivateField(fieldId)}
        onFocusCapture={() => onActivateField(fieldId)}
      >
        <MarkdownHybridEditor
          ref={(handle) => onRegisterHandle(fieldId, handle)}
          historyKey={historyKey}
          markdown={value}
          mode="edit"
          tableCodeViewPolicy="button-only"
          vaultFiles={vaultFiles ?? undefined}
          vaultPngAssets={vaultPngAssets ?? undefined}
          vaultPath={vaultPath}
          sourceRelativePath={sourceRelativePath}
          onChange={onChange}
          renderPreview={renderPreview}
        />
      </div>
      {renderFieldError(error)}
    </div>
  );
};

const useStructuredInsertRouter = (fieldOrder: readonly string[]) => {
  const handlesRef = useRef<Record<string, MarkdownHybridEditorHandle | null>>({});
  const [activeFieldId, setActiveFieldId] = useState<string>(fieldOrder[0] ?? "");

  const onRegisterHandle = useCallback(
    (fieldId: string, handle: MarkdownHybridEditorHandle | null) => {
      handlesRef.current[fieldId] = handle;
    },
    [],
  );

  const onActivateField = useCallback((fieldId: string) => {
    setActiveFieldId(fieldId);
  }, []);

  const resolveTargetHandle = useCallback(() => {
    const activeHandle = handlesRef.current[activeFieldId];
    if (activeHandle) {
      return activeHandle;
    }
    for (const fieldId of fieldOrder) {
      const handle = handlesRef.current[fieldId];
      if (handle) {
        return handle;
      }
    }
    return null;
  }, [activeFieldId, fieldOrder]);

  const insertTable = useCallback(() => {
    const handle = resolveTargetHandle();
    if (!handle) {
      return;
    }
    void handle.insertStructureTemplate("table");
  }, [resolveTargetHandle]);

  const insertCodeBlock = useCallback(() => {
    const handle = resolveTargetHandle();
    if (!handle) {
      return;
    }
    void handle.insertStructureTemplate("code-block");
  }, [resolveTargetHandle]);

  const insertMathBlock = useCallback(() => {
    const handle = resolveTargetHandle();
    if (!handle) {
      return;
    }
    void handle.insertStructureTemplate("math-block");
  }, [resolveTargetHandle]);

  const insertPng = useCallback(() => {
    const handle = resolveTargetHandle();
    if (!handle) {
      return;
    }
    void handle.openImageInsertPicker();
  }, [resolveTargetHandle]);

  return {
    onRegisterHandle,
    onActivateField,
    insertTable,
    insertCodeBlock,
    insertMathBlock,
    insertPng,
  };
};

const renderChoiceOption = (
  option: ChoiceOption,
  card: ChoiceCardFormProps["card"],
  validation: CardValidation | undefined,
  onOptionTextChange: ChoiceCardFormProps["onOptionTextChange"],
  onOptionToggle: ChoiceCardFormProps["onOptionToggle"],
  onOptionSelect: ChoiceCardFormProps["onOptionSelect"],
  onOptionRemove: ChoiceCardFormProps["onOptionRemove"],
) => {
  const hasError = Boolean(validation?.optionErrors?.[option.id]);
  return (
    <div key={option.id} className={`option-row ${hasError ? "has-error" : ""}`}>
      <label className="option-choice">
        {card.type === "m1" ? (
          <input
            type="radio"
            name={`m1-${card.id}`}
            checked={option.isCorrect}
            onChange={() => onOptionSelect(option.id)}
          />
        ) : (
          <input
            type="checkbox"
            checked={option.isCorrect}
            onChange={(event) => onOptionToggle(option.id, event.target.checked)}
          />
        )}
      </label>
      <input
        className="text-input"
        value={option.text}
        onChange={(event) => onOptionTextChange(option.id, event.target.value)}
        placeholder="Option text"
      />
      <button
        type="button"
        className="ghost small danger"
        onClick={() => onOptionRemove(option.id)}
      >
        Remove
      </button>
      {renderFieldError(validation?.optionErrors?.[option.id])}
    </div>
  );
};

const QA_FIELD_ORDER = ["prompt", "answer", "help"] as const;
const TF_FIELD_ORDER = ["prompt", "help"] as const;
const CHOICE_FIELD_ORDER = ["raw", "help"] as const;
const CLOZE_FIELD_ORDER = ["prompt", "help"] as const;

const QaCardForm = ({
  card,
  validation,
  vaultFiles,
  vaultPngAssets,
  vaultPath,
  sourceRelativePath,
  onPromptChange,
  onAnswerChange,
  onHelpChange,
}: QaCardFormProps) => {
  const router = useStructuredInsertRouter(QA_FIELD_ORDER);
  const promptError = [validation?.fieldErrors.prompt, validation?.fieldErrors.syntax]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="card-form">
      <StructuredInsertPanel
        onInsertTable={router.insertTable}
        onInsertCodeBlock={router.insertCodeBlock}
        onInsertMathBlock={router.insertMathBlock}
        onInsertPng={router.insertPng}
      />
      <StructuredMarkdownField
        fieldId="prompt"
        label="Task description"
        value={card.prompt}
        onChange={onPromptChange}
        historyKey={`exam-card-${card.id}-prompt`}
        error={promptError || undefined}
        vaultFiles={vaultFiles}
        vaultPngAssets={vaultPngAssets}
        vaultPath={vaultPath}
        sourceRelativePath={sourceRelativePath}
        onActivateField={router.onActivateField}
        onRegisterHandle={router.onRegisterHandle}
      />
      <StructuredMarkdownField
        fieldId="answer"
        label="Answer"
        value={card.answer}
        onChange={onAnswerChange}
        historyKey={`exam-card-${card.id}-answer`}
        error={validation?.fieldErrors.answer}
        vaultFiles={vaultFiles}
        vaultPngAssets={vaultPngAssets}
        vaultPath={vaultPath}
        sourceRelativePath={sourceRelativePath}
        onActivateField={router.onActivateField}
        onRegisterHandle={router.onRegisterHandle}
      />
      <StructuredMarkdownField
        fieldId="help"
        label="Card help / hint"
        value={card.helpText ?? ""}
        onChange={onHelpChange}
        historyKey={`exam-card-${card.id}-help`}
        vaultFiles={vaultFiles}
        vaultPngAssets={vaultPngAssets}
        vaultPath={vaultPath}
        sourceRelativePath={sourceRelativePath}
        onActivateField={router.onActivateField}
        onRegisterHandle={router.onRegisterHandle}
      />
    </div>
  );
};

const TfCardForm = ({
  card,
  validation,
  vaultFiles,
  vaultPngAssets,
  vaultPath,
  sourceRelativePath,
  onPromptChange,
  onCorrectChange,
  onHelpChange,
}: TfCardFormProps) => {
  const router = useStructuredInsertRouter(TF_FIELD_ORDER);
  const promptError = [validation?.fieldErrors.prompt, validation?.fieldErrors.syntax]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="card-form">
      <StructuredInsertPanel
        onInsertTable={router.insertTable}
        onInsertCodeBlock={router.insertCodeBlock}
        onInsertMathBlock={router.insertMathBlock}
        onInsertPng={router.insertPng}
      />
      <StructuredMarkdownField
        fieldId="prompt"
        label="Task description"
        value={card.prompt}
        onChange={onPromptChange}
        historyKey={`exam-card-${card.id}-prompt`}
        error={promptError || undefined}
        vaultFiles={vaultFiles}
        vaultPngAssets={vaultPngAssets}
        vaultPath={vaultPath}
        sourceRelativePath={sourceRelativePath}
        onActivateField={router.onActivateField}
        onRegisterHandle={router.onRegisterHandle}
      />
      <label className="field">
        <span className="label">Correct answer</span>
        <div className="choice-row">
          <label className="choice-pill">
            <input
              type="radio"
              name={`tf-${card.id}`}
              checked={card.correct === "true"}
              onChange={() => onCorrectChange("true")}
            />
            True
          </label>
          <label className="choice-pill">
            <input
              type="radio"
              name={`tf-${card.id}`}
              checked={card.correct === "false"}
              onChange={() => onCorrectChange("false")}
            />
            False
          </label>
        </div>
        {renderFieldError(validation?.fieldErrors.correct)}
      </label>
      <StructuredMarkdownField
        fieldId="help"
        label="Card help / hint"
        value={card.helpText ?? ""}
        onChange={onHelpChange}
        historyKey={`exam-card-${card.id}-help`}
        vaultFiles={vaultFiles}
        vaultPngAssets={vaultPngAssets}
        vaultPath={vaultPath}
        sourceRelativePath={sourceRelativePath}
        onActivateField={router.onActivateField}
        onRegisterHandle={router.onRegisterHandle}
      />
    </div>
  );
};

const ChoiceCardForm = ({
  card,
  validation,
  vaultFiles,
  vaultPngAssets,
  vaultPath,
  sourceRelativePath,
  onChoiceRawBodyChange,
  onOptionTextChange,
  onOptionToggle,
  onOptionSelect,
  onOptionAdd,
  onOptionRemove,
  onHelpChange,
}: ChoiceCardFormProps) => {
  const router = useStructuredInsertRouter(CHOICE_FIELD_ORDER);
  const rawError = [validation?.fieldErrors.prompt, validation?.fieldErrors.syntax]
    .filter(Boolean)
    .join(" ");
  const choiceSource = useMemo(
    () => (card.rawBody?.trim() ? card.rawBody : serializeChoiceRawBody(card)),
    [card],
  );

  return (
    <div className="card-form">
      <StructuredInsertPanel
        onInsertTable={router.insertTable}
        onInsertCodeBlock={router.insertCodeBlock}
        onInsertMathBlock={router.insertMathBlock}
        onInsertPng={router.insertPng}
      />
      <StructuredMarkdownField
        fieldId="raw"
        label="Question + options source"
        value={choiceSource}
        onChange={onChoiceRawBodyChange}
        historyKey={`exam-card-${card.id}-raw`}
        error={rawError || undefined}
        vaultFiles={vaultFiles}
        vaultPngAssets={vaultPngAssets}
        vaultPath={vaultPath}
        sourceRelativePath={sourceRelativePath}
        onActivateField={router.onActivateField}
        onRegisterHandle={router.onRegisterHandle}
      />
      <div className="field">
        <div className="field-header">
          <span className="label">Options</span>
          <button type="button" className="ghost small" onClick={onOptionAdd}>
            Add option
          </button>
        </div>
        <div className="option-list">
          {card.options.map((option) =>
            renderChoiceOption(
              option,
              card,
              validation,
              onOptionTextChange,
              onOptionToggle,
              onOptionSelect,
              onOptionRemove,
            ),
          )}
        </div>
        {renderFieldError(validation?.fieldErrors.options)}
        {renderFieldError(validation?.fieldErrors.correct)}
      </div>
      <StructuredMarkdownField
        fieldId="help"
        label="Card help / hint"
        value={card.helpText ?? ""}
        onChange={onHelpChange}
        historyKey={`exam-card-${card.id}-help`}
        vaultFiles={vaultFiles}
        vaultPngAssets={vaultPngAssets}
        vaultPath={vaultPath}
        sourceRelativePath={sourceRelativePath}
        onActivateField={router.onActivateField}
        onRegisterHandle={router.onRegisterHandle}
      />
    </div>
  );
};

const ClozeCardForm = ({
  card,
  validation,
  vaultFiles,
  vaultPngAssets,
  vaultPath,
  sourceRelativePath,
  onPromptChange,
  onHelpChange,
}: ClozeCardFormProps) => {
  const router = useStructuredInsertRouter(CLOZE_FIELD_ORDER);
  const [showPreview, setShowPreview] = useState(false);
  const previewCard = useMemo(() => buildClozePreview(card.prompt), [card.prompt]);
  const promptError = [validation?.fieldErrors.prompt, validation?.fieldErrors.syntax]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="card-form">
      <StructuredInsertPanel
        onInsertTable={router.insertTable}
        onInsertCodeBlock={router.insertCodeBlock}
        onInsertMathBlock={router.insertMathBlock}
        onInsertPng={router.insertPng}
      />
      <StructuredMarkdownField
        fieldId="prompt"
        label="Task description"
        value={card.prompt}
        onChange={onPromptChange}
        historyKey={`exam-card-${card.id}-prompt`}
        error={promptError || undefined}
        vaultFiles={vaultFiles}
        vaultPngAssets={vaultPngAssets}
        vaultPath={vaultPath}
        sourceRelativePath={sourceRelativePath}
        onActivateField={router.onActivateField}
        onRegisterHandle={router.onRegisterHandle}
      />
      <div className="hint-box">
        {card.type === "cl" ? (
          <p>Use %answer% to create typed blanks.</p>
        ) : card.type === "cd" ? (
          <p>Use "token" to create drag blanks.</p>
        ) : (
          <p>Combine %blanks% with "tokens" for mixed cloze.</p>
        )}
      </div>
      <div className="cloze-preview">
        <div className="cloze-preview-header">
          <span className="label">Preview</span>
          <button
            type="button"
            className="ghost small"
            onClick={() => setShowPreview((prev) => !prev)}
          >
            {showPreview ? "Hide preview" : "Show preview"}
          </button>
        </div>
        {showPreview ? (
          previewCard ? (
            <div className="help-preview cloze-preview-surface">
              <ClozeCardPreview
                card={previewCard}
                cardIndex={0}
                submitted
                responses={{}}
                showSubmit={false}
                showResult={false}
                revealCorrectness={false}
                showSolution={false}
                helpEnabled={false}
                onInputChange={noop}
                onTokenDrop={noop}
                onTokenRemove={noop}
                onTokenDragStart={noop}
                onBlankDragOver={noop}
                onSubmit={noop}
              />
            </div>
          ) : (
            <div className="help-preview cloze-preview-empty">
              Add at least one cloze marker to see the preview.
            </div>
          )
        ) : null}
      </div>
      <StructuredMarkdownField
        fieldId="help"
        label="Card help / hint"
        value={card.helpText ?? ""}
        onChange={onHelpChange}
        historyKey={`exam-card-${card.id}-help`}
        vaultFiles={vaultFiles}
        vaultPngAssets={vaultPngAssets}
        vaultPath={vaultPath}
        sourceRelativePath={sourceRelativePath}
        onActivateField={router.onActivateField}
        onRegisterHandle={router.onRegisterHandle}
      />
    </div>
  );
};

export const CardContentForm = ({
  card,
  validation,
  onPromptChange,
  onAnswerChange,
  onCorrectChange,
  onOptionTextChange,
  onOptionToggle,
  onOptionSelect,
  onOptionAdd,
  onOptionRemove,
  onChoiceRawBodyChange,
  onHelpChange,
  vaultFiles,
  vaultPngAssets,
  vaultPath,
  sourceRelativePath,
}: CardContentFormProps) => {
  const title = serializeCardTypeLabel(card.type);
  const isValid = validation ? validation.valid : true;
  const statusLabel = isValid ? "Valid" : "Needs work";
  const statusClass = isValid ? "success" : "warning";

  return (
    <section className="exam-card-form">
      <header className="exam-card-form-header">
        <h3>{title} Card</h3>
        <div className="exam-card-form-tags">
          <span className={`pill ${statusClass}`}>{statusLabel}</span>
          {card.helpText?.trim() ? <span className="pill">Hint</span> : null}
          <span className="pill">Structured</span>
        </div>
      </header>
      {card.type === "qa" ? (
        <QaCardForm
          card={card}
          validation={validation}
          vaultFiles={vaultFiles}
          vaultPngAssets={vaultPngAssets}
          vaultPath={vaultPath}
          sourceRelativePath={sourceRelativePath}
          onPromptChange={onPromptChange}
          onAnswerChange={onAnswerChange}
          onHelpChange={onHelpChange}
        />
      ) : null}
      {card.type === "tf" ? (
        <TfCardForm
          card={card}
          validation={validation}
          vaultFiles={vaultFiles}
          vaultPngAssets={vaultPngAssets}
          vaultPath={vaultPath}
          sourceRelativePath={sourceRelativePath}
          onPromptChange={onPromptChange}
          onCorrectChange={onCorrectChange}
          onHelpChange={onHelpChange}
        />
      ) : null}
      {card.type === "m1" || card.type === "m2" ? (
        <ChoiceCardForm
          card={card}
          validation={validation}
          vaultFiles={vaultFiles}
          vaultPngAssets={vaultPngAssets}
          vaultPath={vaultPath}
          sourceRelativePath={sourceRelativePath}
          onPromptChange={onPromptChange}
          onChoiceRawBodyChange={onChoiceRawBodyChange}
          onOptionTextChange={onOptionTextChange}
          onOptionToggle={onOptionToggle}
          onOptionSelect={onOptionSelect}
          onOptionAdd={onOptionAdd}
          onOptionRemove={onOptionRemove}
          onHelpChange={onHelpChange}
        />
      ) : null}
      {card.type === "cl" || card.type === "cd" || card.type === "cld" ? (
        <ClozeCardForm
          card={card}
          validation={validation}
          vaultFiles={vaultFiles}
          vaultPngAssets={vaultPngAssets}
          vaultPath={vaultPath}
          sourceRelativePath={sourceRelativePath}
          onPromptChange={onPromptChange}
          onHelpChange={onHelpChange}
        />
      ) : null}
    </section>
  );
};
