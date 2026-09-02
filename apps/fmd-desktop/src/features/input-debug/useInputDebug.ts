import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useSyncExternalStore } from "react";

const INPUT_DEBUG_MAX_EVENTS = 5_000;
const INPUT_DEBUG_MAX_BYTES = 5 * 1024 * 1024;
const SELECTION_CHANGE_INTERVAL_MS = 100;
const DIAGNOSTIC_LOOKBACK_MS = 10_000;
const MAX_CLASS_LENGTH = 120;
const MAX_ID_LENGTH = 80;
const MAX_ARIA_LABEL_LENGTH = 120;
const MAX_ROLE_LENGTH = 60;
const MAX_DATA_LENGTH = 300;

type InputDebugPhase = "capture";
type InputDebugEventType =
  | "keydown"
  | "keyup"
  | "beforeinput"
  | "input"
  | "compositionstart"
  | "compositionupdate"
  | "compositionend"
  | "focusin"
  | "focusout"
  | "pointerdown"
  | "selectionchange";

type InputDescriptor = {
  kind: "input";
  valueLength: number | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  isPasswordField: boolean;
};

type ContentEditableSelectionDescriptor = {
  kind: "contenteditable";
  anchorOffset: number | null;
  focusOffset: number | null;
  isCollapsed: boolean | null;
};

type InputDebugTargetDescriptor = {
  tagName: string | null;
  id: string | null;
  className: string | null;
  role: string | null;
  ariaLabel: string | null;
  datasetKeys: string[];
  isContentEditable: boolean;
  inputType: string | null;
  inputScope: string | null;
};

export type InputDebugEventRecord = {
  sessionId: string;
  sessionStartedAt: number;
  seq: number;
  ts: number;
  eventType: InputDebugEventType;
  phase: InputDebugPhase;
  defaultPrevented: boolean;
  defaultPreventedAtCapture: boolean;
  composing: boolean;
  target: InputDebugTargetDescriptor | null;
  activeElement: InputDebugTargetDescriptor | null;
  inputMeta: InputDescriptor | null;
  contentEditableSelection: ContentEditableSelectionDescriptor | null;
  inputType: string | null;
  data: string | null;
  dataLength: number | null;
  key: string | null;
  code: string | null;
  repeat: boolean | null;
  modifiers: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  } | null;
  pointerType: string | null;
  button: number | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
};

type InputDebugSessionMetadata = {
  sessionId: string;
  startedAt: number;
  appMode: string;
  userAgent: string | null;
  platform: string | null;
  language: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  devicePixelRatio: number | null;
};

type InputDebugSnapshot = {
  enabled: boolean;
  redactContent: boolean;
  bufferCount: number;
  lastEventTs: number | null;
  diagnosticHints: string[];
};

type InputDebugExportResult = {
  path: string;
  eventCount: number;
};

type InputDebugInstrumentationOptions = {
  enabled: boolean;
  redactContent: boolean;
};

type InputDebugStoreState = {
  enabled: boolean;
  redactContent: boolean;
  records: InputDebugEventRecord[];
  recordSizes: number[];
  totalBytes: number;
  lastEventTs: number | null;
  sequence: number;
  composing: boolean;
  sessionId: string;
  sessionStartedAt: number;
  teardownListeners: (() => void) | null;
  lastSelectionChangeAt: number;
};

const INPUT_DEBUG_EVENT_TYPES = new Set<InputDebugEventType>([
  "keydown",
  "keyup",
  "beforeinput",
  "input",
  "compositionstart",
  "compositionupdate",
  "compositionend",
  "focusin",
  "focusout",
  "pointerdown",
  "selectionchange",
]);

const truncate = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, max)}...`;

const redactKeyboardKey = (key: string, redactContent: boolean) => {
  if (!redactContent) {
    return key;
  }
  if (key.length === 1) {
    return "<char>";
  }
  return key;
};

const isElementNode = (value: unknown): value is Element =>
  typeof Element !== "undefined" && value instanceof Element;

const isInputElement = (value: unknown): value is HTMLInputElement | HTMLTextAreaElement => {
  if (typeof HTMLInputElement !== "undefined" && value instanceof HTMLInputElement) {
    return true;
  }
  if (typeof HTMLTextAreaElement !== "undefined" && value instanceof HTMLTextAreaElement) {
    return true;
  }
  return false;
};

const isPasswordInput = (value: unknown): value is HTMLInputElement =>
  typeof HTMLInputElement !== "undefined" &&
  value instanceof HTMLInputElement &&
  value.type.toLowerCase() === "password";

const toElement = (target: EventTarget | null): Element | null => {
  if (!target) {
    return null;
  }
  if (isElementNode(target)) {
    return target;
  }
  if (typeof Node !== "undefined" && target instanceof Node) {
    return target.parentElement;
  }
  return null;
};

const resolveInputScope = (element: Element | null) => {
  if (!element || typeof element.closest !== "function") {
    return null;
  }
  const scoped = element.closest("[data-input-scope]");
  return scoped?.getAttribute("data-input-scope") ?? null;
};

const describeElement = (element: Element | null): InputDebugTargetDescriptor | null => {
  if (!element) {
    return null;
  }
  const htmlElement = element as HTMLElement;
  const role = htmlElement.getAttribute("role");
  const ariaLabel = htmlElement.getAttribute("aria-label");
  const className =
    typeof htmlElement.className === "string"
      ? htmlElement.className
      : Array.from(htmlElement.classList).join(" ");
  const datasetKeys =
    typeof htmlElement.dataset === "object" ? Object.keys(htmlElement.dataset) : [];

  return {
    tagName: element.tagName?.toLowerCase() ?? null,
    id: htmlElement.id ? truncate(htmlElement.id, MAX_ID_LENGTH) : null,
    className: className ? truncate(className, MAX_CLASS_LENGTH) : null,
    role: role ? truncate(role, MAX_ROLE_LENGTH) : null,
    ariaLabel: ariaLabel ? truncate(ariaLabel, MAX_ARIA_LABEL_LENGTH) : null,
    datasetKeys: datasetKeys.slice(0, 20),
    isContentEditable: Boolean(htmlElement.isContentEditable),
    inputType:
      typeof HTMLInputElement !== "undefined" && htmlElement instanceof HTMLInputElement
        ? htmlElement.type
        : null,
    inputScope: resolveInputScope(element),
  };
};

const resolveInputMeta = (element: Element | null): InputDescriptor | null => {
  if (!element || !isInputElement(element)) {
    return null;
  }
  const isPasswordField = isPasswordInput(element);
  return {
    kind: "input",
    valueLength: isPasswordField ? null : element.value.length,
    selectionStart: isPasswordField ? null : element.selectionStart,
    selectionEnd: isPasswordField ? null : element.selectionEnd,
    isPasswordField,
  };
};

const resolveContentEditableSelection = (
  targetElement: Element | null,
  activeElement: Element | null,
): ContentEditableSelectionDescriptor | null => {
  const focusElement =
    targetElement && (targetElement as HTMLElement).isContentEditable
      ? targetElement
      : activeElement && (activeElement as HTMLElement).isContentEditable
        ? activeElement
        : null;
  if (!focusElement || typeof window === "undefined") {
    return null;
  }
  const selection = window.getSelection();
  if (!selection) {
    return {
      kind: "contenteditable",
      anchorOffset: null,
      focusOffset: null,
      isCollapsed: null,
    };
  }
  return {
    kind: "contenteditable",
    anchorOffset: selection.anchorOffset,
    focusOffset: selection.focusOffset,
    isCollapsed: selection.isCollapsed,
  };
};

const resolveEventType = (event: Event): InputDebugEventType | null => {
  const candidate = event.type as InputDebugEventType;
  return INPUT_DEBUG_EVENT_TYPES.has(candidate) ? candidate : null;
};

const resolveTimestampToken = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
};

const buildSessionId = () => {
  const random = Math.random().toString(36).slice(2, 10);
  return `input-debug-${Date.now()}-${random}`;
};

const nowPerformance = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const enqueueMicrotask = (fn: () => void) => {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(fn);
    return;
  }
  Promise.resolve()
    .then(fn)
    .catch(() => undefined);
};

const createInputDebugStore = () => {
  const listeners = new Set<() => void>();
  const state: InputDebugStoreState = {
    enabled: false,
    redactContent: true,
    records: [],
    recordSizes: [],
    totalBytes: 0,
    lastEventTs: null,
    sequence: 0,
    composing: false,
    sessionId: buildSessionId(),
    sessionStartedAt: Date.now(),
    teardownListeners: null,
    lastSelectionChangeAt: 0,
  };

  let snapshot: InputDebugSnapshot = {
    enabled: state.enabled,
    redactContent: state.redactContent,
    bufferCount: 0,
    lastEventTs: null,
    diagnosticHints: [],
  };

  const computeDiagnosticHints = () => {
    if (state.records.length === 0) {
      return [] as string[];
    }
    const minTs = Date.now() - DIAGNOSTIC_LOOKBACK_MS;
    let hasDeleteBeforeInput = false;
    let hasBackspaceKeydown = false;
    let hasBlockedBackspace = false;

    for (let index = state.records.length - 1; index >= 0; index -= 1) {
      const record = state.records[index];
      if (record.ts < minTs) {
        break;
      }
      if (record.eventType === "beforeinput" && record.inputType === "deleteContentBackward") {
        hasDeleteBeforeInput = true;
      }
      if (record.eventType === "keydown" && record.key === "Backspace") {
        hasBackspaceKeydown = true;
        if (record.defaultPrevented) {
          hasBlockedBackspace = true;
        }
      }
    }

    const hints: string[] = [];
    if (hasDeleteBeforeInput && !hasBackspaceKeydown) {
      hints.push(
        "OSK delivers delete via beforeinput (without Backspace keydown). The editor should handle beforeinput/inputType.",
      );
    }
    if (hasBlockedBackspace) {
      hints.push(
        "Backspace is blocked by preventDefault. Check global shortcuts and key handlers.",
      );
    }
    return hints;
  };

  const emit = () => {
    snapshot = {
      enabled: state.enabled,
      redactContent: state.redactContent,
      bufferCount: state.records.length,
      lastEventTs: state.lastEventTs,
      diagnosticHints: computeDiagnosticHints(),
    };
    listeners.forEach((listener) => listener());
  };

  const pushRecord = (record: InputDebugEventRecord) => {
    const serializedSize = JSON.stringify(record).length;
    state.records.push(record);
    state.recordSizes.push(serializedSize);
    state.totalBytes += serializedSize;
    state.lastEventTs = record.ts;
    while (
      state.records.length > INPUT_DEBUG_MAX_EVENTS ||
      state.totalBytes > INPUT_DEBUG_MAX_BYTES
    ) {
      state.records.shift();
      const droppedSize = state.recordSizes.shift() ?? 0;
      state.totalBytes = Math.max(0, state.totalBytes - droppedSize);
    }
    emit();
  };

  const buildEventRecord = (event: Event): InputDebugEventRecord | null => {
    const eventType = resolveEventType(event);
    if (!eventType) {
      return null;
    }

    const activeElement =
      typeof document !== "undefined" && isElementNode(document.activeElement)
        ? document.activeElement
        : null;
    const targetElement =
      toElement(event.target) ?? (eventType === "selectionchange" ? activeElement : null);
    const inputMeta = resolveInputMeta(targetElement ?? activeElement);
    const isPasswordField = Boolean(
      (inputMeta && inputMeta.isPasswordField) ||
      isPasswordInput(targetElement) ||
      isPasswordInput(activeElement),
    );

    let data: string | null = null;
    let dataLength: number | null = null;
    let inputType: string | null = null;
    let key: string | null = null;
    let code: string | null = null;
    let repeat: boolean | null = null;
    let modifiers: InputDebugEventRecord["modifiers"] = null;
    let pointerType: string | null = null;
    let button: number | null = null;

    if ("key" in event && "code" in event) {
      const keyboardEvent = event as KeyboardEvent;
      key = redactKeyboardKey(keyboardEvent.key, state.redactContent || isPasswordField);
      code = keyboardEvent.code;
      repeat = keyboardEvent.repeat;
      modifiers = {
        ctrl: keyboardEvent.ctrlKey,
        alt: keyboardEvent.altKey,
        shift: keyboardEvent.shiftKey,
        meta: keyboardEvent.metaKey,
      };
    }

    if ("inputType" in event) {
      const inputEvent = event as InputEvent;
      inputType = typeof inputEvent.inputType === "string" ? inputEvent.inputType : null;
      if (typeof inputEvent.data === "string") {
        dataLength = inputEvent.data.length;
        if (!state.redactContent && !isPasswordField) {
          data = truncate(inputEvent.data, MAX_DATA_LENGTH);
        }
      } else if (inputEvent.data === null) {
        dataLength = 0;
      }
    } else if ("data" in event) {
      const compositionEvent = event as CompositionEvent;
      if (typeof compositionEvent.data === "string") {
        dataLength = compositionEvent.data.length;
        if (!state.redactContent && !isPasswordField) {
          data = truncate(compositionEvent.data, MAX_DATA_LENGTH);
        }
      }
    }

    if ("pointerType" in event) {
      const pointerEvent = event as PointerEvent;
      pointerType = pointerEvent.pointerType;
      button = pointerEvent.button;
    }

    const explicitComposing =
      eventType === "compositionstart"
        ? true
        : eventType === "compositionend"
          ? false
          : "isComposing" in event
            ? Boolean((event as { isComposing?: unknown }).isComposing)
            : state.composing;

    if (eventType === "compositionstart") {
      state.composing = true;
    } else if (eventType === "compositionend") {
      state.composing = false;
    }

    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : null;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : null;

    return {
      sessionId: state.sessionId,
      sessionStartedAt: state.sessionStartedAt,
      seq: state.sequence + 1,
      ts: Date.now(),
      eventType,
      phase: "capture",
      defaultPrevented: event.defaultPrevented,
      defaultPreventedAtCapture: event.defaultPrevented,
      composing: explicitComposing,
      target: describeElement(targetElement),
      activeElement: describeElement(activeElement),
      inputMeta,
      contentEditableSelection: resolveContentEditableSelection(targetElement, activeElement),
      inputType,
      data,
      dataLength,
      key,
      code,
      repeat,
      modifiers,
      pointerType,
      button,
      viewportWidth,
      viewportHeight,
    };
  };

  const handleCapturedEvent = (event: Event) => {
    if (!state.enabled) {
      return;
    }
    const eventType = resolveEventType(event);
    if (!eventType) {
      return;
    }
    if (eventType === "selectionchange") {
      const now = nowPerformance();
      if (now - state.lastSelectionChangeAt < SELECTION_CHANGE_INTERVAL_MS) {
        return;
      }
      state.lastSelectionChangeAt = now;
    }

    const record = buildEventRecord(event);
    if (!record) {
      return;
    }
    const preventedAtCapture = event.defaultPrevented;
    enqueueMicrotask(() => {
      record.defaultPreventedAtCapture = preventedAtCapture;
      record.defaultPrevented = event.defaultPrevented;
      state.sequence += 1;
      record.seq = state.sequence;
      pushRecord(record);
    });
  };

  const startListeners = () => {
    if (
      state.teardownListeners ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }
    const listener = (event: Event) => handleCapturedEvent(event);

    window.addEventListener("keydown", listener, true);
    window.addEventListener("keyup", listener, true);
    document.addEventListener("beforeinput", listener, true);
    document.addEventListener("input", listener, true);
    document.addEventListener("compositionstart", listener, true);
    document.addEventListener("compositionupdate", listener, true);
    document.addEventListener("compositionend", listener, true);
    document.addEventListener("focusin", listener, true);
    document.addEventListener("focusout", listener, true);
    document.addEventListener("pointerdown", listener, true);
    document.addEventListener("selectionchange", listener, true);

    state.teardownListeners = () => {
      window.removeEventListener("keydown", listener, true);
      window.removeEventListener("keyup", listener, true);
      document.removeEventListener("beforeinput", listener, true);
      document.removeEventListener("input", listener, true);
      document.removeEventListener("compositionstart", listener, true);
      document.removeEventListener("compositionupdate", listener, true);
      document.removeEventListener("compositionend", listener, true);
      document.removeEventListener("focusin", listener, true);
      document.removeEventListener("focusout", listener, true);
      document.removeEventListener("pointerdown", listener, true);
      document.removeEventListener("selectionchange", listener, true);
    };
  };

  const stopListeners = () => {
    state.teardownListeners?.();
    state.teardownListeners = null;
    state.composing = false;
  };

  const buildSessionMetadata = (includeSystemInfo: boolean): InputDebugSessionMetadata => {
    const base: InputDebugSessionMetadata = {
      sessionId: state.sessionId,
      startedAt: state.sessionStartedAt,
      appMode: import.meta.env.MODE,
      userAgent: null,
      platform: null,
      language: null,
      viewportWidth: null,
      viewportHeight: null,
      devicePixelRatio: null,
    };
    if (!includeSystemInfo || typeof window === "undefined") {
      return base;
    }
    base.userAgent = navigator.userAgent;
    base.platform = navigator.platform;
    base.language = navigator.language;
    base.viewportWidth = window.innerWidth;
    base.viewportHeight = window.innerHeight;
    base.devicePixelRatio = window.devicePixelRatio;
    return base;
  };

  const toJsonLines = (includeSystemInfo: boolean) => {
    const sessionEvent = {
      ts: Date.now(),
      eventType: "session-start",
      inputDebugEnabled: state.enabled,
      redactContent: state.redactContent,
      bufferCount: state.records.length,
      session: buildSessionMetadata(includeSystemInfo),
    };
    const lines = [JSON.stringify(sessionEvent)];
    state.records.forEach((record) => {
      lines.push(JSON.stringify(record));
    });
    return lines.join("\n");
  };

  const exportLog = async (includeSystemInfo: boolean): Promise<InputDebugExportResult | null> => {
    const suggestedName = `input-debug-${resolveTimestampToken(new Date())}.jsonl`;
    const selectedPath = await save({
      title: "Export Input Debug Log",
      defaultPath: suggestedName,
      filters: [{ name: "JSONL", extensions: ["jsonl"] }],
    });
    if (!selectedPath || typeof selectedPath !== "string") {
      return null;
    }
    const path = selectedPath.toLowerCase().endsWith(".jsonl")
      ? selectedPath
      : `${selectedPath}.jsonl`;
    const payload = toJsonLines(includeSystemInfo);
    const writtenPath = await invoke<string>("export_input_debug_log", {
      path,
      payload,
    });
    return {
      path: writtenPath,
      eventCount: state.records.length,
    };
  };

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    setEnabled: (enabled: boolean) => {
      const nextEnabled = Boolean(enabled);
      if (state.enabled === nextEnabled) {
        return;
      }
      state.enabled = nextEnabled;
      if (nextEnabled) {
        state.sessionId = buildSessionId();
        state.sessionStartedAt = Date.now();
        state.sequence = 0;
        state.composing = false;
        state.lastSelectionChangeAt = 0;
        startListeners();
      } else {
        stopListeners();
      }
      emit();
    },
    setRedactContent: (redactContent: boolean) => {
      const next = Boolean(redactContent);
      if (state.redactContent === next) {
        return;
      }
      state.redactContent = next;
      emit();
    },
    clear: () => {
      state.records = [];
      state.recordSizes = [];
      state.totalBytes = 0;
      state.lastEventTs = null;
      state.sequence = 0;
      emit();
    },
    exportLog,
  };
};

const inputDebugStore = createInputDebugStore();

export const useInputDebugInstrumentation = ({
  enabled,
  redactContent,
}: InputDebugInstrumentationOptions) => {
  useEffect(() => {
    inputDebugStore.setRedactContent(redactContent);
  }, [redactContent]);

  useEffect(() => {
    inputDebugStore.setEnabled(enabled);
  }, [enabled]);
};

export const useInputDebug = () => {
  const snapshot = useSyncExternalStore(
    inputDebugStore.subscribe,
    inputDebugStore.getSnapshot,
    inputDebugStore.getSnapshot,
  );

  const clear = useCallback(() => {
    inputDebugStore.clear();
  }, []);

  const exportLog = useCallback(
    async (includeSystemInfo: boolean) => inputDebugStore.exportLog(includeSystemInfo),
    [],
  );

  return {
    ...snapshot,
    clear,
    exportLog,
  };
};
