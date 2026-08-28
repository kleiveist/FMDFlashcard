/**
 * @file apps/fmd-desktop/src/components/previewMarkdownListCommands.ts
 *
 * Zweck:
 * - Kapselt listenbewusste DOM-Kommandos fuer den contentEditable-Markdown-Editor.
 */

export type CommandResult = {
  handled: boolean;
  changed: boolean;
};

const isListElement = (node: Element | null): node is HTMLOListElement | HTMLUListElement =>
  Boolean(node && (node.tagName === "OL" || node.tagName === "UL"));

const isMarkerElement = (node: Element | null) =>
  Boolean(node && node.classList.contains("md-list-marker"));

const rangeIntersectsNode = (range: Range, node: Node) => {
  try {
    return range.intersectsNode(node);
  } catch {
    return false;
  }
};

const resolveRangeListItem = (editor: HTMLElement, range: Range) => {
  const startElement = range.startContainer instanceof Element
    ? range.startContainer
    : range.startContainer.parentElement;
  const endElement = range.endContainer instanceof Element
    ? range.endContainer
    : range.endContainer.parentElement;
  const startListItem = startElement?.closest("li") ?? null;
  const endListItem = endElement?.closest("li") ?? null;
  if (!startListItem || !endListItem) {
    return null;
  }
  if (!editor.contains(startListItem) || !editor.contains(endListItem)) {
    return null;
  }
  return { startListItem, endListItem };
};

const selectionEndpointsInListItems = (editor: HTMLElement, range: Range) =>
  Boolean(resolveRangeListItem(editor, range));

const removeListMarkersFromSubtree = (root: ParentNode) => {
  if (root instanceof Element && root.classList.contains("md-list-marker")) {
    root.remove();
    return;
  }
  Array.from(root.querySelectorAll?.(".md-list-marker") ?? []).forEach((marker) => marker.remove());
};

const isNodeEffectivelyEmpty = (node: Node): boolean => {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.nodeValue ?? "").trim().length === 0;
  }
  if (!(node instanceof HTMLElement)) {
    return true;
  }
  if (node.tagName === "BR") {
    return true;
  }
  if (isMarkerElement(node)) {
    return true;
  }
  if (isListElement(node)) {
    return false;
  }
  return Array.from(node.childNodes).every((child) => isNodeEffectivelyEmpty(child));
};

const isListItemEmpty = (item: HTMLLIElement) =>
  Array.from(item.childNodes).every((child) => isNodeEffectivelyEmpty(child));

const setCaretAtStart = (target: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  let node: Node = target;
  let offset = 0;

  // Prefer first text node for natural typing behavior.
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  const firstText = walker.nextNode();
  if (firstText && firstText.nodeType === Node.TEXT_NODE) {
    node = firstText;
    offset = 0;
  } else if (target.childNodes.length > 0) {
    node = target;
    offset = 0;
  } else {
    target.appendChild(document.createElement("br"));
    node = target;
    offset = 0;
  }

  range.setStart(node, offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

const insertNodeAfter = (reference: Node, nextNode: Node) => {
  const parent = reference.parentNode;
  if (!parent) {
    return false;
  }
  parent.insertBefore(nextNode, reference.nextSibling);
  return true;
};

const resolveOutermostListWithinEditor = (editor: HTMLElement, listItem: HTMLLIElement) => {
  let currentList = listItem.parentElement;
  if (!isListElement(currentList)) {
    return null;
  }
  while (currentList.parentElement && currentList.parentElement !== editor) {
    const parentLi: HTMLLIElement | null = currentList.parentElement.closest("li");
    if (!parentLi || !editor.contains(parentLi)) {
      break;
    }
    const parentList: HTMLElement | null = parentLi.parentElement;
    if (!isListElement(parentList)) {
      break;
    }
    currentList = parentList;
  }
  return currentList;
};

const cleanupEmptyListItemsInternal = (editor: HTMLElement) => {
  const listItems = Array.from(editor.querySelectorAll("li")).reverse();
  listItems.forEach((item) => {
    if (isListItemEmpty(item)) {
      item.remove();
    }
  });
};

export const cleanupEmptyLists = (editor: HTMLElement) => {
  cleanupEmptyListItemsInternal(editor);
  const lists = Array.from(editor.querySelectorAll("ul,ol")).reverse();
  lists.forEach((list) => {
    const hasItems = Array.from(list.children).some((child) => child.tagName === "LI");
    if (!hasItems) {
      list.remove();
    }
  });
};

export const resolveMarkdownEditorSelectionRange = (editor: HTMLElement): Range | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
    return null;
  }
  return range;
};

export const resolveSelectedListItems = (editor: HTMLElement, range: Range): HTMLElement[] => {
  if (!selectionEndpointsInListItems(editor, range)) {
    return [];
  }
  const candidates = Array.from(editor.querySelectorAll("li")).filter((item) =>
    rangeIntersectsNode(range, item)
  );
  // Range.intersectsNode also matches ancestor list items when selecting nested items.
  // Prefer the deepest intersecting items so multi-select on nested siblings targets
  // the visible selected entries instead of their wrapping parent item.
  const deduped = candidates.filter(
    (item) => !candidates.some((other) => other !== item && item.contains(other)),
  );
  return deduped;
};

const normalizeMarkerText = (list: HTMLElement, item: HTMLElement, index: number) => {
  const marker = item.firstElementChild instanceof HTMLElement && isMarkerElement(item.firstElementChild)
    ? item.firstElementChild
    : null;
  const raw = (marker?.textContent ?? "").trim();
  if (list.tagName === "OL") {
    const match = raw.match(/^(\d+)([.)])$/);
    const parentDelimiter = list.getAttribute("data-md-ordered-delimiter") === ")" ? ")" : ".";
    const delimiter = match?.[2] === ")" || match?.[2] === "." ? match[2] : parentDelimiter;
    return `${index + 1}${delimiter} `;
  }

  const taskMatch = raw.match(/^([-+*])\s+\[([ xX])\]$/);
  if (taskMatch) {
    const bullet = taskMatch[1] ?? "-";
    const state = (taskMatch[2] ?? " ").toLowerCase() === "x" ? "x" : " ";
    return `${bullet} [${state}] `;
  }
  const bulletMatch = raw.match(/^([-+*])$/);
  const bullet = bulletMatch?.[1] ?? "-";
  return `${bullet} `;
};

export const normalizeEditableListMarkers = (editor: HTMLElement) => {
  Array.from(editor.querySelectorAll("ol,ul")).forEach((list) => {
    const items = Array.from(list.children).filter((child): child is HTMLLIElement =>
      child instanceof HTMLLIElement
    );
    items.forEach((item, index) => {
      let marker = item.firstElementChild instanceof HTMLElement && isMarkerElement(item.firstElementChild)
        ? item.firstElementChild
        : null;
      if (!marker) {
        marker = item.ownerDocument.createElement("span");
        marker.className = "md-list-marker";
        item.insertBefore(marker, item.firstChild);
      }
      marker.textContent = normalizeMarkerText(list as HTMLElement, item, index);
    });
  });
};

const createRootParagraphBlock = (doc: Document) => {
  const block = doc.createElement("div");
  return block;
};

const extractTailIntoParagraph = (item: HTMLLIElement, range: Range, paragraph: HTMLElement) => {
  const tailRange = range.cloneRange();
  tailRange.setEnd(item, item.childNodes.length);
  const fragment = tailRange.extractContents();
  removeListMarkersFromSubtree(fragment);
  paragraph.appendChild(fragment);
};

const canOperateInListContext = (editor: HTMLElement) => {
  const range = resolveMarkdownEditorSelectionRange(editor);
  if (!range) {
    return null;
  }
  const listContext = resolveRangeListItem(editor, range);
  if (!listContext) {
    return null;
  }
  if (listContext.startListItem !== listContext.endListItem) {
    return null;
  }
  const inMarker = (range.startContainer instanceof Node
    ? (range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement)
    : null)?.closest(".md-list-marker");
  if (inMarker) {
    return null;
  }
  return { range, listContext };
};

export const handleListSoftBreak = (editor: HTMLElement): CommandResult => {
  const resolved = canOperateInListContext(editor);
  if (!resolved) {
    return { handled: false, changed: false };
  }
  const { range } = resolved;
  const doc = editor.ownerDocument;
  if (range && !range.collapsed) {
    range.deleteContents();
  }

  const inserted = (doc as Document & { execCommand?: (command: string) => boolean }).execCommand
    ?.("insertLineBreak") ?? false;
  if (!inserted) {
    const nextRange = resolveMarkdownEditorSelectionRange(editor);
    if (!nextRange) {
      return { handled: true, changed: false };
    }
    const br = doc.createElement("br");
    nextRange.insertNode(br);
    nextRange.setStartAfter(br);
    nextRange.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(nextRange);
  }

  return { handled: true, changed: true };
};

export const handleListEnterExitToRootParagraph = (editor: HTMLElement): CommandResult => {
  const resolved = canOperateInListContext(editor);
  if (!resolved) {
    return { handled: false, changed: false };
  }
  const { range, listContext } = resolved;
  const activeItem = listContext.startListItem as HTMLLIElement;
  const outerList = resolveOutermostListWithinEditor(editor, activeItem);
  if (!outerList) {
    return { handled: false, changed: false };
  }

  if (!range.collapsed) {
    range.deleteContents();
  }

  const liveRange = resolveMarkdownEditorSelectionRange(editor);
  if (!liveRange) {
    return { handled: true, changed: false };
  }

  const paragraph = createRootParagraphBlock(editor.ownerDocument);
  extractTailIntoParagraph(activeItem, liveRange, paragraph);
  removeListMarkersFromSubtree(paragraph);

  const hasParagraphContent = Array.from(paragraph.childNodes).some((child) => !isNodeEffectivelyEmpty(child));
  if (!hasParagraphContent) {
    paragraph.appendChild(editor.ownerDocument.createElement("br"));
  }

  if (!insertNodeAfter(outerList, paragraph)) {
    return { handled: true, changed: false };
  }

  cleanupEmptyListItemsInternal(editor);
  cleanupEmptyLists(editor);
  setCaretAtStart(paragraph);

  return { handled: true, changed: true };
};

const groupContiguousItems = (items: HTMLElement[]) => {
  const groups: HTMLElement[][] = [];
  items.forEach((item) => {
    const previousGroup = groups.length > 0 ? groups[groups.length - 1] : undefined;
    if (!previousGroup) {
      groups.push([item]);
      return;
    }
    const last = previousGroup[previousGroup.length - 1];
    if (
      item.parentElement === last.parentElement &&
      last.nextElementSibling === item
    ) {
      previousGroup.push(item);
      return;
    }
    groups.push([item]);
  });
  return groups;
};

export const indentSelectedListItems = (editor: HTMLElement): CommandResult => {
  const range = resolveMarkdownEditorSelectionRange(editor);
  if (!range) {
    return { handled: false, changed: false };
  }
  const selectedItems = resolveSelectedListItems(editor, range);
  if (selectedItems.length === 0) {
    return { handled: false, changed: false };
  }
  let changed = false;

  groupContiguousItems(selectedItems).forEach((group) => {
    const first = group[0];
    const parentList = first.parentElement;
    if (!first || !isListElement(parentList)) {
      return;
    }
    const previousSibling = first.previousElementSibling;
    if (!(previousSibling instanceof HTMLLIElement)) {
      return;
    }
    const listTag = parentList.tagName.toLowerCase();
    let nestedList = Array.from(previousSibling.children).find(
      (child) => child.tagName.toLowerCase() === listTag,
    ) as HTMLOListElement | HTMLUListElement | undefined;
    if (!nestedList) {
      nestedList = first.ownerDocument.createElement(listTag) as HTMLOListElement | HTMLUListElement;
      if (parentList instanceof HTMLOListElement) {
        const delimiter = parentList.getAttribute("data-md-ordered-delimiter");
        if (delimiter === ")") {
          nestedList.setAttribute("data-md-ordered-delimiter", ")");
        }
      }
      previousSibling.appendChild(nestedList);
    }
    group.forEach((item) => {
      nestedList?.appendChild(item);
      changed = true;
    });
  });

  if (changed) {
    cleanupEmptyLists(editor);
  }
  return { handled: true, changed };
};

export const outdentSelectedListItems = (editor: HTMLElement): CommandResult => {
  const range = resolveMarkdownEditorSelectionRange(editor);
  if (!range) {
    return { handled: false, changed: false };
  }
  const selectedItems = resolveSelectedListItems(editor, range);
  if (selectedItems.length === 0) {
    return { handled: false, changed: false };
  }

  let changed = false;
  groupContiguousItems(selectedItems).forEach((group) => {
    const first = group[0];
    const parentList = first.parentElement;
    if (!first || !isListElement(parentList)) {
      return;
    }
    const parentListItem = parentList.parentElement;
    if (!(parentListItem instanceof HTMLLIElement)) {
      return;
    }
    const grandParentList = parentListItem.parentElement;
    if (!isListElement(grandParentList)) {
      return;
    }
    const insertionRef = parentListItem.nextSibling;
    group.forEach((item) => {
      grandParentList.insertBefore(item, insertionRef);
      changed = true;
    });
  });

  if (changed) {
    cleanupEmptyLists(editor);
  }
  return { handled: true, changed };
};
