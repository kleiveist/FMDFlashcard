export const TABLET_ACCESSORY_BREAKPOINT = 980;

type InputLike = HTMLInputElement | HTMLTextAreaElement;

export type TabletAccessoryTarget = InputLike | HTMLElement;

export type TabletAccessoryMutationOptions = {
  fallbackRange?: Range | null;
};

const SUPPORTED_INPUT_TYPES = new Set([
  "text",
  "search",
  "url",
  "email",
  "tel",
  "number",
  "password",
]);
const CONTENTEDITABLE_HOST_SELECTOR =
  '[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]';
const ARIA_TEXTBOX_SELECTOR = '[role="textbox"], [aria-multiline="true"]';

const isInputLike = (target: TabletAccessoryTarget): target is InputLike =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

const isEditableTextArea = (target: HTMLTextAreaElement) => !target.disabled && !target.readOnly;

const normalizeInputType = (target: HTMLInputElement) =>
  (target.getAttribute("type") ?? "text").toLowerCase();

const isEditableTextInput = (target: HTMLInputElement) => {
  if (target.disabled || target.readOnly) {
    return false;
  }
  return SUPPORTED_INPUT_TYPES.has(normalizeInputType(target));
};

const isNodeInside = (root: HTMLElement, node: Node) => node === root || root.contains(node);

const isRangeInsideTarget = (range: Range, target: HTMLElement) =>
  isNodeInside(target, range.startContainer) && isNodeInside(target, range.endContainer);

const hasEnabledContentEditableAttribute = (element: HTMLElement) => {
  const raw = element.getAttribute("contenteditable");
  if (raw === null) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "" || normalized === "true" || normalized === "plaintext-only";
};

const isElementContentEditable = (element: HTMLElement) =>
  element.isContentEditable || hasEnabledContentEditableAttribute(element);

const isDisabledAriaTextbox = (element: HTMLElement) =>
  element.getAttribute("aria-disabled")?.trim().toLowerCase() === "true";

const isReadonlyAriaTextbox = (element: HTMLElement) =>
  element.getAttribute("aria-readonly")?.trim().toLowerCase() === "true";

const hasTextboxSemantics = (element: HTMLElement) => {
  const role = element.getAttribute("role")?.trim().toLowerCase();
  return role === "textbox" || element.hasAttribute("aria-multiline");
};

const isEditableAriaTextbox = (element: HTMLElement) =>
  hasTextboxSemantics(element) &&
  !isDisabledAriaTextbox(element) &&
  !isReadonlyAriaTextbox(element);

const resolveContentEditableHost = (source: HTMLElement): HTMLElement | null => {
  if (isElementContentEditable(source)) {
    return source;
  }
  const host = source.closest<HTMLElement>(CONTENTEDITABLE_HOST_SELECTOR);
  if (!host || !isElementContentEditable(host)) {
    return null;
  }
  const blockedAncestor = source.closest<HTMLElement>('[contenteditable="false"]');
  if (blockedAncestor && blockedAncestor !== host && host.contains(blockedAncestor)) {
    return null;
  }
  return host;
};

const resolveAriaTextboxHost = (source: HTMLElement): HTMLElement | null => {
  if (isEditableAriaTextbox(source)) {
    return source;
  }
  const host = source.closest<HTMLElement>(ARIA_TEXTBOX_SELECTOR);
  if (!host || !isEditableAriaTextbox(host)) {
    return null;
  }
  return host;
};

export const resolveTabletAccessoryTarget = (
  source: EventTarget | null,
): TabletAccessoryTarget | null => {
  if (!(source instanceof Node)) {
    return null;
  }
  const element = source instanceof HTMLElement ? source : source.parentElement;
  if (!element) {
    return null;
  }
  if (element instanceof HTMLInputElement && isEditableTextInput(element)) {
    return element;
  }
  if (element instanceof HTMLTextAreaElement && isEditableTextArea(element)) {
    return element;
  }
  const ariaTextboxHost = resolveAriaTextboxHost(element);
  if (ariaTextboxHost) {
    return ariaTextboxHost;
  }
  return resolveContentEditableHost(element);
};

export const isContentEditableTarget = (
  target: TabletAccessoryTarget | null,
): target is HTMLElement =>
  Boolean(target && !isInputLike(target) && isElementContentEditable(target));

export const isPasswordInputTarget = (target: TabletAccessoryTarget) =>
  target instanceof HTMLInputElement && normalizeInputType(target) === "password";

export const canInsertBackslash = (target: TabletAccessoryTarget) => !isPasswordInputTarget(target);

export const focusTabletAccessoryTarget = (target: TabletAccessoryTarget) => {
  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
  }
};

const setNativeInputValue = (target: InputLike, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), "value");
  const setter = descriptor?.set;
  if (setter) {
    setter.call(target, value);
    return;
  }
  target.value = value;
};

const dispatchInputMutation = (target: EventTarget, inputType: string, data: string | null) => {
  try {
    target.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: false,
        inputType,
        data,
      }),
    );
    return;
  } catch {
    target.dispatchEvent(new Event("input", { bubbles: true }));
  }
};

const insertBackslashInInputLike = (target: InputLike) => {
  const selectionStart = target.selectionStart;
  const selectionEnd = target.selectionEnd;
  if (selectionStart === null || selectionEnd === null) {
    return false;
  }
  const nextValue = target.value.slice(0, selectionStart) + "\\" + target.value.slice(selectionEnd);
  const caret = selectionStart + 1;
  setNativeInputValue(target, nextValue);
  target.setSelectionRange(caret, caret);
  dispatchInputMutation(target, "insertText", "\\");
  return true;
};

const deleteBackwardInInputLike = (target: InputLike) => {
  const selectionStart = target.selectionStart;
  const selectionEnd = target.selectionEnd;
  if (selectionStart === null || selectionEnd === null) {
    return false;
  }
  if (selectionStart === 0 && selectionEnd === 0) {
    return false;
  }
  let deleteStart = selectionStart;
  if (selectionStart === selectionEnd) {
    deleteStart = Math.max(0, selectionStart - 1);
  }
  const nextValue = target.value.slice(0, deleteStart) + target.value.slice(selectionEnd);
  setNativeInputValue(target, nextValue);
  target.setSelectionRange(deleteStart, deleteStart);
  dispatchInputMutation(target, "deleteContentBackward", null);
  return true;
};

const rangeAtTargetEnd = (target: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(target);
  range.collapse(false);
  return range;
};

const resolveSelectionRange = (target: HTMLElement, fallbackRange?: Range | null) => {
  const selection = window.getSelection();
  if (!selection) {
    return null;
  }
  if (selection.rangeCount > 0) {
    const currentRange = selection.getRangeAt(0);
    if (isRangeInsideTarget(currentRange, target)) {
      return { selection, range: currentRange.cloneRange() };
    }
  }
  if (fallbackRange && isRangeInsideTarget(fallbackRange, target)) {
    const range = fallbackRange.cloneRange();
    selection.removeAllRanges();
    selection.addRange(range);
    return { selection, range };
  }
  const range = rangeAtTargetEnd(target);
  selection.removeAllRanges();
  selection.addRange(range);
  return { selection, range };
};

type TextPosition = {
  node: Text;
  offset: number;
};

const resolveRightmostTextPosition = (node: Node | null): TextPosition | null => {
  if (!node) {
    return null;
  }
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;
    if (textNode.data.length === 0) {
      return null;
    }
    return { node: textNode, offset: textNode.data.length - 1 };
  }
  for (let i = node.childNodes.length - 1; i >= 0; i -= 1) {
    const position = resolveRightmostTextPosition(node.childNodes.item(i));
    if (position) {
      return position;
    }
  }
  return null;
};

const resolvePreviousTextPosition = (
  root: HTMLElement,
  container: Node,
  offset: number,
): TextPosition | null => {
  if (container.nodeType === Node.TEXT_NODE) {
    const textNode = container as Text;
    if (offset > 0) {
      return { node: textNode, offset: offset - 1 };
    }
  }
  if (container.nodeType === Node.ELEMENT_NODE && offset > 0) {
    const element = container as Element;
    for (let i = Math.min(offset - 1, element.childNodes.length - 1); i >= 0; i -= 1) {
      const position = resolveRightmostTextPosition(element.childNodes.item(i));
      if (position) {
        return position;
      }
    }
  }
  let current: Node | null = container;
  while (current && current !== root) {
    let previousSibling = current.previousSibling;
    while (previousSibling) {
      const position = resolveRightmostTextPosition(previousSibling);
      if (position) {
        return position;
      }
      previousSibling = previousSibling.previousSibling;
    }
    current = current.parentNode;
  }
  return null;
};

const insertBackslashInContentEditable = (
  target: HTMLElement,
  options?: TabletAccessoryMutationOptions,
) => {
  const resolved = resolveSelectionRange(target, options?.fallbackRange);
  if (!resolved) {
    return false;
  }
  const { selection, range } = resolved;
  range.deleteContents();
  const textNode = document.createTextNode("\\");
  range.insertNode(textNode);
  const caretRange = document.createRange();
  caretRange.setStart(textNode, textNode.data.length);
  caretRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caretRange);
  dispatchInputMutation(target, "insertText", "\\");
  return true;
};

const deleteBackwardInContentEditable = (
  target: HTMLElement,
  options?: TabletAccessoryMutationOptions,
) => {
  const resolved = resolveSelectionRange(target, options?.fallbackRange);
  if (!resolved) {
    return false;
  }
  const { selection, range } = resolved;
  if (!range.collapsed) {
    range.deleteContents();
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    dispatchInputMutation(target, "deleteContentBackward", null);
    return true;
  }
  const selectionWithModify = selection as Selection & {
    modify?: (
      alter: "move" | "extend",
      direction: "forward" | "backward" | "left" | "right",
      granularity:
        | "character"
        | "word"
        | "sentence"
        | "line"
        | "paragraph"
        | "lineboundary"
        | "sentenceboundary"
        | "paragraphboundary"
        | "documentboundary",
    ) => void;
  };
  if (typeof selectionWithModify.modify === "function") {
    selectionWithModify.modify("extend", "backward", "character");
    if (!selection.isCollapsed) {
      const anchorNode = selection.anchorNode;
      const focusNode = selection.focusNode;
      if (
        anchorNode &&
        focusNode &&
        isNodeInside(target, anchorNode) &&
        isNodeInside(target, focusNode)
      ) {
        selection.deleteFromDocument();
        dispatchInputMutation(target, "deleteContentBackward", null);
        return true;
      }
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
  const previousPosition = resolvePreviousTextPosition(
    target,
    range.startContainer,
    range.startOffset,
  );
  if (!previousPosition) {
    return false;
  }
  const deleteRange = document.createRange();
  deleteRange.setStart(previousPosition.node, previousPosition.offset);
  deleteRange.setEnd(range.startContainer, range.startOffset);
  deleteRange.deleteContents();
  deleteRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(deleteRange);
  dispatchInputMutation(target, "deleteContentBackward", null);
  return true;
};

export const insertBackslashAtTarget = (
  target: TabletAccessoryTarget,
  options?: TabletAccessoryMutationOptions,
) => {
  if (isPasswordInputTarget(target)) {
    return false;
  }
  if (isInputLike(target)) {
    return insertBackslashInInputLike(target);
  }
  return insertBackslashInContentEditable(target, options);
};

export const deleteBackwardAtTarget = (
  target: TabletAccessoryTarget,
  options?: TabletAccessoryMutationOptions,
) => {
  if (isInputLike(target)) {
    return deleteBackwardInInputLike(target);
  }
  return deleteBackwardInContentEditable(target, options);
};
