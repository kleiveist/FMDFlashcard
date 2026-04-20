/**
 * @file apps/fmd-desktop/src/pages/exam-editor/components/CardPalette.tsx
 */

import type { DragEvent } from "react";
import type { CardType } from "../../../features/exam-editor/types";
import { serializeCardTypeLabel } from "../../../features/exam-editor/serializer";
import { DRAG_CHANNELS, endInternalDrag, startInternalDrag } from "../../../lib/dragDrop";

const CARD_TYPES: CardType[] = ["qa", "tf", "m1", "m2", "cl", "cd", "cld"];

const CARD_DESCRIPTIONS: Record<CardType, string> = {
  qa: "Question + Answer",
  tf: "True/False",
  m1: "Multiple choice (1 correct)",
  m2: "Multiple choice (2+ correct)",
  cl: "Cloze (typed blanks)",
  cd: "Cloze (drag tokens)",
  cld: "Cloze (typed + drag)",
};

type CardPaletteProps = {
  onQuickAdd: (type: CardType) => void;
};

const handleDragStart = (event: DragEvent<HTMLButtonElement>, type: CardType) => {
  startInternalDrag(event, {
    channel: DRAG_CHANNELS.EXAM_CARD_TYPE,
    payload: type,
    plainTextFallback: type,
    effectAllowed: "copy",
  });
  try {
    event.dataTransfer.setData("application/x-fmd-card-type", type);
  } catch {
    // ignore restricted dataTransfer implementations
  }
};

export const CardPalette = ({ onQuickAdd }: CardPaletteProps) => (
  <aside className="panel exam-editor-panel card-palette">
    <div className="panel-body">
      <div className="card-palette-grid" role="list">
        {CARD_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className="card-palette-item"
            draggable
            onDragStart={(event) => handleDragStart(event, type)}
            onDragEnd={() => endInternalDrag(DRAG_CHANNELS.EXAM_CARD_TYPE)}
            onClick={() => onQuickAdd(type)}
            aria-label={`Add ${serializeCardTypeLabel(type)} card`}
            title={CARD_DESCRIPTIONS[type]}
            role="listitem"
          >
            <span className="card-type-badge">{serializeCardTypeLabel(type)}</span>
            <span className="card-type-label">{CARD_DESCRIPTIONS[type]}</span>
          </button>
        ))}
      </div>
    </div>
  </aside>
);
