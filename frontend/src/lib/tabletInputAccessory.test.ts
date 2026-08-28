// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  deleteBackwardAtTarget,
  insertBackslashAtTarget,
  resolveTabletAccessoryTarget,
} from "./tabletInputAccessory";

const mount = <T extends HTMLElement>(element: T) => {
  document.body.appendChild(element);
  return element;
};

const setSelection = (
  target: Node,
  start: number,
  end: number = start,
): Range => {
  const selection = window.getSelection();
  if (!selection) {
    throw new Error("Selection API unavailable");
  }
  const range = document.createRange();
  range.setStart(target, start);
  range.setEnd(target, end);
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
};

describe("tabletInputAccessory", () => {
  it("inserts a backslash in input fields and dispatches input events", () => {
    const input = mount(document.createElement("input"));
    input.type = "text";
    input.value = "alpha";
    input.setSelectionRange(2, 2);
    let inputEvents = 0;
    input.addEventListener("input", () => {
      inputEvents += 1;
    });

    const changed = insertBackslashAtTarget(input);

    expect(changed).toBe(true);
    expect(input.value).toBe("al\\pha");
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(3);
    expect(inputEvents).toBe(1);
    input.remove();
  });

  it("deletes the selected input range on soft backspace", () => {
    const input = mount(document.createElement("input"));
    input.type = "search";
    input.value = "abcdef";
    input.setSelectionRange(2, 5);

    const changed = deleteBackwardAtTarget(input);

    expect(changed).toBe(true);
    expect(input.value).toBe("abf");
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(2);
    input.remove();
  });

  it("blocks backslash insert for password inputs while keeping backspace enabled", () => {
    const input = mount(document.createElement("input"));
    input.type = "password";
    input.value = "secret";
    input.setSelectionRange(3, 3);

    const inserted = insertBackslashAtTarget(input);
    const deleted = deleteBackwardAtTarget(input);

    expect(inserted).toBe(false);
    expect(deleted).toBe(true);
    expect(input.value).toBe("seret");
    input.remove();
  });

  it("inserts and deletes inside contenteditable targets", () => {
    const editor = mount(document.createElement("div"));
    editor.contentEditable = "true";
    editor.textContent = "ab";
    const firstText = editor.firstChild;
    if (!firstText) {
      throw new Error("Missing text node");
    }
    setSelection(firstText, 1, 1);

    const inserted = insertBackslashAtTarget(editor);
    expect(inserted).toBe(true);
    expect(editor.textContent).toBe("a\\b");

    const rangeAtEnd = document.createRange();
    rangeAtEnd.selectNodeContents(editor);
    rangeAtEnd.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(rangeAtEnd);

    const deleted = deleteBackwardAtTarget(editor);
    expect(deleted).toBe(true);
    expect(editor.textContent).toBe("a\\");
    editor.remove();
  });

  it("resolves only supported editable targets", () => {
    const checkbox = mount(document.createElement("input"));
    checkbox.type = "checkbox";
    expect(resolveTabletAccessoryTarget(checkbox)).toBeNull();

    const textarea = mount(document.createElement("textarea"));
    expect(resolveTabletAccessoryTarget(textarea)).toBe(textarea);

    const contentEditableHost = mount(document.createElement("div"));
    contentEditableHost.setAttribute("contenteditable", "true");
    contentEditableHost.contentEditable = "true";
    const child = document.createElement("span");
    child.textContent = "x";
    contentEditableHost.appendChild(child);
    expect(resolveTabletAccessoryTarget(child)).toBe(contentEditableHost);

    const roleTextbox = mount(document.createElement("div"));
    roleTextbox.setAttribute("role", "textbox");
    roleTextbox.setAttribute("aria-multiline", "true");
    const roleTextboxChild = document.createElement("span");
    roleTextboxChild.textContent = "value";
    roleTextbox.appendChild(roleTextboxChild);
    expect(resolveTabletAccessoryTarget(roleTextboxChild)).toBe(roleTextbox);

    checkbox.remove();
    textarea.remove();
    contentEditableHost.remove();
    roleTextbox.remove();
  });
});
