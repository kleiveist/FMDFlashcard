import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetInternalDragSessionsForTest,
  DRAG_CHANNELS,
  endInternalDrag,
  readInternalDrag,
  startInternalDrag,
} from "./dragDrop";

type DataTransferMock = Pick<
  DataTransfer,
  "setData" | "getData" | "types" | "effectAllowed" | "dropEffect" | "setDragImage"
>;

const createDataTransfer = (overrides?: Partial<DataTransferMock>) => {
  const store = new Map<string, string>();
  const dataTransfer: DataTransferMock = {
    effectAllowed: "all",
    dropEffect: "none",
    setData: vi.fn((type: string, value: string) => {
      store.set(type, value);
    }),
    getData: vi.fn((type: string) => store.get(type) ?? ""),
    setDragImage: vi.fn(),
    types: [],
    ...overrides,
  };
  return dataTransfer as DataTransfer;
};

beforeEach(() => {
  __resetInternalDragSessionsForTest();
});

describe("dragDrop internal sessions", () => {
  it("keeps fallback payload when setData throws", () => {
    const dataTransfer = createDataTransfer({
      setData: vi.fn(() => {
        throw new Error("blocked");
      }),
      getData: vi.fn(() => ""),
    });
    const event = { dataTransfer };

    startInternalDrag(event, {
      channel: DRAG_CHANNELS.CLOZE_TOKEN,
      payload: { cardIndex: 1, tokenId: "token-1" },
      plainTextFallback: "token-1",
      effectAllowed: "move",
    });

    const payload = readInternalDrag<{ cardIndex: number; tokenId: string }>(event, {
      channel: DRAG_CHANNELS.CLOZE_TOKEN,
    });

    expect(payload).toEqual({ cardIndex: 1, tokenId: "token-1" });
  });

  it("uses in-memory fallback when getData is empty", () => {
    const dataTransfer = createDataTransfer({
      getData: vi.fn(() => ""),
    });
    const event = { dataTransfer };

    startInternalDrag(event, {
      channel: DRAG_CHANNELS.DATABASE_RECORD,
      payload: "record-a.md",
      plainTextFallback: "record-a.md",
    });

    const payload = readInternalDrag<string>(event, {
      channel: DRAG_CHANNELS.DATABASE_RECORD,
    });

    expect(payload).toBe("record-a.md");
  });

  it("isolates payloads by channel", () => {
    const event = { dataTransfer: createDataTransfer({ getData: vi.fn(() => "") }) };

    startInternalDrag(event, {
      channel: DRAG_CHANNELS.DATABASE_RECORD,
      payload: "record-a",
      plainTextFallback: "record-a",
    });
    startInternalDrag(event, {
      channel: DRAG_CHANNELS.DATABASE_COLUMN,
      payload: "column-b",
      plainTextFallback: "column-b",
    });

    const recordPayload = readInternalDrag<string>(event, {
      channel: DRAG_CHANNELS.DATABASE_RECORD,
    });
    const columnPayload = readInternalDrag<string>(event, {
      channel: DRAG_CHANNELS.DATABASE_COLUMN,
    });

    expect(recordPayload).toBe("record-a");
    expect(columnPayload).toBe("column-b");
  });

  it("cleans up sessions with endInternalDrag", () => {
    const event = { dataTransfer: createDataTransfer({ getData: vi.fn(() => "") }) };

    startInternalDrag(event, {
      channel: DRAG_CHANNELS.EXAM_CARD,
      payload: { taskId: "task-1", cardId: "card-2" },
    });

    endInternalDrag(DRAG_CHANNELS.EXAM_CARD);

    const payload = readInternalDrag<{ taskId: string; cardId: string }>(event, {
      channel: DRAG_CHANNELS.EXAM_CARD,
    });

    expect(payload).toBeNull();
  });
});
