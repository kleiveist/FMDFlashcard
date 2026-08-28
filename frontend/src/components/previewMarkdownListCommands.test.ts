// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  cleanupEmptyLists,
  handleListEnterExitToRootParagraph,
  handleListSoftBreak,
  indentSelectedListItems,
  normalizeEditableListMarkers,
  outdentSelectedListItems,
} from "./previewMarkdownListCommands";

const setSelection = (range: Range) => {
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

const buildListEditor = () => {
  const editor = document.createElement("div");
  editor.setAttribute("contenteditable", "true");
  const list = document.createElement("ol");
  list.setAttribute("data-md-ordered-delimiter", ")");
  ["Alpha", "Beta", "Gamma"].forEach((text, index) => {
    const li = document.createElement("li");
    const marker = document.createElement("span");
    marker.className = "md-list-marker";
    marker.textContent = `${index + 1}) `;
    li.appendChild(marker);
    li.appendChild(document.createTextNode(text));
    list.appendChild(li);
  });
  editor.appendChild(list);
  document.body.appendChild(editor);
  return editor;
};

describe("previewMarkdownListCommands", () => {
  it("exits list items to a root paragraph on Enter", () => {
    const editor = buildListEditor();
    const list = editor.querySelector("ol") as HTMLOListElement;
    const firstItem = list.children[0] as HTMLLIElement;
    const textNode = firstItem.childNodes[1] as Text;
    const range = document.createRange();
    range.setStart(textNode, 2);
    range.collapse(true);
    setSelection(range);

    const result = handleListEnterExitToRootParagraph(editor);

    expect(result.handled).toBe(true);
    expect(result.changed).toBe(true);
    expect(editor.firstElementChild?.tagName).toBe("OL");
    expect(editor.lastElementChild?.tagName).toBe("DIV");
    expect((editor.lastElementChild?.textContent ?? "").startsWith("pha")).toBe(true);
    expect((firstItem.textContent ?? "")).toContain("Al");

    editor.remove();
  });

  it("inserts a soft break inside the same list item on Shift+Enter", () => {
    const editor = buildListEditor();
    const firstItem = editor.querySelector("li") as HTMLLIElement;
    const textNode = firstItem.childNodes[1] as Text;
    const range = document.createRange();
    range.setStart(textNode, 2);
    range.collapse(true);
    setSelection(range);

    const result = handleListSoftBreak(editor);

    expect(result.handled).toBe(true);
    expect(result.changed).toBe(true);
    expect(firstItem.querySelector("br")).toBeTruthy();

    editor.remove();
  });

  it("indents and outdents selected list items as a group", () => {
    const editor = buildListEditor();
    const items = Array.from(editor.querySelectorAll("li"));
    const secondText = items[1]?.childNodes[1] as Text;
    const thirdText = items[2]?.childNodes[1] as Text;
    const range = document.createRange();
    range.setStart(secondText, 0);
    range.setEnd(thirdText, thirdText.nodeValue?.length ?? 0);
    setSelection(range);

    const indentResult = indentSelectedListItems(editor);
    normalizeEditableListMarkers(editor);

    expect(indentResult.handled).toBe(true);
    expect(indentResult.changed).toBe(true);
    const rootListAfterIndent = editor.firstElementChild as HTMLOListElement | null;
    const topItemsAfterIndent = Array.from(rootListAfterIndent?.children ?? []);
    expect(topItemsAfterIndent).toHaveLength(1);
    const nestedList = (topItemsAfterIndent[0] as HTMLElement).querySelector("ol");
    expect(nestedList).toBeTruthy();
    expect(nestedList?.children).toHaveLength(2);

    const nestedItems = Array.from(nestedList?.children ?? []).filter((node): node is HTMLLIElement =>
      node instanceof HTMLLIElement
    );
    const outdentRange = document.createRange();
    const outdentStartText = nestedItems[0]?.childNodes[1] as Text;
    const outdentEndText = nestedItems[1]?.childNodes[1] as Text;
    outdentRange.setStart(outdentStartText, 0);
    outdentRange.setEnd(outdentEndText, outdentEndText.nodeValue?.length ?? 0);
    setSelection(outdentRange);

    const outdentResult = outdentSelectedListItems(editor);
    normalizeEditableListMarkers(editor);
    cleanupEmptyLists(editor);

    expect(outdentResult.handled).toBe(true);
    expect(outdentResult.changed).toBe(true);
    const rootListAfterOutdent = editor.firstElementChild as HTMLOListElement | null;
    const topItemsAfterOutdent = Array.from(rootListAfterOutdent?.children ?? []);
    expect(topItemsAfterOutdent).toHaveLength(3);

    editor.remove();
  });

  it("renumbers ordered markers while preserving the ) delimiter", () => {
    const editor = document.createElement("div");
    const list = document.createElement("ol");
    list.setAttribute("data-md-ordered-delimiter", ")");
    ["A", "B"].forEach((text) => {
      const li = document.createElement("li");
      li.appendChild(document.createTextNode(text));
      list.appendChild(li);
    });
    editor.appendChild(list);

    normalizeEditableListMarkers(editor);

    const markers = Array.from(editor.querySelectorAll(".md-list-marker")).map((node) =>
      node.textContent
    );
    expect(markers).toEqual(["1) ", "2) "]);
  });
});
