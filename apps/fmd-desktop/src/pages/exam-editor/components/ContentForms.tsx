/**
 * @file apps/fmd-desktop/src/pages/exam-editor/components/ContentForms.tsx
 */

import type { CardBlueprint, ChoiceOption } from "../../../features/exam-editor/types";
import type { CardValidation } from "../../../features/exam-editor/validation";
import { serializeCardTypeLabel } from "../../../features/exam-editor/serializer";
import { HelpEditor } from "./HelpEditor";

type BaseCardFormProps = {
  card: CardBlueprint;
  validation?: CardValidation;
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
  onOptionTextChange: (optionId: string, value: string) => void;
  onOptionToggle: (optionId: string, value: boolean) => void;
  onOptionSelect: (optionId: string) => void;
  onOptionAdd: () => void;
  onOptionRemove: (optionId: string) => void;
};

type ClozeCardFormProps = BaseCardFormProps & {
  card: Extract<CardBlueprint, { type: "cl" | "cd" | "cld" }>;
};

type CardContentFormProps = {
  card: CardBlueprint;
  validation?: CardValidation;
  onPromptChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onCorrectChange: (value: "true" | "false") => void;
  onOptionTextChange: (optionId: string, value: string) => void;
  onOptionToggle: (optionId: string, value: boolean) => void;
  onOptionSelect: (optionId: string) => void;
  onOptionAdd: () => void;
  onOptionRemove: (optionId: string) => void;
  onHelpChange: (value: string) => void;
};

const renderFieldError = (message?: string) =>
  message ? <span className="field-error">{message}</span> : null;

const renderPromptField = (
  card: CardBlueprint,
  validation: CardValidation | undefined,
  onPromptChange: (value: string) => void,
) => (
  <label className="field">
    <span className="label">Prompt</span>
    <textarea
      className="text-input exam-textarea"
      rows={4}
      value={"prompt" in card ? card.prompt : ""}
      onChange={(event) => onPromptChange(event.target.value)}
      placeholder="Write the task prompt..."
    />
    {renderFieldError(validation?.fieldErrors.prompt)}
    {renderFieldError(validation?.fieldErrors.syntax)}
  </label>
);

const renderHelpField = (
  label: string,
  value: string,
  onHelpChange: (value: string) => void,
) => (
  <HelpEditor
    label={label}
    value={value}
    onChange={onHelpChange}
    showPreviewToggle
  />
);

const QaCardForm = ({
  card,
  validation,
  onPromptChange,
  onAnswerChange,
  onHelpChange,
}: QaCardFormProps) => (
  <div className="card-form">
    {renderPromptField(card, validation, onPromptChange)}
    <label className="field">
      <span className="label">Answer</span>
      <textarea
        className="text-input exam-textarea"
        rows={3}
        value={card.answer}
        onChange={(event) => onAnswerChange(event.target.value)}
        placeholder="Answer text (line-start Answer: in exam mode)"
      />
      {renderFieldError(validation?.fieldErrors.answer)}
    </label>
    {renderHelpField("Card help / hint", card.helpText ?? "", onHelpChange)}
  </div>
);

const TfCardForm = ({
  card,
  validation,
  onPromptChange,
  onCorrectChange,
  onHelpChange,
}: TfCardFormProps) => (
  <div className="card-form">
    {renderPromptField(card, validation, onPromptChange)}
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
    {renderHelpField("Card help / hint", card.helpText ?? "", onHelpChange)}
  </div>
);

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

const ChoiceCardForm = ({
  card,
  validation,
  onPromptChange,
  onOptionTextChange,
  onOptionToggle,
  onOptionSelect,
  onOptionAdd,
  onOptionRemove,
  onHelpChange,
}: ChoiceCardFormProps) => (
  <div className="card-form">
    {renderPromptField(card, validation, onPromptChange)}
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
    {renderHelpField("Card help / hint", card.helpText ?? "", onHelpChange)}
  </div>
);

const ClozeCardForm = ({
  card,
  validation,
  onPromptChange,
  onHelpChange,
}: ClozeCardFormProps) => (
  <div className="card-form">
    {renderPromptField(card, validation, onPromptChange)}
    <div className="hint-box">
      {card.type === "cl" ? (
        <p>Use %%answer%% to create typed blanks.</p>
      ) : card.type === "cd" ? (
        <p>Use inline `token` to create drag blanks.</p>
      ) : (
        <p>Combine %%blanks%% with `tokens` for mixed cloze.</p>
      )}
    </div>
    {renderHelpField("Card help / hint", card.helpText ?? "", onHelpChange)}
  </div>
);

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
  onHelpChange,
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
        </div>
      </header>
      {card.type === "qa" ? (
        <QaCardForm
          card={card}
          validation={validation}
          onPromptChange={onPromptChange}
          onAnswerChange={onAnswerChange}
          onHelpChange={onHelpChange}
        />
      ) : null}
      {card.type === "tf" ? (
        <TfCardForm
          card={card}
          validation={validation}
          onPromptChange={onPromptChange}
          onCorrectChange={onCorrectChange}
          onHelpChange={onHelpChange}
        />
      ) : null}
      {card.type === "m1" || card.type === "m2" ? (
        <ChoiceCardForm
          card={card}
          validation={validation}
          onPromptChange={onPromptChange}
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
          onPromptChange={onPromptChange}
          onHelpChange={onHelpChange}
        />
      ) : null}
    </section>
  );
};
