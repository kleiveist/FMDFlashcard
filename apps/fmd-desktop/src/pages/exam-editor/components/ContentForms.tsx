/**
 * @file apps/fmd-desktop/src/pages/exam-editor/components/ContentForms.tsx
 */

import { useMemo, useState } from "react";
import { MediaBlockCard } from "../../../components/media/MediaBlockCard";
import { VaultPngPicker } from "../../../components/media/VaultPngPicker";
import { SvgPreviewBlock } from "../../../components/flashcards/SvgPreviewBlock";
import {
  createEditorMediaDraft,
  editorMediaDraftToItem,
  type EditorMediaDraft,
} from "../../../lib/cardMedia";
import type { CardBlueprint, ChoiceOption } from "../../../features/exam-editor/types";
import type { CardValidation } from "../../../features/exam-editor/validation";
import { serializeCardTypeLabel } from "../../../features/exam-editor/serializer";
import { ClozeCard as ClozeCardPreview } from "../../../components/flashcards/ClozeCard";
import { parseFlashcards, type ClozeCard as ClozeCardType } from "../../../lib/flashcards";
import { HelpEditor } from "./HelpEditor";
import { AutoGrowTextarea } from "./AutoGrowTextarea";
import type { VaultPngAsset } from "../../../lib/tree";

type BaseCardFormProps = {
  card: CardBlueprint;
  validation?: CardValidation;
  vaultPngAssets?: VaultPngAsset[] | null;
  onPromptChange: (value: string) => void;
  onHelpChange: (value: string) => void;
  onMediaChange: (value: EditorMediaDraft[]) => void;
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
  onCorrectChange: (value: "true" | "false") => void;
  onOptionTextChange: (optionId: string, value: string) => void;
  onOptionToggle: (optionId: string, value: boolean) => void;
  onOptionSelect: (optionId: string) => void;
  onOptionAdd: () => void;
  onOptionRemove: (optionId: string) => void;
  onHelpChange: (value: string) => void;
  onMediaChange: (value: EditorMediaDraft[]) => void;
  vaultPngAssets?: VaultPngAsset[] | null;
};

const renderFieldError = (message?: string) =>
  message ? <span className="field-error">{message}</span> : null;

const renderPromptField = (
  card: CardBlueprint,
  validation: CardValidation | undefined,
  onPromptChange: (value: string) => void,
) => (
  <label className="field">
    <span className="label">Task description</span>
    <AutoGrowTextarea
      className="text-input exam-textarea"
      rows={4}
      value={"prompt" in card ? card.prompt : ""}
      onChange={onPromptChange}
      placeholder="Write the task description..."
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

type MediaEditorProps = {
  value: EditorMediaDraft[];
  onChange: (value: EditorMediaDraft[]) => void;
  vaultPngAssets?: VaultPngAsset[] | null;
};

const blankPngDraft = () => createEditorMediaDraft({ type: "png" });
const blankSvgDraft = () => createEditorMediaDraft({ type: "svg" });

export const MediaEditor = ({ value, onChange, vaultPngAssets }: MediaEditorProps) => {
  const [activeTab, setActiveTab] = useState<"svg" | "png">("png");
  const [pngQuery, setPngQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pngDraft, setPngDraft] = useState<EditorMediaDraft>(() => blankPngDraft());
  const [svgDraft, setSvgDraft] = useState<EditorMediaDraft>(() => blankSvgDraft());

  const configuredCount = value.length;
  const summary =
    configuredCount > 0
      ? `${configuredCount} item${configuredCount === 1 ? "" : "s"} configured`
      : "Optional, collapsed by default";

  const resetComposer = (kind: "png" | "svg") => {
    setEditingId(null);
    if (kind === "png") {
      setPngDraft(blankPngDraft());
      return;
    }
    setSvgDraft(blankSvgDraft());
  };

  const updateDraft = (
    kind: "png" | "svg",
    updater: (draft: EditorMediaDraft) => EditorMediaDraft,
  ) => {
    if (kind === "png") {
      setPngDraft((current) => updater(current));
      return;
    }
    setSvgDraft((current) => updater(current));
  };

  const handleSelectPng = (relPath: string) => {
    setActiveTab("png");
    setPngDraft((current) => {
      const fallbackLabel = relPath.split("/").pop()?.replace(/\.png$/i, "") ?? "";
      const shouldReplaceLabel =
        !current.label.trim() || current.label.trim() === current.src.trim();
      return {
        ...current,
        src: relPath,
        label: shouldReplaceLabel ? fallbackLabel : current.label,
      };
    });
  };

  const handleSaveDraft = (kind: "png" | "svg") => {
    const currentDraft = kind === "png" ? pngDraft : svgDraft;
    if (kind === "png" && !currentDraft.src.trim()) {
      return;
    }
    if (kind === "svg" && !currentDraft.inlineSvg.trim()) {
      return;
    }
    const nextDraft = createEditorMediaDraft({
      ...currentDraft,
      id: editingId && currentDraft.id === editingId ? currentDraft.id : undefined,
      type: kind,
      src: kind === "png" ? currentDraft.src : "",
      inlineSvg: kind === "svg" ? currentDraft.inlineSvg : "",
    });
    const nextItems = editingId
      ? value.map((item) => (item.id === editingId ? nextDraft : item))
      : [...value, nextDraft];
    onChange(nextItems);
    resetComposer(kind);
  };

  const handleEditItem = (item: EditorMediaDraft) => {
    setEditingId(item.id);
    setActiveTab(item.type);
    if (item.type === "png") {
      setPngDraft(createEditorMediaDraft(item));
      return;
    }
    setSvgDraft(createEditorMediaDraft(item));
  };

  const moveItem = (sourceIndex: number, direction: -1 | 1) => {
    const targetIndex = sourceIndex + direction;
    if (targetIndex < 0 || targetIndex >= value.length) {
      return;
    }
    const next = value.slice();
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
  };

  return (
    <details className="media-editor">
      <summary className="media-editor-summary">
        <span className="label">Media</span>
        <span className="muted small">{summary}</span>
      </summary>
      <div className="media-editor-body">
        {value.length > 0 ? (
          <div className="media-editor-items">
            {value.map((item, index) => (
              <div key={item.id} className="media-editor-item">
                <div className="media-editor-item-toolbar">
                  <span className="pill">{item.type.toUpperCase()}</span>
                  <div className="media-editor-item-actions">
                    <button
                      type="button"
                      className="ghost small"
                      onClick={() => handleEditItem(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ghost small"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="ghost small"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === value.length - 1}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      className="ghost small danger"
                      onClick={() => {
                        onChange(value.filter((candidate) => candidate.id !== item.id));
                        if (editingId === item.id) {
                          resetComposer(item.type);
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <MediaBlockCard
                  item={editorMediaDraftToItem(item, { scope: "exam-editor-preview" }, index)}
                  vaultPngAssets={vaultPngAssets}
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="media-editor-tabs" role="tablist" aria-label="Media type">
          <button
            type="button"
            className={`ghost small ${activeTab === "svg" ? "active" : ""}`}
            onClick={() => setActiveTab("svg")}
          >
            SVG
          </button>
          <button
            type="button"
            className={`ghost small ${activeTab === "png" ? "active" : ""}`}
            onClick={() => setActiveTab("png")}
          >
            PNG
          </button>
        </div>

        {activeTab === "png" ? (
          <div className="media-editor-composer">
            <VaultPngPicker
              assets={vaultPngAssets}
              query={pngQuery}
              onQueryChange={setPngQuery}
              onSelect={(candidate) => handleSelectPng(candidate.relPath)}
              selectedRelPath={pngDraft.src}
            />
            <div className="media-editor-fields-grid">
              <label className="field">
                <span className="label">Label / alt</span>
                <input
                  className="text-input"
                  value={pngDraft.label}
                  onChange={(event) =>
                    updateDraft("png", (draft) => ({ ...draft, label: event.target.value }))
                  }
                  placeholder="Optional label for alt text"
                />
              </label>
            </div>
            <div className="media-editor-actions">
              <button
                type="button"
                className="ghost small"
                onClick={() => resetComposer("png")}
              >
                Clear
              </button>
              <button
                type="button"
                className="primary small"
                onClick={() => handleSaveDraft("png")}
                disabled={!pngDraft.src.trim()}
              >
                {editingId && pngDraft.id === editingId ? "Update PNG" : "Add PNG"}
              </button>
            </div>
          </div>
        ) : (
          <div className="media-editor-composer">
            <label className="field">
              <span className="label">Inline SVG</span>
              <AutoGrowTextarea
                className="text-input exam-textarea"
                rows={6}
                value={svgDraft.inlineSvg}
                onChange={(value) =>
                  updateDraft("svg", (draft) => ({ ...draft, inlineSvg: value }))
                }
                placeholder="<svg viewBox=&quot;0 0 10 10&quot;>...</svg>"
              />
            </label>
            {svgDraft.inlineSvg.trim() ? (
              <SvgPreviewBlock
                source={svgDraft.inlineSvg}
                className="media-editor-svg-preview"
              />
            ) : null}
            <div className="media-editor-actions">
              <button
                type="button"
                className="ghost small"
                onClick={() => resetComposer("svg")}
              >
                Clear
              </button>
              <button
                type="button"
                className="primary small"
                onClick={() => handleSaveDraft("svg")}
                disabled={!svgDraft.inlineSvg.trim()}
              >
                {editingId && svgDraft.id === editingId ? "Update SVG" : "Add SVG"}
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
};

const QaCardForm = ({
  card,
  validation,
  vaultPngAssets,
  onPromptChange,
  onAnswerChange,
  onHelpChange,
  onMediaChange,
}: QaCardFormProps) => (
  <div className="card-form">
    {renderPromptField(card, validation, onPromptChange)}
    <MediaEditor
      value={card.mediaItems ?? []}
      onChange={onMediaChange}
      vaultPngAssets={vaultPngAssets}
    />
    <label className="field">
      <span className="label">Answer</span>
      <AutoGrowTextarea
        className="text-input exam-textarea"
        rows={3}
        value={card.answer}
        onChange={onAnswerChange}
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
  vaultPngAssets,
  onPromptChange,
  onCorrectChange,
  onHelpChange,
  onMediaChange,
}: TfCardFormProps) => (
  <div className="card-form">
    {renderPromptField(card, validation, onPromptChange)}
    <MediaEditor
      value={card.mediaItems ?? []}
      onChange={onMediaChange}
      vaultPngAssets={vaultPngAssets}
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
  vaultPngAssets,
  onPromptChange,
  onOptionTextChange,
  onOptionToggle,
  onOptionSelect,
  onOptionAdd,
  onOptionRemove,
  onHelpChange,
  onMediaChange,
}: ChoiceCardFormProps) => (
  <div className="card-form">
    {renderPromptField(card, validation, onPromptChange)}
    <MediaEditor
      value={card.mediaItems ?? []}
      onChange={onMediaChange}
      vaultPngAssets={vaultPngAssets}
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
    {renderHelpField("Card help / hint", card.helpText ?? "", onHelpChange)}
  </div>
);

const ClozeCardForm = ({
  card,
  validation,
  vaultPngAssets,
  onPromptChange,
  onHelpChange,
  onMediaChange,
}: ClozeCardFormProps) => {
  const [showPreview, setShowPreview] = useState(false);
  const previewCard = useMemo(() => buildClozePreview(card.prompt), [card.prompt]);

  return (
    <div className="card-form">
      {renderPromptField(card, validation, onPromptChange)}
      <MediaEditor
        value={card.mediaItems ?? []}
        onChange={onMediaChange}
        vaultPngAssets={vaultPngAssets}
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
      {renderHelpField("Card help / hint", card.helpText ?? "", onHelpChange)}
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
  onHelpChange,
  onMediaChange,
  vaultPngAssets,
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
          {(card.mediaItems ?? []).length > 0 ? <span className="pill">Media</span> : null}
        </div>
      </header>
      {card.type === "qa" ? (
        <QaCardForm
          card={card}
          validation={validation}
          vaultPngAssets={vaultPngAssets}
          onPromptChange={onPromptChange}
          onAnswerChange={onAnswerChange}
          onHelpChange={onHelpChange}
          onMediaChange={onMediaChange}
        />
      ) : null}
      {card.type === "tf" ? (
        <TfCardForm
          card={card}
          validation={validation}
          vaultPngAssets={vaultPngAssets}
          onPromptChange={onPromptChange}
          onCorrectChange={onCorrectChange}
          onHelpChange={onHelpChange}
          onMediaChange={onMediaChange}
        />
      ) : null}
      {card.type === "m1" || card.type === "m2" ? (
        <ChoiceCardForm
          card={card}
          validation={validation}
          vaultPngAssets={vaultPngAssets}
          onPromptChange={onPromptChange}
          onOptionTextChange={onOptionTextChange}
          onOptionToggle={onOptionToggle}
          onOptionSelect={onOptionSelect}
          onOptionAdd={onOptionAdd}
          onOptionRemove={onOptionRemove}
          onHelpChange={onHelpChange}
          onMediaChange={onMediaChange}
        />
      ) : null}
      {card.type === "cl" || card.type === "cd" || card.type === "cld" ? (
        <ClozeCardForm
          card={card}
          validation={validation}
          vaultPngAssets={vaultPngAssets}
          onPromptChange={onPromptChange}
          onHelpChange={onHelpChange}
          onMediaChange={onMediaChange}
        />
      ) : null}
    </section>
  );
};
