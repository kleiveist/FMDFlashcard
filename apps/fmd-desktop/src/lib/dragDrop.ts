/**
 * @file apps/fmd-desktop/src/lib/dragDrop.ts
 *
 * Shared drag-and-drop helpers with defensive DataTransfer access
 * and in-memory fallback sessions for restricted runtimes.
 */

export const DRAG_CHANNELS = {
  CLOZE_TOKEN: "cloze-token",
  DATABASE_RECORD: "db-record",
  DATABASE_COLUMN: "db-column",
  DATABASE_VISIBLE_COLUMN: "db-visible-column",
  DATABASE_SORT_RULE: "db-sort-rule",
  MARKDOWN_BLOCK: "markdown-block",
  PREVIEW_FRONTMATTER_PROPERTY: "preview-frontmatter-property",
  PREVIEW_MARKDOWN_TAB: "preview-markdown-tab",
  EXAM_CARD_TYPE: "exam-card-type",
  EXAM_TASK: "exam-task",
  EXAM_CARD: "exam-card",
  EXAM_SELECTED_FILE: "exam-selected-file",
  VAULT_TREE: "vault-tree",
} as const;

export type DragChannel = (typeof DRAG_CHANNELS)[keyof typeof DRAG_CHANNELS];

type DragEventLike = {
  dataTransfer?: DataTransfer | null;
} | null | undefined;

type InternalDragSession = {
  payload: unknown;
  startedAt: number;
};

type InternalDragStartOptions<TPayload> = {
  channel: DragChannel;
  payload: TPayload;
  plainTextFallback?: string;
  effectAllowed?: DataTransfer["effectAllowed"];
};

type InternalDragReadOptions = {
  channel: DragChannel;
};

const INTERNAL_DRAG_MIME_PREFIX = "application/x-fmd-internal-drag-";
const INTERNAL_DRAG_SESSION_TTL_MS = 30_000;

const internalDragSessions = new Map<DragChannel, InternalDragSession>();

const resolveDataTransfer = (event: DragEventLike) => event?.dataTransfer ?? null;

const buildInternalDragMimeType = (channel: DragChannel) =>
  `${INTERNAL_DRAG_MIME_PREFIX}${channel}`;

const setDataSafe = (
  dataTransfer: DataTransfer,
  type: string,
  value: string,
) => {
  try {
    dataTransfer.setData(type, value);
    return true;
  } catch {
    return false;
  }
};

const getDataSafe = (dataTransfer: DataTransfer, type: string) => {
  try {
    return dataTransfer.getData(type);
  } catch {
    return "";
  }
};

const serializePayload = (payload: unknown) => {
  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
};

const parsePayload = (raw: string) => {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const getValidSessionPayload = (channel: DragChannel) => {
  const session = internalDragSessions.get(channel);
  if (!session) {
    return null;
  }
  if (Date.now() - session.startedAt > INTERNAL_DRAG_SESSION_TTL_MS) {
    internalDragSessions.delete(channel);
    return null;
  }
  return session.payload;
};

export const hasDragType = (event: DragEventLike, type: string) => {
  const dataTransfer = resolveDataTransfer(event);
  if (!dataTransfer) {
    return false;
  }
  try {
    return Array.from(dataTransfer.types ?? []).includes(type);
  } catch {
    return false;
  }
};

export const readPlainTextDragData = (event: DragEventLike) => {
  const dataTransfer = resolveDataTransfer(event);
  if (!dataTransfer) {
    return "";
  }
  return getDataSafe(dataTransfer, "text/plain");
};

export const setDropEffectSafe = (
  event: DragEventLike,
  effect: DataTransfer["dropEffect"],
) => {
  const dataTransfer = resolveDataTransfer(event);
  if (!dataTransfer) {
    return;
  }
  try {
    dataTransfer.dropEffect = effect;
  } catch {
    // ignore runtime restrictions
  }
};

export const setEffectAllowedSafe = (
  event: DragEventLike,
  effect: DataTransfer["effectAllowed"],
) => {
  const dataTransfer = resolveDataTransfer(event);
  if (!dataTransfer) {
    return;
  }
  try {
    dataTransfer.effectAllowed = effect;
  } catch {
    // ignore runtime restrictions
  }
};

export const setDragImageSafe = (
  event: DragEventLike,
  element: Element,
  x: number,
  y: number,
) => {
  const dataTransfer = resolveDataTransfer(event);
  if (!dataTransfer) {
    return;
  }
  try {
    dataTransfer.setDragImage(element, x, y);
  } catch {
    // ignore runtime restrictions
  }
};

export const startInternalDrag = <TPayload>(
  event: DragEventLike,
  { channel, payload, plainTextFallback, effectAllowed = "move" }: InternalDragStartOptions<TPayload>,
) => {
  internalDragSessions.set(channel, {
    payload,
    startedAt: Date.now(),
  });

  setEffectAllowedSafe(event, effectAllowed);

  const dataTransfer = resolveDataTransfer(event);
  if (!dataTransfer) {
    return;
  }

  const serializedPayload = serializePayload(payload);
  if (serializedPayload) {
    setDataSafe(dataTransfer, buildInternalDragMimeType(channel), serializedPayload);
  }

  if (typeof plainTextFallback === "string") {
    setDataSafe(dataTransfer, "text/plain", plainTextFallback);
  }
};

export const readInternalDrag = <TPayload>(
  event: DragEventLike,
  { channel }: InternalDragReadOptions,
): TPayload | null => {
  const dataTransfer = resolveDataTransfer(event);
  if (dataTransfer) {
    const rawPayload = getDataSafe(dataTransfer, buildInternalDragMimeType(channel));
    const parsedPayload = parsePayload(rawPayload);
    if (parsedPayload !== null) {
      internalDragSessions.set(channel, {
        payload: parsedPayload,
        startedAt: Date.now(),
      });
      return parsedPayload as TPayload;
    }
  }

  const fallbackPayload = getValidSessionPayload(channel);
  if (fallbackPayload === null) {
    return null;
  }
  return fallbackPayload as TPayload;
};

export const readInternalDragText = (
  event: DragEventLike,
  { channel }: InternalDragReadOptions,
) => {
  const payload = readInternalDrag<unknown>(event, { channel });
  if (typeof payload === "string") {
    return payload;
  }
  if (typeof payload === "number" || typeof payload === "boolean") {
    return String(payload);
  }

  const plainText = readPlainTextDragData(event);
  return plainText || "";
};

export const endInternalDrag = (channel: DragChannel) => {
  internalDragSessions.delete(channel);
};

export const __resetInternalDragSessionsForTest = () => {
  internalDragSessions.clear();
};
